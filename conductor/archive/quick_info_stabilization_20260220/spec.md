# Specification: Quick Info Box Extraction & Stabilization

## 1. Overview
This track focuses on decomposing the character sheet's quick info summary into individual draggable sections for each stat box (e.g., AC, Initiative, Speed, HP). Additionally, it includes infrastructure to stabilize the custom layout by suppressing responsive resize events that cause D&D Beyond's default layout to overwrite extension changes.

## 2. Functional Requirements
- **Individual Box Extraction:**
  - Automatically identify and extract each `.ct-quick-info__box` element into its own floating, draggable section.
  - Each extracted box must maintain its internal HTML structure and data bindings.
  - The original quick-info container should be hidden or removed once extraction is complete.
- **New Border Style:**
  - Add a new border style option: `box_border` using `assets/border_box.gif`.
  - This style must be added to the border picker modal.
  - Set `box_border` as the default style for all newly extracted quick-info box sections.
- **Layout Stabilization:**
  - Implement a global suppression of `window.onresize` and responsive React events that trigger sheet re-renders.
  - **Critical:** Ensure that events required for the extension's own tools (e.g., layout resizing, repositioning) remain functional.
- **Default Arrangement:**
  - Position the newly extracted boxes in a horizontal row starting from a fixed coordinate (e.g., adjacent to the individual ability sections).

## 3. Technical Constraints
- Must integrate with the existing `DomManager` for selector registration.
- Must follow the established TDD workflow for all new functionality.
- Suppression of events should be implemented using `window.stopImmediatePropagation()` or by overwriting standard event listeners where appropriate.

## 4. Acceptance Criteria
- [ ] Each quick-info box (AC, HP, etc.) appears as a separate draggable section on load.
- [ ] `box_border` is correctly applied by default to these sections and available in the modal.
- [ ] Resizing the browser window does not cause the character sheet to reset to its default layout.
- [ ] Extension tools (like the layout manager) still respond correctly to user interactions.
- [ ] Individual boxes are initially arranged in a horizontal row.

## 5. Out of Scope
- Redesigning the internal layout of the individual boxes.
- Handling responsive layout changes for screen sizes smaller than "tablet" (since the focus is on print optimization).
