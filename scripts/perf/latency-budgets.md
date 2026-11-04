# Latency budgets — the classes, the caps, and where each number comes from

Track `runtime_perf_20261015`. The budget source is **`scripts/perf/budgets.json`**, read by BOTH
`scripts/perf/model_call_telemetry.py` and `scripts/perf/model_call_telemetry.js` and pinned for
parity by `test/unit/model_call_telemetry.test.js`. Print the effective table:

```bash
python scripts/perf/model_call_telemetry.py --classes
```

## The dossier's table, verbatim, as the class defaults

| call class | target p95 | hard cap | per-attempt | session cap | attempts | retry |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `interactive_user` | 60 s | 75 s | 75 s | 150 s | 2 | on error only |
| `interactive_agent` | 90 s | 105 s | 105 s | 210 s | 2 | on error only |
| `background_maintenance` | 180 s | 210 s | 210 s | 420 s | 2 | on error only |
| `unknown_default` | 180 s | 210 s | 210 s | 210 s | **1** | none |

`unknown_default` is the class a call gets when nobody classified its site. It is deliberately the
strictest on RETRIES (one attempt) while keeping the background cap, so a new script is bounded the
moment it calls instead of being unbounded until someone writes it down — and its telemetry says
`request_class=unknown_default`, which is how an unclassified call becomes visible.

## Per-attempt, session, or both — the answer is BOTH

- **Per-attempt budget**: the TOTAL deadline of one transport attempt. It is a deadline, not a
  socket timeout: the supervisor releases the caller when it expires whatever the transport is doing,
  discards a late response, and records `status=timeout`.
- **Session budget**: the cap on the whole RETRY CHAIN of one logical model call, enforced separately
  (`Session`), because that is what the criterion asks: "*retry logic cannot multiply into an
  unbounded session*". A retry chain stops when the session has no room, even if `max_attempts` would
  still allow one.
- A **session is one logical call, not one process run**. A generator that makes 32 calls creates 32
  sessions; the batch is not bounded by 420 s and is not meant to be. What is bounded is that no
  SINGLE call can chain itself past its cap.

Retry policy: `retry_on: ["error"]` only. A `timeout` and a `cancelled` are terminal — retrying a call
that already exhausted its budget is how a budget stops meaning anything.

## Site declarations, and the one shortfall this track has to state

`budgets.json` also carries a `sites` map. A site that needs a cap ABOVE its class cap must declare
`cap_override_s` **with an `override_reason`**; both runtimes refuse the file if it does not (a test
pins that refusal in both). Current state:

| site | class | effective cap | override | why |
| --- | --- | ---: | ---: | --- |
| `scripts/border_design_generator.js` | `background_maintenance` | 210 s | — | takes its class default unmodified; declared NO timeout before this track (bare `fetch`), so this is the first bound that call has ever had |
| `scripts/byok_vision_gate.py` | `background_maintenance` | 420 s | 420 | dispatched a 420 s socket timeout per judged cell; no seat-latency measurement exists here, so the declared budget is kept as an ENFORCED deadline rather than lowered on no evidence |
| `scripts/drag_ux_visual_gate.py` | `background_maintenance` | 300 s | 300 | same, from the drill `byok_vision_gate.py` was derived from |
| `scripts/codex_text_leg.py` | `background_maintenance` | 900 s | 900 | its transport is a SUBPROCESS (the codex CLI seat spends a large reasoning budget before emitting); a smaller cap aborts a legitimate corpus leg |
| `scripts/muse_gate.py` | `background_maintenance` | 600 s | 600 | **NOT WIRED** — see below |

**The shortfall, named rather than buried:** three wired sites run above the dossier's 210 s
background cap. The measured reason is that the cap is calibrated for a relay-served chat call while
these sites are long verification drills; lowering them on no evidence would convert seat answers
that currently arrive into gate failures, which is a worse outcome than a documented override. Every
override is printed in the after-table of `runtime-perf-report.md` beside the class cap it exceeds,
and the report's AC-2 verdict is `PASS (WITH DECLARED OVERRIDES)` — not a silent pass.

## The site this track could NOT wire

`scripts/muse_gate.py` is the mandated GATE reviewer seat and it IS a model-call site (600 s socket
timeout, no terminal telemetry). It is **gitignored by name** (`.gitignore:200`), so it is not part of
the governed `scripts` surface, it is absent from the worktree this track ran in, and an edit to it
could not be delivered by git. It appears in `budgets.json` with `not_wired: true` and its budget
pre-declared, so the next track that touches it needs one line, not an investigation. The same
applies to `temp/text_fallback.py` (the DeepSeek fallback transport, untracked). Both are named in
`model-call-sites.md` and in the final report as an OPEN GAP, not as coverage.

## Changing a budget

Edit `budgets.json`; nothing else. Both runtimes pick it up, the parity test fails if they ever
disagree, and the report re-derives the after-table from the records' own `budget_s`, so an old
record is still judged against the budget it actually ran under.

## What a budget expiry DOES to the call (cycle 2, track `runtime_perf_maintenance_20261017`)

A budget is a total deadline, and expiring it now means three things rather than two:

1. the CALLER is released with `status=timeout` and `timeout_flag=true` (as before);
2. the attempt's abort token fires, so a transport that registered its handle is **torn down** —
   `response.close()` on the two urllib sites, the child-process kill on the subprocess sites, the
   `AbortController` abort in the Node half — and a late answer is never delivered;
3. exactly one terminal record is written, carrying the duration the call ACTUALLY took.

Step 2 was missing in the Python half until this cycle: measured, the caller was released at 0.25 s
against a 0.2 s budget while the transport ran on to 1.562 s. A budget that releases the caller but
lets the transport keep reading bounds the WAIT, not the CALL, which is why the fix is recorded here
rather than in a comment. The failure mode it removes is provider spend that continues after the
caller has already been told the call timed out.
