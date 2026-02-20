# Track: Selector Abstraction Refactor

## Overview
This track aims to reduce the codebase's tight coupling to D&D Beyond's CSS classes and DOM structure by introducing a centralized abstraction layer. The current implementation relies on scattered `document.querySelector` calls using specific class names, making the extension fragile to site updates. We will implement a `DomManager` service that encapsulates all DOM querying and manipulation logic, returning safe Data Objects/Proxies instead of raw elements. This ensures that if D&D Beyond changes its markup, we only need to update the `DomManager`, not the entire extension.

## Goals
1.  **Centralize Selectors:** Move all hardcoded CSS selectors from scattered files into a single, organized structure within `DomManager`.
2.  **Abstract DOM Interaction:** Replace direct DOM manipulation in feature code with semantic methods provided by `DomManager` (e.g., `sheet.getSpells()`).
3.  **Enhance Robustness:** Ensure the new abstraction returns Data Objects/Proxies that provide safe methods for interaction (e.g., `.hide()`, `.getData()`), protecting the core logic from DOM changes.
4.  **Phased Migration:** Execute the refactor in strict layers (Selectors -> Accessors -> Logic) to minimize regression risk.

## Functional Requirements

### 1. `DomManager` Service
-   **Singleton/Static Class:** A central `DomManager` class or module.
-   **Selector Repository:** A private or protected internal structure mapping semantic names (e.g., `SPELL_ROW`, `PAGE_CONTAINER`) to actual CSS selector strings.
-   **Initialization:** Must be able to initialize and cache references to key root elements (e.g., the main character sheet container) on load.

### 2. Data Objects / Proxies
-   **Wrappers:** Methods must return custom objects (e.g., `SpellNode`, `ActionRow`) that wrap the underlying `HTMLElement`.
-   **Safe Methods:** These wrappers must expose semantic methods for common operations:
    -   `isVisible()`
    -   `toggle()` / `hide()` / `show()`
    -   `getTextContent()` / `getAttribute()`
    -   `getChildren()` (returning wrapped children)

### 3. Migration Scope
-   **Phase 1 (Core Layout):** Main container, sidebar, header, navigation tabs, and basic page structure.
-   **Phase 2 (Spells):** Spell lists, spell headers, individual spell rows, spell detail panes/descriptions, and filter controls.
-   **Phase 3 (Everything Else):** Actions, Equipment, Features, Traits, Description, Notes, Extras.

## Non-Functional Requirements
-   **Zero Regression:** The refactor must not break any existing functionality (printing, cloning, extraction, persistence).
-   **Performance:** The abstraction layer must not introduce significant overhead (e.g., excessive DOM querying or object creation).
-   **Maintainability:** The `DomManager` must be well-documented and organized to easily accommodate future D&D Beyond changes.
