---
type: deliberation-ledger
title: "Counterfactual ledger — BEYOND-10 candidates that were not delivered"
description: "Every candidate that was dropped, with the measurement that would recall it."
tags: [deliberation, ledger, beyond-10]
status: recorded
generated: 2026-11-01
sources: [conductor/archive/beyond10_ai_border_refine_loop/deliberation/evaluation_matrix.md, js/ai_border.js, js/shape_picker.js]
---

# Counterfactual ledger — every candidate that was NOT delivered, and what would bring it back

Each section registers a candidate that was not delivered and the measurement that would re-open it. A
rejection here is re-openable when its recall condition is MEASURED — never because someone prefers the
other shape.

## Candidate B — modal variant gallery (rejected)

**Recall condition:** the `custom_borders` store is MEASURED non-empty on a real profile, i.e.
`AiBorder.listBorders()` returns at least a handful of saved variants because a save-to-library flow
shipped. At that point a thumbnail grid is the right surface for "select variant" and candidate A's
inline list becomes the fallback for the single-design case.

Second limb: a user-facing request for a visual comparison of many variants at once (the compare
affordance in candidate A compares TWO: the design and the refined result). That request is the signal
that a grid is owed; no such request exists today.

Cost of recall is stated so the re-open is priced: a fifth mode in the shared picker shell
(`js/shape_picker.js`), a grid renderer, and re-certification of the 18 visual cases in
`test/browser_e2e/picker_ux_visual_capture.spec.js`.

## Candidate C — CSS frame-width knob (inadmissible)

**Recall condition:** `border-image` gains a way to express a dash pattern, or the product's AI borders
stop being SVG (e.g. shipped as pre-rendered raster variants with their own weight/style classes). In
either world "weight" could be a CSS-level knob and the string transform would be redundant.

Measured today against that condition: the AI border is an SVG-as-`data:`-URI painted through
`border-image` (`js/ai_border.js:219`), so the dash pattern lives inside the blob and no CSS property
can reach it — which is exactly why the transform exists.

## Candidate D — UI over the shipped relative transform (rejected)

**Recall condition:** the product ships a surface that offers exactly ONE adjustment per design with no
re-entry (a "heavier" one-shot action with no control state to show). Under that constraint
compounding cannot occur and the missing parameter store costs nothing.

Also recallable if a future card requires the adjustments to be NON-destructive additions on top of a
certified artwork — but note the delivered model already keeps the design bytes
(`data-border-base-svg`), so "preserve the original" is satisfied without this candidate.

## Not carried as candidates (no alternative existed — stated, not implied)

**Recall condition:** someone produces a second defensible answer for where the transform's input comes
from. The transform MUST read the sanitized design bytes and MUST re-enter the DOM through
`renderBorderSvg` — the choke point is the only writer allowed to touch the border
(`scripts/check_border_svg_injection.js` enforces it at build time), so "paint the transform's output
directly" is not an alternative, it is a build failure. That is why it was not padded into a candidate.

Same for the not-adjustable path: a fill-only design cannot be reached by a stroke rewrite, so
"adjust it anyway" is a no-op rather than a design choice.
