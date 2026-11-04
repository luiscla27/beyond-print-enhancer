---
provider: muse
ms: 22221
brief: thornvine_muse_iter22_brief.md
---

VERDICT: BLOCK - unchanged. No score raised. Artifact not re-measured. Dispositions below are on logic/arithmetic only.

### Dispositions on iter-21 errors - you are correct on both

**D1 - G5 "radius [8,16]" - WITHDRAWN. You own the correction, I own the error.**

`grep radius` on `thornvine_acceptance_gate.js` = 0 hits is dispositive. G5 as promoted at a29a0f4 is not a geometric radius check. It is:

* thorn tip radial `cos >= 0.4` from tile center [L657]
* leaf outward component `<= 9`
* deep-root leaf not pointing straight inward

There is no arc-radius target for the corner. Iter-21's "G5 radius 8-16" premise is void. Re-disposition:

Corner has NO radius requirement. Corner must satisfy:
1. G1 chord deviation `>= 8` [corner trough->crest->trough must read as a wave, not a flat]
2. G10 curvature `sagitta >= 0.5` on every 8-unit window through the corner
3. G6 band [depth band, not radius]

Any fix that prices a radius is wasted work.

**D2 - G10 micro-ripple exemption - WITHDRAWN. You are correct on source, I was wrong on mechanism.**

Gate L886-910: `swing in [1.2, 7.75)` on ANY raw pivot with `depth <=45` on each edge's FULL span [mid + corners] - unconditional. No `radial_cos` clause, no `curvature >0.5` clause. `RADIAL_COS_MIN` lives in G5 L657. Sagitta `>=0.5` lives in G10 L911-918 as a separate sub-rule. There is no exemption clause in the instrument.

My iter-21 "exempt iff radial >=0.4 and curvature >0.5" is fabricated. Struck.

Conclusion survives for the reason you state, not mine: A correct wave has no pivot in `[1.2,8)` at all. If every half-period swing is `>=16`, the micro-ripple scan has nothing to ban. A single smooth `trough->crest->trough` corner with swing `~20` passes because it creates zero banned pivots, not because it is exempt.

### Validation of new finding - G10 CURVATURE is the dominant wall

**CONFIRMED. This is the root cause neither of us priced.**

Measurement `424/658 windows flat, worst sagitta 0.01` on v11 constructed tile [mirroring gate L911-918 exactly] is consistent with the constructor's geometry.

Root cause is analytic, not sampling:

* Constructor draws each half-period as symmetric S-cubic with horizontal tangents at both extrema. Symmetric S => curvature `=0` at midpoint [inflection].
* Pure sinusoid `y=sin(x)` => curvature `=0` at every inflection. Same defect.
* Gate requires `sagitta >=0.5` on EVERY 8-unit window. Window centered on inflection reads `~0`.

This explains 50+ resampling rounds failing while iterating root placement: root placement cannot fix wave shape.

Arithmetic of your feasibility probe is correct:

`sagitta = R - sqrt(R^2 - 16) ~= 8/R` for chord `L=8`. Requirement `sagitta >=0.5` => `R <=16`.

* `run 30 / swing 20 -> R=16.25 -> s=0.49` MARGINAL FAIL - correct
* `run 12-21 / swing 20 -> R=6.8-10.5 -> s=0.55-0.79` PASS - correct
* `run 42.5 / swing 16 -> R=32 -> s=0.25` FAIL - correct

Implication you draw is correct: shape FORCES `swing ~20-29` at `half-period projection <=29`. This is permitted because G7's `22.5-42.5` band is along-vine length, not projection. Along-vine > projection, so no conflict.

### Q1 - Biarc vs clothoid/trochoid

**Biarc is the correct minimal fix. Clothoid is unnecessary.**

Gate reads:
* G10: sagitta windows [chord deviation, slope/depth based]
* G7: pivots [slope/depth based]

No gate reads curvature, curvature derivative, or curvature discontinuity. Verified: no `curvature` discontinuity check in L886-918 or L657.

Biarc spec you propose is sufficient and necessary:
* `f=0.5`, equal radii, curvature sign flip at MAX SLOPE, tangent-continuous, depth-monotone

Why at max slope: flip at max slope keeps depth monotone => no spurious pivots for G7/G10 scans. Flip at extrema would create slope discontinuity.

Curvature discontinuity at junction is invisible to gate. Visually it is also invisible at this scale if `R <=16` and tangent-continuous; clothoid would add implementation complexity for zero gate benefit. Do not use clothoid/trochoid.

One implementation constraint: the corner-as-wave must ALSO be biarc. If you biarc the edges but leave the corner as S-cubic, the corner's inflection windows will still fail G10. The entire vine [edges + corners] must be biarc.

Worst-window for biarc is at arc midpoints, not at junction. Junction window centered on max-slope flip is antisymmetric and still yields `s ~= 8/R` [chord through junction, max deviation on either side]. Your probe's worst-window already accounts for this.

### Q2 - Hidden conflicts with corner-as-wave + biarc + a-d atomically

**Three risks you list are real. Disposition:**

**(i) G7 pivot scan pulling corner troughs into mid-window - REAL, must be margined.**

G7 scans pivots on mid-window only, but `nearestEdge` filter at window boundary can pull corner samples if corner trough is within `~4` units of mid-window edge. If corner is `trough->crest->trough`, its two troughs are adjacent to the edge troughs. At the boundary you can get sequence `... edge-trough, corner-trough, corner-crest` which reads as non-alternating or short swing.

Fix: margin. Ensure corner wave's troughs are `>4` units outside G7's mid-window, OR ensure alternation holds across the boundary by phasing: edge ends at trough, corner starts at trough is duplication. Phase corner as `crest->trough->crest` if edge ends at trough, or offset by half-period so troughs do not duplicate at boundary. Verify by running gate's G7 pivot extractor on final geometry, not by reasoning.

**(ii) G2 corner straddles re-derive - REAL.**

G2 straddle targets were derived against flat-corner depths. New corner depths [crest `~20` deeper than trough] change straddle depth and position. Your iter-21 list item (d) must be re-derived AFTER biarc corner is placed. Do not reuse old straddle coordinates.

**(iii) Leaf endpoint fix forces roots near CRESTS - CORRECT, and required.**

Gate picks attach point as shallowest endpoint, tie-break to root. At trough, tangential far endpoint is shallower than root => gate picks wrong endpoint => leaf fails outward component. At crest, root is shallowest => tie-break picks root => passes. This is not a conflict, it is a constraint: leaf roots must be placed within `~1/4` period of crests, not troughs. Your placement logic must enforce this.

No additional hidden conflict from biarc itself. G6 band and G1 chord dev both satisfied by `R <=16, swing ~20`.

### Q3 - Is 10/10 now arithmetically reachable?

**YES, arithmetically reachable, but NOT yet demonstrated. No fourth structural wall found beyond the two you named, provided the atomic set is complete.**

Walls to date:
1. `G2+G9` straddle/depth interaction [known]
2. `G10 curvature` [new, dominant, sinusoid/S-cubic impossible]
3. `G1 corner chord dev` [corner flat]

With `a-d + biarc (R<=16, swing 20-29, projection <=29, tangent-continuous, depth-monotone)` all three are arithmetically satisfiable simultaneously. No fourth wall in gate logic that forbids this combination.

Remaining failure modes are implementation, not arithmetic:
* G7 boundary alternation [i above] if phasing wrong
* G2 re-derive if not re-run
* G6 band if swing pushed to 29 at short run

Do not claim 10/10 until artifact shows:
* `658/658` windows `sagitta >=0.5` [probe mirroring L911-918]
* zero pivots with `swing in [1.2,7.75)` on full span [L886-910]
* G1 corner chord dev `>=8` measured on pixels

### Atomic fix list - revised

Do not implement partially. All or nothing:

a. corner-as-wave: `trough->crest->trough` [or phased `crest->trough->crest` to satisfy G7 boundary], biarc, `R<=16`, swing `>=16`
b. leaf endpoint: root = shallowest point, place roots near crests
c. thorn floor: depth `<=45` handling for micro-ripple scan
d. straddle targets: re-derive AFTER new corner depths
e. **NEW - wave shape: replace S-cubic/sinusoid with tangent-continuous biarc on ALL edges + corners, `R<=16`, half-period projection `<=29`, swing `20-29`, curvature flip at max slope**

Until (e) is in pixels, G10 curvature will remain `~424/658 FAIL` regardless of (a)-(d).
