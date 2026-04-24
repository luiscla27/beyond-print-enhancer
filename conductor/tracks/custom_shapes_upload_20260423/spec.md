# Specification: Upload Custom Shapes from Disk

## Overview
This feature introduces the ability for users to upload custom image files from their local disk to be used as decorative shapes within the layout. These custom shapes will be converted to Base64 format, stored globally in IndexedDB for future reuse across characters, and embedded within the layout JSON to ensure they persist when sharing templates.

## Functional Requirements
1. **Upload Trigger**: Add a new option named "Upload from disk" to the "Add layer modal".
2. **File Selection**: Prompt the user to select an image file from their local file system.
3. **Supported Formats**: Accept PNG, JPEG, WebP, and SVG formats.
4. **Base64 Conversion & Processing**:
    - Convert the selected image to a Base64 string.
    - Implement a file size limit threshold (e.g., 500KB - 1MB).
    - If the image exceeds the limit, automatically resize/compress it.
    - **CRITICAL**: Before compressing, display a prompt warning the user about the impending compression and potential decrease in image quality.
5. **Storage**:
    - **Global Storage**: Store the Base64 image in IndexedDB under a "Global Pool" scope, making it available for future use across all characters.
    - **Layout Embedding**: Embed the Base64 data directly inside the saved layout JSON object to ensure portability when sharing the layout/template.
6. **UI Integration ("Select Decorative Shape" panel)**:
    - Create a new tab named "Custom Shapes" within the "Select Decorative Shape" panel.
    - Display all uploaded custom shapes within this new tab.
7. **Shape Switching**: Ensure the "Custom Shapes" tab and the user's uploaded assets are also available when invoking the "Switch Shape Asset" functionality on an existing shape.

## Non-Functional Requirements
- **Performance**: Base64 encoding and image compression should execute efficiently without freezing the main UI thread.
- **Portability**: Embedding large Base64 strings in the JSON must not exceed IndexedDB or extension storage quota limits; therefore, compression is mandatory for large assets.
- **User Experience**: The compression warning prompt must be clear and offer a way to proceed or cancel.
- **Verification**: Execute `mocha` tests after every task to ensure nothing is broken.

## Acceptance Criteria
- [ ] User can click "Upload from disk" in the "Add layer modal" and select a PNG, JPEG, WebP, or SVG file.
- [ ] If a large file is selected, the user sees a warning prompt about compression.
- [ ] Selected images are converted to Base64 (and compressed if necessary).
- [ ] The custom shape is saved to IndexedDB and immediately appears in the layout.
- [ ] The custom shape data is included when the layout is exported/saved as JSON.
- [ ] A new "Custom Shapes" tab is visible in the "Select Decorative Shape" panel.
- [ ] The "Custom Shapes" tab populates with the user's globally stored custom shapes.
- [ ] The "Custom Shapes" tab is accessible and functional when using the "Switch Shape Asset" button.
- [ ] All `mocha` tests pass after every implementation step.
