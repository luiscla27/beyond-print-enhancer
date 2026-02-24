# Implementation Plan - Add "Shapes Mode" Feature

## Phase 1: Infrastructure & CSS
- [x] Task: Update `DomManager` (`js/dom/dom_manager.js`) to include `selectors.UI.SHAPES_MODE_BTN = '.be-shapes-mode-btn'`. (7d7c9ca)
- [x] Task: Implement global CSS for Shapes Mode in `js/main.js`. (31e0862)
    - Add `.be-shapes-mode-active` styles to the main style tag.
- [~] Task: Conductor - User Manual Verification 'Phase 1: Infrastructure & CSS' (Protocol in workflow.md)

## Phase 2: Logic & UI Implementation (TDD)
- [ ] Task: Implement `toggleShapesMode(forceState)` in `js/main.js`.
    - Should toggle `.be-shapes-mode-active` class on `document.body`.
    - Should update the toggle button's appearance.
- [ ] Task: Add "Shapes Mode" button to `print-enhance-controls` panel in `main.js`.
    - Clicking it should call `toggleShapesMode()`.
- [ ] Task: Initialize Shapes Mode to **ON** by default in the main execution IIFE.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Logic & UI Implementation' (Protocol in workflow.md)

## Phase 3: Verification & Polish
- [ ] Task: Ensure Shapes Mode correctly interacts with existing features (cloning, extraction).
- [ ] Task: Verify that shapes added while in mode are immediately interactive.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Verification & Polish' (Protocol in workflow.md)
