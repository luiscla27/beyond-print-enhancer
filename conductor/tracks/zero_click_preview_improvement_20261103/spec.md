# Spec — zero_click_preview_improvement_20261103

**Track ID**: `zero_click_preview_improvement_20261103` · **Created**: 2026-11-03 · **Owner**: agent session (to be assigned)

## Goal

Raise the **zero-click preview success rate** from **94% → 95%+** so the UX scoring matrix's **Zero-click preview success rate gate cap** moves from **84 → 100**.

This is a **critical gate**, not a criterion. It does not add weighted points by itself; it removes the ceiling that currently holds the whole score at 84. The practical effect is to lift the final score into the high-80s even if the criterion ratings stay unchanged.

## Scope

- **In scope**: Anything that changes the measured percentage of representative sheets that enter print preview with no blocking print defect and require no user adjustment. This includes print-style defaults, pagination/margins/scale/colors/borders defaults, saved-preference application, and the defect inventory behind the current 94% rate.
- **Out of scope**: New product features unrelated to print readiness, vendored runtime, other projects, and asserting a rate without an evidence artifact.

## Design Decisions (to be finalized in Phase 0 via OSD)

- **D-1 — Cluster nomination**: Run Orthogonal Subspace Deliberation (OSD) to choose ONE defensible cluster for Phase 1. Candidates from gap analysis:
  - **Cluster A**: Representative-sheet coverage and defect inventory — enumerate the representative sheets currently used for the 94% figure, identify which ones still fail, and classify the root causes (clipping, overlapping, blank/hidden content, pagination, defaults).
  - **Cluster B**: Print-defect root-cause remediation — fix the recurring blocking defects that require user adjustment before the preview is print-ready.
  - **Cluster C**: Default-state tuning — ensure first-open defaults in `js/print_styles.js` and print-preview initialization are print-safe (pagination, margins, scale, colors, borders, saved-preference application).
  - **Cluster D**: Print-preview gate instrumentation — make the rate itself reproducible: an evidence artifact a fresh session can re-run and a scoring run can consume via `run.py score --evidence`.
- **D-2 — Pattern**: Extend or patch existing print surfaces through existing seams where they exist. If a new module or instrumentation is introduced, follow the `refactor_surface_20261101` pattern: one top-level `window.*` binding where applicable, injected by `js/background.js` before callers, mirrored in `debt_harness.js`, call-time seam resolution (fail-open). Where the change is purely default-state or defect-fixing, keep it as small as the evidence supports.
- **D-3 — Evidence discipline**: The acceptance target is a **measured rate**, not a claim. A future session must be able to re-run the rate from representative sheets and defect counts and feed it to `run.py`. Do not hardcode a number in prose and call it done.

## Audit Evidence

- UX scoring matrix: `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json`
  - criterion: `print_readiness` ("Zero-click print readiness"), weight 25%
  - gate: `Zero-click preview success rate`
  - gate thresholds:
    - `<70%` → cap 49
    - `70-84%` → cap 69
    - `85-94%` → cap 84
    - `>=95%` → cap 100
  - formula: `final_score = max(1, min(applicable_gate_caps, raw_score + severity_penalties, 100))`
  - runner: `python vendor/.reasonix/skills/ux-scoring-matrix/run.py score --evidence <evidence.json>`
- Current gate state: **94% → cap 84** (target: **95%+ → cap 100**)
- Fleet certification: `ux_feature_fleet_20261029` — 18/18 tracks integrated, 2229 unit tests passing
- Relevant print artifacts: `test/unit/print_styles.test.js`, `test/browser_e2e/print_output_audit.spec.js`, `test/browser_e2e/print_per_layer.spec.js`, `test/browser_e2e/layer_print_visibility.spec.js`

## Acceptance Criteria

- **AC-1**: The zero-click preview success rate is **>=95%** on the next UX scoring run using an evidence artifact that feeds `gate_results.zero_click_preview_success_rate`.
- **AC-2**: The UX scoring matrix runner reports a zero-click gate cap of **100** for the delivered evidence.
- **AC-3**: The improvement is evidenced, not asserted: a fresh session can re-run the rate from the same representative-sheet/defect methodology and obtain the same result.
- **AC-4**: No regressions in the full unit suite and `npm run lint` clean; existing print-related tests where present stay green.

## Handoff Instructions for Fresh Session

1. **Read the contract first**: `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json` and `vendor/.reasonix/skills/ux-scoring-matrix/run.py`. This track is a gate, not a criterion. Understand the cap thresholds and the formula before touching code.
2. **Read this spec**, the `metadata.json` gap analysis, and the existing print tests listed in `relevant_files`.
3. **Run OSD**: Invoke `subspace-deliberation` skill to nominate the Phase 1 cluster (must declare `"deliberation": "required"` in metadata — already set).
4. **Execute Phase 1**: Improve the nominated cluster per conductor-protocol. Keep changes as small as the evidence supports; do not refactor print readiness wholesale just to move one gate.
5. **Produce evidence**: Build or update an evidence artifact that reproduces the zero-click rate from representative sheets and defect counts.
6. **Score it**: Run `python vendor/.reasonix/skills/ux-scoring-matrix/run.py score --evidence <updated_evidence.json>` and confirm `gate_caps.zero_click == 100`.
7. **Continue**: Phases 3-5 per conductor-protocol.
