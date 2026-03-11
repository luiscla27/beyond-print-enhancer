# Implementation Plan - Image Filter Fix & Reset UI

## Phase 1: Bug Fix - Image Filter Inversion
- [ ] Task: Research current inversion logic in `applyGlobalFilters`.
    - [ ] Analyze how `inverseFilterStr` is calculated and applied.
    - [ ] Identify why certain `<img>` elements are not being correctly excluded.
- [ ] Task: TDD - Unit tests for Image Filter Inversion.
    - [ ] Update `test/unit/composite_filters.test.js` or create a new test to verify `<img>` exclusion.
    - [ ] Ensure non-shape images (portraits, icons) have the correct inverse filter applied.
- [ ] Task: Implement Fix for Image Filter Inversion.
    - [ ] Update the CSS selectors and logic in `applyGlobalFilters` to reliably exclude all non-shape `<img>` elements.
    - [ ] Ensure the mathematical cancellation is robust (using the epsilon approach if needed).
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Bug Fix - Image Filter Inversion' (Protocol in workflow.md)

## Phase 2: UI - Individual Reset Buttons
- [ ] Task: Update `createFilterSlider` to support reset buttons.
    - [ ] Modify the helper function in `js/main.js` to accept a default value and add a reset button next to the slider.
    - [ ] Implement the `onclick` handler for the reset button to update the slider, label, and storage.
- [ ] Task: TDD - Unit tests for Individual Reset Buttons.
    - [ ] Update `test/unit/filters_ui.test.js` to verify the existence and functionality of reset buttons.
    - [ ] Ensure clicking a reset button restores the default value and triggers a save.
- [ ] Task: Implement Individual Reset Buttons.
    - [ ] Apply the updated `createFilterSlider` to all five filter sliders.
    - [ ] Use appropriate icons (e.g., '↺' or a small button) for the reset action.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: UI - Individual Reset Buttons' (Protocol in workflow.md)

## Phase 3: UI - Global Reset Button
- [ ] Task: Add "Reset All Filters" button to the control panel.
    - [ ] Create a new button at the bottom of the filters container.
    - [ ] Implement the logic to reset Contrast, Saturate, Greyscale, and Sepia while ignoring Hue.
- [ ] Task: TDD - Unit tests for Global Reset Button.
    - [ ] Add tests to `test/unit/filters_ui.test.js` to verify the global reset behavior.
    - [ ] Confirm that Hue is NOT affected by the global reset.
- [ ] Task: Implement Global Reset Button.
    - [ ] Style the button to match the existing control panel aesthetics.
    - [ ] Ensure it correctly updates all relevant sliders and persists the changes.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: UI - Global Reset Button' (Protocol in workflow.md)

## Phase 4: Integration and Final Polish
- [ ] Task: Final integration tests.
    - [ ] Run the full suite of filter tests to ensure no regressions.
    - [ ] Verify that real-time updates and persistence are working seamlessly.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integration and Final Polish' (Protocol in workflow.md)
