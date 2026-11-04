# Plan — feature_04_shape_picker

All phases complete. The work was executed inside the fleet run
(`ux_feature_fleet_20261029`, track-14) on 2026-10-29;
this plan records it in the house phase grammar so the unit has a canonical
plan alongside its spec.

## Phases

- [x] **Phase 1 — Certificate authored** [a50a977-era landing recorded in fleet
  progress track-14] (b9684a3) — the unit's test certificate was
  authored and verified green against the unit's declared component.
- [x] **Phase 2 — Harvest control** (b9684a3) — the certificate was held to
  the fleet's harvest control: content matched the declared component and was
  NOT released to the integrator until control passed.
- [x] **Phase 3 — Explicit-path landing** (b9684a3) — the integrator landed
  the certificate in a dedicated commit with explicit paths (never `git
  add -A`); `git status -- js/` proved zero product-code mutations across the
  whole integration, so this unit's disjointness held on the real tree.
- [x] **Phase 4 — Full-suite green** (b9684a3) — the integrated tree passed
  the whole unit suite (2228 passing / 0 failing / 1 pending — the pending is
  the pre-existing release_gate skip-by-design, unrelated to any fleet change).
- [x] **Phase 5 — Traceability + close-out** (b9684a3) — the unit's
  traceability record, progress record and fleet index entries carry this
  SHA; the carrier's FINAL_CHECKPOINT.md summarizes all 18 units.
- [x] **Phase 6 — Track re-homing (this record)** — the unit's evidence is
  re-homed into this canonical track directory; no product file changes.

## Task ledger

- [x] test certificate present and green: test/unit/asset_catalog.test.js

## Verification commands used at the time

```
npx mocha test/unit/asset_catalog.test.js                           # AC-1, per unit
npx mocha --recursive test/unit --timeout 30000        # AC-3 (full suite)
git status -- js/                                      # AC-2 disjointness proof
python vendor/housekeeping_guard.py check              # close-out gate
```
