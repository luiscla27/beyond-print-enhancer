# Specification: Border Asset Expansion (Extension)

## Overview
This track extends the existing border selection system to include a wider range of graphical assets (GIFs and PNGs) found in `./assets/`. The goal is to provide users with more decorative and thematic options for their character sheet sections by leveraging the established `border-image` implementation.

## Functional Requirements
- **Style Extension:** Add new CSS classes to the `enforceFullHeight` style injection for each of the new border assets.
- **Modal Update:** Extend the `styles` array within `showBorderPickerModal` to include the new options.
- **Asset Mapping:** Map assets like `dwarf.gif`, `ornament_bold.gif`, `spiky.gif`, etc., to selectable border styles.
- **Consistency:** Ensure the new styles use the same CSS variable pattern (`--border-img`, `--border-img-width`, etc.) as the existing ones.

## New Border Assets
The following assets will be mapped to new selectable styles:
- **Thematic:** `dwarf.gif`, `sticks.gif`.
- **Decorative:** `ornament.gif`, `ornament2.gif`, `ornament_bold.gif`, `ornament_bold2.gif`, `ornament_simple.gif`.
- **Spiky/Sharp:** `spike_hollow.gif`, `spiky.gif`, `spiky_bold.gif`.
- **Vines:** `vine_holloow.gif`.

## Acceptance Criteria
- [ ] New borders appear as selectable options in the "Select Section Border" modal.
- [ ] Selecting a new border applies it immediately via the existing CSS class system.
- [ ] No changes are made to the core border selection or persistence logic.
- [ ] Existing borders (Barbarian, Goth, Plants, etc.) continue to function as expected.
