# Implementation Plan: Layer List Focus & Print Z-Index

## Phase 1: Focus & Highlight Interaction
Implement the "click to focus" functionality in the layer list.

- [ ] Task: Research existing focus logic in `js/dom/layer_manager.js` and `js/main.js`.
- [ ] Task: Write Tests: Verify that clicking a layer list item triggers scroll and highlight.
    - [ ] Create `test/unit/layer_focus.test.js`.
    - [ ] Test that `scrollIntoView` is called for the correct element.
    - [ ] Test that the focus highlight class is added and removed.
- [ ] Task: Implement `focusElement(id)` in `DomManager` or `LayerManager`.
    - [ ] Add `be-focus-highlight` CSS class to `js/main.js` (with `drop-shadow` filter).
    - [ ] Implement smooth scrolling to the target element.
    - [ ] Implement class toggle logic with a timeout.
- [ ] Task: Bind click event in `LayerManager` to the newly implemented focus logic.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Focus & Highlight' (Protocol in workflow.md)

## Phase 2: Print Z-Index Property & Persistence
Add the `printZIndex` property to the section data model and ensure it is saved/loaded.

- [ ] Task: Write Tests: Verify `printZIndex` persistence in layout JSON.
    - [ ] Update `test/unit/cloning_persistence.test.js` or create `test/unit/print_z_persistence.test.js`.
    - [ ] Test that `printZIndex` is present in the exported JSON.
    - [ ] Test that loading a JSON with `printZIndex` restores the value.
- [ ] Task: Update the section data model in `js/main.js` to include `printZIndex`.
- [ ] Task: Update `saveLayout` and `loadLayout` functions to handle `printZIndex`.
- [ ] Task: Ensure new sections are initialized with a default `printZIndex` (based on current layer count).
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Data Persistence' (Protocol in workflow.md)

## Phase 3: Layer List Drag-and-Drop UI
Implement drag-and-drop in the `be-layer-content-list` to reorder elements and update their `printZIndex`.

- [ ] Task: Research a lightweight drag-and-drop implementation for vanilla JS (or use native Drag and Drop API).
- [ ] Task: Write Tests: Verify that reordering the list updates the `printZIndex` of sections.
    - [ ] Create `test/unit/layer_list_reorder.test.js`.
    - [ ] Simulate drag-and-drop in the UI and check the updated data model.
- [ ] Task: Implement Drag-and-Drop in `js/dom/layer_manager.js`.
    - [ ] Update UI items to be draggable.
    - [ ] Implement drop handling to reorder items in the DOM.
    - [ ] Implement a callback to update all sections' `printZIndex` values based on the new order.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Layer List Interactivity' (Protocol in workflow.md)

## Phase 4: Print Style Injection
Apply the `printZIndex` values specifically for the print view using injected CSS.

- [ ] Task: Write Tests: Verify `@media print` CSS injection with correct z-index values.
    - [ ] Create `test/unit/print_z_styles.test.js`.
    - [ ] Verify that a `<style>` tag is generated with `@media print` rules targeting `data-print-z`.
- [ ] Task: Implement `updatePrintStyles()` in `js/main.js`.
    - [ ] Add `data-print-z` attribute to `.be-section-wrapper` elements whenever `printZIndex` changes.
    - [ ] Dynamically generate a `<style>` block for `@media print` that applies `z-index` based on the data attribute.
- [ ] Task: Ensure this injected style is updated whenever a reorder occurs or a layout is loaded.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Print Styles' (Protocol in workflow.md)
