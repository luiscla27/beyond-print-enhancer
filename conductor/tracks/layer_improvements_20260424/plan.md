# Implementation Plan: Layer Management Improvements and Edit Mode Enhancements

## Phase 1: Layer Deletion
- [ ] Task: Research and define state updates for deleting a layer in `layer_manager.js` and `main.js`.
- [ ] Task: Write failing unit tests for layer deletion logic.
- [ ] Task: Implement the layer deletion logic (DOM removal, state update).
- [ ] Task: Write failing tests for the inline delete button and confirmation prompt UI.
- [ ] Task: Implement the "Inline Action" delete button on the layer header with a confirmation prompt.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Layer Deletion' (Protocol in workflow.md)

## Phase 2: Shape Context Menu
- [ ] Task: Research and plan the custom context menu component for shape items.
- [ ] Task: Write failing tests for custom context menu invocation and shape deletion event.
- [ ] Task: Implement custom right-click event listener on shape items (prevent native menu).
- [ ] Task: Implement the context menu UI and the "Delete" action logic.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Shape Context Menu' (Protocol in workflow.md)

## Phase 3: Edit Mode & Hover Highlights
- [ ] Task: Research and plan modifications to Edit Mode to support single "active" layer focus.
- [ ] Task: Write failing tests for active layer state management and hover highlight class application.
- [ ] Task: Modify Edit Mode logic to track and enforce the active layer.
- [ ] Task: Implement hover event listeners on `be-section-wrapper` to apply `be-focus-highlight` if they belong to the active layer.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Edit Mode & Hover Highlights' (Protocol in workflow.md)