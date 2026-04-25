# Gemini Project Instructions

## Character Encoding & Language
- **No Asian Characters:** NEVER use Asian characters (Chinese, Japanese, Korean, etc.) in any code, comments, documentation, or tool parameters (especially the `type` and `header` fields of `ask_user`).
- **Standard UTF-8/ASCII:** Only use standard ASCII and UTF-8 characters.
- **Collaborative Tone:** Prefer collaborative and descriptive language over rigid, authoritative, or "high-pressure" terms (e.g., use "We aim to" or "Please verify" instead of "MUST" or "CRITICAL").

## Workflow
- Follow the guidelines in `conductor/workflow.md`.
- Keep the implementation plan (`plan.md`) updated.
- Maintain tests for all new features and bug fixes.
- **CRITICAL MANDATE - Commit Safety:** You MUST NEVER perform a `git commit` unless you have JUST executed all `mocha` tests and verified that they pass. Committing broken or unverified code is strictly prohibited.

## Asset Management
- **Shapes Synchronization:** When scanning or adding new assets to the `assets/shapes/` directory, ensure they are added to the `ASSET_METADATA` constant in `js/main.js` with `"isBackground": true`.
- **Large Assets:** Follow the instructions in `compress-large-images.md` for any asset larger than 150KB.

## UI Design & Isolation
- **Aggressive Hiding (Deep Clean):** The project uses a "Deep Clean" CSS rule in `js/main.js` to hide site-native elements. ALL new floating UI elements (panels, modals, layers) MUST be explicitly excluded from this rule.
- **Naming Conventions:** 
    - IDs for persistent UI elements MUST start with `print-enhance-` (e.g., `print-enhance-layer-manager`).
    - Classes for persistent UI elements MUST start with `be-` (e.g., `be-layer-panel`).
    - Failure to follow these prefixes will result in the UI being hidden by the `DIALOG_SIBLING` selector.
- **Fixed Overlays:** Always ensure fixed overlays have a higher `z-index` than 30000 to clear both site-native modals and extension-added sections.
