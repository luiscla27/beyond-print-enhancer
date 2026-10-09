// tv_g8_ref_probe.js — dump ALL corner-window pivots (crest/trough depths + arc offsets)
// for a given SVG under G8's exact logic (both datums), so G8 recalibration is anchored
// to the accepted reference's real corner geometry, not guessed.
"use strict";
const fs = require("fs");

const TOL = 0.5;
const CREST = [1.5, 8], TROUGH = [24, 30.5], SWING = [16, 29], HALF = 42.5, CORNER_WIN = 30;
const CORNERS = { TL: [0, 0], TR: [224, 0], BR: [224, 256], BL: [0, 256] };

function nearestEdge(x, y) {
  const d = { top: y, bottom: 256 - y, left: x, right: 224 - x };
  return Object.entries(d).sort((a, b) => a[1] - b[1])[0][0];
}
const EDGES = {
  top:    { proj: (p) => p.x,        depth: (p) => p.y },
  right:  { proj: (p) => p.y,        depth: (p) => 224 - p.x },
  bottom: { proj: (p) => 224 - p.x,  depth: (p) => 256 - p.y },
  left:   { proj: (p) => 256 - p.y,  depth: (p) => p.x },
};
function pivots(profile) {
  // slope-sign pivots with a 0.25 flat tolerance, mirroring the gate
  const out = [];
  let dir = 0;
  for (let i = 1; i < profile.length; i++) {
    const dv = profile[i].v - profile[i - 1].v;
    const nd = dv > 0.25 ? 1 : dv < -0.25 ? -1 : dir;
    if (dir !== 0 && nd !== dir && nd !== 0) out.push({ kind: dir < 0 ? "min" : "max", ...profile[i - 1] });
    if (nd !== 0) dir = nd;
  }
  return out;
}

function loadPts(file) {
  const svg = fs.readFileSync(file, "utf8");
  const paths = [...svg.matchAll(/<path[^>]*stroke[^>]*d="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  const tokens = paths[0].match(/[MLCZzQqSsAaHhVv]|-?\d+(?:\.\d+)?/g);
  const pts = [];
  let i = 0, cur = null;
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const C = tokens[i++].toUpperCase();
    if (C === "M") { cur = { x: num(), y: num() }; pts.push({ ...cur }); }
    else if (C === "C") {
      const c1 = { x: num(), y: num() }, c2 = { x: num(), y: num() }, p = { x: num(), y: num() };
      for (let s = 1; s <= 24; s++) {
        const t = s / 24, u = 1 - t;
        pts.push({ x: u*u*u*cur.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*p.x,
                   y: u*u*u*cur.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*p.y });
      }
      cur = p;
    } else if (C === "L") { cur = { x: num(), y: num() }; pts.push({ ...cur }); }
  }
  return pts;
}

const file = process.argv[2] || "temp/scratch/tv_canonical.svg";
const pts = loadPts(file);
const S = [];
let carry = 0;
for (let i = 1; i < pts.length; i++) {
  const a = pts[i - 1], b = pts[i];
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (!L) continue;
  let t = carry;
  while (t < L) { S.push({ x: a.x + (b.x - a.x) * (t / L), y: a.y + (b.y - a.y) * (t / L), s: S.length * 0.5 }); t += 0.5; }
  carry = t - L;
}
for (const [ck, [eA, eB]] of Object.entries({ TL: ["top", "left"], TR: ["top", "right"], BR: ["bottom", "right"], BL: ["bottom", "left"] })) {
  const [cx, cy] = CORNERS[ck];
  const win = S.filter((p) => Math.abs(p.x - cx) <= CORNER_WIN && Math.abs(p.y - cy) <= CORNER_WIN);
  const ordered = [...win].sort((a, b) => a.s - b.s);
  let midIdx = 0, bestD = Infinity;
  ordered.forEach((p, i) => { const d = Math.hypot(p.x - cx, p.y - cy); if (d < bestD) { bestD = d; midIdx = i; } });
  console.log("== " + ck + " (n=" + ordered.length + ", corner-closest idx " + midIdx + ") ==");
  for (const datum of [eA, eB]) {
    const E = EDGES[datum];
    const profile = ordered.map((p) => ({ v: E.depth(p), i: ordered.indexOf(p) }));
    const pv = pivots(profile);
    const exts = pv.map((p) => ({ kind: p.kind, depth: Math.round(p.v * 10) / 10, sOff: Math.round((ordered[p.i].s - ordered[0].s) * 10) / 10, side: p.i < midIdx ? "before" : "after" }));
    console.log("  datum " + datum + ": " + JSON.stringify(exts));
  }
}
