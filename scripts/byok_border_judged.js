#!/usr/bin/env node
/**
 * byok_border_judged.js — compose the JUDGED cells for the Phase-4 visual seat.
 *
 * (Track `byok_svg_borders_20260927`. Operator ruling D-A, 2026-10-01: the per-design
 * NATIVE-SCALE cells are the judged artifact; the overview collage is supplementary. The
 * judged-scale anchor is also the [SUPERSEDED] re-scope of AC-V1-c, ruling D-D — see
 * `conductor/tracks/byok_svg_borders_20260927/spec.md` [AC-V1] and
 * `phase4_visual_brief_r23.md`.)
 *
 * WHAT IT READS
 * -------------
 * A gallery round directory produced by `test/browser_e2e/byok_border_gallery.spec.js`
 * (round >= 23): `gallery-manifest.json` plus, per design, the JUDGED frame (`d.file`,
 * captured at deviceScaleFactor 2 — true device pixels).
 *
 * WHAT IT WRITES (same round directory)
 * -------------------------------------
 *   judged-cell-<n>-<design>.png   ONE IMAGE PER DESIGN. A design's image carries, at 1:1
 *                                  device pixels and with NOTHING resized:
 *                                    TOP edge    — the whole painted band under the top edge
 *                                    BOTTOM edge — the whole painted band over the bottom edge
 *                                    LEFT/RIGHT  — the rails as overlapping SEGMENTS (<= SEG_W)
 *                                  Every strip is cut from the ring band the PRODUCT paints
 *                                  (`border-image-outset: 16px`, width 28px -> the ring spans
 *                                  [-16, +12] CSS px around the section rect; 56 device px at
 *                                  dsf 2), tagged with its edge, and carries a MARKER BAR on the
 *                                  side that faces the section's CENTRE, so "the ornament points
 *                                  inward" is decidable in the pixels themselves.
 *   judged-meta.json               geometry, per-image design lists, pixel budgets.
 *
 * WHY THE RAILS ARE SEGMENTED, NEVER ROTATED (MEASURED DEFECT: round 23 -> 23b)
 * --------------------------------------------------------------------------
 * The first builder rotated each 72x3936 rail 90 degrees and submitted 3936-px-wide images.
 * The vision provider downscales any side above its input budget — MEASURED: a 3936-px-wide
 * submission arrived scaled ~2.5x down, so a 72-px-deep band strip reached the reviewer as
 * ~29 px. Rotation is therefore out; each rail is emitted as OVERLAPPING SEGMENTS no longer
 * than SEG_W, so the strip axis never exceeds the provider's budget. `assertBudget` fails the
 * build if any emitted side does — this class cannot recur silently.
 *
 * WHY ONE DESIGN PER IMAGE (MEASURED DEFECT: round 23b)
 * ----------------------------------------------------
 * The second builder packed three cells per image. Its cells' strip heights varied with each
 * design's own criterion text (251 px for a one-line criterion vs 851 px for a long one), and
 * the same design was judged on a horizontal image and a rail image. The seat then answered
 * CONTRADICTORILY about the same design ("TOP band pixels show uniform white field and no
 * border geometry at the edge" on an image whose top band measures 0.0202-0.7886 ink), and
 * several rail answers argued from the horizontal image's absent rail. Measured on the same
 * frames (probes under `temp/scratch/`, round 23): the emitted pixels are BYTE-IDENTICAL to
 * the region re-cut from the judged frame (12/12 design cells), so no ink is lost — the
 * defect is that a three-design, single-band image gives the reviewer no way to know which
 * strip is which edge and no way to see the ring closed. One design per image, all four edges,
 * every edge tagged, and the interior side marked in the pixels.
 *
 * WHY 1:1 AND WHY THE CAPTION CARRIES THE CRITERION
 * -------------------------------------------------
 * The round-22 seat failed hairline designs at the overview's 0.512 downsample and returned
 * them MET at the loupe scale; the judged scale must be the one the criterion's own words
 * live at. Each cell prints its criterion under the strips (the fixture's text, including an
 * override's, e.g. D-C's aspect-independent 04) so no reviewer judges a design against a
 * remembered criterion.
 *
 * Budget: the gate accepted ~2064x3696 (7.6 Mpx) and rejected ~2112x14016; any side above
 * ~1568 px is downscaled by the provider. Every emitted image is <= MAX_SIDE on its long side
 * and <= MAX_NARROW on its strip axis, asserted per image.
 *
 * Usage:
 *   node scripts/byok_border_judged.js [<round-dir>]
 *   BORDER_GALLERY_ROUND=23 node scripts/byok_border_judged.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ROUND = process.env.BORDER_GALLERY_ROUND || "23";
const DEFAULT_DIR = path.join(
  ROOT, "temp", "visual_logs", "byok_svg_borders_20260927", "gallery-round" + ROUND,
);

/** The product's own band geometry (js/ai_border.js BORDER_IMAGE_KNOBS + js/print_styles.js):
 *  the ring paints from `edge - outset(16)` to `edge + (width 28 - outset 16) = edge + 12`. */
const OUTSET = 16;
const BAND_IN = 12;
/** Landmark only: the drawn strip ends at the painted band. Kept so the caption can state the
 *  strip depth in the product's own units (56 device px = 16 + 12 CSS px at dsf 2). */

/** Long-side envelope: the gate accepted 2064x3696 and rejected 2112x14016. */
const MAX_SIDE = 4000;
const MAX_MPX = 7.5;
/** THE AXIS THE 1:1 STRIPS RUN ALONG. MEASURED: the provider downscales any side above ~1568
 *  px, which is what made the round-23 rotated submission arrive at ~2.5x down. Nothing this
 *  builder emits may exceed this on its strip axis; `assertBudget` enforces it. */
const MAX_NARROW = 1568;
/** Longest 1:1 run of one edge within a single image, and the overlap between consecutive
 *  segments so no ornament mark can straddle a cut unnoticed. */
const SEG_W = 1408;
const OVERLAP = 96;

const FONT = 13;
const TAG_FONT = 12;
const GAP = 10;
/** Width of the interior-side marker bar, in device px, drawn BESIDE the strip (never over it,
 *  so the judged pixels stay untouched) on the side that faces the section's centre. */
const MARK = 6;
const MARK_BG = "#ffd27f";

/** The four edges, each with the side of its own strip that faces the section's CENTRE. */
const EDGES = [
  { id: "TOP", interior: "BOTTOM" },
  { id: "BOTTOM", interior: "TOP" },
  { id: "LEFT", interior: "RIGHT" },
  { id: "RIGHT", interior: "LEFT" },
];

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Wrap text to ~`cols` characters; returns array of lines. */
function wrap(text, cols) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > cols) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines.length ? lines : [""];
}

/** An SVG text band; height grows with the line count so nothing is ever cropped. */
function captionBand(width, lines, bg, fg, fontPx) {
  const h = lines.length * (fontPx + 4) + 8;
  const svg =
    `<svg width="${width}" height="${h}">` +
    `<rect width="100%" height="100%" fill="${bg}"/>` +
    lines
      .map(
        (ln, i) =>
          `<text x="6" y="${(i + 1) * (fontPx + 4)}" font-family="Arial,sans-serif" ` +
          `font-size="${fontPx}" fill="${fg}">${esc(ln)}</text>`,
      )
      .join("") +
    "</svg>";
  return { buf: Buffer.from(svg), h };
}

const tagBand = (width, text) => captionBand(width, [text], "#1b1b1b", "#ffd27f", TAG_FONT);

/** A flat bar used as the interior-side marker (never painted over judged pixels). */
async function markBar(w, h) {
  return sharp({ create: { width: w, height: h, channels: 4, background: MARK_BG } })
    .png()
    .toBuffer();
}

/**
 * Split a rail's height into 1:1 segments no longer than SEG_W, overlapping by OVERLAP.
 * Returns the cut regions in document order (top of the rail first).
 */
function segments(length) {
  if (length <= SEG_W) return [{ offset: 0, length }];
  const step = SEG_W - OVERLAP;
  const out = [];
  for (let start = 0; start < length; start += step) {
    const len = Math.min(SEG_W, length - start);
    out.push({ offset: start, length: len });
    if (start + len >= length) break;
  }
  return out;
}

async function main() {
  const dir = path.resolve(process.argv[2] || DEFAULT_DIR);
  const manifestPath = path.join(dir, "gallery-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("no gallery-manifest.json in " + dir + " — run the gallery capture first");
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if ((manifest.judged || {}).deviceScaleFactor !== 2) {
    throw new Error(
      "manifest.judged.deviceScaleFactor is not 2 (" + JSON.stringify(manifest.judged) +
        ") — this round was not captured by the D-A camera",
    );
  }
  const R = manifest.frameRect;
  if (!R) throw new Error("manifest carries no frameRect");
  const dsf = manifest.judged.deviceScaleFactor;
  // `frameRect` is measured inside the CLIP, so these are the section's own coordinates in the
  // judged frame (device px).
  const dev = {
    x: Math.round(R.x * dsf), y: Math.round(R.y * dsf),
    w: Math.round(R.w * dsf), h: Math.round(R.h * dsf),
  };
  const out = OUTSET * dsf;
  const inn = BAND_IN * dsf;
  const bandPx = out + inn; // 56 device px of paint under/over each edge

  const designs = (manifest.designs || []).filter((d) => d.file);
  if (!designs.length) throw new Error("manifest.designs is empty");

  const images = [];
  let imageNo = 0;

  for (const d of designs) {
    const judgedPath = path.join(dir, d.file);
    if (!fs.existsSync(judgedPath)) throw new Error("missing judged frame " + judgedPath);
    const md = await sharp(judgedPath).metadata();
    const W = md.width, H = md.height;
    const want = { w: manifest.judged.clip.width * dsf, h: manifest.judged.clip.height * dsf };
    if (W !== want.w || H !== want.h) {
      throw new Error(
        d.file + " is " + W + "x" + H + " but the judged clip x dsf is " + want.w + "x" + want.h +
          " — the camera did not capture true device pixels (operator ruling D-A)",
      );
    }
    // A FRESH sharp instance per cut: pipelines are ADDITIVE, so reusing one instance stacks
    // the extracts and the second call resolves against the already-cropped image
    // ("extract_area: bad extract area" — MEASURED on round 23).
    const cut = (region) => sharp(judgedPath).extract(region).png().toBuffer();
    const clamp = (v, hi) => Math.max(0, Math.min(v, hi));

    // The band region for one edge, in the judged frame's own device coordinates.
    const region = {
      TOP: { left: 0, top: clamp(dev.y - out, H - bandPx), width: W, height: bandPx },
      BOTTOM: {
        left: 0, top: clamp(dev.y + dev.h - inn, H - bandPx), width: W, height: bandPx,
      },
      LEFT: { left: clamp(dev.x - out, W - bandPx), top: 0, width: bandPx, height: H },
      RIGHT: {
        left: clamp(dev.x + dev.w - inn, W - bandPx), top: 0, width: bandPx, height: H,
      },
    };
    // The band is an EDGE STRIP: it does not span a corner. A criterion that judges something
    // at the border's corners is therefore read here, in the 28 CSS px CORNER SQUARE of the
    // RING — the intersection of the two bands, i.e. [edge-16, edge+12] on BOTH axes, which is
    // mostly OUTSIDE the section. (An earlier build of this row placed the box at the section's
    // OWN top-left corner, 32 device px too far in: there the section's page content fills the
    // box and a reviewer correctly reported "no arc groups" about a box the border never paints.
    // The box is the RING's corner, not the section's.)
    const cornerPx = Math.round(28 * dsf);
    const corners = {
      "TL": { left: dev.x - out, top: dev.y - out, width: cornerPx, height: cornerPx },
      "TR": {
        left: dev.x + dev.w + inn - cornerPx, top: dev.y - out, width: cornerPx, height: cornerPx,
      },
      "BL": {
        left: dev.x - out, top: dev.y + dev.h + inn - cornerPx, width: cornerPx, height: cornerPx,
      },
      "BR": {
        left: dev.x + dev.w + inn - cornerPx, top: dev.y + dev.h + inn - cornerPx,
        width: cornerPx, height: cornerPx,
      },
    };

    const label = d.label || d.id;
    const overrideNote = d.criterionOverride
      ? " [criterion RE-CUT by operator ruling " + (d.criterionOverride.ruledBy || "?") +
        "; " + (d.criterionOverride.reason || "") + "]"
      : "";
    const capLines = [
      "JUDGED CELL - " + label + " - " + (d.variant ? "superseded variant" : "canonical") +
        " - curated round " + (d.round || "?") + " - source svg sha256 " +
        String(d.sha256 || "?").slice(0, 16) + "…",
      "CRITERION (verbatim from the frozen corpus, = the text this blob was generated for):" +
        overrideNote,
      ...wrap(d.criterion || "(no criterion recorded - judge ring closure only)", 168),
      "GEOMETRY: the product paints this design as a ring from -" + OUTSET + "px (OUTSIDE the " +
        "section edge) to +" + BAND_IN + "px (inside); every strip below is the full painted " +
        "band, " + bandPx + " device px deep at 1:1 (deviceScaleFactor " + dsf + ", nothing " +
        "resized or downscaled).",
      "INTERIOR SIDE: each strip carries a " + MARK_BG + " marker BAR on the side of its own " +
        "strip that faces the section's CENTRE - the ornament must point at that bar, not at " +
        "the blank field beside it.",
      "READING ORDER: TOP edge, BOTTOM edge, then LEFT and RIGHT rails left-to-right as " +
        "overlapping segments, then the four CORNERS (TL, TR, BL, BR) as 28x28 CSS boxes cut " +
        "from the section's own corners - a rail segment is the rail's own pixels UNSLICED, and " +
        "an edge strip does not span a corner, so a corner question is answered by the corner " +
        "row. A design whose criterion is not met must be named NOT MET.",
    ];
    const cap = captionBand(W, capLines, "#222", "#fff", FONT);

    // ---- horizontal edges: strip + marker bar beneath/above -------------------------------
    const rowFor = async (edge) => {
      const strip = await cut(region[edge.id]);
      const bar = await markBar(W, MARK);
      const tag = tagBand(W, edgeLine(edge, region[edge.id], W, dsf, bandPx));
      const markerFirst = edge.interior === "TOP";
      const h = tag.h + bandPx + MARK;
      const parts = [{ input: tag.buf, top: 0, left: 0 }];
      if (markerFirst) {
        parts.push({ input: bar, top: tag.h, left: 0 });
        parts.push({ input: strip, top: tag.h + MARK, left: 0 });
      } else {
        parts.push({ input: strip, top: tag.h, left: 0 });
        parts.push({ input: bar, top: tag.h + bandPx, left: 0 });
      }
      return {
        buf: await sharp({ create: { width: W, height: h, channels: 4, background: "#111" } })
          .composite(parts)
          .png()
          .toBuffer(),
        w: W, h,
      };
    };

    // ---- rails: segment strips side by side, marker bar on the interior side ---------------
    const railRow = async (edge) => {
      const segs = segments(H);
      const cells = [];
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        const strip = await cut({
          left: region[edge.id].left, top: s.offset, width: bandPx, height: s.length,
        });
        const bar = await markBar(MARK, s.length);
        const markerFirst = edge.interior === "LEFT";
        const cw = bandPx + MARK;
        const parts = markerFirst
          ? [{ input: bar, top: 0, left: 0 }, { input: strip, top: 0, left: MARK }]
          : [{ input: strip, top: 0, left: 0 }, { input: bar, top: 0, left: bandPx }];
        const buf = await sharp({ create: { width: cw, height: s.length, channels: 4, background: "#111" } })
          .composite(parts)
          .png()
          .toBuffer();
        cells.push({ buf, w: cw, h: s.length, offset: s.offset, length: s.length });
      }
      const segCount = segs.length;
      const gapW = segCount > 1 ? 12 : 0;
      const rowW = segCount * (bandPx + MARK) + (segCount - 1) * gapW;
      const tag = tagBand(
        W,
        edgeLine(edge, region[edge.id], bandPx, dsf, bandPx) + " | " + segCount +
          " segment(s) left-to-right, each the rail's own pixels UNSLICED (segments overlap " +
          OVERLAP + " device px); the " + MARK_BG + " bar is on the " + edge.interior + " side",
      );
      const rowH = Math.max(...cells.map((c) => c.h));
      const h = tag.h + rowH;
      const parts = [{ input: tag.buf, top: 0, left: 0 }];
      let x = 0;
      for (let i = 0; i < cells.length; i++) {
        if (i > 0) x += gapW;
        parts.push({ input: cells[i].buf, top: tag.h, left: x });
        x += cells[i].w;
      }
      return {
        buf: await sharp({ create: { width: W, height: h, channels: 4, background: "#111" } })
          .composite(parts)
          .png()
          .toBuffer(),
        w: W, h, rowW,
      };
    };

    // ---- corners: the four corner boxes side by side (what an edge strip cannot show) -------
    const cornerNames = Object.keys(corners);
    const cornerRow = async () => {
      const cells = [];
      for (const k of cornerNames) {
        const box = await cut(corners[k]);
        cells.push({ buf: box, w: cornerPx, h: cornerPx, name: k });
      }
      const gapW = 12;
      const tag = tagBand(
        W,
        "CORNERS - the four " + cornerPx + "x" + cornerPx + " device px boxes at the section's " +
          "own corners (28 CSS px at dsf " + dsf + "), LEFT-to-RIGHT: " + cornerNames.join(", ") +
          ". An edge strip above does NOT span a corner: a criterion that judges corner " +
          "artwork is read HERE.",
      );
      const rowH = cornerPx;
      const h = tag.h + rowH;
      const parts = [{ input: tag.buf, top: 0, left: 0 }];
      let x = 0;
      for (let i = 0; i < cells.length; i++) {
        if (i > 0) x += gapW;
        parts.push({ input: cells[i].buf, top: tag.h, left: x });
        x += cells[i].w;
      }
      return {
        buf: await sharp({ create: { width: W, height: h, channels: 4, background: "#111" } })
          .composite(parts)
          .png()
          .toBuffer(),
        w: W, h,
      };
    };

    const rows = [];
    rows.push(await rowFor(EDGES.find((e) => e.id === "TOP")));
    rows.push(await rowFor(EDGES.find((e) => e.id === "BOTTOM")));
    const railLeft = await railRow(EDGES.find((e) => e.id === "LEFT"));
    const railRight = await railRow(EDGES.find((e) => e.id === "RIGHT"));
    rows.push(railLeft, railRight);
    rows.push(await cornerRow());

    const imgH = cap.h + rows.reduce((a, r) => a + r.h + GAP, 0) + GAP;
    const parts = [{ input: cap.buf, top: 0, left: 0 }];
    let top = cap.h + GAP;
    for (const r of rows) {
      parts.push({ input: r.buf, top, left: 0 });
      top += r.h + GAP;
    }
    const mpx = (W * imgH) / 1e6;
    imageNo += 1;
    assertBudget(W, imgH, mpx, label);
    const buf = await sharp({ create: { width: W, height: imgH, channels: 4, background: "#111" } })
      .composite(parts)
      .png()
      .toBuffer();
    const name = "judged-cell-" + String(imageNo).padStart(2, "0") + "-" +
      label.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() + ".png";
    fs.writeFileSync(path.join(dir, name), buf);
    images.push({
      file: name, imageNo, label, id: d.id, variant: Boolean(d.variant), round: d.round || null,
      sha256: d.sha256 || null, criterion: d.criterion || null,
      criterionOverride: d.criterionOverride || null, judgedFile: d.file,
      width: W, height: imgH, mpx: Number(mpx.toFixed(2)),
      edges: EDGES.map((e) => ({
        edge: e.id, interiorSide: e.interior,
        region: region[e.id],
        // For the rails the region is the WHOLE rail and this entry names the slot list; for the
        // horizontals the region is the whole strip and there is exactly one slot. `segments`
        // is the offset/length list a consumer needs to locate a slot's pixels — a bare COUNT
        // is not reconstructible (a prior probe had to re-derive it).
        segments: segments(e.id === "LEFT" || e.id === "RIGHT" ? H : W),
      })),
      corners: {
        boxPx: cornerPx,
        boxes: corners,
      },
    });
    console.log(
      "judged cell: " + name + " - " + W + "x" + imgH + " (" + mpx.toFixed(2) + " Mpx) - " + label,
    );
  }

  const meta = {
    round: ROUND,
    dir: path.relative(ROOT, dir).split(path.sep).join("/"),
    camera: {
      deviceScaleFactor: dsf,
      clipCss: manifest.judged.clip,
      frameRectCss: R,
      frameRectDevice: dev,
      band: { outset: OUTSET, inner: BAND_IN, stripDepthDevicePx: bandPx },
      stripPolicy:
        "one image per design; 1:1 device px, no resize, no rotation; TOP/BOTTOM full width; " +
        "LEFT/RIGHT split into segments of at most " + SEG_W + " device px overlapping by " +
        OVERLAP + "; each strip carries a marker bar on the side facing the section centre",
    },
    budget: {
      maxSide: MAX_SIDE, maxNarrow: MAX_NARROW, maxMpx: MAX_MPX,
      segmentWidth: SEG_W, segmentOverlap: OVERLAP,
      round23Defect:
        "the round-23 builder rotated 72x3936 rails into 3936-px-wide images; the provider " +
        "downscaled that ~2.5x, so the 'native' strips arrived at ~29 px (deterministic ink on " +
        "the same frames: top-ink 0.02-0.79)",
      round23bDefect:
        "the round-23b builder packed 3 designs (single band) per image; cells' strip heights " +
        "varied 251-851 px with each design's criterion text and the seat answered " +
        "contradictorily for the same design across the horizontal and rail images. MEASURED " +
        "on round 23: every emitted strip was BYTE-IDENTICAL to the region re-cut from the " +
        "judged frame, so no ink was lost — the defect was legibility, not fidelity",
    },
    images,
    judgedOver: "scripts/byok_border_judged.js over gallery-round" + ROUND + " (D-A camera)",
  };
  fs.writeFileSync(path.join(dir, "judged-meta.json"), JSON.stringify(meta, null, 2) + "\n");
  console.log(
    "wrote " + path.relative(ROOT, path.join(dir, "judged-meta.json")) + " (" + images.length +
      " image(s))",
  );
}

/** The tag line for one edge strip: which edge, which frame region, and which side is interior. */
function edgeLine(edge, region, stripW, dsf, bandPx) {
  const horiz = edge.id === "TOP" || edge.id === "BOTTOM";
  const span = horiz
    ? "frame columns " + region.left + ".." + (region.left + region.width - 1)
    : "frame rows " + region.top + ".." + (region.top + region.height - 1);
  return edge.id + " edge band - " + stripW + " device px of " + span + ", " + bandPx +
    " px deep, 1:1 at dsf " + dsf + " - INTERIOR side = " + edge.interior + " (marker bar)";
}

/**
 * The budget gate the round-23 defect bypassed: a side above the provider's input budget is
 * silently downscaled, which is the defect. Assert both axes and the area.
 */
function assertBudget(w, h, mpx, label) {
  const long = Math.max(w, h), narrow = Math.min(w, h);
  if (long > MAX_SIDE || mpx > MAX_MPX) {
    throw new Error(
      "judged cell for " + label + " is " + w + "x" + h + " (" + mpx.toFixed(2) + " Mpx) — over " +
        "the vision gate envelope (max long side " + MAX_SIDE + ", max " + MAX_MPX + " Mpx).",
    );
  }
  if (narrow > MAX_NARROW) {
    throw new Error(
      "judged cell for " + label + " is " + w + "x" + h + " and its narrow side is " + narrow +
        " px, above the provider's ~" + MAX_NARROW + "-px input budget — the provider would " +
        "downscale the 1:1 strips by ~" + (narrow / MAX_NARROW).toFixed(2) + "x, which is the " +
        "round-23 defect (the seat read white bands on frames measuring top-ink 0.02-0.79). " +
        "Lower SEG_W via the builder constant.",
    );
  }
}

main().catch((err) => {
  console.error(String((err && err.stack) || err));
  process.exit(1);
});
