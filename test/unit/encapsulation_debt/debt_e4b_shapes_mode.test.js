/**
 * E4-B — Encapsulation-debt regression suite (2026-02-23, shapes-mode series).
 *   c53611f conductor checkpoint (phase-3 stability)
 *   8cc8975 feat(persistence): shapes in layout save/load
 *   9a60def fix(ui): initial Y of shapes -> 160px
 *   172547e feat(dom): shapes mode button selector
 *   bd2c1e4 feat(css): global Shapes Mode styles
 *   02ba46f feat(logic): implement toggleShapesMode
 *   3d4ac48 feat(ui): 'Shapes Mode' button in controls
 *   e935a4e feat(init): default Shapes Mode to ON (superseded -> OFF)
 */
"use strict";

const assert = require("assert");
const { boot } = require("./debt_harness.js");

function bootRooted() {
  return boot(
    "<!DOCTYPE html><html><body><div id='print-layout-wrapper'></div></body></html>",
  );
}

function makeFakeLm(shapeLayers, log) {
  const lm = {
    shapeLayers,
    getLayerById(id) {
      return this.shapeLayers.find((l) => l.id === id);
    },
    toggleLayerLock(layer, btn) {
      log.push({ id: layer.id, wasLocked: layer.isLocked, hasBtn: !!btn });
      layer.isLocked = !layer.isLocked;
    },
    createPanel() {},
  };
  return lm;
}

function wireLm(window, document, lm) {
  window.LayerManager = class {
    constructor() {
      return lm;
    }
  };
  window.DomManager.getInstance = () => ({ getLayerManager: () => lm });
}

/* ------------------------------------------------------------------ */
/* 02ba46f / bd2c1e4 — toggleShapesMode core (no LayerManager)         */
/* ------------------------------------------------------------------ */
describe("E4 02ba46f/bd2c1e4 — shapes-mode class toggling", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.PeDom = () => ({ getLayerManager: () => null });
  });
  afterEach(function () {
    cleanup();
  });

  it("activation adds be-shapes-mode-active and removes the lock class", function () {
    window.toggleShapesMode(true);
    assert.ok(document.body.classList.contains("be-shapes-mode-active"));
    assert.ok(!document.body.classList.contains("be-lock-shapes"));
  });

  it("deactivation removes the mode class and falls back to be-lock-shapes", function () {
    window.toggleShapesMode(false);
    assert.ok(!document.body.classList.contains("be-shapes-mode-active"));
    assert.ok(document.body.classList.contains("be-lock-shapes"));
  });

  it("honors an explicit force state regardless of current class", function () {
    window.toggleShapesMode(false);
    window.toggleShapesMode(false); // no-op (already off)
    assert.ok(!document.body.classList.contains("be-shapes-mode-active"));
    window.toggleShapesMode(true);
    assert.ok(document.body.classList.contains("be-shapes-mode-active"));
  });

  it("no-argument toggle flips the current state", function () {
    document.body.classList.remove("be-shapes-mode-active");
    window.toggleShapesMode(); // off -> on
    assert.ok(document.body.classList.contains("be-shapes-mode-active"));
    window.toggleShapesMode(); // on -> off
    assert.ok(!document.body.classList.contains("be-shapes-mode-active"));
  });
});

/* ------------------------------------------------------------------ */
/* 3d4ac48 — shapes-mode interacts with the layer-manager panel row    */
/* ------------------------------------------------------------------ */
describe("E4 3d4ac48 — toggle syncs the layer manager lock", function () {
  let window, document, cleanup, log;
  beforeEach(function () {
    const html = `<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
      <div id="print-enhance-layer-manager">
        <div class="be-layer-row" data-layer-id="shapes-default">
          <button title="Toggle Edit Mode">lock</button>
        </div>
      </div>
    </body></html>`;
    const b = boot(html);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    log = [];
    const lm = makeFakeLm(
      [{ id: "shapes-default", label: "Shapes", layerId: "print-enhance-shapes-layer", isLocked: true }],
      log,
    );
    wireLm(window, document, lm);
  });
  afterEach(function () {
    cleanup();
  });

  it("passes the matching panel-row button to the layer lock toggle", function () {
    window.toggleShapesMode(true); // unlock request
    assert.strictEqual(log.length, 1);
    assert.strictEqual(log[0].id, "shapes-default");
    assert.ok(log[0].hasBtn, "panel row button should be forwarded");
  });

  it("locks the default layer again when the mode is turned off", function () {
    window.toggleShapesMode(true);
    window.toggleShapesMode(false);
    assert.strictEqual(log.length, 2);
    assert.strictEqual(log[1].wasLocked, false);
  });

  it("requests no duplicate unlock when already unlocked (guard)", function () {
    window.toggleShapesMode(true); // unlock: log 1
    // now isLocked=false; forcing true again must early-return (no log)
    window.toggleShapesMode(true);
    assert.strictEqual(log.length, 1);
  });

  it("toggles the FIRST shape layer when shapes-default is absent", function () {
    const b2 = bootRooted();
    const w2 = b2.window;
    const d2 = b2.document;
    const log2 = [];
    const lm2 = makeFakeLm(
      [{ id: "custom-only", label: "Custom", layerId: "print-enhance-layer-custom", isLocked: true }],
      log2,
    );
    wireLm(w2, d2, lm2);
    w2.toggleShapesMode(true);
    assert.strictEqual(log2[0].id, "custom-only");
    b2.cleanup();
  });
});

/* ------------------------------------------------------------------ */
/* 9a60def — default placement of new shapes                           */
/* ------------------------------------------------------------------ */
describe("E4 9a60def — shape initial placement", function () {
  let window, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("defaults new shapes to top 160px", function () {
    const wrapper = window.createShape("assets/shapes/star.webp");
    assert.strictEqual(wrapper.style.getPropertyValue("top"), "160px");
  });

  it("defaults new shapes to left 50px with a 200x200 container", function () {
    const wrapper = window.createShape("assets/shapes/star.webp");
    assert.strictEqual(wrapper.style.getPropertyValue("left"), "50px");
    const container = wrapper.querySelector(".be-shape-container");
    assert.strictEqual(container.style.getPropertyValue("width"), "200px");
    assert.strictEqual(container.style.getPropertyValue("height"), "200px");
  });

  it("restoreData placement overrides defaults", function () {
    const wrapper = window.createShape("assets/shapes/star.webp", { left: "10px", top: "20px" });
    assert.strictEqual(wrapper.style.getPropertyValue("left"), "10px");
    assert.strictEqual(wrapper.style.getPropertyValue("top"), "20px");
  });

  it("keeps coordinates off the container (only the wrapper is positioned)", function () {
    const wrapper = window.createShape("assets/shapes/star.webp");
    const container = wrapper.querySelector(".be-shape-container");
    assert.strictEqual(container.style.left, "");
    assert.strictEqual(container.style.top, "");
  });
});

/* ------------------------------------------------------------------ */
/* 8cc8975 — shape persistence contract in the layout JSON             */
/* ------------------------------------------------------------------ */
describe("E4 8cc8975 — shape layer persistence (Storage)", function () {
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

  it("migrates a legacy flat shapes array into a default shape layer", function () {
    const out = window.Storage.migrateLayout({
      version: "1.4.0",
      sections: {},
      shapes: [{ id: "s1", path: "assets/shapes/star.webp" }],
    });
    assert.strictEqual(out.version, "1.5.0");
    assert.strictEqual(out.shapeLayers.length, 1);
    assert.strictEqual(out.shapeLayers[0].id, "shapes-default");
    assert.strictEqual(out.shapeLayers[0].elements.length, 1);
    assert.strictEqual(out.shapeLayers[0].elements[0].id, "s1");
  });

  it("preserves an existing shapeLayers array during migration", function () {
    const layers = [
      { id: "shapes-default", layerId: "print-enhance-shapes-layer", isLocked: true, elements: [] },
      { id: "shapes-extra", layerId: "print-enhance-layer-shapes-extra", elements: [] },
    ];
    const out = window.Storage.migrateLayout({ version: "1.4.0", sections: {}, shapeLayers: layers });
    assert.strictEqual(out.shapeLayers.length, 2);
    assert.strictEqual(out.shapeLayers[1].id, "shapes-extra");
  });

  it("ensures shapeLayers exists on legacy layouts without shapes", function () {
    const out = window.Storage.migrateLayout({ version: "1.4.0", sections: {} });
    assert.ok(Array.isArray(out.shapeLayers));
  });

  it("round-trips shape layers through saveLayout/loadLayout unchanged", async function () {
    const layout = {
      version: "1.5.0",
      sections: {},
      shapeLayers: [
        { id: "shapes-default", elements: [{ id: "shape-1", assetPath: "a.webp" }] },
      ],
    };
    await window.Storage.saveLayout("CHAR-1", layout);
    const loaded = await window.Storage.loadLayout("CHAR-1");
    assert.strictEqual(loaded.shapeLayers[0].elements[0].id, "shape-1");
  });
});

/* ------------------------------------------------------------------ */
/* c53611f / 172547e — stability pins + controls-state safety          */
/* ------------------------------------------------------------------ */
describe("E4 c53611f/172547e — stability of the phase-3 surface", function () {
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

  it("keeps creating distinct shapes after repeated calls", async function () {
    this.timeout(5000);
    const ids = [];
    for (let i = 0; i < 3; i++) {
      ids.push(
        window.createShape("assets/shapes/star.webp").querySelector(".be-shape-container").id,
      );
      // createShape ids embed Date.now() (ms resolution) — give the clock room to tick
      await new Promise((r) => setTimeout(r, 5));
    }
    assert.strictEqual(new Set(ids).size, 3);
  });

  it("picker opens after shapes have been created (no leftover state)", async function () {
    window.PeDom = () => ({
      getLayerManager: () => ({
        activeLayerId: "shapes-default",
        refreshUI: () => {},
        getActiveLayerContainer: () => ({ element: document.body }),
      }),
    });
    window.createShape("assets/shapes/star.webp");
    const p = window.showShapePickerModal("", "assets/shapes/");
    p.catch(() => {});
    await new Promise((r) => setTimeout(r, 80));
    assert.ok(document.querySelector(".be-modal-overlay"));
  });

  it("exposes the documented window handles for testing", function () {
    ["createShape", "toggleShapesMode", "applyShapeAsset", "clearBorderStyles", "showFeedback"].forEach(
      (h) => assert.strictEqual(typeof window[h], "function", `${h} missing`),
    );
  });

  it("updateControlsState tolerates a missing layer manager", function () {
    assert.doesNotThrow(() => window.updateControlsState());
  });

  it("updateControlsState keeps the Add-Shape control disabled state in sync", function () {
    const lm = makeFakeLm([{ id: "shapes-default", label: "Shapes", isLocked: true }], []);
    wireLm(window, document, lm);
    assert.doesNotThrow(() => window.updateControlsState());
  });

  it("updateControlsState stays safe when the layer manager has no active layer id", function () {
    const lm = makeFakeLm([{ id: "shapes-default", label: "Shapes", isLocked: true }], []);
    delete lm.activeLayerId;
    wireLm(window, document, lm);
    assert.doesNotThrow(() => window.updateControlsState());
  });

  it("DomManager caches and reuses its LayerManager instance", function () {
    const b2 = bootRooted();
    const w2 = b2.window;
    let constructed = 0;
    const fakeLm = { createPanel() { constructed += 1; } };
    w2.LayerManager = class {
      constructor() {
        return fakeLm;
      }
    };
    const dom = w2.DomManager.getInstance();
    const first = dom.getLayerManager();
    const second = dom.getLayerManager();
    assert.strictEqual(first, second);
    assert.strictEqual(constructed, 1);
    b2.cleanup();
  });

  it("injectCloneButtons stays idempotent across repeated calls", function () {
    const html = `<!DOCTYPE html><html><body>
      <div class="be-section-wrapper">
        <div class="ct-subsection" id="sec-idem">
          <div class="print-section-header"><span>Idem</span></div>
        </div>
      </div>
    </body></html>`;
    const b2 = boot(html);
    b2.window.injectCloneButtons();
    b2.window.injectCloneButtons();
    const wrapper = b2.document.querySelector(".be-section-wrapper");
    assert.strictEqual(
      wrapper.querySelectorAll(".be-more-options-button").length,
      1,
      "trigger should not be duplicated",
    );
    assert.strictEqual(
      wrapper.querySelectorAll(".be-context-menu").length,
      1,
    );
    b2.cleanup();
  });
});

/* ------------------------------------------------------------------ */
/* bd2c1e4 — global Shapes Mode CSS/class interplay                    */
/* ------------------------------------------------------------------ */
describe("E4 bd2c1e4 — shapes-mode CSS/class interplay", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const html = `<!DOCTYPE html><html><head></head><body>
      <div id="print-layout-wrapper">
        <div class="be-section-wrapper"><div class="ct-subsection" id="s1"></div></div>
      </div>
    </body></html>`;
    const b = boot(html);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.PeDom = () => ({ getLayerManager: () => null });
  });
  afterEach(function () {
    cleanup();
  });

  it("print styles target locked layers for full opacity", function () {
    window.updatePrintStyles();
    const css = document.getElementById("be-print-z-style").textContent;
    assert.ok(css.includes(".be-layer-locked .be-section-wrapper"));
    assert.ok(css.includes(".be-layer-locked .be-shape-wrapper"));
  });

  it("active and lock classes never co-occur after toggles", function () {
    window.toggleShapesMode(true);
    window.toggleShapesMode(false);
    const active = document.body.classList.contains("be-shapes-mode-active");
    const locked = document.body.classList.contains("be-lock-shapes");
    assert.ok(active !== locked, `active=${active} locked=${locked}`);
  });

  it("activation records the mode class exactly once", function () {
    window.toggleShapesMode(true);
    window.toggleShapesMode(true);
    const classes = Array.from(document.body.classList);
    assert.strictEqual(
      classes.filter((c) => c === "be-shapes-mode-active").length,
      1,
    );
  });

  it("a full off->on->off cycle restores the default classes", function () {
    window.toggleShapesMode(false);
    const off = document.body.className;
    window.toggleShapesMode(true);
    window.toggleShapesMode(false);
    assert.strictEqual(document.body.className, off);
  });
});

/* ------------------------------------------------------------------ */
/* e935a4e — init default (superseded) and toggle mechanics            */
/* ------------------------------------------------------------------ */
describe("E4 e935a4e — default mode mechanics (today: OFF)", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.PeDom = () => ({ getLayerManager: () => null });
  });
  afterEach(function () {
    cleanup();
  });

  // e935a4e introduced "Default ON"; 1b625be (E5) superseded it to OFF.
  // Surviving mechanics pinned here so the refactor keeps them intact.
  it("boots without shapes mode active (superseded default is OFF)", function () {
    assert.ok(!document.body.classList.contains("be-shapes-mode-active"));
  });

  it("an unforced toggle from the default state activates the mode", function () {
    window.toggleShapesMode();
    assert.ok(document.body.classList.contains("be-shapes-mode-active"));
  });

  it("an unforced toggle pair returns to the default state", function () {
    window.toggleShapesMode();
    window.toggleShapesMode();
    assert.ok(!document.body.classList.contains("be-shapes-mode-active"));
  });

  it("explicit false wins after any earlier state", function () {
    window.toggleShapesMode(true);
    window.toggleShapesMode(false);
    assert.ok(!document.body.classList.contains("be-shapes-mode-active"));
  });
});
