# Specification: Section Cloning Feature

## Overview
This feature allows users to "clone" any section of the D&D Beyond character sheet (e.g., Spells, Actions, Equipment). The primary goal is to support multiple "purpose-built" lists (like "Combat Spells" vs. "Social Spells") on a single printed page. Clones are static snapshots of the section's content at the time of creation.

## Functional Requirements
1.  **Clone Button:**
    *   A new "Clone" icon button must appear on hover in the bottom-left corner of every movable/resizable section (similar to the resize handle position).
    *   The button should be visible only on hover to keep the UI clean.
2.  **Snapshot Logic:**
    *   When clicked, the current content of the section is captured as a "Static Snapshot."
    *   The cloned section is independent of the original; changes to the original's filters or state do not affect existing clones.
3.  **Title/Header Management:**
    *   Upon cloning, the user is prompted (via a modal) to enter a title for the clone.
    *   A default title (e.g., "[Section Name] Clone 1") is auto-generated if none is provided.
    *   Users can re-edit the title by double-clicking the header of the cloned section or via a new "Manage Clones" interface in the floating control panel.
    *   The title editing process must not affect the print layout (styles remain consistent).
4.  **Persistence:**
    *   Each clone must be assigned a unique ID.
    *   Clone data (HTML content, title, position, size, and scaling) must be included in the "Save/Load Template" functionality (IndexedDB and JSON export).
5.  **UI/UX:**
    *   Clones should be movable and resizable just like original sections.
    *   A "Delete" option must be available for cloned sections.

## Non-Functional Requirements
*   **Performance:** Capturing and rendering snapshots should not significantly lag the character sheet.
*   **Print Fidelity:** Clones must adhere to the same print-enhancement styles (black text, optimized margins) as original sections.

## Acceptance Criteria
- [ ] Clicking the Clone button creates a new, identical-looking section on the page.
- [ ] Modifying the "original" section (e.g., changing spell filters) does not change the content of the clone.
- [ ] Cloned sections persist across page reloads when using the "Save Template" feature.
- [ ] The clone title is correctly displayed and editable via double-click.
- [ ] Cloned sections can be moved, resized, and deleted.

## Out of Scope
*   "Live" syncing between clones and originals.
*   Editing the *content* of a snapshot (e.g., adding a spell directly to a clone). Users must update the original and clone again.
