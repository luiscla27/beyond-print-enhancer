# Runtime-perf report — scripts-originated model calls

Track `runtime_perf_20261015` · schema `runtime-perf-report/1` · generated 2026-10-16T06:21:51.762Z

## Evidence sources (AC-6)

- `temp/modelstack/telemetry.jsonl` — this project's RELAY store, READ ONLY. It is the
  dossier's own evidence and it is used here only to re-derive the baseline window.
- `temp/perf/model_calls.jsonl` — the scripts area's own terminal telemetry (this track).
- `scripts/perf/budgets.json` — the declared budget source both runtimes read.
- `scripts/perf/model-call-sites.md` — the measured call-site inventory.
- `TECH_DEBT_SCRIPTS.md` — the area's 54-path measured surface (the dossier claimed 7).
- No file under `vendor/`, `third_party/`, `.git/` or `node_modules/` was read or written.

## Baseline — the dossier's window, re-derived (relay population)

Window `2026-09-21T16:31:00Z` … `2026-09-22T03:01:27Z`, nearest-rank percentiles, 865 terminal model-call rows.

| role | model | calls | latency missing | errors | p50 s | p95 s | max s |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| reasonix-agent | qwen3.8-flash | 855 | 3 | 3 | 16.733 | 54.047 | 465.483 |
| reasonix-agent | deepseek-v4-flash | 3 | 0 | 0 | 334.218 | 356.828 | 356.828 |
| reasonix-agent | glm-5.3-flash | 3 | 0 | 0 | 8.766 | 424.672 | 424.672 |
| maintenance | qwen3.8-flash | 2 | 0 | 1 | 120.577 | 144.891 | 144.891 |
| reasonix-agent | mimo-v2.5 | 2 | 0 | 0 | 126.842 | 129.186 | 129.186 |

Attribution measured over the same events: producer counts {"reasonix_proxy":865}. Every row is the relay's own; the scripts area appears ZERO times in it.

Rows in the window that carry no model label at all: **860** (`task_completed`-class events, 0 of them without a `latency_ms` field). The dossier's `model=unknown, latency n/a` row reads 1093, which this window does NOT reproduce: over the same end instant with a start of `2026-09-21T12:04:57Z` the count is 1093. So the dossier's table was built from TWO windows (its model rows need the later start, its unknown row the earlier one) — and what that row actually shows is that a row carrying no model-call event carries no duration either: the ABSENCE of an event, not a missing measurement.

## After — the scripts area's own calls (project population)

Sample: **120** terminal events in `temp/perf/model_calls.jsonl` (246 rows including lifecycle events; the path is relative to the repository root, so the artifact does not cite the worktree it was generated in).

- `duration_ms` coverage: **100%**
- unknown-model rate: **0%**
- statuses: {"success":104,"timeout":7,"error":5,"cancelled":4}
- timeouts 7 · cancels 4 · errors 5 · progress ticks 6
- cache hits 0 (rate 0)
- latency: n=120 p50=16ms p95=62ms p99=109ms max=109ms

| site | class | declared cap s | class cap s | override | measured budget s | measured session s | calls | exercised | over session cap |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `scripts/perf/model_call_telemetry.py#sample` | mixed(background_maintenance,interactive_agent,interactive_user) | 210 | 210 | — | 0.05 | 0.12 | 120 | yes | no |
| `scripts/border_design_generator.js` | background_maintenance | 210 | 210 | — | — | — | 0 | NO — declared, not exercised by this sample | no |
| `scripts/byok_vision_gate.py` | background_maintenance | 420 | 210 | 420 | — | — | 0 | NO — declared, not exercised by this sample | no |
| `scripts/codex_text_leg.py` | background_maintenance | 900 | 210 | 900 | — | — | 0 | NO — declared, not exercised by this sample | no |
| `scripts/drag_ux_visual_gate.py` | background_maintenance | 300 | 210 | 300 | — | — | 0 | NO — declared, not exercised by this sample | no |
| `scripts/muse_gate.py` | background_maintenance | 600 | 210 | 600 | — | — | 0 | NO — declared, not exercised by this sample | no |

_A row with no calls is a site whose wiring is DECLARED and unmeasured, not a site that is unwired: the production transports need live seats and paid credentials, so this sample exercises the helper rather than the providers._

## Acceptance criteria

| criterion | verdict | basis |
| --- | --- | --- |
| AC-1 | PASS | 120 terminal calls, duration_ms coverage 100%, 0 validator finding(s), unknown-model 0% |
| AC-2 | PASS (WITH DECLARED OVERRIDES) | budget mechanism enforced at every site (5 declared site(s)); 4 site(s) carry a declared override above the class cap for the reasons in `scripts/perf/budgets.json`; measured calls over their session cap: 0 |
| AC-3 | NOT ACHIEVED — OUT OF SCOPE (relay clause); before/after report MET | the criterion's population is relay-served `qwen3.8-flash`, and 865/865 terminal rows in the store are `producer=reasonix_proxy`; no `scripts/` edit can move that percentile. The requested before/after report EXISTS (this file); no p50 comparison is possible because no scripts-originated sample predates this track |
| AC-4 | PASS | 6 progress tick(s) measured on the real code path; cancellation and abort-at-budget are asserted in `test/unit/model_call_telemetry.test.js` |
| AC-5 | PASS (RULED OUT, WITH REASONS) | the framework's own duplicate markers are unset on 865 relay rows (0 marked); coalescing is implemented and proven by test; caching is disabled by policy because the area's only repeated-request class is the byte-identical re-ask, which the repository requires to be an INDEPENDENT answer (`scripts/perf/redundant-call-analysis.md`) |
| AC-6 | PASS | every evidence source is named in this report; the change set is `scripts/perf/**`, five call sites in the tracked `scripts` area, one test file, rows in `TECH_DEBT_SCRIPTS.md`; no excluded tree read or written |

## Decision

`CONDITIONAL PASS` — every criterion this scope can move is met on measurements the report cites; AC-3's relay-side clause is recorded NOT ACHIEVED rather than reinterpreted, and the deferred part is named with the instrument that would settle it

- AC-2 shortfall, named: 4 of 5 declared site(s) run above their class cap because the cap was below the workload the site was dimensioned for and no measurement exists to justify lowering it — each override states its reason in `scripts/perf/budgets.json` and is printed in the after-table above.
- The sample was produced by driving the REAL helper, supervisor and writer against a LOCAL synthetic transport: it proves the code path and the wiring, not a production latency distribution (no live seat call was made).
- AC-3's settling instrument: a post-restart relay sample over the same window, re-derived by the command in `scripts/perf/runtime-perf-baseline.md`.
