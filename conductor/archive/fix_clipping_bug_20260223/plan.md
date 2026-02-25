# Implementation Plan - Outer UI Wrapper for Print Sections

## Phase 1: Infrastructure & CSS
- [x] Task: Update `DomManager` (`js/dom/dom_manager.js`) to include `selectors.UI.WRAPPER = '.be-section-wrapper'`. (ece4e99)
- [x] Task: Implement CSS for `.be-section-wrapper` in `js/main.js`. (31cec15)
    - Wrapper should have `position: absolute`, `display: flex`, `flex-direction: column`, `min-width: max-content`.
    - Move `z-index` and `left/top` logic from `.print-section-container` to `.be-section-wrapper`.
- [~] Task: Conductor - User Manual Verification 'Phase 1: Infrastructure & CSS' (Protocol in workflow.md)

## Phase 2: DOM Restructuring (TDD)
- [x] Task: Update `createDraggableContainer` in `js/main.js` to return the new wrapper structure. (31cec15)
- [x] Task: Update `getOrCreateActionContainer` to append buttons to the wrapper instead of the container. (31cec15)
- [x] Task: Update `createShape` to use the new wrapper structure. (31cec15)
- [~] Task: Conductor - User Manual Verification 'Phase 2: DOM Restructuring' (Protocol in workflow.md)

## Phase 3: Interaction & Persistence (TDD)
- [x] Task: Update `js/dnd.js` to target `.be-section-wrapper` for dragging. (ece4e99)
- [x] Task: Update `initResizeLogic` in `js/main.js` to ensure resize handles remain functional and wrapper adjusts. (31cec15)
- [x] Task: Update `scanLayout()` and `applyLayout()` to handle the wrapper's position and the container's size. (31cec15)
- [x] Task: Update `autoArrangeSections` to move wrappers instead of containers. (31cec15)
- [~] Task: Conductor - User Manual Verification 'Phase 3: Interaction & Persistence' (Protocol in workflow.md)

## Phase 4: Verification & Polish
- [x] Task: Perform full regression test of cloning, extraction, and spell details. (All 179 tests passing)
- [x] Task: Conductor - User Manual Verification 'Phase 4: Verification & Polish' (Protocol in workflow.md)
