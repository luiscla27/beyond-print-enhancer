# Gemini Project Instructions

## Character Encoding & Language
- **No Asian Characters:** NEVER use Asian characters (Chinese, Japanese, Korean, etc.) in any code, comments, documentation, or tool parameters (especially the `type` and `header` fields of `ask_user`).
- **Standard UTF-8/ASCII:** Only use standard ASCII and UTF-8 characters.
- **Collaborative Tone:** Prefer collaborative and descriptive language over rigid, authoritative, or "high-pressure" terms (e.g., use "We aim to" or "Please verify" instead of "MUST" or "CRITICAL").

## Workflow
- Follow the guidelines in `conductor/workflow.md`.
- Keep the implementation plan (`plan.md`) updated.
- Maintain tests for all new features and bug fixes.
- **Commit Safety:** ALWAYS run all `mocha` tests and ensure they pass before performing any `git commit`. Never commit broken code.

## Asset Management
- **Shapes Synchronization:** When scanning or adding new assets to the `assets/shapes/` directory, ensure they are added to the `ASSET_METADATA` constant in `js/main.js` with `"isBackground": true`.
- **Large Assets:** Follow the instructions in `compress-large-images.md` for any asset larger than 150KB.
