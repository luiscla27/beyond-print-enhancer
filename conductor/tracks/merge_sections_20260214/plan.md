# Implementation Plan: Merge & Append Sections

This plan follows the TDD methodology and quality gates defined in `workflow.md`.

## Phase 1: Standardization & Spell Optimization
- [~] Task: Mark `be-spell-detail` sections with the `.be-extracted-section` class
- [ ] Task: Refactor spell detail persistence to save only the spell name and reconstruct content from `spell_cache` during load
- [ ] Task: Update `scanLayout` and `applyLayout` to handle the new optimized spell storage
- [ ] Task: Write unit tests for cache-based spell reconstruction and optimized persistence
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Standardization' (Protocol in workflow.md)

## Phase 2: Merge UI & Discovery
- [ ] Task: Implement the "Append after" button injection logic for all `.be-extracted-section` headers
- [ ] Task: Implement target discovery logic to gather all `be-extractable` groups and `be-extracted-section` containers
- [ ] Task: Implement hierarchical breadcrumb naming (e.g., "Actions > Attacks") for target identification
- [ ] Task: Create the Merge Target Modal UI to display and select targets
- [ ] Task: Write unit tests for target list generation and breadcrumb formatting
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Merge UI' (Protocol in workflow.md)

## Phase 3: Merge Execution & Rollback
- [ ] Task: Implement merge execution logic: move content to target location and destroy source container
- [ ] Task: Implement relationship tracking to support "Independent Rollback" (restoring multiple associated original elements)
- [ ] Task: Update the section 'X' button logic to handle rolling back all merged/appended content
- [ ] Task: Write unit tests for the merge lifecycle: Move -> Destroy Source -> Multi-Rollback
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Merge Execution' (Protocol in workflow.md)

## Phase 4: Relationship Persistence
- [ ] Task: Update the layout schema to support nesting relationships (tracking which IDs are appended to which sections)
- [ ] Task: Update `scanLayout` to capture the hierarchical state of merged sections
- [ ] Task: Update `applyLayout` to reconstruct merged structures and hide all associated original elements
- [ ] Task: Update `handleLoadDefault` to ensure all merged sections are fully unrolled and removed
- [ ] Task: Write integration tests for save/load persistence of merged/appended sections
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Persistence' (Protocol in workflow.md)

## Phase 5: Final Integration & E2E
- [ ] Task: Perform full E2E manual verification of merging spells into actions, groups into groups, and sections into sections
- [ ] Task: Verify that "Compact Mode" and "Resize" work correctly on merged containers
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Final Verification' (Protocol in workflow.md)
