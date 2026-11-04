# Phase 2a RESUME — BEYOND-10 · SC-D2 AI border refinement loop (session #2)

You are an external reasonix session cloned from the orchestrator (same relay 127.0.0.1:38116, same
vendor skills, same yolo plumbing, write access to `C:\luiscla27\projects\dndbeyond-printenhance`).
You are RESUMING a phase whose previous worker session was reaped by host job cleanup at ~156k
tokens, mid-edit, AFTER the implementation landed. Nothing is lost: all its work is uncommitted on
disk and verified. Read `conductor/tracks/orchestrator_backlog_sweep_20261101/prompts/LAUNCH-PROMPT-TEMPLATE.md`
first (rules), then `conductor/tracks/beyond10_ai_border_refine_loop/` (spec.md, plan.md,
metadata.json, deliberation/ — all written by session #1), then this brief.

## 1. Where the previous session left it (ALL VERIFIED by the orchestrator just now)

Uncommitted on disk at HEAD `3a6ecb5` (BEYOND-9 close-out docs commit):

MODIFIED (5 files, +250 lines, all `node --check` OK):
- `js/ai_border.js` (+170): the ABSOLUTE parameter model. `renderBorderSvg` records the design it
  painted (`data-border-base-svg`); `adjustBorderSvg` derives painted bytes FROM THE DESIGN every
  time (`transform(base, {weight, styleIndex})` — never ratcheting on painted bytes); added
  `readBorderAdjust(section)` / `restoreBorderAdjust(section, adjust)` seams, `normalizeAdjust`,
  fail-soft refusal on a base the trust root rejects.
- `js/layout_scan.js` (+27): records `borderAdjust` (`{base, weight, styleIndex}`) beside
  `borderSvg` through the choke point's own reader, ONLY when refined (null otherwise — unrefined
  and deliberately-reverted are the same state, so the field is absent).
- `js/layout_apply.js` (+15): rehydrate side — paints the record's `borderSvg`, then
  `window.AiBorder.restoreBorderAdjust(section, styles.borderAdjust)` AFTER the paint (order is
  load-bearing: the choke point treats a fresh paint as unrefined).
- `js/properties_panel.js` (+37): the refine strip (weight/style controls) in the properties panel.
- `js/background.js` (+4): wiring.

NEW (untracked, verified):
- `js/border_refine.js`: the refinement surface — `window.BorderRefine` with
  `open(section)` / `close()` / `sync()` / `getState()`, pending-selection model
  (adjust → THEN regenerate, per the card's AC-2 order), `regenerate` = pure
  `transform(design, {weight, styleIndex})` (no AI call — the refinement is over PARAMETERS),
  `compare` = design vs refined bytes, `revert` = weight 1 / solid, `announce()`, not-adjustable
  gating via `canAdjustBorder`.
- `test/unit/border_refine_loop.test.js`: the unit contract. **15/15 PASSING** (measured by the
  orchestrator: `npx mocha test/unit/border_refine_loop.test.js --reporter dot`). It documents the
  RED it proved first (no module, no controls, no absolute model, no persist ask).
- `conductor/tracks/beyond10_ai_border_refine_loop/`: spec.md, plan.md, metadata.json
  (msf_key BEYOND-10-AI-BORDER-REFINE-LOOP-20261101, deliberation required), deliberation/ with
  all 4 candidates + counterfactual_ledger.md + evaluation_matrix.md (the guard reads this).

ALSO GREEN (measured by the orchestrator at this exact tree):
- `npx mocha test/unit/ai_border_refine_ac2.test.js` — **20/20 passing** (the shipped library half).
- `node --check` on all 6 js files — OK.

The previous session's LAST narration line was: "Now the e2e spec extension:" — i.e. it was about
to extend `test/browser_e2e/byok_border_gallery.spec.js`. That is exactly where you start.

## 2. What REMAINS (from the previous session's own plan, Phase 2 onward — do not redo Phase 0/1)

1. **AC-4**: extend `test/browser_e2e/byok_border_gallery.spec.js` IN PLACE with the refinement
   FLOW block driving the real controls in the real page: select variant → weight/style →
   regenerate → compare; plus the not-adjustable (fill-only) path. NOTE the spec already has an
   AC-2 seam-level block (line ~283+, "option A, operator decision 2026-10-26", NON-capturing,
   driving `aiArrangeProbe` applyBorder/adjustBorder) — your flow block must drive the REAL
   `window.BorderRefine` surface, not just the choke point. Harness rule: ONE spec file per mocha
   process (batching two e2e files breaks `reinject()` after `page.reload()` — BEYOND-9 finding).
   Run: `npx mocha test/browser_e2e/byok_border_gallery.spec.js --timeout 900000 --reporter dot`
   (Chromium is installed; run in YOUR own inner background job with a long wait — the e2e takes
   minutes).
2. **AC-5 / G-DETECT**: create `scripts/border_refine_gdetect.js` — the plan defines it: same
   design and its refined version rendered in a real browser, pixel-diffed, exit code = verdict.
   Check how other gate scripts in `scripts/` do pixel diffing (grep for existing gate runners;
   BEYOND-9's verification.md shows the gate-evidence format). Run it, record the measurement.
3. `test/browser_e2e/spec_inventory.json` — regenerate DELIBERATELY (your added cases change the
   collected count) and update the pending map with the measurement it names.
4. Full gates: `npm test` (composite; KNOWN BASELINE: `test/unit/input_budget_alignment.test.js`
   has 2 PRE-EXISTING failures on a clean tree — F4/F8 framework findings, proven by stash; do
   not chase them, do not count them as yours), `npm run lint`, `node --check` every touched file,
   the G-DETECT runner, `PYTHONDONTWRITEBYTECODE=1 python vendor/housekeeping_guard.py check`
   (deliberation must read ADMITTED — iterate on its citation-format errors if it complains; the
   previous session already wrote the matrix + ledger).
5. Commits, LOCAL ONLY (never push — fleet hard rule; check `git status` first; if HEAD moved,
   rebase your WIP):
   - Commit A (product): `js/ai_border.js js/layout_scan.js js/layout_apply.js js/properties_panel.js
     js/background.js js/border_refine.js test/unit/border_refine_loop.test.js
     test/browser_e2e/byok_border_gallery.spec.js scripts/border_refine_gdetect.js
     test/browser_e2e/spec_inventory.json` — message cites BEYOND-10.
   - Commit B (track record): `conductor/tracks/beyond10_ai_border_refine_loop/` — docs only.
   Record BOTH SHAs; the evidence chain needs the IMPLEMENTATION commit's own tree (testedTreeOid
   must be commit A's tree, not the later head tree — BEYOND-9 measured this refusal: AT-26 tree
   mismatch).
6. Close-out: `verification.md` + `final_report.md` in the track dir, then ARCHIVE the track to
   `conductor/archive/beyond10_ai_border_refine_loop/` (housekeeping guard convention: completed
   tracks archive; this repo has no conductor/tracks.md for a keep-live exception).
7. **Orchestrator report** (your deliverable besides code):
   `conductor/tracks/orchestrator_backlog_sweep_20261101/reports/phase2a_be10.md` — per AC:
   already-shipped vs your gap (file:line evidence), what you changed + architecture decisions
   (absolute parameter model; design-derived re-apply; pending-selection regenerate; persist ask
   via the scheduleAutosave seam), amendments to the plan, struggles + cumulative measured results,
   knowledge for future sessions, final gate results with exact commands + pass counts, both
   commit SHAs.
8. Token handoff: you will likely need 100-250k tokens. If you hit the YELLOW band with work left,
   STOP and write `conductor/tracks/beyond10_ai_border_refine_loop/ORCHESTRATOR_HANDOFF.md`
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
