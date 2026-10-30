# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (2026-10-29, e2e_feature_inventory_minimax_20261029 — reusable full-inventory video-certification skill)
- **A reusable skill for running the whole e2e feature inventory with full-video evidence and
  MiniMax certification: `vendor/.reasonix/skills/e2e-feature-inventory-minimax/SKILL.md`**
  (declared local in `governance.yaml`, discovered via `[skills] paths`). Distilled from track
  `e2e_feature_inventory_minimax_20261029` (commit `19a4552`): drive all 82 `test/browser_e2e`
  specs (432 tests) against the unpacked MV3 extension, capture a FULL video of every suite's
  browser page, then certify each of the 18 fleet features by sending its complete video to
  MiniMax-3.1-Flash through the OFFICIAL MiniMax API as the single certifier seat, with the
  requested id "minimax 3.1 flash" pinned to the real API model name at run time. Because the
  two driver helpers are gitignored project-authored harness helpers (per the house convention),
  THIS changelog entry is their only durable record — including their measured corrections:
  **`scripts/e2e_inventory_runner.js`** — sequential, resume-safe mocha driver that groups each
  suite to its fleet feature via `ux_feature_fleet_20261029/units.json`, runs each spec in a child
  process at the `npm run test:e2e` timeout (900 s), reads the mocha JSON report from a FILE
  (`--reporter-option output=`, not stdout — a spec's console output corrupts stdout-JSON,
  measured 2026-10-29), keeps the suite's representative `.webm` at a stable path under
  `<outdir>/evidence/<feature>/`, and appends one `progress.jsonl` row per suite
  (`{suite, feature, passing, failing, pending, video, video_missing, video_status, video_bytes,
  pages_captured, ts}`). Two MEASURED corrections landed in the same session after the first run
  was interrupted: **(a)** the video picker was `readdirSync(...)[0]`, i.e. arbitrary directory
  order, while one suite boots one page per case — so all 9 suites that had captured a video were
  storing an unrepresentative page
  (`icons_privacy_surface` kept 176 KB with a 2681 KB page available; `byok_settings_storage`
  181 KB vs 3517 KB), which would have certified a blank tab; it is now SIZE-ORDERED and the
  chosen size plus the page count go on the row so the choice is auditable. **(b)** `--resume`
  keyed on the suite NAME alone, which froze the 20 instrumentation-era video gaps forever and
  would have converted a capture bug into a permanent AC-2 failure; the resume set is now built
  from the LATEST row per suite and counts a suite done only when it ran (`failing >= 0`), produced
  a video, AND recorded its byte size — the last term is what makes the 7 pre-fix rows (which name a
  video whose representativeness nobody can show) retry too, so a gap or a stale pick can never
  harden into a permanent AC-2 failure. And **`scripts/e2e_video_preload.js`** — a mocha
  `--require` preload that instruments every page the harness's own launcher opens, so capture
  exists WITHOUT editing the tracked harness (`test/browser_e2e/_helpers/dom.js` stays
  read-only). Its mechanism is NOT the context-level `video: { dir }` option: MEASURED on
  Playwright 1.63.0 that option silently produces no file (the server-side recorder never starts —
  `DEBUG=PW:video*` emits nothing even for a plain `newContext({video})`). The working mechanism is
  the page-level screencast (`page.screencast.start({path, size})` / `.stop()`), and the FLUSH
  ORDER is the whole file: `page.on("close", stop)` fails because by the time that event fires the
  CDP session is gone (`screencast.stop: Target page, context or browser has been closed`, no
  `.webm` written — reproduced four ways), so the preload wraps `page.close()` and `context.close()`
  to `await stop()` FIRST. A 615,169-byte `.webm` of the live demo sheet was reproduced through
  exactly that path. The preload is process-scoped and inert when `E2E_VIDEO_DIR` is unset, so a
  plain `npm run test:e2e` is unaffected; capture works headless (the harness boots `--headless=new`).
  To run the procedure:
  `node scripts/e2e_inventory_runner.js --outdir <track>/execution [--resume] [--suite <file>]`.
  Smoke-tested twice: `icons_privacy_surface.spec.js` → 3/3 passing, 2,637,258-byte video across 2
  pages; `absolute_positioning.spec.js` → 4/4 passing but `video_missing`, which is
  the gap class fix (b) above now retries instead of skipping.

### Added (2026-10-26, track ux_quick_wins_20261025 — Phases 1-3 of the six approved e2e-matrix gaps)
- **Per-layer three-state visibility (AC-1 / BEYOND-9).** Each layer row now carries an explicit
  Print only / Both / Screen only strip (`js/dom/layer_manager.js`), which REPLACES nothing and
  renames nothing: the printer and eye buttons keep their own meanings, and the strip reads and
  writes the same two persisted flags (`isHidden`, `isDisabledOnPrint`) the panel already owned —
  so the storage schema is unchanged (operator decision #4) and a legacy record that sets BOTH
  flags still reads honestly. `Print only` is the mode that needed new code: the on-screen hide is
  an inline `display:none`, so `js/print_styles.js` now emits a `!important` print rule that undoes
  it, keyed on `data-print-only`. The strip is a separate LINE rather than three more segments in
  the row because the row is measurably full (the 248px panel left the sections label 0px at 3x28px
  segments); the record is `temp/scratch/ac1_measure_record.txt` and the rejected shapes are in the
  track's `deliberation/evaluation_matrix.md`.
- **A retryable AI refusal now offers its retry (AC-4 / BEYOND-13).** The worker's
  `retryable`/`retryAfterSeconds` flags were already computed and dropped on the wire
  (`js/background.js` kept only the latter); they now reach `js/ai_arrange.js`, which offers one
  second dial with the SAME instruction, capabilities and target — the user does not retype what
  they asked. Covered by `byok_relay.spec.js`'s network-failure injection and its recovery case.
- **Reload persistence is now proven for every customization type, not just the credential
  (AC-5 / BEYOND-14).** The BYOK persistence spec covered only the API key. A new sibling
  `test/browser_e2e/byok_settings_persistence_types.spec.js` drives the product's OWN seams for the
  four types the criterion names — `__DDBStorage.saveCustomShape` / `saveCustomBorder`, the layer
  manager's `setLayerMode`, and `CatalogService.applyTemplate` — and asserts the read-back after a
  real `page.reload()` + reinject (5/5 passing). It also pins the undo stack's documented
  SESSION scope (`js/persistence.js:138-152`): depth ≥1 before the reload, 0 after, with
  `announceBootRestore`'s "Restored your saved layout." toast as the notification that the reload
  was not silent. No product gap was found — all four types already persisted correctly.
- **Keyboard layer reorder + reorder polish (AC-6 / BEYOND-15, Phase 5).** The layer panel's rows
  now reorder with the arrow keys: a `keydown` live-region listener delegates through
  `closest("[data-layer-id]")` and maps Up/Down/Home/End to `reorderShapeLayers` — the SAME
  mutation path a drag drop takes, so a keyboard move is drag-equivalent, and both surfaces derive
  their insertion index from the same `getRowAfterGroup` midpoint geometry (they cannot disagree
  about where a move lands). Binding on the row container covers both focus handles
  (`.be-layer-name`'s `tabindex="0"` and the row itself). The AC-6 polish clause ships as
  transform-safe opacity/background transitions in `js/ui_theme.js` (`.be-layer-group`, 140ms) —
  a FLIP transform was honestly rejected because the restack's panel rebuild detaches the old row
  before a translate can be measured against it; animating only opacity/background keeps the panel
  60fps (no layout-triggering property, so a panel that repaints on every keystroke does not force
  a reflow per frame). The drag-over drop-marker precondition (3px gold `be-layer-drop-marker` band,
  midpoint targeting) was verified as already-shipped rather than authored. Delivered as a dedicated
  `test/browser_e2e/layer_reorder_keyboard.spec.js` (7/7 passing) rather than growing
  `byok_arrange_roundtrip.spec.js`, whose subject is the AI-arrange round-trip. For the honest
  record: the spec's two failing cases were test-baseline bugs (each derived its "before" order from
  a `"report"`-mode probe taken AFTER the press — and that mode sets `orderAfter = orderBefore` by
  construction), and one helper referenced a function that exists nowhere in the harness; fixes to
  the SPEC are in this commit, none to product behavior.
### Fixed (2026-10-28 — the browser gate's pending expectation was ~3 weeks stale, so the gate could not go green at all)
- **`test/browser_e2e/spec_pending.json` re-derived from a REAL run, and the gate is green for the
  first time since 2026-09-22.** The map still recorded `case_count: 95` read from the
  `dnde2e-baseline-clean.json` run of 2026-09-13, while the suite has grown since (the AC-2
  refinement block and the 62-corpus gallery renders in `byok_border_gallery.spec.js`, the
  `byok_relay` network-failure cases, `layer_print_visibility`'s three-state cases). MEASURED: every
  `node scripts/browser_gate.js` run AFTER the collection manifest was fixed (`31c4603`) failed on
  `PENDING CHANGED: byok_border_gallery.spec.js expected 0, actual 62` — a real 157-vs-95 pending
  mismatch, not a flaky case. The map is now generated by the tool that is supposed to generate it
  (`node scripts/gen_spec_inventory.js --pending <results.json>`), from
  `temp/scratch/browser_gate_real_run_20261028.json` — the four shard reports merged by
  `temp/scratch/merge_shard_reports.js`, which also asserts the merged pending count equals the
  merged `stats.pending` (157 = 157) so the map cannot be built from a mis-read reporter.
  `gen_spec_inventory.js`'s own self-check then confirmed it against the run's stats. The diff is
  additive plus one count correction: `case_count` 95 → 157, `by_spec_file` gains
  `byok_border_gallery.spec.js` (62), and the eleven previously-recorded capture harnesses keep
  their counts unchanged.
- **The green run that proves it:** `node scripts/browser_gate.js --shards 4` →
  `PASS (sharded:4): 270 passing / 157 pending / 0 failing, 1988s, collection ok, pending ok`,
  `green: true`, `exit_code: 0`, artifact `temp/browser_gate/artifact.json` (collection 81/81 spec
  files, 427/427 tests; host canary 0). Before the regen the SAME command read
  `FAIL … pending mismatch` with 2332s and zero failures — i.e. the only red was the stale map.
  Note for the record: the merge step is a scratch script, deliberately NOT a committed tool, because
  the gate already regenerates its map from a `--reporter json` run; a committed merge step would be
  a second, drifting reader of mocha's reporter shape.

### Fixed (2026-10-16, track runtime_perf_20261015 RE-EXECUTED — three defects the re-run found, and one it refused to inherit)
- **The track was re-executed because its BUILDER hung after committing, not because its work failed.**
  `temp/idlegate/idlegate-audit.log` shows the spawn at `2026-10-15T20:55:40Z` (pid 3920), then
  `2026-10-16T06:10:01Z boot marker past grace: escalate priority=runtime-perf` and a re-fire at
  `06:13:09Z` (pid 17388). The sealed work (`temp/idlegate/seal-state.json` → `b427321`, kept by
  `refs/idlegate/keep/20261015-205540-17140-wt`) was on NO branch and the re-run's base (`19549c6`) had
  no `scripts/perf/` at all. This session ADOPTED it (`git cherry-pick fd5631a b427321`) rather than
  re-authoring a deliverable whose instruments, validator and suite behave as documented, then re-ran
  every phase against it: the dossier's baseline reproduced EXACTLY (855 rows / 852 latency-bearing,
  p50 16.733, p95 54.047, max 465.483; glm 8.766/424.672; deepseek 334.218/356.828; `unknown` 1093 over
  its own window; 865/865 relay rows `producer=reasonix_proxy`), and the validation sample reproduced
  its counts exactly (120 terminal, 100 % `duration_ms`, 7 timeouts, 4 cancels, 5 errors, 0
  unknown-model rows).
- **An interrupted call wrote NO terminal telemetry at all — fixed.** In the helper as delivered, a
  SIGINT delivered to the CALLING thread (how a headless CLI gate's call most often ends) left the
  store holding 1 `model_call_started` and 0 terminal rows — and this track's OWN validator then FAILED
  that store ("`model_call_started` with NO terminal event"), so AC-1's "a cancelled call is
  terminalised rather than omitted" was violated on the interrupt path. `call_model` now terminalises
  the interrupted call as `status=cancelled`, `cancel_flag=true`, `error_class=KeyboardInterrupt` and
  RE-RAISES it. Measured in both directions (probe drives the real helper with a timed SIGINT, then the
  real validator reads the store): delivered helper → 1 started / 0 terminal, validator exit 1; fixed
  helper → 1 started / 1 terminal (`cancelled`), validator exit 0.
- **`CancelToken`'s "exactly once" was a claim, not a property — fixed.** Its `register_closer`
  docstring promised delivery "under the lock" and there was no lock: on the delivered code two
  registrations produced THREE closer calls (a repeated `set()` re-closed every handle; a registration
  racing `set()` could be closed by both sides). Ownership of the closer list is now TRANSFERRED under
  a lock, so each closer fires exactly once. Pinned by test, falsified both directions.
- **The tracked report cited the worktree it was generated in — fixed.** `runtime-perf-report.{md,json}`
  carried `.../worktrees/20261015-205540-17140-wt/temp/perf/model_calls.jsonl` — a disposable path that
  names nothing on the next run. Store paths inside the checkout are now spelled relative to the
  repository root (`temp/perf/model_calls.jsonl`) and both report artifacts were regenerated.
- **`check_scripts_hygiene.js` reported the new `scripts/perf/` DIRECTORY as an undocumented entry —
  fixed.** All 12 of its files carry rows, but the advisory arm compared the direct children of
  `scripts/` against recursive tracked paths, so no directory could ever satisfy it (the false advisory
  was visible on every run since this track added the directory). Directories are skipped now; the
  untracked-FILE arm still fires, pinned by a new fixture case.
- **Three record corrections; no criterion, threshold, cap or verdict was touched.** (1) The baseline's
  reproduction command is now runnable from the checkout the track runs in (`$RELAY_CHECKOUT` — the relay
  store is untracked and lives in the project checkout, and a builder worktree's `temp/` holds only
  `perf/` and `scratch/`). (2) "Five tracked scripts dial a model directly" is corrected to the measured
  FOUR direct sites + one INDIRECT + two untracked sites. (3) The report's blanket "no file under
  `vendor/` was read or written" is narrowed to its EVIDENCE set, because this project's own conductor
  record lives under `vendor/conductor/`. The dossier's telemetry figures are also re-dated as
  measurements of a growing store: 45,589 terminal rows on 2026-10-15 → **45,698** on 2026-10-16, with
  duplicate markers still 0 and the largest `(role, model, task_class, context_band)` bucket still
  **8,422**.
- **Verification (all in this session):** `npm run lint` green (border-SVG guard + scripts hygiene: 57
  judged / 66 rows, both directions, and the false `perf` advisory gone); `npx mocha
  test/unit/model_call_telemetry.test.js` **24 passing**; `test/unit/scripts_hygiene.test.js` **13
  passing**; `npm test` **1615 passing / 7 pending / 11 failing** against a MEASURED pre-change baseline
  of **1613 / 7 / 11** (the changes stashed, suite re-run) — the same three environmental suites in both
  runs (`byok_border_criteria_metrics` missing a `temp/visual_logs` fixture; `lint_config_not_vacuous`
  with no `node_modules/eslint` in a worktree; `vendored_overlay` with no overlay in a worktree), none of
  them this track's, and none of them newly failing. No product file changed (`js/**`, `manifest.json`
  untouched); no release.

### Added (2026-10-15, track runtime_perf_20261015 — the scripts area's model calls are bounded and observed)
- **The dossier's premise was measured before it was built on, and two of its four claims did not
  hold.** `temp/idlegate/runtime-perf/spec.md` (authored 2026-09-22T03:01:27Z by the P4 rung's own
  maintenance call, after nine dead builder attempts) attributes a severe relay tail latency to "the
  `scripts` area" — but all 45,589 terminal model-call rows in `temp/modelstack/telemetry.jsonl` are
  `producer=reasonix_proxy` / `call_origin=relay`, so no `scripts/` edit can move them (its
  `qwen3.8-flash` row, 852 calls / p50 16.7 / p95 54.0 / max 465.5, is relay traffic); its
  "`scripts (7 files)`" scope repeats the blind-inventory defect `scripts_inventory_hygiene_20261014`
  already recorded against a 54-path measured surface; and its `unknown / n/a` row is not a missing
  measurement but the ABSENCE of a model-call event. AC-3's relay-side clause is therefore recorded
  NOT ACHIEVED rather than reinterpreted; the track's decision is CONDITIONAL PASS.
- **The real gap was the area's own traffic, and it is now bounded and observable.** Five tracked
  scripts dial model endpoints directly (`border_design_generator.js`, `byok_vision_gate.py`,
  `drag_ux_visual_gate.py`, `codex_text_leg.py`, and `byok_border_visual_seat.py` indirectly) and
  NONE of them emitted a terminal event anywhere; their only bound was a per-READ socket timeout —
  which does not bound a call — and `border_design_generator.js`'s `fetch` had no timeout at all.
  Delivered: `scripts/perf/model_call_telemetry.{py,js}` (one declared budget source,
  `scripts/perf/budgets.json`, read by BOTH runtimes; a TOTAL deadline enforced by a supervisor so a
  late response is discarded; a session cap separate from the per-attempt cap; a real cancellation
  signal; `started`/`progress_tick`/`terminal` telemetry in `temp/perf/model_calls.jsonl`; a hashed,
  redacted fingerprint), wired at all four direct sites without touching their payload/parse logic.
- **Evidence instruments, not prose.** `scripts/perf/runtime_perf_report.js` re-derives the dossier's
  relay baseline by a NAMED command and window (nearest-rank percentiles — the convention that
  reproduces its numbers unchanged) and emits `runtime-perf-report.{md,json}` with the AC-1..AC-6
  table; `scripts/perf/validate_model_call_telemetry.js` FAILS CLOSED on an empty store and refuses a
  terminal record with no `duration_ms`, a bad status, a missing field, a double terminal, or an
  unterminated call. `test/unit/model_call_telemetry.test.js` (23 cases) drives both helpers against
  local synthetic transports — abort-at-budget, terminal-on-timeout, cancel-does-not-hang, session
  cap, progress ticks, coalescing, budget parity across runtimes, and every validator arm in both
  directions. Validation sample: 120 terminal calls, 100 % `duration_ms` coverage, 7 timeouts,
  4 cancels, 5 errors, 0 unknown-model rows.
- **Named shortfalls, not silent ones.** Three wired sites carry a DECLARED cap override above the
  dossier's 210 s class cap (their own prior timeouts, kept because no seat-latency measurement
  exists to justify lowering them and a lower cap would turn arriving gate answers into failures) —
  each override states its reason in `budgets.json` and is printed in the report. One model-call site
  could not be reached at all: `scripts/muse_gate.py` is gitignored by name, so it is not part of the
  governed surface and is recorded as `not_wired: true` with its budget pre-declared (TECH_DEBT_SCRIPTS
  T-6) rather than counted as coverage.
- **`scripts/perf/` added to the scripts inventory** (12 rows, `TECH_DEBT_SCRIPTS.md` §3; the governed
  surface is now 66 files) plus a new finding F-8 and gap T-6 in that file. No product file changed:
  `js/**`, `manifest.json` and the browser suite are untouched, and this ships no release.

### Added (2026-10-15, track registry_backfill_20261015 — the 11 orphaned archive rows backfilled)
- **The guard's archive arm is clean again.** It had reported 11 archived track folders
  (2026-03..2026-05 era: archer_template_replication, the layer_* family, properties_panel,
  refactor_drag_handles, shape_layer_management, skill_box_splitter) named by NO registry
  row — rows never written, since these tracks predate the row->folder check by months.
  One honest row per folder was appended to `vendor/conductor/tracks.md` (registry bottom,
  oldest first), each citing the folder's own artifacts and stating its REAL box state:
  6 fully ticked; 5 with open boxes recorded as found (NO retro-ticking), with the
  shipped-surface evidence for their features noted (`.be-drag-handle` in `js/dnd.js`,
  `shapeLayers` in `js/dom/layer_manager.js`, `splitSkillsBox` at `js/main.js:2651`,
  `js/properties_panel.js`). Deliberation: required — 3 candidates (backfill rows ADOPTED;
  drop plan.md REJECTED — all 11 are real tracks, deletion would be signal suppression;
  do-nothing REJECTED), matrix + ledger; guard: advisories 11 → 0, debt index 0, both
  roots OK. No product file, archived folder, or guard code touched.

### Added (2026-10-14, leg B — the certified 03-thornvine-lite border embedded in both premade templates)
- **The amended Fork 1 executed.** Leg B's original premise was measured FALSE (verdict-identity
  needs ≥44,194 B against the 16,000-char trust-root cap; three instruments agree) and the
  operator ruled the amended Fork 1: certify a lighter derivative as a NEW design and embed
  THAT — never a 9/10 artifact under the v45 name.
- **Certification campaign (`03-thornvine-lite`)**: `temp/scratch/tv_v45_k10.svg` (13,723 B,
  uniform k=10) certified 10/10 on its own derived instrument
  (`temp/scratch/thornvine_lite_acceptance_gate.js`; G1–G9 unchanged, G10 `CURV_HARD`
  recalibrated 0.20 → 0.08 with measured justification — below the artifact's measured window
  minimum 0.088, the parent gate's own invariant; everything else byte-identical). The absolute
  C6 clause was FALSIFIED and retired: the certified parent itself fails it at the certification
  presentation (`deliberation/c6_falsification_record.md`, parent + k=3 both NOT MET), so
  AC-B3' binds on **C6-delta** ("no visible decimation artifact beyond the parent's own
  rendering at identical presentation") — two independent strict-muse vision sessions on the
  final k=10 collage: MET + P1 + P2 (`tv_lite_vision_s10_k10_delta.txt`,
  `tv_lite_vision_s13_k10_delta2.txt`).
- **The embed**: `borderSvg` stamped on EXACTLY the 13 basic + 10 archer sections whose
  `borderStyle` is null/`no-border` (the B-3 disposition: borderStyle fields stay — the AI
  border overrides while present, clearing it restores the class border). Every other byte of
  both templates is identical to dd66ad9 (`temp/scratch/verify_embed.js` → AC-B1 IDENTITY:
  PASS); every embedded blob passes the REAL trust root (`js/ai_border.js` sanitize) and is
  ≤ MAX_SVG_CHARS.
- **New suite** `test/unit/template_border_svg.test.js` (8 passing) pins the stamping, the
  trust-root + cap path, and byte-identity against the certification fixture
  `test/fixtures/thornvine_lite_border.svg`. Full unit+e2e+manifest suite 1652 passing / 0
  failing; overlap scan on the embedded templates → 0 overlaps; versions stay 1.6.0.
- **AC-B3 is recorded FAILED + superseded, not silently swapped** (plan.md AC block; the
  governing record is `deliberation/c6_falsification_record.md` + the disposition addendum in
  `temp/scratch/byok_template_tuning_scope_20261014.md`).

### Added (2026-10-14, track scripts_inventory_hygiene_20261014 — the scripts-area hygiene baseline)
- **`TECH_DEBT_SCRIPTS.md`** — the `scripts` area inventoried: 54 tracked files, each with
  purpose, invocation, runtime/deps, and touch-risk tier; the dossier's "7 files" count is
  recorded as unreconciled against the measured 53-file surface (the track adds the 54th).
- **`scripts/check_scripts_hygiene.js`** — wired into `npm run lint` (after
  `check_border_svg_injection.js`): compares `TECH_DEBT_SCRIPTS.md` against the tracked
  `scripts/` surface and fails when they disagree in either direction; a new script cannot
  arrive without a purpose header. README's lint line updated.
- **Headers on 23 existing scripts** — `#!/usr/bin/env node` (22) + `python3` fix (1) + one-line
  purpose comments on the 10 that opened with code; no behaviour change (suite green).

### Measured (2026-10-14, the owed operator input-budget re-measure — result: knob stays, no action)
- **`python scripts/input_budget_report.py` → OK.** Soft 150,000 stays ABOVE the measured
  five-term floor, which has FALLEN since the 2026-09-15 measurement: minimum post-fold size is
  now **91,066** (active_turn 45,009 from 2,337 fold-chains over 44,026 telemetry rows;
  digest 4,852 p95; kept_user_turns 8,192; prefix 245 p1; tail 32,768) vs the ~95,080–192,151
  range the 2026-09-15 issue recorded — the p90-heavy active-turn profile that motivated the
  200k consideration has not materialized in the week of live turns. The 2026-09-16 operator
  decision (keep soft = 150,000, do NOT bump) is re-attested on current data; tightening toward
  the 50k ideal stays off the table while 84.2% of calls exceed it (input mean 179,143,
  p90 457,724, max 1,084,278 — folding still lands above the ideal for real turns, but the
  floor no longer threatens the knob). This closes the 2026-09-15 "re-measure by 2026-09-22"
  follow-up from `vendor/AGENTS.md`; no config change.

### Attempted (2026-10-13, leg 8 — v27 = muse iter-26 Q1(a)/Q2 LITERAL + v28 = muse iter-27's mechanisms; best artifact v27c 6/10; NOT shipped)
- **The mandatory 6-loop escape-valve consult RAN (muse iter-27, 2026-10-13)** after 8
  tracked gate iterations on the same target (v23..v27c): complete brief with every
  cumulative approach + measured result
  (`temp/scratch/thornvine_muse_iter27_brief.md`), answer
  (`temp/scratch/thornvine_muse_iter27_answer.txt`, 11,725 chars). His named mechanism:
  wave-start slope-zero isolation (u=0 is a swell extremum; the relief stands alone
  there and its period-3 regularity fires the G10 3-agree trigger). His prescriptions:
  Q1 phi_e=pi/2 + single pi slip, Q2 biarc fillet with interior inflection, Q3
  greedy+slide placement on the displaced ring.
- **v27 sequence measured (gate, exact):** v27 7/10 (ramp missed the fillet's own
  K3*L_f accumulation) -> v27b 7/10 (accumulation absorbed + unwrap; normal-direction
  displacement — hard flatWindows 94-129 -> **0**, p10 0.4; muse F1 remediated) ->
  v27c 6/10 (right/left 5 periods took **G7 to 0 fails**; roots re-solved on the
  displaced ring; fillets 36 -> 140 bez: null). Persistent: G10 regularity triggers
  (16) at wave-start corner windows, firing with fillet relief ON **and** OFF
  (probe6 A/B) — the dome/dive cubic's own decay forms the 4-alternating run.
- **v28 = muse iter-27 Q1/Q3 implemented LITERALLY — measured WORSE (G2 8 / G7 10 /
  G10 16).** Both falsified on this ring: the 3-agree run COMPLETES before the s=9.0
  slip lands (measured agreeing swings 1.2/1.8/1.9 at proj ~8.6-11.7), the slip's
  mid-wave phase rate creates new G7 extrema (false crest 28.1; s2 troughs 4.0-4.3),
  and greedy+slide produced a 570.8u coverage hole (cost 34.4k vs the annealer's
  17.8 — it cannot cross the legal deserts along the fillet arcs).
- **Pushback recorded per the challenge protocol:** muse's falsification relabels the
  G7 gap-44s as sprout gaps; the gate's fail lines read verbatim `along-vine extremum
  gap 43 outside 22.5-42.5` and the periods lever measured G7 -> 0 fails twice — the
  lever stays, his relabel is not adopted.
- **Terminal state:** best artifact v27c (6/10: G2 5 / G4 1 / G9 2 / G10 16; G1/G3/G5/
  G6/G7/G8 PASS), `temp/scratch/tv_constructed_tile_v27.svg`. muse's own verdict: the
  criterion set (G10 REGULARITY ban x monotone-relief handoff x G7 band x G2 gaps) is
  jointly unsatisfiable for this constructor class, and his Option A relaxation is now
  also measured-worse. Remaining paths are OPERATOR-OWNED: Option B (sharpen the G10
  3-agree trigger: amplitude >= 2.0 AND period stddev < 0.3 — the hand reference has
  varied sprout sizes, not strict period-3), Option C (HALF_PERIOD upper 42.5 -> 45.0),
  or fund a new constructor class. Full record:
  `temp/scratch/thornvine_leg8_record_20261013.md`.

### Attempted (2026-10-12, leg 7 — v26 constructor executed after the interrupted session; first honest v26 measurement 7/10; NOT shipped)
- **The interrupted session (gateway restart ~12:59) resumed at its own recorded state and
  the cancelled work was re-issued.** The killed turn's tv_v26.py run had already FAILED at
  12:35 (task snapshot `state=failed, job_failed`); its hang probes died mid-diagnosis with
  no roots JSON / v26 SVG / gate run produced. Full record:
  `temp/scratch/thornvine_leg7_record_20261012.md`.
- **Three constructor defects fixed on the way to the first honest v26 measurement:**
  (1) `resample_relief` infinite loop — the emit branch re-fired from the segment start
  whenever `seg >= spacing` (measured hang: 3,000,001 iterations at strand-A vertex 37,
  seg 0.502 > 0.5; zero-length segs ruled out); fixed to v12's proven emit-within-segment
  structure (6582/6472 points at 0.002 s per strand, arc-true). (2) v26's `bez()` dropped
  the `+ t**3 * p1[1]` y-endpoint term — every fillet endpoint collapsed toward y=0, the
  ring inflated 1309->3291 arc units with two 250-unit border jumps per corner, and the
  roots annealer was structurally blocked (cost floor ~876; 32 roots on a 3290-unit ring
  force mean arc gap ~103 > the 59-unit band). One term restored: ring 1409.7, solver/main
  rings verified identical (N=2820, max per-index deviation 0.000000), roots solved to
  cost 0 at seed 1. (3) Kind-assignment: the arc-order greedy ate both-ok roots into
  leaves first, starved the thorn pool (G9 pairs [3,4|3,4|4,4|3,4]) and skipped leaf-only
  roots whose missing positions widened two G2 gaps to 110.5/71; replaced with the
  capacity-preserving assignment (leaf-only -> thorn-only -> both-ok): G9 PASS 4|4 on all
  edges, oversized gaps gone (alongGaps 22.0-59.5).
- **Tracked gate on `tv_constructed_tile_v26.svg`: 7/10** (G1/G3/G4/G5/G6/G8 — disabled
  per muse iter-20, pass-with-flag — and G9 pass; G2/G7/G10 fail). Residuals root-caused to exact positions: G2 = one consecutive-diff
  3 < 4 (solver floor 3.75 vs the gate's GAP_DIFF 4.0); G7 = corner-crossing extremum
  gaps 43-47.5 > 42.5 (s1, every edge) + the s2 crest at depth 14.7 outside [1.5,8]
  (muse M4 exposure); G10 = fillet-envelope micro-ripple at proj ~8.7 (all four s1 edges)
  + 100 hard-flat windows on s1, worst sagitta 0.0 at s=292 (the fillet relief maximum
  cancels the dome's fall). The v26 sin^2 envelope + phase restart DEVIATES from muse
  iter-26's dispositioned Q1(a)/Q2 plan (per-edge phase + linear ramp + continuous
  handoff, NO envelope); the §6 measurements falsify the envelope shortcut — v27
  pre-registered in the record §8 implements muse's plan literally.
- Full exchange record: muse iter-26 (brief + answer, completed BEFORE the interruption)
  validated F1/F2/F3 and set the v26 contract; no 6-loop escape-valve boundary crossed
  this leg (§9 of the record).

### Fixed (2026-10-12 — the Codex lane's weekly supply from this project: the entry declares a trigger and the trigger is MEASURED; the relay restart is owed)
- **The lane-starvation card `temp/issues/ISSUE_codex_lane_builder_entry_has_no_trigger_so_the_lane_starves_20261011.md`
  is DONE on the declaration side.** The live `reasonix.toml` declares a SECOND `[[osd.builder]]`
  entry beside the untouched one-shot `self-audit` — `id = "dndbeyond-printenhance-weekly-doc-path-drift"`,
  `trigger = "weekly"` (`reasonix.toml:360-382`, both write flags explicit) — the card's own
  "shape 2". Verified with the framework's reader (`read_builder_entries`: state `declared`,
  `problems: []`) and minted through the producer with the pass clock PINNED: exactly one job per ISO
  week, idempotent on the week (`…weekly-doc-path-drift@2026-W42@2d8ed2bb…` → `job-88609833a81a5bf0`;
  a second pass and a later W42 read coalesce; W43 → `job-b25e92c4066e14dd`; W44 →
  `job-49947dd2d22462aa`), each carrying that entry's own objective and its own four acceptance
  criteria — no filler criterion ([CS-2]). The control still starves exactly as the card's §1
  measured: `self-audit` (`trigger = "declared"`) mints one job ever across W42/W43/W44.
- **NOT YET LOADED, and the missing step is a SERVICE action an operator owns:** the declaration is
  read at relay BOOT (`reasonix.toml:325`), and the running relay (PID 29440) booted
  `2026-10-10T21:16:11Z` — 33.7 h before the config's `2026-10-12T06:04:17Z` edit. Its own newest
  producer line (`2026-10-12T12:30:28Z`) still reads `of 1 candidate(s), already settled 1`, and the
  live store carries 0 rows for the weekly key. **Restart `reasonix_proxy.py --project
  dndbeyond-printenhance`**; nothing else is owed — the lane is enabled
  (`framework/osd/codex_lane.yaml:11`, `:269`), the tick defaults it on
  (`framework/osd/tick.py:124`), `codex-cli 0.157.0` and `~/.codex/auth.json` are present.
- **The week still reads short, honestly, and that is arithmetic rather than a defect.**
  `python framework/osd/lane_floor.py C:/luiscla27/projects/dndbeyond-printenhance` (2026-10-12,
  W42): `this_week_jobs: 0`, `min_lane_jobs: 5`, `verdict: codex_lane_underused`, `reason: "the lane
  ran 0 job(s) this ISO week against a floor of 5 — supply, not health: the feeds mint declared work
  or the floor cannot be met"`. One weekly objective is one job per week against a floor of five, so
  the shortfall is a SUPPLY question this declaration cannot answer alone: more REAL weekly
  objectives, or an operator ruling on the floor — never a job whose purpose is to spend ([CS-2]).
- **Reproduce** (this lane blocks `python -c`, so the commands live in the card's §6, not in one
  liners): `read_builder_entries` plus `producer.mint(now=…)` against a throwaway store for the
  weekly semantics and the control, `lane_floor.py` for the reading, and two greps over
  `temp/modelstack/telemetry.jsonl` for what the producer's fold sees. The card also carries the
  harness-side defeat measured on the way (its §8): the idle gate's issue close-out carry-back is
  dead for every builder child, whose own project's handoff
  (`telegram_orchestrator/temp/issues/ISSUE_idlegate_re_attempt_task_text_defeats_the_issue_carry_back_20261011.md`)
  is verified present and OPEN.

### Certified (2026-10-11 — the 8/10 corpus artwork bar: 10 of 11 certified MET)
- **2026-10-12 push ("Push on to 8/10 svg borders") — 01-gilded-frame re-drawn twice more on
  the Gemini seat (rounds 30/31), re-measured FAIL at the same family floor.** r30 is a new
  distinct blob (`60282ce4…`); r31 is a byte re-emission of r23's artwork (seven draws across
  two seats converge on it — the adopted prompt pins that geometry). Both measure
  `cornerDeltaMin` **14** (TL 20 / TR 26 / BL 14 / BR 18, coverage 0.963). Root cause now
  MEASURED: the prompt's declared "**diagonal 6 units**" diamonds (extent x6..12) clip the D1
  corner box (x12..20) derived from r5b's 8-unit diamonds; re-deriving the box from the
  declared geometry reads worse for every blob including r5b, so the frozen box is the correct
  scale. Corpus re-frozen at rounds 1..31 (11 canonical / 44 variants / 55 accepted, **54
  distinct** — the r23→r31 re-emission pinned in the corpus gate). The 8/10 tally is
  unchanged: **10 of 11 MET**. The remaining lever is operator-owned (a prompt amendment to
  8-unit diamonds, or a D1 box re-derivation ruling) — no criterion, threshold or prompt text
  was amended.
- **The 2026-10-11 operator ruling was executed** ("Aim a 8/10 on avg borders"): the corpus
  bar is the set average ≈ 8/10, operationalized as **9 of 11 canonical designs certified
  MET**; the escalated four (01/04/10/12) were regenerated on the **Gemini seat**
  (`gemini-3.8-flash`, official OpenAI-compatible host) and re-judged under the ORIGINAL
  instruments — no criterion, threshold or prompt text amended. **Outcome: 10/11 certified
  MET — the bar is MET.** 04-dragon-scale now PASSES the D2 binding metric on all four terms
  (the prior `LEFT stileStrokeP50Px 1 < 1.5` reads 14); 10-ink-brush and 12-knotwork are MET
  on the vision seat (criterion + AC-V1-c). 01-gilded-frame is FAIL on the binding metric:
  three DISTINCT accepted Gemini blobs (r24/r25/r27) all measure `cornerDeltaMin` 14 < 15 —
  a measured prompt-family floor one device px under the untouched threshold; the seat's MET
  is corroborating-only under D2. Full record:
  `vendor/conductor/archive/byok_border_prompt_adoption_20261006/certification_8_10_bar_20261011.md`
  (ruling: `operator_ruling_20261011.md` in the same directory).
- **Corpus re-frozen at rounds 1..27**: 11 canonical / 42 variants / 53 accepted blobs, all
  distinct; `freeze_border_corpus.js --check` byte-reproducible. All four escalated ids were
  accepted on their first Gemini sample (round 23); 01's three draws each survive as
  variants. `--provider gemini` added to `scripts/border_design_generator.js` (tooling-only;
  the NOUS default, the product parse path and the product prompt path are unchanged; the
  retired Gemini sampling params are never sent).
- **Layout pin updated for the 2026-10-11 unit advance** (unit `9377e009d43b` /
  framework `73c8f2ec970b`): the unit ships an advisory scaffold copy at
  `vendor/governance.yaml`; the framework gate resolves root-first and warns on the second
  declaration (`msf validate --all` PASS, 0 errors, MEASURED). `vendored_overlay.test.js`
  now enforces the invariant that matters — root declaration ENFORCED, unit copy ADVISORY —
  instead of asserting the vendor copy's absence.

### Fixed (2026-10-11 — YouTrack issue-authority go-live CLOSED; the last `msf validate --all` red is green)
- **The missing runbook unit `policy/youtrack-issue-authority` was delivered** via the
  framework's `init --adopt --vendored` (run from the framework tree at rev `73c8f2ec970b`):
  `vendor/docs/governance/youtrack-issue-authority.md` landed byte-faithful (canonical body +
  pure `{{PROJECT_ROOT}}` placeholder substitution — diff verified), and the full adopt reported
  exactly 2 additions (`+ vendor/docs/governance/youtrack-issue-authority.md`,
  `+ vendor/governance.yaml`), 92 pre-existing files skipped untouched. `msf validate --all`
  now **PASSES with 0 errors** (15 warnings, all pre-existing classes). `drift_check` stays OK
  (unit `9377e009d43b`, framework `73c8f2ec970b`) — the unit is untracked-by-the-lock, so the
  new file is lock-neutral.
- **`python temp/msf_golive_migrate.py --apply` re-run end-to-end per the user instruction:**
  12 steps — 8 ok (roster/declaration/credential/capability/unit/capability-after/workspace/receipt),
  2 owed-red (governance + guard, BOTH solely because of the duplicate `vendor/governance.yaml`
  position; a project judged over two governance declarations cannot be judged), 1 planned
  (unit-write dry run, no work). The tracker is the live issue authority: the guard answers
  `[issues=tracker@048e3398c936]` (BEYOND, 5 issues, receipt fresh), and both guard halves pass
  (root: 0 actionable debt; vendor root: 0/0/0).
- **Adopt quirk, measured:** `init --adopt` REFUSES the project's own fleet-declared ports
  (relay 38116 / control 37918 — declared in `reasonix.toml` AND the fleet task table); the run
  was fail-closed (nothing written). Workaround used here was safe only because adopt is
  add-only and every port-bearing file already existed: stand-in ports 38123/37923 were accepted
  and never landed anywhere. Root cause + fix options filed to the framework as
  `modelstack_framework/temp/issues/ISSUE_adopt_refuses_target_own_fleet_declared_ports_20261011.md`
  (cross-referenced to its 2026-10-10 silent-REASSIGN sibling — same family, opposite failure
  mode).
- **Deliberate trade-off kept:** the duplicate `vendor/governance.yaml` (advisory-mode seed) is
  NOT deleted — the migrate script's governance+guard steps cannot judge the tree while the two
  positions disagree, and deleting the root declaration (the documented position, pinned by
  `test/unit/vendored_overlay.test.js`) would go red against that test. Backlog: the migrate
  script should accept the vendored-layout position pair (root FIRST wins) instead of holding
  PENDING; filed as a framework follow-up candidate, not patched here.

### Attempted (2026-10-09, leg 6 resumed — G10-curvature shape families: the trusted baseline was a broken instrument; the loop reached an ARITHMETIC DEAD END; next move is an operator decision; NOT shipped)
- **The interrupted leg-6 session resumed at its own recorded state (§7: probe3k2 owed) and the
  probes UNWOUND the campaign's trusted baseline.** `temp/scratch/thornvine_leg6_record_20261009.md`
  §8-§9 record, all measured with the gate's own math (arc-length 0.5 resample ==
  `scripts/thornvine_acceptance_gate.js` `arcResample` L296-311; 17-sample/2u-step windows ==
  L912-918) under an ASSERTED resample invariant: **(1) probe3's zero-flat table is an
  instrument artifact** — its `biarc_wall` walks arc1 only to th=alpha/2 then midpoint-mirrors,
  leaving a 13.835-unit straight chord mid-wall (`tv_probe3_chain_inspect.py`) and scanning
  windows of raw nodes at irregular spacing; §7's "probe3 STANDS / REPRODUCED" claim is REVOKED
  (the re-run proved the bug deterministic, not the instrument valid — probe3b's own header had
  already documented the construction bug). **(2) The TRUE tangent-continuous biarc fails G10's
  curvature half on EVERY constructor gap 24-42** (`tv_v10_g10_feas_probe3m.py`: flat 1-2/25-28
  windows/period, worst 0.19-0.38 at the inflection, matching the analytic 2/R prediction; R =
  run/(2 sin th_j) >= rise/4 = 5 as run -> 0 gives dev(flip) <= 8/rise = 0.4 < 0.5 FOR ANY RUN —
  structural, not unlucky; corner hairpin marginal 0.43-0.54, not clean) — so §5 item 0's
  "biarc passes flat=0" premise behind muse iter-22's atomic list is FALSIFIED.
  **(3) The gaussian-bump slope profile fails on valid scans** (`tv_v10_g10_feas_probe3k2.py`:
  fixed closure via monotone ratio bisection, resid ~1e-15; NO CLOSURE at gaps 24-38, flat=4 at
  42; flank kappa 0.018-0.10 < the 0.0625 floor for every |a| >= 0.4). **(4) The ramp-radius
  family (probe3j, the one unmeasured survivor) is EXCLUDED BY CLOSURE ALONE**
  (`tv_v10_g10_feas_probe3j2.py` + `_sanity`: u/d >= 1.238 at the 88deg slope cap vs the needed
  0.60-1.05 — R decreasing in t concentrates arc at low slope; zero closure hits over the
  196-point grid x 7 gaps; muse iter-23's "measure-zero tuning" prediction confirmed and
  tightened).
- **The pinned 6-loop escape valve fired and the mandatory consult ran**
  (`thornvine_muse_iter23_{brief,answer}.md`): verdict **BLOCK, no score raised** (the
  hard-to-please rule held), all seven cumulative approaches dispositioned, three named errors
  recorded (instrument validation burned iters 17-22; iterating symmetric families after the
  analytic proof; analytic-wall-first as the 1/10th-effort falsification method), and the
  constraint-set ruling: **swing 20 + half-period <= 29 + one closed stroke + CURV_MIN 0.5 on
  an 8u window is UNSATISFIABLE for any tangent-continuous S-family with an inflection.** His
  standing instrument rules are adopted: assert the 0.5-resample invariant AND a positive
  window count before logging any flat count, and derive the analytic wall BEFORE any family
  scan. Full exchange with per-approach dispositions: leg-6 record §9.1.
- **No code, no corpus, no gate byte changed — the next move is an OPERATOR DECISION on the
  gate rule** (muse iter-23's three named options: CURV_MIN 0.5 -> 0.35-0.40; window 8u -> 6u;
  or reformulate G10 as curvature-continuity instead of chord sagitta on an inflection-centered
  window — his argument: the floor's purpose is to reject perceptually flat stretches, and a
  biarc at R=5 reads dev=0.4, visually curved, failing only through inflection cancellation).
  The tracked gate (`scripts/thornvine_acceptance_gate.js`, promoted a29a0f4) and the frozen
  corpus are untouched; the 03-thornvine verdict stands FAIL [G1,G2,G3,G4,G5,G7,G9,G10] /
  constructor FAIL [G1,G2,G4,G6,G9,G10]. Scratch-only session (probes + record + consult).

### Changed (2026-10-09 — Fix C promoted; the 03-thornvine acceptance gate is a tracked instrument)
- **The operator authorized Fix C ("promote fix C") and the muses' iter-19/20 package left the
  scratch gate: the binding 03-thornvine acceptance gate now lives at
  `scripts/thornvine_acceptance_gate.js`** (the D1 precedent — the criterion contract is a
  versioned module beside `scripts/border_metric.js`, not a script of the moment). The promoted
  file is the leg-5b repaired scratch gate (`fb39c6d`, byte-identical body) plus the
  authorization record in its header. What the promotion carries, all measured in
  `temp/scratch/thornvine_leg5b_record_20261009.md`: **G2's `loopProj` repaired** — branch by
  the gate's own `nearestEdge` (muse iter-20 option (a), minimum-diff; (b) drop-the-projection
  was rejected as deleting iter-13 intent) with a true 0..960 perimeter (right ends 480, bottom
  `480+(224-x)`, left `704+(256-y)`) — fixing three measured defects: the dead bottom branch
  (empty set `256<=224`, 0/57,825 hits, every bottom root projected as left `928-y` → the
  G2+G9 arithmetic impossibility), diagonal-selected seam discontinuities (worst 880.3 units
  over one 0.5-arc step), and the 32-unit perimeter overlaps; **G8 DISABLED pending redesign**
  (skip-with-flag, never deleted: the accepted 03-thornvine reference is a plain 16-unit
  rectangle + one open top-edge path — zero corner-turn pivots in all four corner windows, 57
  samples each, both datums — so no anchor exists for G8's thresholds; re-enabling requires a
  new operator decision). No threshold was softened and no criterion text amended; the honest
  verdict on the current canonical blob stays FAIL (8/10 active gates + disabled G8). The gate
  is NOT wired into `npm test`/the freeze: the canonical blob is the known-failing baseline this
  campaign is fixing; the gate judges FUTURE regenerated candidates, and any 10/10 claim still
  owes the v11 constructor re-derivation of joint G2+G9 feasibility (leg-5b §6, open).
  **Promotion verified, not assumed:** the promoted file reproduces the leg-5b recorded
  verdicts measurement-identically on all three artifacts (canonical corpus blob and
  `tv_canonical.svg` → FAIL [G1,G2,G3,G4,G5,G7,G9,G10]; the constructor tile → FAIL
  [G1,G2,G4,G6,G9,G10]); three lint-blockers were removed in promotion (dead `atMost` /
  `nearestEdgeName` helpers, and a dead leaf-endpoint wrapper whose only effect was to
  double-count identical `sproutBandViolations` — the canonical blob reads 0 either way), and
  `npx eslint scripts/thornvine_acceptance_gate.js` is clean. The scratch copy stays the
  campaign's working copy; divergence from `scripts/` after this date is a provenance question,
  not a gate edit.

### Attempted (2026-10-09, leg 4 — webp-anchored instruction per operator directive, NOT shipped)
- **The operator pointed at the shipped webp borders as the pattern to follow ("a fixed
  width and height, followed by fixed border css classes, and strict matching… one of the
  existing webp borders are vines… improve the prompt to enforce that the svg borders
  follow the same logic") — implemented as a measured prompt leg.** The webp pattern was
  read from product sources (`.vine_border` = vine_hollow.webp slice 205 / width 130px /
  outset 45px in `js/print_styles.js`; AI borders ride the SAME border-image engine
  sliced at 24% per `js/ai_border.js` D4; PIL alpha profile of vine_hollow.webp shows the
  dashed one-third-ink rail) and the instruction was rebuilt around it: nine-slice tile
  framing, the G8 swing/separation fix, the G1 chord anchor, a CONSTRUCTION recipe
  (exactly ONE stroked path = the whole vine as one closed loop, sprouts fill-only), and
  XML-PAIRING / ATTRIBUTE-LOCALITY reply-contract rules — all binding numbers unchanged,
  3803 chars, SHIPPABLE product-path. **Result (12 samples, r38-41): real gate movement,
  still zero full passes.** Three gates no sample had ever passed were passed: G4+G5+G6
  (twice) and G3+G4+G5 (r40-s1 — the campaign's first one-closed-ring architecture, traced
  to the CONSTRUCTION sentence). JSON parses as-is rose from 5/27 to 4/12. Residual gaps
  recorded: ONE-stroke compliance under a full sprout inventory, and the seat's
  `</tool_call>` wrapper leaking into the envelope. Record:
  `temp/scratch/thornvine_leg4_webp_record_20261009.md`; prompt:
  `temp/scratch/tv_webp_instruction.txt`; raw rounds in `temp/scratch/tv_leg2_20261009/`.
  No tracked byte changed.

### Attempted (2026-10-09, leg 3 — consult step 6 self-correction probe, NOT shipped)
- **The operator-chosen leg-3 move (Muse consult step 6: feed the gate's JSON verdict back
  to the same free seat so the MODEL corrects its own gated answer) ran to measurement and
  did not converge — the multi-turn pipeline is falsified on this seat.** Four correction
  turns across both seed blobs (`temp/scratch/tv_step6_correct.js`; model sees its own
  answer + the gate's verbatim failing predicates; product parse path + binding gate every
  turn; no hand repair): seed r34-s2 0/10 → **0/10** (no gate changed); seed r35 2/10 →
  two turns died `finish=length` at 6000 tokens (`model_output_not_json`), and a T=0.3 /
  9000-token retry REGRESSED 2/10 → **1/10** (lost G3, gained nothing). Zero improvements
  in four turns — the consult's own "if the 2nd turn reaches 4-5/10 the pipeline is
  viable" condition is decisively not met, and the multi-turn provenance ruling stays
  unmade because there is nothing converged to rule in. Cumulative: 27 samples, zero gate
  passers, every ship-path lever measured (one-shot vs multi-turn, T ∈ {0, 0.6, 0.75,
  0.8, 0.85}, payload cap, output headroom). Record:
  `temp/scratch/thornvine_leg3_step6_record_20261009.md`. No tracked byte changed; the
  operator decision class narrows to (a) a stricter/different seat or (b) retirement.

### Attempted (2026-10-09 — 03-thornvine leg 2: forensics + mandated consult + three probes, NOT shipped)
- **Leg 2 ran the cumulative consult the protocol owes and executed its three cheap
  probes; the result is a measured exculpation of the prompt and pipeline, and a
  sharply-named seat problem — recorded so the operator rules on evidence.** Raw-file
  forensics first: leg 1's "root-brace truncation with finish=stop" is NOT length
  truncation — every envelope failure ended `finish=stop` at 1161-4300 completion tokens,
  far under the 6000-token request (`max_tokens` exonerated); the classes are JSON
  bookkeeping (one missing final `}` on r23/29/31/r32-s3/r37-s3, over-closure r27, invalid
  `\)` r30, degenerate-but-valid frames r28/r36, malformed SVG r32-s2/r33-s1/s3/r34-s3,
  prose preamble r34-s1) — and one NEW class, a parse-OK answer refused by the trust root
  for invalid UTF-8 + a literal `...` ellipsis inside the SVG (r32-s2). Sampling then ran
  rounds 32-34 (staged 3910-char comp, T=0.75/0.80/0.85, 9 samples): 2 accepted, both gate
  0/10 — r34-s2 draws a vine through the CANVAS CENTRE (128,60), the swirl attractor.
  **Cumulative: 23 samples, 4 accepted (r24 1/10, r33-s2 0/10, r34-s2 0/10, r35 2/10),
  zero passers.** The mandated consult (muse seat, `temp/scratch/tv_leg2_consult_brief.md`
  + `_answer.md`) named five things the loop was doing wrong (category error: brute-forcing
  a deterministic 10-predicate gate with a stochastic text prior; product-acceptance ≠
  model-executability; sunk-cost sampling) and ordered six falsifiable probes — three were
  executed the same session: **r35** sampled the full 5504-char iter-14 GO with the
  ceiling BYPASSED (product scaffolding preserved by message-swap; diagnostic only,
  corpus-inadmissible): gate **2/10** — the best any thornvine sample ever scored, which
  exculpates the 4000-char cut (the GO was never sample-able either); **r36** at T=0:
  degenerate 1060-char one-path frame — the comp has NO deterministic control on this seat;
  **r37** with a hard output cap (svg <1800 chars, no brace/quote in path data, end `}}`):
  degenerate again + the brace-drop persisting — the cap buys minimalism, not bookkeeping.
  Consult steps 4/5 (agent-executed parametric code; few-shot anchor embedding a passing
  snippet) were REJECTED for the ship path: both make the artwork agent-computed, the same
  provenance class as hand repair. Step 6 (model self-correction against the gate JSON) is
  open as a scratch probe, with the operator owning the multi-turn provenance ruling.
  Everything on disk: `temp/scratch/thornvine_leg2_record_20261009.md` (full record +
  per-approach dispositions), `temp/scratch/tv_leg2_20261009/` (round files, raw answers,
  accepted blobs). No tracked byte changed; corpus freeze and suite untouched.

### Attempted (2026-10-08 — 03-thornvine sinuosity fix, NOT shipped)
- **The 03-thornvine regeneration leg ran to measurement and shipped nothing — recorded so
  the next leg starts from evidence, not memory.** The muse-loop over the border's prompt
  (15 iterations, hard cap) reached a GO comp at iter-14 (temp/scratch/thornvine_muse_loop_transcript.md);
  the product's own `buildMessages` then refused it — `MAX_INSTRUCTION_CHARS = 4000`
  (`js/ai_layout.js:177`, pinned by `test/unit/ai_layout_schema.test.js:755`) against 5504
  chars — so iter-15 re-cut it under the ceiling (3910 chars, product envelope tail verbatim,
  every iter-14 constraint accounted for; Muse's own compression was challenged and repaired
  per-protocol: wrong viewBox, half-period defined as same-kind pairs, wavelength-vs-
  peak-to-trough, Euclidean-instead-of-edge-projection, mutilated element allowlist). The
  staged comp (`temp/scratch/tv_final_instruction.txt`, verified through `buildMessages`) is
  NOT in `scripts/border_designs.json`: the sampling leg on the Nous seat (rounds 23-31,
  T=0.75-0.85) produced ONE parser-accepted blob (r24) and it FAILs the deterministic
  acceptance gate 9/10 gates (temp/scratch/thornvine_acceptance_gate.js — chord deviation 0.0
  on three edges, two ring-scale strokes, sprout combinations not enumerated, roots floating,
  micro-ripple), and the other eight samples died on the envelope (4 × root-brace truncation
  with `finish=stop`, 2 × 429, 1 degenerate empty frame, 1 doubled `"note"`). The strict
  product parser refuses truncated JSON by design, so nothing was hand-repaired into the
  corpus; per the operator's 2026-10-08 choice the failed rounds are archived verbatim to
  `temp/scratch/tv_failed_rounds_20261008/` and the freeze + corpus suite went back green
  (`freeze --check OK`, 15 passing/0 failing). The binding gate, the measured baseline
  (`tv_gate_baseline.json`: the frozen canonical fails 9/10 — the defect this loop is fixing),
  and the full sampling record (`temp/scratch/thornvine_sampling_record_20261008.md`) are on
  disk. Full suite still green; no tracked byte changed by this leg (the gate lives in
  `temp/scratch/` by design — scratch, not product).

### Changed (2026-10-06 — track `byok_border_prompt_adoption_20261006`)
- **The BYOK border prompt corpus now carries the 10/10 prompt texts.** All 11 canonical
  instructions in `scripts/border_designs.json` were replaced VERBATIM with the muse-loop's
  10/10 texts (`temp/scratch/border_prompts_final.json`; title + criterion per design
  unchanged; `05-celestial-arcs` stays D3-retired). The corpus artwork was regenerated on the
  live NOUS leg through the product's own prompt path and
  `test/fixtures/byok_border_corpus.json` re-frozen byte-reproducibly over rounds 1–22:
  **11 canonical / 35 variants / 46 distinct accepted blobs** (the freeze's last-accepted-wins
  and every-blob-survives fences unchanged; old canonical bytes survive as hash-pinned
  variants). Corpus suite pins moved to the measured counts; full suite **1630 passing /
  0 failing**. Certification (gallery-round33 judged capture + the D2 binding metric + the
  Muse visual seat, per the archived track's operator rulings): **7/11 certified MET**
  (02-runic-band, 03-thornvine, 06-chainmail, 07-corner-arcs, 08-flame-crest, 09-frost-shards,
  11-starlit-void); **01/04/10/12 escalated to the operator** after 2+ consecutive failing
  samples from the same adopted prompts — no criterion, threshold, or prompt was amended.
  Records: `vendor/conductor/tracks/byok_border_prompt_adoption_20261006/final_report.md`.
- **`scripts/byok_vision_gate.py` — the vision seat no longer crashes on a reasoning-only
  completion.** Muse Spark can spend the whole completion budget inside `reasoning_tokens` and
  return `content: null` with `finish_reason: "length"` (measured: 8000/8000 reasoning tokens,
  null content, on a judged cell that answers fine at 16000). `extract_text` used to return
  `None`, crashing the seat driver with `write() argument must be str, not None` — the same
  "a reasoning-only answer is not evidence" class the archived track hit at 2000 tokens.
  Fixed: `max_tokens` 8000 → **16000**, and an unreadable answer is returned as a NAMED string
  carrying the finish reason and reasoning-token count, so it can never be read as a verdict.

### Fixed
- **§5's own yardstick could not see §5 passing — `admission_cutover()` now splits by instant
  (`scripts/utility_telemetry.py`, 2026-09-21, telemetry handoff §27).** The after-state landed at
  **2026-09-21T20:14:05.299Z** (90 → 98 `admission_summary` decisions, **0** per-candidate rows at
  or after it, 112 candidates carried inside the summaries, max 2 per decision, and the pre-cutover
  baseline of 201 detail rows intact), yet `cmd_admission` kept printing the BEFORE report because
  it chose its branch from `if not rows:` — "does the window hold any `admission_rejected` row" —
  and a straddling rolling window always holds the old detail rows at its head. Four verdicts now,
  each with its own wording: `compacted` (summaries + 0 detail after → §5 SATISFIED), `mixed`
  (summaries AND later detail → **not** a pass, named as the double-writer defect the old code could
  not express at all), `undated` (summaries with no parseable instant → refuse to invent a cutover,
  the `min([])`-to-"compacted" vacuous-green class), `before_only`. The before-branch prose was also
  rewritten: it asserted "the store carries 0 summary rows for ONE reason only" and "muse-lane
  traffic stopped" as live facts against a store holding 90 summaries and 90 muse rejections in 9 h;
  it now states the two readings the branch actually supports. Falsified, not asserted:
  `temp/scratch/s27_falsify_cutover.py` swaps in the old predicate and turns 3 of the 4 new
  properties red (the 4th holds under both rules — recorded, not rounded up). Verification:
  `admission --days 1` → **ADMISSION SUMMARIES**; `selftest` 33 → **37 properties**; `mocha
  test/unit/utility_telemetry.test.js` 24 → **25 passing**; full suite **1471 passing / 1 pending /
  0 failing**; close-out guard OK on both roots. No `vendor/` byte touched.
- **Extracting a section is now undoable.** Double-clicking a block into a floating card was the
  LAST mutation in the product with no record behind it: rolling an extraction back was undoable
  while making one was not, so `Ctrl+Z` after an extract reverted whatever you had done *before*
  it. The gap was found during `undo_stack_20260911` and deliberately left open rather than
  half-landed — awaiting the capture before the mutation defers the extraction by a microtask
  (eight dblclick tests assert synchronously and went red), and a late capture *includes* the new
  section, so the record would be the post-state and the undo a silent no-op. Both halves are now
  built: the site uses the non-deferring pair (start the capture, mutate synchronously, push
  afterwards), and `stripLateAdditions` repairs what that costs — the extraction ids are
  snapshotted synchronously before the mutation and any entry the record gained is removed from
  it, so the record is the pre-add layout. It strips ONLY what the gesture added: an extraction
  you already had survives the repair (the over-reach arm is asserted separately, because
  "empty the array" would pass the first case and destroy your sheet). The undo puts the original
  block back on the page and removes the card, and the label names it (`Extract "Actions"`).
- **An extracted card no longer carries a second copy of its source's `id`.** Found by MEASURING
  the undo above in the real browser rather than by reading the code: the extraction hid its
  source, the record was right, the restore ran — and the block stayed invisible. `cloneNode(true)`
  copies the `id`, so the document held TWO elements with the source's id, and `getElementById`
  answers with whichever comes FIRST in document order — after an extraction, that is the copy
  INSIDE THE CARD. Every path that restores the source by id (`applyLayout`'s extraction teardown,
  `rollbackSection`, the reset-to-defaults sweep, the clone-repositioning pass) was writing to a
  node about to be deleted while the real block kept `display: none !important`. Measured: 2
  matches for the id before, 1 after, and the source visible again. The live original keeps the id
  — that is what the record's `originalId` names and what the selector fallback re-assigns — so
  nothing that resolves the original changes. Pinned in `test/unit/extraction_logic.test.js`
  (falsified: with the strip removed the assertion goes red) and asserted in the browser e2e.
- **`package-lock.json`'s root `version` is synced to the package.** It had drifted to `2.0.1`
  and stayed there across the 2.1.0 and 2.1.1 bumps — the 2.1.1 `### Internal` note records it was
  deliberately left alone at the cut (no `npm install` review had been run, and changing a lockfile
  blind makes the diff unreviewable). This closes that note: the bump was performed with
  `npm install --package-lock-only`, which rewrites exactly the two root `version` fields (top-level
  and `packages[""]`) and touches no dependency resolution — so the sync is reviewable line-for-line
  and the lock can no longer claim a version the product does not ship. No gate asserts this parity
  (`manual_verification_phase4.spec.js` checks `package.json` vs `manifest.json` vs the newest
  CHANGELOG heading only), so this is hygiene, not a defect the release path would have caught.

### Internal
- **The 2026-09-24 framework restamp now has a durable, public-safe record and its own liveness
  gate (issue `ISSUE_framework_restamp_governance_units_20260924`, archived).** The four
  "AMENDED 2026-09-24" passes were process notes, not acceptance gates. Replaced by:
  `docs/governance/msf_restamp_receipt_20260924.json` (tracked hashes-only receipt — no absolute
  paths, no PID; `vendor/` is excluded from history by the generated public block, so the receipt
  cannot live under the overlay), `docs/governance/msf_live_attestations.jsonl#dnd-relay-20260924`
  (the append-only process-probe row, verdict `PROVENANCE-OK`), and
  `scripts/relay_serving_identity.py` — a five-verdict gate (`PROVENANCE-OK / STALE-PROCESS /
  STALE-UNIT / PATH-MISMATCH / UNKNOWN-PID`, exit 0 only on the first) that READS the process the OS
  has on the relay port, never restarts it and never trusts the served tree's own lock as authority.
  Measured 2026-09-24: listener PID `11352`, creation `20:51:01Z`, served module
  `orch:vendor/relay/reasonix_proxy.py`, 20/20 relay + 183/183 unit pins matched, newest served
  source `20:46:11Z` pre-dating the process start. The draft's `STALE-UNIT` came from a date
  comparison that ran the wrong way; the verdict was corrected against the measurements, not the
  other way round. `test/unit/vendored_overlay.test.js` now permits root `docs/` as a NARROWER second
  exception after the `AGENTS.md` pointer (every file under it must be one the overlay does NOT
  carry; a root `docs/governance/gates/` still fails), committed `6c3b009`.
  **Addendum 2026-09-25:** two units advanced again the same evening (`policy/housekeeping-guard`,
  `skill/subspace-deliberation`), so the live gate read 13 warnings / 2 `governance:` lines against
  the receipt's frozen 11/0 — resolved with the documented `msf governance stamp --target . --apply`
  (`APPLIED: 21 unit(s) {'behind': 2, 'current': 19}`, exit 0, nothing refused; both `next: written`),
  after which `msf validate --all` returned to `PASS: 0 error(s), 11 warning(s)` with zero
  `governance:` lines and the gate still read `PROVENANCE-OK`. The re-stamp touched the governance
  surface, not `vendor/relay/**`, so no new ledger row was warranted. No `vendor/` byte was hand-edited
  and no framework body was committed.
- **Deliberation required as the default for every new track (operator fleet mandate 2026-09-23,
  track `deliberation_default_mandate_20260923`).** The operator decided "Turn deliberation as
  required on all projects." The convention is carried by `vendor/conductor/workflow.md` §"Track
  Creation (default deliberation — operator mandate 2026-09-23, binding)" (three clauses:
  creation-time declaration, single-answer decisions not exempt, no retro-declaration) and
  `vendor/AGENTS.md` (working-rule bullet, lines 68–74). Three candidates deliberated: two
  INADMISSIBLE (would edit a stamped body — the guard at hash `c5e8d8de7acc…` and the pre-commit
  hook at `5bbb48a9a1c2…`), one SURVIVOR (the convention). Guard green on both roots,
  `msf validate --all` 0 errors, `verify_lanes` OK, `input_budget` OK. Known limit: convention
  lives under `vendor/` (gitignored); a fresh clone carries the floor but not the convention text.
  **Close-out completed 2026-09-24** (re-execution of the track's plan found the archive step had
  left the LIVE folder `vendor/conductor/tracks/deliberation_default_mandate_20260923/` in place —
  byte-identical to the archive copy, `diff -r` clean, so the guard census still read `1 in-flight`
  and the completion was invisible to the gate that reports it). Removed per `workflow.md`
  §Guidance Protocols → *Track Finalization*; census now `0 plan(s) — 0 in-flight — 0 complete`,
  and the guard's archive half still measures the record (`1 declare "deliberation: required" and
  ARE judged` + `deliberation ADMITTED`, 0 DEFECTIVE / 0 UNREADABLE). The plan's last two boxes
  (CHANGELOG+suite+diff, `User Manual Verification 'Phase 2'`) were unticked and are now `[x]`;
  `npm test` re-read **1476 passing / 1 pending / 0 failing** (the track's own close-out recorded
  1470 — the +6 is `3a63dbf` product work landed after, not this track, whose entire git footprint
  is this CHANGELOG insert). Stamped bodies re-hashed and unchanged: guard
  `c5e8d8de7accd4f52929eb6ef739298f6ba8f18feb38cfba692cb7016c51f2f0`, hook
  `5bbb48a9a1c27f193d5fa5cc90ff004cb4c77f32aeeee9950f782e9b5eb35fa9`. Verification record:
  `vendor/conductor/archive/deliberation_default_mandate_20260923/final_report.md`
  §"Manual verification".
- **Telemetry handoff §28 (session 16, 2026-09-21/22): §2's deferred question is ANSWERED with the
  row census, and the record's own debts are closed.** Census (`temp/scratch/s28_verdict_census.py`):
  store 60,255 rows = 25,405 completed + 25,305 task_completed + 9,334 `admission_rejected` + 98
  `admission_summary` + 84 failed + **18 verdicts** + 11 shutdown; per cell qwen 10,574 calls / 15
  judged / $2.34120 (**93.6 % of store spend**), deepseek 13,935 / 0, mimo 598 / 1, nous 352 / 2,
  glm 70 / 0. **Decision on §12's follow-up: NOT actionable, and the reason is the missing comparator
  rather than the qwen data** — every cell but qwen sits under the ≥8 bar and they hold only 6.4 %
  of spend together, so §4's "both samples or no comparison" rule decides. Also recorded plainly:
  the 100 % `useful_response_rate` is an artifact of §20.1's anchor recipe (every verdict is anchored
  to a commit whose acceptance artifact was GREEN — selected-by-success, so accrual cannot lower it,
  only a different evidence source can), and `cost_to_first_useful=$0.000000` is a
  **window-dependent earliest-prefix fact** — qwen's rows are 4,392 explicit `$0.0`
  (`relay_estimate_free`, the free leg ending 09-16T21:05Z) + 6,160 positive
  (`relay_estimate_bai_now_billed`) + 6 unpriced, and the same metric on `--days 1` prints
  **$0.010491** for a different first-useful verdict, which proves the walk sums real money. §23.2's
  "no code change, do not fix this figure" is CONFIRMED for the right reason. §6's tail re-measured
  whole-store: max 776,391 ms, **55 calls > 300 s** (§23.3: 46), deadline coverage **97/25,521 =
  0.38 %** with `request_deadline_phase` null on all 97. **§21.3's identity claim corrected:** all 18
  verdict rows — including the 12 written through the synced builder — are still `unknown`-writer
  with 3/3 SPEC §27 fields missing, because the unit's `runtime_identity()` /
  `policy_instance_revision()` are called from `build_record` (`vendor/relay/telemetry/__init__.py:482`)
  and NOT from `build_evaluation_record` (`:643`), which takes no identity kwargs; a consumer cannot
  stamp its verdict rows through the contract endpoint. The fleet reader's store-wide pass over the
  rows it actually consumes (`read_telemetry`, call rows only) puts this project's contribution in
  the bucket whose docstring demands zero: **`relay`: 5,085 rows without identity**. Filed to MSF as
  `ISSUE_msf_identity_stamp_reaches_neither_verdict_rows_nor_relay_call_rows_20260921.md` (new file
  under that project's `temp/issues/`; its code untouched). Accrual ceiling stated with arithmetic
  (§28.3): a verdict requires a commit made on that route's session — deepseek's 13,935 calls have
  never carried one, so probing cannot raise it. Record debts closed: §27 was truncated mid-word at
  line 2413 (session-15 disposition/verification/open list never existed) and had **no CHANGELOG
  mirror** — both written; §10's "the DATA is 0 judged today" corrected; §8 line 4 checked with the
  cutover instant; `AGENTS.md`'s pin bullet advanced from `e2084dd93869`/`a457f4974a44` to the live
  lock (`245490672957`/`d93534bdcd33`, 181 files); session 12's and 14's unsupported `nous 4/8`
  corrected to 2/8 with the anchor-vs-verdict vocabulary trap named (§27.4). §28.7 is this session's own citation audit
  (`temp/scratch/s28_verify_pointers.py`): 186 paths across the handoff/CHANGELOG/AGENTS + 8
  `file:NNN` pointers in the vendored unit re-verified -> **0 stale lines, 0 undocumented danglers**
  (5 historical, 12 moved/foreign-resolved), exit 0 -- after the checker itself produced 30+ FALSE
  danglings from an extension alternation that matched `.js` inside `.jsonl`, and after a
  longest-first-ordering explanation this session had written was FALSIFIED by a 2x2 re-run
  (§28.7: the `(?![\w])` guard alone fixes it). The audit also machine-checks §28.4's mechanism
  claim (`build_evaluation_record`: 21 params, no `**kwargs`, no identity params). §28.8 hands ORCH
  the 09-21 re-measure of their own pass criterion (0.38 % coverage, phase null on all 97, 55 calls
  > 300 s). Gates: `selftest` 37 properties, `mocha test/unit/utility_telemetry.test.js` 25 passing,
  `pytest vendor/relay/test_reasonix_proxy.py` **334/334 at pin 245490672957**
  (`temp/scratch/s28_relay_pytest.txt`), `drift_check OK`, guard OK on both roots. Handoff stays OPEN:
  §6's deadline is the last measurable §8 criterion and belongs to ORCH.

- **Telemetry handoff §29/§30/§31 (sessions 16 close-out → 17, 2026-09-22/23): §6's owner turned out
  to be THIS project, and the record's own mirror had been orphaned.** The three sessions are one
  story, so they are mirrored together — and the reason they NEED mirroring is itself the finding:
  `scripts/utility_telemetry.py` and its test are R3-ignored (`.gitignore:201-202`), so for that
  harness the CHANGELOG **is** the durable artifact, and the §27/§28 mirror had been committed as
  `c667a3b` (65 insertions) on a line that "Master Revamp (#40)"/"Huge Revamp (#41)" orphaned —
  `c667a3b` is **not an ancestor of HEAD**, so it survived only on
  `backup/master_revamp-prerebase-20260922` and every later session's notes were unrecoverable prose.
  Both blocks were recovered verbatim from that branch (`git show c667a3b -- CHANGELOG.md`) and
  restored here, beside these. Measured before the restore: `git show HEAD:CHANGELOG.md | grep -c
  s27_falsify_cutover` = **0**.
- **§6 is not ORCH's, and the box that says so was mis-worded.** The §8 criterion "Workflow deadline
  is explicit and propagated to the relay/MSF path" has been the ONLY unmet box since session 13, and
  the record carried two false premises about it. (1) The field it told a reader to check,
  `request_deadline_phase`, has **0 hits in the pinned `vendor/` tree** — it was always a DND-side
  reporter label; the real keys are `caller_timeout_ms` (execute/plan **0 of 28,176**; recover
  115/3,018 = 3.81%, whose coverage predates this change and comes from `compact.go:633`'s own ctx)
  plus `deadline_fired` (5 rows, all `provider_timeout`, all 504). (2) "HANDED OFF to ORCH / nothing
  in this project can move it" was FALSE: ORCH's
  `ISSUE_relay_deadline_header_only_reaches_recover_and_summarize_20260919` is FIXED and archived
  (2026-09-21, fix option 1), but the fix is **opt-in per provider seat**, so the last mover is a
  one-line decision here. `request_timeout_seconds = 900` is now set on `px-dndb-flash` (parses under
  `tomllib`, lands on the right seat; no other fleet project is set, so the before/after is
  uncontaminated). 900 s sits deliberately ABOVE the observed long-call tail (55 calls > 300 s, max
  776,391 ms = 12.9 min) because §6 is about propagation, not cancellation — the relay then caps the
  provider and reports WHICH layer fired (AC-16).
- **The "we need a new binary" premise was retracted in the same session it was written, by a
  `git log -S` probe.** The entire feature — the config field + its TOML tag,
  `Agent.Options.RequestTimeout`, `requestTimeout`, and the `context.WithTimeout` arming in
  `internal/agent/sampling_request.go` — lands in ONE commit, ORCH `cc1553c` (2026-09-21 19:17:26
  -0600); only the pre-existing header emitter (`RelayDeadlineHeader`, `61fc3f6` 2026-09-04) is older,
  and it is reused rather than replaced. The fleet's staged binary (ORCH's deploy staging,
  md5 `086e4ff3a69fb366aa47dc6c5f7ed938`, built 2026-09-22 10:06 — about 15 h after the commit)
  carries the feature's literals (`grep -c request_timeout_seconds reasonix.exe` = 1); negative
  control: ORCH's Aug-21 build (`cba1e310…`) has 0. So the fix was present and SWITCHED OFF, not
  absent and waiting for a build — which is what 0 of 28,176 `execute` rows with a deadline looks
  like. The one remaining dependency is the gateway RELOADING the config:
  `request_timeout_seconds` is read at boot (`internal/boot/boot.go:1087 → :1712`), and ORCH's own
  `deploy_all.ps1` restarts the gateway on its `Test-GatewayConfigStale` check once the chat is idle
  past the 900 s grace. The box stays **UNCHECKED** until the store shows `caller_timeout_ms` on
  `execute`/`plan` rows.
- **Four archived `metadata.json` files were repaired, and the OSD guard's own false positive was
  filed rather than patched.** `vendor/conductor/archive/{ability_separation_20260219,
  content_extraction_20260214, merge_sections_20260214, spell_details_20260214}/metadata.json` were
  invalid JSON — all four carried unescaped `"` inside a single-line `description`, with 0
  backslashes in any file, so the repair escaped the inner quotes rather than doubling existing
  escapes and every other byte was preserved. Result: `scanned 60 unparseable 0`. The guard's four
  `deliberation UNREADABLE (deliberation: required)` lines are gone too, and that line is a defect in
  the OSD guard: the renderer asserts a declaration the predicate (`_declares_deliberation`) says it
  cannot read, while the census line simultaneously counts the same files as `0 declare
  deliberation`. Filed not-patched as
  `modelstack_framework/temp/issues/ISSUE_osd_guard_asserts_deliberation_declaration_for_unreadable_metadata_20260923.md`
  (three fix options, framework-side reproduction). No vendored byte touched.
- **The OSD floor was received the hard way: the write half landed and the record half died with the
  machine.** `msf governance stamp --target . --apply` copied its bodies (`vendor/.reasonix/skills/
  subspace-deliberation/SKILL.md`, `vendor/housekeeping_guard.py`, `vendor/hooks/pre-commit`) and then
  left `governance.stamps.json` as **3,024 NUL bytes** when the host was killed mid-write (Kernel-Power
  event 41 at 12:50:08 + event 6008 "previous shutdown at 12:41:40 was unexpected"; the file's mtime,
  12:49:41, sits inside that window). The root cause is framework-side and already handed off
  (`modelstack_framework/temp/issues/ISSUE_received_record_written_non_atomically_20260923.md`:
  `write_stamps()` is an in-place truncate-then-write at `framework/runtime/governance.py:272`). The
  repair was the framework's own runbook — quarantine, never delete: the corpse is kept as
  `temp/archived/governance.stamps.json.zero-filled-20260923` (the mirror row in `ARCHIVE_INDEX.md` is
  named `ISSUE_governance_stamps_zero_filled_20260923.md`) and a re-stamp re-certified the tree
  (`APPLIED: 21 unit(s) {'behind': 21}`, exit 0). Readings: `msf validate --all --root .` **PASS: 0
  error(s), 11 warning(s)** (was exit 1, 1 error/14 warnings) and `msf governance status --scan-root
  C:/luiscla27/projects` **CURRENT (exit 0)** with this project at OSD `current` / guard `current` /
  hook `bound` / runs `yes`. The same crash also killed this project's own agent session mid-turn and
  exposed two fleet defects worth fixing at the source: the deploy lock is wall-clock-scoped, so it
  survived a reboot that killed its writer and stalled deploys for 15 min, and the idle gate arms
  before Telegram is reachable (DNS is not up at boot), so it fired with no way to notify.
- **Evidence for all of the above:** `temp/scratch/s31_sec6_check.py` (the §6 field census),
  `temp/scratch/s31_archive_readiness.py` (the readiness gate), `temp/scratch/s31_verdict_cells.py`
  (the chat-lane cell attribution), `temp/scratch/s30_fix_broken_metadata.py` (the JSON repair),
  `temp/scratch/s28_verify_pointers.py` (the citation audit, **0 stale lines**, exit 0), and
  `temp/scratch/s30_s293_check.py` (the §29.3 falsifiable check, `NEW-ROW EXPECTATION: MET`).

## [2.2.0] - 2026-09-28

### Added
- **AI border design.** The AI Arrange dialog now has two ephemeral switches — "Arrange layout" and "Border design" — so you can ask the model for a layout change, a border, or both. When Border design is on and a section is targeted, the model can propose a static SVG border for that section. The SVG is validated and sanitized by a single render choke point (`renderBorderSvg`), and every path that can put a border SVG in the DOM (fresh apply, persistence rehydrate, template import, library reuse, section clone, undo restore, preview, print) is forced through it. Accepted borders are stored per-section as a `borderSvg` field in the regular layout save and can also be saved into a reusable local library (`custom_borders`).
- **Ephemeral capability switches.** The dialog's two switches are not persisted between sessions — they default to ON and reset on every open, per `[AC-4]`.
- **Blocking injection guard.** `scripts/check_border_svg_injection.js` is wired into `npm run lint` / `npm run pretest`. It is a structural guard, not an advisory, and fails the build if a second injection site or a direct-injection bypass appears in product source.
- **Privacy copy.** `PRIVACY_POLICY.md` now documents the new on-device border storage and the border-design prompt in §2 and in the `storage` permission description.

### Fixed
- **Picking a raster border now actually replaces an AI border.** After the D4 pipeline
  switch an AI border rides inline custom properties, and inline beats every stylesheet rule —
  so the border picker (and the properties-panel picker, the catalog apply and the layout
  rehydrate, which all funnel through the same clear) removed only the border CLASS and left
  the AI border painted: clicking "Spikes" on an AI-bordered section was a visual no-op.
  The shared clear now also clears the AI border through the render choke point
  (`js/ai_border.js`), so one picker has one winner in both directions — a raster pick (or
  "None") takes the AI border off, and a layout record that carries a `borderSvg` still
  rehydrates last and wins over a `borderStyle`. (Track `byok_svg_borders_20260927`, operator
  ruling R-1, 2026-10-01; pinned by `test/unit/ai_border_picker_clear.test.js`.)

### Changed
- **The AI border paints through the SAME `border-image` pipeline as the built-in borders.** A
  generated border is now carried as four inline custom properties on the section (`--border-img`
  plus `--border-img-slice` / `-width` / `-outset`) consumed by the existing
  `.print-section-container:not(.be-no-border)::before` slot — the very rule set the built-in
  raster border classes paint through — instead of a separate overlay node carrying its own copy of
  the border math. That removes a second implementation of `border-image` from the product, and with
  it a real divergence: the retired overlay declared no decoration filter, so on the default
  greyscale output the built-in borders printed grey while an AI border printed full colour. The
  four values are now the only thing the AI border adds, and with the same source and the same
  values the two are pixel-identical (measured: 0 differing pixels in a 5,184,000-pixel frame), so
  the only difference that remains is the source image. The slice — the one knob that is a property
  of the source rather than of the pipeline — is why every built-in border class already carries its
  own (33 / 25 / 177 / 146 / 250) and the generated family carries `24%`.
- **Version bump 2.1.1 → 2.2.0** (manifest.json + package.json).

## [2.1.1] - 2026-09-22

### Fixed
- **The nine-dot grip is a CELL of the section's action row, so it can no longer land on a
  button.** It had been moved out of the section's centre into the top-left corner
  (`top:8px; left:8px`, absolute) — the operator's placement instruction — but the action bar is
  anchored at the SAME corner with the SAME 39x32 cells, so the grip became coextensive with the
  bar's first button: `elementFromPoint` over the grip's centre returned `be-select-section-button`
  and the overlap measured 100% (1248px of a 39x32 box). Reported by
  `temp/archived/ISSUE_corner_grip_lands_on_first_action_button_20260922.md`, which lists the three
  options; option 1 was taken. `js/dnd.js` now inserts the handle as the rail's **first child**, and
  the rail's own `display:flex; gap:8px` (js/print_styles.js) gives it a box no control can share —
  the collision is unrepresentable rather than ranked away. The handle's rule sheds the placement it
  no longer needs (`position:absolute`, `top`, `left`) and keeps the button tier at 39x32 with
  `flex:0 0 auto` so a narrow section cannot squeeze the GRIP first. **`ensureDragHandle` asks the
  section pass's own accessor for the rail** (`window.getOrCreateActionContainer`, falling back to a
  local `div`) so the bar keeps the inline level from `Z.ACTIONS_BAR` and every other property it is
  built with, migrates a grip left behind by the corner placement instead of stacking a second one,
  and re-asserts slot zero on every pass — which is what makes it survive the builders that prepend
  into the same container. Two consequences of the new position are fixed with it: the
  removed-node arm of `watchDragHandles` resolved the handle's `parentNode`, which since the callback
  is a microtask is `null` for a real removal (the one case that arm exists for never fired) and now
  resolves the WRAPPER from the record, and the grip — being a `button` inside `.be-section-actions` —
  fell to the sheet's and theme's `!important` button rules (pill radius, drop-shadow, white ink, and
  green on shape sections), so the block carries a `(0,2,0)` arm that wins its own paint.
- **Three placement rules became one, and the two dead ones are deleted.** The grip's history is the
  argument for doing this structurally: a centred plate whose collision was MEASURED away
  (`gripBandFor` / `measureGripBands`, a trimmed 18x18 plate, three `--be-grip-*` properties and a
  `ResizeObserver` — the 2026-09-14 geometry pass), then a bar that "yielded" to the grip in the
  stack (`z-index: 700001` against 700002), then the corner. Neither earlier mechanism survived:
  the geometry subsystem was already deleted by the move to the corner (its own unit file,
  `test/unit/grip_geometry.test.js`, is rewritten as the negative contract — that the machinery
  STAYS gone, since a dead second placement rule is what produced round two), and the yield rule is
  removed from `js/print_styles.js` because a level between two controls whose boxes are disjoint
  decides nothing. That removal forced one real change: the bar's `:hover` reveal had no
  `:focus-within` arm, and with the grip INSIDE the row the row's `opacity: 0` would hide a
  keyboard-reached grip, so the reveal now carries both arms — exactly the arms js/dnd.js uses,
  asserted as set equality. `test/unit/hover_refactor.test.js` replaces the ladder case with that
  lockstep plus the slot contract, and adds a case that fails against the old `parentNode` lookup.
  Verified: unit `1473 passing / 0 failing` (was 1457 / 9 at the recovered state), lint clean,
  `affordance_drag_hover_shadows` 13 + `drag_glow_layers` 5 + `lock_handle_visibility` 1 = `19
  passing` in Chromium, and the per-wrapper census
  reports `buttonOverlapPx: 0` on every section with the Select button owning its own centre and the
  grip owning its own. The 2.0.1 Known-issues entry about the bar covering the grip is closed below.
- **The print hide needed the same arm as the base block, and the browser caught it.** The
  grip's `display: flex !important` is (0,2,0) to beat the action buttons' rules, and a @media
  rule does not outrank a higher-specificity declaration outside the media question, so the
  lone `.be-drag-handle { display: none !important }` under `@media print` LOST and the handle
  printed as a flex cell (measured: `{"display":"flex","visibility":"visible","opacity":"1"}`).
  The print block now repeats the (0,2,0) arm, and the unit case asserts the block carries it.
- **The hue-shift case was asserting the wrong half, and the move changed what is true.** A
  filter on an ancestor is a group filter over its whole subtree and no `filter:none` on a
  descendant undoes it, so the nine dots now travel with the row's inverse rotation. That is
  accepted deliberately and recorded in js/filters.js: counter-rotating the handle would make it
  the one cell in the row that does not shift, splitting the row apart visually, and the point
  of the move is that the grip IS a cell of that row. The case now asserts the ANCESTOR CHAIN
  (the rail carries `hue-rotate(-120deg)`, the handle is not counter-rotated on top of it),
  which is the half that can still regress silently, and leaves the colour itself to the eye.

- **New guard: `scripts/check_css_template_backticks.js` + `test/unit/css_template_backticks.test.js`.**
  A backtick inside a CSS COMMENT terminates the template literal a stylesheet is emitted from, so the
  module throws a SyntaxError at require time — and this change hit that in three files at once. The
  existing guard (`scripts/check_theme_backticks.js`) is hard-wired to `THEME_CSS` in js/ui_theme.js and
  could not see it, and the failure was loud but MISLEADING: measured while this was written, one
  injected backtick in js/dnd.js's sheet took the unit suite from 1470 passing to **1341 passing / 84
  failing**, every message reading `TypeError: dnd.initDragAndDrop is not a function`. The new check
  scans every named sheet emitter (js/dnd.js, js/filters.js, js/print_styles.js, js/ui_theme.js), blanks
  `${...}` (a nested template there is legitimate), refuses to scan past a one-line `css += …;`
  terminator so it cannot read the source below a template as its body, and names `file:line`. It
  asserts its own file list exists, so a stale list cannot pass vacuously, and js/ui_theme.js remains
  covered by both guards — its own test is untouched.
- **`test/browser_e2e/spec_inventory.json` regenerated** (75 spec files / 329 tests, was 74 / 325): the
  manifest was stale by one file — `action_menu_registration.spec.js` was committed without a
  regeneration, so the gate would have reported a drift this change does not own.
- **The five "Cannot create item with duplicate id" errors are gone — the action menu is registered
  once, from `onInstalled`.** `js/background.js` created its five action-menu entries (`sponsor`,
  `donate`, `buy-me-a-coffee`, `contribute`, `feedback`) at the **top level** of the MV3 service
  worker. Chrome persists context-menu items in the profile and MV3 re-runs the worker script on every
  worker start, so from the second start onward every `create` asked for an id that already existed and
  each call reported an unchecked `lastError` — the five lines the operator read off
  `chrome://extensions`. The registration now lives in a named `createActionMenu()` invoked from the
  **existing** `chrome.runtime.onInstalled` listener (Chrome's own documented pattern for this API);
  ids, titles, order and the `onClicked` dispatch are unchanged, and the entries remain the five asks
  AC-3 pinned (nothing deleted, no monetisation channel unreachable, no sixth ask). Measured over three
  boots of ONE profile with `chrome.runtime.lastError` read inside the callback — the only channel that
  reports this — the duplicate error is gone while all five ids stay `present`. `npm test` **1471
  passing** / 0 failing, lint clean, and the AC-3 browser spec **3 passing** with all five destinations
  `present` after the move.
- **New guard: `test/browser_e2e/action_menu_registration.spec.js`** (4 cases), plus four helpers in
  `test/browser_e2e/_helpers/dom.js` — `__profilePath` on the context, `launchProfileAgain`,
  `serviceWorkerOf`, `probeActionMenu`. The helpers close the hole that made this class invisible:
  every launcher in the harness handed out a **fresh** profile (deleted on close), i.e. exactly ONE
  worker start per case, so a defect that only fires on the *second* start could not occur in any run.
  Falsified against a reverted copy in `temp/` (never the worktree): the **structural** case fails
  (all five creates must sit inside `createActionMenu()`, with **exactly one** call to it, after the
  listener — verified against the hoisted-call revert), while the runtime cases deliberately do not
  claim that half. **What the falsification corrected:** a duplicate `create` errors and removes
  nothing, so after any number of starts all five ids are still present, and `contextMenus.update()`
  cannot tell "created once" from "created and errored four times" — the same blindness that hid this
  from AC-3. The only reporter is the `lastError` of a `create` call, and that call is itself a
  mutation, so the spec asserts on it **only where the id already exists** (where a failing create is
  provably inert) and asks the read-only question everywhere else; the first draft of the spec learned
  this the hard way, going red on boots 2 and 3 because its own probe had registered the id.
  Post-mortem, both blind spots and the falsification:
  `temp/issues/ISSUE_ctxmenu_duplicate_id_invisible_to_gates_20260921.md`.
- **On a short section the action bar no longer covers the centred grip — the bar yields.**
  **SUPERSEDED in this same cycle by the rail-cell fix above**, which deletes the yield rule: a
  level between two controls whose boxes are now disjoint decides nothing. Kept because it is
  the record of option 3 and of what was measured while it stood.
  `section-extra-tidbits-wrapper` (151×62) was the 2.0.1 census failure recorded under Known issues
  below: the bar carries an inline `z-index: 1000000` (`js/main.js:2512`, via `window.Z.ACTIONS_BAR`)
  against the grip's 700002, so on a section short enough for the bar's band to reach the vertical
  centre the revealed buttons sat ON the drag area and a press there landed on
  `be-select-section-button` instead of the grip. `js/print_styles.js` now drops the bar to
  `700001` on exactly the arms that reveal the grip (`.be-active-layer` + `:hover` /
  `:focus-within` on the wrapper, `!important` because an inline level outranks a non-important
  stylesheet rule), so inside the hovered wrapper's own stacking context the ladder reads
  hover-raise 700000 < yielded bar 700001 < grip 700002: the grip wins its own pixel, the bar stays
  fully revealed and usable, and with the grip off screen nothing has moved at all. Two
  alternatives were implemented and MEASURED on the live sheet before this one was kept — hoisting
  the grip over the bar also reaches 22/22 but covers 60% of the Select button including its own
  centre, and nudging the grip clear of the bar puts it 10px off the literal centre the grip was
  promised at. The census assertion no longer allows any exception (it asserts
  `grabbed === probeable`, and `KNOWN_BAR_OVERLAP_EXCEPTIONS` is deleted), and its follow-up block
  checks what the yield must NOT cost: the bar still revealed, `barZ < gripZ`, the Select button
  still reachable at a point of its own box. `test/unit/hover_refactor.test.js` pins the ladder
  (falsified against the pre-fix pair) and adds a LOCKSTEP case that parses the grip reveal's
  selector arms out of `js/dnd.js` and the yield's out of `js/print_styles.js` and requires the two
  sets to be EQUAL — the one check that keeps "the grip is shown" and "the bar has yielded" from
  ever becoming two definitions of one fact. Measured: census 21/22 → **22/22**; the three
  Option-3 browser suites (`affordance_drag_hover_shadows`, `lock_handle_visibility`,
  `drag_glow_layers`) **19 passing / 0 failing**. Reported and resolved in
  `temp/archived/ISSUE_grip_covered_by_actions_bar_on_small_sections_20260914.md` (option 3 chosen
  by the operator; Muse consulted on the loop, all five of his suggestions dispositioned there).
- **The grip no longer sits on top of a short section's action-bar button.**
  **SUPERSEDED in this same cycle by the rail-cell fix above**: the geometry subsystem this entry
  builds (`gripBandFor` / `measureGripBands` / `--be-grip-*` / the `ResizeObserver`) is DELETED,
  because the grip is laid out by the action row now and has no collision left to measure out of.
  `test/unit/grip_geometry.test.js` keeps the file's name but asserts the opposite — that the
  machinery stays gone — and this entry stands as the record of what was tried and measured.
  The original opening sentence continues:
  above left behind — the yield fixed the stacking and nothing else could — was pure geometry: on
  `section-extra-tidbits-wrapper` (151×62) the grip's 34×26 plate is centred at (75.8, 31) and the
  🎯 Select button's 39×32 box at (74.5, 24), so the two centres are 1.3px apart across and 7px down
  and the boxes overlap over 34×22 = 60% of the button, INCLUDING its centre. Whoever is stacked on
  top takes the other one's centre pixel, which is why hoisting the grip and yielding the bar produced
  the same residual. The fix shrinks the grip's plate to the box its nine dots actually paint
  (18×18 — a 12px `gripVertical` glyph plus a 3px ring, so the pointer never reaches further than the
  user can see) and steps it off any control centre it would swallow. Both come from a MEASUREMENT,
  not a constant: `gripBandFor` in `js/dnd.js` is handed the wrapper's box and the boxes of the
  controls inside it (the action bar's buttons, the rotation handle, the resize handle — exactly the
  nodes `isInteractiveTarget` refuses) and scores its candidates (1) no control loses its centre,
  (2) the smallest step from the wrapper's middle, (3) the least box area covered; on the measured
  section that pays **4px of shift, not 22**, and the plate lands at (66.75, 26) 18×18 — the button's
  centre comes back to the button and 20% of its bottom edge stays the grip's.
  `measureGripBands` runs it per wrapper and writes the answer as three custom properties on the
  handle, with the shipped 34×26/zero-shift as the stylesheet's FALLBACKS, so a wrapper that never
  collides is not touched at all: on the live sheet **1 of 22 sections bands** and 21 paint exactly
  what 2.0.1 painted. The decision follows the geometry rather than a call site — a `ResizeObserver`
  is subscribed to every box the pass reads (the layout root's own size does not change when one
  section resizes, and an absolutely-positioned bar that wraps to a second row does not grow its
  wrapper), including a control the cascade hides with `display:none` — a locked layer's rotate/resize
  handle has no box to reason about but is exactly what appears over the centre when the user unlocks,
  and starting to render is the only notification such an element can send (measured in Chromium:
  `0x0` while hidden, then a real box on unlock). The pass is coalesced into a frame because
  `fitContainer` writes a transform inside the boxes it watches, it is re-armed by `cleanupDrag`
  because it refuses to run while `body.be-dragging` is up, and it RELEASES whatever a pass no longer
  reads (`unobserve`) because an observer pins its targets for the life of the tab — otherwise every
  section deleted from the sheet, and every button of every bar the paints rebuild, would leak.
  The offset rides on `translate`, not `top`: with `inset:0; margin:auto`
  both edges are pinned, so a written `top` is split with the leftover space (measured: `top:
  calc(50% + 9px)` rendered at y 38, not 40). Options ruled out with pixels before this was written:
  a transparent `::after` over the dots takes hits but the plate still wins `elementFromPoint`
  THROUGH it, so it buys the button nothing; `clip-path` trims honestly but only a clipped element's
  own border-box, i.e. it is exactly "shrink the plate" — which is what this is.
  `test/unit/grip_geometry.test.js` (10 cases) pins the rule and the cascade, starting from a case that
  reproduces the reported collision from the issue's own numbers so the fixture cannot rot, and
  falsifying the 80px-height estimate with a 104px two-row bar that an 80px rule calls safe. Two of
  them run against a fake observer that counts subscriptions — the only way to see that a deleted
  section releases its boxes, or that a hidden control is watched without being counted — and both
  were falsified (a short-circuited release, and moving the two watch calls below the hidden-skip)
  before being reverted.
  `test/browser_e2e/affordance_drag_hover_shadows.spec.js` now ASSERTS the pixel it previously
  documented as unobtainable — `buttonOwnsItsCentre`, alongside the grip still winning its own
  (smaller) centre and staying inside its wrapper — and the census stays at 22/22. Reported and
  resolved in `temp/archived/ISSUE_grip_box_overlaps_actions_bar_on_short_sections_20260914.md`.

- **The per-section "Auto-scale to fit" switch now takes effect the moment it is pressed, and a
  section the FLOOR cannot fit says so on the sheet and in the panel.** `fitContainer` keys on two
  inputs — the overflow ratio and `data-no-auto-scale` — and the wiring could only ever see the
  first: both observers watched for SIZE (`js/main.js`), switching the feature off changes no size
  at all, and the one call the panel made to force a re-measure, `initResponsiveScaling()`, returns
  at its `installed` guard. So the checkbox flipped, the attribute landed, and the section kept its
  scale until something else resized it — the control was a no-op in both directions on a static
  sheet. Fixed with the issue's option 2 (operator choice): the existing `MutationObserver` now
  also filters on `data-no-auto-scale` and `recheckFor` re-fits the OWNING container straight away,
  which additionally fixes `js/layout_apply.js` writing the flag for every restored section (that
  only ever worked because an apply happens to resize things). The observation lives in the scaling
  feature rather than behind a `requestScalingRecheck` seam the caller has to remember, because
  this is the code that reads the attribute.
  The same pass now stamps **`data-scaling-clipped="true"`** when the scale it applied still leaves
  content outside the box — i.e. when `MIN_SCALE_FLOOR = 0.60`, not the arithmetic, decided — and
  two surfaces render that one fact: `js/print_styles.js` paints a red fade + dashed hairline at
  the clipped edge under `@media screen` (never in print, and as a pseudo-element so no
  children-walk or `> div` selector in the layout record can see it), and the properties panel
  adds a note naming the cause and the two ways out (drag taller, or turn Auto-scale off). This is
  option 1 of the floor issue — *"shrink to fit, but never below a readable size", with the clip made
  visible rather than silent* — closing the decision `56ab1b7` had already implemented in code while
  its issue stayed open. The note re-reads the marker on the microtask-after-the-write rather than
  re-rendering the panel, so it cannot contradict the band and does not steal the checkbox's focus.
  Also closed here: the two scaling cases that pinned the PRE-FLOOR scale (`0.5`, `0.25`) now mock
  overflows whose arithmetic lands ABOVE the floor and assert `scale(0.625)` — so they still prove
  the clamp exists rather than being moved onto it — and the browser spec's `misfit === 0`, which had
  been red on a clean HEAD since the floor shipped, now asserts that the pixels and the sheet's own
  `data-scaling-clipped` claim AGREE in both directions, over a non-empty set.
  Measured: `npx mocha test/unit/responsive_scaling.test.js` went **6 passing / 3 failing → 12/0**
  (9 cases → 12), the new `test/unit/properties_panel_scaling_note.test.js` is **4/0** (its third
  case found a second defect on the way: the re-read is a zero timer and `clipNote` is a per-build
  closure, so a panel rebuilt in that gap made the stale closure add its note BESIDE the fresh one —
  two identical warnings from one checkbox press; `syncClipNote` now adopts what is actually in the
  host, and the case is falsified by removing that step), the browser
  `responsive_scaling.spec.js` is **3/0** (`section-Spells` the one floored-and-marked section, at
  0.60, +260px), and `npm test` (lint + unit + integration + manifest) is **1167 passing / 0
  failing**. The screen-only clip paint was then checked WHERE it could do damage rather than assumed
  harmless: `PRINT_AUDIT=1 npx mocha test/browser_e2e/print_output_audit.spec.js` → **5 passing** on
  the live pipeline — still 4 Letter pages, still a real text layer (3,341 text-showing operators /
  11,979 characters), and none of the tool's own chrome on the paper with the forced-toast control
  still landing on all four pages. Recorded as §9 of
  `vendor/docs/responsive-scaling-wiring-20260913/FIX_REPORT.md`. Reported and
  resolved in `temp/archived/ISSUE_scaling_offswitch_no_remeasure_and_stale_floor_expectations_20260914.md`
  and `temp/archived/ISSUE_scaling_floor_spells_0443_20260913.md`.

### Internal
- Release gate (`node scripts/release_gate.js`) — PASS at the cut. Its browser-suite witness is
  `temp/browser_gate/artifact.json`: serial run started `2026-09-23T00:06:07.257Z`, 5907 s,
  **329 tests collected across 75 spec files → 234 passing / 95 pending / 0 failing**, exit 0, host
  canary `{"boot_tolerated":0}`; all six required surfaces green (`byok_arrange_roundtrip` 7/7,
  `manual_verification_phase0` 2/2, `phase1` 1/1, `phase2` 1/1, `phase3` 1/1, `phase4` 2/2), with
  `js/` last changed `2026-09-22T14:52:44-06:00`. `npm test` (lint + unit + integration + manifest)
  is **1472 passing / 0 failing / 1 pending**, lint clean. No product code changed after the
  artifact was recorded, so the gate covers exactly what ships in this release.
- `package-lock.json`'s root `version` still reads `2.0.1`. It is NOT bumped: no gate or test asserts
  that field (the version-parity contract in `manual_verification_phase4.spec.js` is
  `package.json` = `manifest.json` = newest CHANGELOG heading), and rewriting the lock without a real
  `npm install` would make its diff unreviewable. Recorded here so the next release either settles it
  with an install or deletes the discrepancy deliberately.

## [2.1.0] - 2026-09-20

### Added
- **Bring your own key (BYOK) — your API key stays on this device** (track
  `byok_ai_layout_20260915`). The layout tray's settings row stores the provider (OpenAI or
  Anthropic), the model id, and **your API key — in `chrome.storage.local`, on this device**.
  The key is never written to a file, never included in a layout save, and never placed in a
  message body: the content script asks the extension's own service worker to make the call and
  the worker reads the key from storage itself (`js/ai_settings.js`, `js/background.js`). A
  request to an origin other than the one you configured is refused by the worker before it
  leaves (`provider_origin_lock`). The row is present and visibly disabled until you store a
  key — its tooltip says why, and the flow re-reads the store as its own second gate, so a
  stale button cannot dial a request; storing a key enables it on an event, no reload. Every
  failure has its own sentence — 401, 429, provider down, offline, aborted and no-worker are
  distinct toasts, and a unit case asserts the copy table is exhaustive over the core's error
  classes so a new class cannot ship without one.
- **`PRIVACY_POLICY.md` §2 is now checked against the manifest, both directions**
  (`test/unit/privacy_policy_manifest_parity.test.js`). §2 promises "the minimum permissions
  necessary to function" and the fifth permission (`storage`) plus the two provider origins had been
  added without anything verifying the doc followed. The new case fails if the manifest grants what
  the policy does not name, *and* if the policy names what the manifest no longer grants.

### Internal
- Baseline for the track (AC-7): `npm test` **1167/0 → 1448/0**, the encapsulation oracle unmoved at
  **299/0**, lint clean, browser collection **71 spec files** (was 69) with
  `node scripts/browser_gate.js` green.

## [2.0.1] - 2026-09-14

### Changed
- **Hovering a section no longer washes it in green.** A hovered, draggable section used to carry
  `filter: drop-shadow(0 0 15px #28a745)` twice, animated over 300ms. A `filter` on the wrapper
  repaints the whole subtree — every border, background and piece of artwork in the section — so it
  did not decorate the section, it washed it. The rule is deleted; the stacking raise it shared a
  block with (`z-index: 700000`) stays, because that is the part other rules depend on and it costs
  nothing to paint.
- **Dragging is now done from a handle, not from anywhere.** `button.be-drag-handle` — a nine-dot
  grip (`Icons.svg("gripVertical", 12)`, a new entry in the existing 16px icon set, filled circles so
  a 12px render reads as dots and not rings) — sits at the **centre of each section**, is revealed
  only on the active layer, and is the one control the drag engine accepts as a grab target
  (`isInteractiveTarget` would otherwise have refused it as a `button`; the exemption is checked
  first, so there is exactly one statement of which control is the handle). Invisible *and*
  unhittable at rest — `visibility`, not `opacity`, so it cannot be tabbed to, clicked through, or
  read out by assistive tech — hidden on locked layers, hidden while a drag is held, hidden in print,
  and excluded from the sheet's hue-rotate filters so a recoloured section cannot carry the grip off
  palette.
- **`#print-enhance-controls` casts no shadow.** Four separate declarations piled blurred black onto
  that one panel, each `!important`, so the last one in the sheet won and calming any earlier one
  changed nothing — including an inline `boxShadow` in `js/controls.js` that outranked everything the
  theme layer tried to do about it. All four are gone for this panel. What it keeps is not shadow:
  a `box-shadow` with zero offset-blur is a **frame**, so the blind-tool ring, the leather border, the
  inner hairline and the corner marks of the ornament treatment all stand. The layer manager keeps
  its lift — it was not part of the complaint, and a fix aimed at one tray must not re-tier the pair.

### Fixed
- **Section action buttons appear on the ACTIVE layer only.** `be-section-actions` used to reveal on
  hover for *every* section, "regardless of their status": two of the three reveal rules keyed off the
  LOCK state (`.be-layer-locked`, and `body[class*="be-lock-"]` which is true whenever any layer is
  locked — and this product keeps every layer but one locked), so between them they matched almost
  everywhere. Both are deleted and `.be-active-layer` is now the single mechanism. Because that class
  is written independently of `isLocked`, an active-and-locked layer still reveals its bar, so the
  reachability the deleted rules were written for (a locked layer's own unlock control) is preserved.
- **…and a hidden action bar is no longer clickable.** The bar is created with an inline
  `pointerEvents = "all"`, which outranks a *non-important* stylesheet rule at any specificity, so the
  rest-state `pointer-events: none` did nothing: every inactive section carried invisible 25×32px dead
  buttons over its content, eating clicks. The rest-state rule is now `!important`.

### Internal
- **The backtick-in-a-CSS-comment trap now has a guard that covers every module, not one.** Three of
  this project's files were simultaneously broken by the same mistake while this work was in
  progress: a backtick inside a CSS comment inside the template literal that emits the stylesheet
  *terminates the literal*, so the module throws a `SyntaxError` at load in the browser, with a
  message pointing at prose. `scripts/check_theme_backticks.js` already existed for that hazard but
  only for `js/ui_theme.js`. `test/unit/js_source_syntax.test.js` compiles every file under `js/`
  (parse-only, so no boot code runs), asserts the four stylesheet-injecting modules it exists for are
  actually in the walk so it cannot pass vacuously, and carries a planted copy of the defect to prove
  it reports it.
- **Browser coverage for the three affordances above, added after the release (no version bump — it
  changes no product code, so it belongs to 2.0.1's behaviour rather than to a new one).**
  `test/browser_e2e/affordance_drag_hover_shadows.spec.js` drives a real MV3 extension in Chromium at
  the pinned `SHEET_VIEWPORT` 1920×1080 and covers everything the unit suite structurally cannot: a
  COMPUTED `box-shadow` on the composed page rather than a grep of the emitted CSS, a revealed grip
  probed with a real pointer at its own pixel, and the `:hover` reveal of `.be-section-actions` on the
  active layer versus its absence on a locked one. 13 cases, all green.
  The hue-isolation case calls the product's own seam,
  `test/browser_e2e/_helpers/inject.js` → `setGlobalFilters`, because `window.applyGlobalFilters`
  lives in the extension's ISOLATED world and is invisible to `page.evaluate` — MEASURED: a direct
  call there was `undefined` and the case failed on its own vacuity guard while the product was
  correct. The suite is runnable by name as `npm run test:e2e:affordances`, which raises the pinned
  per-file roster in `test/unit/e2e_plumbing_guard.test.js` from 37 to 38 (the reason is recorded
  there: 13 cases at ~32 s is a 7-minute run worth naming while iterating on the affordances, exactly
  like `test:e2e:glow` beside it). `test/browser_e2e/spec_inventory.json` is regenerated to match —
  69 spec files / 289 collected tests (was 68 / 276) — verified collection-only, without executing a
  browser case, since the gate runner diffs this manifest against the live enumeration.
- **A grip-reachability CENSUS instead of a first-candidate assertion.** The suite walks every
  active-layer section, hides the non-test layers through the panel's own "Hide on sheet" control, and
  counts how many revealed grips win the hit test at their own centre: **21 of 22**. The one that does
  not is recorded rather than hidden — see Known issues.
  Four of the 13 cases carry a conditional `this.skip()` when the live host sheet offers no reachable
  candidate for them (no locked-and-not-active section, no second layer row to flip); that is the
  existing practice across 24 of this suite's spec files, and it is why the pending map
  (`spec_pending.json`) is deliberately untouched — those skips are runtime host conditions, not
  flag-gated captures, so they never enter it.

### Known issues
- **On a section short enough for its action bar to reach the centre, the bar covers the grip —
  filed, not fixed.** `section-extra-tidbits-wrapper` (151×62) fails the census above: the bar carries
  an inline `z-index: 1000000` (`js/main.js:2512`, via `window.Z.ACTIONS_BAR`) and the grip 700002
  (`js/dnd.js`), so on a small section the revealed buttons sit ON the drag area and a press there
  lands on `be-select-section-button` instead of the grip. This is a real regression in reachability
  introduced by the 2.0.1 grip — the grip's pixel used to be section content, which drags — so it is
  recorded honestly rather than asserted away:
  `temp/archived/ISSUE_grip_covered_by_actions_bar_on_small_sections_20260914.md` (three concrete fix
  options, all re-stacking, none attempted here — **option 3 was taken after this release; see
  `2.1.1`, where it is SUPERSEDED: none of the three could fix this, because the overlap was
  never a cascade question. It is CLOSED structurally — the grip is a cell of the action row, so
  no button shares its box (measured `buttonOverlapPx: 0` on every section).**). The census assertion is a **ratchet on the count**
  (`KNOWN_BAR_OVERLAP_EXCEPTIONS = 1`) with the miss list printed, so a stacking regression that makes
  ordinary section content beat the grip blows far past the bound and goes red.


## [2.0.0] - 2026-09-14

### Added
- **A property surface the extension actually owns.** The `1.4.3` extraction of `js/main.js` into
  named modules is the basis for everything above it, and `1.4.8` puts the properties panel on top:
  a pixel font-size slider (8–30px), compact mode, and border style, all live-synced to the active
  section.
- **Real shape layers.** Shapes behave as layers (`1.4.6`, `1.4.18`): split and move flows, a flat
  restackable stack, chip multi-select with batch operations, glow wrappers that drag as one unit,
  uploads from disk that keep their context (`1.4.20`), and per-layer print output (`1.4.7`).
- **A general undo, and a recoverable path for every destructive action** (`1.4.13`, `1.4.14`). One
  reversible-mutation contract — declared once, and loud when a mutation does not declare itself —
  plus a snapshot gate and a newest-first restore surface so a destructive action is recoverable
  after the fact, not only undoable before it.
- **A browser gate that runs by itself** (`1.4.28`): a Playwright suite covering every shipped
  surface (`1.4.10`, 75 specs) turned into a collection-bound, cause-bound gate that refuses to
  overlap, alongside the lint, unit and print-output gates.
- **Evidence, not opinions.** Every criterion above is gated on captured frames or measurements,
  committed under `vendor/docs/` per track.

### Changed
- **`js/main.js` is no longer the application.** Twenty-one modules now own what used to be one
  file; `js/main.js` keeps the boot sequence and the wiring, and the load order is asserted by a
  test rather than by convention.
- **The interface is rebuilt against a token layer** (`1.4.12`) and then re-skinned as "3.5 Codex on
  the Workbench" — engraved display type, blind-tooled band ornament — instead of starting from
  browser defaults and patching them.
- **Drag & drop is a pointer-events engine** (`1.4.9`) with live grid snap, alignment guides, lock
  cursors, clamped always-completing drops, arrow-key nudge and numeric position fields.
- **The picker is one shell** (`1.4.19`) shared by every surface, with grouped families, live
  search, and OK disabled until there is a genuine selection.
- **Modals are ours** (`1.4.15`): 16 native `confirm`/`alert`/`prompt` call sites — 10 of them
  destructive — moved onto a single shared primitive, so the extension asks the user, not the
  browser.
- **The printed sheet is text, not an image of text** (`1.4.27`, 0 → 11,632 characters of real text
  layer), and the extension's own notices no longer print onto the page.

### Fixed
- **Sections that do not fit are scaled into view instead of clipped.** The responsive scaler built
  a `ResizeObserver` and never called `observe()` — measured on the default demo sheet, 8 of 22
  sections overflowed and their content was silently cut off by `overflow: hidden`; ~1,600px of
  content is recovered (`1.4.29`).
- **Panel and header defects from the UX review** (`1.4.17`): unreachable panel bottoms, headers
  that wrapped at every other width, and a slider modal that leaked its `keydown` listener on a
  mouse close.
- **The print layout no longer hides content or the layer manager** (`1.4.7`).

### Notes
- **The 1.4.x numbering is this line's patch chain, not upstream history.** It renumbers the work
  that followed `1.4.2` — the tracks that were originally released as `1.6.0`–`1.17.3` — so the
  sequence is monotonic and every step is a patch. The feature set is the one described above.
- **Nothing outside the extension is tracked.** The self-maintenance harness this project was
  scaffolded with, the runtime unit it pins, its pin file and the gates and reviewer transcripts
  that only police that harness are gitignored (see `.gitignore`), as is `temp/`. They remain on
  disk and the harness still works against them; they are simply not this project's history.

## [1.17.3] - 2026-09-13

### Fixed
- **A section that is too tall for its box now shrinks to fit instead of losing content.** The
  feature that does this has been in the product since it was scaffolded and had **never once run**:
  it built a `ResizeObserver`, wrote 35 lines of scaling logic, and never called `observe()` on it —
  and an observer that observes nothing never fires. Every section whose content was taller or wider
  than its box therefore had the overflow silently cut off (`.print-section-content` is
  `overflow: hidden`). Measured on the default layout of the real demo sheet: **8 of 22 sections
  overflowed**, the worst being Spells — 1,661 px of content in a 736 px box. Now **about 1,600 px of
  content that used to be cut off is scaled into view instead** (summed over those 8 sections), and the
  printed sheet carries **11,632 → 11,884 characters** of text. Still four US-Letter pages, still a
  real text layer, page count unchanged (`vendor/docs/responsive-scaling-wiring-20260913/`, with the
  before/after rasters of every page).
- **…and it keeps working as the sheet changes.** Sections do not exist when the extension boots —
  they are built afterwards, by the layout pass — so watching only what is on the page at startup
  would have left the feature as dead as it was. Sections created later are picked up, and editing a
  section's content re-measures it even when the section's own box did not move (an explicitly-sized
  section does not resize when its overflow grows, so the observer would otherwise never be told).

### Internal
- **The test that "covered" this feature proved a copy of the algorithm, not the product.**
  `test/unit/responsive_scaling.test.js` re-implemented the callback inside the test file and
  triggered *that*, so a missing `observe()` could not make it fail — the same vacuity class as the
  guard that checked the wrong root and the lint gate that had never run. It is rewritten to drive
  the **product's** callback through the **product's** own observer instance, asserting first that
  the wire exists at all. 2 → 8 cases.
- **The gate caught a second defect the wiring created, and this release fixes that too.** Shrinking
  a section compensates by widening its content, and it did so by writing an **inline width** — on
  `.print-section-content`, whose class name ends in `-content` and therefore MATCHES the selector the
  layout record reads (`innerWidths`). A value the FEATURE derived was being persisted as a USER width
  choice, replayed by `applyLayout` at every later sheet size, and restored by undo as something the
  user never set. The sharded browser gate found it as a red undo round trip
  (`innerWidths["0-0"]` `110.469% → 110.392%`, i.e. `100 / scale`); the compensation now travels as the
  `--be-scale` custom property, applied as a `min-width` rule keyed on the same `data-scaling`
  attribute, and a **RECORD SAFETY** unit case re-runs the scan's own selector and fails if scaling
  ever leaves a width there again. The 12-class undo suite is 12/12 in a real browser again.
- **A browser case now asserts the effect, so a missing wire cannot survive again.** New
  `test/browser_e2e/responsive_scaling.spec.js` (3 cases) checks the live sheet in Chromium: that the
  precondition holds (sections really do overflow — otherwise the suite proves nothing), that a
  section carries `data-scaling`, a scale in (0,1) and the top-left origin the CSS rule supplies, that
  the drawn box fits, and that no `ResizeObserver loop` page error was reported. The browser gate's
  inventory is regenerated for it (67 → 68 spec files, 273 → 276 collected).
- **Falsified at both layers, and with the loop guard shown to be load-bearing.** Removing the wiring
  fails 2 unit cases and the browser case (`{"containers":22,"scaledCount":0}` — a real browser sees
  an absent `observe()` with no mock involved); dropping the mutation pass fails 2 unit cases;
  removing the per-container size record fails the stability case. Each plant was watched failing and
  then reverted.
- **Filed for its own decision, not silently tuned:** Spells now scales to **0.443** on the default
  layout — it fits, and it is small on paper. A floor on the scale, or a per-section switch, is a
  product call that needs a legibility measurement rather than a hunch; the committed page rasters are
  the material for it. Filed as its own decision, with the measurements and the four options:
  `temp/archived/ISSUE_scaling_floor_spells_0443_20260913.md` (path as filed; the decision was taken
  in `2.1.1` above — options 1 + 2 together). See §5 of the fix report.

## [1.17.2] - 2026-09-12

### Internal
- **The gates run by themselves now, and one command cannot miss them.** `npm test` runs **lint
  first**, then unit, integration and the manifest check — a `console.log` outside the logger exits
  non-zero and names the file and line. Before this, **nothing in the repository ran any gate except a
  person**: `.github/` held one file (`FUNDING.yml`, so no CI), no script invoked the suite, and
  `package.json` had no `pretest`. That is how the browser suite sat **22 cases red across several
  releases** while every always-run gate stayed green.
- **`eslint` now runs on the tree it lints — and it had never run on a single file.** The ratified
  `no-console` rule was documented as a hard failure and enforced by nothing; worse, the config could
  not express the tree (`js/` is not an ES-module tree, so the CommonJS guard alone produced 52 false
  `no-undef`). Measured: `js/` **145 → 0**, `test/` **6491 → 0**, `scripts/` **291 → 0**. The
  `no-console` rule itself would have PASSED on `js/` all along (**0 violations**), so that convention
  had been holding by review discipline, not by a gate.
- **Three product defects fell out of the first lint run**, two of them filed rather than silently
  fixed: responsive scaling is **inert** (its `ResizeObserver` is constructed and never `observe()`d,
  so the feature has never worked and its test asserts a *copy* of the logic instead of the wiring —
  `temp/issues/ISSUE_responsive_scaling_observer_never_observed_20260912.md` — **wired in 1.17.3, now
  archived to `temp/archived/`**), and
  `ENABLE_PREMADE_TEMPLATES` is a **dead feature flag** this CHANGELOG documents as controlling the
  Templates menu while nothing reads it
  (`temp/issues/ISSUE_dead_feature_flag_premade_templates_20260912.md` — the flag WAS removed by this
  track's Phase 1; the report was only left marked OPEN, and it is archived now too). Three
  `if (<string>)` guards
  left by the selector refactor were conditions that could never fail; they were rewritten to the
  branch that was always taken, which is behaviour-preserving.
- **The browser gate exists, and it cannot pass by skipping.** `npm run test:browser-gate` (and, once
  the operator registers it, a scheduled task) runs the real extension in Chromium and writes a
  machine-readable artifact. It **fails** — with no green artifact — if a spec file drops out of
  collection (naming it), if the pending set stops matching its committed cause map, if collection is
  **empty**, if any case fails, if another run holds the guard file, or if the executed set does not
  account for the collected set. The exit code is derived from collection *and* execution, so "the
  script finished" is not a pass.
- **Sharded runs are set-identical, not just faster.** 4 shards diffed case-by-case against one full
  serial run: same passing, same failing, same pending. Measured **88.5 min serial → 23.4 min sharded
  (3.78×)**; the bound is the demo host and disk, not CPU, and the `[boot] tolerated` host marker is
  carried in every artifact as the canary.
- **It found a regression on its first unsupervised run**, which is the best argument for it existing:
  a lint edit had deleted a `page.evaluate` whose *call* was the test (it clicked "Add Shape"), so
  adding a shape by that path silently stopped working. Lint was clean *because* the deletion was a
  lint fix, `npm test` was green, and dead-export tracking saw nothing — only a browser run could
  tell.


### Fixed
- **Your printed sheet is now real text you can search, copy and select.** It was being printed as
  **images**: the whole PDF carried **zero** text and just 17 vector paths for four pages, so
  "Shillelagh" was not findable in the printout and nothing could be copied out of it. The cause was
  measured: the tool wrote its filter chains as CSS custom properties on `:root`, and at the default
  settings those chains were *identity* filter strings (`hue-rotate(0deg)`,
  `contrast(100%) saturate(100%) …`) — an identity filter is still a filter, so Chromium rasterised
  every section. Neutral chains are now written as `none`. Measured on the live sheet: **0 → 3,263
  text-showing operators, 0 → 11,632 characters, 17 → 12,613 vector paths.**
- **Your own filter settings still reach the paper, exactly as before.** A filter that can change a
  pixel is emitted verbatim, so the fix is invisible unless every part of a chain is provably a no-op —
  including the default Greyscale of 100%, which is *not* a no-op and would have un-greyed the
  ornaments had the fix been written as "all sliders at their defaults". Verified with the panel's own
  sliders: setting Greyscale to 0% puts colour on the paper, setting Hue to 90 rotates it, and putting
  them back gives a byte-identical file to the default run.

### Internal
- Also fixed while verifying: running the print-audit suite *without* its flag overwrote its own
  committed evidence (`vendor/docs/print-output-audit-20260911/measurements.json`) with `{}`, because mocha
  still runs an `after` hook for a skipped suite. The write is guarded now, and a skipped run is
  proven to leave the file untouched.
- The print audit's last case used to *record* the sheet's operator inventory and deliberately not
  assert it, because a suite requiring `textOps === 0` would have failed this fix for fixing it. It now
  **requires** the text layer (`textOps > 0 && chars > 1000`), so a regression that starts rasterising
  the sheet fails the audit instead of being discovered in the next one. Cause pinned at unit level by
  `test/unit/print_identity_filters.test.js` (7 cases; 4 of them fail against the pre-fix code).
- A second self-skipping probe measures what the audit cannot: whether a chain with every filter
  slider at its DEFAULT value is really neutral, and whether a setting the user makes still reaches
  the paper. It drives the panel's own sliders and asserts both:
  `PRINT_FILTER_PROBE=1 npx mocha test/browser_e2e/print_filter_identity_probe.spec.js`.
- `vendor/docs/print-sheet-text-layer-20260911/FIX_REPORT.md` carries the before/after numbers, the two
  candidate rules measured against each other, and the limits this fix states rather than hides
  (the file is *bigger* now — 5.98 MB → 8.08 MB — and a filtered sheet is still rasterised).
- **The one item the gate track left to the operator is now assigned in writing, to the project that
  owns the fleet's Task Scheduler surface.** Handoff filed 2026-09-13 to that project's issue inbox:
  author the wrapper script there and register the browser-gate task as a **SYSTEM** task
  (operator's choice, a deliberate
  override of the "run only when user is logged on" shape our own fragment recommends), daily, 2 h
  limit, wrapper **must** set `PLAYWRIGHT_BROWSERS_PATH` (a SYSTEM task's `%USERPROFILE%` is the
  systemprofile, so Playwright's browsers would otherwise not be found). Nothing on our side runs or
  registers anything — the no-manual-deploy rule stands — and **the schedule is still absent until ORCH
  reports a green first run** (verified in both places: `LastTaskResult` *and* a
  `green`/`collection.status: ok`/`execution.status: pass` artifact, with a documented fallback to the
  interactive logon type if session 0 cannot launch Chromium). The annotation in
  `vendor/conductor/archive/gate_coverage_20260912/final_report.md` §6.1 records this against the open item it
  leaves standing, and `temp/scratch/probe_handoff_claims.py` checks every request-side fact the
  handoff asserts (26 checks, all pass).

## [1.17.1] - 2026-09-11

### Fixed
- **The tool's own messages no longer print onto your sheet.** If a notice was on screen when you
  printed — the "No saved layout yet" note after a fresh load, a save confirmation, an undo offer, an
  error — it was printed at the top of **every page**, because the notice is pinned to the window and
  the print stylesheet never hid it. Measured on the real printed output: that sentence was the only
  text in the whole PDF, on all four pages. The same gap meant a dialog left open would print its dark
  backdrop over every page. All of the tool's own surfaces are now hidden when printing.
- The print stylesheet hid exactly one dialog **by its id**, which only one dialog in the product
  carries; every other dialog was hidden by luck rather than by rule. They are now hidden by their
  shared class, so a dialog added tomorrow cannot print over a sheet.

### Internal
- **The printed output is now looked at, not just described.** A new gated suite prints the live
  sheet through the real extension and measures the PDF the printer receives — page box, where the
  ink actually sits on the page, per-page coverage, and what the file carries — so "does the printout
  look right" has an answer that is not a screenshot of the page it came from. It found the defect
  above on its first run, and reports (without asserting) that the sheet reaches the paper as images
  rather than text, which is filed separately. Reading a PDF back to pixels needs a rasteriser and
  this machine has none (no poppler, no ghostscript, no ImageMagick; `sharp`'s libvips has no PDF
  input, and headless Chromium downloads a PDF instead of rendering it), so `pdfjs-dist` is pinned as
  a devDependency and driven in a page served by a dependency-free static server.
- The margins claim of the README is re-confirmed on the printed page rather than on the file size,
  with a control proving the measurement can see a margin at all. The earlier track's "noise floor"
  of 37,200 bytes is corrected: that was the boot notice disappearing between two renders, not PDF
  metadata noise.
- `vendor/docs/print-output-audit-20260911/audit_report.md` carries the method, the page-by-page numbers,
  the two visual-gate verdicts and the limits this audit states rather than hides.

## [1.15.1] - 2026-09-11

### Fixed
- **Rotating a shape and then undoing no longer re-applies the angle you just undid.** The undo
  record for a rotation was taken from a reading that could land *after* the rotation was written,
  so undoing it put the new angle back instead of the old one. The record is now taken from the
  value the shape had when the gesture started, which is what an undo is supposed to restore.

### Internal
- One capture-and-push protocol for the undo stack, where three copies (one a verbatim duplicate)
  had drifted apart; the shared helper now repairs a record taken mid-gesture, and a guard fails if
  a second implementation reappears.
- The mutation-class vocabulary is declared once, and an undeclared class is now reported instead
  of silently recorded as `unknown`.
- `js/persistence.js` (which owned the backup store, the undo stack, the restore surfaces and the
  destructive gate in 1,583 lines) is split into `js/undo.js`, `js/recovery_ui.js` and itself. No
  user-visible behaviour changes; the window-level seams keep their names.
- One destructive-gate helper, one logger and one z-index declaration instead of three, three and
  eleven scattered copies; `no-console` is now a lint error outside the logger.
- The browser test harness shares one capture helper across twelve specs, and the duplicated
  per-file npm scripts were retired. No product code is involved.

## [1.16.0] - 2026-09-11

### Added
- **A "?" in the control panel's header opens a gestures-and-shortcuts reference.** Until now the
  extension taught three gestures — drag to move, drag a corner to resize, use the handle to
  rotate — once, in a card that never came back, while its other interactions were discoverable
  only by accident: **double-click** a block to extract it, **right-click** a layer for its menu,
  and **Ctrl+Z / Cmd+Z** to undo. All of them, plus selecting and nudging, are now named in one
  place that is always a click away. It opens the extension's own dialog, so Escape, the close
  control and a click outside all dismiss it.
- **The undo control says how to undo from the keyboard.** `Ctrl+Z` / `Cmd+Z` has been bound for
  a while and was never announced anywhere in the interface.

### Changed
- **More restore points, and the two kinds of "go back" are now told apart.** The automatic
  backups taken before destructive actions kept only the **newest 3**; they keep the **newest
  10** now. The restore dialog says what they are for — the copies are saved in this browser, so
  they are still there after a reload — and the Undo control's tooltip says its history covers
  **the current session only**. They do different jobs and no longer look alike: Undo steps back
  through what you just did, the backups are where you go after a reload or for anything older.
- **The message shown when a change is refused is short enough to actually read.** It used to
  spend its first clause on an explanation; it now leads with what happened ("Nothing was
  changed"), names the cause, and ends with the next step. The full explanation — including why
  a delete needs a backup at all — is still there, in a dialog that stays open.

### Notes
- **One reported defect was withdrawn after measurement.** The project had recorded that a
  non-ASCII character in an injected script renders as mojibake, on the strength of an earlier
  visual capture. Measuring it in a real browser through the real injection path — the ellipsis
  itself, the degree sign, the emoji, the close glyph — showed every one of them rendering
  **correctly**, so the claim is retracted and nothing was changed for it. The record is in
  `vendor/conductor/tracks/ux_gaps_20260911/phase1_classification.md`.
- **The panel's layout was measured and deliberately left alone.** Print, both Save controls,
  Undo and Restore backup are already above the fold at the standard window size, and the
  occasional-use colour filters are below it. No control was moved.

## [1.17.0] - 2026-09-11

### Changed
- **The first-run card now points at the gestures reference instead of being a dead end.** The
  card teaches three gestures and, until now, its **only** control was its permanent dismiss — so
  the product's single moment of instruction ended by deleting itself, while five of the eight
  gestures the reference lists were taught nowhere at first contact. The card now carries a **?**
  (keyboard-reachable, on the icon height tier) that opens the same gestures-and-shortcuts dialog
  the panel header opens, and its sentence is **derived from that same list**, so the two surfaces
  cannot drift apart again. Its accessible name is now scoped to what it teaches
  (`"Three gestures to get started"`) rather than claiming to cover the sheet's gestures as a set.
  *Cost, measured:* the extra control narrows the hint's text column, so the card goes from three
  lines to four — first-run panel content 1194 → 1210px. The card is removed from the DOM once
  dismissed, so the panel a returning user works in is unaffected.
- **The print settings are named in-app, at the moment you print.** The README had always told you to
  set six things by hand in the browser's print dialog, and the extension itself said none of them —
  so the step that most decides whether the printout is right was documented only where you are not
  looking. A **Print settings** control now sits beside **Print** and lists what to set. **Print
  itself is unchanged**: it still opens the print dialog immediately, with nothing in front of it.
  *Measured, and it cut the list:* the extension's own print CSS declares `@page { margin: 0 }`, which
  **overrides the dialog's margin setting** — so the four manual margin values you were asked for did
  nothing, and they disagreed with the CSS anyway. They are gone, and the guidance says so. The other
  four settings stay, because the measurement showed they still change what prints (scale 18×, and
  background graphics 8×, the render-to-render noise floor). Headers and footers were kept too: their
  effect was *below* that noise floor, and a setting is only dropped on a measurement that resolves
  it. Method, numbers and limits: `vendor/docs/first-run-and-panel-20260911/phase2_print_settings.md`.
  *Cost, measured:* one more control takes the panel to 24 controls and its content 1210 → 1246px.
- **The funding and feedback links moved out of the panel, into the extension's own menu.** The
  panel used to carry **Feedback** (a bug-report link) and **Contribute** (a fundraising link) as two
  rows of a tray labelled **HELP**, side by side. They now live on the extension's toolbar-icon menu,
  where the sponsorship links already were, so the panel is only ever about arranging and printing
  your sheet. **Nothing was removed**: the bug tracker, the project page and all three funding
  destinations are reachable from that menu — verified in the browser against Chrome's own menu
  registrar, not by reading source. The now-empty **HELP** tray is gone with them, and the panel is
  **smaller than it was before this release** as a result (−74px of content, two rows and a heading).
- **The extension can be turned off, and it now says when it is on.** There was no way to switch it
  off from inside the page: activating it was one-way, and the only escape was minimizing a panel
  that cannot actually be dismissed — so getting a clean sheet meant reloading the tab by hand
  without being told that. A **power control** in the panel header now does it: it saves your layout
  first, then reloads, and the page that comes back carries **none of the extension** (verified in
  the browser: not one of the seven stylesheets, layers, wrappers or listeners survives). The
  toolbar icon shows **ON** while the tool is running and clears the moment you turn it off or the
  page navigates — which is also how you tell, at a glance, whether the extension is active on the
  page you are looking at. Turning it back on is a click on that icon.
- **The panel can be folded, so it stops covering the sheet.** Each of the panel's four sections —
  **LAYOUT**, **OUTPUT**, **PROPERTIES** and **CANVAS FILTERS** — now has a header you can click (or
  reach with the keyboard) to fold it away. Folding every one takes the panel's content from
  **1120px to 323px** and its overflow from **+534px to zero**: it fits, and every control is still
  there when you unfold it. The headings state their state for screen readers, keyboard focus is
  never left inside a folded section, and **nothing was removed or moved to make room** — the order
  and the controls are exactly as they were. The fold is deliberately not remembered between visits.

### The track's acceptance criteria, and what happened to each

Nothing was dropped and nothing was retracted: every criterion was measured rather than assumed, and
two produced *corrections* to the claims that motivated them. Each phase's GATE 3 record is beside
its plan (`vendor/conductor/archive/first_run_and_panel_20260911/`).

| Criterion | Disposition |
|---|---|
| **AC-1** two gesture surfaces that cannot disagree | **SHIPPED** — the card's sentence is *derived* from the reference list, and the card gained a keyboard-reachable `?` |
| **AC-2** print settings named at the moment of printing | **SHIPPED**, and it **cut one of six instruction groups**: the extension's own `@page` rule overrides the dialog's margins, so the four manual margin values were provably no-ops (measured against a noise floor with a control). The other four stay and headers/footers was kept because the probe could not resolve it |
| **AC-3** funding asks separated from the help surface | **SHIPPED** — moved to the extension's own menu, verified as *relocation* at runtime through Chrome's menu registrar; nothing deleted, ask count unchanged |
| **AC-4** turn it off, and say whether it is on | **SHIPPED** — a header power control (saves first, then deactivates) and an **ON** badge cleared on navigation. It also **corrected F-4's mechanism**: the injection adds 7 stylesheets, 4,058 nodes and removes 20 site nodes, so "off" is a reload rather than an in-place unwrap |
| **AC-5** the panel can be reduced without hiding a control | **SHIPPED** — foldable groups take the content 1120 → 323px and the overflow +534 → 0px, with 28/28 controls reachable and the inventory unchanged |
| **AC-6** release and record | **MET** — this entry, with every criterion's disposition, and the gate list green |
| **AC-7** truth before action | **MET** — all six findings re-measured before anything was built; **zero retractions, two corrections, one added sub-finding**, reported plainly here |
| **AC-V1 / AC-V2** browser evidence and the geometry rule | **MET** — four browser suites (14 cases) against the real unpacked extension with committed frames, and the archived viewport-label defect closed by rule |

### Fixed
- **Corner resize and rotate work again.** Both handles were being hidden on *every* element
  whenever any layer was locked — and the editor always keeps all but one layer locked — so
  dragging a corner to resize, or using the rotate handle, silently did nothing for most users.
  The rule now applies only to the layer that is actually locked; a locked layer still hides
  its own handles exactly as before.
- **Undo now covers moving several shapes at once.** Batch "Move selected to layer..." recorded
  nothing at all (the recording step ran after the function had already returned), so a
  multi-shape move could not be taken back. It records once for the whole batch, and an undo
  puts every shape back.
- **Switching a shape's art is undoable correctly.** The undo used to restore the new artwork
  together with the *old* border and decoration, i.e. a shape that was neither state. The
  previous artwork is now recorded before the switch, so an undo really goes back.
- **Undoing a move no longer leaves the element brought to the front.** Clicking an element to
  start a move also raises it above the others; the undo restored the position but left the new
  stacking, so the element stayed in front. Stacking is recorded and restored too.
- An undo can no longer leave a value it could not clear: restoring now writes back empty values
  (for example a cleared z-order) instead of skipping them and leaving the newer value behind.

## [1.15.0] - 2026-09-11

### Added
- **Undo now covers every change, not just deletes.** Until this release only the LAST
  destructive action could be reversed, and nothing else could be reversed at all. There
  is now a real **undo stack**: drag to move, resize a corner, rotate, reorder layers,
  move a shape to another layer, toggle compact mode, change a border or a shape, flip a
  layer's lock / print / visibility, rename a layer, add or clone things — all of it can
  be taken back, newest first, one change at a time.
- **Ctrl+Z / Cmd+Z.** The keyboard route, alongside the panel control. It deliberately
  does nothing while you are typing in a text field, so your typing keeps the browser's
  own undo.
- **An "Undo: ..." control that says what it will undo.** The control panel entry names
  the action and its subject ("Undo: Toggle \"Actions\"") instead of a bare "Undo", and
  it is disabled — not silently inert — when there is nothing to undo.

### Fixed
- **Undoing no longer reverts edits you made since the last save.** The old undo restored
  the layout as it was last *saved*, so anything you had changed since — a drag, a resize
  — was thrown away with it. The undo record is now taken from the live sheet.
- **A shape dragged while a ghost was on screen could be recorded wrongly.** The drag
  mirror is a clone of the dragged element, so a layout snapshot taken mid-drag could
  capture the clone instead of the real thing. Snapshots now ignore transient drag
  artefacts — this also affects a save that fired mid-drag.
- **A recorded empty value was not restored.** Restoring used truthiness checks, so an
  element whose recorded size or z-order was empty came back with a computed value
  instead. It now restores what was recorded. The same fix stops a missing asset path
  coming back as the literal text "undefined".

### Notes
- The undo history is **per session**: reloading starts fresh. Recovery across a reload
  stays the job of the automatic backups behind **Restore backup...**, which are
  unchanged (and are written before every destructive action exactly as before).
- Canvas filters (hue / contrast / saturation) are **not** part of the saved layout, so
  they are not on the undo stack; see `vendor/docs/undo-stack-20260911/` for the measurement.

## [1.14.0] - 2026-09-11

### Added
- **Undo.** After a destructive action the editor now offers one **Undo** control with
  the message telling you what happened, so a mis-click on Delete Layer no longer costs
  you the layer and every shape in it. The offer is single-use and expires on its own —
  when it is gone it is really gone, not a button that quietly does nothing.
- **"Restore backup..." in the control panel.** A backup is written automatically just
  before any destructive action, and this entry lists them — what each one was and when
  — so you can go back to the state before it. Until now the only way to restore a
  backup was to have a saved layout *fail* to load first, which is not a recovery you
  can plan around.

### Changed
- **A backup is written before every destructive action, not just Reset.** Deleting a
  layer, deleting a shape, deleting a batch of shapes, deleting a clone, merging two
  sections, splitting a skills box, and loading a layout file all snapshot the layout
  first. If the backup cannot be written the action is **refused** and you are told why,
  rather than proceeding with no way back.

### Fixed
- **Deleting a layer now says what it is about to do and can be undone.** It was the
  easiest destructive action to trigger — the button sits in every layer row — and one
  click took the layer and all its shapes.
- **Merging sections and splitting a skills box can be undone.** These two changed your
  layout irretrievably and did not even ask for confirmation; they are now reversible
  (and snapshotted) like the deletes.
- **The control panel's new entry no longer renders a broken character** (an ellipsis in
  an injected script is not decoded as UTF-8 by the browser; the same class of defect
  fixed on the previous release).

## [1.13.3] - 2026-09-10

### Added
- **A first-run hint that the sheet is yours to arrange.** Drag-to-move,
  corner-resize and the rotate handle only appeared on hover, so a new sheet
  looked like a static printout. One small card names the three gestures the
  first time you open the editor; press "Got it" and it never comes back. It lives
  inside the control panel, so it never covers what you are arranging.
- **A selected shape is now as obvious as a selected section.** Choosing a shape
  outlines it exactly the way choosing a section does, and the layer panel's
  highlight follows your selection rather than the layer new shapes would land in.

### Changed
- **The layer row's two controls say what they do.** "Toggle Print Visibility" and
  "Toggle Layer Visibility" were two names for one question; they are now
  **Skip when printing** (print exclusion) and **Hide on sheet** (on-screen
  visibility), each announced to assistive technology as well.
- **One verb per kind of action.** Destructive dialogs say **Delete**, dialogs that
  carry an action through say **Continue**, dismissals say **Cancel**, and a
  dialog that opens another step now always ends in an ellipsis (`Continue…`).
  The engraved small-caps headings and the sentence-case tool labels are unchanged
  — that contrast is deliberate.
- **Smaller windows are usable.** On a narrow window the two docked panels used to
  march across the sheet; they now narrow in stages and the layer panel collapses to
  its header — which always carries a **Restore** control, so rows are never
  stranded — leaving the sheet most of the width at every size.
- **Dialogs always fit the window.** The shape picker and the template catalog
  forced their own pixel width and could overflow a narrow window; both now follow
  the shared dialog rule.

### Fixed
- **The selection is one thing now.** Before, "what is selected" was tracked
  separately by the sheet, the layer panel and the properties panel, and they could
  disagree: selecting a section did not mark its layer row, and clearing the
  selection left the row highlighted. Selecting on the sheet, selecting by layer
  row and clearing now move all three together, and clearing genuinely clears.
- **Colours from outside the palette are gone.** The delete/context-menu red and
  the compact toggle's green-and-red came from outside this product's palette; every
  such value (33 of them in the three files that carried most) now uses the locked
  tokens, so the editor's chrome is one consistent system.
- **A layer's own delete confirmation could be skipped.** The delete test relied on
  a native browser confirm that this product stopped using in 1.13.0 — the dialog was
  never accepted, so nothing was deleted and the check passed anyway. It now
  confirms in-app, which is what it always claimed to test.

## [1.13.2] - 2026-09-10

### Added
- **Every notification can be dismissed.** Each toast now carries a small ✕ —
  click it, or press Escape while it has focus — and dismissing one is announced
  to screen readers. The toasts also no longer pile up on top of each other: they
  stack down the top of the sheet, so each one is readable and its ✕ is actually
  clickable (they used to be drawn at the same spot, one covering the next).
- **"Nothing found" now explains itself and waits for you.** "No clones found",
  "No available targets found" and "No compact-compatible sections found" used to
  be toasts that vanished after three seconds — look away and you were left with
  an unchanged sheet and no idea why. Each is now a dialog that stays until you
  dismiss it, and each suggests the next step.
- **The layer right-click menu works from the keyboard.** It is a real menu now:
  it opens with focus inside, the arrow keys move between items (wrapping), Home
  and End jump, Enter activates, and Escape closes it and puts focus back on the
  layer you right-clicked. It also stays on screen: right-clicking near the right
  or bottom edge used to open it partly or wholly off the edge, where the items
  could not be reached at all.

### Changed
- **The extension now tells you that your saved layout loaded.** Starting a
  session used to be silent, so "my layout is back" and "we loaded the default"
  looked identical. Each boot now confirms which one it was, in one line.
- **Toasts can no longer drop a failure on the floor.** The stack cap used to
  remove the OLDEST notification whatever it was, so a rapid save/error sequence
  could discard an error before it was read. Errors are now kept, and the cap
  applies only to the ordinary ones.
- **"Rename layer" says when nothing changed.** Submitting the same name used to
  close the dialog in silence; it now reports that the name is already the
  layer's.

### Fixed
- **A spell detail that could not be restored now says so.** If recreating a
  merged spell fails, the remaining spells are still restored and you get one
  message naming the ones that did not come back — previously they simply did not
  appear, and the layout quietly differed from what you saved.
- **The spell error no longer blames the wrong thing.** It used to tell you to
  "add the spell from the manage spells button" for every failure, including a
  temporary network problem. That instruction now appears only when it can
  actually help (the spell really is not on this character's list); a temporary
  failure says so and points at Retry.

## [1.13.1] - 2026-09-10

### Changed
- **Internal only — no change to anything the extension does in the browser.**
  The cross-module export surface was audited end to end and trimmed: six dead
  exports are gone (`window.UiTheme`, `Modals.showSliderModal`, `Icons.iconEl`,
  `Icons.names`, `ShapePicker.handleUploadFromDisk`,
  `ShapePicker.SECTION_STYLES_TAB_LABEL`), each with zero callers anywhere in
  `js/`, `test/` or `scripts/`. The exports kept although nothing in `js/` calls
  them now document why at their declaring site (`window.__lastUploadInput`,
  `window.CatalogService`, `window.restoreFailureCard`) — these are test seams,
  and a comment is cheaper than re-litigating them next time.
- The audit is now a committed tool, not a one-off: `scripts/audit_dead_exports.js`
  prints every export on both surfaces (the `window.*` assignments *and* the
  members of every exported namespace object) with per-area reference counts and
  one of three verdicts, and `scripts/check_dead_exports.js` fails the suite when
  a new export appears with no caller and no explanation. The U-22 listener-leak
  test was re-pointed from the retired slider dialog onto the input dialog, so the
  invariant is asserted against a dialog the product actually opens.
- Full suite 853 → 852 passing, 0 failing (−10 cases that existed only to drive
  the retired dialog, +9 for the audit, the annotation rule and the new guard);
  encapsulation debt oracle unchanged at 299. See
  `vendor/docs/dead-exports-20260910/notes.md`.

## [1.13.0] - 2026-09-10

### Changed
- **Every confirmation in the extension is now an in-app dialog.** Deleting a
  layer and its contents, deleting several selected shapes at once, deleting a
  section, a clone or a shape, applying a template over your existing shapes, and
  the reload prompt all used the browser's own blocking `confirm()` — unstyled,
  announced as browser chrome, and **silently skipped altogether** if you had
  ticked "prevent this page from creating additional dialogs", which could leave
  a destructive action looking like it simply did not run. They now use the same
  themed dialog as the rest of the extension, and a dialog you dismiss is always
  read as "no".
- **Error alerts are now the extension's own toast** rather than a blocking
  browser alert: failed template loads and applies, failed image processing, and
  the "close other D&D Beyond tabs" database message. They are announced to
  screen readers and no longer stop you mid-action.
- **The last three dialogs without proper affordances are converted**: the append
  target picker, Manage Clones and Manage Compact now have a ✕, backdrop
  dismissal, Escape, and move focus in when they open (they could previously
  only be left via their own Close button).

### Fixed
- **The shape picker and templates catalog now put focus inside themselves when
  they open.** They were keyboard-reachable only after tabbing in from the page
  behind them; the picker lands on its search field and the catalog on its first
  card, and both return focus when closed.
- **The "Delete clone" confirmation named the wrong thing** — it read the page's
  `window.name` instead of the clone's title.

## [1.12.0] - 2026-09-10

### Added
- **Dialogs are now real dialogs.** The name prompt, the value slider and the
  layout-JSON fallback all open as proper dialogs: they are announced as dialogs
  to screen readers by name, they can be closed with a **✕**, by **clicking the
  backdrop**, or with **Escape**, and **focus moves into them when they open and
  returns to wherever you were when they close**. Previously only some of the
  extension's dialogs could be dismissed any way other than their own buttons,
  and the three above had none of it.
- **The recovery card shown when a saved layout fails to restore is now
  dismissible** (✕ / backdrop / Escape) instead of forcing you to pick one of
  its two recovery actions.
- **A rejected empty name now says so.** Clearing the name field and pressing OK
  used to close the dialog and do nothing at all — no message, no change, and no
  way to tell whether the app had ignored you or refused the value. The dialog
  now stays open, marks the field, and shows **"Enter a name to continue — the
  field cannot be empty."** in the warning colour.

### Changed
- **The layout-JSON fallback card tells the truth about why it is there.** It now
  says the download **failed** and that nothing was saved, instead of implying a
  generic problem — and its copy button no longer claims "Copied!" when the
  browser refused the copy; it selects the text and tells you to press
  Ctrl/Cmd+C.

### Fixed
- **The name field in dialogs no longer appears as a white box** on the dark
  panel. The D&D Beyond page's own stylesheet was overriding the field's
  background; the extension's styling now wins.
- **Dialogs no longer leak key/click handlers.** Every way out of a dialog now
  cleans up after itself, so a later Enter cannot re-trigger a dialog that is
  already gone. A slider dialog that leaked this way was fixed in 1.11.3; this
  release makes it a guarantee across all of them, enforced by a test that
  counts attached handlers rather than trusting the code.

## [1.11.3] - 2026-09-10

### Fixed
- **The value slider dialog no longer leaves a stray keyboard listener behind.**
  Closing it with the mouse (Cancel or Apply) used to leave its Enter/Escape
  handler attached to the page permanently, so pressing Enter later could
  re-trigger the dialog's Apply action on a dialog that was already gone — and
  every time you opened it again another handler piled up. All four ways out of
  the dialog (Cancel, Apply, Enter, Escape) now clean up after themselves.

## [1.11.2] - 2026-09-10

### Fixed
- **The bottom of the left control panel is now reachable.** The panel's content
  is taller than most screens (1156px against a 900px window) and the panel is
  pinned to the viewport, so the bottom third — the **CANVAS FILTERS** sliders and
  **Reset Filters**, and the **Contribute** link — fell below the fold and could
  not be scrolled to at all. The panel header stays pinned and the rest of the
  panel now scrolls, so every control is reachable on a laptop screen. The same
  cap was applied to the right-hand layer panel, which had the same problem on
  shorter windows. Both scrollbars are styled to match the extension rather than
  showing the browser default.

## [1.11.1] - 2026-09-10

### Fixed
- **The "Beyond Print" panel header no longer wraps onto two lines.** It was
  being given 80px of width for 131px of text — the same row also held the
  TEMPLATES chip and the minimise button — so it broke onto two lines and looked
  cramped. The panel's title now owns its own line, with the minimise control at
  its right and TEMPLATES on a row beneath it.
- **All headers are now the same size.** They had drifted across 12px, 13px,
  14px and 18px (the layer-panel header, the panel title, the tray and section
  headers, and the modal title respectively). They now share one recipe —
  Cinzel at 14px, weight 700, the same tracking and casing — and none of them
  can wrap any more, whatever the label.
- **More breathing room around headers**, and consistent spacing between them
  (group headers, the panel header and the modal title all got padding and
  margins they did not have before).
- **The modal title's bottom padding was being silently squeezed away** inside
  the shape picker, which let the golden rule under a modal title paint across
  the title text itself. The title's box is now unshrinkable.

## [1.11.0] - 2026-09-10

### Added
- **Golden ornamental double borders on the panels and modals** (track
  `ornament_symmetry_20260910`). The control panel, the layer manager and every
  modal now carry a **double hairline with a leather gap**: a 1px blind tool, a
  1px stamped gold-brown hairline directly inside it, then 5px of bare leather
  and a second hairline 6px in. It is deliberately **not** a filled gold frame —
  antique gold stays light, never fill, and the Print row is still the only gold
  fill in the chrome.
- **Spiky golden corner terminations** on those same three surfaces: a 12px
  corner L in 1px antique gold with a 1px cream inner highlight, four on a modal
  and the top two on each docked panel (the bottom pair would clash with the
  12px workbench buffer at the sheet edge). They are drawn as pure CSS layers —
  no images, no extra elements, and nothing reaches the printer.
- **A centre diamond ornament on the modal header**, matching the one the
  panels already carried, so every ornamented surface has the same primary
  ornament.
- **One consistent height for every clickable control, per tier.** The nine
  different button heights the chrome used to mix (20/22/24/26/27/30/32/34/36px,
  plus a layer row that rendered at 32px next to one at 39.6px) are now four
  fixed tiers: **action buttons 32px**, **icon-only controls 28×28px**,
  **chips and pills 22px**, **text inputs 32px**, and **list rows 40px**. Width
  still fits the content.

### Changed
- **The Print button is no longer taller than its neighbours.** It was 36px
  against everyone else's 32px; it now shares the 32px tier and stays the
  obvious primary action through its gold fill, weight and padding instead of
  its size.
- **A long label can no longer change a button's height.** Labels no longer
  wrap inside the panel; they clip with an ellipsis and the full text is
  available as a tooltip. Two labels that could not fit at the new width were
  shortened — **"Bugs & Feature Request" → "Feedback"** and **"Reset All
  Filters (excl. Hue)" → "Reset Filters"** — each keeping its full text in the
  tooltip.
- The ornament is deliberately **restrained**: context menus and the colour
  picker keep a single quiet rule, and the toasts, in-sheet action buttons,
  cards, pills, tabs and inputs get no ornament at all — the character sheet is
  the thing being looked at, not the tool chrome.

### Fixed
- **The shape-picker search field rendered at 17px instead of its intended
  height** when the asset grid overflowed the modal (the modal is a column flex
  container capped at 86vh, which was compressing the field). Tiered controls
  are now exempt from that compression.

## [1.10.1] - 2026-09-09

### Fixed
- **Reset to Default no longer destroys your saved layout silently** (track
  `ui_ux_review_20260910`). It writes a **timestamped backup before erasing
  anything** (the newest 3 are kept), and the confirmation is now an in-app
  dialog that states exactly what is deleted and that the backup is the only
  way back — replacing a vague native `confirm()`. If the backup cannot be
  written (e.g. storage full) the reset is **aborted** rather than proceeding.
- **A saved layout that fails to load is no longer replaced by the default
  template in silence.** You now get an explicit card naming the failure and
  offering **Restore a backup** / **Start fresh**, with the default applied
  only so the sheet stays printable (nothing is overwritten).
- **Load now warns before it replaces your layout** (naming the file), and the
  version notice is accurate for newer files too instead of always claiming
  the file is "older".
- **Save to PC can no longer fail in silence** — the layout scan runs inside
  its error path and reports a typed error instead of throwing.
- **Legacy layout files fail loudly** instead of loading a broken sheet with
  no explanation.
- **Error toasts are now visually distinct from success toasts** (warning
  glyph + danger accent, and announced to screen readers) so a failure can
  never be mistaken for a success.
- **Grabbing the rotate or resize handle no longer drags the element** as well
  as transforming it.
- **"Locked" no longer means "unreachable".** Adding a shape used to lock every
  other layer and hide all section controls; and a locked layer was made
  completely inert, so its own unlock/hide/delete controls could not be
  reached. Locking now means *not draggable/resizable/rotatable* while the
  layer's controls stay visible and usable.
- **The spell-detail "Retry" button retries** instead of deleting the section
  (it previously re-entered a duplicate guard, said "already open", then
  removed the panel).
- **A chip click no longer clears a multi-selection** in the layer panel — it
  toggles the clicked chip.
- **The rotation handle is themed** (it had shipped with a debug hot-pink
  border and arrow).

### Notes
- Scope was set by a full-surface UX audit (35 findings) reviewed against this
  project's "click once, then print" contract; the remaining findings are
  tracked as follow-up work rather than half-fixed here.

## [1.10.0] - 2026-09-09

### Changed
- **Shape layers — Photoshop-style flat stack & split flows** (track
  `shape_layer_ps_ux_20260909`) — the layer panel now behaves like a flat
  layer list you build by splitting, instead of one giant "Shapes (Default)".
  Gated on the full mocha suite (737/0), the 299-test debt oracle, touched
  Playwright e2e, and a per-phase visual-model gate (MiniMax-M3 verdicts under
  `vendor/docs/shape-layer-ps-ux-20260909/`).
  - **Split & move** (`js/dom/layer_manager.js`): a shape's right-click menu
    gains **Move to New Layer…** (the new layer is named after the shape) and
    **Move to Layer…** (a chooser listing every other layer). Moving reparents
    the real shape between layer containers, so it persists with the existing
    per-layer save format — no schema change. The chip menu is also visible
    now (it had been silently hidden by a global CSS rule).
  - **Flat restack**: layer rows are draggable (gold ghost + gold insertion
    marker) and dropping restacks the layer list, which drives the print
    z-order. The Sections row stays a distinct band always below the shape
    layers, and rows only drag while their layer is unlocked.
  - **Identity**: shape chips show their curated name (not a filename), every
    layer row shows a live item count, empty layers say "Empty — drag a shape
    here", and renaming uses the app's own modal.
  - **Multi-select**: Ctrl/Shift-click to select several shapes, then
    **Split N into their own layers**, **Move selected to layer…**, or
    **Delete N selected** — applied as one atomic batch (a mid-batch failure
    rolls back rather than leaving shapes half-moved).

## [1.9.2] - 2026-09-09

### Changed
- **Custom upload & templates catalog UX** (track
  `custom_upload_templates_ux_20260909`) — two deferred picker-track
  follow-ups, gated on the full mocha suite (711/0), the 299-test debt
  oracle, touched Playwright e2e, and per-phase visual-model gates
  (MiniMax-M3 verdicts under `vendor/docs/custom-upload-templates-ux-20260909/`).
  - **Custom-tab upload no longer closes the picker or drops a shape**
    (`js/shape_picker.js`): uploading saves the shape to your library and
    the picker stays open with the uploaded shape preselected — OK (Add
    Shape / Switch Asset) places it, Cancel is save-to-library only, and a
    toast tells you which verb places it. Double-click/uploads-in-flight are
    guarded; a dismissed file dialog never leaves the button stuck; the
    layer manager refreshes exactly once.
  - **Templates catalog upgraded** (`js/catalog_service.js`): one modal
    shell (the stacked double overlay is gone) with in-modal grid ⇄ detail
    ⇄ confirm views; ✕ / backdrop / Esc cancel (Esc steps back one view
    first); focusable cards with arrow-key navigation; the apply step is an
    **in-modal confirm** (no more native browser dialog).
  - **Real template thumbnails**: `assets/thumbnails/basic.webp` was missing
    and `archer.webp` was a solid-white stub — both regenerated from live
    captures of the applied templates, and every catalog thumbnail now falls
    back to a neutral placeholder instead of rendering broken-dark.

## [1.9.1] - 2026-09-09

### Changed
- **Border & shape picker UX** (track `border_shape_picker_ux_20260909`) —
  the selector surfaces were unified and reworked end to end, with every
  phase gated on the full mocha suite (697/0), the 299-test debt oracle,
  touched Playwright e2e, and a per-phase visual-model gate (screenshots →
  collage design doc → MiniMax-M3 verdicts under
  `vendor/docs/border-shape-picker-ux-20260909/`).
  - **One picker shell** (`showAssetPickerModal`, `js/shape_picker.js`): the
    separate section-border modal is gone (its 20 hard-coded styles moved to
    the single `SECTION_BORDER_STYLES` catalog in `js/asset_catalog.js`);
    add/switch/style flows share one modal; the legacy entry point is a thin
    add/switch alias.
  - **Honest commit control**: per-flow title + verb (Add Shape / Switch
    Asset / Apply Border Style) and an OK that stays disabled until the
    selection genuinely changes — add mode preselects nothing, so a stray
    Enter can never commit an unintended shape.
  - **Keyboard/cancel integrity + a11y**: Enter activates the focused
    control (focused Cancel cancels — the old trap is gone), Esc/✕/
    backdrop cancel, zero listener leaks across open/close cycles; option
    cells are focusable with arrow-key navigation, `aria-selected` and a
    visible focus ring.
  - **Curated catalog**: 54 assets get human display names + family-group
    headers, with a live search field (name/group/tags) and a proper empty
    state.
  - **Live hover "try it"**: hovering a style or asset tile previews it on
    the real section/shape (dashed-gold outline) with an exact, byte-
    identical restore on leave and on every cancel/commit path; add mode
    shows an enlarged in-modal preview instead. Category-aware preview
    geometry (frame panes vs transparent art panes).
  - Gate hygiene: generated shape-layer ids are now collision-proof (the
    `debt_e9` full-suite flake root cause).

## [1.9.0] - 2026-09-09

### Changed
- **Drag & Drop UX overhaul** (track `drag_ux_overhaul_20260909`) — the
  sheet-positioning drag and the layer-panel reorder were reworked end to
  end, with every phase gated on the full mocha suite, the 299-test debt
  oracle, touched Playwright e2e, and a per-phase visual-model gate
  (screenshots → collage design doc → MiniMax-M3 verdicts under
  `vendor/docs/drag-ux-20260909/`).
  - **Pointer drag engine** (`js/dnd.js`): native HTML5 DnD replaced by a
    pointer-events engine — mouse/touch/pen unified, ~4px movement
    threshold keeps click/text selection intact, locked layers and
    interactive content never arm. Wrappers are no longer native drag
    sources.
  - **Live grid snap + alignment guides**: the drag ghost snaps to the 16px
    grid while dragging (zero release jump) and 1px gold `#C6A15B` hairlines
    render when an edge/center aligns with another section or the sheet
    edge. The misleading green `.drag-over` outline is gone.
  - **Drag feedback**: the custom ghost is near-opaque with a gold frame and
    the source is dimmed with a dashed-gold origin outline; the green hover
    glow is suppressed while dragging and on locked wrappers; locked layers
    show `cursor: not-allowed`.
  - **Always-completing clamped drops**: releases resolve anywhere and clamp
    to the sheet origin (never negative); `pointercancel` aborts cleanly;
    the historical `margin: 0` mutation on drop is removed. Debounced
    auto-save (~1s after the last drop) persists through the existing save
    seam with a "Layout saved" toast. *(Viewport auto-scroll deferred —
    follow-up issue `temp/issues/ISSUE_sheet_overlay_autoscroll_20260909.md`.)*
  - **Precision path**: arrow keys nudge the active section (1px; Shift =
    16px grid step) and the properties panel gains numeric Position X/Y
    inputs, kept in sync after every drop/nudge.
  - **Layer-panel reorder polish**: chips re-sized to the 1.8.0 row language
    (11px bone labels / 34px thumbs), custom mirrored gold-framed ghost, and
    a gold insertion marker at the drop slot.

## [1.8.0] - 2026-09-08

### Changed
- **"3.5 Codex on the Workbench" visual identity** — second-generation
  chrome identity evoking D&D 3.5 nostalgia (2003–07 core-rulebook warmth)
  without cosplay. Implements the design system locked by the 3-round art
  direction consult (`vendor/docs/dnd35-nostalgia-20260908/consult`). Visual chrome
  only; no behavior change (AC-0), gated on the 626-test full suite +
  299-test debt oracle + 3-round Muse visual gate on live captures.
  - Design tokens: `js/ui_theme.js` now injects the leather-and-bone set —
    leather-black grounds (panel `#191410` / tray `#221C16` / well `#120D0A` /
    modal `#1E1813`), blind-tooled seams, bone `#E9DDC2` as text only,
    antique gold `#C6A15B` as light, oxblood `#5E1F1E` / ember `#D86A3D`
    retained for selected/destructive semantics. All 1.7.0 chrome hexes
    retired.
  - Signet Print: the Print action is a flat-gold beveled plaque in a
    ground-well socket — the chrome's only gold fill.
  - Engraved display type: Cinzel→system-serif fallback small-caps with a
    single dark-incise engraving at ≥13px (band titles, modal h3); flat
    11–12px tool labels. Group headers as quiet engraved serif 14px with
    blind-tooled seams; nail-dot group markers.
  - Sheet-edge buffer: 12px ground-well strip + 1px gold hairline where
    chrome meets the bone sheet (never butts leather to bone).
  - Unified range chrome (3px leather track, ringed bone thumbs), ghost
    TEMPLATES / Add Shape actions, Reset All Filters demoted off the gold
    modal-ok fill, PROPERTIES empty state warmed.

## [1.7.0] - 2026-09-08

### Changed
- **UI/UX overhaul (fantasy print-shop design system)** — implements the
  design system locked by the 6-round UI/UX consultant iteration
  (`vendor/docs/ui-ux-review-20260908/consult`). Visual chrome only; no behavior
  change (AC-0), gated on the 626-test full suite + 299-test debt oracle.
  - Design tokens: `js/ui_theme.js` injects the charcoal/parchment/brass/
    oxblood palette as CSS custom properties + a component skin for the
    control panel, properties, sliders, color picker, layer manager,
    context menus, modals and the feedback toast.
  - Icon language: `js/icons.js` 16px SVG line-icon set replaces emoji
    glyphs across control-panel actions, in-sheet action bars/menus and
    layer toggles; layer toggles now expose semantic `data-state`,
    `aria-label`, `aria-pressed` (e2e/unit suites migrated in-commit).
  - Control panel: tray IA (LAYOUT/OUTPUT/HELP) with a top bar
    (title/TEMPLATES chip/collapse), 44px brass PRINT hero in a charcoal
    surround, Contribute as a quiet footer link, PROPERTIES and CANVAS
    FILTERS bands with seam headers.
  - Layer manager: SECTIONS (1)/SHAPES (n) count headers, 32px rows with a
    Print→Show/Hide→Lock→Delete cluster, hide-state dims the whole row,
    lock stays brass-solid, labeled "+ Add Shape" ghost button.
  - In-sheet chrome: destructive actions carry `data-danger` (ember on
    hover only, seam divider above the group); all action glyphs are the
    icon set.
  - Modals/pickers: 640px shared shell with pinned action footer, brass
    underline tabs, brass ring on the selected grid cell, localized 45%
    scrim + blur; color picker gains a "Tint" title card.
  - Toast: charcoal pill over the canvas at y=38 with a brass tick +
    drain bar, pause-on-hover, max 3 stacked (message text preserved for
    e2e).

### Added
- `js/ui_theme.js`, `js/icons.js` (loaded before `js/main.js`).

## [1.6.0] - 2026-09-07

### Changed
- **Encapsulation refactor (behavior-preserving):** the 8,759-line
  `js/main.js` monolith was decomposed into cohesive modules (storage,
  assets, section utils, print styles, section cloning, layout ops,
  filters, spells UI, modals, shape picker, properties panel, controls,
  layout scan/apply, persistence) loaded in dependency order before
  `js/main.js`, which is now an orchestrator. No user-visible behavior
  changed; pinned by the 299-test encapsulation-debt oracle plus the full
  mocha suite.
- **Idempotency fixes:** `createControls()` no longer duplicates the panel
  on a second call; the configured `be-btn-add-shape` id is honored so
  `updateControlsState()` can target it; `injectDnDStyles()` no longer
  appends duplicate style blocks.

## [1.5.0] - 2026-05-03

### Added
- **Centralized Properties Panel:** Introduced a dedicated UI panel above the hue sliders to manage individual section attributes.
- **Active Section Management:** New selection model via '🎯' button to target specific sections for editing.
- **Pixel-based Font Slider:** Granular font size control (8px to 30px) replacing the old percentage-based modal.
- **Proportional Scaling:** Implemented a CSS variable system (`--be-font-scale`) ensuring headers and icons scale proportionally with the body text.
- **Live UI Sync:** Properties panel controls (Font Size, Compact Mode, Border Style) now automatically sync with the active section's current state.

### Changed
- **Persistence Architecture:** Refactored font size storage to include a centralized `applyFontSize` helper, ensuring consistent scaling across all section types (clones, shapes, etc.).
- **UI Refresh:** Replaced text-based property inputs with interactive sliders and live thumbnail buttons.

## [1.4.3] - 2026-05-03

### Added
- **Font Size Slider (Preliminary):** Initial implementation of the font size range slider.
- **Persistence:** Added basic `fontSize` saving for all section types.

## [1.4.2] - 2026-03-24

### Added
- **Templates:** Introduced a new "TEMPLATES" system allowing users to apply professional character sheet layouts instantly.
- **Archer Template:** Full replication of the classic Archer-themed sheet, including custom borders, accents, and dividers.
- **Catalog Service:** Centralized management for template definitions and application logic.
- **New Shape Assets:** Expanded the asset library with `dwarf.webp`, `dwarf_hollow_hand.webp`, and `shield_stats.webp`.
- **Feature Flagging:** Added `ENABLE_PREMADE_TEMPLATES` flag to toggle the template menu (currently disabled for final polish).
- **Color Picker Expansion:** Integrated the **Grayscale** attribute into the 2D Color Picker, allowing simultaneous selection of Hue, Saturation, and Grayscale.

### Changed
- **Asset Compression:** Migrated all image assets from GIF to WebP, reducing the package size from 14.5MB to ~2.1MB (85% reduction).
- **Performance Optimization:** Downscaled high-resolution decorative assets to a maximum of 512px for better loading performance.
- **Metadata Synchronization:** Synchronized `ASSET_METADATA` and `ASSET_LIST` with the `assets/shapes/` directory to ensure all new graphical elements are available in the UI.
- **Workflow Security:** Mandated that all `mocha` tests must pass before any `git commit` is allowed.
- **Grayscale Default:** Changed the default `greyscale` filter value from 0% to **100%** for better out-of-the-box print compatibility.
- **Template Compatibility:** Enabled support for "flat" template formats in `CatalogService`, allowing JSON files from "Save to PC" to be used directly as official templates.
- **Automatic Migration:** Implemented a version-based migration engine that automatically converts legacy GIF paths to WebP and normalizes old layout schemas.

### Fixed
- **Asset Path Integrity:** Resolved missing metadata for several Archer-themed shapes and borders.
- **Template Application:** Fixed a bug where applying a template would sometimes conflict with existing manual element placements.
- **Border Saving Bug:** Fixed a critical issue in `scanLayout` where newer border styles (like "Ornament 1") were not being captured during saving due to a hardcoded check.
- **Shape ID Duplication:** Fixed "undefined" ID issues in the Archer template to ensure correct shape management.

## [1.4.1] - 2026-03-11

### Fixed
- **Hue Filter Color Mismatch:** Resolved a double-hue-rotation bug where borders and shapes were receiving cumulative hue filters (e.g., 114deg + 114deg = 228deg), causing colors to look different from the color picker preview.
- **Standalone Shapes Saturation:** Fixed an issue where shapes added via \"Add Shape\" (not nested in a character section) were missing saturation and hue filters.
- **Saturation Cap:** Reduced the maximum saturation from 250% (or 300% in sliders) to 200% for better visual consistency.
- **Global Filters Architecture:** Refactored `applyGlobalFilters` to separate hue rotation from other visual enhancements using a new `--be-decoration-filter` CSS variable, while correctly identifying nested vs. standalone assets.

## [1.4.0] - 2026-03-07

### Added
- **Shape Transformation:** Persistent 15-degree incremental rotation for all decorative shapes with visual handles.
- **Enhanced Shapes Modal:** New tabbed navigation (Borders vs. Shapes) and tag-based filtering for the asset library.
- **Quick Switch:** Dedicated 🔄 button on shapes to swap assets while perfectly preserving position, size, and rotation.
- **Shape Interaction Lockdown:** Shapes are now non-interactive and dimmed (0.5 opacity) when "Shapes Mode" is inactive to prevent misclicks on standard sections.
- **Improved Shape Actions:** Consolidated Delete, Clone, and Rotate buttons into a unified hover-based actions container.

### Changed
- **Drag-and-Drop Overhaul:** Complete rewrite of the DnD engine in `js/dnd.js`. Replaced native `setDragImage` with a custom "Manual Ghost" system for perfect rotation and scaling support.
- **Print Optimization:** Migrated standalone shapes to `<img>` tags to ensure visibility when "Background Graphics" are disabled in browser print settings.
- **Asset Migration:** All internal `.png` assets migrated to `.gif` for better compression and consistency.
- **CSS Architecture:** Refined print specificity to ensure full content opacity regardless of interactive lockdown state.

### Fixed
- **Drag Ghost Offset:** Resolved the 16px vertical drift issue in the custom drag ghost.
- **Double Rotation Bug:** Fixed a cumulative transform error where rotation was being applied to both wrapper and container.
- **Layout Reset:** "Reset to Default" now correctly purges all non-default shapes and extractions.
- **Initialization Scope:** Fixed `ReferenceError` issues related to `ASSET_METADATA` and `parseAssets` by re-organizing script initialization order.

## [1.3.2] - 2026-03-07

### Added
- **Shapes Mode:** A new toggleable mode to decorate character sheets with custom graphical elements.
- **Shape Decoration Tool:** "Add Shape" button in the control panel to place decorative assets (Dwarf, Goth, Plants, etc.).
- **New Assets:** Added 17 new corner and vertical shape assets for the border picker.
- **Enhanced Border Picker:** Support for the new shape assets in the section border customization.
- **Persistence:** Shapes and decorations are now saved/loaded as part of the character layout.

### Changed
- **UI Architecture:** Introduced `.be-section-wrapper` to encapsulate sheet sections, preventing content clipping and improving button accessibility.
- **Robust Selectors:** Refactored `DomManager` to use attribute-based and context-aware selectors, making it resilient to D&D Beyond's obfuscated class names.
- **Initialization Logging:** Added detailed tracing for the extension's initialization lifecycle.
- **Button Handling:** Replaced simple `.onclick` handlers with `addEventListener` for better reliability on the live site.

### Fixed
- **Critical Layout Support:** Fixed the bug where the entire character sheet (`#site-main`) was hidden due to D&D Beyond's recent layout updates (e.g., the mobile navigation `<dialog>`).
- **"Deep Clean" Logic:** Refined the `DIALOG_SIBLING` selector to explicitly exclude extension-added UI (modals, feedback, controls) from being hidden during printing.
- **Save to PC:** Fixed cross-browser compatibility for downloading layout JSON files.
- **Control Panel Visibility:** Ensured the floating control panel remains visible even when aggressive "Deep Clean" styles are applied.

### Security
- Protected all extension-added DOM elements from being accidentally manipulated or hidden by site-wide CSS injections.

## [1.3.0] - Earlier 2026
- Initial release of the "Shapes" branch features (internal).

## 2026-10-14 — leg 9 run 5: thornvine CERTIFIED (v45: gate 10/10 + strict muse vision 6/6 twice) — temp/scratch only, no product change

Window reset at 08:21 local; the session resumed the in-flight v43 (already written by run 4)
instead of re-deriving it. Full chain (all evidence under `temp/scratch/`, record
`thornvine_leg9_record_20261013.md`, gate iterations 13-15):

- **v43 (iter 13, the escape consult's macro-rhythm mechanism, already in flight at the
  window close): spline probes ALL PASS both strands** (sagitta min 0.2249/0.2269,
  projection min 0.197/0.158, margins 0.542/0.486, re-entry clean); roots + constructor +
  gate → **9/10**, single line `left#s1 along-vine extremum gap 47 outside 22.5-45`. The
  escape consult's own pre-authorization ("if 36u arc exceeds 45, adjust that single
  half-length/depth, do not relax gate") fired: measured per-half G7 arc table logged (the
  consult's implementation condition), over-ceiling half = LEFT h5 (declared L=34,
  trough 27→crest 4, warp +0.15; s2 twin 44.0, margin 1.0). No trough landed at 23.x, so
  the consult's other clause did not fire.
- **v44 (iter 14, single-half remedy, nothing else): left strandA lengths h4/h5
  34/31→30/33, strandB 31/35→35/31, declared left crest 4→5; all other edges byte-identical.**
  Gate **10/10** (left#s1 max gap now 40.5). Strict vision: **criterion 2 MET FOR THE FIRST
  TIME in the 31-round + 15-gate history** (irregular hand-drawn rhythm, varied amplitude,
  flowing corners, no chain/bead/blob reading) — but **criterion 4 flipped NOT MET**:
  "bottom-left corner cluster of 4 oval leaves overlap with merged outlines and vine
  occlusion." Pixel forensics: 3 leaves at (19.9,243.3 rot−125)/(13.9,236.7 rot+30)/
  (10.3,227.1 rot+55), centre distances 8.9/10.3/18.9 vs sum-of-half-lengths ~15 — tip-to-tip
  reach overlap (reviewer counted braid ink as a 4th leaf; both readings agree it is a clump).
  Root cause in source: the roots annealer clears each leaf against RING INK ONLY
  (`ink_tree=cKDTree(pts+ptsB)`), never leaf-vs-leaf — and gate G4/G9 predicate
  attachment/clearance/inventory, not leaf separation (the defect class vision exists to
  catch). No gate edit.
- **Mid-loop muse consult at iter 14** (`thornvine_leg9_muse_after_v44*.md`, standard
  muse-first cumulative review — the situation changed class, not a 6-boundary): Q1
  **reach-disc FLAWED as drafted** (over-rejects opposite-side 14u pair at halfL 7+8;
  side-by-side parallel leaves over-penalized ~2.5-3u) → required correction adopted
  verbatim: oriented ellipse separation `sep=|d|−r_i−r_j`,
  `r(phi)=a·b/√((b·cosφ)²+(a·sinφ)²)`, MARGIN **2.0u**, weight 0.5×; Q2 count delta 4-vs-3
  diagnostic noise; Q3 zero C2 regression risk with the macro table frozen. Ordered fixes
  1-6 adopted (geometry frozen — `tv_v45_arc.py` sha-asserted equal to `tv_v44_arc.py` under
  version-string normalization; per-version leaf-leaf min-sep evidence file; no pool
  widening; no G4 edit).
- **v45 (iter 15): the annealer cost gains the oriented leaf-leaf term** (conservative on
  SIZE — max half-axes 8.0/3.5 + max centre offset 8.0, since emitted size class depends on
  the choice's own arc order — exact on ORIENTATION; true-size evidence table
  `tv_v45_leaf_sep.json` reproduces the constructor's LEAF_SIZES cycle exactly: **min sep
  12.99 over all 120 pairs**, margin 2.0, so the conservative form over-rejected nothing and
  no pool spill was needed; annealer best cost 0.0). Gate **10/10**. Strict muse vision on
  the rendered pixels: **6/6 MET — twice, two independent muse-spark calls on the same
  PNG** (`tv_v45_muse_vision.txt`, `tv_v45_muse_vision_r2.txt`; double-run because this
  project has measured a low-confidence vision flag flipping between rounds on unchanged
  bytes). **Done means achieved (operator-confirmed): `pass: true` on the (C-amended) gate
  AND 6/6 MET strict vision. The 03-thornvine border design is CERTIFIED.**
- Consult ledger for the leg: escape consults at gate iterations 6 and 12 per the 6-boundary
  rule; mid-loop consults before every geometry change (v29…v44), each with per-point
  dispositions; reviewer claims contradicted by pixels/measurements were challenged with
  reasons and logged (iter-27 G7-gap relabel rejected on gate source; v44 reach-disc
  corrected per his own Q1). Gate untouched beyond the operator-authorized [HC-C]; no
  corpus edits; no product files touched; no commits (leg scope: temp/scratch only).
