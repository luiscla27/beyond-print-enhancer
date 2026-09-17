#!/usr/bin/env node
/**
 * Collage composer for byok_ai_layout_20260915 Phase 2's AC-V1-lite visual gate.
 *
 * The gate's question is a COMPARISON ("does the new dialog read as part of the locked
 * identity, or as a bolted-on control?"), so the reviewer gets one image with the new
 * surface and two EXISTING compliant dialogs side by side, each cropped with the SAME
 * window at the SAME scale — the rule the ornament track learned the hard way (two gate
 * rounds lost to collages whose cells were scaled differently).
 *
 * A centre-anchored window is used rather than a per-frame bounding box: the dialogs differ
 * in HEIGHT (706 / 225 / 552 px), and a per-frame crop would silently normalise that
 * difference away — which is precisely the thing a reviewer must be able to see.
 *
 * Usage:  node scripts/byok_collage.js [<artifact root>]
 * Output: <root>/collage-phase2.png   (root defaults to the track's doc dir)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ART = path.resolve(process.argv[2] || path.join(ROOT, "vendor/docs/byok-ai-layout-20260915"));

/** The one window, applied to every cell. */
const WINDOW = { left: 460, top: 70, width: 520, height: 760 };
const SCALE = 0.6;
const COLS = 3;

/** Caption order is the reading order a reviewer needs: new states, then references. */
const CELLS = [
  ["10-ai-settings-empty.png", "1 NEW: empty (no provider, no key)"],
  ["11-ai-settings-filled.png", "2 NEW: provider chosen + key typed (masked)"],
  ["12-ai-settings-error.png", "3 NEW: rejected base URL"],
  ["20-reference-rename.png", "4 EXISTING: rename (input-bearing)"],
  ["21-reference-help.png", "5 EXISTING: help (read-only body)"],
];

async function main() {
  const cells = [];
  for (const [file, caption] of CELLS) {
    const full = path.join(ART, file);
    if (!fs.existsSync(full)) throw new Error("missing frame: " + full);
    const meta = await sharp(full).metadata();
    const extract = {
      left: Math.max(0, Math.min(WINDOW.left, meta.width - 1)),
      top: Math.max(0, Math.min(WINDOW.top, meta.height - 1)),
      width: Math.min(WINDOW.width, meta.width),
      height: Math.min(WINDOW.height, meta.height),
    };
    const buf = await sharp(full)
      .extract(extract)
      .resize(Math.round(extract.width * SCALE), Math.round(extract.height * SCALE))
      .png()
      .toBuffer();
    cells.push({ buf, caption, w: Math.round(extract.width * SCALE), h: Math.round(extract.height * SCALE) });
  }

  const GAP = 12;
  const rows = Math.ceil(cells.length / COLS);
  const cellW = Math.max(...cells.map((c) => c.w));
  const cellH = Math.max(...cells.map((c) => c.h));
  const width = COLS * cellW + (COLS + 1) * GAP;
  const height = rows * cellH + (rows + 1) * GAP;

  const canvas = sharp({
    create: { width, height, channels: 3, background: { r: 12, g: 10, b: 8 } },
  });
  const composite = cells.map((c, i) => ({
    input: c.buf,
    left: GAP + (i % COLS) * (cellW + GAP),
    top: GAP + Math.floor(i / COLS) * (cellH + GAP),
  }));
  await canvas.composite(composite).png().toFile(path.join(ART, "collage-phase2.png"));

  // The captions live in a sidecar, never burned into the cells (visual_gate_protocol §2).
  fs.writeFileSync(
    path.join(ART, "collage-phase2.cells.json"),
    JSON.stringify({ window: WINDOW, scale: SCALE, cells: CELLS.map(([f, c]) => ({ frame: f, caption: c })) }, null, 2),
  );
  console.log("wrote", path.join(ART, "collage-phase2.png"), `${width}x${height}`);
}

main().catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
