# CSS Abstraction Plan

## Goal
Centralize hardcoded CSS selectors found in `injectCompactStyles` and `enforceFullHeight` into `DomManager`.

## Selectors to Abstract

### Core / Global (enforceFullHeight)
| Current Selector | DomManager Key |
| :--- | :--- |
| `.site-bar` | `CORE.SITE_BAR` (Exists) |
| `nav` | `CORE.NAVIGATION` (Exists) |
| `header` | `CORE.HEADER_MAIN` (Exists - ish, assumes header.main) |
| `.ddb-site-alert` | `CORE.SITE_ALERT` (Exists) |
| `.watermark` | `CORE.WATERMARK` (Exists) |
| `#mega-menu-target` | `CORE.MEGA_MENU_TARGET` (Exists) |
| `.mm-navbar` | `CORE.MM_NAVBAR` (New) |
| `.notifications-wrapper` | `CORE.NOTIFICATIONS` (Exists) |
| `.ct-character-sheet-desktop` | `CORE.SHEET_DESKTOP` (Exists) |
| `div.ct-content-group` | `CORE.CONTENT_GROUP` (New) |

### Compact Mode (injectCompactStyles)
Most of these are generic suffix selectors. We should store the *roots* or *patterns* in DomManager.

| Current Selector | DomManager Key |
| :--- | :--- |
| `[class^="styles_tableHeader__"]` | `COMPACT.TABLE_HEADER` |
| `[class$="__header"]` | `COMPACT.GENERIC_HEADER` |
| `[class$="__heading"]` | `COMPACT.GENERIC_HEADING` |
| `[class$="-row"]` | `COMPACT.GENERIC_ROW` |
| `[class$="__row-header"]` | `COMPACT.ROW_HEADER` |
| `[class$="--primary"]` | `COMPACT.PRIMARY` |
| `[class$="-row__primary"]` | `COMPACT.ROW_PRIMARY` |
| `[class$="-content"]` | `COMPACT.GENERIC_CONTENT` |
| `[class$="__attack-save-icon"]` | `COMPACT.ICON_ATTACK` |
| `[class$="__range-icon"]` | `COMPACT.ICON_RANGE` |
| `[class$="__casting-time-icon"]` | `COMPACT.ICON_CAST_TIME` |
| `[class$="__damage-effect-icon"]` | `COMPACT.ICON_DAMAGE` |
| `.ddbc-file-icon` | `COMPACT.ICON_FILE` |
| `.ct-extras` | `EXTRAS.CONTAINER` (Exists) |
| `[class$="--preview"]` | `COMPACT.PREVIEW` |
| `[class$="__preview"]` | `COMPACT.PREVIEW_ALT` |
| `[class$="__label"]` | `COMPACT.LABEL` |
| `[class$="__notes"]` | `COMPACT.NOTES` |
| `[class$="__activation"]` | `COMPACT.ACTIVATION` |
| `[class$="__range"]` | `COMPACT.RANGE` |
| `[class$="__hit-dc"]` | `COMPACT.HIT_DC` |
| `[class$="__effect"]` | `COMPACT.EFFECT` |
| `button[class$="__container"]` | `COMPACT.BUTTON_CONTAINER` |
| `.ct-button` | `CORE.BUTTON` (New) |
| `[class$="__slots"]` | `COMPACT.SLOTS` |
| `[class$="__header-content"]` | `COMPACT.HEADER_CONTENT` |
| `[class$="__action"]` | `COMPACT.ACTION` |
| `[class$="__distance"]` | `COMPACT.DISTANCE` |
| `[class$="__meta"]` | `COMPACT.META` |
| `.ct-spells-spell` | `SPELLS.ROW` (Exists) |

## Strategy
1.  Update `DomManager.js` with new keys.
2.  Refactor `enforceFullHeight` to construct the style string using `DomManager.selectors`.
3.  Refactor `injectCompactStyles` to construct the style string using `DomManager.selectors`.
    *   Since `injectCompactStyles` uses a template literal with many selectors, we can create a helper in `main.js` or `DomManager` to generate the CSS block, or just interpolate variables.
