/**
 * Header contract — every chrome header is a SINGLE LINE at ONE size, with
 * breathing room.
 *
 * Owner report (verbatim): "The 'beyond printer' main header looks crowded, add
 * some padding and margins, also the text should be displayed on a single line
 * (make sure that all headers look the same)".
 *
 * Measured before the fix, from the live product:
 *   - the panel title ("Beyond Print") was given 80px but needs 131px, so it
 *     broke onto TWO lines;
 *   - header type sizes spanned 12/13/14/18px across the chrome;
 *   - no header declared nowrap, so any of them could wrap.
 *
 * These assertions pin the shared recipe and the single-line mechanism. The
 * live rendering (cap heights, line-box counts) is measured by
 * test/browser_e2e/ornament_symmetry_visual_capture.spec.js's header probe and
 * by a one-off probe recorded in the changelog.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const theme = require("../../js/ui_theme.js");

const CSS = theme.css;
const ROOT = path.resolve(__dirname, "..", "..");
const CONTROLS = fs.readFileSync(path.join(ROOT, "js", "controls.js"), "utf8");

/** declarations of the (single) rule whose selector list contains `sel` */
function blocksOf(css, sel) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  const want = sel.replace(/\s+/g, " ").trim();
  const out = [];
  let m;
  while ((m = re.exec(clean)) !== null) {
    const sels = m[1].split(",").map((s) => s.trim().replace(/\s+/g, " "));
    if (sels.includes(want)) out.push(m[2]);
  }
  return out;
}

/** the shared header recipe = the rule that declares the ellipsis triple */
function headerRecipe() {
  const clean = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    if (/text-overflow:\s*ellipsis/.test(m[2]) && /font-size:\s*14px/.test(m[2])) {
      return { selectors: m[1].split(",").map((s) => s.trim().replace(/\s+/g, " ")), body: m[2] };
    }
  }
  return null;
}

describe("one header recipe", function () {
  it("covers every chrome header — the panel title, tray heads, both layer headers and the modal title", function () {
    const recipe = headerRecipe();
    assert.ok(recipe, "a shared header recipe exists");
    for (const sel of [
      ".be-ctl-title",
      ".be-ctl-tray-head",
      ".be-layer-panel-header",
      ".be-layer-panel-header > strong",
      ".be-layer-section-header",
      ".be-layer-section-header > span",
      ".be-modal > h3",
    ]) {
      assert.ok(recipe.selectors.includes(sel), "recipe covers " + sel);
    }
  });

  it("uses ONE size, tracking, weight and casing (the 'look the same' clause)", function () {
    const body = headerRecipe().body;
    assert.match(body, /font-size:\s*14px\s*!important/, "one font-size");
    assert.match(body, /line-height:\s*1\.25\s*!important/, "one line-height");
    assert.match(body, /letter-spacing:\s*0\.13em\s*!important/, "one tracking");
    assert.match(body, /font-weight:\s*700\s*!important/, "one weight");
    assert.match(body, /text-transform:\s*uppercase\s*!important/, "one casing");
    assert.match(body, /font-family:\s*Cinzel[^;]*!important/, "one family");
  });

  it("forces a single line that can never wrap (the 'single line' clause)", function () {
    const body = headerRecipe().body;
    assert.match(body, /white-space:\s*nowrap\s*!important/);
    assert.match(body, /overflow:\s*hidden\s*!important/);
    assert.match(body, /text-overflow:\s*ellipsis\s*!important/);
    assert.match(body, /min-width:\s*0\s*!important/, "a flex item needs min-width:0 to clip");
  });

  it("is order-independent — print_styles re-injects its sheet, so every metric is !important", function () {
    const body = headerRecipe().body;
    // every declaration in the recipe must carry !important
    const decls = body
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d && d.includes(":"));
    const missing = decls.filter((d) => !/!important$/.test(d));
    assert.deepStrictEqual(missing, [], "these declarations would rely on source order");
  });

  it("no header declares a competing size anywhere in the sheet", function () {
    const offenders = [];
    for (const sel of [".be-ctl-title", ".be-layer-panel-header", ".be-layer-section-header"]) {
      for (const body of blocksOf(CSS, sel)) {
        const m = /(?:^|[;\s])font-size:\s*([0-9.]+px)/.exec(body);
        if (m && m[1] !== "14px") offenders.push(sel + " => " + m[1]);
      }
    }
    assert.deepStrictEqual(offenders, [], "a header still declares a different size");
  });
});

describe("breathing room (the 'crowded' clause)", function () {
  it("the topbar is a padded two-row column, not a cramped single row", function () {
    const bar = blocksOf(CSS, ".be-ctl-topbar")[0];
    assert.match(bar, /flex-direction:\s*column/, "rows, not one crowded line");
    assert.match(bar, /gap:\s*8px/);
    assert.match(bar, /padding:\s*4px 6px 16px/, "padding around the header block");
    assert.match(bar, /margin-bottom:\s*8px/, "margin below it");
    const row = blocksOf(CSS, ".be-ctl-topbar-row")[0];
    assert.ok(row, "the row primitive exists");
    assert.match(row, /justify-content:\s*space-between/);
  });

  it("group headers have consistent padding and margin", function () {
    for (const sel of [".be-ctl-tray-head", ".be-layer-section-header"]) {
      const body = blocksOf(CSS, sel).join("\n");
      assert.match(body, /padding:\s*12px 4px 8px/, sel + " padding");
      assert.match(body, /margin:\s*4px 0 6px/, sel + " margin");
    }
  });

  it("the panel header keeps its own padding/margin against print_styles", function () {
    const body = blocksOf(CSS, ".be-layer-panel-header").join("\n");
    assert.match(body, /padding:\s*2px 4px 12px\s*!important/);
    assert.match(body, /margin:\s*0 0 6px\s*!important/);
  });

  it("the title flexes so it is never squeezed to a wrapping width", function () {
    const body = blocksOf(CSS, ".be-ctl-title")[0];
    assert.match(body, /flex:\s*1 1 auto/, "the title takes the row's free space");
    assert.match(body, /min-width:\s*0/);
    assert.match(body, /padding:\s*2px 0 4px/, "its own padding");
  });
});

describe("the modal title's box is not negotiable", function () {
  it("declares flex: 0 0 auto so its bottom padding cannot be shrunk away", function () {
    // The modal is a column flex container capped at max-height 86vh. Because
    // the shared recipe sets overflow:hidden, the h3's automatic minimum size
    // becomes ZERO, and the title was measured being shrunk from 31.5px to
    // 17.6px — which silently ate its 14px bottom padding and let the ornament
    // rule band paint across the title text.
    const body = blocksOf(CSS, ".be-modal > h3").join("\n");
    assert.match(body, /flex:\s*0 0 auto/, "the title's box is not shrinkable");
    assert.match(body, /padding-bottom:\s*14px/, "room for the ornament rule band");
  });
});

describe("the topbar structure (two rows)", function () {
  it("puts the title and the collapse control on row 1 and TEMPLATES on row 2", function () {
    assert.ok(/className = "be-ctl-topbar-row"/.test(CONTROLS), "a header row is built");
    assert.ok(
      /be-ctl-topbar-row be-ctl-topbar-actions/.test(CONTROLS),
      "an actions row is built",
    );
    assert.ok(/headRow\.appendChild\(title\)/.test(CONTROLS), "title on the header row");
    assert.ok(
      /headRow\.appendChild\(collapseBtn\)/.test(CONTROLS),
      "collapse control on the header row",
    );
    assert.ok(
      /actionsRow\.appendChild\(templatesBtn\)/.test(CONTROLS),
      "TEMPLATES on its own row (it cannot share the title's line)",
    );
    assert.ok(
      !/topbar\.appendChild\(templatesBtn\)/.test(CONTROLS),
      "TEMPLATES no longer shares the crowded single row",
    );
    // the full title survives as a tooltip
    assert.ok(/title\.title = "Beyond Print"/.test(CONTROLS));
  });
});
