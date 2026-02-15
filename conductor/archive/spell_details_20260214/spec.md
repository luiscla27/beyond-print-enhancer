# Track: Spell Detail Section Injection (spell_details_20260214)

## Overview
This track introduces the ability to create dedicated, floating "Spell Detail Sections" for individual spells. It leverages existing character data fetching to populate these sections and implements an IndexedDB cache to optimize performance and reduce API load.

## Functional Requirements

### 1. Trigger & Injection
- **Target:** Inject an absolute-positioned button into every spell row (`div.ct-spells-spell`), including those in cloned sections.
- **Visibility:** The button must be hidden by default and only visible when the user hovers over the specific spell row.
- **Spell Name Extraction:** The spell name must be extracted from the `innerText` of the child element `div.ct-spells-spell__label`.

### 2. Data Management & Caching
- **IndexedDB Integration:** Create a new object store named `spell_cache` within the existing `DDBPrintEnhancerDB`.
- **Cache Logic:**
    - On button click, first check the `spell_cache` for the spell name.
    - If found (Cache Hit), use the cached data (Name, Level, Description, Range, School).
    - If not found (Cache Miss), trigger the existing `getCharacterSpells` function to fetch and then store ALL character spells in the cache.
- **Portability:** The `spell_cache` data must be included in the "Save to PC" (JSON export) and "Load from PC" (JSON import) workflows.

### 3. Spell Detail Section UI
- **Immediate Feedback:** Create the section immediately upon clicking the button.
- **Positioning:** The section must be floating (absolute/fixed) and initially placed at the exact coordinates where the user clicked.
- **Loading State:** Show a loading spinner *inside* the new section while data is being retrieved.
- **Content:** Once loaded, display:
    - Spell Name, Level, School, Range, and a stripped-HTML Description.
    - A "Close" button to remove the section.
- **Error State:** If the spell cannot be found after an API fetch:
    - Display the message: "Only previously loaded spells and current ones from the original section are available. Please add the spell from the manage spells button and try again."
    - Provide "Delete" and "Retry" buttons within the section.

## Non-Functional Requirements
- **Performance:** Ensure that IndexedDB operations do not block the main UI thread.
- **Consistency:** The new sections should match the visual style of existing character sheet sections.

## Acceptance Criteria
- [ ] Hovering a spell row reveals a "Details" button.
- [ ] Clicking the button creates a section at the click coordinates.
- [ ] Sections populate correctly from both IndexedDB and the API.
- [ ] The "Delete" and "Retry" logic works as expected for missing spells.
- [ ] Saved JSON layouts include the cached spell data.
