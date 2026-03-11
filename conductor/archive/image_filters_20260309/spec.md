# Specification - Image Filters Expansion (Contrast, Greyscale, Saturate, Sepia)

## Overview
This feature expands the character sheet's visual customization by adding four new image filters: Contrast, Greyscale, Saturate, and Sepia. These filters will be controlled by standalone sliders in the main control panel, similar to the existing Hue shift. They aim to provide more aesthetic flexibility for character sheet decoration while maintaining legibility.

## Functional Requirements
- **Standalone Sliders:** Add four new range inputs to the main floating control panel for:
  - **Contrast:** Range 0-200%, default 100%.
  - **Greyscale:** Range 0-100%, default 0%.
  - **Saturate:** Range 0-200%, default 100%.
  - **Sepia:** Range 0-100%, default 0%.
- **Dynamic Filter Calculation:**
  - Combine all active filters (Hue, Contrast, Greyscale, Saturate, Sepia) into a single CSS `filter` string.
  - Apply the composite filter to targeted elements.
- **Targeting & Exclusion Logic:**
  - **Targets:** Same as Hue (borders, shapes, backgrounds).
  - **Exclusions:**
    - **Floating Control Panel (Menu):** Must NOT be affected by any filters (including Hue).
    - **Text/Fonts:** Must remain unaffected for maximum legibility.
    - **Character Portraits & Icons:** Follow the existing "inverse filter" or direct exclusion logic used for Hue.
- **Persistence:** Save all four new settings to browser storage as global extension preferences (IndexedDB via `Storage` object).
- **Real-time Preview:** Changes should be reflected immediately on the character sheet as the sliders are moved.

## Non-Functional Requirements
- **Performance:** CSS filters should be applied efficiently via a central `<style>` block to avoid re-rendering overhead.
- **Consistency:** The UI for the new sliders should match the existing Hue slider style (labels, range inputs).

## Acceptance Criteria
- [ ] Four new sliders are present in the main control panel.
- [ ] Moving each slider updates the character sheet's visual style in real-time.
- [ ] The floating control panel (menu) remains visually consistent regardless of filter settings.
- [ ] Text, portraits, and icons are not negatively impacted by the filters (maintained through the existing exclusion logic).
- [ ] Filter settings are saved and restored on page reload.
- [ ] Resetting sliders to defaults (100% for Contrast/Saturate, 0% for others) restores the original look.

## Out of Scope
- Individual filter selection per section or shape.
- Color balance (RGB) or advanced image processing beyond CSS filters.
- Presets or theme templates (e.g., "Vintage", "Noir").
