# CSS Abstraction Plan (Detailed)

## Overview
This document analyzes the purpose of each CSS selector used in the injected style blocks (`enforceFullHeight` and `injectCompactStyles`) and maps them to semantic keys in `DomManager`.

## 1. Global / Print Layout (`enforceFullHeight`)
**Purpose:** Hides site navigation, ads, and sets up the print page boundaries.

| Purpose | Selector | Source | DomManager Key |
| :--- | :--- | :--- | :--- |
| **Site Navigation** | `.site-bar` | DDB | `CORE.SITE_BAR` |
| **Main Header** | `nav`, `header` | DDB | `CORE.NAVIGATION`, `CORE.HEADER_MAIN` |
| **Site Alerts** | `.ddb-site-alert` | DDB | `CORE.SITE_ALERT` |
| **Branding/Watermark** | `.watermark` | DDB | `CORE.WATERMARK` |
| **Mega Menu** | `#mega-menu-target` | DDB | `CORE.MEGA_MENU_TARGET` |
| **Mobile Nav** | `.mm-navbar` | DDB | `CORE.MM_NAVBAR` |
| **Notifications** | `.notifications-wrapper` | DDB | `CORE.NOTIFICATIONS` |
| **Footer** | `footer` | DDB | `CORE.FOOTER` |
| **Sheet Container** | `.ct-character-sheet-desktop` | DDB | `CORE.SHEET_DESKTOP` |
| **Print Break Avoidance** | `div.ct-content-group` | DDB | `CORE.CONTENT_GROUP` |

## 2. Layout & Typography Fixes (Inside `enforceFullHeight` CSS block)
**Purpose:** Adjusts font sizes, hides specific internal elements, and fixes layout glitches.

| Purpose | Selector | Source | DomManager Key |
| :--- | :--- | :--- | :--- |
| **Skills Box** | `.ct-skills__box` | DDB | `SKILLS.BOX` |
| **Combat Statuses** | `.ct-combat__statuses` | DDB | `COMBAT.STATUSES` |
| **Quick Info** | `.ct-quick-info` | DDB | `CORE.QUICK_INFO` |
| **Quick Info Health** | `.ct-quick-info__health` | DDB | `UI.QUICK_INFO_HEALTH` |
| **Headings** | `[class^="styles_heading__"]`, `[class^="styles_sectionHeading__"]` | DDB | `CORE.HEADING_STYLES`, `CORE.SECTION_HEADING_STYLES` |
| **Generic Heading Suffix** | `[class$="-heading"]`, `[class$="__heading"]` | DDB | `CORE.HEADING_SUFFIX` |
| **Content Group Header** | `.ct-content-group__header-content` | DDB | `CORE.GROUP_HEADER_CONTENT` |
| **Senses Callout** | `.ct-senses__callout-value` | DDB | `SENSES.CALLOUT_VALUE` |
| **Dice Container** | `.integrated-dice__container` | DDB | `CORE.DICE_CONTAINER` |
| **AC Value** | `.ddbc-armor-class-box__value` | DDB | `COMBAT.AC_VALUE` |
| **Portrait** | `.ddbc-character-avatar__portrait` | DDB | `UI.PORTRAIT` |
| **Skills Container** | `.ct-skills` | DDB | `SKILLS.CONTAINER` |

## 3. Compact Mode (`injectCompactStyles`)
**Purpose:** Condenses the layout for Spells, Actions, and other lists to save paper space.

| Purpose | Selector | Source | DomManager Key |
| :--- | :--- | :--- | :--- |
| **Table Headers** | `[class^="styles_tableHeader__"]` | DDB | `COMPACT.TABLE_HEADER` |
| **Generic Headers** | `[class$="__header"]` | DDB | `COMPACT.GENERIC_HEADER` |
| **Section Headings** | `[class$="__heading"]` | DDB | `COMPACT.GENERIC_HEADING` |
| **List Rows** | `[class$="-row"]` | DDB | `COMPACT.GENERIC_ROW` |
| **Row Headers** | `[class$="__row-header"]` | DDB | `COMPACT.ROW_HEADER` |
| **Primary Text** | `[class$="--primary"]` | DDB | `COMPACT.PRIMARY` |
| **Row Primary** | `[class$="-row__primary"]` | DDB | `COMPACT.ROW_PRIMARY` |
| **Content Body** | `[class$="-content"]` | DDB | `COMPACT.GENERIC_CONTENT` |
| **Attack Icon** | `[class$="__attack-save-icon"]` | DDB | `COMPACT.ICON_ATTACK` |
| **Range Icon** | `[class$="__range-icon"]` | DDB | `COMPACT.ICON_RANGE` |
| **Cast Time Icon** | `[class$="__casting-time-icon"]` | DDB | `COMPACT.ICON_CAST_TIME` |
| **Damage Icon** | `[class$="__damage-effect-icon"]` | DDB | `COMPACT.ICON_DAMAGE` |
| **File Icon** | `.ddbc-file-icon` | DDB | `COMPACT.ICON_FILE` |
| **Preview Pane** | `[class$="--preview"]`, `[class$="__preview"]` | DDB | `COMPACT.PREVIEW`, `COMPACT.PREVIEW_ALT` |
| **Labels** | `[class$="__label"]` | DDB | `COMPACT.LABEL` |
| **Notes** | `[class$="__notes"]` | DDB | `COMPACT.NOTES` |
| **Activation Time** | `[class$="__activation"]` | DDB | `COMPACT.ACTIVATION` |
| **Range Text** | `[class$="__range"]` | DDB | `COMPACT.RANGE` |
| **Hit/DC Text** | `[class$="__hit-dc"]` | DDB | `COMPACT.HIT_DC` |
| **Effect Text** | `[class$="__effect"]` | DDB | `COMPACT.EFFECT` |
| **Action Buttons** | `button[class$="__container"]` | DDB | `COMPACT.BUTTON_CONTAINER` |
| **Spell Slots** | `[class$="__slots"]` | DDB | `COMPACT.SLOTS` |
| **Header Content** | `[class$="__header-content"]` | DDB | `COMPACT.HEADER_CONTENT` |
| **Action Type** | `[class$="__action"]` | DDB | `COMPACT.ACTION` |
| **Distance** | `[class$="__distance"]` | DDB | `COMPACT.DISTANCE` |
| **Meta Info** | `[class$="__meta"]` | DDB | `COMPACT.META` |

## 4. UI Elements (Extension Specific)
**Purpose:** Styles for elements created by the extension. These are owned by us, but good to track.

| Purpose | Selector | Source | DomManager Key |
| :--- | :--- | :--- | :--- |
| **Loading Spinner** | `.be-spinner` | Ext | `UI.SPINNER` |
| **Error Actions** | `.be-error-actions` | Ext | `UI.ERROR_ACTIONS` |
| **Retry Button** | `.be-retry-button` | Ext | `UI.RETRY_BTN` |
| **Delete Button** | `.be-delete-button` | Ext | `UI.DELETE_BTN` |
| **Extractable Trigger** | `.be-extractable` | Ext | `UI.EXTRACTABLE` |
| **Spell Detail Btn** | `.be-spell-details-button` | Ext | `SPELLS.DETAIL_BUTTON` (Exists) |

## Implementation
- Update `DomManager` with the `UI` namespace.
- Update `DomManager` `COMPACT` namespace with any missing definitions.
- Refactor `js/main.js` to use these keys in the `injectCompactStyles` function template literal.
