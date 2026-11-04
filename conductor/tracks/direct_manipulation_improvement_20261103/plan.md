# Plan — direct_manipulation_improvement_20261103

**Track ID**: `direct_manipulation_improvement_20261103`

## Phase Checklist

- [ ] **Phase 0** — Nomination (OSD)
  - [ ] Run `subspace-deliberation` skill to nominate Phase 1 cluster
  - [ ] Record decision in `phase0_nomination.md`
  - [ ] Update `metadata.json` phase0.status = "complete"

- [ ] **Phase 1** — Improvement Implementation
  - [ ] Implement nominated cluster (extend window.DND and/or window.Controls)
  - [ ] Update `js/background.js` injection order if new module
  - [ ] Mirror in `test/unit/encapsulation_debt/debt_harness.js`
  - [ ] Write `phase1_extraction.md` with product changes
  - [ ] Run phase test + combined gate (preserve dnd.test.js 33/33, controls_panel.test.js 63/63)

- [ ] **Phase 2** — Measured Premise (if applicable)
  - [ ] N/A unless new measured premise

- [ ] **Phase 3** — Guard-Discipline Continuity
  - [ ] `test/unit/injected_scope_collision.test.js` passes
  - [ ] Dead-exports tripod passes (audit + check scripts)
  - [ ] `test/unit/scripts_hygiene.test.js` passes
  - [ ] Full unit suite: ≥ 2229 passing, 0 new failures
  - [ ] `npm run lint` clean
  - [ ] `node scripts/smoke_low_risk.js` passes (11/11)
  - [ ] Direct Manipulation regression test(s) added and passing
  - [ ] Record in `phase3_full_suite.md`

- [ ] **Phase 4** — Checkpoint + Review + Consultants
  - [ ] Checkpoint commit
  - [ ] Frontier review PASS
  - [ ] 3 consultant verifications UNANIMOUS PASS

- [ ] **Phase 5** — Register + Seal + Hand-over
  - [ ] Seal criteria
  - [ ] Write `final_report.md`
  - [ ] Update `conductor/tracks.md`
  - [ ] Run UX scoring matrix to confirm ≥ 90