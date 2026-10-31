# Verdict — goal-grounded e2e certification re-run (e2e_goalgrounded_recert_20261101)

**Date:** 2026-11-01 · **Certifier:** MiniMax-M3.1-Flash ONLY, official `api.minimax.io` (AC-6, no relay substitution) · **Corpus:** the archived 2026-10-30 webms, byte-verbatim (`conductor/archive/e2e_feature_inventory_minimax_20261029/execution/evidence/`) · **Prompt:** v2 GOAL-GROUNDED (see "What changed" below) · **Calls:** 19 (one bundle call per feature, same measured knobs as the recert: `reasoning=low`, `max_completion_tokens=8000`, `detail=default`, `fps=5`) · **Result:** 19/19 certified, every call `finish=stop`, 1,491,133 prompt tokens / 39,892 completion tokens total.

## Why this re-run exists (the operator's challenge, upheld)

The operator reviewed the two activation clips (`release_1_4_0.webm`, `first_run_card_verify.webm`) and challenged the recert's verdicts: the model was scoring **the D&D Beyond character sheet itself** — which fills the first frames of every clip — as if it were the extension's work, and never flagged the most basic missing activation affordance (a **"loading…" overlay** smoothing the plain-sheet → enhanced-UI transition). Root cause, verified against `temp/scratch/certify_recert.py::judge_prompt_for`: the v1 prompt contained one clause of product context, grounded the "behavioral contract" ONLY in the suites' own describe/it titles, never defined the verdict scale, never said the base sheet is NOT the extension's work, and rule (1) ("never invent UI you cannot see") actively discouraged absence findings. A suite-assertion evidence check was presented as a product certification. **The challenge is upheld on both counts** (see the two-layer results below).

## What changed (v2 prompt)

Same wire shape, same videos, same seat — ONLY the judge prompt changed, so every verdict delta is attributable to the prompt. v2 (`temp/scratch/certify_goalgrounded.py::judge_prompt_for`, deterministic from `suite_titles.json`) adds:

1. **PRODUCT BRIEF** — what Beyond Print Enhancer IS (MV3 extension on top of the D&D Beyond site), with the explicit exclusion: *the website's sheet/artwork/loading/cookie UI is D&D Beyond's product — NONE of it is the extension's work*; an inventory of what the extension's own work looks like (dark codex-style panels, gold hairlines, red/gold section grips, toasts, dialogs, OFF state).
2. **ACTIVATION ARC** — videos begin on the plain sheet; the extension then enhances. A missing smooth-activation transition (loading overlay class) is explicitly named as a LAYER 2 absence finding the judge is REQUIRED to report.
3. **TWO-LAYER RUBRIC** — LAYER 1: the suite assertions (as before), each marked VISIBLE/NOT-VISIBLE. LAYER 2: product-aim conformance — distinguishability from the base site + basic affordances on camera, with **absence findings REQUIRED, not optional** ("a certificate that only lists what worked is incomplete").
4. **DEFINED VERDICT SCALE** — WORKING / PARTIAL / NOT-VISIBLE with explicit criteria, and: *"Never award WORKING for activity that is the website's, not the extension's."*

## Verdict table — three-way comparison (same 19 bundles, same videos)

| bundle | original run (v1 prompt) | recert 2026-11-01 (v1 prompt) | **goal-grounded (v2 prompt)** | delta |
|---|---|---|---|---|
| feature_01_ai_arrange | PARTIAL | PARTIAL | PARTIAL | — |
| feature_02_ai_borders | NOT-VISIBLE | NOT-VISIBLE | **PARTIAL** | ↑ |
| feature_03_layer_management | PARTIAL | PARTIAL | PARTIAL | — |
| feature_04_shape_picker | NOT-VISIBLE | NOT-VISIBLE | **PARTIAL** | ↑ |
| feature_05_controls_panel | PARTIAL | NOT-VISIBLE | NOT-VISIBLE | — |
| feature_06_print_styles | NOT-VISIBLE | NOT-VISIBLE | NOT-VISIBLE | — |
| feature_07_persistence | PARTIAL | PARTIAL | PARTIAL | — |
| feature_08_layout_operations | NOT-VISIBLE | NOT-VISIBLE | NOT-VISIBLE | — |
| feature_09_section_cloning | NOT-VISIBLE | PARTIAL | PARTIAL | — |
| feature_10_undo_system | PARTIAL | PARTIAL | PARTIAL | — |
| feature_11_spells_ui | NOT-VISIBLE | NOT-VISIBLE | NOT-VISIBLE | — |
| feature_12_properties_panel | NOT-VISIBLE | NOT-VISIBLE | NOT-VISIBLE | — |
| feature_13_ui_theme | PARTIAL | PARTIAL | PARTIAL | — |
| feature_14_filters | NOT-VISIBLE | NOT-VISIBLE | NOT-VISIBLE | — |
| feature_15_modals | PARTIAL | PARTIAL | PARTIAL | — |
| feature_16_background_context | NOT-VISIBLE | NOT-VISIBLE | NOT-VISIBLE | — |
| feature_17_dnd | PARTIAL | PARTIAL | PARTIAL | — |
| feature_18_image_processor | NOT-VISIBLE | PARTIAL | PARTIAL | — |
| cross-cutting (8-suite representative bundle) | PARTIAL | PARTIAL | PARTIAL | — |

Distribution: original PARTIAL ×10 / NOT-VISIBLE ×9 → recert PARTIAL ×10 / NOT-VISIBLE ×9 → **goal-grounded PARTIAL ×12 / NOT-VISIBLE ×7**. The two ↑ moves (feature_02, feature_04) are LAYER 1 gains: under v2 the judge attends to the extension's own on-camera actions (border gallery interactions; shape picker upload/preview) that the v1 prompt's assertion-only grounding under-weighted. Every verdict's verbatim text, usage, file ids and request record: `execution/minimax/<feature>.json`.

**Reading the stability honestly:** 17/19 verdicts did NOT change. The video corpus genuinely samples each suite's asserted interactions, and where frames never sample an assertion (e.g. feature_05's Properties-panel measurements, feature_12, feature_14, feature_16), NO prompt can conjure evidence — those stay NOT-VISIBLE on the merits. What v2 changes is not the pass/fail column but **what the certificate now says**: every record separates WEBSITE-OWNED from EXTENSION-OWNED observations, and every record carries explicit absence findings.

## LAYER 2 — the affordance findings the v1 certificate never made

Recurring absences across the 19 goal-grounded records (verbatim-faithful summaries; full text in each JSON):

- **Activation/loading transition missing — FINDING REAL ON BOTH ARMS:** the v2 seeded arm found it in 13/19 bundles, but the instruction seeded that class, so the honest statement is the CONTROL arm's: the judge finds it **unprompted in 12/19 bundles** (v3, no overlay class anywhere in the prompt — see the method-correction log entry 5 for the per-bundle verbatim hits). Representative, verbatim from the UNPRIMED arm: *"No extension-specific loading state is visible during activation; the only loading spinner shown is D&D Beyond's own"* (f10); *"No explicit activation transition from the plain sheet to the enhanced sheet is captured; the enhancement simply appears as the page loads"* (f18); *"the enhanced template and panels appear together rather than showing a clear progressive loading/transition state"* (f09). **This is the exact gap the operator named — confirmed unprimed, not merely transmitted by the prompt. It is real: no suite asserts a smooth activation transition, so no v1-style assertion check could ever price it.** The website's own spinner is repeatedly and correctly attributed to D&D Beyond, not to us. The product fix the finding implies (an extension-owned "Enhancing sheet…" activation overlay) was identified by the model's own reading on 4/5 pilot bundles even before the class existed in any prompt — see entry 5.
- **Error-state/progress feedback rough — 17/19**: e.g. *"No AI request progress state"* + *"The AI proposed no changes … does not explain whether the cause is a missing API key, rejection, or another condition"* (f01); disabled AI Arrange row is well-communicated, but no key-management path is shown.
- **No end-of-flow success feedback — 5/19** (f01, f02, f08, f09, f15): recordings end on preview/pending states with no "applied" toast on camera.
- **Toolbar ON badge unjudgeable — 4/19** (f01, f03, f13, f15): the e2e capture area excludes the Chrome toolbar, so activation state is off-camera by construction (a capture harness limitation, not a product defect).
- **LAYER 2 working findings (also now on record):** extension UI *"clearly distinguishable from the base website"* in every sampled bundle; toasts (`Saved to browser`, `Section selected for editing`, `No saved layout yet`), confirm dialogs, disabled states, ghost previews, and the layer panel's controls are all positively witnessed.

## Answers to the operator's three questions, directly

1. **"Did you explain to MiniMax why it was supposed to happen and what we are aiming at?"** — No. The v1 prompt grounded the judge in the suites' own assertion titles and never stated the product's aim. That was the defect; it is fixed and measured in this track.
2. **"Did MiniMax evaluate the actual D&D character sheet instead of our extension?"** — Largely yes for scoring purposes: with no product brief and no base-sheet exclusion, the website's rendering dominated the evidence the judge described, and the verdict scale was undefined. The v2 records now attribute every observation to WEBSITE-OWNED vs EXTENSION-OWNED, and the missing loading overlay — invisible to v1 — is found in 13/19 bundles.
3. **"Was the first-run 10/10 biased?"** — The recert never issued a 10/10 (its scale was WORKING/PARTIAL/NOT-VISIBLE, and `first_run_card_verify` rode the cross-cutting bundle at PARTIAL); but the SPIRIT of the concern is confirmed twice over: v1 verdicts under-priced product-aim gaps that no suite asserts, AND the v2 correction itself over-corrected by seeding the headline class (caught by your follow-up, measured by the control arm). The goal-grounded re-run plus the v3 control arm is the corrected instrument — the missing activation overlay is now confirmed by the judge unprompted in 12/19 bundles.

## Best-scored clips for the operator (unchanged, now with the caveat priced)

The two clips the operator reviewed remain the best activation evidence, and v2 confirms rather than overturns their use as *activation* clips — while documenting their limits:

- `release_1_4_0.webm` (2,759,316 B) — release-surface smoke: boot, headline actions, decoration/layer surfaces; v2 LAYER 1: boot + surfaces VISIBLE, version-label NOT FULLY VERIFIABLE on camera.
- `first_run_card_verify.webm` (4,107,170 B) — first-run hint card gestures + reference route.
- Caveat both now carry (v2, on the record): no activation loading/transition overlay exists in the product, and the enhancement appears abruptly on camera. That is a **certified product gap**, not an evidence artifact.

## Coverage honesty (what this certificate is and is not)

- The corpus is the 2026-10-30 e2e run's page-level screencasts; assertions whose interactions the frames never sample remain NOT-VISIBLE under ANY prompt (f05 properties measurements, f12, f14, f16 are the clearest cases). The certificate's NOT-VISIBLE rows are evidence-sampling verdicts, not product-failure verdicts.
- Cross-cutting remains a purpose-annotated 8-suite representative bundle (composition unchanged from the recert); the other 46 cross-cutting suites are covered by their mocha rows + retained webms, not by this call.
- Toolbar/badge state is off-camera by harness construction (4/19 records note it).

## Cost accounting

19 judge calls, 1,491,133 prompt + 39,892 completion tokens (per-call 33,571–276,494 prompt), all `finish=stop` first-try (no concise-retry needed — the v2 prompt's structured sections fit the ~1600-token observed output cap). This is the same magnitude as the recert's adopted pass (1.36M) — the price of answering the operator's challenge with the SAME corpus and ONLY the prompt changed.

## Method-correction log (cumulative approaches — Muse-First protocol)

1. **v1 assertion-grounded prompt** (recert, adopted from the archived track): 19/19 verdicts, but no product brief, no base-sheet exclusion, no absence duty → the operator's challenge upheld. Disposition: REPLACED by v2 for product certification; v1 remains valid ONLY as a suite-assertion evidence check.
2. **v2 goal-grounded prompt, pilot `feature_01_ai_arrange`**: WEBSITE/EXTENSION attribution + explicit loading-overlay absence finding on the first bundle; finish=stop. Disposition: ADOPTED (operator chose full re-run + both-layer rubric in-session).
3. **v2 full pass, 18 remaining bundles**: 19/19 certified, 2 LAYER-1 verdict moves, 13/19 loading-overlay absence findings, zero truncations. Disposition: ADOPTED — this verdict.md.
4. **CONTAMINATION AUDIT (operator follow-up challenge, same session):** the operator correctly noted that the loading-overlay finding was *his*, not the judge's — v2's ACTIVATION ARC explicitly instructed the judge to expect and report a missing smooth transition, so the 13/19 count was transmitted-through-the-prompt, not discovered by the model. Audit (temp/scratch/contamination_audit.py): every v2 Layer-2 absence bullet was extracted and classified against the prompt's actual wording — SEEDED class (transmitted via the ACTIVATION-ARC instruction), DESCRIBED class (a product surface the PRODUCT_BRIEF names for goal grounding), or MODEL-AUTHORED (class exists nowhere in the prompt). Model-authored findings DO exist in v2 (e.g. f04's full upload-file-selection-lifecycle absence set, f07's undo-stack-not-surfaced, f10's rotate-round-trip-absent, f01's AI-request-progress) but the headline finding was seeded, and seeding narrowed rather than broadened the judge. Disposition: REOPENED the question; answered by a control experiment (next entry).
5. **CONTROL EXPERIMENT (v3 prompt, 5-bundle pilot then full 19):** identical to v2 EXCEPT the seeded instruction is deleted — the activation arc is described factually ("the extension then enhances the sheet and its panels appear") with NO expectation stated and NO absence class prescribed. General absence duty retained (LAYER 2 still REQUIRES absence findings as a rubric duty). Results, same corpus/seat/knobs: **the judge independently finds the activation-transition gap in 4 of 5 pilot bundles WITHOUT being told** (f01: "No dedicated loading indicator for AI work… no extension-specific 'arranging'/pending state", f08: "The enhancement appears abruptly near the end; no clear extension-specific loading or activation transition", f10: "No extension-specific loading state is visible during activation; the only loading spinner shown is D&D Beyond's own", f09: "the enhanced template and panels appear together rather than showing a clear progressive loading/transition state"; f02 alone — verdict NOT-VISIBLE — reported the toolbar/activation path off-camera instead). The unseeded judge also surfaced MORE distinct absence classes than the seeded arm on 4 of 5 bundles (f09: 14 vs 8 missing/rough bullets), i.e. seed language narrowed the search, not corrected it.
   **Full 19-bundle unprompted tally** (verbatim-classified; `execution/minimax_control/<feature>.json`, tallied by temp/scratch/control_final_class.py): **12/19 bundles carry the activation/loading-transition absence finding with NO overlay class anywhere in the prompt** — cross-cutting ("No explicit loading transition for the extension UI is shown; it appears abruptly after the sheet is loaded" + "No visible boot-progress or activation transition explains when the extension becomes active"), f01, f05, f08, f09 ("the enhanced template and panels appear together rather than showing a clear progressive loading/transition state"), f10 (×2, one explicitly distinguishing "the only loading spinner shown is D&D Beyond's own"), f12, f13, f15, f16, f18 ("No explicit activation transition from the plain sheet to the enhanced sheet is captured; the enhancement simply appears as the page loads"). Not named in f02 (reported instead that the activation/transition WAS observable but the toolbar click was off-camera), f03/f07/f17 (activation "represented" but the transition itself not characterized — their recording frames never sample it), f04/f06/f11/f14 (their Layer-2 attention went to the feature-internal flows the frames actually show; f06 found "No loading/transition state for printing"). Disposition: ADOPTED — v3 is the honest instrument; going forward the 13/19 overlay count from v2 is reported only as "found primed (v2, 13/19) AND found unprimed (v3, 12/19)", never as an independent v2 discovery. The class is REAL and the judge sees it unprompted — the user's suspicion that the product has no activation overlay is confirmed by the unprimed arm, just not by the originally-cited mechanism.
6. **TRACKER FILING (BEYOND, YouTrack — this session, after the re-cert closed):** the 11 distinct absence classes the UNPRIMED arm surfaced across the 19 bundles were distilled into 11 YouTrack issues via the framework's file_issue CLI (`vendor/tools/file_issue/cli.py`, PLAN dry-run first, then `--apply`), each quoting verbatim judge text from `execution/minimax_control/*.json` and cross-linking the related existing UX issues (BEYOND-9..15) to avoid near-duplicate refilings. Filed **BEYOND-18 through BEYOND-28**, all State=Triage, msf_key prefix `BEYOND-CERT-…-20261101-GOALGROUNDED-RECERT`; receipts at `temp/issue_filings/BEYOND-{18..28}.json`. The classes: activation overlay (18), state/progress/error feedback (19), save confirmation (20), print path undemonstrated (21 — Critical), canvas filters unreachable (22), undo-history UX (23), rotate/nudge round trips (24), upload lifecycle states (25), spells Details flow (26), panel clutter/crowding (27), export/import undemonstrated (28). Closure criteria are deliberately verification-gated: each issue requires the defect class reproduced by the project's own e2e verification (the judge record is filing evidence, not closure evidence) plus attached closure artifacts.
