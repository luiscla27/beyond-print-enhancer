---
type: deliberation-candidate
title: "Candidate D — keep the relative in-place transform and add controls on top"
description: "A rejected option: reuse adjustBorderSvg exactly as shipped (relative, cumulative) and only build the UI around it."
tags: [deliberation, candidate-d, state-model]
status: rejected
generated: 2026-11-01
sources: [js/ai_border.js, js/layout_scan.js, js/layout_apply.js]
---

# Candidate D — the cheapest possible loop: UI over the shipped relative transform

**Claim.** `adjustBorderSvg` already transforms the painted SVG and re-renders through the choke point.
Build the controls on top and stop: weight 1.25x means "call it again with 1.25", style cycles call it
with the next `styleIndex`. No state model, no new record field, no rehydrate work. Cheapest option by
a wide margin and it preserves every one of the 20 shipped cases unchanged.

**Why it loses — the loop it cannot express.** The transform is RELATIVE: it rewrites whatever is
painted. Three measured consequences, each of which breaks an AC:

1. **Compounding.** 1.5x twice paints 2.25x, and there is no way back to 1.5x except by re-applying the
   original design — which the control does not hold. A refinement LOOP (AC-2) that only ratchets one
   direction is not a loop.
2. **The control cannot show its own position.** After one 1.5x pass the state is not stored anywhere,
   so reopening the surface shows "1x" while the artwork is at 1.5x. AC-3 asks the adjustments to
   persist; a persisted effect with an unpersisted parameter is the state-drift class this project has
   already rejected elsewhere (BEYOND-9's candidate D).
3. **Reload.** The layout record carries the painted `borderSvg` (`js/layout_scan.js:321`) and restores
   it (`js/layout_apply.js:202`), so the ARTWORK survives a reload — but the parameters do not, so the
   next refinement pass is applied on top of already-refined bytes with no baseline.

**What would bring it back** is stated in `counterfactual_ledger.md`: a shipped surface that accepts
only single, non-repeated adjustments where compounding cannot occur.

**Cost / risk.** Smallest of the four, and rejected on capability rather than cost.
