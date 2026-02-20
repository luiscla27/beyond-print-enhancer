# Implementation Plan: Section Border Style Selection

## Phase 1: CSS & Styling Setup [checkpoint: 9b4bf40]
- [x] Task: Verify and refine border style CSS classes (`default-border`, `ability_border`, `spikes_border`) in `js/main.js`. (b691458)
- [x] Task: Implement modal-specific styling for the border picker (previews, options grid). (b691458)
- [x] Task: Conductor - User Manual Verification 'Phase 1: CSS & Styling Setup' (Protocol in workflow.md) (9b4bf40)

## Phase 2: Border Picker Modal Implementation [checkpoint: cdc0257]
- [x] Task: Create `showBorderPickerModal(currentStyle)` function in `js/main.js`. (cdc0257)
    - [x] Task: Implement the UI with style previews. (cdc0257)
    - [x] Task: Implement "Apply to all sections of this type" logic. (REMOVED per user request)
- [x] Task: Add a new action button to the `be-section-actions` container in `injectCloneButtons`. (cdc0257)
- [x] Task: Conductor - User Manual Verification 'Phase 2: Border Picker Modal Implementation' (Protocol in workflow.md) (cdc0257)

## Phase 3: Logic & Persistence [checkpoint: 2ab90ad]
- [x] Task: Update `captureSectionSnapshot` to include the selected `borderStyle`. (bf35f77)
- [x] Task: Update `renderClonedSection` to apply the `borderStyle` from the snapshot. (bf35f77)
- [x] Task: Update `Storage.saveLayout` and `Storage.loadLayout` to persist/restore `borderStyle` for each section. (bf35f77)
- [x] Task: Implement logic to apply border changes to all sections of the same type if requested. (REMOVED)
- [x] Task: Conductor - User Manual Verification 'Phase 3: Logic & Persistence' (Protocol in workflow.md) (2ab90ad)

## Phase 4: Verification & Testing [checkpoint: 86ce1e2]
- [x] Task: Add unit tests for border style persistence in `test/unit/storage.test.js`. (bf35f77)
- [x] Task: Add unit tests for border style application in `test/unit/cloning_logic.test.js`. (bf35f77)
- [x] Task: Perform end-to-end verification of the border picker UI and persistence. (cdc0257)
- [x] Task: Conductor - User Manual Verification 'Phase 4: Verification & Testing' (Protocol in workflow.md) (86ce1e2)
