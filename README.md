<img width="1522" height="671" alt="image" src="https://github.com/user-attachments/assets/efa2e184-06ba-4777-845d-830c396b2af7" />




https://github.com/user-attachments/assets/1d596af8-59bf-476d-b100-920194e96072


# Print Enhancer for D&D Beyond

Modernized and restored for D&D Beyond 2026 site changes. This extension helps you print your D&D Beyond character sheets in a clean, print-friendly format.

**Credits**: This project is a fork of the abandoned [D&D Beyond Character Sheet Print Enhancer](https://github.com/adam-p/dndbeyond-printenhance) by Adam Pritchard, with significant updates for modern site compatibility and new features. I made this project because I wanted print-ready character sheets for my D&D games without having to manually edit or create the PDF.


**This project is a work in progress. Feature requests, issue reports and pull requests are welcome.**

## Try the Chrome Extension
1. v1.3.0: [Install here](https://chromewebstore.google.com/detail/beyond-print-enhancer/obmbfcnlmoegklgdlkcanlkiadhengbc)
2. v1.3.2: Pending approval.

## Recent Updates (v1.4.1)
- **Hue Filter Fix**: Resolved the "Double Hue" bug where borders looked blue/purple instead of green/red due to cumulative filters.
- **Shape Transformation (v1.4.0)**: Persistent 15-degree incremental rotation for all decorative shapes with visual handles.
- **Enhanced Shapes Modal**: New tabbed navigation and tag-based filtering for the asset library.
- **Improved Drag-and-Drop**: Complete rewrite of the DnD engine with a custom "Manual Ghost" system for better rotation and scaling support.
- **Quick Switch**: Swap shape assets while perfectly preserving position, size, and rotation.

## Try it Live (Developer Mode)

To test the extension locally:
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the root folder of this project.
5. Open any D&D Beyond character sheet (e.g., [this example character](https://www.dndbeyond.com/characters/151911403)).
6. Click the extension icon in your toolbar to activate the print enhancer.
7. Press `Ctrl+P` to view the print preview.

## Features

1. **Drag & Drop Layout**: Freely reorder and position any character sheet section.
2. **Resizable Sections**: Adjust section width and height to fit your custom layout.
3. **Properties Panel**: A centralized panel to manage the active section's font size, compact mode, and border style in real-time.
4. **Pixel-based Font Scaling**: Granular control over section font sizes (8px to 30px) with proportional scaling for headers and icons.
5. **Decorative Shapes**: Add resizable, rotatable graphical elements to your sheet. Includes a library of borders, corners, and accents.
6. **Custom Asset Upload**: Upload your own image files (PNG, WebP, etc.) to use as custom shapes.
7. **Section Cloning**: Create snapshots of sections like Spells to show different filtered lists (e.g., "Combat" vs "Social") simultaneously.
8. **Dynamic Extraction**: Double-click any block of content (traits, features, actions) to extract it into its own floating, resizable card.
9. **Compact Mode**: One-click condensed view for complex sections to maximize information density.
10. **Border Customization**: Choose from multiple themed border styles (Archer, Barbarian, Goth, etc.) for any section.
11. **Premade Templates**: Apply professional layouts (like the classic Archer theme) instantly.
12. **Global Visual Filters**: Adjust Hue, Saturation, Contrast, and Grayscale for all decorative elements while keeping text legible.
13. **Save & Load**: Persist your custom layouts to browser storage or export them as JSON files to share.
14. **Layer Management**: Organize your decorative elements into layers with custom print Z-ordering and visibility toggles.

## Instructions for use

1. View your character sheet.
2. Click the Beyond Print Enhancer button on your browser toolbar on your PC.
3. Open the print dialog (ctrl+p/cmd+p).
4. Print settings:
  - Color: Probably black and white.
  - Margins: 
    - Top: 0.25"
    - Bottom: 0.25"
    - Left: 0"
    - Right: 0"
  - Scale: Actual size.
  - Headers and footers: deselect.
  - Background graphics: deselect.
5. Review the print preview.
6. Print!

## Known issues

1. The extension does not work on mobile browser devices nor the D&D Beyond mobile app.
2. Currently, only red theme is supported.
3. The extension is not meant to let you edit your character sheet nor throw dices. Only the SPELL section "Manage spells" should be usable.
4. Spell description sheets can ONLY gather information from the original "known spells" of D&D Beyond. The tool mitigates this by saving previously known spells. However, if a description was never seen before, it will not be available.
5. Sometimes, when using the "load" button, the inner contents of a section get messed up. It gets fixed when you resize the section again.
6. When using the "extract" button, contents are extracted from the original D&D Beyond character sheet. This means that if the content was changed you'll have to reload the page to see the changes.


## Legal ##
Beyond Print Enhancer is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
