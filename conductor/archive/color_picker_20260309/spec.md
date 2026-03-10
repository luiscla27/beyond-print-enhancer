# Specification - Color Picker (Global Hue Rotation)

## Overview
This feature introduces a global color customization mechanism for character sheet elements (borders, shapes, backgrounds, etc.) using CSS `hue-rotate` filters. Instead of manually re-coloring assets, a single slider in the main control panel will allow users to shift the hue of the extension's decorative elements relative to a base color of `#c73838`.

## Functional Requirements
- **Global Hue Slider:** Add a range input (0-360 degrees) to the main floating control panel.
- **Dynamic Hue Calculation:**
  - Base color: `#c73838`.
  - Calculate and apply the `filter: hue-rotate(Ndeg)` value to targeted elements.
- **Targeting Logic:**
  - Apply the filter to:
    - Custom section borders.
    - Decorative shapes and ornaments.
    - Floating section backgrounds.
  - **EXCLUDE**:
    - All text/fonts.
    - Character portraits.
    - Status icons (e.g., condition markers).
    - Item icons and all general images/icons.
- **Persistence:** Save the selected hue value to browser storage (global preference) so it persists across different characters and layouts.
- **Real-time Preview:** Changes should be reflected immediately on the character sheet as the slider is moved.

## Non-Functional Requirements
- **Performance:** Hue rotation should be applied via CSS filters to ensure smooth performance without re-rendering elements.
- **Usability:** The slider should have a visual indicator of the currently selected hue or color.

## Acceptance Criteria
- [ ] A "Hue Shift" slider is present in the main control panel.
- [ ] Moving the slider shifts the color of all borders and shapes simultaneously.
- [ ] Icons, images, and text remain unaffected by the color change.
- [ ] The color setting is remembered when the character sheet is reloaded.
- [ ] The default state (0 degrees) matches the original theme.

## Out of Scope
- Individual color selection per section or shape.
- Advanced filters like brightness, contrast, or saturation.
- Support for hex/RGB color input (sticking to the hue-rotate model).
