# Evaluation matrix — visual_capture_red_closure_20261031

Decision: given 11 RED browser_e2e findings — 6 REAL product gaps and 8 stale assertions — how do
we close them without either abandoning measured defects or laundering the harness?

**Basis:** the criteria baseline this decision scopes is this track's `spec.md` §"Acceptance
criteria" (AC-1..AC-7, sealed in `metadata.json` under `operator_ruling`'s scope), read together
with the operator ruling of 2026-10-31 (verbatim in `metadata.json`: *"Fix all 6 real gaps in js/,
and update those 5 stale assertions minimally in the spec files (documented as superseded
behavior; they stay the acceptance harness, still asserting the intended end state)"*). Every
cell below is anchored to a live-boot measurement (the probe recorded in `verification.md`) or to
a product-source citation (`js/print_styles.js`, `js/shape_picker.js`, `js/modals.js`,
`js/catalog_service.js`, `js/recovery_ui.js`, `js/dom/layer_manager.js`, `js/storage.js`).

| dimension | candidate A — fix product + document 8 stale-assertion corrections | candidate B — spec files immutable: product-or-dismiss |
|---|---|---|
| C1 fixes a REAL, measured product defect | YES — 6 measured gaps (pointer-eating by the locked shapes layer, drag commit on mouse+touch, live snap + guides, select-button interception, Escape cancel dead, the reveal step re-locking the layer) | PARTIAL — accepts the same product fixes, but dismisses the remaining REDs |
| C2 keeps the ORIGINAL assertion's intent asserted | YES — all 8 corrections re-checked against the product source; each still asserts its end state | NO — for ≥4 assertions no product change can satisfy them except a REGRESSION |
| C3 minimal and documented | YES — every edit carries a SUPERSEDED BEHAVIOUR note naming track, ruling, superseded form, citation | VACUOUS — nothing changes, so nothing is documented |
| C4 scope discipline (`manifest.json`, `vendor/` untouched) | YES — only `js/` ×2 and the 3 spec files that carried stale assertions | YES |
| C5 evidence of passing in a REAL browser | YES — the inventory runner's exact invocation; 45/45 with per-case `.webm` | NO — 4+ tests stay RED |

## Candidate candidate_a_fix_product_and_correct_stale_assertions

**verdict candidate_a_fix_product_and_correct_stale_assertions:** ADOPTED — the operator ruling
(Option A, 2026-10-31) adopted this candidate at creation; every cell is backed by a live
measurement or a product-source citation, and its anti-laundering mitigation (the source-citation
re-check of all 8 supersessions) was executed before the verdict rather than promised.

## Candidate candidate_b_rigid_no_spec_edits

**verdict candidate_b_rigid_no_spec_edits:** REJECTED — its defining invariant (spec files
immutable) makes ≥4 of the remaining REDs permanently unfixable except through product
regressions (Continue→OK rename breaks the ia_consistency pin; overlay re-stacking; breaking the
pinned exclusive-lock paradigm; a DB version downgrade that loses persisted borders); and it
would leave 6 measured product defects unaddressed while claiming the track's purpose. Its
**Recall condition** is stated in `counterfactual_ledger.md`.

## What the matrix does NOT credit

- Test-count greenness alone. A suite can go green by softening an assertion into vacuity; that
  is scored under C2 (intent still asserted), not C5.
- The operator ruling as a substitute for evidence: it adjudicated the single-answer framing
  ("fix product vs. move the goalposts") per the 2026-09-23 track-creation mandate's single-answer
  clause, and the two candidates above are the REAL rivals that survived to the execution floor —
  not a padded straw.
