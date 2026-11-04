---
provider: muse
ms: 21622
brief: thornvine_muse_iter19_brief.md
---

# muse-loop iter-19 — DISPOSITIONS

Clinical. No cushioning. Binary.

### 1. DISPOSITIONS — numbered, SUSTAINED/FALSIFIED

**1a. ROOT RULE — SUSTAINED-moves-G4 (>=2/20 unrooted==0 OR median <5 OR >=5/20 <=2): FALSIFIED.**
Reason: 0/20 ==0, 0/7 informative ==0. Median 32 on informative set, in 8-64. 0/7 <5, 0/7 <=2. None of the three disjuncts met on either denominator. No movement.

**1b. ROOT RULE — FALSIFIED (0/20 ==0 AND median 8-64 AND no sample <5): SUSTAINED.**
Reason: Exactly observed. 0/20 ==0, median 32, 0/20 <5. On informative n=7: 0/7 ==0, median 32, 0/7 <5. 13/20 never reached gate verdict (4 model_output_not_json +1 length +3 degenerate r49; 3 model_output_not_json +2 border_svg_rejected +1 degenerate r50) — 65% envelope/degenerate rate is itself a within-constraint failure mode, does not rescue the gate. 91 cumulative samples, G4 never passed, unrooted 7-70 wherever countable.

**1c. Within-constraint recipe program EXHAUSTED by my iter-18 standard (G4 was last plausible-mechanism gate): SUSTAINED — YES.**
Reason: My standard was: if ROOT RULE falsified on its own falsification test, no further recipe/grammar prompt within product-path buildMessages can move G4. It is falsified. No within-constraint operator remains that addresses the measured failure mode. Exhausted.

**2. Fix A guarantees 10/10 deterministically by removing model geometry: FALSIFIED.**
Reason: Measured constructor tv_construct_tile.py db4be48 — perfect gate knowledge, no model — reaches 6/10. Pass: G1,G3,G4,G5,G6,G7. Fail: G2+G8+G9+G10 on placement-proof geometry. G4 trivially passes by construction, proving G4 is not the ceiling. Ceiling is gate-side. My iter-18 ranking was given WITHOUT this measurement and is therefore retracted. I do not raise the score: Fix A is 6/10, not 10/10.

**3a. My iter-18 G2 account ("loopProj mis-assigns 27% near corners"): FALSIFIED.**
Reason: Source thornvine_acceptance_gate.js:283-292 bottom branch `256 - p.y <= p.x && p.x <= 224 - p.y` requires `256 <= 224` — empty set. Exhaustive verification over 57,825 integer tile points: 0 hits. Not a corner effect. 100% of bottom-edge roots (y>=224, x<=208) fail top (y<x) and right (x>=y) and fall to LEFT branch `928 - y`.

**3b. Bottom branch DEAD CODE + G2+G9 arithmetic impossibility on bottom edge: SUSTAINED — PROVEN.**
Reason: Algebraic, not sampled. LEFT branch measures depth-from-bottom only, no along-edge position. For k consecutive bottom roots, internal gaps require y_i - y_{i+1} in [20,60]; wrap escape requires drop >=900 impossible in 32-unit band [224,256]. G9 minimum inventory 9 on bottom edge => >=7 internal gaps => >=140 units monotone descent required inside 32-unit band. Impossible for ANY geometry, model or constructor. This explains constructor 6/10 and why accepted corpus reference perEdge bottom (9,4) fails G2 62/64 gaps outside [20,60]. Top/right/left branches project correctly (x, 224+y, 928-y).

**3c. G8 thresholds encode standard reference itself does not meet: SUSTAINED.**
Reason: Accepted corpus blob FAILS G8 (corner crest/trough pair). Gate does not measure its stated intent to reference-consistent tolerance.

### 2. RE-RANKING — Contradiction 1

Prior ranking FALSIFIED. Under full evidence:

**1. Fix C — gate repair — FIRST.** Only operator that removes arithmetic impossibility. Without it, no geometry can pass.

**2. Fix A — hand-frozen deterministic tile — SECOND, and only AFTER Fix C.** Proves G4 is solvable by construction, but capped at 6/10 until gates are repaired. Not a standalone 10/10 route.

**3. Fix B — continued within-constraint recipe/grammar search — LAST / FUTILE.** ROOT RULE falsified, 91 samples 0-pass G4, 65% envelope/degenerate on last 20. No diagnostic yield remains.

Reason: Ranking must follow measured ceiling, not assumed determinism. Fix A cannot guarantee what gates make impossible.

### 3. CONTRADICTION 2 — Fix C status

**Fix C is NOT "redefining success." It is "repairing the gate to measure its own stated intent."**

My iter-18 reason against Fix C is falsified by the dead-branch proof. The bottom-branch metric currently measures depth oscillation, not cyclic gap rhythm along the vine. Repairing it makes the gate measure MORE of the stated intent, not less. G8 same class: threshold repair to reference-consistency.

**MINIMAL Fix C package — legitimate only if:**

**Must change — gate lines only:**
- `thornvine_acceptance_gate.js:283-292` bottom branch condition: replace `256 - p.y <= p.x && p.x <= 224 - p.y` with quadrant-symmetric form `p.y >= p.x && 256 - p.y <= p.x` [or equivalent that restores along-edge projection on bottom edge; verify 57,825-point exhaustive hits >0 and bottom-edge proj = f(x) not 928-y]. No other projection logic touched.
- `G8` thresholds: recalibrate crest/trough pair to pass accepted corpus reference blob at minimum; document delta. If recalibration not possible without redesign, disable G8 pending redesign — do not silently lower to pass constructor.

**Must stay untouched:**
- Geometry, placement logic, tile coordinates, sprout inventory generation, G1,G3,G4,G5,G6,G7, G9 inventory minimum (9), G10 logic — until re-measured after G2 fix. G9 failure is downstream of G2 bug; do not change G9 until G2 repair is validated. Top/right/left projection branches untouched.

**Validation required before any score is raised:** constructor 10/10 and reference corpus PASS on repaired G2+G8; then re-sample model. No score raised on pixels not met.

### 4. Remaining within-constraint experiment

**No further sampling is diagnostic.**

No within-constraint falsification test remains that can move G4 or resolve G2+G9 impossibility. Next diagnostic step is gate repair + re-measurement, which is outside within-constraint program.
