# Final report — e2e_goalgrounded_recert_20261101

**Close-out:** 2026-11-01 · **Operator directive:** full goal-grounded re-run of the 19-bundle MiniMax certification after the operator's upheld challenge that the v1 prompt let the judge score the D&D Beyond sheet itself and never price the missing activation loading overlay.

## What was done

1. **Instrument (Phase 0).** `temp/scratch/certify_goalgrounded.py` — a copy of the proven recert script (`certify_recert.py`) with TRACK repointed to this track and `judge_prompt_for` replaced by prompt v2: PRODUCT_BRIEF (what Beyond Print Enhancer is; the base D&D sheet explicitly declared NOT the extension's work), the activation arc (naming the loading-overlay affordance the judge is REQUIRED to report if absent), a TWO-LAYER rubric (LAYER 1 suite assertions; LAYER 2 product-aim conformance with absence findings mandatory), and a defined WORKING/PARTIAL/NOT-VISIBLE scale ending "Never award WORKING for activity that is the website's, not the extension's." Every record carries `prompt_version: v2`.
2. **Pilot (Phase 1).** `feature_01_ai_arrange` alone: finish=stop; the verbatim text attributes every observation WEBSITE-OWNED vs EXTENSION-OWNED and names, first among absences, "No smooth extension activation transition: there is no brief extension-specific loading/processing overlay." Both pilot criteria met → adopted.
3. **Full pass (Phase 2).** Remaining 18 bundles: 19/19 certified, all finish=stop, 1,491,133 prompt / 39,892 completion tokens. Verdicts: PARTIAL ×12, NOT-VISIBLE ×7 (v1: PARTIAL ×10 / NOT-VISIBLE ×9). Two LAYER-1 moves (feature_02, feature_04: NOT-VISIBLE → PARTIAL).
4. **Verdict (Phase 3).** `verdict.md`: three-way comparison (original / recert / goal-grounded), recurring LAYER 2 absences (loading/transition overlay 13/19; error-state/progress feedback 17/19; end-of-flow success feedback 5/19; ON badge off-camera 4/19), direct answers to the operator's three questions, coverage honesty.

## Acceptance criteria — evidence

- **AC-1 (19/19 fresh verdicts, verbatim recorded):** `execution/minimax/<feature>.json` ×19 + `summary.json` — endpoint, model id `MiniMax-M3.1-Flash`, redacted request, file ids, usage, verbatim text per bundle. Run log: "CERTIFICATION PASS COMPLETE: 19/19 features certified (18 re-run in this process, 1 kept from earlier batches)".
- **AC-2 (prompt v2 recorded):** every JSON's `prompt_version` names v2 and the template location; the template is deterministic from `temp/scratch/suite_titles.json`.
- **AC-3 (three-way table + explicit LAYER 2 findings):** verdict.md's comparison table + "LAYER 2 — the affordance findings the v1 certificate never made" section; the operator's loading-overlay example is quoted verbatim from feature_01 and counted 13/19.
- **AC-4 (no product/test/archive mutation):** `git status --short js manifest.json test` → empty at close; the only worktree change is the new `conductor/tracks/e2e_goalgrounded_recert_20261101/` directory; archived tracks untouched.
- **AC-5 (explicit-path local commit, never push, guard green):** commit `cert(e2e): goal-grounded re-run…` on this track's paths only; no push (project rule). Guard: 0 debt after close-out artifact landed.
- **AC-6 (single seat, official API):** every call to `https://api.minimax.io/v1/chat/completions` with model `MiniMax-M3.1-Flash`; no relay/router substitution.

## Findings the operator should act on (product, not evidence)

- **Missing activation loading/transition overlay** (found 13/19 bundles; the enhancement "pops in" abruptly after the site's own spinner) — the exact gap the operator named. Candidate small fix: an extension-owned "Enhancing sheet…" overlay for the activation window. NOT implemented here (verification-only track; new product work needs its own track).
- **Error/progress feedback roughness** (17/19): async flows (AI Arrange) show no in-flight progress and no explanatory error states.
- **End-of-flow success feedback** (5/19): recordings end on preview states without an "applied" confirmation on camera.
- **Capture-harness limitation:** the toolbar ON badge is never in frame (4/19 records note it) — if badge state matters to certification, the capture harness needs a toolbar-region capture mode.

## Residuals

- 17/19 verdicts did not move under v2: where the corpus never samples an assertion (f05 properties measurements, f12, f14, f16), no prompt can conjure evidence — NOT-VISIBLE rows are evidence-sampling verdicts, not product-failure verdicts.
- `first_run_card_verify` remains mocha-row-covered (4/0) and NOT a MiniMax-judged bundle in any run; its video was never sent to the judge (only the cross-cutting representative 8 were).
