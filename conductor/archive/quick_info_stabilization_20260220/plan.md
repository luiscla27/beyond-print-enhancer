# Implementation Plan: Quick Info Box Extraction & Stabilization

## Phase 1: Infrastructure & Stabilization
- [x] Task: Register new selectors for `.ct-quick-info__box` in `DomManager`.
- [x] Task: Implement global `onresize` suppression in `js/main.js`.
- [x] Task: Create unit tests for event suppression.
- [x] Task: Conductor - User Manual Verification 'Infrastructure & Stabilization' (Protocol in workflow.md)

## Phase 2: Asset Integration & UI
- [x] Task: Add `assets/border_box.gif` metadata extraction and CSS constant calculation.
- [x] Task: Register `box_border` in the border picker modal styles.
- [x] Task: Update the CSS injection logic to include the `box_border` class.
- [x] Task: Create failing tests for the new border style injection.
- [x] Task: Conductor - User Manual Verification 'Asset Integration & UI' (Protocol in workflow.md)

## Phase 3: Extraction & Initial Layout
- [x] Task: Implement `separateQuickInfoBoxes()` logic in `js/main.js`.
- [x] Task: Define horizontal row default coordinates in `DEFAULT_LAYOUTS`.
- [x] Task: Write TDD tests for quick-info box extraction and positioning.
- [x] Task: Conductor - User Manual Verification 'Extraction & Initial Layout' (Protocol in workflow.md)

## Phase 4: Final Verification
- [x] Task: Verify persistence of extracted boxes and their border styles.
- [x] Task: Run all unit tests to ensure no regressions in existing features (Ability separation, cloning, etc.).
- [x] Task: Conductor - User Manual Verification 'Final Verification' (Protocol in workflow.md)
