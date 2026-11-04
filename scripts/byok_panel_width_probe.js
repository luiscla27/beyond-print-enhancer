#!/usr/bin/env node
/**
 * Panel-width probe for the AC-V1-lite collage — the pixels behind V7's claim.
 *
 * Why this exists: the reviewer's V7 verdict ("the new dialog is noticeably WIDER than the
 * existing dialogs") contradicts the DOM measurement written by the same run
 * (`byok-phase2-measurements.json`: empty/rename/help all report `box.w = 400`). A visual
 * gate that turns into a dispute about width gets settled by measuring the frame, not by
 * talking. This scans a horizontal band across each cell and reports the contiguous span of
 * modal-ground pixels — the panel's own edges in the image.
 *
 * Usage: node scripts/byok_panel_width_probe.js <collage.png>
 */
"use strict";
const path = require("path");
const sharp = require("sharp");

const file = process.argv[2] || path.resolve(__dirname, "..", "vendor/docs/byok-ai-layout-20260915/collage-phase2.png");

/** The modal's own ground colour, MEASURED from the DOM probe: rgb(30, 24, 19). */
const GROUND = { r: 30, g: 24, b: 19 };
const TOL = 6;

const isGround = (r, g, b) =>
  Math.abs(r - GROUND.r) <= TOL && Math.abs(g - GROUND.g) <= TOL && Math.abs(b - GROUND.b) <= TOL;

async function main() {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  console.log("image:", path.basename(file), `${width}x${height}`, `channels=${channels}`);

  // Cell geometry, exactly as scripts/byok_collage.js composes it.
  const GAP = 12;
  const cellW = Math.round(520 * 0.6);
  const cellH = Math.round(760 * 0.6);
  const cols = 3;
  const names = [
    "1 NEW empty",
    "2 NEW filled",
    "3 NEW error",
    "4 EXISTING rename",
    "5 EXISTING help",
  ];

  const at = (x, y) => {
    const i = (y * width + x) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  names.forEach((name, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const left = GAP + col * (cellW + GAP);
    const top = GAP + row * (cellH + GAP);
    const results = [];
    for (const frac of [0.25, 0.4, 0.55]) {
      const y = top + Math.round(cellH * frac);
      if (y >= height) continue;
      let first = -1;
      let last = -1;
      for (let x = left; x < left + cellW && x < width; x += 1) {
        const [r, g, b] = at(x, y);
        if (isGround(r, g, b)) {
          if (first < 0) first = x;
          last = x;
        }
      }
      results.push({
        scanY: y - top,
        spanPx: first < 0 ? 0 : last - first + 1,
        leftEdge: first < 0 ? null : first - left,
        rightEdge: first < 0 ? null : last - left,
      });
    }
    console.log(name, JSON.stringify(results));
  });
}

main().catch((e) => {
  console.error(String(e && e.stack ? e : e));
  process.exit(1);
});
