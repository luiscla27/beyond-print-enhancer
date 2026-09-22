/**
 * Source guard: no stray backtick inside any injected-stylesheet template.
 *
 * WHY THIS EXISTS BESIDE test/unit/ui_theme_source.test.js: that file pins the
 * theme's `THEME_CSS` literal only. The same failure mode is open to every
 * module that emits CSS from a template literal, and this project has four —
 * and it was actually hit in js/dnd.js, js/print_styles.js and js/filters.js
 * while moving the drag handle into the action rail, because the prose in these
 * stylesheets quotes identifiers the way this file's own comments do.
 *
 * WHY IT IS NOT THEORETICAL: a backtick inside a CSS comment TERMINATES the
 * literal, so the module throws a SyntaxError at require time. Loud — but at
 * require time in the EXTENSION, where nothing in this suite would have named
 * the line. MEASURED while this guard was being written: a backtick injected
 * into js/dnd.js's stylesheet block took `npm test` from 1470 passing to
 * **1341 passing / 84 failing**, with every message reading
 * `TypeError: dnd.initDragAndDrop is not a function`. The gate that catches the
 * class must name the line, not the blast radius.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  findStrayInTemplate,
  check,
  SHEET_EMITTERS,
} = require("../../scripts/check_css_template_backticks.js");

const ROOT = path.resolve(__dirname, "..", "..");

describe("injected-stylesheet templates carry no stray backtick", function () {
  it("every sheet emitter the project names is present and clean", function () {
    // A missing file would make the loop below report nothing at all, which is
    // how a vacuous guard is born — so the list is asserted before it is read.
    for (const rel of SHEET_EMITTERS) {
      assert.ok(
        fs.existsSync(path.resolve(ROOT, rel)),
        `the guard's own file list is stale — ${rel} does not exist`,
      );
    }
    assert.deepStrictEqual(check(ROOT), [], "stray backtick:\n" + check(ROOT).join("\n"));
  });

  it("scans each emitter's own template bodies", function () {
    // The per-file view, so a failure says WHICH stylesheet.
    for (const rel of SHEET_EMITTERS) {
      const src = fs.readFileSync(path.resolve(ROOT, rel), "utf8");
      assert.deepStrictEqual(
        findStrayInTemplate(src, rel),
        [],
        `${rel} has a backtick inside a stylesheet template`,
      );
    }
  });

  it("names the offending line, and is not fooled by a legit ${...} template", function () {
    const clean = [
      "  style.textContent = `",
      "      .a { color: red; }",
      "      .b { width: ${w}px; }",
      "      ${nested(`x`, `${y}`)}",
      "  `;",
      // A complete one-line template is NOT a multi-line body and must not be
      // scanned past its own terminator into the source that follows.
      "  css += `  #one { display: none; }`;",
      "  const later = `plain prose backticks are fine`;",
      "  function after() { return 1; }",
      "  `;",
    ].join("\n");
    assert.deepStrictEqual(findStrayInTemplate(clean, "fixture"), []);

    const dirty = [
      "  style.textContent = `",
      "      /* the `.be-x` rule */",
      "      .a { color: red; }",
      "  `;",
    ].join("\n");
    const bad = findStrayInTemplate(dirty, "fixture");
    assert.strictEqual(bad.length, 1, "the injected backtick is found: " + JSON.stringify(bad));
    assert.ok(/:2:/.test(bad[0]), "and the message names the line: " + bad[0]);
  });
});
