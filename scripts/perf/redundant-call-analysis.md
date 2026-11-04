# Redundant model work — the measured duplicate scan and the cache ruling (AC-5)

Track `runtime_perf_20261015`, phase 4. AC-5 asks for either a >= 30 % reduction of repeated work or a
documented reason caching is intentionally disabled. This is the measurement that decides which.

## What a duplicate would look like, and whether any exist

Scanned over all 45,596 terminal model-call rows in `temp/modelstack/telemetry.jsonl`:

| probe | measured |
| --- | --- |
| rows carrying the framework's own duplicate markers (`semantic_fingerprint`, `semantic_duplicate_candidate`) | **0** |
| distinct `invocation_id` values | 45,596 (one per row — every call is a distinct invocation) |
| distinct `request_uid` values | 44,107 |
| largest `(role, model, task_class, context_band)` bucket | 8,422 rows |

The last row is the trap this section exists to avoid: 8,422 rows share a role, a model, a task class
and a context band, and **none of them is a duplicate of another**. Request identity is not
`(role, model, class)` — two agent turns on the same model with the same task class carry different
contexts, which is why the framework's own duplicate detector reports nothing. A cache keyed on that
tuple would serve one turn's answer to another turn's question.

## The one repeated-request class in the area is the one that MUST NOT be cached

The `scripts` area does have a genuinely repeated request: `byok_border_visual_seat.py --force`
re-asks **the same image with the same brief on a byte-identical judged cell**. Its own header names
it as the MANDATED RE-CONFIRMATION (operator instruction 2026-10-01):

> when a design's verdict flips between rounds on a BYTE-IDENTICAL judged cell, that verdict is not
> full evidence — the seat is stochastic even at temperature 0.0 — so it must reproduce before
> anything is read off it

That is a request whose whole purpose is to obtain an INDEPENDENT answer. Caching it would return the
first verdict for the second question and destroy the re-confirmation it exists to perform — the
result would look like a reproduced verdict while being a copy of the first one. The same applies to
`byok_vision_gate.py`/`drag_ux_visual_gate.py` (a verdict is a judgement, not a computation) and to
`border_design_generator.js --samples N` (distinct samples are the deliverable; its `--retries` are
re-issues after a 429/502, not deduplication candidates).

**Ruling: caching is intentionally DISABLED for every declared class** (`cacheable: false` in
`scripts/perf/budgets.json`). A reviewer verdict is not idempotent; caching a non-idempotent answer is
not an optimisation, it is a wrong answer that looks fast.

## What IS implemented: coalescing, gated per class and OFF by default

The one safe case is two callers wanting the same answer AT THE SAME TIME. That is coalescing: the
second caller waits for the first call's result instead of issuing a second transport call, and its
record says so (`cache_hit_flag: true`, `cache_policy: "coalesce"`).

- implemented in both runtimes, keyed on the redacted `fingerprint_hash`;
- **off by default** (`coalesce: false` on every class in `budgets.json`), because the same
  independence argument applies the moment the two callers are two re-asks rather than two readers of
  one answer — enabling it is a per-class decision, not a default;
- the OWNER publishes its terminal record BEFORE releasing a waiter, so a waiter can never count an
  unfinished call as a hit. That ordering is not a detail: the first implementation released the
  waiters first and was measured producing **2 transport calls and 0 hits** — coalescing that
  coalesced nothing, which is exactly the class of defect a "looks implemented" review misses. There
  is now a test that fails on that ordering (`COALESCES concurrent identical calls`), and a
  Python-side one driven through two threads.

## Cache-key safety

The key is `fingerprint_hash`: `sha256:` + 16 hex over model + provider + site + a SHA-256 of the
request material. Prompt text is hashed, never stored and never logged; there is no place in the store
where a prompt could leak through a cache key. `cache_age_ms` and `cache_policy` are recorded on every
terminal event so a future cache can be audited from the telemetry alone.

## Verdict

- **>= 30 % reduction of repeated work**: not claimed. The measurement above shows there is no
  eligible repeated class to reduce (0 framework-marked duplicates; the area's only repeated request
  is the mandated independent re-ask).
- **Documented reason caching is limited**: this file, with the operator instruction it rests on.
- **Coalescing**: implemented, tested in both runtimes, and off by default with the reason stated.

That is AC-5 satisfied on its second clause, and the report records it as
`PASS (RULED OUT, WITH REASONS)` rather than as a reduction.
