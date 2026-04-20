# Specification: Layer Edit Mode (Interaction Toggling)

## Overview
Restore and generalize the ability to toggle "Edit Mode" (interaction locking) for individual layers within the Print Enhancer. Previously, a global "Shapes Mode" allowed users to toggle the editability of shapes, but this was removed during the transition to a layered system. This track aims to add per-layer "Edit" toggles to the Layer Management panel, allowing users to independently lock or unlock interaction for both the Sections and Shapes layers.

## Goals
- Provide granular control over which layers are interactive at any given time.
- Re-implement the visual and functional locking behavior (opacity, dragging, resizing, etc.) for both layers.
- Ensure the UI for these toggles is seamlessly integrated into the existing Layer Management panel.

## Functional Requirements

### 1. Layer Panel Integration
- Add an "Edit/Lock" toggle icon (e.g., a lock/unlock or pen icon) next to the "Visibility" (eye) icon for each layer in the Layer Management panel.
- The toggles should reflect the current "Edit Mode" state of the layer.
- **Default State:** On page load, all layers should start as **Editable** (Edit Mode ON).

### 2. Interaction Locking Logic
- When a layer is "Locked" (Edit Mode OFF):
    - **Visual Feedback:** Apply partial opacity (consistent with the legacy Shapes Mode behavior) to all elements within that layer.
    - **Interaction Suppression:**
        - Disable dragging for all elements in the layer.
        - Disable resizing for all elements in the layer.
        - Hide all interaction handles (resize corners, rotation handles, etc.).
        - Disable double-click actions (e.g., editing section titles).
- When a layer is "Editable" (Edit Mode ON):
    - **Visual Feedback:** Restore full opacity to all elements in the layer.
    - **Interaction Restoration:** Enable all standard interaction features (dragging, resizing, double-click, handles).

### 3. Layer Specifics
- **Sections Layer (`pe-sections-layer`):** Apply the locking logic to all standard character sheet sections.
- **Shapes Layer (`pe-shapes-layer`):** Apply the locking logic to all decorative shapes and borders.

## Non-Functional Requirements
- **Performance:** Toggling edit mode should be instantaneous and not cause significant re-renders or layout shifts.
- **Consistency:** Ensure the visual "fade" and interaction suppression use the same CSS classes or logic for both layers to maintain architectural symmetry.
- **Volatile State:** The edit mode state is NOT persistent and should reset to "Editable" on every page load/extension injection.

## Acceptance Criteria
- [ ] A new toggle icon exists next to the eye icon for both "Sections" and "Shapes" in the Layer Management panel.
- [ ] Clicking the toggle for a layer correctly fades all elements in that layer and prevents any dragging or resizing.
- [ ] Clicking the toggle again restores full visibility and interactivity.
- [ ] Both layers behave identically with respect to the locking logic.
- [ ] Toggles do not interfere with the existing visibility (eye) toggles.

## Out of Scope
- Persistent storage of the "Edit Mode" state.
- Adding more layers beyond Sections and Shapes.
