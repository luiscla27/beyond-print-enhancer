# Implementation Plan - Project Modernization & Stabilization

## Phase 1: Environment & Tooling Update
- [x] Task: Project Setup & Dependency Audit
    - [ ] Run `npm install` to establish current state.
    - [ ] Audit `package.json` for outdated devDependencies (specifically `eslint`).
    - [ ] Update `eslint` to a recent stable version.
    - [ ] Update `.eslintrc.js` to be compatible with the new `eslint` version and ES6+ standards.
    - [ ] Verify linting works by running `npx eslint .`.
- [ ] Task: Conductor - User Manual Verification 'Environment & Tooling Update' (Protocol in workflow.md)

## Phase 2: Manifest V3 Compliance Check
- [ ] Task: Manifest Validation
    - [ ] Review `manifest.json` against current Chrome Extension Manifest V3 documentation.
    - [ ] Verify `permissions` are minimal and correct (`declarativeContent`, `activeTab`, `scripting`).
    - [ ] Confirm `background.service_worker` is correctly defined and `js/background.js` uses compliant event listeners (e.g., `chrome.runtime.onInstalled`, `chrome.action.onClicked`).
    - [ ] Check for any usage of remote code (not allowed in V3) - unlikely given the codebase size, but necessary to verify.
- [ ] Task: Conductor - User Manual Verification 'Manifest V3 Compliance Check' (Protocol in workflow.md)

## Phase 3: D&D Beyond DOM Discovery & Documentation
- [ ] Task: Fetch and Analyze Reference Character Sheet
    - [ ] Access the reference URL: https://www.dndbeyond.com/characters/151911403
    - [ ] Extract the current DOM structure, specifically looking for:
        - Main character sheet container.
        - Navigation tabs (Actions, Spells, Equipment, etc.).
        - "Manage" buttons and sidebars.
        - Defenses/Resistances containers.
    - [ ] Create a reference document `conductor/tracks/modernization_20260204/dom_reference.md` listing the new selectors and structure to be used as a source of truth for the modernization.
- [ ] Task: Conductor - User Manual Verification 'D&D Beyond DOM Discovery & Documentation' (Protocol in workflow.md)

## Phase 4: Functionality Verification (Code Analysis)
- [ ] Task: DOM Selector Audit
    - [ ] Analyze `js/main.js` and list all CSS selectors used for DOM manipulation (e.g., `.ct-quick-nav__toggle`, `.ct-component-carousel`).
    - [ ] **Verification:** Compare the existing selectors against the findings in `dom_reference.md` from Phase 3.
- [ ] Task: Code Logic Refactor
    - [ ] Refactor `js/main.js` to use the new selectors identified in Phase 3.
    - [ ] Refactor `js/main.js` to include basic error handling. If a selector is not found, the script should fail gracefully or log a warning rather than crashing.
    - [ ] Ensure `navToSection`, `getAllSections`, and `moveDefenses` functions are modular and readable.
- [ ] Task: Conductor - User Manual Verification 'Functionality Verification (Code Analysis)' (Protocol in workflow.md)

## Phase 5: Final Polish & Build
- [ ] Task: Version Bump
    - [ ] Update version in `package.json` and `manifest.json`.
    - [ ] Update `README.md` to reflect any changes in installation or usage instructions.
- [ ] Task: Conductor - User Manual Verification 'Final Polish & Build' (Protocol in workflow.md)