# Track Specification: Advanced Layout & Persistence Enhancements

## Overview
This track significantly expands the D&D Beyond Print Enhancer by introducing interactive layout management, standardized physical sizing, and state persistence. Users will be able to rearrange the sheet components, duplicate spell sections for different preparation lists, and save their custom configurations locally.

## Functional Requirements
1.  **Draggable Sections:**
    *   All sheet sections (e.g., Stats, Actions, Spells, Equipment) must be draggable.
    *   Dragging is initiated by clicking and holding anywhere on the section header.
    *   Sections should snap into a grid or list to maintain a clean layout.
2.  **Letter Page Standardization:**
    *   The print output must be strictly formatted for "Letter" (8.5" x 11") page size.
    *   Content should overflow naturally to subsequent pages if the height exceeds the first page.
3.  **Automatic Section Extraction:**
    *   On activation, the script must iterate through all tabbed sections ('Actions', 'Spells', 'Equipment', 'Features & Traits').
    *   Each section's content must be extracted, converted into a standalone draggable section, and appended to the main view.
    *   The original tab navigation must be hidden as it is rendered obsolete.
4.  **UI Cleanup:**
    *   Remove all search text boxes from within the sections to save space and remove non-functional print elements.
    *   Force all sections to grow to their full height (remove scroll bars).
5.  **Spell Section Duplication:**
    *   Add a "Duplicate" button to the Spells section.
    *   Each duplicated Spells section must have a unique DOM ID.
    *   Duplicated sections start as an empty template for manual filling.
6.  **Persistence (IndexedDB):**
    *   The customized layout (order of sections) and any manually added spell lists must be saved to IndexedDB.
    *   Persistence is triggered manually via a "Save Layout" button.
    *   Saved state must be restored when the extension is activated on the same character.

## Non-Functional Requirements
- **Performance:** DOM manipulation and IndexedDB operations should not lag the browser UI.
- **Robustness:** Use `safeQuery` patterns to handle potential missing elements in the D&DB DOM.

## Acceptance Criteria
- [ ] Users can drag and reorder every major section of the sheet.
- [ ] The print preview (Ctrl+P) defaults to Letter size with a coherent multi-column or single-column flow.
- [ ] No scrollbars are visible in any section; the page length adjusts to the content.
- [ ] Duplicating a spell section creates a new, independent container with a unique ID.
- [ ] Clicking "Save" preserves the current arrangement across page reloads.

## Out of Scope
- Supporting page sizes other than Letter (e.g., A4).
- Automatic cloud syncing of layouts (Local persistence only).
