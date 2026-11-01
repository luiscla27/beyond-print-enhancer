# PHASE 1 TASK — BEYOND-9: Per-layer three-state control (Print Only / Screen Only / Both)

You are an external reasonix session spawned by an orchestrator to execute ONE YouTrack card as a
conductor track. Read `prompts/LAUNCH-PROMPT-TEMPLATE.md` in this fleet dir FIRST for the full
rules (track record, reproduce-before-fix, TDD, gates, local commits only, close-out, report,
token handoff, failure-loop escalation). The binding rules are restated below; the template is the
source of truth.

## YOUR CARD (verbatim from the YouTrack tracker, project BEYOND)

**BEYOND-9 — [UX Gap] SC-C2: Per-layer three-state control (Print Only / Screen Only / Both)
missing — test shows basic enable/disable only**

UX Gap from e2e test matrix (approved scores 2026-10-25). Scenario SC-C2 (UC-04: Managing Layers
for Print). Composite UX Score 2.0 (critical gap). Evidence from matrix & specs:
- `layer_print_visibility.spec.js` tests basic layer enable/disable only
- Three-state control (Print Only / Screen Only / Both visible) is designed but not implemented
- Current UI only has a toggle, no three-state selector
- This directly impacts users who want layers visible on screen but hidden from print (or vice versa)

Gap classification: Feature absent — the three-state mechanism does not exist in the codebase.
Priority P1 (High) — daily workflow blocker for layer management. Quick win: YES — UI addition
only, no backend changes needed (VERIFY that claim yourself against the code before trusting it —
print rendering and persistence may already be structured to carry a per-layer visibility field,
which would make it genuinely a quick win, or may not, in which case you must say so).

### Acceptance criteria (these are the card's own words — all five must be met and measured)
1. Layer panel shows three-state selector per layer (Print Only / Screen Only / Both)
2. Print preview respects Print Only / Screen Only states correctly
3. Settings persist three-state selection across reloads
4. E2E test `layer_print_visibility.spec.js` extended to cover all three states
5. Gate G-PIX-OVERFLOW and G-PERSIST pass for the new states

## CONTEXT PACK (read before writing anything)

This repo = the D&D Beyond Print Enhancer Chrome MV3 extension. Product JS lives in `js/`,
unit tests in `test/unit/`, Playwright browser-e2e specs in `test/browser_e2e/` (the MV3 harness
boots the real extension against a real D&D Beyond sheet — read the harness docs in test/ and
README.md for SHOTS flags and how report.json is produced per suite).

Files you will almost certainly touch (verify by reading, do not assume):
- Layer UI / controls: search `js/` for the layer panel renderer (candidates: `js/controls.js`,
  `js/properties_panel.js`, `js/dnd.js`, `js/layout_ops.js`, plus anything under `js/dom/`).
  FIND the actual per-layer toggle that today does enable/disable and extend it to a three-state
  selector; do not invent a new panel.
- Print rendering / per-layer visibility: `js/print_styles.js` (already carries
  `.be-shape-wrapper` pointer-events logic for locked layers), `js/print_per_layer.spec.js`
  (an existing per-layer print spec — read it; it is the closest prior art to what AC-2/AC-4 need),
  `test/browser_e2e/layer_print_visibility.spec.js` (THE spec AC-4 names — extend it, do not
  fork a sibling).
- Persistence: `js/storage.js` / `js/persistence.js` (AC-3 — how layer settings serialize today;
  the three-state must ride the SAME store key family so reload restores it, and
  `test/browser_e2e/print_settings_verify.spec.js` may be the persistence precedent).
- Theme/CSS: `js/ui_theme.js` holds the locked theme and the z-index rungs; any new selector must
  be themed there (the house pattern: new affordances get their styling in the locked theme, not
  inline).
- Gates G-PIX-OVERFLOW and G-PERSIST: FIND where these gate names are defined/evaluated in this
  repo (grep `G-PIX-OVERFLOW`, `G-PERSIST`, `PIX-OVERFLOW`, `PERSIST` across test/, tools/,
  conductor/, docs/). They are the card's own gate vocabulary; if they are assertions inside the
  e2e runner or gates in a doc, you must make them pass FOR THE NEW STATES and say exactly how you
  proved it. If the names appear nowhere, that is a finding to report (the card may cite gates the
  harness no longer names) — do not fabricate a gate to satisfy the card; redefine the equivalent
  real assertion and record the rename in your report.

Prior art to study (a complete recent track of this same project, same house style):
`conductor/archive/state-feedback-be19/` — spec.md, plan.md, metadata.json (note
`"deliberation": "required"`), verification.md, final_report.md. Match its quality bar.

## WORK ORDER

1. Track record FIRST: `conductor/tracks/beyond09_layer_three_state/` (spec.md restating the card
   verbatim + acceptance criteria; plan.md with steps, verification vehicles, checkpoints;
   metadata.json with deliberation required, parent BEYOND-9, tracked_issue BEYOND-9).
2. Reproduce: open `test/browser_e2e/layer_print_visibility.spec.js` and run it (plus its unit
   siblings) against the CURRENT tree; prove the three-state mechanism is absent (the spec passes
   only because it asserts two-state behavior — show the gap, e.g. by writing the AC-4 assertions
   first and watching them fail RED).
3. Implement: per-layer three-state selector in the layer panel; print preview honoring
   Print Only / Screen Only (a Print Only layer is HIDDEN on screen but RENDERED in print; a
   Screen Only layer is VISIBLE on screen but OMITTED in print; Both = current default).
   Persist the state across reload. Keep the change scoped; theme the selector in `js/ui_theme.js`.
4. Extend `layer_print_visibility.spec.js` to cover all three states (AC-4) and make the G-PIX-
   OVERFLOW / G-PERSIST equivalents pass for the new states (AC-5).
5. Verify with the real gates and MEASURE: `npm run lint`, `node --check` on every touched js/
   file, `npm test` (unit composite), and the e2e suite that owns this card — record exact
   passing/failing counts before and after in both your report and the track's verification.md.
6. Commit locally (exact files + track record; NEVER push).
7. Close-out same session: flip plan.md checkboxes to [x], write verification.md + final_report.md
   under the track dir, then write the ORCHESTRATOR REPORT to
   `conductor/tracks/orchestrator_backlog_sweep_20261101/reports/phase1_be9.md`.

## REPORT/HANDOFF PATHS

- Orchestrator report (mandatory): conductor/tracks/orchestrator_backlog_sweep_20261101/reports/phase1_be9.md
- Token-budget handoff (only if you go YELLOW — looping, ~120k+ tokens, no verdict):
  conductor/tracks/orchestrator_backlog_sweep_20261101/handoffs/phase1_be9.md
  (write the handoff, then STOP new work and reply that it is written)

## REMINDERS THAT BITE IF FORGOTTEN

- NEVER `git push`. Local commits only.
- Do NOT edit vendor/ (drift_check must stay green) and do NOT call vendor/youtrack/*.py writes —
  tracker closes are the orchestrator's act.
- `python housekeeping_guard.py check` from the repo root must stay green (any temp/issues/*.md
  you create needs a `**Status:**` line).
- If the e2e harness cannot boot in THIS environment (no Chrome/no network), that is a STRUGGLE to
  report immediately with the exact failure — do not fake e2e results; fall back to unit-level
  contract tests and say plainly which verification vehicle actually ran.
- PYTHONDONTWRITEBYTECODE=1 when importing vendor/ modules (keeps the tree clean for git add).

Begin: create the track record, then reproduce the gap, then fix.
