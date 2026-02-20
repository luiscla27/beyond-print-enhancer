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
- **Storage:** IndexedDB for persistent layout data; Browser Download API for JSON export.
- **CSS:** Inline style injection via JavaScript for overriding D&D Beyond's default layout.

## Tooling
- **Linting:** ESLint for code quality and consistency.
- **Testing:** Mocha for unit and manifest validation tests.
