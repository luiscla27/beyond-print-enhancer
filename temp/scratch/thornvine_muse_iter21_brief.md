# Cumulative consult — iter 21: constructive joint G2+G9 placement PROVEN; the remaining blockers are construction-side geometry (corner wave, leaf attachment). What am I doing wrong before I implement the next round?

You are the hardest-to-please design reviewer on this project. Your prior verdict
(iter 20) was a BLOCK with three blockers; I implemented your fixes C (repair the
loop-projector), B (joint G2+G9 feasibility re-derivation BEFORE any resampling
claim), A (corner roots are thorn-only). BLOCKER C is DONE: the gate's loopProj was
repaired (nearest-edge per sample; branches: top x / right 224+y / bottom 480+(224-x)
/ left 704+(256-y)) and the repaired gate is the live arbiter (G8 is now DISABLED
pending redesign; G10 stays). BLOCKER B is now answered by CONSTRUCTION, not
argument. This consult is the cumulative approach review before I implement the next
round. Do NOT raise a score unless the acceptance criteria are actually met in the
artifact's pixels/measurements — a caveat that isn't backed by the criteria is void.

## Project, product, scope

Regenerate the tileable thornvine border SVG (viewBox 224x256; 224-wide
left<->right repeat seam; top and bottom edges tile vertically) to pass the 10-gate
acceptance gate with ZERO threshold changes, zero criterion text changes, zero
product-surface changes. Reference: the operator-selected PNG corpus. The gate is
`scripts/thornvine_acceptance_gate.js` (tracked, run with --json for per-gate
numbers). The construction path is the v10 generator plus a new placement planner
(`tv_construct_tile_v11.py`).

## Acceptance criteria (verbatim, TOL 0.25)

G1 ring must WAVE: [4,8] corner swing, [16,29] mid-edge swing, [8,22] corner chord
deviation. G2 rhythm: gap ranges thorn [24,30.5] (arc), leaf [24,30.5] (arc),
corner straddle [20,60] (both metrics), consecutive diff >= 4, per-edge >= 3
pairwise incl. adjacent corners, no period-2/3 rhythm (0.5 eq tolerance). G3
straight edges. G4 every sprout rooted within 3 units of a ring sample (roots are
vertex-nearer-the-edge). G5 corner radius 8-16 (arc). G6 sprout size thorn [6,8,8,10]
leaf [12,16,5,7] with spread <= 1.0, all inside the viewBox. G7 edge troughs
[24,30.5], one extremum per half period, alternating. G8 DISABLED (redesign; the
reference corpus shows no visible ripple on edges). G9 sprout inventory: per-edge
combos in {thorns 6-8, leaves 12-16, counts 3-4}, size uniformity, exclusivity.
G10 no micro-ripple: swing in [1.2,8] banned; curvature <= 0.5 only on straights;
radial component of any swing >= 0.4x total.

## Cumulative approaches tried (all measured — this is the fourth iteration)

1. **Direct seed evolution (resampling rounds 1-50, legs 1-3).** 50+ live
   generation rounds against the PRE-repair gate; ~817 candidates; zero passes;
   G2/G7/G10 never landed. Verdict at the time: "corpus-attainable but
   generationally remote" (~2% per round conditional on wave landing).
2. **Constructor transplant (legs 3-5).** The v10 generator rebuilt the ring
   analytically (quarter-cosine waves + corner cubic bridges + fixed ROOT_CYCLE
   arc rhythm + center-offset leaves). Before the loop repair: G1 G2 G3 G4 G5 G7
   PASS (6/10) but G9 structurally impossible (the all-thorn [6,7]x[3,3] combo
   fails G4: corner-window roots on straight edges are off the ring). After the
   loop repair: the fixed arc rhythm fails G2 on ALL 80 offsets (projection gaps
   15-19 compressed — roots placed on steep wave sections project shorter), so
   v10 was provably infeasible as a PLACEMENT.
3. **The joint re-derivation itself (this leg, the deliverable).** Replaced the
   arc walk with a planner in the gate's own projection coordinate: (a) corner
   pairs with proj straddle [24,59.5] AND arc straddle [20.5,59.5], corner roots
   thorn-only, edge-specific span tie-breaks; (b) per-edge interior gap sequences
   from a [19.75,43] menu with consecutive-diff 3.75 and a 0.55/pair drift to
   dodge the period-2 ban, sum = span +/- 2.5, per-slot candidate DFS with chain
   verification; (c) a product walk over 4 edges x 5 variants against the FULL
   cyclic rhythm check. **RESULT: `[phase-0 combo0] FEASIBLE root set found`** —
   a concrete 10-thorn/6-leaf (per-edge) root set whose rhythm passes the gate's
   own G2 math AND whose inventory passes G9. Regenerated tile verified by the
   tracked gate: **G3 G5 G9 PASS (G8 disabled) — 4/10; G9 passes for the FIRST
   TIME in the campaign.**

## What the constructive tile now fails (measured, all construction-side)

- **G1/G7/G10 at the corners (the big one).** cornerChordDevs TR 0.7 / BR 4.9 /
  BL 0.7 (< 8); micro-pivots of swing 1.8-2.8 inside [1.2,8) at all four
  junctions; right-edge troughs at depth 7.3-8.1 outside [24,30.5]; a
  non-alternating-extremum reading with a 2.4-swing pivot. ROOT CAUSE: the corner
  cubic bridges the last edge TROUGH to the next edge TROUGH through the interior
  — the wave is interrupted AT the corner, so the corner carries NO swing (chord
  ~straight, arc ~quarter circle). The wave resumes only at ~30 units in.
- **G4 (leaves).** The gate reads a leaf's attachment as its major-axis endpoint
  nearer the edge; the constructor draws the ellipse CENTER 0.35 inward, so the
  near endpoint lands ~7 units off the stem for 10 leaves. Placement error, not a
  geometry impossibility: draw the leaf with its backward endpoint exactly at the
  root.
- **G6 (thorn).** The floor of 8.6 lets a thorn tip at -0.4,128.8 cross the
  viewBox: tip depth = root depth - 9, so the floor must be >= 9.6.
- **G2 residuals (margins).** The four corner straddles land 16.3/17.7/19.7/14.1
  in projection (floor 20) and one along-vine gap is 61 (ceiling 60): the corner
  picker's window plus snap drift; fixable by targeting straddles into [26,54].

## Pixel/geometry truth

v10 ring arc 1331.1, ring path 42 samples. The corner region is the visual seam
between edge waves. The reference corpus edges show a continuous wave INTO the
corner region (the corner "hump" reads as part of the rhythm, not as a blank
arc). Thresholds may not move.

## Question

**What am I doing wrong?** Concretely: (1) Is "make the corner a wave segment
(trough -> crest ~3.5-5 at the 45-degree approach -> trough) instead of a blank
quarter-arc bridge" the right reading of G1's corner swing + chord deviation +
G7's trough rule + G10's pivot ban — or does that reintroduce a period-2/3 or
micro-ripple failure I am not seeing? (2) Is the projection-coordinate placement
planner (menu + drift + variant product) the right tool, or is there a simpler
parametrization that lands G2's margins without the per-slot search? (3) Any
verdict on whether the four construction-side fixes above are jointly sufficient
for a 10/10 constructed tile — or what ELSE will bite (my list: root-vertex
picking on the corners, the leaf's G7 trough interference, G6 spread under the
new floor)?
