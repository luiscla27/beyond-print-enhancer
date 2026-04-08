# Implementation Plan: Layer Management Panel and Refactor

## Phase 1: Research & Setup
- [ ] Task: Research existing section and shape initialization logic in `js/main.js` and `js/dom/dom_manager.js`.
- [ ] Task: Identify all DOM injection points for enhanced elements (sections and shapes).
- [ ] Task: Conductor - User Manual Verification 'Research & Setup' (Protocol in workflow.md)

## Phase 2: Layer Infrastructure
- [ ] Task: Implement the `pe-sections-layer` and `pe-shapes-layer` container creation logic in `js/dom/dom_manager.js`.
- [ ] Task: Update the DOM injection logic in `js/main.js` to redirect elements to their respective layer containers.
- [ ] Task: Add global CSS for the new fixed layer containers (ensuring `pointer-events` isolation).
- [ ] Task: Conductor - User Manual Verification 'Layer Infrastructure' (Protocol in workflow.md)

## Phase 3: Layer Management UI
- [ ] Task: Create the `LayerManager` UI component logic (creation and state management).
- [ ] Task: Implement the fixed control panel in the top-right corner of the viewport.
- [ ] Task: Implement the visibility toggle (eye icon 👁️) functionality for each layer.
- [ ] Task: Conductor - User Manual Verification 'Layer Management UI' (Protocol in workflow.md)

## Phase 4: Refactoring and Integration
- [ ] Task: Remove the legacy "Shapes Mode" toggle from the `print-enhance-controls` panel in `js/main.js`.
- [ ] Task: Synchronize `toggleShapesMode` internal state with the new "Shapes Mode" layer visibility toggle.
- [ ] Task: Verify absolute positioning and interaction integrity of existing features within the new fixed containers.
- [ ] Task: Conductor - User Manual Verification 'Refactoring and Integration' (Protocol in workflow.md)

## Phase 5: Final Validation
- [ ] Task: Perform comprehensive E2E testing of layer toggling and interaction.
- [ ] Task: Verify no regressions in section dragging, shape placement, or layout restoration.
- [ ] Task: Conductor - User Manual Verification 'Final Validation' (Protocol in workflow.md)
