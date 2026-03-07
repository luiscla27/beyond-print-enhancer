# Specification: Shapes Rotation, Migration & Asset Expansion

## Overview
This track focuses on three main goals:
1. Cleaning up asset references by migrating from `.png` to `.gif` due to the physical replacement of the files.
2. Enhancing the "Add Shape" modal to accommodate a large influx of new shapes, separating them by folder into tabs and adding tag-based filtering.
3. Introducing the ability to rotate shapes when "Shapes Mode" is active, with visual handles, step-snapping, and layout persistence.

## Functional Requirements

### 1. Asset Migration & Cleanup
- Systematically locate and update all `.png` references in the codebase (`js/`, CSS, etc.) to point to `.gif`.
- Validate that all referenced `.gif` assets exist within the `/assets/` and `/assets/shapes/` directories.

### 2. Enhanced Shapes Modal
- **Tabbed Navigation:** Implement tabs in the "Add Shape" modal to separate assets based on their source folder (e.g., one tab for `/assets/` (borders) and another for `/assets/shapes/`).
- **Grid Display:** Render the shapes within each tab in a grid layout for easy visual selection.
- **Tag Filtering:** Add quick tag filters (e.g., "bold", "hand drawn", "hollow", "ornament", "dwarf", "goth", "border", "barbarian", "vine"). These tags will filter the displayed shapes by checking if the filename contains the tag string.

### 3. Shape Rotation
- **Rotation Handle:** When a shape is selected/active (especially in "Shapes Mode"), display a circular UI handle that can be dragged to rotate the shape.
- **15-Degree Snapping:** Enforce a strict 15-degree angle snapping during the rotation drag interaction. The shape should only rest on multiples of 15 degrees (0, 15, 30, 45, etc.).
- **Persistence:** Ensure the rotation angle is saved as part of the shape's state in the layout persistence (IndexedDB/JSON export), so that rotation is restored when the layout is loaded.

## Non-Functional Requirements
- Rotation interactions must be smooth, intuitive, and clearly indicate the current snapped angle.
- The asset reference updates must not break any existing rendering logic.
- UI components for the tabs and tags should match the established design language.

## Acceptance Criteria
- [ ] All code references to `.png` image assets are successfully changed to `.gif`.
- [ ] The Add Shape modal features two distinct tabs representing the folder structure.
- [ ] The Add Shape modal includes functional tag buttons that filter the grid of shapes based on filename substrings.
- [ ] A rotation handle appears on selected shapes in Shapes Mode.
- [ ] Dragging the rotation handle rotates the shape, snapping in 15-degree increments.
- [ ] Reloading a saved layout correctly restores the custom rotation angle of all shapes.

## Out of Scope
- Modifying shapes other than rotation (e.g., complex skewing or 3D transformations).
- Adding completely new shape categories beyond the provided assets.