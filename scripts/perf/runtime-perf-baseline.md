# Runtime-perf baseline — the P4 dossier's telemetry, re-derived

Track `runtime_perf_20261015`. Written by the same session that executed the plan; every number below
is produced by a command in this file, not transcribed.

## The dossier's table, and how it was re-derived

Input: `temp/idlegate/runtime-perf/spec.md`, authored 2026-09-22T03:01:27Z by the P4 rung's own
maintenance executor call. Its table has no window, no store path and no percentile convention, so
the first task was to find the ones that reproduce it:

```bash
node scripts/perf/runtime_perf_report.js \
  --relay-store temp/modelstack/telemetry.jsonl \
  --since 2026-09-21T16:31:00Z --until 2026-09-22T03:01:27Z \
  --unknown-since 2026-09-21T12:04:57Z \
  --project-store temp/perf/model_calls.jsonl
```

| dossier row | dossier | re-derived | verdict |
| --- | --- | --- | --- |
| `reasonix-agent / qwen3.8-flash` | `calls=852`, `p50=16.7`, `p95=54.0`, `max=465.5` | 855 rows, 852 latency-bearing, `p50=16.733`, `p95=54.047`, `max=465.483` | MATCH |
| `reasonix-agent / glm-5.3-flash` | `calls=3`, `p50=8.8`, `p95=424.7`, `max=424.7` | 3 rows, `p50=8.766`, `max=424.672` | MATCH |
| `reasonix-agent / deepseek-v4-flash` | `calls=3`, `p50=334.2`, `p95=356.8`, `max=356.8` | 3 rows, `p50=334.218`, `max=356.828` | MATCH |
| `reasonix-agent / mimo-v2.5` | `calls=2`, `p50=126.8`, `p95=129.2`, `max=129.2` | 2 rows, `p50=126.842`, `max=129.186` | MATCH |
| `maintenance / qwen3.8-flash` | `calls=1`, `errors=1`, `120.6s` | 2 rows in the window: `120.577` (failed) and `144.891` | 1-vs-2, cause named below |
| `reasonix-agent / unknown` | `calls=1093`, latency `n/a` | 1,093 rows without a model label, but only over a DIFFERENT window | window mix, named below |

Percentile convention: **nearest-rank** (`percentileSorted` in
`scripts/perf/validate_model_call_telemetry.js`). This is load-bearing, not cosmetic: with linear
interpolation the identical rows read `p95=354.6` where the dossier says `356.8`, and `p50=128.0`
where it says `126.8`. Nearest-rank was chosen because it is the convention that reproduces the
dossier's own numbers unchanged.

Two rows needed a cause rather than a shrug, and both are measured:

- **`maintenance / qwen3.8-flash` = 2, not 1.** The second row starts 2026-09-22T02:59:02Z and ends
  2026-09-22T03:01:27.618Z — **it is the call that WROTE this dossier**. Its own end instant is one
  second after the marker the dossier was generated at (`temp/idlegate/runtime-perf/spec.marker` =
  2026-09-22T03:01:27Z), so it could not have counted itself.
- **`unknown` = 1093 needs an earlier start.** In the window above the count is **860**
  (`task_completed`-class events carrying no model label). 1,093 is what the SAME end instant yields
  with a start of `2026-09-21T12:04:57Z` (~15 h instead of ~10.5 h) — reproduced by
  `--unknown-since 2026-09-21T12:04:57Z`. So the dossier's table was assembled from two windows.

## What the `n/a` latency actually is

`reasonix-agent / unknown` is not a model call whose duration went missing. It is the count of rows
in which **no model-call event was emitted at all** (a `task_completed` row carries no model and no
latency by construction). The dossier read that as a telemetry gap; the measured cause is the
absence of an event, which is why the fix is not a schema change to that population.

## The three highest tail-risk classes

Ranked by observed maximum in the re-derived window, over classes with enough calls to rank:

| class | `calls` | `p50 s` | `p95 s` | `max s` | why it is a tail risk |
| --- | ---: | ---: | ---: | ---: | --- |
| `reasonix-agent / qwen3.8-flash` | 852 | 16.7 | 54.0 | **465.5** | the volume path: the same model carries the median AND a 7-minute maximum |
| `reasonix-agent / glm-5.3-flash` | 3 | 8.8 | 424.7 | **424.7** | two of its three calls are seconds, one is **7 minutes** — a median says nothing here |
| `reasonix-agent / deepseek-v4-flash` | 3 | 334.2 | 356.8 | **356.8** | every call is over 5 minutes; the class has no fast mode at all in this window |

## Attribution: whose calls are these (F-2)

Measured over all 45,589 terminal model-call rows in `temp/modelstack/telemetry.jsonl`:
`producer=reasonix_proxy` **45,589/45,589** · `call_origin=relay` 45,589/45,589 ·
`origin_component=relay` 45,589/45,589. Cross-checked in the re-derived window alone: 865/865
`reasonix_proxy`.

So the dossier's causal sentence — "*the `scripts` area is making external agent/model calls whose
observed tail latency is severe*" — attributes to the track's declared subject a population that
subject cannot reach. **No edit under `scripts/` can move a relay-served `qwen3.8-flash`
percentile.** That is why AC-3's relay-side clause is recorded NOT ACHIEVED in
`runtime-perf-report.md` instead of being chased into `vendor/`.

## The gap the dossier was actually pointing at (F-3)

The `scripts` area DOES make model calls — and they appear in **none** of those 45,589 rows, because
they dial third-party hosts directly instead of the local relay:

| tracked script | transport | endpoint | present in the relay store? |
| --- | --- | --- | --- |
| `scripts/border_design_generator.js` | `fetch` | `inference-api.nousresearch.com`, `generativelanguage.googleapis.com` | no |
| `scripts/byok_vision_gate.py` | `urllib` | `api.meta.ai`, `api.minimax.io` | no |
| `scripts/drag_ux_visual_gate.py` | `urllib` | `api.minimax.io` | no |
| `scripts/codex_text_leg.py` | `subprocess` | the codex CLI seat; `deepseek_call.js` | no |
| `scripts/byok_border_visual_seat.py` | INDIRECT | reaches its seat through `byok_vision_gate.py` | no |

Confirmed by scanning all 45,589 raw rows for the endpoints above and for the keyword families the
area uses: no request to `api.meta.ai`, `api.minimax.io` or `generativelanguage` occurs, and the
store's only `model_call_*` producer is `reasonix_proxy`. **This** is the latency-observability gap:
the area's own model traffic emitted zero terminal events, and its only bound was a per-READ socket
timeout — which does not bound the call.

## The inventory claim (F-4)

The dossier scopes itself to "*the deterministic inventory area `scripts (7 files)`*".
`git ls-files scripts` measures **54** paths at this track's branch point, and no 7-file subset
exists — the identical claim was already measured false and recorded as *unreconciled* by track
`scripts_inventory_hygiene_20261014` (`TECH_DEBT_SCRIPTS.md` §1). Phase 1 instruments the MEASURED
surface, and this paragraph is the deviation record.
