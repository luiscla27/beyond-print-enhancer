# Specification: Refactor Drag Handles (Declutter)

## Overview
This track aims to declutter the user interface by removing the explicit `print-section-header` and the `print-section-minimize` (X) button. Drag functionality will be moved directly to the parent `be-section-wrapper` elements, while ensuring that existing section actions (clone, delete, compact, etc.) remain functional and visible.

## Functional Requirements
1.  **Remove Headers:** The `print-section-header` elements must be removed from the DOM structure of both content sections and decorative shapes.
2.  **Remove Minimize Button:** The `print-section-minimize` (X) button must be removed as it is no longer needed.
3.  **Wrapper Dragging:** The `be-section-wrapper` element itself must become the drag target (`draggable="true"`).
4.  **Interaction Safety:** Initiating a drag by clicking on the wrapper background must be supported. However, clicks on interactive child elements within the section (such as buttons, inputs, links, or text selection areas) and the `.be-section-actions` container must not trigger a drag event.
5.  **Title Preservation:** Since the header span is removed, section titles must be preserved using a `data-title` attribute on the wrapper to allow identification in the Layer Manager.

## Visual Feedback
1.  **Cursor Update:** The mouse cursor must change to a `move` or `grab` icon when hovering over the non-interactive background areas of a `be-section-wrapper`.
2.  **Actions Repositioning:** The `.be-section-actions` bar must be repositioned to the top edge of the section to occupy the space vacated by the header.

## Acceptance Criteria
- [ ] `print-section-header` is removed from the DOM.
- [ ] `print-section-minimize` (X) is removed from the DOM.
- [ ] Sections and shapes are draggable by clicking on their background/wrapper.
- [ ] Interactive elements (buttons, inputs) inside sections remain functional and do not trigger drags.
- [ ] **Crucial:** All buttons and actions inside `.be-section-actions` (Clone, Delete, Compact, etc.) are kept and remain functional.
- [ ] Section titles are correctly displayed in the Layer Manager.

## Out of Scope
- Modifying the underlying coordinate/snapping logic.
- Adding new section actions.
