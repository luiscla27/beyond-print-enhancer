# Implementation Plan - Advanced Layout & Persistence Enhancements

## Phase 1: Foundation & Persistence Layer [checkpoint: c4a10a9]
- [x] Task: Initialize IndexedDB Schema ba24774
    - [ ] Create `js/storage.js` to manage IndexedDB operations.
    - [ ] Define schema for storing character layouts (characterId, sectionOrder, customSpells).
    - [ ] Implement `saveLayout(characterId, data)` and `loadLayout(characterId)` functions.
- [x] Task: Conductor - User Manual Verification 'Foundation & Persistence Layer' (Protocol in workflow.md)

## Phase 2: Enhanced DOM Extraction & UI Cleanup
- [ ] Task: Advanced Section Extraction
    - [ ] Update `js/main.js` to iterate and extract all tabs ('Actions', 'Spells', 'Equipment', 'Features & Traits').
    - [ ] Convert each extracted content block into a standard draggable container structure.
    - [ ] Hide original tab navigation.
- [ ] Task: UI Refinement
    - [ ] Implement logic to remove search boxes from all sections.
    - [ ] Inject CSS to force full height on all containers (remove `overflow: scroll`).
    - [ ] Enforce "Letter" page dimensions in print CSS media queries.
- [ ] Task: Conductor - User Manual Verification 'Enhanced DOM Extraction & UI Cleanup' (Protocol in workflow.md)

## Phase 3: Draggable Layout Engine
- [ ] Task: Implement Drag-and-Drop Logic
    - [ ] Add event listeners for mouse/touch interactions on section headers.
    - [ ] Implement visual feedback during drag (e.g., ghosting or placeholder).
    - [ ] Implement reordering logic when a section is dropped.
- [ ] Task: Add Control UI
    - [ ] Create a "Save Layout" floating button.
    - [ ] Link the button to the Phase 1 persistence functions.
- [ ] Task: Conductor - User Manual Verification 'Draggable Layout Engine' (Protocol in workflow.md)

## Phase 4: Spell Section Specialization
- [ ] Task: Spell Duplication Feature
    - [ ] Add "Duplicate Spells" button to the Spells container.
    - [ ] Implement cloning logic ensuring unique DOM IDs for each clone.
    - [ ] Initialize clones as empty templates as per spec.
- [ ] Task: Persistence Integration
    - [ ] Ensure duplicated spell sections and their contents are included in the IndexedDB save/load payload.
- [ ] Task: Conductor - User Manual Verification 'Spell Section Specialization' (Protocol in workflow.md)

## Phase 5: Final Integration & Polish
- [ ] Task: End-to-End Testing
    - [ ] Verify persistence works across page reloads for different characters.
    - [ ] Verify print layout on physical or PDF "Letter" paper.
- [ ] Task: Conductor - User Manual Verification 'Final Integration & Polish' (Protocol in workflow.md)
