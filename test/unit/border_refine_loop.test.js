/**
 * BEYOND-10 (SC-D2) — the AI border refinement LOOP, as a contract.
 *
 * WHAT THIS FILE IS
 * -----------------
 * The unit half of `conductor/tracks/beyond10_ai_border_refine_loop/spec.md`. Every case boots the REAL
 * production files into a jsdom window (`test/unit/encapsulation_debt/debt_harness.js`) and drives the
 * REAL nodes and the REAL seams: the properties panel's row, the refine surface's own buttons, the
 * `window.AiBorder` choke point, the section record through `window.scanLayout()`, and the rehydrate
 * path through `window.LayoutApply.applyLayout()`.
 *
 * The only thing this file substitutes is the unit harness's absent `js/dnd.js`: `window.scheduleAutosave`
 * is a counting spy in the cases that measure persist asks — the same seam `js/dom/layer_manager.js`
 * calls (BEYOND-9's `requestLayerPersist`), counted the same way that track's contract counted it.
 *
 * WHY AN ABSOLUTE PARAMETER MODEL (the case named "idempotent")
 * -----------------------------------------------------------
 * The shipped `adjustBorderSvg` transformed whatever was PAINTED, so 1.5x applied twice painted 2.25x
 * and the surface could not say what a border was set to. A refinement LOOP (AC-2) that only ratchets
 * is not a loop, and AC-3's "persist" is meaningless if the parameters exist nowhere. So the painted
 * bytes are always derived from the DESIGN: `data-border-base-svg` holds the design, and weight/style
 * are absolute. That is what makes re-applying the same weight a no-op, and what makes "compare"
 * (design vs refined) and "revert" (weight 1, style solid) one-liners instead of new state.
 *
 * WHAT RED LOOKS LIKE (measured before the implementation landed)
 * --------------------------------------------------------------
 * `js/border_refine.js` does not exist, `AiBorder.readBorderAdjust`/`restoreBorderAdjust` do not exist,
 * the properties panel has no refine row, `scanLayout` records no `borderAdjust`, and
 * `applyLayout` restores nothing of the kind — so every case below fails on its own assertion, not on
 * a shared crash.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");

const ROOT = path.resolve(__dirname, "..", "..");
const readJs = (p) => fs.readFileSync(path.join(ROOT, "js", p), "utf8");
const REFINE_FILE = path.join(ROOT, "js", "border_refine.js");

// A stroke-bearing design with a known weight (2) and a `none` dasharray the cycle can act on.
// Mirrors the corpus' own attribute style (inline attributes, no `style=`).
const DESIGN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 224 256">' +
  '<rect x="0" y="0" width="18" height="256" fill="none" stroke="#000" stroke-width="2" ' +
  'stroke-dasharray="none"/>' +
  '<rect x="0" y="0" width="8" height="256" fill="none" stroke="#000" stroke-width="1"/></svg>';

// A SECOND stroke-bearing design, so "select a variant" has something to select.
const LIBRARY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 224 256">' +
  '<rect x="0" y="0" width="24" height="256" fill="none" stroke="#111" stroke-width="4"/></svg>';

// A fill-only design: no stroke-width at all. The capability gate must refuse to refine it.
const FILL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">' +
  '<polygon points="64 0 128 128 0 128" fill="#111"/></svg>';

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
    <div id="print-enhance-properties-panel"></div>
  </div>
</body></html>`;

/**
 * Boot the real stack: the debt harness's extension-order boot, then the three modules the refinement
 * loop lives between. `js/border_refine.js` is eval'd only if it is on disk, so that a tree WITHOUT
 * the module produces thirteen readable assertion failures (one per case) instead of thirteen copies
 * of the same ENOENT.
 */
function bootStack() {
  const b = boot(SHEET);
  const w = b.window;
  w.eval(readJs("ai_layout.js")); // the AC-1 trust root the choke point calls
  w.eval(readJs("ai_border.js")); // the choke point + the pure transform
  if (fs.existsSync(REFINE_FILE)) w.eval(fs.readFileSync(REFINE_FILE, "utf8"));
  return b;
}

const section = (b) => b.window.document.getElementById("section-main");
const refineRoot = (b) =>
  b.window.document.querySelector("[data-be-border-refine]");

/** Apply a design through the choke point, exactly as every real apply path does. */
function paint(b, svg) {
  return b.window.AiBorder.renderBorderSvg(section(b), svg);
}

/** The painted design's first stroke-width, as a number (the assertion everybody needs). */
function firstStrokeWidth(svg) {
  const m = /stroke-width\s*=\s*"([\d.]+)"/.exec(String(svg || ""));
  return m ? Number(m[1]) : null;
}

describe("BEYOND-10 — AI border refinement loop", function () {
  this.timeout(20000);

  let b;
  let w;
  let saves;

  beforeEach(function () {
    b = bootStack();
    w = b.window;
    saves = 0;
    // The seam js/dom/layer_manager.js calls (BEYOND-9's requestLayerPersist). Counted, never
    // implemented by the test: the assertion is "the writer asked", not "the test saved".
    w.scheduleAutosave = () => {
      saves += 1;
    };
  });
  afterEach(function () {
    b.cleanup();
  });

  // ---------------------------------------------------------------------------------------------
  // AC-1 — the controls are exposed, on the surface that owns a section's border
  // ---------------------------------------------------------------------------------------------
  describe("AC-1 — the product exposes weight/style controls", function () {
    it("the properties panel offers a Refine AI border control exactly when the section carries one", function () {
      const panel = w.document.getElementById("print-enhance-properties-panel");
      const el = section(b);

      // No AI border yet: no refine affordance (a dead button on every section is not a control).
      w.PropertiesPanel.setActiveSection(el);
      w.PropertiesPanel.updatePropertiesPanel(panel);
      assert.strictEqual(
        panel.querySelector(".be-prop-border-refine"),
        null,
        "a section with no AI border must not offer a refine control",
      );

      paint(b, DESIGN_SVG);
      w.PropertiesPanel.setActiveSection(el);
      w.PropertiesPanel.updatePropertiesPanel(panel);
      const row = panel.querySelector(".be-prop-border-refine");
      assert.ok(row, "a section carrying an AI border must offer a refine control");
      assert.match(String(row.textContent), /refine/i);
    });

    it("the refine surface renders the weight steps and the style steps, and marks the live one", function () {
      paint(b, DESIGN_SVG);
      const root = w.BorderRefine.open(section(b));
      assert.ok(root, "open() must return the surface it built");
      assert.strictEqual(refineRoot(b), root, "the surface must be in the document");

      const weights = Array.from(root.querySelectorAll("[data-be-refine-weight]")).map((n) =>
        n.getAttribute("data-be-refine-weight"),
      );
      assert.deepStrictEqual(
        weights,
        ["0.5", "0.75", "1", "1.25", "1.5"],
        "the five weight steps, in order",
      );

      const styles = Array.from(root.querySelectorAll("[data-be-refine-style]")).map((n) =>
        n.getAttribute("data-be-refine-style"),
      );
      assert.deepStrictEqual(styles, ["solid", "dashed", "dotted"], "the three style steps, in order");

      // The live position is MARKED, not merely rendered: weight 1 / solid is the unrefined state.
      const pressed = root.querySelector('[data-be-refine-weight="1"]');
      assert.strictEqual(pressed.getAttribute("aria-pressed"), "true", "weight 1 is the live step");
      assert.strictEqual(
        root.querySelector('[data-be-refine-style="solid"]').getAttribute("aria-pressed"),
        "true",
        "solid is the live style",
      );
      assert.strictEqual(
        root.querySelector("[data-be-refine-reason]").textContent,
        "",
        "an adjustable border states no reason",
      );
    });

    it("a fill-only border DISABLES every control and says why, instead of shipping a no-op", function () {
      paint(b, FILL_SVG);
      const root = w.BorderRefine.open(section(b));

      const controls = Array.from(root.querySelectorAll("button[data-be-refine-weight], button[data-be-refine-style], [data-be-refine-regenerate]"));
      assert.ok(controls.length >= 9, "the surface did carry its controls: " + controls.length);
      assert.ok(
        controls.every((n) => n.disabled === true),
        "every adjustment control must be disabled on a border the transform cannot reach",
      );

      const reason = root.querySelector("[data-be-refine-reason]").textContent;
      assert.match(reason, /stroke/i, "the reason names what the design lacks: " + reason);

      const state = w.BorderRefine.getState();
      assert.strictEqual(state.adjustable, false);
      assert.strictEqual(state.reason, "not_adjustable");
    });
  });

  // ---------------------------------------------------------------------------------------------
  // AC-2 — select variant -> adjust parameters -> regenerate -> compare
  // ---------------------------------------------------------------------------------------------
  describe("AC-2 — the loop: select, adjust, regenerate, compare", function () {
    it("selecting a variant paints that variant through the choke point", async function () {
      paint(b, DESIGN_SVG);
      // A saved variant, written through the product's own library seam (real IndexedDB store).
      const saved = await w.AiBorder.saveBorder({ id: "lib-variant-1", svg: LIBRARY_SVG });
      assert.strictEqual(saved.ok, true, "the library write must succeed: " + JSON.stringify(saved));

      const root = w.BorderRefine.open(section(b));
      await waitFor(() => root.querySelectorAll("[data-be-refine-variant]").length > 1);
      const cells = Array.from(root.querySelectorAll("[data-be-refine-variant]")).map((n) =>
        n.getAttribute("data-be-refine-variant"),
      );
      assert.deepStrictEqual(cells, ["current", "lib-variant-1"], "the variants offered: " + cells);

      const clicked = root.querySelector('[data-be-refine-variant="lib-variant-1"]');
      clicked.click();

      const paintedNow = w.AiBorder.readBorderSvg(section(b));
      assert.strictEqual(
        firstStrokeWidth(paintedNow),
        4,
        "the library variant's own stroke is painted: " + paintedNow.slice(0, 80),
      );
      assert.strictEqual(w.BorderRefine.getState().variantId, "lib-variant-1");
    });

    it("regenerate paints the design derived from the chosen weight and style, and says so", function () {
      paint(b, DESIGN_SVG);
      const root = w.BorderRefine.open(section(b));

      root.querySelector('[data-be-refine-weight="1.5"]').click();
      root.querySelector('[data-be-refine-style="dashed"]').click();
      root.querySelector("[data-be-refine-regenerate]").click();

      const painted = w.AiBorder.readBorderSvg(section(b));
      assert.strictEqual(firstStrokeWidth(painted), 3, "2 * 1.5 = 3: " + painted.slice(0, 120));
      assert.match(painted, /stroke-dasharray="4 2"/, "the dashed cycle is painted");

      // The surface now shows the position it just painted.
      assert.strictEqual(
        root.querySelector('[data-be-refine-weight="1.5"]').getAttribute("aria-pressed"),
        "true",
      );
      assert.strictEqual(
        root.querySelector('[data-be-refine-style="dashed"]').getAttribute("aria-pressed"),
        "true",
      );

      const state = w.BorderRefine.getState();
      assert.strictEqual(state.weight, 1.5);
      assert.strictEqual(state.styleIndex, 1);
      assert.strictEqual(state.adjustable, true);
    });

    it("the parameters are ABSOLUTE: asking for 1.5x twice paints 1.5x, not 2.25x", function () {
      paint(b, DESIGN_SVG);
      const el = section(b);
      // The DESIGN as the trust root serialized it (it adds `preserveAspectRatio`, so compare against
      // what was actually painted, not against the input string).
      const design = w.AiBorder.readBorderSvg(el);

      w.BorderRefine.applyAdjust(el, { weight: 1.5, styleIndex: 0 });
      assert.strictEqual(firstStrokeWidth(w.AiBorder.readBorderSvg(el)), 3);

      w.BorderRefine.applyAdjust(el, { weight: 1.5, styleIndex: 0 });
      assert.strictEqual(
        firstStrokeWidth(w.AiBorder.readBorderSvg(el)),
        3,
        "a refinement loop re-derives from the DESIGN; a ratchet is not a loop",
      );

      // …and the design itself is still on the section, which is what makes that possible.
      assert.strictEqual(
        w.AiBorder.readBorderAdjust(el).base,
        design,
        "the design bytes are preserved beside the refined bytes",
      );
    });

    it("compare reports the design against the refined bytes, and whether they differ", function () {
      paint(b, DESIGN_SVG);
      const el = section(b);
      const design = w.AiBorder.readBorderSvg(el);
      w.BorderRefine.applyAdjust(el, { weight: 1.5, styleIndex: 2 });

      const cmp = w.BorderRefine.compare(el);
      assert.strictEqual(cmp.ok, true, JSON.stringify(cmp));
      assert.strictEqual(cmp.original, design, "compare holds the design");
      assert.strictEqual(firstStrokeWidth(cmp.refined), 3, "compare holds the refined artwork");
      assert.match(cmp.refined, /stroke-dasharray="1 3"/, "the dotted cycle is in the refined bytes");
      assert.strictEqual(cmp.differs, true, "the two byte strings differ");

      // The surface renders the comparison it just computed.
      const root = w.BorderRefine.open(el);
      root.querySelector("[data-be-refine-compare]").click();
      const diff = root.querySelector("[data-be-refine-diff]").textContent;
      assert.match(diff, /1\.5/, "the diff names the weight: " + diff);
      assert.match(diff, /dotted|1 3/, "the diff names the style: " + diff);
    });

    it("revert returns the artwork to the design bytes and the controls to 1x solid", function () {
      paint(b, DESIGN_SVG);
      const el = section(b);
      w.BorderRefine.applyAdjust(el, { weight: 1.5, styleIndex: 1 });
      assert.strictEqual(firstStrokeWidth(w.AiBorder.readBorderSvg(el)), 3);

      const root = w.BorderRefine.open(el);
      root.querySelector("[data-be-refine-revert]").click();

      const back = w.AiBorder.readBorderSvg(el);
      assert.strictEqual(firstStrokeWidth(back), 2, "the design's own weight is back");
      assert.doesNotMatch(back, /stroke-dasharray="4 2"/, "the dash cycle is gone");
      const state = w.BorderRefine.getState();
      assert.strictEqual(state.weight, 1);
      assert.strictEqual(state.styleIndex, 0);
    });
  });

  // ---------------------------------------------------------------------------------------------
  // AC-3 — session and settings
  // ---------------------------------------------------------------------------------------------
  describe("AC-3 — the adjustment persists in session and in settings", function () {
    it("every refine write asks the product's own debounced save seam", function () {
      paint(b, DESIGN_SVG);
      const el = section(b);

      assert.strictEqual(saves, 0, "painting a design is not a refinement write");
      w.BorderRefine.applyAdjust(el, { weight: 1.25, styleIndex: 0 });
      assert.strictEqual(saves, 1, "the refinement writer asks for a save (asked " + saves + ")");

      const root = w.BorderRefine.open(el);
      root.querySelector('[data-be-refine-weight="1.5"]').click();
      root.querySelector("[data-be-refine-regenerate]").click();
      assert.strictEqual(saves, 2, "the surface's regenerate asks too (asked " + saves + ")");
    });

    it("the section record carries the adjustment, so a reload has something to restore", async function () {
      paint(b, DESIGN_SVG);
      const design = w.AiBorder.readBorderSvg(section(b));
      w.BorderRefine.applyAdjust(section(b), { weight: 1.5, styleIndex: 1 });

      const layout = await w.scanLayout();
      const rec = layout.sections["section-main"];
      assert.ok(rec, "the record exists for the section");
      assert.strictEqual(firstStrokeWidth(rec.borderSvg), 3, "the RECORD carries the refined bytes");
      assert.ok(rec.borderAdjust, "the record carries the parameters: " + JSON.stringify(rec.borderAdjust));
      assert.strictEqual(rec.borderAdjust.weight, 1.5);
      assert.strictEqual(rec.borderAdjust.styleIndex, 1);
      assert.strictEqual(rec.borderAdjust.base, design, "…and the design they were derived from");
    });

    it("an unrefined section stores NO adjustment (the field is absent, not a no-op object)", async function () {
      paint(b, DESIGN_SVG);
      const layout = await w.scanLayout();
      assert.strictEqual(
        layout.sections["section-main"].borderAdjust,
        null,
        "an unrefined border owes the record nothing",
      );
    });

    it("a record's adjustment rehydrates: the refined bytes AND the parameters come back", async function () {
      paint(b, DESIGN_SVG);
      const design = w.AiBorder.readBorderSvg(section(b));
      w.BorderRefine.applyAdjust(section(b), { weight: 1.5, styleIndex: 2 });
      const layout = await w.scanLayout();
      const rec = layout.sections["section-main"];

      // Simulate the reload: a fresh section with no border and no adjustment of any kind.
      w.AiBorder.clearBorderSvg(section(b));
      assert.strictEqual(w.AiBorder.readBorderSvg(section(b)), null);
      assert.strictEqual(w.AiBorder.readBorderAdjust(section(b)).weight, 1);

      w.LayoutApply.applyLayout({ sections: { "section-main": rec } });

      const back = w.AiBorder.readBorderSvg(section(b));
      assert.strictEqual(firstStrokeWidth(back), 3, "the refined artwork is restored");
      const adj = w.AiBorder.readBorderAdjust(section(b));
      assert.strictEqual(adj.weight, 1.5, "the weight is restored");
      assert.strictEqual(adj.styleIndex, 2, "the style is restored");
      assert.strictEqual(adj.base, design, "the design is restored");
    });

    it("an undo snapshot carries the parameters, so undo restores artwork AND position", function () {
      // The undo path's own seam, driven directly: `snapshotSectionFlags` → `repairSectionFlags` is
      // what the product runs around a border mutation (js/ai_arrange.js), and a repair that forgot
      // the parameters would leave the surface claiming a weight the artwork no longer has.
      paint(b, DESIGN_SVG);
      w.BorderRefine.applyAdjust(section(b), { weight: 1.25, styleIndex: 1 });

      const snap = w.snapshotSectionFlags();
      assert.ok(snap["section-main"], "the snapshot covers the section");
      assert.ok(snap["section-main"].borderAdjust, "the snapshot carries the parameters");
      assert.strictEqual(snap["section-main"].borderAdjust.weight, 1.25);

      // The user refines further, then undoes: the record must go back to the SNAPSHOT's state.
      w.BorderRefine.applyAdjust(section(b), { weight: 0.5, styleIndex: 2 });
      const layout = { sections: { "section-main": { borderSvg: "x", borderAdjust: null } } };
      w.repairSectionFlags(layout, snap);
      assert.strictEqual(firstStrokeWidth(layout.sections["section-main"].borderSvg), 2.5, "the artwork is the snapshot's");
      assert.strictEqual(layout.sections["section-main"].borderAdjust.weight, 1.25, "…and so is the position");
      assert.strictEqual(layout.sections["section-main"].borderAdjust.styleIndex, 1);
    });

    it("the exported SETTINGS bundle carries the adjustment (AC-3's 'settings' half)", async function () {
      // The settings bundle's own collector embeds `scanLayout()`'s record verbatim
      // (js/persistence.js's collectSettingsBundle -> result.layout), and its importer runs the same
      // `applyLayout` the rehydrate case above drives. So this case proves the CARRY half against the
      // product's real collector, and the case above proves the RESTORE half against the product's
      // real restore loop: between them, an exported settings file round-trips a refinement.
      paint(b, DESIGN_SVG);
      w.BorderRefine.applyAdjust(section(b), { weight: 0.75, styleIndex: 2 });
      assert.ok(w.Persistence && typeof w.Persistence.collectSettingsBundle === "function");

      const bundle = await w.Persistence.collectSettingsBundle();
      const rec = bundle && bundle.layout && bundle.layout.sections["section-main"];
      assert.ok(rec, "the settings bundle carries the layout");
      assert.ok(rec.borderAdjust, "the settings bundle lost the adjustment: " + JSON.stringify(rec.borderAdjust));
      assert.strictEqual(rec.borderAdjust.weight, 0.75);
      assert.strictEqual(rec.borderAdjust.styleIndex, 2);
      assert.strictEqual(firstStrokeWidth(rec.borderSvg), 2 * 0.75, "…and the refined artwork beside it");
    });

    it("closing and reopening the surface shows the adjustment still in force (session)", function () {
      paint(b, DESIGN_SVG);
      const el = section(b);
      w.BorderRefine.applyAdjust(el, { weight: 1.25, styleIndex: 2 });

      const first = w.BorderRefine.open(el);
      assert.strictEqual(
        first.querySelector('[data-be-refine-weight="1.25"]').getAttribute("aria-pressed"),
        "true",
      );
      w.BorderRefine.close();
      assert.strictEqual(refineRoot(b), null, "close removes the surface");

      const second = w.BorderRefine.open(el);
      assert.strictEqual(
        second.querySelector('[data-be-refine-weight="1.25"]').getAttribute("aria-pressed"),
        "true",
        "the reopened surface reads the live parameters, not a stale default",
      );
      assert.strictEqual(
        second.querySelector('[data-be-refine-style="dotted"]').getAttribute("aria-pressed"),
        "true",
      );
    });
  });

  // ---------------------------------------------------------------------------------------------
  // The trust boundary the whole border module exists for
  // ---------------------------------------------------------------------------------------------
  describe("trust boundary — the refinement cannot become a laundering channel", function () {
    it("a hostile base in a record is REFUSED and nothing is painted", function () {
      paint(b, DESIGN_SVG);
      const el = section(b);
      const before = w.AiBorder.readBorderSvg(el);

      const res = w.AiBorder.restoreBorderAdjust(el, {
        base: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        weight: 1.5,
        styleIndex: 1,
      });
      assert.strictEqual(res.ok, false, "a script-bearing base must not be accepted: " + JSON.stringify(res));
      assert.strictEqual(res.reason, "rejected");
      assert.strictEqual(w.AiBorder.readBorderSvg(el), before, "the live artwork is untouched");
      assert.strictEqual(w.AiBorder.readBorderAdjust(el).weight, 1, "no parameter was recorded");
    });

    it("a weight that cannot be honoured is refused rather than approximating", function () {
      paint(b, DESIGN_SVG);
      const el = section(b);
      const before = w.AiBorder.readBorderSvg(el);

      const res = w.BorderRefine.applyAdjust(el, { weight: 0, styleIndex: 0 });
      assert.strictEqual(res.ok, false, "weight 0 would delete the art: " + JSON.stringify(res));
      assert.strictEqual(res.reason, "invalid_weight");
      assert.strictEqual(w.AiBorder.readBorderSvg(el), before, "the artwork is untouched");

      const nan = w.BorderRefine.applyAdjust(el, { weight: "heavier", styleIndex: 0 });
      assert.strictEqual(nan.ok, false);
      assert.strictEqual(nan.reason, "invalid_weight");
      assert.strictEqual(w.AiBorder.readBorderSvg(el), before);
    });

    it("refining a fill-only border through the seam refuses AND tells the user why", function () {
      // The surface disables its controls on a fill-only border (AC-1), so this is the defensive path
      // a future caller could still reach. It must refuse rather than paint, and it must SAY something:
      // a silent no-op is the failure mode the card complains about.
      const said = [];
      w.showFeedback = (msg, level) => said.push({ msg, level });
      paint(b, FILL_SVG);
      const el = section(b);
      const before = w.AiBorder.readBorderSvg(el);

      const res = w.BorderRefine.applyAdjust(el, { weight: 1.5, styleIndex: 1 });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.reason, "not_adjustable");
      assert.strictEqual(w.AiBorder.readBorderSvg(el), before, "the fill-only artwork is untouched");
      assert.strictEqual(said.length, 1, "the refusal is announced once: " + JSON.stringify(said));
      assert.match(said[0].msg, /stroke/i, "the message names the reason: " + said[0].msg);
      assert.strictEqual(said[0].level, "error");
    });
  });
});
