# Implementation Plan - Image Filters Expansion (Contrast, Greyscale, Saturate, Sepia)

## Phase 1: Storage and Data Management
- [ ] Task: Update `Storage` object to handle new filters.
    - [ ] Add `contrast`, `greyscale`, `saturate`, and `sepia` to global extension settings.
    - [ ] Implement `getFilters()` and `saveFilter(key, value)` methods.
- [ ] Task: TDD - Unit tests for filter persistence.
    - [ ] Update `test/unit/hue_persistence.test.js` or create `test/unit/filters_persistence.test.js`.
    - [ ] Verify reading/writing all filter values.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Storage and Data Management' (Protocol in workflow.md)

## Phase 2: UI Implementation
- [ ] Task: Add new sliders to Main Control Panel.
    - [ ] Update `createControls` in `js/main.js` to include Contrast, Greyscale, Saturate, and Sepia sliders.
    - [ ] Style sliders to match the existing Hue slider.
    - [ ] Add labels and real-time value displays (e.g., "Contrast: 100%").
- [ ] Task: TDD - Unit tests for Filters UI.
    - [ ] Update `test/unit/hue_ui.test.js` or create `test/unit/filters_ui.test.js`.
    - [ ] Verify slider creation, default values, and event listeners.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: UI Implementation' (Protocol in workflow.md)

## Phase 3: Composite Filter Logic
- [ ] Task: Refactor Hue logic to support composite filters.
    - [ ] Rename `applyGlobalHueShift` to `applyGlobalFilters` in `js/main.js`.
    - [ ] Implement a central method that reads all five filter values (Hue, Contrast, etc.) and generates a single CSS `filter` string.
- [ ] Task: Ensure Control Panel (Menu) Exclusion.
    - [ ] Verify that `#print-enhance-controls` and related elements are NOT affected by any filters (Hue or new filters).
- [ ] Task: Maintain Exclusions (Text, Portraits, Icons).
    - [ ] Ensure the existing inverse filter logic or exclusion list is updated to handle the composite filter string correctly.
- [ ] Task: TDD - Unit tests for Composite Filtering.
    - [ ] Update `test/unit/hue_filtering.test.js` or create `test/unit/composite_filtering.test.js`.
    - [ ] Verify that the generated CSS rule correctly includes all five filters and their respective values.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Composite Filter Logic' (Protocol in workflow.md)

## Phase 4: Integration and Final Polish
- [ ] Task: Connect UI events to composite filtering and storage.
    - [ ] Ensure real-time updates as each slider moves.
    - [ ] Debounce storage writes for efficiency.
- [ ] Task: Final verification and refinement.
    - [ ] Confirm all elements (Borders, Shapes, Backgrounds) respond correctly to all sliders.
    - [ ] Confirm all exclusions (Text, Portraits, Icons, Menu) remain unaffected.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integration and Final Polish' (Protocol in workflow.md)
