# Specification: Inject Ability Summary CSS & Update Workflow

## 1. Overview
This track involves adding new CSS classes for ability summaries to the character sheet, centralizing their selectors in the `DomManager`, and updating the project's development workflow to enforce selector centralization and testing.

## 2. Functional Requirements
- **CSS Injection:**
  - Add `.ddbc-ability-summary { display: contents; }` to the injected styles.
  - Add `.ddbc-ability-summary__secondary` with the following properties:
    - `position: static`
    - `border: 2px solid var(--btn-color)` (replacing hardcoded `#c53131`)
    - `border-radius: 150px`
    - `padding: 8px 13px`
    - `font-size: 16px !important`
    - `width: fit-content`
    - `background: white`
- **DOM Manager Centralization:**
  - Create a new `ABILITY` category in `js/dom/dom_manager.js`.
  - Register selectors for `.ddbc-ability-summary` and `.ddbc-ability-summary__secondary` in this new category.
- **Workflow Update:**
  - Add a new rule to `conductor/workflow.md`: "All CSS selectors MUST be moved to DomManager and have corresponding unit tests."

## 3. Technical Constraints
- Must adhere to the existing `DomManager` singleton pattern.
- Must use existing CSS variables (e.g., `--btn-color`) for theme consistency.

## 4. Acceptance Criteria
- [ ] `DomManager` has a new `ABILITY` category with the required selectors.
- [ ] Injected CSS includes the new classes with correct styling.
- [ ] `workflow.md` is updated with the new requirement for CSS selectors and testing.
- [ ] Unit tests are created to verify the new selectors in `DomManager`.

## 5. Out of Scope
- Modifying the underlying D&D Beyond HTML structure.
- Implementing logic to apply these classes to elements (this track focuses on injection and infrastructure).
