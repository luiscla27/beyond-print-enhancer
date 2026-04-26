# Implementation Plan: Refactor Drag Handles (Declutter)

## Phase 1: DOM Structure & Metadata Cleanup
- [ ] Task: Remove `.print-section-header` and `.print-section-minimize` creation logic from `createDraggableContainer` in `js/main.js`.
- [ ] Task: Implement `data-title` attribute on `.be-section-wrapper` to preserve section names during creation and cloning.
- [ ] Task: Update `js/dom/layer_manager.js` and identification logic in `js/main.js` to read titles from `data-title` instead of the removed header span.
- [ ] Task: Cleanup `getSanitizedContent` and `renderClonedSection` in `js/main.js` to remove references to headers and minimize buttons.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: DOM Structure & Metadata Cleanup' (Protocol in workflow.md)

## Phase 2: Drag-and-Drop Migration
- [ ] Task: Write failing unit tests for `js/dnd.js` to verify wrapper-level dragging and interaction safety (ignoring buttons/inputs).
- [ ] Task: Update `js/dnd.js` to make `.be-section-wrapper` draggable and handle the entire element as the drag source.
- [ ] Task: Implement logic in the `dragstart` handler to block dragging when clicking on `.be-section-actions` or interactive content.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Drag-and-Drop Migration' (Protocol in workflow.md)

## Phase 3: CSS & Layout Refinement
- [ ] Task: Remove all CSS rules for `.print-section-header` and `.print-section-minimize` from the injected styles in `js/main.js`.
- [ ] Task: Add `cursor: grab` and `cursor: grabbing` styles to `.be-section-wrapper` in the injected CSS.
- [ ] Task: Reposition `.be-section-actions` to the top edge of the wrapper (e.g., `top: 8px`) in the injected CSS to replace the header's vertical space.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: CSS & Layout Refinement' (Protocol in workflow.md)
