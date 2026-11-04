# Spec — e2e_feature_inventory_recert_20261101

**Purpose:** Re-certify the full DDB Print Enhancer e2e feature inventory after the closure of the 11 RED visual-capture tests (commit 2e4dc0e). The prior certification (archived track `e2e_feature_inventory_minimax_20261029`) ran 82/82 suites live with full video, but 5 visual-capture suites had 34/45 passing. Those 11 REDs are now fixed; the re-certification uses the **same video evidence** and re-submits each feature's video bundle to the MiniMax certifier to produce an updated verdict table.

**Invariants (from the archived track, carried forward):**
- 82 spec files, 432 tests (spec_inventory.json)
- 18 fleet features via units.json; remaining 64 specs → cross-cutting class
- Single certifier seat: MiniMax-M3.1-Flash via OFFICIAL MiniMax API (api.minimax.io)
- FULL VIDEO per feature (the prior run's Playwright captures — already on disk)
- Verification-only: no js/**, manifest.json, or existing test file modifications
- Deliberation required at creation (operator mandate 2026-09-23)

**Deliverables for this re-certification track:**
1. Fresh MiniMax API calls for all 19 bundles (18 fleet features + cross-cutting) using the **same video evidence** from the archived track
2. `verdict.md` with a **before/after comparison table** showing the prior vs new certifier verdicts, explicitly highlighting the 5 visual-capture bundles (drag_ux, ui_ux_audit, custom_templates, picker_ux, shape_layer_ps) and their improvement from the 11 RED closures
3. `execution/minimax/<feature>.json` artifacts (one per bundle) with endpoint, model id, request (API key redacted), file ids, usage, and verbatim verdict text
4. Verification that AC-1 counts match the fresh 45/45 visual-capture result

**Out of scope:**
- Running any test suite (all 82 already have video)
- Capturing new video
- Any product code changes

**Model id resolution (operative clause):** the phrase "minimax 3.1 flash" must be resolved to the exact model name the official api.minimax.io accepts at the start of this run. If the phrase does not resolve, record the mismatch verbatim and name the closest official id. NEVER silently substitute; the verdict must show the resolution.

**Scope boundary (from the archived track):**
- Track directory: `conductor/tracks/e2e_feature_inventory_recert_20261101/`
- Evidence source: `conductor/archive/e2e_feature_inventory_minimax_20261029/execution/evidence/`
- New outputs: this track's `execution/minimax/` and `verdict.md`
- Close-out: explicit-path local commit, never push