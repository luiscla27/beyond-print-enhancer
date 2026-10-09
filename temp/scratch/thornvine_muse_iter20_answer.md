---
provider: muse
ms: 22576
brief: thornvine_muse_iter20_brief.md
---

DISPOSITIONS — iteration 20, Fix C package. Diagnostic only.

### 1. Package step 1 — bottom branch repair

**SUSTAINED as correctly executed. DEFECTIVE as sufficient fix.**

Execution verified:
- Condition `256 - p.y <= p.x && p.x <= 224 - p.y` is empty set. Replacement `p.y >= p.x && 256 - p.y <= p.x` is quadrant-symmetric complement to other three branches. Correct.
- Domain hit rate 16,113/57,825 and bottom-edge hit 6,897 are consistent with expected quadrant area. Sample (100,230) -> 572 = 448+(224-100) is correct along-edge coordinate.
- Metric effect measured: 724/2671 -> 110/2671 mismatches, elimination of `bottom->left:614` class. This is the predicted effect of repairing a dead branch. No defect in execution.

Insufficiency: Repair does not address second defect. Your measurement of 3 discontinuities >40 over 0.5-arc step, worst 880.3 linear / 78.9 cyclic at TL corner, confirms piecewise formulas are discontinuous at diagonal selection boundaries. On diagonal x=y, left formula vs top formula intersect at x=464 outside tile, so every diagonal crossing where ring deviates inward produces jump of order 10^2. Gate's `d<=0 -> d+=960` wrap masks only TL seam. This is irreducible by any branch-condition patch. Step 1 is necessary but not sufficient.

Note additional defect disclosed by your perimeter note: left offset constant. If code uses `672+(256-y)` then perimeter is discontinuous by 32 at left seam even with correct branch selection. Correct perimeter is `704+(256-y)` where 704=448+256. This must be verified and corrected as part of any (a)/(c) — not part of step 1.

### 2. G8 — recalibration vs disable

**DISABLE pending redesign. No legitimate recalibration anchor exists.**

Your correction to iter-19 is accepted. Withdrawal of inference is noted and required.

Reference structure measured: stroke 0 is axis-aligned rectangle `M16,16 L208,16 L208,240 L16,240 Z` with 0.0 mid-edge chord deviation, stroke 1 is single open top-edge wavy path. 48 polygons + 16 ellipses. Corner windows 57/57/57/57 samples, 0 crest/trough pivots under both datums in all windows. Reference carries zero corner-turn geometry.

Consequence: G8's stated intent — dense single-datum corner turns with crest/trough pairs — has no instantiation in reference. Thresholds cannot be anchored without inventing them. Any recalibration would be arbitrary lowering to make rectangle pass, which deletes intent. Per iter-19 rule you cite, this is the disable branch.

Scratch gate G8 block disposition: **SKIP with detail note, do not delete.**

Required form:
```
 // G8 DISABLED pending redesign — iter-20 measurement: reference corpus 03-thornvine has 0 pivots in all corner windows (57 samples each), no corner turn geometry to anchor thresholds; constructor intent requires redesign. See iter-20 ruling.
 return { pass: true, disabled: true, detail: "G8 disabled pending redesign — no anchor" }
```
Delete is prohibited — it erases audit trail and violates "do not silently lower" principle. Disable must be explicit, pass-with-flag, and require operator authorization to re-enable.

### 3. Reference-side validation

**Your iter-19 validation demand as stated is UNSATISFIABLE and logically invalid. Sustained as defective.**

Reference cannot pass G1/G3/G7/G8 structurally by design: G1 requires wave deviation, G3 requires closed ring-scale strokes, G7/G8 require corner geometry. Reference is rectangle + one open top path. Demanding `reference corpus PASS on repaired G2+G8` is demanding a rectangle pass wave/corner gates. Rejected.

Correct reference-side validation set for repaired gate:

- **Excluded from pass/fail:** G1, G3, G7, G8 — documented as `excluded — reference not instantiating intent` not as failures. Must not be counted in corpus pass rate.
- **Required no-regression:** G2 (repaired), G4, G5, G6, G9. For G2 specifically: re-measure reference gate record under repaired branch (and under repaired+nearestEdge if (a)/(c) adopted). Current reference PASSES G2 through broken metric on rectangle corners. Re-measurement may flip to PASS or FAIL — either outcome is a metric correction, not a reference regression, but must be recorded as `G2-reference-before vs G2-reference-after`. Validation criterion is `no new FAIL introduced by repair on gates reference is intended to satisfy` — not `reference must pass all gates`.
- Constructor-side validation remains 10/10 on regenerated tile, not on non-regenerable 6/10 artifact. Your disclosure that tv_construct_tile.py v10 exits `no feasible global placement` and 6/10 artifact is from uncommitted mid-sequence state invalidates 6/10 as baseline. 10/10 must be measured on re-derived placement using documented parameters (wave cubics per half-period, CORNER_R 12, arc gaps 27.7-44.2). No validation claim is sustainable until re-derivation succeeds.

### 4. G2 endgame — ranking (a)/(b)/(c) and G2+G9 impossibility

**Ranking:**

For **minimum-diff mandate** (Fix C scope): **(a) > (c) > (b)**
For **legitimacy / correctness**: **(c) > (a) >> (b)**

Reasons:

- **(a) MINIMAL — branch by `nearestEdge`:** Fixes catastrophic discontinuity with single predicate swap. Gate already computes `nearestEdge`. Seam jumps drop from ~10^2 to corner-geometry scale <=~30, below 40 threshold. Preserves projection intent (catch edge-projected degenerate spacing) with only distortive error near corners where nearest-edge assignment is ambiguous. Diff is 1 line. Legitimate as minimal repair.

- **(c) REDESIGN — per-edge 1-D + perimeter coordinate with mid-corner seam:** Most legitimate. Explicitly defines projection as intended: per-edge coordinate for edge-local gaps, perimeter coordinate `top x | right 224+y | bottom 448+(224-x) | left 704+(256-y)` for corner-straddling gaps, seam at corner midline. With nearest-edge selection, continuity <=~30. This is what loopProj attempted. Requires new gap-definition logic, larger diff, outside minimal Fix C but correct long-term.

- **(b) DROP projection metric:** Least legitimate. Removes coverage added at iter-13 for degenerate edge-projected spacing. Lifts impossibility by deletion, not repair. Violates minimum-diff in opposite direction — removes intent rather than fixing implementation. Only acceptable if operator explicitly authorizes intent removal, which has not been given. Do not assume.

**G2+G9 arithmetic impossibility (iter-19 sustained):**

**Fully lifted by (a) or (c) + bottom-branch repair. Trivially lifted by (b) via deletion.**

Iter-19 impossibility was: bottom-edge roots projected via left-edge coordinate due to dead branch, forcing depth descent to satisfy both G2 projection gaps and G9. With bottom branch repaired and (a)/(c) selecting by nearestEdge, bottom-edge roots project to `448+(224-x)`, G2 gaps become independent of depth, G9 depth requirement no longer conflicts. Residual 110 `right->bottom` mismatches and 78.9 cyclic jump are the remaining diagonal-selection artifact — eliminated by (a)/(c). (b) also eliminates conflict but by removing G2 projection entirely, which is not a repair.

Condition for lift: left offset must be 704, not 672, otherwise 32-unit discontinuity remains at left seam even under (a)/(c).

### 5. Further measurements required before Fix C goes to operator

**Fix C is NOT shippable as measured. Required before proposal:**

1. Re-measure reference corpus gate record under repaired bottom branch alone, and under (a) — report G2 pass/fail before vs after. Do not ship without this.
2. Measure seam jumps under (a) on constructor ring: exhaustive 0.5-arc step discontinuities, confirm max <40 linear and cyclic. Confirm `nearestEdge` vs branch mismatches -> ~0.
3. Verify left offset constant: exhaustive perimeter continuity check at all four seams with (a)/(c); confirm 704 vs 672 and correct if needed.
4. Re-derive constructor placement from committed script with documented parameters; confirm feasible global placement exists and re-measure G2 (repaired+(a)) and G9 on regenerated tile. 10/10 claim cannot be validated on non-regenerable artifact.
5. Re-run G8 pivot probe on constructor ring to document disable rationale in gate detail note.

No operator decision may be assumed. G8 disable and choice among (a)/(b)/(c) require explicit operator authorization.
