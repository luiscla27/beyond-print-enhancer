---
provider: muse
ms: 22221
brief: thornvine_muse_iter23_brief.md
---

Structural Validation Log — Iter 23 Escape Valve — G10 Curvature Half

Instrument law re-validated: sagitta ~=2k at inflection-centered window, ~=8k at same-sign window. probe3m prediction column matches gate-exact measurement. Law stands as fact.

Dispositions per approach — binary assessment:

1. Symmetric S-cubic (v10/v11, 50+ resampling rounds):
RESOLUTION ACKNOWLEDGED: sagitta at inflection =0 analytically by S-symmetry. Measurement 424/658 windows flat, worst 0.01 confirms prediction.
VERDICT: FALSIFIED. Correctly logged as structurally incapable. Iterating root placement cannot remediate wave-shape defect. No further S-symmetric iteration is warranted.

2. probe3 "biarc wall" R<=16 — trusted baseline:
RESOLUTION ACKNOWLEDGED: Instrument defect correctly identified and retracted. Chain inspection proves discontinuity (5.83,3.30)->(6.44,17.12) =13.835u straight chord mid-wall +1.50u tail gap. Scan of 17 raw nodes at irregular spacing 0.40-5.59u aliases kinks as curvature. Header bug "rise ~6.6 instead of 20" was documented and re-executed. §7 "reproduced, stands" claim is retracted.
VERDICT: FALSIFIED AS INSTRUMENT. Zero-flat claim void. No score implication.

3. TRUE tangent-continuous biarc (exact closure, overhang allowed) — gate-exact 0.5u resample, probe3m:
RESOLUTION ACKNOWLEDGED: Valid instrument. Flat 1-2/period on every constructor gap 24-42, worst dev 0.19-0.38 at inflection window. Corner hairpin 0-1/period, worst 0.43-0.54 marginal.
LOGICAL INTEGRITY: Sound. Derivation R = run/(2 sin th_j) >= rise/4 =5 as run->0 => dev(flip) ~=2/R <=8/rise =0.4 <0.5 FOR ANY RUN at swing 20 is valid. This is a structural impossibility proof for the entire biarc topology, not a sampling artifact. Independent confirmation probe3b corrected generator TOTAL 32 flats corroborates.
VERDICT: FALSIFIED — TOPOLOGY EXCLUDED.

4. Gaussian-bump slope profile (kappa peak at flip, exact closure via monotone ratio bisection, resid ~1e-15, 0.5-resample invariant asserted) — probe3k2:
RESOLUTION ACKNOWLEDGED: Valid instrument. No closure at gaps 24-38 (symmetric S bottoms at u/d ~=0.93, walls require up to 1.18 at 88deg cap), flat=4 at gap 42.
LOGICAL INTEGRITY: Sound. Mechanism kappa(crest/trough ends)=thmax(1-|a|)/sm =0.018-0.10 <0.0625 flank floor for |a|>=0.4. Bump trades flip curvature for flank curvature with zero overlap. a=0 limit is biarc topology.
VERDICT: FALSIFIED.

5. Equal biarcs, asymmetric biarcs, three-arc closures, S-notch, kappa-staircase (3b/3c/3d/3e/3f/3g/3h/3i):
RESOLUTION ACKNOWLEDGED: 3b re-confirmed today TOTAL 32, flat bottom 2-5/period. 3i exhaustive search over (kbase,kflip) no closure.
VERDICT: FALSIFIED. 3b-3h scans valid per headers; 3i closure search valid.

6. Ramp-radius profile R(s)=s*(Rlead+(Rflip-Rlead)*(t/thmax)^p) — R tight ONLY at flip — probe3j:
RESOLUTION ACKNOWLEDGED: Arithmetic threads constraint on paper: kappa_flip=1/Rflip >=0.25 requires Rflip<=4, kappa_flank=1/Rlead >=0.0625 requires Rlead<=16, turn budget spent only near flip.
INSTRUMENT FAILURE ACKNOWLEDGED: Two "ZERO-FLAT" rows are empty-scan artifact: 15 samples/period at spacing 0.40-5.59u, total=0 windows, worst=1e9. No valid gate-exact 0.5u resampled scan exists.
VERDICT: UNMEASURED. No claim can be logged. Only remaining candidate family.

7. Not tried:
- Varying swing per edge deeper wave: Correctly identified as worsening biarc bound (R>=rise/4). Deeper rise increases required R, decreases dev. Not a remediation.
- Abandoning one-closed-stroke: Excluded by G3. Not available.
- Corners phased crest->trough->crest: G7 boundary condition, does not affect wall G10 wall proof.
- Variable swing BETWEEN edges: G2 per-edge pairwise pooling [20,60] on both metrics likely forbids, and would not remediate wall inflection defect which is per-edge.
VERDICT: No untried family identified that escapes the inflection/flank trade.

---

Q1: What am I doing wrong?

1. Instrument validation failure burned iters 17-22. probe3 trusted without chain inspection against gate arcResample L296-311 (0.5u, 17-sample/8u window, step 4). probe3j trusted with total=0 windows. Diagnostic rule: assert 0.5-resample invariant and total windows = floor((arcLen-8)/2)+1 >0 before logging any flat count. Two iterations lost to this.

2. Iterating within symmetric families after analytic proof of zero sagitta at inflection. Symmetry forces cancellation in inflection-centered window. Any symmetric S, biarc, Gaussian-bump with |a|>=0.4 is structurally flat. No root placement or resampling round can fix wave shape.

3. Not falsifying at 1/10th effort via analytic wall. Biarc wall R>=rise/4 => dev<=0.4 provides immediate exclusion without exhaustive scan. Same method must be applied to next family before exhaustive search.

Constraint set assessment:
Swing 20 + half-period projection <=29 + one closed stroke + CURV_MIN 0.5 on 8u window is UNSATISFIABLE for any tangent-continuous S-family with inflection.

Proof sketch logged: To pass G10 curvature half, need simultaneously Rflip<=4 (dev_flip~=2/Rflip>=0.5) and Rlead<=16 (dev_flank~=8/Rlead>=0.5). For any S-curve with thmax<=88deg (1.536 rad) and endpoints horizontal, rise = integral sin theta ds, run = integral cos theta ds. With Rlead<=16, Rflip<=4, the average curvature over the 8u inflection window is <0.25 unless high-curvature region width >=~4u. If width >=4u, then effective R over that width is ~4-6, total rise achievable with run<=29 and thmax cap is <20 or requires slope >88deg. Gaussian-bump formalizes this: no closure at gaps 24-38. Biarc formalizes this: dev<=0.4 for any run. No symmetric family threads both.

Rule that must move — operator decision, not constructor:
- CURV_MIN 0.5 -> 0.35-0.40, OR
- Window 17 samples (8u) -> 13 samples (6u), OR
- Reformulate G10 as curvature-continuity (max curvature discontinuity) rather than chord sagitta on inflection-centered window.

Argument for ART and GATE intent survival: Gate intent is to reject perceptually flat 8u stretches. Biarc at R=5 gives dev=0.4, visually curved, yet fails 0.5 floor due to inflection cancellation, not perceptual flatness. Lowering floor to 0.35 or shortening window to 6u still rejects true flats (straight 8u chord dev=0) while allowing S-inflection geometry that is visually non-flat. Frozen corpus and product surface unchanged; only constructor-side tolerance for inflection artifact is adjusted. Gate promotion Fix C a29a0f4 remains intact.

Q2: Is probe3j ramp-radius the right next probe, or does an analytic wall guarantee failure?

Ramp-radius is the correct next and ONLY remaining probe, but analytic wall predicts narrow-to-zero feasible interval and provides falsification criterion at 1/10th effort.

Wall for ramp-radius:
Let w = effective width of Rflip region within the 8u inflection window (4u each side). Average curvature magnitude over window avg_k ~= (w*k_flip + (4-w)*k_flank)/4 on each side. dev ~=2*avg_k.
With k_flip=1/Rflip, k_flank=1/Rlead.
To achieve dev>=0.5 need avg_k>=0.25.
If Rflip=4 (k=0.25) and Rlead=16 (k=0.0625), even with w=4 (entire half-window at peak), avg_k=0.25 => dev=0.5 marginal, but w=4 implies curvature is constant 0.25 over 4u, which is biarc case already proven to fail closure/rise tradeoff. For any p>1, w<2, avg_k=(2*0.25+2*0.0625)/4=0.156 => dev=0.312 <0.5 fails.
To reach avg_k>=0.25 with w=2, need k_flip>=0.4375 => Rflip<=2.28. Then total rise with Rlead<=16 and thmax=88deg: rise approx 0.965*(Rlead_eff+Rflip_eff) <0.965*18.28=17.64 <20 fails closure at required gaps. Increasing Rlead to compensate violates flank floor (Rlead>16 => dev_flank<0.5).

Therefore ramp-radius must fail unless p~1-1.5 and Rflip~3.0-3.5 and Rlead~10-12 produce w~3u and still close with run 24-29 and thmax 88deg. This is a measure-zero tuning. It is falsifiable without exhaustive search: compute closure residual and avg_k for p in [1,4], Rflip in [2.5,4], Rlead in [8,16] with gate-exact 0.5u resample. If no point yields residual <1e-9 AND dev_flip>=0.5 AND dev_flank>=0.5, then family is excluded and loop is at arithmetic dead end.

Next measurement required before any verdict change:
Run tv_v10_g10_feas_probe3j_corrected.py with gate arcResample L296-311, assert total windows >0, scan p,Rflip,Rlead grid, log per-gap flat count and worst dev. Do not log zero-flat unless 658/658 windows sagitta>=0.5 measured on constructed tile with same resampler.

---

Verdict: BLOCK.

No artifact has met ORIGINAL acceptance criteria in its own pixels/measurements: 658/658 windows sagitta>=0.5, zero pivots in [1.2,7.75), G1 corner chord dev>=8. Best valid wall measurement is 2/25 flat per gap, worst dev 0.19-0.38. v11 tile 424/658 flat. Score and verdict NOT raised. Challenge is diagnostic, not persuasive — gate remains failed until gate-exact measurement proves otherwise.
