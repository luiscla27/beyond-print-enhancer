# Track Specification: Outer UI Wrapper for Print Sections

## Overview
Fix a bug where `.print-section-header` and `.be-section-actions` are clipped when a `.print-section-container` is resized to a small size. This happens because the container has `overflow: hidden` to clip character sheet content.

## Functional Requirements
- **DOM Restructuring:** Introduce a `.be-section-wrapper` that contains the header, action buttons, and the `.print-section-container`.
- **Visibility:** The wrapper must NOT have `overflow: hidden`, allowing the header and actions to remain visible even if the content container is small.
- **Sizing:** The wrapper's width should be `max-content` but at least as wide as the internal `.print-section-container`.
- **Interactions:**
    - **Dragging:** Update `js/dnd.js` to drag the wrapper instead of the container.
    - **Resizing:** Ensure the resize handle still targets the content container, but the wrapper adjusts its bounds accordingly.
    - **Buttons:** All existing section actions (clone, delete, compact, border) must remain functional.
- **Persistence:** Ensure `scanLayout` and `applyLayout` correctly read/write positions from the wrapper.

## Technical Details
- **Wrapper Class:** `.be-section-wrapper` (will have `position: absolute`).
- **Container Class:** `.print-section-container` (will remain `position: relative` or similar inside the wrapper).
- **CSS Selectors:** Update `DomManager` if necessary to distinguish between wrapper and container.

## Acceptance Criteria
- [ ] Headers and buttons are fully visible even on 50x50 sections.
- [ ] Sections remain draggable and snappable.
- [ ] Sections remain resizable.
- [ ] Layout state (position/size) persists correctly across refreshes.
