#!/usr/bin/env node
"use strict";
/**
 * Phase 0 re-measurement for track ux_gaps_20260911 (AC-6).
 * Read-only. Re-derives EVERY number the spec asserts, and classifies each M-1
 * site, so the disposition record is reproducible rather than recalled.
 *
 * Output: a plain-text report on stdout (pasted into phase0_remeasurement.md).
 */
const fs = require("fs");

const out = [];
const say = (s = "") => out.push(s);

// ---- the injected file set, derived from the product's OWN list -------------
const bgSrc = fs.readFileSync("js/background.js", "utf8");
const INJ = [.../(files:\s*\[[\s\S]*?\])/.exec(bgSrc)[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);

say("== M-1 — the encoding defect class ==");
say(`injected files (derived from js/background.js): ${INJ.length}   [spec: 28]`);
say(`background.js itself injected? ${INJ.includes("js/background.js")}`);

// raw non-ASCII, and BOMs
let withRaw = 0, rawTotal = 0, boms = [], injLines = 0;
for (const f of INJ) {
  const buf = fs.readFileSync(f);
  if (buf.slice(0, 3).toString("hex") === "efbbbf") boms.push(f);
  const src = buf.toString("utf8");
  injLines += src.split("\n").length;
  let n = 0;
  for (const ch of src) if (ch.codePointAt(0) > 127) n++;
  if (n) withRaw++;
  rawTotal += n;
}
say(`lines of the injected set: ${injLines}   [spec: 19,244]`);
say(`files carrying raw non-ASCII: ${withRaw}   [spec: 23]`);
say(`raw non-ASCII occurrences: ${rawTotal}   [spec: 465]`);
say(`BOMs in injected files: ${boms.length}   [spec: 0]`);
say("");

// ---- the user-visible classification --------------------------------------
// A string "reaches the DOM" if it is assigned to text/innerHTML/title/aria-label/
// placeholder, or passed as the label argument to a UI builder. Comment lines are
// excluded, and a trailing // comment is stripped first, so the count is not
// inflated by prose (spec's rule).
const VISIBLE = /(textContent|innerHTML|title|aria-label|placeholder|setAttribute)\s*[=:]|createFilterSlider\(|label:\s*["'`]/;
const rawSites = [], escSites = [];
for (const f of INJ) {
  const src = fs.readFileSync(f, "utf8");
  src.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;           // full-line comment
    const code = line.replace(/\s\/\/.*$/, "");            // strip trailing comment
    if (!VISIBLE.test(code)) return;
// deliberate: the control characters ARE the measurement (a byte-level
// encoding probe), not an accident this rule exists to catch.
// eslint-disable-next-line no-control-regex
    if (/[^\x00-\x7F]/.test(code)) rawSites.push([f, i + 1, code.trim()]);
    // `\uXXXX` escapes above 127: the character is INVISIBLE to a byte scan
    const esc = [...code.matchAll(/\\u([0-9a-fA-F]{4})/g)]
      .map((m) => parseInt(m[1], 16)).filter((cp) => cp > 127);
    if (esc.length) escSites.push([f, i + 1, esc.map((c) => "U+" + c.toString(16).toUpperCase().padStart(4, "0")).join(" "), code.trim()]);
  });
}
say(`user-visible RAW non-ASCII assignment sites: ${rawSites.length}   [spec: 30]`);
say(`user-visible ESCAPED (\\uXXXX) sites: ${escSites.length}   [spec: NOT MEASURED — new finding]`);
say("");
say("-- raw sites --");
for (const [f, ln, code] of rawSites) say(`   ${f}:${ln}  ${code.slice(0, 92)}`);
say("");
say("-- escaped sites (a byte scan cannot see these) --");
for (const [f, ln, cps, code] of escSites) say(`   ${f}:${ln}  [${cps}]  ${code.slice(0, 76)}`);
say("");

// ---- the same character, two spellings ------------------------------------
say("== the ✕ U+2715 contradiction (same glyph, two encodings) ==");
for (const f of INJ) {
  const src = fs.readFileSync(f, "utf8");
  src.split("\n").forEach((line, i) => {
    if (/\\u2715/.test(line)) say(`   ESCAPE  ${f}:${i + 1}  ${line.trim().slice(0, 60)}`);
    else if (line.includes("\u2715")) say(`   RAW     ${f}:${i + 1}  ${line.trim().slice(0, 60)}`);
  });
}
say("");

// ---- M-2 discoverability ---------------------------------------------------
say("== M-2 — discoverability ==");
const controls = fs.readFileSync("js/controls.js", "utf8");
const hint = /text\.textContent\s*=\s*\n?\s*"([^"]+)"/.exec(controls);
say(`the first-run hint teaches (js/controls.js:860): "${hint ? hint[1] : "?"}"`);
const helpish = INJ.filter((f) => {
  const s = fs.readFileSync(f, "utf8");
  return /showHelp|helpModal|showShortcuts|keymap|gestureList/i.test(s);
});
say(`files containing a help/shortcut/keymap surface: ${helpish.length} (${helpish.join(", ") || "none"})`);
let ctrlMentions = [];
for (const f of INJ) {
  fs.readFileSync(f, "utf8").split("\n").forEach((l, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
    if (/Ctrl\+Z|Cmd\+Z|Ctrl\/Cmd\+Z/.test(l)) ctrlMentions.push(`${f}:${i + 1}  ${l.trim().slice(0, 78)}`);
  });
}
say(`code (non-comment) mentions of Ctrl/Cmd+Z: ${ctrlMentions.length}`);
for (const m of ctrlMentions) say(`   ${m}`);
const readme = fs.readFileSync("README.md", "utf8");
const numbered = [...readme.matchAll(/^\d+\.\s\*\*/gm)].length;
say(`numbered features in README.md: ${numbered}   [spec: 17]`);
say("");

// ---- M-3 recovery models ---------------------------------------------------
say("== M-3 — the two recovery models ==");
const undo = fs.readFileSync("js/undo.js", "utf8"), pers = fs.readFileSync("js/persistence.js", "utf8");
say(`UNDO_STACK_MAX: ${/const UNDO_STACK_MAX = (\d+)/.exec(undo)[1]}   [spec: 25]  at js/undo.js:${undo.split("\n").findIndex((l) => /const UNDO_STACK_MAX/.test(l)) + 1}`);
say(`MAX_BACKUPS: ${/const MAX_BACKUPS = (\d+)/.exec(pers)[1]}   [spec: 3]  at js/persistence.js:${pers.split("\n").findIndex((l) => /const MAX_BACKUPS/.test(l)) + 1}`);
const rowTray = {};
for (const m of controls.matchAll(/label:\s*"([^"]+)"[^}]*?tray:\s*"([a-z]+)"/gs)) rowTray[m[2]] = (rowTray[m[2]] || 0) + 1;
say(`panel rows per tray: ${JSON.stringify(rowTray)}   [spec: layout 5, output 5, help 1]`);
say("");

// ---- M-4 the reading window (NOT measured by the review) -------------------
say("== M-4 — the toast's actual reading window (this review did NOT measure it) ==");
const modals = fs.readFileSync("js/modals.js", "utf8");
const dwell = /hideTimer = setTimeout\(hide, (\d+)\)/.exec(modals);
const leave = /hideTimer = setTimeout\(hide, (\d+)\)/.exec(modals.slice(modals.indexOf("mouseleave")));
say(`initial dwell (js/modals.js): ${dwell ? dwell[1] : "?"} ms`);
say(`re-arm on mouseleave: ${leave ? leave[1] : "?"} ms`);
const fade = /}, (\d+)\);/.exec(modals.slice(modals.indexOf("const hide = ()")));
say(`fade-out before removal: ${fade ? fade[1] : "?"} ms`);
const drainCss = fs.readFileSync("js/ui_theme.js", "utf8");
const drain = /\.be-feedback-drain \{[\s\S]*?transition: width ([\d.]+)s/.exec(drainCss);
say(`drain bar animation: ${drain ? drain[1] : "?"} s`);
const refusal = "Could not save a backup before this change, so nothing was changed (storage is full). Free up space and try again.";
say(`the refusal string (js/recovery_ui.js:118-119): ${refusal.length} chars, ${refusal.split(/\s+/).length} words`);
const wpm = 200; // a conservative adult reading rate for short UI copy
const need = (refusal.split(/\s+/).length / wpm) * 60;
say(`at ${wpm} wpm that needs ~${need.toFixed(1)} s to read vs ~${((Number(dwell[1]) + Number(fade[1])) / 1000).toFixed(1)} s on screen`);
say("");

// ---- M-5 panel weight -----------------------------------------------------
say("== M-5 — the panel's surface ==");
const labels = [...controls.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
say(`action rows: ${labels.length}   [spec: 11]`);
say(`   ${labels.join(" | ")}`);
say(`(measured over ${INJ.length} injected files / ${injLines} lines)`);

process.stdout.write(out.join("\n") + "\n");
