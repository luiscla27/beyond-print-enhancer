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

/** Every cell is the whole CLOSE-UP frame, at a scale that keeps the strip inside the reviewer's
 *  image budget. NATIVE_MAX_W was the only bound while the frames were 688x900 (the camera cropped
 *  the section); now that the camera captures the section's FULL 656x1920 height the height is the
 *  binding constraint, so a second bound is needed. MEASURED: 20 cells at native 704x1968 in 3
 *  columns is a 2112x14016 strip (29.6 Mpx) — outside what the vision gate accepts — while 4
 *  columns at ~1000px per cell is 1432x5120 (7.3 Mpx), the same order as the 2064x3696 strip the
 *  gate already scored. A 28px border ring survives that downsample at ~14px, which is why the
 *  frames are captured at PAD-padded native resolution in the first place. */
const NATIVE_MAX_W = 1200;
/** Max cell height in px, applied only when the frame is taller than this. */
const NATIVE_MAX_H = 1000;
const COLS = Number(process.env.BORDER_GALLERY_COLS || 4);
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
    return {
      cells: (data.designs || []).map((d) => ({
        // The OVERVIEW frame is the collage's cell (operator ruling D-A, 2026-10-01): since
        // the D-A camera `d.file` is the JUDGED cell (deviceScaleFactor 2, native band
        // strips) and `d.overviewFile` the dsf-1 whole-section view. The overview strip is
        // SUPPLEMENTARY context for the seat — the judged artifact is composed by
        // `scripts/byok_border_judged.js` — so the collage reads the overview when the
        // manifest carries one and falls back to `file` for pre-D-A manifests.
        file: path.join(ART, d.overviewFile || d.file),
        // Prefer the manifest's own label: a SUPERSEDED variant shares its canonical design's id
        // (same instruction, earlier round), so `id` alone labels two different artworks the same
        // and the reviewer cannot tell which bytes they are judging. Fall back to the id for
        // manifests written before the label field existed.
        label: (d.label || d.id || "").replace(/^\d+-/, "").replace(/-/g, " "),
      })),
      clip: data.clip || null,
      target: data.target || null,
    };
  }
  // Fallback: every PNG that is not a strip or a collage.
  return {
    cells: fs
      .readdirSync(ART)
      .filter((f) => f.endsWith(".png") && !f.startsWith("gallery-strip-") && !f.startsWith("collage-"))
      .sort()
      .map((f) => ({
        file: path.join(ART, f),
        label: f.replace(".png", "").replace(/^\d+-/, "").replace(/-/g, " "),
      })),
    clip: null,
    target: null,
  };
}

async function main() {
  const { cells, clip, target } = readDesigns();
  if (cells.length === 0) throw new Error("no PNGs found under " + ART);

  // ONE scale for every cell, decided by the FIRST cell's dimensions, and reported in the sidecar so
  // a reviewer can tell native from downsampled. Deciding per-cell would be the exact defect the
  // ornament track recorded (cells scaled differently, two gate rounds lost). The scale is the
  // SMALLER of the width bound and the height bound, so a tall full-section frame shrinks rather
  // than overflowing the reviewer's image budget.
  const firstMeta = await sharp(cells[0].file).metadata();
  const firstW = firstMeta.width || 1440;
  const firstH = firstMeta.height || 900;
  const scale = Math.min(1, NATIVE_MAX_W / firstW, NATIVE_MAX_H / firstH);

  const prepared = [];
  for (const c of cells) {
    if (!fs.existsSync(c.file)) throw new Error("missing frame: " + c.file);
    const meta = await sharp(c.file).metadata();
    const w = Math.round((meta.width || 1440) * scale);
    const h = Math.round((meta.height || 900) * scale);
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
  fs.writeFileSync(
    out.replace(/\.png$/, "-cells.json"),
    JSON.stringify({ round: ROUND, scale, cellW, cellH, cols: COLS, cells: cells.map((c) => c.label), clip, target }, null, 2),
  );
  console.log("wrote " + path.relative(ROOT, out) + " (" + prepared.length + " cells, scale " + scale + ")");
}

main().catch((e) => {
  console.error(String((e && e.stack) || e));
  process.exit(1);
});