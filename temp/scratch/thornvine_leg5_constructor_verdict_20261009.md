# Thornevine leg 5 — constructor verdict + Fix A/B/C decision record (2026-10-09)

Status: COMPLETE (diagnostic leg; no corpus byte changed)

## What was done

1. **Leg-5 instruction drafted** (`temp/scratch/tv_leg5_instruction.txt`, 3975 chars,
   product-path via `buildMessages`): ONE-stroke architecture first sentence, sprout counts
   second, shape grammar + never-L rails + tool-call-wrap ban. All 33 binding numbers preserved.
2. **Muse iter-16/17/18 consultations** (transcripts under `temp/scratch/thornvine_muse_iter16/17/18_*`):
   - iter-16: challenged false claims (0/41 chord >= 8; "no recipe headroom") with measurements;
     conceded both.
   - iter-17: delta = shape-grammar disclosure + never-L rails; produced the campaign's biggest
     gate movement (G3+G4+G5+G6 firsts in sampling).
   - iter-18: ROOT-RULE falsification resolved (zero effect on unrooted counts); ranked
     Fix A > Fix B > Fix C; predicted G4/G7/G9 precision-class, EV < 5%.
3. **Sampling rounds 42-48** (56 samples, all product-path): quota completed honestly
   (0/20 at >= 7/10, best 1/10, 14/20 degenerate stubs at max_tokens 12000). iter-18 recipe
   (grammar + never-L, max_tokens 6000) tested in rounds 45-48: accepted blobs moved G3/G6
   but never exceeded 2/10.
4. **Constructor diagnostic** (`temp/scratch/tv_construct_tile.py`, v3->v10): a deterministic
   03-thornvine tile built by transcribing the gate's own measurement windows. Reached
   **6/10 gates by construction** (G1, G3, G4, G5, G6, G7) with clean geometry; still fails
   G2, G8, G9, G10.

## Decisive measurement: the 10-gate conjunction is over-constrained

- The gate's G2 projection metric (`loopProj`, four piecewise branches) is **degenerate**:
  a 2671-sample walk of the constructor ring shows **724/2671 (27%) mismatches** between
  `nearestEdge` and the projection branch (right->left, bottom->left, mostly near corners),
  and **3 discontinuities > 40 units per 0.5-unit arc step**, worst **880.3 units at
  arc 1317.5** (BL corner). A sprout root 0.5 arc from another root can project 880 units
  away, so G2's projection-gap band [20,60] cannot be satisfied around any corner that G1
  forces the ring to bow inward. Probe: `temp/scratch/tv_g2_metric_probe.js`.
- The **accepted corpus reference itself fails 9/10 gates** (G2 along-vine gaps: 62/64 outside
  [20,60]; perEdgeSprouts not enumerated). The gate encodes an aspirational standard its own
  reference does not meet.
- Arithmetic on the wave-inflated ring (arc ~1331 units, per-edge arc ~290/340) shows the
  G2+G9 conjunction is *feasible in arc units* (min 8 gaps * 20 = 160 < 290), so the blocker
  is NOT the 20-60 band on arc gaps — it is the degenerate projection metric and the
  G8/G10 thresholds.

## Verdict on Fix A / B / C

- **Fix A (hand-frozen deterministic tile) is FALSIFIED as a 10/10 route.** The constructor
  proves 6/10 is reachable by clean geometry, but G2's discontinuous projection metric makes
  the remaining gates unreachable by placement. Muse iter-18's G4/G7/G9 prediction is
  corroborated and extended: G2's projection branch is the decisive over-constraint.
- **Fix B (change seat) is irrelevant**: the failing gates are deterministic geometry checks,
  not seat capability.
- **Fix C (re-anchor the gate) is the only path to 10/10**: re-define G2's projection metric
  (arc-length gaps only, or repair `loopProj` to be continuous) and check G8/G10 thresholds
  against the accepted reference. Until then, 10/10 is unreachable by arithmetic, not by effort.

## Artifacts

- Constructor + probe: `temp/scratch/tv_construct_tile.py`, `temp/scratch/tv_g2_metric_probe.js`
- Verdict record: `temp/scratch/tv_constructor_verdict_20261009.md`
- Muse transcripts: `temp/scratch/thornvine_muse_iter16/17/18_{brief,answer}.md`
- Instruction: `temp/scratch/tv_leg5_instruction.txt` (3975 chars, product-path)
- Sampling: `temp/scratch/tv_leg2_20261009/{leg2-round42..48}.json|.log`

No tracked byte changed; the corpus is untouched (freeze --check OK).
