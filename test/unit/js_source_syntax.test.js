/**
 * Syntax guard for every shipped source file.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT ABOUT typos. Three files in this project
 * were broken at once by ONE class of mistake while the sheet affordances were
 * being reworked (ISSUE_drag_and_drop / ISSUE_hover / ISSUE_shadows,
 * 2026-09-14): a CSS comment inside the template literal that emits the
 * stylesheet contained a backtick, which TERMINATES the literal — so the module
 * throws a SyntaxError at load, in production, pointing at prose like
 * "Unexpected identifier 'visibility'". `scripts/check_theme_backticks.js`
 * already exists for exactly that trap, but it is written for ONE file
 * (`js/ui_theme.js`), and the same hazard lives in every module that injects a
 * stylesheet from a template literal: `js/dnd.js`, `js/print_styles.js`,
 * `js/filters.js`. `eslint` catches it only when the resulting parse error
 * survives to its parser; it also reported `'section' is not defined` for one of
 * the three, which is a symptom, not the cause.
 *
 * It compiles with `vm.Script`, which parses WITHOUT executing — these modules
 * touch `document`/`window` at load, so `require` would either throw for the
 * wrong reason or run boot code. Compile-only is the whole point: the claim
 * under test is "this file parses", nothing more.
 *
 * Falsified on purpose: see the last case, which plants a backtick in a comment
 * and asserts the guard reports THAT file — so the suite cannot pass because the
 * walk found nothing to check.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const JS_DIR = path.resolve(__dirname, "..", "..", "js");

/** Every .js file under js/, recursively, with its source. */
function sources(dir = JS_DIR) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(p));
    else if (entry.name.endsWith(".js")) {
      out.push({
        file: path.relative(path.resolve(__dirname, "..", ".."), p).replace(/\\/g, "/"),
        src: fs.readFileSync(p, "utf8"),
      });
    }
  }
  return out;
}

/** The files this guard exists for: a stylesheet emitted from a template literal. */
function injectsCss(entry) {
  return /document\.head\.appendChild\(style\)/.test(entry.src) ||
    /style\.textContent\s*=\s*`/.test(entry.src);
}

function compiles(src, file) {
  try {
    new vm.Script(src, { filename: file });
    return null;
  } catch (e) {
    return e.message;
  }
}

describe("source syntax guard — every js/ module parses", function () {
  const ALL = sources();

  it("walks the real tree (not vacuous)", function () {
    assert.ok(ALL.length >= 20, "found only " + ALL.length + " files under js/");
    const cssInjectors = ALL.filter(injectsCss).map((e) => e.file);
    assert.ok(
      cssInjectors.length >= 3,
      "the stylesheet-injecting modules this guard exists for must be present: " +
        cssInjectors.join(", "),
    );
    for (const f of ["js/dnd.js", "js/print_styles.js", "js/filters.js", "js/ui_theme.js"]) {
      assert.ok(cssInjectors.includes(f), f + " injects CSS and must be covered");
    }
  });

  it("every file compiles", function () {
    const failures = [];
    for (const entry of ALL) {
      const err = compiles(entry.src, entry.file);
      if (err) failures.push(`${entry.file}: ${err}`);
    }
    assert.deepStrictEqual(failures, [], "a module that throws SyntaxError at load is " +
      "dead in the browser — a backtick inside a CSS comment inside the template literal " +
      "that emits a stylesheet is how this happens:\n" + failures.join("\n"));
  });

  it("REPORTS the file when a stylesheet comment breaks the literal (falsification)", function () {
    // The exact defect, planted: a backtick pair inside a comment inside the
    // emitted CSS. Without the guard this surfaces as a load-time crash whose
    // message points at prose, three layers away from the cause.
    const broken = [
      "function inject() {",
      "  const style = document.createElement('style');",
      "  style.textContent = `",
      "      /* the reveal rule is `.be-x:hover .be-y` — specificity matters */",
      "      .be-x:hover .be-y { opacity: 1; }",
      "  `;",
      "  document.head.appendChild(style);",
      "}",
    ].join("\n");
    assert.ok(injectsCss({ src: broken }), "the fixture really looks like a CSS injector");
    const err = compiles(broken, "fixture.js");
    assert.ok(err, "the plant must actually break the file — otherwise this case proves nothing");
    assert.match(err, /Unexpected/, "a SyntaxError, the class the guard exists for: " + err);
  });
});
