# Implementation Plan - Image Filter Fix & Reset UI

## Phase 1: Bug Fix - Image Filter Inversion
- [x] Task: Research current inversion logic in `applyGlobalFilters`.
    - [x] Analyze how `inverseFilterStr` is calculated and applied.
    - [x] Identify why certain `<img>` elements are not being correctly excluded.
- [x] Task: TDD - Unit tests for Image Filter Inversion.
    - [x] Update `test/unit/composite_filters.test.js` or create a new test to verify `<img>` exclusion.
    - [x] Ensure non-shape images (portraits, icons) have the correct inverse filter applied.
- [x] Task: Implement Fix for Image Filter Inversion.
    - [x] Update the CSS selectors and logic in `applyGlobalFilters` to reliably exclude all non-shape `<img>` elements.
    - [x] Ensure the mathematical cancellation is robust (using the epsilon approach if needed).
- [x] Task: Conductor - User Manual Verification 'Phase 1: Bug Fix - Image Filter Inversion' (Protocol in workflow.md)

## Phase 2: UI - Individual Reset Buttons
- [x] Task: Update `createFilterSlider` to support reset buttons.
    - [x] Modify the helper function in `js/main.js` to accept a default value and add a reset button next to the slider.
    - [x] Implement the `onclick` handler for the reset button to update the slider, label, and storage.
- [x] Task: TDD - Unit tests for Individual Reset Buttons.
    - [x] Update `test/unit/filters_ui.test.js` to verify the existence and functionality of reset buttons.
    - [x] Ensure clicking a reset button restores the default value and triggers a save.
- [x] Task: Implement Individual Reset Buttons.
    - [x] Apply the updated `createFilterSlider` to all five filter sliders.
    - [x] Use appropriate icons (e.g., '↺' or a small button) for the reset action.
- [x] Task: Conductor - User Manual Verification 'Phase 2: UI - Individual Reset Buttons' (Protocol in workflow.md)

## Phase 3: UI - Global Reset Button
- [x] Task: Add "Reset All Filters" button to the control panel.
    - [x] Create a new button at the bottom of the filters container.
    - [x] Implement the logic to reset Contrast, Saturate, Greyscale, and Sepia while ignoring Hue.
- [x] Task: TDD - Unit tests for Global Reset Button.
    - [x] Add tests to `test/unit/filters_ui.test.js` to verify the global reset behavior.
    - [x] Confirm that Hue is NOT affected by the global reset.
- [x] Task: Implement Global Reset Button.
    - [x] Style the button to match the existing control panel aesthetics.
    - [x] Ensure it correctly updates all relevant sliders and persists the changes.
- [x] Task: Conductor - User Manual Verification 'Phase 3: UI - Global Reset Button' (Protocol in workflow.md)

## Phase 4: Integration and Final Polish
- [x] Task: Final integration tests.
    - [x] Run the full suite of filter tests to ensure no regressions.
    - [x] Verify that real-time updates and persistence are working seamlessly.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Integration and Final Polish' (Protocol in workflow.md)
