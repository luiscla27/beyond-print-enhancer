"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "../..");
const SCAN_SRC = fs.readFileSync(path.join(ROOT, "js/layout_scan.js"), "utf8");

// ── helpers ────────────────────────────────────────────────────────────────

function createDom(html) {
  const dom = new JSDOM(html || "<!DOCTYPE html><html><head></head><body></body></html>", {
    url: "https://www.dndbeyond.com/characters/12345",
    runScripts: "dangerously",
  });
  return { dom, win: dom.window, doc: dom.window.document };
}

function loadScan(win) {
  win.safeLog = () => {};
  win.AssetCatalog = { ALL_BORDER_STYLES: ["no-border", "ability_border", "box_border", "spikes_border", "circle_border"] };
  win.SectionUtils = {
    getSanitizedContent(el) { return el.cloneNode(true); },
    getExtractionSelector() { return null; },
    findSectionTitle(el) { return el.dataset.title || "Title"; },
  };
  win.AiBorder = { readBorderSvg: () => null };
  // minimal DomManager stub — scanLayout reads layerManager
  win.DomManager = {
    getInstance() {
      return {
        getLayerManager() { return null; },
      };
    },
  };
  win.__DDBStorage = {
    SCHEMA_VERSION: "1.6.0",
    init: async () => {},
    getAllSpells: async () => [],
  };
  win.eval(SCAN_SRC);
  assert.ok(win.LayoutScan, "js/layout_scan.js must publish LayoutScan");
  assert.ok(typeof win.scanLayout === "function" || typeof win.LayoutScan.scanLayout === "function");
  // window.* aliases are set by the module tail
  if (!win.scanLayout) win.scanLayout = win.LayoutScan.scanLayout;
  if (!win.migrateLayout) win.migrateLayout = win.LayoutScan.migrateLayout;
  if (!win.currentExtractionIds) win.currentExtractionIds = win.LayoutScan.currentExtractionIds;
}

function sectionHtml(id, extraClass, styles) {
  const cls = `print-section-container ${extraClass || ""}`.trim();
  const style = styles || "";
  return `
    <div class="be-section-wrapper" data-title="Title-${id}" style="left:10px; top:20px; z-index:5;">
      <div class="print-section-header"><span>Title-${id}</span></div>
      <div class="${cls}" id="${id}" style="${style}">
        <div class="print-section-content"><p>content ${id}</p></div>
      </div>
    </div>`;
}

// ── migrateLayout ────────────────────────────────────────────────────────

describe("LayoutScan — migrateLayout (js/layout_scan.js)", function () {
  let win;
  before(function () { const c = createDom(); win = c.win; loadScan(win); });

  it("returns falsy input as-is", function () {
    assert.strictEqual(win.migrateLayout(null), null);
    assert.strictEqual(win.migrateLayout(undefined), undefined);
  });

  it("unwraps wrapped template {data:{sections...}} into top-level", function () {
    const input = { version: "1.0.0", data: { sections: { a: { left: "0px" } }, foo: 1 } };
    const out = win.migrateLayout(input);
    assert.ok(out.sections, "sections should be lifted");
    assert.ok(out.foo === 1);
    assert.ok(!out.data, "wrapper data key should be deleted");
  });

  it("does not unwrap when sections already present", function () {
    const input = { version: "1.0.0", sections: { a: {} }, data: { sections: { b: {} } } };
    const orig = JSON.stringify(input.sections);
    win.migrateLayout(input);
    assert.strictEqual(JSON.stringify(input.sections), orig);
  });

  it("migrates legacy .gif to .webp in shapes and bumps version to 1.4.0", function () {
    const input = {
      version: "1.0.0",
      sections: {},
      shapes: [{ assetPath: "a.gif" }, { assetPath: "b.webp" }, { assetPath: "c.gif" }],
      merges: [],
    };
    const out = win.migrateLayout(input);
    assert.strictEqual(out.version, "1.4.0");
    assert.strictEqual(out.shapes[0].assetPath, "a.webp");
    assert.strictEqual(out.shapes[1].assetPath, "b.webp");
    assert.strictEqual(out.shapes[2].assetPath, "c.webp");
  });

  it("initialises merges:[] when absent", function () {
    const out = win.migrateLayout({ version: "1.6.0", sections: {}, shapes: [] });
    assert.ok(Array.isArray(out.merges));
  });

  it("lifts legacy associatedExtractions into merges (extractions, clones, sections)", function () {
    const input = {
      version: "1.6.0",
      sections: {
        "sec-A": { associatedExtractions: [{ type: "group", originalId: "g1" }] },
      },
      extractions: [
        { id: "ex1", associatedExtractions: [{ type: "group", originalId: "g2" }] },
      ],
      clones: [
        { id: "cl1", associatedExtractions: [{ type: "spell", spellName: "Fireball" }] },
      ],
      merges: [],
    };
    const out = win.migrateLayout(input);
    assert.strictEqual(out.merges.length, 3);
    assert.ok(!out.sections["sec-A"].associatedExtractions, "ligature removed from section");
    assert.ok(!out.extractions[0].associatedExtractions);
    assert.ok(!out.clones[0].associatedExtractions);
  });

  it("does not duplicate merges if already migrated", function () {
    const input = {
      version: "1.6.0",
      sections: {},
      merges: [{ source: { originalId: "g1" }, target: { id: "sec-A" } }],
      extractions: [{ id: "sec-A", associatedExtractions: [{ originalId: "g1" }] }],
    };
    const out = win.migrateLayout(input);
    assert.strictEqual(out.merges.length, 1, "should not duplicate existing merge");
  });
});

// ── scanLayout ──────────────────────────────────────────────────────────

describe("LayoutScan — scanLayout (js/layout_scan.js)", function () {
  let dom, win, doc;

  beforeEach(function () {
    const html = `<!DOCTYPE html><html><head></head><body>
      <div id="print-layout-wrapper">
        <div id="print-enhance-sections-layer"></div>
        <div id="print-enhance-shapes-layer"></div>
      </div>
    </body></html>`;
    const ctx = createDom(html);
    dom = ctx.dom; win = ctx.win; doc = ctx.doc;
    loadScan(win);
    global.window = win;
    global.document = doc;
    win.safeLog = () => {};
  });

  afterEach(function () {
    try {
      dom.window.close();
    } catch {
      // a torn-down jsdom window may already be closed
    }
    delete global.window;
    delete global.document;
  });

  it("scans a plain section with geometry, borderStyle, printHidden, innerWidths", async function () {
    doc.getElementById("print-layout-wrapper").insertAdjacentHTML("beforeend", sectionHtml("section-A", "", "width:100px; height:80px;"));
    const sec = doc.getElementById("section-A");
    sec.classList.add("ability_border");
    sec.dataset.printHidden = "true";
    // inner widths fixture
    const row = doc.createElement("div"); row.className = "foo-row-header";
    const child = doc.createElement("div"); child.style.width = "88px"; row.appendChild(child);
    sec.querySelector(".print-section-content").appendChild(row);

    const layout = await win.scanLayout();
    assert.ok(layout.sections["section-A"], "section-A should be in sections");
    const s = layout.sections["section-A"];
    assert.strictEqual(s.borderStyle, "ability_border");
    assert.strictEqual(s.printHidden, true);
    // print-section-content itself matches [class$="-content"], so the row is at cIdx=1
    assert.ok(Object.values(s.innerWidths).includes("88px"), `innerWidths should contain 88px, got ${JSON.stringify(s.innerWidths)}`);
    assert.strictEqual(s.left, "10px");
    assert.strictEqual(layout.version, "1.6.0");
  });

  it("records clones via sanitized html (not raw overlay) + borderSvg via choke point", async function () {
    let chokeArgs = null;
    win.AiBorder.readBorderSvg = (el) => { chokeArgs = el.id; return "<svg>border</svg>"; };
    win.SectionUtils.getSanitizedContent = (el) => {
      const c = el.cloneNode(true);
      // simulate sanitization: strip menu
      c.querySelectorAll("menu").forEach(e => e.remove());
      return c;
    };
    doc.getElementById("print-layout-wrapper").insertAdjacentHTML("beforeend", sectionHtml("clone-1", "be-clone", "width:120px;"));
    const clone = doc.getElementById("clone-1");
    clone.querySelector(".print-section-content").innerHTML = "<p>hello</p><menu>rm me</menu>";

    const layout = await win.scanLayout();
    assert.strictEqual(layout.clones.length, 1);
    assert.strictEqual(chokeArgs, "clone-1");
    assert.ok(layout.clones[0].borderSvg === "<svg>border</svg>");
    assert.ok(!layout.clones[0].html.includes("<menu>"), "sanitized html must not carry menu");
    assert.ok(layout.clones[0].html.includes("hello"));
  });

  it("records spell_details and extractions with selector resolution", async function () {
    win.SectionUtils.getExtractionSelector = () => ({ selector: ".foo", index: 2 });
    // spell detail
    doc.getElementById("print-layout-wrapper").insertAdjacentHTML("beforeend", sectionHtml("spell-1", "be-spell-detail", ""));
    const spell = doc.getElementById("spell-1");
    spell.closest(".be-section-wrapper").dataset.title = "Fireball";
    // extraction: needs an original in DOM for selector resolution
    const original = doc.createElement("div"); original.id = "orig-1"; original.className = "be-extractable"; doc.body.appendChild(original);
    doc.getElementById("print-layout-wrapper").insertAdjacentHTML("beforeend",
      `<div class="be-section-wrapper" data-title="Extracted" style="left:0; top:0; z-index:3;"><div class="print-section-container be-extracted-section" id="ex-1" data-original-id="orig-1" style="width:50px;"></div></div>`);

    const layout = await win.scanLayout();
    assert.strictEqual(layout.spell_details.length, 1);
    assert.strictEqual(layout.spell_details[0].spellName, "Fireball");
    // extraction precedence: be-extracted-section without spell-detail/clone/shape
    const ex = layout.extractions.find(e => e.id === "ex-1");
    assert.ok(ex, "ex-1 should be in extractions");
    assert.strictEqual(ex.selector, ".foo");
    assert.strictEqual(ex.index, 2);
  });

  it("skips transient drag ghosts and id-less nodes", async function () {
    // ghost: wrapper inside .be-drag-ghost
    const ghostWrap = doc.createElement("div"); ghostWrap.className = "be-drag-ghost";
    ghostWrap.innerHTML = `<div class="be-section-wrapper"><div class="print-section-container" id="ghost-id" style="width:10px;"></div></div>`;
    doc.body.appendChild(ghostWrap);
    // id-less node
    doc.getElementById("print-layout-wrapper").insertAdjacentHTML("beforeend",
      `<div class="be-section-wrapper"><div class="print-section-container" style="width:10px;">no id</div></div>`);

    const layout = await win.scanLayout();
    assert.ok(!layout.sections["ghost-id"] && !layout.clones.find(c => c.id === "ghost-id"), "ghost must be excluded");
    assert.strictEqual(Object.keys(layout.sections).length, 0);
  });

  it("captures merges with data-be-group-merge / data-be-spell-merge and skips ghost wrappers", async function () {
    const wrapper = doc.createElement("div");
    wrapper.className = "be-merge-wrapper";
    wrapper.setAttribute("data-be-group-merge", "group-1");
    wrapper.setAttribute("data-be-target-type", "section");
    wrapper.setAttribute("data-be-target-id", "sec-T");
    wrapper.setAttribute("data-be-target-selector", ".sec");
    wrapper.setAttribute("data-be-target-index", "0");
    wrapper.setAttribute("data-be-target-name", "Target");
    doc.body.appendChild(wrapper);
    const orig = doc.createElement("div"); orig.id = "group-1"; orig.className = "be-extractable"; doc.body.appendChild(orig);
    win.SectionUtils.getExtractionSelector = () => ({ selector: ".sec", index: 0 });

    // ghost wrapper should be skipped
    const ghost = doc.createElement("div");
    ghost.className = "be-merge-wrapper be-drag-ghost";
    ghost.setAttribute("data-be-group-merge", "group-2");
    ghost.setAttribute("data-be-target-type", "section");
    ghost.setAttribute("data-be-target-id", "sec-U");
    doc.body.appendChild(ghost);

    const layout = await win.scanLayout();
    assert.strictEqual(layout.merges.length, 1);
    assert.strictEqual(layout.merges[0].source.originalId, "group-1");
    assert.strictEqual(layout.merges[0].target.id, "sec-T");
  });

  it("isRecordedExtraction precedence: spell-detail / clone / shape are NOT extractions", function () {
    // direct predicate test via scan wiring
    const doc2 = doc;
    const mk = (cls, id) => {
      const el = doc2.createElement("div");
      el.id = id; el.className = `print-section-container ${cls}`;
      doc2.body.appendChild(el);
      return el;
    };
    const a = mk("be-extracted-section", "ex-a");
    const b = mk("be-extracted-section be-spell-detail", "ex-b");
    const c = mk("be-extracted-section be-clone", "ex-c");
    const d = mk("be-extracted-section be-shape", "ex-d");
    [a, b, c, d].forEach((el) => assert.ok(el.id, "fixture mounted"));
    // currentExtractionIds reads the same predicate synchronously
    const ids = win.currentExtractionIds();
    assert.ok(ids.includes("ex-a"), "plain extraction should be included");
    assert.ok(!ids.includes("ex-b"), "spell-detail extraction must not be in extractions[]");
    assert.ok(!ids.includes("ex-c"));
    assert.ok(!ids.includes("ex-d"));
  });

  it("currentExtractionIds is synchronous and agrees with scanLayout extractions", async function () {
    doc.getElementById("print-layout-wrapper").insertAdjacentHTML("beforeend",
      `<div class="be-section-wrapper"><div class="print-section-container be-extracted-section" id="ex-sync-1" style="width:10px;"></div></div>`);
    const syncIds = win.currentExtractionIds();
    const layout = await win.scanLayout();
    assert.deepStrictEqual(syncIds.sort(), layout.extractions.map(e => e.id).sort());
  });

  it("spell cache failure is tolerated (safeLog, no throw)", async function () {
    win.__DDBStorage.getAllSpells = async () => { throw new Error("db boom"); };
    let logged = false; win.safeLog = (lvl) => { if (lvl === "error") logged = true; };
    doc.getElementById("print-layout-wrapper").insertAdjacentHTML("beforeend", sectionHtml("section-OK", "", ""));
    const layout = await win.scanLayout();
    assert.ok(logged, "error should be logged");
    assert.ok(layout.sections["section-OK"], "scan should still return sections");
  });

  it("readBorder via choke point — null when Api absent, swallow throw", async function () {
    win.AiBorder = null;
    doc.getElementById("print-layout-wrapper").insertAdjacentHTML("beforeend", sectionHtml("section-NB", "", ""));
    let layout = await win.scanLayout();
    assert.strictEqual(layout.sections["section-NB"].borderSvg, null);
    // throw path
    win.AiBorder = { readBorderSvg() { throw new Error("choke boom"); } };
    layout = await win.scanLayout();
    assert.strictEqual(layout.sections["section-NB"].borderSvg, null);
  });
});
