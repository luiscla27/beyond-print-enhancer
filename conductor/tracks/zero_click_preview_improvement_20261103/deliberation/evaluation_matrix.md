# Evaluation Matrix — zero_click_preview_improvement_20261103

**Basis:** the track's own acceptance criteria in `spec.md` (`[AC-1]` rate >= 95% on a reproducible evidence artifact, `[AC-2]` cap 100 from `vendor/.reasonix/skills/ux-scoring-matrix/run.py`, `[AC-3]` re-runnable by a fresh session, `[AC-4]` no regressions) read against the gate contract in `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json` and the current measured state in `temp/ux_matrix/evidence_current.json` (gate slot `zero_click_preview_success_rate = 0.886`, cap 84).

## Step 1 — Admissibility filter (applied BEFORE any ranking)

The requirements an admissible Phase-1 cluster must satisfy. A candidate that fails any of R1–R3 is
**inadmissible** and never enters the utility ranking; a candidate that fails only R4/R5 is admissible
but cannot, on its own, close the track.

- **R1 — Moves the measured rate.** The cluster must be capable of changing the number in
  `gate_results.zero_click_preview_success_rate` from its current value toward >= 0.95 [AC-1].
- **R2 — Makes the number reproducible.** The cluster must produce a rate a fresh session can re-run
  from the same method [AC-3]; a rate that is asserted cannot be accepted even if it is high.
- **R3 — Addresses the measurement gap this track actually opens with.** The artifact on disk carries
  `0.886` for a gate slot the narrative calls 94%, and the artifact itself disclaims it as a
  non-matrix-valid proxy. A cluster that plans against either number without resolving which one is
  authoritative is planning against an unverified premise.
- **R4 — Stays inside the gate.** The change must not claim to lift the cap by moving an unrelated
  criterion; the cap contract is arithmetic (`94% -> 84`, `95% -> 100`) and the criterion ratings are
  other tracks' work.
- **R5 — No regression of the print certs.** `test/unit/print_styles.test.js` and the three print E2E
  specs must stay green [AC-4].

| Requirement | A (inventory) | B (defect remediation) | C (default tuning) | D (instrumentation) |
|---|---|---|---|---|
| R1 moves the rate | partial — measures, does not fix | **yes** (targets the failures) | partial — only if defaults are the binding cause | **no** — measurement only |
| R2 reproducible | **yes** — its deliverable IS the method | needs A/D to supply it | no — cannot evidence itself | **yes** |
| R3 resolves the 94% vs 0.886 gap | **yes** | no — assumes a rate | no | **yes** |
| R4 stays inside the gate | yes | yes | yes | yes |
| R5 print certs green | trivially yes (no product change) | at risk, mitigated by the certs | at risk, mitigated by the certs | trivially yes |

**Filter outcome:** no candidate is inadmissible outright. Two candidates (A, D) satisfy R2+R3 and two
(B, C) do not; B alone satisfies R1 with a fix; C satisfies neither R1-with-evidence nor R2. The
ranking below therefore holds only admissible-on-evidence survivors and records what each one owes.

## Step 2 — Utility ranking of the survivors

Ordered by leverage per unit of unverified premise, which is the order the spec's own decision rule
names ("if measurement is uncertain, prefer A/D first"): **A > B > D > C**.

## Candidate A — Representative-sheet coverage and defect inventory

**verdict candidate_a:** ADOPTED for Phase 1. The only cluster satisfying R1, R2 and R3 at once: it
makes the rate reproducible (R2), it resolves which of the two disagreeing numbers is authoritative by
measuring the representative-sheet set the matrix actually defines (R3), and it converts "94% or 88.6%"
into a defect inventory that names what the remaining failures are (R1, by making the failure set
fixable and countable). It does this without touching product behaviour, so R5 holds trivially. What it
does NOT do, stated here so it cannot be read as a closure: it does not by itself raise the rate — if
the inventory shows failures concentrated in one defect class, that defect work is the immediately
following step, and if the inventory shows the rate already at or above 0.95 under the matrix's own
definition, the correct outcome is to report that measurement, not to invent a fix.

## Candidate B — Print-defect root-cause remediation

**verdict candidate_b:** NOT ADMITTED as Phase 1 (admissible, deferred). The only cluster that
directly satisfies R1, so it is not rejected on merit — it is deferred because it cannot satisfy R2 or
R3 on its own: fixing defects measured against an unresolvable rate produces a before/after pair where
both halves are unverified, and the artifact's own note warns that the 0.886 proxy may already be below
a matrix-valid measurement. B also carries the highest R5 exposure of the four, since it changes product
behaviour on the print path. Its requirement coverage is real and it is the expected Phase-2 body of
work once A has produced the defect inventory.

## Candidate C — Default-state tuning

**verdict candidate_c:** NOT ADMITTED as Phase 1 (admissible, deferred and demoted). It fails R2 and
R3 outright and satisfies R1 only conditionally: a defaults change is one edit that applies to every
sheet, so it is the cheapest lever available IF the defaults are the binding cause — and there is
currently no inventory that can tell "the default was wrong" from "this sheet has a sheet-specific
defect", because no per-sheet evidence exists. Ranking it now would be choosing a mechanism on a
premise the track has not measured. It is eligible after A, and it is most likely to be the Phase-2
form of whichever defect class A shows to be default-driven.

## Candidate D — Print-preview gate instrumentation

**verdict candidate_d:** NOT ADMITTED as a standalone Phase 1 (admissible, subsumed). It satisfies R2
and R3 — and that is precisely why it cannot stand alone: it fails R1 by construction, so delivering
it as the cluster converts "the rate is unclear" into "the rate is confirmed at its current value",
which is a correct measurement and a zero-move on the score. It is not rejected and not deferred to
some later phase: its whole content is inside the adopted cluster, whose deliverable is a
representative-sheet-backed artifact that emits the gate slot. Delivering D *as well as* A would be
delivering one artifact twice.

## Comparison (entered after every attribution above; carries no verdict marker)

A is the minimum-commitment move that makes the other three answerable. B is the move that actually
raises the rate, and it becomes executable the moment A names the defect classes. C is B's cheapest
possible form and cannot be chosen before the inventory exists. D is not an alternative to A — it is
A's deliverable. The nomination therefore adopts A and pre-declares B as the expected Phase-2 body,
with C and D positions decided by what A measures rather than by preference.
