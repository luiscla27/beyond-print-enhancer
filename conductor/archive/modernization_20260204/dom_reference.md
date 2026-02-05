# D&D Beyond DOM Reference (as of Feb 2026)

This document maps the old CSS selectors used in the extension to the current structure identified on D&D Beyond.

## Main Application Containers
| Component | Old Selector (js/main.js) | New Selector (Feb 2026) | Notes |
| :--- | :--- | :--- | :--- |
| **Character Name** | `.ct-character-tidbits__name` | `.ct-character-tidbits__name` | Remains unchanged. |
| **HP Display** | `.ct-status-summary-mobile__hp` | `.ct-status-summary-bar__hp-text` | Structure changed to summary-bar. |
| **Navigation Container** | `.ct-quick-nav__toggle` | `.ct-character-sheet-navigation` | Now part of a dedicated navigation component. |
| **Tab Buttons** | `.ct-quick-nav__button` | `.ct-character-sheet-navigation__tab` | |
| **Content Area** | `.ct-component-carousel` | `.ct-character-sheet-content` | Major structural change from carousel to generic content container. |
| **Sidebar** | `.ct-sidebar__header` | `.ct-sidebar` | |
| **Defenses Section** | `.ct-defense-manage-pane` | `.ct-sidebar__section--defenses` | Now explicitly a sidebar section. |

## Detailed Selectors (New)
- **HP Current:** `.ct-status-summary-bar__hp-current`
- **HP Max:** `.ct-status-summary-bar__hp-max`
- **Navigation Tabs:** `.ct-character-sheet-navigation__tabs`
- **Tab Label:** `.ct-character-sheet-navigation__tab-label`
- **Tab Icon:** `.ct-character-sheet-navigation__tab-icon`
- **Sidebar Section Header:** `.ct-sidebar__section-header`
- **Sidebar Section Content:** `.ct-sidebar__section-content`

## Structural Changes Noted
1.  **Navigation:** The old "quick-nav" portal has been replaced by a more standard `ct-character-sheet-navigation` component.
2.  **Content Management:** The "carousel" logic (`.ct-component-carousel`) appears to have been replaced by a static container (`.ct-character-sheet-content`) that likely swaps its children based on React state.
3.  **Sidebar Sections:** Information like Defenses is now more strictly categorized under `.ct-sidebar__section--<type>` classes.

## Elements to Remove/Hide (Potential)
- `.ct-character-sheet-navigation` (Hide during print)
- `.ct-sidebar` (If moved to main sheet)
- `header.main`, `div.site-bar`, `footer` (Site-wide navigation)
