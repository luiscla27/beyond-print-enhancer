# Implementation Plan: Border Asset Expansion (Extension)

## Phase 1: CSS Style Definitions
Add the new border styles to the existing CSS injection logic.

- [x] **Task: Define CSS classes for new assets in `js/main.js`.** (1c9cd65)
    - [ ] Add the following classes to the `style.textContent` inside `enforceFullHeight`:
        - `dwarf_border`, `sticks_border`, `ornament_border`, `ornament2_border`, `ornament_bold_border`, `ornament_bold2_border`, `ornament_simple_border`, `spike_hollow_border`, `spiky_border`, `spiky_bold_border`, `vine_border`.
    - [ ] Assign appropriate `border-image-slice`, `border-image-width`, and `border-image-outset` values (using existing styles as templates).
- [ ] **Task: Verify CSS injection.**
    - [ ] Run the extension and check if the new styles are present in the DOM.

## Phase 2: UI Integration
Expose the new styles in the border picker modal.

- [ ] **Task: Update the `styles` array in `showBorderPickerModal` (`js/main.js`).**
    - [ ] Append the new style objects (id and label) to the existing list.
- [ ] **Task: Verify Modal Scrollability.**
    - [ ] Ensure the modal can accommodate the increased number of options.

## Phase 3: Verification
Ensure the extension works correctly within the existing framework.

- [ ] **Task: Manual Verification of all new border styles.**
    - [ ] Apply each border and verify visual correctness and persistence.
- [ ] **Task: Conductor - User Manual Verification 'Border Asset Extension' (Protocol in workflow.md)**
