/**
 * Controls: the fixed control panel (action buttons, filter sliders and the
 * color-picker) built by createControls().
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 12 (split B). Contains debt
 * fixes #1 (internal idempotency guard) and #2 (be-btn-add-shape id is now
 * honored from the button config).
 *
 * The module is a ~570-line cohesive DOM builder — operator-ratified AC-R2
 * (400-line cap) waiver, mirroring the shape_picker decision.
 *
 * Cross-module seams resolved lazily at call time via window.* handles
 * (safeLog, PropertiesPanel.updatePropertiesPanel, Modals.showFeedback,
 * DomManager, and the persistence/clone actions still owned by main.js until
 * later phases).
 */

"use strict";

/**
 * AC-5 (first_run_and_panel_20260911): a tray/band header that FOLDS ITS OWN GROUP.
 *
 * WHY A DISCLOSURE CONTROL IS THE FIX, AND WHY IT IS NOT A CUT. `ux_gaps_20260911` measured this
 * panel and concluded no control should be cut or reordered — its common path is above the fold and
 * its tray order is already the priority order. That conclusion is transcribed as accepted at the
 * top of `phase5_record.md` and this function does not touch it. What it adds is the property no
 * phase had measured: **the surface can be made smaller by the user while every control survives.**
 *
 * THE THREE REQUIREMENTS THE ARTIFACT PUTS ON IT, each satisfied structurally:
 *
 *  1. **A collapsed group must stay programmatically reachable.** Collapsing adds a class to the
 *     GROUP; the CSS hides the non-header children with `display: none`. Nothing is removed from the
 *     DOM and nothing is detached, so re-expanding restores the same nodes — not rebuilt copies.
 *     (Removing them, which a naive implementation would do to "save space", is an explicit AC-5
 *     fail condition.)
 *  2. **It must be reachable by keyboard.** It is a real `<button>`: Enter and Space activate it for
 *     free, it is in the tab order in the order the groups are read, and its state is announced
 *     through `aria-expanded`.
 *  3. **The header must keep its measured type recipe.** The `ui_headers` contract pins
 *     `padding: 12px 4px 8px` and `margin: 4px 0 6px` and one font recipe across every chrome header;
 *     a `<button>` brings browser defaults, so the CSS resets them and keeps those values.
 *
 * `aria-controls` is set to the group's id so the relationship is machine-readable rather than
 * implied by adjacency.
 *
 * NOT PERSISTED, deliberately: the fold is a view convenience for the moment, and a persisted one
 * would reopen the panel in a state the user did not ask for on a page they have not looked at yet —
 * the same reasoning that made the activation state session-scoped (O-4).
 */
function makeCollapsibleHead(labelText, groupId) {
  const hdr = document.createElement("button");
  hdr.type = "button";
  hdr.className = "be-ctl-tray-head be-ctl-fold";
  hdr.setAttribute("aria-expanded", "true");
  if (groupId) {
    hdr.id = `${groupId}-head`;
    hdr.setAttribute("aria-controls", groupId);
  }

  const label = document.createElement("span");
  label.className = "be-ctl-fold-label";
  label.textContent = labelText;
  hdr.appendChild(label);

  // The chevron is drawn by CSS from this element rather than shipped as an icon: it has to ROTATE
  // to state the fold, and the icon set is 16px line art with no orientation variant.
  const caret = document.createElement("span");
  caret.className = "be-ctl-fold-caret";
  caret.setAttribute("aria-hidden", "true");
  hdr.appendChild(caret);

  hdr.addEventListener("click", () => {
    // The group is the header's parent (a tray or a band). Toggling the class is the whole state.
    const group = hdr.parentElement;
    if (!group) return;
    const collapsed = group.classList.toggle("be-ctl-folded");
    hdr.setAttribute("aria-expanded", String(!collapsed));
    // A collapsed group may contain the focused control — collapsing it would leave focus in a
    // `display: none` subtree, which is where "it works with a mouse but not a keyboard" bugs live.
    // Move focus to the header that did the collapsing, which is also where a keyboard user expects
    // to be after folding a section.
    if (collapsed && group.contains(document.activeElement)) hdr.focus();
  });

  return hdr;
}

function createControls() {
  window.safeLog?.("log", "[DDB Print] createControls: building container...");
  // Debt #1 fix (regression-pinned): an internal guard makes a second call a
  // no-op instead of appending a duplicate panel (was masked by the IIFE init
  // guard only).
  if (document.getElementById("print-enhance-controls")) {
    window.safeLog?.("log", "[DDB Print] createControls: control panel exists, skipping.");
    return;
  }

  const container = document.createElement("div");
  container.id = "print-enhance-controls";
  container.style.position = "fixed";
  container.style.top = "10px";
  container.style.left = "10px";
  container.style.zIndex = window.Z.PANEL; // AC-5: the declaration map (was "10000")
  container.style.background = "#222";
  container.style.border = "1px solid #444";
  container.style.padding = "8px";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "8px";
  container.style.borderRadius = "8px";
  container.style.boxShadow = "0 4px 15px rgba(0,0,0,0.5)";
  container.style.transition = "opacity 0.3s, transform 0.3s";

  // Hover logic
  container.addEventListener("mouseenter", () => {
    container.style.transform = "scale(1.02)";
  });
  container.addEventListener("mouseleave", () => {
    container.style.transform = "scale(1)";
  });

  const buttons = [
    { label: "Load", iconKey: "folderOpen", tray: "layout", action: () => window.handleLoadFile() },
    { label: "Reset to Default", iconKey: "reset", tray: "layout", action: () => window.handleLoadDefault() },
    { label: "Manage Clones", iconKey: "clone", tray: "layout", action: () => window.handleManageClones() },
    {
      label: "Add Shape",
      iconKey: "shape",
      tray: "layout",
      action: async () => {
        const result = await window.showShapePickerModal();
        if (result) {
          // Phase 2f (track undo_stack_20260911): adding a shape is a STRUCTURAL layout
          // mutation (scanLayout records the layer's elements), so the record is taken
          // before the node exists — the inverse removes it.
          if (typeof window.captureUndo === "function") {
            await window.captureUndo("Add shape", window.MUTATION_CLASSES.STRUCTURAL);
          }
          window.createShape(result.assetPath);
          window.showFeedback("Shape added");
        }
      },
      id: "be-btn-add-shape",
    },
    { label: "Manage Compact", iconKey: "compact", tray: "layout", action: () => window.handleManageCompact() },
    {
      label: "Print",
      iconKey: "printer",
      tray: "output",
      kind: "hero",
      // The id is not only for tests: the OUTPUT tray is the one place a user looks before
      // printing, and the AC-2 suite asserts that this control still calls window.print()
      // immediately (no dialog in front of it) — which needs a stable handle on it.
      id: "be-btn-print",
      action: () => window.print(),
    },
    {
      // AC-2 (first_run_and_panel_20260911): the browser-side settings, at the moment of printing.
      // Deliberately placed IMMEDIATELY AFTER Print and NOT in front of it: AC-2's fail condition
      // forbids a surface that blocks, delays or otherwise interferes with `window.print()`, and a
      // settings dialog shown BEFORE the print dialog would be exactly that friction. Printing stays
      // immediate; the settings are one control away, in the same tray, while the user is printing.
      // Label kept short so it cannot wrap in the 232px tray (the same constraint that shortened
      // "Feedback" and "Restore backup...").
      label: "Print settings",
      title: "What to set in the browser's print dialog",
      iconKey: "printer",
      tray: "output",
      id: "be-btn-print-settings",
      action: () => window.showPrintSettingsSurface(),
    },
    { label: "Save to Browser", iconKey: "download", tray: "output", action: () => window.handleSaveBrowser() },
    { label: "Save to PC", iconKey: "savePc", tray: "output", action: () => window.handleSavePC() },
    {
      // AC-8 (undo_stack_20260911): ONE control that names what it will undo, instead of
      // a generic "Undo". The label is refreshed from the stack top — see
      // refreshUndoControl() below, which is driven by the `be-undo-stack-changed` event
      // `pushUndo` dispatches, so the control cannot go stale.
      label: "Undo",
      title: "Undo the last change",
      iconKey: "reset",
      tray: "output",
      id: "be-btn-undo",
      action: () => { if (window.applyUndo) window.applyUndo(); },
    },
    {
      // AC-4 (destructive_recovery_20260911): recovery must be reachable from NORMAL
      // operation. Until this button existed, the only way to restore a backup was to
      // have a layout FAIL to load first — the failure card was the sole restore
      // surface in the product. Label kept short so it fits the 232px tray (same
      // reason O-2 shortened "Feedback"); the full text rides on the tooltip.
      // ASCII ellipsis, deliberately: these scripts are injected as content
      // scripts and the browser does not decode them as UTF-8, so a U+2026 here
      // renders as mojibake in the panel (measured: "Restore backupâ€¦" in the
      // phase-2 capture). Same fix, and same reason, as the onboarding hint.
      label: "Restore backup...",
      title: "Restore an automatic backup taken before a destructive action",
      iconKey: "reset",
      tray: "output",
      action: () => window.showRestoreSurface(),
    },
    // NOTE (AC-3, first_run_and_panel_20260911): "Feedback" and "Contribute" were the last two rows
    // of this array, in a tray labelled HELP. They moved OUT of the panel and into the extension's
    // own action-icon menu (js/background.js), where the funding destinations already live. The
    // operator chose this over leaving them as they were (which AC-3 permitted) so that the tray
    // labelled HELP is unambiguously about help. Nothing was deleted and no channel became
    // unreachable — the moves are verified by a browser case, not asserted from source.
  ];

  // TEMPLATES lives in the top bar (not the action wall) — round 1 IA.
  const templatesBtn = document.createElement("button");
  templatesBtn.id = "be-btn-templates";
  templatesBtn.textContent = "TEMPLATES";
  templatesBtn.className = "be-ctl-chip be-ctl-templates";
  templatesBtn.onclick = () => window.showPremadeCatalogModal();

  // ---- Tray-based IA (round 1/6): header + LAYOUT/OUTPUT/HELP trays ----
  // The topbar is TWO rows: the title owns its own line (it is the longest
  // header in the chrome and used to wrap to two lines when sharing a row with
  // the TEMPLATES chip and the collapse button), and the panel's own controls
  // sit on a second row. Both rows are single-line.
  const topbar = document.createElement("div");
  topbar.className = "be-ctl-topbar";
  const headRow = document.createElement("div");
  headRow.className = "be-ctl-topbar-row";
  const title = document.createElement("span");
  title.className = "be-ctl-title";
  title.textContent = "Beyond Print";
  // the full text survives even if a future label is ever clipped
  title.title = "Beyond Print";
  const collapseBtn = document.createElement("button");
  collapseBtn.id = "be-ctl-collapse";
  collapseBtn.title = "Minimize panel";
  collapseBtn.setAttribute("aria-label", "Minimize panel");
  collapseBtn.innerHTML = window.Icons && window.Icons.svg ? window.Icons.svg("x", 12) : "×";
  collapseBtn.addEventListener("click", () => container.classList.toggle("be-ctl-collapsed"));
  // AC-2 (ux_gaps_20260911): the panel's reference surface. Before this, the product taught
  // exactly THREE gestures, once, in a card that never returns — while its double-click
  // extract, right-click layer menu and Ctrl/Cmd+Z were reachable only by accident (measured:
  // no help/shortcut/keymap surface existed anywhere in js/, and the only non-comment mention
  // of the undo shortcut in the whole product was a log line). The "?" sits in the header,
  // outside the scrollport, so it is reachable at every panel height.
  const helpBtn = document.createElement("button");
  helpBtn.id = "be-ctl-help";
  helpBtn.className = "be-ctl-help";
  helpBtn.textContent = "?";
  helpBtn.title = "Gestures & keyboard shortcuts";
  helpBtn.setAttribute("aria-label", "Gestures and keyboard shortcuts");
  helpBtn.addEventListener("click", () => showHelpSurface());
  // AC-4 (first_run_and_panel_20260911): the tool can be turned off from inside the page, and the
  // toolbar icon says whether it is on.
  //
  // WHY THIS IS IN THE HEADER AND NOT A TRAy ROW. Two reasons, both measured or design-visible:
  // (1) AC-5 has to absorb this track's added height, and the header is OUTSIDE the scrollport, so a
  // control here costs zero vertical pixels where a tray row costs 36-40; (2) "stop the tool" is a
  // meta action about the page, not an operation on the sheet, and the header is where the panel's
  // own controls already live (the "?" and the minimize ✕).
  //
  // WHAT IT DOES is stated in the dialog rather than left to be discovered, because it is a
  // RELOAD: see showTurnOffSurface(). O-4 (ratified) chose SESSION-SCOPED teardown re-activated by
  // the toolbar icon, and a reload is what that means here — measured, a reloaded page carries
  // NONE of the extension (Phase 1's D2 test: panel false; Phase 4's probe: 7 stylesheets, 4,058
  // nodes and 102 ids all come from the injection, and 20 SITE nodes are REMOVED by it, so there is
  // no clean in-place unwrap to perform).
  const offBtn = document.createElement("button");
  offBtn.id = "be-ctl-off";
  offBtn.className = "be-ctl-help";
  offBtn.innerHTML = window.Icons && window.Icons.svg ? window.Icons.svg("power", 14) : "⏻";
  offBtn.title = "Turn off for this page";
  offBtn.setAttribute("aria-label", "Turn off the print enhancer for this page");
  offBtn.addEventListener("click", () => showTurnOffSurface());
  headRow.appendChild(title);
  headRow.appendChild(helpBtn);
  headRow.appendChild(offBtn);
  headRow.appendChild(collapseBtn);
  const actionsRow = document.createElement("div");
  actionsRow.className = "be-ctl-topbar-row be-ctl-topbar-actions";
  actionsRow.appendChild(templatesBtn);
  topbar.appendChild(headRow);
  topbar.appendChild(actionsRow);
  container.appendChild(topbar);

  // Pinned header + scrollable body. The panel's content is taller than a
  // laptop viewport (measured: 1156px of content in a 900px window) and the
  // panel is position:fixed, so without an internal scrollport the bottom
  // blocks — CANVAS FILTERS, Reset Filters and Contribute — could not be
  // reached at all. The header stays OUTSIDE the scroller so the title,
  // TEMPLATES and the collapse control are always at hand.
  const scrollBody = document.createElement("div");
  scrollBody.className = "be-ctl-scroll";
  container.appendChild(scrollBody);

  // AC-3 (first_run_and_panel_20260911): the `help` tray is GONE. It held exactly two rows, both of
  // which moved to the action-icon menu, and an empty tray header would have been a worse artifact
  // than no tray. Tray order is unchanged for everything else: LAYOUT (arrange) -> OUTPUT (print,
  // save, undo, recovery), the priority order 1.16.0 measured and this track does not re-open.
  const trayDefs = { layout: "LAYOUT", output: "OUTPUT" };
  const trays = {};
  Object.keys(trayDefs).forEach((key) => {
    const tray = document.createElement("div");
    tray.className = `be-ctl-tray be-ctl-tray-${key}`;
    tray.id = `be-ctl-tray-${key}`;
    tray.appendChild(makeCollapsibleHead(trayDefs[key], tray.id));
    scrollBody.appendChild(tray);
    trays[key] = tray;
  });

  const makeActionBtn = (btnInfo) => {
    const btn = document.createElement("button");
    if (btnInfo.id) btn.id = btnInfo.id;
    const svgMarkup = btnInfo.iconKey && window.Icons && window.Icons.svg
      ? window.Icons.svg(btnInfo.iconKey, 16)
      : "";
    btn.innerHTML = svgMarkup
      ? `<span class="be-ctl-ico">${svgMarkup}</span><span class="be-ctl-label">${btnInfo.label}</span>`
      : btnInfo.label;
    if (btnInfo.kind) btn.classList.add(`be-ctl-${btnInfo.kind}`);
    btn.classList.add("be-ctl-btn");
    // AC-5: the full label always survives in the tooltip, so a clipped label
    // never loses meaning.
    btn.title = btnInfo.title || btnInfo.label;
    btn.addEventListener("click", async (e) => {
      window.safeLog?.("log", `[DDB Print] Button Clicked: ${btnInfo.label}`);
      try {
        if (typeof btnInfo.action === "function") {
          const result = btnInfo.action(e);
          if (result instanceof Promise) await result;
        } else {
          window.safeLog?.("error", `[DDB Print] No valid action for ${btnInfo.label}`);
        }
      } catch (err) {
        window.safeLog?.("error", `[DDB Print] Error executing ${btnInfo.label}:`, err);
      }
    });
    return btn;
  };

  buttons.forEach((btnInfo) => {
    const btn = makeActionBtn(btnInfo);
    const tray = trays[btnInfo.tray] || trays.layout;
    if (btnInfo.kind === "hero") {
      // 44px brass hero stays inside its tray with a charcoal surround
      const heroWrap = document.createElement("div");
      heroWrap.className = "be-ctl-hero-wrap";
      btn.classList.add("be-ctl-hero");
      heroWrap.appendChild(btn);
      tray.appendChild(heroWrap);
    } else {
      tray.appendChild(btn);
    }
  });

  // NOTE (AC-3, first_run_and_panel_20260911): the "Contribute" footer row was REMOVED from here and
  // moved to the extension's action-icon menu (js/background.js), where the funding destinations
  // already live, so the panel carries no fundraising row at all. The tray labelled HELP is gone
  // with it (see trayDefs below) rather than left as an empty header.

  // Properties Panel Container
  const propertiesPanel = document.createElement("div");
  propertiesPanel.id = "print-enhance-properties-panel";
  propertiesPanel.style.display = "flex";
  propertiesPanel.style.flexDirection = "column";
  propertiesPanel.style.gap = "8px";
  propertiesPanel.style.padding = "8px";
  propertiesPanel.style.borderTop = "1px solid #444";
  propertiesPanel.style.marginTop = "4px";
  propertiesPanel.style.backgroundColor = "var(--be-ground-well)";
  propertiesPanel.style.borderRadius = "4px";
  const propsBand = document.createElement("div");
  propsBand.className = "be-ctl-band";
  propsBand.id = "be-ctl-band-properties";
  propsBand.appendChild(makeCollapsibleHead("PROPERTIES", propsBand.id));
  propsBand.appendChild(propertiesPanel);
  scrollBody.appendChild(propsBand);

  // Filters Container
  const filtersContainer = document.createElement("div");
  filtersContainer.className = "be-filters-container";
  filtersContainer.style.display = "flex";
  filtersContainer.style.flexDirection = "column";
  filtersContainer.style.gap = "4px";
  filtersContainer.style.padding = "4px 8px";
  filtersContainer.style.borderTop = "1px solid #444";
  filtersContainer.style.marginTop = "4px";

  // Local state for filters to avoid async race conditions during slider movement
  let currentFilters = {
    hue: 0,
    contrast: 100,
    saturate: 100,
    greyscale: 0,
    sepia: 0,
  };

  /**
   * Helper to create a filter slider.
   */
  const createFilterSlider = (
    labelStr,
    key,
    min,
    max,
    unit,
    defaultValue,
    hideSlider = false,
  ) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.flexDirection = "column";
    row.style.gap = "2px";
    row.style.marginBottom = "4px";

    const labelRow = document.createElement("div");
    labelRow.style.display = "flex";
    labelRow.style.justifyContent = "space-between";
    labelRow.style.alignItems = "center";

    const label = document.createElement("label");
    label.textContent = `${labelStr}: ${defaultValue}${unit}`;
    label.style.color = "white";
    label.style.fontSize = "11px";
    label.style.fontWeight = "bold";
    labelRow.appendChild(label);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min.toString();
    slider.max = max.toString();
    slider.value = defaultValue.toString();
    slider.style.width = "100%";
    slider.style.cursor = "pointer";
    if (hideSlider) {
      slider.style.display = "none";
    }

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "↺";
    resetBtn.style.background = "none";
    resetBtn.style.border = "none";
    resetBtn.style.color = "#aaa";
    resetBtn.style.cursor = "pointer";
    resetBtn.style.fontSize = "12px";
    resetBtn.style.padding = "0";
    resetBtn.style.lineHeight = "1";
    resetBtn.title = `Reset ${labelStr}`;

    resetBtn.addEventListener("click", async () => {
      slider.value = defaultValue.toString();
      label.textContent = `${labelStr}: ${defaultValue}${unit}`;
      currentFilters[key] = defaultValue;
      if (typeof window.applyGlobalFilters === "function") {
        window.applyGlobalFilters(currentFilters);
      }
      if (window.Storage) {
        await window.Storage.saveFilter(key, defaultValue);
      }
    });
    labelRow.appendChild(resetBtn);
    row.appendChild(labelRow);

    slider.oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      label.textContent = `${labelStr}: ${val}${unit}`;

      // Update local state synchronously
      currentFilters[key] = val;

      // Apply filters immediately
      if (typeof window.applyGlobalFilters === "function") {
        window.applyGlobalFilters(currentFilters);
      }
    };

    slider.onchange = async (e) => {
      if (window.Storage) {
        await window.Storage.saveFilter(key, parseInt(e.target.value, 10));
      }
    };

    row.appendChild(slider);
    filtersContainer.appendChild(row);
    return { slider, label, row };
  };

  const sliders = {
    hue: createFilterSlider("🎨 Hue Shift", "hue", 0, 360, "°", 0, true),
    contrast: createFilterSlider("🌓 Contrast", "contrast", 0, 200, "%", 100),
    saturate: createFilterSlider("🌈 Saturate", "saturate", 0, 200, "%", 100),
    greyscale: createFilterSlider(
      "🌑 Greyscale",
      "greyscale",
      0,
      100,
      "%",
      100,
    ),
    sepia: createFilterSlider("📜 Sepia", "sepia", 0, 100, "%", 0),
  };

  // Color Picker Button & Floating Hue Picker
  const colorPickerBtn = document.createElement("button");
  colorPickerBtn.textContent = "🎨 Color Picker";
  colorPickerBtn.style.marginTop = "4px";
  colorPickerBtn.style.fontSize = "10px";
  colorPickerBtn.style.padding = "4px 8px";
  colorPickerBtn.style.width = "100%";
  colorPickerBtn.className = "be-modal-ok"; // Use consistent style
  sliders.hue.row.appendChild(colorPickerBtn);

  const huePicker = document.createElement("div");
  huePicker.style.position = "fixed";
  huePicker.style.zIndex = window.Z.PICKER; // AC-5 (was "20000")
  huePicker.style.setProperty("display", "none", "important"); // Hidden by default
  huePicker.style.flexDirection = "column";
  huePicker.style.gap = "8px";
  huePicker.style.padding = "8px";
  huePicker.style.backgroundColor = "var(--be-ground-well)";
  huePicker.style.border = "1px solid #444";
  huePicker.style.borderRadius = "4px";
  huePicker.style.boxShadow = "0 4px 20px rgba(0,0,0,0.6)";
  huePicker.style.width = "150px"; // 60 columns * 2px + padding
  document.body.appendChild(huePicker);
  const pickerTitle = document.createElement("div");
  pickerTitle.className = "be-color-picker-title";
  pickerTitle.textContent = "Tint";
  huePicker.insertBefore(pickerTitle, huePicker.firstChild);

  const gridContainer = document.createElement("div");
  gridContainer.style.display = "grid";
  gridContainer.style.gridTemplateColumns = "repeat(60, 2px)";
  gridContainer.style.gap = "0";
  gridContainer.style.cursor = "crosshair";
  gridContainer.style.border = "1px solid #333";
  huePicker.appendChild(gridContainer);

  let tempInitialHue = currentFilters.hue || 0;
  let tempInitialSaturate = currentFilters.saturate || 100;
  let tempInitialGreyscale = currentFilters.greyscale || 100;

  const revertPickerChanges = () => {
    currentFilters.hue = tempInitialHue;
    currentFilters.saturate = tempInitialSaturate;
    currentFilters.greyscale = tempInitialGreyscale;

    // Update UI
    sliders.hue.slider.value = tempInitialHue.toString();
    sliders.hue.label.textContent = `🎨 Hue Shift: ${tempInitialHue}°`;
    sliders.saturate.slider.value = tempInitialSaturate.toString();
    sliders.saturate.label.textContent = `🌈 Saturate: ${tempInitialSaturate}%`;
    sliders.greyscale.slider.value = tempInitialGreyscale.toString();
    sliders.greyscale.label.textContent = `🌑 Greyscale: ${tempInitialGreyscale}%`;

    if (typeof window.applyGlobalFilters === "function") {
      window.applyGlobalFilters(currentFilters);
    }
  };

  colorPickerBtn.onclick = (e) => {
    e.stopPropagation();
    const rect = colorPickerBtn.getBoundingClientRect();
    huePicker.style.top = `${rect.top - 160}px`; // Increased offset for new slider
    huePicker.style.left = `${rect.left}px`;

    const isHidden =
      huePicker.style.display === "none" ||
      huePicker.style.getPropertyValue("display") === "none";
    if (isHidden) {
      // Capture initial state before previewing
      tempInitialHue = currentFilters.hue || 0;
      tempInitialSaturate = currentFilters.saturate || 100;
      tempInitialGreyscale = currentFilters.greyscale || 100;
      huePicker.style.setProperty("display", "flex", "important");
    } else {
      revertPickerChanges();
      huePicker.style.setProperty("display", "none", "important");
    }
  };

  // Close picker when clicking outside
  document.addEventListener("click", (e) => {
    const isVisible =
      huePicker.style.display === "flex" ||
      huePicker.style.getPropertyValue("display") === "flex";
    if (
      isVisible &&
      !huePicker.contains(e.target) &&
      e.target !== colorPickerBtn
    ) {
      revertPickerChanges();
      huePicker.style.setProperty("display", "none", "important");
    }
  });

  let selectedHue = currentFilters.hue || 0;
  let selectedSaturate = currentFilters.saturate || 100;
  let selectedGreyscale = currentFilters.greyscale || 100;

  // Grayscale Slider inside picker
  const pickerGreyscaleContainer = document.createElement("div");
  pickerGreyscaleContainer.style.display = "flex";
  pickerGreyscaleContainer.style.flexDirection = "column";
  pickerGreyscaleContainer.style.gap = "2px";
  pickerGreyscaleContainer.style.marginBottom = "4px";

  const pickerGreyscaleLabel = document.createElement("label");
  pickerGreyscaleLabel.style.fontSize = "9px";
  pickerGreyscaleLabel.style.color = "#ccc";
  pickerGreyscaleLabel.textContent = `Greyscale: ${currentFilters.greyscale}%`;
  pickerGreyscaleContainer.appendChild(pickerGreyscaleLabel);

  const pickerGreyscaleSlider = document.createElement("input");
  pickerGreyscaleSlider.type = "range";
  pickerGreyscaleSlider.min = "0";
  pickerGreyscaleSlider.max = "100";
  pickerGreyscaleSlider.value = (currentFilters.greyscale || 100).toString();
  pickerGreyscaleSlider.style.width = "100%";
  pickerGreyscaleSlider.style.height = "12px";

  pickerGreyscaleSlider.oninput = (e) => {
    const val = parseInt(e.target.value, 10);
    selectedGreyscale = val;
    pickerGreyscaleLabel.textContent = `Greyscale: ${val}%`;

    // Preview immediately
    currentFilters.greyscale = val;
    sliders.greyscale.slider.value = val.toString();
    sliders.greyscale.label.textContent = `🌑 Greyscale: ${val}%`;

    if (typeof window.applyGlobalFilters === "function") {
      window.applyGlobalFilters(currentFilters);
    }
  };
  pickerGreyscaleContainer.appendChild(pickerGreyscaleSlider);
  huePicker.insertBefore(pickerGreyscaleContainer, gridContainer);

  // 600 swatches for a perfect 2D map (60 hues x 10 saturations)
  // Rows = Saturation (0% to 200%), Columns = Hue (0 to 360)
  const saturations = [0, 25, 50, 75, 100, 120, 140, 160, 180, 200];

  saturations.forEach((sat) => {
    for (let i = 0; i < 60; i++) {
      const deg = i * 6;
      const swatch = document.createElement("div");
      swatch.style.height = "8px";
      swatch.style.width = "2px";
      swatch.style.backgroundColor = "var(--be-ember)"; // Base red
      // Show Hue, Saturation and current Greyscale in the preview
      swatch.style.filter = `hue-rotate(${deg}deg) saturate(${sat}%) grayscale(${currentFilters.greyscale || 0}%)`;
      swatch.title = `Hue: ${deg}°, Sat: ${sat}%`;

      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedHue = deg;
        selectedSaturate = sat;

        // Preview Hue immediately
        sliders.hue.slider.value = deg.toString();
        sliders.hue.label.textContent = `🎨 Hue Shift: ${deg}°`;
        currentFilters.hue = deg;

        // Preview Saturation immediately
        sliders.saturate.slider.value = sat.toString();
        sliders.saturate.label.textContent = `🌈 Saturate: ${sat}%`;
        currentFilters.saturate = sat;

        if (typeof window.applyGlobalFilters === "function") {
          window.applyGlobalFilters(currentFilters);
        }
      });
      gridContainer.appendChild(swatch);
    }
  });

  const acceptBtn = document.createElement("button");
  acceptBtn.textContent = "Continue";
  acceptBtn.className = "be-modal-ok";
  acceptBtn.style.fontSize = "10px";
  acceptBtn.style.padding = "4px";
  acceptBtn.style.width = "100%";

  acceptBtn.onclick = async (e) => {
    e.stopPropagation();
    if (window.Storage) {
      await window.Storage.saveFilter("hue", selectedHue);
      await window.Storage.saveFilter("saturate", selectedSaturate);
      await window.Storage.saveFilter("greyscale", selectedGreyscale);
    }
    // Update the "initial" state to the newly accepted values
    tempInitialHue = selectedHue;
    tempInitialSaturate = selectedSaturate;
    tempInitialGreyscale = selectedGreyscale;
    huePicker.style.setProperty("display", "none", "important");
  };
  huePicker.appendChild(acceptBtn);

  // Global Reset Button (Excluding Hue)
  const resetAllBtn = document.createElement("button");
  // O-2: shortened so it cannot wrap in the tray; the full text is the tooltip.
  resetAllBtn.textContent = "Reset Filters";
  resetAllBtn.title = "Reset All Filters (excl. Hue)";
  resetAllBtn.className = "be-modal-ok"; // Reusing existing style
  resetAllBtn.style.marginTop = "8px";
  resetAllBtn.style.width = "100%";
  resetAllBtn.id = "be-reset-all-filters";

  resetAllBtn.addEventListener("click", async () => {
    try {
      const defaults = {
        contrast: 100,
        saturate: 100,
        greyscale: 100,
        sepia: 0,
      };

      for (const [key, defVal] of Object.entries(defaults)) {
        currentFilters[key] = defVal;
        const s = sliders[key];
        if (s) {
          s.slider.value = defVal.toString();
          const labelBase = s.label.textContent.split(":")[0];
          s.label.textContent = `${labelBase}: ${defVal}%`;
        }
      }

      if (typeof window.applyGlobalFilters === "function") {
        window.applyGlobalFilters(currentFilters);
      }

      // Save after UI update
      if (window.Storage) {
        for (const [key, defVal] of Object.entries(defaults)) {
          await window.Storage.saveFilter(key, defVal);
        }
      }
    } catch (err) {
      window.safeLog?.("error", `[DDB Print] Global Reset Error:`, err);
    }
  });

  filtersContainer.appendChild(resetAllBtn);

  window.PropertiesPanel.updatePropertiesPanel(propertiesPanel);

  // Load initial values
  if (window.Storage && typeof window.Storage.getFilters === "function") {
    window.Storage.getFilters().then((filters) => {
      currentFilters = filters; // Initialize local state
      Object.keys(sliders).forEach((key) => {
        const val = filters[key];
        const unit = key === "hue" ? "°" : "%";
        const labelBase = sliders[key].label.textContent.split(":")[0];

        sliders[key].slider.value = val;
        sliders[key].label.textContent = `${labelBase}: ${val}${unit}`;
      });

      if (typeof window.applyGlobalFilters === "function") {
        window.applyGlobalFilters(filters);
      }
    });
  }

  const filterBand = document.createElement("div");
  filterBand.className = "be-ctl-band";
  filterBand.id = "be-ctl-band-filters";
  filterBand.appendChild(makeCollapsibleHead("CANVAS FILTERS", filterBand.id));
  filterBand.appendChild(filtersContainer);
  scrollBody.appendChild(filterBand);

  window.safeLog?.("log", "[DDB Print] createControls: appending to body...");
  document.body.appendChild(container);

  // Verify visibility after a tiny delay
  setTimeout(() => {
    const el = document.getElementById("print-enhance-controls");
    if (el) {
      const style = window.getComputedStyle(el);
      window.safeLog?.(
        "log",
        `[DDB Print] Controls verified. Display: ${style.display}, Visibility: ${style.visibility}, Opacity: ${style.opacity}`,
      );
      if (style.display === "none") {
        window.safeLog?.("error", "[DDB Print] CRITICAL: Controls are HIDDEN by CSS!");
      }
    } else {
      window.safeLog?.(
        "error",
        "[DDB Print] CRITICAL: Controls container missing from DOM after append!",
      );
    }
  }, 500);

  // Inject print-only styles to hide controls
  if (!document.getElementById("ddb-print-controls-style")) {
    const style = document.createElement("style");
    style.id = "ddb-print-controls-style";
    style.textContent =
      "@media print { #print-enhance-controls, #print-enhance-overlay { display: none !important; } }";
    document.head.appendChild(style);
  }

  // Initialize Layer Management Panel
  window.DomManager.getInstance().getLayerManager();

  // AC-5 / U-28: the first-run discoverability hint (operator decision O-1 in
  // spec.md: a one-time dismissible card). Built here because createControls is
  // the control surface's single boot path, and it is idempotent.
  mountOnboardingHint();

  // AC-8: keep the Undo control's label in step with the stack. Driven by the event
  // `pushUndo` dispatches rather than by polling, and it also runs once at build time so
  // a boot with a non-empty stack (not possible today, session-scoped — O-2, but cheap to
  // be correct about) shows the right label immediately.
  function refreshUndoControl() {
    const btn = container.querySelector("#be-btn-undo");
    if (!btn) return;
    const label = typeof window.undoLabel === "function" ? window.undoLabel() : null;
    // `.be-ctl-label` is the span makeActionBtn renders the label into. A button with no
    // icon would render bare text, but this one HAS an icon, so the span is present.
    const full = label ? `Undo: ${label}` : null;
    const shown = typeof window.undoScreenLabel === "function"
      ? window.undoScreenLabel(full)
      : full;
    // The VISIBLE text must fit the panel without the control eating its own meaning
    // (AC-V1 round 1 measured exactly that: the subject was ellipsized away). The FULL
    // string always rides the tooltip and the accessible name.
    const span = btn.querySelector(".be-ctl-label");
    if (span) span.textContent = shown || "Undo";
    btn.disabled = !label;
    // AC-3 (ux_gaps_20260911): the two recovery models must be distinguishable
    // WHERE THE CONTROLS ARE. This one is session-scoped, and a user who does not
    // know that will look for their history after a reload and conclude it was lost.
    // The scope rides the tooltip and the accessible name (the visible label cannot
    // afford it — AC-V1 round 1 measured the panel ellipsizing this control at ~28
    // characters, which is why the scope is not appended to the label itself).
    const scope = " (this session only - see Restore backup for older ones)";
    // AC-2(b) (ux_gaps_20260911): name the KEYBOARD route where the control lives. Ctrl/Cmd+Z
    // has been bound since undo_stack_20260911 (`js/undo.js:255`) and was never announced to
    // the user anywhere — the only non-comment mention in the whole product was a log line.
    const key = " - Ctrl+Z / Cmd+Z";
    btn.setAttribute("aria-label", full ? full + key + scope : "Nothing to undo");
    btn.title = full ? full + key + scope : "Nothing to undo yet";
  }
  window.addEventListener("be-undo-stack-changed", refreshUndoControl);
  refreshUndoControl();

  // Ensure print styles (opacity overrides, manager hiding) are generated on initialization
  if (typeof window.updatePrintStyles === "function") {
    window.updatePrintStyles();
  }
}

/* ------------------------------------------------------------------------- *
 * First-run discoverability (AC-5, U-28) — the ratified O-1 affordance.
 *
 * Drag / resize / rotate are hover-only affordances: nothing on a freshly loaded
 * sheet says it is manipulable. The card states the three verbs once, is
 * dismissible, and the dismissal is REMEMBERED, so it never reappears on a later
 * boot. It is anchored to the bottom of the sheet area rather than the middle:
 * the content a user arranges first lives at the top, so the lower strip is the
 * least harmful place for a card that must not obscure the sheet.
 * ------------------------------------------------------------------------- */
const ONBOARDING_HINT_KEY = "beOnboardingHintDismissed";
/** The host-origin key used when the extension API is unavailable — see below. */
const ONBOARDING_HINT_LS_KEY = "ddbPrintEnhancer.onboardingHintDismissed";
/** Last resort so a dismissal still holds for the session. */
let onboardingHintDismissedInMemory = false;

/**
 * The preferred store. NOTE (measured in the phase-2 capture): the manifest does
 * NOT request the `storage` permission — PRIVACY_POLICY.md commits the extension
 * to "the minimum permissions necessary to function" — so `chrome.storage` is
 * UNDEFINED in a real content script. The first version of this feature relied on
 * it and its unit test passed only because the test STUBBED chrome.storage: the
 * hint then reappeared on every boot in the real product. The chain below is the
 * fix, and the test now covers the host-origin path that production actually
 * takes.
 */
function hintStore() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
  } catch {
    /* not an extension context */
  }
  return null;
}

/** The host page's localStorage: durable per origin, no extra permission. */
function hintLocalStorage() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) return localStorage;
  } catch {
    /* storage may be blocked by policy */
  }
  return null;
}

/**
 * Read the dismissal flag. An unreadable store reads as "not dismissed", i.e.
 * the hint shows, which is the safe direction for an onboarding affordance.
 */
function hintDismissed() {
  const store = hintStore();
  if (store && typeof store.get === "function") {
    try {
      const maybe = store.get(ONBOARDING_HINT_KEY);
      if (maybe && typeof maybe.then === "function") {
        return maybe.then((res) => !!(res && res[ONBOARDING_HINT_KEY]));
      }
      return new Promise((resolve) => {
        try {
          store.get(ONBOARDING_HINT_KEY, (res) =>
            resolve(!!(res && res[ONBOARDING_HINT_KEY])),
          );
        } catch {
          resolve(onboardingHintDismissedInMemory);
        }
      });
    } catch {
      /* fall through to the host-origin store */
    }
  }
  const ls = hintLocalStorage();
  if (ls) {
    try {
      return Promise.resolve(ls.getItem(ONBOARDING_HINT_LS_KEY) === "true");
    } catch {
      /* fall through */
    }
  }
  return Promise.resolve(onboardingHintDismissedInMemory);
}

function rememberHintDismissed() {
  onboardingHintDismissedInMemory = true;
  const store = hintStore();
  if (store && typeof store.set === "function") {
    try {
      const maybe = store.set({ [ONBOARDING_HINT_KEY]: true });
      if (maybe && typeof maybe.catch === "function") maybe.catch(() => {});
    } catch {
      /* a store that cannot persist must not break the dismissal itself */
    }
  }
  const ls = hintLocalStorage();
  if (ls) {
    try {
      ls.setItem(ONBOARDING_HINT_LS_KEY, "true");
    } catch {
      /* blocked storage: the in-memory flag still holds for this session */
    }
  }
}

/**
 * Mount the card unless it is already there or was dismissed in an earlier
 * session. Returns the element (or null) so tests and the capture harness can
 * assert on it.
 */
/**
 * AC-2 (ux_gaps_20260911): the gestures-and-shortcuts surface.
 *
 * WHY IT EXISTS. The first-run card teaches three gestures (drag, corner-resize, rotate) ONCE,
 * and never returns; the product documents 18 features in its README, where the user is not
 * looking. Measured before this was written: no help / shortcut / keymap surface existed
 * anywhere in js/, and the ONLY non-comment mention of `Ctrl/Cmd+Z` in the whole product was a
 * `safeLog` line the user never sees. So these were reachable only by accident:
 *   * double-click a block to EXTRACT it (js/main.js:762, js/section_cloning.js:116)
 *   * right-click a layer for its menu (js/context_menu.js:59)
 *   * Ctrl/Cmd+Z to undo (js/undo.js:255, bound and unannounced)
 *
 * It is built from the SHARED modal shell (`window.Modals.__createModal`), so Escape, the close
 * control, backdrop-dismiss, the dialog role/name, the focus trap and focus return all come for
 * free — a bespoke overlay here would be the exact defect the refactor track removed.
 *
 * The content is DATA (below), so a future gesture is one entry, and the AC-2 measurement can
 * assert that every entry is reachable from the product's own UI.
 */
const HELP_GESTURES = [
  { what: "Move a section", how: "Drag it", card: "Drag to move" },
  { what: "Resize a section", how: "Drag its corner", card: "drag a corner to resize" },
  {
    what: "Rotate a shape",
    how: "Use its rotation handle (15\u00B0 steps)",
    card: "use the handle to rotate",
  },
  { what: "Extract a block into its own card", how: "Double-click the block" },
  { what: "Open a layer's menu", how: "Right-click the layer" },
  { what: "Undo the last change", how: "Ctrl+Z / Cmd+Z, or the Undo control" },
  { what: "Select a section or shape", how: "Click it on the sheet, or its layer row" },
  { what: "Nudge a selected section", how: "Arrow keys (Shift for a 16px step)" },
];

/**
 * AC-1a (first_run_and_panel_20260911): the first-run card's sentence is DERIVED from
 * HELP_GESTURES, not written beside it.
 *
 * WHY IT IS DERIVED RATHER THAN TESTED-EQUAL. Before this, the card and the `?` surface were two
 * independent statements of the same subject: the card taught 3 gestures and the reference listed
 * 8, and five of the eight were taught nowhere at first contact — while the card's only control
 * deleted it forever. The cheap fix is a test that asserts the two lists agree; that detects drift
 * after it happens. Deriving the card's text from the same data the reference renders makes the
 * drift impossible to introduce at all: an entry with a `card` phrase IS one the card teaches, so
 * the relation `card ⊆ HELP_GESTURES` is structural.
 *
 * The test is still written (`test/unit/gesture_surface_convergence.test.js`) and still
 * FALSIFIABLE — it asserts the rendered text is EXACTLY this derivation, so hardcoding a phrase
 * back onto the card turns it red. A derivation nobody can contradict is worth less than a
 * derivation a test can contradict.
 */
function cardGesturePhrases() {
  return HELP_GESTURES.filter((g) => g.card).map((g) => g.card);
}

function cardHintText() {
  const phrases = cardGesturePhrases();
  if (phrases.length <= 1) return phrases.join("");
  return `${phrases.slice(0, -1).join(", ")}, or ${phrases[phrases.length - 1]}`;
}


function showHelpSurface() {
  const api = typeof window !== "undefined" ? window.Modals : null;
  if (!api || typeof api.__createModal !== "function") return null;
  const handle = api.__createModal({
    title: "Gestures & shortcuts",
    body(ctx) {
      const lead = document.createElement("p");
      lead.className = "be-help-lead";
      lead.textContent =
        "Everything below works on the sheet itself. Nothing here changes your " +
        "character - it only arranges how the printout looks.";
      ctx.bodyEl.appendChild(lead);

      const list = document.createElement("dl");
      list.className = "be-help-list";
      HELP_GESTURES.forEach((g) => {
        const dt = document.createElement("dt");
        dt.className = "be-help-what";
        dt.textContent = g.what;
        const dd = document.createElement("dd");
        dd.className = "be-help-how";
        dd.textContent = g.how;
        list.appendChild(dt);
        list.appendChild(dd);
      });
      ctx.bodyEl.appendChild(list);

      const undoNote = document.createElement("p");
      undoNote.className = "be-help-note";
      // The session-vs-reload distinction (AC-3) belongs here too: this is the surface a user
      // reaches when they are trying to work out where their history went.
      undoNote.textContent =
        "Undo covers the current session. For anything older, or to come back after a " +
        "reload, use \"Restore backup...\" in the panel - those copies are saved in this " +
        "browser.";
      ctx.bodyEl.appendChild(undoNote);

      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "be-modal-ok be-help-close";
      ok.textContent = "Got it";
      ctx.actionsRow.appendChild(ok);
      ok.addEventListener("click", () => handle.close(null));
      return null;
    },
  });
  return handle;
}

function mountOnboardingHint() {  if (typeof document === "undefined" || !document.body) return null;
  if (document.getElementById("be-onboarding-hint")) {
    return document.getElementById("be-onboarding-hint");
  }
  const existing = hintDismissed();
  const mount = (dismissed) => {
    if (dismissed || document.getElementById("be-onboarding-hint")) return null;
    const card = document.createElement("div");
    card.id = "be-onboarding-hint";
    card.className = "be-onboarding-hint";
    card.setAttribute("role", "note");
    // AC-1c (first_run_and_panel_20260911): this label used to read "How to arrange this sheet",
    // which claims to cover the sheet's gestures as a SET — while the card teaches three of the
    // eight the product ships. A note that overstates its own scope is worse than a narrow one,
    // because it tells a screen-reader user they have been given the whole picture.
    card.setAttribute("aria-label", "Three gestures to get started");

    const text = document.createElement("span");
    text.className = "be-onboarding-hint-text";
    // ASCII only, deliberately: the first version used a "·" separator and the
    // phase-2 browser capture showed it rendered as mojibake ("Â·") in the live
    // page, because the injected script's bytes were not decoded as UTF-8.
    //
    // AC-1a: DERIVED from HELP_GESTURES (cardHintText) rather than written here. The rendered
    // sentence is byte-identical to the literal it replaces; what changed is that it can no longer
    // disagree with the `?` surface, because it is built out of the same list.
    text.textContent = cardHintText();
    card.appendChild(text);

    // AC-1b (first_run_and_panel_20260911): the path to the reference. Before this, the card's
    // ONLY control was its permanent dismiss, so the product's single moment of instruction ended
    // by deleting itself and pointing nowhere — and the five gestures it does not name were
    // reachable only by accident. Reuses `showHelpSurface()` (same surface the panel's `?` opens),
    // so there is one reference dialog and not a second copy of it.
    const more = document.createElement("button");
    more.type = "button";
    more.className = "be-onboarding-hint-more";
    more.textContent = "?";
    more.title = "All gestures & keyboard shortcuts";
    more.setAttribute("aria-label", "All gestures and keyboard shortcuts");
    more.addEventListener("click", () => showHelpSurface());
    card.appendChild(more);

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "be-onboarding-hint-dismiss";
    dismiss.textContent = "Got it";
    dismiss.setAttribute("aria-label", "Dismiss this hint");
    dismiss.addEventListener("click", () => {
      rememberHintDismissed();
      card.remove();
    });
    card.appendChild(dismiss);

    // Placement is a MEASURED decision, twice corrected by the phase-2 visual
    // gate. Version 1 floated over the sheet's bottom strip and the reviewer's
    // pixels showed it covering sheet content the dismissed frame showed
    // unobstructed. Version 2 appended it to the control panel, where it landed
    // ON TOP of the panel's own absolutely-positioned children (the reviewer read
    // the covered "CANVAS FILTERS / Hue Shift" rows as sheet content). It is now
    // prepended to the panel's own SCROLLED body (`.be-ctl-scroll`), so it takes
    // its own space in the flow: nothing on the sheet and nothing in the panel is
    // covered, and the panel scrolls as it always did.
    const panel = document.getElementById("print-enhance-controls");
    const body = panel ? panel.querySelector(".be-ctl-scroll") : null;
    if (body) {
      body.insertBefore(card, body.firstChild);
    } else {
      (panel || document.body).appendChild(card);
    }
    return card;
  };
  if (existing && typeof existing.then === "function") return existing.then(mount);
  return mount(existing);
}

/**
 * AC-2 (first_run_and_panel_20260911): the browser-side print settings, as DATA.
 *
 * WHY THIS IS DATA AND NOT COPY INSIDE THE DIALOG. The README's "Instructions for use" step 4 told
 * the user to set six things by hand, and the product said none of them — so the one step that most
 * decides whether the printout is right was documented only where the user is not looking. The fix
 * is not a second list: two independent lists drift, which is the whole defect this track exists to
 * remove elsewhere (F-1). The dialog renders THESE arrays, and the suite asserts the README still
 * agrees with them, so the two cannot separate.
 *
 * WHICH SETTINGS ARE HERE, AND WHY — measured, never judged. Phase 2 rendered the live sheet
 * through Chromium's own print pipeline and compared each setting against a NULL render (the same
 * options twice) to establish a noise floor of **37,200 bytes**:
 *
 *   scale      1 vs 0.6      Δ 677,773 bytes   -> 18x the floor: the setting MATTERS  (keep)
 *   backgrounds off vs on    Δ 299,568 bytes   ->  8x the floor: the setting MATTERS  (keep)
 *   headers off vs on        Δ  12,685 bytes   -> BELOW the floor: UNRESOLVED         (keep)
 *   margins     0in vs 1in   Δ  36,980 bytes   -> indistinguishable from the 37,200-byte null
 *                              delta, 4 pages either way — while the CONTROL (the extension's
 *                              print CSS removed) went 10 pages -> 12 pages on the same change.
 *                              So the extension's `@page { margin: 0 }` OVERRIDES the dialog, and
 *                              AC-2(b) permits removing those instructions ON A MEASUREMENT.
 *
 * A setting whose effect could not be resolved is KEPT: AC-2(b) allows deletion only on a
 * measurement, and "I could not tell" is not one. Full record: `phase2_print_settings.md`.
 */
const PRINT_SETTINGS_REQUIRED = [
  { key: "color", setting: "Color", value: "Probably black and white" },
  { key: "scale", setting: "Scale", value: "Actual size" },
  { key: "headers", setting: "Headers and footers", value: "Deselect" },
  { key: "backgrounds", setting: "Background graphics", value: "Deselect" },
];

/** What the tool already does for the user — informational, and measured. */
const PRINT_SETTINGS_HANDLED = [
  {
    key: "margins",
    setting: "Margins",
    value: "You do not need to set these",
  },
  {
    key: "papersize",
    setting: "Paper size",
    value: "Letter, portrait",
  },
];

function showPrintSettingsSurface() {
  const api = typeof window !== "undefined" ? window.Modals : null;
  if (!api || typeof api.__createModal !== "function") return null;
  const handle = api.__createModal({
    title: "Print settings",
    body(ctx) {
      const lead = document.createElement("p");
      lead.className = "be-help-lead";
      // The action the user is about to take, stated first: this dialog exists to be read at the
      // moment of printing, so it opens by naming the dialog they need.
      lead.textContent =
        "In the print dialog, check these before you print. Your character sheet is " +
        "not changed by any of it.";
      ctx.bodyEl.appendChild(lead);

      const list = document.createElement("dl");
      list.className = "be-help-list be-print-list";
      PRINT_SETTINGS_REQUIRED.forEach((s) => {
        const dt = document.createElement("dt");
        dt.className = "be-help-what";
        dt.textContent = s.setting;
        const dd = document.createElement("dd");
        dd.className = "be-help-how";
        dd.textContent = s.value;
        list.appendChild(dt);
        list.appendChild(dd);
      });
      ctx.bodyEl.appendChild(list);

      // AC-2: the tool's own side of the ledger is stated, because "you do not need to set the
      // margins" is the kind of reassurance that stops a user from hunting for a setting that
      // provably does nothing (measured — see the arrays above).
      const note = document.createElement("p");
      note.className = "be-help-note";
      note.textContent = "Already handled for you: " + PRINT_SETTINGS_HANDLED
        .map((s) => `${s.setting} (${s.value.toLowerCase()})`).join(", ") + ".";
      ctx.bodyEl.appendChild(note);

      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "be-modal-ok be-print-settings-close";
      ok.textContent = "Got it";
      ctx.actionsRow.appendChild(ok);
      ok.addEventListener("click", () => handle.close(null));
      return null;
    },
  });
  return handle;
}

/**
 * AC-4 (first_run_and_panel_20260911): "turn the tool off for this page".
 *
 * WHAT "OFF" MEANS HERE, AND WHY IT IS A RELOAD. O-4 (ratified) chose a SESSION-SCOPED teardown,
 * re-activated by the toolbar icon. In this product that is a reload, and the reason is measured
 * rather than assumed — the injection is deeply invasive:
 *
 *   injected:    7 <style> elements (~107 KB of CSS), +4,058 DOM nodes, 102 ids
 *                (the layout root, two layers, and a wrapper per section)
 *   and it also: REMOVES 20 of the SITE's own nodes (its menus, theme, SVGs) as part of its clean
 *
 * So there is no in-place unwrap to perform: the extension wraps the sheet and moves every section
 * into its own wrapper, and it discards site nodes with no stored copy. Restoring them node by node
 * would mean keeping a full pre-injection snapshot of a React page and replaying it, which would
 * break the host's own state as surely as it "restored" it. A reload gives a page that carries
 * NONE of the extension — verified in Phase 1's reload test (`panel: false`) and in Phase 4's
 * browser case, which asserts zero of those seven stylesheets survive.
 *
 * WHAT THE USER IS TOLD, AND WHAT IS PROTECTED FIRST. The dialog names the consequence before it
 * happens and the handler SAVES the arrangement before reloading, so "turn it off" cannot cost the
 * user their work. AC-4's fail condition — "deactivating leaves extension-injected DOM or styles
 * behind" — is a browser assertion in `turn_off_verify.spec.js`, not a promise in this comment.
 */
function showTurnOffSurface() {
  const api = typeof window !== "undefined" ? window.Modals : null;
  if (!api || typeof api.__createModal !== "function") return null;
  const handle = api.__createModal({
    title: "Turn off for this page",
    body(ctx) {
      const lead = document.createElement("p");
      lead.className = "be-help-lead";
      lead.textContent =
        "This removes the print enhancer from this page by reloading it. Your layout is " +
        "saved first, so nothing you have arranged is lost.";
      ctx.bodyEl.appendChild(lead);

      const note = document.createElement("p");
      note.className = "be-help-note";
      // The state half of AC-4, said where the user is deciding: the toolbar icon is how they turn
      // it back on, and how they can tell. Nothing on the icon said either thing before this phase.
      note.textContent =
        "To bring it back, click the extension's icon in your browser toolbar. That icon " +
        "shows when the tool is on.";
      ctx.bodyEl.appendChild(note);

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "be-modal-cancel";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => handle.close(null));
      ctx.actionsRow.appendChild(cancel);

      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "be-modal-ok";
      ok.id = "be-turn-off-confirm";
      ok.textContent = "Turn off";
      ok.addEventListener("click", async () => {
        handle.close(null);
        // SAVE FIRST, and tolerate a failed save: the user asked to turn the tool off, so refusing
        // to do it because a save failed would trap them in the tool. The auto-save that already
        // runs on every change means the common case has nothing pending anyway.
        try {
          if (typeof window.handleSaveBrowser === "function") await window.handleSaveBrowser();
        } catch (err) {
          window.safeLog?.("error", "[DDB Print] Turn-off save failed", err);
        }
        // Tell the extension's own service worker, so the toolbar badge stops claiming the tool is
        // on for this tab (AC-4's state half). Best-effort and fenced: a page with no extension
        // runtime must still turn off.
        try {
          window.chrome?.runtime?.sendMessage?.({ type: "DDB_TURNED_OFF" });
        } catch {
          /* no runtime, or the worker is asleep: the reload is still the deactivation */
        }
        window.location.reload();
      });
      ctx.actionsRow.appendChild(ok);
      return null;
    },
  });
  return handle;
}

const Controls = {
  createControls,
  mountOnboardingHint,
  hintDismissed,
  showHelpSurface,
  showPrintSettingsSurface,
  showTurnOffSurface,
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = Controls;
}
if (typeof window !== "undefined") {
  window.Controls = Controls;
  // AC-2 (ux_gaps_20260911): the reference surface is reachable as its own seam, so the panel
  // button, a keyboard path, and a suite can all open the SAME dialog rather than a copy of it.
  window.showHelpSurface = showHelpSurface;
  // Test seam (track ux_gaps_20260911, AC-2): the gesture list is the product's own statement of
  // what a user can do, and the AC-2 measurement asserts that every entry is reachable from the
  // product's UI. Exposing it is what lets that assertion read the SHIPPED list instead of a
  // re-typed copy that could drift from the panel.
  window.HELP_GESTURES = HELP_GESTURES;
  // AC-1a (first_run_and_panel_20260911): the DERIVATION itself is exposed, so the convergence
  // test can compare the card's rendered text against what the shipped list says it should be.
  // Without this the test would have to re-implement the join and would then be checking its own
  // arithmetic rather than the product's.
  window.cardHintText = cardHintText;
  window.cardGesturePhrases = cardGesturePhrases;
  // AC-2 (first_run_and_panel_20260911): the settings surface is reachable as its own seam, so the
  // panel control and a suite open the SAME dialog rather than a copy of it (the same reason
  // showHelpSurface is a seam).
  window.showPrintSettingsSurface = showPrintSettingsSurface;
  // Test seam: the CHECKLIST and the tool-handled list are exposed so the AC-2 suite can assert the
  // README still agrees with what the dialog renders, instead of re-typing either side — two
  // independent lists that drift is the exact defect AC-2 forbids.
  window.PRINT_SETTINGS_REQUIRED = PRINT_SETTINGS_REQUIRED;
  window.PRINT_SETTINGS_HANDLED = PRINT_SETTINGS_HANDLED;
  // AC-4 (first_run_and_panel_20260911): the turn-off surface as its own seam, so the panel control
  // and a suite open the SAME dialog.
  window.showTurnOffSurface = showTurnOffSurface;
}
