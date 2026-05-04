# Implementation Plan: Properties Panel

## Phase 1: Foundation (Active State & UI Shell)
- [ ] Task: Implement Active Section State
    - [ ] Write Tests: Ensure marking a section as active updates its state/classes and deselects others.
    - [ ] Implement: Add click handler or button to section to trigger 'active' state, applying visual highlight (e.g., `be-active-section` class).
- [ ] Task: Create Properties Panel Shell
    - [ ] Write Tests: Ensure the panel container is rendered above the hue sliders in the global control panel.
    - [ ] Implement: Inject the panel UI container (`#print-enhance-properties-panel`). Ensure it is excluded from Deep Clean.
- [ ] Task: Implement Empty State
    - [ ] Write Tests: Ensure the panel shows the empty state message/disables controls when no section is active.
    - [ ] Implement: Logic to listen for active section changes and toggle the panel's empty/active view.
- [ ] Task: Conductor - User Manual Verification 'Foundation (Active State & UI Shell)' (Protocol in workflow.md)

## Phase 2: Font Size Integration
- [ ] Task: Integrate Font Size Slider
    - [ ] Write Tests: Ensure the panel includes a slider that syncs with the active section's font size.
    - [ ] Implement: Add the range slider to the panel. Add an input event listener to apply the font size to the active section's wrapper (`.be-section-wrapper`).
    - [ ] Implement: Sync the slider's value when a new section is made active.
- [ ] Task: Conductor - User Manual Verification 'Font Size Integration' (Protocol in workflow.md)

## Phase 3: Compact Mode Integration
- [ ] Task: Integrate Compact Mode Toggle
    - [ ] Write Tests: Ensure the panel includes a toggle that reflects and updates the active section's compact mode.
    - [ ] Implement: Add a checkbox/switch. Bind the change event to toggle the `be-compact-mode` class on the active section.
    - [ ] Implement: Sync the toggle state when a new section is made active.
- [ ] Task: Conductor - User Manual Verification 'Compact Mode Integration' (Protocol in workflow.md)

## Phase 4: Border Style Integration
- [ ] Task: Integrate Border Selector Button
    - [ ] Write Tests: Ensure the panel has a button showing the current border thumbnail that triggers the border modal.
    - [ ] Implement: Add a button to the panel. Calculate the thumbnail based on the active section's current border class.
    - [ ] Implement: Bind the click event to open `showBorderPickerModal()`. Upon selection, update the section and the panel's thumbnail.
    - [ ] Implement: Sync the thumbnail when a new section is made active.
- [ ] Task: Conductor - User Manual Verification 'Border Style Integration' (Protocol in workflow.md)
