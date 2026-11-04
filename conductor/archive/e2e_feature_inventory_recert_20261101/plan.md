# Plan — e2e_feature_inventory_recert_20261101

Re-certification only. All 82 suites already ran and have video evidence from the archived track. This plan verifies AC-1/AC-2 and re-runs the MiniMax certification (AC-3/AC-6/AC-7).

## Phases

- [x] **Phase 0 — Verify evidence + pin model id.** Confirm all 82 suites have `video_bytes > 0` in the archived `progress.jsonl` (AC-1/AC-2). Confirm every feature dir under `execution/evidence/` holds at least one `.webm`. Resolve "minimax 3.1 flash" to the exact official MiniMax API model id (query the model list); record the resolution verbatim in the verdict.

- [x] **Phase 1 — Verify AC-1 counts.** Cross-check the archived per-suite pass/fail against the fresh post-closure result: the 5 visual-capture suites must now read 45/45 (was 34/45). Record both the archived and the fresh counts, so the improvement is falsifiable.

- [x] **Phase 2 — Re-certify all 19 bundles (AC-3, AC-6).** For each of the 18 fleet features + cross-cutting: transcode its video(s) → mp4, upload to the official MiniMax Files API, and make ONE chat call with all of that bundle's videos. Write `execution/minimax/<feature>.json` (endpoint, model id, redacted request, file ids, usage, verbatim verdict). Reuse the archived `certify_features.py` logic but write into THIS track's dir.

- [x] **Phase 3 — Verdict with before/after (AC-7).** Write `verdict.md`: per-feature table with mocha counts + video path + new MiniMax verdict quote, plus an explicit **before/after comparison table** against the archived verdict, calling out the 5 visual-capture bundles.

- [x] **Phase 4 — Close-out.** `git status -- js/ manifest.json test/` MUST be empty. Explicit-path local commit; never push. Guard green.

## Resume-safety

Per-feature JSONs are written as they complete, so an interrupted run resumes by skipping bundles whose JSON already exists.

## Method-correction log (cumulative approaches, 2026-11-01 session)

Per the Muse-First cumulative-approach protocol — every attempt with its measured result and disposition:

1. **Track-authored `certify.py`, first shape** — `reasoning_effort: medium`, `max_completion_tokens: 1600`, all content parts in ONE user message, part `type: "video"`. Result: all 19 bundles returned NOT-VISIBLE with ~680 prompt_tokens (frames never sampled). Disposition: WRONG SHAPE — 4 defects vs the archived working call.
2. **Same script, knobs fixed to archived values** (`reasoning: low`, `max_completion_tokens: 8000`) but single-message assembly kept. Result: still NOT-VISIBLE ×19 + one HTTP 400 (invalid params 2013). Disposition: PARTIAL FIX — message assembly still wrong.
3. **Message assembly fixed** (text prompt first, then each video in its own user message) and part type fixed to `video_url`. Result: feature_02 HTTP 400 mid-run, feature_01 still ~683 prompt_tokens / NOT-VISIBLE. Disposition: STILL FAILING despite matching the archived wire format on paper — one untraced residual difference remained.
4. **Fresh-upload processing-delay theory** — hypothesis: freshly uploaded files need processing time before frames are sampleable. FALSIFIED by probe (temp/scratch/fresh_upload_readiness.py): fresh upload + call at T+0s returned 42,391 prompt_tokens with a real frame-by-frame description. Disposition: theory dead; the fault is local to certify.py's call path.
5. **Short-prompt probe via requests** against an archived file_id with the archived wire format. Result: 42,431 prompt_tokens, real description. Disposition: proves the account, model, Files API, and mp4 path are all healthy; isolates the defect to certify.py.
6. **Fall back to the archived track's PROVEN certification script** (`temp/scratch/certify_features.py`, repointed to the recert track as `temp/scratch/certify_recert.py`: TRACK/EVID/progress paths redirected, PLAN_CHECKLIST unchanged because the recert reuses the archived bundle composition verbatim). Validated single-feature on feature_01 (PARTIAL, 275 words of observation), then ran all 19. Result: 19/19 certified, finish=stop, prompt_tokens per call 32,878–275,810 (matching the archived run's per-feature counts ±5), verdicts: PARTIAL ×10, NOT-VISIBLE ×9; 17/19 identical to the archived run, 2 genuine re-observation differences on the byte-identical corpus (feature_09, feature_18: NOT-VISIBLE→PARTIAL). Disposition: **ADOPTED** — the archived track del script was the correct instrument all along; certify.py remains only as the verdict.md builder (Phase 3) and AC-1 counter (Phase 1).

**Why evidence is the archived corpus, verbatim:** the recert's trigger (commit 2e4dc0e closing 11 RED visual-capture tests) changed mocha RESULTS, not the recorded page-level screencast evidence available to the certifier — the recert deliberately re-certifies the same corpus so its verdicts are comparable to the archived run's. The before/after improvement is therefore carried by the mocha columns (34P/11F → 45P/0F across the 5 visual-capture suites), while the video-verdict columns show what the same frames certify under an identical call shape.

**Token accounting (the operator's "did we waste tokens" question):** the two broken certify.py passes cost ~15k tokens each (negligible); the four probes ~a few hundred k; the adopted pass cost ~1.36M prompt tokens across 19 calls (32.9k–275.8k per call, identical in magnitude to the archived certification). No material waste: every byte uploaded (mp4s are byte-identical transcodings of the archived webms) produced a certified record, and the working call shape is now on record for future sessions.
