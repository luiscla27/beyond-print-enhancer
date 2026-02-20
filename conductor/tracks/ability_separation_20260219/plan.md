# Implementation Plan: Individual Ability Score Sections

## Phase 1: Logic and DOM Manipulation
- [ ] Task: Identify and wrap individual ability score elements.
    - [ ] Create a selector for `.ct-quick-info__ability` elements.
    - [ ] Logic to iterate through these elements and wrap each in a draggable container.
- [ ] Task: Implement "Ability" border style default.
    - [ ] Ensure new sections are initialized with the `ability_border` class.
    - [ ] Verify the `borderStyle` attribute is set correctly for persistence.
- [ ] Task: Automated initial arrangement.
    - [ ] Calculate horizontal row coordinates for the 6 new sections.
    - [ ] Apply these coordinates during the extraction process if no saved layout exists.
- [ ] Task: Conductor - User Manual Verification 'Logic and DOM Manipulation' (Protocol in workflow.md)

## Phase 2: Testing and Integration
- [ ] Task: Write TDD tests for ability score extraction.
    - [ ] Test that 6 individual sections are created.
    - [ ] Test that the original container is empty/removed.
    - [ ] Test that the default border is applied.
- [ ] Task: Implement the extraction trigger in `main.js`.
    - [ ] Inject the logic into the character sheet initialization flow.
    - [ ] Ensure it runs before the initial layout scan.
- [ ] Task: Verify persistence compatibility.
    - [ ] Test saving and loading a layout with the separated ability scores.
    - [ ] Verify border style changes persist correctly.
- [ ] Task: Conductor - User Manual Verification 'Testing and Integration' (Protocol in workflow.md)

## Phase 3: Final Polishing
- [ ] Task: Refine "Horizontal Row" default positioning.
    - [ ] Adjust coordinates to ensure they don't overlap with other default sections (like Quick-Info).
- [ ] Task: Code cleanup and documentation.
    - [ ] Document the new extraction logic in `main.js`.
- [ ] Task: Conductor - User Manual Verification 'Final Polishing' (Protocol in workflow.md)
