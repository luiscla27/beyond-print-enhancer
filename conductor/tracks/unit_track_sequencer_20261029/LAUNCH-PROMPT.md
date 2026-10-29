---
type: Prompt
title: "Launch prompt — unit_track_sequencer_20261029 (sequential re-verification, 1 session)"
description: "Copy-paste into ONE fresh Reasonix session with this repo as its workspace. Runs the 18 re-homed unit tracks sequentially, live, and files a verdict. Resume-safe; verification-only; never patches certificates."
tags: [conductor, track, sequential, verification, context-isolation]
---

# LAUNCH-PROMPT — unit_track_sequencer_20261029

You are the **delegated verification session** for conductor track
`unit_track_sequencer_20261029`. You have fresh context; the session that created this
track deliberately did NOT run the work. Your entire product is a verdict: 18 live mocha
re-runs + 1 full-suite re-run + 1 inventory-gate run, written into exactly two files.

## HARD RULES (abort-and-report, never repair)

- You are VERIFICATION-ONLY. If a certificate fails RED, do NOT edit it. Record it, continue,
  and recommend a new delta-track in the verdict.
- After all phases, `git status -- js/` and `git status -- manifest.json` MUST be empty and no
  test file may appear in `git status --short`. If anything appears, STOP, write the violation
  into the verdict, and do not commit.
- Commit exactly two files with explicit paths (never `git add -A`), Conventional Commits
  message `docs(sequencer): sequential re-verification verdict for the 18 unit tracks (<date>)`.
  NEVER push.
- Do NOT kill other reasonix/bot processes; do NOT touch `vendor/` (sync-governed) except to
  RUN `python vendor/housekeeping_guard.py check`.

## SEQUENCE (resume-safe: read progress.jsonl first, skip completed tracks)

For each track IN THIS ORDER (from metadata.json): feature_01_ai_arrange, feature_02_ai_borders,
feature_03_layer_management, feature_04_shape_picker, feature_05_controls_panel,
feature_06_print_styles, feature_07_persistence, feature_08_layout_operations,
feature_09_section_cloning, feature_10_undo_system, feature_11_spells_ui,
feature_12_properties_panel, feature_13_ui_theme, feature_14_filters, feature_15_modals,
feature_16_background_context, feature_17_dnd, feature_18_image_processor:

1. Read the track's `spec.md` acceptance list and its `final_report.md` (what it certified).
2. Run its certificate files with `npx mocha <cert paths> --timeout 60000` (the exact cert
   paths are listed in the track directory's `metadata.json`/`plan.md` — the companion-suite
   pairs noted in plan.md must both run).
3. Append ONE row to `progress.jsonl`:
   `{"track":"feature_NN","certs":["..."],"passing":N,"failing":N,"fleet_sha":"<landing SHA
   from metadata>","status":"green|red","ts":<epoch>}`
4. Tick the track in plan.md's checklist? NO — plan.md is sealed; leave it untouched.
   Only progress.jsonl and sequencer_verdict.md are yours to write.

## Full-suite + gate phase

- `npx mocha --recursive test/unit --timeout 30000 --reporter min` → record final counts.
- `node scripts/browser_gate.js --list` → record pass/fail.
- Playwright row (print_styles): if it demands the unpacked extension, record
  "not runnable headless" — do not attempt.

## Verdict (sequencer_verdict.md)

- A table of all 18 rows + full-suite + gate, the fleet-run landing SHA beside each,
  and a REGRESSION column: any track whose live result differs from its archived result
  (all archived results were green) is a confirmed delta → recommend a NEW track on that
  delta (do not fix it here).
- Overall verdict line: ALL GREEN (18/18 + suite + gate) or N RED with the reds named.

## Pause rules (the reason this track exists)

- If your own context pressure rises before track 18: commit progress.jsonl + a PARTIAL
  verdict listing what ran, then end the turn cleanly. A relaunch resumes from the last
  progress row — never redo a completed track.
