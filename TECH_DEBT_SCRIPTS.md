# TECH_DEBT_SCRIPTS.md — the `scripts` area: inventory, hygiene baseline, and the check that keeps it

**Written by** track `scripts_inventory_hygiene_20261014` (`conductor/archive/scripts_inventory_hygiene_20261014/`),
executed 2026-10-14 from the idlegate tech-debt dossier (`temp/idlegate/tech-debt/spec.md`), and
**re-measured and corrected by** track `scripts_inventory_hygiene_20261017`
(`conductor/archive/scripts_inventory_hygiene_20261017/`), the dossier's second execution cycle, on
2026-10-17.

**What this file is for:** a later track should be able to target the `scripts` area without
re-deriving its surface. Every file is listed once, with what it is, how it is invoked, what it
assumes, and how risky it is to touch. The table is not documentation *about* the check — it is the
check's own input: `scripts/check_scripts_hygiene.js` compares it against the tracked surface and
fails when the two disagree in either direction, and since 2026-10-17 it also fails when the shape
this file declares in §1 disagrees with the repository (that sentence was false for two cycles before
anything read it — finding F-9).

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

Track `runtime_perf_20261015` (2026-10-15) added a twelfth-and-onwards group — twelve more tracked
paths under `scripts/perf/` (three `.js` helpers/tools, one `.py` helper, two `.json` data files and
six `.md` documents), all rowed below — and track `scripts_runtime_smoke_20261017` (2026-10-17)
added the area's runtime smoke, so the surface this file governs and
`scripts/check_scripts_hygiene.js` enforces is now
**68 files**: 50 `.js`, 9 `.py`, 3 `.json`, 6 `.md`. The `scripts/perf/` subdirectory is new for
this area; it exists because the dossier's own plan named those artifact paths, and the area's flat
layout has no other place for a tool plus its schema/budget/report set.

**Correction, 2026-10-17 (track `scripts_inventory_hygiene_20261017`, finding F-9).** The paragraph
above used to declare this surface as *"66 files: 47 `.js`, 9 `.py`, 2 `.json`, 8 `.md`"*. Measured at
`b6db36d` — the very commit that wrote the sentence — and again on 2026-10-17: **48 `.js`, 9 `.py`,
3 `.json`, 6 `.md`. Three of the four class counts were false**; only `.py` was right, and the TOTAL
was right, which is why nothing noticed: `47+9+2+8` and `48+9+3+6` are both 66, and the guard compared
the row SET while nothing ever read this sentence. The counts above are now re-derived from
`git ls-files scripts`, and the guard has a fifth arm that compares this paragraph with the repository
— run on the uncorrected file it reported exactly the three lines below, which is the evidence that the
arm can fail for the reason it names:

```text
  - shape: .js declared 47, measured 48
  - shape: .json declared 2, measured 3
  - shape: .md declared 8, measured 6
```

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
| `scripts/analyze_image_content.js` | analyze_image_content.js - one-off: measure a demo sheet's CONTENT bounding box, by scanning a grayscale copy for pixels that are not white, so a crop can be aimed at the ink. Read-only; its input (demo/ignored/sheet_archer.png) is no longer in the tree. | `node scripts/analyze_image_content.js` | node, `sharp` | medium `harness` — input `demo/ignored/sheet_archer.png` is absent |
| `scripts/audit_dead_exports.js` | audit_dead_exports.js — reproducible audit of the project's `window.*` export surface (track: dead_exports_20260910). | `node scripts/audit_dead_exports.js` | node, `fs`, `path` (module: `require`d by `test/unit/dead_exports.test.js`) | low |
| `scripts/batch_finalize.js` | batch_finalize.js - one-off batch driver for the archer asset set: runs perfect_finalize.js over a hard-coded input/output list. The inputs under nanobanana-output/ are no longer in the tree, so this is the record of how those assets were prepared rather than a runnable step. | `node scripts/batch_finalize.js` | node, `child_process` | medium `harness` — inputs under `nanobanana-output/` are absent |
| `scripts/border_design_generator.js` | border_design_generator.js — produce a real set of AI border designs from the LIVE NOUS free leg. | `node scripts/border_design_generator.js [args]` | node, `fs`, `path`, live model leg (module: `require`d by `test/unit/byok_border_corpus.test.js`) | **high** — writes the tracked prompt corpus `scripts/border_designs.json` |
| `scripts/border_designs.json` | DATA, not a script: the border-design prompt corpus the generator writes and the gallery fixture records | read | none | low |
| `scripts/border_metric.js` | D1 (operator ruling 2026-10-02) — the deterministic pixel metric for criterion OVERRIDES. This is the instrument that makes a re-cut criterion *binding without a seat call*, per decision D2's doctrine: for predicates over shape / continuity / coverage / gap / closure the binding verdict is a measurement on the judged PNG; the vision seat is corroborating only and its dissent is not a NOT MET. | `node scripts/border_metric.js <args>` | node, `pngjs` | medium — its numbers bind a criterion verdict |
| `scripts/border_refine_gdetect.js` | border_refine_gdetect.js — G-DETECT, MEASURED: does refining an AI border change what is painted? Paints an AI border's DESIGN and its REFINED version through the product's own `::before` border-image slot in headless Chromium, screenshots both, and pixel-diffs them (BEYOND-10, track `beyond10_ai_border_refine_loop`, AC-5). Writes two PNGs + `report.json` under `temp/visual_logs/beyond10_gdetect/` and exits non-zero when the change is below its own stated rule (≥0.5% of the canvas AND a rising ink count). `--weight/--style/--design` select the refinement; a no-op refinement is refused rather than passed. | `node scripts/border_refine_gdetect.js [--weight 1.5 --style 1 --design 01-gilded-frame]` | node, `playwright`, `pngjs`, `js/ai_border.js` (the module's own knobs + pure transform) | **medium** — dials a real Chromium through `playwright`; writes only under gitignored `temp/visual_logs/`, and its exit status is the AC-5 verdict |
| `scripts/browser_gate.js` | The browser gate — ONE entry point for the manual run and the scheduled run (track `gate_coverage_20260912`, Phase 2 = AC-3, Phase 3 = AC-5). | `npm run test:browser-gate` (or `:sharded`) | node, `playwright`, `child_process` | **high** — spawns the suite and writes the artifact the release gate reads |
| `scripts/byok_acv1_collage.js` | Collage composer for byok_ai_layout_20260915 Phase 4's AC-V1 visual gate. | `node scripts/byok_acv1_collage.js` | node, `sharp` | medium `harness` — frames under `temp/visual_logs/` are absent |
| `scripts/byok_border_collage.js` | Collage composer for the border-design gallery (track byok_svg_borders_20260927, Phase 4). | `node scripts/byok_border_collage.js` | node, `sharp` | medium `harness` — reads round/capture blobs that are not in the tree |
| `scripts/byok_border_judged.js` | byok_border_judged.js — compose the JUDGED cells for the Phase-4 visual seat. | `node scripts/byok_border_judged.js` | node, `sharp` | medium `harness` — historical harness, inputs not in the tree |
| `scripts/byok_border_visual_seat.py` | byok_border_visual_seat.py — the Phase-4 VISUAL CHARTER driver (R2.17's third seat). | `python scripts/byok_border_visual_seat.py` | python, stdlib + `urllib` | medium — needs a live vision seat and a credential |
| `scripts/byok_collage.js` | Collage composer for byok_ai_layout_20260915 Phase 2's AC-V1-lite visual gate. | `node scripts/byok_collage.js` | node, `sharp` | medium `harness` — `vendor/docs/byok-ai-layout-20260915/collage-phase2.png` is gone |
| `scripts/byok_panel_width_probe.js` | Panel-width probe for the AC-V1-lite collage — the pixels behind V7's claim. | `node scripts/byok_panel_width_probe.js` | node, `sharp` | medium `harness` — reads a `vendor/docs/**` frame that is gone |
| `scripts/byok_vision_gate.py` | Vision-gate dispatcher for byok_ai_layout_20260915 (AC-V1-lite), reviewer-selectable. | `python scripts/byok_vision_gate.py` | python, stdlib + `urllib`, `winreg` | medium — live seat call and a project credential |
| `scripts/check_border_svg_injection.js` | check_border_svg_injection.js — the BLOCKING build guard for the SVG single-source render invariant (track `byok_svg_borders_20260927`, AC-9 / AC-9b(ii)). | part of `npm run lint` | node, `fs`, `path` | low — read-only guard, already blocking |
| `scripts/check_css_template_backticks.js` | Guard: no stray backtick may appear inside an INJECTED-STYLESHEET template. | `node scripts/check_css_template_backticks.js` | node, `fs`, `path` (module: `require`d by a unit test) | low |
| `scripts/check_dead_exports.js` | check_dead_exports.js — the re-rot GUARD (track dead_exports_20260910, AC-6). | `node scripts/check_dead_exports.js` | node (module: `require`d by `test/unit/dead_exports.test.js`) | low |
| `scripts/check_scripts_hygiene.js` | check_scripts_hygiene.js - the `scripts` area's own guard (tracks scripts_inventory_hygiene_20261014 and scripts_inventory_hygiene_20261017). | part of `npm run lint` | node, `child_process` (`git ls-files`) | low — read-only, no mutation |
| `scripts/check_theme_backticks.js` | Guard: no stray backtick may appear inside the THEME_CSS template literal. | `node scripts/check_theme_backticks.js` | node, `fs`, `path` (module: `require`d by `test/unit/ui_theme_source.test.js`) | low |
| `scripts/codex_text_leg.py` | codex_text_leg.py — the CODEX text leg for the border prompt corpus. | `python scripts/codex_text_leg.py` | python, stdlib + `urllib`, `subprocess` | medium — live model leg and credential |
| `scripts/compress_assets.js` | compress_assets.js - the asset migration pass: resize every image under assets/ to a max dimension of 512 and re-encode it at quality 80. Every .gif input it names has since been replaced by a .webp (0 .gif remain, 27 .webp), so the migration it performed is already done. | `node scripts/compress_assets.js` | node, `sharp` | medium `harness` — every `.gif` input it names is gone (0 remain, 27 `.webp`) |
| `scripts/compress_large_assets.js` | compress_large_assets.js - one-off second pass of the asset migration, for the oversized images the first pass missed. Its inputs were read from nanobanana-output/, which is not in the tree. | `node scripts/compress_large_assets.js` | node, `sharp` | medium `harness` — inputs under `nanobanana-output/` are absent |
| `scripts/create_grid.js` | create_grid.js - one-off: slice the demo sheet into a 10x10 tile grid under demo/ignored/grid, so a small region can be inspected at full resolution. Input and output directory are both absent. | `node scripts/create_grid.js` | node, `sharp` | medium `harness` — `demo/ignored/**` is absent |
| `scripts/drag_ux_collage.js` | Collage composer for the drag_ux_overhaul_20260909 visual gates. | `node scripts/drag_ux_collage.js` | node, `sharp` | medium `harness` — historical capture frames |
| `scripts/drag_ux_visual_gate.py` | Visual-gate dispatcher for drag_ux_overhaul_20260909 (and reusable for any track whose visual-gate protocol permits it). | `python scripts/drag_ux_visual_gate.py` | python, stdlib + `urllib` | medium — live seat call |
| `scripts/extract_preliminary_borders.js` | extract_preliminary_borders.js - one-off: crop candidate BORDER regions out of the demo sheet into demo/ignored/extracted, the first step of the archer asset setup. Input and output are absent. | `node scripts/extract_preliminary_borders.js` | node, `sharp` | medium `harness` — `demo/ignored/**` is absent |
| `scripts/extract_preliminary_shapes.js` | extract_preliminary_shapes.js - one-off: crop candidate SHAPE/icon regions out of the demo sheet into demo/ignored/extracted, beside extract_preliminary_borders.js. Input and output are absent. | `node scripts/extract_preliminary_shapes.js` | node, `sharp` | medium `harness` — `demo/ignored/**` is absent |
| `scripts/feedback_collage.js` | Collage composer for the feedback_lifecycle_a11y_20260910 visual gates. | `node scripts/feedback_collage.js` | node, `sharp` | medium `harness` — historical capture frames |
| `scripts/finalize_border.js` | finalize_border.js - one-off: finalize a single border asset - make its background transparent and recolor the ink to the project's red (#e40712). Its inputs (nanobanana-output/**, assets/*.gif) are no longer in the tree. | `node scripts/finalize_border.js` | node, `sharp` | medium `harness` — inputs under `nanobanana-output/` are absent |
| `scripts/freeze_border_corpus.js` | freeze_border_corpus.js — freeze the BYOK border design corpus into a TRACKED fixture. | `node scripts/freeze_border_corpus.js [--check]` | node, `crypto`, `fs`, `path` (module: `require`d by `test/unit/byok_border_corpus.test.js`) | **high** — writes `test/fixtures/byok_border_corpus.json` |
| `scripts/gen_spec_inventory.js` | Regenerate `test/browser_e2e/spec_inventory.json` — the EXPECTED browser-suite inventory. | `node scripts/gen_spec_inventory.js` | node, `child_process`, `fs`, `path` | **high** — writes a tracked file that must be reviewed as a diff |
| `scripts/get_image_metadata.js` | get_image_metadata.js - print sharp's metadata (dimensions, format, channels) for the image given on argv, defaulting to the demo sheet. Read-only and argument-driven. | `node scripts/get_image_metadata.js [file]` | node, `sharp` | low — read-only, argument-driven |
| `scripts/idlegate_census_v2.py` | idlegate_census_v2.py - reduce the idle gate's typed event stream into one census. | `python scripts/idlegate_census_v2.py <args>` | python, stdlib | medium — reads `temp/idlegate/**` (ignored, machine-local); `require`d by a unit test |
| `scripts/idlegate_events.py` | idlegate_events.py - derive a TYPED event stream from the idle gate's log footprints. | `python scripts/idlegate_events.py <args>` | python, stdlib | medium — reads `temp/idlegate/**`; `require`d by a unit test |
| `scripts/inventory_mutation_tags.py` | Inventory the mutation-class tags the product actually passes, by parsing call sites. | `python scripts/inventory_mutation_tags.py` | python, stdlib | low — read-only; feeds mutation-class guards |
| `scripts/measure_css_content.js` | Phase 0 Muse Challenge Stage 5: the STYLESHEET persistence vector (glyphs emitted from generated CSS `content:`) | `node scripts/measure_css_content.js` | node, `fs` | low — read-only |
| `scripts/measure_encodings.js` | Phase 0 re-measurement for `ux_gaps_20260911` (AC-6): re-derives every number the spec asserts | `node scripts/measure_encodings.js` | node, `fs` | low — read-only |
| `scripts/ornament_collage.js` | Scratch: build the compact, redable collages for the ornament_symmetry_20260910 visual gates from the frames the capture harness already saved. | `node scripts/ornament_collage.js` | node, `sharp` | medium `harness` — historical capture frames |
| `scripts/ornament_gold_probe.js` | Scratch: decisive test for the corner terminations (AC-2). | `node scripts/ornament_gold_probe.js` | node, `sharp` | medium `harness` — historical capture frames |
| `scripts/ornament_pixel_probe.js` | Scratch: turn the "three 1px rules with a 6px gap" claim into raw pixel evidence, because the phase-1 reviewer correctly refused to pass AC-1/AC-2 from a downscaled collage ("I cannot resolve a claimed 1px stroke from pixels at this collage scale — a claim you cannot verify from the pixels is a defect in MY evidence"). | `node scripts/ornament_pixel_probe.js` | node, `sharp` | medium `harness` — historical capture frames |
| `scripts/perfect_finalize.js` | perfect_finalize.js - one-off: isolate black ink lines from a white background and recolor them to the target red; batch_finalize.js drives it over the archer asset list. Its inputs are absent. | `node scripts/perfect_finalize.js <in> <out>` | node, `sharp` | medium `harness` — inputs under `nanobanana-output/` are absent |
| `scripts/perf/budgets.json` | DATA, not a script: the declared per-class model-call budgets (target p95, hard cap, per-attempt cap, session cap, retry policy, per-site overrides with reasons) that BOTH model-call helpers read | read | none | low |
| `scripts/perf/latency-budgets.md` | the budget table, what each number is derived from, and the named AC-2 shortfall where a site runs above its class cap | read | none | low |
| `scripts/perf/model-call-sites.md` | the MEASURED inventory of the area's model-call sites (wired / indirect / not-wired) with transport, endpoint, credential source and the timeout each carried before | read | none | low |
| `scripts/perf/model-call-telemetry.schema.md` | the `perf-model-call/1` terminal-telemetry contract both helpers write and the validator enforces (fields, statuses, privacy rule) | read | none | low |
| `scripts/perf/model_call_telemetry.js` | model_call_telemetry.js — the Node half of the scripts area's model-call budget + telemetry. | `node scripts/perf/model_call_telemetry.js --self-test` | node, `crypto`, `fs`, `http` (module: `require`d by `scripts/border_design_generator.js` and by `test/unit/model_call_telemetry.test.js`) | **high** — every Node model call in the area runs through it |
| `scripts/perf/model_call_telemetry.py` | model_call_telemetry.py — bound, observe and cancel the model calls the `scripts` area makes. | `python scripts/perf/model_call_telemetry.py --classes` / `--sample 120` | python, stdlib (module: imported by `scripts/byok_vision_gate.py`, `scripts/drag_ux_visual_gate.py`, `scripts/codex_text_leg.py`) | **high** — every Python model call in the area runs through it |
| `scripts/perf/redundant-call-analysis.md` | the measured duplicate scan and the caching RULING: the area's only repeated request is the mandated independent re-ask, so caching is disabled and coalescing is gated per class | read | none | medium — its ruling binds the cache policy |
| `scripts/perf/runtime-perf-baseline.md` | the dossier's telemetry table RE-DERIVED from the relay store by a named command, with the window/percentile convention and the two rows whose counts differ and why | read | `temp/modelstack/telemetry.jsonl` (dossier evidence) | low |
| `scripts/perf/runtime-perf-report.json` | the machine-readable before/after report: baseline + after tables, sample size, and the AC-1..AC-6 pass/fail block | `node scripts/perf/runtime_perf_report.js --out-json <path>` | none | low |
| `scripts/perf/runtime-perf-report.md` | the human-readable report generated by the same run (evidence sources, baseline, after, AC table, decision) | `node scripts/perf/runtime_perf_report.js --out-md <path>` | none | low |
| `scripts/perf/runtime_perf_report.js` | runtime_perf_report.js — the before/after instrument for track `runtime_perf_20261015`. | `node scripts/perf/runtime_perf_report.js --relay-store P --since ISO --until ISO` | node, `readline` (streams the ~580 MB relay store) | medium — its numbers are the track's evidence, so a wrong window changes a verdict |
| `scripts/perf/validate_model_call_telemetry.js` | validate_model_call_telemetry.js — the gate on the scripts area's own model-call telemetry. | `node scripts/perf/validate_model_call_telemetry.js --min-sample 100` | node (module: `require`d by `test/unit/model_call_telemetry.test.js`) | **high** — its exit status is what allows a coverage figure to be cited |
| `scripts/print_raster_diff.js` | per-page pixel diff of two printed-page rasters (mean absolute channel difference + share changed) | `node scripts/print_raster_diff.js <before> <after> [NN ...]` | node, `sharp` | low — read-only, argument-driven |
| `scripts/print_red_pixel_probe.js` | count STRONGLY-RED pixels per printed page and report their bounding box | `node scripts/print_red_pixel_probe.js <dir>` | node, `sharp` | medium `harness` — expects raster dirs that are not in the tree |
| `scripts/recovery_collage.js` | Collage composer for the destructive_recovery_20260911 visual gates. | `node scripts/recovery_collage.js` | node, `sharp` | medium `harness` — historical capture frames |
| `scripts/relay_serving_identity.py` | relay_serving_identity.py — is the process serving THIS project's relay port actually running the relay unit this project has pinned? | `python scripts/relay_serving_identity.py` | python, stdlib + `subprocess`, `urllib` | medium — probes a live port; reads `modelstack.lock` |
| `scripts/release_gate.js` | The release gate — refuse a version bump on a browser suite that is RED, STALE or UNVERIFIED. | `npm run release:check` | node, `child_process`, `fs`, `path` | medium — spawns `git`; its exit status gates a release |
| `scripts/scaling_innerwidth_collision_probe.js` | probe: does the fit-to-container compensation width land on the same element and property the layout record owns? | `node scripts/scaling_innerwidth_collision_probe.js` | node, `test/browser_e2e/_helpers.js` | medium — needs a live browser boot |
| `scripts/scaling_page_collage.js` | side-by-side of the SAME printed page, before vs after the scaling wiring | `node scripts/scaling_page_collage.js` | node, `sharp` | medium `harness` — needs before/after rasters that are not in the tree |
| `scripts/scaling_resize_refire_probe.js` | does a resize of a section re-fire the fit-to-container measure? | `node scripts/scaling_resize_refire_probe.js` | node, `test/browser_e2e/_helpers.js` | medium — needs a live browser boot |
| `scripts/scaling_scale_distribution_probe.js` | the distribution of scales the fit-to-container feature applies on the live demo sheet | `node scripts/scaling_scale_distribution_probe.js` | node, `test/browser_e2e/_helpers.js` | medium — needs a live browser boot |
| `scripts/screenshot.js` | screenshot.js — Capture a D&D Beyond character sheet with the Beyond Print Enhancer extension ACTIVE, using Playwright + Chromium. | `node scripts/screenshot.js <url> [out]` | node, `playwright` | medium — needs a live sheet and a browser |
| `scripts/selection_collage.js` | Collage composer for the selection_model_ia_20260910 visual gates. | `node scripts/selection_collage.js` | node, `sharp` | medium `harness` — historical capture frames |
| `scripts/selection_visual_diff.js` | Deterministic pixel-diff gate for the selection_model_ia_20260910 phase-1 frames — the PRIMARY evidence instrument for AC-1. | `node scripts/selection_visual_diff.js` | node, `sharp`, `child_process` | medium `harness` — its frame dir `vendor/docs/selection-model-ia-20260910/shots-phase1` is gone |
| `scripts/smoke_low_risk.js` | smoke_low_risk.js — the runtime smoke for the `scripts` area's executable low-risk tools (track scripts_runtime_smoke_20261017; closes TECH_DEBT_SCRIPTS.md T-4). | `npm run smoke` (also the prefix of `npm test`) | node, `child_process` (`git status`) | **high** — wired into `npm test`, so a case it holds can fail the suite; its CASES are cross-checked against this table by guard arm 7 (its own row exempt) |
| `scripts/thornvine_acceptance_gate.js` | thornvine_acceptance_gate.js — the binding DETERMINISTIC acceptance gate for the 03-thornvine fix. Encodes the FINAL muse-loop comp (iteration 14, GO) as measurements. A fail is a fail; certification is never rendered from prompt intent. | `node scripts/thornvine_acceptance_gate.js` | node, `fs` | medium `harness` — expects rasters that are not in the tree |

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
| F-8 (2026-10-15, track `runtime_perf_20261015`) | the area's model CALLS were unobservable and effectively unbounded: 5 tracked scripts dial model endpoints directly, none emitted a terminal event anywhere, and the only bound was `urlopen(timeout=N)` / a bare `fetch` — a per-READ socket timeout does not bound a call, and `border_design_generator.js` declared no timeout at all | **FIXED** — a shared budget+telemetry helper in both runtimes (`scripts/perf/model_call_telemetry.{py,js}`), wired at 4 direct sites (the 5th reaches its seat through one of them); 12 new rows above; the one call site this could NOT reach (`scripts/muse_gate.py`, gitignored by name) is recorded as T-6 rather than counted as coverage |
| F-9 (2026-10-17, track `scripts_inventory_hygiene_20261017`) | **the inventory's declared SHAPE was false in three of four classes, from the day it was written**: §1 said *"66 files: 47 `.js`, 9 `.py`, 2 `.json`, 8 `.md`"* while `git ls-files scripts` reported 48/9/3/6 at `b6db36d` and at `25c7567`. Only `.py` was right; the total was right, which is why nothing noticed — `47+9+2+8` and `48+9+3+6` are both 66. The guard compared the row SET and **nothing read the sentence** | **FIXED + GUARDED** — §1 corrected from measurement (with the correction recorded in place), and the guard gained **arm 5**: it parses the shape sentence and fails on any class or total that disagrees with `git ls-files scripts`, including a *deleted* declaration. Run against the uncorrected file it reported exactly `.js declared 47, measured 48` / `.json declared 2, measured 3` / `.md declared 8, measured 6` |
| F-10 (2026-10-17, track `scripts_inventory_hygiene_20261017`) | **nine `.py` files were read by no gate in this repository** — not for syntax, not for anything: `npm run lint` runs eslint (which parses the `.js` files), then two guards that parse nothing, and `git grep -E "py_compile\|ruff\|flake8\|python -m"` over the whole tracked tree returned **0 hits**, while the dossier's AC-5 names "syntax errors" explicitly | **FIXED + GUARDED** — the guard gained **arm 6**: every tracked `.py` is compiled by an interpreter (parsed, never imported, no bytecode written). The interpreter is probed (`python3` then `python`, and it reports which answered — on this host `python3` is an EACCES stub and `python` is 3.12.0); an absent interpreter is an ADVISORY that names what was NOT covered, never a failure (D-4) |
| F-11 (2026-10-17, track `scripts_inventory_hygiene_20261017`) | **the guard's own self-description was stale**: its header stated *"54 tracked files … 44 Node CLIs, 8 Python tools and one data file, of which only three are reached from `package.json` and seven from tests"*, measured today as 66 / 48 / 9 / 3 data files + 6 docs / four `package.json` entries / eight test-required modules | **FIXED** — the header's census is re-derived from this cycle's measurements and names the command that produced each number, and it records what the stale numbers were, so a reader can see the drift rather than a silently corrected sentence |

## 5. Remaining known debt (not addressed here)

* **T-1 — the area mixes reusable tooling with spent one-off harnesses.** 30 of the 54 files measured
  on 2026-10-14's surface (the area is 66 today; the 12 `scripts/perf/` paths added since are live
  tooling, not harnesses) are single-track probes/collage composers whose inputs
  (`demo/ignored/**`, `nanobanana-output/**`, `temp/visual_logs/**`, migrated `assets/*.gif`) no
  longer exist, while 11 are live tools wired into lint, the release gate or the test suite. Nothing
  marks the difference except §3's risk column. Suggested direction: a `scripts/harness/` partition or
  a documented retirement rule — out of scope here, because moving files changes every citation that
  names them.
  **CLASSIFIED + RULED 2026-10-17 (track `scripts_debt_sweep_20261017`; operator ruling: documented
  retirement rule + harness class, zero moves, zero deletions).** The 25 executable rows whose risk
  cell marks absent inputs now carry the explicit `harness` marker in §3 (counted and reported by
  the guard's arm 8 on every run — an unclassified row whose cell claims absent inputs is a
  failure, so a new harness cannot arrive unmarked). The retirement rule this classification feeds:
  - **A harness retires when** its inputs are permanently gone (the marked condition) AND no live
    citation names it (no row of `TECH_DEBT_SCRIPTS.md` §3, no `package.json` wiring, no
    `require()` from a live tool or test, no registry/archive row marked as the record of a still
    load-bearing artifact).
  - **The deletion checklist a retiring change satisfies in the SAME change:** (1) `git rm` the
    file; (2) its §3 row removed and §1's shape sentence re-derived (arm 5 fails otherwise);
    (3) every citation naming it updated — conductor rows/reports name the retirement commit, they
    are not rewritten; (4) the guard's arm-8 census re-derived (the count falls by the rows
    retired); (5) the falsification suite's fixture row counts updated if they pin the census.
  - **The `scripts/harness/` partition stays rejected** (deliberation record, candidate_b): 25 path
    moves would break every archived citation at once. Recall condition: the first time a
    harness's absent inputs cause a wrong verdict, or the first operator ruling to retire outright.
* **T-2 — the POSIX exec bit is untracked (F-4).** Reversal condition: the first citation that
  invokes a script as `./scripts/<file>`, or the first POSIX run of the suite. The check activates
  its assertion automatically the moment any tracked file in the repo carries mode `100755`.
* **T-3 — per-script dependency declarations (F-6).** The three real dependencies (`sharp`,
  `playwright`, `pngjs`) are devDependencies, so nothing is broken today; a future script that
  needs a runtime dependency would not be caught by anything.
* **T-4 — no runtime smoke test.** Nothing verifies that the 11 `low`-risk tools still run: the
  suite exercises some of them as modules, but `check_border_svg_injection.js` and
  `check_scripts_hygiene.js` are the only ones executed end-to-end by a gate. **Narrowed 2026-10-17:**
  the Python files are now at least PARSED by a gate (arm 6 of the guard), so a `.py` that no longer
  compiles is caught; whether each tool still DOES its job remains open.
  **CLOSED 2026-10-17 (track `scripts_runtime_smoke_20261017`):** `scripts/smoke_low_risk.js`
  executes each executable `low` row END-TO-END as a child process with its documented invocation
  (`npm run smoke`, and the prefix of `npm test`), and requires per case: exit 0, NON-EMPTY stdout
  (the exit-0-but-inert degenerate case the dead_exports review named FLAW-01), and an unchanged
  `git status --porcelain` report; a hang trips the per-case 120 s kill. The two argument-driven
  cases run on committed synthetic inputs (`test/fixtures/smoke/page-{a,b}-NN.png`, and a tracked
  `assets/` image for `get_image_metadata.js`), so a fresh clone passes. Guard arm 7 holds §3's
  executable `low` rows and the runner's CASES equal in both directions. Measured cost: the full
  smoke is ~46-51 s serial (the two dead-export tools are ~46 s of it), which is why it is wired
  into `npm test` and NOT into `npm run lint` (~2.6 s, unchanged). Residuals, carried as new debt:
  the `medium`/`high` rows are still un-smoked (T-9); the no-mutation check cannot see writes into
  gitignored paths (T-10).
* **T-6 — one model-call site is untracked, so it is not governed and not instrumented.**
  `scripts/muse_gate.py` (the mandated GATE reviewer seat, 600 s socket timeout, no terminal
  telemetry) is gitignored by name (`.gitignore:200`) beside `input_budget_report.py` and
  `verify_lanes.py`, and `temp/text_fallback.py` (its DeepSeek fallback transport) is untracked with
  the rest of `temp/`. Neither can be fixed by a commit from a worktree that does not contain them.
  Reversal condition: the first track that makes them tracked, OR any session working in the main
  checkout — the fix is one `call_model(...)` wrapper each, and `scripts/perf/budgets.json` already
  carries `scripts/muse_gate.py`'s budget with `not_wired: true`. Named in
  `scripts/perf/model-call-sites.md` §Not wired and in the track's `final_report.md`.
* **T-5 — the dossier's 7-file count is unreconciled** (§1). Not fixable here: the dossier was
  authored from an inventory this session cannot see. If the idlegate census is instrumented
  again, its area count for `scripts` should be re-measured against `git ls-files scripts`.
* **T-7 — the nine shebangs say `python3`, and this delivery host answers `python` only** (measured
  2026-10-17: `python3 --version` → `EACCES`, a Windows Store stub; `python --version` → 3.12.0).
  Nothing is broken today — every invocation in §3 is explicit (`python scripts/<file>.py`), and the
  new syntax arm probes both names and reports which one answered — but a POSIX host that resolves
  only `python` (or only `python3`) would disagree with either the shebang or the invocation column.
  Reversal condition: the first POSIX run of the suite, or the first `./scripts/<file>.py` invocation
  (which is also T-2's trigger). The fix then is one convention applied to all nine files and to §3's
  invocation column in the same change, never one without the other.
* **T-8 — the row CELLS are shape-checked, not content-checked.** The guard asserts that every row has
  five columns and a valid risk level, and that the row set equals the tracked set; it cannot tell that
  a purpose sentence or an invocation line has become false about a file nobody edited. That is the
  same defect class as F-9 one level down, and it is left open deliberately: F-9 was closable because
  the claim was arithmetic over `git ls-files` output, while a purpose sentence has no machine-checkable
  ground truth. A future track could narrow it by requiring the row's purpose to be the file's OWN
  header text (which arm 2 already demands exists). Reversal condition: the first row found stating a
  purpose its file no longer serves.
* **T-9 — the `medium` and `high` rows are not smoked.** The runtime smoke of 2026-10-17 covers the
  11 executable `low` rows only; 20 executable rows rated `medium` or `high` (visual-gate drivers,
  collage composers, the model-call helpers, the smoke itself) have no end-to-end gate, for the
  measured reasons their §3 rows state — absent inputs, live seats, live browsers, and blast radius.
  The two `high` telemetry helpers' self-test flags (`node scripts/perf/model_call_telemetry.js
  --self-test`, `python scripts/perf/model_call_telemetry.py --classes`) were measured passing on
  2026-10-17 and are the natural first two cases. Reversal condition: the first track that builds
  the missing fixture environments, or the first `medium` row whose inputs become present in the
  tree — either extends `scripts/smoke_low_risk.js`'s CASES (arm 7 then holds the new row equal).
* **T-10 — the no-mutation assertion cannot see writes into gitignored paths.**
  `git status --porcelain` reports tracked changes and untracked files only; `temp/**` and
  `__pycache__/` are sanctioned scratch and correctly invisible, but any OTHER gitignored path a
  smoked tool wrote would pass the smoke silently. The runner's own header states this on every run.
  Reversal condition: the first evidence that a `low`-risk tool writes outside its documented
  outputs — the fix is a per-case ignored-path audit (e.g. `git status --porcelain --ignored`
  diffed against a pre-approved scratch set), not a widening of this file's scope.

## 6. Suggested follow-up tracks

1. **Script-surface consolidation (T-1):** partition reusable tooling from spent harnesses, and
   retire the harnesses whose inputs are permanently gone — with the citations updated in the same
   change. This is the highest-value follow-up: the risk column shows the split is 30 to 11.
2. **Dependency declaration for scripts (T-3):** a declared per-script dependency field (or a lint
   rule over `require()` targets) so a missing `package.json` entry cannot ship.
3. **Runtime smoke test (T-4):** run every `low`-risk tool once in a synthetic fixture directory and
   assert exit 0 and no repo mutation. Feasible because those tools are argument-driven.
   **DELIVERED 2026-10-17 (track `scripts_runtime_smoke_20261017`):** `scripts/smoke_low_risk.js`,
   wired into `npm test` (+ `npm run smoke`), with guard arm 7 cross-checking §3 and the case table
   in both directions. Residuals T-9 (medium/high rows) + T-10 (gitignored writes) carry reversal
   conditions instead of being left open.
4. **Language-specific linting:** the area already passes eslint (including `scripts/**/*.js`), and
   since 2026-10-17 the nine Python files are PARSED by the guard's arm 6 (a `.py` that does not compile
   is now a `npm run lint` failure). What remains is a real Python LINTER (unused names, shadowing,
   bare `except`) — the parse is the floor, not the ceiling.
