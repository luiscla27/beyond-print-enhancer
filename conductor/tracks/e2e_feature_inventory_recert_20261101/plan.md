# Plan — e2e_feature_inventory_recert_20261101

Re-certification only. All 82 suites already ran and have video evidence from the archived track. This plan verifies AC-1/AC-2 and re-runs the MiniMax certification (AC-3/AC-6/AC-7).

## Phases

- [ ] **Phase 0 — Verify evidence + pin model id.** Confirm all 82 suites have `video_bytes > 0` in the archived `progress.jsonl` (AC-1/AC-2). Confirm every feature dir under `execution/evidence/` holds at least one `.webm`. Resolve "minimax 3.1 flash" to the exact official MiniMax API model id (query the model list); record the resolution verbatim in the verdict.

- [ ] **Phase 1 — Verify AC-1 counts.** Cross-check the archived per-suite pass/fail against the fresh post-closure result: the 5 visual-capture suites must now read 45/45 (was 34/45). Record both the archived and the fresh counts, so the improvement is falsifiable.

- [ ] **Phase 2 — Re-certify all 19 bundles (AC-3, AC-6).** For each of the 18 fleet features + cross-cutting: transcode its video(s) → mp4, upload to the official MiniMax Files API, and make ONE chat call with all of that bundle's videos. Write `execution/minimax/<feature>.json` (endpoint, model id, redacted request, file ids, usage, verbatim verdict). Reuse the archived `certify_features.py` logic but write into THIS track's dir.

- [ ] **Phase 3 — Verdict with before/after (AC-7).** Write `verdict.md`: per-feature table with mocha counts + video path + new MiniMax verdict quote, plus an explicit **before/after comparison table** against the archived verdict, calling out the 5 visual-capture bundles.

- [ ] **Phase 4 — Close-out.** `git status -- js/ manifest.json test/` MUST be empty. Explicit-path local commit; never push. Guard green.

## Resume-safety

Per-feature JSONs are written as they complete, so an interrupted run resumes by skipping bundles whose JSON already exists.
