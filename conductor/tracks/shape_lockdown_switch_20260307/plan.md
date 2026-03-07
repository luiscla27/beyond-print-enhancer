# Implementation Plan: Shapes Mode Lockdown & Quick Switch

## Phase 1: Drag Ghost Fix
- [ ] Task: Write tests to reproduce the 16px drag ghost offset.
- [ ] Task: Debug and fix the coordinate calculation in `js/dnd.js`.
- [ ] Task: Verify ghost alignment at 0 and non-zero rotation angles.
- [ ] Task: Conductor - User Manual Verification 'Drag Ghost Fix' (Protocol in workflow.md)

## Phase 2: Shape Interaction Lockdown
- [ ] Task: Write tests for shape pointer-event toggling.
- [ ] Task: Implement CSS rule for `.be-shape-wrapper` when `body:not(.be-shapes-mode-active)`.
- [ ] Task: Ensure selection and handles are cleaned up when mode is toggled OFF.
- [ ] Task: Conductor - User Manual Verification 'Shape Interaction Lockdown' (Protocol in workflow.md)

## Phase 3: Quick Switch Feature
- [ ] Task: Write tests for asset switching while preserving transforms.
- [ ] Task: Update `showShapePickerModal` to support optional folder/tab filtering.
- [ ] Task: Add '🔄' Switch button to shape action container in `createShape`.
- [ ] Task: Implement the callback to update the shape asset without replacing the wrapper.
- [ ] Task: Conductor - User Manual Verification 'Quick Switch Feature' (Protocol in workflow.md)