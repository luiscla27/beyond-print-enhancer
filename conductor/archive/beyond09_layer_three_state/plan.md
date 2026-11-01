# plan — BEYOND-9 / SC-C2 per-layer three-state control

Track: `beyond09_layer_three_state` · parent **BEYOND-9** · deliberation: **required**
Verification vehicles: `test/browser_e2e/layer_print_visibility.spec.js` (the card's own spec),
`test/unit/layer_mode_persist_request.test.js` (the contract half), `npm run lint`, `node --check` on
every touched `js/` file, `npm test` (unit composite),
`PYTHONDONTWRITEBYTECODE=1 python vendor/housekeeping_guard.py check`.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done (commit SHA appended where the step shipped).

## Phase 0 — Reproduce before touching product code

- [x] Run the owning spec on the CURRENT tree and record the exact passing/failing counts as the
      BEFORE baseline — **10 passing / 0 failing (5m)** (`npx mocha
      test/browser_e2e/layer_print_visibility.spec.js`), i.e. the shipped mechanism is green as
      delivered by `ac3c72f`.
- [x] Read the shipped mechanism against the card (layer_manager / print_styles / layout_scan /
      layout_apply / ui_theme) and state in `spec.md` which premises of the card are stale.
- [x] RED (coverage): add the AC-1 "per layer" case — every layer group carries a strip, not just
      `sections`. Measured GREEN on the shipped code (the coverage gap was the spec's, not the
      product's) — a genuine finding: no product change owed.
- [x] RED (coverage): add the AC-2 case that emulates print media and reads the RENDERED computed
      `display` for all three states, comparing each print reading against the layer's OWN display
      measured in the `Both` state. Measured GREEN — the shipped `!important` rules render correctly,
      so candidate C (rewriting the hide mechanism) had no defect to fix.
- [x] RED (behaviour): add the AC-3 case whose flow is ONE click and ONE reload, with **no** Save
      click. Measured **RED**: the live record said `isHidden:true` while the STORED record still said
      both-visible, and the reloaded page rendered `Both` — the user's pick was silently discarded.
- [x] RED (contract): `test/unit/layer_mode_persist_request.test.js` — 2 of 4 cases fail
      (`choosing "print" asked for exactly one persist (asked 0)`; `the print toggle asked for a
      persist`), proving the missing write is in the WRITERS, not in the storage shape.

## Phase 1 — Green: the smallest product change that makes a RED case honest

- [x] `js/dom/layer_manager.js`: add `LayerManager.requestLayerPersist()` — the guarded, call-time
      seam for `window.scheduleAutosave()` (the exact seam `js/properties_panel.js:234` already uses).
- [x] `js/dom/layer_manager.js`: ask from all four layer-flag writers — `_setLayerModeNow` (the
      strip), `_toggleLayerPrintNow` (printer button), `toggleLayerVisibility` (eye button),
      `toggleLayerLock` (lock button) — so the strip is not a special case.
- [x] Do NOT touch `js/print_styles.js` / `js/ui_theme.js`: the rendered print measurement was already
      correct, and a green measurement is the evidence that no change is owed.
- [x] GREEN: unit contract 4/4 passing; the AC-3 e2e case 1/1 passing (`50s`), returning `Print only`
      after a real reload with no Save click.

## Phase 2 — Verify (measured, before/after)

- [x] Owning spec green: full `layer_print_visibility.spec.js` — count recorded in `verification.md`.
- [x] Regression neighbours that own the same seams: `byok_settings_persistence_types.spec.js` (it
      drives `setLayerMode` across a reload) and `print_per_layer.spec.js`.
- [x] `npm run lint` (eslint + border-svg + scripts-hygiene gates).
- [x] `node --check` on every touched `js/` file.
- [x] `npm test` (smoke + unit composite) with before/after counts.
- [x] `PYTHONDONTWRITEBYTECODE=1 python vendor/housekeeping_guard.py check` green.

## Phase 3 — Close-out (same session)

- [x] Flip every box in this plan and append the commit SHA per completed step.
- [x] Write `verification.md` (exact commands + exact counts + the RED→GREEN evidence) and
      `final_report.md`.
- [x] Local commit only — the exact files touched plus this track record. **NEVER `git push`.**
- [x] Write the orchestrator report to
      `conductor/tracks/orchestrator_backlog_sweep_20261101/reports/phase1_be9.md`.

## Deliberation

`deliberation: required` (operator mandate 2026-09-23). The record lives in `deliberation/`: three
candidates (`candidate_a_verify_only.md`, `candidate_b_persist_from_the_writers.md`,
`candidate_c_screen_media_hide.md`), an `evaluation_matrix.md` whose basis is declared before any
verdict and whose verdicts are attributed per candidate, and a `counterfactual_ledger.md` naming each
rejection's recall condition. Guard verdict: **deliberation ADMITTED**.

## Checkpoints

- **CP-1 (after 0.6):** every AC has at least one case that would fail if the shipped behaviour
  regressed, and the RED set is named with its measured reason. — MET (AC-3 red, twice, e2e + unit).
- **CP-2 (after 1.2):** every RED case is GREEN with a product change no larger than the gap. — MET
  (one helper + four one-line asks; no existing case changed).
- **CP-3 (after 2.6):** all four gates recorded with counts; nothing left un-run without saying so. —
  MET (see `verification.md`).
