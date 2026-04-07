# Command: Compress Large Images

## Objective
Identify all image assets larger than 150KB, compress them, convert them to WebP (if not already), update relevant metadata, and summarize the changes.

## Execution Steps

### Step 1: Identify Target Images
Scan the `assets/` directory (and its subdirectories) for any image files (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) that are strictly larger than 150KB.

**Action Required:**
- Generate **Summary 1**: A simple bulleted list of the identified image filenames (e.g., `- assets/large_image.png`), with no additional descriptions. Stop and wait for the user to proceed, or proceed automatically if in autonomous mode.

### Step 2: Implement and Run Compression
Create or update a Node.js script (similar to `scripts/compress_assets.js`) to process the identified images:
1. **Downscale:** If an image's width or height exceeds 512px, resize it so the maximum dimension is 512px, maintaining the aspect ratio.
2. **Convert/Compress:** Convert the image to WebP format (or re-compress if it's already WebP) with a quality setting of 80 to ensure the size drops below 150KB.
3. **Recalculate Metadata:** If the image was resized, recalculate its `border-image-slice` values proportionally based on the scale ratio, just as done in previous compression tasks.
4. **Output:** Save the compressed image as a `.webp` file. Delete the original file if its extension was different (e.g., deleting `.png` after creating `.webp`).

### Step 3: Codebase Integration
Update the codebase to reflect any changed filenames or metadata:
1. Update `ASSET_METADATA` in `js/main.js` with the new `.webp` extensions and recalculated `slice` values.
    - **IMPORTANT:** If you discover new assets in `assets/shapes/` that are not present in `ASSET_METADATA`, you must add them with `"isBackground": true`.
2. Update `ASSET_LIST` in `js/main.js`.
3. Update `manifest.json` `web_accessible_resources` if necessary.
4. Search and replace old extensions (like `.png` or `.jpg`) with `.webp` in `js/main.js`, `js/spells.js`, and `test/**/*.js`.

### Step 4: Verification and Final Summary
- Verify the new file sizes are under 150KB.
- Run unit tests to ensure no breakages.
- Generate **Summary 2**: A brief summary of what changed (e.g., "Compressed 5 images, converted 3 from PNG to WebP, updated slice metadata for 2 images, and updated references in main.js and tests").
