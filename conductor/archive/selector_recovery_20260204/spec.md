# Track Specification: Selector Recovery & Resilience

## Overview
The current implementation of the D&D Beyond Print Enhancer is failing because the website now uses obfuscated/dynamic CSS classes (e.g., `styles_tabButton__wvSLf`). This track aims to restore functionality by moving away from strictly class-based selectors and implementing text-based discovery and structural heuristics.

## Functional Requirements
1.  **Text-Based Navigation Discovery:**
    *   Find tab buttons by searching for text content ("Actions", "Spells", "Equipment") rather than specific `.ct-` classes.
    *   Identify the navigation container by the presence of these buttons.
2.  **Resilient Content Area Detection:**
    *   Locate the main content container by identifying the element that changes or is toggled when navigation tabs are clicked.
    *   Fallback to searching for elements with classes containing `content` or `Carousel`.
3.  **HP Block Recovery:**
    *   Implement a multi-strategy search for the HP display (e.g., looking for "HP" labels or specific numeric patterns).
4.  **Error Handling Enhancements:**
    *   Update `safeQuery` to never throw; it should return `null` and log specific diagnostic info.
5.  **Refactor `main.js`:**
    *   Integrate the recovered selectors and new discovery logic.

## Acceptance Criteria
- [ ] Extension successfully extracts all 4 main sections (Actions, Spells, Equipment, Features) on the reference character.
- [ ] No `TypeError` or `null` reference errors in the console during execution.
- [ ] Draggable containers are correctly populated with character data.
- [ ] Tab navigation is successfully hidden after extraction.
