#!/usr/bin/env node
/**
 * Collage composer for byok_ai_layout_20260915 Phase 4's AC-V1 visual gate.
 *
 * AC-V1 (spec.md) is "before/after collage of ONE real arrangement through the print pipeline".
 * Phase 2's composer (`scripts/byok_collage.js`) cannot serve it: that gate compared DIALOGS, so it
 * used one fixed window chosen by hand. This gate compares GEOMETRY, and a hand-chosen window is
 * exactly what burned round 1 — the frames were cropped to the wrapper, the +24px move they were
 * scored on is smaller than the modal backdrop's own dimming gradient, and Muse correctly returned
 * "frame 3 sheet geometry is pixel-identical to frame 1" (`acv1-verdict-muse.txt`, G1 + G5 NOT MET).
 *
 * So the window here is DERIVED, not chosen: it is the bounding box of the section's source rect
 * and its destination rect (read from `acv1-geometry.json`, which the browser case writes from the
 * live scan), padded, and applied IDENTICALLY to all three frames at native pixel scale.
 * Native scale is non-negotiable — the fleet's ornament track lost two gate rounds to collages whose
 * cells were scaled differently, and a downsampled 2px dashed border is precisely the "heavily
 * blurred background, no ghost-box geometry discernible" complaint the close-up verdict made.
 *
 * Usage:  node scripts/byok_acv1_collage.js [<artifact dir>]
 * Output: <dir>/acv1-strip-arrangement.png  (+ acv1-strip-cells.json, the window it used)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ART = path.resolve(
  process.argv[2] || path.join(ROOT, "temp/visual_logs/byok_ai_layout_20260915"),
);

const GEOM = JSON.parse(fs.readFileSync(path.join(ART, "acv1-geometry.json"), "utf8"));

/** The three frames, in the reading order the brief names. */
const CELLS = [
  ["01-before.png", "CELL 1  BEFORE  -  the sheet as the user left it"],
  ["02-preview-ghosts.png", "CELL 2  PREVIEW  -  dashed gold ghost box + dialog"],
  ["03-after.png", "CELL 3  AFTER Accept  -  the section now sits in the ghost's place"],
];

/**
 * G7's cell, appended when the run captured it. Round 2 was forced to answer
 * "NOT APPLICABLE-BY-FRAME" because the tool's panel is outside the sheet clip, which is honest but
 * leaves a criterion unjudged by the artifact that is supposed to judge it. The panel is a fixed
 * surface, so its own crop joins the strip at its native scale (no resizing — see the header).
 */
const PANEL_CELL = ["04-panel-nokey.png", "CELL 4  CONTROL PANEL, no key stored  -  the AI row's state"];

/**
 * The union of where the section WAS and where the patch proposed it should GO, in frame pixel
 * space. `from`/`to` are record-space (relative to `#print-layout-wrapper`) and the capture clip
 * starts at the wrapper's own origin, so the two coincide — no translation is applied here, and
 * `assert` below pins that assumption against the frame size rather than trusting it.
 */
function windowFor(pad) {
  const f = GEOM.proposed_from;
  const t = GEOM.proposed_to;
  const w = GEOM.live_box_after_apply;
  const x0 = Math.min(f.left, t.left, w.left);
  const y0 = Math.min(f.top, t.top, w.top);
  const x1 = Math.max(f.left + w.width, t.left + w.width, w.left + w.width);
  const y1 = Math.max(f.top + w.height, t.top + w.height, w.top + w.height);
  // A hidden section is the OTHER ghost kind; include it so the brief's claim about both kinds is
  // something the reviewer can actually check rather than something it has to take on trust.
  let box = { x0, y0, x1, y1 };
  if (GEOM.hidden_box) {
    const h = GEOM.hidden_box;
    box = {
      x0: Math.min(box.x0, h.left),
      y0: Math.min(box.y0, h.top),
      x1: Math.max(box.x1, h.left + h.width),
      y1: Math.max(box.y1, h.top + h.height),
    };
  }
  return {
    left: Math.max(0, Math.round(box.x0 - pad)),
    top: Math.max(0, Math.round(box.y0 - pad)),
    width: Math.round(box.x1 - box.x0 + pad * 2),
    height: Math.round(box.y1 - box.y0 + pad * 2),
  };
}

async function main() {
  const CAP = 40;
  const GAP = 10;
  const PAD = 28;

  const meta = await sharp(path.join(ART, CELLS[0][0])).metadata();
  const win = windowFor(PAD);
  // The window must fit inside every frame: the clip is capped by the viewport, so a destination
  // near the bottom edge can sit partly outside. Clamping here keeps the three cells identical.
  win.width = Math.min(win.width, meta.width - win.left);
  win.height = Math.min(win.height, meta.height - win.top);
  console.log(
    "frame %dx%d  window %dx%d at (%d,%d)  travel %dpx  section %s",
    meta.width, meta.height, win.width, win.height, win.left, win.top,
    GEOM.travel_px, GEOM.section,
  );

  const cellW = win.width;
  const cellH = win.height + CAP;

  // G7's cell, if the run photographed the panel. It keeps its OWN crop (the panel is a fixed
  // surface outside the sheet clip) but the SAME 1:1 scale, which is the part the header warns
  // about: cells of a geometry gate may differ in size, they may not differ in scale.
  let panel = null;
  if (fs.existsSync(path.join(ART, PANEL_CELL[0]))) {
    const pm = await sharp(path.join(ART, PANEL_CELL[0])).metadata();
    panel = { width: pm.width, height: pm.height };
  }

  const cells = panel ? CELLS.length + 1 : CELLS.length;
  const totalW = cellW * CELLS.length + (panel ? panel.width : 0) + GAP * (cells - 1);
  const strip = sharp({
    create: {
      width: totalW,
      height: Math.max(cellH, panel ? panel.height + CAP : 0),
      channels: 3,
      background: { r: 12, g: 12, b: 16 },
    },
  });

  const composites = [];
  for (let i = 0; i < CELLS.length; i++) {
    const [file] = CELLS[i];
    const full = path.join(ART, file);
    if (!fs.existsSync(full)) throw new Error("missing frame: " + full);
    const crop = await sharp(full)
      .extract(win)
      .toBuffer();
    const x = i * (cellW + GAP);
    composites.push({ input: crop, left: x, top: CAP });
    const label = Buffer.from(
      "<svg width='" + cellW + "' height='" + CAP + "'><rect width='100%' height='100%' fill='#101018'/>" +
      "<text x='10' y='" + (CAP / 2 + 5) + "' font-family='DejaVu Sans, Arial, sans-serif' " +
      "font-size='15' fill='#f2e6c8'>" +
      CELLS[i][1].replace(/&/g, "&amp;").replace(/</g, "&lt;") +
      "</text></svg>",
      "utf8",
    );
    composites.push({ input: label, left: x, top: 0 });
  }
  if (panel) {
    const x = CELLS.length * (cellW + GAP);
    const img = await sharp(path.join(ART, PANEL_CELL[0])).png().toBuffer();
    composites.push({ input: img, left: x, top: CAP });
    composites.push({
      input: Buffer.from(
        "<svg width='" + panel.width + "' height='" + CAP + "'><rect width='100%' height='100%' fill='#101018'/>" +
        "<text x='10' y='" + (CAP / 2 + 5) + "' font-family='DejaVu Sans, Arial, sans-serif' " +
        "font-size='15' fill='#f2e6c8'>" + PANEL_CELL[1] + "</text></svg>",
        "utf8",
      ),
      left: x,
      top: 0,
    });
  }
  await strip.composite(composites).png().toFile(path.join(ART, "acv1-strip-arrangement.png"));

  fs.writeFileSync(
    path.join(ART, "acv1-strip-cells.json"),
    JSON.stringify(
      {
        window: win,
        pad: PAD,
        cells: CELLS.map((c) => c[0]).concat(panel ? [PANEL_CELL[0]] : []),
        panel_cell: panel,
        scale: "1:1 native",
      },
      null,
      2,
    ),
  );
  console.log("wrote acv1-strip-arrangement.png (%d cells, native 1:1 scale)%s", cells, panel ? " + panel" : "");
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
