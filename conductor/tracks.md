# Conductor Track Registry

> This registry lists every active and archived conductor track in this repo.
> Archival target for completed tracks: `conductor/archive/<track>/`.

## Active

### orchestrator_backlog_sweep_20261101 — ...

### ux_feature_fleet_20261029 — ...

### zero_click_preview_improvement_20261103 — Zero-click preview gate improvement: raise preview success rate from 94% to 95%+ (UX scoring matrix)

- **Created**: 2026-11-03
- **Status**: [x] phase0-complete — Nomination via OSD DONE (2026-11-03). Cluster A (representative-sheet coverage + defect inventory) ADOPTED; B (print-defect remediation) NOT ADMITTED for Phase 1/expected Phase-2 body, C (default-state tuning) deferred+demoted, D (gate instrumentation) subsumed into A. Nomination record: `phase0_nomination.md`; record in `deliberation/`. Premise corrections recorded: the narrative 94% is reproduced by NO artifact on disk (`evidence_current.json` carries 0.886, disclaimed in its own note as an SC-A2 proxy), and the 84 cap is NOT binding on the current evidence (raw 83.92 − 6 = 77.92), so the ceiling lift is conditional on the criterion tracks. phase1-pending.
- **Owner**: agent session (Phase 0 OSD completed 2026-11-03)
- **Analysis**: `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json`
- **Track folder**: `conductor/tracks/zero_click_preview_improvement_20261103/` (metadata.json, spec.md, plan.md, phase0_nomination.md, deliberation/)
- **Target**: Zero-click preview success rate ≥ 95% → gate cap 100 (evidence artifact carries 0.886 → cap 84 today); reproducible evidence, not assertion; no regressions.

### accessibility_improvement_20261103 — Accessibility improvement: raise criterion from 75 to 90+ (UX scoring matrix)

- **Created**: 2026-11-03
- **Status**: [x] phase5-complete — Phase 0: Cluster A (ARIA remediation) adopted via OSD; B/C/D dispositions recorded. Phase 1: in-place ARIA patch across js/main.js (addRobustButton, 10 button types), js/controls.js (makeActionBtn, tray heads, templates/chrome/filter/turn-off buttons), js/context_menu.js (createMenuTrigger), js/modals.js (modal OK buttons); 9 new accessibility regression tests in test/unit/accessibility/aria_labels.test.js, all passing. Phase 2: N/A. Phase 3: guard-discipline all green — injected-scope 5/5, dead-exports 9/9 + 0 dead + 0 violations, scripts hygiene 26/26, full unit suite 432 passing 0 failing, lint clean, smoke 11/11. Phase 4: GATE-4 PASS (frontier review + 3-consultant verification). Phase 5: sealed 2026-11-03, final_report.md written. AC-2/AC-3/AC-4 closed; AC-1 (criterion >= 90) DEFERRED — evidence file holds 62 and ARIA closure does not move the accessibility-mapped cells (SC-H3 1.0; others 3-4); AC-1 requires a broader accessibility re-score (contrast track + possibly focus/names-stays residual), not this work alone. See final_report.md.
- **Owner**: agent session (to be assigned)
- **Analysis**: `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json`
- **Track folder**: `conductor/tracks/accessibility_improvement_20261103/` (metadata.json, spec.md, plan.md, phase0_nomination.md, phase1_extraction.md, phase3_full_suite.md, final_report.md)
- **Target**: Accessibility criterion ≥ 90 on UX scoring matrix; core-flow accessibility gate PASS; no regressions. (AC-1 deferred — see above; AC-2/AC-3/AC-4 closed.)

### ai_arrange_improvement_20261103 — AI Arrange improvement: raise criterion from 78 to 90+ (UX scoring matrix)

- **Created**: 2026-11-03
- **Status**: [ ] phase0-pending — Nomination via OSD required (preview/override, undo granularity, explanation, or confidence scoring cluster)
- **Owner**: agent session (to be assigned)
- **Analysis**: `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json`
- **Track folder**: `conductor/tracks/ai_arrange_improvement_20261103/` (metadata.json, spec.md, plan.md)
- **Target**: AI Arrange criterion ≥ 90; existing certs (ai_layout_schema 142, byok_arrange_roundtrip 6) stay green; no regressions.

### direct_manipulation_improvement_20261103 — Direct Manipulation improvement: raise criterion from 80 to 90+ (UX scoring matrix)

- **Created**: 2026-11-03
- **Status**: [ ] phase0-pending — Nomination via OSD required (initiation threshold, drop targeting, visual feedback, or keyboard alternative cluster)
- **Owner**: agent session (to be assigned)
- **Analysis**: `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json`
- **Track folder**: `conductor/tracks/direct_manipulation_improvement_20261103/` (metadata.json, spec.md, plan.md)
- **Target**: Direct Manipulation criterion ≥ 90; existing certs (dnd 33, controls_panel 63) stay green; no regressions.

### sidebar_controls_improvement_20261103 — Sidebar Controls improvement: raise criterion from 82 to 90+ (UX scoring matrix)

- **Created**: 2026-11-03
- **Status**: [ ] phase0-pending — Nomination via OSD required (density/disclosure, grouping, discoverability, or responsive behavior cluster)
- **Owner**: agent session (to be assigned)
- **Analysis**: `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json`
- **Track folder**: `conductor/tracks/sidebar_controls_improvement_20261103/` (metadata.json, spec.md, plan.md)
- **Target**: Sidebar Control Quality criterion ≥ 90; existing certs (controls_panel 63, properties_panel 38) stay green; no regressions.

## Archived

### refactor_surface_20261101 — Refactoring analysis of the post-maintenance-refactor surface (c5caf02..HEAD)

- **Created**: 2026-11-01
- **Status**: [x] phase5-complete — Phase 0 nomination complete (boot/restore orchestration cluster, `window.Boot.boot()` seam); Phase 1 extraction landed and green (checkpoint commit `14403c4`); Phase 2 N/A; Phase 3 guard-discipline complete (AC-4 5/5, AC-5 9/9+0 dead+0 violations, AC-6 18/18, AC-7 lint+smoke 11/11); Phase 4 complete — frontier review PASS, 3-consultant verification UNANIMOUS PASS (intent-and-mission, preparation-for-further-phases, alignment-with-declared-patterns — all exit code 0); Phase 5 complete — sealed 2026-11-02T02:48:53Z, final_report.md written, GATE-4: PASS.
- **Owner**: agent session (refactor-analysis skill → conductor-protocol)
- **Analysis**: `conductor/refactor_analysis_20261101.md`
- **Track folder**: `conductor/archive/refactor_surface_20261101/` (index.md, metadata.json, spec.md, plan.md, phase0_nomination.md, phase1_extraction.md, phase1_execution_review.md, phase1_consultant_verification_*.md, final_report.md)
- **Scope**: the application surface built after the last maintenance-refactor finalizer (`c5caf02` = `runtime_perf_maintenance_20261017` close-out) through HEAD (`40737ca` = BEYOND-11 high-contrast phase dispatch). 62 commits; no vendor/node_modules/artifacts in scope.
- **Findings carry-over**: the analysis rates the range net-positive (extensibility, testability, debt-fencing, standardization all 👍; performance ⚠️ because the range is not a perf axis). The single most actionable remaining item is `js/main.js` still being the monolith; the range added seams and delegation but did not extract the next dominants.
- **Deliberation**: declared `not_carried` at creation (metadata.json) — Phase 0 nomination was a single-answer decision (only one defensible cluster nominated). Under the OSD rule a genuinely single-answer track records `"not carried as a candidate"` with its reason rather than padding a straw rival. Decision point that would trigger a real deliberation: future Phase 0 nomination if more than one defensible cluster is nominated.
- **Phase 1 extraction**: **complete** — `js/boot.js` extracted (boot/restore orchestration cluster, `window.Boot.boot()` seam beside the `window.Persistence` / `window.LayoutScan` / `window.LayoutApply` family), `js/main.js` edited to delegate, `js/background.js` + `test/unit/encapsulation_debt/debt_harness.js` edited to carry `js/boot.js` in the same position, `test/unit/dead_exports.test.js` updated. Phase 1 proof: `test/unit/boot_module.test.js` (13/13). Combined Phase 1 gate: `node_modules/.bin/mocha --timeout 20000 test/unit/boot_module.test.js test/unit/module_split_guard.test.js` → 19 passing, 0 failing. Checkpoint commit: `14403c4`.
- **Phase 2**: **N/A** — the extraction moves existing code verbatim and does not rest on a new measured premise (confirmed in `phase1_extraction.md`).
- **Phase 3**: **complete** — guard-discipline continuity check: AC-4 (`test/unit/injected_scope_collision.test.js` 5/5), AC-5 (dead-export tripod 9/9 + `scripts/audit_dead_exports.js` 0 dead + `scripts/check_dead_exports.js` 0 violations), AC-6 (`test/unit/scripts_hygiene.test.js` 18/18 + `scripts/check_scripts_hygiene.js` OK), AC-7 (`npm run lint` clean + `node scripts/smoke_low_risk.js` 11/11) — all green. The full unit suite ran to completion: **2262 passing / 23 failing**, and the 23 are NOT regressions (the same 23 fail with this track's boot / print-style changes out of the tree). The two `Ability Summary CSS Injection` failures were harness-contract debt and are now green — see `phase3_full_suite.md`.
- **Phase 4**: **complete** — checkpoint commit `14403c4`; frontier review `phase1_execution_review.md` PASS; 3-consultant verification UNANIMOUS PASS — `phase1_consultant_verification_intent-and-mission.md` (exit 0), `phase1_consultant_verification_preparation-for-further-phases.md` (exit 0), `phase1_consultant_verification_alignment-with-declared-patterns.md` (exit 0).
- **Phase 5**: **complete** — sealed 2026-11-02T02:48:53Z, `final_report.md` written, GATE-4: PASS.

**Next step after this update**: none — track complete, sealed, and archived.

**Landed as:** `14403c4` — Phase 1 extraction committed; Phases 2-5 complete; GATE-4: PASS.