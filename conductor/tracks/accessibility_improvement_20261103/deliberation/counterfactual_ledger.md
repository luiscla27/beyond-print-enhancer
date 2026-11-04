# counterfactual_ledger.md — accessibility_improvement_20261103

Every rejection on this track, with the measured reason it was rejected and the condition that would
flip the verdict. The candidates themselves are in `candidate_a.md` and `candidate_b.md`; this file is
the ledger the guard reads.

## C1 — Candidate B: Focus management cluster (REJECTED)

**Rejected because:** the gap analysis shows ARIA attributes (screen-reader labels, roles, live
regions) are the primary blocker for screen-reader users — focus management addresses keyboard
operability but core flows already work without mouse. Candidate A (ARIA) scores 4.2/5 vs B's 3.6/5
on weighted evaluation. Behavioral focus changes introduce regression risk in drag-reorder and modals.
**Recall condition:** adopt B instead only if (a) an ARIA-only Phase 1 implementation reaches ≥ 90 on
UX scoring matrix without focus work, AND (b) a re-certification still names focus management as a
residual gap. Neither holds as of 2026-11-03.

## C2 — Candidate A: ARIA remediation cluster (ACCEPTED)

**Adopted because:** highest weighted score (4.2/5). Directly targets the largest screen-reader gap
per UX matrix evidence. Low regression risk — additive DOM attributes. Well-scoped Phase 1 extraction
(new module `js/accessibility_aria.js` or patch in place).
**Recall condition (if later rejected):** revert away from A (i.e. reconsider B or a different cluster as the Phase 1 pick) only if ALL of the following hold:
- a post-implementation audit still measures the accessibility criterion below 85 after the ARIA work is complete (i.e. A demonstrably failed to move the criterion), AND
- a new audit identifies focus management as the larger residual gap, AND
- the re-audit shows the remaining shortfall is NOT a names/states shortfall (that stays A's scope) and NOT a contrast shortfall (that stays C's deferral to the contrast track).