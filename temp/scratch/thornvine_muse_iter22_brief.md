# Cumulative consult — iter 22: the G10 CURVATURE half is the real wall (424 flat windows, worst sagitta 0.01); I measured a feasible wave shape (biarcs, R <= 16). Two of your iter-21 claims contradict the gate source — dispositions needed

You are the hardest-to-please design reviewer. Iter-21 verdict was BLOCK with the
atomic fix list (a corner wave, b leaf endpoint, c thorn floor, d straddle targets).
I went to root-cause G10 before implementing and found the residual is TWO rules, and
the one neither of us priced is bigger than the corner issue. Do NOT raise a score
unless the acceptance criteria are actually met in the artifact's pixels/measurements.

## Correction I owe you (my iter-21 brief was wrong, own it)

My iter-21 acceptance list said "G5 corner radius 8-16 (arc)". THE GATE HAS NO
RADIUS CHECK (grep "radius" on scripts/thornvine_acceptance_gate.js: 0 hits).
G5 as promoted (commit a29a0f4, the tracked arbiter) is DIRECTIONS: thorn tip
radial cos >= 0.4 from the tile center, leaf OUTWARD component <= 9, deep-root
leaf not pointing straight inward. Your iter-21 answer priced a "G5 radius [8,16]
is arc radius of the corner path" premise that does not exist in the instrument.
Re-disposition that item: the corner needs NO radius target; it needs G1 chord
dev >= 8 + G10 curvature + G6 band.

## Challenge #1 — your G10 exemption claim contradicts the source

You wrote: "G10 bans swing [1.2,8) ONLY for pivots where radial component <0.4*total
and/or curvature <=0.5 on straights... G1 corner swing [4,8] is exempt iff radial
>=0.4 and curvature >0.5." The gate's micro-ripple check (scripts/...js L886-910)
bans ANY raw pivot with swing in [1.2, 7.75) on each edge's FULL span (mid + corners,
depth <= 45) — unconditionally. RADIAL_COS_MIN lives in G5 (thorn tips, L657), the
sagitta check is a separate G10 sub-rule (flat windows, L911-918). There is no
exemption clause. Your CONCLUSION (a single smooth trough->crest->trough corner
passes) survives for a different reason: a proper wave's swings are >= 16, so no
[1.2,8) pivot exists at all. Confirm or revise.

## New measured finding — G10's CURVATURE half has NEVER passed, and it forbids the sinusoid itself

The v11 constructed tile: **424 of 658 eight-unit windows read straight/flat, worst
sagitta 0.01** (temp/scratch/tv_v11_flat_probe.py, mirrors the gate exactly). Every
window centered on a wave INFLECTION fails: the constructor draws each half-period as
a symmetric S-cubic with horizontal tangents at both extrema, and a symmetric S has
ZERO curvature at its midpoint. A pure sinusoid has the same defect analytically
(curvature = 0 at every inflection). This is why G10 never landed in 50+ resampling
rounds AND fails on the constructor: we were both iterating root placement while the
WAVE SHAPE itself cannot satisfy "every 8-unit stretch shows sagitta >= 0.5".

Feasibility probe (tv_v10_g10_feas_probe.py): the requirement is local radius
R <= 16 (sagitta ~= 8/R on the binding junction window). A wall drawn as a TANGENT-
CONTINUOUS BIARC (two circular arcs, curvature sign flip at MAX SLOPE, no slope
discontinuity, depth monotone -> no spurious pivots for G7/G10 scans):
- run 30 / swing 20 -> R = 16.25 -> worst-window 0.49 (MARGINAL FAIL)
- constructor's real half-periods (projection run 12-21, swing 20) -> R = 6.8-10.5
  -> sagitta 0.55-0.79 (PASS)
- run 42.5 / swing 16 -> R = 32 -> 0.25 (FAIL) — so the shape FORCES the wave toward
  swing ~20-29 at half-periods <= ~29 projection, which G7's along-vine 22.5-42.5
  band permits (along-vine > projection).

## Question

1. Biarc wave (f=0.5, equal radii, curvature flip at max slope, R <= 16) as the
   replacement for the S-cubic wave — is that the right shape, or do you want a
   clothoid/trochoid? My concern with biarc: curvature DISCONTINUITY at the junction
   (slope continuous). Does any gate read curvature discontinuity? (I see none —
   G10 reads sagitta windows, G7 reads pivots, both slope/depth based.)
2. Corner-as-wave + biarc edges atomically (your list a-d + this): any hidden
   conflict I am not seeing? My list of what could still bite: (i) G7's pivot scan
   on the corner crest reading the corner's two troughs as non-alternating with the
   edge troughs (corner is outside G7's mid-window, but the nearestEdge filter can
   pull corner samples in at the window boundary); (ii) G2's corner straddles
   re-derive against the new corner depths; (iii) the leaf endpoint fix forces leaf
   roots near CRESTS (at a trough the tangential far endpoint is shallower, so the
   gate would pick it as attach — at a crest the root is the shallowest point and
   the tie-break picks it).
3. Verdict on the feasibility claim itself: with (a)-(d) + biarc wave, is a
   constructed 10/10 tile now ARITHMETICALLY reachable, or is there a fourth
   structural wall like G2+G9 and the G10-curvature one? If you see one, name it.
