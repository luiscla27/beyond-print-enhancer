# Specification: Archer Sheet Template Replication

## Overview
Replicate the visual identity of `demo/ignored/sheet_archer.png` into the `dndbeyond-printenhance` extension. This includes extracting and cleaning assets (borders and shapes) and providing a new "PREMADE Templates" catalog in the side panel for users to load this and other future templates.

## Functional Requirements
- **Template Asset Extraction:**
  - Identify all unique borders and shapes in `sheet_archer.png`.
  - Distinguish between borders (container decorations) and shapes (ornaments or structural elements).
  - Extract, crop, and clean assets using specialized image tools (referred to as "nano banana").
  - Assets must be saved in the appropriate project folders (e.g., `assets/` or `assets/shapes/`).
- **PREMADE Template Catalog:**
  - Add a new "PREMADE" tab to the extension's side panel.
  - Load a catalog of templates from a `catalog.json` file.
  - The catalog must follow a "Comprehensive" structure: name, thumbnail, and template JSON data (including coordinates and shape IDs).
- **Archer Template Implementation:**
  - Create a JSON template file representing the "Archer" sheet.
  - This JSON should specify the positions, sizes, and assets used to replicate the look of `sheet_archer.png`.
- **UI Interaction:**
  - Users can select the "Archer" template from the new catalog to apply it to their current character sheet.

## Non-Functional Requirements
- **High Fidelity:** The replication must be as accurate as possible to the original image (excluding fonts).
- **Maintainability:** The catalog and template JSON files must be structured to allow for easy addition of new templates.
- **Performance:** Asset sizes should be optimized for use in a browser extension.

## Acceptance Criteria
- [ ] New "PREMADE" tab is visible in the side panel.
- [ ] `sheet_archer.png` assets are correctly extracted, cleaned, and integrated.
- [ ] Selecting the "Archer" template from the catalog correctly applies the replication to the D&D Beyond sheet.
- [ ] Catalog JSON structure supports multiple templates with full metadata.

## Out of Scope
- Font replication (matching the exact fonts used in the image).
- Replication of other sheet templates not explicitly mentioned.