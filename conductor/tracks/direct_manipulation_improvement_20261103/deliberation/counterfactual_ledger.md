# counterfactual_ledger.md — direct_manipulation_improvement_20261103

Every rejection on this track, with the measured reason it was rejected and the condition that would
flip the verdict. The candidates themselves are in `candidate_a.md` and `candidate_b.md`; this file is
the ledger the guard reads.

## C1 — Candidate A: Initiation threshold cluster (REJECTED)

**Rejected because:** the gap analysis shows drop targeting (visual feedback, snap-to-slot, clear
target indication) is the core "feel" of direct manipulation — initiation threshold removes
accidental drags but doesn't improve the core drag experience. Candidate B (Drop Targeting) scores
4.2/5 vs A's 3.6/5 on weighted evaluation. Drop targeting addresses the largest UX gap.
**Recall condition:** adopt A instead only if (a) a Drop Targeting Phase 1 implementation reaches ≥ 90
on UX scoring matrix without initiation threshold, AND (b) a re-certification still names initiation
threshold as a residual gap. Neither holds as of 2026-11-03.

## C2 — Candidate B: Drop targeting cluster (ACCEPTED)

**Adopted because:** highest weighted score (4.2/5). Drop targeting is the core "feel" of direct
manipulation — visual feedback during drag is what makes it feel responsive. Addresses the largest
UX gap (drop zone visualization, snap-to-slot). Well-scoped Phase 1 extraction: extend `window.DND`
with visual feedback namespace.
**Recall condition (if later rejected):** revert to B only if Phase 1 drop targeting implementation
demonstrably fails to move criterion (e.g., post-implementation audit still at < 85 with drop
targeting complete), AND a new audit identifies initiation threshold as the larger residual gap.