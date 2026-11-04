---
provider: muse
ms: 23606
brief: thornvine_muse_iter21_brief.md
---

Verdict: BLOCK - 4/10. No score raise. G3 G5 G9 PASS is real. G1 G2 G4 G6 G7 G10 FAIL is real. BLOCKER C closed. BLOCKER B closed as feasibility proof, not as tile pass. Remaining blockers are construction geometry, correctly localized. Do not implement next round until corner wave is re-specified.

Q1 - Corner as wave segment: YES, required reading. NO, does not reintroduce period-2/3 or micro-ripple if executed to spec. Binary.

Current corner is a blank quarter-arc bridge: trough -> interior cubic -> trough. Measured: cornerChordDev 0.7/4.9/0.7 vs [8,22] FAIL, corner swing ~0 vs [4,8] FAIL, micro-pivots 1.8-2.8 in banned [1.2,8) at all 4 junctions FAIL, right-edge trough depth 7.3-8.1 vs [24,30.5] FAIL, non-alternating extremum with 2.4 pivot FAIL. Root cause diagnosis is correct.

G1+G5+G7+G10 jointly force the corner to be a wave half-period, not a fillet:

* G5 radius [8,16] is arc radius of the corner path, not chord deviation. A wave crest at the 45-degree bisector with amplitude 3.5-5 outward satisfies G5 if the osculating radius at the crest remains 8-16. A blank arc also satisfies G5 but fails G1.
* G1 corner swing [4,8] and chord deviation [8,22] require material deviation at the corner. Trough( edge ) -> crest( ~3.5-5 radial outward at 45deg ) -> trough( next edge ) gives swing = crest - trough ~ 4-8 and chord deviation = distance from corner chord to crest ~ 8-22. Blank bridge gives ~0.
* G7 requires one extremum per half period, alternating, trough depth [24,30.5]. The corner crest IS the alternating extremum between the two edge troughs. Your current bridge has zero extrema in the corner interval, so the gate reads the last edge trough to next edge trough as a single over-long half period with an interior pivot.
* G10 bans swing [1.2,8) ONLY for pivots where radial component <0.4*total and/or curvature <=0.5 on straights. G1 corner swing [4,8] is exempt iff radial >=0.4*total and curvature >0.5. Your 1.8-2.8 pivots fail because they are tangential kinks at the cubic junctions (curvature discontinuity, radial ~0). A single smooth crest with radial outward >=0.4 and curvature >0.5 passes G10. Two pivots in the corner = FAIL. One crest = PASS.

Period-2/3 risk: No. Period-2/3 is a property of the gap sequence, not the wave shape. Adding one crest per corner adds fixed arc length to the corner interval (~12-18 units). Your planner already accounts for this in span = projection length. It does not create a repeating gap pattern unless you make all interior gaps equal. Keep the drift.

Micro-ripple risk: No, if C1/C2 continuous. The current pivots are junction artifacts. Replace cubic bridge with quarter-cosine or sine cap that is C1 at troughs. Do not use cubic Hermite with interior control points.

Q2 - Projection-coordinate planner: YES, correct tool. No simpler parametrization lands margins.

Proof: v10 fixed ROOT_CYCLE arc walk failed G2 on all 80 offsets after loopProj repair. Projection gaps compressed to 15-19 on steep wave sections. Arc == projection is false near wave flanks. G2 measures corner straddle in BOTH metrics and thorn/leaf gaps in arc, but placement must be verified in projection because loopProj is nearest-edge per sample with branches top x / right 224+y / bottom 480+(224-x) / left 704+(256-y). Any arc-uniform walk will drift out of [20,60] projection at corners.

Your menu [19.75,43] + consecutive-diff 3.75 + 0.55/pair drift + sum=span +/-2.5 + per-slot DFS + 4x5 product is not over-engineered. It is minimal to satisfy simultaneously: gap [24,30.5] arc, consecutive diff >=4, per-edge >=3 pairwise incl. adjacent corners, no period-2/3 with 0.5 eq tolerance. Simpler closed-form sine phase will violate consecutive diff or period ban. Keep it. Fix margins by targeting corner straddles to [26,54] not [24,59.5] and tightening snap drift to <1.0. Your residuals 16.3/17.7/19.7/14.1 projection and 61 arc are window+ snap errors, not planner flaw.

Q3 - Are the four construction fixes jointly sufficient for 10/10: NO.

Necessary, not sufficient. Three additional bites will fail the next tile if not fixed in same round:

1. Root-vertex picking on corners. G4: every sprout rooted within 3 units of a ring sample, roots are vertex-nearer-the-edge. Your corner picker uses projection straddle but must snap to the ring vertex whose distance to the edge is minimal, not to the projection coordinate. If you snap to projection, corner thorns will read 3-5 units off ring at the crest flank. Verify with gate's own nearest-sample search.

2. Leaf G7 trough interference. G7 measures trough depth from ring geometry only, but leaf root placement near a trough can be read as an extremum if the leaf stem perturbs the sampled ring path. You place leaves center 0.35 inward; after fix (backward endpoint exactly at root) ensure leaf geometry does not add a sample to the ring path. Keep ring path 42 samples pure, sprouts as separate paths.

3. G6 spread under new floor. Thorn floor 8.6 -> tip at -0.4 FAIL. Floor >=9.6 fixes viewBox. But G6 requires thorn [6,8,8,10] leaf [12,16,5,7] with spread <=1.0. If you raise floor to 9.6-10.0, all thorns must be within 1.0 of each other. You cannot have one thorn at 9.6 and another at 8.0. Set thorn size = 9.6 +/-0.4, leaf size = 14 +/-0.5, 6 +/-0.4. Verify spread after floor change.

What you are doing wrong before next round:

* Treating corner as fillet, not as wave. Reference corpus shows continuous wave INTO corner, hump is part of rhythm. Your v10 transplant inherited a CAD fillet mental model.
* Treating leaf attachment as center-offset, not endpoint-coincident. Gate reads major-axis endpoint nearer edge. 7-unit error is systematic.
* Treating G2 as arc-only. After loopProj repair, projection is arbiter for corner straddle. Arc walk is provably infeasible.

Next round must implement atomically:

a) Corner wave: trough at edge end -> crest 3.5-5 radial outward at 45deg with curvature >0.5 and radial >=0.4*total -> trough at next edge start. C1 continuous. Verify G1 swing [4,8], chord dev [8,22], G7 trough [24,30.5] alternating, G10 no pivot in [1.2,8), G5 radius [8,16].
b) Leaf: backward endpoint = root, exactly. No center offset.
c) Thorn floor >=9.6, spread <=1.0 enforced.
d) Planner: corner straddle target [26,54] both metrics, snap drift <1.0, re-verify full cyclic rhythm with gate math.

Until pixels measure PASS on all 7 live gates, verdict remains BLOCK.
