**Track ID**: `refactor_surface_20261101`
**Phase**: 0 — Nominate the next main.js dominant cluster (GATE pre-read)
**Created**: 2026-11-01
**Status**: [x] complete

## Nomination

Nominated cluster: **boot / restore orchestration** — the async IIFE body at the bottom of `js/main.js` that runs the startup sequence (layout-scan/migrate/apply or apply-default, restore-layout path, the in-flight marker reset, hide-offscreen-controls, the activation overlay, and the feedback-mark framing), plus the one mutation it calls as a local (`addInteractiveTidbitSection`).

## Evidence it is a dominant

- **Size / cohesion**: it is one contiguous async IIFE with a small number of related concerns sequenced the same way a single startup flow does; extracting it keeps that cohesion in one module rather than scattering it.
- **Cohesion vs. the rest of main.js**: the body does not carry the larger data-shape / spell-detail / controls / print-styles logic — it is the *orchestration* of the other modules' seams, which is exactly the shape that belongs outside the monolith.
- **Callers**: the only caller is the startup path itself (the IIFE). `main.js` remains the single caller after extraction by delegating to `window.Boot.boot()` and keeping its own overlay-mount + re-run-gate responsibilities.
- **Seamability**: every symbol the cluster drives is resolved at call time through `window` — the established pattern for this project's extracted modules (`border_refine.js`, `persistence.js`, `undo.js`, `recovery_ui.js`, the layer-manager-side mode control). It therefore exposes cleanly as a `window.*` seam (here: `window.Boot.boot()`) without restructuring callers.

## Seams decided

- **Exposed seam**: `window.Boot { boot }`.
- **Where it sits**: beside the existing related seams for the modules whose orchestration it now owns (`window.Persistence`, `window.LayoutScan`, `window.LayoutApply`, the restoration/feedback family). It is the same kind of seam — a callable module surface reached through `window` at call time.
- **NOT exposed here**: `window.addInteractiveTidbitSection` and the other mutation seams stay where the range put them (`js/main.js` exposes them directly); boot.js uses them through `window` at call time, not re-exposing them.

## What stays in `js/main.js`

- The activation-overlay mount + re-run gate (the one overlay mount inside main.js) stays in main.js — it is the caller's own responsibility, not the boot module's.
- The `await window.Boot.boot()` call replaces the extracted IIFE body at the call site.
- No increase in main.js monolithicity: the extracted cluster is removed, the delegation is added.

## Why this, not a different cluster

The analysis did not name a specific next dominant cluster; this track's first act is the nomination. Among the remaining candidates, the boot/restore orchestration cluster is the clearest first extraction because:
1. It is a self-contained startup flow, not a sub-part of a larger data module.
2. It maps cleanly to the project's established extraction pattern (one module, one `window.*` seam, booted by `debt_harness.js`, proven by a concrete unit test).
3. Extracting it first leaves the larger product clusters (spell detail, controls, etc.) intact for later phases, and it is the one cluster whose IIFE already calls a local mutation (`addInteractiveTidbitSection`) that the extract must still reach through `window` — which is the seam-discipline proof point the track wants to keep live.

## Decisions

- **D-0.1 — nomination timing**: Nominated here, in a track artifact, before any extraction task flips to in-progress. The analysis did not pre-name the cluster, so the nomination IS the first artifact.
- **D-0.2 — which seam**: `window.Boot.boot()`. Rationale: matches the project's established module-surface convention; avoids inventing a new naming scheme for the same kind of thing.

## GATE pre-read (Phase 0)

Reviewed before any in-progress task:
- This track's `spec.md` + `plan.md`.
- Project `AGENTS.md` maintenance guidelines (injected-scope rule, dead-export tripod, scripts-hygiene arms 8/9, hump-filename-only policy, `window.*` seam convention, fail-open call-time resolution).
- `conductor/refactor_analysis_20261101.md` (source analysis).
- Acceptance criteria: AC-1, AC-2, AC-7 (partial at nomination; full at Phase 1).

**GATE verdict**: proceed to Phase 1, with the containment checklist recorded in `plan.md` (Phase 1 completion checklist artifact). The extraction is bounded by the checklist so that whether it succeeds or fails, the trail left behind is a coherent phase artifact, not a partial edit with no story.

**Landed as:** Phase 1 extraction completed and green.
