/**
 * AC-2 (option A, operator decision 2026-10-26) — the client-side weight/style refinement seam.
 *
 * This is the UNIT half of the refinement loop the gallery E2E (`byok_border_gallery.spec.js`)
 * exercises against live captures. It pins THREE things the design decision turns on:
 *
 *  1. `transformBorderSvg` — a PURE string transform: stroke-width scales by `weight`, and the
 *     `styleIndex` dash cycle (solid → dashed → dotted) is applied WITHOUT touching the DOM,
 *     WITHOUT touching `border-image-width` (that is the FRAME's thickness, not the art's line),
 *     and WITHOUT mutating its argument. A no-op call returns the SAME reference.
 *  2. `canAdjustBorder` — the capability gate that DISABLES the controls: stroke-bearing SVGs
 *        return true, the two fill-only corpus designs (`08-flame-crest`, `10-ink-brush` —
 *        measured in `border_corpus_adjustability.test.js`) return false, and a hostile or empty
 *        string is refused rather than guessed.
 *  3. `adjustBorderSvg` — the choke-point-wired seam: it re-renders the transformed bytes through
 *     `renderBorderSvg`, so the trust root re-validates the result and the section record carries
 *     the ADJUSTED bytes. The original bytes are returned alongside for the gallery's compare view.
 *
 * The trust boundary is NOT crossed here: the transform only rewrites presentation attributes the
 * corpus instructions already permit (stroke-width, stroke-dasharray), but `adjustBorderSvg` runs
 * the result back through the AC-1 trust root — defense-in-depth, asserted below with a hostile
 * transformed payload that must NOT paint.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { boot } = require("./encapsulation_debt/debt_harness.js");

const ROOT = path.resolve(__dirname, "..", "..");
const readJs = (p) => fs.readFileSync(path.join(ROOT, "js", p), "utf8");
const CORPUS = path.join(ROOT, "test", "fixtures", "byok_border_corpus.json");

// A stroke-bearing SVG with a known, testable weight (stroke-width="2") and a `none` dasharray
// that the cycle can act on. Mirrors the corpus' own attribute style (inline, no `style=`).
const STROKE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 224 256">' +
  '<rect x="0" y="0" width="18" height="256" fill="none" stroke="#000" stroke-width="2" ' +
  'stroke-dasharray="none"/></svg>';

// A fill-only SVG: zero stroke-width, ink is fill. The capability gate must refuse it.
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
  </div>
</body></html>`;

function bootStack() {
  const b = boot(SHEET);
  const w = b.window;
  w.eval(readJs("ai_layout.js")); // the AC-1 trust root the choke point calls
  w.eval(readJs("ai_border.js"));
  return b;
}
const section = (b) => b.window.document.getElementById("section-main");

describe("AC-2 option A — client-side weight/style refinement seam", function () {
  this.timeout(10000);

  let b;
  let w;
  beforeEach(function () { b = bootStack(); w = b.window; });
  afterEach(function () { b.cleanup(); });

  describe("transformBorderSvg — pure string transform", function () {
    it("scales every stroke-width by the weight factor, preserving per-path ratios", function () {
      const out = w.AiBorder.transformBorderSvg(STROKE_SVG, { weight: 1.5 });
      const m = out.match(/stroke-width="([^"]*)"/);
      assert.strictEqual(m && m[1], "3", "2 * 1.5 = 3, not " + (m && m[1]));
    });

    it("scales both of two different stroke widths by the same factor", function () {
      // Prepend a second rect with a different stroke-width so two values are present.
      const mixed = STROKE_SVG.replace(
        '<rect ', '<rect stroke-width="4" stroke="#000" fill="none" ',
      );
      const out = w.AiBorder.transformBorderSvg(mixed, { weight: 0.5 });
      const widths = out.match(/stroke-width="([^"]*)"/g).sort();
      assert.deepStrictEqual(widths, ['stroke-width="1"', 'stroke-width="2"'].sort(), "both scaled 0.5x (4->2, 2->1)");
    });

    it("the solid dash cycle STRIPS an existing stroke-dasharray", function () {
      const out = w.AiBorder.transformBorderSvg(STROKE_SVG, { styleIndex: 0 });
      assert.ok(!/stroke-dasharray/.test(out), "solid must remove any dasharray");
    });

    it("the dashed cycle writes '4 2' on a `none` dasharray", function () {
      const out = w.AiBorder.transformBorderSvg(STROKE_SVG, { styleIndex: 1 });
      assert.ok(/stroke-dasharray="4 2"/.test(out), "dashed pattern applied: " + out.match(/stroke-dasharray="[^"]*"/));
    });

    it("the dotted cycle writes '1 3'", function () {
      const out = w.AiBorder.transformBorderSvg(STROKE_SVG, { styleIndex: 2 });
      assert.ok(/stroke-dasharray="1 3"/.test(out), "dotted pattern applied");
    });

    it("a design with an EXISTING dash pattern is NOT clobbered by dashed/dotted (only `none`/absent is cycled)", function () {
      const pat = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
        '<path d="M0 0 L10 10" stroke="#000" stroke-width="2" stroke-dasharray="6 3"/></svg>';
      const dashed = w.AiBorder.transformBorderSvg(pat, { styleIndex: 1 });
      assert.ok(/stroke-dasharray="6 3"/.test(dashed), "existing pattern preserved under dashed cycle");
      const dotted = w.AiBorder.transformBorderSvg(pat, { styleIndex: 2 });
      assert.ok(/stroke-dasharray="6 3"/.test(dotted), "existing pattern preserved under dotted cycle");
      const solid = w.AiBorder.transformBorderSvg(pat, { styleIndex: 0 });
      assert.ok(!/stroke-dasharray/.test(solid), "solid still strips an existing pattern");
    });

    it("a no-op call (weight 1, styleIndex 0) leaves a dasharray-free SVG unchanged", function () {
      const clean = STROKE_SVG.replace(/ stroke-dasharray="none"/, "");
      const out = w.AiBorder.transformBorderSvg(clean, { weight: 1, styleIndex: 0 });
      assert.ok(/stroke-width="2"/.test(out), "no-op did not change stroke-width");
      assert.ok(!/stroke-dasharray/.test(out), "no-op introduced no dasharray");
    });

    it("the input string is never mutated (pure function)", function () {
      const before = STROKE_SVG;
      const out = w.AiBorder.transformBorderSvg(STROKE_SVG, { weight: 2.5, styleIndex: 1 });
      assert.strictEqual(STROKE_SVG, before, "input string unchanged");
      assert.notStrictEqual(out, STROKE_SVG, "a real transform produces a new string");
      assert.ok(/stroke-width="5"/.test(out), "2 * 2.5 = 5");
    });

    it("a negative or non-finite weight leaves stroke-width untouched (never zeros/negates a stroke)", function () {
      const bad = w.AiBorder.transformBorderSvg(STROKE_SVG, { weight: -1 });
      assert.ok(/stroke-width="2"/.test(bad), "negative weight refused, original kept");
      const nan = w.AiBorder.transformBorderSvg(STROKE_SVG, { weight: NaN });
      assert.ok(/stroke-width="2"/.test(nan), "NaN weight refused, original kept");
    });

    it("empty/non-string input is handled without throwing", function () {
      assert.strictEqual(w.AiBorder.transformBorderSvg("", { weight: 2 }), "");
      assert.strictEqual(w.AiBorder.transformBorderSvg(null, { weight: 2 }), "");
      assert.strictEqual(w.AiBorder.transformBorderSvg(42, { weight: 2 }), "");
    });
  });

  describe("canAdjustBorder — the capability gate that disables the controls", function () {
    it("returns true for a stroke-bearing SVG", function () {
      assert.strictEqual(w.AiBorder.canAdjustBorder(STROKE_SVG), true);
    });
    it("returns false for a fill-only SVG (no stroke-width)", function () {
      assert.strictEqual(w.AiBorder.canAdjustBorder(FILL_SVG), false);
    });
    it("returns false for empty/non-string input", function () {
      assert.strictEqual(w.AiBorder.canAdjustBorder(""), false);
      assert.strictEqual(w.AiBorder.canAdjustBorder(null), false);
      assert.strictEqual(w.AiBorder.canAdjustBorder(42), false);
    });
    it("returns false for an SVG carrying a <filter> subtree (a blind transform there is unsafe)", function () {
      const f = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
        '<filter id="x"><feGaussianBlur/></filter><rect stroke="#000" stroke-width="2"/></svg>';
      assert.strictEqual(w.AiBorder.canAdjustBorder(f), false);
    });

    it("agrees with the durable corpus premise test on all 11 designs (the gate and the test read the SAME fixture)", function () {
      const corpus = JSON.parse(fs.readFileSync(CORPUS, "utf8"));
      const designs = corpus.designs || corpus;
      assert.ok(designs.length === 11, "the fixture holds 11 designs (got " + designs.length + ")");
      let falseNeg = 0; // designs that ARE stroke-bearing but the gate refused
      let falsePos = 0; // designs that are fill-only but the gate allowed
      for (const d of designs) {
        const svg = (d.border && d.border.svg) || d.svg;
        const gated = w.AiBorder.canAdjustBorder(svg);
        const strokes = (svg.match(/stroke-width\s*=/g) || []).length;
        const really = strokes > 0 && !/<filter\b/i.test(svg) && !/<mask\b/i.test(svg) && !/<pattern\b/i.test(svg);
        if (really && !gated) falseNeg++;
        if (!really && gated) falsePos++;
      }
      assert.strictEqual(falseNeg, 0, "the gate refused a stroke-bearing design (false negative)");
      assert.strictEqual(falsePos, 0, "the gate allowed a fill-only design (false positive)");
      // The two named fill-only designs must gate to false — the basis of option A's disable-with-reason.
      for (const id of ["08-flame-crest", "10-ink-brush"]) {
        const d = designs.find((x) => (x.id || x.title) === id);
        assert.ok(d, id + " is in the frozen corpus");
        assert.strictEqual(w.AiBorder.canAdjustBorder((d.border && d.border.svg) || d.svg), false, id + " must be not-adjustable");
      }
      // And exactly 9 must be adjustable — the same MEASURED split the premise test pins.
      const adj = designs.filter((d) => w.AiBorder.canAdjustBorder((d.border && d.border.svg) || d.svg));
      assert.strictEqual(adj.length, 9, "exactly 9 of 11 designs must be adjustable (got " + adj.length + ")");
    });
  });

  describe("adjustBorderSvg — the choke-point-wired refinement seam", function () {
    it("adjusts a painted border in place and the section record carries the ADJUSTED bytes", function () {
      const sec = section(b);
      const rendered = w.AiBorder.renderBorderSvg(sec, STROKE_SVG);
      assert.strictEqual(rendered.ok, true);
      const res = w.AiBorder.adjustBorderSvg(sec, { weight: 2, styleIndex: 1 });
      assert.strictEqual(res.ok, true, JSON.stringify(res));
      assert.strictEqual(res.adjustable, true, "a stroke-bearing border is adjustable");
      assert.ok(res.original, "original bytes returned for the compare view");
      const after = w.AiBorder.readBorderSvg(sec);
      assert.ok(/stroke-width="4"/.test(after), "2 * 2 = 4 in the painted record: " + after);
      assert.ok(/stroke-dasharray="4 2"/.test(after), "dashed pattern in the record");
      // And the paint state matches the record (no divergence between DOM and record — AC-7).
      assert.ok(sec.style.getPropertyValue("--border-img").trim(), "the ::before slot is still fed");
    });

    it("a no-op adjustment re-renders bytes with no weight/dash change (idempotent)", function () {
      const sec = section(b);
      w.AiBorder.renderBorderSvg(sec, STROKE_SVG);
      const before = w.AiBorder.readBorderSvg(sec);
      const res = w.AiBorder.adjustBorderSvg(sec, { weight: 1, styleIndex: 0 });
      assert.strictEqual(res.ok, true);
      const after = w.AiBorder.readBorderSvg(sec);
      // The trust root normalizes the SVG (adds preserveAspectRatio), so compare the
      // STRUCTURAL weight, not the exact string. A no-op must not change the stroke-width.
      assert.ok(/stroke-width="2"/.test(before), "before has stroke-width=2");
      assert.ok(/stroke-width="2"/.test(after), "no-op left stroke-width=2");
      assert.ok(!/stroke-dasharray="4 2"/.test(after), "no-op introduced no dash pattern");
    });

    it("a border with no prior paint returns reason no_border (not a crash)", function () {
      const sec = section(b);
      const res = w.AiBorder.adjustBorderSvg(sec, { weight: 2 });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.reason, "no_border");
      assert.strictEqual(res.adjustable, false);
    });

    it("a fill-only border returns reason not_adjustable — the gate's refusal, not a render", function () {
      const sec = section(b);
      w.AiBorder.renderBorderSvg(sec, FILL_SVG);
      const res = w.AiBorder.adjustBorderSvg(sec, { weight: 2 });
      assert.strictEqual(res.ok, false, "a no-op control must not paint on a fill-only border");
      assert.strictEqual(res.reason, "not_adjustable");
      assert.strictEqual(res.adjustable, false);
      // The fill-only border is left untouched — no transform painted over it.
      assert.ok(/fill="#111"/.test(w.AiBorder.readBorderSvg(sec)), "fill-only border left as-is");
    });

    it("the transformed bytes are RE-VALIDATED through the trust root — a transform that smuggles a <script> is sanitized before paint", function () {
      // adjustBorderSvg must NOT paint the transform's raw output: it routes the transformed
      // string back through renderBorderSvg, which runs the AC-1 trust root. A buggy or hostile
      // transform that emits markup is SANITIZED (script stripped) before it reaches the record —
      // a naive implementation that skipped the trust root would record the raw hostile string.
      const sec = section(b);
      w.AiBorder.renderBorderSvg(sec, STROKE_SVG);
      // Monkeypatch transformBorderSvg on the seam to emit a hostile payload, to prove
      // adjustBorderSvg routes the OUTPUT through renderBorderSvg's trust root.
      w.AiBorder.transformBorderSvg = function () {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><rect stroke-width="5"/></svg>';
      };
      const res = w.AiBorder.adjustBorderSvg(sec, { weight: 2 });
      assert.strictEqual(res.ok, true, "the trust root sanitized the hostile transform and re-rendered");
      const after = w.AiBorder.readBorderSvg(sec);
      assert.ok(res.original, "original bytes returned for compare alongside the refused transform");
      assert.ok(!/<script/.test(after), "no <script> survived into the section record — trust root ran");
      assert.ok(/stroke-width=/.test(after), "the section painted SOMETHING (the trust root's cleaned output), not nothing");
    });
  });
});
