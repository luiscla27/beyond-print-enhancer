# Track Specification: Layer List Focus & Print Z-Index Management

## Overview
Enhance the layer management UI by adding interactivity to the element list. This includes focusing elements on click (scrolling and highlighting) and introducing a persistent "Print Z-Index" that is separate from the interactive "Edit Mode" z-index. The print z-index will be manageable via drag-and-drop in the layer list and applied specifically to the print view via injected CSS.

## Functional Requirements

### 1. Layer List Interaction (Focus)
- **Click to Focus:** Clicking an element entry in the `be-layer-content-list` will trigger a "focus" sequence:
    - **Existing Logic:** Maintain the current z-index modification logic that brings the element to the front during interaction.
    - **Scrolling:** The viewport will scroll to center the target element.
    - **Highlighting:** A CSS class (e.g., `be-focus-highlight`) will be added to the element, applying a `drop-shadow` filter to make it stand out. The class will be removed after a short duration or upon another interaction.

### 2. Print Z-Index Management
- **Separate Z-Index for Print:** Introduce a `printZIndex` property for all sections (`.be-section-wrapper`).
- **Drag & Drop Reordering:** The `be-layer-content-list` will support drag-and-drop reordering of its items.
    - Reordering items in the list will automatically update the `printZIndex` values of the corresponding elements based on their position in the list.
- **Persistence:**
    - The `printZIndex` value must be saved in the layout JSON object when using the "Save" functionality.
    - The value must be restored when a layout is loaded.

### 3. Print View Application
- **Injected CSS:** Instead of using inline `style="z-index: ..."` for print, the extension will inject a `<style>` block containing `@media print` rules.
- **Implementation Detail:** Each element will have a data attribute (e.g., `data-print-z`) to store its print z-index. The injected CSS will use these attributes to apply the correct `z-index` during printing.
- **Isolation:** This ensures the "Edit Mode" z-index (which is ephemeral and used for UI management) does not interfere with the intended print layout.

## Non-Functional Requirements
- **Performance:** Drag-and-drop reordering should be smooth even with many elements.
- **Compatibility:** Ensure the `@media print` CSS overrides any site-native styles and extension-injected inline styles used for the interactive layout.

## Acceptance Criteria
- [ ] Clicking a layer list item scrolls the element into view and applies a highlight effect.
- [ ] Dragging items in the layer list updates their internal print z-index state.
- [ ] The print z-index is persisted in the exported/saved layout JSON.
- [ ] In Print Preview (Ctrl+P), the z-index of elements reflects the order in the layer list, independent of their current interactive z-index.
- [ ] No `z-index` is added to the inline `style` attribute specifically for print purposes.

## Out of Scope
- Changing the z-index of site-native elements that are not managed by the extension.
- Customizing the highlight effect (color, duration) via the UI.
