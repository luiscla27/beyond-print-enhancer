# Evaluation matrix — feature_12_properties_panel

**Basis (declared before any verdict):** the fleet's own in-repo record — `conductor/tracks/ux_feature_fleet_20261029/units.json` (the 18 sealed unit records), the progress rows under `conductor/tracks/ux_feature_fleet_20261029/fleet/runtime/progress/`, and `conductor/tracks/ux_feature_fleet_20261029/fleet/integrator-prompt.md` (which carries the verbatim ownership rule). Weighting fixed at basis-declaration: disjointness enforcement 0.35, instrument single-locus 0.20, harvest control 0.20, per-unit canonical record 0.15, batch close-out arithmetic 0.10.
in-repo record — `conductor/tracks/ux_feature_fleet_20261029/units.json` (the
18 sealed unit records), the per-unit progress rows under
`conductor/tracks/ux_feature_fleet_20261029/fleet/runtime/progress/`, and the
integrator's rulebook `conductor/tracks/ux_feature_fleet_20261029/fleet/integrator-prompt.md`
(including the verbatim ownership rule: "no code may be touched by two units,
no test file may be touched by two units"). Weighting fixed at basis-declaration:
disjointness enforcement 0.35, instrument single-locus 0.20, harvest control
0.20, per-unit canonical record 0.15, batch close-out arithmetic 0.10.

| criterion (weight) | candidate A: adaptive fleet partition | candidate B: rigid one-track-per-unit |
|---|---|---|
| AC-2 disjointness enforcement (0.35) | PASS — ownership partition by construction; proven live (`git status -- js/` empty across the integration) | PASS for the unit itself; NO cross-unit witness exists |
| Instrument single-locus (0.20) | PASS — zero-click parser written once, shared | FAIL by shape — 18 copies, the drift class |
| Harvest control (0.20) | PASS — integrator holds certificates until content matches the declared component | none — no control exists |
| Per-unit canonical record (0.15) | PASS after re-homing (this track) | PASS natively |
| Batch close-out arithmetic (0.10) | PASS — one integration, one full-suite green | FAIL by shape — 18 separate gates |

2026-10-29 batch execution — the only shape in which AC-2 is enforceable by
construction AND the shared instrument is written once; all four criteria met,
landing `9fa4cdc`.

batch run — inadmissible by SHAPE, not by constraint violation (the verbatim
ownership rule held with zero violations under both shapes); its own properties
fail the instrument-single-locus and close-out-arithmetic criteria and it loses
the cross-unit disjointness witness the partitioned run demonstrably produced
on the real tree. RETAINED with a recall condition for an isolated re-run (see
the ledger).

### candidate_a_adaptive_fleet_partition.md

**Verdict (for: candidate_a_adaptive_fleet_partition.md):** ADOPTED for the

### candidate_b_rigid_one_track_per_unit.md

**Verdict (for: candidate_b_rigid_one_track_per_unit.md):** REJECTED for the
