# Leg-5 Constructor Verdict: the 10-gate conjunction is arithmetically over-constrained
# (scratch analysis backing the Fix A falsification; supersedes the earlier v9 flat-unit
# arithmetic, which used FLAT edge lengths and was WRONG — the gate measures ARC gaps on
# the wave-inflated ring, and the wave's arc inflation makes the G2+G9 conjunction
# *feasible* on paper. The real blocker is the G2 PROJECTION metric, measured below.)

## 1. What the constructor reached (deterministic tile, `tv_construct_tile.py` v3->v10)

Bare rail probe (one closed wave ring, no sprouts), gate result:
- **PASSES G1, G3, G4, G5, G6, G7** — six gates by construction.
- Mid-edge chord dev 20.0/20.0/20.0/20.0 (G1 floor 8); corner chord dev TL 21.6, others 10.9.
- G7 extrema tiling exact: alternating crest 7.2 / trough 27.2, half-period 24.5-28.5 (band 22.5-42.5), 10 extrema per edge.
- Still fails: G8 (corner crest/trough straddle pair), G10 (371 flat 8-unit windows — the wave
  has exact inflection points where an 8-unit chord window reads sagitta 0), G2/G9 (sprout
  placement; not applicable to the bare probe).

Wave ring with 38 sprouts placed at gate-arc gaps 27.7-44.2 (all in 20-60, all diffs >= 5.3):
- Per-edge counts land on enumerated combos (top 9, right 10, bottom 9, left 10).
- Kind feasibility per edge: thorn-ok 8/9/8/9, leaf-ok 7/8/6/6 — enough for (6,3)/(7,3).
- **G2 projection metric FAILS**, see below.

## 2. The G2 projection metric is degenerate (measured, `tv_g2_metric_probe.js`)

The gate's `loopProj` (copied verbatim into the probe) maps a point to a 0..960 coordinate by
FOUR piecewise branches. Run over the constructor ring's 2671 arc-resampled samples:

- nearestEdge-vs-loopProj-branch **mismatches: 724 / 2671 (27%)** — classes right->left (110),
  bottom->left (614). The piecewise branches disagree with the gate's own `nearestEdge`
  naming over 27% of the ring, mostly near corners where the wave dips inward past the
  diagonal.
- **Projection discontinuities > 40 units over one 0.5-unit arc step: 3** — worst 880.3 units
  at arc 1317.5 (the BL corner region). A root sitting 0.5 arc from another root can project
  880 units away, so G2's projection-gap 20-60 check cannot be satisfied around corners
  regardless of placement: the metric is not a continuous loop coordinate there.

Consequence: **G2's projection-gap band [20,60] is unsatisfiable near any corner where the
ring passes inside the corner diagonal** (which G1's corner chord-dev >= 8 forces the ring to
do). A sprout root exactly ON the corner diagonal is even worse: all four branches can reject
it and loopProj falls through to the last branch (left), jumping ~672+ units.

## 3. The accepted corpus reference does NOT pass the gate either (measured)

`test/fixtures/byok_border_corpus.json` design `03-thornvine` (the ACCEPTED blob) scored:
- gate pass: False, failing G1, G2, G3, G4, G5, G7, G8, G9, G10 (9 of 10 fail; G6 passes).
- G2 along-vine gaps: 62 of 64 outside [20,60]; worst gaps 832, 832, 44, 44.
- perEdgeSprouts: top (9,4), right (15,4), bottom (9,4), left (15,4) — not enumerated combos.

So the gate encodes an aspirational standard that its own reference design does not meet.

## 4. Verdict

- **Fix A (hand-frozen deterministic tile) is FALSIFIED as a 10/10 route**: the constructor
  reaches 6/10 (G1, G3, G4, G5, G6, G7) with clean geometry, but G2's projection metric is
  degenerate near corners (measured discontinuity 880.3, 27% branch mismatch) and G8/G10
  remain open. No amount of sprout placement fixes a discontinuous metric.
- **Fix B (change seat) is irrelevant**: the failing gates are deterministic geometry checks,
  not seat capability.
- **Fix C (re-anchor the gate) is the only path to 10/10**: the gate's G2 projection metric
  must be redefined (e.g. use arc-length gaps only, or repair loopProj to be continuous), and
  G8/G10 thresholds checked against the accepted reference. Until then, 10/10 is unreachable
  by arithmetic, not by effort.

Muse iter-18's prediction (G4/G7/G9 precision-class, EV < 5%) is corroborated and extended:
G2's projection branch is the decisive over-constraint, and the constructor proves it.
