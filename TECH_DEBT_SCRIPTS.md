# TECH_DEBT_SCRIPTS.md — the `scripts` area: inventory, hygiene baseline, and the check that keeps it

**Written by** track `scripts_inventory_hygiene_20261014` (`conductor/archive/scripts_inventory_hygiene_20261014/`),
executed 2026-10-14 from the idlegate tech-debt dossier (`temp/idlegate/tech-debt/spec.md`).

**What this file is for:** a later track should be able to target the `scripts` area without
re-deriving its surface. Every file is listed once, with what it is, how it is invoked, what it
assumes, and how risky it is to touch. The table is not documentation *about* the check — it is the
check's own input: `scripts/check_scripts_hygiene.js` compares it against the tracked surface and
fails when the two disagree in either direction.

**Verify / regenerate:**

```bash
node scripts/check_scripts_hygiene.js          # the check (also runs inside `npm run lint`)
node scripts/check_scripts_hygiene.js --json   # machine-readable, for a later track
git ls-files scripts                            # the measured surface itself
```

---

## 1. Reconciliation of the dossier's count

The dossier this track came from declared **"Count: 7 files"** for the `scripts` area, and no file
names. That number does not hold: `git ls-files scripts` returns **53** paths at this track's branch
point (`e1fd05f`) — 44 `.js`, 8 `.py` and 1 `.json` data file.

No 7-file subset of the measured surface exists, so the dossier's count is recorded here as
**unreconciled** rather than explained away: the closest natural subset is the 8 Python scripts; by
shebang presence the split is 30/23; by "opens with a purpose header" it was 41/12. AC-1 is
therefore satisfied against the MEASURED surface, and this paragraph is the deviation record the
criterion asks for. The track adds one further tracked file of its own
(`scripts/check_scripts_hygiene.js`), so the surface this file governs and the check enforces is
**54 files**.

## 2. Risk rubric (declared before anything was rated)

| tier | means | consequence |
| --- | --- | --- |
| **high** | running it can MUTATE the repository or the delivery surface (writes a tracked file, or its exit status gates a release/verdict) | needs a reviewer before it is run |
| **medium** | it cannot run as-is in the delivered tree, or it needs a live credential/service: inputs are absent (`demo/ignored/**`, `nanobanana-output/**`, `temp/visual_logs/**`, migrated `assets/*.gif`) or it dials a model/relay/browser | historical harness; keep, do not assume it works |
| **low** | read-only, argument-driven or guard-shaped, inputs present in the tree, dependencies declared in `package.json` | safe to run and to refactor |

The "absent input" verdicts were measured on 2026-10-14 against this tree: `demo/ignored` does not
exist, `nanobanana-output/` does not exist, `temp/visual_logs/` does not exist, `assets/*.gif` count
is 0 (27 `.webp` remain — the `asset_compression_20260318` migration removed the `.gif` inputs), and
`vendor/docs/byok-ai-layout-20260915/collage-phase2.png` is gone.

## 3. Inventory (the set the check enforces)

| path | primary purpose | invocation | runtime / dependencies | risk |
| --- | --- | --- | --- | --- |
| `scripts/analyze_image_content.js` | one-off: measure a demo sheet's content bounding box (grayscale scan for non-white pixels) | `node scripts/analyze_image_content.js` | node, `sharp` | medium — input `demo/ignored/sheet_archer.png` is absent |
| `scripts/audit_dead_exports.js` | reproducible audit of the `window.*` export surface (track `dead_exports_20260910`); the scanner behind the dead-export retirement | `node scripts/audit_dead_exports.js` | node, `fs`, `path` (module: `require`d by `test/unit/dead_exports.test.js`) | low |
| `scripts/batch_finalize.js` | one-off batch driver: runs `perfect_finalize.js` over the archer asset list | `node scripts/batch_finalize.js` | node, `child_process` | medium — inputs under `nanobanana-output/` are absent |
| `scripts/border_design_generator.js` | generate a real set of AI border designs from the LIVE NOUS free leg (track `byok_svg_borders_20260927` Phase 4) | `node scripts/border_design_generator.js [args]` | node, `fs`, `path`, live model leg (module: `require`d by `test/unit/byok_border_corpus.test.js`) | **high** — writes the tracked prompt corpus `scripts/border_designs.json` |
| `scripts/border_designs.json` | DATA, not a script: the border-design prompt corpus the generator writes and the gallery fixture records | read | none | low |
| `scripts/border_metric.js` | D1 (operator ruling 2026-10-02): the deterministic pixel metric for criterion OVERRIDES — makes a re-cut criterion binding with no seat call | `node scripts/border_metric.js <args>` | node, `pngjs` | medium — its numbers bind a criterion verdict |
| `scripts/browser_gate.js` | the browser gate: ONE entry point for the manual and the scheduled run (track `gate_coverage_20260912`) | `npm run test:browser-gate` (or `:sharded`) | node, `playwright`, `child_process` | **high** — spawns the suite and writes the artifact the release gate reads |
| `scripts/byok_acv1_collage.js` | collage composer for `byok_ai_layout_20260915` Phase 4's AC-V1 visual gate | `node scripts/byok_acv1_collage.js` | node, `sharp` | medium — frames under `temp/visual_logs/` are absent |
| `scripts/byok_border_collage.js` | collage composer for the border-design gallery (track `byok_svg_borders_20260927` Phase 4) | `node scripts/byok_border_collage.js` | node, `sharp` | medium — reads round/capture blobs that are not in the tree |
| `scripts/byok_border_judged.js` | compose the JUDGED cells for the Phase-4 visual seat (operator ruling D-A) | `node scripts/byok_border_judged.js` | node, `sharp` | medium — historical harness, inputs not in the tree |
| `scripts/byok_border_visual_seat.py` | the Phase-4 VISUAL CHARTER driver (R2.17's third seat) | `python scripts/byok_border_visual_seat.py` | python3, stdlib + `urllib` | medium — needs a live vision seat and a credential |
| `scripts/byok_collage.js` | collage composer for `byok_ai_layout_20260915` Phase 2's AC-V1-lite visual gate | `node scripts/byok_collage.js` | node, `sharp` | medium — `vendor/docs/byok-ai-layout-20260915/collage-phase2.png` is gone |
| `scripts/byok_panel_width_probe.js` | panel-width probe behind V7's claim (the new dialog is noticeably wider than the old one) | `node scripts/byok_panel_width_probe.js` | node, `sharp` | medium — reads a `vendor/docs/**` frame that is gone |
| `scripts/byok_vision_gate.py` | vision-gate dispatcher for `byok_ai_layout_20260915` (AC-V1-lite), reviewer-selectable | `python scripts/byok_vision_gate.py` | python3, stdlib + `urllib`, `winreg` | medium — live seat call and a project credential |
| `scripts/check_border_svg_injection.js` | the BLOCKING build guard for the SVG single-source render invariant (AC-9 / AC-9b(ii)) | part of `npm run lint` | node, `fs`, `path` | low — read-only guard, already blocking |
| `scripts/check_css_template_backticks.js` | guard: no stray backtick inside an INJECTED-STYLESHEET template | `node scripts/check_css_template_backticks.js` | node, `fs`, `path` (module: `require`d by a unit test) | low |
| `scripts/check_dead_exports.js` | the re-rot guard for the dead-export surface (AC-6 of `dead_exports_20260910`) | `node scripts/check_dead_exports.js` | node (module: `require`d by `test/unit/dead_exports.test.js`) | low |
| `scripts/check_scripts_hygiene.js` | this area's own guard: inventory completeness, purpose header, shebang hygiene (added by this track) | part of `npm run lint` | node, `child_process` (`git ls-files`) | low — read-only, no mutation |
| `scripts/check_theme_backticks.js` | guard: no stray backtick inside the `THEME_CSS` template literal | `node scripts/check_theme_backticks.js` | node, `fs`, `path` (module: `require`d by `test/unit/ui_theme_source.test.js`) | low |
| `scripts/codex_text_leg.py` | the CODEX text leg for the border prompt corpus: prompt → codex → JSON patch → the product's own parser/sanitizer | `python scripts/codex_text_leg.py` | python3, stdlib + `urllib`, `subprocess` | medium — live model leg and credential |
| `scripts/compress_assets.js` | one-off migration: shrink and convert `assets/**` to WebP (max dimension 512, quality 80) | `node scripts/compress_assets.js` | node, `sharp` | medium — every `.gif` input it names is gone (0 remain, 27 `.webp`) |
| `scripts/compress_large_assets.js` | one-off: re-encode the oversized asset images the first pass missed | `node scripts/compress_large_assets.js` | node, `sharp` | medium — inputs under `nanobanana-output/` are absent |
| `scripts/create_grid.js` | one-off: slice the demo sheet into a 10x10 tile grid for visual inspection | `node scripts/create_grid.js` | node, `sharp` | medium — `demo/ignored/**` is absent |
| `scripts/drag_ux_collage.js` | collage composer for the `drag_ux_overhaul_20260909` visual gates | `node scripts/drag_ux_collage.js` | node, `sharp` | medium — historical capture frames |
| `scripts/drag_ux_visual_gate.py` | visual-gate driver for `drag_ux_overhaul_20260909` (the file `byok_vision_gate.py` was derived from) | `python scripts/drag_ux_visual_gate.py` | python3, stdlib + `urllib` | medium — live seat call |
| `scripts/extract_preliminary_borders.js` | one-off: extract candidate border crops from the demo sheet | `node scripts/extract_preliminary_borders.js` | node, `sharp` | medium — `demo/ignored/**` is absent |
| `scripts/extract_preliminary_shapes.js` | one-off: extract candidate shape and icon crops from the demo sheet | `node scripts/extract_preliminary_shapes.js` | node, `sharp` | medium — `demo/ignored/**` is absent |
| `scripts/feedback_collage.js` | collage composer for the `feedback_lifecycle_a11y_20260910` visual gates | `node scripts/feedback_collage.js` | node, `sharp` | medium — historical capture frames |
| `scripts/finalize_border.js` | one-off: finalize a border asset (transparency + the `#e40712` recolor) | `node scripts/finalize_border.js` | node, `sharp` | medium — inputs under `nanobanana-output/` are absent |
| `scripts/freeze_border_corpus.js` | freeze the BYOK border design corpus into a TRACKED fixture (byte-reproducible, last accepted wins) | `node scripts/freeze_border_corpus.js [--check]` | node, `crypto`, `fs`, `path` (module: `require`d by `test/unit/byok_border_corpus.test.js`) | **high** — writes `test/fixtures/byok_border_corpus.json` |
| `scripts/gen_spec_inventory.js` | regenerate `test/browser_e2e/spec_inventory.json` — the expected browser-suite inventory | `node scripts/gen_spec_inventory.js` | node, `child_process`, `fs`, `path` | **high** — writes a tracked file that must be reviewed as a diff |
| `scripts/get_image_metadata.js` | print `sharp`'s metadata for an image (argv, or the demo sheet by default) | `node scripts/get_image_metadata.js [file]` | node, `sharp` | low — read-only, argument-driven |
| `scripts/idlegate_census_v2.py` | reduce the idle gate's typed event stream into one census | `python scripts/idlegate_census_v2.py <args>` | python3, stdlib | medium — reads `temp/idlegate/**` (ignored, machine-local); `require`d by a unit test |
| `scripts/idlegate_events.py` | derive a TYPED event stream from the idle gate's log footprints | `python scripts/idlegate_events.py <args>` | python3, stdlib | medium — reads `temp/idlegate/**`; `require`d by a unit test |
| `scripts/inventory_mutation_tags.py` | inventory the mutation-class tags the product actually passes, by parsing call sites | `python scripts/inventory_mutation_tags.py` | python3, stdlib | low — read-only; feeds mutation-class guards |
| `scripts/measure_css_content.js` | Phase 0 Muse Challenge Stage 5: the STYLESHEET persistence vector (glyphs emitted from generated CSS `content:`) | `node scripts/measure_css_content.js` | node, `fs` | low — read-only |
| `scripts/measure_encodings.js` | Phase 0 re-measurement for `ux_gaps_20260911` (AC-6): re-derives every number the spec asserts | `node scripts/measure_encodings.js` | node, `fs` | low — read-only |
| `scripts/ornament_collage.js` | collage composer for the `ornament_symmetry_20260910` visual gates (self-described scratch) | `node scripts/ornament_collage.js` | node, `sharp` | medium — historical capture frames |
| `scripts/ornament_gold_probe.js` | scratch: decisive test for the corner terminations (gold L-terminations claim) | `node scripts/ornament_gold_probe.js` | node, `sharp` | medium — historical capture frames |
| `scripts/ornament_pixel_probe.js` | scratch: turn the "three 1px rules with a 6px gap" claim into raw pixel evidence | `node scripts/ornament_pixel_probe.js` | node, `sharp` | medium — historical capture frames |
| `scripts/perfect_finalize.js` | one-off: isolate black ink lines from a white background and recolor them to the target red | `node scripts/perfect_finalize.js <in> <out>` | node, `sharp` | medium — inputs under `nanobanana-output/` are absent |
| `scripts/print_raster_diff.js` | per-page pixel diff of two printed-page rasters (mean absolute channel difference + share changed) | `node scripts/print_raster_diff.js <before> <after> [NN ...]` | node, `sharp` | low — read-only, argument-driven |
| `scripts/print_red_pixel_probe.js` | count STRONGLY-RED pixels per printed page and report their bounding box | `node scripts/print_red_pixel_probe.js <dir>` | node, `sharp` | medium — expects raster dirs that are not in the tree |
| `scripts/recovery_collage.js` | collage composer for the `destructive_recovery_20260911` visual gates | `node scripts/recovery_collage.js` | node, `sharp` | medium — historical capture frames |
| `scripts/relay_serving_identity.py` | is the process serving THIS project's relay port actually the relay unit this project pinned? | `python scripts/relay_serving_identity.py` | python3, stdlib + `subprocess`, `urllib` | medium — probes a live port; reads `modelstack.lock` |
| `scripts/release_gate.js` | refuse a version bump on a browser suite that is RED, STALE or UNVERIFIED | `npm run release:check` | node, `child_process`, `fs`, `path` | medium — spawns `git`; its exit status gates a release |
| `scripts/scaling_innerwidth_collision_probe.js` | probe: does the fit-to-container compensation width land on the same element and property the layout record owns? | `node scripts/scaling_innerwidth_collision_probe.js` | node, `test/browser_e2e/_helpers.js` | medium — needs a live browser boot |
| `scripts/scaling_page_collage.js` | side-by-side of the SAME printed page, before vs after the scaling wiring | `node scripts/scaling_page_collage.js` | node, `sharp` | medium — needs before/after rasters that are not in the tree |
| `scripts/scaling_resize_refire_probe.js` | does a resize of a section re-fire the fit-to-container measure? | `node scripts/scaling_resize_refire_probe.js` | node, `test/browser_e2e/_helpers.js` | medium — needs a live browser boot |
| `scripts/scaling_scale_distribution_probe.js` | the distribution of scales the fit-to-container feature applies on the live demo sheet | `node scripts/scaling_scale_distribution_probe.js` | node, `test/browser_e2e/_helpers.js` | medium — needs a live browser boot |
| `scripts/screenshot.js` | capture a D&D Beyond character sheet with the extension ACTIVE, via Playwright + Chromium | `node scripts/screenshot.js <url> [out]` | node, `playwright` | medium — needs a live sheet and a browser |
| `scripts/selection_collage.js` | collage composer for the `selection_model_ia_20260910` visual gates | `node scripts/selection_collage.js` | node, `sharp` | medium — historical capture frames |
| `scripts/selection_visual_diff.js` | deterministic pixel-diff gate for the `selection_model_ia_20260910` phase-1 frames (that track's primary evidence instrument) | `node scripts/selection_visual_diff.js` | node, `sharp`, `child_process` | medium — its frame dir `vendor/docs/selection-model-ia-20260910/shots-phase1` is gone |
| `scripts/thornvine_acceptance_gate.js` | the binding DETERMINISTIC acceptance gate for the 03-thornvine fix (the muse-loop comp encoded as measurements) | `node scripts/thornvine_acceptance_gate.js` | node, `fs` | medium — expects rasters that are not in the tree |

## 4. Hygiene findings and their dispositions

Measured on the branch-point tree; every "fixed" row names the edit, every "follow-up" row names the
debt and where the reversal condition lives.

| id | finding (measured) | disposition |
| --- | --- | --- |
| F-1 | 10 of 44 `.js` files opened with code, so a reader could not tell what the file was for without reading it: `analyze_image_content.js`, `batch_finalize.js`, `compress_assets.js`, `compress_large_assets.js`, `create_grid.js`, `extract_preliminary_borders.js`, `extract_preliminary_shapes.js`, `get_image_metadata.js`, `finalize_border.js`, `perfect_finalize.js` | **FIXED** — each gained a one-to-three line purpose header stating what it does and, where true, that its inputs are absent. No statement was changed |
| F-2 | the surface declared runtime two ways: 30 files carried a shebang, 22 `.js` files carried none (the `.json` data file is not a script) | **FIXED** — the 22 gained `#!/usr/bin/env node`, normalizing toward the majority convention and the project's own newer scripts. `check_theme_backticks.js` is the one of the 22 that is also `require()`d by a unit test, and the shebang was verified against that path |
| F-3 | `byok_border_visual_seat.py` was the one Python script whose shebang said `python` while the other seven said `python3` | **FIXED** — normalized to `python3` |
| F-4 | **the exec bit is not tracked anywhere in this repository**: `git ls-files -s scripts` is `100644` x 53 (repo-wide: 0 paths at `100755`), and this checkout has `core.filemode=false`. A shebang therefore has no POSIX effect here | **FOLLOW-UP T-2** — deliberately NOT fixed in this track (a 30-file mode change for a POSIX-only benefit); the check reports the state and its activation condition rather than pretending to verify it |
| F-5 | invocation documentation is uneven: 3 files are wired in `package.json`, 7 are `require()`d by tests, 3 are documented in `README.md`, and the rest carry their usage only in their own header (or, before F-1, nowhere) | **FIXED (this file)** — §3 is now the single index of invocation for all 54 files; no script's own usage note was rewritten, so no doc can disagree with another |
| F-6 | dependency assumptions are undeclared per file: `sharp`, `playwright`, `pngjs` are used but only `package.json` reveals them | **FOLLOW-UP T-3** — recorded per file in §3; a pinning/lint pass is a later track (this one may not change behaviour) |
| F-7 | 20 of 53 files write to disk and 5 make network calls, but nothing in the area states which ones are safe to run casually | **FIXED (this file)** — the risk rubric in §2 and the per-file risk column make the distinction explicit for the first time |

## 5. Remaining known debt (not addressed here)

* **T-1 — the area mixes reusable tooling with spent one-off harnesses.** 30 of the 54 files are
  single-track probes/collage composers whose inputs (`demo/ignored/**`, `nanobanana-output/**`,
  `temp/visual_logs/**`, migrated `assets/*.gif`) no longer exist, while 11 are live tools wired
  into lint, the release gate or the test suite. Nothing marks the difference except §3's risk
  column. Suggested direction: a `scripts/harness/` partition or a documented retirement rule —
  out of scope here, because moving files changes every citation that names them.
* **T-2 — the POSIX exec bit is untracked (F-4).** Reversal condition: the first citation that
  invokes a script as `./scripts/<file>`, or the first POSIX run of the suite. The check activates
  its assertion automatically the moment any tracked file in the repo carries mode `100755`.
* **T-3 — per-script dependency declarations (F-6).** The three real dependencies (`sharp`,
  `playwright`, `pngjs`) are devDependencies, so nothing is broken today; a future script that
  needs a runtime dependency would not be caught by anything.
* **T-4 — no runtime smoke test.** Nothing verifies that the 11 `low`-risk tools still run: the
  suite exercises some of them as modules, but `check_border_svg_injection.js` and
  `check_scripts_hygiene.js` are the only ones executed end-to-end by a gate.
* **T-5 — the dossier's 7-file count is unreconciled** (§1). Not fixable here: the dossier was
  authored from an inventory this session cannot see. If the idlegate census is instrumented
  again, its area count for `scripts` should be re-measured against `git ls-files scripts`.

## 6. Suggested follow-up tracks

1. **Script-surface consolidation (T-1):** partition reusable tooling from spent harnesses, and
   retire the harnesses whose inputs are permanently gone — with the citations updated in the same
   change. This is the highest-value follow-up: the risk column shows the split is 30 to 11.
2. **Dependency declaration for scripts (T-3):** a declared per-script dependency field (or a lint
   rule over `require()` targets) so a missing `package.json` entry cannot ship.
3. **Runtime smoke test (T-4):** run every `low`-risk tool once in a synthetic fixture directory and
   assert exit 0 and no repo mutation. Feasible because those tools are argument-driven.
4. **Language-specific linting:** the area already passes eslint (including `scripts/**/*.js`); the 8
   Python files have no linter at all.
