/**
 * Scratch: turn the "three 1px rules with a 6px gap" claim into raw pixel
 * evidence, because the phase-1 reviewer correctly refused to pass AC-1/AC-2
 * from a downscaled collage ("I cannot resolve a claimed 1px stroke from
 * pixels at this collage scale — a claim you cannot verify from the pixels is
 * a defect in MY evidence").
 *
 * Outputs, per surface:
 *   - a vertical scanline down the surface's horizontal centre, dumped as raw
 *     RGB per row, with the ornament rows CLASSIFIED and their offsets
 *     computed from the outermost ornament row — so the rule stack and the
 *     gap stop being an impression and become numbers;
 *   - a horizontal scanline across the corner region, same treatment;
 *   - a 10x NEAREST-NEIGHBOUR zoom of the top-left corner region (aligned to
 *     the outermost rule) so a reviewer can COUNT the strokes; 1px becomes
 *     10px with no smoothing invented.
 *
 *   node temp/ornament_pixel_probe.js
 */
"use strict";

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "vendor", "docs", "ornament-symmetry-20260910");
const SRC = path.join(DOCS, "shots-phase1");

// The hexes the ornament is allowed to use, and what each means.
const KNOWN = {
  "#0C0907": "seamDeep (blind tool)",
  "#4A3E2B": "hairGold (hairline)",
  "#6B5A36": "goldShadow (hairline on the modal / diamond fill)",
  "#C6A15B": "gold (corner stroke)",
  "#E9D6A4": "goldHi (corner highlight / focus)",
  "#191410": "groundPanel",
  "#1E1813": "groundModal",
  "#221C16": "groundTray",
  "#120D0A": "groundWell",
};

const TARGETS = [
  { file: "10-control-panel.png", label: "control-panel" },
  { file: "12-layer-manager.png", label: "layer-manager" },
  { file: "13-modal-shell.png", label: "modal" },
];

async function load(file) {
  const { data, info } = await sharp(path.join(SRC, file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, info };
}

const hex = (n) => n.toString(16).padStart(2, "0");
const at = (img, x, y) => {
  const i = (y * img.info.width + x) * img.info.channels;
  return "#" + [img.data[i], img.data[i + 1], img.data[i + 2]].map(hex).join("").toUpperCase();
};

/** Rows near the top of the frame that carry an ornament hex. */

async function main() {
  const report = {};
  for (const t of TARGETS) {
    const img = await load(t.file);
    const cx = Math.floor(img.info.width / 2);

    // Walk the centre column from the top and find the FIRST ornament row:
    // that is the outermost rule (whatever the frame's padding is).
    let firstOrn = -1;
    for (let y = 0; y < Math.min(120, img.info.height); y++) {
      if (KNOWN[at(img, cx, y)]) {
        firstOrn = y;
        break;
      }
    }
    if (firstOrn < 0) throw new Error("no ornament row found in " + t.file);

    const stack = [];
    for (let y = firstOrn; y < firstOrn + 24; y++) {
      const c = at(img, cx, y);
      stack.push({ offsetFromOuterEdge: y - firstOrn, hex: c, role: KNOWN[c] || null });
    }

    // The corner region: 44px square starting at the outermost rule row, but
    // shifted left to the surface's own left edge. Find it by walking the row
    // that holds the outermost rule until the ornament hex starts.
    let leftEdge = -1;
    for (let x = 0; x < img.info.width; x++) {
      if (at(img, x, firstOrn) === stack[0].hex) {
        leftEdge = x;
        break;
      }
    }
    if (leftEdge < 0) leftEdge = 0;

    // The L arms are at rule C's offset, one row per arm.
    const ruleC = stack.find((s) => s.offsetFromOuterEdge > 2 && s.role);
    const armRow = firstOrn + (ruleC ? ruleC.offsetFromOuterEdge : 8);
    const armScan = [];
    for (let d = 0; d < 20; d++) {
      const row = [];
      for (let x = 0; x < 22; x++) row.push(at(img, leftEdge + x, armRow + d));
      armScan.push({ offsetFromRuleC: d, pixels: row });
    }

    const zoom = await sharp(path.join(SRC, t.file))
      .extract({
        left: Math.max(0, leftEdge),
        top: Math.max(0, firstOrn),
        width: 44,
        height: 44,
      })
      .resize(44 * 10, 44 * 10, { kernel: "nearest" })
      .png()
      .toBuffer();

    report[t.label] = {
      file: t.file,
      frameSize: { w: img.info.width, h: img.info.height },
      outermostRuleY: firstOrn,
      surfaceLeftEdgeX: leftEdge,
      ruleStack: stack,
      // derived: the ornament rows, with their distance from the outer edge
      rules: stack.filter((s) => s.role),
      cornerArmRow: armRow,
      horizontalScanAtRuleC: armScan.slice(0, 4),
      cornerZoom: `pixel-probe-${t.label}-corner-10x.png`,
    };
    fs.writeFileSync(path.join(DOCS, `pixel-probe-${t.label}-corner-10x.png`), zoom);
  }

  const out = path.join(DOCS, "pixel-probe.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("pixel probe written:", out, "\n");
  for (const [k, v] of Object.entries(report)) {
    console.log("=== " + k + " (frame " + v.frameSize.w + "x" + v.frameSize.h +
      ", outer edge y=" + v.outermostRuleY + ", surface x=" + v.surfaceLeftEdgeX + ")");
    for (const r of v.rules) {
      console.log("   +" + String(r.offsetFromOuterEdge).padStart(2) + "px  " + r.hex + "  " + r.role);
    }
  }
}

main().catch((e) => {
  console.error(String(e.stack || e));
  process.exit(1);
});
