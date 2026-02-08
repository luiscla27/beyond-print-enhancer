# Implementation Plan - Advanced Layout & Persistence Enhancements

## Phase 1: Foundation & Persistence Layer [checkpoint: c4a10a9]
- [x] Task: Initialize IndexedDB Schema ba24774
    - [ ] Create `js/storage.js` to manage IndexedDB operations.
    - [ ] Define schema for storing character layouts (characterId, sectionOrder, customSpells).
    - [ ] Implement `saveLayout(characterId, data)` and `loadLayout(characterId)` functions.
- [x] Task: Conductor - User Manual Verification 'Foundation & Persistence Layer' (Protocol in workflow.md)

## Phase 2: Enhanced DOM Extraction & UI Cleanup [checkpoint: 33dd6fd]
- [x] Task: Advanced Section Extraction 1c682fe
    - [ ] Update `js/main.js` to iterate and extract all tabs ('Actions', 'Spells', 'Equipment', 'Features & Traits').
    - [ ] Convert each extracted content block into a standard draggable container structure.
    - [ ] Hide original tab navigation.
- [x] Task: UI Refinement 0bb7baf
    - [ ] Implement logic to remove search boxes from all sections.
    - [ ] Inject CSS to force full height on all containers (remove `overflow: scroll`).
    - [ ] Enforce "Letter" page dimensions in print CSS media queries.
- [x] Task: Conductor - User Manual Verification 'Enhanced DOM Extraction & UI Cleanup' (Protocol in workflow.md)

## Phase 3: Draggable Layout Engine [checkpoint: 8e8e85e]
- [x] Task: Implement Drag-and-Drop Logic
    - [ ] Add event listeners for mouse/touch interactions on section headers.
    - [ ] Implement visual feedback during drag (e.g., ghosting or placeholder).
    - [ ] Implement reordering logic when a section is dropped.
- [x] Task: Add Control UI 9e79fd0
    - [ ] Create a "Save Layout" floating button.
    - [ ] Link the button to the Phase 1 persistence functions.
- [x] Task: Conductor - User Manual Verification 'Draggable Layout Engine' (Protocol in workflow.md)

## Phase 4: Spell Section Specialization [checkpoint: c057d68]
- [x] Task: Spell Duplication Feature 8412192
    - [ ] Add "Duplicate Spells" button to the Spells container.
    - [ ] Implement cloning logic ensuring unique DOM IDs for each clone.
    - [ ] Initialize clones as empty templates as per spec.
- [x] Task: Persistence Integration 15a7923
    - [ ] Ensure duplicated spell sections and their contents are included in the IndexedDB save/load payload.
- [x] Task: Conductor - User Manual Verification 'Spell Section Specialization' (Protocol in workflow.md)

## Phase 5: Final Integration & Polish [checkpoint: 7e84905]
- [x] Task: End-to-End Testing 775cc90
    - [ ] Verify persistence works across page reloads for different characters.
    - [ ] Verify print layout on physical or PDF "Letter" paper.
## Phase 6: UX Enhancements & Reliability
- [~] Task: Section Minimization Feature
    - [x] Add "X" button and minimization logic to `js/main.js`.
    - [x] Implement restore button and CSS for minimized state.
- [~] Task: Drag and Drop Reliability Fix
    - [x] Ensure `#print-layout-wrapper` ID is assigned to the correct container.
    - [x] Verify fix with updated unit tests.
- [ ] Task: Conductor - User Manual Verification 'UX Enhancements & Reliability' (Protocol in workflow.md)

## Phase 7: Absolute Positioning Engine
- [ ] Task: Transition to Absolute Layout
    - [ ] Update `main.js` CSS to use `position: absolute` for containers.
    - [ ] Set `position: relative` on the layout root.
- [ ] Task: Implement Manual Dragging Logic
    - [ ] Update `dnd.js` to track `left`/`top` offsets during drag.
    - [ ] Update persistence to save/restore coordinates in IndexedDB.
- [ ] Task: Conductor - User Manual Verification 'Absolute Positioning Engine' (Protocol in workflow.md)
