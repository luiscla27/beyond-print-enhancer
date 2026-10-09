// tv_g2_metric_probe.js — scratch probe: is G2's projection metric consistent with nearestEdge?
//
// Reads the gate's own loopProj / nearestEdge definitions (copied verbatim) and, for the
// CONSTRUCTOR ring (or any SVG), walks the ring in 0.5-arc steps printing, per corner
// neighbourhood, (edge by nearestEdge) vs (projection branch by loopProj) so a collapse or
// discontinuity in the G2 projection metric is MEASURED rather than asserted.
"use strict";
const fs = require("fs");

function nearestEdge(x, y) {
  const d = { top: y, bottom: 256 - y, left: x, right: 224 - x };
  return Object.entries(d).sort((a, b) => a[1] - b[1])[0][0];
}
function loopProj(p) {
  // OPTION (a) measurement mode (muse iter-20): branch by nearestEdge (the gate's own
  // naming), not diagonal quadrants; constants corrected to a true 0..960 perimeter
  // (right ends 480, bottom 480+(224-x) ends 704, left 704+(256-y) ends 960).
  const e = nearestEdge(p.x, p.y);
  if (e === "top") return p.x;
  if (e === "right") return 224 + p.y;
  if (e === "bottom") return 480 + (224 - p.x);
  return 704 + (256 - p.y);
}
function projBranch(p) {
  if (p.y < p.x && p.x < 224 - p.y) return "top";
  if (p.x >= p.y && 224 - p.x < 256 - p.y) return "right";
  if (p.y >= p.x && 256 - p.y <= p.x) return "bottom"; // REPAIRED leg-5 (mirrors gate fix)
  return "left";
}

// flattened ring points, parsed from the constructor's output if present, else the corpus
function loadPts() {
  const f = process.argv[2] || "temp/scratch/tv_constructed_tile.svg";
  const svg = fs.readFileSync(f, "utf8");
  const m = svg.match(/<path[^>]*stroke[^>]*d="([^"]+)"/);
  const d = m[1];
  const tokens = d.match(/[MLCZzQqSsAaHhVv]|-?\d+(?:\.\d+)?/g);
  const pts = [];
  let i = 0, cur = null;
  const num = () => parseFloat(tokens[i++]);
  const isNum = (t) => t && /^-?\d/.test(t);
  while (i < tokens.length) {
    const C = tokens[i++].toUpperCase();
    if (C === "M") { cur = { x: num(), y: num() }; pts.push({ ...cur }); }
    else if (C === "C") {
      const c1 = { x: num(), y: num() }, c2 = { x: num(), y: num() }, p = { x: num(), y: num() };
      for (let s = 1; s <= 16; s++) {
        const t = s / 16, u = 1 - t;
        pts.push({ x: u*u*u*cur.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*p.x,
                   y: u*u*u*cur.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*p.y });
      }
      cur = p;
    }
  }
  return pts;
}

const pts = loadPts();
// arc resample 0.5 like the gate
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
let mism = 0;
let jumps = 0;
let worst = null;
let prev = null;
for (const p of S) {
  const e = nearestEdge(p.x, p.y);
  const b = projBranch(p);
  if (e !== b) mism++;
  const pr = loopProj(p);
  if (prev !== null) {
    const d = Math.abs(pr - prev);
    if (d > 40) { jumps++; if (!worst || d > worst.d) worst = { d: Math.round(d * 10) / 10, at: Math.round(p.s * 10) / 10, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }; }
  }
  prev = pr;
}
console.log("ring samples:", S.length, "arc:", (S.length * 0.5).toFixed(1));
console.log("nearestEdge vs loopProj branch mismatches:", mism, "/", S.length);
console.log("projection discontinuities >40 over one 0.5-step:", jumps, "worst:", JSON.stringify(worst));
// per-edge summary of mismatches
const byEdge = {};
for (const p of S) {
  const e = nearestEdge(p.x, p.y);
  const b = projBranch(p);
  if (e !== b) byEdge[e + "->" + b] = (byEdge[e + "->" + b] || 0) + 1;
}
console.log("mismatch classes:", JSON.stringify(byEdge));
const verdict = mism > 0 && jumps > 0;
console.log("VERDICT: G2 projection metric is " + (verdict ? "DEGENERATE (collapses/discontinuous near corners)" : "consistent"));
