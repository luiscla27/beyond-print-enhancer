# Track Specification: Project Modernization & Stabilization

## Context
The project "dndbeyond-printenhance" is a Chrome extension that is approximately 2 years old. It was originally built to improve the printing experience of D&D Beyond character sheets by manipulating the DOM to remove unnecessary elements and expand tabbed content. Since its last update, both the Chrome extension platform (Manifest V3 enforcement) and the D&D Beyond website structure may have changed, potentially breaking the extension or making it non-compliant.

## Goals
1.  **Ensure Manifest V3 Compliance:** Verify that the extension is fully compliant with Chrome's Manifest V3 requirements, particularly regarding service workers and permissions.
2.  **Modernize Tooling:** Update the development tooling (ESLint) to current standards to ensure code quality and compatibility with modern JavaScript features.
3.  **Restore/Verify Functionality:** Audit and fix the DOM manipulation logic (`js/main.js`) to ensure it correctly interacts with the current version of the D&D Beyond character sheet, accounting for any CSS class or structural changes on the target site.

## In Scope
-   Reviewing and updating `manifest.json`.
-   Upgrading `eslint` and updating configuration files (`.eslintrc.js`).
-   Auditing `js/background.js` (service worker) for V3 compliance.
-   Auditing `js/main.js` (content script) against a live or saved D&D Beyond character sheet structure.
-   Refactoring deprecated API usage.

## Out of Scope
-   Adding new features (e.g., PDF export, custom styling options).
-   Supporting browsers other than Chrome/Chromium-based browsers.
-   Rewriting the extension in a framework (React/Vue) - we are sticking to vanilla JS as per the tech stack.

## Key Changes
-   **Manifest:** Ensure `manifest_version` is 3, check `background.service_worker`, and verify `action` vs `browser_action`.
-   **Dependencies:** `npm install` / `npm update` for dev dependencies.
-   **Code:** potential selector updates in `main.js` if D&D Beyond class names have changed (e.g., `.ct-quick-nav__toggle`, `.ct-component-carousel`).
