# Implementation Plan: CSS Hover Refactor

## Phase 1: Hover Logic Removal & CSS Update
- [x] Task: Write tests verifying that `initHoverHighlights` is removed and that CSS `.be-section-wrapper:hover` and `.be-shape-wrapper:hover` rules replace `.be-hover-highlight`.
- [x] Task: Delete `initHoverHighlights` function and any calls to it from `js/main.js`.
- [x] Task: Update the injected CSS in `js/main.js` to replace `.be-hover-highlight` styling with native `:hover` on `.be-section-wrapper` and `.be-shape-wrapper`.
- [x] Task: Ensure any overlapping CSS logic (like `.be-focus-highlight-hover`) remains intact if needed.
- [x] Task: Conductor - User Manual Verification 'Hover Logic Removal & CSS Update' (Protocol in workflow.md)

## Phase 2: Final Polish & Documentation
- [x] Task: Run all mocha tests to ensure no regressions and verify hover behavior visually.
- [x] Task: Update project-wide documentation (GEMINI.md, workflow.md, etc.) and record phase checkpoint.