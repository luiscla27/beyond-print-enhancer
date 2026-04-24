# Technology Stack

## Core Platform
- **Type:** Web Browser Extension
- **Manifest Version:** 3 (Chrome Extension)
- **Permissions:** `declarativeContent`, `activeTab`, `scripting`, `contextMenus`, `web_accessible_resources` (for assets)

## Languages & Runtime
- **JavaScript:** Vanilla ES6+ for content scripts and background service workers.
- **Node.js:** Used primarily for development tooling (ESLint).

## Libraries & Frameworks
- **DOM Manipulation:** No external frameworks (e.g., React/Vue). Directly uses native Browser APIs for high-performance DOM traversal and manipulation on the character sheet.
- **Image Processing:** Native **Canvas API** for client-side image resizing and compression; **FileReader API** for Base64 conversion of user-uploaded assets.
- **Layer Infrastructure:** Viewport-filling `position: fixed` containers for isolating interaction layers (Sections vs. Shapes).
- **Storage:** **IndexedDB (Version 4)** for persistent layout data and global custom shape assets; Browser Download API for JSON export.
- **Layout Schema:** Versioned JSON (current: 1.5.0) storing element positions, visibility, and multi-layer shape configurations.
- **CSS:** Inline style injection via JavaScript for overriding D&D Beyond's default layout.
- **Layout Stabilization:** Global interceptors for window resize events and propagation stopping to prevent responsive re-renders.
 
 ## Tooling- **Linting:** ESLint for code quality and consistency.
- **Testing:** Mocha for unit and manifest validation tests.
