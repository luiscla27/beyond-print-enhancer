/**
 * Layout apply: layout-data-to-DOM restoration (applyLayout).
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 13 (split 3/3). Cross-module
 * seams resolved lazily at call time via window.* handles: safeLog,
 * __DDBStorage, DomManager, createShape, flagExtractableElements,
 * handleElementExtraction, handleMergeSections, section_cloning renderers
 * and SectionUtils helpers.
 */

"use strict";

async function applyLayout(layout) {
  layout = window.__DDBStorage.migrateLayout(layout);
  if (!layout) return;

  // Restore skillsSplit flag
  window.skillsSplit = layout.skillsSplit || false;

  // Trigger auto-split if the flag is set and we have the original box
  if (window.skillsSplit) {
    setTimeout(() => {
      if (typeof window.splitSkillsBox === "function") {
        window.splitSkillsBox(true);
      }
    }, 500);
  }

  const peDom = window.DomManager ? window.DomManager.getInstance() : null;
  const layerManager = peDom ? peDom.getLayerManager() : null;

  // Restore shape layers state
  if (layerManager && layout.shapeLayers) {
    // Reset shapeLayers in LayerManager
    layerManager.shapeLayers = [];
    layout.shapeLayers.forEach((savedLayer) => {
      const layer = layerManager.addShapeLayer(savedLayer.name, savedLayer);
      layer.id = savedLayer.id; // Preserve ID
      layer.layerId = savedLayer.layerId || `print-enhance-layer-${layer.id}`;
    });

    // Restore active layer ID if present
    if (layout.layers && layout.layers.activeLayerId) {
      layerManager.activeLayerId = layout.layers.activeLayerId;
      // Sync lock state of the active layer
      const active = layerManager.getLayerById(layerManager.activeLayerId);
      if (active) active.isLocked = false;
    }

    layerManager.refreshUI();
    if (window.updateControlsState) window.updateControlsState();
  }

  if (layerManager && layout.layers?.sections) {
    const layer = layerManager.sectionsLayer;
    const saved = layout.layers.sections;
    if (layer) {
      layer.isLocked = saved.isLocked || false;
      layer.isHidden = saved.isHidden || false;
      layer.isDisabledOnPrint = saved.isDisabledOnPrint || false;
    }
    layerManager.refreshUI();
  }

  // 0. Ensure elements are flagged (crucial for selector-based restoration)
  window.flagExtractableElements();

  // Save spells to cache if present
  if (layout.spell_cache && Array.isArray(layout.spell_cache)) {
    try {
      await window.__DDBStorage.init();
      await window.__DDBStorage.saveSpells(layout.spell_cache);
    } catch (err) {
      window.safeLog?.("error", "[DDB Print] Could not restore spell cache", err);
    }
  }

  // Remove existing clones to avoid duplicates on re-apply
  document
    .querySelectorAll(".print-section-container.be-clone")
    .forEach((el) => el.remove());
  // Remove existing extractions to avoid duplicates
  document
    .querySelectorAll(".print-section-container.be-extracted-section")
    .forEach((el) => {
      const originalId = el.dataset.originalId;
      const original = document.getElementById(originalId);
      if (original) original.style.display = "";
      el.remove();
    });

  // Restore clones
  if (layout.clones && Array.isArray(layout.clones)) {
    layout.clones.forEach((cloneData) => {
      window.renderClonedSection(cloneData);
    });
  }

  // Restore extractions
  if (layout.extractions && Array.isArray(layout.extractions)) {
    const deferredExtractions = [];
    layout.extractions.forEach((exData) => {
      const success = window.SectionCloning.renderExtractedSection(exData);
      if (!success) deferredExtractions.push(exData);
    });

    // Retry deferred extractions once after a delay (React lazy-load buffer)
    if (deferredExtractions.length > 0) {
      setTimeout(() => {
        // Re-flag elements just in case new ones appeared
        window.flagExtractableElements();
        deferredExtractions.forEach((exData) => {
          window.SectionCloning.renderExtractedSection(exData);
        });
        if (typeof window.updatePrintStyles === "function") {
          window.updatePrintStyles();
        }
      }, 1000);
    }
  }

  // Restore spell details
  if (layout.spell_details && Array.isArray(layout.spell_details)) {
    for (const spellData of layout.spell_details) {
      const container = await window.createSpellDetailSection(
        spellData.spellName,
        null,
        spellData,
      );
      if (container && spellData.borderStyle) {
        container.classList.add(spellData.borderStyle);
      }
    }
  }

  // Restore shapes from multi-layer format
  if (
    layerManager &&
    layout.shapeLayers &&
    Array.isArray(layout.shapeLayers)
  ) {
    // Remove existing shape wrappers to avoid duplicates and ID conflicts
    document
      .querySelectorAll(".be-shape-wrapper")
      .forEach((el) => el.remove());

    // Restore each layer and its elements
    layout.shapeLayers.forEach((layerData) => {
      const layer =
        layerManager.getLayerById(layerData.id) ||
        layerManager.addShapeLayer(layerData.name, layerData);
      if (layer) {
        // Ensure correct state
        layer.id = layerData.id;
        layer.isLocked = layerData.isLocked;
        layer.isHidden = layerData.isHidden;
        layer.isDisabledOnPrint = layerData.isDisabledOnPrint;

        if (Array.isArray(layerData.elements)) {
          layerData.elements.forEach((elementData) => {
            window.createShape(elementData.assetPath, elementData, layer.layerId);
          });
        }
      }
    });
    layerManager.refreshUI();
  } else if (layout.shapes && Array.isArray(layout.shapes)) {
    // Fallback to legacy single layer shapes if shapeLayers not present
    // Remove existing shapes to avoid duplicates
    document
      .querySelectorAll(".print-section-container.be-shape")
      .forEach((el) => el.remove());
    layout.shapes.forEach((shapeData) => {
      window.createShape(shapeData.assetPath, shapeData);
    });
  }

  for (const [id, styles] of Object.entries(layout.sections)) {
    const section = document.getElementById(id);
    if (!section) continue;

    const wrapper = section.closest(".be-section-wrapper") || section;

    // Apply border style
    window.Filters.clearBorderStyles(section);
    if (styles.borderStyle) {
      section.classList.add(styles.borderStyle);
    }

    // Apply main styles.
    //
    // track undo_stack_20260911 (Phase 2 verification): these were TRUTHINESS guards, so a
    // recorded EMPTY value was never written — and, worse, it could not CLEAR a value that a
    // gesture had since set. Measured consequence: pressing a section raises its inline
    // `z-index` (the click-to-front handler), the pre-gesture record holds `zIndex: ""`, and
    // the restore skipped it, leaving the section brought to the front after an undo. They
    // are now PRESENCE checks, so a key that exists is written back whatever it holds —
    // including empty, which correctly clears the inline value and restores what the scan
    // reported. Same fix, and same reasoning, as the one already made in createShape.
    const has = (k) => styles[k] !== undefined && styles[k] !== null;
    if (has("left")) wrapper.style.left = styles.left;
    if (has("top")) wrapper.style.top = styles.top;
    if (has("width")) section.style.width = styles.width;
    if (has("height")) section.style.height = styles.height;
    if (has("zIndex")) wrapper.style.zIndex = styles.zIndex;
    if (styles.printZIndex) wrapper.dataset.printZ = styles.printZIndex;
    if (styles.fontSize) window.applyFontSize(wrapper, styles.fontSize);

    if (styles.scalingFloorAutoOff === true || styles.noAutoScale === true) {
      section.dataset.noAutoScale = "true";
    } else {
      delete section.dataset.noAutoScale;
    }

    // Ensure container doesn't have duplicate positioning
    section.style.left = "";
    section.style.top = "";

    // Handle minimization
    if (styles.minimized) {
      section.dataset.minimized = "true";
      const content = section.querySelector(".print-section-content");
      if (content) content.style.display = "none";
    } else {
      section.dataset.minimized = "false";
      const content = section.querySelector(".print-section-content");
      if (content) content.style.display = "flex";
    }

    // Handle compact mode restoration
    if (styles.compact) {
      section.classList.add("be-compact-mode");
      const btn = section.querySelector(".be-compact-button");
      if (btn) btn.style.backgroundColor = "var(--btn-color)";
    } else {
      section.classList.remove("be-compact-mode");
      const btn = section.querySelector(".be-compact-button");
      if (btn) btn.style.backgroundColor = "var(--btn-color-highlight)";
    }

    // Apply inner widths
    if (styles.innerWidths) {
      const innerContainers = section.querySelectorAll(
        'div[class$="-row-header"], div[class$="-content"]',
      );
      // Iterate the DOM (not just the recorded keys) so a child the record has NO width for
      // is CLEARED. Without that, a width applied by a resize survived the undo: measured,
      // a resized section restored to `innerWidths: {"0-0": "288px"}` when the record held
      // `{}`, because the loop simply skipped the absent key.
      innerContainers.forEach((container, cIdx) => {
        Array.from(container.children).forEach((child, dIdx) => {
          if (!child || child.tagName !== "DIV") return;
          const width = styles.innerWidths[`${cIdx}-${dIdx}`] || "";
          child.style.width = width;
          child.style.minWidth = width;
        });
      });
    }
  }

  // 5. Restore Systematic Merges
  if (layout.merges && Array.isArray(layout.merges)) {
    for (const merge of layout.merges) {
      try {
        let sourceContainer = null;

        // 5.1 Resolve or Create Source
        if (merge.source.type === "spell") {
          sourceContainer = await window.createSpellDetailSection(
            merge.source.spellName,
            { x: 0, y: 0 },
          );
        } else if (merge.source.type === "group") {
          // Re-extract the group
          let original = document.getElementById(merge.source.originalId);
          if (!original && merge.source.selector) {
            const matches = document.querySelectorAll(merge.source.selector);
            original = matches[merge.source.index];
            if (original) original.id = merge.source.originalId;
          }
          if (original) {
            sourceContainer = await window.handleElementExtraction(original);
          }
        }

        if (!sourceContainer) continue;

        // 5.2 Resolve Target
        let targetInfo = null;
        if (merge.target.type === "section") {
          const tEl = document.getElementById(merge.target.id);
          if (tEl) {
            targetInfo = {
              type: "section",
              id: merge.target.id,
              element: tEl,
              name: merge.target.id,
            };
          }
        } else if (merge.target.type === "sheet") {
          let tEl = document.getElementById(merge.target.id);
          if (!tEl && merge.target.selector) {
            const matches = document.querySelectorAll(merge.target.selector);
            tEl = matches[merge.target.index];
          }
          if (tEl) {
            targetInfo = {
              type: "sheet",
              id: merge.target.id,
              element: tEl,
              name: merge.target.name || "Sheet Target",
            };
          }
        }

        // 5.3 Execute Merge
        if (targetInfo && sourceContainer) {
          // safeLog('log', `[DDB Print] Restoring merge: ${sourceContainer.id} -> ${targetInfo.name || targetInfo.id}`);
          window.handleMergeSections(sourceContainer, targetInfo);
        } else {
          window.safeLog?.(
            "warn",
            "[DDB Print] Could not resolve merge target or source",
            merge.target,
            !!sourceContainer,
          );
        }
      } catch (err) {
        window.safeLog?.("error", "[DDB Print] Failed to process merge", merge, err);
      }
    }
  }

  window.updateLayoutBounds();
  window.SectionUtils.refreshLayers();
  if (typeof updatePrintStyles === "function") {
    window.updatePrintStyles();
  }
}

const LayoutApply = {
  applyLayout,
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = LayoutApply;
}
if (typeof window !== "undefined") {
  window.LayoutApply = LayoutApply;
}
