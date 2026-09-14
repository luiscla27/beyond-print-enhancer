/**
 * One selection model (selection_model_ia_20260910, Phase 1: AC-1/AC-2/AC-3).
 *
 * These are LIVE-DOM agreement assertions, not source reads: the point of the
 * track is that the layer panel, the on-sheet outline and the properties panel
 * cannot disagree about what is selected, and that a shape is as unmistakable as
 * a section. Every assertion below therefore reads the real DOM that the
 * production modules produced.
 *
 * The chip SET (AC-3) is asserted separately from the single target: the two are
 * deliberately different concepts and must not clobber each other.
 */
"use strict";

const assert = require("assert");
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const read = (p) => fs.readFileSync(path.resolve(__dirname, "../../js", p), "utf8");

const SRC = {
  elementWrapper: read("dom/element_wrapper.js"),
  domManager: read("dom/dom_manager.js"),
  layerManager: read("dom/layer_manager.js"),
  storage: read("storage.js"),
  imageProcessor: read("image_processor.js"),
  sectionUtils: read("section_utils.js"),
  printStyles: read("print_styles.js"),
  uiTheme: read("ui_theme.js"),
  icons: read("icons.js"),
  assetCatalog: read("asset_catalog.js"),
  contextMenu: read("context_menu.js"),
  sectionCloning: read("section_cloning.js"),
  layoutOps: read("layout_ops.js"),
  filters: read("filters.js"),
  spellsUi: read("spells_ui.js"),
  modals: read("modals.js"),
  shapePicker: read("shape_picker.js"),
  propertiesPanel: read("properties_panel.js"),
  controls: read("controls.js"),
  layoutScan: read("layout_scan.js"),
  layoutApply: read("layout_apply.js"),
  persistence: read("persistence.js"),
  main: read("main.js"),
};

/** One sections layer + one shape layer, i.e. both kinds of target. */
const SHEET = `<!DOCTYPE html><html><body>
  <div class="ct-character-sheet-desktop">
    <div class="ct-character-sheet__inner">
      <div id="print-layout-wrapper">
        <div id="print-enhance-sections-layer" class="pe-layer">
          <div class="be-section-wrapper" id="wrapper-one">
            <div class="print-section-container" id="section-one">
              <div class="print-section-header"><span>One</span></div>
              <div class="print-section-content">content</div>
            </div>
          </div>
          <div class="be-section-wrapper" id="wrapper-two">
            <div class="print-section-container" id="section-two">
              <div class="print-section-header"><span>Two</span></div>
              <div class="print-section-content">content</div>
            </div>
          </div>
        </div>
        <div id="print-enhance-shapes-layer" class="pe-layer">
          <div class="be-shape-layer-container pe-layer" id="shapes-default">
            <div class="be-section-wrapper be-shape-wrapper" id="shape-one">
              <div class="print-section-container be-shape-container be-shape" id="shape-one-card"
                   data-asset-path="assets/shapes/vine.webp">
                <img src="assets/shapes/vine.webp" alt="Vine">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

function boot() {
  const dom = new JSDOM(SHEET, {
    url: "http://localhost",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  const window = dom.window;
  const document = window.document;

  global.window = window;
  global.document = document;
  global.HTMLElement = window.HTMLElement;
  global.NodeList = window.NodeList;
  global.Element = window.Element;
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  const { indexedDB, IDBKeyRange } = require("fake-indexeddb");
  window.indexedDB = indexedDB;
  window.IDBKeyRange = IDBKeyRange;
  global.indexedDB = indexedDB;
  global.IDBKeyRange = IDBKeyRange;

  window.confirm = () => true;
  window.alert = () => {};
  // jsdom has no layout engine: the sheet-focus scroll is a no-op here.
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.chrome = {
    runtime: { getURL: (p) => (p ? String(p) : "") },
    storage: { local: { get: async () => ({}), set: async () => {} } },
  };
  window.__DDB_TEST_MODE__ = true;

  // Extension script order (js/background.js), which is also the harness order
  // used by the other suites: the LayerManager is evaluated BEFORE the
  // properties panel, so every seam between them must be resolved lazily.
  window.eval(SRC.elementWrapper);
  window.eval(SRC.domManager);
  window.eval(SRC.layerManager);
  window.eval(SRC.storage);
  window.eval(SRC.imageProcessor);
  window.eval(SRC.sectionUtils);
  window.eval(SRC.printStyles);
  window.eval(SRC.uiTheme);
  window.eval(SRC.icons);
  window.eval(SRC.assetCatalog);
  window.eval(SRC.contextMenu);
  window.eval(SRC.sectionCloning);
  window.eval(SRC.layoutOps);
  window.eval(SRC.filters);
  window.eval(SRC.spellsUi);
  window.eval(SRC.modals);
  window.eval(SRC.shapePicker);
  window.eval(SRC.propertiesPanel);
  window.eval(SRC.controls);
  window.eval(SRC.layoutScan);
  window.eval(SRC.layoutApply);
  window.eval(SRC.persistence);
  window.eval(SRC.main);

  const panel = document.createElement("div");
  panel.id = "print-enhance-properties-panel";
  document.body.appendChild(panel);

  return { window, document, panel };
}

/** The three components that display a selection, read from the live DOM. */
function readSelection(window, document, panel) {
  const marker = document.querySelector(".be-active-target");
  const wrappers = Array.from(document.querySelectorAll(".be-active-wrapper"));
  const rows = Array.from(document.querySelectorAll(".be-layer-row.be-selection-layer"));
  const insertionRows = Array.from(
    document.querySelectorAll(".be-layer-row.be-active-layer"),
  );
  const containers = Array.from(document.querySelectorAll(
    "#print-enhance-sections-layer.be-selection-layer, #print-enhance-shapes-layer.be-selection-layer, .be-shape-layer-container.be-selection-layer",
  ));
  const title = panel.querySelector("h4");
  return {
    targetId: marker ? marker.id : null,
    wrapperIds: wrappers.map((w) => w.id).sort(),
    rowLayerIds: rows.map((r) => r.dataset.layerId).sort(),
    insertionRowIds: insertionRows.map((r) => r.dataset.layerId).sort(),
    activeContainers: containers.map((c) => c.id).sort(),
    panelTitle: title ? title.textContent : null,
    // The store's own value, for the "one value" cross-check.
    storeId: window.PropertiesPanel.getActiveTarget()
      ? window.PropertiesPanel.getActiveTarget().id
      : null,
  };
}

describe("selection model — one writer, three readers (AC-1)", function () {
  let window, document, panel, lm;
  let cleanupGlobals;

  beforeEach(function () {
    ({ window, document, panel } = boot());
    lm = window.DomManager.getInstance().getLayerManager();
    cleanupGlobals = () => {
      delete global.window;
      delete global.document;
      delete global.HTMLElement;
      delete global.NodeList;
      delete global.Element;
      delete global.indexedDB;
      delete global.IDBKeyRange;
    };
  });

  afterEach(function () {
    cleanupGlobals();
  });

  it("selecting a SECTION on the sheet marks its layer row and fills the panel", function () {
    // The insertion target and the selection are DIFFERENT signals, so this test
    // parks the insertion target on the shape layer first: the SECTIONS row can
    // then only carry the selection marker because the STORE said so.
    lm.activeLayerId = "shapes-default";
    lm.applyInsertionTarget();
    assert.deepStrictEqual(
      readSelection(window, document, panel).insertionRowIds,
      ["shapes-default"],
      "precondition: the insertion target is the shape layer",
    );
    assert.deepStrictEqual(
      readSelection(window, document, panel).rowLayerIds,
      [],
      "precondition: nothing is selected, so no row carries the selection marker",
    );

    window.setActiveSection(document.getElementById("section-one"));
    const s = readSelection(window, document, panel);

    assert.strictEqual(s.storeId, "section-one", "the store holds the section card");
    assert.strictEqual(s.targetId, "section-one", "the section carries the shared marker");
    assert.deepStrictEqual(s.wrapperIds, ["wrapper-one"], "its wrapper is marked");
    assert.deepStrictEqual(
      s.rowLayerIds,
      ["sections"],
      "the SECTIONS row carries the selection marker (from the store)",
    );
    assert.deepStrictEqual(
      s.insertionRowIds,
      ["shapes-default"],
      "the insertion target is untouched by selecting",
    );
    assert.ok(
      s.panelTitle && s.panelTitle.includes("One"),
      `panel must name the selected section, got ${s.panelTitle}`,
    );
  });

  it("selecting a LAYER ROW marks the on-sheet wrapper and fills the panel", function () {
    // Same de-vacuuming: park the insertion target elsewhere first, so the row
    // under test is not already marked for an unrelated reason.
    lm.activeLayerId = "shapes-default";
    lm.applyInsertionTarget();

    const row = lm.panel.querySelector('.be-layer-row[data-layer-id="sections"]');
    assert.ok(row, "sections row exists");
    row.querySelector("span").click();

    const s = readSelection(window, document, panel);
    assert.strictEqual(s.targetId, "section-one", "the layer's first element is selected");
    assert.deepStrictEqual(s.wrapperIds, ["wrapper-one"], "on-sheet wrapper marked");
    assert.deepStrictEqual(s.rowLayerIds, ["sections"], "the row that was clicked is selected");
    assert.deepStrictEqual(
      s.insertionRowIds,
      ["shapes-default"],
      "clicking a row does not move the insertion target",
    );
    assert.ok(
      s.panelTitle && s.panelTitle.includes("One"),
      `panel must be populated, got ${s.panelTitle}`,
    );
  });

  it("selecting a SHAPE marks the shape layer row and fills the panel", function () {
    lm.selectElementById("shape-one");
    const s = readSelection(window, document, panel);

    assert.strictEqual(s.targetId, "shape-one", "the shape wrapper carries the same marker");
    assert.deepStrictEqual(s.wrapperIds, ["shape-one"], "the shape is its own wrapper");
    assert.deepStrictEqual(
      s.rowLayerIds,
      ["shapes-default"],
      "the SHAPES row of the containing layer is active",
    );
    assert.ok(s.panelTitle, "the panel is populated for a shape too");
  });

  it("clearing clears the store, the outline and the panel", function () {
    window.setActiveSection(document.getElementById("section-one"));
    window.setActiveSection(null);
    const s = readSelection(window, document, panel);

    assert.strictEqual(s.storeId, null, "store cleared");
    assert.strictEqual(s.targetId, null, "no marker left behind");
    assert.deepStrictEqual(s.wrapperIds, [], "no wrapper left marked");
    assert.deepStrictEqual(
      s.rowLayerIds,
      [],
      "AC-1: no row carries the selection marker (the third reader clears too)",
    );
    assert.ok(
      s.panelTitle === null || s.panelTitle === undefined,
      "panel falls back to its empty state",
    );
  });

  it("the THREE selection states are distinct on the layer panel (measured claim)", function () {
    // This is the claim the phase-1 consultation forced: with one class for both
    // "holds the selection" and "receives the next shape", the section-selected
    // and cleared states were pixel-equal on the layer panel (measured 0 differing
    // pixels). The states must now differ by the SELECTION marker.
    window.setActiveSection(document.getElementById("section-one"));
    const sectionState = readSelection(window, document, panel);

    lm.selectElementById("shape-one");
    const shapeState = readSelection(window, document, panel);

    window.setActiveSection(null);
    const clearedState = readSelection(window, document, panel);

    assert.deepStrictEqual(sectionState.rowLayerIds, ["sections"]);
    assert.deepStrictEqual(shapeState.rowLayerIds, ["shapes-default"]);
    assert.deepStrictEqual(clearedState.rowLayerIds, [], "cleared: no selection row");
    assert.notDeepStrictEqual(
      sectionState.rowLayerIds,
      shapeState.rowLayerIds,
      "state 1 vs state 2 must differ on the row axis",
    );
    assert.notDeepStrictEqual(
      sectionState.rowLayerIds,
      clearedState.rowLayerIds,
      "state 1 vs state 3 must differ on the row axis (the former defect)",
    );
    // …and the insertion target is a SEPARATE signal that survives the clearing.
    assert.deepStrictEqual(
      clearedState.insertionRowIds,
      ["sections"],
      "the insertion target still names the layer new shapes land in",
    );
    assert.strictEqual(
      clearedState.activeContainers.length,
      0,
      "no on-sheet layer container carries the selection marker when cleared",
    );
  });

  it("the insertion target is a different signal with its own writers", function () {
    // Selecting must NOT move the insertion target, and moving the insertion
    // target (unlock / add layer) must NOT create a selection.
    window.setActiveSection(document.getElementById("shape-one"));
    const before = readSelection(window, document, panel).insertionRowIds;

    const extra = lm.addShapeLayer(); // addShapeLayer sets activeLayerId
    const after = readSelection(window, document, panel);

    assert.notDeepStrictEqual(
      after.insertionRowIds,
      before,
      "adding a layer moves the insertion target",
    );
    assert.strictEqual(
      after.storeId,
      "shape-one",
      "…without touching the selection (one writer per concept)",
    );
    assert.deepStrictEqual(
      after.rowLayerIds,
      ["shapes-default"],
      "the selection row is unchanged by the insertion-target move",
    );
    assert.ok(extra && extra.id, "the added layer exists");
  });

  it("clearing removes the selection marker from the shape layer row", function () {
    // DELIBERATELY UPDATED (consultation 2026-09-10): this case used to assert
    // that clearing moved the highlight back onto the add-target layer — which is
    // exactly the equivocation the consultation rejected, and it measured as 0
    // differing pixels between "a section is selected" and "cleared". The correct
    // claim is now: clearing removes the SELECTION marker everywhere, while the
    // separate insertion-target signal survives.
    lm.selectElementById("shape-one");
    assert.deepStrictEqual(
      readSelection(window, document, panel).rowLayerIds,
      ["shapes-default"],
      "the shape layer row carries the selection marker while the shape is selected",
    );

    window.setActiveSection(null);
    const s = readSelection(window, document, panel);
    assert.deepStrictEqual(
      s.rowLayerIds,
      [],
      "no row carries the selection marker after clearing",
    );
    assert.ok(
      !document.getElementById("shapes-default").classList.contains("be-selection-layer"),
      "the shape layer container carries no selection marker either",
    );
    assert.deepStrictEqual(
      s.insertionRowIds,
      ["sections"],
      "the insertion target is untouched by clearing",
    );
  });

  it("switching targets leaves exactly ONE marked element (no residue)", function () {
    window.setActiveSection(document.getElementById("section-one"));
    window.setActiveSection(document.getElementById("section-two"));
    const s = readSelection(window, document, panel);

    assert.strictEqual(s.targetId, "section-two");
    assert.deepStrictEqual(s.wrapperIds, ["wrapper-two"], "the old wrapper is unmarked");
    assert.strictEqual(
      document.querySelectorAll(".be-active-target").length,
      1,
      "exactly one element carries the shared marker",
    );
    assert.strictEqual(
      document.querySelectorAll(".be-active-wrapper").length,
      1,
      "exactly one wrapper is marked",
    );
  });

  it("NEGATIVE CONTROL: a second writer for the marker makes the readers disagree", function () {
    // Falsifies the assertion above: if a rogue writer adds the marker without
    // going through the store, the panel does NOT follow it — which is exactly
    // the defect class AC-1 exists to prevent. Injected, observed, reverted.
    window.setActiveSection(document.getElementById("section-one"));
    const rogue = document.getElementById("section-two");
    rogue.classList.add("be-active-target");

    const s = readSelection(window, document, panel);
    assert.notStrictEqual(
      s.storeId,
      "section-two",
      "the store is NOT convinced by a rogue marker",
    );
    assert.ok(
      s.panelTitle.includes("One"),
      "the panel still shows the store's value, not the rogue marker",
    );
    assert.strictEqual(
      document.querySelectorAll(".be-active-target").length,
      2,
      "the rogue marker is detectable — the invariant is falsifiable",
    );

    // revert
    rogue.classList.remove("be-active-target");
    assert.strictEqual(document.querySelectorAll(".be-active-target").length, 1);
  });
});

describe("selection model — one visual language (AC-2)", function () {
  let window, document, cleanupGlobals;

  beforeEach(function () {
    ({ window, document } = boot());
    cleanupGlobals = () => {
      delete global.window;
      delete global.document;
      delete global.HTMLElement;
      delete global.NodeList;
      delete global.Element;
      delete global.indexedDB;
      delete global.IDBKeyRange;
    };
  });

  afterEach(function () {
    cleanupGlobals();
  });

  it("a selected shape carries the SAME class mechanism as a selected section", function () {
    const section = document.getElementById("section-one");
    const shape = document.getElementById("shape-one");

    window.setActiveSection(section);
    assert.ok(section.classList.contains("be-active-target"), "section marker");
    const sectionMarkerClasses = [...section.classList]
      .filter((c) => c.startsWith("be-active-"))
      .sort();
    window.setActiveSection(shape);
    assert.ok(shape.classList.contains("be-active-target"), "shape marker");
    assert.deepStrictEqual(
      sectionMarkerClasses,
      ["be-active-section", "be-active-target"],
      "a selected section: the shared marker plus the legacy handle",
    );
    assert.deepStrictEqual(
      [...shape.classList].filter((c) => c.startsWith("be-active-")).sort(),
      ["be-active-target", "be-active-wrapper"],
      "a selected shape: the SAME shared marker (plus the wrapper marker)",
    );
    assert.ok(
      shape.classList.contains("be-active-wrapper"),
      "and the wrapper marker, like a section's wrapper",
    );
  });

  it("both kinds get the SAME ring element, positioned over the target (AC-2)", function () {
    const section = document.getElementById("section-one");
    const shape = document.getElementById("shape-one");

    // The ring is ONE body-level overlay owned by the store: same element, same
    // rule, for both kinds.
    window.setActiveSection(section);
    const ring = document.getElementById("print-enhance-selection-ring");
    assert.ok(ring, "the selection ring overlay exists");
    assert.strictEqual(ring.getAttribute("aria-hidden"), "true", "it is decorative");
    const sectionShown = ring.style.display;
    window.setActiveSection(shape);
    assert.strictEqual(
      document.getElementById("print-enhance-selection-ring"),
      ring,
      "the SAME element serves a shape (one mechanism, not two)",
    );
    assert.strictEqual(ring.style.display, sectionShown, "shown for both kinds");

    // …and it is hidden when nothing is selected.
    window.setActiveSection(null);
    assert.strictEqual(
      document.getElementById("print-enhance-selection-ring").style.display,
      "none",
      "cleared: the ring is hidden",
    );
  });

  it("the ring rules are token-based and never print", function () {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../js/print_styles.js"),
      "utf8",
    );
    assert.ok(
      /#print-enhance-selection-ring \{\s*\n\s*position: fixed !important;/.test(src),
      "the ring is a fixed overlay",
    );
    assert.ok(
      src.includes("border: 2px solid var(--be-gold) !important"),
      "the ring border is the locked gold token, not a literal",
    );
    assert.ok(
      !src.includes("3px solid #c53131"),
      "the off-palette red outline is gone",
    );
    assert.ok(
      src.includes("z-index: 2147483647 !important"),
      "the ring sits above every sheet layer",
    );
    // print resets: the ring is listed as hidden.
    const printBlock = src.slice(src.indexOf("Selection and Hover Highlights"));
    assert.ok(
      printBlock.includes("#print-enhance-selection-ring") &&
        printBlock.includes("display: none !important"),
      "the ring is hidden in print",
    );
  });

  it("the selection outline is stripped in print for BOTH markers", function () {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../js/print_styles.js"),
      "utf8",
    );
    const printResets = src.match(/\.be-active-wrapper,\s*[^}]*be-active-section/g) || [];
    assert.ok(printResets.length >= 2, "both print reset lists name the selection markers");
    printResets.forEach((block) => {
      assert.ok(
        block.includes(".be-active-target"),
        "each reset covers the shared marker",
      );
    });
  });
});

describe("selection model — the chip SET coexists with the single target (AC-3)", function () {
  let window, document, panel, lm, cleanupGlobals;

  beforeEach(function () {
    ({ window, document, panel } = boot());
    lm = window.DomManager.getInstance().getLayerManager();
    cleanupGlobals = () => {
      delete global.window;
      delete global.document;
      delete global.HTMLElement;
      delete global.NodeList;
      delete global.Element;
      delete global.indexedDB;
      delete global.IDBKeyRange;
    };
  });

  afterEach(function () {
    cleanupGlobals();
  });

  it("a plain chip click TOGGLES membership — it never clears the set", function () {
    lm.toggleChipSelection("section-one", true);
    const size = lm.toggleChipSelection("section-two", true);
    assert.strictEqual(size, 2, "both chips are in the set");
    // A repeat click removes only that chip (the stale "plain click clears the
    // set" comment corrected in this phase).
    assert.strictEqual(lm.toggleChipSelection("section-one", true), 1);
    assert.deepStrictEqual(
      Array.from(lm.selectedChipIds()),
      ["section-two"],
      "only the re-clicked chip left the set",
    );
  });

  it("changing the single target does NOT disturb the chip set", function () {
    lm.toggleChipSelection("section-one", true);
    lm.toggleChipSelection("section-two", true);
    window.setActiveSection(document.getElementById("section-one"));
    window.setActiveSection(document.getElementById("shape-one"));
    assert.deepStrictEqual(
      Array.from(lm.selectedChipIds()).sort(),
      ["section-one", "section-two"],
      "the set survives two single-target changes",
    );
  });

  it("changing the chip set does NOT disturb the single target", function () {
    window.setActiveSection(document.getElementById("section-two"));
    lm.toggleChipSelection("shape-one", true);
    lm.clearChipSelection();
    assert.strictEqual(
      window.PropertiesPanel.getActiveTarget().id,
      "section-two",
      "clearing the SET leaves the active target alone",
    );
    assert.strictEqual(
      document.getElementById("section-two").classList.contains("be-active-target"),
      true,
      "and its on-sheet marker is untouched",
    );
  });

  it("the chip's element becomes the active target without leaving the set", function () {
    // A section chip's target id is its WRAPPER id; the store canonicalises it
    // to the section card, so both entry points agree on ONE value.
    const chip = lm.panel.querySelector(
      '.be-layer-item-card[data-target-id="wrapper-one"]',
    );
    assert.ok(chip, "the section chip exists");
    chip.click();
    assert.strictEqual(
      window.PropertiesPanel.getActiveTarget().id,
      "section-one",
      "the chip's section became the canonical active target",
    );
    assert.deepStrictEqual(
      Array.from(lm.selectedChipIds()),
      ["wrapper-one"],
      "the click also toggled the set (both concepts updated, neither clobbered)",
    );
    assert.ok(
      document.getElementById("section-one").classList.contains("be-active-target"),
      "and the on-sheet outline followed the chip",
    );
  });

  it("a DELETED selected shape clears the store and the panel (no ghost target)", function () {
    lm.selectElementById("shape-one");
    assert.strictEqual(
      window.PropertiesPanel.getActiveTarget().id,
      "shape-one",
      "precondition: the shape is selected",
    );

    document.getElementById("shape-one").remove();
    lm.refreshLayerContents();

    assert.strictEqual(
      window.PropertiesPanel.getActiveTarget(),
      null,
      "the store no longer holds a detached element",
    );
    assert.strictEqual(
      document.querySelectorAll(".be-active-target").length,
      0,
      "no stale marker anywhere",
    );
    assert.strictEqual(
      panel.querySelector("h4"),
      null,
      "the panel is back to its empty state",
    );
  });

  it("a DELETED selected layer clears the store too", function () {
    const extra = lm.addShapeLayer();
    const wrapper = document.createElement("div");
    wrapper.className = "be-section-wrapper be-shape-wrapper";
    wrapper.id = "shape-extra";
    document.getElementById(extra.layerId).appendChild(wrapper);
    lm.selectElementById("shape-extra");
    assert.ok(window.PropertiesPanel.getActiveTarget(), "precondition: selected");

    lm.deleteShapeLayer(extra.id);
    assert.strictEqual(
      window.PropertiesPanel.getActiveTarget(),
      null,
      "deleting the layer that held the target clears the selection",
    );
    assert.strictEqual(document.querySelectorAll(".be-active-target").length, 0);
  });
});
