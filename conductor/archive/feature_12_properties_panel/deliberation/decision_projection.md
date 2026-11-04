# Decision projection — feature_12_properties_panel

**Decision id:** feature_12_properties_panel-execution-shape-20261029

**Chosen candidate:** `candidate_a_adaptive_fleet_partition.md` — the adaptive fleet partition, adopted for the 2026-10-29 batch run; landing recorded in `metadata.json`.
fleet partition, adopted for the 2026-10-29 batch run on 2026-10-29; landing
`9fa4cdc`.

**Chosen artifact / composition:** the unit's test certificate at
`test/unit/encapsulation_debt/properties_panel.test.js`, landed as `9fa4cdc`.

**Locked invariants:** the sealed test paths, the disjoint write set, and the single-locus audit instrument (enumerated inline below)


- the certificate's declared test paths stay exactly as sealed in the fleet
  unit record (`conductor/tracks/ux_feature_fleet_20261029/units.json`,
  entry `feature_12_properties_panel`); any new test extends, never silently replaces
- this unit's write set stays disjoint — its component key `js/properties_panel` owns
  `js/properties_panel.js`; no other track may touch these files and
  this unit may not touch another's
- the shared zero-click audit instrument stays single-locus
  (`scripts/dndbeyond_extension_ui_audit.py --zero-click`)

**Expected observable outcomes:** `npx mocha test/unit/encapsulation_debt/properties_panel.test.js` green on every
future tree that preserves the unit's files; the full suite
(`npx mocha --recursive test/unit --timeout 30000`) green with this unit's
cases passing; the integration-tree snapshot `git status -- js/` clean after
any integration that includes this unit.

**Retained alternatives:** candidate B (rigid one-track-per-unit) is RETAINED
with recall condition "a future isolated re-run with no batch siblings" — it
becomes admissible the moment this unit is worked on alone.
