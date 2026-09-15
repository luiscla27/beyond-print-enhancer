/**
 * Scratch: build the compact, redable collages for the ornament_symmetry_20260910
 * visual gates from the frames the capture harness already saved.
 *
 * The full-height panel frames (253 x ~1100 CSS px) make the stock composer
 * produce a 2700x10400 collage, which no vision model can read 1px hairlines
 * from. This crops each frame to the region that carries the ornament claim
 * (the top of the panels = corner Ls + rule C + the diamond; the modal frame =
 * all four corners) and tiles them with the caption-free rule intact: the
 * descriptions live in collage-phaseN.md, never burned into the cells.
 *
 * Delete after use (scratch tooling; the collage script remains canonical).
 *
 *   node temp/ornament_collage.js <phase1|phase2>
 */
"use strict";

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "vendor", "docs", "ornament-symmetry-20260910");
const GUTTER = 10;
const GROUND = { r: 26, g: 26, b: 26, alpha: 1 };

const PHASES = {
  phase1a: {
    dir: "shots-phase1",
    out: "collage-phase1a.png",
    cols: 2,
    cellW: 620,
    // The full-treatment surfaces: double hairline + corner Ls + primary
    // ornament. Cropped to the top band, which is where every AC-1/AC-2 claim
    // lives (rule A/B at y=0..1, rule C at y=6..7, corner arms from y=6,
    // the header rule + diamond at y~44).
    cells: [
      ["13-modal-shell.png", { top: 0, height: 250 }],
      ["19-modal-corner-detail.png", { top: 0, height: 250 }],
      ["10-control-panel.png", { top: 0, height: 210 }],
      ["11-control-panel-hover.png", { top: 0, height: 210 }],
      ["12-layer-manager.png", { top: 0, height: 210 }],
    ],
  },
  phase1b: {
    dir: "shots-phase1",
    out: "collage-phase1b.png",
    cols: 2,
    cellW: 620,
    // Restraint + the compressed states + print: the negative predicates
    // (AC-3D/AC-3E) and AC-3C/print.
    cells: [
      ["14-context-menu.png", { top: 0, height: 220 }],
      ["15-color-picker.png", { top: 0, height: 220 }],
      ["16-toast-plain.png", { top: 0, height: 120 }],
      ["17-in-sheet-actions-plain.png", { top: 0, height: 170 }],
      ["18-control-panel-collapsed.png", { top: 0, height: 140 }],
      ["18b-layer-minimized.png", { top: 0, height: 100 }],
      ["20-print-emulation.png", { top: 0, height: 200 }],
    ],
  },
  phase1c: {
    dir: ".",
    out: "collage-phase1c.png",
    cols: 3,
    cellW: 440,
    // PIXEL EVIDENCE: each surface's top-left corner at 10x NEAREST-NEIGHBOUR,
    // cropped so the frame's outer edge sits at the top-left of the cell. At
    // this zoom a 1px rule is 10px wide, so the reviewer can COUNT the rules,
    // measure the gap and see whether the two L arms meet. Produced by
    // temp/ornament_pixel_probe.js, aligned to the outermost ornament row.
    cells: [
      ["pixel-probe-control-panel-corner-10x.png", { top: 0, height: 440 }],
      ["pixel-probe-layer-manager-corner-10x.png", { top: 0, height: 440 }],
      ["pixel-probe-modal-corner-10x.png", { top: 0, height: 440 }],
    ],
  },
  phase1d: {
    dir: "shots-phase1",
    out: "collage-phase1d-print.png",
    cols: 2,
    cellW: 620,
    // The print clause as a before/after pair: the SAME full page on screen
    // (extension chrome + its ornament present) and under emulated print media
    // (chrome gone). The sheet's own printed design is visible in both — that
    // is what the user is printing, and it is out of scope.
    cells: [
      ["19b-screen-full.png", { top: 0, height: 900 }],
      ["20-print-emulation.png", { top: 0, height: 900 }],
    ],
  },
  phase2: {
    dir: "shots-phase2",
    out: "collage-phase2.png",
    cols: 2,
    cellW: 620,
    cells: [
      ["20-tier-t1-panel.png", { top: 0, height: 430 }],
      ["23-modal-tiers.png", { top: 0, height: 340 }],
      ["22-tier-t3-chip.png", { top: 0, height: 190 }],
      ["21-tier-t2-icons.png", { top: 0, height: 190 }],
      ["24-layer-rows-40.png", { top: 0, height: 190 }],
    ],
  },
};

async function main() {
  const phase = PHASES[process.argv[2]];
  if (!phase) throw new Error("usage: node temp/ornament_collage.js <phase1|phase2>");
  const srcDir = path.join(DOCS, phase.dir);

  const metas = [];
  for (const [name, crop] of phase.cells) {
    const p = path.join(srcDir, name);
    if (!fs.existsSync(p)) throw new Error("missing frame: " + p);
    const img = sharp(p);
    const meta = await img.metadata();
    const extract = {
      left: 0,
      top: crop.top || 0,
      width: meta.width,
      height: Math.min(crop.height, meta.height - (crop.top || 0)),
    };
    const cropped = img.extract(extract);
    const scale = phase.cellW / extract.width;
    const w = phase.cellW;
    const h = Math.max(24, Math.round(extract.height * scale));
    metas.push({
      name,
      w,
      h,
      buffer: await cropped.resize(w, h, { kernel: "lanczos3" }).png().toBuffer(),
    });
  }

  const cols = phase.cols;
  const rows = Math.ceil(metas.length / cols);
  const cellW = Math.max(...metas.map((m) => m.w));
  const rowH = [];
  for (let r = 0; r < rows; r++) {
    rowH[r] = Math.max(...metas.slice(r * cols, (r + 1) * cols).map((m) => m.h));
  }
  const W = cols * cellW + (cols + 1) * GUTTER;
  const H = rowH.reduce((a, b) => a + b, 0) + (rows + 1) * GUTTER;

  const composites = metas.map((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const y = GUTTER + rowH.slice(0, row).reduce((a, b) => a + b, 0) + row * GUTTER;
    return {
      input: m.buffer,
      left: GUTTER + col * (cellW + GUTTER),
      top: y,
    };
  });

  const out = path.join(DOCS, phase.out);
  await sharp({
    create: { width: W, height: H, channels: 4, background: GROUND },
  })
    .composite(composites)
    .png()
    .toFile(out);
  console.log("collage written:", out, W + "x" + H, metas.length + " cells");
}

main().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});
