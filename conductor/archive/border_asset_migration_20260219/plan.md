# Implementation Plan: Border Asset Migration & Optimization

## Phase 1: Research and Metadata Extraction [checkpoint: 826e93e]
- [x] Task: Identify all base64-encoded border strings in the codebase.
- [x] Task: Extract image dimensions for each `.gif` in `./assets` using shell commands.
- [x] Task: Calculate static constants for `--border-img-width` and `--border-img-slice` for each style.
- [x] Task: Conductor - User Manual Verification 'Research and Metadata Extraction' (Protocol in workflow.md)

## Phase 2: Manifest and CSS Refactoring [checkpoint: 8b72118]
- [x] Task: Update `manifest.json` with `web_accessible_resources` for `assets/*.gif`.
- [x] Task: Create failing tests for asset-based CSS injection.
- [x] Task: Refactor CSS injection to use `chrome.runtime.getURL()` and pre-calculated variables.
- [x] Task: Remove all base64-encoded border strings from the source code.
- [x] Task: Conductor - User Manual Verification 'Manifest and CSS Refactoring' (Protocol in workflow.md)

## Phase 3: Final Verification [checkpoint: 17f57de]
- [x] Task: Verify all border styles render correctly in unit tests.
- [x] Task: Ensure layout persistence and storage are unaffected by asset migration.
- [x] Task: Conductor - User Manual Verification 'Final Verification' (Protocol in workflow.md)
