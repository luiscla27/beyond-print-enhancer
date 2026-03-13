# Implementation Plan: Fix Border Outset Clipping

## Objective
Fix the issue where decorative borders (added via `.print-section-container::before` with `border-image-outset`) are completely invisible. This occurs because the outset pushes the border outside the container's bounds, and the container's `overflow: hidden` rule clips it.

## Key Files & Context
- `js/main.js`: Contains the CSS injection logic that defines `.print-section-container` and its children.

## Implementation Steps

1. **Remove Clipping from the Container:**
   - In `js/main.js`, locate the CSS rule for `${s.UI.PRINT_CONTAINER}` (around line 2413).
   - Change `overflow: hidden !important;` to `overflow: visible !important;`.
   - *Why:* This allows the `::before` pseudo-element's `border-image-outset` to draw outside the container's perimeter without being cropped out of existence.

2. **Consolidate Content Rules (Maintain Content Clipping):**
   - The D&D Beyond actual content still needs to be clipped when a section is resized smaller than its contents.
   - In `js/main.js`, `.print-section-content` is defined twice: once around line 2247 (`overflow: visible !important;`) and again around line 2507 (`overflow: hidden !important; flex: 1 1 auto !important;`).
   - Remove the earlier, conflicting definition of `.print-section-content` (lines 2247-2252).
   - Ensure the definition around line 2507 remains intact. This guarantees that `.print-section-content` correctly takes over the responsibility of clipping the text/DOM nodes inside it, while allowing the container's border to remain fully visible.

## Verification & Testing
- Load a character sheet and inject the print enhancer.
- Apply different border styles (e.g., Dwarf, Barbarian, Spikes).
- Verify that borders render correctly on the outside of the sections.
- Verify that resizing a section still successfully clips the text/content *inside* the section without clipping the outer border.
- Verify that drag-and-drop handles do not get offset or misbehave due to the overflow change.