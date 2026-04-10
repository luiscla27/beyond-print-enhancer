# Implementation Plan: Layer Content Visualization

## Phase 1: Research & UI Discovery
- [ ] Task: Review `js/dom/layer_manager.js` to identify where to inject the nested lists.
- [ ] Task: Research methods for efficiently scanning layer containers for items (`.be-shape-wrapper` and `.be-section-wrapper`).
- [ ] Task: Conductor - User Manual Verification 'Research & UI Discovery' (Protocol in workflow.md)

## Phase 2: Core Logic Implementation
- [ ] Task: Implement a `refreshLayerContents()` method in `LayerManager` to scan layers.
- [ ] Task: Implement the discovery logic for shapes (extracting thumbnails from `img` src).
- [ ] Task: Implement the discovery logic for sections (extracting titles).
- [ ] Task: Conductor - User Manual Verification 'Core Logic Implementation' (Protocol in workflow.md)

## Phase 3: Nested List UI
- [ ] Task: Update `LayerManager.createPanel()` to include containers for the nested lists.
- [ ] Task: Implement the rendering logic for shape thumbnails in the UI.
- [ ] Task: Implement the rendering logic for section mini-previews (compact cards) in the UI.
- [ ] Task: Add CSS for the nested lists (styling, scrolling if the list is long).
- [ ] Task: Conductor - User Manual Verification 'Nested List UI' (Protocol in workflow.md)

## Phase 4: Dynamic Updates & Integration
- [ ] Task: Integrate `refreshLayerContents()` with extension events (e.g., shape added, section cloned/deleted).
- [ ] Task: Ensure the lists update when the Layer Management panel is opened.
- [ ] Task: Conductor - User Manual Verification 'Dynamic Updates & Integration' (Protocol in workflow.md)

## Phase 5: Final Validation
- [ ] Task: Verify list updates correctly when adding/removing various elements.
- [ ] Task: Verify UI remains compact and performant.
- [ ] Task: Conductor - User Manual Verification 'Final Validation' (Protocol in workflow.md)
