# Implementation Plan: CSS Hover Refactor

## Phase 1: Hover Logic Removal & CSS Update
- [ ] Task: Write tests verifying that `initHoverHighlights` is removed and that CSS `.be-section-wrapper:hover` and `.be-shape-wrapper:hover` rules replace `.be-hover-highlight`.
- [ ] Task: Delete `initHoverHighlights` function and any calls to it from `js/main.js`.
- [ ] Task: Update the injected CSS in `js/main.js` to replace `.be-hover-highlight` styling with native `:hover` on `.be-section-wrapper` and `.be-shape-wrapper`.
- [ ] Task: Ensure any overlapping CSS logic (like `.be-focus-highlight-hover`) remains intact if needed.
- [ ] Task: Conductor - User Manual Verification 'Hover Logic Removal & CSS Update' (Protocol in workflow.md)

## Phase 2: Final Polish & Documentation
- [ ] Task: Run all mocha tests to ensure no regressions and verify hover behavior visually.
- [ ] Task: Update project-wide documentation (GEMINI.md, workflow.md, etc.) and record phase checkpoint.