/**
 * THE Z-INDEX DECLARATION MAP (track refactor_surface_20260911, AC-5).
 *
 * WHY: nine bare stacking literals were scattered across three modules, and the debt had already
 * cost correctness surface — the undo work had to snapshot `zIndex` defensively because of it. The
 * values are EXACTLY the literals each site carried: this is a constant-extraction, not a stacking
 * redesign, so nothing re-orders.
 *
 * READ AT CALL TIME (`window.Z.<NAME>`), because the modules that use these are evaluated before
 * this one. The two `maxZ + 1` raise-to-front ALGORITHMS are deliberately NOT merged into one
 * helper: they compute different things (one walks `style.zIndex` with a 10/110 default pair plus a
 * +100 band per section; the other takes `max(shapeZ, sectionZ + 100) + 1` over a live query), and
 * unifying them would be the behaviour change this phase is not allowed to make. That is recorded
 * as a finding for whoever next touches stacking, rather than changed here.
 */
const Z = Object.freeze({
  /** the control panel column. */
  PANEL: "10000",
  /** the colour-picker popup, above the panel. */
  PICKER: "20000",
  /** the context menu, above floating sections. */
  CONTEXT_MENU: "30000",
  /** a section's action bar, which must stay reachable over everything. */
  ACTIONS_BAR: "1000000",
  /** one whole stack step, used by the band arithmetic. */
  SHAPE_STEP: 100,
  /** the default a floating SHAPE carries when it has no explicit z-index. */
  SHAPE_DEFAULT: 110,
  /** the default a SECTION carries when it has no explicit z-index. */
  SECTION_DEFAULT: 10,
  /** the sentinel the layer-drag ghost uses. */
  TOP: "2147483647",
});

/**
 * Section utils: title discovery, section slug extraction, content
 * sanitization, and base/extraction selector helpers.
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 5. Loaded before
 * js/main.js in the production script list (js/background.js) and in
 * the shared test harness boot.
 */

"use strict";

  /**
   * Helper to identify the base selector for an element
   */
  function getBaseSelector(el) {
    // We match the pattern from DomManager selector strings
    // Assumption: The selector string IS the class selector.
    // We can extract the class name from the selector string (e.g. '[class*="-group"]' -> '-group')
    // Or just use the selector string itself as the source of truth for the regex if possible?
    // Let's use the explicit constants to build the regex logic if user insists on "no strings".
    // "No css selector" implies string literals.

    // We can derive regex from the selector string if it follows '[class*="pattern"]'

    // Or we just map them manually since regex logic is code, not selector string.
    // The "string" in the code below is the key from DomManager, or we construct the target object using DomManager values.

    const targets = [
      { pattern: /-group$/, selector: "[class*=\"-group\"]" },
      { pattern: /-snippet--class$/, selector: "[class*=\"-snippet--class\"]" },
      { pattern: /^styles_actionsList__/, selector: "[class*=\"styles_actionsList__\"]" },
      { pattern: /^styles_attackTable__/, selector: "[class*=\"styles_attackTable__\"]" },
      { pattern: /__traits$/, selector: "[class*=\"__traits\"]" },
    ];

    const classes = Array.from(el.classList);
    for (const target of targets) {
      if (
        classes.some((c) => c !== "be-extractable" && target.pattern.test(c))
      ) {
        return target.selector;
      }
    }
    return null;
  }

  /**
   * Helper to get a stable unique selector for extraction.
   * @param {HTMLElement} el The element to identify.
   * @param {boolean} includeContainers If true, includes elements inside .print-section-container.
   */
  function getExtractionSelector(el, includeContainers = false) {
    const idClass = Array.from(el.classList).find((c) =>
      c.startsWith("be-ext-"),
    );
    const selector = idClass
      ? `.${idClass}.be-extractable`
      : getBaseSelector(el);
    if (!selector) return null;

    let matches = Array.from(document.querySelectorAll(selector));
    if (!includeContainers) {
      matches = matches.filter((m) => !m.closest(".print-section-container"));
    }
    const index = matches.indexOf(el);

    if (index !== -1) {
      return { selector, index };
    }
    return null;
  }

  /**
   * Basic title discovery (to be refined in Phase 3).
   */
  function findSectionTitle(el) {
    const titleEl = el.querySelector("h1, h2, h3, h4, h5, [class*=\"head\"], [data-testid*=\"header\"], [data-testid*=\"heading\"]");
    return titleEl ? titleEl.textContent.trim() : null;
  }

  /**
   * Extracts a section name/slug from inner classes to be used as a CSS class on the wrapper.
   * Searches for ct-subsection--{name} or ct-content-group--{name}
   */
  function getSectionSlug(content) {
    if (!content) return null;

    // Check the content node itself first
    const classes = Array.from(content.classList || []);
    const matchingClass = classes.find(
      (c) =>
        c.startsWith("ct-subsection--") || c.startsWith("ct-content-group--"),
    );
    if (matchingClass) {
      return matchingClass.split("--")[1];
    }

    // Then check children
    const childWithClass = content.querySelector(
      '[class*="ct-subsection--"], [class*="ct-content-group--"]',
    );
    if (childWithClass) {
      const matchingChildClass = Array.from(childWithClass.classList).find(
        (c) =>
          c.startsWith("ct-subsection--") || c.startsWith("ct-content-group--"),
      );
      if (matchingChildClass) {
        return matchingChildClass.split("--")[1];
      }
    }

    return null;
  }

  /**
   * Sanitizes a content node by removing extension UI elements and preventing header duplication.
   * @param {HTMLElement} node The node to sanitize.
   * @returns {HTMLElement} A sanitized clone of the node.
   */
  function getSanitizedContent(node) {
    const clone = node.cloneNode(true);
    const toRemove = [
      ".be-clone-button",
      ".be-compact-button",
      ".be-append-button",
      ".be-section-actions",
      ".print-section-header",
      ".print-section-minimize",
      ".print-section-restore",
      ".print-section-resize-handle",
      ".ct-spells-filter",
      "menu",
    ];

    toRemove.forEach((selector) => {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    });

    // Prevent header duplication: remove top-level standardized headers
    // because new ones are added when wrapping/rendering.

    if (window.DomManager) {
      const existingHeaders = clone.querySelectorAll(
        ":scope > " + ".ct-content-group__header",
      );
      existingHeaders.forEach((h) => h.remove());
    }

    return clone;
  }


  /**
   * Applies font size and proportional scale variable to a section wrapper.
   * (Relocated from js/main.js, encapsulation track Phase 7.)
   */
  function applyFontSize(wrapper, sizeStr) {
    if (!wrapper || !sizeStr) return;

    wrapper.style.setProperty("font-size", sizeStr, "important");

    // Extract scale relative to 10px base
    let numericValue = 10;
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)(px|em|rem|%)$/);
    if (match) {
      numericValue = parseFloat(match[1]);
      const unit = match[2];
      if (unit === "%") numericValue = (numericValue / 100) * 10;
      // em/rem are tricky without root context, but we'll assume they are relative to 16px
      if (unit === "em" || unit === "rem") numericValue = numericValue * 16;

      const scale = numericValue / 10;
      wrapper.style.setProperty(
        "--be-font-scale",
        scale.toString(),
        "important",
      );
    }
  }

  /**
   * Helper to refresh Layer Manager content lists.
   * (Relocated from js/main.js, encapsulation track Phase 7. PeDom is the
   * monolith's shorthand for window.DomManager.getInstance().)
   */
  function refreshLayers() {
    try {
      const lm = window.DomManager.getInstance().getLayerManager();
      if (lm) {
        lm.refreshLayerContents();
        lm.updatePrintZIndexes(true); // Silently sync Z-index with UI order
      }
    } catch {
      // Silently fail if UI not ready
    }
  }

const SectionUtils = {
  findSectionTitle,
  getSectionSlug,
  getSanitizedContent,
  getBaseSelector,
  getExtractionSelector,
  applyFontSize,
  refreshLayers,
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = SectionUtils;
}
if (typeof window !== "undefined") {
  window.SectionUtils = SectionUtils;
}

if (typeof window !== "undefined") {
  // AC-5: the ONE z-index declaration, resolved at CALL time by every module that stacks chrome.
  window.Z = Z;
}
