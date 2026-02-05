# DOM Selector Audit Report

This report compares the selectors found in `js/main.js` with the modern structure identified in `dom_reference.md`.

## Selectors Requiring Update

| File Location | Old Selector | New Recommended Selector | Change Type |
| :--- | :--- | :--- | :--- |
| `navToSection` | `.ct-quick-nav__toggle` | `.ct-character-sheet-navigation` | Structural |
| `navToSection` | `.ct-quick-nav__menu-item--${name} .ct-quick-nav__button` | `.ct-character-sheet-navigation__tab[data-tab="${name}"]` (Estimate) | Structural |
| `getAllSections` | `.ct-component-carousel` | `.ct-character-sheet-content` | Rename |
| `appendAllSections` | `.ct-component-carousel` | `.ct-character-sheet-content` | Rename |
| `moveDefenses` | `.ct-combat-tablet__cta-button` | TBD (Button to open sidebar) | Potential Removal |
| `moveDefenses` | `.ct-defense-manage-pane` | `.ct-sidebar__section--defenses` | Structural |
| `moveDefenses` | `.ct-quick-nav__edge-toggle` | TBD (Close sidebar) | Structural |
| `moveDefenses` | `.ct-combat-tablet__extra--statuses` | TBD | Structural |
| `tweakStyles` | `div.site-bar` | `div.site-bar` (Verified) | Remains |
| `tweakStyles` | `header.main` | `header.main` (Verified) | Remains |
| `tweakStyles` | `div.ct-quick-nav__portal` | `.ct-character-sheet-navigation` | Structural |
| `tweakStyles` | `div.ct-status-summary-mobile__hp` | `.ct-status-summary-bar__hp-text` | Rename |

## Findings
1.  **Carousel Logic:** The transition from `.ct-component-carousel` to `.ct-character-sheet-content` suggests that cloning might be more complex if React state is involved in rendering the content.
2.  **Navigation:** The "Portal" and "Quick Nav" concepts have been unified into a standard navigation component.
3.  **Defenses:** Relocating defenses now involves targeting sidebar sections rather than a standalone manage pane.
4.  **Action Buttons:** "Short Rest" and "Long Rest" buttons (`.ct-character-header-tablet__group--short-rest`) need verification as they might be part of the new header structure.

## Recommendations for Refactor
- Implement a helper function `getElement(selector)` that returns `null` safely if not found.
- Use the modern selectors identified in `dom_reference.md`.
- Add logging when critical elements are missing to aid in debugging.
