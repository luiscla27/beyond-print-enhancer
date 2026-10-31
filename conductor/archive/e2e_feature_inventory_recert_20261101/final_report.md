# Final Report — e2e_feature_inventory_recert_20261101

**Date:** 2026-11-01 · **Track type:** re-certification of `e2e_feature_inventory_minimax_20261029` (archived)
**Certifier:** MiniMax-M3.1-Flash (pinned, official api.minimax.io, single certifier seat per AC-6)
**Model resolution:** operator phrase "minimax 3.1 flash" pinned to MiniMax-M3.1-Flash, re-verified live this session: GET https://api.minimax.io/v1/models → 200 OK, "MiniMax-M3.1-Flash" first entry (owner minimax, created 1789556118). Model id used verbatim in every call, never substituted.
**Evidence source:** archived track corpus, verbatim — all 82 suites, full page-level screencast (.webm), re-certified as 19 feature bundles (18 fleet features + cross-cutting, per the archived PLAN_CHECKLIST composition).

## Result: 19/19 bundles certified

- **PARTIAL ×10:** feature_01_ai_arrange, feature_03_layer_management, feature_07_persistence, feature_09_section_cloning, feature_10_undo_system, feature_13_ui_theme, feature_15_modals, feature_17_dnd, feature_18_image_processor, cross-cutting
- **NOT-VISIBLE ×9:** feature_02_ai_borders, feature_04_shape_picker, feature_05_controls_panel, feature_06_print_styles, feature_08_layout_operations, feature_11_spells_ui, feature_12_properties_panel, feature_14_filters, feature_16_background_context
- Every call: finish_reason=stop, prompt_tokens 32,878–275,810 (per-call counts match the archived run's ±5), usage recorded verbatim per bundle in `execution/minimax/<feature>.json`.
- **17/19 verdicts identical to the archived run.** Two genuine re-observation differences on the byte-identical corpus (NOT-VISIBLE → PARTIAL): feature_09_section_cloning, feature_18_image_processor — recorded honestly, not harmonized.

## Before / after (the recert's trigger)

The 5 visual-capture suites closed 11 RED tests in commit 2e4dc0e:

| Suite | Archived | Fresh | Delta |
|-------|----------|-------|-------|
| drag_ux_visual_capture.spec.js | 6P / 4F | 10P / 0F | +4 |
| ui_ux_audit_visual_capture.spec.js | 1P / 3F | 4P / 0F | +3 |
| custom_templates_visual_capture.spec.js | 4P / 2F | 6P / 0F | +2 |
| picker_ux_visual_capture.spec.js | 17P / 1F | 18P / 0F | +1 |
| shape_layer_ps_visual_capture.spec.js | 6P / 1F | 7P / 0F | +1 |
| **Total** | **34P / 11F** | **45P / 0F** | **+11P, −11F** |

These suites' bundles all ride the cross-cutting row (the archived PLAN_CHECKLIST's composition), whose verdict stayed PARTIAL both runs — the improvement is carried by the mocha columns, and the video-verdict columns re-certify the same archived frames under an identical call shape (see plan.md's method-correction log for why the corpus is the archived one).

## Method correction (what went wrong and what fixed it)

The track-authored `certify.py` Phase 2 initially produced NOT-VISIBLE ×19 with ~680 prompt_tokens (frames never sampled) through **five** cumulative attempts (full log with dispositions in plan.md §"Method-correction log"):

1. Wrong call shape (reasoning=medium, 1600-token cap, single-message assembly, `type: "video"` parts) → NOT-VISIBLE ×19.
2. Knobs fixed (reasoning=low, 8000 tokens) → still NOT-VISIBLE ×19 + one HTTP 400 (invalid params 2013).
3. Message assembly fixed (text-first, one video per user message, `type: "video_url"`) → still failing; one untraced residual difference remained.
4. Fresh-upload processing-delay theory — **FALSIFIED**: probe returned 42,391 prompt_tokens + real descriptions at T+0s on a fresh upload (temp/scratch/fresh_upload_readiness.py).
5. Short-prompt probe (42,431 prompt_tokens) proved account/model/Files-API/mp4 path all healthy → fault isolated to certify.py's call path.

**Adopted fix:** the archived track's PROVEN certification script — `temp/scratch/certify_features.py` repointed as `temp/scratch/certify_recert.py` (TRACK/EVID/progress paths redirected to the recert track + archive; PLAN_CHECKLIST and the measured call knobs unchanged because the recert reuses the archived bundle composition verbatim). Validated single-feature (feature_01 → PARTIAL, matching the archived verdict for that bundle), then ran all 19 → 19/19 certified. certify.py is retained as the verdict.md builder (Phase 3) and AC-1 counter (Phase 1) only.

## Falsified theories (recorded so nobody re-burns tokens)

- "MiniMax-M3.1-Flash cannot see video in the API chat" — FALSE (42k+ prompt_tokens + frame-level descriptions on every working call).
- "Fresh uploads need processing time" — FALSE (works at T+0s).
- "mp4 format was the problem" — FALSE (the pipeline already transcodes webm→mp4 H.264; the archived working run sent mp4 too).

## Verification receipts

- `git status -- js/ manifest.json test/` — **CLEAN** (verification-only constraint honored; no product or test edits).
- Guard: `python vendor/housekeeping_guard.py check` — the only debt it names for this repo state is this close-out artifact requirement, satisfied by this file; no issues debt for the recert (0 actionable items).
- Outputs: `conductor/tracks/e2e_feature_inventory_recert_20261101/` — verdict.md, plan.md (checkboxes flipped + method log), execution/minimax/{19 feature JSONs + summary.json}, certify.py.
- Token accounting: broken passes ~15k tokens each (negligible), probes a few hundred k, adopted pass ~1.36M prompt tokens across 19 calls — the real certification cost, same magnitude as the archived run. No material waste; every uploaded byte produced a certified record.

**Local commit only (never push, per project rule).**
