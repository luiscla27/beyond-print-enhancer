/**
 * Layout ops: portrait / quick-info / ability separation, search-box
 * cleanup and inner-content width adjustments.
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 8. Loaded before
 * js/main.js in the production script list (js/background.js) and in
 * the shared test harness boot.
 *
 * Cross-boundary seams (ratified 2026-09-07): main-closure helpers
 * removeSpecificSvgs / createDraggableContainer / safeLog and the
 * PeDom() shorthand are resolved lazily at call time via the public
 * window handles / window.DomManager — never captured at module load,
 * since this module loads before main.js.
 */

"use strict";

/**
 * Moves the character portrait to the primary box.
 */

function movePortrait() {
  // User Request: Append .ddbc-character-avatar__portrait to .ct-subsection.ct-subsection--primary-box
  const portrait = document.querySelector(".ddbc-character-avatar__portrait");
  // UI.PRIMARY_BOX might be .ct-primary-box, check if we have the specific subsection target
  // The previous code targeted .ct-subsection.ct-subsection--primary-box
  const target = document.querySelector(
    ".ct-subsection.ct-subsection--primary-box",
  );

  if (portrait && target) {
    // Ensure portrait is visible and styled properly
    portrait.style.display = "block";
    portrait.style.width = "100%";
    portrait.style.height = "auto"; // Maintain aspect ratio

    target.appendChild(portrait);
    window.safeLog?.("log", "[DDB Print] Moved character portrait.");
  } else {
    if (!window.__DDB_TEST_MODE__) {
      window.safeLog?.(
        "warn",
        "[DDB Print] Could not find portrait or target to move.",
      );
    }
  }
}

/**
 * Relocates defense information.
 */

function moveDefenses() {
  const defensesSection =
    document.querySelector(".ct-sidebar__section--defenses") ||
    document.querySelector("[class*=\"sidebar__section--defenses\"]");
  if (!defensesSection) return;

  const elem = defensesSection.cloneNode(true);
  window.removeSpecificSvgs(elem); // Ensure SVGs are removed from Defenses clone

  // Remove header
  const header =
    elem.querySelector(".ct-sidebar__section-header") ||
    elem.querySelector("[class*=\"sidebar__section-header\"]");
  if (header) header.remove();

  const combatTablet =
    document.querySelector(".ct-status-summary-bar") ||
    document.querySelector("[class*=\"status-summary-bar\"]");

  if (combatTablet) {
    const container = document.createElement("div");
    container.style["border"] = "thin black solid";
    container.style["margin-top"] = "10px";
    container.appendChild(elem);
    combatTablet.parentElement.appendChild(container);
  }
}

/**
 * Moves Quick Info to a draggable container.
 */

function moveQuickInfo() {
  // User Request: Make .ct-quick-info draggable
  let quickInfo;
  const dom = window.DomManager.getInstance();
  const wrapper = dom.getQuickInfo();
  quickInfo = wrapper ? wrapper.element : null;

  if (quickInfo) {
    const layoutRoot = window.DomManager.getInstance().getLayoutRoot().element;
    if (layoutRoot) {
      // Clone it? Or move it? Moving is safer for events, but cloning preserves original structure if needed.
      // Let's move it to preserve functionality.
      const container = window.createDraggableContainer(
        "Quick Info",
        quickInfo,
        "section-Quick-Info",
      );
      window.DomManager.getInstance().getSectionsLayer().element.appendChild(container);

      // Ensure it's visible if parent was hidden
      quickInfo.style.display = "flex";
      // quickInfo usually has fixed position/margin in normal sheet, reset it
      quickInfo.style.position = "static";
      quickInfo.style.margin = "0";
    }
  }
}

/**
 * Separates ability scores into individual draggable sections.
 * This function:
 * 1. Identifies all ability score elements using DomManager selectors.
 * 2. Wraps each ability in a new draggable 'print-section-container'.
 * 3. Applies the 'ability_border' style by default.
 * 4. Moves the elements to the print layout wrapper.
 * 5. Performs specific SVG removal for each new container.
 * 6. Destroys the original empty parent sections to clean up the UI.
 */

function separateAbilities() {
  const abilities = document.querySelectorAll(".ct-quick-info__ability");
  const layoutRoot = document.getElementById("print-layout-wrapper");

  if (!abilities.length || !layoutRoot) return;

  window.safeLog?.("log", `[DDB Print] Separating ${abilities.length} abilities...`);

  const parentsToRemove = new Set();

  abilities.forEach((ability, index) => {
    const parentSection = ability.closest("section");
    if (parentSection) parentsToRemove.add(parentSection);

    const nameEl = ability.querySelector(".ct-quick-info__ability-name");
    const name = nameEl ? nameEl.textContent.trim() : `Ability ${index + 1}`;
    const id = `section-Ability-${name}`;

    // Create container and MOVE the element
    const wrapper = window.createDraggableContainer(name, ability, id);
    const innerContainer = wrapper.querySelector(".print-section-container");

    // Default to ability border (if not overridden by saved layout later)
    innerContainer.classList.add("ability_border");

    window.DomManager.getInstance().getSectionsLayer().element.appendChild(wrapper);

    // Targeted SVG Removal for the new section
    window.removeSpecificSvgs(innerContainer);

    // Reset internal styles to fit new container
    ability.style.margin = "0";
    ability.style.width = "100%";
    ability.style.display = "flex";
    ability.style.flexDirection = "column";
    ability.style.alignItems = "center";
  });

  // Destroy empty parents
  parentsToRemove.forEach((p) => p.remove());
}

/**
 * Separates individual Quick Info boxes (AC, Initiative, etc.) into draggable sections.
 */

function separateQuickInfoBoxes() {
  const boxes = document.querySelectorAll(".ct-quick-info__box");
  const layoutRoot = document.getElementById("print-layout-wrapper");

  if (!boxes.length || !layoutRoot) return;

  window.safeLog?.(
    "log",
    `[DDB Print] Separating ${boxes.length} quick-info boxes...`,
  );

  const parentsToRemove = new Set();

  boxes.forEach((box, index) => {
    // Collect parent for cleanup (usually .ct-quick-info)
    const parentGroup = box.closest(".ct-quick-info");
    if (parentGroup) parentsToRemove.add(parentGroup);

    const labelEl = box.querySelector(
      ".ct-quick-info__box-label",
    );
    const label = labelEl ? labelEl.textContent.trim() : `Box ${index + 1}`;
    const id = `section-Box-${label.replace(/\s+/g, "-")}`;

    // Create container and MOVE the element
    const wrapper = window.createDraggableContainer(label, box, id);
    const innerContainer = wrapper.querySelector(".print-section-container");

    // Default to box border
    innerContainer.classList.add("box_border");

    window.DomManager.getInstance().getSectionsLayer().element.appendChild(wrapper);

    // Targeted SVG Removal for the new section
    window.removeSpecificSvgs(innerContainer);

    // Reset internal styles
    box.style.margin = "0";
    box.style.width = "100%";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.alignItems = "center";
  });

  // Extract Health if present (User Request)
  const health = document.querySelector(".ct-quick-info__health");
  if (health) {
    // Only extract if it hasn't been extracted yet
    if (!document.getElementById("section-Quick-Info-Health")) {
      const wrapper = window.createDraggableContainer(
        "Health",
        health,
        "section-Quick-Info-Health",
      );
      const innerContainer = wrapper.querySelector(
        ".print-section-container",
      );
      // Remove the header inside health if it exists to avoid duplication/weirdness
      // We can't easily remove h1 if it's needed, but let's trust CSS to handle display

      window.DomManager.getInstance().getSectionsLayer().element.appendChild(wrapper);

      // Fix health display
      health.style.display = "block";
      health.style.position = "static";
      health.style.width = "100%";

      window.removeSpecificSvgs(innerContainer);

      // Mark parent for removal if health was inside it
      const parentGroup = health.parentElement; // usually .ct-quick-info
      if (parentGroup && parentGroup.matches(".ct-quick-info")) {
        parentsToRemove.add(parentGroup);
      }
    }
  }

  // Destroy empty groups
  parentsToRemove.forEach((p) => p.remove());
}

/**
 * Drag and Drop Engine
 */

function removeSearchBoxes() {
  const searchSelectors = [
    ".header-wrapper",
    "input[type=\"search\"]",
    "[class*=\"filter\"]",
    // Add DomManager selectors
    ".ct-spells-filter",
    ".ct-equipment__filter",
    ".ct-inventory__filter",
    ".ct-extras__filter",
    ".ct-features__management-link",
  ].filter(Boolean); // Filter out undefineds

  // Flatten and query
  const allSelectors = searchSelectors.join(",");
  document.querySelectorAll(allSelectors).forEach((el) => {
    // User Request: Preserve Filters on Live Spells Tab
    // Check if element is inside Spells container (or is the spells filter itself checking ancestors)
    if (el.closest(".ct-spells") || el.closest('[data-testid="SPELLS"]')) {
      return;
    }
    el.remove();
  });
}

/**
 * Adjusts the width of immediate children of specific containers based on resize delta.
 */

function adjustInnerContentWidth(section) {
  // User Request: Scan for containers ending in "-row-header" or "-content"
  const containers = section.querySelectorAll(
    'div[class$="-row-header"], div[class$="-content"]',
  );

  // Find the master parent content width
  const parentContent = section.querySelector(".print-section-content");
  if (!parentContent) return;

  // Use padding-box width (clientWidth) or computed width
  // The previous logic relied on delta, but user wants EXACT match to parent.
  // However, .print-section-content might have padding, so inner divs should likely match CLIENT width.
  const parentWidth = parentContent.clientWidth;

  if (!parentWidth) return;

  containers.forEach((container) => {
    // User Request: Override width of IMMEDIATE divs
    Array.from(container.children).forEach((child) => {
      if (child.tagName === "DIV") {
        // Set width to match the PARENT content width
        child.style.setProperty("width", `${parentWidth}px`, "important");
        child.style.setProperty("min-width", `${parentWidth}px`, "important");
      }
    });
  });
}


const LayoutOps = {
  movePortrait,
  moveDefenses,
  moveQuickInfo,
  separateAbilities,
  separateQuickInfoBoxes,
  removeSearchBoxes,
  adjustInnerContentWidth,
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = LayoutOps;
}
if (typeof window !== "undefined") {
  window.LayoutOps = LayoutOps;
}
