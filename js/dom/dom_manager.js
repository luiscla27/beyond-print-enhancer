class DomManager {
  constructor() {
    this._elementWrapper = null;
    this._layerManager = null;
  }

  static getInstance() {
    if (!DomManager.instance) {
      DomManager.instance = new DomManager();
    }
    return DomManager.instance;
  }

  /**
   * Helper to wrap an element or return empty wrapper.
   * @param {string} selector
   * @returns {ElementWrapper}
   */
  _wrap(selector) {
    const el = document.querySelector(selector);
    return new ElementWrapper(el);
  }

  /**
   * Helper to wrap all elements matching selector.
   * @param {string} selector
   * @returns {ElementWrapper[]}
   */
  _wrapAll(selector) {
    const els = document.querySelectorAll(selector);
    return Array.from(els).map((el) => new ElementWrapper(el));
  }

  /**
   * Gets the main character sheet container.
   * @returns {ElementWrapper}
   */
  getCharacterSheet() {
    // Preference for the desktop class as it's more stable for layout
    const el =
      document.querySelector(".ct-character-sheet-desktop") ||
      document.getElementById("site-main");
    return new ElementWrapper(el);
  }

  /**
   * Gets the inner sheet container.
   * @returns {ElementWrapper}
   */
  getSheetInner() {
    return this._wrap(".ct-character-sheet__inner");
  }

  /**
   * Gets the sidebar container.
   * @returns {ElementWrapper}
   */
  getSidebar() {
    return this._wrap(".ct-sidebar");
  }

  /**
   * Gets the main navigation element.
   * @returns {ElementWrapper}
   */
  getNavigation() {
    // More specific check might be needed for D&D Beyond's structure
    // Often it's within the sheet desktop or a specific class
    // For now, simple 'nav' as per analysis or refined selector
    // The analysis showed `document.querySelector('.ct-character-sheet-desktop nav')` usage.
    const el =
      document.querySelector(".ct-character-sheet-desktop nav") ||
      document.querySelector("[class*=\"ct-character-nav\"]");
    return new ElementWrapper(el);
  }

  /**
   * Gets the quick info panel.
   * @returns {ElementWrapper}
   */
  getQuickInfo() {
    return this._wrap(".ct-quick-info");
  }

  /**
   * Hides core UI elements that are not needed for printing.
   */
  hideCoreInterface() {
    const siteMain = document.getElementById("site-main");
    const desktopSheet = document.querySelector(".ct-character-sheet-desktop");

    const selectors = [
      ".site-bar",
      "header.main",
      "#mega-menu-target",
      "footer",
      ".ddb-site-alert",
      ".watermark",
      ".notifications-wrapper",
      "[class*=\"ct-character-nav\"]",
    ];

    selectors.forEach((selector) => {
      if (!selector) return;
      const el = document.querySelector(selector);
      // Never hide the main containers
      if (el && el !== siteMain && el !== desktopSheet) {
        el.style.display = "none";
      }
    });

    // Handle sidebars
    const sidebars = document.querySelectorAll('[class*="sidebar"]');
    sidebars.forEach((el) => {
      // User Request: Exclude the portal which contains modals
      if (
        el.classList.contains("ct-sidebar__portal") ||
        el.closest(".ct-sidebar__portal")
      )
        return;
      if (el === siteMain || el === desktopSheet) return;
      el.style.display = "none";
    });

    // Handle navigation variations
    const navs = document.querySelectorAll('[class*="navigation"]');
    navs.forEach((el) => {
      if (el === siteMain || el === desktopSheet) return;
      el.style.display = "none";
    });

    const megaMenus = document.querySelectorAll('[class*="mega-menu"]');
    megaMenus.forEach((el) => {
      if (el === siteMain || el === desktopSheet) return;
      el.style.display = "none";
    });
  }

  /**
   * Gets the main spells container.
   * @returns {ElementWrapper}
   */
  getSpellsContainer() {
    return this._wrap(".ct-spells");
  }

  /**
   * Gets all spell rows.
   * @returns {ElementWrapper[]}
   */
  getSpellRows(context = document) {
    if (context instanceof ElementWrapper) context = context.element;
    // If context is provided, query within it, otherwise global
    const els = context.querySelectorAll
      ? context.querySelectorAll(".ct-spells-spell")
      : document.querySelectorAll(".ct-spells-spell");
    return Array.from(els).map((el) => new ElementWrapper(el));
  }

  /**
   * Gets the actions container.
   * @returns {ElementWrapper}
   */
  getActionsContainer() {
    return this._wrap("[class*=\"styles_actionsList__\"]");
  }

  /**
   * Gets the equipment container.
   * @returns {ElementWrapper}
   */
  getEquipmentContainer() {
    return this._wrap(".ct-equipment");
  }

  /**
   * Gets the extras container.
   * @returns {ElementWrapper}
   */
  getExtrasContainer() {
    return this._wrap(".ct-extras");
  }

  /**
   * Gets or creates the LayerManager instance.
   * @returns {LayerManager}
   */
  getLayerManager() {
    if (!this._layerManager && typeof window.LayerManager !== "undefined") {
      this._layerManager = new window.LayerManager();
      this._layerManager.createPanel();
    }
    return this._layerManager;
  }

  /**
   * Gets or creates the layout root.
   * @returns {ElementWrapper}
   */
  getLayoutRoot() {
    let root = document.querySelector("#print-layout-wrapper");
    if (!root) {
      // If it doesn't exist, we might need to find where it should be.
      // In main.js it's often .ct-subsections.
      root = document.querySelector(".ct-subsections");
      if (root) root.id = "print-layout-wrapper";
    }
    return new ElementWrapper(root);
  }

  /**
   * Gets or creates the sections layer.
   * @returns {ElementWrapper}
   */
  getSectionsLayer() {
    let layer = document.querySelector("#print-enhance-sections-layer");
    if (!layer) {
      const root = this.getLayoutRoot();
      if (root.element) {
        layer = document.createElement("div");
        layer.id = "print-enhance-sections-layer";
        layer.className = "pe-layer";
        root.element.appendChild(layer);
      }
    }
    return new ElementWrapper(layer);
  }

  /**
   * Gets or creates the shapes layer (legacy support).
   * @returns {ElementWrapper}
   */
  getShapesLayer() {
    let layer = document.querySelector("#print-enhance-shapes-layer");
    if (!layer) {
      const container = this.getShapesContainer();
      if (container.element) {
        layer = document.createElement("div");
        layer.id = "print-enhance-shapes-layer";
        layer.className = "be-shape-layer-container pe-layer";
        container.element.appendChild(layer);
      }
    }
    return new ElementWrapper(layer);
  }

  /**
   * Gets the currently active shapes layer container.
   * @returns {ElementWrapper}
   */
  getActiveShapesLayer() {
    const lm = this.getLayerManager();
    if (lm) {
      const activeContainer = lm.getActiveLayerContainer();
      if (activeContainer) {
        return new ElementWrapper(activeContainer);
      }
    }
    return this.getShapesLayer();
  }

  /**
   * Gets or creates the main shapes container for multiple layers.
   * @returns {ElementWrapper}
   */
  getShapesContainer() {
    let container = document.getElementById("print-enhance-shapes-container");
    if (!container) {
      const root = this.getLayoutRoot();
      if (root.element) {
        container = document.createElement("div");
        container.id = "print-enhance-shapes-container";
        container.className = "pe-shapes-root";
        root.element.appendChild(container);
      }
    }
    return new ElementWrapper(container);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = DomManager;
} else {
  window.DomManager = DomManager;
}
