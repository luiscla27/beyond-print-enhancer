# Specification: Layer Visibility and Print Fixes (v2)

## Overview
This track addresses several printing-related issues in the D&D Beyond Print Enhancer. It ensures the layer management panel is hidden during print, adds a "Disable on Print" toggle for granular control over layer visibility on paper, and guarantees that all layers are printed with full opacity, even if they are locked in the browser.

## Functional Requirements
1.  **Panel Hiding:** The layer management panel (`print-enhance-layer-manager`) must be hidden from the print view using CSS media queries.
2.  **'Disable on Print' Toggle:**
    -   Add a new toggle icon to each item in the layer management list, positioned alongside the 'eye' (visibility) and 'lock' (interactivity) icons.
    -   **Icon:** A printer icon that toggles to a printer-with-slash when disabled.
    -   **Behavior:** When disabled, the corresponding layer is hidden ONLY in the print view. Its visibility and interactivity in the browser (edit mode) remain unchanged.
3.  **Print Opacity Normalization:**
    -   Ensure that all layers (Sections and Shapes) are printed at 100% opacity.
    -   This overrides the default semi-transparency applied to locked shapes in the browser.
4.  **Persistence:**
    -   Include the state of the "Disable on Print" toggle for each layer in the persistent layout data (JSON format).
    -   Ensure that exported layouts save this state and imported layouts correctly restore it.

## Acceptance Criteria
-   The layer management panel is not visible in the browser's print preview or the final printed output.
-   Each layer in the layer manager has a working "Disable on Print" toggle.
-   Layers marked as "Disabled on Print" are hidden in the print output but remain visible in the browser.
-   Visible layers in the print output have no transparency/opacity (opacity: 1), even if they are locked.
-   Exporting and importing a layout JSON correctly saves and restores the "Disable on Print" status of all layers.

## Out of Scope
-   Adding visibility/lock controls for the layer management panel itself.
-   Changing how 'eye' and 'lock' icons behave in the browser.
