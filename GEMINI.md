# Gemini Project Instructions

## Character Encoding & Language
- **No Asian Characters:** NEVER use Asian characters (Chinese, Japanese, Korean, etc.) in any code, comments, documentation, or tool parameters (especially the `type` and `header` fields of `ask_user`).
- **Standard UTF-8/ASCII:** Only use standard ASCII and UTF-8 characters.
- **Collaborative Tone:** Prefer collaborative and descriptive language over rigid, authoritative, or "high-pressure" terms (e.g., use "We aim to" or "Please verify" instead of "MUST" or "CRITICAL").

## Workflow
- Follow the guidelines in `vendor/conductor/workflow.md`.
- Keep the implementation plan (`plan.md`) updated.
- Maintain tests for all new features and bug fixes.
- **Conductor tracks are working state, not history (operator rule 2026-10-03).** A live track
  under `conductor/tracks/` is NOT versioned — it enters git only when it is archived to
  `conductor/archive/`. Do not flag an untracked/modified live track (or its `plan.md` /
  `metadata.json`) as missing-commit debt; that is the intended state. In THIS public project the
  whole `conductor/` tree lives under the gitignored `vendor/` overlay, so both live and archived
  tracks stay out of history here by layout — the rule is stated so agents do not misread that as a
  gap. (msf-side reconciliation of the canonical skill's "committed with the phase" wording is
  handed off as an MD issue to `modelstack_framework/temp/issues/`.)
- **CRITICAL MANDATE - Commit Safety:** You MUST NEVER perform a `git commit` unless you have JUST executed all `mocha` tests and verified that they pass. Committing broken or unverified code is strictly prohibited.

## Asset Management
- **Shapes Synchronization:** When scanning or adding new assets to the `assets/shapes/` directory, ensure they are added to the `ASSET_METADATA` constant in `js/main.js` with `"isBackground": true`.
- **Large Assets:** Follow the instructions in `compress-large-images.md` for any asset larger than 150KB.

## UI Design & Isolation
- **Aggressive Hiding (Deep Clean):** The project uses a "Deep Clean" CSS rule in `js/main.js` to hide site-native elements. ALL new floating UI elements (panels, modals, layers) MUST be explicitly excluded from this rule.
- **Cloning & Layer Integrity:** 
    - When creating clones (manual or automatic), ALWAYS append the new elements to the **Sections Layer** (`PeDom().getSectionsLayer()`) and NOT the Shapes Layer.
    - Clones MUST be tagged with the `be-clone` class.
- **Robust Selectors:**
    - **Skills Detection:** Support both `.ct-skills__box` and `.ct-subsection--skills` to account for different character sheet layouts.
    - **Skill Stats:** Check both `.ct-skills__item--stat` and `.ct-skills__col--stat` when identifying skill ability scores.
- **Action Button Exclusion:** Any specialized action buttons injected into sections (e.g., the Splitter button) MUST be explicitly removed from cloned instances to prevent redundant or recursive UI.
- **Naming Conventions:** 
    - IDs for persistent UI elements MUST start with `print-enhance-` (e.g., `print-enhance-layer-manager`).
    - Classes for persistent UI elements MUST start with `be-` (e.g., `be-layer-panel`).
    - Failure to follow these prefixes will result in the UI being hidden by the `DIALOG_SIBLING` selector.
- **Fixed Overlays:** Always ensure fixed overlays have a higher `z-index` than 30000 to clear both site-native modals and extension-added sections.
