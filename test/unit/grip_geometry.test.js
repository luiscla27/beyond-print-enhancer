/**
 * The grip's GEOMETRY CONTRACT — one placement rule, in one owner.
 *
 * HISTORY THIS FILE NOW GUARDS, because it is the third placement in four days:
 *   1. a centred plate (ISSUE_drag_and_drop.md) — collided with the bar on short
 *      sections, so `gripBandFor` / `measureGripBands` were built to MEASURE the
 *      collision away (ISSUE_grip_box_overlaps_actions_bar_on_short_sections_20260914.md,
 *      temp/archived/);
 *   2. a z-index ladder so the bar "yielded" to the grip
 *      (ISSUE_grip_covered_by_actions_bar_on_small_sections_20260914.md, archived) —
 *      which never fixed the overlap, only ranked it, and js/dnd.js's own note
 *      recorded the price: the grip covering 60% of the Select button;
 *   3. a fixed top-left corner, absolute, beside the bar — coextensive with the
 *      bar's first button, 100% (temp/issues/
 *      ISSUE_corner_grip_lands_on_first_action_button_20260922.md).
 *
 * The current answer is structural, not numerical: the grip is a CELL of the
 * action rail, so `display:flex; gap` owns its box and NO second placement rule
 * can exist beside it. That makes this file's job the negative one — proving the
 * old machinery stayed deleted — plus the two positive rules the handle still
 * carries. A measurement subsystem that survives as dead code is a second
 * definition of placement waiting to disagree with the first, which is exactly
 * how round 1 became round 2.
 *
 * The positive slot contract (`ensureDragHandle` puts the grip in slot zero, and
 * keeps it there across a rebuild) lives with the rest of the handle's unit
 * contract in test/unit/hover_refactor.test.js. Which control wins a real pixel
 * is a browser question and is measured in
 * test/browser_e2e/drag_glow_layers.spec.js and
 * test/browser_e2e/affordance_drag_hover_shadows.spec.js.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const dndPath = path.resolve(__dirname, "..", "..", "js", "dnd.js");
const dndSrc = fs.readFileSync(dndPath, "utf8");
const printStylesSrc = fs.readFileSync(
  path.resolve(__dirname, "..", "..", "js", "print_styles.js"),
  "utf8",
);
/* The declarations only. Both files' prose deliberately NAMES the machinery that
   was deleted (it is the record of why), so an identifier check that reads the
   comments would fail on the history rather than on the code. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "");

function freshDnd() {
  delete require.cache[require.resolve(dndPath)];
  const prevWindow = global.window;
  global.window = {};
  try {
    return require(dndPath);
  } finally {
    global.window = prevWindow;
  }
}

/** The stylesheet the module installs, comments stripped so prose cannot satisfy
 *  an assertion about declarations. */
function handleCss() {
  const { JSDOM } = require("jsdom");
  const prevDocument = global.document;
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  global.document = dom.window.document;
  try {
    freshDnd().injectDnDStyles();
    return global.document
      .getElementById("ddb-print-dnd-style")
      .textContent.replace(/\/\*[\s\S]*?\*\//g, "");
  } finally {
    global.document = prevDocument;
  }
}

const baseBlock = (css) => css.match(/\.be-drag-handle\s*\{[\s\S]*?\}/)[0];

describe("Grip geometry contract — one placement rule, no measurement subsystem", function () {
  it("carries NO second placement: the geometry subsystem stays deleted", function () {
    // Round 1's machinery. Every name here is a placement rule that could come
    // back as a fallback beside the flex row; the browser is allowed exactly one.
    for (const gone of [
      "gripBandFor",
      "measureGripBands",
      "scheduleGripBands",
      "flushGripBands",
      "GRIP_PLATE_W",
      "GRIP_PLATE_H",
      "GRIP_DOT_PLATE_PX",
      "GRIP_BAND_MIN_CLEARANCE",
    ]) {
      assert.ok(
        !new RegExp("\\b" + gone + "\\b").test(stripComments(dndSrc)),
        `${gone} must not come back: the grip is placed by the flex row, not measured out of a collision`,
      );
    }
    assert.ok(
      !/--be-grip-/.test(stripComments(dndSrc)),
      "no --be-grip-* custom property survives (the three carriers of the nudged plate)",
    );
    assert.ok(
      !/--be-grip-|gripBand|measureGripBands/.test(stripComments(printStylesSrc)),
      "and the sheet carries none of them either — one owner, in js/dnd.js",
    );
  });

  it("does not observe layout to place the grip", function () {
    // A ResizeObserver that exists to re-place an absolutely-positioned grip is
    // round 1 again. The rail re-lays itself out; nothing here has to follow.
    assert.ok(
      !/new ResizeObserver/.test(stripComments(dndSrc)),
      "js/dnd.js runs no ResizeObserver — there is no geometry left to re-measure",
    );
    // The observer it DOES run is the one that keeps the node alive per wrapper.
    assert.ok(
      /new MutationObserver/.test(dndSrc),
      "the MutationObserver that re-inserts the grip after a section rebuild stays",
    );
  });

  it("re-solves the collision by placement, not by a nudge or a level", function () {
    // The handle block may not carry ANY of the three mechanisms that failed:
    // an offset (round 3), a centring transform (round 1), or a written size
    // that fights the row. What remains is the tier the buttons use.
    const css = handleCss();
    const block = baseBlock(css);
    for (const forbidden of [
      /--be-grip/,
      /\btranslate\s*:/,
      /\bscale\s*\(/,
      /calc\(\s*50%/,
    ]) {
      assert.ok(
        !forbidden.test(block),
        `no displacement rule may return to the handle: ${forbidden}`,
      );
    }
    assert.ok(
      /width:\s*39px !important/.test(block) && /height:\s*32px !important/.test(block),
      "it keeps the action row's own 39x32 tier",
    );
    assert.ok(
      !/z-index:\s*700001/.test(css) &&
        !/z-index:\s*700001/.test(printStylesSrc.replace(/\/\*[\s\S]*?\*\//g, "")),
      "and the bar's yielded level (round 2) is gone from both files' declarations",
    );
  });

  it("keeps its own hit area honest at rest, on reveal, and while held", function () {
    // Survived every placement change: an invisible-but-hittable grip is a dead
    // control over the section's content, and a grip left visible during a drag
    // rides along in the source (the ghost is the copy the user sees).
    const css = handleCss();
    const block = baseBlock(css);
    assert.ok(/visibility:\s*hidden !important/.test(block), "hidden at rest");
    assert.ok(/pointer-events:\s*none !important/.test(block), "and unhittable at rest");
    const reveal = css.match(
      /\.be-active-layer[^{]*:hover[^{]*\.be-drag-handle[\s\S]{0,320}?\}/,
    )[0];
    assert.ok(/visibility:\s*visible !important/.test(reveal), "revealed by the active layer");
    assert.ok(/pointer-events:\s*auto !important/.test(reveal), "and hittable then");
    const held = css.match(/body\.be-dragging[^{]*\.be-drag-handle[\s\S]*?\}/)[0];
    assert.ok(/visibility:\s*hidden !important/.test(held), "hidden again while held");
  });

  it("cements box-sizing so the declared size IS the rendered size", function () {
    const block = baseBlock(handleCss());
    assert.ok(/box-sizing:\s*border-box !important/.test(block));
  });
});
