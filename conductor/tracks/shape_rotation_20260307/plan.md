# Implementation Plan: Shapes Rotation, Migration & Asset Expansion

## Phase 1: Asset Migration & Cleanup
- [ ] Task: Write tests to ensure asset loading logic correctly handles `.gif` extensions (if applicable in existing tests).
- [ ] Task: Replace all `.png` string references with `.gif` across the codebase (`js/`, CSS).
- [ ] Task: Verify all referenced `.gif` files exist in `/assets/` and `/assets/shapes/`.
- [ ] Task: Conductor - User Manual Verification 'Asset Migration & Cleanup' (Protocol in workflow.md)

## Phase 2: Enhanced Shapes Modal
- [ ] Task: Write tests for parsing shape asset folders and extracting tags from filenames.
- [ ] Task: Implement logic to categorize shapes into "Borders" (assets/) and "Shapes" (assets/shapes/) tabs.
- [ ] Task: Update the "Add Shape" modal UI to include tab navigation and a grid layout.
- [ ] Task: Write tests for the tag filtering logic.
- [ ] Task: Add tag filter buttons to the modal and wire them to the grid display logic.
- [ ] Task: Conductor - User Manual Verification 'Enhanced Shapes Modal' (Protocol in workflow.md)

## Phase 3: Shape Rotation Core & Interaction
- [ ] Task: Write tests for calculating rotation snapping (15-degree increments).
- [ ] Task: Implement the math utility for rotation snapping.
- [ ] Task: Write tests for rotation handle DOM injection when a shape is selected in "Shapes Mode".
- [ ] Task: Implement the UI and interaction logic for dragging the rotation handle and updating the shape's visual rotation (CSS `transform: rotate()`).
- [ ] Task: Conductor - User Manual Verification 'Shape Rotation Core & Interaction' (Protocol in workflow.md)

## Phase 4: Shape Rotation Persistence
- [ ] Task: Write tests to ensure layout extraction and serialization include the rotation angle for shapes.
- [ ] Task: Update the JSON schema/export logic to include rotation properties.
- [ ] Task: Write tests to ensure layout restoration correctly applies the rotation angle to shapes.
- [ ] Task: Update the layout import logic (`applyLayout`) to restore rotation properties.
- [ ] Task: Conductor - User Manual Verification 'Shape Rotation Persistence' (Protocol in workflow.md)