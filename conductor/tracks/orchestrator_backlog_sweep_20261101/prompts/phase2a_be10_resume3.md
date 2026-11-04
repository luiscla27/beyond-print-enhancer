# Phase 2a RESUME #3 — BEYOND-10 · SC-D2 AI border refinement loop (session #3)

You are an external reasonix session cloned from the orchestrator (same relay 127.0.0.1:38116, same
vendor skills, same yolo plumbing, write access to `C:\luiscla27\projects\dndbeyond-printenhance`).
You are the THIRD session on this phase. Session #1 landed the implementation but was reaped by host
job cleanup mid-edit (~156k tok). Session #2 was reaped at the workspace-contention guard after
~23k tok, having added nothing new (it only read). ALL prior work is uncommitted on disk and was
re-verified by the orchestrator at 11:2xZ: every file below passes `node --check`.

FIRST read: `conductor/tracks/orchestrator_backlog_sweep_20261101/prompts/LAUNCH-PROMPT-TEMPLATE.md`
(rules), then `conductor/tracks/beyond10_ai_border_refine_loop/` (spec.md, plan.md, metadata.json,
deliberation/ — written by session #1), then this brief.

## 1. The exact state on disk (orchestrator-verified 2026-11-01 ~11:2xZ, HEAD 3a6ecb5)

MODIFIED (10 files):
- `js/ai_border.js` (+170): absolute parameter model. `renderBorderSvg` records the design it
  painted (`data-border-base-svg`); `adjustBorderSvg` derives painted bytes FROM THE DESIGN every
  time (`transform(base, {weight, styleIndex})` — never ratchets on painted bytes); seams
  `readBorderAdjust(section)` / `restoreBorderAdjust(section, adjust)`, `normalizeAdjust`, fail-soft
  refusal on a base the trust root rejects.
- `js/layout_scan.js` (+27): records `borderAdjust` (`{base, weight, styleIndex}`) beside
  `borderSvg` through the choke point's own reader, ONLY when refined.
- `js/layout_apply.js` (+15): rehydrate — paints `borderSvg`, then
  `window.AiBorder.restoreBorderAdjust(section, styles.borderAdjust)` AFTER the paint (order is
  load-bearing).
- `js/properties_panel.js` (+37): the refine strip (weight/style controls).
- `js/background.js` (+4): wiring.
- `test/browser_e2e/_helpers/inject.js` (+~110): the `refineBorder` probe action — `open`/`close`
  the surface, REAL `click` on `[data-be-refine-weight]` / `[data-be-refine-style]` /
  `[data-be-refine-regenerate]` / `[data-be-refine-compare]`, reads `window.BorderRefine.getState()`
  and what the product would SAVE via `window.scanLayout()`.
- `test/browser_e2e/byok_border_gallery.spec.js`: the BEYOND-10 refinement FLOW block (3 describes,
  11 `it`s total in the file; drives the real controls through the probe; includes the
  not-adjustable/fill-only path).
- `test/browser_e2e/spec_inventory.json` + `spec_pending.json`: regenerated (448 tests collected
  now; measured_at 2026-11-01).
- `test/unit/dead_exports.test.js`: session #1 registered the new module's exports so the
  dead-export gate stays green. VERIFY this diff is coherent with `js/border_refine.js`'s actual
  exports; fix either side if it is not.

NEW (untracked):
- `js/border_refine.js`: the surface (`window.BorderRefine`): `open(section)`, `close()`, `sync()`,
  `getState()`, pending-selection model (adjust → THEN regenerate), `regenerate` = pure
  `transform(design, {weight, styleIndex})` (no AI call), `compare`, `revert` (weight 1 / solid),
  `announce()`, not-adjustable gating via `canAdjustBorder`.
- `test/unit/border_refine_loop.test.js` (456 lines): the unit contract. At 11:1xZ the orchestrator
  measured it 15/15 PASSING together with `test/unit/ai_border_refine_ac2.test.js` 20/20.
- `scripts/border_refine_gdetect.js` (278 lines): G-DETECT. Renders design vs refined through the
  product's own paint mechanism (the four inline custom properties + the
  `.print-section-container::before` border-image rule from `js/print_styles.js:1226`, knobs from
  `AiBorder.BORDER_IMAGE_KNOBS`), screenshots both, pixel-diffs (changed_px > 8 RGB delta,
  ink_delta), PASS rule stated in code (≥0.5% canvas changed AND ink increased). Has `main()` wired
  to argv (`--weight --style --design --keep`) and `process.exit`. NEVER RUN by session #1 or #2.
- `conductor/tracks/beyond10_ai_border_refine_loop/`: spec.md, plan.md, metadata.json, deliberation/
  (4 candidates + counterfactual_ledger.md + evaluation_matrix.md).

## 2. What REMAINS — in this order (do NOT redo what is on disk; verify first, fix only if broken)

1. **Re-verify the unit contracts at this tree** (fast, gives you the GREEN baseline):
   `npx mocha test/unit/border_refine_loop.test.js test/unit/ai_border_refine_ac2.test.js --reporter dot`
   and `npx mocha test/unit/dead_exports.test.js --reporter dot`. If any red, fix it FIRST and
   record why (stash/unstash to prove RED was product-side, per TDD).
2. **Run G-DETECT** (AC-5): `node scripts/border_refine_gdetect.js` (and at least one other design,
   e.g. `--design 03-thornvine --weight 1.25 --style 2`). It writes `temp/visual_logs/beyond10_gdetect/`
   (two frames + diff + report.json). If it fails, debug the runner (it is NEW code; the paint
   mechanism description in its header is the spec). Record the measured numbers (changed_px %,
   ink_delta, sha256s) for verification.md.
3. **Run the e2e flow block** (AC-1..AC-4): `BORDER_GALLERY_SHOTS=1 npx mocha
   test/browser_e2e/byok_border_gallery.spec.js --timeout 900000 --reporter dot` — ONE spec file,
   ONE mocha process (batching two e2e files breaks `reinject()` after `page.reload()` — measured
   BEYOND-9 finding). Chromium is installed. Run it in YOUR own inner background job with a long
   wait (several minutes). If the flow block reds, fix the PRODUCT or the SURFACE wiring (not the
   test's intent); the probe clicks real buttons — a red there is a real wiring defect.
4. **Regression sweep** (one spec per process, pick the owning neighborhoods):
   `test/browser_e2e/border_render_refine.spec.js`, `border_picker_base.spec.js`,
   `byok_border_roundtrip.spec.js`, `state_feedback_ai_borders.spec.js`, and the BEYOND-9 owner
   `layer_print_visibility.spec.js` (14/14 must stay green — your rehydrate work touches the same
   apply path). Record each pass count.
5. **Full gates**: `npm test` (composite; KNOWN BASELINE: `test/unit/input_budget_alignment.test.js`
   has 2 PRE-EXISTING failures on a clean tree — framework findings F4/F8, proven by stash; do not
   chase, do not count as yours), `npm run lint`, `node --check` on every touched file,
   `PYTHONDONTWRITEBYTECODE=1 python vendor/housekeeping_guard.py check` (deliberation must read
   ADMITTED — iterate on its citation-format errors if it complains).
6. **Commits — LOCAL ONLY, never push** (check `git status` first; HEAD is `3a6ecb5`; if it moved,
   rebase your WIP):
   - Commit A (product): the 10 modified + 3 new product/test files — message cites BEYOND-10.
   - Commit B (track record): `conductor/tracks/beyond10_ai_border_refine_loop/` docs.
   Record BOTH SHAs. The evidence chain needs the IMPLEMENTATION commit's own tree
   (testedTreeOid = commit A's tree — BEYOND-9 measured the AT-26 tree-mismatch refusal when the
   head tree was cited instead).
7. **Close-out**: `verification.md` + `final_report.md` in the track dir, then ARCHIVE the track to
   `conductor/archive/beyond10_ai_border_refine_loop/`.
8. **Orchestrator report** (your deliverable besides code):
   `conductor/tracks/orchestrator_backlog_sweep_20261101/reports/phase2a_be10.md` — per AC:
   already-shipped vs your gap (file:line evidence), what you changed + architecture decisions
   (absolute parameter model; design-derived re-apply; pending-selection regenerate; persist ask
   via the scheduleAutosave seam), amendments to the plan, struggles + cumulative measured results
   (include the two reaped sessions), knowledge for future sessions, final gate results with exact
   commands + pass counts, both commit SHAs, G-DETECT measured numbers.
9. **Token handoff**: you will likely need 150-300k tokens. If you hit the YELLOW band with work
   left, STOP and write `conductor/tracks/beyond10_ai_border_refine_loop/ORCHESTRATOR_HANDOFF.md`
   (done/remaining/exact next commands/WIP state). Do not degrade quality to finish.

## 3. Card ACs (for your verification.md mapping)
1. Border gallery UI exposes weight/style adjustment controls
2. Refinement loop: select variant -> adjust parameters -> regenerate -> compare
3. Adjustments persist in session and settings
4. E2E test byok_border_gallery.spec.js extended with refinement flow
5. Gate G-DETECT passes for refined border output

## 4. Hard rules (restated)
Real tests only. Never modify production to make a test pass (record BLOCKED_PRODUCTION_DEFECT
instead). No stubs in e2e; the isolated-world `window.AiBorder` seam is the product's own code.
Local commits only, never push. After 6 identical failures on one target, consult the external
consultant (DeepSeek Pro via the fleet escalation path) and record the exchange. You are NOT the
Gemini verifier seat. When done, report.
