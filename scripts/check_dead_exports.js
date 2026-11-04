#!/usr/bin/env node
/**
 * check_dead_exports.js — the re-rot GUARD (track dead_exports_20260910, AC-6).
 *
 * WHAT IT BLOCKS
 * --------------
 * A `window.*` export (direct, or a member of an exported namespace) that
 *   (a) nothing in `js/` reaches, and
 *   (b) is not annotated at its declaring site, and
 *   (c) is not allowlisted below as a deliberate seam,
 * is NEW surface nobody asked for and nobody uses. That is how the 120-export
 * surface accumulated the dead weight this track just removed, so the guard
 * fails on it.
 *
 * WHY ANNOTATION, NOT DELETION
 * ----------------------------
 * Deleting a `window.*` export is a public API change (see the track spec §
 * Working notes 1), and the project also deliberately keeps dead-looking seams:
 * `__lastUploadInput` has no product caller and is used only by a test; deleting
 * it breaks a suite. So the guard's verdict is "explain yourself", not "delete".
 * The annotation is a comment at the declaring site carrying the marker
 * `Test seam` / `Public API` / `Lazy seam`, and it must say WHAT depends on it —
 * see `scripts/audit_dead_exports.md` for the convention.
 *
 * THE VERDICT IS THE AUDIT'S
 * --------------------------
 * This file does not re-implement counting; it consumes
 * `scripts/audit_dead_exports.js` (the same tables the track's evidence came
 * from), so the guard and the audit can never drift apart.
 *
 * HOST PROPERTIES ARE NOT EXPORTS
 * -------------------------------
 * `window.onresize = null` clears a global handler; it publishes nothing. Those
 * rows are skipped and reported as skipped.
 *
 * USAGE
 *   node scripts/check_dead_exports.js          # exit 0 = clean, 1 = violations
 *   node scripts/check_dead_exports.js --json   # machine-readable findings
 *
 * It runs as part of the suite (`test/unit/dead_exports.test.js`), so it is not
 * a separate manual step nobody remembers to run.
 */
"use strict";

const { loadSources, buildRows } = require("./audit_dead_exports.js");

/**
 * The annotation marker an unannotated-looking export must carry in the comment
 * block above (or on) its declaring line.
 */
const MARKERS = [/Test seam/i, /Public API/i, /Lazy seam/i, /Deliberately kept/i];

/**
 * Exports with no product caller that are ALLOWED to stay despite no marker.
 * Each entry must name WHY; an empty list is the goal — an entry here is a
 * waiver, and a waiver nobody revisits is how surface rots.
 *
 * Empty on purpose at the time of writing: every dead-looking row the audit
 * reports is annotated at its declaring site, so a waiver would only hide a
 * future regression.
 */
const ALLOWLISTED = [
  // e.g. { name: "X", reason: "…" }
];

/** How many lines above a declaration to search for the annotation. */
const COMMENT_LOOKBACK = 8;

function isAnnotated(lines, lineNo) {
  const from = Math.max(0, lineNo - 1 - COMMENT_LOOKBACK);
  const block = lines.slice(from, lineNo).join("\n");
  return MARKERS.some((re) => re.test(block));
}

/**
 * Findings: rows the guard objects to. A row is a finding when it has no product
 * caller, is not host-property, is not annotated and is not allowlisted.
 */
function check() {
  const sources = loadSources();
  const { rows } = buildRows(sources);
  const findings = [];
  const skipped = [];
  const checked = [];
  const allowNames = new Set(ALLOWLISTED.map((a) => a.name));
  const usedAllow = new Set();

  for (const row of rows) {
    const label = row.namespace ? `${row.namespace}.${row.name}` : row.name;
    if (row.kind === "host-property") {
      skipped.push({ label, why: "host-object property, not an export" });
      continue;
    }
    // A member of a namespace that is itself gone has no row to annotate; the
    // declaration that matters is the namespace's.
    if (row.removalUnit && row.removalUnit !== label) {
      skipped.push({ label, why: `member of ${row.removalUnit}, whose declaration is the removal unit` });
      continue;
    }
    if (row.counts.js > 0) {
      checked.push(label);
      continue;
    }
    if (allowNames.has(label) || allowNames.has(row.name)) {
      usedAllow.add(label);
      checked.push(label);
      continue;
    }
    const lines = sources[row.file].lines;
    if (isAnnotated(lines, row.line)) {
      checked.push(label);
      continue;
    }
    findings.push({
      label,
      file: row.file,
      line: row.line,
      verdict: row.verdict,
      counts: row.counts,
      consumers: row.testFiles,
      message:
        `${label} (${row.file}:${row.line}) has no caller in js/ ` +
        `(refs js/test/scripts = ${row.counts.js}/${row.counts.test}/${row.counts.scripts}) ` +
        `and is not annotated. Add a reason comment at the declaring site naming what ` +
        `depends on it (markers: Test seam | Public API | Lazy seam | Deliberately kept), ` +
        `or add it to ALLOWLISTED in scripts/check_dead_exports.js with a reason, or retire it.`,
    });
  }

  const staleAllow = ALLOWLISTED.filter((a) => !usedAllow.has(a.name) && !usedAllow.has(a.label));
  return { findings, skipped, checked, staleAllow };
}

function main() {
  const result = check();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const f of result.findings) console.log("FAIL " + f.message);
    for (const s of result.skipped) console.log(`skip ${s.label} — ${s.why}`);
    console.log(
      `\n${result.checked.length} export(s) checked, ${result.skipped.length} skipped ` +
        `(not exports), ${result.findings.length} violation(s)`
    );
  }
  if (result.findings.length) process.exitCode = 1;
}

module.exports = { check, MARKERS, ALLOWLISTED };

if (require.main === module) main();
