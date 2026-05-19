# Specification: CSS Hover Refactor

## Overview
Refactor the current hover highlight logic by completely removing the JavaScript event listeners that dynamically add and remove the `be-hover-highlight` class. Replace this logic entirely with native CSS `:hover` pseudo-classes to handle the styling changes natively in the browser.

## Functional Requirements
1.  **Remove JS Listeners:** Locate and remove all JavaScript `mousemove`, `mouseenter`, `mouseover`, `mouseleave`, or `mouseout` event listeners responsible for applying the `be-hover-highlight` class (e.g., `initHoverHighlights`).
2.  **Native CSS `:hover`:** Implement the equivalent styling using native CSS `:hover` pseudo-classes within the injected style blocks (e.g., in `main.js`).
3.  **Target Elements:** The native CSS hover styles MUST specifically target elements with the `.be-shape-container` and `.be-section-wrapper` classes, ensuring they receive the appropriate visual feedback when hovered.
4.  **No JS Fallback:** The new implementation MUST rely solely on CSS for the hover visual state without any JavaScript assistance.

## Out of Scope
*   Redesigning the visual appearance of the hover highlight (the visual style should remain the same, just the mechanism changes).
*   Refactoring other unrelated JavaScript interactions.