/**
 * Ornament contract (track ornament_symmetry_20260910) — spec.md AC-1, AC-2,
 * AC-3A..AC-3F.
 *
 * These are SHAPE tests, not visual ones: the geometry of the golden double
 * hairline and the corner terminations is numeric and pinned in the spec, so it
 * is asserted against the emitted stylesheet (js/ui_theme.js exports `css` and
 * the ornament primitives) instead of being re-parsed from source text.
 */

"use strict";

const assert = require("assert");
const theme = require("../../js/ui_theme.js");

const CSS = theme.css;
const ORN = theme.ornament;

/** The ornament layer only — everything between its banner and the print block
 *  that follows it, so the quiet/plain negative assertions cannot be satisfied
 *  or broken by unrelated rules elsewhere in the sheet. */
function ornamentRegion() {
  const start = CSS.indexOf("ORNAMENT LAYER");
  assert.ok(start > -1, "ornament layer banner present");
  const end = CSS.indexOf("Print reinforcement", start);
  assert.ok(end > start, "print reinforcement follows the ornament layer");
  return CSS.slice(start, end);
}

/** Every selector that receives an ornament pseudo-element layer. */

describe("ornament primitives (AC-1/AC-2)", function () {
  it("declares the geometry the spec pins: 6px gap, 12px arm, 5px diamond", function () {
    assert.strictEqual(ORN.gap, 6);
    assert.strictEqual(ORN.arm, 12);
    assert.strictEqual(ORN.diamond, 5);
  });

  it("uses only locked palette values — no new hex (AC-1/AC-2)", function () {
    const t = theme.tokens;
    assert.strictEqual(ORN.stroke, t.gold); // #C6A15B
    assert.strictEqual(ORN.highlight, t.goldHi); // #E9D6A4
    assert.strictEqual(ORN.innerPanel, t.hairGold); // #4A3E2B
    assert.strictEqual(ORN.innerModal, t.goldShadow); // #6B5A36
  });

  it("builds 4 layers per corner, 1px strokes, arms 12px (AC-2)", function () {
    const top = ORN.cornerLayers(ORN.corners.top);
    const all = ORN.cornerLayers(ORN.corners.all);
    assert.strictEqual(top.image.length, 8, "2 corners x 4 layers");
    assert.strictEqual(all.image.length, 16, "4 corners x 4 layers");
    assert.strictEqual(top.image.length, top.position.length);
    assert.strictEqual(top.image.length, top.size.length);
    // two gold arms + two goldHi highlight lines per corner
    assert.strictEqual(top.image.filter((x) => x.includes(ORN.stroke)).length, 4);
    assert.strictEqual(top.image.filter((x) => x.includes(ORN.highlight)).length, 4);
    // the arms are 12px long and exactly 1px thick
    assert.deepStrictEqual(top.size.slice(0, 4), [
      "12px 1px",
      "1px 12px",
      "12px 1px",
      "1px 12px",
    ]);
    // highlights are offset exactly 1px inward on both axes
    assert.deepStrictEqual(top.position.slice(0, 4), [
      "left 0 top 0",
      "left 0 top 0",
      "left 1px top 1px",
      "left 1px top 1px",
    ]);
    assert.deepStrictEqual(top.position.slice(4, 8), [
      "right 0 top 0",
      "right 0 top 0",
      "right 1px top 1px",
      "right 1px top 1px",
    ]);
  });

  it("never emits a stroke wider than 1px anywhere in the ornament layer (AC-1)", function () {
    const region = ornamentRegion();
    // no border/outline >= 2px (border-radius is not a rule and is excluded)
    const thick =
      /(?:border(?:-(?:top|right|bottom|left|width|style|color))?|outline(?:-width)?)\s*:\s*(?:[2-9]\d*px)/;
    assert.ok(!thick.test(region), "no thick border/outline");
  });

  it("the frame emitter never uses #C6A15B as a border colour (AC-1)", function () {
    // Scoped to the frame emitter: the ONLY other place gold is a stroke is the
    // 1px corner-stroke/diamond exception the amendment grants.
    const emitted = ORN.surfaces.full
      .map((sel, i) =>
        ORN.surface(
          sel,
          "0 6px 24px rgba(0,0,0,0.55)",
          i === 2 ? ORN.corners.all : ORN.corners.top,
          i === 2 ? ORN.innerModal : ORN.innerPanel,
        ),
      )
      .join("\n");
    const borderLines = emitted
      .split("\n")
      .filter((l) => /border(?!-color|-radius)\s*:/.test(l))
      .join("\n");
    assert.ok(!borderLines.includes(ORN.stroke),
      "#C6A15B never a frame border colour (only the 1px corner stroke)");
    assert.ok(!borderLines.includes(ORN.highlight), "goldHi is never a border colour");
    assert.strictEqual(
      (emitted.match(/border:\s*1px solid/g) || []).length,
      3,
      "each frame surface declares exactly one 1px border (rule C)",
    );
    assert.strictEqual(
      (emitted.match(/0 0 0 1px #0C0907/g) || []).length,
      3,
      "each frame surface gets the outer blind-tool ring",
    );
  });
});

describe("AC-1 — double hairline with a leather gap, per full surface", function () {
  const surfaces = [
    {
      name: "control panel",
      head: "#print-enhance-controls {",
      buffer: ["12px 0 0 #120D0A", "13px 0 0 #4A3E2B"],
      inner: "#4A3E2B",
      after: "#print-enhance-controls::before",
    },
    {
      name: "layer manager",
      head: "#print-enhance-layer-manager,",
      buffer: ["-12px 0 0 #120D0A", "-13px 0 0 #4A3E2B"],
      inner: "#4A3E2B",
      after: "#print-enhance-layer-manager::before",
    },
    {
      name: "modal shell",
      head: ".be-modal {",
      buffer: [],
      inner: "#6B5A36",
      after: ".be-modal::before",
    },
  ];

  it("puts the outer blind tool (rule A) OUTSIDE the hairline (rule B)", function () {
    const region = ornamentRegion();
    for (const s of surfaces) {
      const i = region.indexOf(s.head);
      assert.ok(i > -1, s.name + " has an ornament surface block");
      const block = region.slice(i, region.indexOf("}", i));
      assert.ok(
        /box-shadow:\s*0 0 0 1px #0C0907,/.test(block),
        s.name + " opens its box-shadow with the 1px #0C0907 blind-tool ring",
      );
      assert.ok(
        /border-color:\s*#4A3E2B\s*!important/.test(block),
        s.name + " carries the #4A3E2B hairline as its border",
      );
      for (const b of s.buffer) {
        assert.ok(block.includes(b), s.name + " keeps its workbench buffer entry " + b);
      }
    }
  });

  it("insets rule C 6px from the border box (inset 5px of the 1px-bordered padding box)", function () {
    for (const s of surfaces) {
      const i = CSS.indexOf(s.after);
      assert.ok(i > -1, s.name + " emits its rule-C pseudo-element");
      const block = CSS.slice(i, CSS.indexOf("}", i));
      assert.ok(/inset:\s*5px/.test(block), s.name + " rule C at inset 5px");
      assert.ok(new RegExp(`border:\\s*1px solid ${s.inner}`).test(block),
        s.name + " rule C is 1px " + s.inner);
      assert.ok(/pointer-events:\s*none/.test(block), s.name + " rule C is inert");
      assert.ok(/border-radius:\s*6px/.test(block), s.name + " rule C follows the radius");
    }
  });

  it("keeps the three rules distinct 1px, never a fill (AC-1)", function () {
    const region = ornamentRegion();
    assert.strictEqual(
      (region.match(/0 0 0 1px #0C0907/g) || []).length,
      3,
      "exactly three surfaces carry the rule-A blind-tool ring",
    );
    assert.strictEqual(
      (region.match(/border-color: #4A3E2B/g) || []).length,
      3,
      "exactly three surfaces carry the rule-B hairline",
    );
  });
});

describe("AC-2 — corner terminations", function () {
  it("gives the modal all 4 corners and each docked panel the top 2 only", function () {
    assert.deepStrictEqual(ORN.corners.all, ["tl", "tr", "bl", "br"]);
    assert.deepStrictEqual(ORN.corners.top, ["tl", "tr"]);
    const region = ornamentRegion();
    const modal = region.slice(region.indexOf(".be-modal::after"));
    assert.ok(modal.includes("bottom 0"), "modal has bottom corner arms");
    assert.ok(modal.includes("left 0 top 0") && modal.includes("right 0 top 0"));
    const panel = region.slice(
      region.indexOf("#print-enhance-controls::after"),
      region.indexOf("#print-enhance-layer-manager,"),
    );
    assert.ok(!panel.includes("bottom 0"), "docked panel has NO bottom corner arms");
  });

  it("draws the L on a layer above rule C, in the same inset box (AC-3F)", function () {
    const region = ornamentRegion();
    const before = region.slice(
      region.indexOf("#print-enhance-controls::before"),
      region.indexOf("#print-enhance-controls::after"),
    );
    const after = region.slice(
      region.indexOf("#print-enhance-controls::after"),
      region.indexOf("#print-enhance-layer-manager,"),
    );
    assert.ok(/inset:\s*5px/.test(before) && /inset:\s*5px/.test(after),
      "both layers share the inset box, so the L lands on rule C's corner");
    assert.ok(!/border\s*:/.test(after), "the L layer is stroke-free (backgrounds only)");
    assert.ok(/background-image:/.test(after));
    // The L's own box must be SQUARE: a radius clips its corner into two
    // detached stubs (caught by the raw-pixel probe on 2026-09-10).
    assert.ok(/border-radius:\s*0/.test(after),
      "the L layer has no radius, so the 12px arms actually meet");
    assert.ok(/border-radius:\s*6px/.test(before),
      "rule C keeps the inner radius, so the L reads as capping its corner");
  });
});

describe("AC-3 — ornament hierarchy", function () {
  it("declares three disjoint surface sets (muse_review_2 step 2)", function () {
    const { full, quiet, plain } = ORN.surfaces;
    const seen = new Map();
    for (const [set, list] of [["full", full], ["quiet", quiet], ["plain", plain]]) {
      for (const sel of list) {
        assert.ok(!seen.has(sel), `${sel} appears in both ${seen.get(sel)} and ${set}`);
        seen.set(sel, set);
      }
    }
    assert.ok(full.length === 3 && quiet.length === 3 && plain.length >= 5);
  });

  it("ornaments ONLY the full set (AC-3D/AC-3E negative predicates)", function () {
    const region = ornamentRegion();
    const { quiet, plain } = ORN.surfaces;
    for (const sel of [...quiet, ...plain]) {
      assert.ok(!region.includes(sel), sel + " must not appear in the ornament layer");
    }
  });

  it("AC-3A keeps the panels' primary diamond construction unchanged", function () {
    for (const sel of [".be-ctl-topbar::before", ".be-layer-panel-header::before"]) {
      const i = CSS.indexOf(sel);
      assert.ok(i > -1, sel + " still emitted");
      const block = CSS.slice(i, CSS.indexOf("}", i));
      assert.ok(/width:\s*5px/.test(block) && /height:\s*5px/.test(block));
      assert.ok(/background:\s*#6B5A36/.test(block), "diamond fill is goldShadow");
      assert.ok(/border:\s*1px solid #C6A15B/.test(block), "diamond stroke is 1px gold");
      assert.ok(/rotate\(45deg\)/.test(block));
    }
  });

  it("AC-3B gives the modal the same primary ornament on a header rule", function () {
    for (const sel of [".be-modal > h3::before", ".be-modal > h3::after"]) {
      assert.ok(CSS.includes(sel), sel + " emitted (O-4 = B1)");
    }
    const diamond = CSS.slice(
      CSS.indexOf(".be-modal > h3::before"),
      CSS.indexOf("}", CSS.indexOf(".be-modal > h3::before")),
    );
    assert.ok(/width:\s*5px/.test(diamond) && /height:\s*5px/.test(diamond));
    assert.ok(/background:\s*#6B5A36/.test(diamond));
    assert.ok(/border:\s*1px solid #C6A15B/.test(diamond));
    assert.ok(/rotate\(45deg\)/.test(diamond));
    assert.ok(/left:\s*50%/.test(diamond), "centred like the panel diamonds");
    const rule = CSS.slice(
      CSS.indexOf(".be-modal > h3::after"),
      CSS.indexOf("}", CSS.indexOf(".be-modal > h3::after")),
    );
    assert.ok(rule.includes("#0C0907") && rule.includes("#4A3E2B"),
      "the modal header rule is the same blind-tooled pair the panels use");
  });

  it("AC-3C drops the primary ornament in both compressed states", function () {
    const region = ornamentRegion();
    for (const sel of [
      ".be-layer-panel.minimized::before",
      ".be-layer-panel.minimized::after",
      ".be-layer-panel.minimized .be-layer-panel-header::before",
      ".be-layer-panel.minimized .be-layer-panel-header::after",
      ".be-ctl-collapsed .be-ctl-topbar::before",
    ]) {
      assert.ok(region.includes(sel), sel + " hidden in the compressed state");
    }
  });

  it("AC-3F hides the ornament surfaces in print", function () {
    const i = CSS.indexOf("Print reinforcement");
    const block = CSS.slice(i);
    assert.ok(/@media print/.test(block));
    for (const sel of [".be-modal-overlay", ".be-modal", ".be-context-menu", ".be-color-picker-popup"]) {
      assert.ok(block.includes(sel), sel + " hidden in print");
    }
  });
});
