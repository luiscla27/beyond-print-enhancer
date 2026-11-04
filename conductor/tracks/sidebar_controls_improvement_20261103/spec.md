# Spec — sidebar_controls_improvement_20261103

**Track ID**: `sidebar_controls_improvement_20261103` · **Created**: 2026-11-03 · **Owner**: agent session (to be assigned)

## Goal

Raise the **Sidebar Control Quality** criterion rating from **82 → 90+** on the UX scoring matrix by improving sidebar control efficiency, while keeping all guard disciplines green.

## Scope

- **In scope**: Enhancements to sidebar control UX — density/progressive disclosure, logical grouping, discoverability, responsive behavior. Work extends existing `window.Controls` and/or `window.Properties` seams.
- **Out of scope**: Core control logic changes (already certified at 63+38 cases), new product features unrelated to sidebar controls, vendored runtime, other projects.

## Design Decisions (to be finalized in Phase 0 via OSD)

- **D-1 — Cluster nomination**: Run Orthogonal Subspace Deliberation (OSD) to choose ONE defensible cluster for Phase 1. Candidates from gap analysis:
  - **Cluster A**: Control density/progressive disclosure — collapse advanced controls behind "More" or accordion sections; reduce initial cognitive load; show only primary actions by default.
  - **Cluster B**: Logical grouping — visually group related controls (Layout, Print, Appearance, Advanced) with clear section headers, dividers, or cards; consistent ordering.
  - **Cluster C**: Discoverability — tooltip onboarding for first-time users, empty-state hints (e.g., "No sections to arrange — add content first"), keyboard shortcut hints on hover/focus.
  - **Cluster D**: Responsive behavior — sidebar adapts to narrow viewports (e.g., DDB sidebar widths), controls reflow without horizontal scroll, touch-friendly hit targets.
- **D-2 — Pattern**: Extend `window.Controls` (from `js/controls_panel.js`) and/or `window.Properties` (from `js/properties_panel.js`). Injected by `js/background.js`, mirrored in `debt_harness.js`, call-time seam resolution (fail-open).
- **D-3 — Test preservation**: `test/unit/encapsulation_debt/controls_panel.test.js` (63 cases) and `test/unit/encapsulation_debt/properties_panel.test.js` (38 cases) must stay green. New tests for added capability in `test/unit/controls/` or extend existing.

## Audit Evidence

- UX scoring matrix: `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json` (criterion weight 8%, current 82, target 90+)
- Fleet certification: `ux_feature_fleet_20261029` — track-03 (controls) at 153e2df, track-12 (properties_panel) at 9fa4cdc
- Existing certificates: `test/unit/encapsulation_debt/controls_panel.test.js` (63), `test/unit/encapsulation_debt/properties_panel.test.js` (38)
- Guard baseline: all four disciplines green on current tree

## Acceptance Criteria

- **AC-1**: Sidebar Control Quality criterion rating ≥ 90 on UX scoring matrix (`vendor/.reasonix/skills/ux-scoring-matrix/run.py score` with updated evidence JSON).
- **AC-2**: Existing Controls and Properties certificates stay green — `test/unit/encapsulation_debt/controls_panel.test.js` (63 cases) and `test/unit/encapsulation_debt/properties_panel.test.js` (38 cases).
- **AC-3**: No regressions in full unit suite (≥ 2229 passing, 0 new failures) and `npm run lint` clean.
- **AC-4**: Injected-scope collision guard, dead-exports tripod, scripts hygiene, lint, and smoke all pass on delivered tree.

## Handoff Instructions for Fresh Session

1. **Read**: This spec + `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json` + `test/unit/encapsulation_debt/controls_panel.test.js` + `test/unit/encapsulation_debt/properties_panel.test.js` + `js/controls_panel.js` + `js/properties_panel.js`.
2. **Run OSD**: Invoke `subspace-deliberation` skill to nominate the Phase 1 cluster (must declare `"deliberation": "required"` in metadata — already set).
3. **Execute Phase 1**: Implement the nominated improvement per conductor-protocol. Extend `window.Controls`/`window.Properties` following `refactor_surface_20261101` pattern.
4. **Verify**: Run full guard suite (Phase 3 checks) + existing Controls/Properties certificates + new regression tests.
5. **Score**: Run `python vendor/.reasonix/skills/ux-scoring-matrix/run.py score --evidence <updated_evidence.json>` to confirm ≥ 90.
6. **Continue**: Phases 3-5 per conductor-protocol.