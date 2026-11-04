# Spec — Properties Panel (Active Section State) (feature_12_properties_panel)

Re-homed from the UX feature fleet carrier `ux_feature_fleet_20261029`
(2026-10-29), where this unit ran to completion as fleet track track-12.
This is the unit's own canonical conductor track record; the carrier remains the
will-record of the fleet run and is NOT modified.

## Subject

Unit `feature_12_properties_panel`: Properties Panel (Active Section State)
Active section state management, properties panel updates

Files covered:
- js/properties_panel.js

## Scope boundary

- Test-layer only: this track's own work product is the test certificate
  (test/unit/encapsulation_debt/properties_panel.test.js). No `js/**` product code and no
  `manifest.json` change belongs to this track; every product-code fix the fleet
  needed was executed separately under ai_task_runner_20261027 and is cited from
  that track's archive record, not re-executed here.
- The zero-click sqlite parser the fleet added
  (`scripts/dndbeyond_extension_ui_audit.py --zero-click`) is the fleet's shared
  measurement instrument and is deliberately centralized (one copy is the
  permanent anti-drift locus), not re-homed into every unit track.

## Acceptance criteria (SEALED 2026-10-29T16:00:00Z, before any work was done
on this track — inherited from the fleet's sealed unit record)

1. **AC-1** — the unit's test certificate exists at the fleet-declared path and
   its suite is green under `npx mocha`.
2. **AC-2** — the unit's declared writes are disjoint from every other unit's
   writes (the fleet's ownership proof; no code touched by two units, no test
   file touched by two units).
3. **AC-3** — the certificate is integrated through an explicit-path landing
   commit (never `git add -A`) and the full suite is green on the integrated
   tree.
4. **AC-4** — the landing commit SHA is recorded in this track's metadata and
   in the fleet traceability index.

## Non-goals

- Re-running the fleet (all 18 units already ran and landed).
- Re-ratifying product decisions the fleet made (they are recorded in the
  carrier's FINAL_CHECKPOINT.md).
