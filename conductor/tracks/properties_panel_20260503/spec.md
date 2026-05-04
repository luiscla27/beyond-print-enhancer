# Specification: Properties Panel

## Overview
Introduce a new "Properties Panel" in the main UI, positioned directly above the existing "Hue Shift Colors" sliders in the control panel. This panel will serve as a centralized hub to manage specific visual attributes (Font Size, Compact Mode, Border Style) for individual sections. It provides a persistent alternative to the current popup modals for numerical/boolean values, while reusing existing complex modals where appropriate.

## Functional Requirements

### 1. Active Section State
- Introduce the concept of an "Active Section".
- A user can mark a section as "Active" (e.g., by clicking it or via a new "Select" button in the section actions).
- Only one section can be active at a time.
- The active section should have a distinct visual indicator (e.g., a persistent highlight or border) to distinguish it from the hover state.

### 2. Properties Panel UI
- **Location:** Positioned in the global control panel, immediately above the hue sliders.
- **Empty State:** When no section is active, the panel should be disabled or display a message instructing the user to select a section.
- **Controls:**
  - **Font Size Slider:** A range slider that dynamically adjusts the font size of the active section in real-time.
  - **Compact Mode Toggle:** A switch/checkbox to enable or disable compact mode for the active section.
  - **Border Style Selector:** A button displaying a thumbnail preview of the currently selected border style for the active section. Clicking this button will open the existing Border Picker Modal (`showBorderPickerModal`).

### 3. Real-Time Interaction
- Changes made in the Properties Panel (e.g., sliding the font size) must instantly reflect on the active section (Live Update).
- When the active selection changes, the controls in the Properties Panel must immediately sync with the current state (font size, compact status, current border thumbnail) of the newly activated section.
- If the Border Picker Modal is used via the panel's button, confirming the modal will update both the section and the panel's thumbnail.

### 4. Redundancy & Alternatives
- The new panel must work as a direct alternative to the existing floating modals/buttons.
- Modifying a property via the panel must have the exact same effect as doing it via the section's action buttons.

## Out of Scope
- Modifying global styles (other than the specific section attributes mentioned).
- Adding new properties beyond Font Size, Compact Mode, and Border Style at this time.
