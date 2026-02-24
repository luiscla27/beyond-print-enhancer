# Implementation Plan - Add "Shapes Mode" Feature

## Phase 1: Infrastructure & CSS [checkpoint: 3c3a761]
- [x] Task: Update `DomManager` (`js/dom/dom_manager.js`) to include `selectors.UI.SHAPES_MODE_BTN = '.be-shapes-mode-btn'`. (7d7c9ca)
- [x] Task: Implement global CSS for Shapes Mode in `js/main.js`. (31e0862)
    - Add `.be-shapes-mode-active` styles to the main style tag.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Infrastructure & CSS' (Protocol in workflow.md) (3c3a761)

## Phase 2: Logic & UI Implementation (TDD)
- [x] Task: Implement `toggleShapesMode(forceState)` in `js/main.js`. (ebf2393)
    - Should toggle `.be-shapes-mode-active` class on `document.body`.
    - Should update the toggle button's appearance.
- [x] Task: Add "Shapes Mode" button to `print-enhance-controls` panel in `main.js`. (31b84d0)
    - Clicking it should call `toggleShapesMode()`.
- [x] Task: Initialize Shapes Mode to **ON** by default in the main execution IIFE. (8e97dcd)
- [~] Task: Conductor - User Manual Verification 'Phase 2: Logic & UI Implementation' (Protocol in workflow.md)

## Phase 3: Verification & Polish
- [ ] Task: Ensure Shapes Mode correctly interacts with existing features (cloning, extraction).
- [ ] Task: Verify that shapes added while in mode are immediately interactive.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Verification & Polish' (Protocol in workflow.md)
