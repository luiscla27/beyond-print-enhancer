#!/usr/bin/env python
"""model_call_telemetry.py — bound, observe and cancel the model calls the `scripts` area makes.

WHY THIS EXISTS (track `runtime_perf_20261015`). Four tracked scripts dial a model endpoint
directly (three over HTTP, one over a subprocess) and a fifth reaches its seat through one of
them; until this file none of them emitted a single terminal event: the whole area's model
traffic was invisible (`scripts/perf/runtime-perf-baseline.md` F-3 — the framework's relay store
holds 45,589 terminal rows and `producer=reasonix_proxy` on 45,589 of them, so a script-originated
call appears there ZERO times). What stood in for a bound was a socket timeout — and a socket
timeout bounds each READ, not the total call, so a slowly-trickling response could outlive its own
timeout indefinitely.

WHAT IT GUARANTEES
  * ONE terminal record per logical call, whatever the outcome: `success`, `error`, `timeout` or
    `cancelled`. A failure, a budget expiry and a cancel are all terminal telemetry, never an
    omission (a stack trace tells you the call died; it never tells you how long it lived).
  * A TOTAL deadline, not a per-read one: the transport runs on a worker thread and the caller is
    released at the deadline whether or not the worker has returned, so a late response is
    DISCARDED and the terminal event is still written exactly once.
  * A real cancellation signal: `CancelToken.set()` releases the caller immediately and closes the
    registered transport handle when one exists — it is not a label.
  * A DEADLINE TEARS THE TRANSPORT DOWN, it does not merely release the caller. Every path that
    releases the caller without a value fires the attempt's own abort token first, so a transport
    that accepts `abort=` can register its handle (`response.close`) and be CLOSED at the deadline.
    Measured 2026-10-17 (cycle 2) before this: the caller was released at 0.25 s against a 0.2 s
    budget and the trickling transport kept running to 1.562 s, then returned a value nobody read —
    the exact "a socket timeout bounds each READ, not the total call" disease this file exists to end,
    cured in the Node half and not here. The caller's `cancel` token is never set by a deadline: a
    budget expiry must not be reported as a cancellation.
  * A session budget SEPARATE from the per-attempt one, so a retry chain cannot accumulate past the
    hard cap. A `timeout` or `cancelled` attempt is never auto-retried; only a retryable `error` is.
  * Progress telemetry for long calls (`model_call_started` -> `model_call_progress_tick` ->
    `model_call_terminal`), which is the only surface a headless CLI gate has.
  * A REDACTED fingerprint: the request body is hashed, never stored and never logged, so the store
    can identify a repeat without carrying a prompt.

BUDGETS ARE DATA. Every cap comes from `scripts/perf/budgets.json`, read by this file AND by
`scripts/perf/model_call_telemetry.js`, so the Node and Python halves cannot drift. A site that
needs a cap above its class default must declare an override WITH a reason in that file; the reason
is not decoration — the report prints every override beside the class cap it exceeds.

USAGE (as a library — the call sites import it)
    from model_call_telemetry import call_model, CancelToken

    result = call_model(
        site="scripts/muse_gate.py",
        role="reasonix-agent", model="muse-spark-1.2-contributor", provider="muse",
        fingerprint_material=prompt,
        transport=lambda timeout_s, abort=None: _post(req, timeout_s, abort),   # urllib / subprocess
        # `abort` is optional and ADDITIVE: a transport that does not accept it is called exactly as
        # before. Accepting it is what lets a budget expiry CLOSE your handle instead of abandoning it
        # (scripts/byok_vision_gate.py and scripts/drag_ux_visual_gate.py register `response.close`).
    )
    if result.ok:
        ... result.value ...

USAGE (as a CLI — the validation sample and the store's own inspect mode)
    python scripts/perf/model_call_telemetry.py --sample 120        # synthetic transport, real path
    python scripts/perf/model_call_telemetry.py --sample 120 --store temp/perf/model_calls.jsonl
    python scripts/perf/model_call_telemetry.py --classes           # the effective budget table

Exit codes: 0 ok; 1 refused (bad site/class, no override reason, store unreadable); 2 usage.
"""
from __future__ import annotations

import argparse
import hashlib
import inspect
import json
import os
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
BUDGETS_PATH = HERE / "budgets.json"
DEFAULT_STORE = ROOT / "temp" / "perf" / "model_calls.jsonl"
STORE_ENV = "MODEL_CALL_TELEMETRY_STORE"

#: The terminal statuses the schema allows. A status outside this set is a defect, not a new state.
STATUSES = ("success", "error", "timeout", "cancelled")

#: How long the supervisor waits, after releasing the caller, for the worker to unwind before it
#: stops waiting on it. The worker is a daemon: an abandoned worker can never hold the process open,
#: which is what makes "a cancel does not hang" a property of the code rather than of the provider.
UNWIND_GRACE_S = 2.0

#: Poll interval of the supervising loop. It is the granularity at which a cancel is FELT by the
#: caller, so it is deliberately far below any budget in budgets.json.
_POLL_S = 0.05


class BudgetError(RuntimeError):
    """The declared budget data is missing, malformed, or an override states no reason."""


def load_budgets(path=None):
    """The declared budget source. Raises `BudgetError` rather than inventing a default: a call
    with no declared budget is exactly the state this track exists to end."""
    p = Path(path) if path else BUDGETS_PATH
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001 - any read/parse failure is the same refusal
        raise BudgetError("budget source unreadable: %s (%s)" % (p, exc)) from exc
    classes = data.get("classes") or {}
    for name, spec in classes.items():
        for key in ("target_p95_s", "hard_cap_s", "per_attempt_s", "session_cap_s", "max_attempts"):
            if not isinstance(spec.get(key), (int, float)):
                raise BudgetError("class %r declares no numeric %s" % (name, key))
        spec.setdefault("retry_on", [])
        spec.setdefault("cacheable", False)
        spec.setdefault("coalesce", False)
    if "unknown_default" not in classes:
        raise BudgetError("budgets.json declares no `unknown_default` class: an unclassified call "
                          "must still be bounded, and a missing class is a defect, not a default")
    for site, spec in (data.get("sites") or {}).items():
        if spec.get("request_class") not in classes:
            raise BudgetError("site %r names class %r, which budgets.json does not declare"
                              % (site, spec.get("request_class")))
        if spec.get("cap_override_s") is not None and not (spec.get("override_reason") or "").strip():
            raise BudgetError("site %r declares cap_override_s=%s with no override_reason: an "
                              "override above the class cap must state WHY"
                              % (site, spec["cap_override_s"]))
    return data


class Budgets:
    """Read-only view over `budgets.json`, plus the per-site resolution."""

    def __init__(self, data=None, path=None):
        self.data = data if data is not None else load_budgets(path)
        self.path = Path(path) if path else BUDGETS_PATH

    @property
    def progress_threshold_s(self):
        return float(self.data.get("progress", {}).get("threshold_s", 10))

    @property
    def progress_tick_s(self):
        return float(self.data.get("progress", {}).get("tick_ms", 5000)) / 1000.0

    def classes(self):
        return self.data["classes"]

    def resolve(self, site, request_class=None):
        """`(class_name, effective)`, where `effective` folds the site's override into the class.

        An unknown site is NOT an error: a new script must be bounded the moment it calls, and the
        bounded answer for a call nobody classified is `unknown_default` (max_attempts 1, no retry)
        — with `request_class=unknown_default` in its telemetry, so the unclassified call is visible
        rather than silent.
        """
        site_spec = (self.data.get("sites") or {}).get(site) or {}
        name = request_class or site_spec.get("request_class") or "unknown_default"
        if name not in self.data["classes"]:
            raise BudgetError("unknown request class %r (site %r)" % (name, site))
        base = dict(self.data["classes"][name])
        override = site_spec.get("cap_override_s")
        if override is not None:
            base["per_attempt_s"] = float(override)
            base["session_cap_s"] = max(float(override), float(base["session_cap_s"]))
            base["cap_override_s"] = float(override)
            base["override_reason"] = site_spec.get("override_reason", "")
        else:
            base["cap_override_s"] = None
        base["request_class"] = name
        base["site"] = site
        return name, base


class CancelToken:
    """A real cancellation signal. `set()` releases every waiter at its next poll."""

    def __init__(self):
        self._event = threading.Event()
        self._closers = []
        self._lock = threading.Lock()

    def set(self):
        # "Exactly once" is a property of this lock, not a hope. Ownership of the closer list is
        # TRANSFERRED here under the lock, so a `register_closer` racing this call either joins the
        # list this call is about to drain or takes the immediate-close path below — never both —
        # and a second `set()` finds an empty list instead of re-closing every handle. Measured
        # before the lock: `set()` called twice closed every handle twice, and a registration racing
        # `set()` could be closed by both sides.
        with self._lock:
            self._event.set()
            closers, self._closers = self._closers, []
        for close in closers:
            try:
                close()
            except Exception:  # noqa: BLE001 - a closer that fails must not mask a cancel
                pass

    def is_set(self):
        return self._event.is_set()

    def register_closer(self, close):
        """Register the transport handle's teardown (e.g. `response.close`).

        Under the token's lock, so a cancel racing this registration still closes the handle EXACTLY
        ONCE: either the closer joins the list `set()` will drain, or `set()` has already taken the
        list and this call closes it here.
        """
        with self._lock:
            if not self._event.is_set():
                self._closers.append(close)
                return
        try:
            close()
        except Exception:  # noqa: BLE001 - a closer that fails must not mask a cancel
            pass


class Session:
    """The retry chain of ONE logical call. Its cap is what stops a retry loop from accumulating
    past the hard cap; a multi-call run creates one session per logical call, so a batch pass is
    bounded per call rather than as a whole (see scripts/perf/latency-budgets.md §session)."""

    def __init__(self, cap_s):
        self.cap_s = float(cap_s)
        self.spent_s = 0.0
        self.attempts = 0

    def remaining_s(self):
        return max(0.0, self.cap_s - self.spent_s)

    def charge(self, seconds):
        self.spent_s += float(seconds)

    def can_attempt(self, minimum_s=0.05):
        return self.remaining_s() > minimum_s


class CallResult:
    """What a call site gets back. `ok` is the only thing a site needs to branch on."""

    def __init__(self, **kw):
        self.__dict__.update(kw)

    @property
    def ok(self):
        return self.status == "success"

    def __repr__(self):
        return ("CallResult(status=%r, duration_ms=%s, attempts=%s, timeout=%s, cancelled=%s, "
                "cache_hit=%s)" % (self.status, self.duration_ms, self.attempts, self.timeout_flag,
                                   self.cancel_flag, self.cache_hit_flag))


def fingerprint(model, provider, site, material):
    """`sha256:` + 16 hex — built from the model/provider/site plus a HASH of the request material,
    so the store can identify a repeat without ever carrying a prompt. Raw text never leaves here."""
    h = hashlib.sha256()
    h.update((model or "").encode("utf-8", "replace"))
    h.update(b"\x00")
    h.update((provider or "").encode("utf-8", "replace"))
    h.update(b"\x00")
    h.update((site or "").encode("utf-8", "replace"))
    h.update(b"\x00")
    if isinstance(material, bytes):
        blob = material
    elif material is None:
        blob = b""
    else:
        blob = str(material).encode("utf-8", "replace")
    h.update(hashlib.sha256(blob).digest())
    return "sha256:" + h.hexdigest()[:16]


def _utc_now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


class _Store:
    """Append-only JSONL writer. It writes ONLY new lines to the PROJECT-owned store; it never
    reads, rewrites or truncates (a telemetry store that can lose a row is not evidence)."""

    def __init__(self, path=None):
        env = os.environ.get(STORE_ENV)
        self.path = None if path == "" else Path(path or env or DEFAULT_STORE)
        if self.path is not None:
            self.path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, record):
        if self.path is None:
            return
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")


def _record(event, *, call_id, site, role, model, provider, request_class, fp, **extra):
    rec = {
        "schema": "perf-model-call/1",
        "event": event,
        "ts": _utc_now(),
        "call_id": call_id,
        "site": site,
        "role": role,
        "model": model if model else "unknown",
        "model_cause": None if model else "call site passed no model label",
        "provider": provider or "unknown",
        "request_class": request_class,
        "fingerprint_hash": fp,
    }
    rec.update(extra)
    return rec


class _Inflight:
    """An identical call already running in THIS process (see budgets.json `coalesce`)."""

    def __init__(self):
        self.done = threading.Event()
        self.result = None


_INFLIGHT = {}
_INFLIGHT_LOCK = threading.Lock()


def _invoke_transport(transport, timeout_s, abort):
    """Call the site's transport, handing it the attempt's `abort` token when it accepts one.

    The token is how an ABANDONED transport gets torn down (see `_run_supervised`): a transport that
    takes `abort` registers its own handle (`response.close`, a socket's, a pipe's) and the supervisor
    fires the token the moment the caller is released without a value. This seam is ADDITIVE on
    purpose — every site wired before this cycle has the signature `transport(timeout_s)` and is
    called exactly as it was, which is what keeps five call sites source-compatible.
    """
    try:
        params = inspect.signature(transport).parameters
    except (TypeError, ValueError):  # a builtin/C callable: no signature to read, call it plainly
        return transport(timeout_s=timeout_s)
    takes_abort = ("abort" in params
                   or any(p.kind is inspect.Parameter.VAR_KEYWORD for p in params.values()))
    if takes_abort:
        return transport(timeout_s=timeout_s, abort=abort)
    return transport(timeout_s=timeout_s)


def _run_supervised(transport, deadline_s, cancel, tick_s, on_tick):
    """Run `transport(timeout_s)` off-thread and supervise it. Returns `(outcome, value, error)`.

    `outcome` is one of `success` / `timeout` / `cancelled` / `error`. A worker that returns a
    value AFTER the caller was released cannot change the outcome: a late response is discarded.

    RELEASING THE CALLER IS NOT ENOUGH (measured 2026-10-17, this track's E-5). The first version of
    this supervisor released the caller at the deadline and left the transport running: a trickling
    read — the exact shape a per-READ socket timeout cannot bound, per this module's own docstring —
    kept running 1.3 s past a 0.2 s budget and then produced its late value, while the Node half
    aborted its `AbortController` at the deadline. So every path that ABANDONS the worker now fires
    the attempt's own `abort` token first, which calls every closer the transport registered. The
    caller's `cancel` token is untouched by this: a budget expiry must not be reported as a
    cancellation.
    """
    aborted = CancelToken()
    box = {"value": None, "error": None, "closed": False}
    done = threading.Event()

    def worker():
        try:
            box["value"] = _invoke_transport(transport, deadline_s, aborted)
        except BaseException as exc:  # noqa: BLE001 - the outcome is classified below, not here
            box["error"] = exc
        finally:
            done.set()

    def abandon():
        """The caller is being released without a value: TEAR THE TRANSPORT DOWN."""
        aborted.set()

    t = threading.Thread(target=worker, name="model-call-transport", daemon=True)
    started = time.monotonic()
    t.start()
    if cancel is not None:
        cancel.register_closer(lambda: box.__setitem__("closed", True))
    next_tick = started + tick_s
    while True:
        if done.wait(_POLL_S):
            break
        # CANCELLATION IS CHECKED BEFORE THE DEADLINE, and it is checked even when the closer has
        # already run: a token set before the call started closes the handle immediately, and the
        # `closed` flag must not be read as "the cancel already happened" — doing that classified
        # every pre-set cancel as a budget expiry (measured: 4 cancelled samples reported timeout).
        if cancel is not None and cancel.is_set():
            abandon()
            return "cancelled", None, None
        if (time.monotonic() - started) >= deadline_s:
            abandon()
            return "timeout", None, None
        now = time.monotonic()
        if on_tick is not None and tick_s > 0 and now >= next_tick:
            on_tick(now - started)
            next_tick = now + tick_s
    elapsed = time.monotonic() - started
    if box["value"] is None and box["error"] is None:
        return "error", None, RuntimeError("transport returned no value")
    if box["error"] is not None:
        abandon()
        if isinstance(box["error"], (TimeoutError,)) or "timed out" in str(box["error"]).lower():
            return "timeout", None, box["error"]
        return "error", None, box["error"]
    return "success", box["value"], None


def call_model(site, transport, *, role, model=None, provider=None, fingerprint_material=None,
               request_class=None, store=None, cancel=None, session=None, budgets=None,
               retryable=True, emit=True):
    """Perform ONE logical model call under its declared budget and emit its telemetry.

    `transport(timeout_s=...)` is the site's own dialect: `urllib.request.urlopen(...).read()`,
    `subprocess.run(..., timeout=timeout_s)`, anything. This function owns the timing, the budget,
    the cancel path and the telemetry — never the payload.
    """
    budgets = budgets or Budgets()
    store = _Store(store) if not isinstance(store, _Store) else store
    name, eff = budgets.resolve(site, request_class=request_class)
    fp = fingerprint(model, provider, site, fingerprint_material)
    call_id = uuid.uuid4().hex[:16]
    started = time.monotonic()
    session = session if session is not None else Session(eff["session_cap_s"])
    coalesce_key = fp if eff.get("coalesce") else None
    inflight = None

    if coalesce_key:
        with _INFLIGHT_LOCK:
            inflight = _INFLIGHT.get(coalesce_key)
            if inflight is None:
                inflight = _INFLIGHT[coalesce_key] = _Inflight()
                owner = True
            else:
                owner = False
        if not owner:
            # An identical call is already in flight: share its bytes AND its terminal record's
            # outcome, and say so — a coalesced call is a hit, not a second call.
            inflight.done.wait(timeout=eff["session_cap_s"] + UNWIND_GRACE_S)
            shared = inflight.result
            if shared is not None:
                return _terminal(store, call_id, site, role, model, provider, name, fp, started,
                                 status=shared.status, value=shared.value, err=shared.error,
                                 timeout_flag=shared.timeout_flag, cancel_flag=shared.cancel_flag,
                                 attempts=shared.attempts, cache_hit=True, cache_policy="coalesce",
                                 error_class=shared.error_class, emit=emit)

    if emit:
        store.append(_record("model_call_started", call_id=call_id, site=site, role=role, model=model,
                             provider=provider, request_class=name, fp=fp,
                             budget_s=eff["per_attempt_s"], session_cap_s=eff["session_cap_s"]))

    def on_tick(elapsed_s):
        if emit:
            store.append(_record("model_call_progress_tick", call_id=call_id, site=site, role=role,
                                 model=model, provider=provider, request_class=name, fp=fp,
                                 elapsed_ms=int(elapsed_s * 1000)))

    value, err, outcome, attempts, last_budget_s = None, None, None, 0, eff["per_attempt_s"]
    terminalised = False
    try:
        try:
            while True:
                if not session.can_attempt():
                    outcome, err = "timeout", RuntimeError("session budget exhausted before an attempt")
                    break
                attempts += 1
                budget_s = min(eff["per_attempt_s"], session.remaining_s())
                last_budget_s = budget_s
                attempt_started = time.monotonic()
                outcome, value, err = _run_supervised(transport, budget_s, cancel,
                                                      budgets.progress_tick_s,
                                                      on_tick if budget_s > budgets.progress_threshold_s
                                                      else None)
                session.charge(time.monotonic() - attempt_started)
                if outcome == "success":
                    break
                if outcome == "cancelled":
                    break
                if outcome == "timeout":
                    break                      # a timeout is never auto-retried
                retryable_outcome = "error" in (eff.get("retry_on") or [])
                if (retryable and retryable_outcome and attempts < int(eff["max_attempts"])
                        and session.can_attempt()):
                    continue
                break
            status = "timeout" if outcome == "timeout" else (
                "cancelled" if outcome == "cancelled"
                else ("success" if outcome == "success" else "error"))
            error_class = None
            if status == "error" and err is not None:
                error_class = type(err).__name__
            # Set BEFORE the write, so an exception raised INSIDE `_terminal` (a store whose append
            # fails, an interrupt landing on the write) cannot reach the handler below with the flag
            # still clear and write a SECOND terminal row for the same `call_id` — which would break
            # this module's own "ONE terminal record per logical call" contract and trip the
            # validator's double-terminal arm. Measured reasoning, not theory: the flag is the whole
            # difference between one row and two on that path.
            terminalised = True
            result = _terminal(store, call_id, site, role, model, provider, name, fp, started,
                               status=status, value=value, err=err, timeout_flag=(status == "timeout"),
                               cancel_flag=(status == "cancelled"), attempts=attempts, cache_hit=False,
                               cache_policy="disabled" if not coalesce_key else "coalesce",
                               error_class=error_class, emit=emit, budget_s=last_budget_s,
                               session_cap_s=eff["session_cap_s"])
            # The owner publishes its record BEFORE releasing the waiters: a coalesced call is a HIT, and
            # a waiter that woke on an unpublished in-flight entry would answer with a second transport
            # call while still claiming to be one (measured: that ordering produced 2 transport calls and
            # 0 hits, i.e. coalescing that coalesced nothing).
            if coalesce_key and inflight is not None:
                inflight.result = result
            return result
        except BaseException as interrupt:  # noqa: BLE001 - an interruption must not become an OMISSION
            # A KeyboardInterrupt (Ctrl+C / SIGINT) or any other BaseException delivered to the CALLING
            # thread while this call is in flight used to skip the terminal record entirely: measured
            # 2026-10-16 against the helper as first delivered — the store held 1 `model_call_started`
            # and 0 terminals for that call, and this track's OWN validator then failed the store
            # ("model_call_started with NO terminal event"), because AC-1 requires a cancelled call to be
            # terminalised rather than omitted. It is also the most likely way a headless CLI gate's call
            # ends, which is exactly what AC-4 asks to be observable. So: terminalise it as `cancelled`
            # (an interrupt IS the caller cancelling — it is the CLI's own cancel signal), name the
            # exception in `error_class`, and RE-RAISE so the caller's semantics survive (a CLI's
            # KeyboardInterrupt, a signal handler, an exit status of 130). The transport worker is a
            # daemon: nothing here can hang the caller, and the site's own `with urlopen(...)` unwinds
            # when the worker returns or the process ends.
            #
            # `terminalised` guards the ONE hole this arm could otherwise open: an exception raised
            # inside the normal `_terminal` write would arrive here with the record already written,
            # and a second write would break the module's own "one terminal per call" contract. A call
            # that was already terminalised is therefore left exactly as it is and only re-raised.
            if not terminalised:
                _terminal(store, call_id, site, role, model, provider, name, fp, started,
                          status="cancelled", value=None, err=interrupt, timeout_flag=False,
                          cancel_flag=True, attempts=attempts, cache_hit=False,
                          cache_policy="disabled" if not coalesce_key else "coalesce",
                          error_class=type(interrupt).__name__, emit=emit, budget_s=last_budget_s,
                          session_cap_s=eff["session_cap_s"])
            raise
    finally:
        if coalesce_key:
            with _INFLIGHT_LOCK:
                if _INFLIGHT.get(coalesce_key) is inflight:
                    del _INFLIGHT[coalesce_key]
            if inflight is not None:
                # Always release the waiters: on the normal path the result is already published, and
                # on an exception path the waiter must fall through to its OWN call rather than block
                # for the whole session cap.
                inflight.done.set()


def _terminal(store, call_id, site, role, model, provider, name, fp, started, *, status, value, err,
              timeout_flag, cancel_flag, attempts, cache_hit, cache_policy, error_class, emit,
              budget_s=None, session_cap_s=None):
    duration_ms = int((time.monotonic() - started) * 1000)
    if emit:
        store.append(_record("model_call_terminal", call_id=call_id, site=site, role=role,
                             model=model, provider=provider, request_class=name, fp=fp,
                             status=status, duration_ms=duration_ms, timeout_flag=bool(timeout_flag),
                             cancel_flag=bool(cancel_flag), cache_hit_flag=bool(cache_hit),
                             cache_age_ms=None, cache_policy=cache_policy, attempts=attempts,
                             budget_s=budget_s, session_cap_s=session_cap_s,
                             error_code=(None if err is None else str(err)[:200]),
                             error_class=error_class))
    return CallResult(status=status, duration_ms=duration_ms, value=value, error=err,
                      timeout_flag=bool(timeout_flag), cancel_flag=bool(cancel_flag),
                      cache_hit_flag=bool(cache_hit), cache_policy=cache_policy, attempts=attempts,
                      request_class=name, site=site, call_id=call_id, model=model,
                      provider=provider, role=role, error_class=error_class)


# ---------------------------------------------------------------------------------------------
# CLI: the validation sample. It drives THIS code path against a LOCAL synthetic transport, so the
# records are produced by the real helper, the real supervisor and the real writer - only the far
# side of the wire is fake. That distinction is stated in scripts/perf/runtime-perf-report.md.
# ---------------------------------------------------------------------------------------------

def _synthetic_transport(plan):
    """A transport whose behaviour per call is scripted: `(delay_s, mode)`. No network."""
    state = {"n": 0}

    def transport(timeout_s):
        i = state["n"]
        state["n"] += 1
        delay, mode = plan(i)
        deadline = time.monotonic() + delay
        while time.monotonic() < deadline:
            if timeout_s is not None and timeout_s <= 0:
                raise TimeoutError("synthetic budget expiry")
            time.sleep(min(0.01, max(0.0, deadline - time.monotonic())))
        if mode == "error":
            raise RuntimeError("synthetic provider failure")
        return b'{"choices":[{"message":{"content":"ok"}}]}'

    return transport


def _sample(total, store):
    budgets = Budgets()
    classes = ["interactive_user", "interactive_agent", "background_maintenance"]
    written = 0
    for i in range(total):
        if i % 17 == 5:
            plan = lambda n: (0.30, "slow")          # noqa: E731 - budget expiry -> timeout
        elif i % 23 == 7:
            plan = lambda n: (0.005, "error")        # noqa: E731 - retryable provider error
        elif i % 29 == 11:
            plan = lambda n: (1.0, "ok")             # noqa: E731 - cancelled before it returns
        else:
            plan = lambda n: (0.004 + (n % 7) * 0.001, "ok")   # noqa: E731
        cls = classes[i % len(classes)]
        cancel = None
        if i % 29 == 11:
            cancel = CancelToken()
            cancel.set()
        budgets_override = Budgets({
            "classes": dict(budgets.classes(), **{
                cls: dict(budgets.classes()[cls], per_attempt_s=0.05, session_cap_s=0.12,
                          max_attempts=2, retry_on=["error"])}),
            # The progress threshold is COMPRESSED for the sample (10 s -> 10 ms) so the same
            # tick-emitting code path is exercised inside a fast run; the production threshold is the
            # 10 s declared in budgets.json. Stated here and in scripts/perf/runtime-perf-report.md.
            "sites": {}, "progress": {"threshold_s": 0.001, "tick_ms": 10}})
        call_model("scripts/perf/model_call_telemetry.py#sample", _synthetic_transport(plan),
                   role="reasonix-agent" if i % 3 else "maintenance",
                   model="muse-spark-1.2-contributor" if i % 4 else "qwen3.8-flash",
                   provider="muse" if i % 4 else "bai",
                   fingerprint_material="sample prompt %d" % i,
                   request_class=cls, store=store, cancel=cancel, budgets=budgets_override)
        written += 1
    print("sample written: %d terminal call(s) -> %s" % (written, store.path))


def main(argv=None):
    ap = argparse.ArgumentParser(description="model-call telemetry helper (see the module docstring)")
    ap.add_argument("--sample", type=int, metavar="N", help="write N synthetic terminal calls")
    ap.add_argument("--store", default=None, help="JSONL store (default: temp/perf/model_calls.jsonl)")
    ap.add_argument("--classes", action="store_true", help="print the effective budget table")
    args = ap.parse_args(argv)
    try:
        if args.classes:
            b = Budgets()
            print("call class                 target_p95  hard_cap  per_attempt  session  attempts")
            for name, spec in sorted(b.classes().items()):
                print("%-26s %10s %9s %12s %8s %9s" % (name, spec["target_p95_s"], spec["hard_cap_s"],
                                                       spec["per_attempt_s"], spec["session_cap_s"],
                                                       spec["max_attempts"]))
            print("\nsite overrides (a site above its class cap must state a reason):")
            for site, spec in sorted((b.data.get("sites") or {}).items()):
                cap = spec.get("cap_override_s")
                print("  %-42s class=%-22s cap=%s" % (site, spec.get("request_class"), cap))
                if cap is not None:
                    print("      reason: %s" % spec.get("override_reason"))
            return 0
        if args.sample:
            _sample(args.sample, _Store(args.store if args.store is not None else None))
            return 0
    except BudgetError as exc:
        print("REFUSED: %s" % exc, file=sys.stderr)
        return 1
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
