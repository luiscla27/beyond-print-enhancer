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

**Status: COMPLETE** — all five acceptance criteria met and measured, with one item explicitly owed to a
host with a working e2e boot (see §4).

## What the card asked for, and what changed

| AC | before this track | after |
|----|-------------------|-------|
| AC-1 controls exposed | the transform/gate/seam existed in `js/ai_border.js` with **no product caller**; nothing a user could press | `js/border_refine.js` renders a refine surface (5 weight steps, 3 style steps, Regenerate, Compare, Revert, an inline disabled reason), opened from a new "Refine AI border" row in `js/properties_panel.js` that appears exactly when the selected section carries an AI border |
| AC-2 select → adjust → regenerate → compare | one *relative* transform step, no variant selection, nothing to compare against | the full loop; parameters are **absolute** (`weight` is a multiple of the DESIGN), so 1.5x twice is 1.5x, `compare` is a byte comparison of design vs derived artwork, `revert` is weight 1 / solid |
| AC-3 session + settings | only the adjusted BYTES persisted (the record's `borderSvg`); the parameters existed nowhere and no writer asked for a save | `data-border-base-svg` / `data-border-weight` / `data-border-style` ride the section, `js/layout_scan.js` writes them into the record as `borderAdjust`, `js/layout_apply.js` restores them, and every refine write asks the product's own `window.scheduleAutosave()` (the seam BEYOND-9's `requestLayerPersist` uses) |
| AC-4 spec extended | a seam block that would stay green with the whole surface deleted | a `BEYOND-10 refinement flow` block (4 cases) clicking the REAL buttons and reading what the product would save through `window.scanLayout()` |
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

- `npx mocha test/unit/border_refine_loop.test.js` → **17 passing / 0 failing** (RED before: 0/15).
- `npx mocha test/unit/ai_border_refine_ac2.test.js` → **20 passing** — the shipped contract survives the
  absolute model unchanged.
- `node scripts/border_refine_gdetect.js` → **G-DETECT PASS** (numbers above; artifacts under
  `temp/visual_logs/beyond10_gdetect/`).
- `npm run lint` → clean (36 checks, 0 violations; scripts hygiene OK).
- `node --check` on all six touched `js/` files + both specs → clean.
- `python vendor/housekeeping_guard.py check` → OK, no debt, **deliberation ADMITTED**, 5 criteria sealed.
- Coverage of the new module, from V8 coverage (no runner in devDependencies): **94.4% of functions,
  99.8% of bytes** of `js/border_refine.js`.

## What is owed (stated, not smoothed)

The four new e2e cases have not executed in a real browser on this host: `bootPage` times out at
`READY_SELECTOR` for EVERY spec here, including untouched ones (`border_picker_base.spec.js` →
1 passing / 3 failing, all three the same timeout). The loop's own evidence is the 17-case unit
contract (real jsdom, real nodes) plus G-DETECT's real-Chromium pixels, both green. Re-run on a healthy
host with one spec in one mocha process:

    BORDER_GALLERY_SHOTS=1 npx mocha test/browser_e2e/byok_border_gallery.spec.js \
      --timeout 900000 --grep "BEYOND-10 refinement flow"

## Delivery

Two local commits, no push (`noPushPerformed: true`):

1. **implementation** — `js/ai_border.js`, `js/border_refine.js` (new), `js/properties_panel.js`,
   `js/layout_scan.js`, `js/layout_apply.js`, `js/background.js`,
   `test/unit/border_refine_loop.test.js` (new), `test/unit/dead_exports.test.js`,
   `test/browser_e2e/_helpers/inject.js`, `test/browser_e2e/byok_border_gallery.spec.js`,
   `test/browser_e2e/spec_inventory.json`, `test/browser_e2e/spec_pending.json`,
   `scripts/border_refine_gdetect.js` (new).
2. **track record** — `conductor/archive/beyond10_ai_border_refine_loop/**`.
