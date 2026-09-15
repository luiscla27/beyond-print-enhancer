/**
 * The grip's GEOMETRY — the trimmed plate and the measured nudge.
 * (temp/archived/ISSUE_grip_box_overlaps_actions_bar_on_short_sections_20260914.md)
 *
 * WHY A UNIT CASE FOR SOMETHING SO VISUAL: the browser suite
 * (`test/browser_e2e/affordance_drag_hover_shadows.spec.js`) measures which control wins
 * one real pixel and cannot say WHY it lost. This file pins the placement RULE itself —
 * what the grip decides when its centred plate would swallow a control's centre — and
 * the cascade that carries that decision: three custom properties with the shipped values
 * as fallbacks, and a `translate` rather than a `top`.
 *
 * THE MEASURED SECTION IS THE FIXTURE. Every number below comes from the live demo sheet
 * at 1920x1080 with the decorative layers hidden through their own panel control
 * (`section-extra-tidbits-wrapper`, wrapper 151.5x62, action bar at top:8/left:8 with
 * 39x32 buttons, grip plate 34x26 centred). A unit test written against made-up geometry
 * would prove the algorithm follows a story nobody measured.
 */
"use strict";

const assert = require("assert");
const path = require("path");
const { JSDOM } = require("jsdom");

const dndPath = path.resolve(__dirname, "..", "..", "js", "dnd.js");

function freshModule() {
  delete require.cache[require.resolve(dndPath)];
  const prevWindow = global.window;
  global.window = {};
  try {
    return require(dndPath);
  } finally {
    global.window = prevWindow;
  }
}

/** `handleCss()` — the stylesheet the module installs, comments stripped so prose cannot
 *  satisfy an assertion about declarations. */
function handleCss() {
  const prevDocument = global.document;
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  global.document = dom.window.document;
  try {
    const dnd = freshModule();
    dnd.injectDnDStyles();
    return global.document
      .getElementById("ddb-print-dnd-style")
      .textContent.replace(/\/\*[\s\S]*?\*\//g, "");
  } finally {
    global.document = prevDocument;
  }
}

const baseBlock = (css) => css.match(/\.be-drag-handle\s*\{[\s\S]*?\}/)[0];

describe("Grip geometry — the trimmed plate and the nudge (ISSUE_grip_box_overlaps_actions_bar_on_short_sections_20260914)", function () {
  const dnd = freshModule();
  const { gripBandFor, GRIP_PLATE_W, GRIP_PLATE_H, GRIP_DOT_PLATE_PX } = dnd;

  // The MEASURED colliding wrapper and its bar, in the wrapper's own client coordinates.
  const TIDBITS = { w: 151.5, h: 62 };
  const BAR_BUTTONS = [
    { x: 8, y: 8, w: 39, h: 32 }, // 🎯 Select  — centre (27.5, 24)
    { x: 55, y: 8, w: 39, h: 32 }, // 👁 Toggle — centre (74.5, 24): THE swallowed one
  ];
  const centredPlateSwallows = (c) => {
    const x = (TIDBITS.w - GRIP_PLATE_W) / 2;
    const y = (TIDBITS.h - GRIP_PLATE_H) / 2;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    return cx > x && cx < x + GRIP_PLATE_W && cy > y && cy < y + GRIP_PLATE_H;
  };

  it("the shipped centred plate really does swallow a bar button's centre (the fixture is the bug)", function () {
    // NON-VACUITY FIRST: if the numbers below do not reproduce the reported collision, the
    // rest of this file is testing a geometry that does not exist.
    assert.ok(
      centredPlateSwallows(BAR_BUTTONS[1]),
      "the centred 34x26 plate covers the second button's centre — measured (74.5, 24)",
    );
    assert.ok(!centredPlateSwallows(BAR_BUTTONS[0]), "and not the first button's");
  });

  it("bands the plate to the dots' box and steps it clear of that centre, at the smallest shift", function () {
    const band = gripBandFor({ ...TIDBITS, controls: BAR_BUTTONS });
    assert.ok(band, "a colliding wrapper gets a band");
    assert.strictEqual(band.width, GRIP_DOT_PLATE_PX, "the plate becomes the dots' box");
    assert.strictEqual(band.height, GRIP_DOT_PLATE_PX);

    // The plate the band produces, resolved the way the stylesheet resolves it: centred
    // on both axes by `inset:0; margin:auto`, then displaced by `--be-grip-shift`.
    const top = (TIDBITS.h - band.height) / 2 + band.shift;
    const left = (TIDBITS.w - band.width) / 2;
    const ownsCentre = (c) => {
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      return cx > left && cx < left + band.width && cy > top && cy < top + band.height;
    };
    for (const c of BAR_BUTTONS) {
      assert.ok(!ownsCentre(c), `no control's centre is swallowed: ${JSON.stringify(c)}`);
    }
    // THE PRICE, pinned as a number rather than described: the promise is a CENTRED grip,
    // so the shift is what this fix pays and it must be the SMALLEST shift that works.
    // A candidate that cleared the row by going all the way below it costs 22px; 4 is the
    // measured minimum for this wrapper (the plate's top edge lands 2px under the row's
    // centre), and the ordering that puts NEAREST-TO-CENTRE before LEAST-COVERED is what
    // buys it.
    assert.strictEqual(band.shift, 4, "a 4px step, not a 22px move below the row");
    // And the plate may not leave the wrapper: the sheet clips it there, and a
    // half-painted affordance is worse than the collision (a real probe of a `top`-based
    // version put the plate 2px past a 62px wrapper's bottom edge).
    assert.ok(
      top >= 0 && top + band.height <= TIDBITS.h,
      `the banded plate stays inside the wrapper: y ${top}..${top + band.height} of ${TIDBITS.h}`,
    );
  });

  it("leaves every wrapper that is NOT colliding exactly as it shipped", function () {
    // The whole reason the trim is invisible in practice: a section whose centred plate
    // reaches no control's centre is not touched at all.
    assert.strictEqual(gripBandFor({ w: 400, h: 62, controls: BAR_BUTTONS }), null,
      "a wide 62px section: the plate never reaches the top-left bar");
    assert.strictEqual(gripBandFor({ ...TIDBITS, controls: [] }), null, "no controls at all");
    assert.strictEqual(gripBandFor({ w: 500, h: 400, controls: [BAR_BUTTONS[0]] }), null,
      "a document-sized section");
    assert.strictEqual(gripBandFor({ w: 0, h: 0, controls: BAR_BUTTONS }), null,
      "an unmeasurable wrapper is left alone, not banded to nonsense");
    // FALSIFIED: the same call on the colliding fixture DOES band — so the four nulls
    // above are a judgement about geometry, not a function that always returns null.
    assert.ok(gripBandFor({ ...TIDBITS, controls: BAR_BUTTONS }), "the fixture still bands");
  });

  it("bands by what a control's CENTRE needs, not by a wrapper-height constant", function () {
    // The issue's own estimate was "collides up to ~2*(8+32) = 80px". A 104px wrapper
    // with a TWO-ROW bar breaks that rule in both directions at once: it is TALLER than
    // 80px, and it still has two rows whose centres the plate reaches.
    const twoRows = [
      { x: 8, y: 8, w: 39, h: 32 },
      { x: 55, y: 8, w: 39, h: 32 },
      { x: 8, y: 48, w: 39, h: 32 },
      { x: 55, y: 48, w: 39, h: 32 },
    ];
    const band = gripBandFor({ w: 151.5, h: 104, controls: twoRows });
    assert.ok(band, "a 104px wrapper with a two-row bar is NOT assumed safe");
    const top = (104 - band.height) / 2 + band.shift;
    const left = (151.5 - band.width) / 2;
    for (const c of twoRows) {
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      assert.ok(
        !(cx > left && cx < left + band.width && cy > top && cy < top + band.height),
        `row button centre (${cx}, ${cy}) survives: plate y ${top}..${top + band.height}`,
      );
    }
  });

  it("carries the decision as custom properties whose fallbacks ARE the shipped plate", function () {
    const css = handleCss();
    const base = baseBlock(css);
    assert.match(base, /width:\s*var\(--be-grip-w,\s*34px\)\s*!important;/,
      "the plate's width reads the property, defaulting to the shipped 34px");
    assert.match(base, /height:\s*var\(--be-grip-h,\s*26px\)\s*!important;/,
      "…and its height, defaulting to 26px");
    assert.ok(
      !/--be-grip-[wh]:/.test(css.replace(/var\([^)]*\)/g, "")),
      "no rule SETS the sizes: only the placement pass does, so nothing can band a grip " +
        "by hand and survive a sync",
    );
    // The offset: `translate`, NOT `top`. With `inset:0` + `margin:auto` both edges are
    // pinned and a written `top` is SPLIT with the leftover space (measured: `top:
    // calc(50% + 9px)` on a 62px wrapper rendered at y 38, not 40) — so a `top` here
    // would silently misplace every banded grip by half its own shift.
    const shiftRule = css.match(/\.be-drag-handle\s*\{[^}]*\}/g).find((r) => /translate:/.test(r));
    assert.ok(shiftRule, "the offset is declared");
    assert.match(shiftRule, /translate:\s*0 var\(--be-grip-shift,\s*0px\)\s*!important;/,
      "…on the handle, defaulting to zero");
    assert.ok(!/\btop:/.test(css.match(/\.be-drag-handle\s*\{[\s\S]*?\}/)[0]),
      "the base rule writes no `top` at all");
    // No state class exists: the properties are the state, so a stale marker cannot
    // outlive the geometry it was written for.
    assert.ok(!/\.be-grip-band/.test(css), "there is no band class in the cascade");
  });

  it("keeps the plate's own hit area honest at rest, on reveal, and while held", function () {
    const css = handleCss();
    const base = baseBlock(css);
    // The trim is a SIZE, so `pointer-events` still needs no second mechanism: hidden
    // means unhittable, revealed means hittable, and both are the shipped rules.
    assert.match(base, /visibility:\s*hidden\s*!important;[\s\S]*pointer-events:\s*none\s*!important;/,
      "at rest: invisible and out of the hit test, whatever its size");
    const reveal = css.match(
      /\.be-active-layer [^{]*:hover [^{]*\.be-drag-handle[\s\S]*?pointer-events:\s*auto\s*!important;\s*\}/,
    );
    assert.ok(reveal, "the reveal still arms the pointer — the trim is a box, not a gate");
    assert.match(reveal[0], /visibility:\s*visible\s*!important;/);
    // The dots must never outgrow the trimmed plate: `ensureDragHandle` asks for a 12px
    // glyph and a replaced flex child can be grown by its layout.
    const svgRule = css.match(/\.be-drag-handle svg\s*\{[^}]*\}/)[0];
    assert.match(svgRule, /max-width:\s*100%\s*!important;/, "the glyph is capped to the plate");
    assert.match(svgRule, /max-height:\s*100%\s*!important;/);
    assert.match(svgRule, /pointer-events:\s*none;/, "and the hits stay on the button itself");
  });

  it("cements box-sizing so the declared size IS the rendered size", function () {
    // The pass clamps the plate inside the wrapper and clears a centre by a couple of px.
    // A 1px border adding 2px to both dimensions would eat that margin of error on any
    // host that does not set border-box for us.
    assert.match(baseBlock(handleCss()), /box-sizing:\s*border-box\s*!important;/);
  });

  it("re-measures on every box the placement reads, and never during a drag", function () {
    const fs = require("fs");
    const src = fs.readFileSync(dndPath, "utf8");
    assert.ok(
      /ro\.observe\(node,\s*\{ box: 'border-box' \}\)/.test(src),
      "the observer subscribes to the nodes the pass reads (an observer on the layout " +
        "root or on body would never be told about one section resizing)",
    );
    for (const selector of ["watchGripBand(wrapper)", "watchGripBand(node)"]) {
      assert.ok(src.includes(selector), `${selector} — every wrapper AND every control`);
    }
    assert.ok(
      /classList\.contains\('be-dragging'\)\)\s*return 0/.test(src),
      "the pass refuses to run while a drag is committed",
    );
    const cleanup = src.match(/function cleanupDrag\(\)\s*\{[\s\S]*?\n\}/)[0];
    assert.ok(
      /classList\.remove\('be-dragging'\)/.test(cleanup) && /scheduleGripBands\(\)/.test(cleanup),
      "…and the SAME function that clears the flag re-arms it, or the drop's own geometry " +
        "change would be swallowed forever",
    );
  });
});
