# Implementation Plan: Section Cloning

This plan outlines the steps to implement the section cloning feature, allowing users to create static snapshots of character sheet sections.

## Phase 1: UI Foundation - Clone Button & Modal
In this phase, we will add the "Clone" button to existing sections and create the modal for title entry.

- [x] Task: Write unit tests for the Clone button injection logic. e6fa745
- [x] Task: Implement `injectCloneButtons()` in `js/main.js` to add the icon to the bottom-left of sections. e6fa745
- [x] Task: Add CSS styles for the Clone button (absolute positioning, hidden by default, visible on parent hover). e6fa745
- [x] Task: Create a reusable Modal component/function for title input. e2b8c40
- [x] Task: Write tests for the title modal (ensuring it returns the user input or default title). e2b8c40
- [x] Task: Conductor - User Manual Verification 'Phase 1: UI Foundation' (Protocol in workflow.md)

## Phase 2: Core Logic - Snapshot & Rendering
This phase focuses on capturing the DOM state and rendering it as a new "Clone" section.

- [x] Task: Write unit tests for the snapshot capture logic (DOM cloning and sanitization). b30f8ff
- [x] Task: Implement `captureSectionSnapshot(sectionId)` to clone the DOM, remove interactive elements, and prepare it for storage. b30f8ff
- [x] Task: Implement `renderClonedSection(snapshotData)` to inject the snapshot into the DOM with the "Clone" wrapper. b30f8ff
- [x] Task: Update the layout engine to handle clones as first-class "movable" items. b30f8ff
- [x] Task: Conductor - User Manual Verification 'Phase 2: Core Logic' (Protocol in workflow.md)

## Phase 3: Persistence - Save/Load Integration
Integrating clones into the existing persistence layer (IndexedDB and JSON).

- [x] Task: Write tests for the updated storage schema (ensuring clones are included in exports). 454aaa1
- [x] Task: Update the `saveLayout` and `loadLayout` functions to include the `clones` array in the data structure. 454aaa1
- [x] Task: Implement logic to restore clones on page load from the stored snapshots. 454aaa1
- [x] Task: Verify that resizing and positioning of clones are persisted correctly. 454aaa1
- [x] Task: Conductor - User Manual Verification 'Phase 3: Persistence' (Protocol in workflow.md)

## Phase 4: Interactions - Title Editing & Deletion
Finalizing the user interactions for managing existing clones.

- [x] Task: Write tests for double-click title editing and deletion logic. 2674cdb
- [x] Task: Implement double-click event listener on clone headers to trigger the title edit modal. 2674cdb
- [x] Task: Add a "Delete" button (trash icon) to the hover UI of cloned sections. 2674cdb
- [x] Task: Implement the deletion logic, ensuring clones are removed from both the DOM and persistent storage. 2674cdb
- [x] Task: Add a "Manage Clones" button to the floating control panel to list and quickly jump to/edit clones. 2674cdb
- [x] Task: Conductor - User Manual Verification 'Phase 4: Interactions' (Protocol in workflow.md)
