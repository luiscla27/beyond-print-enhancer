# Specification: UI Revamp - Section Actions Context Menu

## Overview
Revamp the `.be-section-actions` layout for both sections and shapes to reduce visual clutter. Only primary actions will remain visible by default, while secondary actions will be moved into a new, minimalist "More Options" context menu.

## Functional Requirements
### 1. Primary Visible Actions
*   **Sections:** Only the "Select Section" (`be-select-section-button`) and "Delete Clone" (`be-clone-delete`) buttons MUST remain visible in the main action bar.
*   **Shapes:** Only the "Delete Shape" (`be-shape-delete`) and "Rotate Shape" (`be-shape-rotate`) buttons MUST remain visible.

### 2. Context Menu Trigger
*   A new "More Options" button (e.g., '⋮' or '⋯') MUST be added to both section and shape action bars alongside the primary buttons.
*   Clicking this button will toggle the visibility of the new context menu.
*   **Placement Consistency:** The placement and appearance of the context menu and its trigger button MUST look the same for both shapes and sections.

### 3. Context Menu Contents
*   The context menu MUST contain the following buttons when applicable to the element type:
    *   `be-clone-button`
    *   `be-border-button`
    *   `be-split-skills-button`
    *   `be-compact-button`
    *   `be-shape-switch`
    *   `be-shape-clone`

### 4. UI/UX Design
*   **Styling:** The context menu MUST feature a clean, custom, minimalist floating panel design, distinct from the native D&D Beyond dark dropdowns.

## Out of Scope
*   Adding new functionality to the buttons themselves; this track only covers their relocation and the menu UI.
