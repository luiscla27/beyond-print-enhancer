# Implementation Plan: Section Cloning

This plan outlines the steps to implement the section cloning feature, allowing users to create static snapshots of character sheet sections.

## Phase 1: UI Foundation - Clone Button & Modal
In this phase, we will add the "Clone" button to existing sections and create the modal for title entry.

- [x] Task: Write unit tests for the Clone button injection logic. e6fa745
- [x] Task: Implement `injectCloneButtons()` in `js/main.js` to add the icon to the bottom-left of sections. e6fa745
- [x] Task: Add CSS styles for the Clone button (absolute positioning, hidden by default, visible on parent hover). e6fa745
- [ ] Task: Create a reusable Modal component/function for title input.
- [ ] Task: Write tests for the title modal (ensuring it returns the user input or default title).
- [ ] Task: Conductor - User Manual Verification 'Phase 1: UI Foundation' (Protocol in workflow.md)

## Phase 2: Core Logic - Snapshot & Rendering
This phase focuses on capturing the DOM state and rendering it as a new "Clone" section.

- [ ] Task: Write unit tests for the snapshot capture logic (DOM cloning and sanitization).
- [ ] Task: Implement `captureSectionSnapshot(sectionId)` to clone the DOM, remove interactive elements, and prepare it for storage.
- [ ] Task: Implement `renderClonedSection(snapshotData)` to inject the snapshot into the DOM with the "Clone" wrapper.
- [ ] Task: Update the layout engine to handle clones as first-class "movable" items.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core Logic' (Protocol in workflow.md)

## Phase 3: Persistence - Save/Load Integration
Integrating clones into the existing persistence layer (IndexedDB and JSON).

- [ ] Task: Write tests for the updated storage schema (ensuring clones are included in exports).
- [ ] Task: Update the `saveLayout` and `loadLayout` functions to include the `clones` array in the data structure.
- [ ] Task: Implement logic to restore clones on page load from the stored snapshots.
- [ ] Task: Verify that resizing and positioning of clones are persisted correctly.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Persistence' (Protocol in workflow.md)

## Phase 4: Interactions - Title Editing & Deletion
Finalizing the user interactions for managing existing clones.

- [ ] Task: Write tests for double-click title editing and deletion logic.
- [ ] Task: Implement double-click event listener on clone headers to trigger the title edit modal.
- [ ] Task: Add a "Delete" button (trash icon) to the hover UI of cloned sections.
- [ ] Task: Implement the deletion logic, ensuring clones are removed from both the DOM and persistent storage.
- [ ] Task: Add a "Manage Clones" button to the floating control panel to list and quickly jump to/edit clones.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Interactions' (Protocol in workflow.md)
