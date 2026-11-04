# Decision space: sidebar_controls_improvement_20261103

Question: which Sidebar Controls cluster (Density/Progressive Disclosure vs Logical Grouping) raises the Sidebar Control Quality criterion from 82 → 90+ with the fewest new surface concepts, given the UX scoring matrix gap analysis?

**Basis:** the gap analysis from the UX scoring matrix (`vendor/.reasonix/skills/ux-scoring-matrix/matrix.json`): current 82, target 90+, weight 8%. Existing certs: `test/unit/encapsulation_debt/controls_panel.test.js` (63 cases), `test/unit/encapsulation_debt/properties_panel.test.js` (38 cases). Panel density vs. scanability, slider precision, color picker affordance, filter reset clarity.

**Basis tie:** the track's acceptance criteria are the manifold this rubric judges against — [AC-1] (criterion ≥ 90 on matrix), [AC-2] (existing certs stay green), [AC-3] (no regressions in full suite), [AC-4] (guard disciplines green).

## Comparison

| Dimension | Candidate A (Density/Progressive Disclosure) | Candidate B (Logical Grouping) |
|---|---|---|
| **Impact on criterion** | +8–10 points (directly addresses density/scanability gap) | +6–8 points (helps discoverability but not density) |
| **Implementation effort** | Medium (state + accordion UI) | Low (visual structure only) |
| **Regression risk** | Low (additive UI) | Very low (CSS/structure) |
| **Testability** | High (unit state + UI tests) | High (DOM structure) |
| **Standards alignment** | ISO 9241-110 (progressive disclosure) | ISO 9241-110 (grouping) |
| **Future extensibility** | Foundation for responsive behavior | Independent visual enhancement |

## Candidate A — Control density / progressive disclosure

**verdict candidate_a:** ADOPTED. Highest weighted score (4.0/5). Directly targets the "panel density vs. scanability" gap cited in UX matrix. Low regression risk — additive UI pattern. Clear Phase 1 extraction: extend `window.Controls` with progressive disclosure namespace. Meets the basis: density/scanability is the primary gap.

## Candidate B — Logical grouping

**verdict candidate_b:** REJECTED (for Phase 1). Lower weighted score (3.2/5). Doesn't address the core density/scanability gap. Could be Phase 2 visual enhancement if progressive disclosure alone doesn't reach ≥ 90.
**Recall condition:** adopt B instead only if progressive disclosure implementation proves sufficient for ≥ 90 without grouping, OR user research shows grouping > density for scanability improvement.