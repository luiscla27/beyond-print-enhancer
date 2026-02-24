# Implementation Plan - Add "Shape" Decoration Feature

## Phase 1: Infrastructure & Assets [checkpoint: d2ff2c0]
- [x] Task: Create `assets/shapes/` directory. (b9763b4)
- [x] Task: Update `manifest.json` `web_accessible_resources` to include `assets/shapes/*`. (7ac4854)
- [x] Task: Update `DomManager` (`js/dom/dom_manager.js`) to include selectors for shapes. (54c636e)
    - Add `selectors.UI.SHAPE_CONTAINER = '.print-shape-container'`
- [~] Task: Conductor - User Manual Verification 'Phase 1: Infrastructure & Assets' (Protocol in workflow.md)

## Phase 2: Core Logic Implementation (TDD)
- [ ] Task: Implement `createShape(assetPath, restoreData)` in `js/main.js`.
    - Should return a resizable, draggable `DIV` with `.print-shape-container` and `.be-shape` classes.
    - Content should be empty.
    - Style should include `border-image` properties matching the selected asset.
- [ ] Task: Update `initZIndexManagement` to distinguish between sections and shapes.
    - Shapes must maintain a z-index at least 100 higher than the highest section.
- [ ] Task: Add "Delete" icon functionality specifically for shapes.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core Logic Implementation' (Protocol in workflow.md)

## Phase 3: UI & Interaction (TDD)
- [ ] Task: Create `showShapePickerModal()` function in `js/main.js` (modeled after `showBorderPickerModal`).
    - Should list assets from `assets/shapes/` and all existing borders.
- [ ] Task: Add "Add Shape" button to `print-enhance-controls` panel in `main.js`.
    - Clicking it should open the `showShapePickerModal` and then call `createShape`.
- [ ] Task: Implement CSS styles for `.print-shape-container` and the delete icon.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: UI & Interaction' (Protocol in workflow.md)

## Phase 4: Persistence & Stabilization
- [ ] Task: Update `scanLayout()` to capture and return shape data (id, pos, size, asset).
- [ ] Task: Update `applyLayout()` to recreate shapes from the saved data.
- [ ] Task: Update `SCHEMA_VERSION` in `js/main.js` to `1.4.0` (or appropriate increment).
- [ ] Task: Ensure shapes are correctly handled during `autoArrangeSections` (they should probably be ignored or handled separately to stay floating).
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Persistence & Stabilization' (Protocol in workflow.md)
