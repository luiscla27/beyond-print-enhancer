# Track Specification: Fix Asset Paths for Dwarf and Ornament

## Overview
Fix a bug where "Dwarf" and "Ornament" shapes/borders fail to load because of incorrect paths (`assets/shapes/` vs `assets/`).

## Functional Requirements
- **Asset Correction:** Update all references to `dwarf.gif` and `ornament.gif` to use the correct `assets/` path.
- **Consistency:** Ensure `applyShapeAsset`, `showShapePickerModal`, and `assetToClassMap` use identical path strings.
- **Loading:** Ensure sections using these borders are correctly identified and styled during `applyLayout`.

## Acceptance Criteria
- [ ] "Dwarf (Shape)" and "Ornament (Shape)" options in the shape picker modal show correct previews and create visible shapes.
- [ ] Sections with Dwarf or Ornament borders are correctly styled when loading a saved layout.
- [ ] No regression in other shape/border types.
