"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "../..");
const APPLY_SRC = fs.readFileSync(path.join(ROOT, "js/layout_apply.js"), "utf8");
const SCAN_SRC = fs.readFileSync(path.join(ROOT, "js/layout_scan.js"), "utf8");

function createDom(html) {
  const dom = new JSDOM(html || "<!DOCTYPE html><html><head></head><body></body></html>", {
    url: "https://www.dndbeyond.com/characters/12345",
    runScripts: "dangerously",
  });
  return { dom, win: dom.window, doc: dom.window.document };
}

function bootScanApply(win) {
  win.safeLog = () => {};
  win.AssetCatalog = { ALL_BORDER_STYLES: ["no-border", "ability_border", "box_border", "spikes_border"] };
  win.SectionUtils = {
    getSanitizedContent(el) { return el.cloneNode(true); },
    getExtractionSelector() { return null; },
    findSectionTitle(el) { return el.dataset.title || "Title"; },
    refreshLayers() {},
  };
  win.__DDBStorage = { SCHEMA_VERSION: "1.6.0", init: async () => {}, getAllSpells: async () => [], migrateLayout: (d) => d, saveSpells: async () => {} };
  win.DomManager = { getInstance() { return { getLayerManager() { return null; } }; } };
  // scan then apply
  win.eval(SCAN_SRC);
  win.eval(APPLY_SRC);
  // publish aliases if not already
  if (!win.scanLayout && win.LayoutScan) win.scanLayout = win.LayoutScan.scanLayout;
  if (!win.applyLayout && win.LayoutApply) win.applyLayout = win.LayoutApply.applyLayout;
  if (!win.migrateLayout && win.LayoutScan) win.migrateLayout = win.LayoutScan.migrateLayout;
  // seams that applyLayout calls
  win.flagExtractableElements = () => {};
  win.SectionCloning = { renderExtractedSection: () => true };
  win.renderClonedSection = () => {};
  win.createSpellDetailSection = async () => null;
  win.createShape = () => {};
  win.updateLayoutBounds = () => {};
  win.updatePrintStyles = () => {};
  win.applyFontSize = (wrapper, size) => { if (wrapper && size) wrapper.style.fontSize = size; };
  win.Filters = { clearBorderStyles(el) { ["ability_border","box_border","spikes_border","no-border"].forEach(c=>el.classList.remove(c)); } };
  win.AiBorder = { renderBorderSvg(el, svg) { el._borderSvg = svg; } };
}

// ── applyLayout ─────────────────────────────────────────────────────────

describe("LayoutApply — applyLayout (js/layout_apply.js)", function () {
  let dom, win, doc;

  function resetDom() {
    const html = `<!DOCTYPE html><html><head></head><body>
      <div id="print-layout-wrapper"><div id="print-enhance-sections-layer"></div><div id="print-enhance-shapes-layer"></div></div>
      <div id="section-A" class="print-section-container" style="width:100px; height:80px;">
        <div class="print-section-content"><p>hello</p></div>
      </div>
    </body></html>`;
    const ctx = createDom(html);
    dom = ctx.dom; win = ctx.win; doc = ctx.doc;
    bootScanApply(win);
    const secA = doc.getElementById("section-A");
    const wrapper = doc.createElement("div");
    wrapper.className = "be-section-wrapper";
    wrapper.dataset.title = "Title-section-A";
    secA.parentNode.insertBefore(wrapper, secA);
    wrapper.appendChild(secA);
    global.window = win; global.document = doc;
  }

  afterEach(function () {
    try {
      dom.window.close();
    } catch {
      // a torn-down jsdom window may already be closed
    }
    delete global.window;
    delete global.document;
  });

  it("clears border style then re-adds from record + choke-point borderSvg", async function () {
    resetDom();
    const sec = doc.getElementById("section-A");
    sec.classList.add("spikes_border");
    let chokeArg = null;
    win.AiBorder.renderBorderSvg = (el, svg) => { chokeArg = svg; el._borderSvg = svg; };

    const layout = {
      version: "1.6.0",
      sections: {
        "section-A": {
          left: "5px", top: "6px", width: "200px", height: "150px",
          zIndex: "7", printZIndex: "7", fontSize: "12px",
          minimized: false, compact: false, noAutoScale: false,
          printHidden: true, borderStyle: "box_border", borderSvg: "<svg>hi</svg>",
          innerWidths: {},
        },
      },
      shapeLayers: [], clones: [], extractions: [], spell_details: [], merges: [], spell_cache: [],
    };
    await win.applyLayout(layout);
    assert.ok(!sec.classList.contains("spikes_border"), "old border must be cleared");
    assert.ok(sec.classList.contains("box_border"), "new border must be applied");
    assert.strictEqual(chokeArg, "<svg>hi</svg>");
    assert.strictEqual(sec.dataset.printHidden, "true");
    assert.strictEqual(sec.dataset.noAutoScale, undefined);
  });

  it("presence checks: empty zIndex clears inline zIndex (truthiness-bug guard)", async function () {
    resetDom();
    const wrapper = doc.querySelector(".be-section-wrapper");
    wrapper.style.zIndex = "999";
    const layout = {
      version: "1.6.0",
      sections: { "section-A": { left: "", top: "", zIndex: "", printZIndex: null, borderStyle: null, printHidden: false, innerWidths: {} } },
      shapeLayers: [], clones: [], extractions: [], spell_details: [], merges: [], spell_cache: [],
    };
    await win.applyLayout(layout);
    assert.strictEqual(wrapper.style.zIndex, "", "empty zIndex must CLEAR the inline value");
  });

  it("printHidden cleared when false (so undo re-enables section) and innerWidths cleared for absent keys", async function () {
    resetDom();
    const sec = doc.getElementById("section-A");
    sec.dataset.printHidden = "true";
    const row = doc.createElement("div"); row.className = "foo-row-header";
    const child = doc.createElement("div"); child.style.width = "300px"; row.appendChild(child);
    sec.querySelector(".print-section-content").appendChild(row);

    const layout = {
      version: "1.6.0",
      sections: { "section-A": { printHidden: false, borderStyle: null, innerWidths: {} } },
      shapeLayers: [], clones: [], extractions: [], spell_details: [], merges: [], spell_cache: [],
    };
    await win.applyLayout(layout);
    assert.strictEqual(sec.dataset.printHidden, undefined, "printHidden false must DELETE the dataset flag");
    assert.strictEqual(child.style.width, "", "innerWidths:{} must CLEAR previously-set child width");
  });

  it("minimized/compact toggling", async function () {
    resetDom();
    const sec = doc.getElementById("section-A");
    const content = sec.querySelector(".print-section-content");
    let layout = {
      version: "1.6.0",
      sections: { "section-A": { minimized: true, compact: true, printHidden: false, borderStyle: null } },
      shapeLayers: [], clones: [], extractions: [], spell_details: [], merges: [], spell_cache: [],
    };
    await win.applyLayout(layout);
    assert.strictEqual(sec.dataset.minimized, "true");
    assert.strictEqual(content.style.display, "none");
    assert.ok(sec.classList.contains("be-compact-mode"));

    layout = {
      version: "1.6.0",
      sections: { "section-A": { minimized: false, compact: false, printHidden: false, borderStyle: null } },
      shapeLayers: [], clones: [], extractions: [], spell_details: [], merges: [], spell_cache: [],
    };
    await win.applyLayout(layout);
    assert.strictEqual(sec.dataset.minimized, "false");
    assert.strictEqual(content.style.display, "flex");
    assert.ok(!sec.classList.contains("be-compact-mode"));
  });

  it("renders clones/extractions and creates shapes per-layer; legacy shapes fallback", async function () {
    resetDom();
    let cloneCalls = 0, extractCalls = 0, shapeCalls = 0;
    win.renderClonedSection = () => { cloneCalls++; };
    win.SectionCloning.renderExtractedSection = () => { extractCalls++; return true; };
    // shape per-layer path needs a layerManager mock
    const fakeLayer = { id: "shapes-default", layerId: "print-enhance-shapes-layer", isLocked: false, isHidden: false, isDisabledOnPrint: false };
    win.DomManager = {
      getInstance() {
        return {
          getLayerManager() {
            return {
              shapeLayers: [fakeLayer],
              sectionsLayer: { id: "sections", isLocked: false, isHidden: false, isDisabledOnPrint: false },
              getLayerById(id) { return fakeLayer.id === id ? fakeLayer : null; },
              addShapeLayer(name, data) { return data; },
              refreshUI() {},
              getActiveLayerContainer() { return null; },
            };
          }
        };
      }
    };
    // need to re-eval apply to capture new DomManager? No — apply reads DomManager at call time, so just updating win.DomManager is enough
    win.createShape = () => { shapeCalls++; };

    const layout = {
      version: "1.6.0",
      sections: {},
      shapeLayers: [
        { id: fakeLayer.id, name: "Layer 1", layerId: fakeLayer.layerId, isLocked: true, isHidden: false, isDisabledOnPrint: false, elements: [{ assetPath: "a.webp" }], label: "Layer 1" },
      ],
      layers: { activeLayerId: fakeLayer.id },
      clones: [{ id: "cl1" }],
      extractions: [{ id: "ex1" }],
      spell_details: [],
      merges: [],
      spell_cache: [],
    };
    await win.applyLayout(layout);
    assert.strictEqual(cloneCalls, 1);
    assert.strictEqual(extractCalls, 1);
    // shape path: for each element in shapeLayers
    assert.ok(shapeCalls >= 1, `shapeCalls should be >=1 got ${shapeCalls}`);

    // legacy fallback: shapeLayers absent, shapes present — createShape per shape
    shapeCalls = 0;
    // force the legacy branch by removing shapeLayers key and adding shapes
    const layout2 = {
      version: "1.6.0",
      sections: {},
      shapes: [{ assetPath: "legacy.webp" }],
      clones: [], extractions: [], spell_details: [], merges: [], spell_cache: [],
    };
    // ensure shapeLayers is not present so the first branch is skipped
    delete layout2.shapeLayers;
    // keep DomManager null-ish so first branch falsy, legacy branch runs
    win.DomManager = { getInstance() { return null; } };
    await win.applyLayout(layout2);
    assert.strictEqual(shapeCalls, 1, "legacy shapes should still create shapes");
  });

  it("null layout does not throw (migrateLayout returns falsy)", async function () {
    resetDom();
    win.__DDBStorage.migrateLayout = () => null;
    await win.applyLayout(null); // must not throw
  });

  it("restores merges for spell + group sources (merge-execute path)", async function () {
    resetDom();
    let merged = null;
    win.handleMergeSections = (src, tgt) => { merged = tgt.id; };
    win.createSpellDetailSection = async (name) => { const el = doc.createElement("div"); el.id = "spell-detail-" + name; return el; };
    const orig = doc.createElement("div"); orig.id = "group-1"; orig.className = "be-extractable"; doc.body.appendChild(orig);
    win.handleElementExtraction = async (el) => {
      if (el && el.id === "group-1") { const out = doc.createElement("div"); out.id = "extracted-group-1"; return out; }
      return null;
    };
    const tgt = doc.createElement("div"); tgt.id = "sec-T"; doc.body.appendChild(tgt);

    const layout = {
      version: "1.6.0",
      sections: {},
      shapeLayers: [], clones: [], extractions: [], spell_details: [], merges: [
        { source: { type: "spell", spellName: "Fireball" }, target: { type: "section", id: "sec-T" } },
        { source: { type: "group", originalId: "group-1", selector: "[class*=\"-group\"]", index: 0 }, target: { type: "section", id: "sec-T" } },
      ],
      spell_cache: [],
    };
    await win.applyLayout(layout);
    assert.strictEqual(merged, "sec-T", "at least one merge should execute via handleMergeSections");
  });

  it("warns when merge source missing (continue branch)", async function () {
    resetDom();
    win.createSpellDetailSection = async () => null;
    win.handleElementExtraction = async () => null;
    let warned = false;
    win.safeLog = (lvl) => { if (lvl === "warn") warned = true; };
    // sourceContainer will be null (spell detail returns null, group original missing), so continue before target resolve — warn not hit.
    // To hit the warn (targetInfo null but sourceContainer present), make spell succeed but target missing.
    const orig = doc.createElement("div"); orig.id = "group-ok"; orig.className = "be-extractable"; doc.body.appendChild(orig);
    win.handleElementExtraction = async (el) => {
      if (el && el.id === "group-ok") { const out = doc.createElement("div"); out.id = "extracted-ok"; return out; }
      return null;
    };
    const layout = {
      version: "1.6.0",
      sections: {},
      shapeLayers: [], clones: [], extractions: [], spell_details: [], merges: [
        { source: { type: "group", originalId: "group-ok" }, target: { type: "section", id: "no-such-target" } },
      ],
      spell_cache: [],
    };
    await win.applyLayout(layout);
    assert.ok(warned, "unresolvable target with valid source should warn");
  });
});
