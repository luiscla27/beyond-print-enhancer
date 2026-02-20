# Specification: Section Border Style Selection

## Overview
Add a new action button to the section actions bar (`be-section-actions`) that opens a modal for choosing between different border styles. This allows users to customize the visual appearance of individual sections or groups of similar sections on their printed character sheet.

## Functional Requirements
- **Action Button:** Add a "Border Style" button (suggested icon: 🖼️) to the `be-section-actions` container in each section.
- **Selection Modal:**
    - Display a title: "Select Section Border".
    - Provide three options: `Default`, `Ability`, and `Spikes`.
    - **Visual Preview:** Show a small frame previewing the border image and slice for each option.
    - **Selection Logic:** Highlight the currently selected style.
    - **Scope Toggle:** Include a checkbox or toggle "Apply to all sections of this type" (e.g., if triggered on a "Spells" section, it can apply to all cloned/original spell sections).
- **Styling Application:**
    - Update the `print-section-container` class list or CSS variables to reflect the choice (`default-border`, `ability_border`, or `spikes_border`).
    - Ensure the CSS for these borders (already partially present in base styles) is fully functional.
- **Persistence:**
    - Save the selected border style per section (or section type) in the character's layout data within IndexedDB.
    - Restore the selected border style when the character sheet is loaded or a section is re-rendered.

## Technical Considerations
- Use the existing `showInputModal` pattern as a base for a more specialized `showBorderPickerModal`.
- Update `captureSectionSnapshot` and `renderClonedSection` to include border style metadata.
- Modify `Storage` logic to accommodate the new `borderStyle` property in the layout schema.

## Acceptance Criteria
- [ ] A new button appears on all sections in the print layout.
- [ ] Clicking the button opens a modal with previews of the three border styles.
- [ ] Selecting a style and clicking OK immediately updates the section's border.
- [ ] Checking "Apply to all sections of this type" updates all sections sharing the same original source ID.
- [ ] Border selections persist after a page reload.
- [ ] Canceling the modal makes no changes.
