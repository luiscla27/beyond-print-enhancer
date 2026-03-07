# Implementation Plan: Shapes Rotation, Migration & Asset Expansion

## Phase 1: Asset Migration & Cleanup
- [x] Task: Write tests to ensure asset loading logic correctly handles `.gif` extensions (if applicable in existing tests). 598ab2f
- [x] Task: Replace all `.png` string references with `.gif` across the codebase (`js/`, CSS). 598ab2f
- [x] Task: Verify all referenced `.gif` files exist in `/assets/` and `/assets/shapes/`. 598ab2f
- [x] Task: Conductor - User Manual Verification 'Asset Migration & Cleanup' (Protocol in workflow.md)

## Phase 2: Enhanced Shapes Modal
- [x] Task: Write tests for parsing shape asset folders and extracting tags from filenames. d886605
- [x] Task: Implement logic to categorize shapes into "Borders" (assets/) and "Shapes" (assets/shapes/) tabs. d886605
- [x] Task: Update the "Add Shape" modal UI to include tab navigation and a grid layout. d886605
- [x] Task: Write tests for the tag filtering logic. d886605
- [x] Task: Add tag filter buttons to the modal and wire them to the grid display logic. d886605
- [x] Task: Conductor - User Manual Verification 'Enhanced Shapes Modal' (Protocol in workflow.md) d886605

## Phase 3: Shape Rotation Core & Interaction
- [x] Task: Write tests for calculating rotation snapping (15-degree increments). e901115
- [x] Task: Implement the math utility for rotation snapping. e901115
- [x] Task: Write tests for rotation handle DOM injection when a shape is selected in "Shapes Mode". e901115
- [x] Task: Implement the UI and interaction logic for dragging the rotation handle and updating the shape's visual rotation (CSS `transform: rotate()`). e901115
- [x] Task: Conductor - User Manual Verification 'Shape Rotation Core & Interaction' (Protocol in workflow.md) e901115

## Phase 4: Shape Rotation Persistence
- [x] Task: Write tests to ensure layout extraction and serialization include the rotation angle for shapes. e901115
- [x] Task: Update the JSON schema/export logic to include rotation properties. e901115
- [x] Task: Write tests to ensure layout restoration correctly applies the rotation angle to shapes. e901115
- [x] Task: Update the layout import logic (`applyLayout`) to restore rotation properties. e901115
- [x] Task: Conductor - User Manual Verification 'Shape Rotation Persistence' (Protocol in workflow.md) fd9e905