# Implementation Plan - Selector Abstraction Refactor

## Phase 1: Foundation & Core Layout Abstraction [checkpoint: 1eef013]
This phase establishes the `DomManager` architecture and migrates the fundamental page structure selectors (Container, Header, Sidebar, Tabs).

- [x] Task: specific - Analyze Core DOM Usage & Design Wrappers
    - [x] Audit `main.js` and `background.js` to list all properties, attributes, and methods currently accessed on Core elements (e.g., `.style.display`, `.classList.contains`, `.dataset.id`, `.innerText`).
    - [x] Design the `ElementWrapper` interface to expose semantic methods for these operations (e.g., `isVisible()`, `toggleDisplay()`, `getData(key)`, `addClass()`, `removeClass()`).
- [x] Task: specific - Create `DomManager` & `ElementWrapper` Implementation
    - [x] Create `js/dom/dom_manager.js` and `js/dom/element_wrapper.js`.
    - [x] Implement `ElementWrapper` with the designed semantic interface.
    - [x] Implement `DomManager` with the `selectors` registry.
    - [x] Write unit tests for `DomManager` and `ElementWrapper` in `test/unit/dom_manager.test.js` covering the new interface methods.
- [x] Task: specific - Migrate Core Layout Selectors & Logic
    - [x] Add Core Layout selectors (Character Sheet root, Sidebar, Header, Navigation Tabs) to `DomManager`.
    - [x] Update `DomManager` to expose methods returning `ElementWrapper`s (e.g., `getCharacterSheet()`, `getSidebar()`).
    - [x] Refactor `js/main.js` to use `DomManager` for Core Layout, replacing direct DOM manipulation with Wrapper methods.
    - [x] Verify that features relying on these elements (e.g., "Minimize Header", "Hide Sidebar") still work.
- [x] Task: Conductor - User Manual Verification 'Foundation & Core Layout Abstraction' (Protocol in workflow.md)

## Phase 2: Spells Module Abstraction [checkpoint: a6fa071]
This phase tackles the complex Spells tab, including lists, headers, rows, and detail panes.

- [x] Task: specific - Define Spell Wrappers & Selectors
    - [x] Identify all Spell-related selectors (Spell Container, Spell Row, Spell Name, Spell Level, Spell School, Spell Casting Time, Spell Range, Spell Components, Spell Duration, Spell Description).
    - [x] Add these to `DomManager`.
    - [x] Create specialized wrappers if necessary (e.g., `SpellRowWrapper` that has specific methods like `getLevel()`).
    - [x] Update `DomManager` to return these wrappers (e.g., `getSpells()`, `getSpellAt(index)`).
    - [x] Write unit tests for Spell retrieval and wrapper functionality.
- [x] Task: specific - Refactor Spell Logic
    - [x] Replace direct DOM usage in `js/spells.js` (and relevant parts of `js/main.js`) with `DomManager`.
    - [x] Ensure "Expand Spells", "Spell Cloning", and "Spell Filtering" features function correctly using the new abstraction.
- [x] Task: Conductor - User Manual Verification 'Spells Module Abstraction' (Protocol in workflow.md)

## Phase 3: Actions, Equipment & Remaining Modules [checkpoint: 0906065]
This phase covers the remaining major tabs and any other scattered selectors.

- [x] Task: specific - Migrate Actions & Equipment
    - [x] Identify selectors for Actions tab (Attack rows, Action details) and Equipment tab.
    - [x] Add to `DomManager` and create wrappers.
    - [x] Refactor logic in `js/main.js` (and any other files) to use `DomManager`.
- [x] Task: specific - Migrate Traits, Features & Extras
    - [x] Identify selectors for Features & Traits, Description, Notes, and Extras tabs.
    - [x] Add to `DomManager` and create wrappers.
    - [x] Refactor logic.
- [x] Task: Conductor - User Manual Verification 'Actions, Equipment & Remaining Modules' (Protocol in workflow.md)

## Phase 4: Final Cleanup & Verification [checkpoint: 61cb6a9]
Ensure the abstraction is complete and no legacy direct DOM access remains.

- [x] Task: specific - Global Scan & Cleanup
    - [x] Search codebase for any remaining `document.querySelector` or `document.querySelectorAll` calls that should be managed by `DomManager`.
    - [x] Refactor or whitelist valid exceptions (if any).
    - [x] Ensure all new files follow project style guidelines.
- [x] Task: Conductor - User Manual Verification 'Final Cleanup & Verification' (Protocol in workflow.md)

## Phase 5: CSS Injection Abstraction [checkpoint: 801af66]
This phase addresses the hardcoded CSS selectors within injected style blocks (e.g., `injectCompactStyles`, `enforceFullHeight`).

- [x] Task: specific - Analyze Injected CSS
    - [x] Audit `js/main.js` for `injectCompactStyles`, `enforceFullHeight`, and any other style injection functions.
    - [x] Identify all D&D Beyond specific selectors used in these strings.
- [x] Task: specific - Centralize CSS Selectors
    - [x] Update `DomManager` (or create a `CssManager`) to store these selectors or generating functions.
    - [x] Refactor the CSS strings to use the centralized constants.
- [x] Task: Conductor - User Manual Verification 'CSS Injection Abstraction' (Protocol in workflow.md)

## Phase 6: Comprehensive CSS Analysis & Abstraction
This phase tackles the deep analysis and abstraction of remaining CSS selectors, particularly those in the large injected blocks, ensuring every D&D Beyond dependency is identified, documented, and abstracted.

- [ ] Task: specific - Detailed CSS Audit
    - [ ] Analyze `js/main.js` specifically lines 1579-2062 (and similar blocks).
    - [ ] Create a detailed map of each selector, its purpose (e.g., "Hides rolling panel", "Shrinks icon"), and its source (DDB vs. Extension).
    - [ ] Document this analysis in `css_abstraction_plan.md` (updating the existing file).
- [ ] Task: specific - Refined Abstraction
    - [ ] Update `DomManager` with semantic keys based on the analysis (e.g., `UI.DICE_ROLLER`, `UI.COLLAPSED_ACTIONS`).
    - [ ] Refactor the CSS strings to use these new semantic keys.
- [ ] Task: Conductor - User Manual Verification 'Comprehensive CSS Analysis & Abstraction' (Protocol in workflow.md)
