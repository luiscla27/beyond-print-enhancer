/**
 * Properties panel: THE selection store (the single "active target" value),
 * plus the font-size / compact / border controls shown for the selected
 * target, the numeric position inputs, and the Add-Shape control-state
 * updater.
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 12 (split A). main.js delegates
 * through window.PropertiesPanel and keeps the legacy window
 * setActiveSection/getActiveSection/updateControlsState handles.
 *
 * SELECTION STORE (selection_model_ia_20260910, AC-1). This module owns the one
 * value that means "selected" and `setActiveSection` is the ONE write path. The
 * three components that display a selection READ it instead of keeping private
 * duplicates:
 *   - the on-sheet outline + wrapper glow  -> the DOM contract below
 *   - the layer panel's active row         -> LayerManager.syncSelectionRow()
 *                                             (notified here, resolved lazily)
 *   - these panel controls                 -> read `activeTarget` directly
 * The chip multi-select Set in js/dom/layer_manager.js stays a SET on purpose
 * (AC-3) — it is a different concept (a batch, not the active target) and must
 * never be conflated with this value.
 *
 * DOM CONTRACT (also AC-2 — one selection visual language): the selected
 * element carries `be-active-target` (the SHARED marker, added for sections AND
 * shapes) — sections additionally keep the legacy `be-active-section` handle, a
 * shape keeps the same `be-active-wrapper` marker on itself — and its
 * `.be-section-wrapper` ancestor carries `be-active-wrapper`. The store is the
 * only writer of those classes; nothing else may add or remove them.
 *
 * Cross-module seams resolved lazily at call time: SectionUtils.applyFontSize,
 * updateLayoutBounds, the unified asset picker (style mode), Filters.clearBorderStyles,
 * AssetCatalog.ALL_BORDER_STYLES, and the LayerManager.
 */

"use strict";

/** THE selection store — the only value that means "selected". @type {Element|null} */
let activeTarget = null;

/** Section-only panel controls are meaningless for a shape: identify the kind. */
function isShapeTarget(el) {
  return !!el && typeof el.classList !== "undefined" &&
    el.classList.contains("be-shape-wrapper");
}

/** The `.be-section-wrapper` that owns a target (a shape wrapper owns itself). */
function selectionWrapperOf(el) {
  if (!el || typeof el.closest !== "function") return null;
  return el.classList.contains("be-section-wrapper")
    ? el
    : el.closest(".be-section-wrapper");
}

/* ------------------------------------------------------------------------- *
 * THE SELECTION RING (AC-2, "one selection visual language").
 *
 * It is ONE body-level overlay element, positioned over the selected target's
 * measured box, and that is a MEASURED decision rather than a stylistic one:
 *   1. an `outline` on the target paints below the element's own children, so a
 *      shape's ornate border art covered it (0 exact-gold pixels around the
 *      shape against 568 around the section);
 *   2. a wrapper `::after` ring was computed correctly for both kinds (same
 *      2px solid rgb(198,161,91), same insets, display:block, non-zero box) yet
 *      rendered only for the SECTION — the shape's wrapper paint never reached
 *      the pixels;
 *   3. a wrapper `filter: drop-shadow(...)` ring works for a rectangular
 *      composite (the section) but for a shape the composite silhouette IS the
 *      artwork, so it produces no ring at all (measured: 0 warm-gold pixels
 *      around the shape's box).
 * A fixed overlay above every layer is unaffected by any of that, is literally
 * the same element for both kinds — so the two cannot drift — and gives the
 * pixels an exact, measurable 2px gold rectangle to assert.
 * ------------------------------------------------------------------------- */
const SELECTION_RING_ID = "print-enhance-selection-ring";

function selectionRingEl() {
  if (typeof document === "undefined") return null;
  let ring = document.getElementById(SELECTION_RING_ID);
  if (!ring) {
    ring = document.createElement("div");
    ring.id = SELECTION_RING_ID;
    ring.setAttribute("aria-hidden", "true");
    (document.body || document.documentElement).appendChild(ring);
  }
  return ring;
}

/** Position (or hide) the ring over the store's current target. */
function positionSelectionRing() {
  const ring = selectionRingEl();
  if (!ring) return;
  const rect =
    activeTarget && typeof activeTarget.getBoundingClientRect === "function"
      ? activeTarget.getBoundingClientRect()
      : null;
  if (!rect || (!rect.width && !rect.height)) {
    ring.style.display = "none";
    return;
  }
  ring.style.display = "block";
  ring.style.left = Math.round(rect.left - 3) + "px";
  ring.style.top = Math.round(rect.top - 3) + "px";
  ring.style.width = Math.round(rect.width) + "px";
  ring.style.height = Math.round(rect.height) + "px";
}

/** Keep the ring over the target while the sheet moves under it. */
let selectionRingTrackingBound = false;
function bindSelectionRingTracking() {
  if (typeof window === "undefined" || selectionRingTrackingBound) return;
  selectionRingTrackingBound = true;
  const reposition = () => positionSelectionRing();
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);
  window.addEventListener("be-layout-moved", reposition);
}

/**
 * Canonicalise the target so EVERY entry point stores the SAME element for the
 * same thing (that is what makes "one value" real rather than nominal): a shape
 * is its `.be-shape-wrapper`, a section is its `.print-section-container` card
 * (the element that actually carries `be-compact-mode` and the section styles),
 * falling back to whatever was handed in when no card exists (bare fixtures).
 */
function normalizeSelectionTarget(el) {
  if (!el || typeof el.classList === "undefined") return null;
  if (isShapeTarget(el)) return el;
  if (el.classList.contains("print-section-container")) return el;
  const wrapper = selectionWrapperOf(el);
  const scope = wrapper || el;
  if (typeof scope.querySelector === "function") {
    const card = scope.querySelector(".print-section-container");
    if (card) return card;
  }
  return el;
}

function clearSelectionMarkers(el) {
  if (!el || typeof el.classList === "undefined") return;
  el.classList.remove("be-active-target", "be-active-section");
  const wrapper = selectionWrapperOf(el);
  if (wrapper) wrapper.classList.remove("be-active-wrapper");
}

function applySelectionMarkers(el) {
  if (!el || typeof el.classList === "undefined") return;
  el.classList.add("be-active-target");
  if (!isShapeTarget(el)) el.classList.add("be-active-section");
  const wrapper = selectionWrapperOf(el);
  if (wrapper) wrapper.classList.add("be-active-wrapper");
}

/**
 * Notify the other readers of the selected target. The LayerManager is
 * resolved at CALL time (it is evaluated before this module in every harness
 * and in the extension's script list) and never cached.
 */
function notifySelectionChanged(target) {
  try {
    const manager = window.PeDom
      ? window.PeDom().getLayerManager()
      : window.DomManager
        ? window.DomManager.getInstance().getLayerManager()
        : null;
    if (manager && typeof manager.syncSelectionRow === "function") {
      manager.syncSelectionRow(target);
    }
  } catch {
    /* bare harnesses without a layer manager: nothing else reads the target */
  }
  try {
    window.dispatchEvent(new window.CustomEvent("be-selection-changed", {
      detail: { targetId: target && target.id ? target.id : null },
    }));
  } catch {
    /* CustomEvent may be unavailable in bare harnesses */
  }
}

/**
 * THE single write path for the selection store (AC-1). Accepts a section card
 * or a shape wrapper; `null` clears. Never add a second writer.
 */
function setActiveSection(target) {
  const next = normalizeSelectionTarget(target);
  if (next !== activeTarget) clearSelectionMarkers(activeTarget);
  activeTarget = next;
  applySelectionMarkers(activeTarget);
  positionSelectionRing();
  bindSelectionRingTracking();
  updatePropertiesPanel();
  notifySelectionChanged(activeTarget);
}


/**
 * Position group (AC-9, Phase 4 of drag_ux_overhaul_20260909): numeric X/Y
 * (left/top) inputs for the active wrapper. Commits on blur/change or Enter,
 * clamped to >= 0 (same bounds contract as drops/nudges), then keeps the
 * layout bounds, the autosave hook and the sync event in step.
 */
function appendPositionGroup(panel, wrapper) {
  const row = document.createElement("div");
  row.className = "be-prop-position";
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "8px";
  row.style.margin = "0 0 8px 0";

  const title = document.createElement("span");
  title.textContent = "Position";
  title.style.fontSize = "11px";
  title.style.color = "#ccc";
  row.appendChild(title);

  const commit = async (input, axis) => {
    const v = Math.max(0, Math.round(parseFloat(input.value) || 0));
    // Phase 2a (track undo_stack_20260911): capture BEFORE the write (scanLayout awaits
    // storage mid-scan, so it must complete before the DOM changes), and skip the record
    // when the value did not actually change — a re-commit of the same number is a no-op,
    // and the no-op guard is what keeps the stack from filling with non-mutations.
    const prop = axis === "x" ? "left" : "top";
    const current = wrapper.style[prop] || "";
    if (current !== v + "px" && typeof window.captureUndo === "function") {
      await window.captureUndo(
        "Position \"" + (wrapper.dataset.title || wrapper.id || "element") + "\"",
        window.MUTATION_CLASSES.POSITION,
      );
    }
    input.value = String(v);
    wrapper.style.setProperty(prop, v + "px", "important");
    if (window.updateLayoutBounds) window.updateLayoutBounds();
    if (typeof window.scheduleAutosave === "function") window.scheduleAutosave();
    if (typeof window.notifyLayoutMoved === "function") window.notifyLayoutMoved();
  };
  const mkInput = (axis, initial) => {
    const field = document.createElement("label");
    field.style.display = "flex";
    field.style.alignItems = "center";
    field.style.gap = "4px";
    field.style.fontSize = "11px";
    field.style.color = "#aaa";
    const cap = document.createElement("span");
    cap.textContent = axis.toUpperCase();
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.dataset.bePos = axis;
    input.value = String(initial);
    input.style.width = "64px";
    input.style.fontSize = "12px";
    input.addEventListener("change", () => commit(input, axis));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit(input, axis);
        input.blur();
      }
    });
    field.appendChild(cap);
    field.appendChild(input);
    return field;
  };

  const left = parseInt(wrapper.style.left) || 0;
  const top = parseInt(wrapper.style.top) || 0;
  row.appendChild(mkInput("x", left));
  row.appendChild(mkInput("y", top));
  panel.appendChild(row);
}

function syncPositionInputs() {
  const panel = document.getElementById("print-enhance-properties-panel");
  if (!panel || !activeTarget) return;
  const wrapper = activeTarget.closest(".be-section-wrapper") || activeTarget;
  const x = panel.querySelector('input[data-be-pos="x"]');
  const y = panel.querySelector('input[data-be-pos="y"]');
  if (x) x.value = String(parseInt(wrapper.style.left) || 0);
  if (y) y.value = String(parseInt(wrapper.style.top) || 0);
}

function updatePropertiesPanel(panelElement = null) {
  const panel =
    panelElement || document.getElementById("print-enhance-properties-panel");
  if (!panel) return;

  panel.innerHTML = "";

  if (!activeTarget) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "be-prop-panel-empty";
    emptyMsg.textContent = "Select a section to edit its properties";
    emptyMsg.style.color = "#888";
    emptyMsg.style.fontStyle = "italic";
    emptyMsg.style.textAlign = "center";
    emptyMsg.style.padding = "10px";
    panel.appendChild(emptyMsg);
    return;
  }

  const title = document.createElement("h4");
  title.style.margin = "0 0 8px 0";
  title.style.fontSize = "14px";
  title.style.color = "var(--btn-color)";

  const targetIsShape = isShapeTarget(activeTarget);
  if (targetIsShape) {
    const name =
      activeTarget.dataset.label ||
      activeTarget.dataset.title ||
      activeTarget.querySelector("img")?.getAttribute("alt") ||
      "Shape";
    title.textContent = `Editing: ${name}`;
  } else {
    const header = activeTarget.querySelector(".print-section-header span");
    title.textContent = `Editing: ${header ? header.textContent.trim() : "Section"}`;
  }
  panel.appendChild(title);

  // Position (numeric X/Y) is meaningful for BOTH kinds. For a section it is
  // appended AFTER the font-size block, which is what keeps the debt-pinned
  // first <span> of the panel = the font-size value readout; a shape has no
  // font-size block, so it leads with the position group.
  if (targetIsShape) {
    appendPositionGroup(panel, selectionWrapperOf(activeTarget) || activeTarget);
    // A shape has no font size, compact mode or border style of its own (its
    // styling lives in the in-sheet action bar / the shape picker). Saying so
    // is honest; inventing section controls for it is not (AC-1).
    const note = document.createElement("div");
    note.className = "be-prop-panel-note";
    note.textContent = "Shape selected — use its on-sheet controls to restyle it";
    note.style.color = "#888";
    note.style.fontSize = "11px";
    note.style.fontStyle = "italic";
    note.style.lineHeight = "1.4";
    panel.appendChild(note);
    return;
  }

  // 1. Font Size Slider
  const fsContainer = document.createElement("div");
  fsContainer.className = "be-prop-control";
  fsContainer.style.display = "flex";
  fsContainer.style.flexDirection = "column";
  fsContainer.style.gap = "4px";

  const fsLabel = document.createElement("label");
  fsLabel.textContent = "Font Size";
  fsLabel.style.fontSize = "11px";
  fsLabel.style.color = "#ccc";
  fsContainer.appendChild(fsLabel);

  const fsSliderRow = document.createElement("div");
  fsSliderRow.style.display = "flex";
  fsSliderRow.style.alignItems = "center";
  fsSliderRow.style.gap = "8px";

  const wrapper =
    activeTarget.closest(".be-section-wrapper") || activeTarget;
  const currentSize = wrapper.style.fontSize || "10px";

  let numericValue = 10;
  let unit = "px";
  const match = currentSize.match(/^(\d+(?:\.\d+)?)(px|em|rem|%)$/);
  if (match) {
    numericValue = parseFloat(match[1]);
    unit = match[2];

    // If it was percentage, convert to px base 10 for the slider
    if (unit === "%") {
      numericValue = (numericValue / 100) * 10;
      unit = "px";
    }
  }

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "8";
  slider.max = "30";
  slider.value = numericValue.toString();
  slider.className = "be-modal-slider";
  slider.style.flexGrow = "1";

  const valDisplay = document.createElement("span");
  valDisplay.textContent = `${slider.value}px`;
  valDisplay.style.minWidth = "40px";
  valDisplay.style.textAlign = "right";
  valDisplay.style.fontSize = "12px";

  slider.oninput = () => {
    const val = slider.value;
    valDisplay.textContent = `${val}px`;

    window.SectionUtils.applyFontSize(wrapper, `${val}px`);
    window.updateLayoutBounds();
  };

  fsSliderRow.appendChild(slider);
  fsSliderRow.appendChild(valDisplay);
  fsContainer.appendChild(fsSliderRow);
  panel.appendChild(fsContainer);

  // Position (numeric X/Y) — precision path (AC-9, drag_ux_overhaul
  // Phase 4). Placed after the font-size block (keeps the debt-pinned first
  // <span> = the font-size value readout) and high enough to be inside the
  // tray's visible area.
  appendPositionGroup(panel, selectionWrapperOf(activeTarget) || activeTarget);

  // 2. Compact Mode Toggle
  const compactContainer = document.createElement("div");
  compactContainer.className = "be-prop-control";
  compactContainer.style.display = "flex";
  compactContainer.style.alignItems = "center";
  compactContainer.style.justifyContent = "space-between";
  compactContainer.style.padding = "4px 0";

  const compactLabel = document.createElement("label");
  compactLabel.textContent = "Compact Mode";
  compactLabel.style.fontSize = "12px";
  compactLabel.style.color = "#ccc";
  compactContainer.appendChild(compactLabel);

  const compactToggle = document.createElement("input");
  compactToggle.type = "checkbox";
  compactToggle.checked = activeTarget.classList.contains("be-compact-mode");
  compactToggle.style.cursor = "pointer";

  compactToggle.onchange = () => {
    activeTarget.classList.toggle("be-compact-mode", compactToggle.checked);
    window.updateLayoutBounds();

    // Sync with the section button if visible
    const btn = activeTarget.querySelector(".be-compact-toggle");
    if (btn) {
      btn.style.backgroundColor = compactToggle.checked
        ? "var(--btn-color)"
        : "var(--btn-color-highlight)";
    }
  };

  compactContainer.appendChild(compactToggle);
  panel.appendChild(compactContainer);

  // 3. Responsive Scaling Toggle
  const scalingContainer = document.createElement("div");
  scalingContainer.className = "be-prop-control";
  scalingContainer.style.display = "flex";
  scalingContainer.style.alignItems = "center";
  scalingContainer.style.justifyContent = "space-between";
  scalingContainer.style.padding = "4px 0";

  const scalingLabel = document.createElement("label");
  scalingLabel.textContent = "Auto-scale to fit";
  scalingLabel.style.fontSize = "12px";
  scalingLabel.style.color = "#ccc";
  scalingContainer.appendChild(scalingLabel);

  const scalingToggle = document.createElement("input");
  scalingToggle.type = "checkbox";
  scalingToggle.checked = activeTarget.dataset.noAutoScale !== "true";
  scalingToggle.style.cursor = "pointer";

  scalingToggle.onchange = () => {
    if (scalingToggle.checked) {
      delete activeTarget.dataset.noAutoScale;
    } else {
      activeTarget.dataset.noAutoScale = "true";
    }

    if (typeof window.initResponsiveScaling === "function") {
      window.initResponsiveScaling();
    }

    window.updateLayoutBounds();
  };

  scalingContainer.appendChild(scalingToggle);
  panel.appendChild(scalingContainer);

  // 4. Border Style Button
  const borderContainer = document.createElement("div");
  borderContainer.className = "be-prop-control";
  borderContainer.style.display = "flex";
  borderContainer.style.alignItems = "center";
  borderContainer.style.justifyContent = "space-between";
  borderContainer.style.padding = "4px 0";

  const borderLabel = document.createElement("label");
  borderLabel.textContent = "Border Style";
  borderLabel.style.fontSize = "12px";
  borderLabel.style.color = "#ccc";
  borderContainer.appendChild(borderLabel);

  const borderBtn = document.createElement("button");
  borderBtn.className = "be-prop-border-button";
  borderBtn.style.width = "60px";
  borderBtn.style.height = "40px";
  borderBtn.style.padding = "4px";
  borderBtn.style.border = "1px solid #444";
  borderBtn.style.backgroundColor = "#222";
  borderBtn.style.cursor = "pointer";
  borderBtn.style.borderRadius = "4px";
  borderBtn.style.display = "flex";
  borderBtn.style.alignItems = "center";
  borderBtn.style.justifyContent = "center";
  borderBtn.style.position = "relative";
  borderBtn.title = "Change Border Style";

  const currentBorderStyle =
    (window.AssetCatalog.ALL_BORDER_STYLES || ["no-border"]).find((style) =>
      activeTarget.classList.contains(style),
    ) || "default-border";

  const borderPreview = document.createElement("div");
  borderPreview.className = `be-border-preview ${currentBorderStyle}`;
  borderPreview.style.width = "100%";
  borderPreview.style.height = "100%";
  borderPreview.style.pointerEvents = "none";
  borderBtn.appendChild(borderPreview);

  borderBtn.onclick = async () => {
    const style =
      (window.AssetCatalog.ALL_BORDER_STYLES || ["no-border"]).find((s) => activeTarget.classList.contains(s)) ||
      "default-border";
    // Unified picker style mode (border_shape_picker_ux_20260909, B-1: the
    // legacy Modals border-style surface is gone).
    const result = await window.showAssetPickerModal({
      mode: "style",
      current: style,
      target: activeTarget,
    });

    if (result) {
      window.Filters.clearBorderStyles(activeTarget);
      activeTarget.classList.add(result.style);

      // Update preview
      borderPreview.className = `be-border-preview ${result.style}`;

      window.updateLayoutBounds();
    }
  };

  borderContainer.appendChild(borderBtn);
  panel.appendChild(borderContainer);
}

/** Legacy handle (main.js + the active_section suite): the same single value. */
function getActiveSection() {
  return activeTarget;
}

/** The store's read accessor (AC-1) — prefer this name in new code. */
function getActiveTarget() {
  return activeTarget;
}

/**
 * A selected target that has been REMOVED from the sheet must not stay selected:
 * otherwise the panel keeps describing an element that no longer exists, which
 * is the same class of disagreement AC-1 forbids. Called by the layer panel
 * after any content change (deletes, batch deletes, moves). Clearing goes
 * through the one write path, so this adds a reader-driven trigger, not a second
 * writer.
 */
function pruneSelection() {
  if (
    activeTarget &&
    typeof activeTarget.isConnected === "boolean" &&
    !activeTarget.isConnected
  ) {
    setActiveSection(null);
    return true;
  }
  return false;
}

function updateControlsState() {
  const lm = window.PeDom
    ? window.PeDom().getLayerManager()
    : window.DomManager
      ? window.DomManager.getInstance().getLayerManager()
      : null;
  if (!lm) return;

  const addShapeBtn = document.getElementById("be-btn-add-shape");
  if (addShapeBtn) {
    const hasActiveLayer = lm.activeLayerId !== null;
    addShapeBtn.disabled = !hasActiveLayer;
    addShapeBtn.style.opacity = !hasActiveLayer ? "0.5" : "1";
    addShapeBtn.style.cursor = !hasActiveLayer ? "not-allowed" : "pointer";
    addShapeBtn.title = !hasActiveLayer
      ? "Select a layer in Layer Management to enable"
      : "Add a decorative shape";
  }
}

const PropertiesPanel = {
  setActiveSection,
  getActiveSection,
  getActiveTarget,
  pruneSelection,
  positionSelectionRing,
  updatePropertiesPanel,
  updateControlsState,
  syncPositionInputs,
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = PropertiesPanel;
}
if (typeof window !== "undefined") {
  window.PropertiesPanel = PropertiesPanel;
}
