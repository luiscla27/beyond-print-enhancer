# Implementation Plan: Shape Layer Management

## Phase 1: Data Model & Persistence
- [ ] Task: Update JSON Schema and Data Models
    - [ ] Update `SCHEMA_VERSION` in `js/main.js` to reflect the new structure supporting multiple Shape layers.
    - [ ] Define the data structure for Shape layers (e.g., `id`, `name`, `isVisible`, `isLocked`, `elements[]`).
    - [ ] Update serialization/deserialization logic in `js/main.js` (or related storage file) to handle the new layer array format.
    - [ ] Ensure backward compatibility: automatically map the old single-layer shapes array into a single \"Default Shapes Layer\" during import/load.
- [ ] Task: Write Tests for Data Model & Persistence
    - [ ] Create/update unit tests for serialization, ensuring multi-layer structure is preserved.
    - [ ] Create/update unit tests for backward compatibility logic.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Data Model & Persistence' (Protocol in workflow.md)

## Phase 2: DOM Layer Management
- [ ] Task: Multi-Layer DOM Containers
    - [ ] Modify `js/dom/layer_manager.js` (or equivalent) to support generating and managing multiple `<div class=\"be-shape-layer\">` containers.
    - [ ] Implement logic to automatically create a new layer container when a layer's element count exceeds 100.
    - [ ] Ensure the existing \"Sections\" layer code remains completely untouched.
- [ ] Task: Write Tests for DOM Layer Management
    - [ ] Create unit tests to verify correct `DIV` creation and the 100-element limit enforcement.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: DOM Layer Management' (Protocol in workflow.md)

## Phase 3: Layer Panel UI
- [ ] Task: Layer Panel UI Updates
    - [ ] Update the Layer Panel UI (ensure new elements use `print-enhance-` IDs and `be-` classes to bypass \"Deep Clean\").
    - [ ] Add the \"Add new Layer\" button specifically for the Shapes section.
    - [ ] Render a list of Shape layers as draggable panels.
    - [ ] Wire up \"Print Visible\", \"Eye\" (Visibility), and \"Lock\" buttons to act on the corresponding layer's DOM `DIV` container.
- [ ] Task: Write Tests for Layer Panel UI
    - [ ] Create unit tests for UI rendering, button interactions, and state toggling on layer containers.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Layer Panel UI' (Protocol in workflow.md)

## Phase 4: Z-Index & Drag-and-Drop
- [ ] Task: Z-Index Calculation & Drag-and-Drop
    - [ ] Implement logic to update `zPrint` values based on layer order (Layer N base Z-index = N * 100).
    - [ ] Update drag-and-drop logic for Shape layers to reorder them in the DOM and trigger a Z-index recalculation.
    - [ ] Enable dragging of individual shape elements between different Shape layer panels, strictly reusing existing drag-and-drop code.
- [ ] Task: Write Tests for Z-Index & Drag-and-Drop
    - [ ] Create unit tests for Z-index calculation based on layer order.
    - [ ] Create unit tests for intra-layer and inter-layer drag-and-drop state updates.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Z-Index & Drag-and-Drop' (Protocol in workflow.md)