# Track Specification: Layout Refinements

## Overview
Refine initialization defaults and fix layout height calculation after the recent DOM restructuring.

## Functional Requirements
- **Default State:** "Shapes Mode" should be OFF by default when the extension loads.
- **Dynamic Height:** The print layout wrapper and its parent containers (character sheet) must be tall enough to contain all section wrappers, even those far down the page.
- **Accuracy:** Layout bounds calculation must use `.be-section-wrapper` positions and dimensions instead of `.print-section-container`.

## Acceptance Criteria
- [ ] Extension initializes with "Shapes Mode" OFF (all elements interactive by default).
- [ ] `updateLayoutBounds` correctly identifies the maximum bottom/right coordinates using `.be-section-wrapper`.
- [ ] Scrolling is possible down to the furthest element on the sheet.
- [ ] No regression in existing tests.
