# Plan — refactor_surface_20261101

> Source of truth for this track's tasks and phases (conductor-protocol).
> Status legend: `[ ]` pending · `[~]` in-progress · `[x]` completed.

**Status**: [x] phase3-complete — Phase 4 in progress.

## Phase 0 — Nominate the next main.js dominant cluster

- [x] GATE pre-read: review `spec.md`, `plan.md`, project `AGENTS.md` reference docs, and `conductor/refactor_analysis_20261101.md` before nominating.
- [x] Nominate the cluster and record the nomination as a track artifact (`phase0_nomination.md`), with the evidence that it is a dominant, the seams decided, and what stays in `js/main.js`.

## Phase 1 — Extract the nominated cluster behind a seam

- [x] Extract the boot/restore orchestration IIFE from `js/main.js` into `js/boot.js` behind the `window.Boot { boot }` seam (verbatim move; activation-overlay mount + re-run gate stay in main.js).
- [x] Update `js/background.js` (inject `js/boot.js` before `js/main.js`) and `test/unit/encapsulation_debt/debt_harness.js` (same positional mirror in the harness).
- [x] Write the phase test `test/unit/encapsulation_debt/boot_module.test.js` (seam surface, one-binding invariant, harness-order mirror, live-sequence behavior) — 13/13 green.
- [x] Update `test/unit/dead_exports.test.js` counts for the new module seam (170 -> 171 direct, 169 -> 170 module) — 9/9 green.
- [x] Run the combined Phase 1 gate (`boot_module` + `module_split_guard`) — 19 passing, 0 failing; `npm run lint` clean; `node scripts/smoke_low_risk.js` 11/11.
- [x] Phase 2 measured-premise gate: N/A — verbatim move, no new measured premise (rationale recorded in `phase1_extraction.md`).

## Phase 3 — Guard-discipline continuity check

- [x] AC-4: `test/unit/injected_scope_collision.test.js` — 5/5.
- [x] AC-5: `test/unit/dead_exports.test.js` (9/9) + `scripts/audit_dead_exports.js` (0 dead) + `scripts/check_dead_exports.js` (0 violations).
- [x] AC-6: `test/unit/scripts_hygiene.test.js` — 18/18; `scripts/check_scripts_hygiene.js` OK.
- [x] AC-7: `npm run lint` clean + `node scripts/smoke_low_risk.js` 11/11.
- [x] Full unit suite: run to completion and record the result — **2262 passing / 23 failing**, and the 23 are NOT regressions from this extraction (identical 23 with the boot / print-style changes stashed). The two pre-existing "Ability Summary CSS Injection" failures were harness-contract debt on a different surface and are now green, narrowed to the shared harness (`debt_harness.js` boot order + `__DDB_TEST_MODE__` + an awaited `Boot.boot()`); the remaining 23 sit on border-assets/styles, sidebar styles, the activation-overlay contract, print-surface extraction and the vendored overlay. Record: `phase3_full_suite.md`.

## Phase 4 — Checkpoint + frontier review + 3-consultant verification

- [x] Checkpoint commit: commit the Phase 1 product diff (the five product changes) as the phase checkpoint; the track folder stays unversioned working state.
- [x] GATE 3 — frontier execution review: write `phase1_execution_review.md` (what was attempted / original requirement + spec / what was actually achieved, with gate commands and exit codes), and have a frontier-grade reviewer confirm the SPEC INTENT is satisfied, naming evidence per AC.
- [x] 3-consultant phase verification: three charters (intent-and-mission; preparation-for-further-phases; alignment-with-declared-patterns), each consultant RUNNING the phase's own verification path and reporting what it observed with exit codes — artifacts `<phase>_consultant_verification_<charter>.md`. At least two distinct providers when reachable; UNANIMOUS PASS required.
- [x] Record the frontier-review and 3-consultant exchanges with per-suggestion dispositions. (All three consultants PASS with exit code 0; no suggestions raised; dispositions: N/A — unanimous pass.)

## Phase 5 — Register, seal, hand to the user

- [x] Flip the phase boxes `[x]` in this `plan.md` and update `index.md`, `metadata.json`, and `conductor/tracks.md` to the completed status.
- [x] Seal the track's acceptance criteria: `python housekeeping_guard.py seal --track refactor_surface_20261101` (criterion hashes into `metadata.json`; guard then reports CRITERION CHANGED/REMOVED on drift) — **SEALED 2026-11-02T02:48:53Z**.
- [x] GATE-4 intent reconciliation: per-AC table in `final_report.md` with status + evidence pointer; record `GATE-4: PASS` in the registry status line at archive time.
- [x] Hand to the user with the closure line: `**Landed as:** 14403c4` (Phase 1 extraction committed; Phases 2-4 complete; Phase 5 sealed and delivered).
