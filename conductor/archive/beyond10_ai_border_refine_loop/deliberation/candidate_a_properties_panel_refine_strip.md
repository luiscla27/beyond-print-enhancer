---
type: deliberation-candidate
title: "Candidate A — refine strip on the properties panel's border row"
description: "The adopted option: weight/style controls and the loop live beside the Border Style row, fed by the product's own custom_borders library."
tags: [deliberation, candidate-a, ui, properties-panel]
status: adopted
generated: 2026-11-01
sources: [js/properties_panel.js, js/ai_border.js, js/border_refine.js]
---

# Candidate A — the refine strip lives on the border row the product already has

**Claim.** The card's "border gallery UI" does not exist as a product surface; the only gallery in the
repo is the e2e capture harness `test/browser_e2e/byok_border_gallery.spec.js`. The surface that owns
a section's border in the product is the properties panel's Border Style row
(`js/properties_panel.js:559`), reached by selecting a section. So the refinement controls belong
there: a row that appears exactly when the selected section carries an AI border
(`window.AiBorder.hasBorderSvg`), opening a self-contained refine surface with the variant list, the
weight steps, the style steps, Regenerate, Compare and Revert.

**Scope of the ask.** One new module (`js/border_refine.js`) plus one row in the panel. The variant
list is fed by the product's own `custom_borders` library through `AiBorder.listBorders()` — the only
in-product store of AI border variants — and degrades to "the design currently painted" when the
library is empty, so the loop is usable before the user has saved a single variant.

**Why this shape and not a nicer one.** The panel row is where the user already goes to change a
border, so the refinement is discoverable without a new navigation concept. It also keeps AC-1's
"controls are exposed" honest: the controls appear on the surface a user actually has open, with the
section in front of them, which is what makes compare meaningful.

**Measured.** Before: `grep` for `adjustBorderSvg` / `canAdjustBorder` / `transformBorderSvg` over
`js/` returns no caller outside `js/ai_border.js`, and `window.BorderRefine` does not exist, so no
control can be pressed. After: the unit contract drives the real control nodes and the real product
seam; the owning e2e spec drives the same controls in a real page.

**Cost / risk.** One module and one panel row. The risk is panel growth, answered by presence-gating
the row on `hasBorderSvg` rather than showing a dead control on every section.
