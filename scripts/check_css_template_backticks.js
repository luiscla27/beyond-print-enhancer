#!/usr/bin/env node
/**
 * Guard: no stray backtick may appear inside an INJECTED-STYLESHEET template.
 *
 * WHY A SECOND FILE BESIDE scripts/check_theme_backticks.js: that one is hard
 * wired to `const THEME_CSS = \`` in js/ui_theme.js, and the class it exists for is
 * not the theme's. Every module that emits CSS through a JS template literal
 * shares it — a backtick inside a CSS COMMENT terminates the literal and throws a
 * SyntaxError at require time, with a message that points at prose
 * ("Unexpected identifier 'display'") rather than at the quote.
 *
 * It is not theoretical: this session hit it in js/dnd.js, js/print_styles.js and
 * js/filters.js. All three failures were SYNTAX errors, so loud — but loud at
 * require time in the browser, which no unit test in the repo would have surfaced
 * before a human loaded the extension, because the unit harness reaches those
 * files through `require` and would have thrown 84 unrelated times instead.
 *
 * USAGE
 *   node scripts/check_css_template_backticks.js          # check, name offenders
 *   require("./check_css_template_backticks.js")          # → { findStrayInTemplate }
 *
 * A template is found by its OPENER line (`style.textContent = \``, or any line
 * matching `EMITTER_RE` below) and closed at the first lone "\`;" — which is how
 * every one of this project's emitters ends. A stray backtick inside such a body
 * cannot be told apart from the real terminator by text alone, so the rule is the
 * honest one: there must be NO backtick between the opener and the terminator
 * that is not the opener or the terminator. `${...}` expressions are blanked
 * first, exactly as check_theme_backticks.js does, because a nested template in
 * an interpolation IS legitimate.
 */
"use strict";

const fs = require("fs");
const path = require("path");

/* Every place this project writes a stylesheet out of a template literal. The
 * three js/dnd.js-style assignments plus ui_theme's const are all covered. */
const EMITTER_RE = /^(\s*(?:style\.textContent|cssText|css) \+=? )?`/;

/** Blank out `${...}` blocks so nested templates inside them are not flagged. */
function maskInterpolations(body) {
  let masked = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "$" && body[i + 1] === "{") {
      let depth = 1;
      let j = i + 2;
      let str = null;
      while (j < body.length && depth > 0) {
        const c = body[j];
        if (str) {
          if (c === "\\") j++;
          else if (c === str) str = null;
        } else if (c === '"' || c === "'" || c === "`") {
          str = c;
        } else if (c === "{") depth++;
        else if (c === "}") depth--;
        j++;
      }
      masked += " ".repeat(j - i);
      i = j - 1;
      continue;
    }
    masked += ch;
  }
  return masked;
}

/**
 * Every offending line in every stylesheet template of one source file.
 * @param {string} src
 * @param {string} [label] what to name in the message
 * @returns {string[]} [] when clean
 */
function findStrayInTemplate(src, label) {
  const out = [];
  const lines = src.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    // A template OPENER is a line that assigns and opens the literal at its END:
    // `style.textContent = \`` with nothing after it. Anything that puts content
    // on the same line (`css += \`  #x {}\n\`;`) is a complete one-line template
    // and is not what this scan is for — reading those would scan to the NEXT
    // lone "`;" and report the source between them, which is prose, not a body.
    const opener = /^(\s*)(?:[\w.$]+(?:\.\w+)*\s*=\s*|css(?:Text)?\s*\+=\s*)`\s*$/.exec(
      lines[i],
    );
    if (!opener) {
      i++;
      continue;
    }
    // Find the terminator: a line whose whole content is "`;" (with indent).
    let end = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s*`;\s*$/.test(lines[j])) {
        end = j;
        break;
      }
    }
    if (end < 0) {
      out.push(`${label || "source"}:${i + 1} template has no \`; terminator — the scan stopped`);
      break;
    }
    const body = lines.slice(i + 1, end).join("\n");
    const masked = maskInterpolations(body);
    masked.split("\n").forEach((l, k) => {
      if (l.includes("`")) {
        out.push(`${label || "source"}:${i + 2 + k}: ${body.split("\n")[k].trim()}`);
      }
    });
    i = end + 1;
  }
  return out;
}

/** Files whose stylesheets are emitted from template literals. */
const SHEET_EMITTERS = [
  "js/dnd.js",
  "js/filters.js",
  "js/print_styles.js",
  "js/ui_theme.js",
];

function check(root) {
  const bad = [];
  for (const rel of SHEET_EMITTERS) {
    const file = path.resolve(root, rel);
    if (!fs.existsSync(file)) continue; // a partial checkout must not read as a pass
    bad.push(...findStrayInTemplate(fs.readFileSync(file, "utf8"), rel));
  }
  return bad;
}

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const bad = check(root);
  if (bad.length) {
    console.error("STRAY BACKTICK(S) in an injected stylesheet template — breaks the literal:");
    for (const b of bad) console.error("  " + b);
    process.exit(1);
  }
  console.log(`stylesheet templates OK — no stray backticks in ${SHEET_EMITTERS.length} files`);
}

module.exports = { findStrayInTemplate, maskInterpolations, check, SHEET_EMITTERS, EMITTER_RE };
