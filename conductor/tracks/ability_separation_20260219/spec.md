# Specification: Individual Ability Score Sections

## 1. Overview
This feature automatically separates the character's ability scores (STR, DEX, CON, INT, WIS, CHA) from their original container into individual floating sections. This allows for more granular layout customization of the core stats.

## 2. Functional Requirements
- **Automated Extraction:** Upon character sheet load, the extension will identify all `.ct-quick-info__ability` elements.
- **Section Creation:** Six new floating, draggable sections will be created, each containing one ability score.
- **Redundancy Cleanup:** The original `.ct-quick-info__ability` elements will be removed from the DOM once successfully extracted.
- **Default Visuals:** Each new section will have its `borderStyle` attribute set to "ability" by default.
- **Initial Layout:** The sections will be positioned in a horizontal row by default (e.g., along the top or just below the header).
- **Integration:** The new sections must be fully compatible with:
    - Persistent layout management (Saving/Loading coordinates and sizes).
    - Draggable behavior.
    - Border Picker UI (allowing the user to change from the "ability" default).

## 3. Non-Functional Requirements
- **Performance:** Extraction must happen efficiently during the initialization phase without causing significant layout shift or flicker.
- **Reliability:** Ensure extraction only occurs if the required DOM elements are found.

## 4. Acceptance Criteria
- [ ] On page load, ability scores are automatically moved into individual floating sections.
- [ ] The original ability score list is no longer visible in its default location.
- [ ] The sections are initially arranged in a horizontal row.
- [ ] All 6 sections use the "ability" border style by default.
- [ ] The user can change the border style of an individual ability section using the existing UI.
- [ ] The position and border style of these sections are correctly saved and restored via IndexedDB/JSON export.

## 5. Out of Scope
- Support for custom ability scores outside the standard 6.
- Logic to "re-group" them into the original container (users can manually group them using the merge feature if applicable).
