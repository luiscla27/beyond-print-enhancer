/**
 * Ability-summary CSS injection — one assertion set over the print-style sheet.
 *
 * HARNESS CONTRACT. This suite boots the SAME way the rest of the unit suite does:
 * `test/unit/encapsulation_debt/debt_harness.js` boots a fresh jsdom window, sets
 * `window.__DDB_TEST_MODE__` BEFORE eval, and eval's the production files in the
 * extension's own order (js/background.js's injected list, with js/boot.js before
 * js/main.js). Hand-rolling that plumbing here is what made this suite drift: it
 * concatenated a subset of files into one <script> and waited 200 ms, so it neither
 * matched the real boot order nor observed the extracted boot module at all.
 *
 * WHY THE SUITE DRIVES Boot.boot() ITSELF. Under `__DDB_TEST_MODE__` the async IIFE
 * at the tail of js/main.js returns immediately (that is the flag's whole contract:
 * expose the window.* handles, skip the production boot). The `ddb-print-enhance-style`
 * sheet is created by `enforceFullHeight`, which the extracted boot module
 * (js/boot.js) drives as one of its steps — so with the production boot skipped,
 * nothing would create the sheet and the assertions below would read `null`. Running
 * the module's own sequence is therefore the harness equivalent of the page boot, not
 * a re-implementation of it: it is the same call the product makes.
 */
"use strict";

const assert = require("assert");
const { boot } = require("./encapsulation_debt/debt_harness.js");

describe("Ability Summary CSS Injection", function () {
  let document, cleanup;

  before(async function () {
    const ctx = boot();
    document = ctx.document;
    cleanup = ctx.cleanup;

    // The real startup sequence — the only caller of `enforceFullHeight`. AWAITED,
    // because boot() is async: asserting before it settles reads a document the sheet
    // has not landed in yet (which is exactly how a fixed sleep used to paper over it).
    await ctx.window.Boot.boot();
  });

  after(function () {
    cleanup();
  });

  it("should have .ddbc-ability-summary styles defined", function () {
    const styleTag = document.getElementById("ddb-print-enhance-style");
    assert.ok(styleTag, "Style tag should be created");

    const css = styleTag.textContent;
    assert.ok(css.includes(".ddbc-ability-summary"), "Should have .ddbc-ability-summary class");
    assert.ok(css.includes("display: contents;"), "Should have display: contents");
  });

  it("should have .ddbc-ability-summary__secondary styles defined", function () {
    const styleTag = document.getElementById("ddb-print-enhance-style");
    assert.ok(styleTag, "Style tag should be created");
    const css = styleTag.textContent;
    assert.ok(
      css.includes(".ddbc-ability-summary__secondary"),
      "Should have .ddbc-ability-summary__secondary class",
    );
    assert.ok(css.includes("border: 2px solid var(--btn-color);"), "Should use var(--btn-color)");
    assert.ok(css.includes("border-radius: 150px;"), "Should have border-radius");
    assert.ok(css.includes("padding: 8px 13px;"), "Should have padding");
    assert.ok(css.includes("background: white;"), "Should have background: white");
  });
});
