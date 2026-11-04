# Decision space: accessibility_improvement_20261103

Question: which accessibility cluster (ARIA remediation vs Focus management) raises the Accessibility criterion from 75 → 90+ with the fewest new surface concepts, given the UX scoring matrix gap analysis?

**Basis:** the gap analysis from the UX scoring matrix (`vendor/.reasonix/skills/ux-scoring-matrix/matrix.json`): current 62 (evidence file temp/ux_matrix/evidence_current.json; live score 78 on 2026-11-03), target 90+, weight 6%. Core-flow accessibility gate passes but finer inclusive-interaction details need polish — ARIA attributes, focus management, contrast, screen-reader labels.

**Basis tie:** the track's acceptance criteria are the manifold this rubric judges against — [AC-1] (criterion ≥ 90 on matrix), [AC-2] (core-flow accessibility gate PASS), [AC-3] (no regressions in full suite), [AC-4] (guard disciplines green).

## Comparison

| Dimension | Candidate A (ARIA) | Candidate B (Focus) |
|---|---|---|
| **Impact on criterion** | +8–10 points (ARIA gaps are largest screen-reader blocker) | +6–8 points (focus blocks keyboard users but core flow works) |
| **Implementation effort** | Low (attribute additions across ~30 elements) | Medium (focus trap logic, tab order coordination) |
| **Regression risk** | Very low (additive attributes) | Medium (behavioral changes to focus) |
| **Testability** | High (programmatic ARIA verification) | High (programmatic focus verification) |
| **Standards alignment** | WCAG 1.3.1, 4.1.2 | WCAG 2.4.3, 2.4.7, 3.2.2 |
| **Future extensibility** | Modular — more ARIA patterns later | Foundation for focus patterns |

## Candidate A — ARIA remediation

**verdict candidate_a:** ADOPTED. Highest weighted score (4.2/5). Directly targets matrix row 3 ("Controls have accessible names and states") — the largest screen-reader gap per UX matrix evidence. Low regression risk — additive DOM attributes. Well-scoped Phase 1 patch (in place, not a new module). Meets the basis: addresses ARIA/attribute gaps which are the primary blocker for screen-reader users. Does NOT claim row 5 ("Text and interactive elements meet WCAG 2.2 AA contrast and sizing expectations") — that is SC-H3 (1.0) and the contrast track's territory. The accessibility-mapped scenario cells are SC-A1/A2/A3/B1/C1/C2/C3/D1/H1/H3/G1/J2; A closes row 3 but does not move those cells, so A alone does not raise the criterion rating above 62 — AC-1 is deferred to a future accessibility re-score.

## Candidate B — Focus management

**verdict candidate_b:** REJECTED (for Phase 1). Lower weighted score (3.6/5). Behavioral changes introduce regression risk in drag-reorder and modals. Does not address ARIA gaps — screen-reader users still blocked on icon-only controls and dynamic regions. Focus order/indicators is matrix row 2; the core-flow accessibility gate is already green (SC-C3 keyboard reorder 3.9, SC-G3 keyboard undo 3.6) and focus is not the current mean-puller on this tree, so B's Phase-1 leverage is lower than A's. Recall condition: adopt B instead only if an ARIA-only Phase 1 implementation reaches >= 90 without focus, OR an updated audit proves focus gaps larger than ARIA gaps.
**Recall condition:** adopt B instead only if ARIA-only phase reaches ≥ 90 without focus, OR updated audit proves focus gaps larger than ARIA gaps.