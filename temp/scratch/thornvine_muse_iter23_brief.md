# Cumulative consult — iter 23: MANDATORY 6-LOOP ESCAPE VALVE (iters 17-22 all BLOCK on G10 curvature; my trusted baseline turned out to be a broken instrument). What am I doing wrong?

You are the hardest-to-please design reviewer. This is the pinned escape-valve
consultation: this is the 6th fix-loop iteration on the same target (the G10
curvature half of the 03-thornvine acceptance gate), iters 17-22 all returned
BLOCK, and before any 7th attempt I am required to present EVERY approach tried
with its measured result and ask you directly: **what am I doing wrong?**

HARD RULE (binding on this consult): you must NOT raise any score or verdict
unless the ORIGINAL acceptance criteria are actually met in the artifact's own
pixels/measurements. The challenge below is diagnostic — name the specific
defects and falsify my claims; do not comply to be agreeable. A reviewer that
caves is a failed-gate signal. If a suggestion of yours contradicts a measured
probe, I will push back with the measurement and expect your answer.

## The scope

NOT a product bug, NOT a gate repair, NOT a corpus change. The question is
NARROW: **does any wave shape exist that satisfies the gate's G10 curvature
half on the thornvine vine geometry — and if the arithmetic says yes, what
shape family should the constructor use?** Constructor-side only; the tracked
gate (`scripts/thornvine_acceptance_gate.js`), the frozen corpus, and the
product surface are untouched. Gate promotion (Fix C, commit a29a0f4) is DONE
and not in question.

## The failing acceptance language (verbatim mechanics, tracked gate)

- G10 curvature half, `scripts/thornvine_acceptance_gate.js` L911-918: the ring
  is arc-length resampled at 0.5u (gate `arcResample` L296-311); every window
  of 17 samples (8u of arc, stepping 4 = 2u) must show max chord deviation
  (sagitta) >= CURV_MIN 0.5. ANY window below 0.5 fails G10
  ("N eight-unit stretch(es) read straight/flat").
- G10 micro-ripple half, L886-910: any raw pivot with swing in [1.2, 7.75) on
  an edge's full span fails — no exemption clause (confirmed against source in
  iter-22; you withdrew the claimed exemption).
- Wall geometry constraints the constructor must live in: vine crest depth ~7,
  trough depth 24-30.5 (G1/G7 interplay), half-period projection <= ~29 (G7
  projection tiling), swing 20 (G2 rhythm needs the projection gaps in
  [20,60] on both metrics), corner windows 30u, viewBox 224x256, ring drawn as
  ONE closed stroke.

## The cumulative approaches — ALL tried, ALL measured, in order

(Instrument law used throughout: a window centered on an inflection with
curvature k reads sagitta ~= 2k; a same-sign-curvature window reads ~= 8k.
These laws were established 3a-3j against the gate's own scan and re-confirmed
today by probe3m's prediction column matching its measurement.)

1. **Symmetric S-cubic (the v10/v11 constructor's actual shape), 50+ resampling
   rounds** — sagitta at every inflection = 0 analytically (S symmetry). V11
   tile measured: **424/658 windows flat, worst 0.01** (`tv_v11_flat_probe.py`).
   FALSIFIED — iterating root placement cannot fix wave shape.
2. **probe3's "biarc wall" (R <= 16) — yesterday's trusted baseline** — claimed
   flat=0 on all gaps, worst 0.75. TODAY FALSIFIED AS AN INSTRUMENT:
   `tv_probe3_chain_inspect.py` shows its `biarc_wall` walks arc1 only to
   th=alpha/2 then midpoint-mirrors — the chain jumps (5.83,3.30) ->
   (6.44,17.12), a **13.835-unit straight chord mid-wall**, plus a 1.50u tail
   gap, and its check() scans windows of 17 raw nodes at irregular spacing.
   Kinks read as curvature. probe3b's own header had ALREADY documented this
   bug ("rise ~6.6 instead of 20") — my §7 "reproduced, stands" claim re-ran a
   known-broken generator. probe3's zero-flat is RETRACTED.
3. **The TRUE tangent-continuous biarc (exact closure, overhang allowed),
   gate-exact scan** (`tv_v10_g10_feas_probe3m.py`, today) — flat 1-2/period on
   EVERY constructor gap 24-42 (worst dev 0.19-0.38), matching the analytic
   prediction: R = run/(2 sin th_j) >= rise/4 = 5 as run -> 0, so dev(flip)
   ~= 2/R <= 8/rise = 0.4 < 0.5 FOR ANY RUN at swing 20. Corner hairpin: flat
   0-1/period, worst 0.43-0.54 (marginal, not clean). **Structurally
   impossible, not unlucky.** Independent agreement: probe3b (corrected
   generator, re-run today) — flat 2-4/period on all edges, TOTAL 32.
4. **Gaussian-bump slope profile** (kappa peaks at the flip, dips at the
   flanks; closure solved exactly via monotone ratio bisection, resid ~1e-15;
   0.5-resample invariant asserted) (`tv_v10_g10_feas_probe3k2.py`, today) —
   **NO CLOSURE at gaps 24-38** (symmetric S bottoms at u/d ~= 0.93; the walls
   need up to 1.18 at the 88deg slope cap), flat=4 at gap 42. Mechanism:
   kappa(crest/trough ends) = thmax(1-|a|)/sm = 0.018-0.10 < the 0.0625 flank
   floor for every |a| >= 0.4 — the bump trades flip curvature for flank
   curvature with no overlap. The a=0 limit IS the biarc topology. FALSIFIED.
5. **Equal biarcs, asymmetric biarcs, three-arc closures, S-notch,
   kappa-staircase** (3b/3c/3d/3e/3f/3g/3h/3i, prior sessions) — flat bottoms
   at 2-5/period (3b re-confirmed today: TOTAL 32) or no closure at all (3i).
   FALSIFIED (3b-3h carried valid scans per their headers; 3i's closure search
   was exhaustive over (kbase, kflip)).
6. **Ramp-radius profile R(s) = s*(Rlead + (Rflip-Rlead)*(t/thmax)^p) — R tight
   ONLY at the flip** (probe3j) — the ONE family whose arithmetic threads the
   constraint (kappa_flip = 1/Rflip >= 0.25 at Rflip <= 4, flank
   kappa = 1/Rlead, turn budget spent only near the flip). **UNMEASURED: its
   two "ZERO-FLAT" rows were the empty-scan artifact (15 samples/period at
   spacing 0.40-5.59, total=0 windows, worst=1e9).** It is the only next
   candidate; it has never had a valid scan.
7. **What I have NOT tried** (name any I am missing): varying swing per edge
   (the gate only needs [20,60] on both metrics — a DEEPER wave raises rise,
   which makes biarc WORSE, not better); abandoning one-closed-stroke (G3
   forbids); corners phased as crest->trough->crest (G7 boundary); variable
   swing BETWEEN edges (G2's per-edge pairwise pooling may forbid it).

## The failing numbers, side by side (geometry truth)

- Windows per constructor gap (probe3m): gap 24: 2/25 flat, 26: 2/25, 28: 1/25,
  30: 2/25, 32: 2/26, 38: 2/27, 42: 2/28. Worst dev 0.190 (gap 42) to 0.384
  (gap 30), all at the inflection window.
- v11 constructed tile (the real artifact): 424/658 windows flat.
- Acceptance floor: 658/658 windows sagitta >= 0.5, zero pivots in [1.2, 7.75),
  G1 corner chord dev >= 8 (iter-22's honesty floor — unchanged, and I hold
  myself to it).

## The two questions this consult must answer (in order)

1. **What am I doing wrong?** Six iterations, two of them burned on instrument
   artifacts (probe3's chord, probe3j's empty scan), zero valid zero-flat
   families found, and the arithmetic says every SYMMETRIC family is
   structurally flat at the inflection. Is there a shape family I am blind to?
   Is the constraint set itself (swing 20 + half-period <= 29 + one closed
   stroke + 0.5 sagitta floor) UNSATISFIABLE — and if so, say so plainly and
   name the rule that has to move (with the argument for why the ART and the
   GATE intent survive the change)?
2. **Is probe3j's ramp-radius family the right next probe** — or is there a
   reason it too must fail that I can falsify for 1/10th the effort (an
   analytic wall like the biarc's R >= rise/4)? If it must fail too, the loop
   is at an arithmetic dead end and the next move is a GATE-side decision
   (CURV_MIN, window, or a curvature-continuity formulation), which is an
   operator decision I will not make unilaterally.

Answer with dispositions per numbered approach, then the verdict. Do not raise
any score unless the 658/658 floor is met in a measured artifact.
