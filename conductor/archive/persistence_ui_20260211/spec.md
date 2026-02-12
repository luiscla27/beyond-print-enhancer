# Specification: Persistence and Layout Management UI

## Overview
This track introduces a persistent layout management system for the D&D Beyond Print Enhancer. It adds a set of UI controls allowing users to save their custom arrangements (coordinates, sizes, and internal widths) both locally in the browser and as external files, and to restore defaults or contribute to the project.

## Functional Requirements

### 1. Control Panel UI
- **Positioning:** A fixed vertical column in the top-left corner of the viewport.
- **Controls:**
    - **Save on Browser:** Saves the current layout to IndexedDB.
    - **Save on PC:** Downloads the layout as a `.json` file.
    - **Load Default:** Resets all sections to their hardcoded default positions and sizes.
    - **Load:** Opens a file picker to import a previously saved JSON layout.
    - **Contribute:** Opens the project's GitHub repository.
- **Visuals:**
    - **Hidden on Print:** The entire control panel must not appear in print media.
    - **Interactions:** Semi-transparent (e.g., `opacity: 0.3`) when idle, becoming fully opaque on hover.
    - **Aesthetics:** Modern, "cool" design (e.g., dark theme, subtle shadows, rounded corners).
    - **Feedback:** Temporary success notifications/indicators upon successful save or load operations.

### 2. Data Persistence (JSON Schema)
The saved JSON must include:
- **Version:** The current extension version (for future migration/compatibility).
- **Sections:** An array/object mapping section IDs to:
    - `left`, `top`, `width`, `height`.
    - `innerWidths`: A map of widths for immediate `div` children within containers ending in `-row-header` or `-content`.
- **Character Context:** Layouts should be stored globally by default, but the system should track the "last used" layout for specific characters to allow switching.

### 3. Logic & Integration
- **Auto-Load:** On page visit, the extension should check IndexedDB and automatically apply the saved global layout (or character-specific last layout if applicable).
- **Save on Browser (IndexedDB):** Use IndexedDB for robust local storage.
- **Save on PC (Fallback):** If the browser blocks direct download, display a floating modal with a dark overlay containing a `textarea` with the JSON content for manual copying.
- **Load Default:** Must trigger the existing `defaultLayouts` logic and clear any active overrides in the current session.

## Non-Functional Requirements
- **Performance:** Layout application should be efficient to minimize "layout shift" after the page loads.
- **Robustness:** Invalid or outdated JSON files should be handled gracefully without breaking the UI.

## Acceptance Criteria
- [ ] Control panel is visible in the top-left and follows hover/transparency rules.
- [ ] Buttons are hidden during print preview/printing.
- [ ] Layout (including inner widths) is correctly saved to IndexedDB and restored on page refresh.
- [ ] Layout can be downloaded as a JSON file and successfully re-imported via the "Load" button.
- [ ] "Load Default" successfully reverts the sheet to the initial state.
- [ ] "Contribute" button opens the correct GitHub URL.
- [ ] JSON contains a version attribute.

## Out of Scope
- Server-side syncing of layouts.
- Advanced layout editing tools (e.g., alignment grids, multi-select).
