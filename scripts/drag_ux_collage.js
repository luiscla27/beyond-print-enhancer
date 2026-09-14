/**
 * Collage composer for the drag_ux_overhaul_20260909 visual gates.
 *
 * Stitches the named frames of a phase into a single caption-free grid image
 * (descriptions live in collage-phaseN.md, never burned into cells — per
 * visual_gate_protocol.md §2). Cells keep the given order (default: sorted
 * filenames). Output uses 1–2px #1a1a1a gutters on a dark ground so panel
 * boundaries read clearly to a vision model.
 *
 * Usage:
 *   node scripts/drag_ux_collage.js <dir> <out.png> [cell1.png cell2.png ...]
 *
 * Examples:
 *   node scripts/drag_ux_collage.js docs/drag-ux-20260909/shots-phase1 \
 *     docs/drag-ux-20260909/collage-phase1.png
 *   node scripts/drag_ux_collage.js .../shots-phase2 .../collage-phase2.png \
 *     20-mid-drag-snapped.png 21-alignment-guides.png 22-locked-hover.png
 */
"use strict";

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

async function main() {
  const flagIdx = process.argv.indexOf("--cols");
  const colsFlag =
    flagIdx >= 0 && process.argv[flagIdx + 1]
      ? parseInt(process.argv[flagIdx + 1], 10) || 3
      : 3;
  const positional = process.argv.slice(2).filter(
    (v, i, arr) => v !== "--cols" && arr[i - 1] !== "--cols",
  );
  const [dir, out, ...cellsArg] = positional;
  if (!dir || !out) {
    console.error("usage: node scripts/drag_ux_collage.js <dir> <out.png> [cells...]");
    process.exit(2);
  }
  if (!fs.existsSync(dir)) {
    console.error("dir not found:", dir);
    process.exit(2);
  }
  let cells = cellsArg.length
    ? cellsArg
    : fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort();
  if (cells.length === 0) {
    console.error("no png cells in", dir);
    process.exit(2);
  }

  const GUTTER = 8;
  const MAX_CELL_W = 900; // cap for large full-sheet frames
  // Zoom crops (small source frames) must be UPSCALED so the vision model
  // can resolve them; large full-sheet frames are downscaled to MAX_CELL_W.
  const upscale = (w) => {
    if (w < 640) return Math.min(3, 900 / w); // enlarge small crops
    return Math.min(1, MAX_CELL_W / w); // cap large frames
  };

  const metas = [];
  for (const name of cells) {
    const p = path.join(dir, name);
    const img = sharp(p);
    const meta = await img.metadata();
    if (!meta.width || !meta.height) throw new Error("bad metadata: " + p);
    const s = upscale(meta.width);
    const w = Math.round(meta.width * s);
    const h = Math.round(meta.height * s);
    metas.push({
      name,
      path: p,
      w,
      h,
      buffer: await img.resize(w, h, { kernel: "lanczos3" }).png().toBuffer(),
    });
  }

  const cols = Math.min(colsFlag, Math.max(1, metas.length));
  const cellW = Math.max(...metas.map((m) => m.w));
  const rows = Math.ceil(metas.length / cols);
  const W = cols * cellW + (cols + 1) * GUTTER;
  const H = rows * (Math.max(...metas.map((m) => m.h))) + (rows + 1) * GUTTER;

  const composites = [];
  metas.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    composites.push({
      input: m.buffer,
      left: GUTTER + col * (cellW + GUTTER),
      top: GUTTER + row * (Math.max(...metas.map((x) => x.h)) + GUTTER),
    });
  });

  await sharp({
    create: { width: W, height: H, channels: 3, background: "#1a1a1a" },
  })
    .composite(composites)
    .png()
    .toFile(out);

  console.log(
    `collage written: ${out} (${W}x${H}, ${metas.length} cells in ${cols}x${rows})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
