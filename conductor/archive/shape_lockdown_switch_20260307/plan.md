# Implementation Plan: Shapes Mode Lockdown & Quick Switch

## Phase 1: Drag Ghost Fix
- [x] Task: Write tests to reproduce the 16px drag ghost offset.
- [x] Task: Debug and fix the coordinate calculation in `js/dnd.js`.
- [x] Task: Verify ghost alignment at 0 and non-zero rotation angles.
- [x] Task: Conductor - User Manual Verification 'Drag Ghost Fix' (Protocol in workflow.md)

## Phase 2: Shape Interaction Lockdown
- [x] Task: Write tests for shape pointer-event toggling.
- [x] Task: Implement CSS rule for `.be-shape-wrapper` when `body:not(.be-shapes-mode-active)`.
- [x] Task: Ensure selection and handles are cleaned up when mode is toggled OFF.
- [x] Task: Conductor - User Manual Verification 'Shape Interaction Lockdown' (Protocol in workflow.md)

## Phase 3: Quick Switch Feature
- [x] Task: Write tests for asset switching while preserving transforms.
- [x] Task: Update `showShapePickerModal` to support optional folder/tab filtering.
- [x] Task: Add '🔄' Switch button to shape action container in `createShape`.
- [x] Task: Implement the callback to update the shape asset without replacing the wrapper.
- [x] Task: Conductor - User Manual Verification 'Quick Switch Feature' (Protocol in workflow.md) aa76d2f