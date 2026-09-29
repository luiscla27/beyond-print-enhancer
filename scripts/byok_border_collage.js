#!/usr/bin/env node
/**
 * Collage composer for the border-design gallery (track byok_svg_borders_20260927, Phase 4).
 *
 * WHAT THIS DOES
 * --------------
 * Reads every PNG under `temp/visual_logs/byok_svg_borders_20260927/gallery-roundN/`, labels each
 * cell with its design id, and writes a single labelled strip:
 *   `gallery-strip-round<N>.png`   — the artifact the visual gate scores.
 *
 * WHY THE WINDOW IS FULL-FRAME, NOT A HAND-CHOSEN CROP
 * ----------------------------------------------------
 * The gallery frames are already 1440×900 shots of the whole page. A hand-chosen crop would be
 * precisely the mistake the ornament track made: two gate rounds lost to collages whose cells were
 * scaled differently. Every cell is therefore the SAME full frame, at the SAME scale, with the
 * SAME caption band — the only way a reviewer can compare designs against each other.
 *
 * USAGE:
 *   node scripts/byok_border_collage.js [<artifact dir>]
 *
 * `artifact dir` defaults to `temp/visual_logs/byok_svg_borders_20260927/gallery-roundN`
 * (where N = BORDER_GALLERY_ROUND or 1).
 */

"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ROUND = process.env.BORDER_GALLERY_ROUND || "1";
const ART = path.resolve(
  process.argv[2] || path.join(ROOT, "temp", "visual_logs", "byok_svg_borders_20260927", "gallery-round" + ROUND),
);

/** Every cell is the whole frame, at this scale. */
const SCALE = 0.5;
const COLS = 3;
/** The caption band sits below each cell, in a dark grey with white text. */
const CAPTION_H = 24;
const CAPTION_BG = "#222";
const CAPTION_FG = "#fff";
const FONT_SIZE = 13;
const PADDING = 4;

function readDesigns() {
  const manifest = path.join(ART, "gallery-manifest.json");
  if (fs.existsSync(manifest)) {
    const data = JSON.parse(fs.readFileSync(manifest, "utf8"));
    return (data.designs || []).map((d) => ({
      file: path.join(ART, d.file),
      label: (d.id || "").replace(/^\d+-/, "").replace(/-/g, " "),
    }));
  }
  // Fallback: every PNG that is not a strip or a collage.
  return fs
    .readdirSync(ART)
    .filter((f) => f.endsWith(".png") && !f.startsWith("gallery-strip-") && !f.startsWith("collage-"))
    .sort()
    .map((f) => ({ file: path.join(ART, f), label: f.replace(".png", "").replace(/^\d+-/, "").replace(/-/g, " ") }));
}

async function main() {
  const cells = readDesigns();
  if (cells.length === 0) throw new Error("no PNGs found under " + ART);

  const prepared = [];
  for (const c of cells) {
    if (!fs.existsSync(c.file)) throw new Error("missing frame: " + c.file);
    const meta = await sharp(c.file).metadata();
    const w = Math.round((meta.width || 1440) * SCALE);
    const h = Math.round((meta.height || 900) * SCALE);
    const imgBuf = await sharp(c.file).resize(w, h).png().toBuffer();

    // Build a labelled cell: image + caption band, composited onto one canvas.
    const cellH = h + CAPTION_H;
    const captionSvg = Buffer.from(
      `<svg width="${w}" height="${CAPTION_H}">
         <rect width="100%" height="100%" fill="${CAPTION_BG}"/>
         <text x="${PADDING}" y="${FONT_SIZE + 2}" font-family="Arial,sans-serif" font-size="${FONT_SIZE}"
               fill="${CAPTION_FG}">${c.label}</text>
       </svg>`,
    );
    const cellBuf = await sharp({
      create: { width: w, height: cellH, channels: 4, background: CAPTION_BG },
    })
      .composite([
        { input: imgBuf, top: 0, left: 0 },
        { input: captionSvg, top: h, left: 0 },
      ])
      .png()
      .toBuffer();

    prepared.push({ buf: cellBuf, w, h: cellH, label: c.label });
  }

  const cellW = prepared[0].w;
  const cellH = prepared[0].h;
  const rows = Math.ceil(prepared.length / COLS);
  const stripW = cellW * COLS;
  const stripH = cellH * rows;

  const composites = [];
  for (let i = 0; i < prepared.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    composites.push({ input: prepared[i].buf, left: col * cellW, top: row * cellH });
  }

  const out = path.join(ART, "gallery-strip-round" + ROUND + ".png");
  await sharp({
    create: { width: stripW, height: stripH, channels: 4, background: "#111" },
  })
    .composite(composites)
    .png()
    .toFile(out);
  console.log("wrote " + path.relative(ROOT, out) + " (" + prepared.length + " cells)");
}

main().catch((e) => {
  console.error(String((e && e.stack) || e));
  process.exit(1);
});