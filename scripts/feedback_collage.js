#!/usr/bin/env node
/**
 * Collage composer for the feedback_lifecycle_a11y_20260910 visual gates.
 *
 * Stitches the phase's NAMED frames into one caption-free grid (per the track's
 * visual_gate_protocol.md §2 — descriptions live in collage-phaseN.md, never
 * burned into the cells). Cells are produced by cropping every frame with the
 * SAME window at the SAME scale, so a claim that compares two cells ("the two
 * AC-2 copies differ") is a like-for-like comparison. The ornament track lost two
 * gate rounds to collages whose cells were scaled differently; this composer makes
 * that impossible by construction: one window, one scale, for the whole phase.
 *
 * Usage:
 *   node scripts/feedback_collage.js <phase 1|2> [--cols N]
 *
 * Output: docs/feedback-lifecycle-a11y-20260910/collage-phase<N>.png
 */
"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ART = path.join(ROOT, "docs", "feedback-lifecycle-a11y-20260910");

/**
 * Per-phase composition plan. `window` is the crop applied to EVERY frame of the
 * phase; `scale` is the uniform zoom for every cell.
 */
const PLANS = {
  1: {
    cols: 2,
    // The toast lane: wide enough for the longest toast and tall enough for the
    // full five-deep stack, anchored at the lane's own top-left reference.
    window: { left: 340, top: 20, width: 760, height: 260 },
    scale: 0.85,
    cells: [
      "10-toast-with-dismiss.png",
      "11-toast-error-retained.png",
      "12-boot-restore-success.png",
      "12c-boot-default-copy.png",
      "13-partial-spell-restore.png",
      "14-after-dismiss.png",
    ],
  },
  2: {
    cols: 2,
    // Whole viewport: the phase-2 claims are about a centred dialog AND a menu
    // clamped at a viewport edge, so the frame's full extent is the evidence.
    window: null,
    scale: 0.5,
    cells: [
      "20-empty-state-dialog.png",
      "20b-empty-state-still-present.png",
      "21-context-menu-keyboard.png",
      "21b-context-menu-after-walk.png",
      "22-context-menu-clamped.png",
    ],
  },
  // A ZOOM collage for the same phase, composed from the SAME frames: the
  // reviewer of round 1 could not judge the focus treatment or the clamp margin at
  // collage scale and asked for a higher-resolution crop / a view without collage
  // chrome. Cropping the committed frames answers both without re-capturing.
  "2z": {
    shotsPhase: 2,
    outName: "collage-phase2-zoom.png",
    cols: 3,
    // A uniform window around the menu region of the three menu frames (the menu
    // opens at 1208,782 in cells 3/4 and at 1282,766 when clamped in cell 5).
    window: { left: 1140, top: 700, width: 300, height: 200 },
    scale: 3,
    cells: [
      "21-context-menu-keyboard.png",
      "21b-context-menu-after-walk.png",
      "22-context-menu-clamped.png",
    ],
  },
};

async function main() {
  const phase = process.argv[2];
  const plan = PLANS[phase];
  if (!plan) {
    console.error("usage: node scripts/feedback_collage.js <1|2> [--cols N]");
    process.exit(2);
  }
  const colsIdx = process.argv.indexOf("--cols");
  const cols = colsIdx > 0 ? parseInt(process.argv[colsIdx + 1], 10) || plan.cols : plan.cols;

  const shotsPhase = plan.shotsPhase || phase;
  const outName = plan.outName || `collage-phase${phase}.png`;
  const provName = plan.outName
    ? plan.outName.replace(/\.png$/, ".provenance.json")
    : `collage-phase${phase}.provenance.json`;
  const shots = path.join(ART, `shots-phase${shotsPhase}`);
  const missing = plan.cells.filter((c) => !fs.existsSync(path.join(shots, c)));
  if (missing.length) {
    console.error(`phase ${phase}: missing frames: ${missing.join(", ")}`);
    process.exit(3);
  }

  const tiles = [];
  for (const cell of plan.cells) {
    let img = sharp(path.join(shots, cell));
    if (plan.window) img = img.extract(plan.window);
    const buf = await img
      .resize({
        width: Math.round((plan.window ? plan.window.width : 1440) * plan.scale),
        height: Math.round((plan.window ? plan.window.height : 900) * plan.scale),
        fit: "fill",
      })
      .png()
      .toBuffer();
    const meta = await sharp(buf).metadata();
    tiles.push({ cell, buf, width: meta.width, height: meta.height });
  }

  const cellW = tiles[0].width;
  const cellH = tiles[0].height;
  // Uniformity assertion: the whole point of this composer.
  for (const t of tiles) {
    if (t.width !== cellW || t.height !== cellH) {
      throw new Error(
        `cell ${t.cell} is ${t.width}x${t.height}, expected ${cellW}x${cellH} — ` +
          "cells in one collage must share a window and a scale",
      );
    }
  }

  const rows = Math.ceil(tiles.length / cols);
  const gutter = 2;
  const gut = "#1a1a1a";
  const W = cols * cellW + (cols + 1) * gutter;
  const H = rows * cellH + (rows + 1) * gutter;

  const composites = tiles.map((t, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return {
      input: t.buf,
      left: gutter + c * (cellW + gutter),
      top: gutter + r * (cellH + gutter),
    };
  });

  const out = path.join(ART, outName);
  await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: gut,
    },
  })
    .composite(composites)
    .png()
    .toFile(out);

  const prov = {
    phase: Number(phase),
    cells: tiles.map((t) => t.cell),
    cols,
    cellSize: { w: cellW, h: cellH },
    gutter,
    window: plan.window,
    scale: plan.scale,
    composedAt: new Date().toISOString(),
    composer: "scripts/feedback_collage.js",
  };
  fs.writeFileSync(path.join(ART, provName), JSON.stringify(prov, null, 2));
  console.log(`wrote ${path.relative(ROOT, out)} (${W}x${H}, ${cols}x${rows} cells of ${cellW}x${cellH})`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
