# muse-loop — thorn vine, iteration 19 (ROOT RULE measured; two of your claims contradicted by measurement — answer the challenge)

Same role and rules as before: clinical, diagnostic, never persuasive; revise only what the pixels meet. You conceded at iter-17 that H2 (recipe headroom) was untested; iter-18 you demanded a falsification test for the ROOT RULE sentence. It has been run as you specified. You also ranked Fix A first. Two of your claims are now contradicted by measurement; answer them head-on.

## 1. Your ROOT RULE test, run exactly as you specified

`ROOT RULE: sprout base coordinates MUST exactly equal vine path coordinates at that t — copy the numbers, zero offset.` embedded in the grammar + never-L base (tv_leg5_instruction_v4.txt, 3837 chars, product-path buildMessages OK). Rounds 49-50: 2 x 10 samples, max_tokens 7500, T=0.75. Measured:

- r49: 3/10 accepted (unrooted 7, 32, 19), 3 degenerate, 4 model_output_not_json.
- r50: 4/10 accepted (unrooted 70, 42, 13, 39), 2 border_svg_rejected, 3 model_output_not_json (one finish=length), 1 degenerate.
- Informative n = 7/20; 13/20 never reached a gate verdict (envelope/degenerate).
- unrooted values: [7, 13, 19, 32, 39, 42, 70]. n==0: 0. n<5: 0. n<=2: 0. median 32.

YOUR criteria, evaluated: FALSIFIED iff 0/20 unrooted==0 AND median in 8-64 AND no sample <5 — on informative samples that is EXACTLY the observed outcome (0/7 ==0, median 32, 0/7 <5). SUSTAINED-moves-G4 needed >=2/20 unrooted==0 OR median <5 OR >=5/20 <=2 — none met. Per your own rubric: FALSIFIED / no movement, now on 91 cumulative samples with G4 never passed and unrooted 7-70 wherever countable. Disposition your own prediction ("Expected falsified") — and say whether the within-constraint program is now exhausted BY YOUR STANDARD, given you already said at iter-18 that G4 was the last plausible-mechanism gate.

## 2. CONTRADICTION 1 — your #1 ranking is measured-false

At iter-18 you ranked **Fix A (hand-frozen deterministic tile) FIRST**, reason: "only operator action that guarantees 10/10 deterministically by removing model geometry." That ranking was given WITHOUT the constructor measurement (the iter-18 brief did not include it; it landed after your answer). Measured since (tv_construct_tile.py, committed db4be48):

- The deterministic constructor — perfect gate knowledge, no model in the loop — reaches **6/10** (G1, G3, G4, G5, G6, G7 pass; G4 trivially, sprouts rooted by construction). Fix A does NOT guarantee 10/10. It is falsified as a 10/10 route.
- The blocking residual is G2 + G8 + G9 + G10 on placement-proof geometry.

## 3. CONTRADICTION 2 — your G2 account was wrong about WHERE the degeneracy is, and the truth is provable

You accepted "loopProj mis-assigns 27% near corners." The source now yields an exact algebraic result (thornvine_acceptance_gate.js:283-292, verified exhaustively over all 57,825 integer tile points):

- The bottom branch condition `256 - p.y <= p.x && p.x <= 224 - p.y` requires `256 - y <= 224 - y`, i.e. `256 <= 224` — **empty set. DEAD CODE.** Zero hits over the whole domain.
- Every bottom-edge root (y >= 224, x <= 208) therefore fails top (y<x) and right (x>=y) and falls to the LEFT branch: proj = 928 - y — **depth-from-bottom only, no along-edge position.** The probe's "bottom->left 614 mismatches" were this dead branch, not a corner effect.
- Consequence (analytic, not sampled): for a run of k consecutive bottom roots, each internal projection gap needs y_i - y_{i+1} in [20,60] (the wrap escape needs a drop of >= 900 — impossible in a 32-unit band). G9's minimum inventory is 9 sprouts on the bottom edge -> >= 7 internal gaps -> >= 120-140 units of monotone depth descent required inside a 32-unit band. **G2+G9 is arithmetically impossible on the bottom edge for ANY geometry, model or constructor.** This is why the constructor (6/10) and every sampled blob fail G2's projection metric, and why the accepted corpus reference (perEdge bottom (9,4)) fails it too (62/64 gaps outside [20,60]).
- Top, right, left branches project properly (x, 224+y, 928-y with correct edge alignment). The bottom edge is the ONLY degenerate one, and it is degenerate by a typo-class bug, not by design intent.

Note what this does to your iter-18 reason against Fix C ("redefining success, compromises design intent"): the bottom-branch metric does not measure along-edge spacing AT ALL — it measures depth oscillation. Repairing one branch condition (`p.y >= p.x && 256 - p.y <= p.x`, the obvious quadrant-symmetric form) makes the gate measure MORE of the stated intent (cyclic gap rhythm along the vine), not less. Separately, G8 was reference-checked: the accepted corpus blob FAILS G8 (corner crest/trough pair), so G8's thresholds encode a standard the reference itself does not meet — same class as before.

## The questions (answer head-on, numbered)

1. ROOT RULE dispositions per your rubric (FALSIFIED / no movement?) — and is the within-constraint recipe program now EXHAUSTED by your own standard, yes or no?
2. CONTRADICTION 1: with Fix A measured at 6/10 ceiling (not a 10/10 guarantee), does your ranking stand? Re-rank Fix A / Fix B / Fix C under the full evidence and give the reason.
3. CONTRADICTION 2: given the dead-branch proof (one-branch repair restores a true along-edge metric on the bottom edge) and the G8 reference-mismatch, is Fix C still "redefining success," or is it "repairing the gate to measure its own stated intent"? State which, and what a MINIMAL Fix C package must contain to be legitimate (gate lines + what stays untouched).
4. Is there ANY remaining within-constraint experiment you would demand before the operator decides? If yes: one sentence, its falsification test. If no: say "no further sampling is diagnostic."

Reply with DISPOSITIONS (numbered, SUSTAINED/FALSIFIED with reasons), your re-ranking, and the minimal Fix C package if you endorse one. Do not soften gates; do not assume unauthorized operator decisions; do not raise a score the pixels do not meet.
