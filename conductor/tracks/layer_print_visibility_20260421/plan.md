# Implementation Plan: Layer Visibility and Print Fixes

## Phase 1: Infrastructure & Print Overrides
**Goal:** Ensure the layer panel is hidden and layers are opaque on print.
- [x] Task: Create Track Directory and Metadata (`layer_print_visibility_20260421`).
- [ ] Task: Update `updatePrintStyles()` in `js/main.js` to:
    - [ ] Add `@media print` rule to hide `#print-enhance-layer-manager`.
    - [ ] Add `@media print` rule to force `opacity: 1 !important` on all `.be-section-wrapper` elements.
    - [ ] Add `@media print` logic to hide layers based on `data-print-disabled="true"` attribute.
- [x] Task: Write Unit Tests in `test/unit/print_styles.test.js` to verify generated CSS rules.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Infrastructure & Print Overrides' (Protocol in workflow.md)

## Phase 2: LayerManager UI Enhancements
**Goal:** Add the "Disable on Print" toggle to the UI.
- [x] Task: Update `LayerManager` in `js/dom/layer_manager.js`:
    - [x] Add `isDisabledOnPrint` property to default layers in `constructor`.
    - [x] Update `createPanel()` to inject a printer toggle button alongside lock/visibility toggles.
    - [x] Implement `toggleLayerPrint(layer, btn)` to switch `isDisabledOnPrint` state and update `data-print-disabled` on the corresponding layer element.
    - [x] Implement `refreshUI()` to update all toggle icons based on the current state (useful for restoration).
- [x] Task: Write Unit Tests in `test/unit/layer_manager_ui.test.js` for the new toggle functionality.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: LayerManager UI Enhancements' (Protocol in workflow.md)

## Phase 3: Persistence and Integration
**Goal:** Save and restore the "Disable on Print" state in JSON layouts.
- [x] Task: Update `scanLayout()` in `js/main.js` to capture `isDisabledOnPrint` for all layers.
- [x] Task: Update `applyLayout()` in `js/main.js` to restore `isDisabledOnPrint` states to the `LayerManager` and refresh the UI.
- [x] Task: Update `migrateLayout()` (if necessary) to ensure legacy JSON without this field is handled gracefully.
- [x] Task: Write Integration Tests in `test/unit/layout_persistence_layers.test.js` to verify save/load of the print-disabled state.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Persistence and Integration' (Protocol in workflow.md)
