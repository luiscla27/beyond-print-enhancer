#!/usr/bin/env node
/**
 * D1 (operator ruling 2026-10-02) — the deterministic pixel metric for criterion
 * OVERRIDES. This is the instrument that makes a re-cut criterion *binding without a seat
 * call*, per decision D2's doctrine: for predicates over shape / continuity / coverage /
 * gap / closure the binding verdict is a measurement on the judged PNG; the vision seat is
 * corroborating only and its dissent is not a NOT MET.
 *
 * WHY IT LIVES HERE (read before moving it). D2's clause says a claim outside the metric is
 * "a gate challenge requiring a NEW METRIC DEFINITION", so the metric is not a script of the
 * moment: it is part of the criterion contract. Turning the operator's ruling sentences into
 * numbers in a versioned module - beside `freeze_border_corpus.js`, whose gate reads it - is
 * what makes D1 enforceable by the corpus gate instead of by a human reading a screenshot.
 *
 * WHAT IT MEASURES, and the honest limits of each term:
 *   coverage   - fraction of a rule line's span that carries ink. For D1's "two rules per
 *                edge at >=90%": measured as a LINE-EXISTENCE projection, i.e. for each row
 *                (TOP/BOTTOM) or column (LEFT/RIGHT) of the band window, is >=50% of that
 *                line's span inked? The metric counts how many such lines exist per edge and
 *                the coverage of the best pair. LIMIT, stated so nobody over-reads it: this
 *                is a 1-D projection, so it cannot prove a rule is CURVED - it proves a
 *                full-span line exists at that depth. Continuity of a curved rule is the
 *                `coverage` of the rule's own footprint, not of a single row.
 *   gap        - the longest run of ink-free pixels measured ALONG the rule's own footprint
 *                (per rule, via the mask of lines contributing to it). This is what makes
 *                "unbroken" checkable instead of eyeballed.
 *   cornerDelta- ink inside a corner box minus ink in an identical-size control box on the
 *                same two rails at mid-edge. The control is a CONTROL, not a threshold on
 *                ink: it is what makes "+41 px over control" a statement about the corner
 *                rather than about the rails being thick (measured on 01: the corner boxes
 *                are BUSIER than the control, so the earlier `>=15 px` phrasing would have
 *                been satisfiable by noise - see `phase4_round28_d1_metric.md`).
 *   thickness  - mean run length of inked pixels perpendicular to the rule at sample points.
 *
 * The band depth model is the product's own: a 200 x N CSS section captured at 2x, source SVG
 * 200x200, `border-image-slice: 24%` -> 48 source px -> 96 device px per side, of which the
 * FIRST 16 device px sit OUTSIDE the section box (the cell's own marker gutter). Depth 0..31
 * is therefore outside, 32..127 inside. `judgedScale` (D4) pins the band height so a metric
 * cannot be measured on a crop of a different depth and still be compared.
 *
 * No network, no model, no rendering: pixels in, numbers out, so the same PNG yields the same
 * numbers on any machine.
 */
"use strict";

const fs = require("fs");
const { PNG } = require("pngjs");

/** The judged band geometry D4 pins (device px @2x, greyscale). */
const JUDGED_SCALE = Object.freeze({
  capture2x: true,
  sectionCssWidth: 200,
  slicePercent: 24,
  sourceUnits: 200,
  // 24% of 200 source units = 48 source px = 96 device px per side at 2x.
  bandDevicePx: 96,
  // The judged cell draws a 16 device px marker gutter OUTSIDE the section box.
  outsideDevicePx: 16,
});

const DEFAULTS = Object.freeze({
  /** Luma below this is ink. Chosen from the measured band: blank paper is ~232-236. */
  inkLumaMax: 205,
  /** A row/column counts as a RULE LINE when at least this fraction of its span is inked. */
  lineCoverageMin: 0.5,
  /** Two rule lines are the same rule when their depth gap is within this many device px. */
  ruleJoinPx: 2,
  /** A rule with no line at some depth is one whose footprint is interpolated; see report. */
  maxRuleSamples: 8,
});

function loadPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

/** Luma of a pixel, 0..255. RGB only - a greyscale PNG is normalized by pngjs. */
function luma(png, x, y) {
  const i = (png.width * y + x) << 2;
  const d = png.data;
  return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
}

/**
 * The rules on ONE edge, and their coverage/gap/thickness.
 *
 * `edge` is "TOP" | "BOTTOM" | "LEFT" | "RIGHT"; `region` is the band window inside the judged
 * cell, exactly as `judged-meta.json` records it, so the metric and the seat read the same
 * pixels. Depth 0 = the outer edge of the band window.
 */
function edgeRules(png, region, edge, opts) {
  const o = { ...DEFAULTS, ...(opts || {}) };
  const horizontal = edge === "TOP" || edge === "BOTTOM";
  // For LEFT/RIGHT the band is the rail: the rule runs vertically, so the "line" axis is the
  // depth axis (x) and the span axis is y. Normalize so `depthCount` is always the number of
  // line positions and `span` is the run along the rule.
  const depthCount = horizontal ? region.height : region.width;
  const span = horizontal ? region.width : region.height;

  // inked[line][t] along the span.
  const lines = [];
  for (let line = 0; line < depthCount; line++) {
    const row = new Uint8Array(span);
    for (let t = 0; t < span; t++) {
      const x = horizontal ? region.left + t : region.left + line;
      const y = horizontal ? region.top + line : region.top + t;
      row[t] = luma(png, x, y) <= o.inkLumaMax ? 1 : 0;
    }
    lines.push(row);
  }

  // LINE EXISTENCE: a depth counts as a rule line when >= lineCoverageMin of its span is ink.
  const lineMask = lines.map((row) => {
    let ink = 0;
    for (const v of row) ink += v;
    return ink / span >= o.lineCoverageMin;
  });
  const lineScores = lines.map((row) => {
    let ink = 0;
    for (const v of row) ink += v;
    return ink / span;
  });

  // GROUP contiguous rule lines into RULES: a rule spans a depth interval whose lines are
  // rule lines, allowing a 1-px hole (anti-aliasing) but never a gap wider than ruleJoinPx.
  const rules = [];
  let cur = null;
  for (let d = 0; d < depthCount; d++) {
    if (lineMask[d]) {
      if (cur && d - cur.last <= o.ruleJoinPx) {
        cur.last = d;
        cur.lines.push(d);
      } else {
        if (cur) rules.push(cur);
        cur = { first: d, last: d, lines: [d] };
      }
    }
  }
  if (cur) rules.push(cur);

  // For each rule: coverage along its own footprint, longest ink-free gap, mean thickness.
  for (const r of rules) {
    const covered = new Uint8Array(span);
    for (let d = r.first; d <= r.last; d++) {
      const row = lines[d];
      for (let t = 0; t < span; t++) covered[t] |= row[t];
    }
    let ink = 0;
    for (const v of covered) ink += v;
    r.coverage = ink / span;
    // Longest ink-free run along the rule (edge-padded runs count: a rule that exits the band
    // has no ink there, which is exactly the mid-edge break the criterion forbids).
    let longest = 0;
    let run = 0;
    for (let t = 0; t < span; t++) {
      if (covered[t]) run = 0;
      else longest = Math.max(longest, ++run);
    }
    r.maxGapPx = longest;
    // Thickness: for each span sample, count inked pixels across the rule's depth band.
    let samples = 0;
    let total = 0;
    const step = Math.max(1, Math.floor(span / 64));
    for (let t = 0; t < span; t += step) {
      let count = 0;
      for (let d = r.first; d <= r.last; d++) if (lines[d][t]) count++;
      total += count;
      samples++;
    }
    r.meanThicknessPx = samples ? total / samples : 0;
    r.depthFirst = r.first;
    r.depthLast = r.last;
    r.lineCoverage = Math.max(...r.lines.map((d) => lineScores[d]));
  }
  return {
    edge,
    span,
    depthCount,
    rules,
    // The strongest pair: the two rules with the greatest depth separation whose lines are
    // both full-span. This is what "two concentric rules" means numerically.
    ruleCount: rules.length,
  };
}

/** Ink count (luma <= threshold) inside a box. */
function inkInBox(png, box, inkLumaMax) {
  const max = inkLumaMax === undefined ? DEFAULTS.inkLumaMax : inkLumaMax;
  let ink = 0;
  for (let y = box.top; y < box.top + box.height; y++) {
    for (let x = box.left; x < box.left + box.width; x++) {
      if (luma(png, x, y) <= max) ink++;
    }
  }
  return ink;
}

/**
 * The D1 metric on one judged cell.
 *
 * `meta` is one entry of `judged-meta.json`'s `images[]` (it carries `edges[]` with `region`,
 * and the corner boxes under `corners[]` when present); `baseline` is another design's meta
 * entry used as the CONTROL for the corner term (the rubric forbids comparing against a
 * threshold alone - see the module header).
 */
function measure(PNG_, meta, opts) {
  const o = { ...DEFAULTS, ...(opts || {}) };
  const png = PNG_;
  const edges = {};
  for (const e of meta.edges) {
    edges[e.edge] = edgeRules(png, e.region, e.edge, o);
  }
  // The two-rules-per-edge term: the BEST pair on each edge, so a design with three rules is
  // not penalised, and the term is the MINIMUM over the four edges (a rule missing on one edge
  // is not compensated by a thick edge elsewhere).
  const perEdge = {};
  for (const [edge, r] of Object.entries(edges)) {
    const sorted = [...r.rules].sort((a, b) => a.depthFirst - b.depthFirst);
    let best = null;
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const sep = sorted[j].depthFirst - sorted[i].depthLast;
        const cov = Math.min(sorted[i].coverage, sorted[j].coverage);
        const gap = Math.max(sorted[i].maxGapPx, sorted[j].maxGapPx);
        if (!best || cov > best.pairCoverage) {
          best = { a: sorted[i], b: sorted[j], separationPx: sep, pairCoverage: cov, maxGapPx: gap };
        }
      }
    }
    perEdge[edge] = {
      ruleCount: r.rules.length,
      pairCoverage: best ? best.pairCoverage : 0,
      maxGapPx: best ? best.maxGapPx : r.span,
      separationPx: best ? best.separationPx : 0,
      ruleCoverages: sorted.map((x) => Number(x.coverage.toFixed(4))),
      depths: sorted.map((x) => [x.depthFirst, x.depthLast]),
      meanThicknessPx: sorted.map((x) => Number(x.meanThicknessPx.toFixed(2))),
    };
  }
  const result = {
    id: meta.label,
    sha256: meta.sha256 || null,
    file: meta.judgedFile || null,
    judgedScale: JUDGED_SCALE,
    perEdge,
  };
  result.twoRulePerEdgeCoverageMin = Math.min(
    ...Object.values(perEdge).map((e) => e.pairCoverage),
  );
  result.maxGapPx = Math.max(...Object.values(perEdge).map((e) => e.maxGapPx));
  return result;
}

/**
 * The corner term, measured against a CONTROL: the same-size box on the same two rails at
 * mid-edge. A corner "mark" exists only if the corner box carries strictly more ink than the
 * control - otherwise the reading is about rail thickness, not about an ornament.
 *
 * `boxes` is `[{name, corner, control}]` in the judged cell's coordinates.
 */
function cornerDeltas(png, boxes, opts) {
  const o = { ...DEFAULTS, ...(opts || {}) };
  return boxes.map((b) => ({
    corner: b.corner,
    box: b.box,
    control: b.control,
    boxInk: inkInBox(png, b.box, o.inkLumaMax),
    controlInk: inkInBox(png, b.control, o.inkLumaMax),
    deltaInk: inkInBox(png, b.box, o.inkLumaMax) - inkInBox(png, b.control, o.inkLumaMax),
    boxPx: b.box.width * b.box.height,
    controlPx: b.control.width * b.control.height,
  }));
}

/**
 * The corner-mark term (D1's second clause), measured against a CONTROL.
 *
 * A corner "mark" exists only if the corner box carries strictly more ink than an
 * identical-size box on the SAME two rails at mid-edge. Two things are load-bearing here and
 * both are deliberate:
 *   - the box comes from the artwork's OWN declared coordinates (`mark.sourceUnits`) mapped
 *     through the SHIPPED border-image knobs, so a mark cannot be claimed into existence by
 *     looking harder, and a mark that the pipeline does not actually paint cannot be claimed
 *     by geometry alone;
 *   - the comparison is to a CONTROL, not to a threshold. MEASURED, 2026-10-02: with a bare
 *     absolute threshold the earlier `>= 15 px` phrasing was satisfiable by rail thickness
 *     alone - on round-27's cells the corner boxes of a design with NO corner artwork at all
 *     (03-thornvine) carry 200-340 inked px, so ">= 15 px of ink" would have certified an
 *     ornament that does not exist. The delta over an equal-area control on the same rails is
 *     the term that actually separates the two cases.
 *
 * `mark` = { corners: {TL,TR,BL,BR} of source-unit boxes, sourceUnits, translation } - the
 * declared geometry that the D4 formulation gate requires a criterion to carry.
 */
function cornerMarks(png, meta, mark, opts) {
  const o = { ...DEFAULTS, ...(opts || {}) };
  const cam = meta.camera || {};
  const fr = cam.frameRectDevice;
  const band = cam.band || {};
  const dsf = cam.deviceScaleFactor || 2;
  const OUT = (band.outset || 0) * dsf;
  const IN = (band.inner || 0) * dsf;
  const BAND = OUT + IN;
  // The band's INNER edge is the section's own edge; the OUTER edge is BAND beyond it. The
  // corner tile occupies the whole band SQUARE at each corner, and its outer corner is the
  // anchor the source units are measured FROM (see `su`): every source-unit box is mapped with
  // 0 at the tile's OUTER edge, growing inward — that is the only anchor that makes the same
  // `corners` table correct for all four tiles, because the tile is mirrored per corner.
  const outerL = fr.x - OUT;
  const outerT = fr.y - OUT;
  const outerR = fr.x + fr.w + OUT;
  const outerB = fr.y + fr.h + OUT;
  // Source units per device px, as the shipped knobs produce them (the same mapping the
  // corner proof used: 61.44 x 69.12 source units per side for a 200x286 CSS section).
  const su = mark && mark.sourceUnits ? mark.sourceUnits : { x: 61.44, y: 69.12 };
  const sx = BAND / su.x;
  const sy = BAND / su.y;
  const out = [];
  for (const corner of ["TL", "TR", "BL", "BR"]) {
    const box = (mark.corners || {})[corner];
    if (!box) continue;
    const right = corner.endsWith("R");
    const bottom = corner.startsWith("B");
    const x = Math.round(right ? outerR - box.x * sx : outerL + box.x * sx);
    const y = Math.round(bottom ? outerB - box.y * sy : outerT + box.y * sy);
    const w = Math.max(2, Math.round(box.w * sx));
    const h = Math.max(2, Math.round(box.h * sy));
    const rect = { left: x, top: y, width: w, height: h };
    // Control: the SAME box size on the SAME rails, moved to mid-edge - far enough that the
    // corner ornament is not in frame. For TOP/BOTTOM the control slides along x to the
    // section's middle; for LEFT/RIGHT the box is already at mid-height, so the control
    // mirrors across the band centre to the opposite rail's mid-edge.
    const cx = right ? x - 400 : x + 400;
    const cy = bottom ? y - 400 : y + 400;
    const control = { left: Math.max(0, Math.min(cx, png.width - w)), top: Math.max(0, Math.min(cy, png.height - h)), width: w, height: h };
    out.push({
      corner,
      box: rect,
      control,
      boxInk: inkInBox(png, rect, o.inkLumaMax),
      controlInk: inkInBox(png, control, o.inkLumaMax),
      deltaInk: inkInBox(png, rect, o.inkLumaMax) - inkInBox(png, control, o.inkLumaMax),
      boxPx: w * h,
    });
  }
  const deltas = out.map((c) => c.deltaInk);
  return {
    marks: out,
    cornerDeltaMin: deltas.length ? Math.min(...deltas) : 0,
    cornerDeltaAll: deltas,
  };
}

/**
 * The D1 binding verdict for ONE design on ONE judged cell — the executable form of the
 * operator ruling D1 (2026-10-02): "the BINDING verdict is the deterministic pixel metric on
 * the judged PNG; the seat is corroborating only."
 *
 * `imageEntry` is one entry of `judged-meta.json`'s `images[]`; `fixtureEntry` is that design's
 * entry in `test/fixtures/byok_border_criteria_metrics.json`; `camera` is the meta root's
 * `camera` (the judged geometry — pass it explicitly because a per-image entry does not carry
 * it; MEASURED DEFECT, FIXED 2026-10-02: `cornerMarks` read `meta.camera`, which is undefined
 * on an images[] entry, so the corner term silently could not run from the documented input).
 *
 * Returns `{ metric, terms: [{name, op, value, reading, pass}], pass, readings }`. A design
 * whose fixture entry is `metric: null` is VOID and this returns `pass: null` with VOID named —
 * never a silent false, because per D2 a VOID criterion is not a NOT MET.
 */
function evaluate(png, imageEntry, fixtureEntry, camera, opts) {
  const o = { ...DEFAULTS, ...(opts || {}) };
  if (!fixtureEntry || fixtureEntry.metric === null) {
    return {
      metric: null,
      terms: [],
      pass: null,
      void: true,
      voidReason: (fixtureEntry && fixtureEntry.voidReason) || "no fixture entry",
      readings: {},
    };
  }
  const meas = measure(png, imageEntry, o);
  const readings = { twoRulePerEdgeCoverageMin: meas.twoRulePerEdgeCoverageMin };
  if (fixtureEntry.cornerMark) {
    const marks = cornerMarks(png, { camera, label: imageEntry.label }, fixtureEntry.cornerMark, o);
    readings.cornerDeltaMin = marks.cornerDeltaMin;
    readings.cornerDeltaAll = marks.cornerDeltaAll;
  }
  const terms = (fixtureEntry.terms || []).map((t) => {
    const reading = readings[t.name];
    const cmp = { ">=": (a, b) => a >= b, ">": (a, b) => a > b, "<=": (a, b) => a <= b, "<": (a, b) => a < b }[t.op];
    if (!cmp || reading === undefined) {
      return { ...t, reading: reading === undefined ? null : reading, pass: null };
    }
    return { ...t, reading, pass: cmp(reading, t.value) };
  });
  return {
    metric: fixtureEntry.metric,
    terms,
    // Binding = EVERY stated term passes. A term that could not be read makes the verdict
    // UNRESOLVED (null), not a pass: an unmeasured term is exactly what D4 exists to prevent.
    pass: terms.length > 0 && terms.every((t) => t.pass === true)
      ? true
      : terms.some((t) => t.pass === null) ? null : false,
    void: false,
    readings,
  };
}

/**
 * D3 IMPLEMENTATION (operator ruling 2026-10-05) — the two new terms the D3 clause
 * needs and the D1 two-rule terms above do not express: a single-rule design reads
 * `pairCoverage` 0 BY CONSTRUCTION (it is the best PAIR over rules), which is exactly
 * why 04/11/05 read 0.0000 under the D1 term on pixels that carry a full band
 * (`phase4_d3_measurements_20261004.md` §6 — same pixels, opposite verdicts).
 *
 * The clause (converged §5 wording, ruled 2026-10-05):
 *   `[SUPERSEDED] AC-V1-c is superseded ONLY for 04-dragon-scale, 11-starlit-void and
 *   05-celestial-arcs; for all other canonical designs AC-V1-c remains as written. For
 *   those three, per-edge coverage >= 90% (05 >= 85%), max interior-edge gap <= 8 device
 *   px, rail/stile minima stated separately, assumeSquareSourceUnits: false, and no
 *   four-edge continuity required; 05 additionally requires a solid arc stroke >= 8
 *   device px. 05 is regenerated once via --border-img, then judged by the binding
 *   metric; if the metric fails, 05 is retired (canonical: false). Product
 *   border-image-repeat: round is UNCHANGED.`
 *
 * The terms, as measured (the filed probe implementations are the reference):
 *   paintedCoverage    - fraction of the edge's SPAN with >= 1 ink px at ANY band depth
 *                        (ink = luma <= inkLumaMax). NOT the two-rule pairCoverage.
 *   maxInteriorGapPx   - longest UNPAINTED span run EXCLUDING runs that touch a span
 *                        end: every edge carries the border-image tile margins at
 *                        [0..15] and [span-16..span-1], which are the pipeline's own,
 *                        not artwork — the clause's word "interior" excludes them.
 *   strokeP50Px        - median ink-run length ALONG the band DEPTH axis over the
 *                        span (the rail/stile minima, stated separately per the
 *                        ruling: rails >= 3 device px, stiles >= 1.5 device px).
 *   solidStrokeP50Px   - 05's own clause ("a solid arc stroke >= 8 device px"), the
 *                        D3-drafted solid-stroke minFeaturePx example the rail/stile
 *                        minima deliberately do not carry: the MIN over the four edges
 *                        of the median ink-run length of the runs that are PAINTED
 *                        strokes (the same depthRunMedianPx instrument, restricted to
 *                        each edge's own strokes), so a dashed/fragmented texture
 *                        (round-6 05: p50 4/4/8/5) fails even where a rail minimum
 *                        would pass. Stated ONLY on 05's entry (a 04/11 entry carrying
 *                        it would need its own operator ruling).
 */

/** Per-span ink profile of one edge band (which span positions carry ink, how deep). */
function bandProfile(png, region, edge, inkLumaMax) {
  const horizontal = edge === "TOP" || edge === "BOTTOM";
  const depthCount = horizontal ? region.height : region.width;
  const span = horizontal ? region.width : region.height;
  const paintedAt = new Array(span).fill(false);
  const depthAt = new Array(span).fill(0);
  for (let d = 0; d < depthCount; d++) {
    for (let t = 0; t < span; t++) {
      const x = horizontal ? region.left + t : region.left + d;
      const y = horizontal ? region.top + d : region.top + t;
      if (luma(png, x, y) <= inkLumaMax) {
        paintedAt[t] = true;
        depthAt[t]++;
      }
    }
  }
  return { span, paintedAt, depthAt };
}

/** Ink-free span runs; runs touching a span end are flagged `interior: false`. */
function unpaintedRuns(paintedAt) {
  const span = paintedAt.length;
  const runs = [];
  let run = 0;
  for (let t = 0; t < span; t++) {
    if (!paintedAt[t]) run++;
    else {
      if (run) runs.push({ start: t - run, end: t - 1, len: run });
      run = 0;
    }
  }
  if (run) runs.push({ start: span - run, end: span - 1, len: run });
  if (runs.length) {
    runs[0].interior = runs[0].start > 0;
    runs[runs.length - 1].interior = runs[runs.length - 1].end < span - 1;
    for (let i = 1; i < runs.length - 1; i++) runs[i].interior = true;
  }
  return runs;
}

/** Median of numbers; 0 for an empty list (an unpainted edge has no strokes). */
function median(vals) {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * The D3 band terms for ONE edge of a judged cell: paintedCoverage,
 * maxInteriorGapPx and strokeP50Px (plus the run counts, for the record).
 */
function edgeBandTerms(png, region, edge, inkLumaMax) {
  const o = { ...DEFAULTS, ...(inkLumaMax === undefined ? {} : { inkLumaMax }) };
  const { span, paintedAt, depthAt } = bandProfile(png, region, edge, o.inkLumaMax);
  let painted = 0;
  for (const p of paintedAt) if (p) painted++;
  const interior = unpaintedRuns(paintedAt).filter((r) => r.interior);
  const strokes = depthAt.filter((c) => c > 0);
  return {
    edge,
    span,
    paintedCoverage: span ? painted / span : 0,
    maxInteriorGapPx: interior.reduce((m, r) => Math.max(m, r.len), 0),
    interiorRunCount: interior.length,
    strokeP50Px: median(strokes),
    strokeRuns: strokes.length,
    // The clause's "solid" half: a stroke the pipeline paints, read at its own
    // median run length — the null only fires when the edge carries NO ink at all.
    solidStrokeP50Px: strokes.length ? median(strokes) : null,
  };
}

/**
 * The D3 binding readings on one judged cell (an images[] entry of judged-meta.json):
 * the MIN per-edge painted coverage, the MAX interior gap, and the MIN stroke p50 over
 * rails (TOP/BOTTOM) and over stiles (LEFT/RIGHT) — the clause's "rail/stile minima
 * stated separately" as two separate pooled minima.
 */
function measureBand(png, meta, opts) {
  const o = { ...DEFAULTS, ...(opts || {}) };
  const perEdge = {};
  for (const e of meta.edges) {
    perEdge[e.edge] = edgeBandTerms(png, e.region, e.edge, o.inkLumaMax);
  }
  const pick = (keys) =>
    keys.map((k) => perEdge[k]).filter((v) => v && typeof v.strokeP50Px === "number");
  const solidPick = (keys) =>
    keys.map((k) => perEdge[k]).filter((v) => v && typeof v.solidStrokeP50Px === "number");
  const result = {
    id: meta.label,
    sha256: meta.sha256 || null,
    file: meta.judgedFile || null,
    judgedScale: JUDGED_SCALE,
    perEdge,
    perEdgePaintedCoverageMin: Math.min(...Object.values(perEdge).map((e) => e.paintedCoverage)),
    maxInteriorGapPx: Math.max(...Object.values(perEdge).map((e) => e.maxInteriorGapPx)),
    railStrokeP50Px: Math.min(...pick(["TOP", "BOTTOM"]).map((e) => e.strokeP50Px)),
    stileStrokeP50Px: Math.min(...pick(["LEFT", "RIGHT"]).map((e) => e.strokeP50Px)),
    // 05's own clause ("a solid arc stroke >= 8 device px"): the MIN over all four edges
    // of the per-edge solid-stroke p50 — the exact instrument the term names, pooled the
    // same way the rail/stile minima pool theirs. An edge with no ink contributes no
    // reading, and if NO edge carries ink the term reads null (UNRESOLVED), never a
    // vacuous 0 — the same "missing evidence is not a FAIL" contract as evaluateBand's.
    solidStrokeP50PxMin: solidPick(["TOP", "BOTTOM", "LEFT", "RIGHT"]).length
      ? Math.min(...solidPick(["TOP", "BOTTOM", "LEFT", "RIGHT"]).map((e) => e.solidStrokeP50Px))
      : null,
  };
  // A missing edge reads 0, not undefined: an edge the camera did not take is a FAIL
  // condition of the verdict, never a term that silently disappears. `solidStrokeP50PxMin`
  // is exempt — it stays null (UNRESOLVED) when no edge carries ink, because its FAIL
  // contract is the coverage term's, not a pooled-minimum's.
  for (const k of ["perEdgePaintedCoverageMin", "maxInteriorGapPx", "railStrokeP50Px", "stileStrokeP50Px"]) {
    if (!Number.isFinite(result[k])) result[k] = 0;
  }
  return result;
}

/**
 * The D3 binding verdict for ONE design on ONE judged cell — same contract as
 * `evaluate`: metric null is VOID (pass null, never a silent false), a term that
 * cannot be read is UNRESOLVED (null), binding = EVERY stated term passes. The
 * fixture entries (04/11/05 in `byok_border_criteria_metrics.json`) carry the
 * thresholds; the metric name is "per-edge-band".
 */
function evaluateBand(png, imageEntry, fixtureEntry, opts) {
  const o = { ...DEFAULTS, ...(opts || {}) };
  if (!fixtureEntry || fixtureEntry.metric === null) {
    return {
      metric: null,
      terms: [],
      pass: null,
      void: true,
      voidReason: (fixtureEntry && fixtureEntry.voidReason) || "no fixture entry",
      readings: {},
    };
  }
  const meas = measureBand(png, imageEntry, o);
  const terms = (fixtureEntry.terms || []).map((t) => {
    const reading = meas[t.name];
    const cmp = { ">=": (a, b) => a >= b, ">": (a, b) => a > b, "<=": (a, b) => a <= b, "<": (a, b) => a < b }[t.op];
    // A null reading is UNREADABLE evidence (the term's measure has nothing to read), not a
    // 0: comparing null against a threshold would coerce it to 0 and turn "cannot measure"
    // into a silent FAIL. UNRESOLVED (pass null), never a silent false.
    if (!cmp || reading === undefined || reading === null) {
      return { ...t, reading: reading === undefined || reading === null ? null : reading, pass: null };
    }
    return { ...t, reading, pass: cmp(reading, t.value) };
  });
  return {
    metric: fixtureEntry.metric,
    terms,
    pass: terms.length > 0 && terms.every((t) => t.pass === true)
      ? true
      : terms.some((t) => t.pass === null) ? null : false,
    void: false,
    readings: meas,
  };
}

module.exports = {
  JUDGED_SCALE,
  DEFAULTS,
  loadPng,
  luma,
  edgeRules,
  inkInBox,
  measure,
  cornerDeltas,
  cornerMarks,
  evaluate,
  bandProfile,
  unpaintedRuns,
  median,
  edgeBandTerms,
  measureBand,
  evaluateBand,
};
