---
type: orchestrator-report
title: "phase2a BEYOND-10 — AI border refinement loop (SC-D2)"
description: "The working seat's report: outcome per acceptance criterion, new code with SHAs, architecture decisions, amendments, struggles, knowledge to persist, and exact gate results."
tags: [orchestrator, report, beyond-10, phase2a]
status: complete
generated: 2026-11-01
sources: [conductor/archive/beyond10_ai_border_refine_loop/spec.md, conductor/archive/beyond10_ai_border_refine_loop/verification.md, conductor/archive/beyond10_ai_border_refine_loop/final_report.md]
---

# Phase 2a — BEYOND-10 (SC-D2): AI border refinement loop — ORCHESTRATOR REPORT

## OUTCOME: COMPLETE (all five criteria, AC-4 EXECUTED — see the session-2 addendum at the end)

| AC | verdict | proof |
|----|---------|-------|
| AC-1 gallery UI exposes weight/style controls | **MET** | New surface `js/border_refine.js` (5 weight steps, 3 style steps) opened from a new "Refine AI border" row in `js/properties_panel.js` that appears exactly when the section carries an AI border. Unit cases 1-3 + e2e `panelRow`/`open` probe assertions — **executed in a real browser**. |
| AC-2 select → adjust → regenerate → compare | **MET** | Variant list from the product's own `custom_borders` library; `Regenerate` re-derives from the DESIGN (absolute parameters); `Compare` returns the design and the refined bytes + `differs`; `Revert` returns weight 1 / solid. Unit cases 4-8 + e2e case 2 — **executed**. |
| AC-3 persist in session and settings | **MET** | `borderAdjust {base, weight, styleIndex}` in the section record (`js/layout_scan.js`), restored by `js/layout_apply.js`, carried by the undo snapshot (`js/undo.js`), carried by the settings bundle (`collectSettingsBundle → layout`, measured), and every refine write asks `window.scheduleAutosave()`. Unit cases 9-14 + e2e case 3 — **executed**. |
| AC-4 `byok_border_gallery.spec.js` extended with the refinement flow | **MET (AUTHORED + COLLECTED + EXECUTED)** | `BEYOND-10 refinement flow — the controls, in the real page` (4 cases) drives the real buttons and reads the record via `window.scanLayout()`. Collected 62 → 66. **4 passing / 0 failing in a real browser** — after session 2 fixed the boot defect that had been misread as a host failure (addendum §A). |
| AC-5 G-DETECT passes for refined border output | **MET (measured)** | `node scripts/border_refine_gdetect.js` → **PASS**: 6541 / 306240 px changed (2.136%), ink 5364 → 7392 (+2028). Negative control (`--weight 1 --style 0`) refuses to report a pass. |


## NEW CODE

Implementation commit: **`3ccd5fe`** · track record: **`8c615c0`** (close-out) + **`7d524ba`** (final
unit counts) · scripts inventory: **`5684221`**. `delivery.pushed: false`, `noPushPerformed: true` —
nothing was pushed to any remote.

| file | purpose |
|------|---------|
| `js/border_refine.js` (new, 502 lines) | the refinement surface: variant list, weight steps, style steps, Regenerate, Compare, Revert, disabled-with-reason state; asks `window.scheduleAutosave()` on every refinement write |
| `js/ai_border.js` | absolute parameter model: `data-border-base-svg` / `data-border-weight` / `data-border-style`, `readBorderAdjust`, `restoreBorderAdjust` (trust-root validated), `normalizeAdjust` (+`invalid_weight`), `BORDER_IMAGE_KNOBS` exported for the G-DETECT host |
| `js/properties_panel.js` | the "Refine AI border" row (product caller), presence-gated on `AiBorder.hasBorderSvg` |
| `js/layout_scan.js` | `borderAdjust` on all four section records (sections / clones / spell details / extractions) |
| `js/layout_apply.js` | restores the parameters after the choke point repaints the record's bytes |
| `js/undo.js` | the flag snapshot/repair carries `borderAdjust`, so undo cannot leave artwork and position disagreeing |
| `js/background.js` | `js/border_refine.js` joins the injected file list |
| `test/unit/border_refine_loop.test.js` (new, 18 cases) | the AC-1/AC-2/AC-3 contract against the real product |
| `test/unit/dead_exports.test.js` | census 169/168 → 170/169 with a written reason (the new namespace) |
| `test/browser_e2e/_helpers/inject.js` | `refineBorder` probe: open / click / state / record / compare / panelRow |
| `test/browser_e2e/byok_border_gallery.spec.js` | the refinement-FLOW block (4 cases) |
| `test/browser_e2e/spec_inventory.json` | regenerated deliberately (gallery 62 → 66; also corrected pre-existing drift 82 → 87 spec files) |
| `test/browser_e2e/spec_pending.json` | gallery 62 → 66, read from a REAL flag-less run of that spec, provenance amended |
| `scripts/border_refine_gdetect.js` (new) | G-DETECT: design vs refined painted through the product's own `border-image` slot in headless Chromium, pixel-diffed, verdict + artifact |

## ARCHITECTURE DECISIONS (a future session must know these)

1. **The card's "border gallery UI" does not exist in the product.** The only gallery is the e2e
   capture harness. The in-product owner of a section's border is the properties panel's
   "Border Style" row (`js/properties_panel.js:559`), so the controls landed there plus a
   self-contained surface. The variant list is the product's own `custom_borders` library — which is
   EMPTY on a real profile (`AiBorder.saveBorder` has no product caller yet), so the loop degrades to
   "the variant currently painted" instead of shipping an empty grid.
2. **Refinement parameters are ABSOLUTE, and the design is kept.** `weight` multiplies the DESIGN,
   never what is currently painted. This is what makes re-applying idempotent, makes "compare" a byte
   comparison, makes "revert" one call, and makes a reload able to restore the control position.
   Rejected alternative (candidate D): UI over the shipped relative transform — it ratchets
   (1.5x twice = 2.25x) and stores no parameters.
3. **"Regenerate" re-derives; it does not call the model again.** The generator is non-deterministic
   and costs the user's credential, and a re-roll would destroy the comparison AC-2 also asks for.
4. **"Settings" = the section record**, not a new key family: the adjustment rides the same record the
   border bytes ride, so the exported settings bundle carries it verbatim and the import path restores
   it through the same `applyLayout`.
5. **Fill-only designs disable, never no-op.** `canAdjustBorder` is false for the 2 of 11 corpus
   designs with no `stroke-width`; the surface disables all adjustment controls and states the reason
   inline rather than shipping a control that cannot change its variant's pixels.

## PLAN AMENDMENTS (the card's framing was stale, again)

- The card assumed a gallery exists to extend. It does not (see decision 1). Recorded in `spec.md`
  under "Amendments to the card", together with the two below.
- AC-2's "regenerate" was read as *re-derive from the parameters*, not *call the model* (decision 3).
- AC-3's "settings" was read as *the product's per-section record + the debounced autosave seam*
  (decision 4), not as a new storage key.
- The card's "Quick win YES — parameter adjustment UI + refinement loop, leverages existing gallery"
  was half true: the *library* half shipped (with no caller), the *user-reachable* half did not, and
  the state model had to be rebuilt to make a loop possible.

## STRUGGLES (cumulative, with measured results)

1. **The e2e host cannot boot the demo sheet.** Every `bootPage` in this workspace dies at
   `waitForSelector(READY_SELECTOR)` (60s, 114-116 locator resolutions on
   `<div class="ct-subsections" id="print-layout-wrapper">`, "not visible"). Proven **host-wide, not
   track-specific**: the untouched `test/browser_e2e/border_picker_base.spec.js` →
   `1 passing / 3 failing`, all three the same timeout; the gallery spec fails identically. So the
   refinement-FLOW cases are written and COLLECT (66 pending) but have never run here. Attempts: the
   gallery spec with `BORDER_GALLERY_SHOTS=1 --grep "BEYOND-10 refinement flow"` (twice; first attempt
   also surfaced two real defects, below).
2. **`js/background.js`'s injected file list is parsed by a REGEX in the e2e harness.** `bootPage`'s
   `productionInjectFiles()` rebuilds the list with `/'([^']+)'/g`, so an apostrophe in a comment
   inside that array becomes a bogus "file": the first run failed with
   `Could not load file: 's surface. It …`, and the second (after re-wording, but with the regex
   literal quoted back into the comment) failed with `No se ha podido cargar el archivo "([^"`. Fixed by
   keeping the comment quote-free and saying why. **Any future edit to that array must do the same.**
3. **G-DETECT's first two measurements were zeros, and both were harness defects, not verdicts.**
   (a) Escaping the CSS `url()` delimiters as `&quot;` produced `url(&quot;…)` — not a CSS function,
   nothing painted: 0 ink. (b) After the paint worked, an ELEMENT screenshot of the section-sized box
   still read 0 ink because `border-image-outset` paints OUTSIDE the border box; the clip is now
   inflated by the product's own outset. Both are recorded in the script's comments, and the script
   now THROWS on a 0-ink frame instead of reporting a green-looking zero.
4. **Integer-pinned census in `test/unit/dead_exports.test.js`** (169/168) — a new `window.*` namespace
   is a count bump by design; the file's house style is a written `+n` reason, which is what landed.
5. **`spec_inventory.json` was already stale at HEAD** (82 spec files vs 87 collected; the two
   `beyond18_*` specs and BEYOND-9's four extra `layer_print_visibility` cases were never collected
   into it). Regenerating it fixed the drift as well as adding this track's 4 cases — worth knowing if
   the browser gate's collection diff was being read as green before today.

## KNOWLEDGE TO PERSIST (for other cards)

- **A section's border state is three markers on the element**: `data-border-raw-svg` (painted),
  `data-border-base-svg` (the design), `data-border-weight` / `data-border-style` (the refinement).
  Read them through `window.AiBorder.readBorderAdjust`, never by scraping.
- **The product's persist seam for a per-section write is `window.scheduleAutosave()`**, resolved at
  call time and fail-open (BEYOND-9's `requestLayerPersist` pattern, now used by the refine writers).
- **The border's paint slot is `.print-section-container:not(.be-no-border)::before`**
  (`js/print_styles.js:1226`); it paints OUTSIDE the border box (`border-image-outset: 16px`), which
  matters for any screenshot-based measurement.
- **Any new module in the injected file list needs:** an entry in `js/background.js`, a
  `window.<Name>` export with a `Test seam`/`Public API` annotation if it has no product reader, a
  census bump in `test/unit/dead_exports.test.js`, and NO quote marks in comments inside that array.
- **A per-spec mocha run is the only way to run an e2e case here** (never two spec files in one
  process — the reload/reinject harness finding from BEYOND-9 still binds).

## GATE RESULTS (exact commands, exact counts)

| command | result |
|---------|--------|
| `npx mocha test/unit/border_refine_loop.test.js --reporter dot` | **RED before: 0 passing / 15 failing → GREEN after: 18 passing / 0 failing** |
| `npx mocha test/unit/ai_border_refine_ac2.test.js --reporter dot` | **20 passing / 0 failing** (unchanged under the absolute model) |
| `npx mocha test/unit/border_refine_loop.test.js test/unit/ai_border_refine_ac2.test.js` | **38 passing** |
| `npx mocha test/browser_e2e/byok_border_gallery.spec.js --timeout 900000 --reporter dot` | **0 passing / 66 pending** (was 62; flag-gated suite) |
| `BORDER_GALLERY_SHOTS=1 npx mocha … --grep "BEYOND-10 refinement flow"` | **BLOCKED BY HOST** — `bootPage` timeout (see STRUGGLES 1) |
| `npx mocha test/browser_e2e/border_picker_base.spec.js` (untouched control) | **1 passing / 3 failing** — same `bootPage` timeout ⇒ host-wide |
| `node scripts/border_refine_gdetect.js` | **G-DETECT PASS** — 6541/306240 px (2.136%), ink 5364 → 7392 (+2028) |
| `node scripts/border_refine_gdetect.js --weight 1 --style 0` | **refused** (`the refinement is a no-op …`) — the gate cannot pass vacuously |
| `npm test` | **2271 passing / 2 failing** — both are the pre-existing `input_budget_alignment` F4/F8 findings |
| `npm run lint` | **clean** — 36 checks passed, 0 violations; SCRIPTS HYGIENE OK |
| `node --check` (7 touched `js/` files + 2 specs + the new script) | **clean** |
| `python vendor/housekeeping_guard.py check` | **OK** — no debt; deliberation **ADMITTED** (4 candidates + matrix + ledger); 5 criteria **sealed** |
| coverage of `js/border_refine.js` (V8, no runner in devDependencies) | **94.4% of functions / 99.8% of bytes** |

**Token handoff: not needed** — the card finished inside the budget. No `ORCHESTRATOR_HANDOFF.md` was
written, and `temp/wip/beyond10_ai_border_refine_loop/` holds only scratch (the two pending-map /
coverage helpers live under gitignored `temp/scratch/`).

---

# SESSION 2 ADDENDUM — the "host" was the product, and AC-4 now executes

Written by the resumed seat. Context: this file and the record above were produced by a worker that was
reaped mid-session; the orchestrator re-spawned the phase. On arrival the tree already carried the
worker's five commits (`3ccd5fe`, `8c615c0`, `7d524ba`, `5684221`, `f8b6813`), so this addendum does not
re-describe the card — it corrects ONE claim in it and finishes the item it left owed.

## A. THE CORRECTION: STRUGGLES §1 was a misdiagnosis

The record above says the e2e flow "could not execute on this host: `bootPage` times out at
READY_SELECTOR for EVERY spec here", and cites the untouched `border_picker_base.spec.js`
(1 passing / 3 failing) as proof the problem was environmental. **Both halves were wrong.**

It was a product defect introduced by this track's own new module, and the untouched spec failed for
the same reason every other spec did — they all boot through one injected file list.

    js/border_refine.js:67   const state = { … }        ← this track's new module
    js/dnd.js:437            let state = null;          ← injected AFTER it

`chrome.scripting.executeScript({ files })` evaluates the listed files as CLASSIC SCRIPTS in ONE shared
global scope, so the second declaration is a fatal `SyntaxError` that kills the WHOLE file that loses the
race. `js/dnd.js` lost it: `window.initDragAndDrop` and `window.scheduleAutosave` were never published,
`js/main.js`'s boot threw at `initDragAndDrop()`, and `#print-layout-wrapper` stayed at **height 0** —
which Playwright reports as "not visible", which is exactly what `waitForSelector(READY_SELECTOR)`
(default `state: 'visible'`) waits for. A 60-second timeout that reads like a dead demo host.

The A/B that settled it (same browser, same page, same profile shape):

| injection set | `initDragAndDrop` | `scheduleAutosave` | page errors | `#print-layout-wrapper` after 9s |
|---|---|---|---|---|
| production list **minus** `js/border_refine.js` | `function` | `function` | none | `1306x5458` |
| production list as `js/background.js` declares it | `undefined` | `undefined` | `Identifier 'state' has already been declared`, `initDragAndDrop is not defined` | height **0** |

This is the third occurrence of the class in this repo: `js/undo.js` and `js/recovery_ui.js` both carry
the same measured note for `_safeLog`. The rule was already written down; nothing enforced it.

## B. WHAT SESSION 2 SHIPPED (commit `75829a0`)

| file | change |
|------|--------|
| `js/border_refine.js` | every top-level binding uniquely named (`const state` → `refineSurfaceState`, `refine*` on the rest). `open`/`close` renamed too — a top-level function declaration of a `window` member overwrites it for every file in the shared scope. **No exported API name changed.** |
| `test/unit/injected_scope_collision.test.js` (new, 5 cases) | the class's fast-suite guard: parses the injected list the way the harness parses it, fails on a duplicate top-level binding, separates the FATAL lexical case (`let`/`const`/`class`) from the tolerated `var`/`function` shadowing case (frozen + reasoned, exact in both directions), checks window-shadowing, and carries a falsifiability case that feeds the detector the measured collision so a green run means "detected nothing" rather than "cannot detect". |
| `test/browser_e2e/_helpers/inject.js` | `facts()` returned its inline text under `reason`, clobbering the click op's own refusal `reason` — the fill-only case compared prose against `"control_disabled"` and could never pass. Renamed to `inlineReason`. (Harness defect; the product's disabled state was correct.) |
| `test/browser_e2e/byok_border_gallery.spec.js` | the two assertions that read that field. |

Two exports were also RETIRED, not allowlisted: `BorderRefine.WEIGHT_STEPS` / `.STYLE_STEPS` had no
reader anywhere. They were invisible to `scripts/audit_dead_exports.js` while the namespace members were
written as shorthand (`applyAdjust,` carries no `name: value` pair to census); writing them as
`applyAdjust: refineApplyAdjust` made the census see them and the audit immediately reported both as dead.
The header comment claiming "asserted by the contract" was false — the contract asserts the vocabulary
through the buttons' own `data-be-refine-*` attributes — so it was replaced with the reason.

## C. GATE RESULTS ON THE FIXED TREE

| command | result |
|---------|--------|
| `BORDER_GALLERY_SHOTS=1 npx mocha test/browser_e2e/byok_border_gallery.spec.js --timeout 900000 --grep "BEYOND-10 refinement flow"` | **4 passing / 0 failing (37s)** — AC-1 controls, AC-2 select→adjust→regenerate→compare, AC-3 record + reopen, AC-1 fill-only disabled-with-reason. AC-4 is now EXECUTED, not merely collected. |
| `npx mocha test/browser_e2e/border_picker_base.spec.js --timeout 900000` (untouched control) | **4 passing / 0 failing** — was 1 passing / 3 failing. The number the first record read as proof of a broken host. |
| `npx mocha test/unit/injected_scope_collision.test.js` | **5 passing**; RED **2 failing** on the pre-fix module (the `state` collision AND `open`/`close` shadowing window members). |
| `npx mocha test/unit/border_refine_loop.test.js` | **18 passing** |
| `npx mocha test/unit/ai_border_refine_ac2.test.js` | **20 passing** |
| `npm test` | **2276 passing / 2 failing** — the 2 are the pre-existing `input_budget_alignment` F4/F8 baseline |
| `npm run lint` | **clean** — 36 checks, 0 violations; SCRIPTS HYGIENE OK |
| `node scripts/check_dead_exports.js` | **401 exports, 0 violations** |
| `node scripts/border_refine_gdetect.js` | **PASS** — 6541/306240 px (2.136%), ink 5364 → 7392 (+2028) |
| `node scripts/border_refine_gdetect.js --weight 1 --style 0` | **refused** — the gate cannot pass vacuously |
| `npx mocha test/browser_e2e/byok_border_gallery.spec.js` (flag off) | **0 passing / 66 pending** — collection unchanged, so `spec_inventory.json` / `spec_pending.json` needed no regeneration |
| `PYTHONDONTWRITEBYTECODE=1 python vendor/housekeeping_guard.py check` | **OK** — no debt, deliberation **ADMITTED** |

## D. KNOWLEDGE TO PERSIST (this is the one that will bite again)

- **The injected file list is ONE global scope.** Any two files in it declaring the same top-level
  binding is a fatal `SyntaxError` that silently deletes a whole module — and the symptom is an e2e boot
  timeout, i.e. it looks like infrastructure. `test/unit/injected_scope_collision.test.js` now fails in
  the fast suite instead.
- **Name module-locals uniquely** (the documented rule from `undo.js`/`recovery_ui.js`), and never
  declare a top-level function named after a `window` member (`open`, `close`, `focus`, `print`, …).
- **A zero-height `#print-layout-wrapper` is the signature of an aborted boot**, and
  `waitForSelector(READY_SELECTOR)` needs a non-empty box. If a spec times out there, check
  `typeof window.initDragAndDrop` in the isolated world before blaming the host.
- **`scripts/audit_dead_exports.js` cannot see shorthand namespace members** (`{ applyAdjust }`), only
  `name: value` pairs. A namespace written in shorthand is uncensused.
- The pre-existing duplicate pair `function fail` in `js/ai_layout.js:1278` and `js/ai_arrange.js:968` is
  frozen with a reason in the new guard's `TOLERATED_DUPLICATES`. `var`/`function` redeclaration is legal
  but the later file silently wins, so one module's callers get the other's arity. Worth a follow-up card;
  it is not this track's file and it was not touched.

## E. DELIVERY

Local commits only, `noPushPerformed: true` — nothing was pushed to any remote.

1. `3ccd5fe` — the refinement loop (session 1).
2. **`75829a0`** — the boot fix, the scope-collision guard, the probe `inlineReason` fix, the two dead
   exports retired (session 2).
3. Track record: `8c615c0`, `7d524ba`, `5684221`, and this correction (session 2).
