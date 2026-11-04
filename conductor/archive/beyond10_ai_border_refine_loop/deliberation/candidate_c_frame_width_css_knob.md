---
type: deliberation-candidate
title: "Candidate C — weight as a CSS border-image-width knob"
description: "An inadmissible option: express weight by rewriting the frame's border-image custom properties instead of the artwork's own stroke."
tags: [deliberation, candidate-c, mechanism, css]
status: inadmissible
generated: 2026-11-01
sources: [js/ai_border.js, js/print_styles.js]
---

# Candidate C — make "weight" a CSS knob on the frame, not a stroke rewrite

**Claim.** The border is painted by the product's own `border-image` slot: four inline custom
properties (`--border-img`, `--border-img-slice`, `--border-img-width`, `--border-img-outset`) consumed
by `.print-section-container::before` in `js/print_styles.js`. Instead of rewriting SVG attributes,
scale `--border-img-width` (28px is the default) and the refinement becomes a style write — cheap,
reversible, no string surgery, and it also thickens the frame the user sees.

**Why it is inadmissible for THIS criterion.** It changes the FRAME's thickness, not the ART's line.
The card asks for border **weight and style**: a 4px-wide frame still draws a 2-unit hairline inside
it. And **style** (solid / dashed / dotted) is not expressible at all at that level — dash patterns
live inside the SVG, and `border-image` has no dash concept. So two of the three claimed controls
would be a no-op on the artwork while looking like they did something: exactly the "ship a control that
cannot work" failure the shipped capability gate (`js/ai_border.js:199`) exists to prevent.

**Second limb.** Scaling `--border-img-width` also changes how much of the section's edge the frame
eats, so "heavier" and "inset further" become the same gesture — a UX regression dressed as a fix.

**Measured.** The pure transform already rewrites `stroke-width` and `stroke-dasharray` on the
sanitized string; `test/unit/ai_border_refine_ac2.test.js` measures both changes in the section record,
so the mechanism this candidate would replace is already proven to reach the art.

**Cost / risk.** Zero code (the knob exists), but it cannot meet AC-2, so its cost is not the reason it
loses.
