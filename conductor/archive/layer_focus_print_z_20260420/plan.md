# Implementation Plan: Layer List Focus & Print Z-Index

## Phase 1: Focus & Highlight Interaction
Implement the "click to focus" functionality in the layer list.

- [x] Task: Research existing focus logic in `js/dom/layer_manager.js` and `js/main.js`.
- [x] Task: Write Tests: Verify that clicking a layer list item triggers scroll and highlight.
    - [x] Create `test/unit/layer_focus.test.js`.
    - [x] Test that `scrollIntoView` is called for the correct element.
    - [x] Test that the focus highlight class is added and removed.
- [x] Task: Implement `focusElement(id)` in `DomManager` or `LayerManager`.
    - [x] Add `be-focus-highlight` CSS class to `js/main.js` (with `drop-shadow` filter).
    - [x] Implement smooth scrolling to the target element.
    - [x] Implement class toggle logic with a timeout.
- [x] Task: Bind click event in `LayerManager` to the newly implemented focus logic.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Focus & Highlight' (Protocol in workflow.md)

## Phase 2: Print Z-Index Property & Persistence
Add the `printZIndex` property to the section data model and ensure it is saved/loaded.

- [x] Task: Write Tests: Verify `printZIndex` persistence in layout JSON.
    - [x] Create `test/unit/print_z_persistence.test.js`.
    - [x] Test that `printZIndex` is present in the exported JSON.
    - [x] Test that loading a JSON with `printZIndex` restores the value.
- [x] Task: Update the section data model in `js/main.js` to include `printZIndex`.
- [x] Task: Update `saveLayout` and `loadLayout` functions to handle `printZIndex`.
- [x] Task: Ensure new sections are initialized with a default `printZIndex` (based on current layer count).
- [x] Task: Conductor - User Manual Verification 'Phase 2: Data Persistence' (Protocol in workflow.md)

## Phase 3: Layer List Drag-and-Drop UI
Implement drag-and-drop in the `be-layer-content-list` to reorder elements and update their `printZIndex`.

- [x] Task: Research a lightweight drag-and-drop implementation for vanilla JS (or use native Drag and Drop API).
- [x] Task: Write Tests: Verify that reordering the list updates the `printZIndex` of sections.
    - [x] Create `test/unit/layer_list_reorder.test.js`.
    - [x] Simulate drag-and-drop in the UI and check the updated data model.
- [x] Task: Implement Drag-and-Drop in `js/dom/layer_manager.js`.
    - [x] Update UI items to be draggable.
    - [x] Implement drop handling to reorder items in the DOM.
    - [x] Implement a callback to update all sections' `printZIndex` values based on the new order.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Layer List Interactivity' (Protocol in workflow.md)

## Phase 4: Print Style Injection
Apply the `printZIndex` values specifically for the print view using injected CSS.

- [x] Task: Write Tests: Verify `@media print` CSS injection with correct z-index values.
    - [x] Create `test/unit/print_z_styles.test.js`.
    - [x] Verify that a `<style>` tag is generated with `@media print` rules targeting `data-print-z`.
- [x] Task: Implement `updatePrintStyles()` in `js/main.js`.
    - [x] Add `data-print-z` attribute to `.be-section-wrapper` elements whenever `printZIndex` changes.
    - [x] Dynamically generate a `<style>` block for `@media print` that applies `z-index` based on the data attribute.
- [x] Task: Ensure this injected style is updated whenever a reorder occurs or a layout is loaded.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Print Styles' (Protocol in workflow.md)
