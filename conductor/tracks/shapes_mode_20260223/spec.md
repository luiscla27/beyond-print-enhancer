# Track Specification: Shapes Mode Feature

## Overview
This track implements a "Shapes Mode" toggle. When active, it isolates interaction to only decorative shapes, making all other character sheet sections unclickable, un-draggable, and un-resizable. This facilitates granular placement of decorative elements without accidentally moving layout sections.

## Functional Requirements
- **Toggle Button:** Add a "Shapes Mode" button to the `print-enhance-controls` panel.
- **State Management:**
    - The mode starts **ON** by default when the extension initializes.
    - The state is toggled manually by the user.
- **Interaction Locking (Strict Lock):**
    - When ON: All elements matching `.print-section-container` that do NOT have the `.be-shape` class must have `pointer-events: none` applied.
    - This effectively disables clicking, dragging, and resizing for standard sections, clones, and extractions.
- **Visual Feedback (Fade Others):**
    - When ON: Non-shape elements should have their opacity reduced (e.g., to `0.4`) to visually indicate they are inactive.
    - A visual indicator (e.g., green glowing border or icon change) should appear on the control button.

## Non-Functional Requirements
- **Performance:** Toggling the mode should be instantaneous.
- **Cleanup:** Ensure the mode is correctly removed if the extension is re-initialized.

## Technical Details
- **Implementation:** Use a global class on `body` (e.g., `.be-shapes-mode-active`) and use CSS selectors to enforce locking and fading.
- **CSS:**
    ```css
    body.be-shapes-mode-active .print-section-container:not(.be-shape) {
        pointer-events: none !important;
        opacity: 0.4 !important;
    }
    ```

## Acceptance Criteria
- [ ] "Shapes Mode" button exists in the control panel.
- [ ] Button toggles the state between ON and OFF.
- [ ] When ON, character sheet sections cannot be dragged or clicked.
- [ ] When ON, shapes REMAIN interactive (draggable/resizable).
- [ ] When ON, non-shape elements are visually faded.
- [ ] The mode starts ON by default.

## Out of Scope
- Persisting the mode state to IndexedDB (session-based is sufficient).
