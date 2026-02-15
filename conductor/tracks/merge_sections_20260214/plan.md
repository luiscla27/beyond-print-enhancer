# Implementation Plan: Merge & Append Sections

This plan follows the TDD methodology and quality gates defined in `workflow.md`.

## Phase 1: Standardization & Spell Optimization [checkpoint: 213bb3e]
- [x] Task: Mark `be-spell-detail` sections with the `.be-extracted-section` class 213bb3e
- [x] Task: Refactor spell detail persistence to save only the spell name and reconstruct content from `spell_cache` during load 213bb3e
- [x] Task: Update `scanLayout` and `applyLayout` to handle the new optimized spell storage 213bb3e
- [x] Task: Write unit tests for cache-based spell reconstruction and optimized persistence 213bb3e
- [x] Task: Conductor - User Manual Verification 'Phase 1: Standardization' (Protocol in workflow.md) 213bb3e

## Phase 2: Merge UI & Discovery [checkpoint: a8f6b84]
- [x] Task: Implement the "Append after" button injection logic for all `.be-extracted-section` headers a8f6b84
- [x] Task: Implement target discovery logic to gather all `be-extractable` groups and `be-extracted-section` containers a8f6b84
- [x] Task: Implement hierarchical breadcrumb naming (e.g., "Actions > Attacks") for target identification a8f6b84
- [x] Task: Create the Merge Target Modal UI to display and select targets a8f6b84
- [x] Task: Write unit tests for target list generation and breadcrumb formatting a8f6b84
- [x] Task: Conductor - User Manual Verification 'Phase 2: Merge UI' (Protocol in workflow.md) a8f6b84

## Phase 3: Merge Execution & Rollback [checkpoint: 95b9117]
- [x] Task: Implement merge execution logic: move content to target location and destroy source container 95b9117
- [x] Task: Implement relationship tracking to support "Independent Rollback" (restoring multiple associated original elements) 95b9117
- [x] Task: Update the section 'X' button logic to handle rolling back all merged/appended content 95b9117
- [x] Task: Write unit tests for the merge lifecycle: Move -> Destroy Source -> Multi-Rollback 95b9117
- [x] Task: Conductor - User Manual Verification 'Phase 3: Merge Execution' (Protocol in workflow.md) 95b9117

## Phase 4: Relationship Persistence [checkpoint: aaa8275]
- [x] Task: Update the layout schema to support nesting relationships (tracking which IDs are appended to which sections) aaa8275
- [x] Task: Update `scanLayout` to capture the hierarchical state of merged sections aaa8275
- [x] Task: Update `applyLayout` to reconstruct merged structures and hide all associated original elements aaa8275
- [x] Task: Update `handleLoadDefault` to ensure all merged sections are fully unrolled and removed aaa8275
- [x] Task: Write integration tests for save/load persistence of merged/appended sections aaa8275
- [x] Task: Conductor - User Manual Verification 'Phase 4: Persistence' (Protocol in workflow.md) aaa8275

## Phase 5: Final Integration & E2E [checkpoint: fd5b98d]
- [x] Task: Perform full E2E manual verification of merging spells into actions, groups into groups, and sections into sections fd5b98d
- [x] Task: Verify that "Compact Mode" and "Resize" work correctly on merged containers fd5b98d
- [x] Task: Conductor - User Manual Verification 'Phase 5: Final Verification' (Protocol in workflow.md) fd5b98d
