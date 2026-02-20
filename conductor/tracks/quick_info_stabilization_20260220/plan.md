# Implementation Plan: Quick Info Box Extraction & Stabilization

## Phase 1: Infrastructure & Stabilization
- [ ] Task: Register new selectors for `.ct-quick-info__box` in `DomManager`.
- [ ] Task: Implement global `onresize` suppression in `js/main.js`.
    - [ ] Create a mechanism to block non-extension resize events.
    - [ ] Verify that extension resizing tools still function correctly.
- [ ] Task: Create failing unit tests for event suppression.
- [ ] Task: Conductor - User Manual Verification 'Infrastructure & Stabilization' (Protocol in workflow.md)

## Phase 2: Asset Integration & UI
- [ ] Task: Add `assets/border_box.gif` metadata extraction and CSS constant calculation.
- [ ] Task: Register `box_border` in the border picker modal styles.
- [ ] Task: Update the CSS injection logic to include the `box_border` class.
- [ ] Task: Create failing tests for the new border style injection.
- [ ] Task: Conductor - User Manual Verification 'Asset Integration & UI' (Protocol in workflow.md)

## Phase 3: Extraction & Initial Layout
- [ ] Task: Implement `separateQuickInfoBoxes()` logic in `js/main.js`.
    - [ ] Extract each `.ct-quick-info__box` into a new container.
    - [ ] Apply `box_border` by default.
    - [ ] Remove/hide the original group container.
- [ ] Task: Define horizontal row default coordinates in `DEFAULT_LAYOUTS`.
- [ ] Task: Write TDD tests for quick-info box extraction and positioning.
- [ ] Task: Conductor - User Manual Verification 'Extraction & Initial Layout' (Protocol in workflow.md)

## Phase 4: Final Verification
- [ ] Task: Verify persistence of extracted boxes and their border styles.
- [ ] Task: Run all unit tests to ensure no regressions in existing features (Ability separation, cloning, etc.).
- [ ] Task: Conductor - User Manual Verification 'Final Verification' (Protocol in workflow.md)
