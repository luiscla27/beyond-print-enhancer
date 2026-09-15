#!/usr/bin/env node
/**
 * Collage composer for the destructive_recovery_20260911 visual gates.
 *
 * Per the track's visual_gate_protocol.md §2: the phase's NAMED frames are stitched
 * into one caption-free grid, every cell at a UNIFORM zoom, and any cell used for an
 * equality claim uses an identically sized window anchored at the same reference
 * point. The ornament track lost two gate rounds to collages whose cells were scaled
 * differently, so cell uniformity is asserted here and the composer refuses to write
 * a collage whose cells differ.
 *
 * Two collages:
 *   collage-phase2.png       four whole-viewport cells (0.5) — the layout claim
 *   collage-phase2-zoom.png  two cells of ONE window at 2x, anchored on the offer's
 *                            measured position, comparing the offer with the state
 *                            after the undo (the equality claim: the offer is gone)
 *
 * Usage: node scripts/recovery_collage.js
 * Output: vendor/docs/destructive-recovery-20260911/collage-phase2{,-zoom}.png
 */
"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ART = path.join(__dirname, "..", "vendor", "docs", "destructive-recovery-20260911");
const SHOTS = path.join(ART, "shots-phase2");

const FRAMES = [
  "20-undo-offer.png",
  "21-after-undo.png",
  "22-restore-entry.png",
  "23-restore-empty-honest.png",
];

async function grid(tiles, cols, outName) {
  const cellW = tiles[0].width;
  const cellH = tiles[0].height;
  for (const t of tiles) {
    if (t.width !== cellW || t.height !== cellH) {
      throw new Error(
        `cell ${t.label} is ${t.width}x${t.height}, expected ${cellW}x${cellH} — ` +
          "cells in one collage must share a window and a scale",
      );
    }
  }
  const rows = Math.ceil(tiles.length / cols);
  const gutter = 2;
  const W = cols * cellW + (cols + 1) * gutter;
  const H = rows * cellH + (rows + 1) * gutter;
  await sharp({ create: { width: W, height: H, channels: 4, background: "#1a1a1a" } })
    .composite(
      tiles.map((t, i) => ({
        input: t.buf,
        left: gutter + (i % cols) * (cellW + gutter),
        top: gutter + Math.floor(i / cols) * (cellH + gutter),
      })),
    )
    .png()
    .toFile(path.join(ART, outName));
  console.log(
    `wrote ${outName} — ${tiles.length} cells of ${cellW}x${cellH} ` +
      `(cols=${cols}, uniform window + scale asserted)`,
  );
}

async function main() {
  const missing = FRAMES.filter((f) => !fs.existsSync(path.join(SHOTS, f)));
  if (missing.length) {
    console.error(`missing frames: ${missing.join(", ")}`);
    process.exit(3);
  }
  const meta = await sharp(path.join(SHOTS, FRAMES[0])).metadata();

  // 1 — the four states, whole viewport, one scale.
  const wide = [];
  for (const f of FRAMES) {
    const buf = await sharp(path.join(SHOTS, f))
      .resize({
        width: Math.round(meta.width * 0.5),
        height: Math.round(meta.height * 0.5),
        fit: "fill",
      })
      .png()
      .toBuffer();
    const m = await sharp(buf).metadata();
    wide.push({ label: f, buf, width: m.width, height: m.height });
  }
  await grid(wide, 2, "collage-phase2.png");

  // 2 — the equality pair: the offer region, before and after the undo, through ONE
  //     window at 2x. The window is anchored on the measured offer box from the
  //     probe, so both cells are the same slice of the same screen area.
  const probePath = path.join(SHOTS, "recovery-probe.json");
  if (!fs.existsSync(probePath)) {
    console.error("missing shots-phase2/recovery-probe.json (the offer's measured box)");
    process.exit(3);
  }
  const probe = JSON.parse(fs.readFileSync(probePath, "utf8"));
  const offerBox = probe.afterDelete && probe.afterDelete.offer && probe.afterDelete.offer.box;
  if (!offerBox) {
    console.error("the probe has no measured offer box — cannot anchor the zoom window");
    process.exit(3);
  }
  const pad = 18;
  const w = Math.min(offerBox[2] + pad * 2, meta.width);
  const h = Math.min(offerBox[3] + pad * 2, meta.height);
  const left = Math.max(0, Math.min(meta.width - w, offerBox[0] - pad));
  const top = Math.max(0, Math.min(meta.height - h, offerBox[1] - pad));
  const zoom = [];
  for (const f of ["20-undo-offer.png", "21-after-undo.png"]) {
    const buf = await sharp(path.join(SHOTS, f))
      .extract({ left, top, width: w, height: h })
      .resize({ width: w * 2, height: h * 2, fit: "fill" })
      .png()
      .toBuffer();
    const m = await sharp(buf).metadata();
    zoom.push({ label: f, buf, width: m.width, height: m.height });
  }
  await grid(zoom, 2, "collage-phase2-zoom.png");
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
