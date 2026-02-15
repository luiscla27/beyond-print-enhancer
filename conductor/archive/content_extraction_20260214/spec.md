# Specification: Dynamic Content Extraction Trigger

## Overview
This feature introduces a standardized way to dynamically extract logical groups of content (like specific action lists, snippets, or trait blocks) from the D&D Beyond character sheet into floating, draggable sections. It provides a visual "extraction mode" where users can identify and relocate content via hover and double-click.

## Functional Requirements

### 1. Extraction Trigger (Hover & Visual Feedback)
- **Activation Flag:** A specific CSS class (e.g., `.be-extractable`) will be used to identify elements that can be extracted.
- **Hover Behavior:** 
    - When an element with the activation flag is hovered, it must be outlined with a 2px black dashed line.
    - A tooltip must appear at the top-left corner of the element using a `:before` pseudo-element.
    - **Tooltip Content:** "Extract content with double click" (White text on black background, minimalist design).
- **Target Selectors (Default):** The following selectors will receive the activation flag by default:
    - `[class$="-group"]`
    - `[class$="-snippet--class"]`
    - `[class^="styles_actionsList__"]`
    - `[class^="styles_attackTable__"]`
    - `[class$="__traits"]`
- **Nesting Logic:** Top-Down Priority. If a parent element matches the extraction criteria, its children are ignored for individual extraction to prevent UI clutter.

### 2. Extraction Action (Double-Click)
- **Workflow:** On double-click of an extractable element:
    1. **Section Creation:** A new draggable container is created and placed adjacent to the extraction point (or at click coordinates).
    2. **Content Cloning:** A clone of the targeted HTML element is appended to the new section's content area.
    3. **Title Discovery:** The extension searches for a title within the cloned content using selectors `h1`, `h2`, `h3`, `h4`, `h5`, and `[class*="head"]`.
    4. **Fallback Title:** If no title is found, the user is prompted to enter one manually.
    5. **Standard Header:** The section content area must include a prepended standardized D&D Beyond header (`ct-content-group__header` > `ct-content-group__header-content`).
    6. **Hiding Original:** The original outlined element is set to `display: none` and tracked with a unique ID linked to the new section.

### 3. Rollback (Closure)
- **Action:** When the dynamically created section is "Closed" (via its header 'X' button):
    - The floating section is removed from the DOM.
    - The original hidden element (tracked by ID) is restored to `display: block` (or its original display value).
    - **Note:** Any edits made to the content while inside the floating section are discarded.

### 4. Persistence & Integration
- **State Management:** Extractions must be tracked in the layout schema.
- **Save/Load:** Extracted states (which original IDs are hidden and where their clones are positioned) must be saved to IndexedDB and exported/imported via JSON.
- **Load Default:** In `handleLoadDefault`, all extractions are rolled back (original elements shown, floating sections removed).

## Non-Functional Requirements
- **Performance:** Hover/Outline logic must be efficient to avoid lag during sheet scrolling.
- **Style Consistency:** Tooltips and outlines must adhere to the project's High Contrast Black & White visual identity.

## Acceptance Criteria
- [ ] Hovering a matching group shows a dashed outline and tooltip.
- [ ] Nested matching groups do NOT show triggers if their parent is already extractable.
- [ ] Double-clicking creates a new floating section containing the group's content.
- [ ] The original content is hidden immediately upon extraction.
- [ ] Closing the section restores the original content to its place.
- [ ] Extracted sections persist across page reloads and JSON export/import.
