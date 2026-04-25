# Specification: Layer Management Improvements and Edit Mode Enhancements

## Overview
This track introduces improvements to the layer management system by allowing users to easily delete entire layers and specific shapes via a context menu. It also refines "Edit Mode" to focus on a single active layer at a time, applying hover highlights to elements within that active layer.

## Functional Requirements

### 1. Layer Deletion
- Add an "Inline Action" button next to the visibility and lock toggles on each layer's header in the Layer Manager.
- Clicking this button must prompt the user for confirmation to prevent accidental data loss.
- Confirming the deletion must remove the layer and all its contained shapes from the DOM and state.

### 2. Shape Context Menu
- Implement a context menu for shape items within the Layer Manager list.
- Trigger the context menu by right-clicking a shape item.
- The context menu must include an option to "Delete" the shape directly from the list.

### 3. Edit Mode Enhancements & Hover Highlights
- Modify "Edit Mode" to enforce that only **one layer** can be actively edited at a time.
- When hovering over elements (specifically `be-section-wrapper` elements) belonging to the currently active layer, apply the `be-focus-highlight` CSS class.
- Elements not in the active layer should not receive this highlight.

### 4. Shape Addition Constraints
- The "Add Shape" button must be disabled if no layer is currently active (unlocked).
- When adding a new shape, it must be automatically added to the currently active layer's DOM container.
- New shapes must also be correctly registered in the `LayerManager`'s tracking of that layer's content.

## Non-Functional Requirements
- Ensure no native right-click context menu appears when right-clicking the shape items in the Layer Manager.
- All new UI elements must follow the `be-` class prefix and `print-enhance-` ID prefix guidelines to avoid deep clean hiding.

## Acceptance Criteria
- [ ] Users can click a delete button on a layer header, confirm, and see the layer removed.
- [ ] Users can right-click a shape in the layer manager and delete it via a custom context menu.
- [ ] Activating Edit Mode limits editing to one layer at a time.
- [ ] Hovering over a `be-section-wrapper` in the active layer highlights it; hovering over elements in inactive layers does not.