# Implementation Plan: Spell Detail Section Injection

This plan outlines the steps to implement floating spell detail sections with IndexedDB caching, following the project's TDD workflow.

## Phase 1: Storage & Persistence Integration [checkpoint: df2dff4]
- [x] Task: Initialize `spell_cache` object store in `DDBPrintEnhancerDB` (Update `Storage.init` in `js/main.js`) c89d0bb
- [x] Task: Implement `Storage` methods for spell cache: `getSpell(name)`, `saveSpells(spells)` c89d0bb
- [x] Task: Write unit tests for `spell_cache` IndexedDB operations c89d0bb
- [x] Task: **JSON Schema Upgrade:** Increment `SCHEMA_VERSION` and implement upgrade alert logic (Warn user and suggest re-download if loaded JSON is older) 3a4e11d
- [x] Task: Update JSON Export/Import logic to include `spell_cache` data cf9a09e
- [x] Task: Update `workflow.md` to mandate `SCHEMA_VERSION` increments for any JSON structure changes 3a4e11d
- [x] Task: Write unit tests for spell cache persistence and version validation cf9a09e
- [x] Task: Conductor - User Manual Verification 'Phase 1: Storage' (Protocol in workflow.md) df2dff4

## Phase 2: Data Service & Cache Logic
- [ ] Task: Refactor `getCharacterSpells` to return raw data suitable for caching if not already optimal
- [ ] Task: Implement `fetchSpellWithCache(spellName)` logic: Check IndexedDB -> Fetch API on miss -> Update Cache
- [ ] Task: Write unit tests for the Cache-First retrieval strategy
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Data Service' (Protocol in workflow.md)

## Phase 3: UI - Trigger Injection
- [ ] Task: Implement CSS for the hidden/hover "Details" button in spell rows
- [ ] Task: Implement button injection logic for `div.ct-spells-spell` (supporting original and clones)
- [ ] Task: Write unit tests verifying button injection in various section states
- [ ] Task: Conductor - User Manual Verification 'Phase 3: UI - Buttons' (Protocol in workflow.md)

## Phase 4: UI - Spell Detail Section
- [ ] Task: Implement `createSpellDetailSection(coords)` to immediately place a shell section at click location
- [ ] Task: Implement internal section UI: Loading spinner, Data display (Name, Level, School, Range, Description)
- [ ] Task: Implement "Close" functionality and coordinate handling for dragging (if applicable)
- [ ] Task: Implement Error State UI: "Retry" and "Delete" buttons with the required guidance message
- [ ] Task: Write unit tests for section rendering, loading states, and error interactions
- [ ] Task: Conductor - User Manual Verification 'Phase 4: UI - Detail Sections' (Protocol in workflow.md)

## Phase 5: Final Integration & E2E
- [ ] Task: Perform E2E manual verification of the full flow
- [ ] Task: Verify performance of bulk cache updates on first-time fetch
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Final Verification' (Protocol in workflow.md)
