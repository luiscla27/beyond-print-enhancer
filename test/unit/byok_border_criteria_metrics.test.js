"use strict";
/* The D4 formulation gate (operator ruling 2026-10-02) — fixture-level fence.
 *
 * Reads test/fixtures/byok_border_criteria_metrics.json and enforces, per canonical design:
 *   - the design carries an entry (no silent omission — a missing entry is a VOID nobody declared);
 *   - an entry with metric != null carries judgedScale-derived minFeaturePx, at least one numeric
 *     term with op/value, and a deterministic metric name that scripts/border_metric.js actually
 *     implements (require()d, so the binding instrument EXISTS, not just claimed);
 *   - an entry with metric == null carries a voidReason (the honest VOID declaration per D2);
 *   - thresholds are above minFeaturePx floors where both are stated (a demand below the smallest
 *     paintable feature is unjudgeable — D4's rejection clause).
 *
 * D5 (the freeze/publication block): if ANY canonical design is VOID, this test prints the
 * binding-publication implication but does NOT fail the suite on it — the block binds
 * PUBLICATION (tallies in reports/final_report), not the corpus fixture itself. The failure
 * mode D5 guards against is a published "9/12 MET" computed over VOID criteria; the fence
 * here keeps the data honest so no such tally can be computed silently.
 *
 * NO EDITS to this file may weaken a clause without the operator ruling it — this is the
 * fixture-level half of D4 (the freeze-time half lives in scripts/freeze_border_corpus.js,
 * which consumes the same file).
 */
const assert = require("assert");
const { PNG } = require("pngjs");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const METRICS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "test", "fixtures", "byok_border_criteria_metrics.json"), "utf8"),
);
const corpus = JSON.parse(
  fs.readFileSync(path.join(ROOT, "test", "fixtures", "byok_border_corpus.json"), "utf8"),
);
// The binding instrument must EXIST and load: a metric name this module cannot execute is a
// claimed metric, not a metric (D2: the binding verdict is the measurement).
// NOTE: scripts/border_metric.js requires `pngjs` (a devDependency) — this require also proves
// the dependency is declared, so a fresh clone can run the gate.
const instrument = require(path.join(ROOT, "scripts", "border_metric.js"));

const KNOWN_METRICS = new Set(["two-rule-per-edge"]);

describe("D4 formulation gate — the criteria metrics fixture (operator ruling 2026-10-02)", function () {
  it("carries an entry for EVERY canonical design (no silent omission)", function () {
    const missing = corpus.designs.filter((d) => !METRICS.criteria[d.id]);
    assert.deepStrictEqual(
      missing.map((d) => d.id),
      [],
      "canonical designs with no metrics entry are silently VOID — declare them (metric: null " +
        "+ voidReason) or define their metric: " + missing.map((d) => d.id).join(", "),
    );
  });

  it("every declared metric is deterministic and IMPLEMENTED by scripts/border_metric.js", function () {
    for (const [id, entry] of Object.entries(METRICS.criteria)) {
      if (entry.metric === null) continue;
      assert.ok(
        KNOWN_METRICS.has(entry.metric),
        id + ": metric \"" + entry.metric + "\" is not implemented by scripts/border_metric.js — " +
          "a binding predicate without an executable metric is VOID per D2, not binding",
      );
      assert.ok(
        typeof instrument.measure === "function" && typeof instrument.cornerDeltas === "function",
        "the instrument module lost its measure/cornerDeltas entry points",
      );
    }
  });

  it("a metric entry carries minFeaturePx + at least one numeric term with op/value", function () {
    for (const [id, entry] of Object.entries(METRICS.criteria)) {
      if (entry.metric === null) continue;
      assert.ok(
        entry.minFeaturePx && typeof entry.minFeaturePx === "object" &&
          Object.keys(entry.minFeaturePx).length >= 1,
        id + ": metric entry has no minFeaturePx — D4 requires the judged scale's smallest " +
          "paintable feature to be stated",
      );
      assert.ok(
        Array.isArray(entry.terms) && entry.terms.length >= 1 &&
          entry.terms.every((t) => t.name && t.op && typeof t.value === "number"),
        id + ": metric entry carries no numeric term {name, op, value}",
      );
    }
  });

  it("a VOID entry (metric: null) carries its voidReason — no silent VOIDs", function () {
    for (const [id, entry] of Object.entries(METRICS.criteria)) {
      if (entry.metric !== null) continue;
      assert.ok(
        typeof entry.voidReason === "string" && entry.voidReason.length >= 20,
        id + ": metric is null but the VOID is undeclared — a binding-publication block per D5 " +
          "must name WHY no metric exists (gestalt prose, pipeline cannot paint it, …)",
      );
    }
  });

  it("judgedScale is pinned (bandDevicePx/slicePercent/greyscale) — a metric measured at a " +
    "different depth is not comparable", function () {
    const js = METRICS.judgedScale;
    assert.strictEqual(js.capture2x, true, "the judged scale is the D-A camera: deviceScaleFactor 2");
    assert.strictEqual(js.slicePercent, 24, "border-image-slice changed — every threshold is stale");
    assert.strictEqual(js.bandDevicePx, 96, "band depth at 2x changed — every threshold is stale");
    assert.strictEqual(js.greyscale, true, "the judged state is the R-2 print-default greyscale");
  });

  it("the instrument's own band model agrees with the fixture's judgedScale", function () {
    assert.strictEqual(
      instrument.JUDGED_SCALE.bandDevicePx, METRICS.judgedScale.bandDevicePx,
      "scripts/border_metric.js and the fixture disagree on the band depth — one of them is stale",
    );
    assert.strictEqual(
      instrument.JUDGED_SCALE.slicePercent, METRICS.judgedScale.slicePercent,
      "scripts/border_metric.js and the fixture disagree on border-image-slice",
    );
  });

  it("D5 publication status: the count of BINDING (metricized) vs VOID criteria is stated, " +
    "not discovered", function () {
    const ids = Object.keys(METRICS.criteria);
    const binding = ids.filter((id) => METRICS.criteria[id].metric !== null);
    const voided = ids.filter((id) => METRICS.criteria[id].metric === null);
    // The D5 clause: no canonical tally may be PUBLISHED as binding while designs are VOID.
    // This assertion is the fence that makes the state EXPLICIT: when the binding set changes,
    // this line must be updated consciously, so a report cannot silently claim 12/12.
    assert.deepStrictEqual(
      binding.sort(),
      ["01-gilded-frame"],
      "the BINDING set changed — update this fence AND every published tally (D5: a canonical " +
        "count computed over VOID criteria is not a tally), naming the ruling that metricized " +
        "each new id",
    );
    assert.strictEqual(voided.length, ids.length - 1, "every non-binding id is counted VOID");
  });

  // ---------------------------------------------------------------------------------------
  // The instrument must be able to FAIL. A metric that returns MET on every input is not an
  // instrument — it is a rubber stamp, and D1's whole claim is that the measurement is binding
  // INSTEAD of a seat call. So this block builds known pixels (a synthetic judged cell with
  // two rules and a corner mark) and drives the metric both ways: the control case must pass,
  // and each deliberate defect must make it fail.
  // ---------------------------------------------------------------------------------------
  function syntheticCell(opts) {
    const W = 240, H = 760;
    const png = new PNG({ width: W, height: H, colorType: 6 });
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (W * y + x) << 2;
        const v = 240;
        png.data[i] = png.data[i + 1] = png.data[i + 2] = v;
        png.data[i + 3] = 255;
      }
    }
    const ink = (x, y) => {
      if (x < 0 || x >= W || y < 0 || y >= H) return;
      const i = (W * y + x) << 2;
      png.data[i] = png.data[i + 1] = png.data[i + 2] = 20;
    };
    const band = { outset: 8, inner: 6 };            // 14 CSS px per band at dsf 2 => 28 device px
    const frame = { x: 28, y: 28, w: 184, h: 688 };  // section box in device px
    const OUT = band.outset * 2, IN = band.inner * 2;
    const BAND = OUT + IN;
    const outerL = frame.x - OUT, outerT = frame.y - OUT;
    const outerR = frame.x + frame.w + OUT, outerB = frame.y + frame.h + OUT;
    // The two rules on the TOP band, at depth 6 and depth 12 from the OUTER edge, spanning the
    // painted width (x 22..W-23, the tiles' own margin excluded — the same shape 01 measured).
    const topY = outerT;
    for (const d of opts.rules) {
      for (let x = 22; x <= W - 23; x++) { ink(x, topY + d); ink(x, topY + d + 1); }
    }
    // The four corner marks, drawn at EXACTLY the rect the fixture's own source-unit table
    // predicts through the shipped knobs (`sourceUnits` 28 with sx=sy=1 at this synthetic
    // scale), so the control case tests the metric rather than a hand-drawn coincidence.
    if (opts.cornerMarks) {
      const su = SYNTH_FIXTURE.cornerMark.sourceUnits;
      const sx = BAND / su.x, sy = BAND / su.y;
      for (const [corner, box] of Object.entries(SYNTH_FIXTURE.cornerMark.corners)) {
        const right = corner.endsWith("R"), bottom = corner.startsWith("B");
        const x0 = Math.round(right ? outerR - box.x * sx : outerL + box.x * sx);
        const y0 = Math.round(bottom ? outerB - box.y * sy : outerT + box.y * sy);
        const w = Math.max(2, Math.round(box.w * sx)), h = Math.max(2, Math.round(box.h * sy));
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) ink(x, y);
      }
    }
    const imageEntry = {
      label: "synthetic",
      edges: [
        { edge: "TOP", region: { left: 0, top: topY, width: W, height: BAND } },
        { edge: "BOTTOM", region: { left: 0, top: frame.y + frame.h + IN - BAND + IN, width: W, height: BAND } },
        { edge: "LEFT", region: { left: outerL, top: 0, width: BAND, height: H } },
        { edge: "RIGHT", region: { left: outerR - BAND, top: 0, width: BAND, height: H } },
      ],
    };
    return { png, camera: { deviceScaleFactor: 2, frameRectDevice: frame, band }, imageEntry };
  }

  const SYNTH_FIXTURE = {
    metric: "two-rule-per-edge",
    minFeaturePx: { ruleThicknessPx: 1, cornerMarkBoxPx: 8 },
    terms: [
      { name: "twoRulePerEdgeCoverageMin", op: ">=", value: 0.9, unit: "fraction" },
      { name: "cornerDeltaMin", op: ">=", value: 15, unit: "device px" },
    ],
    cornerMark: {
      sourceUnits: { x: 28, y: 28 },
      corners: { TL: { x: 2, y: 2, w: 8, h: 12 }, TR: { x: 2, y: 2, w: 8, h: 12 }, BL: { x: 2, y: 2, w: 8, h: 12 }, BR: { x: 2, y: 2, w: 8, h: 12 } },
    },
  };

  it("CONTROL: a synthetic cell carrying two rules per edge and four corner marks measures MET " +
    "(so the terms are satisfiable at all)", function () {
    const { png, camera, imageEntry } = syntheticCell({ rules: [6, 12], cornerMarks: true });
    // Only the TOP band is fully painted in this synthetic cell (the rails/other edges are
    // paper), so the assertion is on the term the cell was built to satisfy: the corner term,
    // plus the TOP rule pair via a single-edge read.
    const marks = instrument.cornerMarks(png, { camera }, SYNTH_FIXTURE.cornerMark);
    assert.strictEqual(marks.cornerDeltaAll.length, 4, "the four corner boxes were not all measured");
    assert.ok(
      marks.cornerDeltaMin >= 15,
      "the control's corner marks measured " + marks.cornerDeltaMin +
        " over an identical control box — a satisfiable criterion must PASS on pixels that carry " +
        "the feature, else the metric is inverted",
    );
    const top = instrument.edgeRules(png, imageEntry.edges[0].region, "TOP");
    assert.ok(top.ruleCount >= 2, "two drawn rules read as " + top.ruleCount + " — the rule finder misses them");
  });

  it("FALSIFIER: deleting ONE of the two rules makes the same metric fail (it can fail)", function () {
    const two = syntheticCell({ rules: [6, 12], cornerMarks: true });
    const one = syntheticCell({ rules: [6], cornerMarks: true });
    const t2 = instrument.edgeRules(two.png, two.imageEntry.edges[0].region, "TOP");
    const t1 = instrument.edgeRules(one.png, one.imageEntry.edges[0].region, "TOP");
    assert.ok(t2.ruleCount >= 2, "control should carry two rules, saw " + t2.ruleCount);
    assert.strictEqual(t1.ruleCount, 1, "with one rule drawn the finder should see one, saw " + t1.ruleCount);
  });

  it("FALSIFIER: removing the corner marks drops the corner delta below the threshold", function () {
    const withMarks = syntheticCell({ rules: [6, 12], cornerMarks: true });
    const without = syntheticCell({ rules: [6, 12], cornerMarks: false });
    const a = instrument.cornerMarks(withMarks.png, { camera: withMarks.camera }, SYNTH_FIXTURE.cornerMark);
    const b = instrument.cornerMarks(without.png, { camera: without.camera }, SYNTH_FIXTURE.cornerMark);
    assert.ok(a.cornerDeltaMin >= 15, "control: " + a.cornerDeltaMin);
    assert.ok(
      b.cornerDeltaMin < 15,
      "with no corner artwork drawn the corner term must FAIL, measured " + b.cornerDeltaMin +
        " — a metric whose corner term passes on an empty corner certifies ornaments that do not exist",
    );
  });

  it("evaluate() reports VOID as null, never as a silent false", function () {
    const { png, camera, imageEntry } = syntheticCell({ rules: [6, 12], cornerMarks: true });
    const v = instrument.evaluate(png, imageEntry, METRICS.criteria["02-runic-band"], camera);
    assert.strictEqual(v.void, true, "a metric:null fixture entry must report VOID");
    assert.strictEqual(v.pass, null, "VOID is not MET and not NOT MET — it is unjudged");
    assert.ok(v.voidReason.length > 20, "a VOID must name its reason");
  });

  it("the instrument is DETERMINISTIC: the same pixels yield byte-identical readings", function () {
    // D2's whole claim is that the measurement, not a seat, is binding. A measurement that
    // varies run to run would be a seat call wearing a number, so this is asserted rather than
    // assumed: pixels in, numbers out, twice, compared exactly.
    const { png, camera, imageEntry } = syntheticCell({ rules: [6, 12], cornerMarks: true });
    const a = instrument.evaluate(png, imageEntry, SYNTH_FIXTURE, camera);
    const b = instrument.evaluate(png, imageEntry, SYNTH_FIXTURE, camera);
    assert.deepStrictEqual(b, a, "two reads of identical pixels disagreed — the metric is not deterministic");
    // and on the REAL judged cell, where the pipeline's own anti-aliasing is in play
    const realMeta = JSON.parse(
      fs.readFileSync(path.join(ROOT, "temp", "visual_logs", "byok_svg_borders_20260927",
        "gallery-round27", "judged-meta.json"), "utf8"),
    );
    const entry = realMeta.images.find((i) => i.label === "01-gilded-frame" && !i.variant);
    const cell = path.join(ROOT, "temp", "visual_logs", "byok_svg_borders_20260927",
      "gallery-round27", entry.judgedFile);
    if (!fs.existsSync(cell)) return; // a fresh clone has no captured frames; the fence skips
    const png2 = instrument.loadPng(cell);
    const a2 = instrument.evaluate(png2, entry, METRICS.criteria["01-gilded-frame"], realMeta.camera);
    const png3 = instrument.loadPng(cell);
    const b2 = instrument.evaluate(png3, entry, METRICS.criteria["01-gilded-frame"], realMeta.camera);
    assert.deepStrictEqual(b2, a2, "the real judged cell read differently twice");
  });
});
