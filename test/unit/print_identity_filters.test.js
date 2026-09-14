/**
 * An IDENTITY css filter is still a filter — it must not be emitted on the root.
 * (issue `ISSUE_print_sheet_rasterised_20260911.md`, FIXED in 1.17.2 and archived to temp/archived/;
 *  found by measuring the REAL printed output)
 *
 * WHY THIS SUITE EXISTS. The tool writes four filter chains
 * (`js/filters.js` -> `--be-full-filter` / `--be-decoration-filter` / `--be-hue-filter` /
 * `--be-inv-hue-filter` on `document.documentElement`) and the injected stylesheet applies them with
 * `filter: var(--be-...) !important`. Chromium RASTERISES a filtered subtree when it prints, so a
 * container carrying `hue-rotate(0deg)` reaches the paper as an image: measured on the live sheet,
 * the whole printed PDF carried **0 text-showing operators, 0 characters and 17 vector paths**
 * (5,976,211 bytes), and removing the identity chains gave back **3,263 text ops, 11,632 characters
 * and 12,613 paths**. Searchable, copyable, accessible print output is what this suite protects.
 *
 * WHAT IT PINS, AND WHAT IT REFUSES TO PIN. Only a chain whose every function is a provable identity
 * may become `none`. In particular the product's DEFAULT `greyscale: 100` is NOT an identity
 * (`grayscale(100%)` is what makes the ornaments grey on purpose — the shipped default since 1.4.2),
 * so a rule that treated "all sliders at their defaults" as neutral would silently un-grey the
 * printed sheet: MEASURED, 5,458 -> 66,740 saturated pixels on page 1 alone. The case below fails
 * against exactly that shortcut. And any value that is not a finite number is NOT neutral, so junk
 * input cannot silently switch a user's filters off.
 *
 * FALSIFIED BEFORE TRUSTED: written against the pre-fix code, the first two cases fail
 * (`hue-rotate(0deg)` instead of `none`).
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "../..");
const FILTERS = fs.readFileSync(path.join(ROOT, "js/filters.js"), "utf8");

/** The four custom properties, read the way the browser sees them: inline, on :root. */
const VARS = [
  "--be-full-filter",
  "--be-decoration-filter",
  "--be-hue-filter",
  "--be-inv-hue-filter",
];

describe("identity filter chains are not emitted (issue print_sheet_rasterised_20260911)", function () {
  let dom, window, document;

  before(function () {
    dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
      url: "https://www.dndbeyond.com/characters/12345",
      runScripts: "dangerously",
    });
    window = dom.window;
    document = window.document;
    window.eval(FILTERS);
    // filters.js publishes the namespace itself (`window.Filters`), and its top-level
    // `"use strict"` keeps a bare function declaration OUT of the global scope under eval — so the
    // namespace, not `window.applyGlobalFilters`, is the seam to drive here.
    assert.ok(window.Filters && typeof window.Filters.applyGlobalFilters === "function",
      "precondition: js/filters.js published its namespace");
  });

  after(function () {
    if (dom) dom.window.close();
  });

  /** Apply the settings and read back the four variables, exactly as the product writes them. */
  function varsFor(filters) {
    window.Filters.applyGlobalFilters(filters);
    const style = document.documentElement.style;
    return Object.fromEntries(VARS.map((v) => [v, style.getPropertyValue(v)]));
  }

  const NEUTRAL = { hue: 0, contrast: 100, saturate: 100, greyscale: 0, sepia: 0 };

  it("every function at its identity: all four chains are `none`, never an identity chain", function () {
    const vars = varsFor(NEUTRAL);
    for (const v of VARS) {
      assert.strictEqual(
        vars[v],
        "none",
        `${v} must be "none" when the chain is an identity transformation — an identity filter ` +
          `still rasterises the subtree when Chromium prints it. Got: "${vars[v]}"`,
      );
    }
  });

  it("the product's DEFAULT greyscale of 100% is NOT neutral: the ornaments stay grey", function () {
    // The shortcut this refuses: "all sliders at their defaults -> none". The default greyscale is
    // 100 (js/storage.js getFilters, the panel's slider default, Reset Filters), and
    // `grayscale(100%)` changes pixels, so dropping it is a behaviour change on screen AND on paper.
    const vars = varsFor({ hue: 0, contrast: 100, saturate: 100, greyscale: 100, sepia: 0 });
    assert.strictEqual(vars["--be-hue-filter"], "none", "the identity hue chain still collapses");
    assert.strictEqual(vars["--be-inv-hue-filter"], "none", "…and so does its inverse");
    assert.ok(
      vars["--be-decoration-filter"].includes("grayscale(100%)"),
      `the default greyscale must still be applied to the decorations; got "${vars["--be-decoration-filter"]}"`,
    );
    assert.ok(
      vars["--be-full-filter"].includes("grayscale(100%)"),
      `the full chain must still carry it too; got "${vars["--be-full-filter"]}"`,
    );
    assert.strictEqual(
      vars["--be-decoration-filter"],
      "contrast(100%) saturate(100%) grayscale(100%) sepia(0%)",
      "the emitted chain is unchanged, verbatim — only identity chains are rewritten",
    );
  });

  it("a user's own settings are emitted verbatim (unchanged by this fix)", function () {
    const vars = varsFor({ hue: 90, contrast: 150, saturate: 120, greyscale: 50, sepia: 30 });
    assert.strictEqual(vars["--be-full-filter"], "hue-rotate(90deg) contrast(150%) saturate(120%) grayscale(50%) sepia(30%)");
    assert.strictEqual(vars["--be-decoration-filter"], "contrast(150%) saturate(120%) grayscale(50%) sepia(30%)");
    assert.strictEqual(vars["--be-hue-filter"], "hue-rotate(90deg)");
    assert.strictEqual(vars["--be-inv-hue-filter"], "hue-rotate(-90deg)");
  });

  it("each chain is decided ON ITS OWN, not by the sliders as a group", function () {
    // Hue at its identity, contrast set by the user: the hue chains collapse, the contrast survives.
    const a = varsFor({ hue: 0, contrast: 150, saturate: 100, greyscale: 0, sepia: 0 });
    assert.strictEqual(a["--be-hue-filter"], "none");
    assert.ok(a["--be-decoration-filter"].includes("contrast(150%)"), "the user's contrast must survive");
    assert.ok(a["--be-full-filter"].includes("contrast(150%)"), "…in the full chain too");

    // …and the mirror image: a real hue with the decorations at their identity.
    const b = varsFor({ hue: 90, contrast: 100, saturate: 100, greyscale: 0, sepia: 0 });
    assert.strictEqual(b["--be-decoration-filter"], "none", "an identity decoration chain collapses");
    assert.strictEqual(b["--be-hue-filter"], "hue-rotate(90deg)", "a real hue is emitted, not dropped");
  });

  it("hue-rotate(360deg) is an identity too, so the whole slider range is covered", function () {
    const vars = varsFor({ hue: 360, contrast: 100, saturate: 100, greyscale: 0, sepia: 0 });
    assert.strictEqual(vars["--be-hue-filter"], "none", "hue-rotate(360deg) is a no-op");
    assert.strictEqual(vars["--be-inv-hue-filter"], "none", "hue-rotate(-360deg) is one as well");
  });

  it("a value that is not a finite number is never silently dropped", function () {
    // Safety direction: an unparseable setting must fall back to emitting the chain (today's
    // behaviour), never to switching the user's filter off behind their back.
    const vars = varsFor({ hue: "abc", contrast: 100, saturate: 100, greyscale: 0, sepia: 0 });
    assert.notStrictEqual(vars["--be-hue-filter"], "none", `got "${vars["--be-hue-filter"]}"`);
    const missing = varsFor({ hue: 0, contrast: undefined, saturate: 100, greyscale: 0, sepia: 0 });
    assert.notStrictEqual(
      missing["--be-decoration-filter"],
      "none",
      "a missing value must not read as a neutral one",
    );
    // The specific trap: `Number("")` and `Number(null)` are BOTH 0, so an empty or null setting
    // would read as "hue 0" — an identity — unless emptiness is rejected explicitly.
    for (const empty of ["", "   ", null]) {
      const v = varsFor({ hue: empty, contrast: 100, saturate: 100, greyscale: 0, sepia: 0 });
      assert.notStrictEqual(
        v["--be-hue-filter"],
        "none",
        `hue=${JSON.stringify(empty)} must not read as hue 0 and collapse the chain`,
      );
      assert.notStrictEqual(v["--be-inv-hue-filter"], "none", "…nor its inverse");
    }
  });

  it("the product still CONSUMES all four variables (so `none` is what reaches the paper)", function () {
    // Anti-vacuity: the fix is only meaningful because real rules read these variables. If a rule
    // stopped consuming one, asserting `none` above would prove nothing about the output.
    varsFor(NEUTRAL);
    const own = document.getElementById("be-global-filters-style").textContent;
    const printStyles = fs.readFileSync(path.join(ROOT, "js/print_styles.js"), "utf8");
    // The three the tool's own filter block applies…
    for (const v of ["--be-full-filter", "--be-decoration-filter", "--be-inv-hue-filter"]) {
      assert.ok(own.includes(`var(${v})`), `js/filters.js must still apply var(${v})`);
    }
    // …and the one the section containers carry, which is the chain that rasterised the whole
    // printed sheet (`js/print_styles.js` -> `.print-section-container { filter: var(--be-hue-filter) }`).
    assert.ok(
      printStyles.includes("filter: var(--be-hue-filter) !important"),
      "the section containers must still read --be-hue-filter, or the fix has no effect on paper",
    );
    assert.ok(own.includes("filter: none !important"), "the exclusions are still forced to none");
  });
});
