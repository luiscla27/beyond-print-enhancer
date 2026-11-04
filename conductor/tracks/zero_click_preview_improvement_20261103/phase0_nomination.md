# Phase 0 Nomination — zero_click_preview_improvement_20261103

**Track ID**: `zero_click_preview_improvement_20261103` · **Date**: 2026-11-03 · **Phase**: 0 (Nomination)

## Decision

**Adopt Cluster A (representative-sheet coverage and defect inventory) as the Phase 1 cluster.**

The deliberation is filed in `deliberation/` — four candidate texts (`candidate_a.md` ..
`candidate_d.md`), the admissibility filter and utility ranking in `evaluation_matrix.md`, and the
rejection record with recall conditions in `counterfactual_ledger.md`. This file is the nomination
record; the guard reads the deliberation folder, not this file.

## Starting point (stated explicitly, because the track's premise is not settled)

The spec and `metadata.json` open with **94% -> 95%+**, cap **84 -> 100**. The evidence artifact on disk
says something else, and says so itself:

- `temp/ux_matrix/evidence_current.json` carries
  `gate_results.zero_click_preview_success_rate = 0.886`, and `run.py` derives cap **84** from it — the
  cap arithmetic agrees with the spec for both 94% and 88.6% (both land in the 85-94% band).
- The track's own `evidence.json` flags the disagreement in `gate_state_proof.why_94_vs_886` and states
  that 0.886 is **not** measured against the matrix's representative-sheet definition ("10 sheets, no
  adjustment required") but is an SC-A2 mean/5 proxy, which `score_run_20261029.json` disposition P3
  rejects as an invalid gate measurement.
- The same file's `ceiling_effect_proof` also corrects a premise in the spec: with the *current*
  evidence, `raw_score + severity = 77.92`, which is **below** the 84 cap, so the cap is **not binding**
  today and raising it to 100 does not by itself raise this evidence's final score. The ceiling-lift
  claim holds only once criteria rise toward 90+ (i.e. once the sibling criterion tracks land), which
  makes it conditional rather than a guaranteed outcome of moving the gate.

**Consequence for this track**: the authoritative number is not known, and no code change can be
credited against an unknown number. That is the reason A wins the nomination — not because measuring is
safer, but because the track currently has no measurable premise to act on.

## Why A (representative-sheet coverage + defect inventory) is the Phase 1 pick

Against the requirement set declared in `evaluation_matrix.md` (R1 moves the rate, R2 makes it
reproducible, R3 resolves the 94% vs 0.886 measurement gap, R4 stays inside the gate, R5 no print-cert
regression):

1. **A is the only cluster satisfying R1, R2 and R3 at once.** It makes the rate reproducible, it
   resolves which of the two disagreeing numbers is authoritative by measuring the representative-sheet
   set the matrix actually defines, and it converts the percentage into a named defect inventory.
2. **A carries the lowest regression exposure of the four.** It touches no product behaviour, so the
   print certs (`test/unit/print_styles.test.js`, `test/browser_e2e/print_output_audit.spec.js`,
   `test/browser_e2e/print_per_layer.spec.js`,
   `test/browser_e2e/layer_print_visibility.spec.js`) cannot be regressed by it.
3. **A is a prerequisite for crediting B or C.** Both are plausible rate movers and neither can produce
   evidence of having moved the rate while the rate itself is unresolvable. A before/after pair measured
   against a disclaimed proxy has two unverified halves.
4. **A does not pre-empt the fix.** It is not a measurement-only track disguised as progress: its
   deliverable is the defect inventory that Phase 2 acts on, and the nomination below names the
   promotion trigger explicitly.

## What A does NOT claim

- It does **not** claim the rate rises to 95%. If the inventory shows the rate already at or above 0.95
  under the matrix's own definition, the correct Phase-1 outcome is to **report that measurement** and
  record why the narrative 94% differed — not to manufacture a fix to justify the track.
- It does **not** claim the cap becomes binding after the move. Per the ceiling-effect correction above,
  the cap lift only converts into a higher final score once the criterion ratings rise; the gate work
  and the criterion tracks are separate bodies of work and this track must not report the other's gains.
- It does **not** claim SC-A2 is a valid substitute for the gate metric; the whole point is to replace
  the proxy with a representative-sheet measurement.

## Candidate dispositions (summary; the record of each is in the ledger)

- **candidate_a — ADOPTED (Phase 1).** Satisfies R1+R2+R3; no product surface.
- **candidate_b (print-defect root-cause remediation) — NOT ADMITTED for Phase 1, deferred.** Fails R2
  and R3 alone, but is the only cluster that directly satisfies R1, so it is the expected Phase-2 body
  of work. **Recall condition**: promote as soon as A produces a re-runnable measurement plus a named,
  clustered defect inventory.
- **candidate_c (default-state tuning) — NOT ADMITTED for Phase 1, deferred and demoted.** Fails R2/R3
  and satisfies R1 only if defaults are the binding cause, which nothing on this tree can currently
  distinguish from sheet-specific defects. **Recall condition**: recall only if A's inventory shows the
  failing sheets share a default-driven cause (pagination, margins, scale, colour handling, border
  rendering, saved-preference application).
- **candidate_d (gate instrumentation) — NOT ADMITTED as a standalone cluster, subsumed into A.** It
  satisfies R2/R3 and fails R1 by construction, so delivering it alone converts "the rate is unclear"
  into "the rate is confirmed at its current value" — a correct measurement and a zero-move on the
  score. Its entire content is A's deliverable, so adopting both would deliver one artifact twice.
  **Recall condition**: recall as its own cluster only if the representative-sheet definition cannot be
  operationalised inside A and the measurement must become a separate track.

## Phase 1 entry contract (what the next session executes against)

1. **Define the representative-sheet set operationally**, from the matrix's own gate definition
   ("percentage of representative sheets that enter preview with no blocking print defect and require no
   user adjustment") — the sheet list, what counts as a blocking defect, and what counts as "requires
   adjustment". Record it in the track, not in prose.
2. **Measure it.** Emit `gate_results.zero_click_preview_success_rate` from that definition via an
   artifact a fresh session can re-run. Do not enter the number by hand.
3. **Classify the failures** into named defect classes (clipping, overlapping, blank/hidden content,
   pagination, defaults) with per-sheet attribution, and count each class.
4. **Score it** with `python vendor/.reasonix/skills/ux-scoring-matrix/run.py score --evidence
   <evidence.json>` and record the resulting cap.
5. **Hand back**: if the measured rate is >= 0.95 under the matrix definition, `[AC-1]` is met by the
   measurement and `[AC-3]` by the re-run. Otherwise Phase 2 is candidate B (and/or the default-driven
   subset C, per the recall conditions above), chosen by which defect classes the inventory names — not
   by preference.

## Note on the 94% figure

The consultation narrative's 94% is **not** reproduced by anything on disk. `run.py` confirms the *cap
contract* (94% and 88.6% both cap at 84; 95% caps at 100) but not the rate. A future session must not
carry 94% forward as a measured baseline; the number to beat is whatever the representative-sheet run
says, and the first honest deliverable may well be "the starting rate is 88.6%, confirmed".
