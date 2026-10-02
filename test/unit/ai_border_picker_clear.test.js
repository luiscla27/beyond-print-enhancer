/**
 * R-1 (operator ruling 2026-10-01, track `byok_svg_borders_20260927`) —
 * picking a RASTER border CLEARS the AI border.
 *
 * THE DEFECT THIS FILE PINS
 * -------------------------
 * After D4 the AI border rides INLINE custom properties (`--border-img` + the three knobs)
 * plus `dataset.borderRawSvg`, set by the single writer `renderBorderSvg`. Inline beats
 * every stylesheet rule — so every raster-border path that only removed the border CLASS
 * (`Filters.clearBorderStyles` + `classList.add`) was a visual NO-OP on an AI-bordered
 * section: the user clicks "Spikes" and the AI border stays painted, and
 * `Filters.applyBorderStyle(section, "spikes_border")` (js/main.js), the properties-panel
 * picker (js/properties_panel.js:612), the catalog apply (js/catalog_service.js:116) and
 * the layout rehydrate (js/layout_apply.js:186) all funneled through that class-only clear.
 * `phase4_operator_ruling_owed.md` §3 R-1 listed it; the operator's ruling
 * (`phase4_operator_rulings_20261001.md` §1 R-1) chose: picking a raster border (or
 * "None") CLEARS the AI border.
 *
 * THE CONTRACT UNDER TEST
 * -----------------------
 * `Filters.clearBorderStyles` is the ONE clear every raster-border path already calls, so
 * the fix lives there: it also clears the AI border — through the choke point
 * (`window.AiBorder.clearBorderSvg`, resolved at CALL time) when the module is loaded, and
 * through a REMOVAL-ONLY mirror of the four properties + the dataset carrier when it is
 * not (a bare harness). Removal is not a paint: the AC-9 static guard bans WRITING
 * `--border-img` outside `js/ai_border.js`, and this suite asserts that invariant is
 * untouched by re-running the real choke point after the clear.
 *
 * "One picker, one winner", both directions:
 *   - raster pick on an AI-painted section  -> raster class paints, AI paint gone;
 *   - a record carrying `borderSvg` rehydrates through the choke point and WINS over a
 *     `borderStyle` in the same record (path B's order is unchanged: clear, class, then
 *     rehydrate) — asserted here so the fix cannot flip that precedence.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { boot } = require("./encapsulation_debt/debt_harness.js");

const ROOT = path.resolve(__dirname, "..", "..");
const readJs = (p) => fs.readFileSync(path.join(ROOT, "js", p), "utf8");

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

const CLEAN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40" ' +
  'preserveAspectRatio="none"><rect width="100" height="40" fill="none" ' +
  'stroke="#C6A15B" stroke-width="2"/></svg>';

/** The four inline properties `renderBorderSvg` writes (js/ai_border.js BORDER_IMAGE_PROPS). */
const PROPS = ["--border-img", "--border-img-slice", "--border-img-width", "--border-img-outset"];

const painted = (s) => Boolean(s && s.style.getPropertyValue("--border-img").trim());
const propsGone = (s) => PROPS.every((p) => !s.style.getPropertyValue(p).trim());

function bootStack() {
  const b = boot(SHEET);
  const w = b.window;
  w.eval(readJs("ai_layout.js"));
  w.eval(readJs("ai_border.js"));
  return b;
}

describe("R-1 — picking a raster border CLEARS the AI border (operator ruling 2026-10-01)", function () {
  this.timeout(10000);

  let b;
  let w;

  beforeEach(function () {
    b = bootStack();
    w = b.window;
  });

  afterEach(function () {
    b.cleanup();
  });

  const section = () => w.document.getElementById("section-main");

  /** A real raster style id from the product's own catalog (never a made-up class). */
  const rasterStyle = () =>
    (w.AssetCatalog && w.AssetCatalog.ALL_BORDER_STYLES || []).find(
      (s) => s && s !== "no-border",
    ) || "spikes_border";

  describe("the four raster-border sites, through the ONE clear they share", function () {
    it("applyBorderStyle (js/main.js's picker path) takes the AI border off and paints the raster", function () {
      const style = rasterStyle();
      const res = w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.strictEqual(res.ok, true, JSON.stringify(res));
      assert.ok(painted(section()), "positive control: the AI border must be painted first");
      assert.ok(section().dataset.borderRawSvg, "positive control: the record carrier must be set");

      w.Filters.applyBorderStyle(section(), style);

      assert.ok(
        section().classList.contains(style),
        "the picked raster class must be applied — the fix must not break the pick itself",
      );
      assert.ok(propsGone(section()), "all four inline custom properties must be gone");
      assert.strictEqual(
        section().dataset.borderRawSvg,
        undefined,
        "the dataset carrier must be gone — otherwise readBorderSvg still reports a border",
      );
      assert.strictEqual(
        w.AiBorder.hasBorderSvg(section()),
        false,
        "hasBorderSvg must report the cleared state",
      );
    });

    it('applyBorderStyle(section, "no-border") clears too — "None" is a pick, and one picker has one winner', function () {
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.ok(painted(section()));

      w.Filters.applyBorderStyle(section(), "no-border");

      assert.ok(propsGone(section()), '"no-border" must clear the inline properties');
      assert.strictEqual(section().dataset.borderRawSvg, undefined, "and the dataset carrier");
    });

    it("clearBorderStyles (properties_panel.js + catalog_service.js paths) clears on its own", function () {
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.ok(painted(section()));

      w.Filters.clearBorderStyles(section());

      assert.ok(propsGone(section()), "the shared clear must take the AI border off by itself");
      assert.strictEqual(section().dataset.borderRawSvg, undefined);
    });

    it("the choke point still owns the PAINT: after the clear, a fresh render repaints (round trip)", function () {
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      w.Filters.applyBorderStyle(section(), rasterStyle());
      assert.ok(propsGone(section()), "precondition: cleared");

      const res = w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);

      assert.strictEqual(res.ok, true, JSON.stringify(res));
      assert.ok(painted(section()), "re-applying an AI border must repaint through the choke point");
      assert.ok(section().dataset.borderRawSvg, "and restore the record carrier");
    });
  });

  describe("the bare-harness fallback (no window.AiBorder at call time)", function () {
    it("removal-only: props + dataset go, and nothing is written where the guard watches", function () {
      // Simulate a painted AI border in a harness that never loaded js/ai_border.js.
      delete w.AiBorder;
      const s = section();
      s.style.setProperty("--border-img", 'url("data:image/svg+xml;utf8,<svg/>")');
      s.style.setProperty("--border-img-slice", "24%");
      s.style.setProperty("--border-img-width", "28px");
      s.style.setProperty("--border-img-outset", "16px");
      s.dataset.borderRawSvg = CLEAN_SVG;

      w.Filters.clearBorderStyles(s);

      assert.ok(propsGone(s), "the fallback must remove all four properties");
      assert.strictEqual(s.dataset.borderRawSvg, undefined, "and the dataset carrier");
    });

    it("never throws when neither the module nor the style list is present", function () {
      delete w.AiBorder;
      const savedCatalog = w.AssetCatalog;
      try {
        // A bare element with NO catalog at all: the original contract (border classes
        // default to ["no-border"]) must survive the fix unchanged.
        delete w.AssetCatalog;
        const el = w.document.createElement("div");
        w.Filters.clearBorderStyles(el);
        w.Filters.applyBorderStyle(el, "some_border");
        assert.ok(el.classList.contains("some_border"));
      } finally {
        w.AssetCatalog = savedCatalog;
      }
    });
  });

  describe("path B precedence is unchanged: a record's borderSvg WINS over its borderStyle", function () {
    it("raster-only record on an AI-painted section -> AI paint gone, raster class paints", async function () {
      const style = rasterStyle();
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.ok(painted(section()));

      await w.applyLayout({
        version: "1.6.0",
        sections: { "section-main": { borderStyle: style } },
      });

      assert.ok(propsGone(section()), "the record carries no borderSvg, so the AI paint must not survive");
      assert.ok(
        section().classList.contains(style),
        "the record's raster borderStyle must paint",
      );
    });

    it("record carrying BOTH -> borderSvg rehydrates last and wins", async function () {
      const style = rasterStyle();
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);

      await w.applyLayout({
        version: "1.6.0",
        sections: { "section-main": { borderStyle: style, borderSvg: CLEAN_SVG } },
      });

      assert.ok(painted(section()), "borderSvg rehydrates after the class clear and wins");
      assert.ok(section().dataset.borderRawSvg, "via the choke point, not inline editing");
    });
  });
});
