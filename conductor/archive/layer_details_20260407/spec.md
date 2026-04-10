# Track Specification: Layer Content Visualization

## 1. Overview
Enhance the Layer Management panel by adding "nested lists" under each layer (Shapes Mode and Sections). These lists will provide visual feedback to the user about which elements are currently contained within that layer.

## 2. Functional Requirements
- **Nested Content Lists:**
    - Under the "Shapes Mode" entry in the management panel, display a list of all decorative shapes currently in the `#print-enhance-shapes-layer`.
    - Under the "Sections" entry, display a list of all enhanced sections currently in the `#print-enhance-sections-layer`.
- **Visualization:**
    - **Shapes:** Each item in the list must show a small thumbnail of the shape's asset.
    - **Sections:** Each item in the list must show a "mini preview" (e.g., a compact card displaying the section's title).
- **Dynamic Updates:**
    - The lists must refresh when elements are added or removed (e.g., when a shape is placed or a section is cloned/deleted).
- **Read-Only:**
    - These sub-panels are for visualization only; individual item visibility toggling is out of scope.

## 3. Non-Functional Requirements
- **Compactness:** The sub-panels must be small enough to not clutter the main panel.
- **Performance:** Scanning layers for items should be efficient.

## 4. Acceptance Criteria
- [ ] The Layer Management panel shows a list of shapes under "Shapes Mode".
- [ ] The Layer Management panel shows a list of sections under "Sections".
- [ ] Shapes are represented by thumbnails.
- [ ] Sections are represented by mini preview labels.
- [ ] Adding/removing elements updates the lists correctly.
