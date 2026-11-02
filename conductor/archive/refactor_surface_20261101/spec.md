# Spec — refactor_surface_20261101

**Track ID**: `refactor_surface_20261101` · **Created**: 2026-11-01 · **Owner**: agent session (refactor-analysis skill -> conductor-protocol)

## Goal

Continue shrinking `js/main.js` by extracting its dominant clusters into standalone modules behind `window.*` seams, using the pattern the analyzed range (`c5caf02..HEAD`) itself established, while keeping the four guard disciplines green at every phase.

## Scope

- **In scope**: extraction of the boot/restore orchestration cluster (Phase 1, this track's first extraction); guard-discipline continuity (Phase 3); checkpoint + frontier review + 3-consultant verification (Phase 4); register/seal/hand-over (Phase 5). Later extractions (spell-detail, controls, print-styles) are FUTURE phases of this track, not part of the current work.
- **Out of scope**: behavior changes of any kind; restructuring existing callers' seam resolution; new product features; the vendored runtime; other projects.

## Design decisions

- **D-1 — pattern**: one module per cluster, ONE top-level `window.*` binding (a namespace object where the module has many members), injected by `js/background.js` immediately before its caller, mirrored positionally in `test/unit/encapsulation_debt/debt_harness.js`, call-time resolution through `window.*` (fail-open) per the range's established convention.
- **D-2 — boot seam shape**: `window.Boot = { boot }` — a callable orchestration seam beside the `window.Persistence` / `window.LayoutScan` / `window.LayoutApply` family. `boot(beforeMutations)` takes an optional async hook so main.js keeps ownership of the re-run confirm gate without the boot module reaching into main.js internals.
- **D-3 — what stays in main.js**: the activation-overlay MOUNT (must run before the re-run gate) and the re-run gate itself (it uses a main.js-local `askConfirm`). Everything else in the IIFE moves.
- **D-4 — discipline**: module-locals are uniquely prefixed (`bootSafeLog`, `bootStep`) per the injected-scope rule; no `console` (O-4: `no-console` is an eslint error; the logger seam is resolved at call time).

## Audit Evidence

- Source analysis: `conductor/refactor_analysis_20261101.md` — the range `c5caf02..HEAD` (62 commits) is net-positive on extensibility/testability/debt-fencing/standardization; the single most actionable remaining item is `js/main.js` still being the monolith.
- Guard state at nomination: `test/unit/injected_scope_collision.test.js`, `test/unit/dead_exports.test.js` (+ tripod scripts), `test/unit/scripts_hygiene.test.js` — all green on the pre-extraction tree.

## Acceptance Criteria

- **AC-1**: `js/boot.js` exposes exactly ONE top-level binding (`window.Boot = { boot }`), is idempotent across re-injection, is loaded AFTER its seams and BEFORE its one caller (`js/main.js`), and every step `boot()` drives resolves through `window` at call time — a missing seam is SKIPPED, not fatal, and a throwing seam cannot abort the boot. Falsified if: a second top-level binding appears, re-injection throws or double-runs, the injected order regresses, or an absent/throwing seam aborts the sequence.
- **AC-2**: `js/main.js` delegates to `await window.Boot.boot()` instead of keeping a second copy of the sequence, and keeps only the activation-overlay mount + the re-run gate. Falsified if: main.js retains a duplicate of the boot sequence, or loses the mount/gate responsibilities.
- **AC-3**: the phase test `test/unit/encapsulation_debt/boot_module.test.js` exercises the sequence end-to-end against live seams (declared order, failed-restore surfaces the recovery card, empty layout applies default, gate-halt semantics) and passes. Falsified if: the test is removed, vacuous, or red.
- **AC-4**: the injected-scope collision guard (`test/unit/injected_scope_collision.test.js`) passes after the extraction — no new top-level binding collides with or shadows another injected module's. Falsified if: the guard fails or is vacated.
- **AC-5**: the dead-export tripod (`test/unit/dead_exports.test.js` + `scripts/audit_dead_exports.js` + `scripts/check_dead_exports.js`) passes with counts updated deliberately for the new seam, and zero dead exports. Falsified if: the counts are stale, an unhandled dead export appears, or the audit reports violations.
- **AC-6**: scripts hygiene (`test/unit/scripts_hygiene.test.js` + `scripts/check_scripts_hygiene.js`) passes. Falsified if: either fails on the delivered tree.
- **AC-7**: `npm run lint` is clean and `node scripts/smoke_low_risk.js` passes (11/11) on the delivered tree. Falsified if: either fails.
- **AC-8**: the split guard `test/unit/module_split_guard.test.js` passes — the moved function bodies are the moved ones (exist exactly ONCE), the frozen seam set holds, and no module of the split captures a seam at LOAD time. Falsified if: the guard fails or the seam set drifts without a deliberate count update.
- **AC-9**: the track artifacts (`metadata.json`, `index.md`, `plan.md`, `phase0_nomination.md`, `phase1_extraction.md`, `conductor/tracks.md`) state the true phase state — no artifact claims a phase that did not run, and every claimed gate cites its command and result. Falsified if: any artifact asserts a state the tree contradicts.
