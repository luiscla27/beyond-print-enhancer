---
type: deliberation-candidate
title: "Candidate B — a modal variant gallery with thumbnail previews"
description: "A rejected option: a new modal listing every AI border variant as a thumbnail grid, with the controls beneath the grid."
tags: [deliberation, candidate-b, ui, modal]
status: rejected
generated: 2026-11-01
sources: [js/shape_picker.js, js/ai_border.js]
---

# Candidate B — open a modal gallery of variants and refine from the grid

**Claim.** AC-1 says "border gallery UI", which reads like a grid of variants. Build one: a modal in
the shared picker shell (`js/shape_picker.js`, mode-driven: style / add / switch) whose grid holds one
cell per AI border variant, with the weight and style controls in the modal footer. Selecting a cell
previews it on the target section; the footer regenerates.

**Why it loses.** Two measurements, one of them decisive:

1. **The grid has no population path.** The only variant store is `custom_borders`
   (`js/storage.js:46`), written by `AiBorder.saveBorder` — which has no product caller either, so the
   store is empty on every real profile. A gallery whose grid is empty on first run is a worse first
   experience than no gallery, and filling it means shipping the "save this border" flow first — a
   different card.
2. **Blast radius.** The shared picker is an already-certified surface with 18 owned visual cases
   (`test/browser_e2e/picker_ux_visual_capture.spec.js`) and a mode-driven OK-state machine
   (`js/shape_picker.js:101`). Adding a fifth mode means editing that state machine and re-certifying
   those cases inside a P2 quick win.

**What would bring it back** is stated in `counterfactual_ledger.md` beside this record.

**Cost / risk.** The largest of the four: a new modal mode, a grid renderer, and a re-certification of
the picker surface, for a variant list that is empty until a different card ships a save flow.
