# Model-call sites in the `scripts` area — the measured inventory

Track `runtime_perf_20261015`, phase 1. Method: scan the TRACKED surface for outbound request
construction and for subprocess bridges that hand a prompt to a model seat, then classify each hit by
who is waiting on the answer.

```bash
git ls-files scripts                                   # 54 paths at this track's branch point
grep -ln "urlopen\|fetch(\|http.request\|/chat/completions\|/v1/" scripts/*.py scripts/*.js
grep -ln "subprocess.run\|execFileSync\|spawnSync" scripts/*.py scripts/*.js
```

The dossier's scope line says "*the deterministic inventory area `scripts (7 files)`*". The measured
surface is **54 tracked paths**, and the 7-file claim was already recorded as unreconciled by
`scripts_inventory_hygiene_20261014` (`TECH_DEBT_SCRIPTS.md` §1). This inventory is against the
MEASURED surface.

## Sites that make a model call

| # | path | state | transport | endpoint | credential source | timeout BEFORE | class | cap NOW |
| ---: | --- | --- | --- | --- | --- | ---: | --- | ---: |
| 1 | `scripts/border_design_generator.js` | WIRED | `fetch` | `inference-api.nousresearch.com`, `generativelanguage.googleapis.com` | `NOUS_API_KEY`, `GEMINI_PAID_API_KEY` / `GEMINI_FREE_TIER_API_KEY` | **none** | `background_maintenance` | 210 s |
| 2 | `scripts/byok_vision_gate.py` | WIRED | `urllib` | `api.meta.ai` / `api.minimax.io` | `MUSE_SPARK_API_KEY`, `MINIMAX_API_KEY` | 420 s (per read) | `background_maintenance` | 420 s |
| 3 | `scripts/drag_ux_visual_gate.py` | WIRED | `urllib` | `api.minimax.io` | `MINIMAX_API_KEY` | 300 s (per read) | `background_maintenance` | 300 s |
| 4 | `scripts/codex_text_leg.py` | WIRED | `subprocess` | the codex CLI seat; `deepseek_call.js` | the codex CLI's own auth; `SECONDARY_DEEPSEEK_API_KEY` | 900 s / 900 s | `background_maintenance` | 900 s |
| 5 | `scripts/byok_border_visual_seat.py` | INDIRECT | loads site 2 as a module and calls `gate.dispatch(...)` | inherits site 2 | inherits site 2 | inherits 420 s | inherits `background_maintenance` | inherits 420 s |
| 6 | `scripts/muse_gate.py` | **NOT WIRED** | `urllib` | `api.meta.ai` | `MUSE_SPARK_API_KEY` | 600 s (per read) | `background_maintenance` | 600 s (declared) |
| 7 | `temp/text_fallback.py` | **NOT WIRED** | `urllib` | `api.b.ai` | `SECONDARY_DEEPSEEK_API_KEY` | 300 s (per read) | `background_maintenance` (declared by analogy) | — |

### Why 6 and 7 are NOT WIRED, and why that is stated instead of skipped

Both are **untracked**:

- `scripts/muse_gate.py` is gitignored by name (`.gitignore:200`, alongside
  `scripts/input_budget_report.py` and `scripts/verify_lanes.py`) — the repository's deliberate
  "project-authored harness helper" class. It is therefore not part of the surface
  `scripts/check_scripts_hygiene.js` governs, it does not exist in the worktree this track executed
  in, and a change to it could not be delivered by a commit.
- `temp/text_fallback.py` lives under `temp/` with the rest of the untracked harness, and is the
  DeepSeek fallback that site 6 reaches when Muse is unavailable.

**This is an OPEN GAP, not coverage.** It matters because site 6 is the MANDATED GATE reviewer for
every new track in this project, i.e. one of the highest-traffic model call sites here. The fix is
one line once the file is reachable: `budgets.json` already carries its budget (`not_wired: true`)
and the helper is importable from `scripts/perf/`. `test/unit/model_call_telemetry.test.js` fails if a
declared site is neither wired nor marked `not_wired`, so this row cannot rot into silence.

## Sites that look like call sites and are not

Measured, so the inventory is honest about its own noise:

- `scripts/relay_serving_identity.py` — an HTTP probe of the LOCAL relay's `/reload/status` on
  `127.0.0.1`. No model call.
- `scripts/browser_gate.js`, `scripts/release_gate.js`, `scripts/gen_spec_inventory.js`,
  `scripts/check_scripts_hygiene.js` — `spawn` bridges to mocha / git / the browser suite. No model.
- `scripts/audit_dead_exports.js` — its `api.` hit is a code sample inside a comment.
- Every other tracked script: no outbound request construction at all (they read local artifacts, do
  pixel metrics, or guard the tree).

## Where the model label comes from

None of the wired sites can emit `model=unknown` by accident — each has a literal or per-site pair,
and the helper records it verbatim:

| site | model label | provider label |
| --- | --- | --- |
| `scripts/border_design_generator.js` | `NOUS_DEFAULT_MODEL` / `GEMINI_MODEL` (`gemini-3.8-flash`) | the resolved base URL |
| `scripts/byok_vision_gate.py` | `review["model"]` (`muse-spark-1.2-contributor` or `MiniMax-M3`) | `review["base_url"]` |
| `scripts/drag_ux_visual_gate.py` | `MODEL` (`MiniMax-M3`) | `BASE_URL` |
| `scripts/codex_text_leg.py` | `codex-cli` / `deepseek-v4-flash` | `codex-cli-subprocess` / `deepseek-call-js-subprocess` |

The helper's own rule (schema §3) is that a call with no resolvable label must carry a `model_cause`
— so `unknown` is a statement about a specific call, never a blanket.

## What every wired site gained

1. a **total deadline** enforced by a supervisor, replacing a per-READ socket timeout that could not
   bound the call (site 1 had no timeout at all);
2. **one terminal event** per call — `success`, `error`, `timeout` or `cancelled` — in
   `temp/perf/model_calls.jsonl`;
3. `started` / `progress_tick` lifecycle events, which is the only progress surface a headless CLI
   gate has (AC-4);
4. a real cancellation path (`CancelToken`) that releases the caller and aborts the transport;
5. a session cap so a retry chain cannot accumulate past its hard cap.

## The deadline now TEARS THE TRANSPORT DOWN (cycle 2, track `runtime_perf_maintenance_20261017`)

Item 4 above was true of a caller that passed a `CancelToken`, and of the NODE half for a budget
expiry. The PYTHON half did not: measured 2026-10-17, a call released at 0.25 s against a 0.2 s
budget left its transport running to **1.562 s** and then returned a value nobody read — the
"a socket timeout bounds each READ, not the total call" failure this whole area exists to end.
The supervisor now fires a per-attempt abort token on every non-success outcome, and a transport that
accepts `abort=` registers the handle it must close:

| site | transport dialect | teardown at the deadline |
| --- | --- | --- |
| `scripts/byok_vision_gate.py` | `urllib` (HTTP) | `abort.register_closer(r.close)` — the response is CLOSED, so a late answer is never delivered |
| `scripts/drag_ux_visual_gate.py` | `urllib` (HTTP) | same |
| `scripts/codex_text_leg.py` (both legs) | `subprocess` | `subprocess.run(timeout=…)` kills the child at the deadline — the kill IS the teardown, so no `abort` seam is needed (declared, not silently skipped) |
| `scripts/border_design_generator.js` | `fetch` | the Node supervisor aborts the attempt's `AbortController` at the deadline (already did; now pinned by a test) |

The seam is ADDITIVE: a transport whose signature is `transport(timeout_s)` — every site wired before
this cycle — is called exactly as it was, so the five wired sites needed no signature change beyond
the two above that opted into the teardown.

The call sites' business logic is untouched: payload construction and response parsing are exactly as
they were, and the helper never sees a payload it has to understand.
