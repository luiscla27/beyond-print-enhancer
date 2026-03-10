# Implementation Plan - Color Picker (Global Hue Shift)

## Phase 1: Storage and Data Management
- [ ] Task: Update DataService to handle global hue preference.
    - [ ] Add `hueShift` to global extension settings.
    - [ ] Implement `getHueShift()` and `saveHueShift(deg)` methods.
- [ ] Task: TDD - Unit tests for hue storage.
    - [ ] Write `test/unit/hue_persistence.test.js`.
    - [ ] Verify reading/writing hue value.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Storage and Data Management' (Protocol in workflow.md)

## Phase 2: UI Implementation
- [ ] Task: Add Hue Slider to Main Control Panel.
    - [ ] Update `DomManager` to create a range input (0-360) in the controls.
    - [ ] Style the slider to fit the extension UI.
- [ ] Task: TDD - Unit tests for Slider UI.
    - [ ] Write `test/unit/hue_ui.test.js`.
    - [ ] Verify slider creation and event listeners.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: UI Implementation' (Protocol in workflow.md)

## Phase 3: CSS and Filtering Logic
- [ ] Task: Implement dynamic CSS injection for hue shift.
    - [ ] Create a central method to update a global `<style>` block.
    - [ ] Target `.section-border`, `.decorative-shape`, and other decorative elements.
    - [ ] Ensure high-specificity selectors are used to avoid conflicts.
- [ ] Task: TDD - Unit tests for CSS injection.
    - [ ] Write `test/unit/hue_filtering.test.js`.
    - [ ] Verify CSS rules are correctly generated and applied to target classes.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: CSS and Filtering Logic' (Protocol in workflow.md)

## Phase 4: Integration and Final Polish
- [ ] Task: Connect Slider events to Storage and CSS injection.
    - [ ] Ensure real-time updates as the slider moves.
    - [ ] Debounce storage writes if necessary for performance.
- [ ] Task: Final Verification and UI refinement.
    - [ ] Check exclusions (icons, images, text) to ensure they are NOT rotated.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integration and Final Polish' (Protocol in workflow.md)
