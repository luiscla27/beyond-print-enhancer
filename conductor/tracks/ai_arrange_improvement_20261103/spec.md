# Spec — ai_arrange_improvement_20261103

**Track ID**: `ai_arrange_improvement_20261103` · **Created**: 2026-11-03 · **Owner**: agent session (to be assigned)

## Goal

Raise the **AI Arrange** criterion rating from **78 → 90+** on the UX scoring matrix by improving the "usefulness and user control" dimension of the AI Arrange feature, while keeping all guard disciplines green.

## Scope

- **In scope**: Enhancements to the AI Arrange user experience — preview/override before apply, undo granularity, AI decision explanation, confidence scoring. Work extends the existing `window.AIArrange` seam or adds a companion module.
- **Out of scope**: Core arrangement algorithm changes (already certified), new product features unrelated to AI Arrange, vendored runtime, other projects.

## Design Decisions (to be finalized in Phase 0 via OSD)

- **D-1 — Cluster nomination**: Run Orthogonal Subspace Deliberation (OSD) to choose ONE defensible cluster for Phase 1. Candidates from gap analysis:
  - **Cluster A**: User preview/override — before applying AI arrangement, show a diff/preview of proposed moves; user can accept, reject, or manually adjust individual moves.
  - **Cluster B**: Undo granularity — replace all-or-nothing undo with per-move undo stack; each AI-proposed move is independently reversible.
  - **Cluster C**: AI decision explanation — surface rationale for each move (e.g., "grouped by spell level", "moved to reduce page breaks", "compacted for print"); tooltips or side panel.
  - **Cluster D**: Confidence scoring — show confidence score per proposed move; user can filter below threshold or review low-confidence moves first.
- **D-2 — Pattern**: Extend `window.AIArrange` namespace (existing seam from `js/ai_arrange.js`) or add `window.AIArrangePreview` companion module. Injected by `js/background.js`, mirrored in `debt_harness.js`, call-time seam resolution (fail-open).
- **D-3 — Test preservation**: `test/unit/ai_layout_schema.test.js` (142 cases) and `test/browser_e2e/byok_arrange_roundtrip.spec.js` (6 E2E) must stay green. New tests for the added capability in `test/unit/ai_arrange/` or extend existing.

## Audit Evidence

- UX scoring matrix: `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json` (criterion weight 8%, current 78, target 90+)
- Fleet certification: `ux_feature_fleet_20261029` — track-00 adopted pre-existing certs at commit 1059ad3 ("Huge Revamp #41")
- Existing certificates: `test/unit/ai_layout_schema.test.js` (142), `test/browser_e2e/byok_arrange_roundtrip.spec.js` (6)
- Guard baseline: all four disciplines green on current tree

## Acceptance Criteria

- **AC-1**: AI Arrange criterion rating ≥ 90 on UX scoring matrix (`vendor/.reasonix/skills/ux-scoring-matrix/run.py score` with updated evidence JSON).
- **AC-2**: Existing AI Arrange certificates stay green — `test/unit/ai_layout_schema.test.js` (142 cases) and `test/browser_e2e/byok_arrange_roundtrip.spec.js` (6 cases).
- **AC-3**: No regressions in full unit suite (≥ 2229 passing, 0 new failures) and `npm run lint` clean.
- **AC-4**: Injected-scope collision guard, dead-exports tripod, scripts hygiene, lint, and smoke all pass on delivered tree.

## Handoff Instructions for Fresh Session

1. **Read**: This spec + `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json` + `test/unit/ai_layout_schema.test.js` + `test/browser_e2e/byok_arrange_roundtrip.spec.js` + `js/ai_arrange.js`.
2. **Run OSD**: Invoke `subspace-deliberation` skill to nominate the Phase 1 cluster (must declare `"deliberation": "required"` in metadata — already set).
3. **Execute Phase 1**: Implement the nominated improvement per conductor-protocol. Extend `window.AIArrange` or add companion module following `refactor_surface_20261101` pattern.
4. **Verify**: Run full guard suite (Phase 3 checks) + existing AI Arrange certificates + new regression tests.
5. **Score**: Run `python vendor/.reasonix/skills/ux-scoring-matrix/run.py score --evidence <updated_evidence.json>` to confirm ≥ 90.
6. **Continue**: Phases 3-5 per conductor-protocol.