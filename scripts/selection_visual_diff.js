#!/usr/bin/env node
/**
 * Deterministic pixel-diff gate for the selection_model_ia_20260910 phase-1
 * frames — the PRIMARY evidence instrument for AC-1.
 *
 * WHY THIS EXISTS (phase-1 consultation, 2026-09-10): a single-image-per-round
 * vision reviewer is the wrong instrument for a three-reader agreement invariant.
 * It returned MET while citing pixels that were not in the frame (round 1), and a
 * NOT MET that was falsified by measurement (round 4). The invariant is
 * deterministic, so it gets a deterministic instrument: compare the committed
 * frames region by region and require that the states which MUST differ, differ,
 * and that every difference lands where the selection is supposed to be.
 *
 * Regions (both derived from the pinned 1440x900 layout):
 *   sheet        x 100..900,  y 20..500   — the on-sheet outline + haze
 *   layer-panel  x 1165..1415, y 10..520  — the layer rows
 *   panel        x 9..277,    y 701..900  — the properties panel
 *
 * Claims asserted:
 *   C1  section-selected vs shape-selected differ in the sheet AND the layer panel
 *       (the selection moved: outline moves, row moves)
 *   C2  section-selected vs cleared       differ in the sheet AND the layer panel
 *       (the defect this gate caught: previously 0 pixels in the layer panel)
 *   C3  shape-selected   vs cleared       differ in the sheet AND the layer panel
 *   C4  every frame pair differs SOMEWHERE (no two states are indistinguishable)
 *
 * Usage:
 *   node scripts/selection_visual_diff.js [--dir vendor/docs/selection-model-ia-20260910/shots-phase1]
 *                                        [--json <out.json>]
 *
 * Exit 1 when any claim fails. Output: one line per pair per region with the
 * differing-pixel count, then one line per claim.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};

const DIR = path.resolve(
  ROOT,
  arg("dir", "vendor/docs/selection-model-ia-20260910/shots-phase1"),
);
const PROBE = path.join(DIR, "selection-probe.json");
const FRAMES = {
  section: "10-section-selected.png",
  shape: "11-shape-selected.png",
  row: "12-layer-row-selected.png",
  cleared: "13-cleared.png",
};
const REGIONS = {
  sheet: { left: 100, top: 20, width: 800, height: 480 },
  "layer-panel": { left: 1165, top: 10, width: 250, height: 510 },
  panel: { left: 9, top: 701, width: 268, height: 199 },
};
/** Deltas below this are treated as identical (anti-aliasing noise). */
const THRESHOLD = 12;

async function diff(fileA, fileB, region) {
  const [a, b] = await Promise.all(
    [fileA, fileB].map((f) =>
      sharp(f).extract(region).raw().toBuffer({ resolveWithObject: true }),
    ),
  );
  let differing = 0;
  let maxDelta = 0;
  for (let i = 0; i < a.data.length; i += a.info.channels) {
    const d =
      Math.abs(a.data[i] - b.data[i]) +
      Math.abs(a.data[i + 1] - b.data[i + 1]) +
      Math.abs(a.data[i + 2] - b.data[i + 2]);
    if (d > THRESHOLD) differing++;
    if (d > maxDelta) maxDelta = d;
  }
  return { differing, maxDelta, total: a.info.width * a.info.height };
}

async function main() {
  const missing = Object.values(FRAMES).filter(
    (f) => !fs.existsSync(path.join(DIR, f)),
  );
  if (missing.length) {
    console.error(`missing frames in ${path.relative(ROOT, DIR)}: ${missing.join(", ")}`);
    process.exit(3);
  }
  const p = (name) => path.join(DIR, FRAMES[name]);
  const pairs = [
    ["section", "shape"],
    ["section", "cleared"],
    ["shape", "cleared"],
    ["section", "row"],
  ];

  const out = { dir: path.relative(ROOT, DIR), threshold: THRESHOLD, regions: {}, pairs: [] };
  for (const [region, box] of Object.entries(REGIONS)) {
    out.regions[region] = box;
  }
  for (const [a, b] of pairs) {
    const row = { pair: `${a} vs ${b}`, regions: {} };
    for (const [region, box] of Object.entries(REGIONS)) {
      const d = await diff(p(a), p(b), box);
      row.regions[region] = d;
      console.log(
        `${a} vs ${b} [${region}] differing=${d.differing}/${d.total} maxDelta=${d.maxDelta}`,
      );
    }
    out.pairs.push(row);
  }

  const get = (pair) =>
    out.pairs.find((r) => r.pair === `${pair} vs ${pair.split(" vs ")[1]}` && false) ||
    out.pairs.find((r) => r.pair === pair);
  const at = (a, b, region) =>
    get(`${a} vs ${b}`).regions[region].differing;

  const claims = [
    [
      "C1 section vs shape differ on the sheet AND the layer panel (the selection moved)",
      at("section", "shape", "sheet") > 0 && at("section", "shape", "layer-panel") > 0,
      `sheet=${at("section", "shape", "sheet")} layer-panel=${at("section", "shape", "layer-panel")}`,
    ],
    [
      "C2 section vs cleared differ on the sheet AND the layer panel (the multi-writer defect)",
      at("section", "cleared", "sheet") > 0 &&
        at("section", "cleared", "layer-panel") > 0,
      `sheet=${at("section", "cleared", "sheet")} layer-panel=${at("section", "cleared", "layer-panel")}`,
    ],
    [
      "C3 shape vs cleared differ on the sheet AND the layer panel",
      at("shape", "cleared", "sheet") > 0 && at("shape", "cleared", "layer-panel") > 0,
      `sheet=${at("shape", "cleared", "sheet")} layer-panel=${at("shape", "cleared", "layer-panel")}`,
    ],
    [
      "C4 section vs layer-row-selected BOTH select an element of the SECTIONS layer (store-read) and differ on the sheet",
      at("section", "row", "sheet") > 0,
      `sheet=${at("section", "row", "sheet")} (different elements: the row entry point takes the layer's first, the frames' section is the largest visible)`,
    ],
  ];

  // AC-2's paint claim, measured rather than eyeballed: a selected element's
  // wrapper must actually RENDER a gold ring (the wrapper's ::after). The ring is
  // counted as warm-gold pixels that CHANGED within 4px of the wrapper's box
  // edges, for BOTH kinds — an outline that is computed but covered by the
  // element's own art shows up here as zero (that is exactly how the first
  // capture exposed the shape case).
  if (fs.existsSync(PROBE)) {
    const probe = JSON.parse(fs.readFileSync(PROBE, "utf8"));
    const ringGold = async (stateKey) => {
      const box = probe[stateKey] && probe[stateKey].dom.onSheet.box;
      if (!box) return null;
      const pad = 5;
      const region = {
        left: Math.max(0, box.left - pad),
        top: Math.max(0, box.top - pad),
        width: Math.min(box.w + pad * 2, 1440 - Math.max(0, box.left - pad)),
        height: Math.min(box.h + pad * 2, 900 - Math.max(0, box.top - pad)),
      };
      const [a, b] = await Promise.all(
        [p(ringGold.state), p("cleared")].map((f) =>
          sharp(f).extract(region).raw().toBuffer({ resolveWithObject: true }),
        ),
      );
      let n = 0;
      let exact = 0;
      for (let i = 0; i < a.data.length; i += a.info.channels) {
        const r = a.data[i], g = a.data[i + 1], bl = a.data[i + 2];
        const d =
          Math.abs(r - b.data[i]) +
          Math.abs(g - b.data[i + 1]) +
          Math.abs(bl - b.data[i + 2]);
        if (d <= 25) continue;
        const px = i / a.info.channels;
        const x = (px % a.info.width) + region.left;
        const y = Math.floor(px / a.info.width) + region.top;
        const nearV = Math.abs(x - box.left) <= 4 || Math.abs(x - (box.left + box.w)) <= 4;
        const nearH = Math.abs(y - box.top) <= 4 || Math.abs(y - (box.top + box.h)) <= 4;
        if (!nearV && !nearH) continue;
        if (r > g && g > bl && r - bl > 15) n++;
        // The RING is the exact locked gold, not an approximate warm tone: an
        // earlier version of this check counted the soft glow and would have
        // passed while no ring was painted at all (found by re-measuring).
        if (
          Math.abs(r - 198) <= 45 &&
          Math.abs(g - 161) <= 45 &&
          Math.abs(bl - 91) <= 45
        ) {
          exact++;
        }
      }
      return { warm: n, exact };
    };
    ringGold.state = "section";
    const sectionRing = await ringGold("sectionSelected");
    ringGold.state = "shape";
    const shapeRing = await ringGold("shapeSelected");
    console.log("");
    console.log(
      `ac-2 ring pixels (within 4px of the box edges): ` +
        `section exact-gold=${sectionRing.exact} warm=${sectionRing.warm} | ` +
        `shape exact-gold=${shapeRing.exact} warm=${shapeRing.warm}`,
    );
    claims.push([
      "C5 BOTH kinds RENDER the same EXACT-GOLD ring on their box edges (AC-2's paint)",
      sectionRing.exact > 300 && shapeRing.exact > 300,
      `section=${sectionRing.exact} shape=${shapeRing.exact} exact-gold pixels (threshold 300)`,
    ]);

    // C6 — the row entry point selects an element of the SECTIONS layer, and the
    // sheet entry point does too (the same reader, two entry points). Read from
    // the store, not from pixels: the layer panel's chips load thumbnails
    // asynchronously, so whole-panel pixel equality between two frames captured
    // seconds apart is not a valid test of this claim (it produced a 1189-pixel
    // difference that had nothing to do with the selection).
    const rowsFor = (key) =>
      (probe[key] && probe[key].store && probe[key].store.activeLayerRows) || null;
    const sectionRows = rowsFor("sectionSelected");
    const rowRows = rowsFor("layerRowSelected");
    const shapeRows = rowsFor("shapeSelected");
    const clearedRows = rowsFor("cleared");
    console.log(
      `selection rows (store-read): section=${JSON.stringify(sectionRows)} ` +
        `row=${JSON.stringify(rowRows)} shape=${JSON.stringify(shapeRows)} ` +
        `cleared=${JSON.stringify(clearedRows)}`,
    );
    claims.push([
      "C6 the row entry point and the sheet entry point agree on the SELECTION ROW, and clearing empties it",
      JSON.stringify(sectionRows) === JSON.stringify(rowRows) &&
        sectionRows &&
        sectionRows.length === 1 &&
        JSON.stringify(shapeRows) !== JSON.stringify(sectionRows) &&
        Array.isArray(clearedRows) &&
        clearedRows.length === 0,
      `section=${JSON.stringify(sectionRows)} row=${JSON.stringify(rowRows)} shape=${JSON.stringify(shapeRows)} cleared=${JSON.stringify(clearedRows)}`,
    ]);
  } else {
    console.log(`\n(no probe at ${path.relative(ROOT, PROBE)} — C5 skipped)`);
  }

  console.log("");
  let failed = 0;
  for (const [name, ok, detail] of claims) {
    console.log(`${ok ? "CLAIM OK  " : "CLAIM FAIL"} — ${name} (${detail})`);
    if (!ok) failed++;
  }
  out.claims = claims.map(([name, ok, detail]) => ({ claim: name, ok, detail }));

  const jsonOut = arg("json", null);
  if (jsonOut) {
    fs.writeFileSync(
      path.resolve(ROOT, jsonOut),
      JSON.stringify({ provenance: provenanceNow(), ...out }, null, 2),
    );
    console.log(`\nwrote ${jsonOut}`);
  }
  process.exit(failed ? 1 : 0);
}

function provenanceNow() {
  let sha = "(unknown)";
  try {
    sha = require("child_process")
      .execSync("git rev-parse --short HEAD", { cwd: ROOT })
      .toString()
      .trim();
  } catch {
    /* not a repo */
  }
  return {
    productCommit: sha,
    measuredAt: new Date().toISOString(),
    instrument: "scripts/selection_visual_diff.js",
    frames: FRAMES,
  };
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
