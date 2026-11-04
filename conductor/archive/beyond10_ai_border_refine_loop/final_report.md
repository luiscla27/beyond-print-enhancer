---
type: track-final-report
title: "final report — BEYOND-10 / SC-D2 AI border refinement loop"
description: "What shipped, why, and what the measured evidence says: the loop, the absolute parameter model, the persistence path, and G-DETECT."
tags: [track, beyond-10, final-report]
status: complete
generated: 2026-11-01
sources: [conductor/archive/beyond10_ai_border_refine_loop/verification.md, conductor/archive/beyond10_ai_border_refine_loop/plan.md]
---

# final report — BEYOND-10 / SC-D2

**Status: COMPLETE** — all five acceptance criteria met and measured, AC-4 now EXECUTED (4 passing in a
real browser) as well as collected. The first session's "the e2e host cannot boot" conclusion was wrong
and is corrected in §"What the first record got wrong".

## What the card asked for, and what changed

| AC | before this track | after |
|----|-------------------|-------|
| AC-1 controls exposed | the transform/gate/seam existed in `js/ai_border.js` with **no product caller**; nothing a user could press | `js/border_refine.js` renders a refine surface (5 weight steps, 3 style steps, Regenerate, Compare, Revert, an inline disabled reason), opened from a new "Refine AI border" row in `js/properties_panel.js` that appears exactly when the selected section carries an AI border |
| AC-2 select → adjust → regenerate → compare | one *relative* transform step, no variant selection, nothing to compare against | the full loop; parameters are **absolute** (`weight` is a multiple of the DESIGN), so 1.5x twice is 1.5x, `compare` is a byte comparison of design vs derived artwork, `revert` is weight 1 / solid |
| AC-3 session + settings | only the adjusted BYTES persisted (the record's `borderSvg`); the parameters existed nowhere and no writer asked for a save | `data-border-base-svg` / `data-border-weight` / `data-border-style` ride the section, `js/layout_scan.js` writes them into the record as `borderAdjust`, `js/layout_apply.js` restores them, and every refine write asks the product's own `window.scheduleAutosave()` (the seam BEYOND-9's `requestLayerPersist` uses) |
| AC-4 spec extended | a seam block that would stay green with the whole surface deleted | a `BEYOND-10 refinement flow` block (4 cases) clicking the REAL buttons and reading what the product would save through `window.scanLayout()` — **executed 4 passing / 0 failing in a real browser** (session 2; the first session could only collect it, see "What the first record got wrong") |
| AC-5 G-DETECT | never measured in this tree | `scripts/border_refine_gdetect.js`: **PASS** — 6541 / 306240 px changed (2.136%), ink 5364 → 7392 (+2028), with a negative control that fails on a no-op refinement |

## The four decisions a future session must know (full record in `deliberation/`)

1. **The panel row, not a modal gallery** (candidate A vs B). The product has no border gallery — only
   the e2e capture harness — and the `custom_borders` library that a gallery would list is EMPTY on a
   real profile (`AiBorder.saveBorder` has no product caller yet). The variant list is fed from that
   library anyway, and degrades to "the design currently painted" when it is empty.
2. **Absolute parameters, design preserved** (candidate D rejected). The shipped seam transformed what
   was PAINTED, so weight compounded (1.5x → 2.25x) and the surface could not report its own position.
   `renderBorderSvg` now records the design it painted as `data-border-base-svg`; `adjustBorderSvg`
   derives from it every time and records the parameters beside it.
3. **"Regenerate" re-derives, it does not re-roll.** The generator is non-deterministic and costs the
   user's credential; a re-roll would destroy the comparison AC-2 also asks for. Recorded in the spec's
   amendments and in the module header.
4. **"Settings" = the section record, not a new key family.** The refinement rides the same record field
   family as `borderSvg`, so the exported settings bundle carries it verbatim
   (`collectSettingsBundle → layout`) and the import path restores it through the same `applyLayout`.

## Measured evidence (exact commands in `verification.md`)

- `npx mocha test/unit/border_refine_loop.test.js` → **18 passing / 0 failing** (RED before: 0/15).
- `npx mocha test/unit/ai_border_refine_ac2.test.js` → **20 passing** — the shipped contract survives the
  absolute model unchanged.
- `node scripts/border_refine_gdetect.js` → **G-DETECT PASS** (numbers above; artifacts under
  `temp/visual_logs/beyond10_gdetect/`).
- `npm run lint` → clean (36 checks, 0 violations; scripts hygiene OK).
- `node --check` on all six touched `js/` files + both specs → clean.
- `python vendor/housekeeping_guard.py check` → OK, no debt, **deliberation ADMITTED**, 5 criteria sealed.
- Coverage of the new module, from V8 coverage (no runner in devDependencies): **94.4% of functions,
  99.8% of bytes** of `js/border_refine.js`.

## What the first record got wrong (session 2, same day)

The first session closed this track reporting that the four new e2e cases "have not executed in a real
browser on this host: `bootPage` times out at `READY_SELECTOR` for EVERY spec here", and cited the
untouched `border_picker_base.spec.js` (1 passing / 3 failing) as proof the problem was the host.

It was a **product defect introduced by this track's own new module**, and the untouched spec failed for
the same reason every other spec did: they all boot through one injected file list.
`js/border_refine.js` shipped `const state = {…}` at its top level; `js/dnd.js:437` declares
`let state = null`, and the injected files share ONE global scope (`chrome.scripting.executeScript`
evaluates them as classic scripts). dnd.js is injected AFTER the new module, so it died at parse time
with `Identifier 'state' has already been declared`, never published `window.initDragAndDrop` /
`window.scheduleAutosave`, and `js/main.js`'s boot threw at `initDragAndDrop()` — leaving
`#print-layout-wrapper` at height 0, which Playwright reports as "not visible", which is what
`waitForSelector(READY_SELECTOR)` waits for. A 60-second timeout that looks exactly like a dead host.

The A/B that settled it (same browser, same page): production list **minus** `js/border_refine.js` →
`initDragAndDrop: function`, no page errors, wrapper `1306x5458`; the list as declared → both seams
`undefined`, both page errors, wrapper height `0`.

Fixed by naming every top-level binding uniquely (`refine*`, the house rule `js/undo.js` and
`js/recovery_ui.js` already state for `_safeLog`) and by landing
`test/unit/injected_scope_collision.test.js` — a fast-suite guard that fails when two injected modules
declare the same top-level binding, with the fatal lexical case separated from the tolerated
function/var shadowing case, plus a falsifiability case. RED on the pre-fix module: 2 failing (the
`state` collision and `open`/`close` shadowing window members); GREEN after: 5 passing.

Session 2 also fixed a harness defect in the e2e probe (`facts()` clobbered the click-refusal `reason`
with its inline text, so the fill-only case could never pass) and retired two genuinely dead namespace
exports that only became visible to the dead-export census once the shorthand properties were written as
`name: value` pairs.

## The evidence, after the e2e run actually happened

| what | command | measured |
|------|---------|----------|
| **AC-4, executed** | `BORDER_GALLERY_SHOTS=1 npx mocha test/browser_e2e/byok_border_gallery.spec.js --timeout 900000 --grep "BEYOND-10 refinement flow"` | **4 passing / 0 failing (37s)** |
| the untouched control the first record blamed | `npx mocha test/browser_e2e/border_picker_base.spec.js --timeout 900000` | **4 passing / 0 failing** (was 1/3) |
| the new guard | `npx mocha test/unit/injected_scope_collision.test.js` | **5 passing** (RED 2 failing pre-fix) |
| the contract | `npx mocha test/unit/border_refine_loop.test.js` | **18 passing** |
| the shipped contract | `npx mocha test/unit/ai_border_refine_ac2.test.js` | **20 passing** |
| composite | `npm test` | **2276 passing / 2 failing** (the F4/F8 baseline) |

## Delivery

Local commits only, no push (`noPushPerformed: true`):

1. **implementation** — `3ccd5fe`: `js/ai_border.js`, `js/border_refine.js` (new), `js/properties_panel.js`,
   `js/layout_scan.js`, `js/layout_apply.js`, `js/undo.js`, `js/background.js`,
   `test/unit/border_refine_loop.test.js` (new), `test/unit/dead_exports.test.js`,
   `test/browser_e2e/_helpers/inject.js`, `test/browser_e2e/byok_border_gallery.spec.js`,
   `test/browser_e2e/spec_inventory.json`, `test/browser_e2e/spec_pending.json`,
   `scripts/border_refine_gdetect.js` (new).
2. **boot fix + guard** — `75829a0`: `js/border_refine.js` (unique top-level names),
   `test/unit/injected_scope_collision.test.js` (new), the probe's `inlineReason` key, the two spec
   assertions that read it.
3. **track record** — `8c615c0`, `7d524ba`, `5684221`, and this correction.

