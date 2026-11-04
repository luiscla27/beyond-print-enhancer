# Plan — e2e_feature_inventory_minimax_20261029

Executed by a SEPARATE Reasonix session launched from LAUNCH-PROMPT.md (deliberation ADOPTED
candidate A: single-session sequential). This session only built the track; all phases below
are the delegated session's work.

## Phases (for the delegated session — all resume-safe via progress.jsonl)

- [x] **Phase 0 — Orientation + model-id pinning.** Read spec.md, metadata.json,
  `test/browser_e2e/spec_inventory.json`, `conductor/tracks/ux_feature_fleet_20261029/units.json`.
  Resolve the requested "minimax 3.1 flash" to the EXACT model id the official MiniMax API
  (api.minimax.io) accepts (query its published model list); record the resolution or the mismatch.
  DONE 2026-10-30: pinned to **MiniMax-M3.1-Flash**; live host measured to be **api.minimax.io**
  (.io — .ai does not resolve from this network); resolution + correction recorded in verdict.md.
- [x] **Phase 1 — Videography launcher.** Author the track's own launcher (under this track's
  directory, e.g. `execution/run_inventory_e2e.js`) that boots the harness's
  `launchExtensionContext` with Playwright `video: "on"` and replays the 82 inventory specs
  suite-by-suite, retaining ONE full video per suite under `execution/evidence/<suite>/`.
  No existing spec/js/manifest file is edited (AC-4).
  DONE: `scripts/e2e_inventory_runner.js` + `scripts/e2e_video_preload.js` (tracked-excluded
  harness helpers — Playwright 1.63 context-level `video:{}` silently produces nothing on this
  harness, so the preload patches page screencast via mocha `--require`; no existing file edited).
- [x] **Phase 2 — Sequential e2e execution (AC-1).** Run all 82 suites / 432 tests live against
  the unpacked extension (per-suite timeout 900 s). Append ONE progress.jsonl row per suite:
  DONE: 82/82 suites ran; unique-suite totals passing=422 failing=11 (all 11 in 5 cross-cutting
  visual-capture suites — recorded verbatim in verdict.md, never repaired); progress.jsonl holds
  255 rows (resume retries included), latest-row-per-suite is the 82-row record.
- [x] **Phase 3 — Video evidence assembly (AC-2).** Confirm a full video artifact exists for
  EVERY feature in the inventory (18 fleet units from units.json + the cross-cutting suites).
  Missing video = that feature fails AC-2, recorded not fabricated.
  DONE: 82/82 suites carry ≥1 retained .webm (840 page videos total, 323 MB, size-ordered pick
  per suite with byte sizes on each progress row); AC-2 gap count at close = 0.
- [x] **Phase 4 — MiniMax certification (AC-3, AC-6).** For each feature: send its full video(s)
  to the pinned MiniMax model via the OFFICIAL MiniMax API; record request, resolved model id,
  response, verdict text verbatim under `execution/minimax/<feature>.json`. Only MiniMax judges.
  DONE: 19 bundle judge calls (18 features + 1 cross-cutting residual class), one call per
  feature bundle via Files API upload (purpose=video_understanding, mm_file:// refs) + chat
  completion (reasoning=low, max_completion_tokens=8000, detail=default, fps=5; knobs measured
  from probes A-F after the feature_07 truncation); verdicts: 0 WORKING / 7 PARTIAL / 12
  NOT-VISIBLE; every record names endpoint, model id, file ids, usage, VERBATIM verdict text.
- [x] **Phase 5 — Verdict assembly (AC-5).** Write `verdict.md`: per-feature table (mocha counts,
  video path, MiniMax verdict, regression flag vs the fleet's archived green), overall verdict,
  model-id resolution record.
  DONE 2026-10-30: `verdict.md` beside this plan — per-feature table, the 11 RED tests verbatim
  with measured root causes, regression-class analysis (first-ever run, not regressions),
  model-id appendix (.ai→.io host correction), judge-call-pattern appendix (18→19
  reconciliation), AC-4 audit, usage totals (1,494,110 tokens across 19 calls).
- [x] **Phase 6 — Close-out (AC-4, AC-5).** `git status -- js/` empty check; housekeeping guard;
  commit verdict artifacts with explicit paths, Conventional Commits message
  `docs(e2e-minimax): feature-inventory video certification verdict (<date>)`. NEVER push.
  DONE in this session: AC-4 audit empty; guard GREEN (tracker receipt refreshed via
  `python vendor/youtrack/reader.py read --root .` — the documented refresh path); explicit-path
  local commit (never pushed).

## Feature checklist (ticked as each certified — 18 fleet units from units.json + cross-cutting suites; ALL CERTIFIED 2026-10-30, verdicts in execution/minimax/<feature>.json)

- [x] feature_01_ai_arrange — byok_arrange_roundtrip.spec.js — 7/0 — PARTIAL
- [x] feature_02_ai_borders — byok_border_gallery.spec.js — 63/0 — NOT-VISIBLE
- [x] feature_03_layer_management — layer_print_visibility.spec.js + layer_reorder_keyboard.spec.js — 17/0 — PARTIAL
- [x] feature_04_shape_picker — (unit-only in fleet; e2e-adjacent: custom_shapes_upload.spec.js) — 5/0 — NOT-VISIBLE
- [x] feature_05_controls_panel — (unit-only in fleet; e2e-adjacent: panel_measure.spec.js + properties_panel.spec.js) — 7/0 — NOT-VISIBLE
- [x] feature_06_print_styles — print_styles.spec.js — 5/0 — NOT-VISIBLE
- [x] feature_07_persistence — byok_settings_persistence.spec.js + byok_settings_persistence_types.spec.js + persistence_panel.spec.js — 17/0 — PARTIAL
- [x] feature_08_layout_operations — (layout e2e: print_per_layer.spec.js, section_print_order.spec.js) — 10/0 — NOT-VISIBLE
- [x] feature_09_section_cloning — section_cloning.spec.js — 4/0 — NOT-VISIBLE
- [x] feature_10_undo_system — undo_stack_visual_capture.spec.js + undo_stack_class_verification.spec.js — 13/0 — PARTIAL
- [x] feature_11_spells_ui — spell_detail_sections.spec.js — 4/0 — NOT-VISIBLE
- [x] feature_12_properties_panel — properties_panel.spec.js — 6/0 — NOT-VISIBLE
- [x] feature_13_ui_theme — (theme e2e: icons_privacy_surface.spec.js) — 3/0 — PARTIAL
- [x] feature_14_filters — print_filter_identity_probe.spec.js — 4/0 — NOT-VISIBLE
- [x] feature_15_modals — modal_primitive_visual_capture.spec.js — 1/0 — PARTIAL
- [x] feature_16_background_context — (background e2e: sheet_autoscroll.spec.js) — 2/0 — NOT-VISIBLE
- [x] feature_17_dnd — affordance_drag_hover_shadows.spec.js + drag_glow_layers.spec.js + drag_ux_visual_capture.spec.js — 24/4 (drag_ux RED — see verdict.md §The 11 RED) — PARTIAL
- [x] feature_18_image_processor — webp_assets.spec.js — 3/0 — NOT-VISIBLE
- [x] cross-cutting suites (the ~20 inventory files not mapped to a fleet unit: manual_verification_phase0-4, *_visual_capture family, release_1_3_2/1_4_0, zz_border_diag, etc.) — 57 residual suites, 233/7 — PARTIAL (representative 8-suite bundle)

## Pause rules (resume-safe)

- A RED suite does NOT stop the sequence; it is recorded and the run continues. A feature whose
  mocha result is RED still gets its video sent to MiniMax (the certification question is "is the
  feature working", and a red suite is itself evidence).
- Context pressure: commit progress.jsonl + a PARTIAL verdict, then exit cleanly; a relaunch
  resumes from the last progress row.
