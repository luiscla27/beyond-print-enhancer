# Implementation Plan - Image Filters Expansion (Contrast, Greyscale, Saturate, Sepia)

## Phase 1: Storage and Data Management
- [x] Task: Update `Storage` object to handle new filters.
    - [x] Add `contrast`, `greyscale`, `saturate`, and `sepia` to global extension settings.
    - [x] Implement `getFilters()` and `saveFilter(key, value)` methods.
- [x] Task: TDD - Unit tests for filter persistence.
    - [x] Update `test/unit/hue_persistence.test.js` or create `test/unit/filters_persistence.test.js`.
    - [x] Verify reading/writing all filter values.
- [~] Task: Conductor - User Manual Verification 'Phase 1: Storage and Data Management' (Protocol in workflow.md)

## Phase 2: UI Implementation
- [x] Task: Add new sliders to Main Control Panel.
    - [x] Update `createControls` in `js/main.js` to include Contrast, Greyscale, Saturate, and Sepia sliders.
    - [x] Style sliders to match the existing Hue slider.
    - [x] Add labels and real-time value displays (e.g., "Contrast: 100%").
- [x] Task: TDD - Unit tests for Filters UI.
    - [x] Update `test/unit/hue_ui.test.js` or create `test/unit/filters_ui.test.js`.
    - [x] Verify slider creation, default values, and event listeners.
- [~] Task: Conductor - User Manual Verification 'Phase 2: UI Implementation' (Protocol in workflow.md)

## Phase 3: Composite Filter Logic
- [x] Task: Refactor Hue logic to support composite filters.
    - [x] Rename `applyGlobalHueShift` to `applyGlobalFilters` in `js/main.js`.
    - [x] Implement a central method that reads all five filter values (Hue, Contrast, etc.) and generates a single CSS `filter` string.
- [x] Task: Ensure Control Panel (Menu) Exclusion.
    - [x] Verify that `#print-enhance-controls` and related elements are NOT affected by any filters (Hue or new filters).
- [x] Task: Maintain Exclusions (Text, Portraits, Icons).
    - [x] Ensure the existing inverse filter logic or exclusion list is updated to handle the composite filter string correctly.
- [x] Task: TDD - Unit tests for Composite Filtering.
    - [x] Update `test/unit/hue_filtering.test.js` or create `test/unit/composite_filtering.test.js`.
    - [x] Verify that the generated CSS rule correctly includes all five filters and their respective values.
- [~] Task: Conductor - User Manual Verification 'Phase 3: Composite Filter Logic' (Protocol in workflow.md)

## Phase 4: Integration and Final Polish
- [x] Task: Connect UI events to composite filtering and storage.
    - [x] Ensure real-time updates as each slider moves.
    - [x] Debounce storage writes for efficiency (using `onchange` vs `oninput`).
- [x] Task: Final verification and refinement.
    - [x] Confirm all elements (Borders, Shapes, Backgrounds) respond correctly to all sliders.
    - [x] Confirm all exclusions (Text, Portraits, Icons, Menu) remain unaffected.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Integration and Final Polish' (Protocol in workflow.md)
