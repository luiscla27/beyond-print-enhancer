# Implementation Plan: Skill Box Splitter

## Phase 1: State Management & Auto-Execution Setup
- [ ] Task: Add 'skillsSplit' flag to state persistence.
    - [ ] Update state initialization to include `skillsSplit: false` by default.
    - [ ] Ensure the JSON save/load mechanism persists and reads this flag.
- [ ] Task: Implement auto-execution hook on load.
    - [ ] Add logic in the loading sequence to check `state.skillsSplit`.
    - [ ] If true, trigger the skill splitting process automatically upon load.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: State Management & Auto-Execution Setup' (Protocol in workflow.md)
- [ ] Task: Update project-wide documentation (GEMINI.md, workflow.md, etc.) and record phase checkpoint

## Phase 2: Splitter UI Injection
- [ ] Task: Inject the 'Splitter' icon button.
    - [ ] Target the `.be-section-actions` specifically within the `ct-skills-box` section.
    - [ ] Create an icon-only button matching existing UI styling.
    - [ ] Attach a click event listener that triggers the splitting process.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Splitter UI Injection' (Protocol in workflow.md)
- [ ] Task: Update project-wide documentation (GEMINI.md, workflow.md, etc.) and record phase checkpoint

## Phase 3: Splitting and Filtering Logic
- [ ] Task: Implement section cloning.
    - [ ] Upon triggering, use the existing section CLONE functionality to create 5 new sections from `ct-skills-box`.
    - [ ] Retitle the 5 new sections to: `STR`, `INT`, `WIS`, `CHA`, `DEX`.
- [ ] Task: Implement item filtering for clones.
    - [ ] For each clone, iterate through `.ct-skills__item` rows.
    - [ ] Compare the `.ct-skills__item--stat` text with the clone's new title.
    - [ ] Remove rows that do not match the clone's title.
- [ ] Task: Cleanup original section and prevent re-splitting.
    - [ ] Delete the original `ct-skills-box` section after successful cloning.
    - [ ] Ensure the new cloned sections do NOT contain the Splitter button.
    - [ ] Update the `skillsSplit` state flag to `true` to persist this action.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Splitting and Filtering Logic' (Protocol in workflow.md)
- [ ] Task: Update project-wide documentation (GEMINI.md, workflow.md, etc.) and record phase checkpoint