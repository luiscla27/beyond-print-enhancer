/**
 * Context Menu UI primitives.
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 1. Pure-DOM, zero
 * dependencies — loaded before js/main.js in the production script list
 * (js/background.js) and in the shared test harness boot.
 *
 * Dual registration keeps both load paths working:
 *   - content scripts (no CommonJS): window.ContextMenu + the three legacy
 *     window.* handles (public test surface preserved);
 *   - Node tests requiring this file: module.exports.
 */

"use strict";

/**
 * Creates a minimalist context menu for secondary actions.
 */
function createContextMenu() {
  const menu = document.createElement("div");
  menu.className = "be-context-menu";
  menu.style.display = "none";

  // Close menu when clicking outside
  const closeListener = (e) => {
    if (!menu.contains(e.target)) {
      menu.style.display = "none";
      document.removeEventListener("mousedown", closeListener);
    }
  };

  // Store listener on element so we can remove it if toggled manually
  menu._closeListener = closeListener;

  return menu;
}

/**
 * Toggles the visibility of a context menu.
 */
function toggleContextMenu(menu) {
  const isVisible = menu.style.display === "block";
  if (isVisible) {
    menu.style.display = "none";
    document.removeEventListener("mousedown", menu._closeListener);
  } else {
    menu.style.display = "block";
    document.addEventListener("mousedown", menu._closeListener);
  }
}

/**
 * Creates a 'More Options' trigger button.
 */
function createMenuTrigger() {
  const btn = document.createElement("button");
  btn.className = "be-more-options-button";
  btn.innerHTML = "⋮";
  btn.title = "More Options";
  return btn;
}

const ContextMenu = { createContextMenu, toggleContextMenu, createMenuTrigger };

if (typeof module !== "undefined" && module.exports) {
  module.exports = ContextMenu;
}
if (typeof window !== "undefined") {
  window.ContextMenu = ContextMenu;
  // Legacy public surface — preserved for tests and any external callers.
  window.createContextMenu = createContextMenu;
  window.toggleContextMenu = toggleContextMenu;
  window.createMenuTrigger = createMenuTrigger;
}
