# Implementation Plan: Asset Compression & WebP Migration

## Phase 1: Environment Setup
- [x] Install `sharp` as a dev dependency.
- [x] Create `scripts/compress_assets.js` to handle the batch processing.

## Phase 2: Compression & Recalculation
- [x] Implement image resizing logic (max 512px).
- [x] Implement WebP conversion logic.
- [x] Implement `border-image-slice` recalculation logic.
- [x] Run the script to generate new assets in `assets/` (replacing old ones or alongside).
- [x] Capture the new metadata mapping.

## Phase 3: Codebase Integration
- [/] Update `ASSET_METADATA` in `js/main.js` with new slice values and `.webp` extensions.
- [/] Update `ASSET_LIST` in `js/main.js`.
- [ ] Update `manifest.json` web_accessible_resources to include `*.webp`.
- [ ] Global search and replace `.gif` with `.webp` in `js/main.js`, `js/spells.js`, and `test/**/*.js`.

## Phase 4: Verification
- [ ] Verify total file size reduction.
- [ ] Run all unit tests.
- [ ] Manual verification of border rendering (via simulated tests).
- [ ] Remove old `.gif` files.
