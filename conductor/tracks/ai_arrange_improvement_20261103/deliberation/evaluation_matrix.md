# Decision space: ai_arrange_improvement_20261103

Question: which AI Arrange cluster (User preview/override vs Undo granularity) raises the AI Arrange criterion from 78 → 90+ with the fewest new surface concepts, given the UX scoring matrix gap analysis?

**Basis:** the gap analysis from the UX scoring matrix (`vendor/.reasonix/skills/ux-scoring-matrix/matrix.json`): current 78, target 90+, weight 8%. Existing certs: `test/unit/ai_layout_schema.test.js` (142 cases), `test/browser_e2e/byok_arrange_roundtrip.spec.js` (6 E2E). "Usefulness and user control" dimension rates lower.

**Basis tie:** the track's acceptance criteria are the manifold this rubric judges against — [AC-1] (criterion ≥ 90 on matrix), [AC-2] (existing certs stay green), [AC-3] (no regressions in full suite), [AC-4] (guard disciplines green).

## Comparison

| Dimension | Candidate A (Preview/Override) | Candidate B (Undo Granularity) |
|---|---|---|
| **Impact on criterion** | +10–12 points (preview directly addresses "usefulness" gap) | +6–8 points (undo addresses "control" but not "usefulness") |
| **Implementation effort** | Medium (new preview UI + diff engine) | Medium (undo stack redesign) |
| **Regression risk** | Medium (new UI surface) | Low (extends existing undo) |
| **Testability** | High (E2E preview flow) | High (unit undo tests) |
| **Standards alignment** | ISO 9241-110 (user control), 9241-210 (preview) | ISO 9241-110 (reversibility) |
| **Future extensibility** | Foundation for explanation + confidence | Independent enhancement |

## Candidate A — User preview/override

**verdict candidate_a:** ADOPTED. Highest weighted score (4.0/5). Directly targets the "usefulness and user control" gap cited in UX matrix. Preserves certified AI Arrange algorithm (142 cases + 6 E2E). Clear Phase 1 extraction path: extend `window.AIArrange` with preview namespace. Meets the basis: preview before apply is the primary "usefulness" gap.

## Candidate B — Undo granularity

**verdict candidate_b:** REJECTED (for Phase 1). Lower weighted score (3.2/5). Doesn't solve the core "usefulness" gap (user can't see/approve before apply). Could be Phase 2 enhancement if preview alone doesn't reach ≥ 90.
**Recall condition:** adopt B instead only if preview implementation proves sufficient for ≥ 90 without undo granularity, OR user research shows undo granularity > preview for control perception.