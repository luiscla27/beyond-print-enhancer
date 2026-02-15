# Implementation Plan: Dynamic Content Extraction Trigger

This plan follows the TDD methodology and quality gates defined in `workflow.md`.

## Phase 1: CSS & Visual Triggers [checkpoint: 09931d6]
- [x] Task: Define CSS for `.be-extractable` class, including dashed outline and `:before` pseudo-element tooltip 09931d6
- [x] Task: Implement `flagExtractableElements()` to scan the DOM and apply the activation class to target selectors 09931d6
- [x] Task: Implement nesting logic to ensure only top-level matching elements are flagged 09931d6
- [x] Task: Write unit tests verifying that correct elements are flagged and nested ones are ignored 09931d6
- [x] Task: Conductor - User Manual Verification 'Phase 1: Visual Triggers' (Protocol in workflow.md) 09931d6

## Phase 2: Extraction Core & Lifecycle [checkpoint: 28d542c]
- [x] Task: Implement `handleElementExtraction(element)` to clone content and create a new floating section 28d542c
- [x] Task: Implement ID tracking system to link floating sections with their hidden original elements 28d542c
- [x] Task: Implement the "Rollback" logic triggered by closing a dynamically created section 28d542c
- [x] Task: Write unit tests for the extraction lifecycle: Hide original -> Create clone -> Restore on close 28d542c
- [x] Task: Conductor - User Manual Verification 'Phase 2: Extraction Core' (Protocol in workflow.md) 28d542c

## Phase 3: UI Enhancements & Discovery [checkpoint: 76aba0b]
- [x] Task: Implement `findSectionTitle(element)` using the prioritized selector list (`h1`-`h5`, `head`) 76aba0b
- [x] Task: Integrate manual title prompt fallback using `showInputModal` 76aba0b
- [x] Task: Ensure prepended standardized D&D Beyond headers are included in the extracted content area 76aba0b
- [x] Task: Write unit tests for title discovery logic and manual fallback 76aba0b
- [x] Task: Conductor - User Manual Verification 'Phase 3: UI & Title Discovery' (Protocol in workflow.md) 76aba0b

## Phase 4: Persistence & State Management [checkpoint: 5487e92]
- [x] Task: Update the layout schema to support a new `extractions` array (tracking original ID and coordinates) 5487e92
- [x] Task: Update `scanLayout` to capture the state of all currently extracted sections 5487e92
- [x] Task: Update `applyLayout` to automatically hide original elements and re-create floating sections on load 5487e92
- [x] Task: Update `handleLoadDefault` to reset all extractions b01e344
- [x] Task: Write integration tests for save/load persistence of dynamic extractions 5487e92
- [x] Task: Conductor - User Manual Verification 'Phase 4: Persistence' (Protocol in workflow.md) 5487e92

## Phase 5: Final Integration & E2E [checkpoint: 0fe3045]
- [x] Task: Perform full E2E manual verification of the extraction flow on a live character sheet 0fe3045
- [x] Task: Verify performance impact of hover/outline logic on large sheets 0fe3045
- [x] Task: Conductor - User Manual Verification 'Phase 5: Final Verification' (Protocol in workflow.md) 0fe3045
