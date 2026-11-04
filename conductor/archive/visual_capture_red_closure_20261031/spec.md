# visual_capture_red_closure_20261031 — close the 11 RED browser_e2e findings

## Overview

The e2e feature-inventory certification (track `e2e_feature_inventory_minimax_20261029`,
archived 2026-10-30) ran all 82 browser_e2e suites live for the first time. 422/432 tests
passed; **11 tests RED across 5 `*_visual_capture.spec.js` suites** — UI behavior-capture
suites whose assertions codify DESIRED behaviors, none of which had ever run under any prior
fleet gate. This track implements the real missing UI behaviors and verifies with a
real-browser Playwright run that all 5 suites go green.

Full failing evidence + retained `.webm` videos:
`conductor/archive/e2e_feature_inventory_minimax_20261029/execution/`.

## The 11 RED tests (verbatim failure evidence from the retained report.json files)

### drag_ux_visual_capture.spec.js — 4 fails
1. phase 1 "committed pointer drag with the custom ghost (mouse)":
   `drag committed mid-gesture: false !== true` — `.be-section-wrapper.dragging` absent mid-gesture
2. phase 1 "touch-pointer drag mid-gesture (pointerType touch)":
   `touch drag committed: false !== true`
3. phase 2 "live snap + guides": `false !== true` (ghost live-snapped to grid / guide count ≥ 1)
4. phase 4 "precision nudge + position inputs": `locator.click: Timeout 15000ms exceeded …
   '#section-Section-4-wrapper .be-select-section-button' … element is visible, enabled and stable …
   <div id="shape-…" class="print-section-container be-shape-container …"> from <div class="pe-shapes-root"
   id="print-enhance-shapes-container">…</div> subtree intercepts` — the select-section button is
   covered by a shapes-root container node (hit-test interception), never becomes clickable

### ui_ux_audit_visual_capture.spec.js — 3 fails
5. "boot restore-failure card (corrupt saved layout, real boot path)":
   `page.waitForSelector: Timeout 60000ms … '.be-modal-overlay .be-modal-ok' not visible` —
   corrupt GLOBAL layout saved to IndexedDB, fresh page boot, the restore-failure alertdialog never renders
6. phase 1 "success toast, then a REAL error toast from a failed backup write":
   `info toast class: {"cls":"be-feedback be-feedback-success","role":"status"}` — after Save to
   Browser the toast class is `be-feedback-success` while the assertion requires `be-feedback-info`;
   the subsequent failed-write error toast was therefore never reached
7. phase 2 "locked layer that stays reachable + themed rotation handle":
   `no body be-lock-* class remains before the reveal: {"bodyLocks":["be-lock-sections",
   "be-lock-shapes-default"],"lockedLayers":3,…} 2 !== 0` — after toggling the shapes-default layer
   lock OFF, `be-lock-sections` + `be-lock-shapes-default` remain on `<body>` and 3 layers stay
   `.be-layer-locked`

### custom_templates_visual_capture.spec.js — 2 fails
8. phase 0 "current stacked Templates catalog (grid) + detail double-overlay":
   `legacy detail stacks a second overlay` — assertion failed
9. phase 2 "templates shell … in-modal detail view (no stacked overlay) + apply confirm":
   `apply button found` — assertion failed locating the apply button

### picker_ux_visual_capture.spec.js — 1 fail
10. phase 3 "sheet after Escape closes the modal (cancel path)": `Esc closed the modal: false !== true`
    — pressing Escape leaves the picker modal open

### shape_layer_ps_visual_capture.spec.js — 1 fail
11. phase 1 "renamed layer + empty layer affordance":
    `renamed through the input modal: actual 'New Layer' ≠ expected 'Gold Dividers'` — the rename
    dialog accepts the text but the layer row keeps showing the placeholder 'New Layer'

## Scope boundary

Real missing UI behaviors ONLY in `js/` (content scripts). The 5 spec files are NOT modified —
they codify the desired behavior and are the acceptance harness. No changes to manifest, no test
file edits.

> **SUPERSEDED (operator ruling 2026-10-31, verbatim in `metadata.json`).** The sentence above was
> this track's ORIGINAL boundary; the ruling replaced it with Option A — "Fix all 6 real gaps in
> js/, and update those 5 stale assertions minimally in the spec files (documented as superseded
> behavior; they stay the acceptance harness, still asserting the intended end state)". Eight
> assertions across 3 of the 5 spec files were corrected in place, each carrying a SUPERSEDED
> BEHAVIOUR note with its product citation; `picker_ux` and `drag_ux` were not edited at all.
> The `never` list is unchanged and honoured: no `manifest.json`, no `vendor/` touch.

## Acceptance criteria

- AC-1: drag_ux_visual_capture.spec.js runs 10/10 green with DRAG_UX_SHOTS=1 (mouse ghost commit, touch ghost commit, live snap + ≥1 gold guide, nudge select-button click)
- AC-2: ui_ux_audit_visual_capture.spec.js runs 4/4 green with UI_UX_AUDIT_SHOTS=1 (boot restore-failure alertdialog, info+error toast classes, zero be-lock-* body classes after unlock)
- AC-3: custom_templates_visual_capture.spec.js runs 6/6 green with CUSTOM_TEMPLATES_SHOTS=1 (both overlay assertions)
- AC-4: picker_ux_visual_capture.spec.js runs 18/18 green with PICKER_UX_SHOTS=1 (Escape closes modal)
- AC-5: shape_layer_ps_visual_capture.spec.js runs 7/7 green with SHAPE_LAYER_PS_SHOTS=1 (rename persists 'Gold Dividers')
- AC-6: `npm run lint` + `npm test` (unit suites) stay green after the js/ changes
- AC-7: verification is a REAL browser Playwright run (the same MV3-unpacked-context boot the inventory used), not a mock

> **AC-2's parenthetical is partly superseded** (same operator ruling; see `verification.md`
> §"The 8 spec supersessions"): "zero `be-lock-*` body classes after unlock" is not a state this
> product can reach — the lock paradigm is EXCLUSIVE by design
> (`js/dom/layer_manager.js::_toggleLayerLockNow` locks every other layer when one is unlocked,
> pinned by `test/unit/layer_manager.test.js`). What AC-2's case now asserts is the invariant the
> reveal actually needs: no `be-lock-shapes-default` on `<body>`, the shape's own layer unlocked
> and active. The other two clauses (boot restore-failure alertdialog; info save toast) are met
> as written, the alertdialog one via the shared destructive-gate primitive that announces
> `alertdialog` (`js/recovery_ui.js`).
