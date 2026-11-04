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

const KNOWN_METRICS = new Set(["two-rule-per-edge", "per-edge-band"]);

describe("D4 formulation gate — the criteria metrics fixture (operator ruling 2026-10-02)", function () {
  it("carries an entry for EVERY canonical design, and no entry for an id that is not canonical " +
    "(no silent omission, no orphan metric)", function () {
    const missing = corpus.designs.filter((d) => !METRICS.criteria[d.id]);
    assert.deepStrictEqual(
      missing.map((d) => d.id),
      [],
      "canonical designs with no metrics entry are silently VOID — declare them (metric: null " +
        "+ voidReason) or define their metric: " + missing.map((d) => d.id).join(", "),
    );
    // The other direction: an entry whose id is no longer canonical (D3 retired 05) must still be
    // DECLARED as a retirement on the entry itself, so a reader can tell "this design was retired"
    // from "this id was mistyped".
    const orphans = Object.keys(METRICS.criteria)
      .filter((id) => !corpus.designs.some((d) => d.id === id));
    for (const id of orphans) {
      const e = METRICS.criteria[id];
      assert.ok(
        e.metric === null && /RETIRED/.test(e.voidReason || "") && e.retired,
        id + ": an entry for a non-canonical id must be a declared RETIREMENT (metric null + " +
          "retired block), not a stale row",
      );
    }
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
      if (entry.metric === "per-edge-band") {
        assert.ok(
          typeof instrument.measureBand === "function" && typeof instrument.evaluateBand === "function",
          id + ": the per-edge-band metric requires the instrument's D3 entry points (measureBand/evaluateBand)",
        );
      }
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
    // D3 (operator ruling 2026-10-05): 04/11 become binding under the per-edge-band metric; 05
    // became binding PROVISIONALLY for its regeneration, FAILED the metric on the regenerated
    // artwork, and was RETIRED (absent from the canonical set), so it is VOID again — by the
    // ruling's own branch, not by omission. 01 remains binding under the D1 two-rule metric.
    assert.deepStrictEqual(
      binding.sort(),
      ["01-gilded-frame", "04-dragon-scale", "11-starlit-void"],
      "the BINDING set changed — update this fence AND every published tally (D5: a canonical " +
        "count computed over VOID criteria is not a tally), naming the ruling that metricized " +
        "each new id (and any retirement that removed one)",
    );
    assert.strictEqual(voided.length, ids.length - 3, "every non-binding id is counted VOID");
    // The retired id is present in the fixture as a VOID whose voidReason is a RETIREMENT, never as
    // a silent omission and never as a metricized row a tally could count.
    assert.strictEqual(
      METRICS.criteria["05-celestial-arcs"].metric, null,
      "the D3-retired design must not carry a binding metric",
    );
    assert.ok(
      /RETIRED/.test(METRICS.criteria["05-celestial-arcs"].voidReason),
      "05's VOID must name the retirement, not merely the absence of a metric",
    );
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

  // ---------------------------------------------------------------------------------------
  // D3 (operator ruling 2026-10-05) — the per-edge-band metric. Same discipline as the D1
  // block above: the metric must be able to FAIL on synthetic pixels, and the REAL round-27
  // cells are the reference verdicts the ruling was measured on (04/11 MET, 05 NOT MET with
  // its regeneration branch pending — the branch retires 05, it does not amend the terms).
  // ---------------------------------------------------------------------------------------
  function d3Frame(depth) {
    // A synthetic judged frame with all four edge bands painted to `depth` device px inside
    // each band, leaving the 16px border-image tile margins unpainted (the real cells' shape).
    // 408 wide so the 16px margins are ~3.9% per side — the real cells' proportion (16/1408);
    // at 200 the margins would be 16% and coverage would read 0.84, a synthetic-geometry
    // artifact, not a metric fact.
    const W = 408, H = 408, B = 16;
    const png = new PNG({ width: W, height: H, colorType: 6 });
    for (let p = 0; p < png.data.length; p += 4) {
      png.data[p] = png.data[p + 1] = png.data[p + 2] = 240;
      png.data[p + 3] = 255;
    }
    const ink = (x, y) => {
      const i = (W * y + x) << 2;
      png.data[i] = png.data[i + 1] = png.data[i + 2] = 20;
    };
    for (let x = B; x < W - B; x++) {
      for (let d = 0; d < depth; d++) { ink(x, d); ink(x, H - 1 - d); }
    }
    for (let y = B; y < H - B; y++) {
      for (let d = 0; d < depth; d++) { ink(d, y); ink(W - 1 - d, y); }
    }
    const imageEntry = {
      label: "synthetic-d3",
      edges: [
        { edge: "TOP", region: { left: 0, top: 0, width: W, height: B } },
        { edge: "BOTTOM", region: { left: 0, top: H - B, width: W, height: B } },
        { edge: "LEFT", region: { left: 0, top: 0, width: B, height: H } },
        { edge: "RIGHT", region: { left: W - B, top: 0, width: B, height: H } },
      ],
    };
    return { png, imageEntry };
  }
  // Unpaint the TOP band's x span [a..b] on a d3Frame (reset to paper), leaving every other
  // edge intact — the interior-gap falsifier's carver.
  function carve(png, a, b) {
    const W = png.width;
    for (let x = a; x <= b; x++) {
      for (let y = 0; y < 16; y++) {
        const i = (W * y + x) << 2;
        png.data[i] = png.data[i + 1] = png.data[i + 2] = 240;
      }
    }
  }
  const D3_TERMS = [
    { name: "perEdgePaintedCoverageMin", op: ">=", value: 0.9, unit: "fraction" },
    { name: "maxInteriorGapPx", op: "<=", value: 8, unit: "device px" },
    { name: "railStrokeP50Px", op: ">=", value: 3, unit: "device px" },
    { name: "stileStrokeP50Px", op: ">=", value: 1.5, unit: "device px" },
  ];
  const d3Fixture = { metric: "per-edge-band", minFeaturePx: { paintedSpanPx: 1, interiorGapPx: 1, strokeP50Px: 1 }, terms: D3_TERMS };
  // 05's own fifth term (the clause's "solid arc stroke >= 8 device px"), as ruled and
  // implemented: the min over the four edges of the per-edge depth-run median of painted
  // strokes. Its synthetic CONTROL lives in the d3Frame below (a 6px band would fail it,
  // which is why the term is only stated on 05's entry, whose artwork carries 8px+ arcs).
  const d3SolidFixture = {
    metric: "per-edge-band",
    minFeaturePx: { paintedSpanPx: 1, interiorGapPx: 1, strokeP50Px: 1, solidStrokeP50Px: 8 },
    terms: [...D3_TERMS, { name: "solidStrokeP50PxMin", op: ">=", value: 8, unit: "device px" }],
  };

  it("per-edge-band CONTROL (synthetic): a full band on all four edges measures MET", function () {
    const full = d3Frame(6);
    const v = instrument.evaluateBand(full.png, full.imageEntry, d3Fixture);
    assert.strictEqual(v.pass, true, "a full painted band must pass its own terms: " +
      JSON.stringify(v.terms.map((t) => [t.name, t.reading, t.pass])));
  });

  it("per-edge-band FALSIFIER (synthetic): a hairline band (depth 1) fails the rail minimum", function () {
    const thin = d3Frame(1);
    const v = instrument.evaluateBand(thin.png, thin.imageEntry, d3Fixture);
    const rail = v.terms.find((t) => t.name === "railStrokeP50Px");
    assert.strictEqual(rail.reading, 1, "a 1px band's stroke p50 was misread as " + rail.reading);
    assert.strictEqual(rail.pass, false, "a 1px band must FAIL the rails >= 3 minimum");
    const stile = v.terms.find((t) => t.name === "stileStrokeP50Px");
    assert.strictEqual(stile.pass, false, "a 1px band must FAIL the stiles >= 1.5 minimum");
  });

  it("per-edge-band FALSIFIER (synthetic): an interior gap of 9 fails, exactly 8 passes (the clause's <=)", function () {
    // Reuse the synthetic frame but unpaint a 9px (then 8px) interior window on the TOP band
    // only, by carving it out of a fresh frame with a gap: paint [0..90] + [100..199] on TOP.
    const g9 = d3Frame(6);
    carve(g9.png, 91, 99);
    const v9 = instrument.evaluateBand(g9.png, g9.imageEntry, d3Fixture);
    const gap9 = v9.terms.find((t) => t.name === "maxInteriorGapPx");
    assert.strictEqual(gap9.reading, 9, "the 9px interior gap was misread as " + gap9.reading);
    assert.strictEqual(gap9.pass, false, "a 9px interior gap must FAIL the <= 8 term");
    const g8 = d3Frame(6);
    carve(g8.png, 92, 99);
    const v8 = instrument.evaluateBand(g8.png, g8.imageEntry, d3Fixture);
    const gap8 = v8.terms.find((t) => t.name === "maxInteriorGapPx");
    assert.strictEqual(gap8.reading, 8, "the 8px interior gap was misread as " + gap8.reading);
    assert.strictEqual(gap8.pass, true, "exactly 8 SATISFIES <= 8 (the clause's own threshold case)");
  });

  it("per-edge-band solidStrokeP50PxMin (05's clause): a 6px band fails the >= 8 minimum, and " +
    "the blank-edge contract keeps its UNRESOLVED shape", function () {
    // The falsifier the clause's threshold needs: a texture whose coverage/rail/stile terms
    // all pass but whose stroke p50 sits under 8 must FAIL on 05's term and PASS without it.
    const six = d3Frame(6);
    const v6 = instrument.evaluateBand(six.png, six.imageEntry, d3SolidFixture);
    const solid = v6.terms.find((t) => t.name === "solidStrokeP50PxMin");
    assert.strictEqual(solid.reading, 6, "a 6px band's solid-stroke p50 was misread as " + solid.reading);
    assert.strictEqual(solid.pass, false, "a 6px stroke must FAIL 05's >= 8 solid minimum");
    assert.strictEqual(v6.pass, false, "binding = every stated term passes");
    // Same pixels, terms without the fifth: NOT MET vs MET — the term is what decides.
    const v6without = instrument.evaluateBand(six.png, six.imageEntry, d3Fixture);
    assert.strictEqual(v6without.pass, true, "without 05's term the same pixels pass — the term is 05's own");
    // A fully blank cell: no edge carries ink, so the solid p50 has nothing to read —
    // null (UNRESOLVED), never a vacuous numeric 0.
    const blank = d3Frame(0);
    const vb = instrument.evaluateBand(blank.png, blank.imageEntry, d3SolidFixture);
    const solidBlank = vb.terms.find((t) => t.name === "solidStrokeP50PxMin");
    assert.strictEqual(solidBlank.reading, null, "a blank cell's solid p50 must read null (no ink to measure)");
    assert.strictEqual(solidBlank.pass, null, "null reading is UNRESOLVED, never a silent false");
  });

  it("per-edge-band FALSIFIER (synthetic): the span-end tile margins are NOT interior gaps", function () {
    // The synthetic frame leaves the 16px tile margins unpainted on every edge, exactly the
    // shape every real cell measures: the interior-gap term must read 0, not 16.
    const margined = d3Frame(6);
    const v = instrument.evaluateBand(margined.png, margined.imageEntry, d3Fixture);
    const gap = v.terms.find((t) => t.name === "maxInteriorGapPx");
    assert.strictEqual(gap.reading, 0, "the border-image tile margins were counted as an interior gap: " + gap.reading);
  });

  it("per-edge-band FALSIFIER (synthetic): an unpainted edge fails coverage and stroke minima", function () {
    const blank = d3Frame(0);
    const v = instrument.evaluateBand(blank.png, blank.imageEntry, d3Fixture);
    assert.strictEqual(v.pass, false, "a blank band must fail");
    assert.ok(v.terms.every((t) => t.pass === false || (t.name === "maxInteriorGapPx" && t.pass === true)),
      "on a blank band the coverage/stroke terms must fail (gap 0 vacuously passes): " +
      JSON.stringify(v.terms.map((t) => [t.name, t.reading, t.pass])));
  });

  it("D3 reference verdicts on the REAL cells: 04 MET and 11 MET (round 27), and the RETIRED 05 reads " +
    "VOID on the round-27 cell instead of a verdict", function () {
    // The ruling's measured basis. A fresh clone has no captured frames and skips; where the
    // frames exist this fence pins the verdicts so the terms cannot drift without the record.
    // 05 is NOT in the expectVerdict set any more: D3 retired it on 2026-10-05 after its one
    // permitted regeneration FAILED the metric, so its fixture entry carries no binding metric and
    // `evaluateBand` reports VOID (pass null) — a VOID, never a silent NOT MET.
    const realMeta = JSON.parse(
      fs.readFileSync(path.join(ROOT, "temp", "visual_logs", "byok_svg_borders_20260927",
        "gallery-round27", "judged-meta.json"), "utf8"),
    );
    const expectVerdict = { "04-dragon-scale": true, "11-starlit-void": true };
    for (const [id, want] of Object.entries(expectVerdict)) {
      const entry = realMeta.images.find((i) => i.label === id && !i.variant);
      const cell = path.join(ROOT, "temp", "visual_logs", "byok_svg_borders_20260927",
        "gallery-round27", entry.judgedFile);
      if (!fs.existsSync(cell)) return; // skip, as the determinism fence above does
      const png = instrument.loadPng(cell);
      const v = instrument.evaluateBand(png, entry, METRICS.criteria[id]);
      assert.strictEqual(v.pass, want,
        id + ": the D3 binding verdict on the round-27 cell is " + v.pass +
        " — the ruling was measured on these pixels (" +
        JSON.stringify(v.terms.map((t) => [t.name, t.reading, t.pass])) + "); a drift here means " +
        (want ? "the cell or the terms changed" : "the regenerated artwork landed and the branch must be dispositioned, not the terms amended"));
    }
    // The retired id: VOID on the same cell, and VOID on the round-28 cell where the D3 generation
    // was judged. The five terms stay on the entry as the RECORD of what decided the retirement, so
    // this assertion also proves the retained terms still measure the artwork they were read on.
    const retired = METRICS.criteria["05-celestial-arcs"];
    assert.strictEqual(retired.metric, null, "the retired design carries a binding metric");
    assert.strictEqual(retired.terms.length, 5, "the five terms the verdict was read with are gone");
    for (const [roundDir, label] of [["gallery-round27", "05-celestial-arcs"],
      ["gallery-round28", "05-celestial-arcs"]]) {
      const meta = JSON.parse(
        fs.readFileSync(path.join(ROOT, "temp", "visual_logs", "byok_svg_borders_20260927",
          roundDir, "judged-meta.json"), "utf8"),
      );
      const entry = meta.images.find((i) => i.label === label && !i.variant);
      const cell = path.join(ROOT, "temp", "visual_logs", "byok_svg_borders_20260927",
        roundDir, entry.judgedFile);
      if (!fs.existsSync(cell)) continue;
      const png = instrument.loadPng(cell);
      const v = instrument.evaluateBand(png, entry, retired);
      assert.strictEqual(v.void, true, roundDir + ": a retired design must read VOID, not a verdict");
      assert.strictEqual(v.pass, null, roundDir + ": VOID is null, never a silent false");
      // And the retained terms, read with the clause's own thresholds, still FAIL the artwork they
      // were measured on — the retirement's premise, re-measured by the instrument itself.
      const m = instrument.measureBand(png, entry);
      assert.ok(
        m.perEdgePaintedCoverageMin < 0.85 || m.maxInteriorGapPx > 8,
        roundDir + ": the retired artwork now PASSES its own clause (" +
          JSON.stringify({ cov: m.perEdgePaintedCoverageMin, gap: m.maxInteriorGapPx }) +
          ") — the retirement premise no longer holds and the ruling must be revisited",
      );
    }
  });
});
