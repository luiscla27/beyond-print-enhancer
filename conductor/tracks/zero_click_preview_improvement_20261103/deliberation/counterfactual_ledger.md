# Counterfactual Ledger — zero_click_preview_improvement_20261103

Every candidate this record did not adopt, with the requirement it failed and the condition that would
recall it. The full admissibility filter and ranking are in `evaluation_matrix.md`; this file is the
ledger the guard reads. The candidate texts are `candidate_a.md` … `candidate_d.md`.

**Basis:** the requirement set R1–R5 declared in `evaluation_matrix.md`, which is derived from the
track's own `spec.md` criteria `[AC-1]`..`[AC-4]` and the gate contract in
`vendor/.reasonix/skills/ux-scoring-matrix/matrix.json`.

## C1 — candidate_b: print-defect root-cause remediation (NOT ADMITTED for Phase 1)

**Rejected for Phase 1 because:** it fails R2 (reproducible rate) and R3 (resolve the 94% vs 0.886
measurement gap). It is the only candidate that directly satisfies R1 — fixing the defects that force
adjustment is the actual rate mover — so this is a deferral on evidence grounds, not a rejection on
merit. A before/after pair measured against an unresolvable rate has two unverified halves, and the
evidence artifact's own `important_caveat` says the current 0.886 proxy may not be a matrix-valid
measurement at all. It also carries the highest R5 exposure of the four (product behaviour change on
the print path).

**Recall condition:** promote candidate_b to the Phase-1 body of work as soon as candidate_a's
inventory exists — i.e. when the representative-sheet set is defined, a re-runnable measurement names
which sheets fail the zero-click test, and their failures are clustered into named defect classes.
Recall is immediate if the inventory shows a single defect class accounting for enough of the failures
to cross 0.95.

## C2 — candidate_c: default-state tuning (NOT ADMITTED for Phase 1; deferred and demoted)

**Rejected for Phase 1 because:** it satisfies R1 only conditionally and fails R2 and R3. A defaults
change is the cheapest lever per adjustment avoided — one edit applies to every sheet — but nothing on
this tree can currently distinguish "the default was wrong" from "this sheet has a sheet-specific
defect", because no per-sheet evidence exists. Choosing it now would be picking a mechanism on a
premise the track has not measured, which is exactly what the record's own decision rule forbids
("if measurement is uncertain, prefer A/D first"). Its regression exposure is real: a wrong default
guess breaks sheets that currently pass, and the same missing evidence would not catch it.

**Recall condition:** recall candidate_c only if candidate_a's inventory shows the failing sheets share
a default-driven cause (pagination, margins, scale, colour handling, border rendering, or
saved-preference application) rather than distinct sheet-specific defects. If the failures are scattered
across unrelated sheets, candidate_c stays demoted and candidate_b is the correct next body of work.

## C3 — candidate_d: print-preview gate instrumentation (NOT ADMITTED as a standalone cluster; subsumed)

**Rejected as a standalone Phase 1 because:** it fails R1 by construction. Instrumentation is a correct
and necessary piece of work, and it satisfies R2 and R3 fully — which is precisely why it cannot be the
cluster: delivered alone it converts "the rate is unclear (94% in the narrative, 0.886 in the artifact)"
into "the rate is confirmed at its current value", a zero-move on the score and a worse honest answer
than the track was chartered to produce. It is not deferred to a later phase either: its entire content
lives inside candidate_a's deliverable, whose output is a representative-sheet-backed artifact emitting
`gate_results.zero_click_preview_success_rate`. Adopting both would be delivering one artifact twice.

**Recall condition:** recall candidate_d as its own cluster only if candidate_a's delivered artifact
proves unable to emit the gate slot from a re-runnable method — i.e. if the representative-sheet
definition cannot be operationalised inside the adopted cluster and the measurement has to become a
separate track. A re-run of the artifact by a fresh session that reproduces the same rate closes this
recall for good.

## C4 — candidate_a: representative-sheet coverage and defect inventory (ADOPTED — retained so its own rejection is falsifiable)

**Adopted because:** it is the only candidate that satisfies R1, R2 and R3 together — it makes the rate
reproducible, it resolves which of the two disagreeing numbers is authoritative by measuring the
representative-sheet set the matrix actually defines, and it converts an unverifiable percentage into a
named defect inventory. It touches no product behaviour, so R5 holds trivially.

**Recall condition (if later rejected):** reconsider candidate_a as the Phase-1 cluster only if ALL of
the following hold: the delivered inventory fails to produce a rate that reproduces on a second run by a
different session (R2 unmet), AND the attempt shows the representative-sheet definition cannot be
operationalised on this tree at all, AND the alternative that produced the working measurement is one of
candidate_b/candidate_c/candidate_d carrying its own reproducible evidence. A single failure of the
artifact to reproduce is not enough to recall this — it is a defect to fix inside candidate_a's scope.
