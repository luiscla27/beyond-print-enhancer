# Implementation Plan: Inject Ability Summary CSS & Update Workflow

## Phase 1: Workflow Update [checkpoint: 5b45e91]
- [x] Task: Update `conductor/workflow.md` to include the rule: "All CSS selectors MUST be moved to DomManager and have corresponding unit tests." [4fa7fcc]
- [x] Task: Conductor - User Manual Verification 'Workflow Update' (Protocol in workflow.md)

## Phase 2: DomManager Enhancement [checkpoint: ae2c268]
- [x] Task: Create a new `ABILITY` category in `js/dom/dom_manager.js`. [c8e324b]
- [x] Task: Register selectors for `.ddbc-ability-summary` and `.ddbc-ability-summary__secondary` in the new category. [c8e324b]
- [x] Task: Write failing unit tests in `test/unit/dom_manager.test.js` to verify the existence of these new selectors. [c8e324b]
- [x] Task: Verify tests pass after implementation. [c8e324b]
- [x] Task: Conductor - User Manual Verification 'DomManager Enhancement' (Protocol in workflow.md)

## Phase 3: CSS Injection
- [x] Task: Update the CSS injection logic in `js/main.js` to include the new ability summary classes. [ae6000f]
- [x] Task: Ensure the styles use `var(--btn-color)` for consistency. [ae6000f]
- [x] Task: Verify the injected styles match the specification requirements. [ae6000f]
- [ ] Task: Conductor - User Manual Verification 'CSS Injection' (Protocol in workflow.md)
