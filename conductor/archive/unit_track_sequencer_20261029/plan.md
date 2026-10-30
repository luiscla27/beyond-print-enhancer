# Plan — unit_track_sequencer_20261029

Executed by a SEPARATE Reasonix session launched from LAUNCH-PROMPT.md. This session only
built the track; all execution phases below are the delegated session's work.

## Phases (for the delegated session — all resume-safe)

- [ ] **Phase 0 — Orientation.** Read README.md, spec.md, metadata.json (track order +
  landed SHAs), then `conductor/archive/feature_*/final_report.md` for the first track.
  Write the first progress row.
- [ ] **Phase 1 — Sequential per-track verification (AC-1, AC-2).** For each of the 18
  tracks IN ORDER: run its declared certificate files with `npx mocha <cert>...`
  (per-track timeouts 60s), append a progress.jsonl row
  `{"track": "...", "command": "...", "passing": N, "failing": N, "sha_fleet_land": "...",
  "status": "green"|"red"}`, and mark the checklist below.
- [ ] **Phase 2 — Full-suite re-run (AC-3).** `npx mocha --recursive test/unit --timeout
  30000` (reporter min), then `node scripts/browser_gate.js --list` for the inventory
  gate; record counts.
- [ ] **Phase 3 — Disjointness proof (AC-4).** `git status -- js/` must be empty,
  `git status -- manifest.json` empty, no test files modified; anything else = abort +
  report.
- [ ] **Phase 4 — Verdict assembly (AC-5).** Write `sequencer_verdict.md`: per-track
  table (18 rows + full-suite row + gate row), overall verdict (ALL GREEN / N RED), and
  the diff-vs-fleet-run comparison (did any certificate regress since its landing SHA?).
- [ ] **Phase 5 — Close-out (AC-6, AC-7).** Run `python vendor/housekeeping_guard.py
  check`; commit the two artifacts with explicit paths (`git add conductor/tracks/
  unit_track_sequencer_20261029/sequencer_verdict.md conductor/tracks/unit_track_sequencer_
  20261029/progress.jsonl`), message `docs(sequencer): sequential re-verification verdict
  for the 18 unit tracks (<date>)`. NEVER push.

## Track checklist (tick as each completes)

- [ ] feature_01_ai_arrange → certs: test/unit/ai_arrange.test.js (+ companion suite)
- [ ] feature_02_ai_borders → test/unit/border_metric.test.js
- [ ] feature_03_layer_management → test/unit/layer_manager.test.js (fleet-run SHA 768a20b
      adopted the pre-existing certificate; verify it still passes)
- [ ] feature_04_shape_picker → test/unit/shape_picker.test.js
- [ ] feature_05_controls_panel → test/unit/controls_panel.test.js
- [ ] feature_06_print_styles → test/unit/print_styles.test.js (Playwright E2E class:
      record "not runnable headless" if it demands the unpacked extension)
- [ ] feature_07_persistence → test/unit/persistence.test.js
- [ ] feature_08_layout_operations → test/unit/layout_scan.test.js + layout_apply.test.js
- [ ] feature_09_section_cloning → test/unit/section_cloning.test.js
- [ ] feature_10_undo_system → test/unit/undo.test.js
- [ ] feature_11_spells_ui → test/unit/spells_ui.test.js (+ companion)
- [ ] feature_12_properties_panel → test/unit/properties_panel.test.js
- [ ] feature_13_ui_theme → test/unit/ui_theme.test.js
- [ ] feature_14_filters → test/unit/filters.test.js
- [ ] feature_15_modals → test/unit/modals.test.js
- [ ] feature_16_background_context → test/unit/background.test.js
- [ ] feature_17_dnd → test/unit/dnd.test.js
- [ ] feature_18_image_processor → test/unit/image_processor.test.js (+ companion)

## Pause rules (resume-safe)

- A RED certificate does NOT stop the sequence; it is recorded and the run continues.
- Context pressure (the very risk this track exists to offload): if the delegated session
  approaches its own budget, it commits progress.jsonl + a partial verdict and EXITS
  cleanly — a relaunch resumes from the last progress row, never redoing a completed one.
