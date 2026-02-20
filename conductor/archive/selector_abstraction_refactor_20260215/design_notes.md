# Design Notes: Selector Abstraction Layer

## Overview
This document outlines the design for the `DomManager` and `ElementWrapper` classes to abstract DOM interactions.

## Architecture

### 1. `ElementWrapper`
A lightweight wrapper around `HTMLElement`.

**Properties:**
- `element`: The underlying native HTMLElement.

**Methods:**
- **Visibility:** `show()`, `hide()`, `toggle()`, `isVisible()`.
- **Styling:** `css(property, value)`, `setStyle(stylesObj)`.
- **Classes:** `addClass(...names)`, `removeClass(...names)`, `toggleClass(name)`, `hasClass(name)`.
- **Attributes/Data:** `attr(name, value)`, `removeAttr(name)`, `data(key, value)`.
- **Traversal:** `find(selector)`, `findAll(selector)`, `parent()`, `closest(selector)`.
- **Manipulation:** `append(child)`, `prepend(child)`, `remove()`, `empty()`, `text(value)`, `html(value)`.
- **Events:** `on(event, handler)`, `off(event, handler)`, `click()`.
- **Misc:** `clone(deep)`, `getBoundingClientRect()`.

### 2. `DomManager`
A static service (or singleton) to manage selectors and retrieve wrapped elements.

**Constants:**
- `SELECTORS`: A nested object containing all hardcoded selector strings.
    - `CORE`: `SHEET_DESKTOP`, `SIDEBAR`, `NAV_TABS`, `QUICK_INFO`, etc.
    - `SPELLS`: `CONTAINER`, `ROW`, `FILTER`, etc.

**Methods:**
- **Core Retrieval:**
    - `getCharacterSheet()`: Returns `ElementWrapper`.
    - `getSidebar()`: Returns `ElementWrapper`.
    - `getNavigationTabs()`: Returns `ElementWrapper[]`.
    - `getQuickInfo()`: Returns `ElementWrapper`.
- **Utility:**
    - `wrap(element)`: Returns new `ElementWrapper(element)`.
    - `create(tagName, classes, attributes)`: Creates a new element and returns `ElementWrapper`.

## Migration Strategy (Phase 1)
1.  Implement `ElementWrapper` and `DomManager`.
2.  Populate `DomManager.SELECTORS.CORE`.
3.  Refactor `main.js`:
    - Replace `document.querySelector('.ct-character-sheet-desktop')` with `DomManager.getCharacterSheet()`.
    - Replace `navTabs.style.display = 'none'` with `DomManager.getNavigationTabs().forEach(t => t.hide())`.
