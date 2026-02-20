


https://github.com/user-attachments/assets/1d596af8-59bf-476d-b100-920194e96072


# Print Enhancer for D&D Beyond

Modernized and restored for D&D Beyond 2026 site changes. This extension helps you print your D&D Beyond character sheets in a clean, print-friendly format.

**Credits**: This project is a fork of the abandoned [D&D Beyond Character Sheet Print Enhancer](https://github.com/adam-p/dndbeyond-printenhance) by Adam Pritchard, with significant updates for modern site compatibility and new features. I made this project because I wanted print-ready character sheets for my D&D games without having to manually edit or create the PDF.


**This project is a work in progress. Feature requests, issue reports and pull requests are welcome.**

## Try the Chrome Extension
1. v1.3.0: [Install here](https://chromewebstore.google.com/detail/beyond-print-enhancer/obmbfcnlmoegklgdlkcanlkiadhengbc)
2. v1.3.1: Pending approval.

## Recent Updates (v1.3.1)
- **Quick Info Decomposition**: AC, Initiative, Speed, and HP are now extracted into individual draggable sections.
- **Individual Ability Sections**: STR, DEX, CON, INT, WIS, and CHA are now separated for more granular layout control.
- **Asset Migration**: Replaced all base64 border images with local assets, reducing extension size and improving performance.
- **Layout Stabilization**: Implemented advanced event suppression to prevent window resizing and React re-renders from breaking custom layouts.
- **New Decorative Styles**: Added a new 'Box' border style and improved the border picker modal with more options (Barbarian, Goth, Plants).
- **Bug Fixes**: Improved layout persistence and fixed default coordinate synchronization.

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

1. Drag & Drop sections to reorder them.
2. Resizable sections.
3. Minimize sections.
4. Save & Load templates.
5. Clone sections, specifically for the SPELL section (e.g., "Combat Spells" vs "Utility Spells").
6. Compact mode to maximize information density in heavy sections like Spells.
7. Spell description cards.
8. Merge sections together to save space. 
9. Extrac specific cards content into its own cards
11. **WIP**: Editable content and font resizing.
12. **WIP**: Support for other color themes (beyond Red).

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
