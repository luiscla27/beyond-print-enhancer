/**
 * E9 — Encapsulation-debt regression suite (2026-04-22..05-05).
 *   8c44fab Layer splitter for shapes (#30)
 *   dd46d98 Upload shapes (#31)
 *   b809e94 New delete buttons (#32)
 *   bb87e61 Shape glow (#33)
 *   8b75579 Font size (#34)
 *   dff9bea Print per layer fixes (#35)
 * Complementary to shape_layers_*, layer_deletion, print_styles,
 * custom_shapes_storage/custom_shapes_ui, properties_panel_font_size.
 */
"use strict";

const assert = require("assert");
const { boot, waitFor } = require("./debt_harness.js");

/* ------------------------------------------------------------------ */
/* 8c44fab — Layer splitter for shapes (LayerManager structural state)  */
/* ------------------------------------------------------------------ */
describe("E9 8c44fab — shape layer splitting (LayerManager state)", function () {
  let window, document, LayerManager;
  beforeEach(function () {
    const dom = new (require("jsdom").JSDOM)(
      '<!DOCTYPE html><html><body><div id="print-enhance-shapes-layer"></div><div id="print-enhance-sections-layer"></div></body></html>',
    );
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    global.NodeList = window.NodeList;
    window.DomManager = {
      getInstance: () => ({
        getLayoutRoot: () => ({ element: document.body }),
        getShapesContainer: () => ({ element: document.body }),
        getSectionsContainer: () => ({ element: document.body }),
      }),
    };
    window.updatePrintStyles = () => {};
    LayerManager = require("../../../js/dom/layer_manager.js");
  });
  afterEach(function () {
    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.NodeList;
    delete require.cache[require.resolve("../../../js/dom/layer_manager.js")];
  });

  it("initializes one default shapes layer plus the sections layer", function () {
    const lm = new LayerManager();
    assert.strictEqual(lm.sectionsLayer.id, "sections");
    assert.strictEqual(lm.sectionsLayer.layerId, "print-enhance-sections-layer");
    assert.strictEqual(lm.shapeLayers.length, 1);
    assert.strictEqual(lm.shapeLayers[0].id, "shapes-default");
    assert.strictEqual(lm.shapeLayers[0].layerId, "print-enhance-shapes-layer");
    assert.strictEqual(lm.activeLayerId, "sections");
  });

  // AC-5/U-7 (ui_ux_review_20260910): adding a layer used to LOCK every other
  // layer, which silently hid all section hover controls on the sheet and made
  // the extension look broken after a normal action. The new layer still
  // becomes the active one, but the others keep their previous lock state.
  it("addShapeLayer activates the new layer without locking the others", function () {
    const lm = new LayerManager();
    const before = lm.shapeLayers.map((l) => l.isLocked);
    const extra = lm.addShapeLayer("Extra");
    assert.strictEqual(extra.isLocked, false, "new layer is unlocked");
    assert.strictEqual(lm.activeLayerId, extra.id, "new layer becomes active");
    const existing = lm.shapeLayers.filter((l) => l.id !== extra.id);
    assert.strictEqual(
      JSON.stringify(existing.map((l) => l.isLocked)),
      JSON.stringify(before),
      "existing layers keep their lock state",
    );
    assert.strictEqual(lm.sectionsLayer.isLocked, false, "sections untouched");
  });

  it("addShapeLayer assigns unique ids and increments the layer list", function () {
    const lm = new LayerManager();
    const a = lm.addShapeLayer("A");
    const b = lm.addShapeLayer("B");
    assert.notStrictEqual(a.id, b.id);
    assert.strictEqual(lm.shapeLayers.length, 3); // default + A + B
    assert.ok(lm.getLayerById(a.id));
    assert.ok(lm.getLayerById(b.id));
  });

  it("addShapeLayer honors a restore initialState (id + layerId)", function () {
    const lm = new LayerManager();
    const restored = lm.addShapeLayer("Restored", {
      id: "shapes-saved-1",
      layerId: "print-enhance-layer-saved",
      isLocked: true,
    });
    assert.strictEqual(restored.id, "shapes-saved-1");
    assert.strictEqual(restored.layerId, "print-enhance-layer-saved");
    assert.strictEqual(lm.getLayerById("shapes-saved-1").label, "Restored");
  });

  it("signals the controls layer when a shape layer is added", function () {
    const lm = new LayerManager();
    let calls = 0;
    window.updateControlsState = () => {
      calls += 1;
    };
    lm.addShapeLayer("Signaled");
    assert.ok(calls >= 1, "updateControlsState should be called after add");
  });
});

/* ------------------------------------------------------------------ */
/* dd46d98 — Upload shapes (custom-shape storage contract)             */
/* ------------------------------------------------------------------ */
describe("E9 dd46d98 — uploaded custom shapes storage contract", function () {
  let window, cleanup;
  beforeEach(async function () {
    const b = boot("<!DOCTYPE html><html><body></body></html>");
    window = b.window;
    cleanup = b.cleanup;
    await window.Storage.init();
  });
  afterEach(function () {
    cleanup();
  });

  // fake-indexeddb is process-shared across files in this repo, so other suites
  // may already have saved custom shapes; only assert our own fixture is absent.
  it("reports no previously-uploaded shape before this suite adds one", async function () {
    const shapes = await window.Storage.getCustomShapes();
    assert.ok(Array.isArray(shapes));
    assert.ok(
      !shapes.some((s) => s.id === "debt-fresh-shape"),
      "only this suite uses its own fixture id",
    );
  });

  it("persists an uploaded base64 shape by id (data URL contract)", async function () {
    const shape = { id: "custom-1", name: "Star", data: "data:image/png;base64,AAA" };
    await window.Storage.saveCustomShape(shape);
    const shapes = await window.Storage.getCustomShapes();
    const found = shapes.find((s) => s.id === "custom-1");
    assert.ok(found);
    assert.strictEqual(found.data, "data:image/png;base64,AAA");
  });

  it("upserts rather than duplicates when the same id is saved twice", async function () {
    await window.Storage.saveCustomShape({ id: "custom-1", name: "A", data: "d1" });
    await window.Storage.saveCustomShape({ id: "custom-1", name: "B", data: "d2" });
    const shapes = await window.Storage.getCustomShapes();
    const matches = shapes.filter((s) => s.id === "custom-1");
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].name, "B");
  });

  it("round-trips customShapes inside a saved layout JSON object", async function () {
    const layout = {
      version: "1.5.0",
      sections: {},
      customShapes: [{ id: "custom-9", name: "Diamond", data: "data:image/webp;base64,ZZZ" }],
    };
    await window.Storage.saveLayout("GLOBAL", layout);
    const loaded = await window.Storage.loadLayout("GLOBAL");
    assert.ok(Array.isArray(loaded.customShapes));
    assert.strictEqual(loaded.customShapes[0].id, "custom-9");
    assert.strictEqual(loaded.customShapes[0].data, "data:image/webp;base64,ZZZ");
  });
});

/* ------------------------------------------------------------------ */
/* b809e94 — Delete buttons (clone + shape)                            */
/* ------------------------------------------------------------------ */
describe("E9 b809e94 — clone/shape delete buttons", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const html = `<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper">
        <div class="be-section-wrapper">
          <div class="ct-subsection" id="section-main">
            <div class="print-section-header"><span>Main</span></div>
          </div>
        </div>
        <div class="be-section-wrapper">
          <div class="ct-subsection" id="clone-42">
            <div class="print-section-header"><span>Clone</span></div>
          </div>
        </div>
        <div class="be-shape-wrapper">
          <div class="be-shape-container" id="shape-x"><img src="a.png" /></div>
        </div>
      </div>
    </body></html>`;
    const b = boot(html);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.injectCloneButtons();
  });
  afterEach(function () {
    cleanup();
  });

  it("shows a delete button only for clone ids, not regular sections", function () {
    const mainActions = document
      .getElementById("section-main")
      .closest(".be-section-wrapper")
      .querySelector(".be-section-actions");
    assert.strictEqual(mainActions.querySelectorAll(":scope > button.be-clone-delete").length, 0);
    const cloneActions = document
      .getElementById("clone-42")
      .closest(".be-section-wrapper")
      .querySelector(".be-section-actions");
    assert.ok(cloneActions.querySelector(":scope > button.be-clone-delete"));
  });

  it("removes the clone wrapper when its delete button is confirmed", async function () {
    const cloneActions = document
      .getElementById("clone-42")
      .closest(".be-section-wrapper")
      .querySelector(".be-section-actions");
    cloneActions.querySelector(":scope > button.be-clone-delete").click();
    // U-36: deletion now confirms through the SHARED in-app dialog. This
    // harness loads js/modals.js, so drive the real dialog rather than stubbing
    // the native confirm() — a stronger assertion than the stub was.
    await new Promise((r) => setTimeout(r, 0));
    const ok = document.querySelector(".be-modal-overlay .be-modal-ok");
    assert.ok(ok, "a confirmation dialog should be shown");
    ok.click();
    // DELIBERATELY UPDATED (AC-1): the delete now writes a backup BEFORE removing,
    // so the removal completes after a storage round-trip rather than on the next
    // tick. Wait for the EFFECT instead of assuming a tick count — a stronger
    // assertion, and it does not encode how long the durability step takes.
    await waitFor(() => document.getElementById("clone-42") === null);
    assert.strictEqual(document.getElementById("clone-42"), null);
  });

  it("keeps the clone when deletion is declined", async function () {
    const cloneActions = document
      .getElementById("clone-42")
      .closest(".be-section-wrapper")
      .querySelector(".be-section-actions");
    cloneActions.querySelector(":scope > button.be-clone-delete").click();
    await new Promise((r) => setTimeout(r, 0));
    const cancel = document.querySelector(".be-modal-overlay .be-modal-cancel");
    assert.ok(cancel, "a confirmation dialog should be shown");
    cancel.click();
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(document.getElementById("clone-42"), "declining keeps the clone");
  });

  it("exposes a visible delete button on shapes that removes the wrapper", async function () {
    const shapeActions = document.getElementById("shape-x").querySelector(".be-section-actions");
    const del = shapeActions.querySelector(":scope > button.be-shape-delete");
    assert.ok(del, "shape delete button should be visible in the bar");
    del.click();
    await new Promise((r) => setTimeout(r, 0));
    const ok = document.querySelector(".be-modal-overlay .be-modal-ok");
    assert.ok(ok, "a confirmation dialog should be shown");
    ok.click();
    // DELIBERATELY UPDATED (AC-1): snapshot-first, so wait for the effect.
    await waitFor(() => document.getElementById("shape-x") === null);
    assert.strictEqual(document.getElementById("shape-x"), null);
    assert.strictEqual(document.querySelectorAll(".be-shape-wrapper").length, 0);
  });
});

/* ------------------------------------------------------------------ */
/* bb87e61 — Shape glow (focus highlight)                              */
/* ------------------------------------------------------------------ */
describe("E9 bb87e61 — focus highlight glow", function () {
  let window, document, cleanup, LayerManager, lm;
  beforeEach(function () {
    const html = `<!DOCTYPE html><html><body>
      <div class="be-section-wrapper" id="wrapper-1">
        <div class="ct-subsection" id="section-1"></div>
      </div>
      <div class="be-section-wrapper" id="wrapper-2">
        <div class="ct-subsection" id="section-2"></div>
      </div>
    </body></html>`;
    const b = boot(html);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.DomManager = {
      getInstance: () => ({
        getLayoutRoot: () => ({ element: document.body }),
        getShapesContainer: () => ({ element: document.body }),
        getSectionsContainer: () => ({ element: document.body }),
      }),
    };
    window.HTMLElement.prototype.scrollIntoView = function () {};
    LayerManager = require("../../../js/dom/layer_manager.js");
    lm = new LayerManager();
  });
  afterEach(function () {
    cleanup();
    delete require.cache[require.resolve("../../../js/dom/layer_manager.js")];
  });

  it("adds the be-focus-highlight class to the section wrapper", function () {
    lm.focusElement("section-1");
    const wrapper = document.getElementById("wrapper-1");
    assert.ok(wrapper.classList.contains("be-focus-highlight"));
  });

  it("removes the glow after the 2s timeout", async function () {
    this.timeout(4000);
    lm.focusElement("section-1");
    const wrapper = document.getElementById("wrapper-1");
    assert.ok(wrapper.classList.contains("be-focus-highlight"));
    await new Promise((r) => setTimeout(r, 2100));
    assert.ok(!wrapper.classList.contains("be-focus-highlight"));
  });

  it("raises the focused wrapper above its siblings", function () {
    lm.focusElement("section-1");
    const w1 = document.getElementById("wrapper-1");
    const w2 = document.getElementById("wrapper-2");
    assert.ok(parseInt(w1.style.zIndex, 10) >= 1000, `z=${w1.style.zIndex}`);
    assert.ok(!w2.style.zIndex || parseInt(w2.style.zIndex, 10) < parseInt(w1.style.zIndex, 10));
  });

  it("is a silent no-op for unknown ids", function () {
    assert.doesNotThrow(() => lm.focusElement("missing-id"));
  });

  it("print styles strip focus glow filters", function () {
    window.updatePrintStyles();
    const style = document.getElementById("be-print-z-style");
    const css = style.textContent;
    assert.ok(css.includes(".be-focus-highlight-hover"));
    assert.ok(css.includes("filter: none !important"));
  });
});

/* ------------------------------------------------------------------ */
/* 8b75579 — Font size (#34)                                           */
/* ------------------------------------------------------------------ */
describe("E9 8b75579 — font size application", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const html = `<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper">
        <div class="be-section-wrapper" id="wrapper-font">
          <div class="ct-subsection" id="section-font">
            <div class="print-section-header"><span>Notes</span></div>
          </div>
        </div>
      </div>
    </body></html>`;
    const b = boot(html);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.injectCloneButtons();
  });
  afterEach(function () {
    cleanup();
  });

  it("applies the wrapper font size and scale variable via the panel slider", function () {
    const panel = document.createElement("div");
    panel.id = "print-enhance-properties-panel";
    document.body.appendChild(panel);
    window.setActiveSection(document.getElementById("section-font"));
    const slider = panel.querySelector('input[type="range"]');
    assert.ok(slider);
    slider.value = "16";
    slider.dispatchEvent(new window.Event("input", { bubbles: true }));
    const wrapper = document.getElementById("wrapper-font");
    assert.strictEqual(wrapper.style.getPropertyValue("font-size"), "16px");
    assert.strictEqual(wrapper.style.getPropertyValue("--be-font-scale"), "1.6");
  });

  it("slider covers the 8-30px range and defaults to 10px", function () {
    const panel = document.createElement("div");
    panel.id = "print-enhance-properties-panel";
    document.body.appendChild(panel);
    window.setActiveSection(document.getElementById("section-font"));
    const slider = panel.querySelector('input[type="range"]');
    assert.strictEqual(slider.min, "8");
    assert.strictEqual(slider.max, "30");
    assert.strictEqual(slider.value, "10");
    const display = panel.querySelector("span");
    assert.ok(display.textContent.includes("10px"));
  });

  it("shows the current wrapper font size when re-opening the panel", function () {
    const wrapper = document.getElementById("wrapper-font");
    wrapper.style.setProperty("font-size", "20px", "important");
    const panel = document.createElement("div");
    panel.id = "print-enhance-properties-panel";
    document.body.appendChild(panel);
    window.setActiveSection(document.getElementById("section-font"));
    const slider = panel.querySelector('input[type="range"]');
    assert.strictEqual(slider.value, "20");
  });

  it("locks font size and scale with !important priority", function () {
    const wrapper = document.getElementById("wrapper-font");
    const section = document.getElementById("section-font");
    const panel = document.createElement("div");
    panel.id = "print-enhance-properties-panel";
    document.body.appendChild(panel);
    window.setActiveSection(section);
    const slider = panel.querySelector('input[type="range"]');
    slider.value = "24";
    slider.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.strictEqual(wrapper.style.getPropertyPriority("font-size"), "important");
    assert.strictEqual(wrapper.style.getPropertyPriority("--be-font-scale"), "important");
  });
});

/* ------------------------------------------------------------------ */
/* dff9bea — Print per layer fixes                                     */
/* ------------------------------------------------------------------ */
describe("E9 dff9bea — print-per-layer CSS regeneration", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const html = `<!DOCTYPE html><html><head></head><body>
      <div id="print-layout-wrapper">
        <div class="be-shape-layer-container" id="shapesLayer" data-print-z="5" data-print-disabled="true">
          <div class="be-shape-wrapper"><div class="be-shape-container" id="s1"></div></div>
        </div>
        <div id="print-enhance-sections-layer" data-print-z="3">
          <div class="be-section-wrapper"><div class="ct-subsection" id="sec1"></div></div>
        </div>
        <div class="be-shape-layer-container" id="extraLayer" data-print-z="4">
          <div class="be-shape-wrapper"><div class="be-shape-container" id="s2"></div></div>
        </div>
      </div>
    </body></html>`;
    const b = boot(html);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("writes a single style element with id be-print-z-style", function () {
    window.updatePrintStyles();
    window.updatePrintStyles();
    const styles = document.querySelectorAll("#be-print-z-style");
    assert.strictEqual(styles.length, 1);
  });

  it("emits a z-index rule per [data-print-z] layer id", function () {
    window.updatePrintStyles();
    const css = document.getElementById("be-print-z-style").textContent;
    assert.ok(css.includes("#shapesLayer { z-index: 5 !important; }"), css);
    assert.ok(css.includes("#extraLayer { z-index: 4 !important; }"));
    assert.ok(css.includes("#print-enhance-sections-layer { z-index: 3 !important; }"));
  });

  it("hides layers flagged data-print-disabled=true inside the media query", function () {
    window.updatePrintStyles();
    const css = document.getElementById("be-print-z-style").textContent;
    assert.ok(css.includes("#shapesLayer { display: none !important; }"));
    assert.ok(!css.includes("#extraLayer { display: none !important; }"));
  });

  it("enforces layer ordering: sections layer 1000, shape layers 2000", function () {
    window.updatePrintStyles();
    const css = document.getElementById("be-print-z-style").textContent;
    assert.ok(css.includes("#print-enhance-sections-layer { z-index: 1000 !important; }"));
    assert.ok(css.includes(".be-shape-layer-container { z-index: 2000 !important; }"));
  });

  it("emits rules only inside a single @media print block", function () {
    window.updatePrintStyles();
    const css = document.getElementById("be-print-z-style").textContent;
    const opens = (css.match(/@media print/g) || []).length;
    assert.strictEqual(opens, 1);
  });
});
