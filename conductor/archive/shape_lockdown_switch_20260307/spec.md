# Specification: Shapes Mode Lockdown & Quick Switch

## Overview
This track aims to improve the "Shapes Mode" usability and fix a persistent dragging bug. The primary goals are:
1. Preventing accidental shape selection/movement when not in Shapes Mode by locking pointer events.
2. Providing a way to quickly swap a shape's asset while preserving its transform (rotation, size, position).
3. Fixing a 16px vertical offset in the custom drag ghost implementation.

## Functional Requirements

### 1. Shape Interaction Lockdown
- When "Shapes Mode" is **OFF**, all decorative shapes (`.be-shape-wrapper`) must have `pointer-events: none` applied.
- When "Shapes Mode" is **ON**, pointer events must be restored to allow selection, dragging, and rotation.
- This ensures that users working on character sheet sections (which may overlap with shapes) do not accidentally click or drag a shape.

### 2. "Switch Shape" Feature
- Add a new "Switch" button (icon: 🔄) to the `be-section-actions` container within the shape wrapper.
- When clicked, this button opens the `showShapePickerModal`.
- The modal should be pre-filtered to show only assets from the same category (Borders if the current asset is a border, Shapes if it is a standalone shape).
- Selecting a new asset should update the shape while **preserving** its current coordinates (`top`, `left`), size (`width`, `height`), and `rotation`.

### 3. Drag Ghost Fix
- Identify and correct the cause of the ~16px vertical offset in the `be-drag-ghost`.
- Ensure the ghost image aligns perfectly with the source element's position during the drag operation.
- The drop position must match the visual feedback provided by the ghost.

## Non-Functional Requirements
- Transitions between locked and unlocked states should be immediate.
- Modal filtering should be performant and reflect the current asset's folder path.

## Acceptance Criteria
- [ ] Shapes are completely unclickable when Shapes Mode is disabled.
- [ ] A 'Switch' button appears on shapes in the actions container.
- [ ] Switching a shape's asset preserves its rotation and dimensions.
- [ ] The drag ghost image no longer appears shifted 16px down from the pointer/source.
- [ ] Drag-and-drop landing position is accurate to the visual ghost.

## Out of Scope
- Adding new asset categories.
- Changing the layout extraction format.