# Plan — e2e_goalgrounded_recert_20261101

Goal-grounded re-run of the 19-bundle MiniMax certification: same archived corpus, same seat, same wire knobs — ONLY the judge prompt changes (v2). Triggered by the operator's upheld challenge that the v1 prompt let the judge score the D&D Beyond sheet itself and miss the missing activation loading overlay.

## Phases

- [x] **Phase 0 — Instrument.** Copy the proven `certify_recert.py` to `temp/scratch/certify_goalgrounded.py`; repoint TRACK to this track; replace `judge_prompt_for` with v2 (PRODUCT_BRIEF + base-sheet exclusion + activation arc + two-layer rubric + defined verdict scale); gate `needs_rerun` on v2 records; tag every record `prompt_version: v2`. Declare deliberation in the track metadata at creation.

- [x] **Phase 1 — Pilot.** Re-judge `feature_01_ai_arrange` alone. Success criterion: the verbatim text attributes observations to WEBSITE-OWNED vs EXTENSION-OWNED and lists the missing activation loading overlay as a LAYER 2 absence. MEASURED: both criteria met (verbatim: "No smooth extension activation transition: there is no brief extension-specific loading/processing overlay"); finish=stop, 43,534 prompt tokens.

- [x] **Phase 2 — Full pass.** Run the remaining 18 bundles. MEASURED: "CERTIFICATION PASS COMPLETE: 19/19 features certified (18 re-run, 1 kept)", every call finish=stop, 1,491,133 prompt tokens total. Verdicts: PARTIAL ×12, NOT-VISIBLE ×7 (from PARTIAL ×10 / NOT-VISIBLE ×9 under v1).

- [x] **Phase 3 — Verdict.** `verdict.md`: three-way comparison table (original / recert / goal-grounded), recurring LAYER 2 absence findings (loading overlay 13/19, error-state feedback 17/19, success feedback 5/19, ON badge off-camera 4/19), direct answers to the operator's three questions, coverage honesty section.

- [x] **Phase 4 — Close-out.** AC-4 check (git status clean on js/ manifest.json test/), housekeeping guard, explicit-path local commit, never push.

## Resume-safety

Per-feature JSONs are written as they complete; `needs_rerun` skips bundles already carrying a v2-certified record, so an interrupted pass resumes without re-paying completed calls.

## Method-correction log (cumulative approaches — Muse-First protocol)

1. **v1 assertion-grounded prompt** (the recert's instrument): no product brief, no base-sheet exclusion, undefined verdict scale, absence findings discouraged by rule (1). Result: the operator's challenge upheld — the judge described the website's surfaces as the evidence and priced no product-aim gaps. Disposition: REPLACED for product certification.
2. **v2 goal-grounded prompt, pilot bundle**: every target behavior of the prompt demonstrated on the first call (WEBSITE/EXTENSION attribution; the loading-overlay absence found; structured layers; clean verdict line). Disposition: ADOPTED.
3. **v2 full pass**: 19/19 certified, 17/19 verdicts stable, 2 LAYER-1 moves, 13/19 loading-overlay findings. Disposition: ADOPTED — the goal-grounded certificate supersedes the recert's as the product-aim record; the recert stands as the suite-assertion record.
