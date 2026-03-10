# Implementation Plan - Color Picker (Global Hue Shift)

## Phase 1: Storage and Data Management
- [x] Task: Update DataService to handle global hue preference.
    - [x] Add `hueShift` to global extension settings.
    - [x] Implement `getHueShift()` and `saveHueShift(deg)` methods.
- [x] Task: TDD - Unit tests for hue storage.
    - [x] Write `test/unit/hue_persistence.test.js`.
    - [x] Verify reading/writing hue value.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Storage and Data Management' (Protocol in workflow.md)

## Phase 2: UI Implementation
- [x] Task: Add Hue Slider to Main Control Panel.
    - [x] Update `DomManager` to create a range input (0-360) in the controls.
    - [x] Style the slider to fit the extension UI.
- [x] Task: TDD - Unit tests for Slider UI.
    - [x] Write `test/unit/hue_ui.test.js`.
    - [x] Verify slider creation and event listeners.
- [x] Task: Conductor - User Manual Verification 'Phase 2: UI Implementation' (Protocol in workflow.md)

## Phase 3: CSS and Filtering Logic
- [x] Task: Implement dynamic CSS injection for hue shift.
    - [x] Create a central method to update a global `<style>` block.
    - [x] Target `.section-border`, `.decorative-shape`, and other decorative elements.
    - [x] Ensure high-specificity selectors are used to avoid conflicts.
- [x] Task: TDD - Unit tests for CSS injection.
    - [x] Write `test/unit/hue_filtering.test.js`.
    - [x] Verify CSS rules are correctly generated and applied to target classes.
- [x] Task: Conductor - User Manual Verification 'Phase 3: CSS and Filtering Logic' (Protocol in workflow.md)

## Phase 4: Integration and Final Polish
- [x] Task: Connect Slider events to Storage and CSS injection.
    - [x] Ensure real-time updates as the slider moves.
    - [x] Debounce storage writes if necessary for performance. (Using onchange for final save).
- [x] Task: Final Verification and UI refinement.
    - [x] Check exclusions (icons, images, text) to ensure they are NOT rotated.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Integration and Final Polish' (Protocol in workflow.md)
