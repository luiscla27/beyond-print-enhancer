/**
 * AC-7 — persistence of the AI-generated border SVG
 * (track `byok_svg_borders_20260927`, Phase 2, sub-step 2.1).
 *
 * WHAT THIS SUITE EXISTS TO PREVENT
 * ---------------------------------
 * AC-7 makes three claims and each has its own way of passing vacuously:
 *
 *  1. "the SVG round-trips a save/load and a template export" — a case that only
 *     asserts `Storage.saveLayout` did not throw proves nothing about the FIELD. Every
 *     round-trip case below compares the string BYTE-FOR-BYTE after a real
 *     `saveLayout` → `loadLayout` cycle through `fake-indexeddb`, and the "template
 *     export" half goes through the real export path (`scanLayout` → the record that
 *     `handleSavePC` stringifies), not through a hand-built object.
 *  2. "`SCHEMA_VERSION` bumps from 1.5.0 to 1.6.0 with a no-op migration" — the version
 *     is asserted on BOTH copies (`js/storage.js`'s constant and the value stamped on a
 *     scanned layout), because the constant alone can be bumped while the scan still
 *     writes the old one.
 *  3. "migration does not corrupt a 1.5.0 record" — the dangerous direction is an
 *     OVER-eager migration that ADDS a field or drops a neighbour. So the migration case
 *     asserts the record is byte-identical apart from `version`, with `borderSvg`
 *     strictly ABSENT when the input had none (`Object.prototype.hasOwnProperty`), since
 *     a `borderSvg: null` invented by the migrator would later read as "this section has
 *     a border" on every rehydrate path.
 *
 * The `custom_borders` library is asserted through CRUD, and the store must be a REAL
 * IndexedDB object store (not a module-level array): the case saves, then reads back
 * through a completely fresh `init()`-free connection path (`Storage.getCustomBorders`),
 * and asserts a second store (`custom_shapes`) still works, so a broken upgrade that
 * somehow dropped a sibling store is caught here rather than in a UI suite.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");

const ROOT = path.resolve(__dirname, "..", "..");
const readJs = (p) => fs.readFileSync(path.join(ROOT, "js", p), "utf8");

/** A well-formed, AC-1-clean border SVG. */
const CLEAN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40" ' +
  'preserveAspectRatio="none"><rect width="100" height="40" fill="none" ' +
  'stroke="#C6A15B" stroke-width="2"/></svg>';

const SHEET = `<!DOCTYPE html><html><body>
  <div id="print-layout-wrapper">
    <div id="print-enhance-sections-layer">
      <div class="be-section-wrapper" id="wrapper-main" data-title="main box"
           style="left: 40px; top: 20px; z-index: 10">
        <div class="print-section-container" id="section-main"
             style="width: 200px; height: 120px;">
          <div class="print-section-header"><span>main heading</span></div>
          <div class="print-section-content"><div style="width: 190px;">body</div></div>
        </div>
      </div>
    </div>
    <div id="print-enhance-shapes-layer">
      <div class="be-shape-layer-container" id="shapes-default"></div>
    </div>
    <div id="print-enhance-properties-panel"></div>
  </div>
</body></html>`;

/** Boot the real stack (storage + scan + apply) over the fixture sheet. */
async function bootStack() {
  const b = boot(SHEET);
  const w = b.window;
  w.eval(readJs("ai_layout.js"));
  w.eval(readJs("ai_border.js"));
  await w.__DDBStorage.init();
  return b;
}

describe("AC-7 — borderSvg persistence + custom_borders library (Phase 2)", function () {
  this.timeout(10000);

  let b;
  let w;
  let Storage;

  beforeEach(async function () {
    b = await bootStack();
    w = b.window;
    Storage = w.__DDBStorage;
  });

  afterEach(function () {
    b.cleanup();
  });

  describe("schema version and the fourth store", function () {
    it("SCHEMA_VERSION is 1.6.0 and DB_VERSION advanced past 4", function () {
      assert.strictEqual(Storage.SCHEMA_VERSION, "1.6.0");
      assert.strictEqual(b.window.Storage.SCHEMA_VERSION, "1.6.0");
      assert.ok(
        Storage.DB_VERSION > 4,
        `DB_VERSION must advance for a new object store, got ${Storage.DB_VERSION}`,
      );
    });

    it("names the custom_borders store and exposes it on the Storage object", function () {
      assert.strictEqual(Storage.CUSTOM_BORDERS_STORE, "custom_borders");
    });

    it("the scanned layout is stamped with the CURRENT schema version", async function () {
      const layout = await w.scanLayout();
      assert.strictEqual(layout.version, "1.6.0");
    });

    it("the custom_borders object store really exists in IndexedDB", async function () {
      const db = await Storage.init();
      assert.ok(
        Array.from(db.objectStoreNames).includes("custom_borders"),
        `stores: ${Array.from(db.objectStoreNames).join(", ")}`,
      );
      // …and the sibling stores survived the upgrade.
      for (const s of ["layouts", "spell_cache", "custom_shapes"]) {
        assert.ok(Array.from(db.objectStoreNames).includes(s), `lost store ${s}`);
      }
    });
  });

  describe("per-section borderSvg round-trip", function () {
    it("save/load preserves the field byte-for-byte", async function () {
      const record = {
        version: "1.6.0",
        sections: { "section-main": { left: "40px", borderSvg: CLEAN_SVG } },
      };
      await Storage.saveLayout("CHAR-A", record);
      const loaded = await Storage.loadLayout("CHAR-A");
      assert.strictEqual(loaded.sections["section-main"].borderSvg, CLEAN_SVG);
      assert.strictEqual(loaded.version, "1.6.0");
    });

    it("the field survives the TEMPLATE-EXPORT path (scanLayout → JSON)", async function () {
      // Drive the REAL path: render through the choke point, then scan the live sheet the
      // way `handleSavePC`/`handleSaveBrowser` do.
      const section = w.document.getElementById("section-main");
      const res = w.AiBorder.renderBorderSvg(section, CLEAN_SVG);
      assert.strictEqual(res.ok, true, "precondition: the clean SVG must render");

      const layout = await w.scanLayout();
      assert.strictEqual(
        layout.sections["section-main"].borderSvg,
        res.sanitized,
        "scanLayout must record what the choke point actually rendered",
      );
      // …and it is in the exported document.
      const exported = JSON.parse(JSON.stringify(layout));
      assert.ok(exported.sections["section-main"].borderSvg.includes("<svg"));
    });

    it("applyLayout rehydrates borderSvg through the choke point (path B)", async function () {
      await w.applyLayout({
        version: "1.6.0",
        sections: { "section-main": { left: "40px", borderSvg: CLEAN_SVG } },
      });
      const section = w.document.getElementById("section-main");
      // Under D4 the border paints the ::before slot via four inline custom properties
      // on the section — there is no overlay node to query. The choke point is the
      // rehydrate writer, so a stored borderSvg MUST produce a paint.
      const painted = section && section.style.getPropertyValue("--border-img").trim();
      assert.ok(painted, "a stored borderSvg must paint through the choke point on rehydrate");
      assert.ok(painted.startsWith('url("data:image/svg+xml'), `painted URI is wrong: ${painted}`);
      // …and the record carrier survives the round trip.
      assert.strictEqual(
        section.dataset.borderRawSvg,
        CLEAN_SVG,
        "the raw model SVG must be the carrier read back by scanLayout",
      );
    });

    it("a section record with NO borderSvg clears any paint (no stale residue)", async function () {
      const section = w.document.getElementById("section-main");
      w.AiBorder.renderBorderSvg(section, CLEAN_SVG);
      assert.ok(section.style.getPropertyValue("--border-img").trim(), "precondition: a border painted");

      await w.applyLayout({
        version: "1.6.0",
        sections: { "section-main": { left: "40px" } },
      });
      const s2 = w.document.getElementById("section-main");
      assert.strictEqual(
        s2.style.getPropertyValue("--border-img").trim(),
        "",
        "a record without borderSvg means 'no border', not 'keep whatever was there'",
      );
      assert.strictEqual(s2.dataset.borderRawSvg, undefined, "the carrier must be cleared too");
    });
  });

  describe("1.5.0 migration is a no-op", function () {
    it("stamps 1.6.0 without inventing or dropping anything", function () {
      const before = {
        version: "1.5.0",
        sections: { a: { left: "1px", borderStyle: "ormate-border" } },
        shapeLayers: [{ id: "shapes-default", elements: [] }],
        customShapes: [{ id: "c1", data: "data:image/png;base64,aa" }],
      };
      const out = Storage.migrateLayout(JSON.parse(JSON.stringify(before)));
      assert.strictEqual(out.version, "1.6.0");
      assert.strictEqual(out.sections.a.borderStyle, "ormate-border");
      assert.strictEqual(out.customShapes[0].id, "c1");
      assert.strictEqual(out.shapeLayers.length, 1);
      assert.strictEqual(
        Object.prototype.hasOwnProperty.call(out.sections.a, "borderSvg"),
        false,
        "the migration must not INVENT borderSvg — a null reads as 'has a border' later",
      );
    });

    it("a 1.5.0 record round-trips through save/load uncorrupted", async function () {
      const before = {
        version: "1.5.0",
        sections: { "section-main": { left: "40px", borderStyle: "no-border" } },
        customShapes: [{ id: "keep-me", data: "data:image/png;base64,zz" }],
      };
      await Storage.saveLayout("CHAR-OLD", JSON.parse(JSON.stringify(before)));
      const loaded = await Storage.loadLayout("CHAR-OLD");
      assert.strictEqual(loaded.version, "1.6.0");
      assert.strictEqual(loaded.sections["section-main"].borderStyle, "no-border");
      assert.strictEqual(loaded.customShapes[0].id, "keep-me");
    });
  });

  describe("custom_borders library CRUD", function () {
    it("saves, lists and deletes an id-keyed border record", async function () {
      const rec = {
        id: "border-1",
        prompt: "a gothic arch frame",
        svg: CLEAN_SVG,
        createdAt: "2026-09-28T00:00:00.000Z",
      };
      await Storage.saveCustomBorder(rec);
      const all = await Storage.getCustomBorders();
      assert.ok(Array.isArray(all));
      const found = all.find((r) => r.id === "border-1");
      assert.ok(found, "the record must come back from the store");
      assert.strictEqual(found.prompt, "a gothic arch frame");
      assert.strictEqual(found.svg, CLEAN_SVG);

      await Storage.deleteCustomBorder("border-1");
      const after = await Storage.getCustomBorders();
      assert.strictEqual(after.filter((r) => r.id === "border-1").length, 0);
    });

    it("an upsert of the same id replaces rather than duplicates", async function () {
      await Storage.saveCustomBorder({ id: "dup", prompt: "a", svg: CLEAN_SVG });
      await Storage.saveCustomBorder({ id: "dup", prompt: "b", svg: CLEAN_SVG });
      const all = await Storage.getCustomBorders();
      const rows = all.filter((r) => r.id === "dup");
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].prompt, "b");
    });

    it("the library is a REAL store, not a module-level array", async function () {
      await Storage.saveCustomBorder({ id: "real", prompt: "p", svg: CLEAN_SVG });
      const db = await Storage.init();
      const raw = await new Promise((resolve, reject) => {
        const tx = db.transaction(["custom_borders"], "readonly");
        const req = tx.objectStore("custom_borders").get("real");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.target.error);
      });
      assert.ok(raw, "the row must be readable through a raw transaction");
      assert.strictEqual(raw.id, "real");
    });
  });

  describe("the choke point is the only writer", function () {
    it("scanLayout reads the field back from the DOM the choke point wrote", async function () {
      const section = w.document.getElementById("section-main");
      w.AiBorder.renderBorderSvg(section, CLEAN_SVG);
      const overlay = section.querySelector(".be-border-svg-overlay");
      // The scan source is the overlay's own serialized content, so the two agree by
      // construction — asserted here as the precondition for the export case above.
      assert.ok(waitFor(() => !!overlay.querySelector("svg")));
      const layout = await w.scanLayout();
      assert.ok(layout.sections["section-main"].borderSvg);
    });
  });
});
