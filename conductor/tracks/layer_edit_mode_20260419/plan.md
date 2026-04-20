# Implementation Plan: Layer Edit Mode (Interaction Toggling)

## Phase 1: Research & UI Design
- [x] Task: Review `LayerManager.js` to determine the best icon/character for the "Lock" toggle (e.g., 🔒/🔓 or ✏️).
- [x] Task: Identify all legacy "Shapes Mode" logic in `main.js` that needs to be refactored or removed to allow independent layer locking.
- [x] Task: Conductor - User Manual Verification 'Research & UI Design' (Protocol in workflow.md)

## Phase 2: Core Logic Implementation (LayerManager)
- [ ] Task: Update `LayerManager` constructor to include `isLocked: false` for all layers.
- [ ] Task: Implement `toggleLayerLock(layer, btn)` in `LayerManager`.
    - This method should toggle the corresponding body class (`be-lock-sections` or `be-lock-shapes`).
    - It should update the button icon/style to reflect the locked state.
- [ ] Task: Update `LayerManager.createPanel()` to inject the lock toggle button next to the visibility toggle.
- [ ] Task: Write unit tests in `test/unit/layer_manager.test.js` to verify that toggling the lock button correctly adds/removes the body classes.
- [ ] Task: Conductor - User Manual Verification 'Core Logic Implementation (LayerManager)' (Protocol in workflow.md)

## Phase 3: Integration & Refactoring (main.js)
- [ ] Task: Refactor `toggleShapesMode` in `main.js` to be compatible with independent layer locking (or remove it if redundant).
- [ ] Task: Ensure that on initialization, both layers are "Unlocked" (body classes removed).
- [ ] Task: Update any global click listeners that depend on `be-shapes-mode-active` to instead check the specific layer lock state if necessary.
- [ ] Task: Verify that deselecting shapes still works when the shapes layer is locked.
- [ ] Task: Conductor - User Manual Verification 'Integration & Refactoring (main.js)' (Protocol in workflow.md)

## Phase 4: Visual & Interaction Refinement
- [ ] Task: Verify that the "fade" (opacity 0.4) is correctly applied to both layers when locked.
- [ ] Task: Verify that dragging, resizing, and double-clicking are disabled for elements in locked layers.
- [ ] Task: Ensure that visibility toggles (eye icon) still work independently of the lock toggles.
- [ ] Task: Verify that "Shapes Mode" handles (rotation) are hidden when the shapes layer is locked.
- [ ] Task: Conductor - User Manual Verification 'Visual & Interaction Refinement' (Protocol in workflow.md)

## Phase 5: Final Validation
- [ ] Task: Run all existing tests to ensure no regressions in layout saving/loading.
- [ ] Task: Verify the new functionality in the live character sheet environment.
- [ ] Task: Conductor - User Manual Verification 'Final Validation' (Protocol in workflow.md)
