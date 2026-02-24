# Track Specification: Shape Decoration Feature

## Overview
This track implements a new "Shape" decoration feature. It allows users to add decorative elements (shapes/borders) as independent, floating, and resizable DIVs that sit on top of the layout sections. These elements are purely aesthetic and do not contain content.

## Functional Requirements
- **Shape Button:** Add a new "Shape" button to the `print-enhance-controls` panel.
- **Shape Picker:** Clicking the button opens a modal or dropdown to select an asset from:
    - A new `assets/shapes/` directory.
    - Existing border assets in `assets/`.
- **Add Shape:** Selecting an asset creates a new floating `DIV` on the layout.
- **Floating DIV Properties:**
    - **Draggable:** Users can move shapes anywhere on the print layout.
    - **Resizable:** Users can resize shapes using a resize handle.
    - **Z-Index:** Shapes must always remain on top of layout sections. Specifically, they should have a z-index 100 higher than the base z-index of sections (Base: 10 -> Shapes: 110+).
    - **Asset Application:** The selected image is applied using the `border-image` CSS property to maintain the look and feel of existing borders.
    - **Removal:** A "Delete" icon (X) is provided on the shape's corner to remove it.
- **Persistence:**
    - The state of all added shapes (position, size, selected asset) must be saved to IndexedDB.
    - Shapes must be restored upon page refresh or layout load.

## Non-Functional Requirements
- **Performance:** Adding multiple shapes should not significantly degrade performance.
- **UI Consistency:** The "Shape" button and picker should match the existing extension UI style.

## Technical Details
- **Assets:** Create `assets/shapes/` folder and populate with placeholder assets if none provided.
- **DOM Structure:** Use a new class `.print-shape-container` for these elements.
- **Z-Index Logic:** Update `initZIndexManagement` to ensure shapes stay above sections.
- **Storage:** Update the layout schema in IndexedDB to include a `shapes` array.

## Acceptance Criteria
- [ ] A "Shape" button exists in the control panel.
- [ ] Clicking the button allows choosing a shape/border.
- [ ] A new shape is added to the layout and can be dragged/resized.
- [ ] Shapes always appear above standard sections.
- [ ] Shapes can be deleted.
- [ ] Shapes persist across refreshes.

## Out of Scope
- Adding text content inside shapes.
- Animating shapes.
