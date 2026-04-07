# Specification: Asset Compression & WebP Migration

## Objective
Reduce the extension package size from 14MB to under 3MB by optimizing image assets.

## Scope
-   **Image Resizing:** Downscale all high-resolution assets (currently up to 2000px+) to a maximum of 512px.
-   **Format Migration:** Convert all `.gif` assets to `.webp` for better compression and transparency support.
-   **Metadata Synchronization:** Recalculate and update `border-image-slice` values in `ASSET_METADATA` to match the new image dimensions.
-   **Codebase Update:** Update all references from `.gif` to `.webp` in `manifest.json`, `main.js`, and test files.

## Technical Constraints
-   Maintain visual quality (at least 80% WebP quality).
-   Ensure transparency is preserved during conversion.
-   `border-image-slice` values MUST be scaled proportionally to the image resize ratio.

## Success Criteria
-   Total `assets/` directory size is under 3MB.
-   All 227 tests pass.
-   Borders and shapes render correctly on the character sheet with the new assets.
