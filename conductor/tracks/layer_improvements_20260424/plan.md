# Implementation Plan: Layer Management Improvements and Edit Mode Enhancements

## Phase 1: Layer Deletion
- [x] Task: Research and define state updates for deleting a layer in `layer_manager.js` and `main.js`.
- [x] Task: Write failing unit tests for layer deletion logic.
- [x] Task: Implement the layer deletion logic (DOM removal, state update).
- [x] Task: Write failing tests for the inline delete button and confirmation prompt UI.
- [x] Task: Implement the "Inline Action" delete button on the layer header with a confirmation prompt.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Layer Deletion' (Protocol in workflow.md)

## Phase 2: Shape Context Menu
- [x] Task: Research and plan the custom context menu component for shape items.
- [x] Task: Write failing tests for custom context menu invocation and shape deletion event.
- [x] Task: Implement custom right-click event listener on shape items (prevent native menu).
- [x] Task: Implement the context menu UI and the "Delete" action logic.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Shape Context Menu' (Protocol in workflow.md)

## Phase 3: Edit Mode & Hover Highlights
- [x] Task: Research and plan modifications to Edit Mode to support single "active" layer focus.
- [x] Task: Write failing tests for active layer state management and hover highlight class application.
- [x] Task: Modify Edit Mode logic to track and enforce the active layer.
- [x] Task: Implement hover event listeners on `be-section-wrapper` to apply `be-focus-highlight` if they belong to the active layer.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Edit Mode & Hover Highlights' (Protocol in workflow.md)

## Phase 4: Shape Addition Constraints
- [x] Task: Research "Add Shape" button logic and its target container resolution.
- [x] Task: Write failing tests for disabled "Add Shape" button when no layer is active.
- [x] Task: Implement "Add Shape" button disabling/enabling based on `activeLayerId`.
- [x] Task: Modify shape creation logic to target the active layer's DOM container.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Shape Addition Constraints' (Protocol in workflow.md)

## Phase 5: Active Layer UI Indicators
- [ ] Task: Design and implement a visual indicator for the active layer in `LayerManager.js`.
- [x] Task: Add CSS for the active layer indicator in `js/main.js`.
- [x] Task: Conductor - User Manual Verification 'Phase 5: Active Layer UI Indicators' (Protocol in workflow.md)

## Phase 6: Refined Activation & Renaming
- [ ] Task: Update `LayerManager` to auto-activate the only available shape layer.
- [ ] Task: Implement click-to-activate logic on layer names.
- [ ] Task: Implement double-click to rename logic for layers with a modal.
- [ ] Task: Write tests for refined activation and renaming.
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Refined Activation & Renaming' (Protocol in workflow.md)

## Phase 7: Enhanced Persistence
- [ ] Task: Update `scanLayout` to include `activeLayerId` and refined layer metadata.
- [ ] Task: Update `applyLayout` to restore `activeLayerId` and trigger `updateControlsState`.
- [ ] Task: Verify persistence across browser reload.
- [ ] Task: Conductor - User Manual Verification 'Phase 7: Enhanced Persistence' (Protocol in workflow.md)