/*
Licensed under Blue Oak Model License 1.0.0
*/

(function () {






  if (window.__DDB_PRINT_ENHANCE_INITIALIZED__) {
    safeLog("log", "[DDB Print Enhance] Already initialized.");
    return;
  }

  window.__DDB_PRINT_ENHANCE_INITIALIZED__ = true;
  window.skillsSplit = false;

  // Encapsulated module js/context_menu.js (loaded before main.js in the
  // production script list and the shared test harness boot). The public
  // window.* handles for the menu primitives now come from the module.
  // NOTE: fail-open (`|| {}`) is intentional — a handful of test suites boot
  // main.js standalone (page-script templates) and never invoke the menu
  // paths; throwing here would break them. The menu primitives only throw if
  // actually called while the module is absent (a load-order wiring bug).
  const { createContextMenu, toggleContextMenu, createMenuTrigger } =
    window.ContextMenu || {};

  // Encapsulated module js/asset_catalog.js (pure data: border/shape
  // asset lists, metadata, parseAssets categorizer). Loaded before
  // main.js in the production script list and the shared harness boot.
  // Fail-open defaults keep standalone-boot suites load-safe; the picker
  // simply lists no assets if the module was not wired in.

  // Encapsulated module js/storage.js (IndexedDB data-access layer:
  // layouts, global filters/hue, custom shapes, spell cache,
  // migrate/validate). Loaded before main.js in the production script
  // list and the shared harness boot.
  // Seam (ratified): the module registers on window.__DDBStorage so
  // suites that pre-stub window.Storage keep their exact pre-extraction
  // clobber timing via the window.Storage export at the end of this IIFE.
  const Storage = window.__DDBStorage || {};

  // Encapsulated module js/image_processor.js (canvas read/resize/compress)
  // is consumed by js/shape_picker.js via window.ImageProcessor; main.js no
  // longer references it directly.

  // Encapsulated module js/section_utils.js (title/slug/sanitize +
  // extraction selector helpers + shared DOM helpers applyFontSize /
  // refreshLayers, relocated here in Phase 7).
  const SectionUtils = window.SectionUtils || {};
  const { findSectionTitle, getSectionSlug, getSanitizedContent, getExtractionSelector, applyFontSize, refreshLayers } = SectionUtils;

  // Encapsulated module js/print_styles.js (print CSS + layout-bounds
  // generation).
  const PrintStyles = window.PrintStyles || {};
  const { updatePrintStyles, updateLayoutBounds, drawPageSeparators, injectCompactStyles, enforceFullHeight } = PrintStyles;

  const AssetCatalog = window.AssetCatalog || {};
  const ASSET_METADATA = AssetCatalog.ASSET_METADATA || {};

  // Encapsulated module js/section_cloning.js (clone/extract section
  // snapshots + rollback). Loaded before main.js in the production script
  // list and the shared harness boot.
  const SectionCloning = window.SectionCloning || {};
  const { captureSectionSnapshot, renderClonedSection, rollbackSection, rollbackExtraction } = SectionCloning;

  // Encapsulated module js/layout_ops.js (portrait/quick-info/ability
  // separation, search-box cleanup, inner-content width). Loaded before
  // main.js in the production script list and the shared harness boot.
  const LayoutOps = window.LayoutOps || {};
  const { movePortrait, moveDefenses, moveQuickInfo, separateAbilities, separateQuickInfoBoxes, removeSearchBoxes, adjustInnerContentWidth } = LayoutOps;

  // Encapsulated module js/filters.js (global filter CSS + border-style
  // helpers). Loaded before main.js in the production script list and the
  // shared harness boot.
  const Filters = window.Filters || {};
  const { applyGlobalFilters, clearBorderStyles, applyBorderStyle } = Filters;

  // Encapsulated module js/spells_ui.js (floating spell detail sections +
  // spell fetch/cache). Loaded before main.js in the production script list
  // and the shared harness boot.
  const SpellsUi = window.SpellsUi || {};
  const { createSpellDetailSection, getCharacterId, fetchSpellWithCache, getCharacterSpells, injectSpellDetailTriggers } = SpellsUi;

  // Encapsulated modules js/modals.js + js/shape_picker.js (modal toolkit
  // and the shape/border asset picker). Loaded before main.js in the
  // production script list and the shared harness boot.
  const Modals = window.Modals || {};
  const { showInputModal, showFallbackModal, showFeedback } = Modals;

  /**
   * AC-5 (U-17): show a persistent "nothing found" state.
   *
   * The three former call sites raised a toast, which expired after 3s — so a
   * user who looked away had no explanation for why nothing opened. This resolves
   * the dialog seam at CALL time via `window.Modals` (working note 5: js/modals.js
   * is loaded before main.js in production, but a bare unit boot may not have it),
   * and falls back to the toast rather than to silence if the seam is missing.
   */
  function emptyState(title, opts) {
    const api = Modals.showEmptyStateDialog || window.Modals && window.Modals.showEmptyStateDialog;
    if (typeof api === "function") {
      return api(Object.assign({ title }, opts || {}));
    }
    showFeedback(title + (opts && opts.message ? ` \u2014 ${opts.message}` : ""));
    return Promise.resolve(null);
  }

  /**
   * U-36: in-app confirmation instead of the native `confirm()`.
   *
   * A native confirm is unstyled, is announced as browser chrome rather than as
   * part of the product, and — the part that matters for a delete — a user who
   * has ticked "prevent this page from creating additional dialogs" gets no
   * dialog at all. Resolved through the shared modal primitive; a bare unit boot
   * without js/modals.js falls back to the native dialog so the existing
   * `window.confirm` stubs keep working.
   */
  const askConfirm = (opts) => {
    const w = typeof window !== "undefined" ? window : null;
    if (w && typeof w.confirmAction === "function") return w.confirmAction(opts);
    const text = opts.title
      ? opts.title + "\n\n" + (opts.message || "")
      : opts.message || "";
    const nativeConfirm = w && typeof w.confirm === "function" ? w.confirm.bind(w) : null;
    return Promise.resolve(nativeConfirm ? nativeConfirm(text) : false);
  };

  /**
   * Resolve the destructive-action gate at CALL time (track
   * destructive_recovery_20260911). js/persistence.js is loaded before this file in
   * both the production script list and the harness boot, but the seam is still read
   * per call rather than captured (the codebase convention), and its absence in a bare
   * harness fails OPEN by design — pinned by test/unit/destructive_recovery.test.js.
   */
  // AC-5: the gate's policy lives in ONE place now (js/recovery_ui.js's `destructiveGate`);
  // this wrapper only resolves the seam at CALL time. The fail-open for a seam-less harness is
  // kept HERE as well, because this module is also booted on its own by the unit harnesses.
  const destructiveGate = async (reason) => {
    if (typeof window.destructiveGate === "function") {
      return window.destructiveGate(reason);
    }
    return { ok: true, missing: true };
  };

  const ShapePicker = window.ShapePicker || {};
  const { showShapePickerModal, showAssetPickerModal } = ShapePicker;

  // Encapsulated modules js/properties_panel.js + js/controls.js (active-
  // section state + properties panel; the fixed control panel with filter
  // sliders and color picker). Loaded before main.js in the production
  // script list and the shared harness boot.
  const PropertiesPanel = window.PropertiesPanel || {};
  const { setActiveSection, getActiveSection, updateControlsState } = PropertiesPanel;

  const Controls = window.Controls || {};
  const { createControls } = Controls;

  // Encapsulated modules js/persistence.js + js/layout_scan.js +
  // js/layout_apply.js (user save/load flows, DOM<->layout-data
  // serialization/apply). Loaded before main.js in the production script
  // list and the shared harness boot.
  const Persistence = window.Persistence || {};
  const { handleSaveBrowser, handleSavePC, handleLoadFile, restoreLayout, applyDefaultLayout, handleLoadDefault, restoreFailureCard: showRestoreFailureCard, announceBootRestore } = Persistence;

  const LayoutScan = window.LayoutScan || {};
  const { scanLayout, migrateLayout } = LayoutScan;

  const LayoutApply = window.LayoutApply || {};
  const { applyLayout } = LayoutApply;

  const PeDom = () => window.DomManager.getInstance();

  /**
   * Initializes global hover highlights for the active layer.
   * Uses a single listener and z-index prioritization to prevent flickering on overlaps.
   */
  /**
   * Toggles the interaction mode for the shapes layer.
   */
  function toggleShapesMode(forceState) {
    const activeClass = "be-shapes-mode-active";
    const lm = window.PeDom
      ? window.PeDom().getLayerManager()
      : window.DomManager
        ? window.DomManager.getInstance().getLayerManager()
        : null;

    const isActive =
      forceState !== undefined
        ? forceState
        : !document.body.classList.contains(activeClass);

    if (isActive) {
      document.body.classList.add(activeClass);
    } else {
      document.body.classList.remove(activeClass);
    }

    if (lm) {
      // In the new system, we toggle the default shape layer or all shape layers
      const shapesLayer =
        lm.getLayerById("shapes-default") ||
        (lm.shapeLayers && lm.shapeLayers[0]);
      if (shapesLayer) {
        // In the old system, "Shapes Mode ON" meant Locked: false
        const shouldBeLocked = !isActive;

        // If the state is already what we want, do nothing to avoid feedback loops
        if (shapesLayer.isLocked === shouldBeLocked) return;

        // Find the button in the panel to keep UI in sync
        const panel = document.getElementById("print-enhance-layer-manager");
        let btn = null;
        if (panel) {
          const rows = Array.from(panel.querySelectorAll(".be-layer-row"));
          const shapesRow = rows.find(
            (r) => r.dataset.layerId === shapesLayer.id,
          );
          if (shapesRow)
            btn = shapesRow.querySelector('button[title="Toggle Edit Mode"]');
        }

        // Call the new locking logic
        lm.toggleLayerLock(shapesLayer, btn);
        return;
      }
    }

    // Fallback if LayerManager is not initialized
    const lockClass = "be-lock-shapes";
    if (isActive) {
      document.body.classList.remove(lockClass);
    } else {
      document.body.classList.add(lockClass);
    }
  }


  window.updatePrintStyles = updatePrintStyles;

  /**

  /**
   * The ONE logger (AC-5, track refactor_surface_20260911): every other module calls
   * `window.safeLog?.(...)` at CALL time, and this is the only implementation of the test-mode
   * silencing.
   *
   * DOCUMENTED DEGRADATION, not a hidden delta: a consumer whose call runs before this module has
   * evaluated — or in a harness that boots that module alone — gets `window.safeLog === undefined`
   * and the optional call DROPS the line. That is deliberate: the old per-module fallbacks each
   * carried their own `console` bridge (a second implementation, and in js/dnd.js's case one with no
   * test-mode silencing), so "log it to console anyway" is not available without re-introducing what
   * AC-5 removed. In production this module is last in the injected list and every consumer calls at
   * RUNTIME, so the seam is present; the drop applies to harness boots and to a hypothetical load
   * failure of this file, and it is silent rather than fatal by design.
   */
  function safeLog(method, ...args) {
    if (window.__DDB_TEST_MODE__) return;
    // The exemption is SCOPED to these two statements (O-4's guard requires `no-console` to be an
    // ERROR with no file-scoped allowlist), so the rule cannot be bypassed anywhere else in this file.
    if (console[method]) { // eslint-disable-line no-console
      console[method](...args); // eslint-disable-line no-console
    }  }
  window.safeLog = safeLog;





  /**
   * Calculates a snapped angle based on the step size.
   * @param {number} angle
   * @param {number} step Default 15
   */
  function calculateSnappedAngle(angle, step = 15) {
    return Math.round(angle / step) * step;
  }

  /**
   * Calculates the angle in degrees between a center point and a pointer point.
   */
  function getAngleFromPoint(cx, cy, px, py) {
    const dy = py - cy;
    const dx = px - cx;
    let theta = Math.atan2(dy, dx);
    theta *= 180 / Math.PI;
    if (theta < 0) theta = 360 + theta;
    return theta;
  }

  // Default layouts are now loaded from premade templates (catalog.json)

  /**
   * Navigate to a specific character sheet section (tab).
   */
  function navToSection(name) {
    const tabs = Array.from(
      document.querySelectorAll("button[class*=\"tabButton\"]"),
    );

    // Try matching by data-testid first (very reliable)
    const testIdMap = {
      Actions: "ACTIONS",
      Spells: "SPELLS",
      Inventory: "EQUIPMENT",
      Equipment: "EQUIPMENT",
      "Features & Traits": "FEATURES_TRAITS",
      Background: "DESCRIPTION",
      Notes: "NOTES",
      Extras: "EXTRAS",
    };

    let target = null;
    const testId = testIdMap[name];
    if (testId) {
      target = tabs.find((tab) => tab.getAttribute("data-testid") === testId);
    }

    // Fallback to text content
    if (!target) {
      target = tabs.find((tab) =>
        tab.textContent.toLowerCase().includes(name.toLowerCase()),
      );
    }

    if (target) {
      safeLog("log", `[DDB Print Enhance] Navigating to: ${name}`);
      target.click();
      return target;
    }

    safeLog(
      "error",
      `[DDB Print Enhance] Could not find tab for section: ${name}`,
    );
    return null;
  }


  /**
   * Creates a standard draggable container for extracted content.
   */
  function createDraggableContainer(title, content, id) {
    const wrapper = document.createElement("div");
    wrapper.className = "be-section-wrapper";

    // Extract and apply a specific class based on content for CSS targeting
    const slug = getSectionSlug(content);
    if (slug) {
      wrapper.classList.add(`be-section-${slug}`);
    } else {
      wrapper.classList.add("be-section-unknown");
    }

    wrapper.id = id ? `${id}-wrapper` : `wrapper-${Date.now()}`;
    wrapper.dataset.title = title; // Store title for identification
    // Track drag_ux_overhaul_20260909 (Phase 1): the wrapper is deliberately
    // NOT a native drag source (no draggable=true) — the pointer-events
    // engine in js/dnd.js arms drags after a movement threshold so text
    // selection and clicks stay intact (spec.md AC-1/AC-2).

    const container = document.createElement("div");
    container.className = "print-section-container";
    container.id = id;
    container.style.left = "";
    container.style.top = "";

    const contentWrapper = document.createElement("div");
    contentWrapper.className = "print-section-content";
    contentWrapper.appendChild(content);
    container.appendChild(contentWrapper);

    wrapper.appendChild(container);

    return wrapper;
  }

  /**
   * Collect content from all tabs and wrap them in draggable containers.
   */
  /**
   * Collect content from all tabs and wrap them in draggable containers.
   */
  async function extractAndWrapSections() {

    // Strategy: Identify sections by looking for tab buttons using DomManager
    // We strictly use the defined selectors, no more fallbacks to hardcoded lists.
    let tabs = Array.from(
      document.querySelectorAll("button[class*=\"tabButton\"]"),
    );

    // If no tabs found, we can't extract dynamic sections.
    if (tabs.length === 0) {
      safeLog(
        "warn",
        "[DDB Print] No tabs found using DomManager selectors. Extraction aborted.",
      );
      return [];
    }

    const sectionsToExtract = tabs
      .map((t) => ({
        name: t.textContent.trim(),
        title: t.textContent.trim(),
        testId: t.getAttribute("data-testid"),
      }))
      .filter((s) => s.name);

    const extractedContainers = [];

    for (const section of sectionsToExtract) {
      const target = navToSection(section.name);

      // Give React time to render. Using Promise-based delay to be safe.
      await new Promise((r) => setTimeout(r, 100));

      if (target) {
        // Priority: Find the main structural container that holds the styles
        // We use DomManager selectors
        const selectors = [
          "[class*=\"styles_primaryBox\"]",
          ".ct-primary-box",
          // Removed specific fallbacks as per user request to have NO CSS strings in main.js
        ];

        // Helper to find visible element among matches
        let content = null;
        for (const selector of selectors) {
          if (!selector) continue;
          const matches = document.querySelectorAll(selector);
          // Find one that is not hidden.
          const visibleMatch = Array.from(matches).find((el) => {
            const style = window.getComputedStyle(el);
            return style.display !== "none" && !el.classList.contains("hidden");
          });

          if (visibleMatch) {
            content = visibleMatch;
            break;
          }
        }

        if (content) {
          // Refinement: If we matched a child but the parent is the actual styled container, go up.
          if (
            content.parentElement &&
            (content.parentElement.className.includes("primaryBox") ||
              content.parentElement.className.includes("ct-primary-box"))
          ) {
            content = content.parentElement;
          }

          // User Request: DONT clone the "spells" tab (keep it live/interactive)
          // Fix: Skip Spells in the loop to avoid breaking iteration.
          // Strict Check: Use data-testid="SPELLS" if available, or name fallback
          if (
            section.name.includes("Spells") ||
            section.title.includes("Spells") ||
            section.testId === "SPELLS"
          ) {
            safeLog(
              "log",
              "[DDB Print] Skipping Spells in main loop (will handle deferred/live)",
            );
            continue;
          }

          const nodeToWrap = content.cloneNode(true);

          const clone = nodeToWrap; // Alias for existing logic compliance

          // Ensure the content is visible (it might be hidden if tab wasn't active)
          clone.style.display = "";
          clone.classList.remove("hidden"); // Remove potential utility classes for hiding

          // Cleanup: Remove unwanted elements from the clone
          // 1. Hide <menu> tags (often used for popups/context)
          clone
            .querySelectorAll("menu")
            .forEach((el) => (el.style.display = "none"));

          // 2. Hide specific filters
          clone
            .querySelectorAll('[data-testid="tab-filters"]')
            .forEach((el) => (el.style.display = "none"));

          // 3. Layout Fix: Remove Scrollbars & Fixed Heights
          // Force the container and its children to expand
          // User Request: height: fit-content !important; display: flex !important;
          clone.style.cssText +=
            "height: fit-content !important; display: flex !important; flex-direction: column !important; max-height: none !important; overflow: visible !important;";

          // Apply similar logic to internal sections that might assume fixed height
          clone.querySelectorAll("section, .ct-primary-box").forEach((el) => {
            el.style.cssText +=
              "height: fit-content !important; display: flex !important; flex-direction: column !important; max-height: none !important; overflow: visible !important;";
          });

          // Targeted SVG Removal: Use helper function
          removeSpecificSvgs(clone);

          // RE-ENABLED: Fix Background SVGs to stretch for non-border backgrounds
          const bgSvgs = clone.querySelectorAll(
            [
              ".ct-primary-box" + " > " + "svg",
              "svg.ddbc-rep-box-background__svg",
              ".ddbc-box-background" +
                ':not([style*="display: none"]) ' +
                "svg",
            ].join(", "),
          );

          bgSvgs.forEach((svg) => {
            svg.style.height = "100%";
            svg.style.width = "100%";
            if (svg.hasAttribute("height")) svg.removeAttribute("height");
            if (svg.hasAttribute("width")) svg.removeAttribute("width");
            svg.setAttribute("preserveAspectRatio", "none");
          });

          // Explicitly fix Group Boxes (Proficiency, Skills, Senses, Saving Throws)
          const groupBoxSvgs = clone.querySelectorAll(
            [
              ".ct-proficiency-groups-box svg",
              ".ct-senses-box svg",
              ".ct-skills-box svg",
              ".ct-saving-throws-box svg",
            ].join(", "),
          );
          groupBoxSvgs.forEach((svg) => {
            svg.setAttribute("preserveAspectRatio", "none");
            svg.style.width = "100%";
            svg.style.height = "100%";
          });

          // Also target potential internal scrolling containers
          clone.querySelectorAll("*").forEach((el) => {
            const tag = el.tagName.toLowerCase();
            if (
              tag === "svg" ||
              tag === "g" ||
              tag === "path" ||
              tag === "symbol" ||
              tag === "defs"
            )
              return;

            const style = window.getComputedStyle(el);
            if (
              style.overflow === "auto" ||
              style.overflow === "scroll" ||
              style.maxHeight !== "none"
            ) {
              el.style.maxHeight = "none";
              el.style.overflow = "visible";
            }
          });

          // Create a clean wrapper for the print layout
          const wrapper = document.createElement("div");
          // We do NOT blindly copy parent classes here because we just cloned the PROPER container.
          // But we can add a helper class.
          wrapper.className = "print-section-wrapper";
          wrapper.appendChild(clone);

          extractedContainers.push(
            createDraggableContainer(
              section.title,
              wrapper,
              `section-${section.name.replace(/\s+/g, "_")}`,
            ),
          );
        } else {
          safeLog(
            "warn",
            `[DDB Print] Content content not found for section: ${section.name}`,
          );
        }
      }
    }

    return extractedContainers;
  }

  /**
   * Creates and appends a new section created after the tidbits body.
   */
  function addInteractiveTidbitSection() {
    const tidbitBody = document.querySelector(".ddbc-character-tidbits__body");
    if (!tidbitBody) return;

    const nameEl = document.querySelector(".ddbc-character-tidbits__heading h1");
    const characterName = nameEl ? nameEl.textContent.trim() : "";

    // Create the content for the new section
    const content = document.createElement("div");
    content.className = "be-tidbit-extension-section";
    content.innerHTML = `
      <h3>${characterName}</h3>
    `;

    // Use the existing helper to make it draggable
    const wrapper = createDraggableContainer(
      characterName,
      content,
      "section-extra-tidbits",
    );

    // Properly integrate the original tidbits body into the draggable container's content
    const contentWrapper = wrapper.querySelector(".print-section-content");
    if (contentWrapper) {
      contentWrapper.appendChild(tidbitBody);
    }

    // Ensure it's integrated with the extension's layout system
    if (typeof PeDom !== "undefined") {
      PeDom().getSectionsLayer().element.appendChild(wrapper);
    }
  }

  /**
   * Removes specific SVGs as requested by the user.
   * 1. First .ddbc-box-background
   * 2. All section > div > svg
   */
  function removeSpecificSvgs(container) {
    if (window.__MOCK_REMOVE_SPECIFIC_SVGS__) {
      window.__MOCK_REMOVE_SPECIFIC_SVGS__(container);
      return;
    }
    if (!container) return;

    // 1. Remove first .ddbc-box-background
    const firstBg = container.querySelector(".ddbc-box-background");
    if (firstBg) {
      // User Request: Don't hide the background if it belongs to Armor Class or Initiative
      const isProtected =
        firstBg.querySelector(".ddbc-armor-class-box-svg" + ", " + ".ddbc-initiative-box-svg") ||
        firstBg.closest(".ddbc-armor-class-box" + ", " + ".ddbc-initiative-box");

      if (!isProtected) {
        firstBg.style.display = "none";
      }
    }

    // 2. Remove all section > div > svg
    // Check nested instances
    container.querySelectorAll("section > div > svg").forEach((svg) => {
      if (
        !svg.classList.contains(".ddbc-armor-class-box-svg".replace(".", "")) &&
        !svg.classList.contains(".ddbc-initiative-box-svg".replace(".", ""))
      ) {
        svg.style.display = "none";
      }
    });

    // Check if container itself matches section > div > svg pattern (e.g. if container is section)
    if (container.tagName === "SECTION") {
      container.querySelectorAll(":scope > div > " + "svg").forEach((svg) => {
        if (
          !svg.classList.contains(".ddbc-armor-class-box-svg".replace(".", "")) &&
          !svg.classList.contains(".ddbc-initiative-box-svg".replace(".", ""))
        ) {
          svg.style.display = "none";
        }
      });
    }
  }

  /**
   * Appends all collected sections to the main sheet view.
   */
  /**
   * Copies SVG definitions to the print wrapper to ensure icons render.
   */
  function copySvgDefinitions(targetContainer) {
    // Find all SVGs that might contain definitions (defs/symbol)
    // Find all SVGs that might contain definitions (defs/symbol)
    const svgs = document.querySelectorAll("svg");
    svgs.forEach((svg) => {
      if (
        svg.querySelector("svg definitions".replace("svg ", "")) ||
        svg.style.display === "none"
      ) {
        const clone = svg.cloneNode(true);
        clone.style.display = "none"; // Ensure it doesn't take up space
        targetContainer.appendChild(clone);
      }
    });
  }

  /**
   * Scans the DOM for elements that match extraction criteria and flags them.
   * Implements Top-Down Priority: nested matching elements are ignored.
   */
  /**
   * Scans the DOM for elements that match extraction criteria and flags them.
   * Implements Top-Down Priority: nested matching elements are ignored.
   * Also injects a unique-ish class based on content for stable persistence.
   */
  function flagExtractableElements() {
    const selectors = [
      "[class*=\"-group\"]",
      "[class*=\"-snippet--class\"]",
      "[class*=\"styles_actionsList__\"]",
      "[class*=\"styles_attackTable__\"]",
      "[class*=\"__traits\"]",
    ];

    const elements = Array.from(
      document.querySelectorAll(selectors.join(", ")),
    );

    elements.forEach((el) => {
      // Nesting logic: Top-Down Priority.
      // Check if any matching element strictly contains this one.
      const isNested = elements.some((other) => {
        return other !== el && other.contains(el);
      });

      if (!isNested) {
        el.classList.add("be-extractable");

        // Generate and add an extraction-specific identification class
        let title = findSectionTitle(el);
        if (!title) {
          title = el.textContent.trim().substring(0, 8);
        }

        if (title) {
          const sanitized = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");

          const idClass = `be-ext-${sanitized || "content"}`;
          el.classList.add(idClass);
        }

        // Attach extraction listener
        el.ondblclick = async (e) => {
          e.stopPropagation();
          await extractElementRecorded(el);
        };
      }
    });
  }

  /**
   * Handles the extraction of an element into a new floating section.
   */
  async function handleElementExtraction(el) {
    // 1. Ensure original has an ID for tracking
    if (!el.id) {
      el.id = `be-auto-id-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    // 2. Discover Title
    let title = findSectionTitle(el);
    if (!title) {
      title = await (window.showInputModal || showInputModal)(
        "Extract Content",
        "No title found. Enter a name for this section:",
        "Extracted Section",
      );
      if (!title) return; // User cancelled
    }

    // 3. Clone content
    const sanitizedClone = getSanitizedContent(el);
    const clone = sanitizedClone; // Alias for existing logic compliance
    clone.style.display = ""; // Ensure clone is visible
    clone.classList.remove("be-extractable"); // Avoid nested triggers in clone

    // Hide original header/title inside the clone to avoid duplication
    const originalHeader = clone.querySelector(
      'h1, h2, h3, h4, h5, [class*="head"]',
    );
    if (originalHeader) {
      originalHeader.style.display = "none";
    }

    // Create section content using a DocumentFragment to avoid extra intermediate DIVs
    const fragment = document.createDocumentFragment();

    // Standardized header
    const header = document.createElement("div");
    header.className = "ct-content-group__header";
    const headerContent = document.createElement("div");
    headerContent.className = "ct-content-group__header-content";
    headerContent.textContent = title;
    header.appendChild(headerContent);
    fragment.appendChild(header);

    // If it's a merge wrapper, we take its children to avoid redundant DIV nesting
    if (clone.classList.contains("be-merge-wrapper")) {
      while (clone.firstChild) {
        fragment.appendChild(clone.firstChild);
      }
    } else {
      fragment.appendChild(clone);
    }

    // 4. Create floating section
    const sectionId = `extracted-section-${Date.now()}`;
    const wrapper = createDraggableContainer(title, fragment, sectionId);
    wrapper.classList.add("be-extracted-section-wrapper");
    const container = wrapper.querySelector(".print-section-container");
    container.classList.add("be-extracted-section");
    container.dataset.originalId = el.id;

    // Store parent section ID for "Apply to all" and grouping logic
    const parentSection = el.closest(`.ct-subsection, .ct-section`);
    if (parentSection) {
      container.dataset.parentSectionId = parentSection.id;
    }

    // Store identification class for future merges
    const idClass = Array.from(el.classList).find((c) =>
      c.startsWith("be-ext-"),
    );
    if (idClass) container.dataset.beExtClass = idClass;

    // 5. Use delete button for rollback
    const deleteBtn = wrapper.querySelector(".be-delete-button");
    if (deleteBtn) {
      deleteBtn.title = "Rollback Extraction";
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        rollbackExtraction(container);
      };
    }

    // 6. Position and Hide Original
    const rect = el.getBoundingClientRect();
    const layoutRoot = PeDom().getLayoutRoot().element;
    const rootRect = layoutRoot.getBoundingClientRect();

    wrapper.style.position = "absolute";
    wrapper.style.left = `${rect.left - rootRect.left + rect.width + 20}px`; // To the right of original
    wrapper.style.top = `${rect.top - rootRect.top}px`;
    wrapper.style.zIndex = window.Z.PANEL; // AC-5 (was "10000")

    const innerContainer = wrapper.querySelector(".print-section-container");
    innerContainer.style.width = `${rect.width}px`;
    innerContainer.style.height = "auto";

    PeDom().getSectionsLayer().element.appendChild(wrapper);

    // In the case of spell sections, destroy original instead of hiding    // (They are ephemeral and don't have a home on the sheet to rollback to)
    const isSpell =
      el.classList.contains("be-spell-detail") ||
      el.id.startsWith("spell-detail-") ||
      el.querySelector("[data-be-spell-merge]");

    if (isSpell) {
      el.remove();
    } else {
      el.style.setProperty("display", "none", "important");
    }

    if (window.injectCloneButtons) window.injectCloneButtons(innerContainer);
    if (window.injectAppendButton) window.injectAppendButton(innerContainer);
    if (window.initResizeLogic) window.initResizeLogic();
    updateLayoutBounds();
    refreshLayers();
    showFeedback(`Extracted ${title}`);

    return wrapper;
  }




  /**
   * Gathers all potential merge targets and their display names.
   * Targets include .be-extractable (on sheet) and .be-extracted-section (floating).
   */
  function getMergeTargets() {
    const targets = [];

    // 1. Sheet Targets (be-extractable)
    document.querySelectorAll(".be-extractable").forEach((el) => {
      // Find parent section for breadcrumb
      const parentSection = el.closest(".print-section-container");
      let sectionName = "Sheet";
      if (parentSection) {
        const wrapper =
          parentSection.closest(".be-section-wrapper") || parentSection;
        sectionName =
          wrapper.dataset.title ||
          (wrapper.querySelector(".print-section-header span")
            ? wrapper
                .querySelector(".print-section-header span")
                .textContent.trim()
            : "Section");
      }

      const itemName =
        findSectionTitle(el) || el.textContent.trim().substring(0, 20);
      targets.push({
        type: "sheet",
        id: el.id,
        name: `${sectionName} > ${itemName}`,
        element: el,
      });
    });

    // 2. Floating Targets (be-extracted-section)
    document
      .querySelectorAll(".print-section-container.be-extracted-section")
      .forEach((el) => {
        const wrapper = el.closest(".be-section-wrapper") || el;
        const itemName =
          wrapper.dataset.title ||
          (wrapper.querySelector(".print-section-header span")
            ? wrapper
                .querySelector(".print-section-header span")
                .textContent.trim()
            : "Extracted Section");

        // Find the inner standardized header if it exists for extra detail
        const subHeader = el.querySelector(".ct-content-group__header-content");
        const detail = subHeader ? ` (${subHeader.textContent.trim()})` : "";

        targets.push({
          type: "section",
          id: el.id,
          name: `Floating: ${itemName}${detail}`,
          element: el,
        });
      });

    return targets;
  }

  /**
   * Injects an "Append after" button into an extracted section's header.
   */
  function injectAppendButton(container) {
    const actionContainer = getOrCreateActionContainer(container);
    if (actionContainer.querySelector(".be-append-button")) return;

    const btn = document.createElement("button");
    btn.className = "be-append-button";
    btn.innerHTML = "🔗";
    btn.title = "Append after...";

    btn.onclick = async (e) => {
      e.stopPropagation();
      const targets = getMergeTargets().filter((t) => t.element !== container);
      if (targets.length === 0) {
        // AC-5 (U-17): a dialog that stays, not a toast that expires (U-17).
        emptyState("No available targets found", {
          message: "There are no other sections on this sheet to append to.",
          hint: "Extract or clone a second section first, then use Append again.",
        });
        return;
      }

      const selectedTarget = await showTargetSelectionModal(targets);
      if (selectedTarget) {
        // AC-1: snapshot first — merging DESTROYS the source container, and until
        // now it did so with no confirmation and no way back. Gated at this USER
        // entry point, not inside handleMergeSections: the layout-apply path calls
        // that function too (js/layout_apply.js), where a gate would write a backup
        // per merge and could even block a restore when storage was tight — exactly
        // when the user needs restore most.
        const mergeGate = await destructiveGate(
          `Merge sections into "${selectedTarget.name}"`,
        );
        if (!mergeGate.ok) return;
        handleMergeSections(container, selectedTarget);
        // AC-3: the snapshot just taken IS the undo (this transform used to have no
        // confirmation AND no way back).
        window.offerUndo && window.offerUndo(mergeGate.record,
          `Merged sections into "${selectedTarget.name}"`,
        );
      }
    };

    actionContainer.appendChild(btn);
  }

  /**
   * Shows a modal to select a merge target.
   */
  function showTargetSelectionModal(targets) {
    const api = window.Modals;
    if (!api || typeof api.__createModal !== "function") {
      // Bare boot without the modal primitive: fail loudly rather than
      // silently doing nothing (a merge would look like it simply did not run).
      showFeedback("Could not open the append-target dialog. Reload the page.", "error");
      return Promise.resolve(null);
    }

    const handle = api.__createModal({
      title: "Select Append Target",
      body(ctx) {
        ctx.overlay.style.zIndex = window.Z.CONTEXT_MENU; // AC-5, above floating sections
        ctx.modal.style.width = "500px";
        ctx.modal.style.maxHeight = "80vh";
        ctx.modal.style.overflowY = "auto";

        const list = document.createElement("div");
        list.style.display = "flex";
        list.style.flexDirection = "column";
        list.style.gap = "5px";

        targets.forEach((target) => {
          const btn = document.createElement("button");
          btn.textContent = target.name;
          btn.className = ".ct-theme-button".substring(1);
          btn.type = "button";
          btn.style.textAlign = "left";
          btn.style.padding = "8px 12px";
          btn.style.width = "100%";
          btn.onclick = () => ctx.close(target);
          list.appendChild(btn);
        });
        ctx.bodyEl.appendChild(list);

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        cancelBtn.className = "be-modal-cancel";
        cancelBtn.type = "button";
        ctx.actionsRow.appendChild(cancelBtn);
        cancelBtn.onclick = () => ctx.close(null);
      },
    });

    return handle.promise;
  }

  /**
   * Handles the logic of merging one section into another target.
   */
  function handleMergeSections(sourceContainer, targetInfo) {
    const sourceContent = sourceContainer.querySelector(
      ".print-section-content",
    );
    if (!sourceContent) return;

    const sourceId = sourceContainer.dataset.originalId;
    const sourceAssociatedIds = sourceContainer.dataset.associatedIds
      ? JSON.parse(sourceContainer.dataset.associatedIds)
      : [];
    const allSourceIds = [sourceId, ...sourceAssociatedIds].filter((id) => id);

    let targetContainer = null;
    let appendTarget = null;

    if (targetInfo.type === "section") {
      targetContainer = targetInfo.element;
      appendTarget = targetContainer.querySelector(".print-section-content");
    } else {
      // Sheet target: append after the element
      appendTarget = targetInfo.element;
      // Search for the closest section container OR the sheet body wrapper
      targetContainer =
        appendTarget.closest(".print-section-container") ||
        document.getElementById("print-layout-wrapper");
    }

    if (appendTarget) {
      // Create a wrapper that mimics the target's classes (to preserve styling)
      const wrapper = document.createElement("div");
      // Copy classes from target element, but exclude our identification/trigger classes
      const targetClasses = Array.from(targetInfo.element.classList).filter(
        (c) => c !== "be-extractable" && !c.startsWith("be-ext-"),
      );
      wrapper.className = targetClasses.join(" ");

      wrapper.classList.add("be-merge-wrapper");
      // ADD BACK the essential extraction classes for the merged content itself
      wrapper.classList.add("be-extractable");
      const idClass = sourceContainer.dataset.beExtClass;
      if (idClass) wrapper.classList.add(idClass);

      // Tag for persistence if it's a group extraction
      const sourceId = sourceContainer.dataset.originalId;
      const isSpell =
        sourceContainer.classList.contains("be-spell-detail") ||
        sourceContainer.id?.startsWith("spell-detail-");

      if (!isSpell) {
        wrapper.setAttribute("data-be-group-merge", sourceId);
      }

      // Store target metadata for persistence
      wrapper.setAttribute("data-be-target-type", targetInfo.type);
      wrapper.setAttribute("data-be-target-id", targetInfo.id || "");
      if (targetInfo.type === "sheet") {
        const res = getExtractionSelector(targetInfo.element, true); // True to include elements in containers
        if (res) {
          wrapper.setAttribute("data-be-target-selector", res.selector);
          wrapper.setAttribute("data-be-target-index", res.index);
          wrapper.setAttribute("data-be-target-name", targetInfo.name || "");
        }
      }

      // Attach extraction listener to the new merged wrapper
      wrapper.ondblclick = async (e) => {
        e.stopPropagation();
        await extractElementRecorded(wrapper);
      };

      // If source is a spell detail, tag it for persistence
      const sourceWrapper =
        sourceContainer.closest(".be-section-wrapper") || sourceContainer;
      const spellName = isSpell
        ? sourceWrapper.dataset.title ||
          sourceWrapper
            .querySelector(".print-section-header span")
            ?.textContent.trim()
        : null;
      let tagged = false;

      // Move all children of sourceContent to the wrapper
      while (sourceContent.firstChild) {
        const child = sourceContent.firstChild;

        if (child.nodeType === 1) {
          // Element
          // Clear dimensions that might have been set by resize logic
          child.style.width = "";
          child.style.minWidth = "";
          child.style.height = "";

          if (isSpell && !tagged) {
            child.setAttribute("data-be-spell-merge", spellName);
            child.setAttribute("data-be-original-id", sourceId);
            tagged = true;
          }
        }
        wrapper.appendChild(child);
      }

      // Now append the wrapper to the final target
      if (targetInfo.type === "section") {
        appendTarget.appendChild(wrapper);
      } else {
        // Insert after target element on sheet
        appendTarget.parentNode.insertBefore(wrapper, appendTarget.nextSibling);
      }

      // If target is a section, track IDs for rollback
      if (targetContainer) {
        const targetAssociatedIds = targetContainer.dataset.associatedIds
          ? JSON.parse(targetContainer.dataset.associatedIds)
          : [];
        const newAssociatedIds = [...targetAssociatedIds, ...allSourceIds];
        targetContainer.dataset.associatedIds =
          JSON.stringify(newAssociatedIds);
      }

      // Destroy source container
      // (The AC-1 gate is at this action's USER entry point — see the Append
      // button — because the layout-apply path also calls this function.)
      sourceContainer.remove();
      updateLayoutBounds();
      showFeedback(`Merged into ${targetInfo.name}`);
    }
  }

  /**
   * Injects extracted clones into the live Spells view to create the print layout.
   */
  async function injectClonesIntoSpellsView() {
    const containers = await extractAndWrapSections();

    // 1. Navigate to Spells to make it the active, visible view
    await navToSection("Spells");
    await new Promise((r) => setTimeout(r, 200));

    // 2. Find the Live Spells Node (which is now visible)
    let spellsNode;
    const dom = window.DomManager.getInstance();
    const wrapper = dom.getSpellsContainer();
    spellsNode = wrapper ? wrapper.element : null;

    // Fallback to primary box if getSpellsContainer fails but we are on Spells tab?
    // If getSpellsContainer relies on a specific class that might be missing, we could try finding the visible primary box.
    if (!spellsNode) {
      // Use DomManager's generic PRIMARY_BOX selector
      const primaryBoxes = document.querySelectorAll(
        ".ct-primary-box",
      );
      spellsNode = Array.from(primaryBoxes).find((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== "none" && !el.classList.contains("hidden");
      });
    }

    if (!spellsNode) {
      if (!window.__DDB_TEST_MODE__) {
        safeLog(
          "error",
          "[DDB Print] Could not find Live Spells Node! Aborting injection.",
        );
      }
      return;
    }

    // 3. Clean up the Live Spells Node (Hide UI, Fix Layout)
    // We apply the same fixes as we did for clones, but IN PLACE.
    spellsNode
      .querySelectorAll("menu")
      .forEach((el) => (el.style.display = "none"));

    spellsNode.style.cssText +=
      "height: fit-content !important; display: flex !important; flex-direction: column !important; max-height: none !important; overflow: visible !important;";

    spellsNode
      .querySelectorAll(".ct-primary-box" + ", section")
      .forEach((el) => {
        el.style.cssText +=
          "height: fit-content !important; display: flex !important; flex-direction: column !important; max-height: none !important; overflow: visible !important;";
      });

    // Targeted SVG Removal for Spells: Use helper function
    removeSpecificSvgs(spellsNode);

    // We RESTORE the logic for other SVGs as per user request.

    const bgSvgs = spellsNode.querySelectorAll(
      [
        ".ct-primary-box" + " > " + "svg",
        "svg.ddbc-rep-box-background__svg",
        ".ddbc-box-background" +
          ':not([style*="display: none"]) ' +
          "svg",
      ].join(", "),
    );
    bgSvgs.forEach((svg) => {
      svg.style.height = "100%";
      svg.style.width = "100%";
      if (svg.hasAttribute("height")) svg.removeAttribute("height");
      if (svg.hasAttribute("width")) svg.removeAttribute("width");
      svg.setAttribute("preserveAspectRatio", "none");
    });

    // Explicitly fix Group Boxes (Proficiency, Skills, Senses, Saving Throws) in Spells View

    const groupBoxSvgs = spellsNode.querySelectorAll(
      [
        ".ct-proficiency-groups-box svg",
        ".ct-senses-box svg",
        ".ct-skills-box svg",
        ".ct-saving-throws-box svg",
      ].join(", "),
    );
    groupBoxSvgs.forEach((svg) => {
      svg.setAttribute("preserveAspectRatio", "none");
      svg.style.width = "100%";
      svg.style.height = "100%";
    });

    // 4. Identify the Unified Layout Root
    // We want to move everything to .ct-subsections
    const layoutRoot = document.querySelector(".ct-subsections");
    if (!layoutRoot) {
      if (!window.__DDB_TEST_MODE__) {
        safeLog(
          "warn",
          "[DDB Print] Could not find .ct-subsections! Falling back to original parent.",
        );
      }
      return;
    }
    layoutRoot.id = "print-layout-wrapper";

    // 5. Wrap existing Children (Skills, Senses, etc.)
    // These are already in the DOM, we want to wrap them if they aren't already.
    let unnamedSectionCounter = 1;
    Array.from(layoutRoot.children).forEach((child) => {
      if (!child.classList.contains("print-section-container")) {
        // Identify a title for the section (e.g. from a header)
        const titleEl = child.querySelector(
          "header, " + ".ct-subsection__header",
        );
        let title = titleEl ? titleEl.textContent.trim() : null;

        if (!title) {
          title = `Section ${unnamedSectionCounter++}`;
        }

        // Ensure SVGs are removed from existing sections too
        removeSpecificSvgs(child);

        // Wrap it
        const wrapper = createDraggableContainer(
          title,
          child,
          `section-${title.replace(/\s+/g, "-")}`,
        );
        PeDom().getSectionsLayer().element.appendChild(wrapper); // This moves 'child' into 'wrapped'
      }
    });

    // 6. Wrap and Inject the Live Spells Node
    const spellsContainer = createDraggableContainer(
      "Spells",
      spellsNode,
      "section-Spells",
    );

    // 7. Consolidate All Clones
    const allSectionsOrdered = [];
    const actionsContainer = containers.find((c) =>
      c.textContent.includes("Actions"),
    );
    if (actionsContainer) allSectionsOrdered.push(actionsContainer);

    allSectionsOrdered.push(spellsContainer);

    containers.forEach((container) => {
      if (!allSectionsOrdered.includes(container)) {
        allSectionsOrdered.push(container);
      }
    });

    // Inject everything into the sections layer
    allSectionsOrdered.forEach((container) => {
      PeDom().getSectionsLayer().element.appendChild(container); // Append moves them to the end or maintains order if prepended
    });

    // 8. Hide Navigation UI (Using DomManager)
    window.DomManager.getInstance().getNavigation().hide();

    // 9. Inject spell detail triggers into all sections
    injectSpellDetailTriggers(layoutRoot);

    // Clean up global definitions
    copySvgDefinitions(document.body);
  }

  /**
   * Optimized layout for print.
   */
  function tweakStyles() {
    // Hide major UI components using DomManager
    window.DomManager.getInstance().hideCoreInterface();

    const name = document.querySelector(".ddbc-character-tidbits__heading h1");
    if (name) name.style["color"] = "black";

    // HP recovery
    const allElements = Array.from(document.querySelectorAll("*"));
    const hpElements = allElements.filter(
      (el) =>
        el.textContent.trim().match(/^\d+\s*\/\s*\d+$/) &&
        el.children.length === 0,
    );

    hpElements.forEach((el) => {
      el.style["font-size"] = "30px";
      el.style["font-weight"] = "bold";
      el.style["color"] = "black";
    });
  }

  /**
   * Suppresses global resize events to stabilize custom layout.
   */
  function suppressResizeEvents() {
    safeLog("log", "[DDB Print] Suppressing global resize events...");

    // 1. Nullify window.onresize
    window.onresize = null;

    // 2. Stop propagation of resize events in the capture phase
    // This targets listeners added BEFORE the extension was loaded
    window.addEventListener(
      "resize",
      (e) => {
        e.stopImmediatePropagation();
      },
      true,
    );

    // 3. Intercept addEventListener for 'resize'
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = function (type) {
      if (type === "resize") {
        safeLog("log", "[DDB Print] Blocking external resize listener.");
        return;
      }
      return originalAddEventListener.apply(this, arguments);
    };
  }

  /**
   * Shows a modal to manage existing clones.
   */
  function handleManageClones() {
    const clones = document.querySelectorAll(
      ".print-section-container.be-clone",
    );
    if (clones.length === 0) {
      // AC-5 (U-17): a dialog that stays, not a toast that expires.
      emptyState("No clones found", {
        message: "This sheet has no clones to manage yet.",
        hint: "Clone a section first (the clone button on any section), then come back here.",
      });
      return;
    }

    // Modal for managing clones — built on the shared modal primitive (U-20),
    // so it gains role/aria, a close ✕, backdrop cancel, Esc and focus handling
    // it never had (it could previously only be left via its own Close button).
    const modalApi = window.Modals;
    if (!modalApi || typeof modalApi.__createModal !== "function") {
      showFeedback("Could not open the clones dialog. Reload the page.", "error");
      return;
    }

    modalApi.__createModal({
      title: "Manage Clones",
      body(ctx) {
        ctx.modal.style.width = "500px";

        const list = document.createElement("div");
        list.style.maxHeight = "300px";
        list.style.overflowY = "auto";
        list.style.display = "flex";
        list.style.flexDirection = "column";
        list.style.gap = "8px";

        clones.forEach((clone) => {
          const item = document.createElement("div");
          item.style.display = "flex";
          item.style.justifyContent = "space-between";
          item.style.alignItems = "center";
          item.style.padding = "8px";
          item.style.background = "#333";
          item.style.borderRadius = "4px";

          const title =
            clone.dataset.title ||
            clone.querySelector(".print-section-header span")?.textContent ||
            "Unnamed Clone";

          const nameLabel = document.createElement("span");
          nameLabel.textContent = title;
          item.appendChild(nameLabel);

          const actions = document.createElement("div");
          actions.style.display = "flex";
          actions.style.gap = "8px";

          const goBtn = document.createElement("button");
          goBtn.textContent = "🎯";
          goBtn.title = "Jump to Clone";
          goBtn.type = "button";
          goBtn.onclick = () => {
            clone.scrollIntoView({ behavior: "smooth", block: "center" });
            // Flash effect
            const originalOutline = clone.style.outline;
            clone.style.outline = "4px solid gold";
            setTimeout(() => (clone.style.outline = originalOutline), 1000);
            ctx.close(null);
          };
          actions.appendChild(goBtn);

          const delBtn = document.createElement("button");
          delBtn.textContent = "🗑️";
          delBtn.title = "Delete Clone";
          delBtn.type = "button";
          delBtn.onclick = async () => {
            const okToDelete = await askConfirm({
              title: "Delete clone",
              message: `Delete "${title}"? This cannot be undone.`,
              confirmLabel: "Delete",
              danger: true,
            });
            if (okToDelete) {
              const cloneGate = await destructiveGate(`Delete clone "${title}"`);
              if (!cloneGate.ok) return;
              clone.remove();
              item.remove();
              // AC-3: the snapshot just taken IS the undo.
              window.offerUndo && window.offerUndo(cloneGate.record, `Deleted clone "${title}"`);
              if (list.children.length === 0) {
                ctx.close(null);
              }
              showFeedback("Clone deleted");
              updateLayoutBounds();
            }
          };
          actions.appendChild(delBtn);

          item.appendChild(actions);
          list.appendChild(item);
        });

        ctx.bodyEl.appendChild(list);

        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Close";
        closeBtn.className = "be-modal-ok";
        closeBtn.type = "button";
        ctx.actionsRow.appendChild(closeBtn);
        closeBtn.onclick = () => ctx.close(null);
      },
    });
  }

  window.updateControlsState = updateControlsState;

  /**
   * Creates a floating decorative shape.
   */
  function createShape(assetPath, restoreData = null, targetLayerId = null) {
    const id = restoreData ? restoreData.id : `shape-${Date.now()}`;
    const content = document.createElement("div");
    content.className = "be-shape-content";

    // Create container using the existing helper
    const wrapper = createDraggableContainer("", content, id);
    wrapper.classList.add("be-shape-wrapper");

    const container = wrapper.querySelector(".print-section-container");
    container.classList.add("be-shape-container", "be-shape");
    // Ensure ID is set from restoreData or generated
    container.id = id;

    // Show rotate button for shapes
    const rotateBtn = wrapper.querySelector(".print-section-rotate");
    if (rotateBtn) {
      rotateBtn.style.display = "block";
    }

    // Action Buttons logic (specific for shapes) handled by injectCloneButtons
    injectCloneButtons(wrapper);

    // Asset Application
    // Asset Application.
    //
    // track undo_stack_20260911 (contract.md §3): the assignment below used to run
    // unconditionally, so a restore whose recorded `assetPath` was ABSENT wrote the
    // STRING "undefined" into the DOM (`dataset` coerces), and the next scan reported
    // `assetPath: "undefined"` where the record had no `assetPath` at all — an
    // asymmetry, and one a faithful inverse cannot have. The attribute is now written
    // when the scan would read it and REMOVED when it would not, so absent stays absent
    // and empty stays empty.
    if (typeof assetPath === "string") container.dataset.assetPath = assetPath;
    else delete container.dataset.assetPath;
    applyShapeAsset(container, assetPath);

    // Z-Index Management (at least 100 higher than sections)
    let maxZ = window.Z.SHAPE_DEFAULT; // AC-5 (was 110)
    document.querySelectorAll(".be-section-wrapper").forEach((el) => {
      // Only count sections, not other shapes for the base 110 offset
      if (!el.classList.contains("be-shape-wrapper")) {
        const z = parseInt(el.style.zIndex) || window.Z.SECTION_DEFAULT;
        if (z > maxZ - window.Z.SHAPE_STEP) maxZ = z + window.Z.SHAPE_STEP;
      } else {
        // But shapes should also stack on top of each other
        const z = parseInt(el.style.zIndex) || window.Z.SHAPE_DEFAULT;
        if (z > maxZ) maxZ = z;
      }
    });
    wrapper.style.zIndex = maxZ + 1;

    // Restore saved state.
    //
    // track undo_stack_20260911 (contract.md §3, D-2): these guards used to be
    // TRUTHINESS checks (`if (restoreData.width)`), which silently dropped a recorded
    // FALSY value — an element whose recorded `zIndex` was "" kept the freshly computed
    // `maxZ + 1` above instead of the value the record held, so the inverse wrote a
    // value the record never contained and `scanLayout` -> `applyLayout` was not exact.
    // They are now PRESENCE checks: a key that is present is written back even when its
    // value is empty, which is what a faithful inverse requires. `printZIndex` and
    // `fontSize` keep their truthiness form because an empty value there means "absent"
    // in the scan as well.
    if (restoreData) {
      const has = (k) => restoreData[k] !== undefined && restoreData[k] !== null;
      if (has("width"))
        container.style.setProperty("width", restoreData.width, "important");
      if (has("height"))
        container.style.setProperty("height", restoreData.height, "important");
      if (has("left"))
        wrapper.style.setProperty("left", restoreData.left, "important");
      if (has("top"))
        wrapper.style.setProperty("top", restoreData.top, "important");
      if (has("zIndex"))
        wrapper.style.setProperty("z-index", restoreData.zIndex, "important");
      if (restoreData.printZIndex)
        wrapper.dataset.printZ = restoreData.printZIndex;
      if (restoreData.fontSize) applyFontSize(wrapper, restoreData.fontSize);
    } else {
      wrapper.style.setProperty("left", "50px", "important");
      wrapper.style.setProperty("top", "160px", "important");
      container.style.setProperty("width", "200px", "important");
      container.style.setProperty("height", "200px", "important");
    }

    container.style.left = "";
    container.style.top = "";

    // Rotation Logic
    let currentRotation =
      restoreData && restoreData.rotation ? parseInt(restoreData.rotation) : 0;

    const applyRotation = (angle) => {
      currentRotation = calculateSnappedAngle(angle) % 360;
      // Apply rotation to container, not wrapper
      container.style.transform = `rotate(${currentRotation}deg)`;
      wrapper.dataset.rotation = currentRotation;

      // Clear wrapper transform to avoid conflict
      wrapper.style.transform = "";
    };

    if (currentRotation !== 0) {
      applyRotation(currentRotation);
    }

    // Listener for header rotate button - TOGGLE HANDLE
    wrapper.addEventListener("be-rotate-click", () => {
      const existingHandle = wrapper.querySelector(".be-rotation-handle");
      if (existingHandle) {
        existingHandle.remove();
        showFeedback("Rotation tool hidden");
      } else {
        addRotationHandle();
        showFeedback("Rotation tool shown");
      }
    });

    wrapper.addEventListener("click", (e) => {
      // Prevent handle click from re-triggering logic
      if (e.target.classList.contains("be-rotation-handle")) return;
      // Deselect others (auto-hide their handles if we want strict focus,
      // but user asked for button control. Let's keep button as the main toggle.)
      document.querySelectorAll(".be-shape-wrapper.selected").forEach((el) => {
        if (el !== wrapper) {
          el.classList.remove("selected");
        }
      });

      if (!wrapper.classList.contains("selected")) {
        wrapper.classList.add("selected");
      }
    });

    function addRotationHandle() {
      if (wrapper.querySelector(".be-rotation-handle")) return;

      const handle = document.createElement("div");
      handle.className = "be-rotation-handle";
      handle.title = "Drag to Rotate (15° snap)";
      wrapper.appendChild(handle);

      handle.addEventListener("mousedown", (mdE) => {
        mdE.preventDefault();
        mdE.stopPropagation();

        const rect = wrapper.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        // Phase 2b (track undo_stack_20260911): rotate requests NO persist today (U-4),
        // so its commit point is DEFINED as this gesture: capture at the handle's
        // mousedown, record at mouseup. `container` is the element the rotation is
        // applied to, and `dataset.rotation` is the persisted field (scanLayout reads it,
        // createShape re-applies it), so the inverse restores the angle.
        const rotationBefore = currentRotation;
        // Phase 2 (track refactor_surface_20260911): the reversible record starts HERE, on the
        // pristine pre-gesture DOM, and is pushed at mouseup through the ONE shared protocol
        // (`window.beginMutation` / `window.pushMutation`) — the same shape resize, nudge and
        // drag use. This site used to hand-roll the capture-and-push dance INLINE, and that is
        // why it drifted: its settled branch kept pushing a mid-gesture capture RAW. The shared
        // helper was fixed for exactly that in Phase 1 (F-9 for the helper, F-1 for this site).
        const rotateMut = window.beginMutation
          ? window.beginMutation({ rotation: String(rotationBefore) })
          : null;

        const onMouseMove = (mmE) => {
          // Calculate angle from center to mouse
          let angle = getAngleFromPoint(cx, cy, mmE.clientX, mmE.clientY);
          // Adjust by 90 because handle is at top (270 deg)
          // and CSS 0 is Right (East). Top is -90 or 270.
          applyRotation(angle + 90);
        };

        const onMouseUp = () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
          showFeedback(`Rotated to ${currentRotation}°`);

          // No-op guard: a gesture that left the angle where it was pushes nothing.
          if (currentRotation === rotationBefore) return;
          if (!rotateMut || typeof window.pushMutation !== "function") return;
          window.pushMutation(
            rotateMut,
            "Rotate \"" + wrapper.id + "\"",
            window.MUTATION_CLASSES.ROTATE,
            (layout, snap) => {
              // A capture that settled after the rotation wrote holds the NEW angle; the repair
              // puts the pre-gesture one back so the inverse restores the old orientation. It now
              // runs for the SETTLED branch too (Phase 1) — which is the defect this site
              // carried, and the reason the repair is no longer duplicated here.
              if (window.patchCapturedFields) {
                window.patchCapturedFields(layout, container.id, {
                  rotation: String(snap.rotation),
                });
              }
            },
          );
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    }

    const layoutRoot = PeDom().getLayoutRoot().element;
    if (layoutRoot) {
      // TARGET LAYER APPENDING
      let layerContainer = null;
      if (targetLayerId) {
        layerContainer = document.getElementById(targetLayerId);
      }

      if (!layerContainer) {
        // Fallback to active shapes layer (guaranteed to be a shape layer now)
        layerContainer = PeDom().getActiveShapesLayer().element;
      }

      if (layerContainer) {
        layerContainer.appendChild(wrapper);
      } else {
        // Final fallback to the hardcoded default shapes layer
        PeDom().getShapesLayer().element.appendChild(wrapper);
      }
    }

    // Re-init resize logic for the new container
    if (window.initResizeLogic) window.initResizeLogic();

    refreshLayers();

    return wrapper;
  }

  /**
   * Helper to apply asset to a shape container via class or inline style.
   */
  function applyShapeAsset(container, assetPath) {
    if (!container) return;

    // Type safety check
    if (typeof assetPath !== "string") {
      safeLog(
        "error",
        `[DDB Print] applyShapeAsset: assetPath must be a string, got ${typeof assetPath}`,
        assetPath,
      );
      // Try to recover if it's the result object
      if (assetPath && typeof assetPath.assetPath === "string") {
        assetPath = assetPath.assetPath;
      } else {
        return;
      }
    }

    // Remove existing classes from metadata
    Object.values(ASSET_METADATA).forEach((meta) => {
      if (meta.className) container.classList.remove(meta.className);
    });

    // Reset styles that might have been applied
    container.style.borderStyle = "";
    container.style.borderImageSource = "";
    container.style.borderImageSlice = "";
    container.style.borderImageWidth = "";
    container.style.borderImageOutset = "";
    container.style.borderImageRepeat = "";
    container.style.backgroundImage = "";
    container.style.backgroundSize = "";
    container.style.backgroundRepeat = "";
    container.style.backgroundPosition = "";
    container.style.border = "";
    container.style.backgroundColor = "transparent";
    container.innerHTML = ""; // Clear any existing img tags

    // Default to hiding the ::before border for shapes unless it's a "border" asset with a class
    container.classList.add("be-no-border");

    const isBase64 = assetPath && assetPath.startsWith("data:");
    const getUrl = (path) => {
      if (isBase64) return path;
      return typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.getURL
        ? chrome.runtime.getURL(path)
        : path;
    };

    const meta = ASSET_METADATA[assetPath];
    if (isBase64 || meta) {
      if (isBase64 || meta.isBackground) {
        // Use <img> for print compatibility (background-graphics are often disabled)
        const img = document.createElement("img");
        img.className = "be-shape-asset";
        img.src = getUrl(assetPath);
        Object.assign(img.style, {
          width: "100%",
          height: "100%",
          objectFit: "contain",
          pointerEvents: "none",
          display: "block",
        });
        container.appendChild(img);
        container.style.border = "none";
      } else if (meta.className) {
        container.classList.add(meta.className);
        container.classList.remove("be-no-border"); // Show the ::before border
      } else if (meta.slice !== undefined) {
        container.style.borderStyle = "solid";
        container.style.borderImageSource = `url('${getUrl(assetPath)}')`;
        container.style.borderImageSlice = meta.slice.toString();
        container.style.borderImageWidth = meta.width || "20px";
        container.style.borderImageOutset = meta.outset || "0";
        container.style.borderImageRepeat = "round";
      } else {
        // Default border fallback if slice is missing
        container.style.borderStyle = "solid";
        container.style.borderImageSource = `url('${getUrl(assetPath)}')`;
        container.style.borderImageSlice = "33";
        container.style.borderImageWidth = "20px";
      }
    } else {
      // Fallback for unknown assets
      container.style.borderStyle = "solid";
      container.style.borderImageSource = `url('${getUrl(assetPath)}')`;
      container.style.borderImageSlice = "33";
      container.style.borderImageWidth = "20px";
    }
  }

  // Export for testing and cross-script access
  window.createShape = createShape;
  window.applyShapeAsset = applyShapeAsset;
  window.clearBorderStyles = clearBorderStyles;
  window.showFeedback = showFeedback;

  /**
   * Scales a section's content down so it FITS its container instead of being clipped by it.
   *
   * WHAT THIS REPLACED (issue `responsive_scaling_observer_never_observed_20260912`, wired 2026-09-13
   * at the operator's decision "finish the wiring, do not delete it"). The function used to construct
   * a ResizeObserver and NEVER call `observe()` on it — and an observer that observes nothing never
   * fires — so the entire callback was inert, as was the empty `forEach` that closed the function, as
   * was the `data-scaling` rule in `js/print_styles.js` (its attribute was only ever set from that
   * dead callback). The one test for the feature COPIED the algorithm instead of exercising the
   * wiring, which is how an inert feature kept a green suite.
   *
   * HOW IT WORKS NOW — four parts, each of which the old code lacked:
   *   1. `observe()` every `.print-section-container` that exists at boot, so each gets its
   *      guaranteed first delivery (ResizeObserver reports every newly observed element).
   *   2. A MutationObserver on the document keeps that true as sections are CREATED (which is the
   *      normal case: at `initResponsiveScaling()`'s call site the sheet has NO containers yet —
   *      they are built by layout apply/default afterwards), and forces a RE-MEASURE when content is
   *      added into, moved into, or removed from a section — a container of fixed height does not
   *      resize when its overflow grows, so no size notification would otherwise arrive.
   *   3. A per-container record of the box it was last measured at, because applying a scale changes
   *      the inner's layout width, which changes an auto-height container's box, which delivers a
   *      SECOND notification for the same logical measurement. Without the record the feature writes
   *      styles in a loop and Chromium reports it as an observer loop; with it, the second pass is a
   *      no-op and the sheet settles.
   *   4. The same MutationObserver also watches `data-no-auto-scale` (issue
   *      `scaling_offswitch_no_remeasure_and_stale_floor_expectations_20260914`).
   *      `fitContainer` keys on TWO inputs — the overflow ratio and that per-section switch — and
   *      parts 2 and 3 could only ever see the first: both
   *      observers watched for SIZE, and switching the feature off on a section changes no size at
   *      all, so the write went unnoticed and the scale stayed on until something else happened to
   *      resize the section. The one call the panel made to fix this, `initResponsiveScaling()`,
   *      returns at its `installed` guard, which is the same no-op for every caller. The observation
   *      lives HERE instead of behind a re-check seam the caller has to remember, because this is the
   *      code that reads the attribute — and it also covers `js/layout_apply.js`, which writes the
   *      attribute for every restored section and never asked for a re-measure either.
   *
   * The scale is applied to `.print-section-content > div` and its origin is pinned to top-left by
   * the (now reachable) `data-scaling` rule, so a scaled section keeps its width and its left edge.
   */
  let responsiveScalingInstalled = false;

  function initResponsiveScaling() {
    if (responsiveScalingInstalled) return;
    if (typeof ResizeObserver !== "function") return; // no observer in this host
    responsiveScalingInstalled = true;

    const observed = new WeakSet();
    const pendingRecheck = new WeakSet(); // strong refs would keep removed sections alive
    const lastMeasured = new WeakMap();

    /** The quantity the algorithm measures against: the content box of the scroll parent. */
    function measuredBox(container) {
      const content = container.querySelector(".print-section-content");
      if (!content) return null;
      return `${content.clientWidth}x${content.clientHeight}`;
    }

    /** Take the scale back off one section: the attribute and the compensation ride together. */
    function clearScaling(container, inner) {
      inner.style.transform = "";
      inner.style.removeProperty("--be-scale");
      container.removeAttribute("data-scaling");
      // The clip marker rides with the scale it belongs to. Its attribute is NOT cleared
      // here — the next `fitContainer` pass re-reads the overflow after the reset, and only
      // a genuine out-of-box clip sets it again.
      container.removeAttribute("data-scaling-clipped");
    }

    /** Applying the minimum scale currently permitted for automatic fit-to-container. */
    const MIN_SCALE_FLOOR = 0.60;

    /**
     * How much a floored section may stick out of its box before the pass marks it as
     * CLIPPED, in px. The content is measured at `scale`, so one layout pixel is 0.6 drawn
     * pixels; the slack absorbs the 2px rounding on `scrollHeight` and the sub-pixel error
     * of a fractional scale — the `misfit` measure in
     * `test/browser_e2e/responsive_scaling.spec.js` (`readSheet`) uses the same 1px-per-edge order.
     */
    const CLIP_SLACK_PX = 4;

    /**
     * The per-section off-switch, as the ATTRIBUTE name — `fitContainer` reads it right here and
     * the MutationObserver below filters on it, so the two cannot drift apart. Naming it is the
     * cheap half of the fix; `attributeFilter` is what keeps it affordable: without the filter
     * every attribute write anywhere in the sheet (React re-rendering classes, styles, ids)
     * would reach this callback.
     */
    const NO_AUTO_SCALE_ATTRIBUTE = "data-no-auto-scale";

    /**
     * Mark a section whose scaled content STILL does not fit — i.e. the floor, not the
     * arithmetic, decided the scale, and the tail of the content is cut off by the content
     * box's own `overflow: hidden`. An attribute only: the paint lives in the stylesheet
     * (`js/print_styles.js`, `@media screen`), so this stays out of the print output and out
     * of every inline-style scan the layout record performs.
     */
    function setClipMarker(container, clipped) {
      if (clipped) {
        container.setAttribute("data-scaling-clipped", "true");
      } else {
        container.removeAttribute("data-scaling-clipped");
      }
    }

    function fitContainer(container) {
      const content = container.querySelector(".print-section-content");
      const inner = content ? content.firstElementChild : null;

      if (container.getAttribute(NO_AUTO_SCALE_ATTRIBUTE) === "true") {
        clearScaling(container, inner);
        return;
      }

      if (!inner) {
        container.removeAttribute("data-scaling");
        return;
      }

      // Reset scaling to measure natural size. THE ATTRIBUTE GOES FIRST: the width
      // compensation is a stylesheet rule keyed on `data-scaling` (see the record-collision
      // note in the header above), so dropping it is what takes the compensation off for the
      // measurement — no inline width is ever written or cleared here.
      container.removeAttribute("data-scaling");
      inner.style.transform = "none";
      inner.style.removeProperty("--be-scale");

      const containerWidth = content.clientWidth;
      const containerHeight = content.clientHeight;
      const contentWidth = inner.scrollWidth;
      const contentHeight = inner.scrollHeight;

      if (contentWidth > containerWidth || contentHeight > containerHeight) {
        const scaleX = containerWidth / contentWidth;
        const scaleY = containerHeight / contentHeight;
        const rawScale = Math.min(scaleX, scaleY, 1);
        const scale = Math.min(Math.max(rawScale, MIN_SCALE_FLOOR), 1);

        if (scale < 1) {
          inner.style.transform = `scale(${scale})`;
          // The compensation travels as a custom property, NOT as `inner.style.width`.
          inner.style.setProperty("--be-scale", String(scale));
          container.setAttribute("data-scaling", "true");
          // FITTED, OR JUST SMALLER? The floor can stop the scale above the size the box
          // needs, and then the tail is still cut off by the content box's own
          // `overflow: hidden` — the pre-1.17.3 failure, back in a bounded dose. Option 1
          // of the floor issue is explicit that this must not be silent, so mark it: the pass
          // compares the DRAWN size (natural size x the applied scale) against the box, and the
          // stylesheet paints the result. The natural size is used (transform is `none` at the
          // top of this pass, and `fitContainer` is never called mid-transform), so both axes
          // are checked at the scale that was actually applied.
          setClipMarker(
            container,
            contentHeight * scale > containerHeight + CLIP_SLACK_PX ||
              contentWidth * scale > containerWidth + CLIP_SLACK_PX,
          );
        } else {
          clearScaling(container, inner);
        }
      } else {
        clearScaling(container, inner);
      }
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const container = entry.target;
        const box = measuredBox(container);
        // A recheck was requested (content changed, or this is a fresh observe): the box alone
        // cannot tell us the content changed, so those passes skip the size record.
        if (!pendingRecheck.has(container) && box === lastMeasured.get(container)) {
          continue;
        }
        pendingRecheck.delete(container);
        lastMeasured.set(container, box);
        fitContainer(container);
      }
    });

    /** Every container at or inside `node`. */
    function containersIn(node) {
      if (node.nodeType !== 1) return [];
      if (node.classList && node.classList.contains("print-section-container")) {
        return [node];
      }
      return Array.from(node.querySelectorAll(".print-section-container"));
    }

    /** Start observing one container, and make sure it is measured even if its box never moved. */
    function observeContainer(container) {
      if (observed.has(container)) {
        pendingRecheck.add(container);
        return;
      }
      try {
        observer.observe(container);
      } catch {
        return; // a bare harness whose observer cannot take a target: nothing to scale yet
      }
      observed.add(container);
      pendingRecheck.add(container);
    }

    function forgetContainer(container) {
      if (!observed.has(container)) return;
      observed.delete(container);
      pendingRecheck.delete(container);
      lastMeasured.delete(container);
      try {
        observer.unobserve(container);
      } catch {
        /* the harness's mock may not implement unobserve; the WeakSet already dropped it */
      }
    }

    /** The containers a mutation touches: added ones, the section a change happened inside of,
     *  and the section an off-switch write belongs to (see part 4 of the header above). */
    function recheckFor(record) {
      if (record.type === "attributes") {
        // The per-section off-switch (issue
        // scaling_offswitch_no_remeasure_and_stale_floor_expectations_20260914). Switching the
        // feature off changes NO SIZE at all, so no ResizeObserver notification will ever
        // arrive to carry it — queueing a recheck here would mark a pending pass that nothing
        // triggers. Apply the change now, recording the box it was measured at in the same order
        // the observer callback uses, so the layout pass this write causes cannot be mistaken for
        // a fresh measurement and re-applied in a loop.
        const target = record.target;
        const owner = target.closest
          ? target.closest(".print-section-container")
          : null;
        if (owner && observed.has(owner)) {
          const box = measuredBox(owner);
          pendingRecheck.delete(owner);
          lastMeasured.set(owner, box);
          fitContainer(owner);
        }
        return;
      }

      let touched = false;
      for (const node of record.addedNodes) {
        for (const container of containersIn(node)) {
          observeContainer(container);
          touched = true;
        }
      }
      for (const node of record.removedNodes) {
        for (const container of containersIn(node)) {
          // A move out of the sheet must leave the section unobserved, or a re-insert would be
          // skipped by `observed` and never measured again.
          forgetContainer(container);
          touched = true;
        }
        if (
          node.nodeType === 1 &&
          !containersIn(node).length &&
          node.closest
        ) {
          const owner = node.closest(".print-section-container");
          if (owner && observed.has(owner)) pendingRecheck.add(owner);
        }
      }
      if (!touched && record.target && record.target.closest) {
        // Content edited IN PLACE inside a section (no node added or removed at this level):
        // the container's box can stay identical while its overflow grows, so the size record
        // would suppress the re-measure — request one explicitly.
        const owner = record.target.closest(".print-section-container");
        if (owner && observed.has(owner)) pendingRecheck.add(owner);
      }
    }

    let mutationObserver = null;
    if (typeof MutationObserver === "function") {
      mutationObserver = new MutationObserver((records) => {
        for (const record of records) recheckFor(record);
      });
      mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [NO_AUTO_SCALE_ATTRIBUTE],
      });
    }

    /** Observe every container currently in the document (the boot-time pass). */
    function observeExistingContainers() {
      document
        .querySelectorAll(".print-section-container")
        .forEach(observeContainer);
    }

    observeExistingContainers();
  }

  /**
   * Handles Z-Index for click-to-front behavior
   */
  function initZIndexManagement() {
    const container = document.getElementById("print-layout-wrapper");
    if (!container) return;

    container.addEventListener("mousedown", (e) => {
      const clickedEl = e.target.closest(".be-section-wrapper");
      if (!clickedEl) return;

      const isShape = clickedEl.classList.contains("be-shape-wrapper");
      const allElements = document.querySelectorAll(".be-section-wrapper");

      let maxSectionZ = 10;
      let maxShapeZ = window.Z.SHAPE_DEFAULT; // AC-5 (was 110)

      allElements.forEach((el) => {
        const z =
          parseInt(el.style.zIndex) ||
          parseInt(window.getComputedStyle(el).zIndex) ||
          10;
        if (el.classList.contains("be-shape-wrapper")) {
          if (z > maxShapeZ) maxShapeZ = z;
        } else {
          if (z > maxSectionZ) maxSectionZ = z;
        }
      });

      if (isShape) {
        // Shapes always on top of sections and front of other shapes
        clickedEl.style.zIndex = Math.max(maxShapeZ, maxSectionZ + 100) + 1;
      } else {
        // Sections stay below shapes (usually < 110)
        clickedEl.style.zIndex = maxSectionZ + 1;
      }
    });
  }

  /**
   * Automatically arranges sections in a masonry-like grid
   */
  function autoArrangeSections() {
    const containers = Array.from(
      document.querySelectorAll(".print-section-container"),
    ).filter((el) => !el.classList.contains("be-shape"));
    if (containers.length === 0) return;

    const viewportWidth = window.innerWidth || 1200; // Fallback
    let currentX = 10;
    let currentY = 10;
    let rowHeight = 0;
    const gutter = 15;
    let columnsInRow = 0;

    containers.forEach((container) => {
      const wrapper = container.closest(".be-section-wrapper") || container;

      wrapper.style.left = "0px";
      wrapper.style.top = "0px";

      const width = container.offsetWidth || 300;
      const height = container.offsetHeight || 150;

      // Check if we need a new row:
      // 1. If it doesn't fit horizontally
      // 2. OR if we've reached the 3-column limit
      if (
        (currentX + width > viewportWidth - 20 && currentX > 10) ||
        columnsInRow >= 3
      ) {
        // New row
        currentX = 10;
        currentY += rowHeight + gutter;
        rowHeight = 0;
        columnsInRow = 0;
      }

      // Snap to grid
      const snapX = Math.round(currentX / 16) * 16;
      const snapY = Math.round(currentY / 16) * 16;

      wrapper.style.left = `${snapX}px`;
      wrapper.style.top = `${snapY}px`;

      currentX += width + gutter;
      if (height > rowHeight) rowHeight = height;
      columnsInRow++;
    });

    updateLayoutBounds();
  }

  /**
   * Custom Resize Logic for 16px Grid Snapping
   */
  function initResizeLogic() {
    // Add resize handles if not present
    document.querySelectorAll(".print-section-container").forEach((section) => {
      if (!section.querySelector(".print-section-resize-handle")) {
        const handle = document.createElement("div");
        handle.className = "print-section-resize-handle";
        section.appendChild(handle);

        handle.addEventListener("mousedown", initResize);
      }
    });

    let resizingSection = null;
    let startX, startY, startWidth, startHeight;
    // Phase 2: the reversible-record state for the resize gesture — ONE handle on the shared
    // protocol's `{snap, settled, capture}` record, instead of the three hand-rolled variables
    // this used to keep (a capture, its settled value, and a parallel geometry snapshot).
    let resizeMut = null;

    function initResize(e) {
      resizingSection = e.target.closest(".print-section-container");
      startX = e.clientX;
      startY = e.clientY;
      startWidth = parseInt(window.getComputedStyle(resizingSection).width, 10);
      startHeight = parseInt(
        window.getComputedStyle(resizingSection).height,
        10,
      );

      // Phase 2b (track undo_stack_20260911): this class requests NO persist today (U-4),
      // so its commit point is DEFINED here as gesture start -> gesture end, and the
      // capture begins at mousedown on the pristine DOM. The geometry is saved
      // SYNCHRONOUSLY as well, because a capture that finishes its DOM reads after
      // doResize/stopResize have written records the POST-resize size; that late case is
      // repaired from these values rather than by deferring the resize.
      resizeMut = window.beginMutation
        ? window.beginMutation(
            window.snapshotContainerGeometry
              ? window.snapshotContainerGeometry(resizingSection)
              : null,
          )
        : null;

      document.documentElement.addEventListener("mousemove", doResize, false);
      document.documentElement.addEventListener("mouseup", stopResize, false);
      e.stopPropagation();
      e.preventDefault();
    }

    function doResize(e) {
      if (!resizingSection) return;

      // Calculate raw new dimensions
      let rawNewWidth = startWidth + (e.clientX - startX);
      let rawNewHeight = startHeight + (e.clientY - startY);

      // Snap to 16px
      let newWidth = Math.round(rawNewWidth / 16) * 16;
      let newHeight = Math.round(rawNewHeight / 16) * 16;

      // Min dimensions
      if (newWidth < 50) newWidth = 48; // nearest 16 is 48
      if (newHeight < 30) newHeight = 32;

      resizingSection.style.width = newWidth + "px";
      resizingSection.style.height = newHeight + "px";
    }

    function stopResize() {
      let subjectId = null;
      let changed = false;
      if (resizingSection) {
        subjectId = resizingSection.id;
        const finalWidth = parseInt(resizingSection.style.width, 10);
        // Ensure finalWidth is valid number, fallback to computed if needed (though doResize sets style)
        if (!isNaN(finalWidth)) {
          const deltaX = finalWidth - startWidth;
          if (deltaX !== 0) {
            adjustInnerContentWidth(resizingSection, deltaX);
          }
          changed = deltaX !== 0 ||
            parseInt(resizingSection.style.height, 10) !== startHeight;
        }
      }

      resizingSection = null;
      document.documentElement.removeEventListener(
        "mousemove",
        doResize,
        false,
      );
      document.documentElement.removeEventListener(
        "mouseup",
        stopResize,
        false,
      );
      updateLayoutBounds();

      // The DOM work above stays SYNCHRONOUS (unchanged from before this track); the
      // record is pushed afterwards. Phase 2b's no-op guard: a resize that moved nothing
      // pushes nothing.
      const mut = resizeMut;
      const id = subjectId;
      resizeMut = null;
      if (!changed || !id || !mut || typeof window.pushMutation !== "function") return;

      // Repaired UNCONDITIONALLY, from the synchronous snapshot — not only when the capture
      // was still in flight. The capture starts at mousedown, and the product's click-to-front
      // handler runs on the SAME mousedown, so even a capture that settled during the gesture
      // can hold the RAISED z-index (measured for the drag class; this one has the same
      // shape). Repairing always makes the record the pre-GESTURE state.
      const repair = (layout, snap) => {
        if (!layout) return;
        if (snap && window.patchCapturedFields) {
          window.patchCapturedFields(layout, id, {
            width: snap.width,
            height: snap.height,
            innerWidths: snap.innerWidths,
            zIndex: snap.zIndex,
            printZIndex: snap.printZIndex,
          });
        }
      };
      window.pushMutation(mut, "Resize \"" + id + "\"", window.MUTATION_CLASSES.RESIZE, repair);
    }
  }

  /**
   * Shows a modal to manage Compact Mode status for named sections.
   */
  /**
   * Phase 2e/2f (track undo_stack_20260911): record a mutation that happens inside an
   * already-async action handler.
   *
   * These handlers are `await`ed by the click bridge, so awaiting the capture first is
   * exact and simple: `scanLayout` awaits storage mid-scan, so it must finish before
   * anything changes. Returns false when no record could be taken, which the caller uses
   * to skip its mutation (the abort contract the destructive gate already honours).
   *
   * The MOUNT (`addRobustButton`) is defined further down this file, so this is a plain
   * function declaration and hoists to it.
   */
  async function captureMutationNow(label, klass) {
    if (typeof window.captureUndo !== "function") return false;
    const entry = await window.captureUndo(label, klass);
    return Boolean(entry);
  }

  /**
   * EXTRACT, recorded — the USER entry point for extraction.
   *
   * ATTEMPTED AND REVERTED 2026-09-11, and the reason is recorded because the GAP IS REAL and
   * should not be mistaken for "handled": creating an extraction is a structural addition
   * (`scanLayout` records `extractions[]`) with NO capture point, so "extract this" is not
   * undoable while "roll the extraction back" is.
   *
   * WHY IT IS NOT SIMPLY WIRED HERE. Awaiting the capture before the mutation defers the
   * extraction by a microtask, and EIGHT existing tests dispatch a dblclick and then assert
   * synchronously — they went red, which is the same tension Phase 2e hit for the border and
   * compact sites. Wiring this class properly therefore needs the NON-DEFERRING pattern
   * (start the capture, mutate synchronously, push afterwards) PLUS a repair, because this
   * class ADDS an entry: a capture that finishes after the mutation INCLUDES the new
   * extraction, so the record would be the post-state and the undo a no-op. The repair is
   * straightforward but specific — snapshot the extraction ids synchronously before the
   * mutation, then strip any entry the record gained — and it is left for its own change
   * rather than half-landed here.
   *
   * The capture also cannot live inside `handleElementExtraction` itself:
   * `js/layout_apply.js:278` AWAITS that function on the RESTORE path, so a record there would
   * be pushed by every layout apply — the feedback loop the contract forbids. Same reason the
   * destructive gate for `splitSkillsBox` sits at its user entry point, not inside it.
   */
  async function extractElementRecorded(el) {
    return handleElementExtraction(el);
  }

  function handleManageCompact() {
    // Find all sections that are candidates for compact mode logic
    // Criteria: Named sections (excluding section-\d+), or clones of named sections.
    const allSections = Array.from(
      document.querySelectorAll(".print-section-container"),
    );

    const candidates = allSections.filter((section) => {
      const sourceId = section.dataset.originalId || section.id || "";
      const isNumbered = /^section-Section-\d+$/.test(sourceId);
      return sourceId && !isNumbered; // Only named sections
    });

    if (candidates.length === 0) {
      // AC-5 (U-17): a dialog that stays, not a toast that expires.
      emptyState("No compact-compatible sections found", {
        message:
          "Compact mode needs at least one named section to fold, and this sheet has none.",
        hint: "Extract or clone a named section first, then try Manage Compact again.",
      });
      return;
    }

    // Modal — built on the shared modal primitive (U-20): gains role/aria, a
    // close ✕, backdrop cancel, Esc and focus handling it never had.
    const modalApi = window.Modals;
    if (!modalApi || typeof modalApi.__createModal !== "function") {
      showFeedback("Could not open the compact-mode dialog. Reload the page.", "error");
      return;
    }

    modalApi.__createModal({
      title: "Manage Compact Mode",
      body(ctx) {
        ctx.modal.style.width = "500px";

        // Toggle All Button
      const toggleAllBtn = document.createElement("button");
      toggleAllBtn.textContent = "Toggle All";
      toggleAllBtn.className = "be-modal-ok"; // Reusing style
      toggleAllBtn.style.marginBottom = "10px";
      toggleAllBtn.style.alignSelf = "flex-start";

      // Check if majority are currently compact to decide initial toggle direction
      const compactCount = candidates.filter((s) =>
        s.classList.contains("be-compact-mode"),
      ).length;
      const allCompact = compactCount === candidates.length;

      toggleAllBtn.onclick = async () => {
        // Phase 2e: `compact` is persisted per section (scanLayout writes
        // `classList.contains("be-compact-mode")`), so this toggle is a layout mutation.
        // The NON-DEFERRING pair: the dialog's caller closes and asserts immediately, so
        // the mutation must not wait on the scan.
        const mut = window.beginMutation
          ? window.beginMutation(window.snapshotSectionFlags())
          : null;
        const newState = !allCompact; // If all are on, turn off. Otherwise turn on.
        candidates.forEach((section) => {
          // Update class
          if (newState) section.classList.add("be-compact-mode");
          else section.classList.remove("be-compact-mode");

          // Sync button style if present
          const btn = section.querySelector(".be-compact-button");
          if (btn) {
            btn.style.backgroundColor = newState
              ? "var(--btn-color)"
              : "var(--btn-color-highlight)";
          }
        });
        updateLayoutBounds();
        if (window.pushMutation) {
          window.pushMutation(mut, "Toggle all compact", window.MUTATION_CLASSES.COMPACT,
            (layout, snap) => window.repairSectionFlags(layout, snap));
        }
        ctx.close(null);
        showFeedback(
          newState ? "All sections compacted" : "All sections expanded",
        );
      };
      ctx.bodyEl.appendChild(toggleAllBtn);

      const list = document.createElement("div");
      list.style.maxHeight = "300px";
      list.style.overflowY = "auto";
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "8px";

      candidates.forEach((section) => {
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.style.padding = "8px";
        item.style.background = "#333";
        item.style.borderRadius = "4px";

        const titleSpan = section.querySelector(
          ".print-section-header span, .ct-subsection__header, .ct-section__header",
        );
        const name = titleSpan
          ? titleSpan.textContent.trim()
          : section.id || "Unnamed";

        const nameLabel = document.createElement("span");
        nameLabel.textContent = name;
        item.appendChild(nameLabel);

        const toggleBtn = document.createElement("button");
        const isCompact = section.classList.contains("be-compact-mode");
        toggleBtn.textContent = isCompact ? "ON" : "OFF";
        // AC-6: locked palette tokens. The Material green/red that used to sit
        // here were not in this product's palette at all.
        toggleBtn.style.backgroundColor = isCompact
          ? "var(--be-gold)"
          : "var(--be-taupe)";
        toggleBtn.style.color = "white";
        toggleBtn.style.border = "none";
        toggleBtn.style.padding = "4px 8px";
        toggleBtn.style.borderRadius = "4px";
        toggleBtn.style.cursor = "pointer";

        toggleBtn.onclick = () => {
          // Phase 2e: `compact` is persisted per section, so this is a layout mutation.
          const mut = window.beginMutation
            ? window.beginMutation(window.snapshotSectionFlags())
            : null;
          const newState = section.classList.toggle("be-compact-mode");
          if (window.pushMutation) {
            window.pushMutation(mut, `Toggle "${name}"`, window.MUTATION_CLASSES.COMPACT,
              (layout, snap) => window.repairSectionFlags(layout, snap));
          }
          toggleBtn.textContent = newState ? "ON" : "OFF";
          toggleBtn.style.backgroundColor = newState
            ? "var(--be-gold)"
            : "var(--be-taupe)";

          // Sync the manual button on the section if it exists
          const manualBtn = section.querySelector(".be-compact-button");
          if (manualBtn) {
            manualBtn.style.backgroundColor = newState
              ? "var(--btn-color)"
              : "var(--btn-color-highlight)";
          }
          updateLayoutBounds();
        };

        item.appendChild(toggleBtn);
        list.appendChild(item);
      });

      ctx.bodyEl.appendChild(list);

      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Close";
      closeBtn.className = "be-modal-ok";
      closeBtn.style.marginTop = "10px";
      closeBtn.onclick = () => ctx.close(null);

        ctx.actionsRow.appendChild(closeBtn);
      },
    });
  }


  /**
   * Gets or creates a container for section-level action buttons (Clone, Compact, Append, Delete).
   * @param {HTMLElement} section The section element.
   * @returns {HTMLElement} The container element.
   */
  function getOrCreateActionContainer(section) {
    const wrapper = section.closest(".be-section-wrapper") || section;
    let container = wrapper.querySelector(".be-section-actions");
    if (!container) {
      container = document.createElement("div");
      container.className = "be-section-actions";
      // Ensure buttons are reachable
      container.style.zIndex = window.Z.ACTIONS_BAR; // AC-5 (was "1000000")
      container.style.pointerEvents = "all";
      wrapper.appendChild(container);
    }
    return container;
  }

  /**
   * Splits the skills box into individual stat-based sections.
   * @param {boolean} isSilent If true, suppresses feedback messages.
   */
  async function splitSkillsBox(isSilent = false) {
    const skillsBox =
      document.querySelector(".ct-skills__box") ||
      document.querySelector(".ct-subsection--skills");
    if (!skillsBox) {
      if (!isSilent) showFeedback("Skills box not found");
      return;
    }

    const wrapper = skillsBox.closest(".be-section-wrapper") || skillsBox;
    const container =
      wrapper.querySelector(".print-section-container") ||
      (wrapper.classList.contains("print-section-container") ? wrapper : null);

    if (!container || !container.id) {
      if (!isSilent) showFeedback("Could not find skills box container ID");
      return;
    }

    const originalId = container.id;

    const stats = ["STR", "INT", "WIS", "CHA", "DEX"];

    // Capture the original section snapshot
    const snapshot = captureSectionSnapshot(originalId);
    if (!snapshot) {
      if (!isSilent) showFeedback("Failed to capture skills box");
      return;
    }

    // Create 5 clones
    for (const stat of stats) {
      const statSnapshot = JSON.parse(JSON.stringify(snapshot));
      statSnapshot.id = `skills-${stat.toLowerCase()}-${Date.now()}-${Math.floor(
        Math.random() * 1000,
      )}`;
      statSnapshot.title = stat;

      const clone = renderClonedSection(statSnapshot);
      if (clone) {
        // Filtering: remove non-matching rows
        const rows = clone.querySelectorAll(".ct-skills__item");
        rows.forEach((row) => {
          const statEl =
            row.querySelector(".ct-skills__item--stat") ||
            row.querySelector(".ct-skills__col--stat");
          const skillStat = statEl ? statEl.textContent.trim().toUpperCase() : "";
          
          if (skillStat !== stat) {
            row.remove();
          }
        });

        // Re-inject buttons (clone, etc.) but NOT the splitter
        injectCloneButtons(clone);

        // Ensure the splitter button is not there (remove all instances from clone)
        clone
          .querySelectorAll(".be-split-skills-button")
          .forEach((btn) => btn.remove());
      }
    }

    // Delete the original section
    // (The AC-1 gate is at this action's USER entry point — see the Split
    // button — because the layout-apply path also calls this function, with
    // `isSilent = true`.)
    if (wrapper) {
      wrapper.remove();
    }

    window.skillsSplit = true;
    updateLayoutBounds();
    if (!isSilent) showFeedback("Skills box split successfully");
  }

  window.splitSkillsBox = splitSkillsBox;

  /**
   * Injects clone buttons and compact toggles into sections.
   */
  /**
   * Injects clone buttons and compact toggles into sections and shapes.
   */
  function injectCloneButtons(context = document) {
    const selector = `.ct-subsection, .ct-section, .print-section-container, .be-shape-container`;
    // If the context itself matches the selector, include it
    let elements = Array.from(context.querySelectorAll(selector));
    if (context instanceof HTMLElement && context.matches(selector)) {
      elements.push(context);
    }

    // Filter out redundant containers (e.g., .print-section-container inside a .ct-subsection)
    elements = elements.filter((el) => {
      if (el.classList.contains("print-section-container")) {
        const parentSection = el.parentElement?.closest(
          ".ct-subsection, .ct-section",
        );
        if (parentSection) return false;
      }
      return true;
    });

    elements.forEach((section) => {
      const actionContainer = getOrCreateActionContainer(section);
      const isShape = section.classList.contains("be-shape-container");

      // Get or create context menu
      let menu = actionContainer.querySelector(".be-context-menu");
      if (!menu) {
        menu = createContextMenu();
        actionContainer.appendChild(menu);

        const trigger = createMenuTrigger();
        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          // Position menu
          menu.style.top = "100%";
          menu.style.right = "0";
          toggleContextMenu(menu);
        });
        actionContainer.appendChild(trigger);
      }

      // Helper to add robust button
      const addRobustButton = (
        className,
        icon,
        title,
        action,
        targetContainer = actionContainer,
      ) => {
        if (targetContainer.querySelector(`.${className}`)) return;

        const btn = document.createElement("button");
        btn.className = className;
        // ui_ux_overhaul Phase 5: in-sheet action glyphs -> 16px SVG icons
        // (fail-open: falls back to the emoji when the icon set is absent).
        const ACTION_ICONS = {
          "be-select-section-button": "select",
          "be-clone-button": "clone",
          "be-compact-button": "compact",
          "be-border-button": "border",
          "be-split-skills-button": "split",
          "be-clone-delete": "trash",
          "be-shape-delete": "trash",
          "be-shape-rotate": "rotate",
          "be-shape-switch": "switchArrows",
          "be-shape-clone": "clone",
        };
        const svgIcon = ACTION_ICONS[className];
        btn.innerHTML = svgIcon && window.Icons && window.Icons.svg
          ? window.Icons.svg(svgIcon, 14)
          : icon;
        btn.title = title;
        if (/delete/i.test(title) && className.indexOf("delete") !== -1) {
          btn.dataset.danger = "true";
        }

        const log = (msg) =>
          safeLog(
            "log",
            `[DDB Print] Button ${className} (${section.id}): ${msg}`,
          );

        btn.addEventListener("mousedown", () => log("Mousedown"));
        btn.addEventListener("mouseup", () => log("Mouseup"));
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          log("Clicked");
          if (targetContainer === menu) {
            menu.style.display = "none";
            document.removeEventListener("mousedown", menu._closeListener);
          }
          try {
            await action(e);
          } catch (err) {
            safeLog("error", `[DDB Print] Error in button ${className}:`, err);
          }
        });

        targetContainer.appendChild(btn);
      };

      if (!isShape) {
        // --- SECTION ACTIONS ---

        // 0. Select Section Button (Visible)
        addRobustButton(
          "be-select-section-button",
          "🎯",
          "Select Section for Editing",
          () => {
            setActiveSection(section);
            showFeedback("Section selected for editing");
          },
        );

        // 1. Clone Button (Menu)
        addRobustButton(
          "be-clone-button",
          "📋",
          "Clone Section",
          async () => {
            const id = section.id || "unknown";
            const wrapper = section.closest(".be-section-wrapper") || section;
            const sectionName =
              wrapper.dataset.title ||
              section
                .querySelector(
                  `.ct-subsection__header, .ct-section__header, .print-section-header span`,
                )
                ?.textContent.trim() ||
              "Section";

            const title = await showInputModal(
              "Clone Section",
              `Enter a name for this ${sectionName} clone:`,
              `${sectionName} (Clone)`,
            );

            if (title) {
              // Phase 2f: a clone is a STRUCTURAL addition (scanLayout records clones[]),
              // so it is recorded before it is created — the inverse removes it.
              await captureMutationNow(`Clone "${title}"`, window.MUTATION_CLASSES.STRUCTURAL);
              const snapshot = captureSectionSnapshot(id);
              if (snapshot) {
                snapshot.id = `clone-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                snapshot.title = title;

                const clone = renderClonedSection(snapshot);
                if (clone) {
                  showFeedback(`Cloned: ${title}`);
                  updateLayoutBounds();
                  injectCloneButtons();
                  injectSpellDetailTriggers(clone);
                }
              } else {
                showFeedback("Failed to capture snapshot.");
              }
            }
          },
          menu,
        );

        // 2. Compact Mode Button (Menu)
        const sourceId = section.dataset.originalId || section.id || "";
        const isNumbered = /^section-Section-\d+$/.test(sourceId);

        if (sourceId && !isNumbered) {
          addRobustButton(
            "be-compact-button",
            "📏",
            "Toggle Compact Mode",
            (e) => {
              const btn = e.currentTarget;
              const wrapper = section.closest(".be-section-wrapper") || section;
              const container =
                wrapper.querySelector(".print-section-container") ||
                (wrapper.classList.contains("print-section-container")
                  ? wrapper
                  : null);

              if (container) {
                // Phase 2e: persisted per section (scanLayout reads the class), so this
                // in-sheet toggle is recorded like the dialog's — and, like the dialog's,
                // through the NON-DEFERRING pair: this case's test clicks and asserts
                // immediately, which a deferred mutation would break.
                const compactLabel =
                  `Toggle "${(wrapper.dataset && wrapper.dataset.title) || container.id}"`;
                const mut = window.beginMutation
                  ? window.beginMutation(window.snapshotSectionFlags())
                  : null;
                const isCompact = container.classList.toggle("be-compact-mode");
                if (window.pushMutation) {
                  window.pushMutation(mut, compactLabel, window.MUTATION_CLASSES.COMPACT,
                    (layout, snap) => window.repairSectionFlags(layout, snap));
                }
                btn.innerHTML = isCompact ? "📐" : "📏";
                showFeedback(
                  isCompact ? "Compact mode ON" : "Compact mode OFF",
                );
                updateLayoutBounds();
              }            },
            menu,
          );
        }

        // 3. Border Style Button (Menu) — unified picker, style mode
        // (border_shape_picker_ux_20260909, B-1: the legacy section-style
        // modal is gone; its surface now lives in showAssetPickerModal).
        addRobustButton(
          "be-border-button",
          "🖼️",
          "Change Border Style",
          async () => {
            const current =
              (window.AssetCatalog.ALL_BORDER_STYLES || ["no-border"]).find(
                (s) => section.classList.contains(s),
              ) || "default-border";
            const style = await showAssetPickerModal({
              mode: "style",
              current,
              target: section,
            });
            if (style !== null) {
              // Phase 2e: `borderStyle` is persisted per section, so a border change is a
              // layout mutation. The NON-DEFERRING pair: the border tests click and assert
              // in the same turn, and three of them went red when this awaited instead.
              const borderMut = window.beginMutation
                ? window.beginMutation(window.snapshotSectionFlags())
                : null;
              // `wrapper` is NOT in scope in this handler (it is declared inside the clone
              // and compact callbacks above), so referring to it threw a ReferenceError
              // HERE — after the border had been applied but before the record was pushed.
              // `addRobustButton` swallows callback errors by design, so the visible result
              // was a border change with NO undo and no error. Found by the real-browser
              // per-class verification; `section` is the in-scope element.
              const borderLabel =
                `Border "${(section.dataset && section.dataset.title) || section.id}"`;
              applyBorderStyle(section, style);
              if (window.pushMutation) {
                window.pushMutation(borderMut, borderLabel, window.MUTATION_CLASSES.BORDER,
                  (layout, snap) => window.repairSectionFlags(layout, snap));
              }
              showFeedback(
                `Border applied: ${style && style.style ? style.style : "None"}`,
              );
            }
          },
          menu,
        );

        // 4. Split Skills Button (Menu)
        const isSkills =
          section.querySelector(".ct-skills__box") ||
          section.querySelector(".ct-subsection--skills");
        if (isSkills && !window.skillsSplit) {
          addRobustButton(
            "be-split-skills-button",
            "🔪",
            "Split Skills into Individual Stats",
            async () => {
              // AC-1: snapshot first — splitting DELETES the original section.
              // Gated at this USER entry point, not inside splitSkillsBox: the
              // layout-apply path calls that function with `isSilent = true`
              // (js/layout_apply.js), and a gate there would spam backups and could
              // block an apply when storage was tight.
              const splitGate = await destructiveGate(
                `Split skills box "${(section.dataset && section.dataset.title) || "section"}"`,
              );
              if (!splitGate.ok) return;
              await splitSkillsBox();
              // AC-3: the snapshot just taken IS the undo.
              window.offerUndo && window.offerUndo(splitGate.record,
                `Split skills box "${(section.dataset && section.dataset.title) || "section"}"`,
              );
            },
            menu,
          );
        }

        // 5. Delete Button (for clones - Visible)
        if (section.id && section.id.startsWith("clone-")) {
          addRobustButton(
            "be-clone-delete",
            "🗑️",
            "Delete this Clone",
            async () => {
              const wrapper = section.closest(".be-section-wrapper") || section;
              const okToDelete = await askConfirm({
                title: "Delete cloned section",
                message: "Delete this cloned section? This cannot be undone.",
                confirmLabel: "Delete",
                danger: true,
              });
              if (okToDelete) {
                const sectionGate = await destructiveGate(
                  `Delete cloned section "${(wrapper && wrapper.dataset.title) || "section"}"`,
                );
                if (!sectionGate.ok) return;
                wrapper.remove();
                updateLayoutBounds();
                showFeedback("Clone deleted");
                // AC-3: the snapshot just taken IS the undo.
                window.offerUndo && window.offerUndo(sectionGate.record,
                  `Deleted cloned section "${(wrapper.dataset && wrapper.dataset.title) || "section"}"`,
                );
              }
            },
          );
        }
      } else {
        // --- SHAPE ACTIONS ---

        // 1. Delete Shape (Visible)
        addRobustButton("be-shape-delete", "🗑️", "Delete Shape", async () => {
          const wrapper = section.closest(".be-shape-wrapper");
          if (wrapper) {
            const okToDelete = await askConfirm({
              title: "Delete shape",
              message: "Delete this shape? This cannot be undone.",
              confirmLabel: "Delete",
              danger: true,
            });
            if (okToDelete) {
              const shapeGate = await destructiveGate(`Delete shape`);
              if (!shapeGate.ok) return;
              wrapper.remove();
              updateLayoutBounds();
              refreshLayers();
              // AC-3: the snapshot just taken IS the undo.
              window.offerUndo && window.offerUndo(shapeGate.record, "Deleted shape");
            }
          }
        });

        // 2. Rotate Shape (Visible)
        addRobustButton("be-shape-rotate", "↻", "Toggle Rotation Tool", (e) => {
          const event = new CustomEvent("be-rotate-click", { bubbles: true });
          e.target.dispatchEvent(event);
        });

        // 3. Switch Shape Asset (Menu)
        addRobustButton(
          "be-shape-switch",
          "🔄",
          "Switch Shape Asset",
          async () => {
            const currentAsset = section.dataset.assetPath || "";
            const folder = currentAsset.includes("assets/shapes/")
              ? "assets/shapes/"
              : "assets/";
            // B-5: pass the live shape container as the hover-swap target.
            const result = await showShapePickerModal(currentAsset, folder, section);
            if (result) {
              // result should be {assetPath: '...'}
              const newPath = result.assetPath || result; // Handle both object and raw string
              if (typeof newPath === "string") {
                // MEASURED DEFECT, found by the coverage audit: the capture used to be
                // awaited AFTER this assignment, so the record held the NEW asset path and
                // the undo left the shape with the new path but the OLD visual classes — an
                // inconsistent state, not a revert. `scanLayout` reads
                // `container.dataset.assetPath`, so the capture must come FIRST.
                await captureMutationNow("Switch shape asset", window.MUTATION_CLASSES.ASSET);
                section.dataset.assetPath = newPath;
                applyShapeAsset(section, newPath);
                showFeedback(
                  `Shape asset updated: ${result.name || "New Asset"}`,
                );
              } else {
                safeLog(
                  "error",
                  "[DDB Print] Invalid result from shape picker",
                  result,
                );
              }
            }
          },
          menu,
        );

        // 4. Clone Shape (Menu)
        addRobustButton(
          "be-shape-clone",
          "📋",
          "Clone Shape",
          async () => {
            const wrapper = section.closest(".be-shape-wrapper");
            if (wrapper) {
              // Phase 2f: a shape clone is a structural addition (scanLayout records the
              // layer's elements), so it is recorded before the node is created — the
              // inverse removes it.
              await captureMutationNow("Clone shape", window.MUTATION_CLASSES.STRUCTURAL);
              const clone = wrapper.cloneNode(true);
              // Update ID to avoid duplicates
              const newId = `shape-clone-${Date.now()}`;
              clone.id = newId;
              const innerShape = clone.querySelector(".be-shape-container");
              if (innerShape) innerShape.id = `inner-${newId}`;

              // Offset position slightly
              const top = parseFloat(wrapper.style.top || 0);
              const left = parseFloat(wrapper.style.left || 0);
              clone.style.top = `${top + 20}px`;
              clone.style.left = `${left + 20}px`;

              wrapper.parentNode.appendChild(clone);
              injectCloneButtons(clone);
              refreshLayers();
              showFeedback("Shape cloned");
            }
          },
          menu,
        );
      }
    });
  }


  // Expose for testing synchronously

  window.createDraggableContainer = createDraggableContainer;
  window.extractAndWrapSections = extractAndWrapSections;
  window.injectClonesIntoSpellsView = injectClonesIntoSpellsView;
  window.enforceFullHeight = enforceFullHeight;
  window.removeSearchBoxes = removeSearchBoxes;
  window.tweakStyles = tweakStyles;
  window.injectCompactStyles = injectCompactStyles;
  window.moveDefenses = moveDefenses;
  window.movePortrait = movePortrait;
  window.initResponsiveScaling = initResponsiveScaling;
  window.initZIndexManagement = initZIndexManagement;
  window.autoArrangeSections = autoArrangeSections;
  window.initResizeLogic = initResizeLogic;
  window.updateLayoutBounds = updateLayoutBounds;
  window.removeSpecificSvgs = removeSpecificSvgs;
  window.drawPageSeparators = drawPageSeparators;
  window.moveQuickInfo = moveQuickInfo;
  window.toggleShapesMode = toggleShapesMode;
  window.suppressResizeEvents = suppressResizeEvents;
  window.separateAbilities = separateAbilities;
  window.separateQuickInfoBoxes = separateQuickInfoBoxes;
  window.adjustInnerContentWidth = adjustInnerContentWidth;
  window.scanLayout = scanLayout;
  window.migrateLayout = migrateLayout;
  window.applyLayout = applyLayout;
  window.applyDefaultLayout = applyDefaultLayout;
  window.handleSaveBrowser = handleSaveBrowser;
  window.handleLoadDefault = handleLoadDefault;
  window.handleSavePC = handleSavePC;
  window.handleLoadFile = handleLoadFile;
  window.restoreLayout = restoreLayout;
  window.showFeedback = showFeedback;
  window.createControls = createControls;
  window.showFallbackModal = showFallbackModal;
  window.showInputModal = showInputModal;
  window.showAssetPickerModal = showAssetPickerModal;
  window.showShapePickerModal = showShapePickerModal;
  window.handleManageClones = handleManageClones;
  window.handleManageCompact = handleManageCompact;
  window.getOrCreateActionContainer = getOrCreateActionContainer;
  window.captureSectionSnapshot = captureSectionSnapshot;
  window.renderClonedSection = renderClonedSection;
  window.createShape = createShape;
  window.applyShapeAsset = applyShapeAsset;
  window.Storage = Storage;
  window.injectCloneButtons = injectCloneButtons;
  window.injectSpellDetailTriggers = injectSpellDetailTriggers;
  window.flagExtractableElements = flagExtractableElements;
  window.findSectionTitle = findSectionTitle;
  window.applyGlobalFilters = applyGlobalFilters;
  window.createSpellDetailSection = createSpellDetailSection;
  window.injectAppendButton = injectAppendButton;
  window.getMergeTargets = getMergeTargets;
  window.handleMergeSections = handleMergeSections;
  window.handleElementExtraction = handleElementExtraction;
  window.rollbackSection = rollbackSection;
  window.getCharacterId = getCharacterId;
  window.fetchSpellWithCache = fetchSpellWithCache;
  window.getCharacterSpells = getCharacterSpells;
  window.setActiveSection = setActiveSection;
  window.getActiveSection = getActiveSection;

  // Execution
  (async () => {
    if (window.__DDB_TEST_MODE__) return;

    // Initialize storage first
    try {
      await Storage.init();
    } catch (err) {
      safeLog("error", "[DDB Print] Failed to initialize storage:", err);
    }

    // Stabilize layout by suppressing global resize events
    suppressResizeEvents();

    // Idempotency: cleanup previous run if exists
    const existingWrapper = document.getElementById("print-layout-wrapper");
    if (existingWrapper) {
      // User Request: Confirmation for re-run
      const okToReload = await askConfirm({
        title: "Reload page",
        message: "You need to reload to apply changes again. Reload now?",
        confirmLabel: "Continue",
      });
      if (okToReload) {
        window.location.reload();
        return;
      } else {
        return; // Do nothing
      }
    }

    enforceFullHeight();
    await injectClonesIntoSpellsView();
    moveDefenses();
    tweakStyles();
    injectCompactStyles();
    removeSearchBoxes();
    movePortrait(); // User Request: Move portrait at the end
    moveQuickInfo(); // User Request: Make Quick Info draggable
    separateAbilities();
    separateQuickInfoBoxes();
    addInteractiveTidbitSection();
    injectCloneButtons();
    flagExtractableElements();
    initDragAndDrop();
    // AC-8 (undo_stack_20260911): the keyboard path. Bound once at boot; inert while a
    // text field has focus and a no-op when the stack is empty (both asserted).
    if (typeof window.installUndoShortcut === "function") {
      window.installUndoShortcut();
      safeLog("log", "[DDB Print] Undo shortcut bound (Ctrl/Cmd+Z)");
    }
    if (window.injectDnDStyles) {
      window.injectDnDStyles();
      safeLog("log", "[DDB Print] DnD Styles Injected");
    }
    initResponsiveScaling();
    initZIndexManagement();
    initResizeLogic();

    // UI Controls
    createControls();

    // AC-4 (first_run_and_panel_20260911): tell the extension's own service worker that the
    // enhancer is RUNNING on this page, so the toolbar icon can say so.
    //
    // WHY THIS IS A MESSAGE RATHER THAN WORK DONE IN `chrome.action.onClicked`. The first version
    // set the badge from the click handler, and the browser suite measured it reporting "" instead
    // of "ON" — because a click handler knows an injection was REQUESTED, not that it happened, and
    // the test harness (like any other programmatic injection) never goes through that handler at
    // all. Announcing from the content script ties the badge to the one fact it is supposed to
    // report — this script actually booted in this tab — and it makes every injection path
    // equivalent, which is what lets the suite verify the real thing instead of a parallel copy.
    //
    // Fenced and best-effort: a page with no extension runtime (jsdom, a standalone boot) must still
    // run the whole init sequence.
    try {
      window.chrome?.runtime?.sendMessage?.({ type: "DDB_IS_ON" });
    } catch {
      /* no runtime to tell: the enhancer still works */
    }

    // AC-1/Edge 4: restoreLayout returns a RESULT OBJECT. A layout that
    // exists but FAILED to load must surface an error card — never silently
    // downgrade to the default template (which looked like data loss).
    const restoreResult = await restoreLayout();
    if (restoreResult && restoreResult.restored) {
      updateLayoutBounds();
    } else if (restoreResult && restoreResult.reason && restoreResult.reason !== "empty") {
      // Consultant risk #3: never leave a blank sheet. Establish a usable,
      // printable default and THEN explain what happened — the saved layout is
      // untouched (nothing re-persists it) and the card offers recovery.
      await applyDefaultLayout();
      showRestoreFailureCard(restoreResult);
    } else {
      await applyDefaultLayout();
    }
    // AC-2 (U-15): one confirmation of which layout the sheet is showing —
    // "restored" and "there was nothing to restore, here is the default" must
    // not look the same. Silent on the failure branch above, which the recovery
    // card owns.
    if (typeof announceBootRestore === "function") announceBootRestore(restoreResult);

    // Default to Shapes Mode OFF
    toggleShapesMode(false);

    // Export for testing and cross-script access
    window.createShape = createShape;
    window.toggleShapesMode = toggleShapesMode;
    window.applyShapeAsset = applyShapeAsset;
    window.clearBorderStyles = clearBorderStyles;
    window.showFeedback = showFeedback;
    window.splitSkillsBox = splitSkillsBox;
    window.skillsSplit = window.skillsSplit || false;
  })();
})();