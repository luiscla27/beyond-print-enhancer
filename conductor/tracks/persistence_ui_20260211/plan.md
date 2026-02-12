# Implementation Plan: Persistence and Layout Management UI

This plan covers the implementation of a floating control panel to manage layout persistence via IndexedDB and JSON file export/import.

## Phase 1: Infrastructure & Data Schema
Establish the storage layer and the JSON data structure for capturing layout state.

- [x] Task: Define JSON schema and versioning constants in `js/storage.js` 72e4a86
- [x] Task: Implement IndexedDB wrapper for saving/loading global and per-character layouts c033961
- [x] Task: Implement "Layout Scanner" to extract coordinates, sizes, and inner widths from the DOM ac81da1
- [x] Task: Implement "Layout Applier" to inject saved styles back into the DOM b98e7bc
- [x] Task: Conductor - User Manual Verification 'Phase 1: Infrastructure' (Protocol in workflow.md) a3cc719

## Phase 2: UI Components & Aesthetics
Build the floating control panel and the fallback modal.

- [x] Task: Implement the vertical control panel container with hover/transparency logic 52d64fc
- [x] Task: Style buttons with a modern "cool" aesthetic (dark theme, shadows) 52d64fc
- [x] Task: Implement the "Fallback Modal" for manual JSON copy-pasting 52d64fc
- [x] Task: Ensure all UI elements are excluded from `@media print` 52d64fc
- [x] Task: Conductor - User Manual Verification 'Phase 2: UI Components' (Protocol in workflow.md) a3cc719

## Phase 3: Core Logic & File I/O
Connect the UI buttons to the persistence logic and file system.

- [x] Task: Implement "Save on Browser" logic (Scanner -> IndexedDB -> Success Feedback) 6f69e4d
- [x] Task: Implement "Save on PC" logic using the Download API or Fallback Modal 6f69e4d
- [x] Task: Implement "Load" logic (File Picker -> JSON Validation -> Applier) 6f69e4d
- [x] Task: Implement "Load Default" logic to reset overrides and re-run default positioning 6f69e4d
- [x] Task: Implement "Contribute" button link to GitHub 6f69e4d
- [x] Task: Implement Auto-Load logic on extension initialization 6f69e4d
- [x] Task: Conductor - User Manual Verification 'Phase 3: Core Logic' (Protocol in workflow.md) 6f69e4d

## Phase 4: Refinement & Validation
Finalize visual feedback and ensure robust error handling.

- [ ] Task: Add temporary "Success" notifications for save/load actions
- [ ] Task: Add basic JSON version migration logic for future-proofing
- [ ] Task: Perform final integration testing and CSS cleanup
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Refinement' (Protocol in workflow.md)
