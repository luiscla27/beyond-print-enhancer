/**
 * Guard: no stray backtick may appear inside the THEME_CSS template literal.
 *
 * js/ui_theme.js emits its stylesheet from a JS template literal, so a backtick
 * inside a CSS COMMENT terminates the literal and produces a SyntaxError at
 * require time ("Unexpected identifier ..."). That has now happened three times
 * while editing CSS comments, so it gets a check that names the offending line
 * instead of failing three layers deep.
 *
 * Legitimate backticks are the nested template literals inside ${...}
 * expressions (the ornamentSurface() calls), which are matched explicitly.
 *
 *   node scripts/check_theme_backticks.js
 *   (also run as part of test/unit/ui_theme_source.test.js)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const FILE = path.resolve(__dirname, "..", "js", "ui_theme.js");

/** Return the offending lines, or [] when the template is clean. */
function findStrayBackticks(src) {
  const start = src.indexOf("const THEME_CSS = `");
  if (start < 0) throw new Error("THEME_CSS template not found");
  const bodyStart = start + "const THEME_CSS = `".length;
  const end = src.indexOf("\n`;", bodyStart);
  if (end < 0) throw new Error("THEME_CSS template end not found");
  const body = src.slice(bodyStart, end);

  // Blank out the ${...} expressions, which may legitimately contain backticks.
  let masked = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "$" && body[i + 1] === "{") {
      let d = 1;
      let j = i + 2;
      let inStr = null;
      while (j < body.length && d > 0) {
        const c = body[j];
        if (inStr) {
          if (c === "\\") j++;
          else if (c === inStr) inStr = null;
        } else if (c === '"' || c === "'" || c === "`") {
          inStr = c;
        } else if (c === "{") d++;
        else if (c === "}") d--;
        j++;
      }
      masked += " ".repeat(j - i);
      i = j - 1;
      continue;
    }
    masked += ch;
  }

  const lines = [];
  const linesArr = masked.split("\n");
  linesArr.forEach((l, i) => {
    if (l.includes("`")) {
      lines.push(`THEME_CSS line ${i + 1}: ${body.split("\n")[i].trim()}`);
    }
  });
  return lines;
}

if (require.main === module) {
  const src = fs.readFileSync(FILE, "utf8");
  const bad = findStrayBackticks(src);
  if (bad.length) {
    console.error("STRAY BACKTICK(S) in THEME_CSS — this breaks the template literal:");
    for (const b of bad) console.error("  " + b);
    process.exit(1);
  }
  console.log("theme template OK — no stray backticks");
}

module.exports = { findStrayBackticks };
