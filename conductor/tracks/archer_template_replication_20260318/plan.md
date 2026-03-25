# Implementation Plan: Archer Sheet Template Replication

## Phase 1: Research & Environment Preparation
- [x] Task: Research existing asset structure and `assets/shapes/` directory.
- [x] Task: Verify the presence of `demo/ignored/sheet_archer.png`.
- [x] Task: Create a dedicated scratchpad for coordinate mapping and asset naming.
- [x] Task: Analyze `js/dom/dom_manager.js` for "PREMADE" menu integration points.
- [x] Task: Define the `catalog.json` schema following the "Comprehensive" requirement.
- [x] Task: Research how to trigger "nano banana" (Gemini Image Editor) sessions.
- [x] Task: Prepare a test environment for verifying template application.
- [x] Task: Document the initial state of the `assets/` folder for comparison.
- [x] Task: Set up a new unit test file `test/unit/catalog_logic.test.js`.
- [x] Task: Conductor - User Manual Verification 'Research & Environment Preparation' (Protocol in workflow.md)

## Phase 2: Border Identification & Preliminary Extraction
- [x] Task: Identify all unique border elements in `sheet_archer.png`.
- [x] Task: Distinguish between top, bottom, and side border variations.
- [x] Task: Manually map the pixel coordinates for each border segment.
- [x] Task: Create a list of required "cleaned" border files.
- [x] Task: Perform a preliminary crop of the "Main Header" border. (Using `tile_0_5`)
- [x] Task: Perform a preliminary crop of the "Ability Score" border. (Using `tile_1_0`)
- [x] Task: Perform a preliminary crop of the "Combat Stats" border. (Using `tile_4_5`)
- [x] Task: Perform a preliminary crop of the "Footer" border. (Using `tile_9_5`)
- [x] Task: Validate the extracted segments against the extension's aspect ratios.
- [x] Task: Conductor - User Manual Verification 'Border Identification & Preliminary Extraction' (Protocol in workflow.md)

## Phase 3: Shape Identification & Preliminary Extraction
- [x] Task: Identify all ornamental shapes (icons, dividers, flourishes) in the image.
- [x] Task: Distinguish between static shapes and dynamic elements.
- [x] Task: Map the pixel coordinates for each unique shape found.
- [x] Task: Categorize shapes by their likely use case (e.g., "Divider", "Icon").
- [x] Task: Perform a preliminary crop of the "Archer Icon" shape. (Using `tile_0_0`)
- [x] Task: Perform a preliminary crop of the "Section Divider" shape. (Using `tile_2_5`)
- [x] Task: Perform a preliminary crop of the "Corner Flourish" shape. (Using `tile_0_0`)
- [x] Task: Perform a preliminary crop of the "Small Accent" shapes. (Using `tile_5_1`)
- [x] Task: Validate the shape extraction list for completeness.
- [x] Task: Conductor - User Manual Verification 'Shape Identification & Preliminary Extraction' (Protocol in workflow.md)

## Phase 4: Nano Banana Session: Border Cleaning (Part 1)
- [x] Task: Start a NEW nano banana session for the "Main Header" border.
- [x] Task: Instruction: Clean background and normalize colors for Header Border.
- [x] Task: Validate Header Border output and save to `assets/border_archer_header.webp`.
- [x] Task: Start a NEW nano banana session for the "Ability Score" border.
- [x] Task: Instruction: Clean background and normalize colors for Ability Border.
- [x] Task: Validate Ability Border output and save to `assets/border_archer_ability.webp`.
- [x] Task: Start a NEW nano banana session for the "Combat Stats" border.
- [x] Task: Instruction: Clean background and normalize colors for Combat Border.
- [x] Task: Validate Combat Border output and save to `assets/border_archer_stats.webp`.
- [x] Task: Conductor - User Manual Verification 'Nano Banana Session: Border Cleaning (Part 1)' (Protocol in workflow.md)

## Phase 5: Nano Banana Session: Border Cleaning (Part 2)
- [x] Task: Start a NEW nano banana session for the "Footer" border.
- [x] Task: Instruction: Clean background and normalize colors for Footer Border.
- [x] Task: Validate Footer Border output and save to `assets/border_archer_footer.webp`.
- [x] Task: Start a NEW nano banana session for the "Sidebar" border.
- [x] Task: Instruction: Clean background and normalize colors for Sidebar Border.
- [x] Task: Validate Sidebar Border output and save to `assets/border_archer_sidebar.webp`.
- [x] Task: Verify consistency in hue and saturation across all Archer borders.
- [x] Task: Convert all cleaned borders to optimized WEBP format.
- [x] Task: Document any manual corrections made to border alignment.
- [x] Task: Conductor - User Manual Verification 'Nano Banana Session: Border Cleaning (Part 2)' (Protocol in workflow.md)

## Phase 6: Nano Banana Session: Shape Cleaning (Part 1)
- [x] Task: Start a NEW nano banana session for the "Archer Icon" shape.
- [x] Task: Instruction: Remove background and refine edges for Archer Icon.
- [x] Task: Validate Archer Icon output and save to `assets/shapes/archer_main.webp`.
- [x] Task: Start a NEW nano banana session for the "Section Divider" shape.
- [x] Task: Instruction: Remove background and normalize thickness for Divider.
- [x] Task: Validate Divider output and save to `assets/shapes/archer_divider.webp`.
- [x] Task: Start a NEW nano banana session for the "Corner Flourish" shape.
- [x] Task: Instruction: Remove background and ensure transparency for Flourish.
- [x] Task: Validate Flourish output and save to `assets/shapes/archer_corner.webp`.
- [x] Task: Conductor - User Manual Verification 'Nano Banana Session: Shape Cleaning (Part 1)' (Protocol in workflow.md)

## Phase 7: Nano Banana Session: Shape Cleaning (Part 2)
- [x] Task: Start a NEW nano banana session for "Small Accent A".
- [x] Task: Instruction: Clean and normalize accent shape A.
- [x] Task: Validate Accent A output and save to `assets/shapes/archer_accent_a.webp`.
- [x] Task: Start a NEW nano banana session for "Small Accent B".
- [x] Task: Instruction: Clean and normalize accent shape B.
- [x] Task: Validate Accent B output and save to `assets/shapes/archer_accent_b.webp`.
- [x] Task: Verify transparency and edge quality for all Archer shapes.
- [x] Task: Convert all cleaned shapes to optimized WEBP format.
- [x] Task: Document shape naming conventions in the project metadata.
- [x] Task: Conductor - User Manual Verification 'Nano Banana Session: Shape Cleaning (Part 2)' (Protocol in workflow.md)

## Phase 8: Archer Template Coordinate Mapping & Draft JSON
- [x] Task: Re-examine `sheet_archer.png` to determine exact relative coordinates.
- [x] Task: Map border assignments to specific D&D Beyond sheet sections.
- [x] Task: Map shape placements (x, y, scale, rotation) for the template.
- [x] Task: Draft the `archer_template.json` file structure.
- [x] Task: Implement the "Borders" section of the Archer JSON.
- [x] Task: Implement the "Shapes" section of the Archer JSON.
- [x] Task: Add metadata (name, description, thumbnail path) to the Archer JSON.
- [x] Task: Validate JSON syntax and coordinate ranges.
- [x] Task: Create a placeholder thumbnail for the Archer template.
- [x] Task: Conductor - User Manual Verification 'Archer Template Coordinate Mapping & Draft JSON' (Protocol in workflow.md)

## Phase 9: PREMADE Catalog Backend & JSON Infrastructure
- [x] Task: Create `catalog.json` with the Archer template entry.
- [x] Task: Implement `CatalogService` to load and parse the JSON catalog.
- [x] Task: Add TDD tests for `CatalogService.loadTemplates()`.
- [x] Task: Implement logic to apply a template JSON to the current sheet state.
- [x] Task: Add TDD tests for template application logic (mocking DOM state).
- [x] Task: Update `DomManager` to support "Template" as a new state category. (8c1d3f5)
- [x] Task: Ensure template application doesn't conflict with existing manual edits. (60e7f12)
- [x] Task: Implement a "Preview" mode for templates if feasible. (a3d2e1f)
- [x] Task: Add error handling for malformed template JSON files. (f4e1a2b)
- [x] Task: Conductor - User Manual Verification 'PREMADE Catalog Backend & JSON Infrastructure' (Protocol in workflow.md)

## Phase 10: PREMADE Catalog UI & Integration
- [x] Implement the "PREMADE" tab in the side panel UI. (Buttons list in side panel)
- [x] Create a list view for catalog items (thumbnails + names). (Grid in modal)
- [x] Add an "Apply Template" button to each catalog item. (In detailed preview)
- [x] Connect the UI buttons to the `CatalogService` application logic.
- [x] Implement a "Loading" state for template application. (Applying... button state)
- [x] Ensure the UI updates correctly after a template is applied.
- [x] Perform a full visual audit of the Archer template vs. `sheet_archer.png`. (Validated ID mappings)
- [x] Fix any minor alignment or audit issues found during the audit.
- [x] Update the project documentation to include instructions for adding new templates.
- [x] Implement a regression test for manifest integrity (ensure all declared files exist).
- [x] Conductor - User Manual Verification 'PREMADE Catalog UI & Integration' (Protocol in workflow.md)