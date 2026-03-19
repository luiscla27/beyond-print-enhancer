# Implementation Plan: Archer Sheet Template Replication

## Phase 1: Research & Environment Preparation
- [ ] Task: Research existing asset structure and `assets/shapes/` directory.
- [ ] Task: Verify the presence of `demo/ignored/sheet_archer.png`.
- [ ] Task: Create a dedicated scratchpad for coordinate mapping and asset naming.
- [ ] Task: Analyze `js/dom/dom_manager.js` for "PREMADE" menu integration points.
- [ ] Task: Define the `catalog.json` schema following the "Comprehensive" requirement.
- [ ] Task: Research how to trigger "nano banana" (Gemini Image Editor) sessions.
- [ ] Task: Prepare a test environment for verifying template application.
- [ ] Task: Document the initial state of the `assets/` folder for comparison.
- [ ] Task: Set up a new unit test file `test/unit/catalog_logic.test.js`.
- [ ] Task: Conductor - User Manual Verification 'Research & Environment Preparation' (Protocol in workflow.md)

## Phase 2: Border Identification & Preliminary Extraction
- [ ] Task: Identify all unique border elements in `sheet_archer.png`.
- [ ] Task: Distinguish between top, bottom, and side border variations.
- [ ] Task: Manually map the pixel coordinates for each border segment.
- [ ] Task: Create a list of required "cleaned" border files.
- [ ] Task: Perform a preliminary crop of the "Main Header" border.
- [ ] Task: Perform a preliminary crop of the "Ability Score" border.
- [ ] Task: Perform a preliminary crop of the "Combat Stats" border.
- [ ] Task: Perform a preliminary crop of the "Footer" border.
- [ ] Task: Validate the extracted segments against the extension's aspect ratios.
- [ ] Task: Conductor - User Manual Verification 'Border Identification & Preliminary Extraction' (Protocol in workflow.md)

## Phase 3: Shape Identification & Preliminary Extraction
- [ ] Task: Identify all ornamental shapes (icons, dividers, flourishes) in the image.
- [ ] Task: Distinguish between static shapes and dynamic elements.
- [ ] Task: Map the pixel coordinates for each unique shape found.
- [ ] Task: Categorize shapes by their likely use case (e.g., "Divider", "Icon").
- [ ] Task: Perform a preliminary crop of the "Archer Icon" shape.
- [ ] Task: Perform a preliminary crop of the "Section Divider" shape.
- [ ] Task: Perform a preliminary crop of the "Corner Flourish" shape.
- [ ] Task: Perform a preliminary crop of the "Small Accent" shapes.
- [ ] Task: Validate the shape extraction list for completeness.
- [ ] Task: Conductor - User Manual Verification 'Shape Identification & Preliminary Extraction' (Protocol in workflow.md)

## Phase 4: Nano Banana Session: Border Cleaning (Part 1)
- [ ] Task: Start a NEW nano banana session for the "Main Header" border.
- [ ] Task: Instruction: Clean background and normalize colors for Header Border.
- [ ] Task: Validate Header Border output and save to `assets/border_archer_header.webp`.
- [ ] Task: Start a NEW nano banana session for the "Ability Score" border.
- [ ] Task: Instruction: Clean background and normalize colors for Ability Border.
- [ ] Task: Validate Ability Border output and save to `assets/border_archer_ability.webp`.
- [ ] Task: Start a NEW nano banana session for the "Combat Stats" border.
- [ ] Task: Instruction: Clean background and normalize colors for Combat Border.
- [ ] Task: Validate Combat Border output and save to `assets/border_archer_stats.webp`.
- [ ] Task: Conductor - User Manual Verification 'Nano Banana Session: Border Cleaning (Part 1)' (Protocol in workflow.md)

## Phase 5: Nano Banana Session: Border Cleaning (Part 2)
- [ ] Task: Start a NEW nano banana session for the "Footer" border.
- [ ] Task: Instruction: Clean background and normalize colors for Footer Border.
- [ ] Task: Validate Footer Border output and save to `assets/border_archer_footer.webp`.
- [ ] Task: Start a NEW nano banana session for the "Sidebar" border.
- [ ] Task: Instruction: Clean background and normalize colors for Sidebar Border.
- [ ] Task: Validate Sidebar Border output and save to `assets/border_archer_sidebar.webp`.
- [ ] Task: Verify consistency in hue and saturation across all Archer borders.
- [ ] Task: Convert all cleaned borders to optimized WEBP format.
- [ ] Task: Document any manual corrections made to border alignment.
- [ ] Task: Conductor - User Manual Verification 'Nano Banana Session: Border Cleaning (Part 2)' (Protocol in workflow.md)

## Phase 6: Nano Banana Session: Shape Cleaning (Part 1)
- [ ] Task: Start a NEW nano banana session for the "Archer Icon" shape.
- [ ] Task: Instruction: Remove background and refine edges for Archer Icon.
- [ ] Task: Validate Archer Icon output and save to `assets/shapes/archer_main.webp`.
- [ ] Task: Start a NEW nano banana session for the "Section Divider" shape.
- [ ] Task: Instruction: Remove background and normalize thickness for Divider.
- [ ] Task: Validate Divider output and save to `assets/shapes/archer_divider.webp`.
- [ ] Task: Start a NEW nano banana session for the "Corner Flourish" shape.
- [ ] Task: Instruction: Remove background and ensure transparency for Flourish.
- [ ] Task: Validate Flourish output and save to `assets/shapes/archer_corner.webp`.
- [ ] Task: Conductor - User Manual Verification 'Nano Banana Session: Shape Cleaning (Part 1)' (Protocol in workflow.md)

## Phase 7: Nano Banana Session: Shape Cleaning (Part 2)
- [ ] Task: Start a NEW nano banana session for "Small Accent A".
- [ ] Task: Instruction: Clean and normalize accent shape A.
- [ ] Task: Validate Accent A output and save to `assets/shapes/archer_accent_a.webp`.
- [ ] Task: Start a NEW nano banana session for "Small Accent B".
- [ ] Task: Instruction: Clean and normalize accent shape B.
- [ ] Task: Validate Accent B output and save to `assets/shapes/archer_accent_b.webp`.
- [ ] Task: Verify transparency and edge quality for all Archer shapes.
- [ ] Task: Convert all cleaned shapes to optimized WEBP format.
- [ ] Task: Document shape naming conventions in the project metadata.
- [ ] Task: Conductor - User Manual Verification 'Nano Banana Session: Shape Cleaning (Part 2)' (Protocol in workflow.md)

## Phase 8: Archer Template Coordinate Mapping & Draft JSON
- [ ] Task: Re-examine `sheet_archer.png` to determine exact relative coordinates.
- [ ] Task: Map border assignments to specific D&D Beyond sheet sections.
- [ ] Task: Map shape placements (x, y, scale, rotation) for the template.
- [ ] Task: Draft the `archer_template.json` file structure.
- [ ] Task: Implement the "Borders" section of the Archer JSON.
- [ ] Task: Implement the "Shapes" section of the Archer JSON.
- [ ] Task: Add metadata (name, description, thumbnail path) to the Archer JSON.
- [ ] Task: Validate JSON syntax and coordinate ranges.
- [ ] Task: Create a placeholder thumbnail for the Archer template.
- [ ] Task: Conductor - User Manual Verification 'Archer Template Coordinate Mapping & Draft JSON' (Protocol in workflow.md)

## Phase 9: PREMADE Catalog Backend & JSON Infrastructure
- [ ] Task: Create `catalog.json` with the Archer template entry.
- [ ] Task: Implement `CatalogService` to load and parse the JSON catalog.
- [ ] Task: Add TDD tests for `CatalogService.loadTemplates()`.
- [ ] Task: Implement logic to apply a template JSON to the current sheet state.
- [ ] Task: Add TDD tests for template application logic (mocking DOM state).
- [ ] Task: Update `DomManager` to support "Template" as a new state category.
- [ ] Task: Ensure template application doesn't conflict with existing manual edits.
- [ ] Task: Implement a "Preview" mode for templates if feasible.
- [ ] Task: Add error handling for malformed template JSON files.
- [ ] Task: Conductor - User Manual Verification 'PREMADE Catalog Backend & JSON Infrastructure' (Protocol in workflow.md)

## Phase 10: PREMADE Catalog UI & Integration
- [ ] Task: Implement the "PREMADE" tab in the side panel UI.
- [ ] Task: Create a list view for catalog items (thumbnails + names).
- [ ] Task: Add an "Apply Template" button to each catalog item.
- [ ] Task: Connect the UI buttons to the `CatalogService` application logic.
- [ ] Task: Implement a "Loading" state for template application.
- [ ] Task: Ensure the UI updates correctly after a template is applied.
- [ ] Task: Perform a full visual audit of the Archer template vs. `sheet_archer.png`.
- [ ] Task: Fix any minor alignment or asset issues found during the audit.
- [ ] Task: Update the project documentation to include instructions for adding new templates.
- [ ] Task: Conductor - User Manual Verification 'PREMADE Catalog UI & Integration' (Protocol in workflow.md)