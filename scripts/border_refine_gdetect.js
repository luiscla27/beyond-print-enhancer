#!/usr/bin/env node
/**
 * border_refine_gdetect.js — G-DETECT, MEASURED: does refining an AI border change what is painted?
 *
 * WHAT THE GATE IS, in this project's own vocabulary: "G-DETECT: border refinement produces
 * detectable output changes" (`conductor/tracks/beyond10_ai_border_refine_loop/plan.md`). It is a claim
 * about PIXELS, so it cannot be answered by comparing SVG strings — a stroke-width attribute that
 * changed in a string and a stroke that changed on the page are different facts. This script renders
 * the DESIGN and its REFINED version through the product's own paint mechanism, screenshots both, and
 * counts the pixels that moved.
 *
 * HOW IT PAINTS — THE PRODUCT'S MECHANISM, NOT AN ILLUSTRATION OF IT
 * -----------------------------------------------------------------
 * `js/ai_border.js` paints an AI border by setting four inline custom properties on the section and
 * letting the `.print-section-container:not(.be-no-border)::before` rule in `js/print_styles.js:1226`
 * put them through the browser's own `border-image` engine. The host page below reproduces exactly
 * that rule (same properties, same order, same `border-image-repeat: round`) and takes the four
 * KNOBS from the product module itself (`AiBorder.BORDER_IMAGE_KNOBS`), so the frame is painted at the
 * product's slice/width/outset rather than at numbers this script invented.
 *
 * WHAT IS ASSERTED (and why these thresholds)
 * -------------------------------------------
 *   changed_px  : pixels whose RGB differs by more than 8 in any channel — the same order of
 *                 magnitude as an anti-aliasing step, so a change must be bigger than resampling
 *                 noise to count.
 *   ink_delta   : the change in the count of "inked" (non-white) pixels — the frame getting heavier
 *                 must ADD ink, which is the direction a weight refinement is supposed to move.
 * The PASS rule is stated in code (`VERDICT`) rather than left to a reader: at least 0.5% of the
 * canvas must change AND the ink must increase. A refinement that painted nothing, or that painted the
 * same artwork, fails BOTH.
 *
 * OUTPUT: `temp/visual_logs/beyond10_gdetect/` — the two frames, the diff, and `report.json` (all three
 * measured numbers, the design id, the parameters, and the product's own sha256 for each SVG, so a
 * reader can tell WHICH bytes produced the frames).
 *
 * USAGE
 *   node scripts/border_refine_gdetect.js                 # verdict, exit 0 = PASS
 *   node scripts/border_refine_gdetect.js --weight 1.25 --style 2 --design 03-thornvine
 *   node scripts/border_refine_gdetect.js --keep          # keep the browser context's temp profile
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const AiBorder = require("../js/ai_border.js");

const ROOT = path.resolve(__dirname, "..");
const CORPUS = path.join(ROOT, "test", "fixtures", "byok_border_corpus.json");
const OUT_DIR = path.join(ROOT, "temp", "visual_logs", "beyond10_gdetect");

/** The section geometry the gallery gate measures at (656x400 / 656x1920 are the frozen sizes). */
const CANVAS = { width: 656, height: 400 };

/** A channel difference at or below this is resampling/anti-aliasing, not a change. */
const CHANNEL_EPSILON = 8;

/** The verdict's own numbers, stated here so the pass rule can be argued with. */
const VERDICT = {
  min_changed_fraction: 0.005, // 0.5% of the canvas
  require_ink_increase: true,
};

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/** The frozen corpus, read exactly the way the gallery spec reads it. */
function loadDesign(id) {
  const data = JSON.parse(fs.readFileSync(CORPUS, "utf8"));
  const designs = (data.designs || []).filter((d) => d.accepted !== false && d.svg);
  const design = designs.find((d) => d.id === id);
  if (!design) {
    throw new Error(
      "design " + id + " is not in " + path.relative(ROOT, CORPUS) + " — available: " +
        designs.map((d) => d.id).join(", "),
    );
  }
  return design;
}

/** The `data:` URI form the choke point builds (`js/ai_border.js`'s `borderImageValue`). */
function borderImageValue(sanitizedSvg) {
  return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(sanitizedSvg) + '")';
}

/**
 * The page. Two identical boxes, each painting one SVG through the product's own `::before` slot
 * (`js/print_styles.js:1226`). The ONLY difference between them is the source image.
 *
 * The `url()` delimiter is a SINGLE quote on purpose: `encodeURIComponent` leaves `'` alone and
 * escapes `"` (as %22), so a single-quoted CSS url survives inside a double-quoted HTML attribute.
 * Measured: escaping the delimiters as `&quot;` produced `url(&quot;…)`, which is not a CSS function,
 * and the frame painted nothing at all (G-DETECT read 0 ink on both frames).
 */
function buildHtml({ design, refined, knobs }) {
  const box = (cls, svg) =>
    '<div class="box ' + cls + '" style="' +
    "--border-img: " + borderImageValue(svg).replace(/"/g, "'") + "; " +
    "--border-img-slice: " + knobs.slice + "; " +
    "--border-img-width: " + knobs.width + "; " +
    "--border-img-outset: " + knobs.outset + '"></div>';
  return (
    "<!DOCTYPE html><html><head><meta charset='utf-8'><style>" +
    "html,body{margin:0;padding:0;background:#ffffff}" +
    ".wrap{padding:40px;display:flex;gap:40px}" +
    ".box{position:relative;box-sizing:border-box;width:" + CANVAS.width + "px;height:" + CANVAS.height + "px}" +
    /* VERBATIM from js/print_styles.js:1226 (`border-image-repeat: round`, `border-width: 0`, the same
       four properties). `z-index:-1` is dropped ONLY because this host has no content to sit behind;
       nothing else about the paint is changed. */
    ".box::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;" +
    "border-color:transparent;border-image-outset:var(--border-img-outset);" +
    "border-image-repeat:round;border-image-slice:var(--border-img-slice);" +
    "border-image-source:var(--border-img);border-image-width:var(--border-img-width);" +
    "border-style:solid;border-width:0}" +
    "</style></head><body><div class='wrap'>" +
    box("design", design) +
    box("refined", refined) +
    "</div></body></html>"
  );
}

/** Decode a PNG buffer into a comparable `{width, height, data}` record. */
function decode(buf) {
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: png.data };
}

/** Is this pixel "ink"? Anything that is not (nearly) white. */
function inked(r, g, b) {
  return r < 245 || g < 245 || b < 245;
}

/** The measurement: how many pixels moved, and in which direction the ink went. */
function measure(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error("frame sizes differ: " + a.width + "x" + a.height + " vs " + b.width + "x" + b.height);
  }
  const total = a.width * a.height;
  let changed = 0;
  let inkA = 0;
  let inkB = 0;
  for (let i = 0; i < total; i++) {
    const off = i * 4;
    const dr = Math.abs(a.data[off] - b.data[off]);
    const dg = Math.abs(a.data[off + 1] - b.data[off + 1]);
    const db = Math.abs(a.data[off + 2] - b.data[off + 2]);
    if (dr > CHANNEL_EPSILON || dg > CHANNEL_EPSILON || db > CHANNEL_EPSILON) changed++;
    if (inked(a.data[off], a.data[off + 1], a.data[off + 2])) inkA++;
    if (inked(b.data[off], b.data[off + 1], b.data[off + 2])) inkB++;
  }
  return {
    width: a.width,
    height: a.height,
    total_px: total,
    changed_px: changed,
    changed_fraction: changed / total,
    ink_design_px: inkA,
    ink_refined_px: inkB,
    ink_delta_px: inkB - inkA,
  };
}

async function main() {
  const weight = Number(arg("weight", "1.5"));
  const styleIndex = Number(arg("style", "1"));
  const designId = arg("design", "01-gilded-frame");

  const design = loadDesign(designId);
  const refined = AiBorder.transformBorderSvg(design.svg, { weight, styleIndex });
  if (refined === design.svg) {
    // A refinement that transforms NOTHING cannot be detected, and saying so here is the difference
    // between "the gate failed" and "the gate had nothing to measure".
    throw new Error(
      "the refinement is a no-op on " + designId + " (weight " + weight + ", style " + styleIndex +
        ") — pick a stroke-bearing design, or a parameter that changes it",
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const html = buildHtml({ design: design.svg, refined, knobs: AiBorder.BORDER_IMAGE_KNOBS });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: CANVAS.width * 2 + 200, height: CANVAS.height + 200 },
    deviceScaleFactor: 1,
  });
  let frames;
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForTimeout(300);
    // WHY A CLIP AND NOT AN ELEMENT SCREENSHOT (measured): `border-image-outset` paints OUTSIDE the
    // border box, so an element screenshot of the section-sized box came back 656x400 with ZERO ink —
    // the whole frame lived 16px beyond the crop. The clip is inflated by the product's own outset, so
    // the frame is inside the frame.
    const boxes = await page.$$eval(".box", (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }),
    );
    if (boxes.length !== 2) throw new Error("the host page did not render both boxes");
    const pad = (parseFloat(AiBorder.BORDER_IMAGE_KNOBS.outset) || 0) + 4;
    const clipFor = (bx) => ({
      x: bx.x - pad,
      y: bx.y - pad,
      width: bx.w + pad * 2,
      height: bx.h + pad * 2,
    });
    const designPng = await page.screenshot({ clip: clipFor(boxes[0]) });
    const refinedPng = await page.screenshot({ clip: clipFor(boxes[1]) });
    fs.writeFileSync(path.join(OUT_DIR, "design-" + designId + ".png"), designPng);
    fs.writeFileSync(path.join(OUT_DIR, "refined-" + designId + ".png"), refinedPng);
    frames = measure(decode(designPng), decode(refinedPng));
    if (frames.ink_design_px === 0) {
      throw new Error(
        "the host page painted NOTHING for the design (0 ink) — the ::before slot did not paint, so " +
          "there is no measurement here, only a green-looking zero",
      );
    }
  } finally {
    await browser.close();
  }

  const pass =
    frames.changed_fraction >= VERDICT.min_changed_fraction &&
    (!VERDICT.require_ink_increase || frames.ink_delta_px > 0);

  const report = {
    gate: "G-DETECT",
    claim: "border refinement produces detectable output changes",
    measured_at: new Date().toISOString(),
    design: {
      id: design.id,
      title: design.title || null,
      sha256: sha256(design.svg),
      bytes: design.svg.length,
    },
    parameters: { weight, styleIndex },
    refined: { sha256: sha256(refined), bytes: refined.length },
    paint: {
      mechanism: "the product's own ::before border-image slot (js/print_styles.js:1226)",
      knobs: AiBorder.BORDER_IMAGE_KNOBS,
      canvas: CANVAS,
      channel_epsilon: CHANNEL_EPSILON,
    },
    verdict_rule: VERDICT,
    frames,
    verdict: pass ? "PASS" : "FAIL",
    artifacts: {
      design: path.relative(ROOT, path.join(OUT_DIR, "design-" + designId + ".png")).split(path.sep).join("/"),
      refined: path.relative(ROOT, path.join(OUT_DIR, "refined-" + designId + ".png")).split(path.sep).join("/"),
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2) + "\n");

  console.log(
    "G-DETECT " + report.verdict + " — " + design.id + " @ weight " + weight + " / style " +
      styleIndex + ": " + frames.changed_px + " of " + frames.total_px + " px changed (" +
      (frames.changed_fraction * 100).toFixed(3) + "%), ink " + frames.ink_design_px + " -> " +
      frames.ink_refined_px + " (" + (frames.ink_delta_px >= 0 ? "+" : "") + frames.ink_delta_px + ")",
  );
  console.log("report: " + path.relative(ROOT, path.join(OUT_DIR, "report.json")));
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error("G-DETECT ERROR: " + (err && err.message ? err.message : String(err)));
  process.exit(2);
});
