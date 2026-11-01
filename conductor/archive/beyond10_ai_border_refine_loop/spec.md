---
type: track-spec
title: "spec — BEYOND-10 / SC-D2: AI border refinement loop"
description: "The card verbatim, its five acceptance criteria, and the certification of what already shipped against each of them before any new code."
tags: [track, beyond-10, sc-d2, ai-border, refinement]
status: complete
generated: 2026-11-01
sources: [js/ai_border.js, js/properties_panel.js, test/browser_e2e/byok_border_gallery.spec.js, test/unit/ai_border_refine_ac2.test.js]
---

# spec — BEYOND-10 / SC-D2: AI border refinement loop (weight / style)

Track: `beyond10_ai_border_refine_loop` · parent + tracked issue **BEYOND-10** · created 2026-11-01
Scope: one YouTrack card, executed as a conductor track by an external orchestrator-spawned session.

## The card (verbatim, from the BEYOND tracker)

> **BEYOND-10 — [UX Gap] SC-D2: AI border refinement loop missing — gallery shows variants but no
> weight/style adjustment**
>
> UX Gap from e2e test matrix (approved scores 2026-10-25). Scenario SC-D2 (UC-05: AI Layout Assist).
> Composite UX Score 2.7 (weak).
>
> Evidence:
> - `byok_border_gallery.spec.js` shows border variants exist
> - no refinement loop for adjusting border weight, style, or parameters
> - users cannot iteratively refine AI-generated borders
> - core AI assist feature incomplete
>
> Gap classification: Feature incomplete — gallery exists but refinement loop absent. Priority P2.
> Quick win YES — parameter adjustment UI + refinement loop, leverages existing gallery.

### Acceptance criteria (the card's own words — all five must be met and measured)

- **AC-1** — Border gallery UI exposes weight/style adjustment controls.
- **AC-2** — Refinement loop: select variant → adjust parameters → regenerate → compare.
- **AC-3** — Adjustments persist in session and settings.
- **AC-4** — E2E test `byok_border_gallery.spec.js` extended with refinement flow.
- **AC-5** — Gate G-DETECT passes for refined border output.

## Certification BEFORE building (what already shipped vs each AC)

The card's framing is stale in the same way BEYOND-9's was, and the recon in the launch card says so.
Measured on this tree (`3a6ecb5`), one row per AC:

| AC | What exists | Verdict |
|----|-------------|---------|
| AC-1 | **Nothing user-reachable.** `js/ai_border.js:141` `transformBorderSvg`, `:199` `canAdjustBorder`, `:347` `adjustBorderSvg` exist as *library* functions; `grep` over `js/` finds **zero** callers outside `js/ai_border.js` itself. No control, no panel, no button. | **GENUINELY MISSING** |
| AC-2 | The *mechanism* of one adjustment step exists (transform + re-render through the choke point). There is no loop: no variant selection surface, no compare, and the transform is **relative** — `adjustBorderSvg` transforms whatever is painted, so 1.5x applied twice paints 2.25x and there is no way to ask "what is this border set to?". | **PARTIALLY MISSING** (no UI, no absolute parameter model, no compare) |
| AC-3 | The adjusted *bytes* persist, because the adjustment re-renders through `renderBorderSvg` and the layout record already carries `borderSvg` (`js/layout_scan.js:321`, restored at `js/layout_apply.js:202`). The *parameters* persist nowhere: after a reload the refined bytes come back but nothing knows the weight/style that produced them, and no writer asks the product's own autosave seam. | **PARTIALLY MISSING** |
| AC-4 | `test/browser_e2e/byok_border_gallery.spec.js:295` carries a **seam** block (apply → adjust → assert on the section record). It never drives a FLOW (no controls, no user gestures) and never compares original vs refined. | **PARTIALLY MISSING** |
| AC-5 | G-DETECT is defined by the project's own gate vocabulary as "border refinement produces detectable output changes". No measurement of it exists in this tree; the claim in `vendor/conductor/archive/ux_quick_wins_20261025/plan.md` is about a *different* tree/run and is not this repo's evidence. | **MISSING** (no measured pass) |

Two further facts the certification established, both load-bearing for the plan:

1. **The product has no border *gallery*.** The only gallery is the e2e capture harness
   (`byok_border_gallery.spec.js`). The product surface that owns a section's border today is the
   properties panel's "Border Style" row (`js/properties_panel.js:559`). The card's AC-1 therefore
   resolves to *that* surface, and the amendment is recorded below rather than papered over.
2. **`canAdjustBorder` divides the corpus.** 9 of the 11 canonical designs carry `stroke-width`;
   `08-flame-crest` and `10-ink-brush` are fill-only (`test/unit/border_corpus_adjustability.test.js`).
   A weight/style control is a provable no-op on those two, so the loop must **disable itself with a
   named reason** there instead of shipping a dead control.

## The ask, restated precisely (what "done" means)

A user who has an AI border on a section can, from the product, **pick which of their saved AI border
variants is being refined**, **set a weight and a style**, **regenerate** the painted border from that
choice, and **compare** the refined result against the design it came from — and both the refined
artwork and the control position survive a close/reopen of the surface and a reload of the page.
On a fill-only border every control is disabled and says why.

## Amendments to the card (stated plainly, as the launch card requires)

1. **"Border gallery UI"** → the properties panel's border row plus a new self-contained refine
   surface. There is no in-product gallery to extend; the variant list is fed by the product's own
   `custom_borders` library (`AiBorder.listBorders()`), which is the only in-product store of AI
   border variants.
2. **AC-2's "regenerate"** is honoured as *re-derive the painted artwork from the chosen parameters*,
   not as *call the model again*. The model call is non-deterministic (`test/fixtures/byok_border_corpus.json`
   header: same instruction accepted one round, refused the next) and spends the user's credential;
   the refinement the card asks for is over parameters, and a regenerate that re-rolled the artwork
   would destroy the comparison AC-2 also asks for. Recorded as candidate D in `deliberation/`.
3. **AC-3's "settings"** is honoured through the product's own per-section record (the same record that
   already carries `borderSvg`), written through the same debounced autosave seam BEYOND-9 used
   (`window.scheduleAutosave()`), rather than through a new key family.

## Non-goals

- No new thumbnail/preview gallery of the frozen corpus in the product (that corpus is test
  infrastructure; `test/fixtures/byok_border_corpus.json` is not shipped).
- No new prompt or provider call, and no change to the AI border trust boundary: every transformed
  string re-enters the DOM through `renderBorderSvg`'s internal sanitize-then-inject.
- No change to `border_render_refine.spec.js` (PR #8's raster-rendering refinement — a different
  mechanism, deliberately untouched).
