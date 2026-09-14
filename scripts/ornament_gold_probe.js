/**
 * Scratch: decisive test for the corner terminations (AC-2).
 *
 * Phase-1a's reviewer claimed to see gold L-terminations; phase-1b's claimed it
 * did not; and a scanline at the wrong row proves nothing either way. So this
 * finds EVERY gold pixel (#C6A15B stroke / #E9D6A4 highlight) in each surface
 * frame and reports its count, bounding box and coordinates — plus the same for
 * the other ornament hexes, so the rule stack and the Ls are read from the
 * image itself rather than from the CSS.
 *
 *   node temp/ornament_gold_probe.js
 */
"use strict";

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs", "ornament-symmetry-20260910");
const SRC = path.join(DOCS, "shots-phase1");

const GOLD = [0xc6, 0xa1, 0x5b];
const GOLD_HI = [0xe9, 0xd6, 0xa4];
const SEAM = [0x0c, 0x09, 0x07];
const HAIR = [0x4a, 0x3e, 0x2b];
const GOLD_SHADOW = [0x6b, 0x5a, 0x36];

const TARGETS = ["10-control-panel.png", "12-layer-manager.png", "13-modal-shell.png"];

const eq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

async function main() {
  const report = {};
  for (const file of TARGETS) {
    const { data, info } = await sharp(path.join(SRC, file))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const find = (colour) => {
      const hits = [];
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          const i = (y * info.width + x) * info.channels;
          if (eq([data[i], data[i + 1], data[i + 2]], colour)) hits.push([x, y]);
        }
      }
      if (!hits.length) return { count: 0 };
      const xs = hits.map((h) => h[0]);
      const ys = hits.map((h) => h[1]);
      return {
        count: hits.length,
        bbox: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) },
        // the first 24 hits, which for a top-left corner reveal the L's shape
        head: hits.slice(0, 24),
      };
    };
    report[file] = {
      frameSize: { w: info.width, h: info.height },
      strokeGold_C6A15B: find(GOLD),
      highlightGoldHi_E9D6A4: find(GOLD_HI),
      seamDeep_0C0907: find(SEAM),
      hairGold_4A3E2B: find(HAIR),
      goldShadow_6B5A36: find(GOLD_SHADOW),
      // L-shape verification: at the top-left L's corner, both arms must exist
      // and must MEET (the earlier radius-clipped version produced two detached
      // 6px stubs whose arms never touched).
      lShape: (() => {
        const g = find(GOLD);
        if (!g.count) return { ok: false, reason: "no gold stroke pixels" };
        const [cx, cy] = g.head[0];
        const isGold = (x, y) => {
          const i = (y * info.width + x) * info.channels;
          return eq([data[i], data[i + 1], data[i + 2]], GOLD);
        };
        const hArm = [];
        for (let d = 0; d < 12; d++) hArm.push(isGold(cx + d, cy));
        const vArm = [];
        for (let d = 0; d < 12; d++) vArm.push(isGold(cx, cy + d));
        return {
          corner: [cx, cy],
          horizontalArm12px: hArm.every(Boolean),
          verticalArm12px: vArm.every(Boolean),
          armsMeet: isGold(cx, cy),
          horizontalPixels: hArm.filter(Boolean).length,
          verticalPixels: vArm.filter(Boolean).length,
        };
      })(),
    };
  }
  const out = path.join(DOCS, "gold-probe.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("gold probe written:", out, "\n");
  for (const [file, v] of Object.entries(report)) {
    console.log("=== " + file + " (" + v.frameSize.w + "x" + v.frameSize.h + ")");
    for (const [k, val] of Object.entries(v)) {
      if (k === "frameSize") continue;
      console.log(
        "  " + k + ": " + val.count +
        (val.bbox ? "  bbox x[" + val.bbox.x0 + ".." + val.bbox.x1 + "] y[" + val.bbox.y0 + ".." + val.bbox.y1 + "]" : ""),
      );
    }
    const g = v.strokeGold_C6A15B;
    if (g.count) console.log("    stroke head:", JSON.stringify(g.head.slice(0, 13)));
    const hi = v.highlightGoldHi_E9D6A4;
    if (hi.count) console.log("    highlight head:", JSON.stringify(hi.head.slice(0, 13)));
    console.log("    L-shape:", JSON.stringify(v.lShape));
  }
}

main().catch((e) => {
  console.error(String(e.stack || e));
  process.exit(1);
});
