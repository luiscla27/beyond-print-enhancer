/**
 * Print styles: injected @media print CSS generation, layout-bounds
 * recomputation, page separators and compact-mode CSS.
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 6. Loaded before
 * js/main.js in the production script list (js/background.js) and in
 * the shared test harness boot.
 */

"use strict";

// safeLog lives inside main.js's IIFE (exported to window.safeLog only when
// main.js runs). A top-level `const safeLog` here would collide with js/dnd.js
// (also `const safeLog`) in suites that concatenate both files into one
// <script>, so resolve it lazily at the single call site below.

  /**
   * Updates the injected CSS block for print z-index based on data attributes.
   */
  function updatePrintStyles() {
    let style = document.getElementById("be-print-z-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "be-print-z-style";
      if (document.head) document.head.appendChild(style);
      else document.body.appendChild(style);
    }

    const elements = document.querySelectorAll("[data-print-z]");
    const disabledLayers = document.querySelectorAll(
      '[data-print-disabled="true"]',
    );

    let css = "@media print {\n";

    // Hide the layer management panel on print
    css += "  #print-enhance-layer-manager { display: none !important; }\n";

    // Force all sections and layer containers to be fully opaque on print (ignores edit-mode/lock opacity)
    css +=
      "  .be-shape-layer-container, #print-enhance-sections-layer, .be-section-wrapper, .be-shape-wrapper, .be-layer-locked .be-section-wrapper, .be-layer-locked .be-shape-wrapper { opacity: 1 !important; visibility: visible !important; }\n";

    // Force layer ordering on print: Sections < Shapes
    css += "  #print-enhance-sections-layer { z-index: 1000 !important; }\n";
    css += "  .be-shape-layer-container { z-index: 2000 !important; }\n";

    // Selection and Hover Highlights
    css +=
      "  .be-active-wrapper, .be-active-target, #print-enhance-selection-ring, .be-section-wrapper:hover, .be-shape-wrapper:hover, .be-focus-highlight-hover, .be-active-section { filter: none !important; outline: none !important; }\n";

    // Hide layers that are explicitly disabled for print
    disabledLayers.forEach((layer) => {
      if (layer.id) {
        css += `  #${layer.id} { display: none !important; }\n`;
      }
    });

    // Handle z-index overrides
    elements.forEach((el) => {
      const z = el.dataset.printZ;
      if (el && el.id) {
        // Use ID for maximum specificity to override inline styles during print
        css += `  #${el.id} { z-index: ${z} !important; }\n`;
      } else {
        // Fallback to data attribute if ID is missing
        css += `  [data-print-z="${z}"] { z-index: ${z} !important; }\n`;
      }
    });
    css += "}";
    style.textContent = css;
  }

  /**
   * Updates the size of the layout wrapper to fit all sections
   */
  function updateLayoutBounds() {
    const container = document.getElementById("print-layout-wrapper");
    if (!container) return;

    let maxBottom = 0;
    let maxRight = 0;

    const wrappers = Array.from(
      document.querySelectorAll(".be-section-wrapper"),
    );
    wrappers.forEach((wrapper) => {
      // Since wrappers are absolute in a relative container, style.top is relative to container top.
      const top = parseInt(wrapper.style.top) || 0;
      const left = parseInt(wrapper.style.left) || 0;
      const width = wrapper.offsetWidth || 0;
      const height = wrapper.offsetHeight || 0;

      const bottom = top + height;
      const right = left + width;

      if (bottom > maxBottom) maxBottom = bottom;
      if (right > maxRight) maxRight = right;
    });

    // Add padding (e.g., 50px)
    const newHeight = maxBottom + 50;
    const newWidth = maxRight + 50;

    // Apply min-height/width to ensure it at least covers the viewport
    // User Request: Update body container height to always be at least the same height as furthest coordinate

    // 1. Update the wrapper itself
    const minH = Math.max(newHeight, window.innerHeight) + "px";
    container.style.minHeight = minH;
    container.style.height = minH; // Explicitly set height too just in case
    container.style.minWidth = Math.max(newWidth, window.innerWidth) + "px";

    // 2. Also attempt to update parent containers if they restrict height
    let sheetDesktop, sheetInner;
    if (window.DomManager) {
      const desktopWrapper =
        window.DomManager.getInstance().getCharacterSheet();
      sheetDesktop = desktopWrapper ? desktopWrapper.element : null;

      const innerWrapper = window.DomManager.getInstance().getSheetInner();
      sheetInner = innerWrapper ? innerWrapper.element : null;
    } else {
      sheetDesktop = document.querySelector(".ct-character-sheet-desktop");
      sheetInner = document.querySelector(".ct-character-sheet__inner");
    }

    if (sheetDesktop) {
      sheetDesktop.style.minHeight = minH;
      // height: auto is usually enough on parent if child pushes it, but flex/grid/absolute might interfere
      sheetDesktop.style.height = "auto";
    }

    if (sheetInner) {
      sheetInner.style.minHeight = minH;
    }

    drawPageSeparators(newHeight, 1200);
  }

  /**
   * Draws visual page separators to indicate print boundaries.
   * Scales the "page height" based on how much the content needs to shrink to fit 8.5in width.
   */
  function drawPageSeparators(totalHeight, totalWidth) {
    const container = document.getElementById("print-layout-wrapper");
    if (!container) return;

    // Remove existing separators
    container
      .querySelectorAll(".print-page-separator")
      .forEach((el) => el.remove());

    // Constants for Letter Portrait at 96 DPI
    // Standard Letter is 8.5in x 11in.
    // However, most browsers apply margins (approx 0.4-0.5in).
    // Printable Area ≈ 8in x 10in.
    // Width: 8in * 96 = 768px (safe area)
    // Height: 10in * 96 = 960px (safe area)
    const PAGE_WIDTH_PX = 816; // 8.5in full width for scaling calc
    const PAGE_HEIGHT_PX = 960; // 10in height (excludes ~0.5in margins top/bottom)

    // Calculate effective page height if scaled to fit
    // If content is wider than 816px, the browser shrinks it.
    // Scale Factor = 816 / totalWidth (e.g. 0.68)
    // Effective Pixel Height = 1056 / Scale Factor
    // Example: 1200px wide content. Scale = 0.68.
    // Effective Height = 1056 / 0.68 = 1552px.

    // Default scale is 1 if content fits or is smaller
    let effectivePageHeight = PAGE_HEIGHT_PX;
    let scaleLabel = "100%";

    if (totalWidth > PAGE_WIDTH_PX) {
      const scale = PAGE_WIDTH_PX / totalWidth;
      effectivePageHeight = PAGE_HEIGHT_PX / scale;
      scaleLabel = `${Math.round(scale * 100)}%`;
    }

    window.safeLog?.(
      "log",
      `[DDB Print] Separators: Content Width ${totalWidth}px. Scale ${scaleLabel}. Page Height ${Math.round(effectivePageHeight)}px`,
    );

    let currentY = effectivePageHeight;
    let pageNum = 1;

    while (currentY < totalHeight) {
      const separator = document.createElement("div");
      separator.className = "print-page-separator";
      separator.style.position = "absolute";
      separator.style.left = "0";
      separator.style.top = `${currentY}px`;
      separator.style.width = `${totalWidth}px`;
      separator.style.height = "2px";
      separator.style.borderTop = "2px dashed red";
      separator.style.zIndex = "99995";
      separator.style.pointerEvents = "none";
      separator.style.opacity = "0.5";

      // Label
      const label = document.createElement("span");
      label.textContent = `Page ${pageNum} END (Scale: ${scaleLabel})`;
      label.style.position = "absolute";
      label.style.right = "5px";
      label.style.top = "-15px";
      label.style.color = "red";
      label.style.fontSize = "12px";
      label.style.fontWeight = "bold";
      label.style.backgroundColor = "rgba(255,255,255,0.8)";

      separator.appendChild(label);
      container.appendChild(separator);

      currentY += effectivePageHeight;
      pageNum++;
    }
  }

  /**
   * Injects CSS for Compact Mode.
   */
  function injectCompactStyles() {
    if (document.getElementById("ddb-print-compact-style")) return;

    // Ensure all keys exist to prevent template error if fallback was partial
    const style = document.createElement("style");
    style.id = "ddb-print-compact-style";
    style.textContent = `
        .print-section-container.be-compact-mode {
            --reduce-height-by: 0px;
            --reduce-width-by: 0px;
        }
        .print-section-container.be-compact-mode [class^="styles_tableHeader__"],
        .print-section-container.be-compact-mode [class$="__header"] {
            margin-top: 10px !important;
            margin-bottom: 5px !important;
            padding-bottom: 2px !important;
            border-bottom: 1px solid #ccc !important;
        }
        .print-section-container.be-compact-mode [class$="__heading"] {
            margin: 0px !important;
        }
        .print-section-container.be-compact-mode [class$="-row"] {
            padding: 2px 0px !important;
        }
        .print-section-container.be-compact-mode [class$="__row-header"] [class$="--primary"],
        .print-section-container.be-compact-mode [class$="-row"] [class$="-row__primary"] {
            max-width: 80px !important;
        }
        .print-section-container.be-compact-mode [class$="-content"] > div {
            padding: 0 !important;
            min-height: auto !important;
            border-bottom: 1px dashed #eee !important;
        }
        
        /* Hide or shrink icons */
        .print-section-container.be-compact-mode [class$="__attack-save-icon"],
        .print-section-container.be-compact-mode [class$="__range-icon"],
        .print-section-container.be-compact-mode [class$="__casting-time-icon"],
        .print-section-container.be-compact-mode [class$="__attack-save-icon"],
        .print-section-container.be-compact-mode [class$="__damage-effect-icon"]{
            transform: scale(0.8);
            margin: 0 !important;
        }
        
        .print-section-container.be-compact-mode .ddbc-file-icon {
            width: 16px !important;
            height: 16px !important;
        }
        
        /* Hide previews for extras */
        .print-section-container.be-compact-mode .ct-extras [class$="--preview"],
        .print-section-container.be-compact-mode .ct-extras [class$="__preview"] {
            display: none !important;
        }

        /* Tighten text */
        .print-section-container.be-compact-mode [class$="__label"],
        .print-section-container.be-compact-mode [class$="__header"],
        .print-section-container.be-compact-mode [class$="__notes"] {
            font-size: 11px !important;
            line-height: 1.2 !important;
        }
        
        .print-section-container.be-compact-mode [class$="__activation"],
        .print-section-container.be-compact-mode [class$="__range"],
        .print-section-container.be-compact-mode [class$="__hit-dc"],
        .print-section-container.be-compact-mode [class$="__effect"] {
            font-size: 11px !important;
            padding: 0 2px !important;
            vertical-align: middle !important;
        }

        /* Buttons (Cast, At Will, etc) */
        .print-section-container.be-compact-mode button[class$="__container"],
        .print-section-container.be-compact-mode .ct-button {
            height: 20px !important;
            line-height: 20px !important;
            padding: 0!important;
            font-size: 10px !important;
            min-height: 0 !important;
        }

        /* Slots Checkboxes - Align to immediate left of "SLOTS" label if possible, or just left align container */
        .print-section-container.be-compact-mode [class$="__slots"] {
            margin-left: 10px !important;
            margin-right: auto !important; /* Push to left */
            transform: scale(0.9);
            transform-origin: left center;
        }
        
        .print-section-container.be-compact-mode [class$="__header-content"] {
            flex: 0 0 auto !important; /* Stop taking full width */
            margin-right: 10px !important;
        }
        
        .print-section-container.be-compact-mode [class$="__header"] {
            justify-content: flex-start !important; /* Align content to start */
        }

        /* General width reductions for columns */
        .print-section-container.be-compact-mode [class$="__action"],
        .print-section-container.be-compact-mode [class$="__distance"],
        .print-section-container.be-compact-mode [class$="__meta"] {
            width: auto !important;
            max-width: none !important;
        }

        /* Spell Details Trigger Button */
        .ct-spells-spell {
            position: relative;
        }
        .be-spell-details-button {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            display: none;
            background: #242528;
            color: white;
            border: 1px solid #444;
            border-radius: 4px;
            padding: 2px 8px;
            font-size: 11px;
            cursor: pointer;
            z-index: 100;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }
        .ct-spells-spell:hover .be-spell-details-button {
            display: block;
        }
        .be-spell-details-button:hover {
            background: #333;
            border-color: #666;
        }

        /* Loading Spinner */
        .be-spinner {
            border: 4px solid rgba(255, 255, 255, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #EC2127;
            animation: be-spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes be-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Error UI Buttons */
        .be-error-actions {
            display: flex;
            gap: 10px;
            margin-top: 10px;
            justify-content: center;
        }
        /* AC-6 (selection_model_ia_20260910): retry/delete used the Material
           green/red, which are not in this product's palette. Retry is the
           affirmative action (gold), delete is destructive (ember). */
        .be-retry-button { background: var(--be-gold) !important; color: var(--be-gold-ink) !important; }
        .be-delete-button { background: var(--be-ember) !important; color: var(--be-ground-well) !important; }

        /* Dynamic Extraction Trigger */
        .be-extractable {
            transition: outline 0.1s ease-in-out;
            margin: 2px;
        }
        .be-extractable:hover {
            outline: 2px dashed black !important;
            position: relative;
        }
        .be-extractable:hover:before {
            content: "Extract content with double click";
            position: absolute;
            top: -25px;
            left: 0;
            background: black;
            color: white;
            padding: 2px 8px;
            font-size: 12px;
            border-radius: 4px;
            white-space: nowrap;
            z-index: 10001;
            pointer-events: none;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }

        /*Minumum sizes*/
        .ddbc-armor-class-box {
            min-height: 100px;
        }
    `;
    document.head.appendChild(style);
  }


function enforceFullHeight() {
  const styleId = "ddb-print-enhance-style";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
      :root {
          --border-img: url('${chrome.runtime.getURL("assets/border_default.webp")}');
          --border-img-width: 28px;
          --border-img-outset: 16px;
          --border-img-slice: 33;
          --btn-color: #c53131;
          --btn-color-highlight: #f18383ff;
          --be-full-filter: none;
          --be-decoration-filter: none;
          --be-hue-filter: none;
          --be-inv-hue-filter: none;
      }
      .no-border {
          border-image-source: none !important;
          border-style: none !important;
      }
      /* Hidden ::before when no-border */
      .no-border::before {
          display: none !important;
      }
      .default-border {
          --border-img: url('${chrome.runtime.getURL("assets/border_default.webp")}');
          --border-img-width: 28px;
          --border-img-outset: 16px;
          --border-img-slice: 33;
      }
      .ability_border {
          --border-img: url('${chrome.runtime.getURL("assets/border_ability.webp")}');
          --border-img-width: 28px;
          --border-img-slice: 25;
          --border-img-outset: 8px;
      }
      .spikes_border {
          --border-img: url('${chrome.runtime.getURL("assets/border_spikes.webp")}');
          --border-img-width: 118px;
          --border-img-slice: 177;
          --border-img-outset: 55px;
      }
      .barbarian_border {
          --border-img: url('${chrome.runtime.getURL("assets/border_barbarian.webp")}');
          --border-img-width: 88px;
          --border-img-slice: 146;
          --border-img-outset: 71px;
      }
      .goth_border {
          --border-img: url('${chrome.runtime.getURL("assets/border_goth1.webp")}');
          --border-img-width: 111px;
          --border-img-slice: 250;
          --border-img-outset: 50px 35px;
      }
      .plants_border {
          --border-img: url('${chrome.runtime.getURL("assets/vine_plants.webp")}');
          --border-img-width: 145px;
          --border-img-slice: 219;
          --border-img-outset: 50px;
      }
      .box_border {
          --border-img: url('${chrome.runtime.getURL("assets/border_box.webp")}');
          --border-img-width: 25px;
          --border-img-slice: 22;
          --border-img-outset: 7px 10px;
      }
      .dwarf_border {
          --border-img: url('${chrome.runtime.getURL("assets/dwarf.webp")}');
          --border-img-width: 205px;
          --border-img-slice: 206;
          --border-img-outset: 173px;
      }
      .dwarf_hollow_border {
          --border-img: url('${chrome.runtime.getURL("assets/dwarf_hollow.webp")}');
          --border-img-width: 205px;
          --border-img-slice: 206;
          --border-img-outset: 173px;
      }
      .sticks_border {
          --border-img: url('${chrome.runtime.getURL("assets/sticks.webp")}');
          --border-img-width: 90px;
          --border-img-slice: 245;
          --border-img-outset: 22px;
      }
      .ornament_border {
          --border-img: url('${chrome.runtime.getURL("assets/ornament.webp")}');
          --border-img-width: 60px;
          --border-img-slice: 105;
          --border-img-outset: 25px;
      }
      .ornament2_border {
          --border-img: url('${chrome.runtime.getURL("assets/ornament2.webp")}');
          --border-img-width: 60px;
          --border-img-slice: 105;
          --border-img-outset: 25px;
      }
      .ornament_bold_border {
          --border-img: url('${chrome.runtime.getURL("assets/ornament_bold.webp")}');
          --border-img-width: 80px;
          --border-img-slice: 205;
          --border-img-outset: 25px;
      }

      /* Context Menu Styles */
      .be-context-menu {
          position: absolute;
          background: #fff;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          padding: 4px 0;
          z-index: 32000;
          display: none;
          min-width: 120px;
      }
      .be-context-menu button {
          display: block;
          width: 100%;
          text-align: left !important;
          padding: 8px 12px !important;
          border: none !important;
          background: none !important;
          cursor: pointer !important;
          font-size: 12px !important;
          color: #333 !important;
          height: auto !important;
          border-radius: 0 !important;
          filter: none !important;
      }
      .be-context-menu button:hover {
          background-color: #f5f5f5 !important;
      }
      .be-more-options-button {
          cursor: pointer;
          font-size: 16px;
          background: none;
          border: none;
          padding: 0 4px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
      }

      /* Layer Management Panel Styles */
      .be-layer-panel {
          position: fixed;
          top: 10px;
          right: 10px;
          width: 250px;
          background: #222;
          color: white;
          border: 1px solid #444;
          padding: 8px;
          z-index: 31000; /* Above modals and other extensions */
          font-family: sans-serif;
          font-size: 12px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.5);
          transition: width 0.3s ease, height 0.3s ease;
      }
      .be-layer-panel.minimized {
          width: 180px;
          height: 32px;
          padding: 4px 8px;
          overflow: hidden;
      }
      .be-layer-panel.minimized .be-layer-panel-header {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
      }
      .be-layer-panel-header {
          border-bottom: 1px solid #444;
          margin-bottom: 8px;
          padding-bottom: 4px;
          text-align: center;
      }
      .be-layer-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
      }
      .be-layer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px;
          background: #333;
          border-radius: 4px;
      }
      .be-layer-controls {
          display: flex;
          gap: 4px;
      }
      .be-layer-controls button {
          background: #444;
          border: 1px solid #555;
          color: white;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 14px;
      }
      .be-layer-controls button:hover {
          background: #555;
      }

      .ornament_bold2_border {
          --border-img: url('${chrome.runtime.getURL("assets/ornament_bold2.webp")}');
          --border-img-width: 80px;
          --border-img-slice: 205;
          --border-img-outset: 24px;
      }
      .ornament_simple_border {
          --border-img: url('${chrome.runtime.getURL("assets/ornament_simple.webp")}');
          --border-img-width: 50px;
          --border-img-slice: 255;
          --border-img-outset: 20px;
      }
      .spike_hollow_border {
          --border-img: url('${chrome.runtime.getURL("assets/spike_hollow.webp")}');
          --border-img-width: 100px;
          --border-img-slice: 205;
          --border-img-outset: 50px;
      }
      .spiky_border {
          --border-img: url('${chrome.runtime.getURL("assets/spike_hollow2.webp")}');
          --border-img-width: 100px;
          --border-img-slice: 205;
          --border-img-outset: 60px;
      }
      .spiky_bold_border {
          --border-img: url('${chrome.runtime.getURL("assets/spike_bold.webp")}');
          --border-img-width: 120px;
          --border-img-slice: 205;
          --border-img-outset: 69px;
      }
      .vine_border {
          --border-img: url('${chrome.runtime.getURL("assets/vine_hollow.webp")}');
          --border-img-width: 130px;
          --border-img-slice: 205;
          --border-img-outset: 45px;
      }
      .archer_header_border {
          --border-img: url('${chrome.runtime.getURL("assets/border_archer_header.webp")}');
          --border-img-width: 172px 208px 81px 194px;
          --border-img-slice: 481 470 202 475;
          --border-img-outset: 10px;
      }
      .archer_ability_border {
          --border-img: url('${chrome.runtime.getURL("assets/border_archer_ability.webp")}');
          --border-img-width: 201px 245px 116px 242px;
          --border-img-slice: 167 174 79 178;
          --border-img-outset: 10px;
      }
      .archer_border_archer_footer {
          --border-img: url('${chrome.runtime.getURL("assets/border_archer_footer.webp")}');
          --border-img-width: 35px 32px 36px 44px;
          --border-img-slice: 61 60 61 83;
          --border-img-outset: 10px;
      }
      .archer_sidebar_border {
          --border-img: url('${chrome.runtime.getURL("assets/border_archer_sidebar.webp")}');
          --border-img-width: 35px 32px 36px 44px;
          --border-img-slice: 61 60 61 83;
          --border-img-outset: 10px;
      }

      .ct-quick-info__box,
      section {
          height: 100% !important;
          padding: 0 !important;
      }

      #character-tools-target {
          background-color: white;
      }

      /* Deep Clean: Aggressively hide top elements */
      [data-original-id="section-Section-6"] .print-section-header > span, 
      [data-original-id="section-Section-6"] .print-section-content .ct-primary-box, 
      div#section-Section-6 .print-section-header > span, 
      div#section-Section-6 .print-section-content .ct-primary-box, 
      footer, 
      header.main, 
      #mega-menu-target, 
      .mm-navbar,
      [class*="ct-character-nav"], 
      .notifications-wrapper,
      .ddb-site-alert, 
      .site-bar, 
      .watermark, 
      dialog ~ div:not(#site-main):not([id^="print-enhance"]):not([class*="be-"]),
      .ct-character-sheet:before,
      .ct-equipment__filter,
      .ct-extras-filter__interactions,
      .ct-spells-spell__action,
      [class$="__actions--collapsed"],
      .dice-rolling-panel,
      .ct-features__management-link,
      .ct-character-sheet-desktop .ct-character-header-desktop,
      .ct-quick-info__health h1 + div,
      .ct-quick-info__inspiration,
      .ct-subsection__footer,
      .ddbc-theme-link,
      .ddbc-character-tidbits__heading {
          display: none !important;
      }

      .ct-quick-info__health h1 {
          position: static;
          transform: none;
      }
      /* REsizable */
      .ct-character-sheet-desktop .ct-subsection {
          position: static!important;
          display: flex!important;
          flex-flow: row!important;
          height: 100%;
      }
      .ct-character-sheet-desktop .ct-subsections {
          height: auto !important;
          display: block;
          width: 100%;
          position: relative !important;
      }

      /* User Request: Side Panel Fixed & Scrollable */
      .ct-sidebar__portal {
          position: fixed !important;
          top: 0 !important;
          right: 0 !important;
          height: 100% !important;
          z-index: 9999 !important;
      }
      .ct-spell-manager {
          overflow-y: auto !important;
          max-height: 100% !important;
      }
      .ct-sidebar {
          position: static !important;
      }
      .ct-sidebar__inner {
          overflow-y: auto !important;
          overflow-x: hidden !important;
      }
      .ct-character-sheet {
          background: url(https://www.dndbeyond.com/avatars/61/510/636453152253102859.jpeg) no-repeat, url(https://www.dndbeyond.com/attachments/0/84/background_texture.png) #333 !important;
      }
      .ct-character-sheet-desktop {
          background-color: white;
          height: 100%;
          -webkit-box-shadow: 5px 5px 15px 5px #3f3f3fff;
          box-shadow: 5px 5px 15px 5px #3f3f3fff;
      }

      .print-section-wrapper,
      .print-section-wrapper > * {
          width: 100%;
          max-width: 1200px;
          padding: 0 !important;
      }

      @media (min-width: 1200px) {
          .ct-primary-box {
              width: 100% !important;
          }
      }

      @media screen {
          .ct-character-sheet-desktop {
              max-width: none !important;
              margin: 0 !important;
              width: 100% !important;
              background-color: white !important;
          }
      }
      
      .pe-layer {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          pointer-events: none !important;
          z-index: 1000;
          overflow: visible !important;
      }

      /* Sheet-internal scrollport (track sheet_autoscroll_20260909, AC-S1):
         the sections layer is the fixed editor overlay's scroll context —
         sections placed/dragged below the 100vh fold become reachable
         (native wheel over a wrapper + the drag edge auto-scroll drive its
         scrollTop). Screen-only so print and other media never inherit the
         scroll container (@media print resets overflow below). The shapes
         layer is deliberately NOT a scrollport (ratified trade-off: shapes
         do not scroll with scrolled sections). */
      @media screen {
          #print-enhance-sections-layer {
              overflow-y: auto !important;
              overflow-x: hidden !important;
          }
      }
      
      #print-enhance-shapes-layer {
          z-index: 1001; /* Above sections */
      }
      
      .be-section-wrapper {
          position: absolute !important;
          display: flex !important;
          flex-direction: column !important;
          z-index: 10;
          min-width: max-content;
          transition: opacity 0.2s;
          pointer-events: auto !important; /* Interactive by default */
      }
      
      .be-section-wrapper img {
          background-color: transparent;
          border: none;
          object-fit: contain;
      }
      
      .be-section-wrapper section:not(.ddbc-armor-class-box) > h2 + div,
      .be-section-wrapper section {
          height: 100%;
          width: 100%;
      }
      
      .be-section-wrapper section:not(.ddbc-armor-class-box) > h2 + div {
          height: 100% !important;
      }
      
      /* Layer Lock Interactions */
      /* AC-5/U-7 (ui_ux_review_20260910): a locked layer must stay HOVERABLE.
         This rule used to set pointer-events:none on the wrapper, which killed
         the hover that reveals the action bar — so a locked layer's own unlock
         / hide / delete controls became unreachable and the lock was a trap.
         Locking now means "not draggable / resizable / rotatable": the drag
         engine refuses a locked wrapper (isElementLocked) and the move
         affordances are hidden, while the wrapper stays interactive (dimmed as
         the state cue). */
      .be-layer-locked .be-section-wrapper {
          opacity: 0.5 !important;
          cursor: not-allowed;
      }
      /* ONE mechanism, precise about WHICH layer is locked: .be-layer-locked is set on the
         LAYER CONTAINER, so it names exactly the locked layer.
         The two legacy arms carry a :not(.be-shape-wrapper) guard on purpose — a SHAPE wrapper also
         carries be-section-wrapper (measured), so body.be-lock-sections + .be-section-wrapper matched every SHAPE while the sections layer was locked and
         hid a shape's rotation handle for no reason. That is the same over-broad mistake this
         block was fixed for, caught in the fix itself by enumerating the matching rules in the
         live browser. */
      .be-layer-locked .be-rotation-handle,
      body.be-lock-sections .be-section-wrapper:not(.be-shape-wrapper) .be-rotation-handle,
      body.be-lock-shapes .be-shape-wrapper .be-rotation-handle {
          display: none !important;
      }
      .be-layer-locked .print-section-resize-handle,
      body.be-lock-sections .be-section-wrapper:not(.be-shape-wrapper) .print-section-resize-handle,
      body.be-lock-shapes .be-shape-wrapper .print-section-resize-handle {
          display: none !important;
      }
      /* …and the lock's state is signalled on the wrapper itself (opacity +
         not-allowed cursor above). The action bar is NOT revealed here:
         ISSUE_hover.md — hover-revealed actions belong to the ACTIVE layer
         ONLY, for every layer state, so the one reveal rule below (scoped to
         .be-active-layer) is the only mechanism. */

      /* ISSUE_drag_and_drop.md (2026-09-14): the GREEN HOVER GLOW is gone. This rule
         used to paint filter: drop-shadow(0 0 15px #28a745) twice over the hovered
         section — a filter repaints the whole subtree (every border, background and
         piece of artwork in the section), which is what the report is about: "the UX
         of that is extremely bad". The affordance is now a CENTRED NINE-DOT DRAG
         HANDLE on the active layer's sections, and the handle itself — its box, skin,
         cursor and reveal — lives with the drag engine that consumes it
         (js/dnd.js injectDnDStyles), one owner for one component.

         What stays HERE is the part only this file can own: the WRAPPER STACKING. A
         handle can only sit above the sheet's other sections if the hovered wrapper is
         raised, and this is the one cascade slot that reliably beats the wrapper's own
         z-index: 10 / .be-active-wrapper { z-index: 100004 } above it. The raise
         therefore keeps the removed glow's exact value and selector list — the
         ordering behaviour is unchanged, only the painted effect is different. The
         glow's transition: filter 0.3s ease-in-out is deliberately NOT replaced:
         animating a filter animates the whole subtree, the cost this issue is about. */
      .be-active-layer .be-section-wrapper:hover,
      .be-active-layer .be-shape-wrapper:hover,
      .be-focus-highlight-hover {
          z-index: 700000 !important;
      }

      /* AC-5/U-7 (ui_ux_review_20260910): a PER-LAYER lock used to be made
         completely inert here (pointer-events:none), which killed hover — so
         the layer's own controls could never be reached to unlock/delete it.
         Locking is enforced in the drag engine (isElementLocked refuses a
         locked wrapper) and by hiding the move/resize/rotate affordances; the
         layer stays hoverable and its action bar stays usable.
         NOTE: the legacy SHAPES-MODE lockdown (body.be-lock-shapes, emitted by
         the shapes-mode toggle) is a different feature and stays inert — see
         the !important rule below, which deliberately wins over this one. */
      body[class*="be-lock-"] #print-enhance-shapes-layer,
      body[class*="be-lock-"] #print-enhance-sections-layer {
          pointer-events: auto;
      }

      /* Shapes Mode OFF (legacy lockdown): shapes are intentionally read-only
         until the user enables Shapes Mode. */
      body.be-lock-shapes #print-enhance-shapes-layer,
      body.be-lock-sections #print-enhance-sections-layer {
          pointer-events: none !important;
      }

      /* AC-5/U-7 (ui_ux_review_20260910): "locked" means NOT draggable /
         resizable / rotatable — it must not hide the affordances the user
         needs to unlock, delete or toggle the element. Controls stay visible
         and clickable; only the move/resize/rotate affordances are disabled
         and signalled with a not-allowed cursor.

         MEASURED DEFECT (2026-09-11, found by track undo_stack_20260911 while
         verifying its resize/rotate classes in a real browser): this block used
         to key off the BODY lock class (body[class*=be-lock-]), which matches when ANY layer is
         locked. The product keeps every layer but one locked
         (toggleLayerLock locks all others, and a fresh boot already carries
         be-lock-shapes-default), so that selector hid the handles on EVERY
         wrapper — including the ones on the UNLOCKED layer — and corner resize
         and rotate were unreachable by mouse in practice. The correctly-scoped
         rules are the .be-layer-locked ones above (that class is set on the
         LAYER CONTAINER, so it names exactly the locked layer), plus the exact
         legacy shapes-mode classes; the over-broad pair is deleted rather than
         kept beside them, so there is ONE mechanism. */
      body[class*="be-lock-"] .be-section-wrapper {
          cursor: not-allowed;
      }
      /* The action bar is NOT revealed on a locked layer (ISSUE_hover.md):
         hover-revealed actions belong to the ACTIVE layer only — the single
         .be-active-layer rule is the ONE mechanism, and these body-level
         lock classes name "ANY layer is locked" (the product keeps every
         layer but one locked), so an arm here would reveal actions on
         inactive layers again. */
      /* Locked state cue: dim the layer element itself. */
      .be-layer-locked {
          opacity: 0.5;
      }

      /* AC-6: the destructive cue is the locked ember token, not a literal. */
      .be-delete-layer-btn {            color: var(--be-ember) !important;
      }
      .be-delete-layer-btn:hover {
          background-color: var(--be-oxblood) !important;
      }

      .be-context-menu {
          user-select: none;
          overflow: hidden;
          animation: be-fade-in 0.1s ease-out;
      }
      @keyframes be-fade-in {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
      }

      .be-context-menu-item:hover {
          background-color: #333 !important;
      }

      /* ONE SELECTION VISUAL LANGUAGE (selection_model_ia_20260910, AC-2).
         THE SELECTION RING is ONE body-level overlay, positioned by the
         selection store (js/properties_panel.js) over the selected target's
         measured box. Both kinds therefore carry literally the SAME element and
         the SAME rule, and no descendant art can cover it: the three
         element-anchored alternatives were each measured and rejected —
         an outline on the target (covered by the shape's own ::before art:
         0 exact-gold pixels around the shape against 568 around the section),
         a wrapper ::after ring (computed identically for both, rendered only for
         the section) and a wrapper filter ring (works for a rectangular
         composite, produces nothing around a shape, whose composite silhouette
         IS the artwork). The wrapper keeps only the soft GLOW. */
      #print-enhance-selection-ring {
          position: fixed !important;
          display: none;
          border: 2px solid var(--be-gold) !important;
          border-radius: 2px;
          box-shadow: 0 0 8px var(--be-gold);
          pointer-events: none !important;
          z-index: 2147483647 !important;
      }

      .be-active-wrapper {
          filter: drop-shadow(0 0 8px var(--be-gold)) !important;
          z-index: 100004 !important;
      }

      /* The layer that HOLDS THE SELECTED ELEMENT gets the gold bar
         (be-selection-layer, written only from the selection store, so it is
         gone when nothing is selected — AC-1). The INSERTION TARGET keeps the
         quieter be-active-layer marker with no bar. */
      .be-selection-layer {
          background-color: transparent;
          border-left: 3px solid var(--be-gold);
          margin-left: -3px;
      }
      #print-enhance-shapes-layer.be-active-layer,
      #print-enhance-sections-layer.be-active-layer,
      #print-enhance-shapes-layer.be-selection-layer,
      #print-enhance-sections-layer.be-selection-layer
       {
          background-color: transparent;
          border-left: 0;
          margin-left: 0;
      }

      .be-section-wrapper {
          cursor: grab;
          transition: opacity 0.3s ease;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          box-sizing: border-box;
          break-inside: avoid;
          display: flex !important;
          flex-direction: column !important;
          min-height: 30px !important;
          min-width: 50px !important;
      }
      .be-section-wrapper.dragging {
          cursor: grabbing;
      }
      .be-section-wrapper * {
          cursor: auto;
      }
      /* Rest state: NO bar, and NOT CLICKABLE. !important is load-bearing
         here, not decoration: the bar is created with an inline
         pointerEvents = "all" (js/main.js:2513) to win back clicks from the
         wrapper's own pointer handling, and an inline declaration outranks a
         NON-important stylesheet rule at any specificity. Without it, an
         inactive layer's bar is invisible (opacity 0) yet fully hittable —
         25×32px dead buttons floating over the section, which is precisely the
         "buttons on sections regardless of their status" complaint
         (ISSUE_hover.md) answered halfway. */
      .be-section-wrapper:hover .be-section-actions,
      .be-shape-wrapper:hover .be-section-actions {
          opacity: 0;
          pointer-events: none !important;
      }

      /* THE REVEAL IS SCOPED TO THE ACTIVE LAYER, AND ONLY HERE.
         (ISSUE_hover.md: "the hover event of the mouse should show the
         class="be-section-actions" that are on the ACTIVE layer, currently the
         buttons are being displayed on ALL sections regardless of their
         status.")

         Two other rules used to reveal the bar — .be-layer-locked …:hover and
         body[class*="be-lock-"] …:hover — and both are GONE rather than
         narrowed. They were written for a different complaint (the locked-layer
         bar being unreachable, ui_ux_audit AC/U-11), but between them they made
         the bar appear on every layer, because a locked layer is either the
         active one (first rule) or the body is in that class's lock mode (the
         other). .be-active-layer is the ONE writer of "the layer you're
         working on" (js/dom/layer_manager.js:1329 applyInsertionTarget), so it
         is the only scope the reveal may use. The same class scopes the drag
         handle (js/dnd.js) — one definition, two consumers. */
      .be-active-layer .be-section-wrapper:hover .be-section-actions,
      .be-active-layer .be-shape-wrapper:hover .be-section-actions {
          opacity: 1;
          pointer-events: auto !important;
      }

      /* THE BAR YIELDS TO THE GRIP WHILE THE GRIP IS REVEALED — option 3 of
         temp/archived/ISSUE_grip_covered_by_actions_bar_on_small_sections_20260914.md, chosen
         over raising the grip above the bar because raising it STEALS A BUTTON: measured on
         the live sheet, a grip hoisted over the bar covers 60% of the top-row Select button
         on section-extra-tidbits-wrapper (151.5x62px) INCLUDING that button's own centre,
         so "grabbable everywhere" would have been bought with "unselectable there".

         WHY ONE NUMBER MOVES AND NOT TWO: a positioned wrapper with a z-index is its own
         STACKING CONTEXT (be-section-wrapper carries z-index 10, and on the same hover that
         reveals the grip the raise above gives it 700000), so the bar's level is scoped INSIDE
         the hovered wrapper — it never has to out-rank the sheet, only its own siblings: the
         section's content (print-section-container, z-index 0) and the grip. Both bounds are
         therefore real: below the grip's 700002 (js/dnd.js — the collision being fixed) and
         above the content the bar must sit on (the stylesheet's own be-section-actions
         already uses 20 for that). 700001 sits in that gap and reads as "just under the grip"
         beside the 700000/700002 pair this cascade already uses.

         The bar keeps its inline built level (js/main.js getOrCreateActionContainer, which
         reads ACTIONS_BAR from the ONE map in js/section_utils.js) whenever the grip is NOT on
         screen, so the reachability that level was added for is untouched; and !important is
         load-bearing here for the same reason the two rules above carry it — inline outranks a
         NON-important stylesheet rule at any specificity, so a yield without it would silently
         do nothing.

         THE CONDITION IS THE GRIP'S OWN REVEAL, ARM FOR ARM — be-active-layer plus
         :hover and :focus-within on the wrapper. That is deliberate: a second, hand-written
         notion of "the grip is showing" (a state class, a timer) would be a second definition
         of the same fact and could disagree with js/dnd.js. Same scope, same triggers, one
         definition — which is also why the yield is inert on a locked or inactive layer, where
         there is no grip to make room for. */
      .be-active-layer .be-section-wrapper:hover .be-section-actions,
      .be-active-layer .be-shape-wrapper:hover .be-section-actions,
      .be-active-layer .be-section-wrapper:focus-within .be-section-actions,
      .be-active-layer .be-shape-wrapper:focus-within .be-section-actions {
          z-index: 700001 !important;
      }

      .print-section-container {
          --reduce-height-by: 0px;
          --reduce-width-by: 0px;
          background-color: rgba(255, 255, 255, 0.85);
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          box-sizing: border-box;
          break-inside: avoid;
          display: flex !important;
          flex-direction: column !important;
          min-height: 30px !important;
          min-width: 50px !important;
          overflow: visible !important; /* Changed to visible so ::before border outsets are not clipped */
          position: relative !important;
          filter: var(--be-hue-filter) !important;
          z-index: 0;
      }

      .print-section-container:not(.be-no-border)::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          border-color: transparent;
          border-image-outset: var(--border-img-outset);
          border-image-repeat: round;
          border-image-slice: var(--border-img-slice);
          border-image-source: var(--border-img);
          border-image-width: var(--border-img-width);
          border-style: solid;
          border-width: 0;
          filter: var(--be-decoration-filter) !important;
          z-index: -1;
      }

      .print-shape-container {
          background-color: transparent !important;
          border-width: 0;
          border-style: solid;
          pointer-events: auto;
      }
      .print-shape-container .print-section-content {
          background-color: transparent !important;
      }

      /* Rotation handles should be hidden for locked shapes */
      .be-layer-locked .be-rotation-handle {
          display: none !important;
      }

      .print-section-container, 
      .print-section-container * {
          font-size: calc(10px * var(--be-font-scale, 1)) !important;
          white-space: normal !important;
          overflow-wrap: break-word !important;
      }

      .print-section-container .ct-combat__statuses h2 *,
      .print-section-container .ct-combat__statuses h2 + *,
      .print-section-container .ct-quick-info * {
          font-size: calc(12px * var(--be-font-scale, 1)) !important;
      }

      .print-section-container .ct-quick-info__health * {
          font-size: 14px !important;
      }
      .print-section-container [class^="styles_heading__"],
      .print-section-container [class^="styles_sectionHeading__"],
      .print-section-container [class$="-heading"],
      .print-section-container [class$="__heading"],
      .print-section-container [class$="__heading"] ,
      .print-section-container .ct-content-group__header-content {
          font-size: 12px !important;
          font-weight: bold !important;
          text-transform: uppercase;
          border-bottom: 1px solid #979797;
          margin-bottom: 4px;
      }
      .print-section-container [class^="styles_sectionHeading__"],
      .print-section-container [class$="__heading"],
      .print-section-container [class$="__heading"]  {
          font-size: 10px !important;
      }
      .print-section-container [class^="styles_sectionHeading__"],
      .print-section-container [class$="__heading"],
      .print-section-container [class$="__heading"] ,
      .print-section-container [class^="styles_heading__"] [class$="-heading"] {
          border-bottom: 0
      }
      .print-section-content {
          flex: 1 1 auto !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
          position: relative !important;
      }
      .ct-senses__callout-value,
      .integrated-dice__container,
      .integrated-dice__container span {
          font-size: 16px !important;
      }
      .ddbc-armor-class-box__value {
          font-size: 26px !important;
      }

          /* Scaling helper.
             THE COMPENSATION IS A MIN-WIDTH RULE, NOT AN INLINE WIDTH, and that is
             load-bearing for the layout RECORD rather than a style preference.
             scanLayout() and snapshotContainerGeometry() record child.style.width over
             div[class$="-row-header"], div[class$="-content"] into
             layout.sections[id].innerWidths — and .print-section-content ITSELF matches
             div[class$="-content"] (its class name ends in "-content"), whose first child is
             exactly the element scaled here. So an inline width written by this feature is
             picked up as a USER width choice, persisted, and replayed by applyLayout(): a value
             derived at one sheet size becomes a pinned style at every later size, and an undo
             restores something other than what the user had. MEASURED: the browser gate's undo
             round trip failed on precisely that field, innerWidths["0-0"] going
             "110.469%" -> "110.392%", where 110.392% is 100 / the scale this feature applied.
             The compensation now travels as --be-scale, which those inline-style scans do not
             read, and the element still cannot be narrower than containerWidth / scale.
             See fitContainer() in js/main.js and scripts/scaling_innerwidth_collision_probe.js,
             which re-measures the claim. */
      .print-section-container[data-scaling="true"] .print-section-content > div {
          transform-origin: top left;
          min-width: calc(100% / var(--be-scale, 1)) !important;
      }
      /* THE FLOOR'S COST, MADE VISIBLE. fitContainer (js/main.js) never scales below
         MIN_SCALE_FLOOR = 0.60, so a section that would need less than that keeps its tail
         cut off by .print-section-content's own overflow: hidden — the pre-1.17.3 failure,
         in a bounded dose. A silent clip is what issue
         scaling_floor_spells_0443_20260913 objected to (its option 1: "the honest form is
         then 'shrink to fit, but never below a readable size', with the clip made *visible*
         somehow (a marker, a panel warning) rather than silent"), so the pass stamps
         data-scaling-clipped="true" when the scale it applied does NOT fit, and this paints
         it: a red fade + hairline at the bottom edge of the content box, i.e. exactly the
         edge where the text stops.

         NOTE THE ABSENCE OF BACKTICKS AND DOLLAR-BRACES HERE, ON PURPOSE: this stylesheet is
         emitted from a JS template literal, and a backtick inside a CSS comment TERMINATES
         the literal (test/unit/js_source_syntax.test.js exists for exactly that failure
         class, and a dollar-brace would be read as a substitution). Style this comment in
         plain text.

         SCREEN-ONLY, AND THAT IS LOAD-BEARING: on paper nothing changes — the marker is not
         part of the document, @media print is what the user's PDF is made of, and a warning
         band printed onto the sheet would be the tool's own notice reaching the paper (the
         failure class print_output_audit.spec.js was written to catch). The pseudo-element
         hangs off .print-section-content, which is already position: relative, so it needs
         no new stacking or layout of its own, and pointer-events: none keeps it from eating
         a click on the content underneath. It is a pseudo-child, so no "> div" selector and
         no children walk (js/layout_scan.js, js/undo.js) can mistake it for content. */
      @media screen {
          .print-section-container[data-scaling-clipped="true"] .print-section-content::after {
              content: "";
              position: absolute;
              left: 0;
              right: 0;
              bottom: 0;
              height: 14px;
              pointer-events: none;
              background: linear-gradient(to bottom, rgba(198, 40, 40, 0), rgba(198, 40, 40, 0.38));
              outline: 1px dashed rgba(198, 40, 40, 0.65);
              outline-offset: -1px;
          }
      }
      .print-section-container div[class$="-row-header"] > div, 
      .print-section-container div[class$="-content"] > div > div {
          min-width: 38px;
      }
      .print-section-container div[class$="-row-header"] div[class$="--name"], 
      .print-section-container div[class$="-content"] div[class$="__name"] {
          max-width: 72px;
      }
      .print-section-container div[class$="-content"] div[class$="-slot__name"] {
          max-width: 200px;
      }
      .print-section-container div[class$="-content"] div[class$="-item__name"] {
          max-width: 136px;
      }
  
      .ddbc-character-avatar__portrait {
          width: 100%;
      }
      
      /* Ability Summary */

      .ddbc-ability-summary {
          display: contents;
      }
      .ddbc-ability-summary__secondary {
          position: static!important;
          border: 2px solid var(--btn-color);
          border-radius: 150px;
          padding: 8px 13px;
          font-size: 16px !important;
          width: fit-content;
          background: white;
      }
      .ddbc-ability-summary__label {
          font-size: 12px !important;
      }

      /* PROFICIENCY & WALKING SPEED */
      
      .ct-quick-info__box * {
          font-size: 14px !important;
          line-height: 21px;
      }

      /* Custom Resize Handle */

      .print-section-resize-handle {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 16px;
          height: 16px;
          cursor: se-resize;
          z-index: 20;
          opacity: 0; /* Hidden by default */
      }
      .be-section-wrapper:hover .print-section-resize-handle {
          opacity: 1;
          background: linear-gradient(135deg, transparent 50%, var(--btn-color) 50%);
      }
      .be-section-wrapper.be-shape-wrapper:hover .print-section-resize-handle {
          background: linear-gradient(135deg, transparent 50%, rgba(40, 167, 69, 0.8) 50%) !important;
      }

      /* Skills specific compact logic (already mostly covered by global above) */
      .ct-skills, .ct-skills * {
          font-size: 10px !important;
      }

      .ct-skills__box {
          overflow: hidden !important;
          border: 1px solid black !important;
      }
      .ct-skills > div > div,
      .ct-skills > div > div > * {
          height: 26px !important;
          padding: 0 !important;
          margin: 0 !important;
          font-size: 10px !important;
          line-height: 10px !important;
          display: flex;
          align-items: center;
      }
      .ct-notes__note {
          white-space: pre-wrap !important;
      }
      .print-section-container.minimized .print-section-content {
          display: none !important;
      }

      /* Unified Section Action Buttons */
      .be-section-actions {
          position: absolute;
          top: 8px; /* Repositioned to top since header is gone */
          left: 8px;
          display: flex;
          gap: 8px;
          z-index: 20;
          opacity: 0;
          transition: opacity 0.2s;
          pointer-events: none;
      }
      .be-section-actions button {
          width: 39px;
          height: 32px;
          cursor: pointer;
          background: var(--btn-color);
          border: 1px solid rgb(85, 85, 85);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          margin: 0;
          filter: drop-shadow(2px 4px 6px black);
          border-radius: 32px;
          color: white;
          font-size: 18px !important;
          transition: background-color 0.2s;
      }
      .be-section-actions button:hover {
          background-color: var(--btn-color-highlight);
      }
      .be-shape .be-section-actions button {
          background-color: #28a745 !important;
      }
      .be-shape .be-section-actions button:hover {
          background-color: #218838 !important;
      }
      .be-clone-button {
          font-size: 21px !important;
      }
      .be-clone-delete:hover {
          background: #cc0000 !important;
      }
      .be-shape-delete:hover {
          background: #1e7e34 !important;
      }
      @media print {
          .be-section-actions {
              display: none !important;
          }
      }

      .be-section-primary-box, .be-section-primary-box * {
          background: transparent !important;
      }

      /* Modal Styles */
      .be-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100000;
          backdrop-filter: blur(4px);
      }
      .be-modal {
          background: #222;
          color: white;
          padding: 24px;
          border-radius: 12px;
          width: 400px;
          max-width: 90%;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border: 1px solid #444;
          display: flex;
          flex-direction: column;
          gap: 16px;
      }
      .be-modal h3 {
          margin: 0;
          font-size: 18px;
      }
      .be-modal p {
          margin: 0;
          font-size: 14px;
          color: #ccc;
      }
      .be-modal input {
          background: #111;
          border: 1px solid #444;
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 14px;
      }
      .be-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
      }
      .be-modal-actions button {
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          border: 1px solid #555;
      }
      .be-modal-ok {
          background: #444;
          color: white;
      }
      .be-modal-cancel {
          background: transparent;
          color: #ccc;
      }
      /* Picker modal a11y + close affordance (border_shape_picker_ux_20260909,
         B-3 / AC-3): close ✕, visible focus ring on option cells.
         Height tier T2 (ornament_symmetry_20260910, AC-4): every icon-only
         control is a 28x28 square — this one measured 26px. */
      .be-modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: transparent;
          border: none;
          color: #aaa;
          font-size: 14px;
          line-height: 1;
          width: 28px;
          height: 28px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          cursor: pointer;
      }
      .be-modal-close:hover {
          color: #fff;
          background: #333;
      }
      .be-modal-close:focus-visible {
          outline: 2px solid var(--btn-color);
          outline-offset: 1px;
      }
      .be-border-option:focus-visible {
          outline: 2px solid var(--btn-color);
          outline-offset: 1px;
      }
      .be-modal-ok:disabled {
          cursor: not-allowed;
      }
      /* Live hover "try it" affordance (border_shape_picker_ux_20260909,
         B-5 / AC-5): while a tile is hovered the real target carries
         be-hover-preview; a dashed gold outline makes the preview state
         unambiguous in the pixels (the border art itself paints on ::before
         with an outward outset, which element crops would clip). */
      .print-section-container.be-hover-preview,
      .be-shape-container.be-hover-preview {
          outline: 2px dashed var(--btn-color);
          outline-offset: 6px;
      }

      .be-modal-slider-container {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 10px 0;
      }
      .be-modal-slider {
          flex-grow: 1;
          cursor: pointer;
          accent-color: var(--btn-color);
      }
      .be-modal-slider-value {
          font-weight: bold;
          min-width: 50px;
          text-align: right;
          font-size: 1.1em;
          color: white;
      }

      /* Border Picker Styles */
      .be-border-options {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          overflow-y: auto;
          max-height: 400px;
          margin: 20px 0;
          justify-content: center;
      }
      .be-border-option {
          cursor: pointer;
          padding: 10px;
          border: 2px solid transparent;
          transition: all 0.2s;
          text-align: center;
          width: 100px;
          border-radius: 4px;
      }
      .be-border-option:hover {
          background: #333;
      }
      .be-border-option.selected {
          border-color: var(--btn-color);
          background: #444;
      }
      .be-rotation-handle {
          position: absolute;
          top: -45px;
          left: 50%;
          transform: translateX(-50%);
          /* Height tier T2 (ornament_symmetry_20260910, AC-4): the on-sheet
             icon controls are 28x28; this handle measured 30px. box-sizing
             makes the 28x28 the rendered size (it carries a 3px ring), and the
             stem below is re-derived so it still touches the handle. */
          width: 28px;
          height: 28px;
          box-sizing: border-box;
          /* AC-8/U-29: themed with the locked chrome tokens (this handle used
             to ship a debug hot-pink border/arrow). */
          background: var(--be-bone, #E9DDC2);
          border: 3px solid var(--be-gold, #C6A15B);
          border-radius: 50%;
          cursor: grab;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.5);
      }
      .be-rotation-handle::before {
          content: '↻';
          color: var(--be-oxblood, #5E1F1E);
          font-weight: bold;
      }
      .be-rotation-handle:active {
          cursor: grabbing;
      }
      .be-rotation-handle::after {
          content: '';
          position: absolute;
          top: 26px;
          left: 50%;
          transform: translateX(-50%);
          width: 3px;
          height: 17px;
          background: var(--be-gold, #C6A15B);
      }
      .be-border-preview {
          width: 80px;
          height: 80px;
          margin: 0 auto 5px;
          background: white;
          box-sizing: border-box;
          border-width: 0px;
          border-style: solid;
          border-color: transparent;
          border-image-source: var(--border-img);
          border-image-slice: var(--border-img-slice);
          border-image-width: var(--border-img-width);
          border-image-repeat: round;
      }

      /* Final Print Overrides - Highest Priority */
      @media print {
          @page {
              margin: 0;
              size: letter portrait;
          }
          body {
              margin-top: 0in !important;
              margin-bottom: 0.25in !important;
              margin-left: 0.1in !important;
              margin-right: 0.1in !important;
              padding: 0 !important;
          }
          
          html, body, .ct-character-sheet-desktop {
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              transform: none !important;
          }

          /* Content Opacity Fix */
          html body .be-section-wrapper,
          html body .be-shape-wrapper,
          html body #print-enhance-sections-layer,
          html body #print-enhance-shapes-layer,
          html body.be-lock-sections .be-section-wrapper,
          html body.be-lock-shapes .be-shape-wrapper,
          html body .be-layer-locked .be-section-wrapper,
          html body .be-layer-locked .be-shape-wrapper {
              opacity: 1 !important;
              visibility: visible !important;
              pointer-events: none !important;
          }
          
          html body .be-section-wrapper *, 
          html body .be-shape-wrapper * {
              opacity: 1 !important;
              visibility: visible !important;
          }

          /* Scrollport reset (track sheet_autoscroll_20260909, AC-S1): in
             print the sections layer is a plain fixed overlay again
             (overflow: visible) — the screen-only scroll container must
             never clip or paginate printed output. Printed behaviour stays
             identical to pre-fix. */
          html body #print-enhance-sections-layer {
              overflow: visible !important;
          }

          /* Selection and Hover Highlights (the unified be-active-target marker
             and the selection ring overlay included — neither may print) */
          .be-active-wrapper,
          .be-active-target,
          #print-enhance-selection-ring,
          .be-section-wrapper:hover,
          .be-shape-wrapper:hover,
          .be-focus-highlight-hover,
          .be-active-section {
              filter: none !important;
              outline: none !important;
              border-color: transparent !important;
          }
          #print-enhance-selection-ring {
              display: none !important;
          }

          /* UI Cleanup.
             THE LAST FOUR ARE HIDDEN BY CLASS, NOT BY ID, and that is deliberate. An open
             overlay is position:fixed, so Chromium repeats it on EVERY printed page. This
             list used to hide #print-enhance-overlay -- an id only ONE dialog passes
             (js/modals.js:377) -- which left every other dialog from the shared shell printing
             its scrim, and left the feedback lane (.be-feedback) printing outright: measured on
             the live sheet, the boot notice's sentence was the ONLY text in the whole PDF and
             appeared on all four pages, because nothing here matched it. Print output is audited
             in test/browser_e2e/print_output_audit.spec.js and the rule is pinned by
             test/unit/print_hides_own_surfaces.test.js. */
          .print-section-header, 
          .be-section-actions, 
          .be-drag-handle,
          .print-section-resize-handle,
          .be-rotation-handle,
          .be-shapes-mode-btn,
          .print-page-separator,
          #print-enhance-controls, 
          #print-enhance-overlay,
          #be-onboarding-hint,
          .be-feedback,
          #be-feedback-announcer,
          .be-modal-overlay,
          .be-context-menu {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
          }

          .ct-spells-filter {
              visibility: hidden !important;
          }
      }
  `;
  document.head.appendChild(style);
}

const PrintStyles = { updatePrintStyles, updateLayoutBounds, drawPageSeparators, injectCompactStyles, enforceFullHeight };
if (typeof module !== "undefined" && module.exports) {
  module.exports = PrintStyles;
}
if (typeof window !== "undefined") {
  window.PrintStyles = PrintStyles;
}
