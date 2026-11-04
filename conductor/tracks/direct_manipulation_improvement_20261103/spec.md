# Spec — direct_manipulation_improvement_20261103

**Track ID**: `direct_manipulation_improvement_20261103` · **Created**: 2026-11-03 · **Owner**: agent session (to be assigned)

## Goal

Raise the **Direct Manipulation** criterion rating from **80 → 90+** on the UX scoring matrix by improving the in-sheet drag-and-reorder experience, while keeping all guard disciplines green.

## Scope

- **In scope**: Enhancements to drag-and-reorder UX — initiation threshold, drop targeting, visual feedback, keyboard alternative. Work extends existing `window.DND` and/or `window.Controls` seams.
- **Out of scope**: Core DND algorithm changes (already certified at 33 cases), new product features unrelated to direct manipulation, vendored runtime, other projects.

## Design Decisions (to be finalized in Phase 0 via OSD)

- **D-1 — Cluster nomination**: Run Orthogonal Subspace Deliberation (OSD) to choose ONE defensible cluster for Phase 1. Candidates from gap analysis:
  - **Cluster A**: Drag initiation threshold — add press-delay (150-200ms) or minimum distance threshold (5-8px) to prevent accidental drags on click/scroll.
  - **Cluster B**: Drop targeting — improve drop zone visualization (highlight valid targets), snap-to-slot animation, clearer valid/invalid target indication (ghost vs red).
  - **Cluster C**: Visual feedback during drag — ghost preview of dragged section, live page-break indicators, outline of target container, opacity/transform cues.
  - **Cluster D**: Keyboard alternative — full drag-reorder via keyboard (e.g., `Alt+ArrowUp/Down` to move section, `Alt+Shift+Arrow` to move across pages), meeting WCAG keyboard operability.
- **D-2 — Pattern**: Extend `window.DND` (from `js/dnd.js`) and/or `window.Controls` (from `js/controls_panel.js`). Injected by `js/background.js`, mirrored in `debt_harness.js`, call-time seam resolution (fail-open).
- **D-3 — Test preservation**: `test/unit/dnd.test.js` (33 cases) and `test/unit/encapsulation_debt/controls_panel.test.js` (63 cases) must stay green. New tests for added capability in `test/unit/dnd/` or extend existing.

## Audit Evidence

- UX scoring matrix: `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json` (criterion weight 12%, current 80, target 90+)
- Fleet certification: `ux_feature_fleet_20261029` — track-03 (controls) at 153e2df, track-04 (dnd) at f167c3f
- Existing certificates: `test/unit/dnd.test.js` (33), `test/unit/encapsulation_debt/controls_panel.test.js` (63)
- Guard baseline: all four disciplines green on current tree

## Acceptance Criteria

- **AC-1**: Direct Manipulation criterion rating ≥ 90 on UX scoring matrix (`vendor/.reasonix/skills/ux-scoring-matrix/run.py score` with updated evidence JSON).
- **AC-2**: Existing DND and Controls certificates stay green — `test/unit/dnd.test.js` (33 cases) and `test/unit/encapsulation_debt/controls_panel.test.js` (63 cases).
- **AC-3**: No regressions in full unit suite (≥ 2229 passing, 0 new failures) and `npm run lint` clean.
- **AC-4**: Injected-scope collision guard, dead-exports tripod, scripts hygiene, lint, and smoke all pass on delivered tree.

## Handoff Instructions for Fresh Session

1. **Read**: This spec + `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json` + `test/unit/dnd.test.js` + `test/unit/encapsulation_debt/controls_panel.test.js` + `js/dnd.js` + `js/controls_panel.js`.
2. **Run OSD**: Invoke `subspace-deliberation` skill to nominate the Phase 1 cluster (must declare `"deliberation": "required"` in metadata — already set).
3. **Execute Phase 1**: Implement the nominated improvement per conductor-protocol. Extend `window.DND`/`window.Controls` following `refactor_surface_20261101` pattern.
4. **Verify**: Run full guard suite (Phase 3 checks) + existing DND/Controls certificates + new regression tests.
5. **Score**: Run `python vendor/.reasonix/skills/ux-scoring-matrix/run.py score --evidence <updated_evidence.json>` to confirm ≥ 90.
6. **Continue**: Phases 3-5 per conductor-protocol.