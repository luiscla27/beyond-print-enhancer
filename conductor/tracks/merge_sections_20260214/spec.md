# Specification: Merge & Append Sections

## Overview
This feature introduces the ability to "Merge" floating extracted sections into other sections or back into specific locations on the character sheet. It also optimizes spell detail persistence by utilizing the existing cache instead of storing redundant HTML.

## Functional Requirements

### 1. Section Standardization & Optimization
- **Spell Detail Integration:** All `be-spell-detail` sections must now also be marked with the `.be-extracted-section` class.
- **Merge Trigger:** Every `.be-extracted-section` must include an "Append after" button in its header.
- **Spell Persistence Optimization:** The layout JSON will no longer store the HTML content for spell detail sections. Instead, it will only store the `spellName`. During `applyLayout`, the section content must be reconstructed using data from the `spell_cache`.

### 2. Merge Interaction (Modal)
- **Modal Display:** Clicking "Append after" opens a modal listing all valid targets.
- **Target Selection:**
    - **Extractable Groups:** All elements on the character sheet with the `.be-extractable` class.
    - **Floating Sections:** All other `.be-extracted-section` containers.
- **Naming Convention:** Targets in the modal must use hierarchical breadcrumbs (e.g., "Actions > Attacks", "Spell: Fireball") to ensure clarity.

### 3. Execution (The Merge)
- **Sheet Target:** If a sheet group is selected, the source section's content is appended immediately after that group in the DOM.
- **Section Target:** If a floating section is selected, the source section's content is appended to the target's `.print-section-content` child.
- **Cleanup:** The source floating section container is destroyed after its content is moved.
- **State Hiding:** Original elements associated with merged content remain hidden (`display: none !important`).

### 4. Persistence & Rollback
- **Independent Rollback:** Merged relationships must be tracked. If a section containing merged content is "Closed" or rolled back, ALL original elements associated with that section must be restored to visibility.
- **Selector/Cache Nature:** Persistence must use selector-based logic for groups and cache-based logic for spells. The layout JSON must track nesting relationships to ensure correct reconstruction on reload.

## Acceptance Criteria
- [ ] Spell detail sections are correctly identified as extractable sections.
- [ ] "Append after" button is present and functional on all extracted sections.
- [ ] Selecting a target successfully moves content and destroys the source container.
- [ ] Closing a section restores all original elements involved in the merge.
- [ ] Spell detail sections are persisted by name only and reconstructed from cache on load.
- [ ] Merged state is correctly saved and restored from JSON/IndexedDB.
