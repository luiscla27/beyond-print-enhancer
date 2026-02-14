# Implementation Plan: Dynamic Content Extraction Trigger

This plan follows the TDD methodology and quality gates defined in `workflow.md`.

## Phase 1: CSS & Visual Triggers [checkpoint: 09931d6]
- [x] Task: Define CSS for `.be-extractable` class, including dashed outline and `:before` pseudo-element tooltip 09931d6
- [x] Task: Implement `flagExtractableElements()` to scan the DOM and apply the activation class to target selectors 09931d6
- [x] Task: Implement nesting logic to ensure only top-level matching elements are flagged 09931d6
- [x] Task: Write unit tests verifying that correct elements are flagged and nested ones are ignored 09931d6
- [x] Task: Conductor - User Manual Verification 'Phase 1: Visual Triggers' (Protocol in workflow.md) 09931d6

## Phase 2: Extraction Core & Lifecycle
- [~] Task: Implement `handleElementExtraction(element)` to clone content and create a new floating section
- [~] Task: Implement ID tracking system to link floating sections with their hidden original elements
- [~] Task: Implement the "Rollback" logic triggered by closing a dynamically created section
- [ ] Task: Write unit tests for the extraction lifecycle: Hide original -> Create clone -> Restore on close
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Extraction Core' (Protocol in workflow.md)

## Phase 3: UI Enhancements & Discovery
- [ ] Task: Implement `findSectionTitle(element)` using the prioritized selector list (`h1`-`h5`, `head`)
- [ ] Task: Integrate manual title prompt fallback using `showInputModal`
- [ ] Task: Ensure prepended standardized D&D Beyond headers are included in the extracted content area
- [ ] Task: Write unit tests for title discovery logic and manual fallback
- [ ] Task: Conductor - User Manual Verification 'Phase 3: UI & Title Discovery' (Protocol in workflow.md)

## Phase 4: Persistence & State Management
- [ ] Task: Update the layout schema to support a new `extractions` array (tracking original ID and coordinates)
- [ ] Task: Update `scanLayout` to capture the state of all currently extracted sections
- [ ] Task: Update `applyLayout` to automatically hide original elements and re-create floating sections on load
- [ ] Task: Update `handleLoadDefault` to reset all extractions
- [ ] Task: Write integration tests for save/load persistence of dynamic extractions
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Persistence' (Protocol in workflow.md)

## Phase 5: Final Integration & E2E
- [ ] Task: Perform full E2E manual verification of the extraction flow on a live character sheet
- [ ] Task: Verify performance impact of hover/outline logic on large sheets
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Final Verification' (Protocol in workflow.md)
