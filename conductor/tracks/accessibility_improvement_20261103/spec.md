# Spec — accessibility_improvement_20261103

**Track ID**: `accessibility_improvement_20261103` · **Created**: 2026-11-03 · **Owner**: agent session (to be assigned)

## Goal

Raise the **Accessibility** criterion rating from **75 → 90+** on the UX scoring matrix (vendor/.reasonix/skills/ux-scoring-matrix/matrix.json) by remediating inclusive-interaction gaps across the extension surface, while keeping all guard disciplines green.

## Scope

- **In scope**: Accessibility remediation for the D&D Beyond Print Enhancer Chrome extension — ARIA attributes, focus management, color contrast, screen-reader labels, keyboard operability. Work is done as one or more module extractions (new `window.*` seams) or in-place patches with guard discipline.
- **Out of scope**: Behavior changes to print logic, new product features, vendored runtime, other projects.

## Design Decisions (to be finalized in Phase 0 via OSD)

- **D-1 — Cluster nomination**: Run Orthogonal Subspace Deliberation (OSD) to choose ONE defensible cluster for Phase 1. Candidates from gap analysis:
  - **Cluster A**: ARIA remediation — add missing `role`, `aria-label`, `aria-expanded`, `aria-controls` across sidebar, modals, print preview, controls panel.
  - **Cluster B**: Focus management — visible focus outlines, focus trapping in modals, logical tab order in drag-reorder, focus restoration after print/close.
  - **Cluster C**: Color contrast — print styles (`js/print_styles.js`), UI theme (`js/ui_theme.js`), sidebar controls meet WCAG AA (4.5:1 text, 3:1 UI).
  - **Cluster D**: Screen-reader labels — icon-only buttons (clone, extract, arrange, compact, shape picker) get `aria-label` or visible text alternatives.
- **D-2 — Pattern**: If extraction, follow `refactor_surface_20261101` pattern: one module per cluster, ONE top-level `window.*` binding, injected by `js/background.js` before caller, mirrored in `debt_harness.js`, call-time seam resolution (fail-open). If in-place, ensure `eslint` clean and no new top-level bindings.
- **D-3 — Test additions**: New accessibility regression tests in `test/unit/accessibility/` (create if needed) or extend existing component tests. Must exercise real DOM (JSDOM) and verify ARIA/focus/contrast programmatically.

## Audit Evidence

- UX scoring matrix: `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json` (criterion weight 6%, current 75, target 90+)
- Fleet certification: `ux_feature_fleet_20261029` — 18/18 tracks integrated, 2229 unit tests passing
- Guard baseline: all four disciplines green on current tree
- Relevant test files: `test/unit/encapsulation_debt/controls_panel.test.js`, `test/unit/ui_theme.test.js`, `test/unit/encapsulation_debt/boot_module.test.js`

## Acceptance Criteria

- **AC-1**: Accessibility criterion rating ≥ 90 on UX scoring matrix (`vendor/.reasonix/skills/ux-scoring-matrix/run.py score` with evidence JSON reflecting the improvement).
- **AC-2**: Core-flow accessibility gate continues to PASS — all core flows operable without mouse (no regression).
- **AC-3**: No regressions in full unit suite (≥ 2229 passing, 0 new failures) and `npm run lint` clean.
- **AC-4**: Injected-scope collision guard, dead-exports tripod, scripts hygiene, lint, and smoke all pass on delivered tree.

## Handoff Instructions for Fresh Session

1. **Read**: This spec + `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json` + relevant test files listed in `metadata.json`.
2. **Run OSD**: Invoke `subspace-deliberation` skill to nominate the Phase 1 cluster (must declare `"deliberation": "required"` in metadata — already set).
3. **Execute Phase 1**: Extract/remediate the nominated cluster per conductor-protocol. Follow the `refactor_surface_20261101` pattern if new module; patch in place if simpler.
4. **Verify**: Run the full guard suite (Phase 3 checks) + accessibility-specific test additions.
5. **Score**: Run `python vendor/.reasonix/skills/ux-scoring-matrix/run.py score --evidence <updated_evidence.json>` to confirm ≥ 90.
6. **Continue**: Phases 3-5 per conductor-protocol.