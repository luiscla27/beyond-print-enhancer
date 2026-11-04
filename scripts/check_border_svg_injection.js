#!/usr/bin/env node
/**
 * check_border_svg_injection.js — the BLOCKING build guard for the SVG single-source
 * render invariant (track `byok_svg_borders_20260927`, AC-9 / AC-9b(ii)).
 *
 * WHY A BUILD GUARD AND NOT A NOTE
 * -------------------------------
 * AC-9's claim is about the BUILD: "a bypass fails the build/lint, never an advisory
 * note". A static property of the source tree, checked statically, blocking.
 *
 * THE RULES (operator decision D4, 2026-10-01 — the AI border rides the product's own
 * `border-image` slot, so the rules moved with it)
 * ---------------------------------------------------------------------------
 *  R1 — the choke point must EXIST. `js/ai_border.js` must declare `renderBorderSvg`
 *       and must call the trust root (`sanitizeSvg`, AC-1) itself.
 *  R2 — sanitize-then-paint: the choke point must (a) NEVER use a markup-injection
 *       primitive at all (the border SVG never becomes DOM markup — it becomes a CSS
 *       image), and (b) write the `--border-img` custom property on a line that
 *       mentions the sanitizer's output. The inject-if-caller-says-clean falsifier
 *       (AC-9b(i)) is now expressed as: no markup primitive, ever, in the choke point.
 *  R3 — no OTHER product file may use a markup-injection primitive on an SVG-sourced
 *       expression: `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write`
 *       whose right-hand side mentions a border-SVG source name.
 *  R4 — no OTHER product file may feed a `data:`/`url(` value into a CSS image sink
 *       from a border-SVG source. The choke point is the ONE sanctioned site (D4's
 *       amended AC-9 clause); everywhere else a border-SVG source must never become a
 *       CSS image value.
 *  R5 — the RETIRED overlay literal `be-border-svg-overlay` must appear in ZERO product
 *       files. It was allowed in exactly two under the pre-D4 implementation; D4
 *       deleted the overlay node, so any reappearance is a second renderer being
 *       rebuilt and fails the build.
 *
 * HOSTILE INPUT
 * -------------
 * The scan is over SOURCE TEXT, and this file's own docstring quotes the banned
 * patterns, so comments and template literals are stripped before matching.
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
const RENDER_FN = "renderBorderSvg";
const CSS_CUSTOM_PROP = "--border-img";

/** The overlay node's class — RETIRED by D4. R5 fails the build on any reappearance. */
const OVERLAY_CLASS = "be-border-svg-overlay";

/**
 * Names that mean "a border SVG string is flowing here".
 *
 * This is a NAME match, and its limit is stated rather than hidden: too broad a pattern
 * is a false alarm (`window.Icons.svg` is an icon lookup, not a border payload —
 * MEASURED, it tripped the first draft of this file on two unrelated modules), so the
 * set is the border-specific spellings plus the library record's `svg` field. The
 * STRUCTURAL rules below (R2's sanitize-then-paint, R5's retired literal) carry the
 * weight; this rule is the cheap tripwire for the obvious bypass.
 */
const SVG_SOURCE =
  /\bborderSvg\b|\brawSvg\b|\bsanitizedSvg\b|\bborderSvgString\b|\bborder_svg\b|\brecord\.svg\b|\bborder\.svg\b/;

/** DOM markup-injection primitives. */
const MARKUP_PRIMITIVE =
  /\.(innerHTML|outerHTML)\s*=[^=]|\.insertAdjacentHTML\s*\(|document\.write(?:ln)?\s*\(/;

/**
 * CSS image sinks that accept a `data:`/`url(` payload, plus the `--border-img`
 * custom-property write D4 introduced. The custom property is named explicitly so a
 * second writer of the AI border's source fails R4 rather than sliding through a
 * pattern that only knew `backgroundImage`/`borderImageSource`.
 */
const CSS_IMAGE_SINK =
  /(backgroundImage|borderImageSource|listStyleImage|maskImage|WebkitMaskImage|src)\s*=|setProperty\s*\(\s*["'](?:background|border-image|list-style|mask|--border-img)/;

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

  // ---- R1 + R2: the choke point exists and paints from the sanitizer's output ----
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
    // R2(a): the choke point must NEVER inject markup — D4 moved the border off the DOM
    // and into a CSS image, so any markup primitive in the choke point is a bypass.
    const markupIdx = choke.search(MARKUP_PRIMITIVE);
    if (markupIdx !== -1) {
      findings.push({
        rule: "R2",
        file: CHOKE_POINT,
        line: at(choke, markupIdx),
        message:
          `${CHOKE_POINT} uses a markup-injection primitive. Under D4 the border SVG never ` +
          `becomes DOM markup — it becomes a CSS image (a \`data:\` URI in ` +
          `\`${CSS_CUSTOM_PROP}\`); an \`innerHTML\` here is a second render surface.`,
      });
    }
    // R2(b): the custom-property PAINT must derive from the sanitizer's output.
    // Scoped to the actual assignment (`setProperty`/`borderImageSource`), not any
    // mention of the property name — the property also appears in a frozen array
    // literal and in prose, neither of which paints anything.
    const paintRe = new RegExp(
      `(setProperty\\s*\\(\\s*["']${CSS_CUSTOM_PROP}["']|\\b${CSS_CUSTOM_PROP}\\b\\s*[:=])`,
    );
    const paintMatch = choke.match(paintRe);
    if (!paintMatch) {
      findings.push({
        rule: "R2",
        file: CHOKE_POINT,
        line: 0,
        message:
          `${CHOKE_POINT} never paints \`${CSS_CUSTOM_PROP}\` (no setProperty/assignment ` +
          `found) — under D4 the choke point paints the border by writing that custom ` +
          `property from the trust root's output.`,
      });
    } else {
      const paintLine = at(choke, paintMatch.index);
      const lineText = choke.split("\n")[paintLine - 1] || "";
      if (!/sanitiz/i.test(lineText)) {
        findings.push({
          rule: "R2",
          file: CHOKE_POINT,
          line: paintLine,
          message:
            `${CHOKE_POINT}:${paintLine} writes \`${CSS_CUSTOM_PROP}\` from a value that ` +
            `is not the sanitizer's output (\`${lineText.trim()}\`). sanitize-then-paint; ` +
            `never paint-what-the-caller-says-is-clean.`,
        });
      } else {
        checked.push(`${CHOKE_POINT}:${paintLine} (sanitize-then-paint)`);
      }
    }
  }

  // ---- R3 + R4 + R5: no second render surface, no second writer -------------------
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
            `\`${line.trim()}\`. Under D4 the choke point is the ONE sanctioned site for ` +
            `that write; a second writer is a second render surface.`,
        });
      }
    }

    if (src.includes(OVERLAY_CLASS)) {
      findings.push({
        rule: "R5",
        file: rel,
        line: 0,
        message:
          `${rel} mentions the RETIRED overlay literal \`${OVERLAY_CLASS}\`. D4 deleted ` +
          `the overlay node — the AI border rides the product's \`::before\` ` +
          `\`border-image\` slot instead. Any reappearance is a second renderer.`,
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
