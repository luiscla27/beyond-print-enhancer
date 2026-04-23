# Specification: Shape Layer Management

## Overview
The application currently uses two hardcoded physical layers:
1.  **Sections Layer:** Contains elements extracted from the existing D&D Beyond DOM. This layer requires special handling and is considered fragile.
2.  **Shapes Layer:** Contains user-added decorative elements (assets).

This track introduces a new layer management system **exclusively for the Shapes Layer**. The system will support creating multiple Shape layers, each backed by a distinct `DIV` container in the DOM, allowing users to easily manage visibility and lock states for groups of shapes. To facilitate predictable `z-index` management for printing, each Shape layer is restricted to a maximum of 100 elements.

## Out of Scope
-   **Sections Layer Modifications:** Any analysis, refactoring, or modification of the "Sections" layer code, DOM structure, or extraction logic is strictly out of scope. The Sections layer must remain exactly as it is (a single, hardcoded layer).

## Functional Requirements
1.  **Shape Layer DOM Structure:**
    -   The system will introduce support for multiple Shape layers, each backed by a distinct `DIV` container appended within the overall shapes container.
    -   Initially, all existing shapes will be mapped into a single default Shape layer.
2.  **Element Limit & Z-Index Management:**
    -   A strict limit of 100 shape elements per layer is enforced.
    -   The layer order determines the `zPrint` CSS value. The base Z-index for a Shape layer will increment by 100 based on its order (e.g., Layer 1: 0-99, Layer 2: 100-199).
    -   If a user drags the 101st shape into a layer, the system will automatically create a new Shape layer to accommodate the overflow.
3.  **Layer Panel UI & Interaction:**
    -   A global \"Add new Layer\" button will be added to the layer panel management UI (specifically under the Shapes section).
    -   Shape layers will be represented as draggable panels, allowing users to reorder them to adjust Z-indexes.
    -   Shape elements within layers will be draggable, allowing movement between different Shape layer panels. **Implementation must reuse existing drag-and-drop code to prevent duplication.**
4.  **Layer Controls:**
    -   Each Shape layer panel will feature dedicated \"Print Visible\", \"Eye\" (Visibility), and \"Lock\" buttons.
    -   These controls act on the layer as a whole (by toggling classes/attributes on the layer's `DIV` container), not per individual element.
5.  **Persistence:**
    -   The Shape layer structure, including custom layer names, ordering, and element assignments, will be serialized and saved as part of the existing layout JSON.
    -   This ensures the layer configuration is persisted to IndexedDB and can be exported/imported via disk.

## Acceptance Criteria
-   [ ] The existing \"Sections\" layer code and DOM structure remain entirely unmodified.
-   [ ] Multiple Shape layers are supported, each rendered as a separate `DIV` in the DOM.
-   [ ] Users can create new Shape layers via the \"Add new Layer\" button.
-   [ ] Shape layers can be dragged to reorder them, updating their DOM order and internal `zPrint` logic.
-   [ ] Shape elements can be dragged between different Shape layer panels using existing drag-and-drop logic.
-   [ ] A Shape layer cannot contain more than 100 elements; overflow auto-creates a new layer.
-   [ ] \"Print Visible\", \"Eye\", and \"Lock\" toggles work at the Shape layer level, applying to the layer's `DIV\" container.
-   [ ] The multi-layer Shape configuration is successfully saved and loaded via the existing JSON export/import mechanisms.