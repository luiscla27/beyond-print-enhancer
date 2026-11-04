# Decision space: direct_manipulation_improvement_20261103

Question: which Direct Manipulation cluster (Initiation threshold vs Drop targeting) raises the Direct Manipulation criterion from 80 → 90+ with the fewest new surface concepts, given the UX scoring matrix gap analysis?

**Basis:** the gap analysis from the UX scoring matrix (`vendor/.reasonix/skills/ux-scoring-matrix/matrix.json`): current 80, target 90+, weight 12% (highest among lower-rated). Existing certs: `test/unit/dnd.test.js` (33 cases), `test/unit/encapsulation_debt/controls_panel.test.js` (63 cases). Drag-and-reorder friction in initiation threshold, drop targeting, visual feedback, keyboard alternative.

**Basis tie:** the track's acceptance criteria are the manifold this rubric judges against — [AC-1] (criterion ≥ 90 on matrix), [AC-2] (existing certs stay green), [AC-3] (no regressions in full suite), [AC-4] (guard disciplines green).

## Comparison

| Dimension | Candidate A (Initiation Threshold) | Candidate B (Drop Targeting) |
|---|---|---|
| **Impact on criterion** | +6–8 points (removes accidental-drag friction) | +8–10 points (core direct manipulation feel) |
| **Implementation effort** | Low (threshold parameter) | Medium (visual feedback + hit test) |
| **Regression risk** | Very low | Medium (DND logic changes) |
| **Testability** | High (unit threshold tests) | High (visual + hit test) |
| **Standards alignment** | WCAG 2.5.1 | WCAG 2.5.1, 2.5.7 |
| **Future extensibility** | Standalone parameter | Foundation for visual feedback system |

## Candidate B — Drop targeting

**verdict candidate_b:** ADOPTED. Highest weighted score (4.2/5). Drop targeting is the core "feel" of direct manipulation — visual feedback during drag is what makes it feel responsive. Addresses the largest UX gap (drop zone visualization, snap-to-slot). Well-scoped Phase 1 extraction: extend `window.DND` with visual feedback namespace. Meets the basis: drop targeting is the primary "feel" gap.

## Candidate A — Initiation threshold

**verdict candidate_a:** REJECTED (for Phase 1). Lower weighted score (3.6/5). Single-parameter fix; doesn't address the core "feel" gap. Could be Phase 2 parameter if drop targeting alone doesn't reach ≥ 90.
**Recall condition:** adopt A instead only if drop targeting implementation proves sufficient for ≥ 90 without threshold, OR user research shows accidental drags are the primary friction.