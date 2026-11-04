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

- **Missing activation loading/transition overlay** — confirmed by the UNPRIMED control arm in 12/19 bundles and by the seeded v2 arm in 13/19 (the enhancement "pops in" abruptly after the site's own spinner) — the exact gap the operator named. Candidate small fix: an extension-owned "Enhancing sheet…" overlay for the activation window. NOT implemented here (verification-only track; new product work needs its own track).
- **Error/progress feedback roughness** (17/19): async flows (AI Arrange) show no in-flight progress and no explanatory error states.
- **End-of-flow success feedback** (5/19): recordings end on preview states without an "applied" confirmation on camera.
- **Capture-harness limitation:** the toolbar ON badge is never in frame (4/19 records note it) — if badge state matters to certification, the capture harness needs a toolbar-region capture mode.

## Residuals

- 17/19 verdicts did not move under v2: where the corpus never samples an assertion (f05 properties measurements, f12, f14, f16), no prompt can conjure evidence — NOT-VISIBLE rows are evidence-sampling verdicts, not product-failure verdicts.
- `first_run_card_verify` remains mocha-row-covered (4/0) and NOT a MiniMax-judged bundle in any run; its video was never sent to the judge (only the cross-cutting representative 8 were).

## Addendum — contamination audit + unseeded control arm (operator follow-up challenge, same session)

The operator's follow-up was correct and is upheld: **the loading-overlay finding above was seeded by me, not discovered by the judge.** The v2 ACTIVATION ARC instructs the judge to expect a smooth activation transition and to report its absence explicitly — so the "13/19" count was transmitted through the prompt. A contamination audit (`temp/scratch/contamination_audit.py`) classified every v2 Layer-2 bullet: SEEDED (transmitted via the instruction), DESCRIBED (product surface named in the PRODUCT_BRIEF for grounding), MODEL-AUTHORED (class exists nowhere in the prompt — e.g. f04's upload-lifecycle absences, f07's undo-stack-not-surfaced, f10's rotate-round-trip-absent).

To answer the question empirically rather than by argument, a **control arm (prompt v3)** was run: identical to v2 EXCEPT the seeded absence instruction is deleted (the activation arc is stated factually, with no expectation and no prescribed absence class; the general LAYER-2 absence duty was kept). Script: `temp/scratch/certify_control.py`; corpus/seat/knobs unchanged; records: `execution/minimax_control/<feature>.json` ×19 + `summary.json`, all `prompt_version: v3 CONTROL`.

Results: **the judge finds the activation/loading-transition absence class unprompted in 12/19 bundles** (cross-cutting, f01, f05, f08, f09, f10 ×2 — one explicitly distinguishing "the only loading spinner shown is D&D Beyond's own" — f12, f13, f15, f16, f18: verbatim quotes in verdict.md's method-correction log entry 5). The unprimed judge also produced MORE distinct absence classes than the seeded arm on 4/5 pilot bundles (f09: 14 vs 8 bullets) — seed language narrowed the judge's search, it did not correct it.

**What this establishes:**

1. The missing activation overlay is REAL and judgment-grade even without priming — the user's core suspicion is confirmed, and v2-vs-v3 makes the finding contamination-free (the correct reporting from now on is "primed 13/19 AND unprimed 12/19", not "13/19 by the judge").
2. The v2 certificate's OTHER Layer-2 findings stand (they were produced under a rubric duty, and the control arm re-produces the same class families unprompted — error states, disabled states, success feedback, toolbar-off-camera).
3. The claimed "the judge found what the product lacks" is true for this class but was not true as originally narrated — a correction now on the record.

**Action item unchanged:** an extension-owned "Enhancing sheet…" activation overlay remains the product fix this evidence points at; NOT implemented here (verification-only track; new product work needs its own track).

## Tracker dispositions (filed this session, BEYOND/YouTrack)

The 11 distinct absence classes the **unprimed control arm (v3)** surfaced were distilled into 11 issues via the framework's file_issue CLI (PLAN dry-run for all 11 first, then `--apply`), each description quoting verbatim judge text from `execution/minimax_control/*.json` and cross-linking the related existing UX issues (BEYOND-9…15) instead of near-duplicate refilings:

| issue | class | priority |
|---|---|---|
| BEYOND-18 | activation-transition overlay absent (12/19 bundles unprompted) | Major |
| BEYOND-19 | state-invisible work: no progress/error/transition feedback | Major |
| BEYOND-20 | no success confirmation after Save | Major |
| BEYOND-21 | print path never exercised end-to-end (headline aim) | Critical |
| BEYOND-22 | canvas-filters surface never shown open | Major |
| BEYOND-23 | undo-history UX (depth invisible, clipping, toast stacking) | Minor |
| BEYOND-24 | rotate + keyboard-nudge round trips unwitnessed | Minor |
| BEYOND-25 | upload lifecycle states undemonstrated | Minor |
| BEYOND-26 | spells Details flow never demonstrated | Minor |
| BEYOND-27 | panel real-estate: crowding, icon-only controls, title truncation | Minor |
| BEYOND-28 | export/import round trip never on camera | Minor |

All State=Triage, Kind=Defect, Type=Task; msf_key prefix `BEYOND-CERT-…-20261101-GOALGROUNDED-RECERT`; receipts `temp/issue_filings/BEYOND-{18..28}.json`; spec sources `temp/scratch/yt_specs/*.json`. Each issue's acceptance criteria are verification-gated: the class must be re-reproduced by this project's own e2e verification (the judge record is filing evidence, not closure evidence) plus attached closure artifacts.

**Status:** COMPLETE — archived to `conductor/archive/e2e_goalgrounded_recert_20261101/`, registry row in `vendor/conductor/tracks.md`, local commits a5db709 (certification) + the filing commit. Not pushed (never-push rule).
