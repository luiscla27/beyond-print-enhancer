# muse-loop — thorn vine, iteration 20 (your Fix C package applied; two measured developments need your ruling)

Same role and rules: clinical, diagnostic, never persuasive; revise only what the measurements meet.

## 1. Your package, step 1 executed exactly as you specified

The bottom branch of `loopProj` (scratch gate thornvine_acceptance_gate.js:287) is REPAIRED: `256 - p.y <= p.x && p.x <= 224 - p.y` (empty set) replaced by the quadrant-symmetric `p.y >= p.x && 256 - p.y <= p.x`. Verified after the edit:

- Exhaustive domain check: repaired branch hits 16,113 / 57,825 integer points; bottom-edge (y>=224) hits 6,897. Sample root (100,230): branch bottom, proj 448+(224-100)=572 — along-edge position, as intended.
- G2 metric probe on the constructor ring: nearestEdge-vs-branch mismatches drop 724/2671 (27%) -> 110/2671 (4.1%); the "bottom->left: 614" class is GONE (residual class: right->bottom 110, a narrow corner band).

## 2. NEW MEASUREMENT — the seam discontinuities survive the branch repair

After the repair, the probe still reports 3 projection discontinuities > 40 over one 0.5-arc step; worst 880.3 (linear) at arc 1317.5 = the TL corner; cyclically (the gate's own `d <= 0 -> d += 960` wrap) that one is 78.9. Root cause, now measured and analytic:

- `loopProj` selects its branch by the point's DIAGONAL QUADRANT (x vs y comparisons), and the four piecewise formulas DO NOT JOIN at the diagonals: on the diagonal x=y, left-formula 672+256-x equals top-formula x only at x=464 (outside the 0..224 tile). Every diagonal crossing where the ring dips inside (which G1's corner bows force) is a seam with a jump of hundreds of units; the gate's 960-wrap absorbs only the TL seam.
- So the dead bottom branch was one of TWO defects. The other — diagonal-selected discontinuous zones — is not fixable by any branch-condition patch. A piecewise projection whose pieces are selected by a test discontinuous for the ring's own path cannot be a continuous loop coordinate there.

## 3. CORRECTION TO MY ITER-19 CLAIM (my error, disclosed)

I told you "G8 was reference-checked: the accepted corpus blob FAILS G8." True but MISLEADING, and I withdraw the inference I drew from it. Measured structure of the accepted 03-thornvine reference (test/fixtures/byok_border_corpus.json):

- TWO ring-scale strokes (G3 fails it): stroke 0 = `M16,16 L208,16 L208,240 L16,240 Z` — a PLAIN 16-unit RECTANGLE, zero waves (G1 mid-edge chord dev 0.0 on all four edges). Stroke 1 = one OPEN wavy path along the TOP edge only (640 chars, `C` curves, 0-32 depth).
- 48 filled polygons + 16 ellipses (sprouts), perEdgeSprouts top (9,4) right (15,4) bottom (9,4) left (15,4).
- Corner windows: 57/57/57/57 samples, and the G8 pivot probe finds ZERO crest/trough pivots in every corner window under both datums — the reference has NO corner turn geometry at all. Its corners are straight rectangle sides.

Consequence for your package step 2 (G8 recalibration): there is nothing to recalibrate TO — the reference carries no corner crest/trough pairs, so anchoring G8's thresholds to it would delete G8's stated intent (dense single-datum corner turns). By your own iter-19 rule — "If recalibration not possible without redesign, disable G8 pending redesign — do not silently lower" — this looks like the disable branch. Rule on it.

Consequence for your validation demand ("constructor 10/10 AND reference corpus PASS on repaired G2+G8"): the reference CANNOT pass G1/G3/G7/G8 regardless of G2 — rectangle + one open top path. The validation demand as stated is unsatisfiable for the reference. State what the reference-side validation should be instead (e.g. "reference must not REGRESS on the repaired metric: its G2 pass status before vs after the repair" — note the reference currently PASSES G2 as-is (gaps measured on the rectangle's corners through the broken metric) and its gate record must be re-measured under the repaired branch).

Also disclosed: the constructor's 6/10 artifact (the placement-feasible tile the verdict measured) is NOT regenerable from the committed script — tv_construct_tile.py v10 exits "no feasible global placement"; the working version was mid-sequence (v3->v10) and only the final state was committed. Constructor-side 10/10 validation needs a re-derivation of the placement (parameters documented in the verdict: wave cubics per half-period, CORNER_R 12, arc gaps 27.7-44.2).

## 4. The G2 endgame — rank these three options

With the seam discontinuity measured as irreducible-by-branch-patch, the repair options for the G2 projection metric are:

- (a) MINIMAL: select the branch by `nearestEdge` (the gate already computes it) instead of diagonal quadrants. Seam jumps shrink from hundreds to the corner-geometry scale (top coordinate ~x vs right coordinate 224+y disagree at the switch by <= ~30 units on a ring that stays within 32 of the edges). Metric becomes distortive near corners but no longer catastrophic.
- (b) DROP the projection metric; keep along-vine only. The projection copy is redundant for the stated intent (cyclic gap rhythm along the vine) — but it was added deliberately at iter-13 to catch designs whose along-vine rhythm varies while their EDGE-projected spacing is degenerate. Dropping it removes that check.
- (c) REDESIGN: per-edge 1-D projection gaps (each root projected onto its own edge coordinate), corner-straddling gaps defined by a perimeter coordinate (top x, right 224+y, bottom 448+(224-x), left 704+(256-y) — note 704, not 672: 448+256) with the seam chosen at a corner midline. This is what loopProj was attempting; done with nearest-edge selection it is continuous to <= ~30 at seams.

Rank (a)/(b)/(c) for legitimacy and minimum-diff, and state whether the G2+G9 arithmetic impossibility you sustained at iter-19 (bottom-edge depth-descent requirement) is fully lifted by the repair plus your ranked choice.

## The questions (numbered)

1. Package step 1 (bottom-branch repair): SUSTAINED as correctly executed and verified, or defective?
2. G8: disable-pending-redesign per your own rule, or do you see a legitimate recalibration anchor I have missed? If disable: say exactly what the scratch gate's G8 block should become (skip with detail note vs delete).
3. Reference-side validation, given the reference cannot pass G1/G3/G7/G8 structurally: what is the correct validation set for the repaired gate?
4. Rank G2 options (a)/(b)/(c) with reasons; is the iter-19 G2+G9 impossibility fully lifted by repair + your choice?
5. Is there any further measurement you require before this package goes to the operator as the Fix C proposal?

DISPOSITIONS numbered, with reasons. Do not soften gates; do not assume unauthorized operator decisions.
