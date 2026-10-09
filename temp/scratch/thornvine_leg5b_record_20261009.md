# Leg-5b — ROOT RULE measured; G2 projection metric root-caused to THREE defects; repaired per muse iter-19/20 rulings

Continues `thornvine_leg5_constructor_verdict_20261009.md` (commit db4be48). All work in the
scratch gate copy `temp/scratch/thornvine_acceptance_gate.js`; the tracked gate is untouched
pending operator authorization (Fix C).

## 1. Muse iter-19 — the ROOT RULE test (his own falsification design), run as specified

Prompt = grammar + never-L base + `ROOT RULE: sprout base coordinates MUST exactly equal vine
path coordinates at that t — copy the numbers, zero offset.` (`tv_leg5_instruction_v4.txt`,
3837 chars, product-path). Rounds 49-50: 2 x 10 samples, max_tokens 7500, T=0.75.

- r49: 3/10 accepted (unrooted 7, 32, 19), 3 degenerate, 4 model_output_not_json.
- r50: 4/10 accepted (unrooted 70, 42, 13, 39), 2 border_svg_rejected, 3 not-json (one
  finish=length), 1 degenerate. Informative n = 7/20.
- unrooted: [7, 13, 19, 32, 39, 42, 70]; 0 at zero, 0 under 5, median 32.
- Muse's rubric: FALSIFIED / no movement — exactly as he predicted. Cumulative: 91 samples,
  G4 never passed. **Within-constraint program EXHAUSTED by his own standard.**
- Iter-19 dispositions: Fix A-first ranking RETRACTED (given without the constructor
  measurement; 6/10 ceiling falsifies "guarantees 10/10"); his corner-effect G2 account
  retracted; dead-branch proof sustained as PROVEN; re-ranking **Fix C first**, reclassified:
  "repairing the gate to measure its own stated intent", NOT redefining success.

## 2. The G2 projection metric has THREE defects (all measured/verified)

1. **Dead bottom branch** — `256 - p.y <= p.x && p.x <= 224 - p.y` requires `256 <= 224`:
   empty set, 0 hits over all 57,825 integer tile points. Every bottom root projected as
   left `928 - y` (depth-only) => G2+G9 arithmetic impossibility on the bottom edge
   (>=7 internal gaps x 20-60 => >=120-140 units of monotone depth descent inside a
   32-unit band). One-line repair: `p.y >= p.x && 256 - p.y <= p.x` (hits 16,113/57,825;
   bottom-edge hits 6,897; (100,230) -> 572). Probe mismatches 724/2671 -> 110/2671.
2. **Seam discontinuities from diagonal-selected branches** — the four piecewise formulas
   do not join at the diagonals (on x=y, left-formula equals top-formula only at x=464,
   outside the tile). Every inward corner dip is a jump of hundreds of units (worst 880.3
   linear / 78.9 cyclic measured). Not fixable by branch-condition patching.
3. **Wrong perimeter constants** — `right` ends at 480 but `bottom` starts at 448 (32-unit
   overlap; a -32 jump becomes +928 cyclic at BR), and `left` 672+(256-y) ends at 928 vs
   the 960 loop (TL wrap 32-short). Correct perimeter: top x | right 224+y |
   bottom **480**+(224-x) | left **704**+(256-y). (Muse caught the left/704 half; the
   bottom/480 half was found by the same corner-continuity audit.)

## 3. The repair implemented (option (a), muse iter-20 ranking: minimum-diff first)

Scratch gate `loopProj` now: branch by `nearestEdge` (the gate's own naming), corrected
constants. Post-repair measurements:

- Probe on constructor ring: `right->bottom: 110` residual only (corner band); canonical
  reference: 0 mismatches, 0 discontinuities.
- Seam jump under (a) ~ 2x corner depth (47.7 cyclic at TL for corner depth 23.8) — a
  G8-crest-scale corner keeps all seams under the 40 threshold. TL-straddling gaps become
  `y_a + x_b in [20,60]` — satisfiable.
- **G2+G9 impossibility LIFTED** (flat arithmetic: 8 gaps x 20 = 160 <= 192 usable/edge).

## 4. G8 disabled pending redesign (muse iter-20 ruling; skip-with-flag, never deleted)

Reason measured, not argued: the accepted 03-thornvine reference is a PLAIN 16-unit
RECTANGLE ring (`M16,16 L208,16 L208,240 L16,240 Z`, mid-edge chord dev 0.0 on all edges)
+ one OPEN wavy path along the top edge only + 48 polygons + 16 ellipses. Its corner
windows carry ZERO crest/trough pivots (57/57/57/57 samples, both datums — probe
`tv_g8_ref_probe.js`). G8's thresholds have no anchor in the reference; recalibration
would invent thresholds the reference never instantiates. The G8 block in the scratch gate
is replaced by an explicit disabled-note per corner; re-enabling requires operator
authorization.

## 5. Reference-side validation (muse's own demand rejected as unsatisfiable, by him)

Reference cannot pass G1/G3/G7/G8 structurally (rectangle + one open top path). Correct
set per iter-20: no-regression on G2/G4/G5/G6/G9 + before/after recording. Measured:
**reference G2 PASS (broken metric) -> FAIL (repaired metric)** — proj gaps 2, 16x14,
44, 960-wrap. Metric correction, not a reference regression: the reference's spacing was
never rhythm-legal; the old metric could not see it. Recorded.

## 6. Constructor status — the 6/10 artifact is NOT the baseline; re-derivation owed

The on-disk `tv_constructed_tile.svg` is a mid-sequence artifact (corner chord devs
17.4/7.1 — G1 fails it; the verdict's 6/10 tile is not regenerable: v10 exits "no feasible
global placement"). Post-repair it scores 4/10 (G3, G5, G7, disabled-G8) with G2 honestly
failing: its roots were placed by ARC gaps (20-60 along-vine) and the repaired metric shows
their FLAT-perimeter gaps at 9.4-19 — arc inflation is not projection. Muse's requirement:
10/10 claims need a re-derived placement satisfying BOTH metrics jointly (v11). Open.

## 7. Where this leaves the campaign

- Prompt program: exhausted (muse-confirmed, 91 samples). No further sampling is diagnostic.
- Gate: three G2 defects found, measured, and repaired in the SCRATCH copy per the muse-
  endorsed minimal package; G8 disabled with rationale; tracked gate untouched.
- Next: operator decision on Fix C promotion (scratch -> tracked gate), then the v11
  constructor re-derivation to prove joint G2+G9 feasibility, then re-sampling.

## Artifacts

- Repaired scratch gate + probe: `temp/scratch/thornvine_acceptance_gate.js`,
  `temp/scratch/tv_g2_metric_probe.js` (option-a mode), `temp/scratch/tv_g8_ref_probe.js`
- Muse transcripts: `thornvine_muse_iter19/20_{brief,answer}.md`
- Sampling: `tv_leg2_20261009/leg2-round49.json|.log`, `leg2-round50.json|.log`
- Gate records: `tv_constructed_tile_gate_optA.json`, `tv_canonical_gate_optA.json`
  (+ pre-repair `tv_canonical_gate.json` for the before/after pair)

## 8. Addendum (2026-10-09, later the same session) — Fix C PROMOTED by operator decision

The operator authorized Fix C ("promote fix C"), closing this record's open decision and muse
iter-20's "no operator decision may be assumed" gate. What was done:

- The repaired gate left the scratch home for the tracked instrument home:
  **`scripts/thornvine_acceptance_gate.js`** (beside `scripts/border_metric.js`, the D1
  precedent). Body is the leg-5b scratch gate (`fb39c6d`) byte-identical; the authorization
  record (items 1-5 of §3-§5 above: option (a), G8 disabled skip-with-flag, no-regression
  before/after, thresholds unsoftened, not wired into npm test) lives in its header.
- Promotion lint-blockers removed, all verdict-neutral (three dead bindings: `atMost`,
  `nearestEdgeName`, and a dead leaf-endpoint wrapper whose only effect was to run the
  identical leaf-rim loop twice, double-counting identical `sproutBandViolations`; canonical
  blob reads 0 either way). `npx eslint scripts/thornvine_acceptance_gate.js` exit 0.
- **Verified against this record, not assumed:** the promoted gate reproduces §3-§5's recorded
  verdicts measurement-identically — canonical corpus blob and `tv_canonical.svg` → FAIL
  [G1,G2,G3,G4,G5,G7,G9,G10] (= `tv_canonical_gate_optA.json`), constructor tile → FAIL
  [G1,G2,G4,G6,G9,G10] (= `tv_constructed_tile_gate_optA.json`).
- Scratch copy retained as the campaign's working copy; divergence from `scripts/` after this
  date is a provenance question, not a gate edit.
- Still owed, unchanged: the v11 constructor re-derivation of joint G2+G9 feasibility (§6)
  before any 10/10 claim, then re-sampling.
