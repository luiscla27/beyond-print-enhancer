#!/usr/bin/env node
"use strict";
/**
 * Phase 0, Muse Challenge Stage 5: the STYLESHEET persistence vector.
 * The script-side guard (AC-1b) cannot see glyphs emitted from generated CSS
 * (`content:` on a pseudo-element), so absence there must be MEASURED, not assumed.
 * Read-only.
 */
const fs = require("fs");
const bg = fs.readFileSync("js/background.js", "utf8");
const INJ = [.../(files:\s*\[[\s\S]*?\])/.exec(bg)[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);

// every `content: <string>` in the injected files, raw or escaped
const CONTENT = /content\s*:\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
let rows = [], total = 0;
for (const f of INJ) {
  const src = fs.readFileSync(f, "utf8");
  src.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(CONTENT)) {
      const val = m[2];
      const rawNonAscii = [...val].filter((c) => c.codePointAt(0) > 127);
      const escNonAscii = [...val.matchAll(/\\u([0-9a-fA-F]{4})/g)]
        .map((x) => parseInt(x[1], 16)).filter((cp) => cp > 127);
      if (!rawNonAscii.length && !escNonAscii.length && !val.trim()) continue;
      total++;
      rows.push({
        at: `${f}:${i + 1}`,
        raw: rawNonAscii.join("") || "-",
        rawCp: rawNonAscii.map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase()).join(",") || "-",
        esc: escNonAscii.map((c) => "U+" + c.toString(16).toUpperCase()).join(",") || "-",
        val: val.length > 46 ? val.slice(0, 46) + "…" : val,
      });
    }
  });
}

console.log("== stylesheet `content:` sinks in the injected files ==");
console.log(`non-empty content: values: ${total}`);
console.log("");
const bad = rows.filter((r) => r.raw !== "-" || r.esc !== "-");
console.log(`** with a RAW or ESCAPED non-ASCII glyph: ${bad.length} **`);
for (const r of bad) {
  console.log(`   ${r.at.padEnd(28)} raw=${r.rawCp.padEnd(10)} esc=${r.esc.padEnd(8)} "${r.val}"`);
}
console.log("");
console.log("-- all non-empty content: values (for the human-visible ones) --");
for (const r of rows) {
  if (r.raw === "-" && r.esc === "-" && !/[A-Za-z]{3}/.test(r.val)) continue; // skip empty/""
  console.log(`   ${r.at.padEnd(28)} "${r.val}"`);
}
