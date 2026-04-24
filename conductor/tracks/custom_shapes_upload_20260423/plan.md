# Implementation Plan: Upload Custom Shapes from Disk

## Phase 1: Foundation & Storage
- [ ] Task: Research image compression and Base64 conversion libraries/methods (native Canvas vs library).
- [ ] Task: Update `Storage` object in `js/main.js` to handle custom shapes in IndexedDB and layout JSON.
- [ ] Task: Write Tests: Create `test/unit/custom_shapes_storage.test.js` to verify saving/loading Base64 shapes.
- [ ] Task: Implement: Add `saveCustomShape` and `getCustomShapes` to `Storage` object.
- [ ] Task: Conductor - User Manual Verification 'Foundation & Storage' (Protocol in workflow.md)

## Phase 2: Upload Logic & Image Processing
- [ ] Task: Write Tests: Add tests for image compression logic in `test/unit/image_processing.test.js`.
- [ ] Task: Implement: Create `ImageProcessor` helper to handle file reading, Base64 conversion, and compression.
- [ ] Task: Implement: Add "Upload from disk" option to the Layer Manager's "Add layer" modal.
- [ ] Task: Implement: Connect file selection to `ImageProcessor` and storage.
- [ ] Task: Implement: Add the compression warning prompt before processing large files.
- [ ] Task: Conductor - User Manual Verification 'Upload Logic & Image Processing' (Protocol in workflow.md)

## Phase 3: UI Integration
- [ ] Task: Write Tests: Create `test/unit/custom_shapes_ui.test.js` to verify "Custom Shapes" tab rendering.
- [ ] Task: Implement: Update `showShapePickerModal` to include the "Custom Shapes" tab.
- [ ] Task: Implement: Populate the "Custom Shapes" tab with assets from IndexedDB.
- [ ] Task: Implement: Ensure "Switch Shape Asset" button correctly opens the updated picker with the custom tab.
- [ ] Task: Conductor - User Manual Verification 'UI Integration' (Protocol in workflow.md)

## Phase 4: Finalization
- [ ] Task: Run full `mocha` test suite to ensure no regressions.
- [ ] Task: Verify end-to-end flow: Upload -> Save -> Reuse -> Export -> Import.
- [ ] Task: Conductor - User Manual Verification 'Finalization' (Protocol in workflow.md)
