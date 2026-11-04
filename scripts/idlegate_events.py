#!/usr/bin/env python
"""idlegate_events.py - derive a TYPED event stream from the idle gate's log footprints.

Why this exists (2026-09-27 audit): the idle gate wrote 7092 lines into
`temp/idlegate/idlegate-audit.log` over nine days and not one of them could answer "did the
gate deliver anything?". The reason was not a missing log line - it was that the line
GRAMMAR was untyped prose, so every consumer had to re-invent a regex and re-decide what
`executor issue-fixes ok` MEANT. That collapse is the whole failure: 32 `ok` lines coexisted
with `closed=0` on every daily census, because `ok` reports "the gate handled its own state
correctly", never "an issue was closed".

This script removes the interpretation step. It reads the audit log and emits ONE typed
record per gate transition, so the reducer (`idlegate_census_v2.py`) and any future consumer
count the same things the same way. It is a DERIVER, not a writer: the gateway binary owns
the log, this is the typed projection of it.

    python scripts/idlegate_events.py \
        --log temp/idlegate/idlegate-audit.log \
        --out temp/idlegate/idlegate-events.jsonl \
        --root .

SCHEMA `idlegate-event/1` (field order is stable; one JSON object per line, ascending `seq`)

    seq                 1-based stream position (the log line order, never re-sorted)
    line                1-based source line number in the audit log (provenance, see `evidence`)
    ts                  source timestamp, verbatim, e.g. "2026-09-19T06:52:41Z"
    day_utc             ts[:10] - the UTC day the gate's census buckets on
    source              "idlegate-audit.log"
    project             repository name the event belongs to
    event               typed verb, from the closed vocabulary below
    outcome             ok | failed | refused | parked | escalate | null (see vocabulary)
    reason              short machine token when the source carries one (not-idle, all-clean,
                        no-budget-consumed, max-runs-per-day, ...), else null
    error_class         failed|refused classification when the line carries a transport/
                        budget/exit failure (relay-5xx, budget-backstop, exit-status, timeout)
    rung                p1..p5 when the event is attributable to a rung, else null
    rung_role           housekeeping|issue-fixes|tech-debt|runtime-perf|dev-quickwins, else null
    run_id              the gate's own decision id (`run=orch-<ts>-<n>`) when known, else null
    parent_run_id       for a fire, the id of the verdict it produced (same as run_id of the
                        verdict); for a child, the id of the rung decision that spawned it
    child_pid           builder child pid, when the event is about a child
    issue               the TARGET ARTIFACT the run acts on, repo-relative, and only when the
                        source line names it: a temp/issues/*.md path, a parked oldest issue, or
                        a temp/idlegate/<slug> track. `issue` is the artifact, not "an issue"
                        in the human sense - a track spec is carried here too, and
                        `target_kind` says which.
    target_kind         issue | track | null
    est_usd             builder_est_usd from [idle_gate] in reasonix.toml (config-derived,
                        stamped on child events so a later cost join needs no re-read)
    actual_usd          ALWAYS null: the audit log does not carry per-fire money. Kept in the
                        schema so its absence is explicit rather than a missing key.
    charged             TRI-STATE. true = the log says a slot was consumed (never observed),
                        false = the log says it was NOT (`no budget consumed`), null = the log
                        does not say. Post-2026-09-19 rule: a slot is consumed by a COMPLETED
                        run only. Do not read null as false - the 30 m-era kills predate the
                        fix and are genuinely un-attributable.
    budget_source       "local-config" when the verdict says so (no maintenance surface
                        configured), else null
    duration_seconds    child spawn -> terminal wall clock, when derivable
    evidence            the verbatim source line (or its first 200 chars) - every record is
                        falsifiable by grepping the log for it
    raw                 present ONLY on `event:"unparsed"` records: the full original line, so
                        an unknown grammar is preserved instead of silently dropped

CLOSED VOCABULARY (the point of the exercise - each verb is one thing, not a synonym)

    tick              the 60 s evaluate: outcome=idle|busy, reason=not-idle|all-clean|...
    rung.fire         a rung was selected to run
    rung.verdict      the P/S/R boundary answered: reason=local_config_ok, allow=true/false
    rung.parked       nothing eligible for the rung (every open issue is skip-parked)
    rung.executor     the rung finished handling its state: outcome=ok|error  <-- NOT value
    rung.noop         reserved: emitted when a rung decides there is nothing to do
    child.spawn       a builder child was launched (child_pid set)
    child.refused     a builder child was NOT launched (backstop/cap); outcome=refused
    child.terminal    the child ended: outcome=ok|failed, reason, charged
    child.liveness    the child's heartbeat line (see `bytes`/`cpu` note below)
    boot.marker       a priority boot marker went dormant
    boot.escalate     a boot marker crossed its grace window and escalated
    cycle.done        a p3/p4 maintenance cycle finished: outcome=closed|blocked|declined
    p1.error          p1 housekeeping step failed (the rung's own error branch)
    p1.semantic       p1 semantic sweep result (classified/trash/p1_clean)
    census.logged     the gate's OWN daily census line, kept as an event so the typed reducer
                      can be reconciled against it rather than replacing it blindly
    unparsed          grammar this deriver does not know - never dropped

KNOWN LIMITS, made explicit instead of papered over (measured on the 2026-09-18..27 log):

  * `child.liveness` is evidence of NOTHING. All 164 liveness lines read `bytes=0` with a
    NEGATIVE remaining cpu (`cpu=-1345056h23m55...s`), so a hung child and a working child are
    indistinguishable. `child.liveness` is emitted for completeness and must not be read as
    progress. This is why the proofs protocol (`temp/idlegate/proofs/<run_id>/`) is needed.
  * `actual_usd` is not in the log at all; only the daily census line carries `spend=`, and
    that number is not attributable to a single fire. See `--census-log` in the reducer.
  * a child's SUCCESS is not in the log. There is no "run ok" / "exit 0" line anywhere in nine
    days; the only child terminals are `builder run FAILED (...)` and
    `executor <rung> error: builder run killed ...`. So "completed" in the reducer means
    "a terminal was observed", and value has to come from artifacts, not from this stream.

Exit codes: 0 ok, 2 the log is missing/unreadable, 3 nothing parsed at all.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone

SCHEMA = "idlegate-event/1"
DEFAULT_LOG = os.path.join("temp", "idlegate", "idlegate-audit.log")

# rung -> role, as the gate spells them in `fire <role>` and `executor <role>`.
ROLE_TO_RUNG = {
    "housekeeping": "p1",
    "issue-fixes": "p2",
    "tech-debt": "p3",
    "runtime-perf": "p4",
    "dev-quickwins": "p5",
}

TS_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s(.*)$")

# ---------------------------------------------------------------------------
# line grammar. Each pattern yields (event, extractor) - one verb per pattern, so a
# consumer never has to guess which flavour of "ok" it is looking at.
# ---------------------------------------------------------------------------


def _status_token(reason: str) -> str | None:
    """Classify a failure/refusal reason into an error_class, or None."""
    r = reason.lower()
    if "max runs per day" in r or "per-day backstop" in r:
        return "budget-backstop"
    if "http 5" in r or "deferred_by_stack" in r:
        return "relay-5xx"
    if "context deadline exceeded" in r:
        return "timeout-context-deadline"
    if "context canceled" in r:
        return "timeout-context-canceled"
    if "exit status" in r:
        return "exit-status"
    return None


def _kill_reason(detail: str) -> str:
    """Canonical kill reason, stable across BOTH spellings of the same terminal.

    The log writes the same event two ways - `builder run FAILED (...): builder run killed
    after 24h0m0s: context canceled` and `executor <rung> error: builder run killed after
    24h0m0s: context canceled` - so the reason is normalised to `killed after <dur>` and the
    CAUSE goes into `error_class`. Without this a timeout count double-counts spellings.
    """
    m = re.search(r"killed after (\d+h\d+m\d+s|\d+m\d+s)", detail)
    if m:
        return f"killed after {m.group(1)}"
    m = re.search(r"(exit status \d+)", detail)
    if m:
        return m.group(1)
    return detail.split(":")[0][:60]


def parse_target(task: str) -> tuple[str | None, str | None]:
    """Return (target_kind, repo-relative target artifact) for a builder task line.

    Matches BOTH spellings of the same task text: the spawn line (`... task=Fix <path> per its
    own evidence standards; ...`) and the budget ledger's terminal
    (`builder run FAILED (...): <kill> (task=Fix <path> ...)`). A path can appear anywhere in
    the string, so this searches instead of anchoring - anchoring was what made every ledger
    terminal un-attributable and forced the reducer to INFER the child.
    """
    m = re.search(r"(?:^|\btask=)Fix (temp/issues/\S+\.md)", task)
    if m:
        return "issue", m.group(1)
    m = re.search(
        r"Execute the (\S+) maintenance track authored at (temp/idlegate/\S+?)/spec\.md", task
    )
    if m:
        return "track", m.group(2)
    return None, None


def base(seq, line, ts, project, event, **kw):
    rec = {
        "seq": seq,
        "line": line,
        "ts": ts,
        "day_utc": ts[:10],
        "source": "idlegate-audit.log",
        "project": project,
        "event": event,
        "outcome": None,
        "reason": None,
        "error_class": None,
        "rung": None,
        "rung_role": None,
        "run_id": None,
        "parent_run_id": None,
        "child_pid": None,
        "issue": None,
        "target_kind": None,
        "est_usd": None,
        "actual_usd": None,
        "charged": None,
        "budget_source": None,
        "duration_seconds": None,
        "evidence": None,
        "raw": None,
    }
    rec.update(kw)
    return rec


def build_parser(project: str, est_usd, logname: str):
    """Return (handle_line, finalize, state) for the audit-log grammar."""

    state = {
        "rung": None,
        "rung_role": None,
        "run_id": None,
        # ordered spawn records; a child is "terminated" once its PRIMARY terminal is seen,
        # so the second view of the same terminal can be detected instead of counted again.
        "spawns": [],
        "last_terminal": None,  # (pid, ts, view, rung_role) of the previous child.terminal
    }

    def open_spawns():
        return [s for s in state["spawns"] if not s["terminated"]]

    def match_spawn(kind, target, ts, view):
        """Pair a terminal line to the child it ended. Returns (spawn|None, attribution).

        `matched`   - the line named the target (`task=...`) and an open spawn agrees, or it
                      is the second VIEW of the ledger terminal written moments earlier, or
                      exactly one child was open.
        `inferred`  - more than one child was open and the line names none; the most recent
                      open child is assumed. Count these, never trust them.
        `unknown`   - nothing to pair with (orphan terminal).
        """
        op = open_spawns()
        if target:
            for s in reversed(op):
                if s["kind"] == kind and s["target"] == target:
                    return s, "matched"
            return None, "unknown"
        lt = state["last_terminal"]
        if (
            lt
            and lt["view"] == "ledger"
            and lt["rung_role"] == state["rung_role"]
            and lt["ts"]
            and _delta(lt["ts"], ts) <= 5
        ):
            s = next((x for x in state["spawns"] if x["pid"] == lt["pid"]), None)
            if s:
                return s, "matched"
        if len(op) == 1:
            return op[0], "matched"
        if op:
            return op[-1], "inferred"
        return None, "unknown"

    def terminal(seq, line, ts, body, detail, kind, target, view, charged):
        """Emit a child.terminal, collapsing the rung view onto the ledger view."""
        s, attribution = match_spawn(kind, target, ts, view)
        dup = bool(s and s["terminated"])
        if s and not dup:
            s["terminated"] = True
        pid = s["pid"] if s else None
        state["last_terminal"] = {
            "pid": pid, "ts": ts, "view": view, "rung_role": state["rung_role"],
        }
        rec = base(
            seq, line, ts, project, "child.terminal",
            outcome="failed", reason=_kill_reason(detail),
            error_class=_status_token(detail),
            rung=(s or {}).get("rung") or state["rung"],
            rung_role=(s or {}).get("role") or state["rung_role"],
            run_id=(s or {}).get("run_id") or state["run_id"],
            child_pid=pid, charged=charged, est_usd=est_usd, evidence=body[:200],
        )
        rec["terminal_view"] = view
        rec["attribution"] = attribution
        rec["duplicate_view"] = dup
        rec["issue"] = (s or {}).get("target") or target
        rec["target_kind"] = (s or {}).get("kind") or kind
        if s:
            rec["duration_seconds"] = round(_delta(s["ts"], ts), 3)
        return rec

    def handle(seq: int, line: int, body: str, ts: str):
        ev = None

        # 1. the 60 s evaluate tick
        m = re.match(r"evaluate idle=(\S+) idleFor=(\S+) reason=(\S+)$", body)
        if m:
            idle = m.group(1) == "true"
            return base(
                seq, line, ts, project, "tick",
                outcome="idle" if idle else "busy",
                reason=m.group(3),
                evidence=body[:200],
            )

        # 2. a rung was selected
        m = re.match(r"fire (\S+)$", body)
        if m:
            role = m.group(1)
            state["rung_role"] = role
            state["rung"] = ROLE_TO_RUNG.get(role)
            state["run_id"] = None
            return base(
                seq, line, ts, project, "rung.fire",
                rung=state["rung"], rung_role=role, evidence=body[:200],
            )

        # 3. the P/S/R boundary verdict
        m = re.match(
            r"maintenance verdict row=(\d+) reason=(\S+) allow=(\S+) rung=(\S+) "
            r"run=(\S+) budget_source=(.*)$",
            body,
        )
        if m:
            run_id = m.group(5)
            budget = m.group(6)
            state["run_id"] = run_id
            state["rung"] = m.group(4)
            return base(
                seq, line, ts, project, "rung.verdict",
                outcome="allow" if m.group(3) == "true" else "deny",
                reason=m.group(2),
                rung=m.group(4), rung_role=state["rung_role"], run_id=run_id,
                budget_source="local-config" if "local-config" in budget else budget[:60],
                evidence=body[:200],
            )

        # 4. nothing eligible for the rung
        m = re.match(
            r"issue-fixes all open issues parked; oldest (\S+) parked_at=(\S+) "
            r"attempts=(\d+) rearms=(\S+)$",
            body,
        )
        if m:
            return base(
                seq, line, ts, project, "rung.parked",
                outcome="parked", reason="all-open-issues-parked",
                rung="p2", rung_role="issue-fixes", run_id=state["run_id"],
                issue=m.group(1), target_kind="issue",
                evidence=body[:200],
            )

        # 5. the rung finished handling its own state (NOT a value signal)
        m = re.match(r"executor (\S+) (ok|error)\b:?\s*(.*)$", body)
        if m:
            role, status, detail = m.group(1), m.group(2), m.group(3).strip()
            if "builder run killed" in detail:
                # The refusal path logs the SAME terminal verbatim, so both go through the
                # shared terminal() emitter and the second view is marked duplicate_view.
                return terminal(seq, line, ts, body, detail, None, None, "rung", None)
            return base(
                seq, line, ts, project, "rung.executor",
                outcome="ok" if status == "ok" else "error",
                reason=_status_token(detail) or (detail.split(":")[0] if detail else None),
                error_class=_status_token(detail) if status == "error" else None,
                rung=ROLE_TO_RUNG.get(role), rung_role=role, run_id=state["run_id"],
                child_pid=None, evidence=body[:200],
            )

        # 6. a builder child was NOT launched
        m = re.match(r"builder spawn refused: (.*)$", body)
        if m:
            reason = m.group(1).strip()
            return base(
                seq, line, ts, project, "child.refused",
                outcome="refused", reason=("max-runs-per-day" if "max runs per day" in reason
                                           else reason[:60]),
                error_class=_status_token(reason) or "refused",
                rung=state["rung"], rung_role=state["rung_role"], run_id=state["run_id"],
                charged=False, est_usd=est_usd, evidence=body[:200],
            )

        # 7. a builder child was launched
        m = re.match(r"builder spawn pid=(\d+) task=(.*)$", body)
        if m:
            pid, task = m.group(1), m.group(2)
            kind, target = parse_target(task)
            state["spawns"].append({
                "pid": pid, "ts": ts, "kind": kind, "target": target,
                "run_id": state["run_id"], "role": state["rung_role"], "rung": state["rung"],
                "terminated": False,
            })
            return base(
                seq, line, ts, project, "child.spawn",
                outcome="spawned", reason=None,
                rung=state["rung"], rung_role=state["rung_role"], run_id=state["run_id"],
                child_pid=pid, issue=target, target_kind=kind,
                charged=False, est_usd=est_usd, evidence=body[:200],
            )

        # 8. the child's terminal, as the budget ledger wrote it
        m = re.match(r"builder run FAILED \(no budget consumed\): (.*)$", body)
        if m:
            detail = m.group(1).strip()
            kind, target = parse_target(detail)
            return terminal(seq, line, ts, body, detail, kind, target, "ledger", False)

        m = re.match(r"builder run killed (.*)$", body)
        if m:
            kind, target = parse_target(body)
            return terminal(seq, line, ts, body, body, kind, target, "ledger", None)

        # 9. the (uninformative) heartbeat
        m = re.match(r"builder liveness ok pid=(\d+) bytes=(\d+) cpu=(\S+)$", body)
        if m:
            return base(
                seq, line, ts, project, "child.liveness",
                outcome="ok", reason=f"bytes={m.group(2)} cpu={m.group(3)}",
                rung=state["rung"], rung_role=state["rung_role"], run_id=state["run_id"],
                child_pid=m.group(1), charged=None, evidence=body[:200],
            )

        # 10. boot markers
        m = re.match(r"boot marker present priority=(\S+) \((.*)\)$", body)
        if m:
            return base(
                seq, line, ts, project, "boot.marker", outcome="dormant",
                reason=m.group(1), rung=ROLE_TO_RUNG.get(m.group(1)), rung_role=m.group(1),
                evidence=body[:200],
            )
        m = re.match(r"boot marker past grace: escalate priority=(\S+) started=(\S+)$", body)
        if m:
            return base(
                seq, line, ts, project, "boot.escalate", outcome="escalate",
                reason="past-grace", rung=ROLE_TO_RUNG.get(m.group(1)), rung_role=m.group(1),
                evidence=body[:200],
            )

        # 11. p3/p4 cycle completion
        m = re.match(
            r"(\S+) cycle done outcome=(\S+) attempts=(\d+) next_allowed=(\S+) started=(\S+)$",
            body,
        )
        if m:
            role = m.group(1)
            return base(
                seq, line, ts, project, "cycle.done",
                outcome=m.group(2), reason=f"attempts={m.group(3)}",
                rung=ROLE_TO_RUNG.get(role), rung_role=role,
                issue=f"temp/idlegate/{role}", target_kind="track",
                evidence=body[:200],
            )

        # 12. p1's own error branch (the rung reported ok anyway - that is the finding)
        m = re.match(r"p1 housekeeping error: (.*)$", body)
        if m:
            return base(
                seq, line, ts, project, "p1.error", outcome="error",
                reason=m.group(1).strip()[:120], rung="p1", rung_role="housekeeping",
                evidence=body[:200],
            )
        m = re.match(r"p1 semantic classified=(\d+) trash=(\d+) p1_clean=(\S+)$", body)
        if m:
            return base(
                seq, line, ts, project, "p1.semantic",
                outcome="clean" if m.group(3) == "true" else "dirty",
                reason=f"classified={m.group(1)} trash={m.group(2)}",
                rung="p1", rung_role="housekeeping", evidence=body[:200],
            )

        # 13. the gate's own census line
        m = re.match(r"idlegate census (\S+): (.*)$", body)
        if m:
            return base(
                seq, line, ts, project, "census.logged",
                reason=m.group(1), evidence=body[:200],
            )

        # 14. unknown grammar - preserved, never dropped
        return base(
            seq, line, ts, project, "unparsed",
            evidence=body[:200], raw=body,
        )

    def finalize(records: list[dict]):
        """Nothing left to resolve: attribution happens inline (see terminal())."""
        return records

    return handle, finalize


def _delta(a: str, b: str) -> float:
    fmt = "%Y-%m-%dT%H:%M:%SZ"
    return (datetime.strptime(b, fmt) - datetime.strptime(a, fmt)).total_seconds()


def read_est_usd(root: str):
    """builder_est_usd from [idle_gate] in reasonix.toml (config-derived, best effort)."""
    for name in ("reasonix.toml", "reasonix.toml.example"):
        p = os.path.join(root, name)
        if not os.path.exists(p):
            continue
        try:
            import tomllib

            with open(p, "rb") as fh:
                cfg = tomllib.load(fh)
            v = (cfg.get("idle_gate") or {}).get("builder_est_usd")
            if v is not None:
                return float(v), f"{name} [idle_gate].builder_est_usd"
        except Exception:  # noqa: BLE001 - config is optional provenance, never fatal
            continue
    return None, None


def derive(log_text: str, project: str, est_usd) -> list[dict]:
    handle, finalize = build_parser(project, est_usd, "idlegate-audit.log")
    records = []
    seq = 0
    for i, raw in enumerate(log_text.splitlines(), start=1):
        if not raw.strip():
            continue
        m = TS_RE.match(raw)
        if not m:
            # The file carries 80 NUL bytes (a torn write from the gateway's stderr
            # redirection) and one of them lands INSIDE a real line, which is why `grep`
            # classifies the whole log as binary and must be run with -a. NULs are padding
            # here, never content, so they are stripped before the grammar sees the line.
            cleaned = raw.replace("\x00", "")
            m = TS_RE.match(cleaned)
            if not m:
                seq += 1
                records.append(
                    base(seq, i, "", project, "unparsed", evidence=raw[:200], raw=raw)
                )
                continue
            raw = cleaned
        seq += 1
        rec = handle(seq, i, m.group(2), m.group(1))
        records.append(rec)
    return finalize(records)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", default=".")
    ap.add_argument("--log", default=DEFAULT_LOG)
    ap.add_argument("--out", default=None, help="write JSONL here (default: stdout)")
    ap.add_argument("--project", default=None)
    ap.add_argument("--summary", action="store_true", help="print per-event counts to stderr")
    args = ap.parse_args(argv)

    log_path = args.log if os.path.isabs(args.log) else os.path.join(args.root, args.log)
    if not os.path.exists(log_path):
        print(f"FAIL - audit log not found: {log_path}", file=sys.stderr)
        return 2
    try:
        with open(log_path, "rb") as fh:
            text = fh.read().decode("utf-8", "replace")
    except OSError as exc:
        print(f"FAIL - audit log unreadable: {exc}", file=sys.stderr)
        return 2

    project = args.project or os.path.basename(os.path.abspath(args.root))
    est_usd, est_src = read_est_usd(args.root)

    records = derive(text, project, est_usd)
    typed = [r for r in records if r["event"] != "unparsed"]
    if not typed:
        print("FAIL - nothing parsed; the audit-log grammar has changed", file=sys.stderr)
        return 3

    payload = "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in records)
    if args.out:
        out_path = args.out if os.path.isabs(args.out) else os.path.join(args.root, args.out)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(payload)
    else:
        sys.stdout.write(payload)

    if args.summary:
        counts: dict[str, int] = {}
        for r in records:
            counts[r["event"]] = counts.get(r["event"], 0) + 1
        print(f"schema={SCHEMA} records={len(records)} est_usd={est_usd} ({est_src})",
              file=sys.stderr)
        for k in sorted(counts):
            print(f"  {counts[k]:>6}  {k}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
