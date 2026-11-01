---
type: track-verification
title: "verification — BEYOND-10 / SC-D2 AI border refinement loop"
description: "The measured evidence behind every acceptance criterion: RED/GREEN counts, the record's own fields, G-DETECT's pixel numbers, and the exact commands."
tags: [track, beyond-10, verification, gates]
status: complete
generated: 2026-11-01
sources: [conductor/archive/beyond10_ai_border_refine_loop/plan.md, test/unit/border_refine_loop.test.js, test/browser_e2e/byok_border_gallery.spec.js, scripts/border_refine_gdetect.js]
---

# verification — BEYOND-10 / SC-D2

Every number below was produced by the command beside it, on this tree. Nothing here is inferred from
reading code.

## 1. Reproduce before fixing (baseline, current tree at `3a6ecb5` + this track's WIP)

| what | command | measured |
|------|---------|----------|
| the shipped library half | `npx mocha test/unit/ai_border_refine_ac2.test.js --reporter dot` | **20 passing / 0 failing** |
| the owning e2e spec, flag off | `npx mocha test/browser_e2e/byok_border_gallery.spec.js --timeout 900000 --reporter dot` | **0 passing / 62 pending** (flag-gated suite) |
| the gap, as a contract | `npx mocha test/unit/border_refine_loop.test.js --reporter dot` | **0 passing / 15 failing** (RED) |
| the gap, as a fact about `js/` | `grep -rn "adjustBorderSvg\|canAdjustBorder\|transformBorderSvg" js/` | no caller outside `js/ai_border.js` — no control could be pressed |

The RED run's failures were behavioural, not a shared crash: `window.BorderRefine` undefined, the
properties panel offering no refine row, `AiBorder.restoreBorderAdjust` missing, and
`scanLayout()`'s record carrying no `borderAdjust`.

## 2. GREEN — the new contract

`npx mocha test/unit/border_refine_loop.test.js --reporter dot` → **18 passing / 0 failing**.

| AC | the case that proves it | what it measures |
|----|-------------------------|------------------|
| AC-1 | "the properties panel offers a Refine AI border control exactly when the section carries one" | the panel's own renderer, with and without an AI border |
| AC-1 | "the refine surface renders the weight steps and the style steps, and marks the live one" | the five weights, the three styles, the pressed state |
| AC-1 | "a fill-only border DISABLES every control and says why" | 9 controls disabled + an inline reason naming the missing stroke |
| AC-2 | "selecting a variant paints that variant through the choke point" | a variant written through `AiBorder.saveBorder`, then clicked |
| AC-2 | "regenerate paints the design derived from the chosen weight and style" | `stroke-width 2 → 3`, `stroke-dasharray "4 2"` |
| AC-2 | "the parameters are ABSOLUTE: 1.5x twice paints 1.5x, not 2.25x" | idempotence + the design preserved beside the result |
| AC-2 | "compare reports the design against the refined bytes" | both byte strings + `differs` + the rendered diff line |
| AC-2 | "revert returns the artwork to the design bytes" | weight back to 2, dash cycle gone, controls at 1x solid |
| AC-3 | "every refine write asks the product's own debounced save seam" | persist asks counted: 0 on paint, 1 per refinement write |
| AC-3 | "the section record carries the adjustment" | `scanLayout()` → `borderAdjust {base, weight, styleIndex}` |
| AC-3 | "an unrefined section stores NO adjustment" | the field is `null`, not a no-op object |
| AC-3 | "a record's adjustment rehydrates" | `LayoutApply.applyLayout()` restores bytes + parameters + design |
| AC-3 | "closing and reopening shows the adjustment still in force" | close → reopen → the same pressed steps |
| trust | "a hostile base in a record is REFUSED and nothing is painted" | the trust root refuses `<script>`; artwork untouched |
| trust | "a weight that cannot be honoured is refused" | `weight 0` and `"heavier"` → `invalid_weight`, nothing painted |

The shipped contract is still green under the new absolute model:
`npx mocha test/unit/ai_border_refine_ac2.test.js` → **20 passing / 0 failing** (the two files together:
**38 passing**).

## 3. G-DETECT (AC-5) — measured on PIXELS

`node scripts/border_refine_gdetect.js` →
**G-DETECT PASS — 01-gilded-frame @ weight 1.5 / style 1: 6541 of 306240 px changed (2.136%), ink 5364 -> 7392 (+2028)**

- The two frames are painted through the product's OWN mechanism: the four inline custom properties
  consumed by `.print-section-container:not(.be-no-border)::before` (`js/print_styles.js:1226`), with
  the knobs read from `AiBorder.BORDER_IMAGE_KNOBS` rather than copied.
- The pass rule is in the script (`VERDICT`): ≥0.5% of the canvas must change AND the ink must
  increase. Artifacts + `report.json`: `temp/visual_logs/beyond10_gdetect/`.
- **Negative control (falsifiability):** `node scripts/border_refine_gdetect.js --weight 1 --style 0` →
  `G-DETECT ERROR: the refinement is a no-op on 01-gilded-frame …` — a "refinement" that changes
  nothing cannot pass this gate, and the same happens on a fill-only design.
- Two measured harness defects were found and fixed while building it (both recorded in the script's
  own comments): a `&quot;`-escaped CSS `url()` paints nothing, and an ELEMENT screenshot of the box
  came back 656x400 with **0 ink** because `border-image-outset` paints outside the border box.

## 4. The owning e2e spec (AC-4)

The spec now carries a `BEYOND-10 refinement flow — the controls, in the real page` block (4 cases)
that drives the surface's real buttons and reads what the product would SAVE through its own
`window.scanLayout()`. Collection is measured:

- `npx mocha test/browser_e2e/byok_border_gallery.spec.js --timeout 900000 --reporter dot` →
  **0 passing / 66 pending** (was 62): the four new cases are inside the same flag-gated suite.
- `test/browser_e2e/spec_inventory.json` regenerated deliberately (`node scripts/gen_spec_inventory.js`)
  → `byok_border_gallery.spec.js` 62 → 66 tests collected; the regeneration also corrected pre-existing
  drift (82 → 87 spec files, including the two beyond18 specs).
- `test/browser_e2e/spec_pending.json` per-file count 62 → 66, read from a REAL flag-less run of that
  one spec (`--reporter json`, `stats.pending`), with the provenance amended to say exactly that.

**The real-browser run of the new cases is BLOCKED BY THE HOST, not by the tests** — see §6.

## 5. Gates

| gate | command | result |
|------|---------|--------|
| lint | `npm run lint` | clean — 36 check(s) passed, 0 violations; SCRIPTS HYGIENE OK |
| syntax | `node --check` on every touched `js/` file + the two specs | clean |
| unit composite | `npm test` | see §6 (the 2 known-red `input_budget_alignment` cases are the fleet baseline) |
| housekeeping | `python vendor/housekeeping_guard.py check` | OK — no debt, deliberation ADMITTED |
| G-DETECT | `node scripts/border_refine_gdetect.js` | PASS (numbers in §3) |

## 6. Security review of this diff (policy `review=forced-security`)

The seat's subagent skills could not be invoked in this session — `use_capability` with
`skill:security-review` (and `skill:review`) returns the same host error for every argument shape
tried (`{"task": …}`, `{"arguments": {"task": …}}`, `{}`): *"run_skill: skill \"security-review\" is a
subagent and requires 'arguments' — the subagent has no other context"*. Recorded here rather than
silently skipped; the review was therefore performed by the seat on the staged diff, with the
build-time guard as the machine-checked half:

| check | result |
|-------|--------|
| `node scripts/check_border_svg_injection.js` (the AC-9 invariant: one writer, sanitize-then-inject, no other CSS image sink) | **36 checks passed, 0 violations** |
| new markup sinks in the diff (`innerHTML` / `insertAdjacentHTML` / `outerHTML` / `document.write`) | **none** — the new surface builds every node with `createElement`/`textContent`/`setAttribute` and static `cssText`; the only `innerHTML` in a touched file is `js/properties_panel.js:289`'s pre-existing `panel.innerHTML = ""` (a clear, no interpolation) |
| untrusted record input reaching the DOM | `AiBorder.restoreBorderAdjust` runs a saved record's `base` through the trust root BEFORE it is stored on the element, and writes NOTHING on refusal (pinned by the contract's hostile-base case) |
| new CSS `url()` sinks | none outside `js/ai_border.js`'s `borderImageValue`, which encodes the trust root's own output; `scripts/border_refine_gdetect.js` percent-encodes its payload too, and the payload cannot terminate the quoted `url()` |
| credential / permission surface | the new e2e probe ops read no `be.ai` record and touch no `chrome.storage`; they drive the same isolated world the product's own content script runs in |
| fail-open vs fail-closed | every new refusal path (hostile base, missing base, `invalid_weight`, `not_adjustable`) leaves the previous artwork untouched and records nothing |

**No security findings.**

## 7. What is NOT proven, stated rather than smoothed over

1. **The four new e2e cases have never executed in a real browser here.** `bootPage` times out waiting
   for `READY_SELECTOR` on `<div class="ct-subsections" id="print-layout-wrapper">` (60s, 114-116
   locator resolutions, not visible). This is **host-wide, not track-specific**: the untouched
   `test/browser_e2e/border_picker_base.spec.js` fails IDENTICALLY on this tree (`1 passing / 3 failing`,
   all three failures the same `bootPage` timeout), and so does the gallery spec as a whole. The evidence
   for the loop itself is therefore the unit contract (18 cases, real product code in jsdom) + G-DETECT
   (real Chromium pixels) — both green — plus a spec that COLLECTS its cases. A re-run on a host where
   `bootPage` reaches `READY_SELECTOR` is the outstanding step, and the exact command is recorded in the
   orchestrator report.
2. **`npm test` composite:** measured **2271 passing / 2 failing**, and both failures are the
   pre-existing `input_budget_alignment` F4/F8 findings (unrelated to this track; named in the launch
   card as the fleet baseline).

