/**
 * E4-A — Encapsulation-debt regression suite (2026-02-20..23).
 *   5ba0e0e New borders (#15)
 *   3598bd2 Ornaments (#16)
 *   e57b53b Shapes (#17)
 *   f59b383 feat(dom): shape container selector
 *   8e9eabe feat(z-index): z-index mgmt for shapes
 *   9df5cb2 feat(ui): showShapePickerModal
 *   291d5ea feat(ui): 'Add Shape' button
 */
"use strict";

const assert = require("assert");
const { boot } = require("./debt_harness.js");

function bootRooted() {
  return boot(
    "<!DOCTYPE html><html><body><div id='print-layout-wrapper'></div></body></html>",
  );
}

function stubLm(window, document, extra = {}) {
  window.PeDom = () => ({
    getLayerManager: () =>
      Object.assign(
        {
          activeLayerId: "shapes-default",
          refreshUI: () => {},
          getActiveLayerContainer: () => ({ element: document.body }),
        },
        extra,
      ),
  });
}

/* ------------------------------------------------------------------ */
/* 5ba0e0e — New borders (#15)                                         */
/* ------------------------------------------------------------------ */
describe("E4 5ba0e0e — border style picker basics", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = boot("<!DOCTYPE html><html><body></body></html>");
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("opens a modal titled 'Select Section Border'", async function () {
    // border_shape_picker_ux_20260909 B-1: the legacy entry point was
    // merged into the unified picker's style mode (same observable surface).
    const p = window.showAssetPickerModal({ mode: "style" });
    p.catch(() => {});
    await new Promise((r) => setTimeout(r, 60));
    const h3 = Array.from(document.querySelectorAll("h3")).find(
      (h) => h.textContent === "Select Section Border",
    );
    assert.ok(h3, "picker heading should exist");
  });

  it("preselects the current style option", async function () {
    const p = window.showAssetPickerModal({ mode: "style", current: "spikes_border" });
    p.catch(() => {});
    await new Promise((r) => setTimeout(r, 60));
    const selected = document.querySelector(".be-border-option.selected");
    assert.ok(selected);
    assert.ok(
      selected.className.includes("spikes_border") ||
        selected.textContent.includes("Spikes"),
    );
  });

  it("offers Default and None alongside named styles", async function () {
    const p = window.showAssetPickerModal({ mode: "style" });
    p.catch(() => {});
    await new Promise((r) => setTimeout(r, 60));
    const labels = Array.from(
      document.querySelectorAll(".be-border-option"),
    ).map((o) => o.textContent.trim());
    assert.ok(labels.includes("Default"));
    assert.ok(labels.includes("None"));
  });

  it("clearBorderStyles removes every border class from an element", function () {
    const section = document.createElement("div");
    section.className = "ct-subsection spikes_border goth_border";
    window.clearBorderStyles(section);
    assert.ok(!section.classList.contains("spikes_border"));
    assert.ok(!section.classList.contains("goth_border"));
    assert.ok(section.classList.contains("ct-subsection"), "unrelated class kept");
  });
});

/* ------------------------------------------------------------------ */
/* 3598bd2 — Ornaments (#16)                                           */
/* ------------------------------------------------------------------ */
describe("E4 3598bd2 — ornament assets in picker", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = boot("<!DOCTYPE html><html><body></body></html>");
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    stubLm(window, document);
  });
  afterEach(function () {
    cleanup();
  });

  it("lists Ornament options in the border picker modal", async function () {
    const p = window.showAssetPickerModal({ mode: "style" });
    p.catch(() => {});
    await new Promise((r) => setTimeout(r, 60));
    const labels = Array.from(
      document.querySelectorAll(".be-border-option"),
    ).map((o) => o.textContent.trim());
    assert.ok(labels.some((l) => l.includes("Ornament")), labels.join(" | "));
  });

  it("renders ornament shape assets through createShape without error", function () {
    const b2 = bootRooted();
    const w2 = b2.window;
    const wrapper = w2.createShape("assets/shapes/corner_ornament.webp");
    const container = wrapper.querySelector(".be-shape-container");
    assert.strictEqual(
      container.dataset.assetPath,
      "assets/shapes/corner_ornament.webp",
    );
    b2.cleanup();
  });

  it("applyShapeAsset recovers when handed a result object", function () {
    const b2 = bootRooted();
    const w2 = b2.window;
    const wrapper = w2.createShape("assets/shapes/star.webp");
    const container = wrapper.querySelector(".be-shape-container");
    assert.doesNotThrow(() =>
      w2.applyShapeAsset(container, { assetPath: "assets/ornament.webp" }),
    );
    assert.ok(container.classList.contains("be-shape-container"), "container remains usable");
    b2.cleanup();
  });

  it("applyShapeAsset is a silent no-op for a missing container", function () {
    const b2 = bootRooted();
    assert.doesNotThrow(() => b2.window.applyShapeAsset(null, "assets/ornament.webp"));
    b2.cleanup();
  });
});

/* ------------------------------------------------------------------ */
/* e57b53b — Shapes (#17)                                              */
/* ------------------------------------------------------------------ */
describe("E4 e57b53b — createShape basics", function () {
  let window, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("builds a .be-shape-wrapper containing a .be-shape-container", function () {
    const wrapper = window.createShape("assets/shapes/star.webp");
    assert.ok(wrapper.classList.contains("be-shape-wrapper"));
    const container = wrapper.querySelector(".be-shape-container");
    assert.ok(container, "shape container expected");
    assert.ok(container.classList.contains("be-shape"));
  });

  it("tags the container with the chosen asset path", function () {
    const wrapper = window.createShape("assets/shapes/archer_main.webp");
    const container = wrapper.querySelector(".be-shape-container");
    assert.strictEqual(container.dataset.assetPath, "assets/shapes/archer_main.webp");
  });

  it("generates distinct ids for consecutive shapes", function () {
    const a = window.createShape("assets/shapes/star.webp");
    const b = window.createShape("assets/shapes/star.webp");
    const idA = a.querySelector(".be-shape-container").id;
    const idB = b.querySelector(".be-shape-container").id;
    assert.notStrictEqual(idA, idB);
  });

  it("honors restoreData.id on the container", function () {
    const wrapper = window.createShape("assets/shapes/star.webp", { id: "shape-saved" });
    assert.strictEqual(wrapper.querySelector(".be-shape-container").id, "shape-saved");
  });
});

/* ------------------------------------------------------------------ */
/* f59b383 — DomManager shapes container selector                      */
/* ------------------------------------------------------------------ */
describe("E4 f59b383 — shapes container/layer creation", function () {
  let window, document, cleanup, dom;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    dom = window.DomManager.getInstance();
  });
  afterEach(function () {
    cleanup();
  });

  it("getShapesContainer creates #print-enhance-shapes-container", function () {
    const container = dom.getShapesContainer().element;
    assert.ok(container);
    assert.strictEqual(container.id, "print-enhance-shapes-container");
  });

  it("getShapesLayer creates the layer inside the shapes container", function () {
    const layer = dom.getShapesLayer().element;
    assert.strictEqual(layer.id, "print-enhance-shapes-layer");
    assert.strictEqual(layer.parentElement.id, "print-enhance-shapes-container");
  });

  it("layer creation is idempotent (single container + layer)", function () {
    dom.getShapesContainer();
    dom.getShapesContainer();
    dom.getShapesLayer();
    dom.getShapesLayer();
    assert.strictEqual(
      document.querySelectorAll("#print-enhance-shapes-container").length,
      1,
    );
    assert.strictEqual(document.querySelectorAll("#print-enhance-shapes-layer").length, 1);
  });

  it("getActiveShapesLayer falls back to the shapes layer without LayerManager", function () {
    const active = dom.getActiveShapesLayer().element;
    assert.strictEqual(active.id, "print-enhance-shapes-layer");
  });
});

/* ------------------------------------------------------------------ */
/* 8e9eabe — shape z-index management                                  */
/* ------------------------------------------------------------------ */
describe("E4 8e9eabe — shape z-index stacking", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  function addSection(id) {
    let layer = document.getElementById("print-enhance-sections-layer");
    if (!layer) {
      layer = window.DomManager.getInstance().getSectionsLayer().element;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "be-section-wrapper";
    wrapper.id = `${id}-wrapper`;
    wrapper.style.zIndex = "10";
    const container = document.createElement("div");
    container.className = "print-section-container";
    container.id = id;
    wrapper.appendChild(container);
    layer.appendChild(wrapper);
  }

  it("starts shapes above the 110 baseline", function () {
    const wrapper = window.createShape("assets/shapes/star.webp");
    assert.ok(parseInt(wrapper.style.zIndex, 10) >= 111);
  });

  it("stacks a second shape above the first", function () {
    const a = window.createShape("assets/shapes/star.webp");
    const b = window.createShape("assets/shapes/star.webp");
    assert.ok(
      parseInt(b.style.zIndex, 10) > parseInt(a.style.zIndex, 10),
      `${a.style.zIndex} !< ${b.style.zIndex}`,
    );
  });

  it("keeps shapes at least 100 above sections they coexist with", function () {
    addSection("sec-a");
    const wrapper = window.createShape("assets/shapes/star.webp");
    assert.ok(parseInt(wrapper.style.zIndex, 10) >= 110);
  });

  it("writes the z-index as an integer on the wrapper style", function () {
    const wrapper = window.createShape("assets/shapes/star.webp");
    assert.ok(/^\d+$/.test(wrapper.style.zIndex), wrapper.style.zIndex);
  });
});

/* ------------------------------------------------------------------ */
/* 9df5cb2 — showShapePickerModal behaviors                            */
/* ------------------------------------------------------------------ */
describe("E4 9df5cb2 — shape picker modal", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = boot("<!DOCTYPE html><html><body></body></html>");
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("rejects gracefully with feedback when no layer is active", async function () {
    const result = await window.showShapePickerModal();
    assert.strictEqual(result, null);
    const feedback = document.querySelector(".be-feedback");
    assert.ok(feedback, "feedback toast should be shown");
    assert.ok(feedback.textContent.includes("layer"), feedback.textContent);
  });

  it("creates an overlay with Borders/Shapes/Custom tabs once a layer is active", async function () {
    stubLm(window, document);
    const p = window.showShapePickerModal();
    p.catch(() => {});
    await new Promise((r) => setTimeout(r, 60));
    assert.ok(document.querySelector(".be-modal-overlay"));
    const tabs = Array.from(document.querySelectorAll(".be-modal-tab")).map(
      (t) => t.textContent,
    );
    assert.deepStrictEqual(tabs, ["Borders", "Shapes", "Custom"]);
  });

  it("renders shape options on the Shapes tab", async function () {
    stubLm(window, document);
    const p = window.showShapePickerModal("", "assets/shapes/");
    p.catch(() => {});
    await new Promise((r) => setTimeout(r, 60));
    const options = document.querySelectorAll(".be-border-option");
    assert.ok(options.length > 0);
  });

  it("marks the current asset as selected", async function () {
    stubLm(window, document);
    const p = window.showShapePickerModal(
      "assets/shapes/archer_main.webp",
      "assets/shapes/",
    );
    p.catch(() => {});
    await new Promise((r) => setTimeout(r, 60));
    assert.ok(document.querySelector(".be-border-option.selected"));
  });
});

/* ------------------------------------------------------------------ */
/* 291d5ea — 'Add Shape' control button                                */
/* ------------------------------------------------------------------ */
describe("E4 291d5ea — Add Shape control wiring", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  function addShapeButton() {
    return Array.from(document.querySelectorAll("#print-enhance-controls button")).find(
      (btn) => btn.textContent.includes("Add Shape"),
    );
  }

  it("createControls adds an 'Add Shape' button into the control panel", function () {
    window.createControls();
    const panel = document.getElementById("print-enhance-controls");
    assert.ok(panel, "control panel expected");
    assert.ok(addShapeButton(), "Add Shape button expected");
  });

  it("carries an inline SVG icon on the Add Shape control (redesign: paintbrush → shape glyph)", function () {
    window.createControls();
    const btn = addShapeButton();
    // ui_ux_overhaul_20260908 Phase 3: emoji icon replaced by the 16px SVG
    // icon language; the semantic contract is an icon element inside the
    // button (label text preserved separately).
    const ico = btn.querySelector(".be-ctl-ico svg");
    assert.ok(ico, "Add Shape control carries an SVG icon element");
    assert.ok(
      ico.classList.contains("be-icon-shape"),
      "icon is the shape glyph",
    );
    assert.ok(
      (btn.textContent || "").includes("Add Shape"),
      "label text preserved",
    );
  });

  // Debt #1 (FIXED in Phase 12 of encapsulation_functionality_20260907):
  // createControls now carries an internal guard, so a second call is a no-op
  // (previously it appended a duplicate panel; production only masked it via
  // the IIFE __DDB_PRINT_ENHANCE_INITIALIZED__ boot-once guard).
  it("is idempotent — a second createControls call does not duplicate the panel", function () {
    window.createControls();
    window.createControls();
    assert.strictEqual(
      document.querySelectorAll("#print-enhance-controls").length,
      1,
      "createControls must not duplicate the panel (debt #1 fixed in Phase 12)",
    );
  });

  it("clicking Add Shape opens the shape picker when a layer is active", async function () {
    stubLm(window, document);
    window.createControls();
    addShapeButton().click();
    await new Promise((r) => setTimeout(r, 60));
    assert.ok(document.querySelector(".be-modal-overlay"));
    assert.ok(
      Array.from(document.querySelectorAll(".be-modal-tab")).some(
        (t) => t.textContent === "Shapes",
      ),
    );
  });

  it("updateControlsState never throws with or without a layer manager", function () {
    stubLm(window, document, { activeLayerId: null });
    window.createControls();
    assert.doesNotThrow(() => window.updateControlsState());
    // also safe without any LayerManager at all
    const bare = bootRooted();
    assert.doesNotThrow(() => bare.window.updateControlsState());
    bare.cleanup();
  });
});
