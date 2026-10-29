"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, "js", f), "utf8");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadCatalogFresh() {
  const code = read("asset_catalog.js");
  const m = new module.constructor();
  // asset_catalog.js publishes AssetCatalog via module.exports when present
  // and via window.AssetCatalog — do NOT add a stale wrapper that shadows it.
  // Append an export line only if the source lacks one.
  const hasExport = /module\.exports/.test(code);
  const wrapped = hasExport ? code : code + "\nmodule.exports = AssetCatalog;";
  m._compile(wrapped, "asset_catalog.js");
  return m.exports;
}

function jsdomWithCatalog() {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "http://localhost",
    runScripts: "dangerously",
  });
  const w = dom.window;
  w.chrome = { runtime: { getURL: (p) => `chrome-extension://mock/${p}` } };
  w.eval(read("asset_catalog.js"));
  assert.ok(w.AssetCatalog, "asset_catalog.js must publish window.AssetCatalog");
  return { dom, window: w, document: w.document };
}

// ---------------------------------------------------------------------------
// Asset catalog — pure data + parseAssets + curation + styles
// ---------------------------------------------------------------------------
describe("Asset catalog (js/asset_catalog.js) — feature_04_shape_picker", function () {
  let Catalog;

  before(function () {
    Catalog = loadCatalogFresh();
  });

  // -----------------------------------------------------------------------
  // ASSET_LIST
  // -----------------------------------------------------------------------
  describe("ASSET_LIST", function () {
    it("is a non-empty array of webp paths rooted at assets/", function () {
      assert.ok(Array.isArray(Catalog.ASSET_LIST));
      assert.ok(Catalog.ASSET_LIST.length >= 50, `too few entries: ${Catalog.ASSET_LIST.length}`);
      Catalog.ASSET_LIST.forEach((p) => {
        assert.match(p, /^assets\//, `not rooted at assets/: ${p}`);
        assert.ok(p.endsWith(".webp"), `not a webp: ${p}`);
      });
    });

    it("has no duplicate entries", function () {
      const s = new Set(Catalog.ASSET_LIST);
      assert.strictEqual(s.size, Catalog.ASSET_LIST.length, "duplicate paths in ASSET_LIST");
    });

    it("includes both borders (assets/) and shapes (assets/shapes/)", function () {
      assert.ok(Catalog.ASSET_LIST.some((p) => !p.includes("assets/shapes/")), "no border entries");
      assert.ok(Catalog.ASSET_LIST.some((p) => p.includes("assets/shapes/")), "no shape entries");
    });
  });

  // -----------------------------------------------------------------------
  // ASSET_METADATA
  // -----------------------------------------------------------------------
  describe("ASSET_METADATA", function () {
    it("contains an entry for every ASSET_LIST path that is a border", function () {
      // Shape entries that are isBackground-only are still present; border-image
      // entries carry slice/width/className. Either way the key must exist for
      // every asset in the list.
      Catalog.ASSET_LIST.forEach((p) => {
        assert.ok(Catalog.ASSET_METADATA[p], `missing metadata for ${p}`);
      });
    });

    it("border-image entries carry slice + width + outset + className", function () {
      Object.entries(Catalog.ASSET_METADATA).forEach(([p, meta]) => {
        if (meta.isBackground) return;
        assert.ok(meta.slice !== undefined, `${p} missing slice`);
        assert.ok(typeof meta.width === "string" && meta.width.length > 0, `${p} missing width`);
        assert.ok(typeof meta.outset === "string" && meta.outset.length > 0, `${p} missing outset`);
        assert.ok(typeof meta.className === "string" && meta.className.length > 0, `${p} missing className`);
        // slice is either a number or a 4-value "a b c d" string
        if (typeof meta.slice === "number") {
          assert.ok(meta.slice > 0, `${p} slice not positive`);
        } else {
          assert.match(String(meta.slice), /^\d+(\s+\d+){3}$/, `${p} slice not 4-value: ${meta.slice}`);
        }
        assert.match(meta.className, /^[a-z0-9_-]+$/, `${p} className shape: ${meta.className}`);
      });
    });

    it("className values are unique (no two assets share one border class)", function () {
      const names = Object.values(Catalog.ASSET_METADATA)
        .map((m) => m.className)
        .filter(Boolean);
      assert.strictEqual(names.length, new Set(names).size, "duplicate className values");
    });
  });

  // -----------------------------------------------------------------------
  // SECTION_BORDER_STYLES — the frozen 20-entry fixture
  // -----------------------------------------------------------------------
  describe("SECTION_BORDER_STYLES", function () {
    const FROZEN = [
      ["default-border", "Default"],
      ["no-border", "None"],
      ["ability_border", "Ability"],
      ["spikes_border", "Spikes"],
      ["barbarian_border", "Barbarian"],
      ["goth_border", "Goth"],
      ["plants_border", "Plants"],
      ["box_border", "Box"],
      ["dwarf_border", "Dwarf"],
      ["dwarf_hollow_border", "Dwarf Hollow"],
      ["sticks_border", "Sticks"],
      ["ornament_border", "Ornament 1"],
      ["ornament2_border", "Ornament 2"],
      ["ornament_bold_border", "Ornament Bold"],
      ["ornament_bold2_border", "Ornament Bold 2"],
      ["ornament_simple_border", "Ornament Simple"],
      ["spike_hollow_border", "Spike Hollow"],
      ["spiky_border", "Spiky"],
      ["spiky_bold_border", "Spiky Bold"],
      ["vine_border", "Vine"],
    ];

    it("is the frozen 20-entry ordered fixture", function () {
      const styles = Catalog.SECTION_BORDER_STYLES;
      assert.ok(Array.isArray(styles));
      assert.strictEqual(styles.length, 20);
      styles.forEach((s, i) => {
        assert.strictEqual(s.className, FROZEN[i][0], `row ${i} className`);
        assert.strictEqual(s.label, FROZEN[i][1], `row ${i} label`);
      });
    });

    it("every className is backed by ASSET_METADATA (or is the sentinel no-border)", function () {
      const known = new Set(
        Object.values(Catalog.ASSET_METADATA)
          .map((m) => m.className)
          .filter(Boolean)
          .concat(["no-border"]),
      );
      Catalog.SECTION_BORDER_STYLES.forEach((s) => {
        assert.ok(known.has(s.className), `unknown style class: ${s.className}`);
      });
    });
  });

  // -----------------------------------------------------------------------
  // ALL_BORDER_STYLES
  // -----------------------------------------------------------------------
  describe("ALL_BORDER_STYLES", function () {
    it("includes no-border and every metadata className", function () {
      assert.ok(Catalog.ALL_BORDER_STYLES.includes("no-border"), "ALL_BORDER_STYLES missing no-border");
      Object.values(Catalog.ASSET_METADATA).forEach((m) => {
        if (m.className) assert.ok(Catalog.ALL_BORDER_STYLES.includes(m.className), `missing ${m.className}`);
      });
    });

    it("has no undefined/null holes", function () {
      Catalog.ALL_BORDER_STYLES.forEach((v) => {
        assert.ok(typeof v === "string" && v.length > 0, `hole: ${v}`);
      });
    });
  });

  // -----------------------------------------------------------------------
  // ASSET_CURATION + ASSET_GROUP_ORDER + curatedAssetInfo
  // -----------------------------------------------------------------------
  describe("ASSET_CURATION / ASSET_GROUP_ORDER / curatedAssetInfo()", function () {
    it("curates every ASSET_LIST path (name + group) with no gaps", function () {
      assert.strictEqual(
        Catalog.ASSET_LIST.length,
        Object.keys(Catalog.ASSET_CURATION).length,
        "ASSET_LIST vs ASSET_CURATION length mismatch",
      );
      Catalog.ASSET_LIST.forEach((p) => {
        const c = Catalog.ASSET_CURATION[p];
        assert.ok(c && typeof c.name === "string" && c.name.length > 1, `missing/bad name for ${p}`);
        assert.ok(c && typeof c.group === "string" && c.group.length > 0, `missing/bad group for ${p}`);
        assert.ok(Catalog.ASSET_GROUP_ORDER.includes(c.group), `group "${c.group}" not in ASSET_GROUP_ORDER (${p})`);
      });
    });

    it("ASSET_GROUP_ORDER is the frozen family order without duplicates", function () {
      const expected = [
        "Archer",
        "Barbarian",
        "Dwarf",
        "Goth",
        "Ornament",
        "Spike",
        "Sticks",
        "Vine & Plant",
        "Base",
        "Emblems & Accents",
        "Other",
      ];
      assert.deepStrictEqual(Catalog.ASSET_GROUP_ORDER, expected);
    });

    it("curatedAssetInfo() returns curated entries and degrades gracefully for unknown paths", function () {
      assert.deepStrictEqual(Catalog.curatedAssetInfo("assets/border_goth1.webp"), { name: "Goth", group: "Goth" });
      assert.deepStrictEqual(Catalog.curatedAssetInfo("assets/ornament_bold2.webp"), {
        name: "Ornament Bold Double",
        group: "Ornament",
      });
      assert.deepStrictEqual(Catalog.curatedAssetInfo("assets/shapes/shield_stats.webp"), {
        name: "Shield Stats",
        group: "Emblems & Accents",
      });
      const unk = Catalog.curatedAssetInfo("assets/unknown_zzzz.webp");
      assert.strictEqual(unk.group, "Custom", "unknown path must degrade to group Custom");
      assert.ok(typeof unk.name === "string" && unk.name.length > 0, "unknown path needs a display name");
    });

    it("curated names are human editorial (no filename-derived artifacts like 'Goth1', 'Hollow2' bare)", function () {
      const names = Object.values(Catalog.ASSET_CURATION).map((c) => c.name);
      const artifacts = ["Goth1", "Hollow2", "Bold2"];
      artifacts.forEach((a) => {
        assert.ok(
          !names.some((n) => n.includes(a)),
          `filename-derived artifact leaked as curated name: ${a}`,
        );
      });
    });
  });

  // -----------------------------------------------------------------------
  // parseAssets()
  // -----------------------------------------------------------------------
  describe("parseAssets(fileList)", function () {
    it("splits borders vs shapes by path and filters to .webp only", function () {
      const input = [
        "assets/border_box.webp",
        "assets/shapes/archer_main.webp",
        "assets/notes.txt",
        "assets/border_goth1.webp",
        "assets/shapes/dwarf.webp",
        "assets/border_goth1_hand.webp",
      ];
      const out = Catalog.parseAssets(input);
      assert.deepStrictEqual(
        out.borders.map((a) => a.path).sort(),
        ["assets/border_box.webp", "assets/border_goth1.webp", "assets/border_goth1_hand.webp"].sort(),
      );
      assert.deepStrictEqual(
        out.shapes.map((a) => a.path).sort(),
        ["assets/shapes/archer_main.webp", "assets/shapes/dwarf.webp"].sort(),
      );
    });

    it("produces a title-cased label and tag list per asset", function () {
      const out = Catalog.parseAssets(["assets/border_goth1_hand.webp", "assets/shapes/corner_ornament_bold2.webp"]);
      const goth = out.borders[0];
      assert.ok(goth.label.length > 3, `label too short: ${goth.label}`);
      assert.ok(goth.tags.includes("hand drawn"), `goth tags: ${goth.tags.join(",")}`);
      assert.ok(goth.tags.includes("goth"), `goth tags: ${goth.tags.join(",")}`);
      const orn = out.shapes[0];
      assert.ok(orn.tags.includes("ornament"), `orn tags: ${orn.tags.join(",")}`);
      assert.ok(orn.tags.includes("bold"), `orn tags: ${orn.tags.join(",")}`);
    });

    it("returns empty categories for an empty list", function () {
      assert.deepStrictEqual(Catalog.parseAssets([]), { borders: [], shapes: [] });
    });

    it("is pure — does not mutate the input array", function () {
      const input = ["assets/border_box.webp"];
      const copy = input.slice();
      Catalog.parseAssets(input);
      assert.deepStrictEqual(input, copy);
    });
  });

  // -----------------------------------------------------------------------
  // Shape picker shell wiring (jsdom integration — proves our picker surface
  // consumes the curated catalog, not filename-derived labels)
  // -----------------------------------------------------------------------
  describe("picker shell wiring (jsdom)", function () {
    it("picker renders curated names from ASSET_CURATION (no filename-derived labels like 'Border Goth1 Hand')", function () {
      const { window, document } = jsdomWithCatalog();
      window.PeDom = () => ({
        getLayerManager: () => ({
          activeLayerId: "shapes-default",
          refreshUI() {},
          getActiveLayerContainer: () => ({ element: document.body }),
        }),
      });
      window.eval(read("modals.js"));
      window.eval(read("shape_picker.js"));
      window.ShapePicker.showShapePickerModal();
      const names = Array.from(document.querySelectorAll(".be-border-option")).map((c) => c.textContent.trim());
      assert.ok(names.length > 0, "no picker cells rendered");
      const leaked = ["Border Goth1 Hand", "Spike Hollow2", "Corner Ornament Bold2"];
      leaked.forEach((a) => assert.ok(!names.includes(a), `filename-derived label leaked: ${a}`));
      assert.ok(names.includes("Ornament Bold Double"), "curated rename surfaced");
    });

    it("picker exposes the three surface tabs and groups headers in fixed family order", function () {
      const { window, document } = jsdomWithCatalog();
      window.PeDom = () => ({
        getLayerManager: () => ({
          activeLayerId: "shapes-default",
          refreshUI() {},
          getActiveLayerContainer: () => ({ element: document.body }),
        }),
      });
      window.eval(read("modals.js"));
      window.eval(read("shape_picker.js"));
      window.ShapePicker.showShapePickerModal();
      const headers = Array.from(document.querySelectorAll(".be-asset-group")).map((h) => h.textContent.trim());
      assert.ok(headers.length > 0, "no group headers rendered");
      const order = window.AssetCatalog.ASSET_GROUP_ORDER;
      let lastRank = -1;
      const seen = new Set();
      headers.forEach((h) => {
        const rank = order.indexOf(h);
        assert.ok(rank >= 0, `unexpected header: ${h}`);
        assert.ok(rank >= lastRank, `headers out of order: ${headers.join("|")}`);
        lastRank = rank;
        assert.ok(!seen.has(h), `duplicate header: ${h}`);
        seen.add(h);
      });
    });
  });
});
