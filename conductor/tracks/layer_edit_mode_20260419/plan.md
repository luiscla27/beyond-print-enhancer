# Implementation Plan: Layer Edit Mode (Interaction Toggling)

## Phase 1: Research & UI Design
- [x] Task: Review `LayerManager.js` to determine the best icon/character for the "Lock" toggle (e.g., 🔒/🔓 or ✏️).
- [x] Task: Identify all legacy "Shapes Mode" logic in `main.js` that needs to be refactored or removed to allow independent layer locking.
- [x] Task: Conductor - User Manual Verification 'Research & UI Design' (Protocol in workflow.md)

## Phase 2: Core Logic Implementation (LayerManager)
- [x] Task: Update `LayerManager` constructor to include `isLocked: false` for all layers.
- [x] Task: Implement `toggleLayerLock(layer, btn)` in `LayerManager`.
    - This method should toggle the corresponding body class (`be-lock-sections` or `be-lock-shapes`).
    - It should update the button icon/style to reflect the locked state.
- [x] Task: Update `LayerManager.createPanel()` to inject the lock toggle button next to the visibility toggle.
- [x] Task: Write unit tests in `test/unit/layer_manager.test.js` to verify that toggling the lock button correctly adds/removes the body classes.
- [x] Task: Conductor - User Manual Verification 'Core Logic Implementation (LayerManager)' (Protocol in workflow.md)

## Phase 3: Integration & Refactoring (main.js)
- [x] Task: Refactor `toggleShapesMode` in `main.js` to be compatible with independent layer locking (or remove it if redundant).
- [x] Task: Ensure that on initialization, both layers are "Unlocked" (body classes removed).
- [x] Task: Update any global click listeners that depend on `be-shapes-mode-active` to instead check the specific layer lock state if necessary.
- [x] Task: Verify that deselecting shapes still works when the shapes layer is locked.
- [x] Task: Conductor - User Manual Verification 'Integration & Refactoring (main.js)' (Protocol in workflow.md)

## Phase 4: Visual & Interaction Refinement
- [x] Task: Verify that the "fade" (opacity 0.4) is correctly applied to both layers when locked.
- [x] Task: Verify that dragging, resizing, and double-clicking are disabled for elements in locked layers.
- [x] Task: Ensure that visibility toggles (eye icon) still work independently of the lock toggles.
- [x] Task: Verify that "Shapes Mode" handles (rotation) are hidden when the shapes layer is locked.
- [x] Task: Conductor - User Manual Verification 'Visual & Interaction Refinement' (Protocol in workflow.md)

## Phase 5: Final Validation
- [x] Task: Run all existing tests to ensure no regressions in layout saving/loading.
- [x] Task: Verify the new functionality in the live character sheet environment.
- [x] Task: Conductor - User Manual Verification 'Final Validation' (Protocol in workflow.md)
