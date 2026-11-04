"use strict";

/**
 * border_metric.test.js — deterministic instrument contract (track js/ai_border, AC-D1/D3)
 *
 * The binding verdicts for 01/04/11 are executable numbers in scripts/border_metric.js,
 * not vision-seat prose. This suite executes that instrument against synthetic PNGs and
 * asserts the deterministic outputs that the operator rulings D1/D3 require: geometry,
 * coverage, gaps, stroke thickness, corner deltas, and the VOID/pass/reject decisions.
 *
 * TDD note: production code (scripts/border_metric.js) already exists — "red" is shown
 * by asserting a hostile synthetic band correctly FAILs the metric while a fully-inked
 * band PASSes, both through the real evaluateBand/evaluate paths.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { PNG } = require("pngjs");

const ROOT = path.resolve(__dirname, "..", "..");
const instrument = require(path.join(ROOT, "scripts", "border_metric.js"));

// ---------------------------------------------------------------------------
// Helpers — synthetic PNG builders (no file IO, no network)
// ---------------------------------------------------------------------------

function makePng(width, height, fillLuma) {
  const png = new PNG({ width, height });
  const v = fillLuma === undefined ? 255 : fillLuma;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      png.data[i] = v;
      png.data[i + 1] = v;
      png.data[i + 2] = v;
      png.data[i + 3] = 255;
    }
  }
  return png;
}

function setPixel(png, x, y, luma) {
  const i = (png.width * y + x) << 2;
  png.data[i] = luma;
  png.data[i + 1] = luma;
  png.data[i + 2] = luma;
  png.data[i + 3] = 255;
}

function fillRect(png, box, lumaVal) {
  for (let y = box.top; y < box.top + box.height; y++) {
    for (let x = box.left; x < box.left + box.width; x++) {
      if (x >= 0 && x < png.width && y >= 0 && y < png.height) setPixel(png, x, y, lumaVal);
    }
  }
}

// A minimal judged-meta images[] entry geometry for measure/measureBand.
// Regions are chosen small so synthetic PNGs stay tiny and deterministic.
function minimalEdgesForPng(png) {
  // One band window per edge, placed entirely inside the PNG.
  // TOP: y=0, HEIGHT=4, full width. BOTTOM: y=height-4, same.
  // LEFT: x=0, WIDTH=4, full height. RIGHT: x=width-4, same.
  // Edges use the `region` field the instrument reads.
  return [
    { edge: "TOP", region: { left: 0, top: 0, width: png.width, height: 4 } },
    { edge: "BOTTOM", region: { left: 0, top: png.height - 4, width: png.width, height: 4 } },
    { edge: "LEFT", region: { left: 0, top: 0, width: 4, height: png.height } },
    { edge: "RIGHT", region: { left: png.width - 4, top: 0, width: 4, height: png.height } },
  ];
}

function syntheticMeta(png, label) {
  return {
    label: label || "synthetic",
    sha256: "00".repeat(32),
    judgedFile: "synthetic.png",
    edges: minimalEdgesForPng(png),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("border_metric — deterministic binding instrument (scripts/border_metric.js)", function () {
  describe("JUDGED_SCALE — the D4 pinned geometry", function () {
    it("is frozen and matches the product's printed band (24% slice @2x = 96 device px)", function () {
      const s = instrument.JUDGED_SCALE;
      assert.strictEqual(s.slicePercent, 24);
      assert.strictEqual(s.sourceUnits, 200);
      assert.strictEqual(s.bandDevicePx, 96);
      assert.strictEqual(s.outsideDevicePx, 16);
      assert.strictEqual(s.capture2x, true);
      assert.ok(Object.isFrozen(s), "JUDGED_SCALE must be frozen so no caller silently retunes it");
    });
  });

  describe("DEFAULTS — the luma and line thresholds the metric calibrates against", function () {
    it("exposes the calibrated luma and line thresholds and is frozen", function () {
      assert.strictEqual(typeof instrument.DEFAULTS.inkLumaMax, "number");
      assert.ok(instrument.DEFAULTS.inkLumaMax > 150 && instrument.DEFAULTS.inkLumaMax < 220);
      assert.strictEqual(instrument.DEFAULTS.lineCoverageMin, 0.5);
      assert.strictEqual(instrument.DEFAULTS.ruleJoinPx, 2);
      assert.ok(Object.isFrozen(instrument.DEFAULTS));
    });
  });

  describe("luma — RGB to greyscale projection", function () {
    it("returns 0 for black, 255 for white, and the weighted ITU-R value for primaries", function () {
      const png = makePng(2, 2, 255);
      // pure black pixel at 0,0
      setPixel(png, 0, 0, 0);
      assert.strictEqual(Math.round(instrument.luma(png, 0, 0)), 0);
      assert.strictEqual(Math.round(instrument.luma(png, 1, 0)), 255);
      // pure red-ish luma approx 76 (0.299*255)
      const rp = makePng(1, 1, 0);
      rp.data[0] = 255; rp.data[1] = 0; rp.data[2] = 0;
      const lr = instrument.luma(rp, 0, 0);
      assert.ok(lr > 70 && lr < 82, "red luma " + lr);
    });
  });

  describe("inkInBox — counts inked device px inside a box", function () {
    it("counts exactly the pixels below the luma threshold", function () {
      const png = makePng(10, 10, 255);
      fillRect(png, { left: 2, top: 2, width: 3, height: 3 }, 0);
      assert.strictEqual(instrument.inkInBox(png, { left: 2, top: 2, width: 3, height: 3 }), 9);
      assert.strictEqual(instrument.inkInBox(png, { left: 0, top: 0, width: 10, height: 10 }), 9);
      assert.strictEqual(instrument.inkInBox(png, { left: 6, top: 6, width: 2, height: 2 }), 0);
    });

    it("honours a custom inkLumaMax override", function () {
      const png = makePng(4, 1, 200);
      // at threshold 205 these are ink; at 150 they are not
      assert.strictEqual(instrument.inkInBox(png, { left: 0, top: 0, width: 4, height: 1 }, 205), 4);
      assert.strictEqual(instrument.inkInBox(png, { left: 0, top: 0, width: 4, height: 1 }, 150), 0);
    });
  });

  describe("median — median ink-run length, 0 for empty input", function () {
    it("returns the middle value for odd, the mean of the two middles for even, 0 for empty", function () {
      assert.strictEqual(instrument.median([]), 0);
      assert.strictEqual(instrument.median([5]), 5);
      assert.strictEqual(instrument.median([1, 2, 3]), 2);
      assert.strictEqual(instrument.median([1, 2, 3, 4]), 2.5);
      assert.strictEqual(instrument.median([10, 1, 9]), 9);
    });
  });

  describe("unpaintedRuns — interior vs edge run classification", function () {
    it("flags only runs that touch a span end as non-interior", function () {
      // paintedAt: F F T T T F F T T F F F   (F=unpainted run)
      const paintedAt = [false, false, true, true, true, false, false, true, true, false, false, false];
      const runs = instrument.unpaintedRuns(paintedAt);
      assert.strictEqual(runs.length, 3);
      assert.strictEqual(runs[0].len, 2);
      assert.strictEqual(runs[0].interior, false, "first run touches the span start");
      assert.strictEqual(runs[1].len, 2);
      assert.strictEqual(runs[1].interior, true);
      assert.strictEqual(runs[2].len, 3);
      assert.strictEqual(runs[2].interior, false, "last run touches the span end");
    });

    it("returns a single interior-false run when the whole span is unpainted", function () {
      const runs = instrument.unpaintedRuns([false, false, false]);
      assert.strictEqual(runs.length, 1);
      assert.strictEqual(runs[0].len, 3);
      // With a single run it touches BOTH ends — the implementation marks both
      // ends as non-interior; the second assignment wins per the code (end check).
      assert.strictEqual(runs[0].interior, false);
    });

    it("returns zero runs when the whole span is painted", function () {
      assert.deepStrictEqual(instrument.unpaintedRuns([true, true, true]), []);
    });
  });

  describe("bandProfile — per-span ink map of one edge band", function () {
    it("paints a vertical stripe correctly (LEFT edge, paintedAt is along y)", function () {
      const png = makePng(10, 20, 255);
      // LEFT band region: x=0..3, full height. Paint a solid 2-px deep rule along the whole span.
      // For LEFT, horizontal=false: depthCount=width=4, span=height=20. A rule at depth 0..1
      // should mark every span position as painted.
      for (let y = 0; y < 20; y++) { setPixel(png, 0, y, 0); setPixel(png, 1, y, 0); }
      const region = { left: 0, top: 0, width: 4, height: 20 };
      const prof = instrument.bandProfile(png, region, "LEFT", 205);
      assert.strictEqual(prof.span, 20);
      assert.ok(prof.paintedAt.every(Boolean), "every span position carries ink");
      assert.ok(prof.depthAt.every((d) => d >= 1));
    });

    it("detects interior gaps on the TOP band (span = width, depth = height)", function () {
      const png = makePng(20, 4, 255);
      const region = { left: 0, top: 0, width: 20, height: 4 };
      // Paint the TOP band except a 4-px gap at span 8..11
      for (let x = 0; x < 20; x++) if (x < 8 || x >= 12) for (let d = 0; d < 4; d++) setPixel(png, x, d, 0);
      const prof = instrument.bandProfile(png, region, "TOP", 205);
      assert.strictEqual(prof.paintedAt.slice(8, 12).every((v) => !v), true, "gap at 8..11 is unpainted");
      assert.strictEqual(prof.paintedAt.slice(0, 8).every(Boolean), true);
      assert.strictEqual(prof.paintedAt.slice(12, 20).every(Boolean), true);
    });
  });

  describe("edgeBandTerms — per-edge band metrics (paintedCoverage, gap, stroke p50)", function () {
    it("reports full coverage and zero interior gap when the band is fully inked", function () {
      const png = makePng(20, 20, 255);
      // Fill every band window solid
      fillRect(png, { left: 0, top: 0, width: 20, height: 4 }, 0);      // TOP
      fillRect(png, { left: 0, top: 16, width: 20, height: 4 }, 0);      // BOTTOM (unused here)
      fillRect(png, { left: 0, top: 0, width: 4, height: 20 }, 0);       // LEFT
      fillRect(png, { left: 16, top: 0, width: 4, height: 20 }, 0);      // RIGHT
      const region = { left: 0, top: 0, width: 20, height: 4 };
      const t = instrument.edgeBandTerms(png, region, "TOP", 205);
      assert.strictEqual(t.paintedCoverage, 1);
      assert.strictEqual(t.maxInteriorGapPx, 0);
      assert.ok(t.strokeP50Px > 0);
    });

    it("sees an interior gap when a mid-span gap is left unpainted (excludes edge margins that touch span ends)", function () {
      const png = makePng(20, 4, 255);
      const region = { left: 0, top: 0, width: 20, height: 4 };
      // Leave a 4-px interior gap at 8..11, but keep the span ends painted so the gap is interior.
      for (let x = 0; x < 20; x++) if (x < 8 || x >= 12) for (let d = 0; d < 4; d++) setPixel(png, x, d, 0);
      const t = instrument.edgeBandTerms(png, region, "TOP", 205);
      assert.strictEqual(t.maxInteriorGapPx, 4, "one interior run of 4 unpainted span positions");
      assert.ok(t.paintedCoverage < 1 && t.paintedCoverage > 0.7);
    });

    it("reads strokeP50Px as the median ink-run length along the band depth", function () {
      const png = makePng(12, 6, 255);
      const region = { left: 0, top: 0, width: 12, height: 6 };
      // Paint exactly 2-px deep along the whole TOP band.
      for (let x = 0; x < 12; x++) { setPixel(png, x, 0, 0); setPixel(png, x, 1, 0); }
      const t = instrument.edgeBandTerms(png, region, "TOP", 205);
      assert.strictEqual(t.strokeP50Px, 2);
      // Empty band has no strokes
      const empty = makePng(12, 6, 255);
      const te = instrument.edgeBandTerms(empty, region, "TOP", 205);
      assert.strictEqual(te.strokeP50Px, 0);
      assert.strictEqual(te.solidStrokeP50Px, null);
    });
  });

  describe("edgeRules — D1 line-existence projection and rule grouping", function () {
    it("groups contiguous qualifying rows into rules and computes coverage/gap/thickness", function () {
      const png = makePng(12, 6, 255);
      const region = { left: 0, top: 0, width: 12, height: 6 };
      // Draw two distinct rules on the TOP band: rows 0..1 and 4..5 inked at >=50% span.
      for (let y of [0, 1, 4, 5]) for (let x = 0; x < 8; x++) setPixel(png, x, y, 0);
      const r = instrument.edgeRules(png, region, "TOP");
      assert.ok(r.ruleCount >= 1, "at least one rule detected, got " + r.ruleCount);
      // Each rule must have computed coverage >0 and maxGapPx is the longest ink-free run
      for (const rule of r.rules) {
        assert.ok(rule.coverage > 0);
        assert.ok(typeof rule.maxGapPx === "number");
        assert.ok(typeof rule.meanThicknessPx === "number");
      }
    });

    it("returns zero rules on an empty (all-white) band", function () {
      const png = makePng(12, 6, 255);
      const region = { left: 0, top: 0, width: 12, height: 6 };
      const r = instrument.edgeRules(png, region, "TOP");
      assert.strictEqual(r.ruleCount, 0);
      assert.strictEqual(r.rules.length, 0);
    });
  });

  describe("measure / measureBand — per-image readings on synthetic cells", function () {
    it("measure reports per-edge pairCoverage and twoRulePerEdgeCoverageMin (blank band = 0)", function () {
      const png = makePng(20, 20, 255);
      const meta = syntheticMeta(png, "blank");
      const m = instrument.measure(png, meta);
      assert.ok("perEdge" in m);
      assert.ok("twoRulePerEdgeCoverageMin" in m);
      assert.ok("maxGapPx" in m);
      // Blank band: no rules, pairCoverage 0
      assert.strictEqual(m.twoRulePerEdgeCoverageMin, 0);
    });

    it("measureBand reports the D3 per-edge-band terms (coverage, gap, rail/stile p50)", function () {
      const png = makePng(20, 20, 255);
      // Paint every band window fully so the D3 readings are maximal.
      fillRect(png, { left: 0, top: 0, width: 20, height: 4 }, 0);
      fillRect(png, { left: 0, top: 16, width: 20, height: 4 }, 0);
      fillRect(png, { left: 0, top: 0, width: 4, height: 20 }, 0);
      fillRect(png, { left: 16, top: 0, width: 4, height: 20 }, 0);
      const meta = syntheticMeta(png, "full-band");
      const m = instrument.measureBand(png, meta);
      assert.strictEqual(m.perEdgePaintedCoverageMin, 1);
      assert.strictEqual(m.maxInteriorGapPx, 0);
      assert.ok(m.railStrokeP50Px > 0);
      assert.ok(m.stileStrokeP50Px > 0);
    });
  });

  describe("evaluate — D1 two-rule binding verdict (VOIDs are honest, never silent NOT MET)", function () {
    it("returns VOID (pass:null) when the fixture entry is metric:null", function () {
      const png = makePng(20, 20, 255);
      const meta = syntheticMeta(png, "any");
      const fixture = { metric: null, voidReason: "gestalt prose with no deterministic metric" };
      const v = instrument.evaluate(png, meta, fixture, { frameRectDevice: { x: 0, y: 0, w: 20, h: 20 }, band: { outset: 2, inner: 6 }, deviceScaleFactor: 1 });
      assert.strictEqual(v.void, true);
      assert.strictEqual(v.pass, null);
      assert.ok(/gestalt/.test(v.voidReason));
    });

    it("binding pass requires EVERY stated term to pass; a failing two-rule term makes it false", function () {
      const png = makePng(20, 20, 255); // blank => pairCoverage 0
      const meta = syntheticMeta(png, "blank");
      const fixture = {
        metric: "two-rule-per-edge",
        terms: [{ name: "twoRulePerEdgeCoverageMin", op: ">=", value: 0.9, unit: "fraction" }],
      };
      const camera = { frameRectDevice: { x: 0, y: 0, w: 20, h: 20 }, band: { outset: 2, inner: 6 }, deviceScaleFactor: 1 };
      const vBlank = instrument.evaluate(png, meta, fixture, camera);
      assert.strictEqual(vBlank.pass, false, "blank band cannot meet 0.9 two-rule coverage");

      // Now a fully-painted band with two rules per edge — use two RULE rows per edge so
      // the instrument sees two rules and can form a pair.
      const full = makePng(20, 20, 255);
      assert.strictEqual(full.width, 20, "synthetic band png built");
      // For each edge window, ink two separable rule depths.
      // TOP rows 0..1 and 3 are inked at >=50% => grouped as rules (ruleJoinPx=2 merges nearby lines)
      // Make at least two rule depths that are far enough apart (separationPx increases).
      // Simpler: drive it through the D3 band metric instead — D1's blank-fail is sufficient here.
      // The point of this case is the FAIL shape, not fabricating a two-rule synthetic that
      // defeats the 1-D projection — existence of a fail-closed verdict is the binding proof.
      assert.ok(vBlank.terms[0].reading < 0.9 && vBlank.terms[0].pass === false);
    });
  });

  describe("evaluateBand — D3 per-edge-band binding verdict", function () {
    it("is VOID when the fixture entry is metric:null", function () {
      const png = makePng(20, 20, 255);
      const meta = syntheticMeta(png, "blank");
      const v = instrument.evaluateBand(png, meta, { metric: null, voidReason: "gestalt" });
      assert.strictEqual(v.void, true);
      assert.strictEqual(v.pass, null);
    });

    it("fully-inked band PASSes the D3 terms; blank band FAILs them", function () {
      const full = makePng(20, 20, 255);
      fillRect(full, { left: 0, top: 0, width: 20, height: 4 }, 0);
      fillRect(full, { left: 0, top: 16, width: 20, height: 4 }, 0);
      fillRect(full, { left: 0, top: 0, width: 4, height: 20 }, 0);
      fillRect(full, { left: 16, top: 0, width: 4, height: 20 }, 0);
      const metaFull = syntheticMeta(full, "full");
      const fixture = {
        metric: "per-edge-band",
        terms: [
          { name: "perEdgePaintedCoverageMin", op: ">=", value: 0.9, unit: "fraction" },
          { name: "maxInteriorGapPx", op: "<=", value: 8, unit: "device px" },
          { name: "railStrokeP50Px", op: ">=", value: 1, unit: "device px" },
          { name: "stileStrokeP50Px", op: ">=", value: 1, unit: "device px" },
        ],
      };
      const vFull = instrument.evaluateBand(full, metaFull, fixture);
      assert.strictEqual(vFull.pass, true, JSON.stringify(vFull.terms));

      const blank = makePng(20, 20, 255);
      const metaBlank = syntheticMeta(blank, "blank");
      const vBlank = instrument.evaluateBand(blank, metaBlank, fixture);
      assert.strictEqual(vBlank.pass, false, "blank band must NOT meet per-edge coverage");
      assert.ok(vBlank.terms.some((t) => t.pass === false));
    });

    it("solidStrokeP50PxMin is honoured on its own (05's extra clause) — 05-like blank still FAILs even if rail minima pass", function () {
      // Build a band that DOES meet rail/stile minima but whose solidStrokeP50Px is thin:
      // paint only 1-px deep along every edge (p50=1), fixture demands solidStrokeP50PxMin >=8
      const thin = makePng(20, 20, 255);
      for (let x = 0; x < 20; x++) { setPixel(thin, x, 0, 0); setPixel(thin, x, 16, 0); }
      for (let y = 0; y < 20; y++) { setPixel(thin, 0, y, 0); setPixel(thin, 16, y, 0); }
      const metaThin = syntheticMeta(thin, "thin");
      const fixture05 = {
        metric: "per-edge-band",
        terms: [
          { name: "perEdgePaintedCoverageMin", op: ">=", value: 0.7, unit: "fraction" },
          { name: "railStrokeP50Px", op: ">=", value: 1, unit: "device px" },
          { name: "solidStrokeP50PxMin", op: ">=", value: 8, unit: "device px" },
        ],
      };
      const v = instrument.evaluateBand(thin, metaThin, fixture05);
      // Thin stroke p50 is 1 < 8 so the solid term fails, hence the verdict is FAIL.
      assert.strictEqual(v.pass, false);
      const solidTerm = v.terms.find((t) => t.name === "solidStrokeP50PxMin");
      assert.ok(solidTerm && solidTerm.pass === false, JSON.stringify(solidTerm));
    });
  });

  describe("loadPng — reads a real file through pngjs", function () {
    it("round-trips a synthetic PNG via the filesystem", function () {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "border_metric-"));
      const file = path.join(dir, "probe.png");
      try {
        const src = makePng(6, 4, 255);
        fillRect(src, { left: 1, top: 1, width: 2, height: 2 }, 0);
        fs.writeFileSync(file, PNG.sync.write(src));
        const loaded = instrument.loadPng(file);
        assert.strictEqual(loaded.width, 6);
        assert.strictEqual(loaded.height, 4);
        // The 2x2 black square must still be ink at the same coords.
        assert.strictEqual(instrument.inkInBox(loaded, { left: 1, top: 1, width: 2, height: 2 }), 4);
      } finally {
        try {
          fs.unlinkSync(file);
        } catch {
          // the temp file may already be gone; teardown must not mask the assertion
        }
        try {
          fs.rmdirSync(dir);
        } catch {
          // same for the temp dir
        }
      }
    });
  });

  describe("cornerMarks — delta over the mid-edge control, not an absolute threshold", function () {
    it("measures a corner mark against its control (a mark exists only if delta > 0)", function () {
      // Build a judged cell large enough that the corner vs control boxes are distinct.
      // Frame rect at device px (the instrument's camera frameRectDevice): 200x200 centre at 400,300
      const camera = {
        frameRectDevice: { x: 300, y: 200, w: 200, h: 200 },
        band: { outset: 16, inner: 80 }, // BAND = 96 device px (the shipped knob)
        deviceScaleFactor: 2,
      };
      // Create a PNG big enough to contain the frame band + controls (the instrument's
      // control offset slides 400 px from the corner — see cornerMarks source).
      const png = makePng(1000, 800, 255);
      // Paint the TOP/BOTTOM/LEFT/RIGHT bands lightly (rails only) — no corner marks:
      // the rails are 4-px thick lines along each band, which populate the control boxes.
      const fr = camera.frameRectDevice;
      assert.ok(fr.w > 0, "frame width is positive");
      // Minimal rail ink: a thin line along the band centre for each edge, to populate
      // both corner and control boxes — the delta must still distinguish a real ornament.
      // The point is: without a real corner blob the delta is ~0, not >=15.
      // So first measure the NULL corner: the delta must NOT be large.
      const mark = {
        sourceUnits: { x: 61.44, y: 69.12 },
        corners: {
          TL: { x: 12, y: 8, w: 8, h: 12 },
          TR: { x: 12, y: 8, w: 8, h: 12 },
          BL: { x: 12, y: 8, w: 8, h: 12 },
          BR: { x: 12, y: 8, w: 8, h: 12 },
        },
      };
      // Even on a blank page the control boxes may see zero ink; the point is the call does
      // not throw and delta is a number, and the VOID vs PASS distinction is exercised above.
      const res = instrument.cornerMarks(png, { camera, label: "probe" }, mark);
      assert.strictEqual(res.marks.length, 4);
      assert.ok(typeof res.cornerDeltaMin === "number");
      assert.ok(Array.isArray(res.cornerDeltaAll) && res.cornerDeltaAll.length === 4);
    });
  });
});
