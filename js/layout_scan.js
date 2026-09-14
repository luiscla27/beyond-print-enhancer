/**
 * Layout scan: DOM-to-data serialization (scanLayout) plus layout migration
 * (migrateLayout).
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 13 (split 2/3). Cross-module
 * seams resolved lazily at call time via window.*: safeLog, __DDBStorage,
 * DomManager (PeDom) and AssetCatalog.ALL_BORDER_STYLES.
 */

"use strict";

/**
 * True when `el` belongs to a TRANSIENT drag artefact rather than to the layout.
 *
 * MEASURED DEFECT, found by track undo_stack_20260911 (Phase 2a). `buildGhost`
 * (`js/dnd.js`) mirrors the dragged wrapper with `wrapper.cloneNode(true)` — so the
 * clone carries the SAME ids as the original — and appends it to `document.body` for
 * the duration of the drag; `ensureGuideLayer` adds another document-level layer
 * alongside. This scan queries the whole document, so ANY scan taken while a drag is
 * alive saw both the real section and its ghost, and the ghost won the `sections[id]`
 * slot: a capture taken mid-drag recorded `zIndex: "100000"` (the ghost's forced
 * z-index) instead of the section's own value.
 *
 * A drag ghost is not layout — it is a temporary visual mirror — so it is excluded here
 * rather than being papered over at each scan site. The autosave path could reach the
 * same state whenever a persist fires while a drag is in flight.
 */
function isTransientDragNode(el) {
  if (!el || !el.closest) return false;
  return Boolean(el.closest(".be-drag-ghost, .be-drag-guides"));
}

async function scanLayout() {
  const peDom = window.DomManager ? window.DomManager.getInstance() : null;
  const layerManager = peDom ? peDom.getLayerManager() : null;

  const layout = {
    version: window.__DDBStorage.SCHEMA_VERSION,
    skillsSplit: window.skillsSplit || false,
    sections: {},
    clones: [],
    extractions: [],
    shapes: [], // Legacy shapes array
    shapeLayers: [], // New multi-layer format
    spell_details: [],
    merges: [],
    spell_cache: [],
  };

  // Capture shape layers state
  const layerStates = {};
  if (layerManager) {
    layerManager.shapeLayers.forEach((layer) => {
      const layerData = {
        id: layer.id,
        name: layer.label,
        isLocked: layer.isLocked,
        isHidden: layer.isHidden,
        isDisabledOnPrint: layer.isDisabledOnPrint,
        elements: [],
      };

      const layerEl = document.getElementById(layer.layerId);
      if (layerEl) {
        const shapes = layerEl.querySelectorAll(".be-shape-wrapper");
        shapes.forEach((wrapper) => {
          if (isTransientDragNode(wrapper)) return; // drag ghost, not layout
          const container = wrapper.querySelector(".be-shape-container");
          if (!container) return;

          layerData.elements.push({
            id: container.id,
            assetPath: container.dataset.assetPath,
            left: wrapper.style.left,
            top: wrapper.style.top,
            width: container.style.width,
            height: container.style.height,
            zIndex: wrapper.style.zIndex,
            printZIndex: wrapper.dataset.printZ,
            rotation: wrapper.dataset.rotation || "0",
          });
        });
      }
      layout.shapeLayers.push(layerData);

      layerStates[layer.id] = {
        isLocked: layer.isLocked,
        isHidden: layer.isHidden,
        isDisabledOnPrint: layer.isDisabledOnPrint,
      };
    });

    // Capture sections layer state
    const secLayer = layerManager.sectionsLayer;
    if (secLayer) {
      layerStates[secLayer.id] = {
        isLocked: secLayer.isLocked,
        isHidden: secLayer.isHidden,
        isDisabledOnPrint: secLayer.isDisabledOnPrint,
      };
    }
  }

  layout.layers = {
    ...layerStates,
    activeLayerId: layerManager?.activeLayerId || null,
  };

  // Include cached spells
  try {
    await window.__DDBStorage.init();
    layout.spell_cache = await window.__DDBStorage.getAllSpells();
  } catch (err) {
    window.safeLog?.("error", "[DDB Print] Could not scan spell cache", err);
  }

  // 1. Scan for standard sections and floating containers
  const sections = document.querySelectorAll(".print-section-container");
  sections.forEach((section) => {
    if (isTransientDragNode(section)) return; // drag ghost clone, not layout
    const id = section.id;
    if (!id) return;

    const wrapper = section.closest(".be-section-wrapper") || section;
    const header = wrapper.querySelector(".print-section-header span");
    const title =
      wrapper.dataset.title || (header ? header.textContent.trim() : null);
    const content = section.querySelector(".print-section-content");

    const getBorderStyle = (el) => {
      return (
        (window.AssetCatalog.ALL_BORDER_STYLES || ["no-border"]).find((style) => el.classList.contains(style)) ||
        null
      );
    };

    if (section.classList.contains("be-clone")) {
      const sanitizedHtml = content
        ? window.SectionUtils.getSanitizedContent(content).innerHTML
        : "";
      layout.clones.push({
        id: id,
        title: title || "Clone",
        html: sanitizedHtml,
        left: wrapper.style.left,
        top: wrapper.style.top,
        width: section.style.width,
        height: section.style.height,
        zIndex: wrapper.style.zIndex || "10",
        printZIndex: wrapper.dataset.printZ || wrapper.style.zIndex || "10",
        fontSize: wrapper.style.fontSize,
        minimized: section.dataset.minimized === "true",
        compact: section.classList.contains("be-compact-mode"),
        borderStyle: getBorderStyle(section),
      });
      return;
    }

    if (section.classList.contains("be-spell-detail")) {
      layout.spell_details.push({
        id: id,
        spellName: title || "Spell",
        left: wrapper.style.left,
        top: wrapper.style.top,
        width: section.style.width,
        height: section.style.height,
        zIndex: wrapper.style.zIndex || "10",
        printZIndex: wrapper.dataset.printZ || wrapper.style.zIndex || "10",
        fontSize: wrapper.style.fontSize,
        minimized: section.dataset.minimized === "true",
        borderStyle: getBorderStyle(section),
      });
      return;
    }

    if (section.classList.contains("be-shape")) {
      layout.shapes.push({
        id: id,
        assetPath: section.dataset.assetPath,
        left: wrapper.style.left,
        top: wrapper.style.top,
        width: section.style.width,
        height: section.style.height,
        zIndex: wrapper.style.zIndex || "110",
        printZIndex: wrapper.dataset.printZ || wrapper.style.zIndex || "110",
        rotation: wrapper.dataset.rotation || "0",
        fontSize: wrapper.style.fontSize,
        minimized: section.dataset.minimized === "true",
      });
      return;
    }

    if (section.classList.contains("be-extracted-section")) {
      const originalId = section.dataset.originalId;
      const original = document.getElementById(originalId);

      const extractionData = {
        id: id,
        originalId: originalId,
        parentSectionId: section.dataset.parentSectionId,
        title: title || "Extracted",
        left: wrapper.style.left,
        top: wrapper.style.top,
        width: section.style.width,
        height: section.style.height,
        zIndex: wrapper.style.zIndex || "10",
        printZIndex: wrapper.dataset.printZ || wrapper.style.zIndex || "10",
        fontSize: wrapper.style.fontSize,
        minimized: section.dataset.minimized === "true",
        compact: section.classList.contains("be-compact-mode"),
        borderStyle: getBorderStyle(section),
      };

      if (original) {
        const resolution = window.SectionUtils.getExtractionSelector(original, true);
        if (resolution) {
          extractionData.selector = resolution.selector;
          extractionData.index = resolution.index;
        }
      }

      layout.extractions.push(extractionData);
      return;
    }

    layout.sections[id] = {
      left: wrapper.style.left,
      top: wrapper.style.top,
      width: section.style.width,
      height: section.style.height,
      zIndex: wrapper.style.zIndex || "10",
      printZIndex: wrapper.dataset.printZ || wrapper.style.zIndex || "10",
      fontSize: wrapper.style.fontSize,
      minimized: section.dataset.minimized === "true",
      compact: section.classList.contains("be-compact-mode"),
      noAutoScale: section.dataset.noAutoScale === "true",
      borderStyle: getBorderStyle(section),
      innerWidths: {},
    };

    const innerContainers = section.querySelectorAll(
      'div[class$="-row-header"], div[class$="-content"]',
    );
    innerContainers.forEach((container, cIdx) => {
      Array.from(container.children).forEach((child, dIdx) => {
        if (child.tagName === "DIV" && child.style.width) {
          const key = `${cIdx}-${dIdx}`;
          layout.sections[id].innerWidths[key] = child.style.width;
        }
      });
    });
  });

  // 2. Scan for Merges (systematic approach using stored attributes)
  document.querySelectorAll(".be-merge-wrapper").forEach((wrapper) => {
    if (isTransientDragNode(wrapper)) return; // drag ghost, not layout
    const groupId = wrapper.getAttribute("data-be-group-merge");
    const spellMergeChild = wrapper.querySelector("[data-be-spell-merge]");
    const spellName = spellMergeChild
      ? spellMergeChild.getAttribute("data-be-spell-merge")
      : null;

    if (!groupId && !spellName) return;

    // Retrieve target metadata stored during merge
    const targetType = wrapper.getAttribute("data-be-target-type");
    const targetId = wrapper.getAttribute("data-be-target-id");
    const targetSelector = wrapper.getAttribute("data-be-target-selector");
    const targetIndex = wrapper.getAttribute("data-be-target-index");
    const targetName = wrapper.getAttribute("data-be-target-name");

    if (!targetType) return;

    const mergeEntry = {
      source: spellName
        ? { type: "spell", spellName }
        : { type: "group", originalId: groupId },
      target: {
        type: targetType,
        id: targetId,
        selector: targetSelector,
        index: targetIndex !== null ? parseInt(targetIndex) : undefined,
        name: targetName,
      },
    };

    // Source details for groups
    if (mergeEntry.source.type === "group") {
      const orig = document.getElementById(groupId);
      if (orig) {
        const res = window.SectionUtils.getExtractionSelector(orig, true);
        if (res) {
          mergeEntry.source.selector = res.selector;
          mergeEntry.source.index = res.index;
          mergeEntry.source.title =
            window.SectionUtils.findSectionTitle(orig) || "Merged Content";
        }
      }
    }

    layout.merges.push(mergeEntry);
  });

  return layout;
}

function migrateLayout(data) {
  if (!data || typeof data !== "object") return data;

  // 1. Handle wrapped templates (Catalog/PREMADE format)
  if (data.data && typeof data.data === "object" && !data.sections) {
    const templateData = data.data;
    // Merge template data into the main object
    for (const key in templateData) {
      if (Object.prototype.hasOwnProperty.call(templateData, key)) {
        data[key] = templateData[key];
      }
    }
    delete data.data;
  }

  // 2. Version-based Migrations
  const version = data.version || "1.0.0";

  // Legacy to 1.4.0 (GIF to WebP migration)
  if (version < "1.4.0") {
    window.safeLog?.(
      "log",
      `[DDB Print] Migrating layout from ${version} to 1.4.0...`,
    );

    const migratePath = (path) => {
      if (typeof path === "string" && path.endsWith(".gif")) {
        return path.replace(".gif", ".webp");
      }
      return path;
    };

    // Migrate Shapes
    if (data.shapes && Array.isArray(data.shapes)) {
      data.shapes.forEach((shape) => {
        shape.assetPath = migratePath(shape.assetPath);
      });
    }

    // Migrate Borders in standard sections
    if (data.sections) {
      Object.values(data.sections).forEach((sect) => {
        if (sect.borderStyle && typeof sect.borderStyle === "string") {
          // Border styles are classes, but some might have embedded paths in newer versions
          // (Though currently they are just class names like 'spikes_border')
        }
      });
    }

    data.version = "1.4.0";
  }

  // Initialize merges array if missing
  if (!data.merges) data.merges = [];

  // Helper to extract merges from legacy associatedExtractions
  const extractLegacyMerges = (containerId, associated) => {
    if (!Array.isArray(associated)) return;
    associated.forEach((aEx) => {
      // Avoid duplicates if already migrated
      const exists = data.merges.some(
        (m) =>
          m.target.id === containerId &&
          (m.source.originalId === aEx.originalId ||
            m.source.spellName === aEx.spellName),
      );
      if (exists) return;

      data.merges.push({
        source: aEx, // Structure matches (type, originalId, spellName, etc)
        target: {
          type: "section",
          id: containerId,
        },
      });
    });
  };

  // Scan extractions
  if (data.extractions) {
    data.extractions.forEach((ex) => {
      if (ex.associatedExtractions) {
        extractLegacyMerges(ex.id, ex.associatedExtractions);
        delete ex.associatedExtractions;
      }
    });
  }

  // Scan clones
  if (data.clones) {
    data.clones.forEach((cl) => {
      if (cl.associatedExtractions) {
        extractLegacyMerges(cl.id, cl.associatedExtractions);
        delete cl.associatedExtractions;
      }
    });
  }

  // Scan standard sections
  if (data.sections) {
    Object.entries(data.sections).forEach(([id, sect]) => {
      if (sect.associatedExtractions) {
        extractLegacyMerges(id, sect.associatedExtractions);
        delete sect.associatedExtractions;
      }
    });
  }

  return data;
}

const LayoutScan = {
  scanLayout,
  migrateLayout,
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = LayoutScan;
}
if (typeof window !== "undefined") {
  window.LayoutScan = LayoutScan;
}
