# Implementation Plan - Selector Abstraction Refactor

## Phase 1: Foundation & Core Layout Abstraction
This phase establishes the `DomManager` architecture and migrates the fundamental page structure selectors (Container, Header, Sidebar, Tabs).

- [ ] Task: specific - Analyze Core DOM Usage & Design Wrappers
    - [ ] Audit `main.js` and `background.js` to list all properties, attributes, and methods currently accessed on Core elements (e.g., `.style.display`, `.classList.contains`, `.dataset.id`, `.innerText`).
    - [ ] Design the `ElementWrapper` interface to expose semantic methods for these operations (e.g., `isVisible()`, `toggleDisplay()`, `getData(key)`, `addClass()`, `removeClass()`).
- [ ] Task: specific - Create `DomManager` & `ElementWrapper` Implementation
    - [ ] Create `js/dom/dom_manager.js` and `js/dom/element_wrapper.js`.
    - [ ] Implement `ElementWrapper` with the designed semantic interface.
    - [ ] Implement `DomManager` with the `selectors` registry.
    - [ ] Write unit tests for `DomManager` and `ElementWrapper` in `test/unit/dom_manager.test.js` covering the new interface methods.
- [ ] Task: specific - Migrate Core Layout Selectors & Logic
    - [ ] Add Core Layout selectors (Character Sheet root, Sidebar, Header, Navigation Tabs) to `DomManager`.
    - [ ] Update `DomManager` to expose methods returning `ElementWrapper`s (e.g., `getCharacterSheet()`, `getSidebar()`).
    - [ ] Refactor `js/main.js` to use `DomManager` for Core Layout, replacing direct DOM manipulation with Wrapper methods.
    - [ ] Verify that features relying on these elements (e.g., "Minimize Header", "Hide Sidebar") still work.
- [ ] Task: Conductor - User Manual Verification 'Foundation & Core Layout Abstraction' (Protocol in workflow.md)

## Phase 2: Spells Module Abstraction
This phase tackles the complex Spells tab, including lists, headers, rows, and detail panes.

- [ ] Task: specific - Define Spell Wrappers & Selectors
    - [ ] Identify all Spell-related selectors (Spell Container, Spell Row, Spell Name, Spell Level, Spell School, Spell Casting Time, Spell Range, Spell Components, Spell Duration, Spell Description).
    - [ ] Add these to `DomManager`.
    - [ ] Create specialized wrappers if necessary (e.g., `SpellRowWrapper` that has specific methods like `getLevel()`).
    - [ ] Update `DomManager` to return these wrappers (e.g., `getSpells()`, `getSpellAt(index)`).
    - [ ] Write unit tests for Spell retrieval and wrapper functionality.
- [ ] Task: specific - Refactor Spell Logic
    - [ ] Replace direct DOM usage in `js/spells.js` (and relevant parts of `js/main.js`) with `DomManager`.
    - [ ] Ensure "Expand Spells", "Spell Cloning", and "Spell Filtering" features function correctly using the new abstraction.
- [ ] Task: Conductor - User Manual Verification 'Spells Module Abstraction' (Protocol in workflow.md)

## Phase 3: Actions, Equipment & Remaining Modules
This phase covers the remaining major tabs and any other scattered selectors.

- [ ] Task: specific - Migrate Actions & Equipment
    - [ ] Identify selectors for Actions tab (Attack rows, Action details) and Equipment tab.
    - [ ] Add to `DomManager` and create wrappers.
    - [ ] Refactor logic in `js/main.js` (and any other files) to use `DomManager`.
- [ ] Task: specific - Migrate Traits, Features & Extras
    - [ ] Identify selectors for Features & Traits, Description, Notes, and Extras tabs.
    - [ ] Add to `DomManager` and create wrappers.
    - [ ] Refactor logic.
- [ ] Task: Conductor - User Manual Verification 'Actions, Equipment & Remaining Modules' (Protocol in workflow.md)

## Phase 4: Final Cleanup & Verification
Ensure the abstraction is complete and no legacy direct DOM access remains.

- [ ] Task: specific - Global Scan & Cleanup
    - [ ] Search codebase for any remaining `document.querySelector` or `document.querySelectorAll` calls that should be managed by `DomManager`.
    - [ ] Refactor or whitelist valid exceptions (if any).
    - [ ] Ensure all new files follow project style guidelines.
- [ ] Task: Conductor - User Manual Verification 'Final Cleanup & Verification' (Protocol in workflow.md)
