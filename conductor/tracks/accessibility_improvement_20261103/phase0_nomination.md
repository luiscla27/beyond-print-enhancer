# Phase 0 Nomination — accessibility_improvement_20261103

**Track ID**: `accessibility_improvement_20261103` · **Date**: 2026-11-03 · **Phase**: 0 (Nomination)

## Decision

**Adopt Cluster A (ARIA remediation) as the Phase 1 cluster.** Deferred for later phases: Cluster B (focus management) and Cluster C (color contrast). Cluster D (screen-reader labels for icon-only controls) is **absorbed into A's audit scope**, not carried as a separate cluster, after reconciliation against the actual surface (below).

This is a single-answer nomination: the deliberation was recorded and the counterfactual ledger was updated (C1/B rejected-for-Phase-1, C2/A adopted). Per the track's `deliberation: required` declaration, this file IS the nomination record.

## Starting point (stated explicitly)

- **Spec framing**: raise the Accessibility criterion from **75 → 90+** (UX scoring matrix anchors: 75 = "Core flows meet accessibility expectations", 90 = "Excellent, polished, and highly reliable").
- **Measured current on this tree**: Accessibility criterion rating = **62** in `temp/ux_matrix/evidence_current.json` (criterion_ratings.accessibility). The live score run on 2026-11-03 (`python vendor/.reasonix/skills/ux-scoring-matrix/run.py score --evidence temp/ux_matrix/evidence_current.json`) returns **overall 78 (Good)**, raw 83.92, accessibility weighted 3.72 (rating 62 × weight 6 / 100).
- So the spec's 75 anchor is the *anchor language*, not the measured rating. The measured starting point is **62**, and the gap to the 90 target is larger than the spec's "75→90" phrasing implies. This track operates against the measured number, not the anchor.
- **What pulls the accessibility mean down**: SC-H3 ("High Contrast Mode for Accessibility") is scored **1.0** in `temp/e2e_test_matrix_scored.md` — the single lowest cell in the entire 27-scenario matrix. It is the dominant accessibility mean-puller. The other accessibility-mapped scenarios are mid-to-high (SC-A1/A2/A3 3, SC-B1 3, SC-C1/C2/C3 3–4, SC-D1 3, SC-H1 4, SC-G1 4, SC-J2 3).
- **Core-flow accessibility gate**: green on this tree (`evidence_current.json` gate_results.core_flow_accessibility = true). Keyboard operability for core flows is not the current blocker; the matrix's accessibility measurement rows that still need work are "Controls have accessible names and states" and "Text and interactive elements meet WCAG 2.2 AA contrast and sizing expectations."

## Why A (ARIA remediation) is the Phase 1 pick

Basis: the matrix's accessibility criterion is derived from 11 mapped scenario dimensions
(`score_evidence_20261029.json` scenario_dimension_map.accessibility = SC-A1, A2, A3, B1, C1, C2, C3, D1, H1, H3, G1, J2),
and the matrix's measurement rows for the criterion are:
- "All functions are keyboard operable" — green at the core-flow gate (SC-C3, SC-G1 evidence).
- "Focus order and focus indicators are clear" — this is **Cluster B's** territory; deferred (see below), because the core-flow gate is green and the mean is not currently pulled by focus order.
- "Controls have accessible names and states" — **Cluster A's** territory; the highest-leverage first move on the measured evidence (additive attributes, low regression risk, high testability).
- "Color is not the sole state indicator" — partial coverage by A/B both; not A's primary job.
- "Text and interactive elements meet WCAG 2.2 AA contrast and sizing expectations" — **Cluster C's** territory; SC-H3 (1.0) lives here; deferred to the contrast track (see below).

Selection rationale (measured, not asserted):
- **A directly targets "controls have accessible names and states"**, which is one of the five matrix measurement rows and is not covered by the contrast track.
- **A is additive DOM-attribute work**, so regression risk is low (no behavioral change to focus, drag, or modal lifecycles).
- **A is highly testable in JSDOM** — the existing harness already asserts ARIA on the panel chrome (`test/unit/encapsulation_debt/controls_panel.test.js` asserts `aria-expanded`/`aria-controls`/`aria-hidden` on tray heads; `js/modals.js` is the best-wired surface on the tree with `role=dialog`, `aria-modal`, `aria-labelledby`, `aria-live` message, `aria-label` on close X, `aria-invalid` field errors). So the regression harness is warm for this.
- **A does not claim SC-H3 (contrast)**. The matrix's 1.0 cell is a contrast problem, and claiming A closed it would be a false closure. A raises the accessibility mean by fixing names/states; contrast stays the contrast track's job.

## Why B (focus management) is DEFERRED, not adopted — and not dismissed

**What B covers** (per `deliberation/candidate_b.md`):
- visible focus outlines on all interactive elements (`:focus-visible`)
- focus trapping in modals (inert outside)
- logical tab order through drag handles
- focus restoration to the trigger after modal close / print complete
- Standards: WCAG 2.4.3, 2.4.7, 3.2.2

**Why deferred in Phase 1 (measured rationale):**
1. **Lower Phase-1 leverage on this tree's evidence.** The accessibility criterion is currently pulled down by SC-H3 (contrast), not by focus order. Focus order / indicators are one of five matrix measurement rows, but the core-flow accessibility gate is already green (SC-C3 keyboard reorder 3.9, SC-G3 keyboard undo 3.6 — both operable without mouse). So the first-phase leverage is higher on names/states (A) than on focus order (B), and the gap A closes is more directly the matrix's current weakness.
2. **Higher regression risk in Phase 1.** Focus management is behavioral: focus traps, tab-order coordination, drag-reorder focus, focus restoration. That touches drag-reorder and modals — the two surfaces where behavioral regressions are most expensive. A's attribute work does not. When the goal is "raise the criterion with the fewest new surface concepts and the lowest regression risk," A is the cleaner first move.
3. **Not dismissed.** B is a legitimate next-phase candidate. It is deferred on leverage + regression-risk grounds, not because it's unimportant or wrong.

## B defer condition (the trigger to promote it)

After A is implemented and the matrix is re-scored, promote B to the next Phase 1 cluster **only if** all of the following hold:
- the accessibility criterion is still < 90, AND
- the remaining pull is **focus-order / focus-indicators-related** (the matrix measurement row "Focus order and focus indicators are clear"), AND
- the remaining pull is **NOT** SC-H3 contrast (that stays C's deferral to the contrast track) and is **NOT** unresolved names/states (that stays A's scope).

In other words: B promotes when A's names/states work is complete and the shortfall that remains is genuinely a focus-order/indicators shortfall, not a contrast shortfall and not a names/states shortfall. If the re-score is still short for a contrast reason, C's deferral is the active track, not B. If it is still short for a names/states reason, A's scope is not yet complete — do not promote B early.

**B is also tracked externally** — a low-priority YouTrack issue was filed (see below) so a future session that picks B up has the full context rather than reconstructing it from this file.

## Why C (color contrast) is DEFERRED to the contrast track — and formally represented here

**What C covers** (per `spec.md` candidate list): print styles (`js/print_styles.js`), UI theme (`js/ui_theme.js`), sidebar controls meet WCAG AA (4.5:1 text, 3:1 UI).

**Why C is deferred and why it is the contrast track's territory, not A's:**
- The matrix's single lowest accessibility cell is SC-H3 (1.0) — "High Contrast Mode for Accessibility" — and SC-H3 sits squarely on the contrast axis. Closing contrast is a measured, standalone product effort, not an attribute-side-job, and it is already tracked as its own BEYOND issue in this fleet (high-contrast / BEYOND-11).
- A cannot close SC-H3 — adding `aria-label` does not raise a contrast ratio. Claiming it would be a false closure.
- A raises the accessibility mean by fixing names/states; C is what moves the SC-H3 cell. So this Phase 0 formally defers C to the contrast track and does NOT fold it into A.

**C defer condition:** When the contrast track lands SC-H3 (high contrast mode) and the matrix is re-scored, the accessibility mean gets the SC-H3 lift directly. At that point a re-audit should confirm whether A's names/states work plus C's contrast work together reach ≥ 90, or whether B (focus) becomes the residual.

## Why D (screen-reader labels for icon-only controls) is ABSORBED into A — with the surface reconciled

The deliberation folder estimated "~30 elements" as a planning size. That is **not** a measured touch-point list on this tree, and Phase 1 should not begin from it. The measured starting audit is narrower and is the output below; Phase 1 confirms the exact residual by DOM audit, then remediates.

**Audit 1 — `addRobustButton` family, `js/main.js`** (largest single ARIA touch-point family on the tree):
Buttons rendered with an icon + visible title/emoji text but **no explicit `aria-label`**. All via the same `addRobustButton` helper in `js/main.js`:
- `be-clone-button` ("Clone Section")
- `be-compact-button` ("Toggle Compact Mode")
- `be-select-section-button` ("Select Section for Editing")
- `be-border-button`
- `be-split-skills-button`
- `be-clone-delete`
- `be-shape-delete` ("Delete Shape")
- `be-shape-rotate` ("Toggle Rotation Tool")
- `be-shape-switch`
- `be-shape-clone`
Each has visible text, so the accessible-name question is: does the visible text reliably become the accessible name for a screen reader in this menu/action-container context, or is there a silent reliance on `title` that a screen reader may or may not announce? The Phase 1 fix is to give each an explicit `aria-label` mirroring the visible text, so the accessible name is deterministic — the same pattern the panel chrome already uses (`aria-label` on `collapseBtn`, `helpBtn`, `offBtn`, and the undo control in `js/controls.js`).

**Audit 2 — Panel icon+label rows, `js/controls.js`** (named "arrange" controls in the spec's domain):
- `be-btn-ai-arrange` — icon + label + `title`; no `aria-label`.
- `be-btn-ai-settings` — icon + label + `title`; no `aria-label`.
Both are in the `makeActionBtn` family, which renders visible `.be-ctl-label` text whenever `btnInfo.label` exists — so they are not icon-only either. Same question as Audit 1: is the visible label text a reliable accessible name, or is an explicit `aria-label` warranted? The Phase 1 fix is consistent with Audit 1.

**Audit 3 — Residual icon-bearing buttons with no visible text AND no accessible name** (the genuine "icon-only, unnamed" gap):
The grep across `js/*.js` for `aria-label` shows most modules' constructed buttons **already have one** (modals close X "Close dialog", recovery buttons "Restore backup: …", shape picker close "Close", catalog close "Close", etc.). The residual is the subset that has an icon, no visible text, and no `aria-label` — Phase 1 enumerates the actual residual by DOM audit rather than asserting it here. Based on the grep, this residual is smaller than the spec's "~30 elements" estimate, because the largest families (`makeActionBtn` tray buttons, `addRobustButton` in-sheet buttons, modal buttons) either have visible text or already have `aria-label`.

**Audit 4 — Live-region gaps for dynamic state text** (the "states" half of "names and states"):
The grep for `aria-live` / `role="status"` / `role="alert"` shows the major live-region surfaces are wired:
- `js/modals.js`: toast lane (`role` status/alert + `aria-live`), modal message (`role=status`, `aria-live=polite`), feedback toasts, undo announcer (`role=status`, `aria-live=polite`).
- `js/ai_arrange.js:983`: `aria-live=polite` on a node.
- `js/activation_overlay.js:86`: `aria-live=polite` on the overlay.
So the live-region story is largely in place. The residual is the dynamic text updates that change DOM text content **without** passing through one of these announcers — e.g. panel state reflections (layer counts, arrangement progress text, filter slider readouts, compact-mode ON/OFF feedback) that update `textContent` but are not in a live region. The `showFeedback` path is a live region, so anything routed through it is covered; the gap is the in-place text updates that bypass it. Phase 1 enumerates the actual residual by DOM audit.

## What this nomination does NOT claim

- It does **not** claim A will close SC-H3 (contrast). That is the contrast track's job (deferred C).
- It does **not** claim the spec's "~30 elements" is a measured touch-point count. The measured starting audit is the four audits above; Phase 1 confirms the exact residual.
- It does **not** claim D's spec-named list is all real controls — "extract" and "shape picker as icon-only button" are not on the surface; the list was reconciled (above) before any code.
- It does **not** dismiss B. B is deferred on leverage + regression-risk grounds with a stated (checkable) defer condition.

## Acceptance for Phase 0 completion

- This file written (`phase0_nomination.md`).
- `metadata.json` updated: `phase0.status = "complete"`, `phase0.summary` names Cluster A as adopted Phase 1 cluster and records the B/C/D dispositions.
- `conductor/tracks.md` updated: this track's status line flipped from `[ ] phase0-pending` to `[x] phase0-complete` with a one-line note.
- B filed as a low-priority YouTrack issue in project `BEYOND` (block below).

## B — YouTrack issue (low priority, project BEYOND)

Filed so a future session that promotes B to a Phase 1 cluster has the full context rather than reconstructing it from this file.

- **Project**: `BEYOND`
- **Priority**: Low
- **Component / Label**: accessibility (UX) — deferred-phase-candidate
- **Summary**: `accessibility_improvement_20261103 — Phase 2 candidate: focus management cluster (deferred)`
- **Body** (verbatim — written so the future session can act on it without re-deriving the rationale):
  - Origin: Phase 0 nomination of `accessibility_improvement_20261103` (2026-11-03). Adopted Cluster A (ARIA remediation) for Phase 1; B (focus management) deferred.
  - What B covers: visible focus outlines on all interactive elements (`:focus-visible`); focus trapping in modals (inert outside); logical tab order through drag handles; focus restoration to the trigger after modal close / print complete. WCAG 2.4.3, 2.4.7, 3.2.2.
  - Why deferred (Phase 0 rationale, measured):
    1. Lower Phase-1 leverage than A on this tree's evidence — the accessibility criterion (62 in `temp/ux_matrix/evidence_current.json`; live score 78 on 2026-11-03, `python vendor/.reasonix/skills/ux-scoring-matrix/run.py score --evidence temp/ux_matrix/evidence_current.json`) is pulled down by SC-H3 contrast (1.0 in `temp/e2e_test_matrix_scored.md`), not by focus order.
    2. The core-flow accessibility gate is already green (`evidence_current.json` gate_results.core_flow_accessibility = true; SC-C3 keyboard reorder 3.9, SC-G3 keyboard undo 3.6 in `temp/e2e_test_matrix_scored.md`), so focus order is not the current mean-puller.
    3. ARIA (A) is additive-attribute work with low regression risk, while focus management (B) is behavioral and touches drag-reorder + modals, raising regression risk in Phase 1.
  - Not dismissed: B is a legitimate next-phase candidate. It is deferred on leverage + regression-risk grounds, not because it's unimportant or wrong.
  - Defer condition (promote B to next Phase 1 cluster): after A is implemented and the matrix is re-scored, promote B **only if** all of the following hold:
    - the accessibility criterion is still < 90, AND
    - the remaining pull is focus-order / focus-indicators-related (the matrix measurement row "Focus order and focus indicators are clear"), AND
    - the remaining pull is NOT SC-H3 contrast (that stays C's deferral to the contrast track) and is NOT unresolved names/states (that stays A's scope).
    If the re-score is still short for a contrast reason, C's deferral is the active track, not B. If it is still short for a names/states reason, A's scope is not yet complete — do not promote B early.
  - Related matrix evidence: `vendor/.reasonix/skills/ux-scoring-matrix/matrix.json` (accessibility criterion, weight 6%; measurement row "Focus order and focus indicators are clear"); `temp/ux_matrix/evidence_current.json` (criterion rating 62); `temp/e2e_test_matrix_scored.md` (SC-C3 3.9 keyboard reorder, SC-G3 3.6, SC-H3 1.0 contrast — the contrast cell is the current mean pull-down, hence C gets the formal SC-H3 deferral to the contrast track rather than B).
  - Linked track folder: `conductor/tracks/accessibility_improvement_20261103/`.
  - Do NOT start B until the defer condition is met — this is a backlog item, not an active phase.
  - Note for the future session: before starting B, re-read `phase0_nomination.md` in that track folder — it carries the A disposition and the C (contrast) deferral that B sits alongside; B is one of two deferred clusters, not the only one.
