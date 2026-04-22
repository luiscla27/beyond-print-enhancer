# Product Definition

## Initial Concept
D&D Beyond Players printing character sheets (Modernized for 2026)

## Target Audience
- **Primary:** D&D Beyond users (players and DMs) who prefer physical character sheets during gameplay.
- **Secondary:** Users who want a cleaner, distraction-free digital view of their character sheet without site navigation and ads.

## Core Value Proposition
The D&D Beyond Print Enhancer transforms the interactive, tabbed D&D Beyond character sheet into a condensed, printer-friendly format. It solves the problem of "hidden" content in tabs (Actions, Spells, Equipment) by expanding them into a single view and removing unnecessary web UI elements (nav bars, buttons, excessive padding) to optimize for physical paper printing.

## Key Features
- **Content Expansion:** Automatically expands and appends 'Actions', 'Spells', and 'Equipment' sections to the main view, eliminating the need to print multiple views or switch tabs.
- **Layout Optimization:** Removes site headers, navigation bars, sidebars, and interactive buttons (e.g., Short/Long Rest, Manage Spells) to maximize printable space.
- **Persistent Layout Management:** Provides a floating control panel to save custom section arrangements (coordinates, sizes, and internal scaling) to the browser (IndexedDB) or as local JSON files for portability.
- **Section Cloning:** Allows users to create static snapshots of any section (e.g., Spells) to support multiple lists (like "Combat" vs. "Social") on a single printed page.
- **Dynamic Content Extraction:** Enables users to selectively extract specific blocks of content (e.g., individual action lists, traits, or snippets) into new floating sections via double-click, automatically hiding the original content to prevent redundancy.
- **Quick Info Decomposition:** Automatically separates the character's core stat boxes (AC, Initiative, Speed, etc.) and ability scores into individual draggable sections for granular placement.
- **Layout Stabilization:** Suppresses responsive site events (window resizing, React re-renders) that would otherwise disrupt custom layouts, ensuring a consistent print-ready state.
- **Customizable Borders:** Allows users to choose between different border styles (e.g., Default, Ability, Spikes, Dwarf, or Ornament) for individual sections to better define layout groups or add visual flair.
- **Decorative Shapes:** Enables users to add independent, floating, and resizable decorative elements (shapes/borders) to the layout. Includes an enhanced 'Add Shape' modal with categorized tabs and tag-based filtering for a large library of assets.
- **Shape Transformation:** Allows users to rotate decorative shapes in 15-degree increments with togglable visual handles and persistence across sessions.
- **Shape Interaction Lockdown:** Automatically locks decorative shapes (making them semi-transparent and non-interactive) when not in 'Shapes Mode' to prevent accidental misclicks.
- **Quick Switch:** Provides a dedicated button on shapes to rapidly swap assets while preserving their existing position, size, and rotation.
- **Interaction Isolation (Shapes Mode):** Provides a toggleable mode that isolates interaction to only decorative shapes, making all other character sheet sections unclickable and faded to facilitate precise placement of decorations.
- **Layer Management:** Introduces a dedicated panel to toggle the visibility of 'Shapes Mode' and 'Sections' layers independently. Includes nested visual lists with thumbnails and previews to help users identify layer contents.
- **Print Z-Order & Focus:** Enhances the layer management list with interactivity:
    - **Click-to-Focus:** Clicking an item in the layer list automatically scrolls the character sheet to that element and applies a temporary highlight effect.
    - **Custom Print Order:** Supports drag-and-drop reordering of items in the layer list to define a persistent Z-index specifically for the print view, managed via injected CSS to ensure no interference with interactive edit modes.
    - **Selective Print Visibility:** Adds a "Disable on Print" toggle to each layer, allowing users to keep elements visible in the browser for reference while hiding them from the final printed page.
    - **Print Opacity Normalization:** Automatically forces all visible layers to 100% opacity during print, ensuring that locked or decorative elements are fully legible on paper.
- **Section Merging & Nesting:** Allows users to merge floating sections into each other or append them back to specific locations on the sheet, facilitating complex custom layouts and group consolidations.
- **Compact Mode:** Provides a toggleable condensed layout for complex sections (like Spells), reducing margins, padding, and font sizes to maximize information density on paper.
- **PREMADE Template Catalog:** Provides a library of professional, themed layouts (e.g., 'Archer Template') that can be applied with a single click, automatically configuring borders and adding decorative shapes.
- **Data Consolidation:** Relocates defense information (resistances, immunities) from hidden modals directly onto the combat tablet for immediate visibility.
- **Print Styling:** Adjusts text colors to black for better contrast and legibility on paper, and tightens margins/padding to fit more content per page.
- **Global Visual Filters:** Provides a suite of sliders (Hue, Contrast, Saturate, Greyscale, and Sepia) in the main control panel to globally change the appearance of all borders, shapes, and decorative elements while preserving the legibility of text and the original colors of icons and images.
