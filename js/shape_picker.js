/**
 * Shape picker modal: ONE unified shell (track border_shape_picker_ux_20260909,
 * B-1) for the asset grid (borders/shapes/custom tabs) plus the new Section
 * Styles surface (the legacy section-style modal merged in here), with the
 * "Upload from disk" flow.
 *
 * Entry points:
 *   showAssetPickerModal({ mode, current, folder, target })
 *     mode: 'add'    — Add Shape (control / layer panel). Tabs
 *                      Borders/Shapes/Custom; resolves { assetPath }.
 *           'switch' — Switch Shape Asset (shape ⋮ menu). Same three tabs,
 *                      optionally folder-filtered; resolves { assetPath }.
 *           'style'  — Section border style (section ⋮ menu / properties
 *                      panel). Single "Section Styles" surface fed by
 *                      AssetCatalog.SECTION_BORDER_STYLES; resolves
 *                      { style: className }.
 *   showShapePickerModal(currentAsset, filterFolder) — thin alias routing to
 *     mode 'switch' when a current asset and/or folder hint is given, else
 *     mode 'add' (kept for the legacy control seam).
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 11 (split B). Cross-module
 * seams resolved lazily at call time: AssetCatalog (ASSET_LIST /
 * window.AssetCatalog.ASSET_METADATA / parseAssets / SECTION_BORDER_STYLES),
 * Storage via window.__DDBStorage, ImageProcessor, showFeedback, safeLog, and
 * window.SpellsUi.getCharacterId — never captured at module load.
 */

"use strict";

/**
 * U-36: errors go to the themed, announced error toast instead of a blocking
 * native `alert()`. Resolved at call time (js/modals.js injects the toast seam
 * later); a bare boot logs rather than throwing. The name is unique per file
 * because several modules are eval'd into ONE shared scope in the test harness.
 */
const shapePickerNotifyError = (msg) => {
  const w = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null);
  if (w && typeof w.showFeedback === "function") w.showFeedback(msg, "error");
  // AC-5: the ONE logger, resolved at call time.
  else if (w && typeof w.safeLog === "function") w.safeLog("error", "[DDB Print] " + msg);
};

// C-1 / AC-1 (custom_upload_templates_ux_20260909): module-scoped upload
// in-flight guard — a second Upload click (or a second file selection while
// one is processing) must be a no-op.
let _uploadInFlight = false;

/** Resolve the active layer manager + active layer id (add/switch guard). */
function _layerManager() {
  return window.PeDom
    ? window.PeDom().getLayerManager()
    : window.DomManager
      ? window.DomManager.getInstance().getLayerManager()
      : null;
}

/**
 * Unified asset/style picker.
 * @param {{mode?: 'add'|'switch'|'style', current?: string, folder?: string,
 *          target?: HTMLElement}} opts
 * @returns {Promise<{assetPath: string}|{style: string}|null>}
 */
function showAssetPickerModal(opts = {}) {
  const mode = opts.mode === "style" ? "style" : opts.mode === "switch" ? "switch" : "add";
  const current = opts.current || "";
  const filterFolder = opts.folder || "";
  const styleMode = mode === "style";

  // Fail-open module aliases (mirror the monolith destructure defaults):
  // standalone test boots may eval this module without asset_catalog.js /
  // storage.js; the picker then lists no built-in assets and its custom tab
  // reads the (possibly absent) storage layer defensively.
  const AssetCatalog = window.AssetCatalog || {};
  const ASSET_LIST = AssetCatalog.ASSET_LIST || [];
  const ASSET_METADATA = AssetCatalog.ASSET_METADATA || {};
  const SECTION_BORDER_STYLES = AssetCatalog.SECTION_BORDER_STYLES || [];
  const curatedAssetInfo =
    AssetCatalog.curatedAssetInfo ||
    ((path) => ({ name: path.split("/").pop().replace(".webp", ""), group: "Other" }));
  const ASSET_GROUP_ORDER =
    AssetCatalog.ASSET_GROUP_ORDER ||
    ["Archer", "Barbarian", "Dwarf", "Goth", "Ornament", "Spike", "Sticks", "Vine & Plant", "Base", "Emblems & Accents", "Other"];
  const parseAssets =
    AssetCatalog.parseAssets || (() => ({ borders: [], shapes: [] }));
  const Storage = window.__DDBStorage || {};

  // add/switch flows act on the active shape layer; style mode acts on a
  // section (target optional at this phase) and needs no layer manager.
  if (!styleMode) {
    const lm = _layerManager();
    if (!lm || !lm.activeLayerId) {
      window.showFeedback(
        "Please select/unlock a layer in Layer Management first.",
        "error",
      );
      return Promise.resolve(null);
    }
  }

  // Per-flow copy (border_shape_picker_ux_20260909, B-2 / AC-2): title and
  // OK verb are mode-driven. Titles: style keeps the legacy section-border
  // heading; switch names the action instead of the generic shape title.
  const MODE_TITLES = {
    add: "Select Decorative Shape",
    switch: "Switch Shape Asset",
    style: "Select Section Border",
  };
  const MODE_OK_VERBS = {
    add: "Add Shape",
    switch: "Switch Asset",
    style: "Apply Border Style",
  };

  return new Promise((resolve) => {
    const categories = parseAssets(ASSET_LIST);
    const overlay = document.createElement("div");
    overlay.className = "be-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "be-modal";
    // AC-9 (U-33): no inline pixel width. The shared modal shell owns the
    // responsive rule (max-width 640px / width 92%), so the picker fits a narrow
    // window instead of overflowing it. "One shared shell width for every mode"
    // is preserved — the shell is simply the thing that decides it now.
    modal.style.maxWidth = "600px";

    const h3 = document.createElement("h3");
    h3.textContent = MODE_TITLES[mode];
    modal.appendChild(h3);

    // Single-category mode: Section Styles (style) or a folder-filtered
    // asset grid (switch with a folder hint). In those cases the tab bar is
    // hidden (folder-filtered pickers already hide it today; style mode is a
    // single-category surface by design).
    const singleCategory =
      styleMode || filterFolder === "assets/shapes/" || filterFolder === "assets/";

    // Tab State
    let activeTab = styleMode
      ? "styles"
      : filterFolder === "assets/shapes/"
        ? "shapes"
        : filterFolder === "assets/"
          ? "borders"
          : current.includes("assets/shapes/")
            ? "shapes"
            : "borders";

    const tabsContainer = document.createElement("div");
    tabsContainer.className = "be-modal-tabs";
    tabsContainer.style.display = singleCategory ? "none" : "flex";
    tabsContainer.style.gap = "10px";
    tabsContainer.style.marginBottom = "15px";
    tabsContainer.style.borderBottom = "1px solid #444";

    const makeTab = (label) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.className = "be-modal-tab";
      b.style.padding = "8px 16px";
      b.style.background = "#222";
      b.style.color = "#ccc";
      b.style.border = "none";
      b.style.cursor = "pointer";
      b.style.borderTopLeftRadius = "4px";
      b.style.borderTopRightRadius = "4px";
      return b;
    };
    const tabDefs = styleMode
      ? []
      : [
          { key: "borders", label: "Borders" },
          { key: "shapes", label: "Shapes" },
          { key: "custom", label: "Custom" },
        ];
    const tabs = tabDefs.map((d) => {
      const b = makeTab(d.label);
      const activate = () => {
        activeTab = d.key;
        tabs.forEach((t) => {
          t.classList.remove("active");
          t.style.background = "#222";
          t.style.color = "#ccc";
        });
        b.classList.add("active");
        b.style.background = "#444";
        b.style.color = "white";
        tagsContainer.style.display =
          activeTab === "custom" || styleMode ? "none" : "flex";
        updateSearchVisibility();
        renderAssets(activeTab);
      };
      b.onclick = activate;
      tabsContainer.appendChild(b);
      return b;
    });
    if (styleMode) {
      // style mode still owns a (hidden) tabs container so tag handling and
      // render dispatch stay uniform below.
    }
    modal.appendChild(tabsContainer);

    // Tag Filters (asset tabs only)
    const tagsContainer = document.createElement("div");
    tagsContainer.className = "be-modal-tags";
    tagsContainer.style.display =
      styleMode || activeTab === "custom" || singleCategory ? "none" : "flex";
    tagsContainer.style.flexWrap = "wrap";
    tagsContainer.style.gap = "5px";
    tagsContainer.style.marginBottom = "15px";

    const tagList = [
      "bold",
      "hand drawn",
      "hollow",
      "ornament",
      "dwarf",
      "goth",
      "border",
      "barbarian",
      "vine",
      "plants",
      "spikes",
      "sticks",
    ];
    let activeTag = null;

    const renderTags = () => {
      if (styleMode || singleCategory) return;
      tagsContainer.innerHTML = "";
      const chip = (label, tag) => {
        const c = document.createElement("button");
        c.textContent = label;
        c.style.fontSize = "10px";
        c.style.padding = "2px 8px";
        c.style.borderRadius = "10px";
        c.style.border = "1px solid #666";
        c.style.background = activeTag === tag ? "#666" : "#222";
        c.style.color = "white";
        c.style.cursor = "pointer";
        c.onclick = () => {
          activeTag = activeTag === tag ? null : tag;
          renderTags();
          renderAssets(activeTab);
        };
        return c;
      };
      tagsContainer.appendChild(chip("All", null));
      tagList.forEach((tag) => tagsContainer.appendChild(chip(tag, tag)));
    };

    renderTags();
    modal.appendChild(tagsContainer);

    // --- Live search field (B-4 / AC-4): filters the catalog grid by curated
    // name, group, and tags; composes with the active tag pill.
    let searchQuery = "";
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "be-picker-search";
    searchInput.placeholder = "Search borders, shapes, corners…";
    searchInput.setAttribute("aria-label", "Search borders and shapes");
    searchInput.style.cssText =
      "box-sizing: border-box; width: 100%; margin-bottom: 10px;";
    const updateSearchVisibility = () => {
      searchInput.style.display =
        styleMode || activeTab === "custom" ? "none" : "block";
    };
    updateSearchVisibility();
    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value.trim();
      renderAssets(activeTab);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        // Esc in the field clears the query + focus — never cancels the modal.
        searchInput.value = "";
        searchQuery = "";
        renderAssets(activeTab);
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === "Enter") {
        // Typing/Enter in the field must not commit the modal.
        e.stopPropagation();
      }
    });
    modal.appendChild(searchInput);

    const optionsContainer = document.createElement("div");
    optionsContainer.className = "be-border-options";
    optionsContainer.style.maxHeight = "400px";
    optionsContainer.style.overflowY = "auto";
    optionsContainer.style.display = "flex";
    optionsContainer.style.flexWrap = "wrap";
    optionsContainer.style.gap = "10px";
    optionsContainer.style.padding = "10px";

    // Selection anchors + disabled-until-genuine-change (B-2 / AC-2).
    // - style: preselects the current class (or the Default fallback); OK is
    //   disabled while the selection still equals the anchor.
    // - switch: preselects the current asset when one is given (it shows what
    //   is being replaced); OK disabled until a DIFFERENT asset is chosen.
    // - add: NO fabricated preselection — nothing is chosen at open, so a
    //   stray Enter can never commit an unintended default; OK enables on the
    //   first explicit choice.
    let selectedStyle = styleMode
      ? SECTION_BORDER_STYLES.some((s) => s.className === current)
        ? current
        : "default-border"
      : "";
    let selectedAsset = "";
    if (!styleMode && current) {
      selectedAsset = current;
    }
    const openStyle = selectedStyle; // anchor (style mode)
    const openAsset = selectedAsset; // anchor (switch mode; '' in add)

    // --- Option-cell semantics (B-3 / AC-3): focusable cells with
    // role="option" + aria-selected, roving tabindex, shared pick routine.
    const setRovingTab = () => {
      const cells = Array.from(
        optionsContainer.querySelectorAll(".be-border-option"),
      );
      cells.forEach((c) => (c.tabIndex = -1));
      const anchor =
        cells.find((c) => c.classList.contains("selected")) || cells[0];
      if (anchor) anchor.tabIndex = 0;
    };

    const pickOption = (opt) => {
      optionsContainer
        .querySelectorAll(".be-border-option")
        .forEach((el) => {
          el.classList.remove("selected");
          el.setAttribute("aria-selected", "false");
        });
      opt.classList.add("selected");
      opt.setAttribute("aria-selected", "true");
      setRovingTab();
      updateOkState();
    };

    // AC-1: if duplicate base64 data produced multiple `.selected` cells,
    // keep only the most-recently rendered instance (the upload just added).
    const collapseToSingleSelection = () => {
      const sel = Array.from(
        optionsContainer.querySelectorAll(".be-border-option.selected"),
      );
      if (sel.length <= 1) return;
      sel.slice(0, -1).forEach((el) => {
        el.classList.remove("selected");
        el.setAttribute("aria-selected", "false");
      });
      setRovingTab();
    };

    const decorateCell = (opt) => {
      opt.setAttribute("role", "option");
      opt.setAttribute(
        "aria-selected",
        opt.classList.contains("selected") ? "true" : "false",
      );
      opt.tabIndex = opt.classList.contains("selected") ? 0 : -1;
      return opt;
    };

    // --- Live hover "try it" engine (B-5 / AC-5) ----------------------
    // Four contracts (from muse_review_2):
    //  Snapshot  — taken once at open, before any hover handler can fire;
    //              immutable deep clone of the controlled state.
    //  Mutation  — hover swaps ONLY the controlled class (style) or asset
    //              path (shape); foreign classes/styles/handles untouched; a
    //              transient be-hover-preview marker marks the preview state;
    //              no persistence writes during hover; rapid swap-to-swap
    //              without intermediate restore.
    //  Restore   — mouseleave AND every modal exit path restore byte-
    //              identical; idempotent; disconnected target → safe no-op.
    //  Lifecycle — handlers are element-scoped (die with the modal); no
    //              window/document listeners added by the engine.
    const BORDER_CLASSES = AssetCatalog.ALL_BORDER_STYLES || ["no-border"];
    const rawTarget = opts.target && opts.target.nodeType === 1 ? opts.target : null;
    const hoverTarget =
      !styleMode && mode === "add" ? null : rawTarget; // add never resolves a target
    let snapshot = null;
    let previewActive = false; // one live preview at a time (re-entrancy guard)

    const isConnected = (el) => {
      if (!el) return false;
      if (typeof el.isConnected === "boolean") return el.isConnected;
      return !!(
        el.ownerDocument &&
        el.ownerDocument.contains &&
        el.ownerDocument.contains(el)
      );
    };

    const takeSnapshot = () => {
      if (!hoverTarget) {
        snapshot = null;
        return;
      }
      const img = hoverTarget.querySelector("img.be-shape-asset");
      snapshot = {
        el: hoverTarget,
        kind: styleMode ? "style" : "asset",
        classes: Array.from(hoverTarget.classList),
        assetPath: styleMode ? null : hoverTarget.dataset.assetPath || "",
        imgSrc: img ? img.getAttribute("src") : null,
        hasImg: !!img,
      };
    };

    const applyStyleHover = (className) => {
      if (!snapshot || !isConnected(snapshot.el)) return;
      const el = snapshot.el;
      BORDER_CLASSES.forEach((c) => el.classList.remove(c));
      if (className && className !== "no-border") el.classList.add(className);
      el.classList.add("be-hover-preview");
      previewActive = true;
    };

    const applyAssetHover = (assetPath) => {
      if (!snapshot || !isConnected(snapshot.el)) return;
      const el = snapshot.el;
      el.dataset.assetPath = assetPath;
      let img = el.querySelector("img.be-shape-asset");
      const isData = assetPath && assetPath.startsWith("data:");
      const url = isData
        ? assetPath
        : typeof chrome !== "undefined" &&
            chrome.runtime &&
            chrome.runtime.getURL
          ? chrome.runtime.getURL(assetPath)
          : assetPath;
      if (img) {
        img.setAttribute("src", url);
      } else {
        img = document.createElement("img");
        img.className = "be-shape-asset";
        Object.assign(img.style, {
          width: "100%",
          height: "100%",
          objectFit: "contain",
          pointerEvents: "none",
          display: "block",
        });
        el.appendChild(img);
        img.setAttribute("src", url);
      }
      el.classList.add("be-hover-preview");
      previewActive = true;
    };

    // Restore contract: byte-identical return to the open-time snapshot;
    // idempotent; disconnected target → safe no-op. The snapshot itself is
    // session-persistent (immutable) so later hovers keep swapping.
    const restorePreview = () => {
      if (!snapshot || !previewActive) return;
      const s = snapshot;
      const el = s.el;
      if (!isConnected(el)) {
        previewActive = false;
        return;
      }
      if (s.kind === "style") {
        BORDER_CLASSES.forEach((c) => el.classList.remove(c));
        el.classList.remove("be-hover-preview");
      } else {
        el.classList.remove("be-hover-preview");
        if (typeof s.assetPath === "string") el.dataset.assetPath = s.assetPath;
        const img = el.querySelector("img.be-shape-asset");
        if (s.hasImg && img) img.setAttribute("src", s.imgSrc || "");
        else if (!s.hasImg && img) img.remove();
      }
      s.classes.forEach((c) => {
        if (!el.classList.contains(c)) el.classList.add(c);
      });
      previewActive = false;
    };

    // Magnified in-modal preview (add mode / no live target).
    const hoverStrip = document.createElement("div");
    hoverStrip.className = "be-picker-hover-strip";
    hoverStrip.style.cssText =
      "display: none; align-items: center; justify-content: center; gap: 12px; " +
      "width: 100%; min-height: 150px; background: #181818; border: 1px dashed #444; " +
      "border-radius: 8px; margin-bottom: 10px; padding: 10px; box-sizing: border-box;";
    const showStrip = (cell) => {
      hoverStrip.innerHTML = "";
      const prev = cell.querySelector(".be-border-preview");
      if (prev) {
        const clone = prev.cloneNode(true);
        clone.style.width = "130px";
        clone.style.height = "130px";
        clone.style.margin = "0";
        hoverStrip.appendChild(clone);
      }
      const cap = document.createElement("div");
      cap.textContent = cell.textContent.trim();
      cap.style.cssText = "font-size: 12px; color: #ccc; max-width: 220px;";
      hoverStrip.appendChild(cap);
      hoverStrip.style.display = "flex";
    };
    const hideStrip = () => {
      hoverStrip.style.display = "none";
      hoverStrip.innerHTML = "";
    };

    const bindPreviewCell = (cell, spec) => {
      cell.addEventListener("mouseenter", () => {
        if (!snapshot) {
          showStrip(cell);
          return;
        }
        if (spec.type === "style") applyStyleHover(spec.className);
        else applyAssetHover(spec.path);
      });
      cell.addEventListener("mouseleave", () => {
        if (!snapshot) {
          hideStrip();
          return;
        }
        restorePreview();
      });
    };

    const styleCell = (entry) => {
      const opt = document.createElement("div");
      opt.className = "be-border-option";
      if (selectedStyle === entry.className) opt.classList.add("selected");
      decorateCell(opt);

      const preview = document.createElement("div");
      preview.className = `be-border-preview be-frame-preview ${entry.className}`;
      opt.appendChild(preview);

      const label = document.createElement("div");
      label.textContent = entry.label;
      label.style.fontSize = "12px";
      opt.appendChild(label);

      opt.onclick = () => {
        selectedStyle = entry.className;
        pickOption(opt);
      };
      bindPreviewCell(opt, { type: "style", className: entry.className });
      return opt;
    };

    const renderAssets = async (tabName) => {
      try {
        optionsContainer.innerHTML = "";

        if (styleMode) {
          SECTION_BORDER_STYLES.forEach((entry) =>
            optionsContainer.appendChild(styleCell(entry)),
          );
          setRovingTab();
          return;
        }

        let assets = [];
        if (tabName === "custom") {
          assets = await Storage.getCustomShapes();
        } else {
          assets = categories[tabName] || [];
        }

        const isCustom = tabName === "custom";

        if (activeTag && !isCustom) {
          assets = assets.filter((a) => a.tags.includes(activeTag));
        }

        // Live search (B-4 / AC-4): match curated name, group, or tags.
        if (searchQuery && !isCustom) {
          const q = searchQuery.toLowerCase();
          assets = assets.filter((a) => {
            const info = curatedAssetInfo(a.path);
            return (
              info.name.toLowerCase().includes(q) ||
              info.group.toLowerCase().includes(q) ||
              (a.tags || []).some((t) => t.toLowerCase().includes(q))
            );
          });
        }

        // Group the catalog view by curated family (stable sort by group
        // rank); custom shapes keep insertion order and their own names.
        const groupRank = (g) => {
          const i = ASSET_GROUP_ORDER.indexOf(g);
          return i < 0 ? ASSET_GROUP_ORDER.length - 1 : i;
        };
        if (!isCustom) {
          assets = assets
            .slice()
            .sort(
              (a, b) =>
                groupRank(curatedAssetInfo(a.path).group) -
                groupRank(curatedAssetInfo(b.path).group),
            );
        }

        if (assets.length === 0 && !isCustom) {
          const empty = document.createElement("div");
          empty.textContent = searchQuery
            ? `No shapes found for “${searchQuery}”.`
            : "No shapes found for this filter.";
          empty.style.color = "#888";
          empty.style.padding = "20px";
          empty.style.gridColumn = "1 / -1";
          empty.style.textAlign = "center";
          optionsContainer.appendChild(empty);
          return;
        }

        if (isCustom) {
          const uploadContainer = document.createElement("div");
          uploadContainer.style.cssText =
            "grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; padding: 20px; border: 2px dashed #444; border-radius: 8px; margin-bottom: 10px;";

          const uploadBtn = document.createElement("button");
          uploadBtn.textContent = "Upload from disk";
          uploadBtn.className = "be-modal-button";
          uploadBtn.style.cssText =
            "background: #0056b3; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;";
          // C-1 / AC-1 (custom_upload_templates_ux_20260909): upload keeps
          // the modal OPEN — save to the library, refresh ONLY the Custom
          // grid, preselect the uploaded shape (OK enables per the
          // disabled-until-genuine-change contract), then OK applies it in
          // the current mode. Cancel = library-only, no sheet mutation.
        let uploadBusy = false; // closure-level double-click guard
        uploadBtn.onclick = async () => {
          if (uploadBusy) return; // second click while busy: no-op
          uploadBusy = true;
          uploadBtn.disabled = true;
          try {
            const shape = await uploadShapeFromDisk();
            if (!shape) return; // user cancelled compression / dismissed — unchanged
            // Preselect by DATA identity (name/id collisions never drive it);
            // most-recent instance wins if the same data already existed.
            selectedAsset = shape.data;
            await renderAssets("custom"); // grid-only re-render
            collapseToSingleSelection();
            updateOkState();
            window.showFeedback(
              `Uploaded “${shape.name}” — press ${MODE_OK_VERBS[mode]} to place it.`,
            );
          } catch (err) {
            if (err && err.message !== "User cancelled compression") {
              window.safeLog?.("error", "[DDB Print Enhance] Upload failed:", err);
              shapePickerNotifyError("Failed to process image. Please try a different file.");
            }
          } finally {
            uploadBusy = false;
            uploadBtn.disabled = false;
          }
        };
          uploadContainer.appendChild(uploadBtn);

          const helpText = document.createElement("div");
          helpText.textContent =
            "PNG, JPEG, WebP, or SVG. Large files will be compressed.";
          helpText.style.cssText =
            "font-size: 11px; color: #777; margin-top: 8px;";
          uploadContainer.appendChild(helpText);

          optionsContainer.appendChild(uploadContainer);

          if (assets.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "No custom shapes uploaded yet.";
            empty.style.color = "#555";
            empty.style.padding = "20px";
            empty.style.gridColumn = "1 / -1";
            empty.style.textAlign = "center";
            optionsContainer.appendChild(empty);
          }
        }

        let shownGroup = null;
        const groupHeader = (group) => {
          const h = document.createElement("div");
          h.className = "be-asset-group";
          h.textContent = group;
          h.style.cssText =
            "flex-basis: 100%; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #b9a47a; border-bottom: 1px solid #3a3a3a; margin: 10px 0 4px; padding-bottom: 3px;";
          return h;
        };

        assets.forEach((asset) => {
          // Curated display info (B-4 / AC-4); custom shapes keep their
          // user-supplied names and render without family headers.
          const info = isCustom ? null : curatedAssetInfo(asset.path);
          if (info && info.group !== shownGroup) {
            shownGroup = info.group;
            optionsContainer.appendChild(groupHeader(info.group));
          }
          const displayName = info
            ? info.name
            : asset.name || asset.id || "Custom Shape";
          const opt = document.createElement("div");
          opt.className = "be-border-option";
          opt.title = displayName;
          const assetPath = asset.path || asset.data; // Use data (base64) for custom
          if (selectedAsset === assetPath) opt.classList.add("selected");
          decorateCell(opt);

          const preview = document.createElement("div");
          preview.className = `be-border-preview`;

          // Asset Application Logic using window.AssetCatalog.ASSET_METADATA
          const meta =
            ASSET_METADATA[asset.path] ||
            (tabName === "custom" ? { isBackground: true } : null);
          if (meta) {
            const url =
              tabName === "custom"
                ? asset.data
                : chrome.runtime.getURL(asset.path);
            if (meta.isBackground) {
              preview.style.backgroundImage = `url('${url}')`;
              preview.style.backgroundSize = "contain";
              preview.style.backgroundRepeat = "no-repeat";
              preview.style.backgroundPosition = "center";
              preview.style.border = "none";
            } else if (meta.className) {
              preview.classList.add(meta.className);
            } else {
              preview.style.borderStyle = "solid";
              preview.style.borderImageSource = `url('${url}')`;
              preview.style.borderImageSlice = meta.slice
                ? meta.slice.toString()
                : "33";
              preview.style.borderImageWidth = meta.width || "20px";
              preview.style.borderImageOutset = meta.outset || "0";
              preview.style.borderImageRepeat = "round";
            }
          } else {
            // Fallback for unknown assets
            const url =
              tabName === "custom"
                ? asset.data
                : chrome.runtime.getURL(asset.path);
            preview.style.borderStyle = "solid";
            preview.style.borderImageSource = `url('${url}')`;
            preview.style.borderImageSlice = "33";
            preview.style.borderImageWidth = "20px";
          }

          opt.appendChild(preview);
          // Category-aware preview geometry (B-5 / AC-5): frame assets tile
          // on an aspect pane; background/corner art on a transparent pane.
          preview.classList.add(
            tabName === "custom" ||
              (meta && meta.isBackground)
              ? "be-art-preview"
              : "be-frame-preview",
          );

          const label = document.createElement("div");
          label.textContent = displayName;
          label.style.fontSize = "10px";
          label.style.marginTop = "5px";
          opt.appendChild(label);

          opt.onclick = () => {
            selectedAsset = assetPath;
            pickOption(opt);
          };
          bindPreviewCell(opt, { type: "asset", path: assetPath });

          optionsContainer.appendChild(opt);
        });
        setRovingTab();
      } catch (err) {
        window.safeLog?.("warn", "DEBUG ERROR in renderAssets:", err);
      }
    };

    // Mark the active tab on first render
    if (!styleMode) {
      tabs.forEach((t) => t.classList.remove("active"));
      const activeTabDefIndex = tabDefs.findIndex((d) => d.key === activeTab);
      if (activeTabDefIndex >= 0) {
        tabs[activeTabDefIndex].classList.add("active");
        tabs[activeTabDefIndex].style.background = "#444";
        tabs[activeTabDefIndex].style.color = "white";
      }
    }

    // Snapshot the live target ONCE, before the grid (and its hover
    // handlers) exist — AC-5 snapshot contract.
    takeSnapshot();

    renderAssets(activeTab);
    modal.appendChild(optionsContainer);
    modal.appendChild(hoverStrip);

    // --- Keyboard grid navigation (B-3 / AC-3): arrow keys move the roving
    // focus within the option cells; Home/End jump to the ends.
    optionsContainer.addEventListener("keydown", (e) => {
      const cells = Array.from(
        optionsContainer.querySelectorAll(".be-border-option"),
      );
      if (!cells.length) return;
      const idx = cells.indexOf(document.activeElement);
      if (idx < 0) return;
      const step =
        e.key === "ArrowDown" || e.key === "ArrowRight"
          ? 1
          : e.key === "ArrowUp" || e.key === "ArrowLeft"
            ? -1
            : 0;
      if (step !== 0) {
        e.preventDefault();
        e.stopPropagation();
        const ni = Math.max(0, Math.min(cells.length - 1, idx + step));
        cells.forEach((c) => (c.tabIndex = -1));
        cells[ni].tabIndex = 0;
        cells[ni].focus();
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        e.stopPropagation();
        cells.forEach((c) => (c.tabIndex = -1));
        cells[0].tabIndex = 0;
        cells[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        e.stopPropagation();
        const last = cells[cells.length - 1];
        cells.forEach((c) => (c.tabIndex = -1));
        last.tabIndex = 0;
        last.focus();
      }
    });

    // --- Actions + lifecycle (B-3 / AC-3): one window keydown handler,
    // removed on EVERY close path; close ✕; backdrop-click cancel; settled
    // guard so no close path double-resolves.
    let settled = false;
    const closeModal = (value) => {
      if (settled) return;
      settled = true;
      // AC-5 restore contract: EVERY exit path restores a live hover preview
      // and hides the magnified strip before the modal goes away.
      restorePreview();
      hideStrip();
      window.removeEventListener("keydown", onModalKey);
      overlay.remove();
      resolve(value);
    };

    const modalTitle = MODE_TITLES[mode];

    // Close ✕ (top-right of the shell).
    const closeBtn = document.createElement("button");
    closeBtn.className = "be-modal-close";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.title = "Close";
    closeBtn.onclick = () => closeModal(null);
    modal.appendChild(closeBtn);

    const actions = document.createElement("div");
    actions.className = "be-modal-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "be-modal-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = () => closeModal(null);
    actions.appendChild(cancelBtn);

    const okBtn = document.createElement("button");
    okBtn.className = "be-modal-ok";
    // Mode-driven verb (B-2 / AC-2): add "Add Shape", switch "Switch Asset",
    // style "Apply Border Style".
    okBtn.textContent = MODE_OK_VERBS[mode];

    // Disabled-until-genuine-selection (B-2 / AC-2): hovering never flips
    // this state — the delta is computed from click-selection only (AC-5
    // restore contract keeps hover previews out of the committed state).
    const updateOkState = () => {
      let disabled;
      if (styleMode) {
        disabled = selectedStyle === openStyle;
      } else if (mode === "switch") {
        disabled = !selectedAsset || (!!openAsset && selectedAsset === openAsset);
      } else {
        // add: nothing chosen at open → disabled until the first choice.
        disabled = !selectedAsset;
      }
      okBtn.disabled = disabled;
      // Strong disabled affordance: dim + full desaturate + not-allowed so
      // the state reads unambiguously in pixels (visual-gate finding,
      // Phase 2 round 1: 0.5 opacity alone was not distinguishable).
      okBtn.style.opacity = disabled ? "0.45" : "1";
      okBtn.style.filter = disabled ? "grayscale(0.8) brightness(0.85)" : "none";
      okBtn.style.cursor = disabled ? "not-allowed" : "pointer";
    };

    okBtn.onclick = () => {
      if (okBtn.disabled) return; // Enter/click while disabled is a no-op
      closeModal(
        styleMode ? { style: selectedStyle } : { assetPath: selectedAsset },
      );
    };
    updateOkState();
    actions.appendChild(okBtn);

    // Dialog a11y (B-3 / AC-3).
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", modalTitle);
    modal.style.position = "relative";

    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Move focus INTO the dialog on open (U-20 follow-up: this dialog measured
    // `activeElementInside: false`, so it was keyboard-reachable only after
    // tabbing in from the page behind it). Prefer the search field — it is the
    // primary control — then the first option cell, then the close ✕.
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        const visibleSearch =
          searchInput && searchInput.style.display !== "none" ? searchInput : null;
        const landing =
          visibleSearch ||
          optionsContainer.querySelector(".be-border-option") ||
          closeBtn;
        if (landing && typeof landing.focus === "function") landing.focus();
      });
    }

    // Backdrop click cancels (only when the overlay itself is the target —
    // a pointer-down that starts inside the modal and releases outside must
    // not close).
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) closeModal(null);
    });

    // One window keydown handler for the whole modal lifetime (B-3 / AC-3):
    //   Esc cancels from anywhere; Enter/Space activate the FOCUSED control
    //   (focused Cancel/✕ cancel, focused OK commits when enabled, a focused
    //   option cell selects it) — the legacy global "Enter always commits"
    //   trap is gone. As a convenience, Enter with NO interactive control
    //   focused commits when OK is enabled (matches the old happy path
    //   without the focused-Cancel trap).
    function onModalKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal(null);
        return;
      }
      if (e.key !== "Enter" && e.key !== " ") return;
      const ae = document.activeElement;
      // Text fields handle their own keys — typing/Enter must not commit.
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return;
      if (ae && ae.classList && ae.classList.contains("be-border-option")) {
        // Enter/Space on a focused option selects it (no commit).
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          ae.click();
        }
        return;
      }
      if (ae && (ae === cancelBtn || ae === closeBtn)) {
        e.preventDefault();
        ae.click();
        return;
      }
      if (ae && ae === okBtn) {
        // Native semantics: a disabled OK does not activate.
        if (!okBtn.disabled) {
          e.preventDefault();
          okBtn.click();
        }
        return;
      }
      if (e.key === "Enter" && !okBtn.disabled) {
        // Convenience commit when nothing interactive is focused.
        e.preventDefault();
        okBtn.click();
      }
    }
    window.addEventListener("keydown", onModalKey);
  });
}

/** Legacy alias: route to add/switch mode from (currentAsset, filterFolder). */
function showShapePickerModal(currentAsset = "", filterFolder = "", target) {
  const mode = currentAsset || filterFolder ? "switch" : "add";
  return showAssetPickerModal({
    mode,
    current: currentAsset,
    folder: filterFolder,
    target,
  });
}

/**
 * C-1 / AC-1 (custom_upload_templates_ux_20260909).
 * `uploadFromFile`: the DOM-free pipeline for one disk upload. Guarded by
 * `_uploadInFlight`, so a second concurrent call is a no-op (null).
 *  - saves to the library + appends to the current layout customShapes,
 *  - refreshes the layer manager exactly once (zero on abort),
 *  - NO toast and NO modal/sheet side effects — placement is the caller's
 *    decision (the picker stays open; OK places the shape in the mode).
 * Resolves the saved {id,name,data}; resolves null when compression is
 * user-cancelled (aborts before any persist/refresh); rejects on real
 * processing errors.
 */
async function uploadFromFile(file) {
  if (!file) return null;
  if (_uploadInFlight) return null; // second concurrent upload: no-op
  _uploadInFlight = true;
  const ImageProcessor = window.ImageProcessor || {};
  const Storage = window.__DDBStorage || {};
  const getCharacterId =
    window.getCharacterId || (() => window.location.pathname.split("/").pop());
  try {
    const base64 = await ImageProcessor.processImage(file);
    const shapeId = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const shapeName = file.name.split(".")[0];
    const customShape = { id: shapeId, name: shapeName, data: base64 };

    await Storage.saveCustomShape(customShape);

    const characterId = getCharacterId() || "GLOBAL";
    const layout = await Storage.loadLayout(characterId);
    if (layout) {
      if (!layout.customShapes) layout.customShapes = [];
      layout.customShapes.push(customShape);
      await Storage.saveLayout(characterId, layout);
    }

    const lm = window.PeDom ? window.PeDom().getLayerManager() : null;
    if (lm) lm.refreshUI();

    return customShape;
  } catch (err) {
    if (err && err.message === "User cancelled compression") {
      return null; // abort before persist/refresh
    }
    throw err;
  } finally {
    _uploadInFlight = false;
  }
}

/**
 * `uploadShapeFromDisk`: open the file dialog and run `uploadFromFile` on the
 * picked file. Resolves the saved shape; resolves null on user-cancelled
 * compression OR a dismissed dialog (window regains focus with no change
 * started). The pipeline guard lives in `uploadFromFile`; this function only
 * owns the dialog → settle lifecycle so a dismissed dialog can never leave
 * the caller's button disabled.
 */
function uploadShapeFromDisk() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png, image/jpeg, image/webp, image/svg+xml";
    let started = false;
    let released = false;

    const settle = (fn, value) => {
      if (released) return;
      released = true;
      window.removeEventListener("focus", onFocus);
      input.value = ""; // reset so same-file reselect fires change again
      fn(value);
    };

    function onFocus() {
      // Returning from the (modal) file dialog with no change started means
      // the user dismissed it → release (null). If a change started, the
      // change path owns the settle.
      if (!started) settle(resolve, null);
    }

    input.onchange = async (e) => {
      started = true;
      try {
        const shape = await uploadFromFile(e.target.files && e.target.files[0]);
        settle(resolve, shape);
      } catch (err) {
        settle(reject, err);
      }
    };

    // Test seam (track dead_exports_20260910 — has no product caller; KEEP):
    // jsdom cannot open a native file dialog, so under __DDB_TEST_MODE__ the
    // created input is exposed for test/unit/custom_upload_flow.test.js to
    // dispatch a change with a File. Remove only together with that test.
    if (window.__DDB_TEST_MODE__) {
      window.__lastUploadInput = input;
    }
    window.addEventListener("focus", onFocus);
    input.click();
  });
}

const ShapePicker = {
  showShapePickerModal,
  showAssetPickerModal,
  uploadShapeFromDisk,
  uploadFromFile,
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = ShapePicker;
}
if (typeof window !== "undefined") {
  window.ShapePicker = ShapePicker;
  window.showAssetPickerModal = showAssetPickerModal;
}
