# counterfactual_ledger.md — sidebar_controls_improvement_20261103

Every rejection on this track, with the measured reason it was rejected and the condition that would
flip the verdict. The candidates themselves are in `candidate_a.md` and `candidate_b.md`; this file is
the ledger the guard reads.

## C1 — Candidate B: Logical grouping cluster (REJECTED)

**Rejected because:** the gap analysis shows "panel density vs. scanability" is the primary gap —
logical grouping helps discoverability but doesn't reduce density (the core issue). Candidate A
(Density/Progressive Disclosure) scores 4.0/5 vs B's 3.2/5 on weighted evaluation. Progressive
disclosure directly addresses the density/scanability gap; grouping is purely visual structure.
**Recall condition:** adopt B instead only if (a) a Progressive Disclosure Phase 1 implementation
reaches ≥ 90 on UX scoring matrix without grouping, AND (b) a re-certification still names grouping
as a residual gap. Neither holds as of 2026-11-03.

## C2 — Candidate A: Control density / progressive disclosure cluster (ACCEPTED)

**Adopted because:** highest weighted score (4.0/5). Directly targets the "panel density vs.
scanability" gap cited in UX matrix. Low regression risk — additive UI pattern. Clear Phase 1
extraction: extend `window.Controls` with progressive disclosure namespace.
**Recall condition (if later rejected):** revert to A only if Phase 1 progressive disclosure
implementation demonstrably fails to move criterion (e.g., post-implementation audit still at < 85
with progressive disclosure complete), AND a new audit identifies grouping as the larger residual gap.