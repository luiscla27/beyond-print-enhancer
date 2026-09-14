/**
 * E8 — Encapsulation-debt regression suite (2026-04-06..21).
 *   868fd68 Started Premade sheets feature (#25)
 *   3ae6619 Fixed shapes mode (#26)
 *   9265007 Section print order on drag (#27)
 *   9e440a2 Layer enhancements; layer mgmt hidden on print (#28)
 * Complementary to catalog_logic, schema, layer_list_reorder,
 * layout_persistence_layers, print_styles, print_z_*.
 */
"use strict";

const assert = require("assert");
const { boot } = require("./debt_harness.js");

/* ------------------------------------------------------------------ */
/* 868fd68 — Premade sheets / template apply against a live document   */
/* ------------------------------------------------------------------ */
describe("E8 868fd68 — premade template application to live DOM", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const html = `<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper">
        <div class="be-section-wrapper">
          <div class="ct-subsection" id="skills">
            <div class="print-section-header"><span>Skills</span></div>
          </div>
        </div>
        <div class="be-section-wrapper">
          <div class="ct-subsection" id="combat">
            <div class="print-section-header"><span>Combat</span></div>
          </div>
        </div>
      </div>
    </body></html>`;
    const b = boot(html, { catalogService: true });
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    // route fetch for catalog + template payloads
    window.fetch = async (url) => ({
      ok: true,
      json: async () => {
        const s = String(url);
        if (s.includes("catalog")) {
          return {
            templates: [
              { id: "hero", name: "Hero", path: "templates/hero.json", thumbnail: "t.png" },
            ],
          };
        }
        return {
          name: "Hero",
          data: {
            sections: {
              skills: { width: "600px", borderStyle: "be-border-goth1" },
              combat: { left: "120px", top: "80px" },
            },
            shapes: [],
          },
        };
      },
    });
    window.clearBorderStyles = () => {}; // spy-able no-op replacement
  });
  afterEach(function () {
    cleanup();
  });

  it("applies a configured border style to the matching section only", async function () {
    await window.CatalogService.applyTemplate("hero", true);
    const skills = document.getElementById("skills");
    const combat = document.getElementById("combat");
    assert.ok(skills.classList.contains("be-border-goth1"));
    assert.ok(!combat.classList.contains("be-border-goth1"));
  });

  it("positions the wrapper with important inline styles from the template", async function () {
    await window.CatalogService.applyTemplate("hero", true);
    const combatWrapper = document
      .getElementById("combat")
      .closest(".be-section-wrapper");
    assert.strictEqual(combatWrapper.style.getPropertyValue("left"), "120px");
    assert.strictEqual(combatWrapper.style.getPropertyValue("top"), "80px");
    assert.strictEqual(
      combatWrapper.style.getPropertyPriority("left"),
      "important",
    );
  });

  it("sets section width on the section element when configured", async function () {
    await window.CatalogService.applyTemplate("hero", true);
    const skills = document.getElementById("skills");
    assert.strictEqual(skills.style.getPropertyValue("width"), "600px");
    assert.strictEqual(skills.style.getPropertyPriority("width"), "important");
  });

  it("reports failure when the catalog cannot be fetched", async function () {
    window.fetch = async () => {
      throw new Error("network down");
    };
    const applied = await window.CatalogService.applyTemplate("hero", true);
    assert.strictEqual(applied, false);
  });
});

/* ------------------------------------------------------------------ */
/* 3ae6619 — Fixed shapes mode (toggle semantics via layer manager)    */
/* ------------------------------------------------------------------ */
describe("E8 3ae6619 — shapes-mode toggle semantics", function () {
  let window, document, cleanup;
  let lockCalls = [];

  beforeEach(function () {
    const b = boot("<!DOCTYPE html><html><body></body></html>");
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    lockCalls = [];
    const fakeLm = {
      shapeLayers: [
        { id: "shapes-default", label: "Shapes", layerId: "print-enhance-shapes-layer", isLocked: true },
      ],
      getLayerById(id) {
        return this.shapeLayers.find((l) => l.id === id);
      },
      toggleLayerLock(layer) {
        lockCalls.push({ id: layer.id, isLocked: layer.isLocked });
        layer.isLocked = !layer.isLocked;
      },
      createPanel() {},
    };
    window.LayerManager = class {
      constructor() {
        return fakeLm;
      }
    };
    // DomManager must hand back the cached LM (state persists across toggles)
    window.DomManager.getInstance = () => ({
      getLayerManager: () => fakeLm,
    });
  });
  afterEach(function () {
    cleanup();
  });

  it("activation adds the mode class and unlocks the default shape layer", function () {
    window.toggleShapesMode(true);
    assert.ok(document.body.classList.contains("be-shapes-mode-active"));
    assert.strictEqual(lockCalls.length, 1);
    assert.strictEqual(lockCalls[0].id, "shapes-default");
    assert.strictEqual(lockCalls[0].isLocked, true); // was locked -> unlock requested
  });

  it("deactivation removes the mode class and requests a lock", function () {
    window.toggleShapesMode(true);
    window.toggleShapesMode(false);
    assert.ok(!document.body.classList.contains("be-shapes-mode-active"));
    assert.strictEqual(lockCalls.length, 2);
    assert.strictEqual(lockCalls[1].isLocked, false);
  });

  it("no-op toggles do not re-issue the same lock request (feedback-loop guard)", function () {
    window.toggleShapesMode(true); // unlock
    window.toggleShapesMode(true); // already active, layer already unlocked
    assert.strictEqual(lockCalls.length, 1, "second identical toggle should no-op");
  });

  it("falls back to the be-lock-shapes class when no LayerManager exists", function () {
    const b2 = boot("<!DOCTYPE html><html><body></body></html>");
    // no window.LayerManager, no DomManager.getLayerManager
    b2.window.toggleShapesMode(false);
    assert.ok(b2.document.body.classList.contains("be-lock-shapes"));
    b2.window.toggleShapesMode(true);
    assert.ok(!b2.document.body.classList.contains("be-lock-shapes"));
    b2.cleanup();
  });
});

/* ------------------------------------------------------------------ */
/* 9265007 — Section print order on drag (print z sync)                */
/* ------------------------------------------------------------------ */
describe("E8 9265007 — print z-index sync with layer list order", function () {
  let dom, window, document, lm;
  beforeEach(function () {
    dom = new (require("jsdom").JSDOM)(
      '<!DOCTYPE html><html><body><div id="print-enhance-sections-layer"></div><div id="print-enhance-shapes-layer"></div></body></html>',
    );
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    global.NodeList = window.NodeList;
    global.Node = window.Node;
    window.DomManager = {
      getInstance: () => ({
        getLayoutRoot: () => ({ element: document.body }),
        getShapesContainer: () => ({ element: document.body }),
        getSectionsContainer: () => ({ element: document.body }),
      }),
    };
    const LayerManager = require("../../../js/dom/layer_manager.js");
    lm = new LayerManager();
    window.showFeedback = () => {};
    window.updatePrintStyles = () => {};
  });
  afterEach(function () {
    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.NodeList;
    delete global.Node;
    delete require.cache[require.resolve("../../../js/dom/layer_manager.js")];
  });

  function addSection(id) {
    const layer = document.getElementById("print-enhance-sections-layer");
    const wrapper = document.createElement("div");
    wrapper.className = "be-section-wrapper";
    wrapper.id = `${id}-wrapper`;
    const container = document.createElement("div");
    container.className = "print-section-container";
    container.id = id;
    wrapper.appendChild(container);
    layer.appendChild(wrapper);
  }

  it("assigns descending print z to sections by list order (top = highest)", function () {
    addSection("sec-1");
    addSection("sec-2");
    lm.createPanel();
    lm.refreshLayerContents();
    lm.updatePrintZIndexes(true);
    const zBefore = (id) =>
      parseInt(document.getElementById(id).dataset.printZ, 10);
    const zTopBefore = zBefore("sec-2-wrapper"); // sec-2 is top of the reversed list
    const zBottomBefore = zBefore("sec-1-wrapper");
    assert.ok(zTopBefore > zBottomBefore);

    // drag the top card (sec-2) to the very bottom of the UI list
    const list = document.querySelector('.be-layer-content-list[data-layer="sections"]');
    list.appendChild(list.querySelector(".be-layer-item-card"));
    lm.updatePrintZIndexes(true);
    assert.ok(zBefore("sec-2-wrapper") < zBefore("sec-1-wrapper"), "moved card should now be bottom");
  });

  it("silent mode updates attributes without feedback", function () {
    addSection("sec-1");
    addSection("sec-2");
    lm.createPanel();
    lm.refreshLayerContents();
    let feedback = 0;
    window.showFeedback = () => {
      feedback += 1;
    };
    lm.updatePrintZIndexes(true);
    assert.strictEqual(feedback, 0);
    const w2 = document.getElementById("sec-2-wrapper");
    assert.ok(w2.dataset.printZ);
  });

  it("non-silent sync reports 'Layer order updated'", function () {
    addSection("sec-1");
    addSection("sec-2");
    lm.createPanel();
    lm.refreshLayerContents();
    let msg = null;
    window.showFeedback = (m) => {
      msg = m;
    };
    lm.updatePrintZIndexes(false);
    assert.ok(msg && msg.includes("Layer order updated"));
  });

  it("reorders real DOM so the bottom of the list renders first", function () {
    addSection("sec-1");
    addSection("sec-2");
    addSection("sec-3");
    lm.createPanel();
    lm.refreshLayerContents();
    const layerEl = document.getElementById("print-enhance-sections-layer");
    const list = document.querySelector('.be-layer-content-list[data-layer="sections"]');
    // move top card (sec-3) to bottom of the list
    list.appendChild(list.querySelector(".be-layer-item-card"));
    lm.updatePrintZIndexes(true);
    const domIds = Array.from(layerEl.children).map((w) => w.id);
    // top item of list = sec-2 must be LAST in DOM (highest z)
    assert.strictEqual(domIds[domIds.length - 1], "sec-2-wrapper");
    assert.strictEqual(domIds[0], "sec-3-wrapper");
  });

  it("uses a higher z base for the shapes layer than sections", function () {
    addSection("sec-1");
    const shapeLayer = document.getElementById("print-enhance-shapes-layer");
    const sw = document.createElement("div");
    sw.className = "be-shape-wrapper";
    sw.id = "shape-w-1";
    const sc = document.createElement("div");
    sc.className = "print-section-container";
    sc.id = "shape-1";
    sc.dataset.assetPath = "assets/shapes/star.webp";
    sw.appendChild(sc);
    shapeLayer.appendChild(sw);
    lm.createPanel();
    lm.refreshLayerContents();
    lm.updatePrintZIndexes(true);
    const shapeZ = parseInt(document.getElementById("shape-w-1").dataset.printZ, 10);
    const sectionZ = parseInt(document.getElementById("sec-1-wrapper").dataset.printZ, 10);
    assert.ok(!Number.isNaN(shapeZ), `shape z was NaN`);
    assert.ok(shapeZ > sectionZ, `shape z ${shapeZ} should exceed section z ${sectionZ}`);
  });
});

/* ------------------------------------------------------------------ */
/* 9e440a2 — Layer enhancements; layer manager hidden on print (#28)   */
/* ------------------------------------------------------------------ */
describe("E8 9e440a2 — layer manager print suppression + refresh", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const html = `<!DOCTYPE html><html><head></head><body>
      <div id="print-enhance-layer-manager"></div>
      <div id="print-layout-wrapper">
        <div class="be-section-wrapper"><div class="ct-subsection" id="s1"></div></div>
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

  it("print styles hide the layer-manager panel", function () {
    window.updatePrintStyles();
    const css = document.getElementById("be-print-z-style").textContent;
    assert.ok(css.includes("#print-enhance-layer-manager { display: none !important; }"));
  });

  it("layer print rules hide disabled layers inside the media query only", function () {
    const layer = document.createElement("div");
    layer.id = "disabledLayer";
    layer.dataset.printDisabled = "true";
    document.body.appendChild(layer);
    window.updatePrintStyles();
    const css = document.getElementById("be-print-z-style").textContent;
    assert.ok(css.includes("#disabledLayer { display: none !important; }"));
    assert.ok(css.startsWith("@media print"));
  });

  it("reuses one style element across repeated updates", function () {
    window.updatePrintStyles();
    window.updatePrintStyles();
    assert.strictEqual(document.querySelectorAll("#be-print-z-style").length, 1);
  });

  it("creates no style element when there is nothing print-specific", function () {
    const empty = boot("<!DOCTYPE html><html><head></head><body></body></html>");
    empty.window.updatePrintStyles();
    const css = empty.document.getElementById("be-print-z-style").textContent;
    assert.ok(css.includes("@media print"));
    empty.cleanup();
  });
});
