# Plan — e2e_feature_inventory_minimax_20261029

Executed by a SEPARATE Reasonix session launched from LAUNCH-PROMPT.md (deliberation ADOPTED
candidate A: single-session sequential). This session only built the track; all phases below
are the delegated session's work.

## Phases (for the delegated session — all resume-safe via progress.jsonl)

- [ ] **Phase 0 — Orientation + model-id pinning.** Read spec.md, metadata.json,
  `test/browser_e2e/spec_inventory.json`, `conductor/tracks/ux_feature_fleet_20261029/units.json`.
  Resolve the requested "minimax 3.1 flash" to the EXACT model id the official MiniMax API
  (api.minimax.io) accepts (query its published model list); record the resolution or the mismatch.
- [ ] **Phase 1 — Videography launcher.** Author the track's own launcher (under this track's
  directory, e.g. `execution/run_inventory_e2e.js`) that boots the harness's
  `launchExtensionContext` with Playwright `video: "on"` and replays the 82 inventory specs
  suite-by-suite, retaining ONE full video per suite under `execution/evidence/<suite>/`.
  No existing spec/js/manifest file is edited (AC-4).
- [ ] **Phase 2 — Sequential e2e execution (AC-1).** Run all 82 suites / 432 tests live against
  the unpacked extension (per-suite timeout 900 s). Append ONE progress.jsonl row per suite:
  `{"suite":"<file>","feature":"<unit id or cross-cutting>","passing":N,"failing":N,"video":"<path>","ts":...}`.
- [ ] **Phase 3 — Video evidence assembly (AC-2).** Confirm a full video artifact exists for
  EVERY feature in the inventory (18 fleet units from units.json + the cross-cutting suites).
  Missing video = that feature fails AC-2, recorded not fabricated.
- [ ] **Phase 4 — MiniMax certification (AC-3, AC-6).** For each feature: send its full video(s)
  to the pinned MiniMax model via the OFFICIAL MiniMax API; record request, resolved model id,
  response, verdict text verbatim under `execution/minimax/<feature>.json`. Only MiniMax judges.
- [ ] **Phase 5 — Verdict assembly (AC-5).** Write `verdict.md`: per-feature table (mocha counts,
  video path, MiniMax verdict, regression flag vs the fleet's archived green), overall verdict,
  model-id resolution record.
- [ ] **Phase 6 — Close-out (AC-4, AC-5).** `git status -- js/` empty check; housekeeping guard;
  commit verdict artifacts with explicit paths, Conventional Commits message
  `docs(e2e-minimax): feature-inventory video certification verdict (<date>)`. NEVER push.

## Feature checklist (tick as each certifies — 18 fleet units from units.json + cross-cutting suites)

- [ ] feature_01_ai_arrange — byok_arrange_roundtrip.spec.js
- [ ] feature_02_ai_borders — byok_border_gallery.spec.js
- [ ] feature_03_layer_management — layer_print_visibility.spec.js + layer_reorder_keyboard.spec.js
- [ ] feature_04_shape_picker — (unit-only in fleet; e2e-adjacent: custom_shapes_upload.spec.js)
- [ ] feature_05_controls_panel — (unit-only in fleet; e2e-adjacent: panel_measure.spec.js)
- [ ] feature_06_print_styles — print_styles.spec.js
- [ ] feature_07_persistence — byok_settings_persistence.spec.js + byok_settings_persistence_types.spec.js + persistence_panel.spec.js
- [ ] feature_08_layout_operations — (layout e2e: print_per_layer.spec.js, section_print_order.spec.js)
- [ ] feature_09_section_cloning — section_cloning.spec.js
- [ ] feature_10_undo_system — undo_stack_visual_capture.spec.js + undo_stack_class_verification.spec.js
- [ ] feature_11_spells_ui — spell_detail_sections.spec.js
- [ ] feature_12_properties_panel — properties_panel.spec.js
- [ ] feature_13_ui_theme — (theme e2e: icons_privacy_surface.spec.js)
- [ ] feature_14_filters — print_filter_identity_probe.spec.js + composite e2e
- [ ] feature_15_modals — modal_primitive_visual_capture.spec.js
- [ ] feature_16_background_context — (background e2e: sheet_autoscroll.spec.js)
- [ ] feature_17_dnd — affordance_drag_hover_shadows.spec.js + drag_glow_layers.spec.js + drag_ux_visual_capture.spec.js
- [ ] feature_18_image_processor — webp_assets.spec.js
- [ ] cross-cutting suites (the ~20 inventory files not mapped to a fleet unit: manual_verification_phase0-4, *_visual_capture family, release_1_3_2/1_4_0, zz_border_diag, etc.)

## Pause rules (resume-safe)

- A RED suite does NOT stop the sequence; it is recorded and the run continues. A feature whose
  mocha result is RED still gets its video sent to MiniMax (the certification question is "is the
  feature working", and a red suite is itself evidence).
- Context pressure: commit progress.jsonl + a PARTIAL verdict, then exit cleanly; a relaunch
  resumes from the last progress row.
