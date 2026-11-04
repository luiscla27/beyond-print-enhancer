---
type: track-plan
title: "plan — BEYOND-10 / SC-D2 AI border refinement loop"
description: "Steps, verification vehicles and checkpoints for the AI border refinement loop: reproduce, TDD red->green, gates, commit. Every box carries what was MEASURED."
tags: [track, beyond-10, sc-d2, plan, tdd]
status: complete
generated: 2026-11-01
sources: [conductor/archive/beyond10_ai_border_refine_loop/spec.md, conductor/archive/beyond10_ai_border_refine_loop/verification.md]
---

# plan — BEYOND-10 / SC-D2 AI border refinement loop

Track: `beyond10_ai_border_refine_loop` · parent **BEYOND-10** · deliberation: **required** ·
status **COMPLETE** · archived at `conductor/archive/beyond10_ai_border_refine_loop/`
Verification vehicles: `test/browser_e2e/byok_border_gallery.spec.js` (the card's own spec, extended),
`test/unit/border_refine_loop.test.js` (the new contract), `test/unit/ai_border_refine_ac2.test.js`
(the shipped library half), `node scripts/border_refine_gdetect.js` (G-DETECT), `npm run lint`,
`node --check`, `npm test`, `python vendor/housekeeping_guard.py check`.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done (with what was measured).

## Phase 0 — Reproduce before touching product code

- [x] Run the owning e2e spec on the CURRENT tree as the BEFORE baseline —
      `npx mocha test/browser_e2e/byok_border_gallery.spec.js --timeout 900000`: **0 passing /
      62 pending** (the flag-gated suite skips without `BORDER_GALLERY_SHOTS=1`).
- [x] Run the shipped refinement contract as the BEFORE baseline —
      `npx mocha test/unit/ai_border_refine_ac2.test.js`: **20 passing / 0 failing**.
- [x] RED (product gap): `grep -rn "adjustBorderSvg\|canAdjustBorder\|transformBorderSvg" js/` returns
      NO caller outside `js/ai_border.js`; `window.BorderRefine` does not exist; the properties panel
      has no refine row. Recorded in `spec.md`'s certification table, not inferred.
- [x] RED (contract): `test/unit/border_refine_loop.test.js` written first and RUN RED against the
      current tree — **0 passing / 15 failing**, every case on its own assertion.

## Phase 1 — Green: the refinement loop as product code

- [x] `js/ai_border.js`: the ABSOLUTE parameter model. `renderBorderSvg` records the design it painted
      (`data-border-base-svg`) and resets the parameters; `adjustBorderSvg` derives from the design
      every time and records `data-border-weight` / `data-border-style`; `readBorderAdjust` /
      `restoreBorderAdjust` read and rehydrate them through the trust root; `normalizeAdjust` refuses a
      weight that cannot be honoured (`invalid_weight`).
- [x] `js/border_refine.js` (new): the surface — variant list (the product's own `custom_borders`
      library), five weight steps, three style steps, Regenerate, Compare, Revert, and the
      `not_adjustable` disabled state with an inline reason.
- [x] `js/properties_panel.js`: the product caller — a "Refine AI border" row, present exactly when the
      selected section carries an AI border (`AiBorder.hasBorderSvg`).
- [x] AC-3 persistence: every refine write asks `window.scheduleAutosave()` (BEYOND-9's seam);
      `js/layout_scan.js` writes `borderAdjust` into the section record (all four record sites);
      `js/layout_apply.js` restores it after the paint; `js/undo.js`'s flag snapshot carries it so an
      undo cannot leave the artwork and the parameters disagreeing.
- [x] `js/background.js`: the new module in the injected file list (and a measured note that a quote
      mark in a comment inside that array breaks `test/browser_e2e/_helpers/dom.js`'s parse).

## Phase 2 — AC-4 + AC-5: the refinement FLOW, and G-DETECT measured

- [x] `test/browser_e2e/byok_border_gallery.spec.js`: a `BEYOND-10 refinement flow` block (4 cases)
      driving the real controls (`refineBorder` probe: open / click / record / compare / panelRow), plus
      a fill-only case that proves the disabled state paints nothing.
- [x] `scripts/border_refine_gdetect.js` (new): G-DETECT measured in real Chromium through the product's
      own `border-image` slot — **PASS: 6541 / 306240 px changed (2.136%), ink 5364 → 7392 (+2028)**,
      with a negative control that fails on a no-op refinement.
- [x] `test/browser_e2e/spec_inventory.json` regenerated deliberately (`node scripts/gen_spec_inventory.js`)
      — gallery 62 → 66 collected; the run also corrected pre-existing drift (82 → 87 spec files).
- [x] `test/browser_e2e/spec_pending.json` — gallery 62 → 66, read from a REAL flag-less run of that one
      spec, provenance amended.

## Phase 3 — Gates, evidence, commit

- [x] `npm run lint` clean (36 checks, 0 violations; scripts hygiene OK); `node --check` clean on all
      touched files; `npm test` composite recorded in `verification.md` (the 2 known-red
      `input_budget_alignment` cases are the fleet baseline); G-DETECT PASS;
      `python vendor/housekeeping_guard.py check` OK with deliberation ADMITTED.
- [x] Coverage of the new module, measured from V8 coverage (no runner in devDependencies):
      **94.4% of functions, 99.8% of bytes**.
- [x] Commit product code first, track record second (local only — never push).
- [x] `verification.md`, `final_report.md`, and the orchestrator report
      `conductor/tracks/orchestrator_backlog_sweep_20261101/reports/phase2a_be10.md` — all three
      written in this session and committed with the record.

## Owed to a healthy e2e host — DISCHARGED in session 2 (it was never the host)

Session 1 recorded the four new e2e cases as collecting (66 pending, up from 62) but never executing,
because `bootPage` timed out at `READY_SELECTOR` for every spec here, including untouched ones
(`border_picker_base.spec.js` → 1 passing / 3 failing). Session 2 proved that was a PRODUCT defect from
this track's own new module, not the host, and closed it:

- [x] `js/border_refine.js`: a top-level `const state` collided with `js/dnd.js:437`'s `let state` in the
      injected file list's ONE shared global scope, so `js/dnd.js` died at parse time
      (`Identifier 'state' has already been declared`), `window.initDragAndDrop` / `window.scheduleAutosave`
      were never published, `js/main.js`'s boot threw, and `#print-layout-wrapper` stayed at height 0 —
      "not visible" to Playwright, hence the 60s `waitForSelector` timeout in EVERY spec. Every top-level
      binding is now uniquely named (`refine*`), including `open`/`close` (window members).
- [x] `test/unit/injected_scope_collision.test.js` (new, 5 cases): the fast-suite guard for the class —
      RED 2 failing on the pre-fix module (the `state` collision + `open`/`close` window shadowing),
      GREEN 5 passing.
- [x] The e2e probe's `facts()` returned its inline text under `reason`, clobbering the click refusal's
      own `reason`; renamed to `inlineReason` (harness defect — the product was correct).
- [x] **The flow cases EXECUTED: 4 passing / 0 failing (37s)**, and the untouched control spec the first
      record blamed went **1 passing / 3 failing → 4 passing / 0 failing**.
- [x] A/B proof, same browser and page: production list minus `js/border_refine.js` →
      `initDragAndDrop: function`, no page errors, wrapper `1306x5458`; list as declared → both seams
      `undefined`, both page errors, wrapper height `0`. Full measurement table in `verification.md` §8.

