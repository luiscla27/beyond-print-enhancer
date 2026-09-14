#!/usr/bin/env node
/**
 * Collage composer for the selection_model_ia_20260910 visual gates.
 *
 * Per the track's visual_gate_protocol.md §2: the phase's NAMED frames are
 * stitched into ONE caption-free grid, every cell rendered at a UNIFORM zoom, and
 * any cell used for an equality claim uses an identically sized window. Two
 * collages are produced from the same four frames:
 *
 *   collage-phase1.png       whole-viewport cells (the layout claim: the sheet,
 *                            the layer panel and the properties panel all agree)
 *   collage-phase1-zoom.png  marker-centred cells at 1:1 scale, all the same
 *                            window size, because the outline claim ("the selected
 *                            shape is as unmistakable as the selected section")
 *                            cannot be judged at collage scale — the ornament
 *                            track lost two rounds to exactly that.
 *
 * The zoom windows are read from shots-phase1/selection-probe.json, so the crop
 * is anchored on the real measured box of the selected element rather than on a
 * hand-guessed offset.
 *
 * Usage:
 *   node scripts/selection_collage.js [--phase 1] [--zoom-width 560] [--zoom-height 380]
 *
 * Output: docs/selection-model-ia-20260910/collage-phase1{,-zoom}.png
 */
"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ART = path.join(ROOT, "docs", "selection-model-ia-20260910");
const SHOTS = path.join(ART, "shots-phase1");
const PROBE = path.join(SHOTS, "selection-probe.json");

const CELLS = [
  ["10-section-selected.png", "sectionSelected"],
  ["11-shape-selected.png", "shapeSelected"],
  ["12-layer-row-selected.png", "layerRowSelected"],
  ["13-cleared.png", "cleared"],
];

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
}

/**
 * Phase 3 (consistency): the narrow-viewport states side by side.
 *
 * Each cell is a DIFFERENT viewport width rendered into a common cell box
 * (letterboxed, never stretched), because the claim is about the geometry of the
 * panels at each width — a cross-cell scale comparison is not implied, and the
 * composer says so here rather than leaving it to the reader.
 */
async function phase3Collage() {
  const shots = path.join(ART, "shots-phase3");
  const frames = [
    "22-narrow-900.png",
    "22-narrow-700.png",
    "22-narrow-560.png",
    "22-narrow-picker.png",
  ];
  const missing = frames.filter((f) => !fs.existsSync(path.join(shots, f)));
  if (missing.length) {
    console.error(`missing phase-3 frames: ${missing.join(", ")}`);
    process.exit(3);
  }
  const cellW = parseInt(arg("cell-width", "420"), 10);
  const cellH = parseInt(arg("cell-height", "470"), 10);
  const tiles = [];
  for (const f of frames) {
    const buf = await sharp(path.join(shots, f))
      .resize({ width: cellW, height: cellH, fit: "contain", background: "#1a1a1a" })
      .png()
      .toBuffer();
    const m = await sharp(buf).metadata();
    tiles.push({ label: f, buf, width: m.width, height: m.height });
  }
  await grid(tiles, 4, "collage-phase3-narrow.png");
  console.log(
    "(cells are different viewport widths in a common cell box — no cross-cell scale claim)",
  );

  // A 3x crop of the rail header at the two narrow stages: AC-10's "with a way
  // back" is a claim about a CONTROL, and a control has to be legible. Uniform
  // window + scale for both cells.
  const probe = JSON.parse(
    fs.readFileSync(path.join(shots, "consistency-probe.json"), "utf8"),
  );
  const railBox = probe.narrow["700"] && probe.narrow["700"].layersBox;
  if (!railBox) {
    console.error("consistency-probe.json has no 700px layer-panel box");
    process.exit(3);
  }
  const pad = 10;
  // The two frames have DIFFERENT widths (700px and 560px), so one absolute
  // window cannot cover both rails. Each cell is therefore anchored on its own
  // frame's rail box at the SAME size and the SAME scale — the claim here is
  // legibility of the way-back control, not an equality between the two stages,
  // so a shared absolute window is not implied (and saying so is the point of
  // this comment).
  const w = 210;
  const h = 62;
  const zoom = [];
  for (const [f, key] of [
    ["22-narrow-700.png", "700"],
    ["22-narrow-560.png", "560"],
  ]) {
    const box = (probe.narrow[key] && probe.narrow[key].layersBox) || railBox;
    const fm = await sharp(path.join(shots, f)).metadata();
    const left = Math.max(0, Math.min(fm.width - w, Math.round(box[0] - pad)));
    const top = Math.max(0, Math.min(fm.height - h, Math.round(box[1] - pad)));
    const buf = await sharp(path.join(shots, f))
      .extract({ left, top, width: Math.min(w, fm.width - left), height: Math.min(h, fm.height - top) })
      .resize({ width: w * 3, height: h * 3, fit: "fill" })
      .png()
      .toBuffer();
    const m = await sharp(buf).metadata();
    zoom.push({ label: `${f}@${left},${top}`, buf, width: m.width, height: m.height });
  }
  await grid(zoom, 2, "collage-phase3-rail-zoom.png");
}

/**
 * Phase 2, deterministic half: compose the collages AND assert the one claim no
 * vision round should be trusted with — that showing the hint changes NOTHING
 * outside the control panel column. The card lives in the panel's own scrolled
 * body, so the sheet region must be pixel-identical between the fresh-hint frame
 * and the dismissed frame. Any difference there means the card is covering the
 * sheet, which is exactly what the phase-2 gate rejected twice.
 */
async function phase2Claims() {
  await phase2Collages();

  const shots = path.join(ART, "shots-phase2");
  const withHint = path.join(shots, "20-first-run-hint.png");
  const without = path.join(shots, "21-hint-dismissed.png");
  const probe = JSON.parse(
    fs.readFileSync(path.join(shots, "hint-probe.json"), "utf8"),
  );
  const card = probe.fresh && probe.fresh.box;
  const panel = probe.fresh && probe.fresh.panelBox;
  if (!card || !panel) {
    console.error("hint-probe.json lacks the card/panel boxes");
    process.exit(3);
  }

  const meta = await sharp(withHint).metadata();
  const regions = {
    // The sheet: everything right of the control panel column.
    sheet: {
      left: panel[0] + panel[2],
      top: 0,
      width: meta.width - (panel[0] + panel[2]),
      height: meta.height,
    },
    // The whole frame (must differ SOMEWHERE, or the hint is not visible at all).
    whole: { left: 0, top: 0, width: meta.width, height: meta.height },
  };

  const out = {};
  for (const [name, region] of Object.entries(regions)) {
    const [a, b] = await Promise.all(
      [withHint, without].map((f) =>
        sharp(f).extract(region).raw().toBuffer({ resolveWithObject: true }),
      ),
    );
    let differing = 0;
    for (let i = 0; i < a.data.length; i += a.info.channels) {
      const d =
        Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2]);
      if (d > 25) differing++;
    }
    out[name] = differing;
    console.log(
      `hint shown vs dismissed [${name}] differing=${differing}/${
        a.info.width * a.info.height
      }`,
    );
  }

  const claims = [
    [
      "C7 the hint obscures NOTHING outside the control panel (sheet region is pixel-identical)",
      out.sheet === 0,
      `sheet=${out.sheet} differing pixels`,
    ],
    [
      "C8 the hint IS visible in the frame (so the claim above is not vacuous)",
      out.whole > 0,
      `whole frame=${out.whole} differing pixels`,
    ],
    [
      "C9 the card's box is contained in the control panel's box",
      card[0] >= panel[0] - 1 && card[0] + card[2] <= panel[0] + panel[2] + 1,
      `card=[${card}] panel=[${panel}]`,
    ],
  ];
  console.log("");
  let failed = 0;
  claims.forEach(([name, ok, detail]) => {
    console.log(`${ok ? "CLAIM OK  " : "CLAIM FAIL"} — ${name} (${detail})`);
    if (!ok) failed++;
  });
  fs.writeFileSync(
    path.join(ART, "phase2-non-occlusion.json"),
    JSON.stringify(
      {
        provenance: { ...probe.provenance, measuredAt: new Date().toISOString() },
        card,
        panel,
        differing: out,
        claims: claims.map(([claim, ok, detail]) => ({ claim, ok, detail })),
      },
      null,
      2,
    ),
  );
  if (failed) process.exit(1);
}

/**
 * Phase 2 (discoverability): the hint card's own two states.
 *
 *  collage-phase2.png            the three full-viewport frames at 0.5 (fresh
 *                                hint / dismissed / a later boot), so the frame
 *                                the REVIEWER needs most — whether the card
 *                                obscures the sheet — is one whole-screen cell.
 *  collage-phase2-hint-zoom.png  the card's measured box, one uniform window at
 *                                2x from both states, because a 13px sentence in
 *                                a 387x54 card is not legible at thumbnail scale
 *                                (the round-8 lesson: send the reviewer the scale
 *                                a claim actually needs).
 */
async function phase2Collages() {
  const shots = path.join(ART, "shots-phase2");
  const probePath = path.join(shots, "hint-probe.json");
  const frames = [
    "20-first-run-hint.png",
    "21-hint-dismissed.png",
    "21b-hint-not-restored.png",
  ];
  const missing = frames.filter((f) => !fs.existsSync(path.join(shots, f)));
  if (missing.length) {
    console.error(`missing phase-2 frames: ${missing.join(", ")}`);
    process.exit(3);
  }
  const meta = await sharp(path.join(shots, frames[0])).metadata();
  const wide = [];
  for (const f of frames) {
    const buf = await sharp(path.join(shots, f))
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
  await grid(wide, 3, "collage-phase2.png");

  if (!fs.existsSync(probePath)) {
    console.error("missing shots-phase2/hint-probe.json (the card's measured box)");
    process.exit(3);
  }
  const probe = JSON.parse(fs.readFileSync(probePath, "utf8"));
  const box = probe.fresh && probe.fresh.box;
  if (!box) {
    console.error("hint-probe.json has no fresh.box — cannot anchor the zoom");
    process.exit(3);
  }
  const pad = 22;
  const zw = Math.round(box[2] + pad * 2);
  const zh = Math.round(box[3] + pad * 2);
  const left = Math.max(0, Math.min(meta.width - zw, box[0] - pad));
  const top = Math.max(0, Math.min(meta.height - zh, box[1] - pad));
  const zoom = [];
  for (const f of [frames[0], frames[1]]) {
    const buf = await sharp(path.join(shots, f))
      .extract({ left, top, width: zw, height: zh })
      .resize({ width: zw * 2, height: zh * 2, fit: "fill" })
      .png()
      .toBuffer();
    const m = await sharp(buf).metadata();
    zoom.push({ label: f, buf, width: m.width, height: m.height });
  }
  await grid(zoom, 2, "collage-phase2-hint-zoom.png");
}

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
  await sharp({
    create: { width: W, height: H, channels: 4, background: "#1a1a1a" },
  })
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
  const phase2 = process.argv.includes("--phase2");
  if (phase2) return phase2Claims();
  const phase3 = process.argv.includes("--phase3");
  if (phase3) return phase3Collage();
  const missing = CELLS.filter(([f]) => !fs.existsSync(path.join(SHOTS, f)));
  if (missing.length) {
    console.error(`missing frames: ${missing.map((m) => m[0]).join(", ")}`);
    process.exit(3);
  }
  if (!fs.existsSync(PROBE)) {
    console.error(`missing probe: ${path.relative(ROOT, PROBE)}`);
    process.exit(3);
  }
  const probe = JSON.parse(fs.readFileSync(PROBE, "utf8"));
  const meta = await sharp(path.join(SHOTS, CELLS[0][0])).metadata();

  // 1 — whole-viewport grid (the agreement claim).
  const wide = [];
  for (const [file] of CELLS) {
    const buf = await sharp(path.join(SHOTS, file))
      .resize({ width: Math.round(meta.width * 0.5), height: Math.round(meta.height * 0.5), fit: "fill" })
      .png()
      .toBuffer();
    const m = await sharp(buf).metadata();
    wide.push({ label: file, buf, width: m.width, height: m.height });
  }
  await grid(wide, 2, "collage-phase1.png");

  // 2 — marker-centred zoom grid (the outline claim).
  const zw = parseInt(arg("zoom-width", "560"), 10);
  const zh = parseInt(arg("zoom-height", "380"), 10);
  const zoom = [];
  for (const [file, key] of CELLS) {
    const box = probe[key] && probe[key].dom && probe[key].dom.onSheet.box;
    // A cleared frame has no marker: anchor it on the SAME reference the other
    // cells use — the section's own box from the section-selected state — so the
    // four cells remain comparable (one window, one anchor policy).
    const anchor =
      box ||
      (probe.sectionSelected &&
        probe.sectionSelected.dom &&
        probe.sectionSelected.dom.onSheet.box) ||
      { left: 0, top: 0, w: zw, h: zh };
    const left = Math.max(0, Math.min(meta.width - zw, Math.round(anchor.left + anchor.w / 2 - zw / 2)));
    const top = Math.max(0, Math.min(meta.height - zh, Math.round(anchor.top + anchor.h / 2 - zh / 2)));
    const buf = await sharp(path.join(SHOTS, file))
      .extract({ left, top, width: zw, height: zh })
      .png()
      .toBuffer();
    const m = await sharp(buf).metadata();
    zoom.push({ label: file, buf, width: m.width, height: m.height });
  }
  await grid(zoom, 2, "collage-phase1-zoom.png");

  // 3 — the PANEL column, one uniform window over the four states (AC-1's
  // "populates the properties panel" half). Round 1 flagged that the panel's
  // CONTENT is not legible at collage scale: that is an evidence defect, so it is
  // answered with more evidence rather than with argument.
  const pw = parseInt(arg("panel-width", "268"), 10);
  const requestedPh = parseInt(arg("panel-height", "268"), 10);
  const panelBoxes = CELLS.map(([, key]) => probe[key] && probe[key].dom.propertiesPanel.box);
  const known = panelBoxes.filter(Boolean);
  const panelLeft = Math.max(0, Math.round(Math.min(...known.map((b) => b.left)) - 12));
  const panelTop = Math.max(0, Math.round(Math.min(...known.map((b) => b.top)) - 12));
  // The panel's own box can extend below the viewport (measured bottom 943 in a
  // 900px window — the tray scrolls), so the uniform window is clamped to what the
  // frames actually contain. One window for all four cells, clamped once.
  const ph = Math.min(requestedPh, meta.height - panelTop);
  const pwClamped = Math.min(pw, meta.width - panelLeft);
  const panels = [];
  for (const [file] of CELLS) {
    const buf = await sharp(path.join(SHOTS, file))
      .extract({ left: panelLeft, top: panelTop, width: pwClamped, height: ph })
      .resize({
        width: Math.round(pwClamped * 1.6),
        height: Math.round(ph * 1.6),
        fit: "fill",
      })
      .png()
      .toBuffer();
    const m = await sharp(buf).metadata();
    panels.push({ label: file, buf, width: m.width, height: m.height });
  }
  await grid(panels, 2, "collage-phase1-panels.png");

  // 4 — the PAIRS grid: for every state, the on-sheet selection treatment (1:1)
  // beside the layer-panel view (1:1). Neither a whole-viewport cell (where the
  // outline is sub-pixel at 0.5 scale) nor an element-only crop (where the row is
  // outside the frame) can show the outline and the highlighted row together at a
  // legible scale; pairing two 1:1 windows does, and every cell keeps the same
  // window size and scale.
  const selW = parseInt(arg("pair-width", "560"), 10);
  const selH = parseInt(arg("pair-height", "380"), 10);
  const lpBoxes = CELLS.map(([, key]) => probe[key] && probe[key].dom.layerPanel.box);
  const lpKnown = lpBoxes.filter(Boolean);
  const lpRight = Math.round(Math.max(...lpKnown.map((b) => b.left + b.w)));
  const lpLeft = Math.max(0, Math.min(meta.width - selW, lpRight - selW));
  const lpTop = Math.max(0, Math.round(Math.min(...lpKnown.map((b) => b.top)) - 20));
  const pairs = [];
  for (const [file, key] of CELLS) {
    const selBox = probe[key] && probe[key].dom.onSheet.box;
    const anchor =
      selBox ||
      (probe.sectionSelected && probe.sectionSelected.dom.onSheet.box) ||
      { left: 0, top: 0, w: selW, h: selH };
    const sLeft = Math.max(0, Math.min(meta.width - selW, Math.round(anchor.left + anchor.w / 2 - selW / 2)));
    const sTop = Math.max(0, Math.min(meta.height - selH, Math.round(anchor.top + anchor.h / 2 - selH / 2)));
    for (const win of [
      { left: sLeft, top: sTop, width: selW, height: selH },
      { left: lpLeft, top: lpTop, width: selW, height: selH },
    ]) {
      const buf = await sharp(path.join(SHOTS, file)).extract(win).png().toBuffer();
      const m = await sharp(buf).metadata();
      pairs.push({ label: `${file}:${win.left},${win.top}`, buf, width: m.width, height: m.height });
    }
  }
  await grid(pairs, 2, "collage-phase1-pairs.png");

  // 5 — the LANGUAGE pair: one 1:1 window on the selected SECTION's ring corner
  // and the identical window on the selected SHAPE's ring corner. Two cells, one
  // window size, one scale: a like-for-like comparison of the paint, which is
  // what AC-2 claims. (Consultation 2026-09-10: the vision reviewer is reliable
  // for exactly this — an on-sheet legibility comparison at 1:1 — and not for the
  // three-reader agreement.)
  const lw = parseInt(arg("lang-width", "430"), 10);
  const lh = parseInt(arg("lang-height", "320"), 10);
  const lang = [];
  for (const key of ["sectionSelected", "shapeSelected"]) {
    const box = probe[key] && probe[key].dom.onSheet.box;
    if (!box) {
      console.error(`missing box for ${key} — cannot compose the language pair`);
      process.exit(3);
    }
    const left = Math.max(0, Math.min(meta.width - lw, Math.round(box.left - 24)));
    const top = Math.max(0, Math.min(meta.height - lh, Math.round(box.top - 24)));
    const buf = await sharp(path.join(SHOTS, key === "sectionSelected" ? CELLS[0][0] : CELLS[1][0]))
      .extract({ left, top, width: lw, height: lh })
      .png()
      .toBuffer();
    const m = await sharp(buf).metadata();
    lang.push({
      label: `${key}@${left},${top}`,
      buf,
      width: m.width,
      height: m.height,
    });
  }
  await grid(lang, 2, "collage-phase1-language.png");

  fs.writeFileSync(
    path.join(ART, "collage-phase1.provenance.json"),
    JSON.stringify(
      {
        ...probe.provenance,
        composer: "scripts/selection_collage.js",
        sourceFrames: CELLS.map((c) => c[0]),
        wide: { cols: 2, scale: 0.5, window: "whole viewport" },
        zoom: { cols: 2, window: { width: zw, height: zh }, scale: 1 },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
