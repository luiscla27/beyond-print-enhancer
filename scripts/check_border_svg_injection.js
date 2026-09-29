#!/usr/bin/env node
/**
 * check_border_svg_injection.js — the BLOCKING build guard for the SVG single-source
 * render invariant (track `byok_svg_borders_20260927`, AC-9 / AC-9b(ii)).
 *
 * WHY A BUILD GUARD AND NOT A NOTE
 * -------------------------------
 * AC-9 says the invariant is "no SVG string is ever rendered without passing the
 * sanitizer, on EVERY path that can put SVG bytes in the DOM". `js/ai_border.js`'s
 * `renderBorderSvg` is the ONE choke point that satisfies it, and a unit test can only
 * prove that the paths THAT EXIST TODAY go through it. The failure mode this guard
 * exists for is the one a test cannot see: a FUTURE edit that reaches the DOM directly
 * (a stray `innerHTML`, a `data:` background, a second overlay builder). That is a
 * static property of the source tree, so it is checked statically, and the check is
 * BLOCKING: it runs inside `npm run lint`, which `pretest` runs, so a bypass fails the
 * build rather than emitting an advisory nobody reads.
 *
 * THE RULES (each names what it prevents)
 * ---------------------------------------
 *  R1 — the choke point must EXIST. `js/ai_border.js` must declare `renderBorderSvg`
 *       and must call the trust root (`validateSvg`/`sanitizeSvg`, AC-1) itself. A
 *       missing helper is a hard failure, not a vacuous pass: without R1 every other
 *       rule would be satisfied trivially by there being nothing to check.
 *  R2 — the choke point must sanitize BEFORE it injects: inside `js/ai_border.js` the
 *       assignment that writes markup must derive from the validator's own `sanitized`
 *       output. This is the `inject-if-caller-says-clean` falsifier (AC-9b(i) at the
 *       source level).
 *  R3 — no OTHER product file may use a markup-injection primitive on an SVG-sourced
 *       expression: `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write`
 *       whose right-hand side mentions a border-SVG source name.
 *  R4 — no product file may feed a `data:` or `url(` value into a CSS image property
 *       (`backgroundImage`, `borderImageSource`, `setProperty("background-image"…)`…)
 *       from a border-SVG source, outside the choke point.
 *  R5 — the overlay node's own class literal (`be-border-svg-overlay`) may appear in
 *       exactly two files: the choke point that CREATES it and `js/print_styles.js`
 *       whose CSS sizes and prints it. A third file means a second injection site.
 *
 * HOSTILE INPUT
 * -------------
 * The scan is over SOURCE TEXT, and this file's own docstring quotes the banned
 * patterns, so comments are stripped before matching (otherwise the guard fails on its
 * own explanatory prose — the `js/ai_arrange.test.js` `codeOf()` lesson).
 *
 * USAGE
 *   node scripts/check_border_svg_injection.js            # exit 0 clean, 1 violations
 *   node scripts/check_border_svg_injection.js --json     # machine-readable findings
 *
 * FALSIFICATION: `test/unit/ai_border_svg_guard.test.js` runs `checkSources()` over a
 * crafted fixture for each rule and asserts it FAILS, so this guard cannot pass
 * vacuously.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CHOKE_POINT = "js/ai_border.js";
const PRINT_STYLES = "js/print_styles.js";
const OVERLAY_CLASS = "be-border-svg-overlay";
const RENDER_FN = "renderBorderSvg";

/** Files allowed to mention `OVERLAY_CLASS`: the creator and the CSS consumer. */
const OVERLAY_ALLOWED = [CHOKE_POINT, PRINT_STYLES];

/**
 * Names that mean "a border SVG string is flowing here".
 *
 * This is a NAME match, and its limit is stated rather than hidden: too broad a pattern
 * is a false alarm (`window.Icons.svg` is an icon lookup, not a border payload —
 * MEASURED, it tripped the first draft of this file on two unrelated modules), so the
 * set is the border-specific spellings plus the library record's `svg` field. The
 * STRUCTURAL rules below (R5's overlay-node literal, R2's sanitize-then-inject) are what
 * carry the weight; this rule is the cheap tripwire for the obvious bypass.
 */
const SVG_SOURCE =
  /\bborderSvg\b|\brawSvg\b|\bsanitizedSvg\b|\bborderSvgString\b|\bborder_svg\b|\brecord\.svg\b|\bborder\.svg\b/;

/** DOM markup-injection primitives. */
const MARKUP_PRIMITIVE =
  /\.(innerHTML|outerHTML)\s*=[^=]|\.insertAdjacentHTML\s*\(|document\.write(?:ln)?\s*\(/;

/** CSS image sinks that accept a `data:`/`url(` payload. */
const CSS_IMAGE_SINK =
  /(backgroundImage|borderImageSource|listStyleImage|maskImage|WebkitMaskImage|src)\s*=|setProperty\s*\(\s*["'](?:background|border-image|list-style|mask)/;

/** A literal that carries bytes rather than a reference. */
const BLOB_LITERAL = /data:[a-z]+\/|url\(/i;

/**
 * Remove comments and TEMPLATE LITERALS so the guard is not defeated (or falsely
 * tripped) by prose or by a test's own backtick-quoted source. Regex literals are not
 * parsed — documented limit: a `/…\/\//` literal could confuse the line-comment pass,
 * and that under-counts rather than over-counts.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => line.replace(/(^|\s)\/\/.*$/, "$1"))
    .join("\n")
    .replace(/`[^`]*`/g, " ");
}

/** Every `.js` under `js/`, recursive, POSIX-relative to the repo root. */
function readProductSources(root = ROOT) {
  const out = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) {
        const rel = path.relative(root, full).split(path.sep).join("/");
        out[rel] = fs.readFileSync(full, "utf8");
      }
    }
  };
  const jsDir = path.join(root, "js");
  if (fs.existsSync(jsDir)) walk(jsDir);
  return out;
}

/**
 * The five rules, over a `{relPath: source}` map.
 *
 * @param {Record<string, string>} sources
 * @returns {{findings: Array<{rule:string,file:string,line:number,message:string}>, checked:string[]}}
 */
function checkSources(sources) {
  const findings = [];
  const checked = [];
  const at = (src, index) => src.slice(0, index).split("\n").length;

  const bare = {};
  for (const [rel, src] of Object.entries(sources)) bare[rel] = stripComments(src);

  // ---- R1 + R2: the choke point exists and sanitizes before it injects -------------
  const choke = bare[CHOKE_POINT];
  if (choke === undefined) {
    findings.push({
      rule: "R1",
      file: CHOKE_POINT,
      line: 0,
      message:
        `${CHOKE_POINT} is MISSING. AC-9's single-source render invariant requires the ` +
        `choke point to exist; without it this guard would pass vacuously.`,
    });
  } else {
    checked.push(`${CHOKE_POINT} (choke point present)`);
    if (!new RegExp(`function\\s+${RENDER_FN}\\b`).test(choke)) {
      findings.push({
        rule: "R1",
        file: CHOKE_POINT,
        line: 0,
        message: `${CHOKE_POINT} declares no \`function ${RENDER_FN}\` — the choke point named by AC-9.`,
      });
    }
    if (!/\bsanitizeSvg\b/.test(choke)) {
      findings.push({
        rule: "R2",
        file: CHOKE_POINT,
        line: 0,
        message:
          `${CHOKE_POINT} never calls the AC-1 trust root (\`validateSvg\`/\`sanitizeSvg\`). ` +
          `The choke point must sanitize INTERNALLY.`,
      });
    }
    // The injection must read the validator's own output, not a caller-supplied string.
    const injectIdx = choke.search(MARKUP_PRIMITIVE);
    if (injectIdx !== -1) {
      const line = at(choke, injectIdx);
      const lineText = choke.split("\n")[line - 1] || "";
      if (!/sanitiz/i.test(lineText)) {
        findings.push({
          rule: "R2",
          file: CHOKE_POINT,
          line,
          message:
            `${CHOKE_POINT}:${line} injects markup from a value that is not the sanitizer's ` +
            `output (\`${lineText.trim()}\`). sanitize-then-inject; never inject-if-caller-says-clean.`,
        });
      } else {
        checked.push(`${CHOKE_POINT}:${line} (sanitize-then-inject)`);
      }
    }
  }

  // ---- R3 + R4 + R5: no second injection site ------------------------------------
  for (const [rel, src] of Object.entries(bare)) {
    if (rel === CHOKE_POINT) continue;

    for (const line of src.split("\n")) {
      if (MARKUP_PRIMITIVE.test(line) && SVG_SOURCE.test(line)) {
        findings.push({
          rule: "R3",
          file: rel,
          line: 0,
          message:
            `${rel}: markup-injection primitive with an SVG source — \`${line.trim()}\`. ` +
            `All border SVG reaching the DOM must go through ${CHOKE_POINT}'s \`${RENDER_FN}\`.`,
        });
      }
      if (CSS_IMAGE_SINK.test(line) && BLOB_LITERAL.test(line) && SVG_SOURCE.test(line)) {
        findings.push({
          rule: "R4",
          file: rel,
          line: 0,
          message:
            `${rel}: \`data:\`/\`url(\` fed into a CSS image sink from an SVG source — ` +
            `\`${line.trim()}\`.`,
        });
      }
    }

    if (src.includes(OVERLAY_CLASS) && !OVERLAY_ALLOWED.includes(rel)) {
      findings.push({
        rule: "R5",
        file: rel,
        line: 0,
        message:
          `${rel} mentions the overlay node literal \`${OVERLAY_CLASS}\`; only ` +
          `${CHOKE_POINT} (creates it) and ${PRINT_STYLES} (styles/prints it) may. ` +
          `A third file is a second injection site.`,
      });
    }
    checked.push(`${rel} (no direct injection)`);
  }

  return { findings, checked };
}

function check() {
  return checkSources(readProductSources(ROOT));
}

function main() {
  const result = check();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const f of result.findings) {
      const where = f.line ? `${f.file}:${f.line}` : f.file;
      console.log(`FAIL [${f.rule}] ${where} — ${f.message}`);
    }
    console.log(
      `\n${result.checked.length} check(s) passed, ${result.findings.length} violation(s) ` +
        `(border-SVG injection guard, AC-9)`,
    );
  }
  if (result.findings.length) process.exitCode = 1;
}

module.exports = { check, checkSources, readProductSources, OVERLAY_CLASS, CHOKE_POINT };

if (require.main === module) main();
