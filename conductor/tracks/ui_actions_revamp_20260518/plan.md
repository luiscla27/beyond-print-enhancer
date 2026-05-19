# Implementation Plan: UI Revamp - Section Actions Context Menu

## Phase 1: Context Menu Core UI & CSS
- [x] Task: Write tests for Context Menu DOM generation and basic interactivity (toggle visibility).
- [x] Task: Implement the shared context menu DOM generation logic and the 'More Options' trigger button.
- [x] Task: Implement the custom, minimalist CSS for the floating menu panel, ensuring it matches requirements.
- [x] Task: Conductor - User Manual Verification 'Context Menu Core UI & CSS' (Protocol in workflow.md) (SHA: 3d99ac9)

## Phase 2: Section Actions Refactor
- [x] Task: Write tests verifying that sections only display `be-select-section-button` and `be-clone-delete` natively, with others inside the menu.
- [x] Task: Refactor section UI injection logic to append `be-clone-button`, `be-border-button`, `be-split-skills-button`, and `be-compact-button` to the new context menu.
- [ ] Task: Conductor - User Manual Verification 'Section Actions Refactor' (Protocol in workflow.md)

## Phase 3: Shape Actions Refactor & Consistency
- [x] Task: Write tests verifying that shapes only display `be-shape-delete` and `be-shape-rotate` natively, with others inside the menu.
- [x] Task: Refactor shape UI injection logic to append `be-shape-switch` and `be-shape-clone` to the new context menu.
- [x] Task: Ensure placement and styling of the context menu button for shapes is completely consistent with sections.
- [x] Task: Refactor createShape to use unified injectCloneButtons logic.
- [ ] Task: Conductor - User Manual Verification 'Shape Actions Refactor & Consistency' (Protocol in workflow.md)

## Phase 4: Final Polish & Documentation
- [x] Task: Perform a full pass to verify edge cases (e.g., menu closing when clicking outside).
- [x] Task: Update project-wide documentation (GEMINI.md, workflow.md, etc.) and record phase checkpoint.
- [x] Task: Fix be-compact-mode class name and nested container processing.
