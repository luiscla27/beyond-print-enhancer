# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.2] - 2026-03-24

### Added
- **Premade Templates:** Introduced a new "PREMADE" templates system allowing users to apply professional character sheet layouts instantly.
- **Archer Template:** Full replication of the classic Archer-themed sheet, including custom borders, accents, and dividers.
- **Catalog Service:** Centralized management for template definitions and application logic.
- **New Shape Assets:** Expanded the asset library with `dwarf.webp`, `dwarf_hollow_hand.webp`, and `shield_stats.webp`.
- **Feature Flagging:** Added `ENABLE_PREMADE_TEMPLATES` flag to toggle the template menu (currently disabled for final polish).

### Changed
- **Asset Compression:** Migrated all image assets from GIF to WebP, reducing the package size from 14.5MB to ~2.1MB (85% reduction).
- **Performance Optimization:** Downscaled high-resolution decorative assets to a maximum of 512px for better loading performance.
- **Metadata Synchronization:** Synchronized `ASSET_METADATA` and `ASSET_LIST` with the `assets/shapes/` directory to ensure all new graphical elements are available in the UI.
- **Workflow Security:** Mandated that all `mocha` tests must pass before any `git commit` is allowed.

### Fixed
- **Asset Path Integrity:** Resolved missing metadata for several Archer-themed shapes and borders.
- **Template Application:** Fixed a bug where applying a template would sometimes conflict with existing manual element placements.

## [1.4.1] - 2026-03-11

### Fixed
- **Hue Filter Color Mismatch:** Resolved a double-hue-rotation bug where borders and shapes were receiving cumulative hue filters (e.g., 114deg + 114deg = 228deg), causing colors to look different from the color picker preview.
- **Standalone Shapes Saturation:** Fixed an issue where shapes added via \"Add Shape\" (not nested in a character section) were missing saturation and hue filters.
- **Saturation Cap:** Reduced the maximum saturation from 250% (or 300% in sliders) to 200% for better visual consistency.
- **Global Filters Architecture:** Refactored `applyGlobalFilters` to separate hue rotation from other visual enhancements using a new `--be-decoration-filter` CSS variable, while correctly identifying nested vs. standalone assets.

## [1.4.0] - 2026-03-07

### Added
- **Shape Transformation:** Persistent 15-degree incremental rotation for all decorative shapes with visual handles.
- **Enhanced Shapes Modal:** New tabbed navigation (Borders vs. Shapes) and tag-based filtering for the asset library.
- **Quick Switch:** Dedicated 🔄 button on shapes to swap assets while perfectly preserving position, size, and rotation.
- **Shape Interaction Lockdown:** Shapes are now non-interactive and dimmed (0.5 opacity) when "Shapes Mode" is inactive to prevent misclicks on standard sections.
- **Improved Shape Actions:** Consolidated Delete, Clone, and Rotate buttons into a unified hover-based actions container.

### Changed
- **Drag-and-Drop Overhaul:** Complete rewrite of the DnD engine in `js/dnd.js`. Replaced native `setDragImage` with a custom "Manual Ghost" system for perfect rotation and scaling support.
- **Print Optimization:** Migrated standalone shapes to `<img>` tags to ensure visibility when "Background Graphics" are disabled in browser print settings.
- **Asset Migration:** All internal `.png` assets migrated to `.gif` for better compression and consistency.
- **CSS Architecture:** Refined print specificity to ensure full content opacity regardless of interactive lockdown state.

### Fixed
- **Drag Ghost Offset:** Resolved the 16px vertical drift issue in the custom drag ghost.
- **Double Rotation Bug:** Fixed a cumulative transform error where rotation was being applied to both wrapper and container.
- **Layout Reset:** "Reset to Default" now correctly purges all non-default shapes and extractions.
- **Initialization Scope:** Fixed `ReferenceError` issues related to `ASSET_METADATA` and `parseAssets` by re-organizing script initialization order.

## [1.3.2] - 2026-03-07

### Added
- **Shapes Mode:** A new toggleable mode to decorate character sheets with custom graphical elements.
- **Shape Decoration Tool:** "Add Shape" button in the control panel to place decorative assets (Dwarf, Goth, Plants, etc.).
- **New Assets:** Added 17 new corner and vertical shape assets for the border picker.
- **Enhanced Border Picker:** Support for the new shape assets in the section border customization.
- **Persistence:** Shapes and decorations are now saved/loaded as part of the character layout.

### Changed
- **UI Architecture:** Introduced `.be-section-wrapper` to encapsulate sheet sections, preventing content clipping and improving button accessibility.
- **Robust Selectors:** Refactored `DomManager` to use attribute-based and context-aware selectors, making it resilient to D&D Beyond's obfuscated class names.
- **Initialization Logging:** Added detailed tracing for the extension's initialization lifecycle.
- **Button Handling:** Replaced simple `.onclick` handlers with `addEventListener` for better reliability on the live site.

### Fixed
- **Critical Layout Support:** Fixed the bug where the entire character sheet (`#site-main`) was hidden due to D&D Beyond's recent layout updates (e.g., the mobile navigation `<dialog>`).
- **"Deep Clean" Logic:** Refined the `DIALOG_SIBLING` selector to explicitly exclude extension-added UI (modals, feedback, controls) from being hidden during printing.
- **Save to PC:** Fixed cross-browser compatibility for downloading layout JSON files.
- **Control Panel Visibility:** Ensured the floating control panel remains visible even when aggressive "Deep Clean" styles are applied.

### Security
- Protected all extension-added DOM elements from being accidentally manipulated or hidden by site-wide CSS injections.

## [1.3.0] - Earlier 2026
- Initial release of the "Shapes" branch features (internal).
