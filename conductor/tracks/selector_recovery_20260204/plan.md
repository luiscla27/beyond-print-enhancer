# Implementation Plan - Selector Recovery & Resilience

## Phase 1: Diagnostic & Utility Update [checkpoint: 8f30362]
- [x] Task: Enhanced Query Utilities bc48416
    - [ ] Update `js/main.js` with `findByText(text, selector)` and `findByClassPattern(pattern)` helpers.
    - [ ] Refactor `safeQuery` to accept an array of potential selectors.
- [ ] Task: Conductor - User Manual Verification 'Diagnostic & Utility Update' (Protocol in workflow.md)

## Phase 2: Navigation & Content Recovery [checkpoint: 51b045a]
- [x] Task: Restore Navigation Logic 1ab4035
    - [ ] Update `navToSection` to use text-based discovery for tab buttons.
    - [ ] Update `extractAndWrapSections` to verify content is actually captured before cloning.
- [x] Task: Restore Styling & Cleanup 0ae4776
    - [ ] Update `tweakStyles` to remove site-bar and mega-menu using verified selectors.
    - [ ] Update HP and Character name selectors based on diagnostic data.
- [x] Task: Conductor - User Manual Verification 'Navigation & Content Recovery' (Protocol in workflow.md)

## Phase 3: Validation & Stabilization
- [x] Task: Integration Test d36bd3f
    - [ ] Update `test/e2e/extraction.test.js` to use the new obfuscated classes as a mock environment.
- [ ] Task: Final Build
    - [ ] Verify version 1.1.1.
- [ ] Task: Conductor - User Manual Verification 'Validation & Stabilization' (Protocol in workflow.md)
