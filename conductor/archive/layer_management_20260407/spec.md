# Track Specification: Layer Management Panel and Refactor

## 1. Overview
This track introduces a dedicated "Layer Management" panel to the top-right corner of the interface. This panel will provide a central place to toggle the visibility of the two primary layers of the extension: **Shapes Mode** and **Sections**. Each layer's content will be wrapped in its own top-level `fixed` container `div` to simplify visibility management and isolate interaction layers.

## 2. Functional Requirements
- **Layer Containers:**
  - **Sections Layer:** Wrap all enhanced sections (e.g., stats, actions, spells, etc.) into a single parent container `div` with ID `pe-sections-layer`.
  - **Shapes Layer:** Wrap all decorative shapes into a single parent container `div` with ID `pe-shapes-layer`.
  - **Container Properties:** Both containers must be `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; overflow: visible;`. 
  - Elements inside these layers will maintain their own `pointer-events: auto` for interaction.
- **Layer Management Panel:**
  - Implement a fixed, compact UI control panel in the top-right corner of the screen.
  - The panel must contain two control entries: "Shapes Mode" and "Sections".
  - Each entry must be its own `div` featuring a label and a visibility toggle (eye icon 👁️).
- **Visibility Toggling:**
  - Clicking the eye icon for a layer toggles the CSS `display` property of its corresponding container `div` between `block` (or its default state) and `none`.
- **Refactoring:**
  - Remove the existing "Shapes Mode" toggle button from the `print-enhance-controls` panel.
  - Scan all existing features and ensure absolute positioned `divs` are correctly moved into their respective layer containers without breaking their coordinate system (as the fixed parent matches the viewport).
  - Maintain correct z-index stack (Shapes Layer above Sections Layer).
- **Styling:**
  - Use a clean, compact design for the management panel that matches the extension's aesthetic.
  - Use the Unicode character 👁️ for the eye icon.

## 3. Non-Functional Requirements
- **Performance:** Toggling visibility should be instantaneous.
- **UI Integrity:** Ensure the new container structure does not break existing drag-and-drop or positioning logic.

## 4. Acceptance Criteria
- [ ] A new panel appears in the top-right corner with toggles for both layers.
- [ ] Toggling the "Sections" eye icon correctly hides/shows its parent container `div`.
- [ ] Toggling the "Shapes Mode" eye icon correctly hides/shows its parent container `div`.
- [ ] The "Shapes Mode" button is removed from the `print-enhance-controls` panel.
- [ ] All absolute positioned elements are correctly moved into their new fixed parent containers.
- [ ] No regression in shape placement, interaction, or section dragging functionality.

## 5. Out of Scope
- Adding more than the two specified layers.
- Drag-and-drop reordering of layers.
- Individual element visibility within a layer (only full layer toggle).
