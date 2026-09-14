/**
 * Source guard for the theme module (see scripts/check_theme_backticks.js).
 *
 * js/ui_theme.js emits its stylesheet from a JS template literal, so a backtick
 * placed inside a CSS COMMENT terminates the literal and throws a SyntaxError
 * at require time. That is a loud failure but a confusing one (the message is
 * "Unexpected identifier ..." pointing at the comment text). This test names the
 * offending line instead. It has happened three times while editing CSS comments
 * in this project, which is why it is pinned.
 */

"use strict";

const assert = require("assert");
const { findStrayBackticks } = require("../../scripts/check_theme_backticks.js");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(
  path.resolve(__dirname, "..", "..", "js", "ui_theme.js"),
  "utf8",
);

describe("theme source guard", function () {
  it("has no stray backtick inside the THEME_CSS template literal", function () {
    const bad = findStrayBackticks(SRC);
    assert.deepStrictEqual(
      bad,
      [],
      "a backtick inside a CSS comment breaks the template literal:\n" + bad.join("\n"),
    );
  });

  it("does not mistake a legitimate ${...} expression for a stray backtick", function () {
    // the emitter builds surface rules from nested template literals, so the
    // check must tolerate (and this test must prove it tolerates) ${...} blocks
    const sample = [
      "const THEME_CSS = `",
      ".x { color: ${TOKENS.bone}; }",
      "${someFn(`a`, `${b}`)}",
      "`;",
      "",
    ].join("\n");
    assert.deepStrictEqual(findStrayBackticks(sample), []);
  });

  it("actually detects a backtick in a CSS comment", function () {
    const sample = [
      "const THEME_CSS = `",
      "/* see `.be-thing` for details */",
      ".x { color: red; }",
      "`;",
      "",
    ].join("\n");
    const bad = findStrayBackticks(sample);
    assert.strictEqual(bad.length, 1, "the offending line is reported");
    assert.match(bad[0], /THEME_CSS line 2/);
  });
});
