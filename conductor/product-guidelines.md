# Product Guidelines

## Visual Identity
- **Philosophy:** "Utility First." The design prioritization is purely functional, aiming to convert a screen-first UI into a paper-first layout.
- **Color Palette:** Strictly High Contrast Black & White.
    - Text: Forced Black (#000000) for maximum legibility on printed paper.
    - Backgrounds: Forced White (#FFFFFF) to save ink and ensure clean printing.
    - Borders: Thin black solid lines (e.g., `border: thin black solid`) for clearly defining sections like the defenses box.
- **Typography:**
    - Font sizes for headings and data items are reduced (e.g., `12px`) to fit more density on the page.
    - Key stats (like HP) are enlarged (e.g., `40px`) for visibility at a glance.

## Interaction Design (UX)
- **Zero-Click Print Readiness:** The user experience is designed to be "click once, then print."
    - **No Navigation:** All navigation elements (tabs, menus, portals) are stripped away. The user should never need to "navigate" the sheet once the extension is active.
    - **Expanded View:** "Hidden" information that usually requires clicks (like expanding the 'Defenses' modal or switching tabs to 'Spells') is programmatically extracted and rendered statically on the main page.
- **Destructive UI:** The extension actively removes interactive elements that don't make sense on paper (e.g., "Short Rest" buttons, "Manage Custom" links, filter toggles).

## Technical Principles
- **DOM Manipulation:** The extension operates by directly manipulating the existing DOM of the D&D Beyond character sheet.
    - **Cloning & Relocation:** Elements like the 'Defenses' pane are cloned from their original sidebar location and injected into the main combat tablet.
    - **Style Overrides:** Inline styles are aggressively used to override site defaults (e.g., setting margins/padding to 0, forcing colors).
