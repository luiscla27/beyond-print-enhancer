# Specification - Image Filter Fix & Reset UI

## Overview
This track addresses two key issues: a bug in the global filtering logic that incorrectly affects non-shape images (like portraits and icons), and a missing UI feature for resetting filters to their default values. The fix involves refining the inverse filter logic for `<img>` elements, and the enhancement adds both individual and global reset buttons to the control panel.

## Functional Requirements
- **Bug Fix: Image Filter Inversion**
  - Refine `applyGlobalFilters` to ensure that ALL `<img>` elements EXCEPT those with the `be-shape-asset` class are correctly excluded from global filters.
  - Verify that the inverse filter logic (`sepia(-X%)`, `grayscale(-X%)`, etc.) is correctly applied and mathematically sound to cancel out the positive values.
- **Feature: Individual Reset Buttons**
  - Add a small reset icon/button (e.g., '↺') next to each of the five filter sliders (Hue, Contrast, Saturate, Greyscale, Sepia).
  - Clicking an individual reset button will immediately set that slider to its default value (0 for Hue, 100 for Contrast/Saturate, 0 for Greyscale/Sepia).
  - The UI label and the character sheet view must update in real-time upon reset.
- **Feature: Global Reset Button**
  - Add a "Reset All Filters" button at the bottom of the filters container.
  - Clicking this button will reset **Contrast, Saturate, Greyscale, and Sepia** to their defaults.
  - **Exception:** As requested, this global reset will NOT affect the Hue Shift value.
- **Persistence**
  - All reset actions (individual or global) must be persisted to storage.

## Acceptance Criteria
- [ ] Non-shape images (portraits, DDB icons) remain visually unchanged when global filters are applied.
- [ ] Each slider has a functional individual reset button next to it.
- [ ] A "Reset All Filters" button is present and resets all filters except Hue.
- [ ] Resetting a value updates the slider, the label, the character sheet view, and the saved storage value.
- [ ] The "Reset All" button correctly ignores the Hue slider setting.

## Out of Scope
- Redesigning the entire control panel UI.
- Individual reset buttons for other non-filter settings (like compact mode).
- Resetting specific sections or shapes individually.
