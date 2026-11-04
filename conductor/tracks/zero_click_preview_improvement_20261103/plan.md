# Plan — zero_click_preview_improvement_20261103

**Track ID**: `zero_click_preview_improvement_20261103`

## Phase Checklist

- [x] **Phase 0** — Nomination (OSD)
  - [x] Run `subspace-deliberation` skill to nominate Phase 1 cluster
  - [x] Record decision in `phase0_nomination.md`
  - [x] Update `metadata.json` phase0.status = "complete"

- [ ] **Phase 1** — Improvement Implementation
  - [ ] Implement nominated cluster (defect remediation, defaults tuning, representative-sheet inventory, or gate instrumentation, per OSD)
  - [ ] Update `js/background.js` injection order only if a new module is introduced
  - [ ] Mirror in `test/unit/encapsulation_debt/debt_harness.js` only if a new top-level seam is introduced
  - [ ] Write `phase1_extraction.md` with product changes
  - [ ] Run phase test + combined gate

- [ ] **Phase 2** — Measured Premise
  - [ ] Build or update an evidence artifact that reproduces the zero-click preview success rate from representative sheets and defect counts
  - [ ] Record measurement method, sheet coverage, and defect classification in `phase2_evidence_method.md`

- [ ] **Phase 3** — Guard-Discipline Continuity
  - [ ] `test/unit/injected_scope_collision.test.js` passes
  - [ ] Dead-exports tripod passes (audit + check scripts)
  - [ ] `test/unit/scripts_hygiene.test.js` passes
  - [ ] Full unit suite: ≥ 2229 passing, 0 new failures
  - [ ] `npm run lint` clean
  - [ ] `node scripts/smoke_low_risk.js` passes (11/11)
  - [ ] Zero-click gate evidence artifact can be re-run by a fresh session
  - [ ] Record in `phase3_full_suite.md`

- [ ] **Phase 4** — Checkpoint + Review + Consultants
  - [ ] Checkpoint commit
  - [ ] Frontier review PASS
  - [ ] 3 consultant verifications UNANIMOUS PASS

- [ ] **Phase 5** — Register + Seal + Hand-over
  - [ ] Seal criteria
  - [ ] Write `final_report.md`
  - [ ] Update `conductor/tracks.md`
  - [ ] Run UX scoring matrix to confirm zero-click gate cap == 100

## Notes for the fresh session

- The target is a **gate**, not a criterion. Do not treat the 94% → 95% move as a cosmetic score bump. The gate cap is what currently holds the whole matrix at 84.
- The acceptance test is **measurable**: `gate_results.zero_click_preview_success_rate` fed into `run.py score --evidence`.
- If the nominated cluster touches print defaults or defects, keep the change as small as the evidence supports. Rising a gate by 1 percentage point does not justify a large print-readiness refactor on its own.
- If the nominated cluster is instrumentation/evidence, the deliverable is a reproducible rate, not a report.
