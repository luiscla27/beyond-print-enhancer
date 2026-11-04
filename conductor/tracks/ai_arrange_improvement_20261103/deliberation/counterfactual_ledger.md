# counterfactual_ledger.md — ai_arrange_improvement_20261103

Every rejection on this track, with the measured reason it was rejected and the condition that would
flip the verdict. The candidates themselves are in `candidate_a.md` and `candidate_b.md`; this file is
the ledger the guard reads.

## C1 — Candidate B: Undo granularity cluster (REJECTED)

**Rejected because:** the gap analysis shows "usefulness" (user can't see/approve before apply) is
the primary reason for the 78 score — undo granularity addresses "control" but not "usefulness".
Candidate A (Preview/Override) scores 4.0/5 vs B's 3.2/5 on weighted evaluation. Preview directly
addresses the core gap; undo is a post-apply control.
**Recall condition:** adopt B instead only if (a) a Preview/Override Phase 1 implementation reaches ≥ 90
on UX scoring matrix without undo granularity, AND (b) a re-certification still names undo
granularity as a residual gap. Neither holds as of 2026-11-03.

## C2 — Candidate A: User preview/override cluster (ACCEPTED)

**Adopted because:** highest weighted score (4.0/5). Directly targets the "usefulness and user
control" gap cited in UX matrix. Preserves certified AI Arrange algorithm (142 cases + 6 E2E). Clear
Phase 1 extraction path: extend `window.AIArrange` with preview namespace.
**Recall condition (if later rejected):** revert to A only if Phase 1 preview implementation
demonstrably fails to move criterion (e.g., post-implementation audit still at < 85 with preview
complete), AND a new audit identifies undo granularity as the larger residual gap.