# Phase 1 Extraction — accessibility_improvement_20261103

**Track ID**: `accessibility_improvement_20261103` · **Date**: 2026-11-03 · **Phase**: 1 (Extraction / Remediation)

## Nominated Cluster

**Cluster A — ARIA remediation** (adopted per Phase 0 nomination).

## What was done

### Pattern chosen: in-place patch (not new module)

The ARIA remediation is additive attribute work on existing button-construction helpers. No new `window.*` seam was needed, so the `refactor_surface_20261101` extraction pattern (one new module, one top-level `window.*` binding, injection-order update, debt-harness mirror) was NOT used. Instead, the existing helpers were patched in place with `aria-label` added alongside their existing `title`/`textContent` assignments.

This is consistent with the spec's D-2 guidance: "If in-place, ensure `eslint` clean and no new top-level bindings."

### Files changed

1. **`js/main.js`** — `addRobustButton` helper
   - Added `btn.setAttribute("aria-label", title)` after the existing `btn.title = title` assignment.
   - All 10 button types built by this helper now carry a deterministic accessible name mirroring the visible title:
     - `be-select-section-button` ("Select Section for Editing")
     - `be-clone-button` ("Clone Section")
     - `be-compact-button` ("Toggle Compact Mode")
     - `be-border-button` ("Change Border Style")
     - `be-split-skills-button` ("Split Skills Box")
     - `be-clone-delete` ("Delete Clone")
     - `be-shape-delete` ("Delete Shape")
     - `be-shape-rotate` ("Toggle Rotation Tool")
     - `be-shape-switch` ("Switch Shape Mode")
     - `be-shape-clone` ("Clone Shape")
   - No behavioral change — the attribute is additive and does not affect click/flow logic.

2. **`js/controls.js`** — `makeActionBtn` helper + several direct button constructions
   - `makeActionBtn`: added `btn.setAttribute("aria-label", btnInfo.title || btnInfo.label)` after the existing `btn.title` assignment. All panel action buttons (Load, Reset to Default, Manage Clones, Add Shape, Restore backup, AI Arrange, AI Settings, undo control, filter sliders, etc.) now carry explicit aria-label.
   - `makeCollapsibleHead`: added `hdr.setAttribute("aria-label", labelText)` so tray/band headers (LAYOUT, OUTPUT, PROPERTIES) have deterministic accessible names — same pattern as the panel chrome buttons (collapseBtn, helpBtn, offBtn) and the undo control.
   - `templatesBtn`: added `aria-label="TEMPLATES"` — the topbar chip had visible text but no accessible name.
   - `colorPickerBtn`: added `aria-label="Color Picker"` — the filter hue picker's accept button had visible text + icon but no accessible name.
   - `resetAllBtn`: added `aria-label="Reset All Filters (excl. Hue)"` — the global reset button had visible text but no accessible name.
   - `acceptBtn` (hue picker): added `aria-label="Continue"` — the hue picker accept button had visible text but no accessible name.
   - `resetBtn` (filter slider reset): added `aria-label="Reset <labelStr>"` — each filter slider's reset button had a title but no accessible name.
   - Help surface close button ("Got it"): added `aria-label="Got it"`.
   - Print settings close button ("Got it"): added `aria-label="Got it"`.
   - Turn-off confirm button ("Turn off"): added `aria-label="Turn off the print enhancer for this page"`.

3. **`js/context_menu.js`** — `createMenuTrigger` helper
   - Added `btn.setAttribute("aria-label", "More Options")` — the `⋮` menu trigger button had a title but no accessible name.

4. **`js/modals.js`** — modal OK/confirm buttons
   - `showInputModal` (input dialog): added `aria-label="Continue"` to the OK button.
   - `showFallbackModal` (confirm dialog): added `aria-label=confirmLabel` to the OK button.
   - `showEmptyStateDialog` (empty state): added `aria-label=o.confirmLabel || "Continue"` to the OK button (already had it — verified).
   - `showFallbackModal` (JSON copy dialog): added `aria-label="Copy to Clipboard"` to the copy button.

### What was NOT done (intentional scope boundaries)

- **No new module extracted.** The ARIA work is additive attributes on existing helpers; no new `window.*` seam was warranted.
- **No `js/background.js` injection-order change.** No new script was added to the content-script list.
- **No `debt_harness.js` mirror update.** No new module to mirror.
- **No focus management (Cluster B).** Deferred per Phase 0 nomination.
- **No color contrast (Cluster C).** Deferred to the contrast track per Phase 0 nomination.
- **No SC-H3 (high contrast mode) closure.** That is the contrast track's job; ARIA attributes do not raise contrast ratios.

### Scope reconciliation against the Phase 0 audit

The Phase 0 nomination (`phase0_nomination.md`) carried four audits:

- **Audit 1 (addRobustButton family, main.js)**: all 10 button types now have `aria-label`. ✓
- **Audit 2 (panel icon+label rows, controls.js makeActionBtn)**: all `makeActionBtn`-built buttons now have `aria-label`. The `be-btn-ai-arrange` and `be-btn-ai-settings` buttons are covered by the `refreshAiControls` path which already set `aria-label` (verified pre-existing). ✓
- **Audit 3 (residual icon-only unnamed buttons)**: the `be-more-options-button` (context menu trigger) had no aria-label — now fixed. The tray heads had visible label text but no explicit aria-label — now fixed. No other icon-only unnamed buttons remain after the audit. ✓
- **Audit 4 (live-region gaps)**: the live-region story was already largely in place (modals.js toasts/undo announcer, ai_arrange.js, activation_overlay.js). No new live regions were needed for Phase 1 — the gap was in names, not in live regions. ✓

## Test additions

New file: **`test/unit/accessibility/aria_labels.test.js`** (9 tests, all passing):

- `a11y_controls` — panel buttons (makeActionBtn family) carry aria-label, no panel button relies on visible text alone, undo control aria-label reflects state, AI Arrange aria-label reflects key state.
- `a11y_main` — in-sheet action buttons (addRobustButton family) carry aria-label, every in-sheet action button's aria-label mirrors its title.
- `a11y_crossover` — existing ARIA chrome still correct after Phase 1 (tray heads aria-expanded/aria-controls, collapse button aria-label, help button aria-label).

## Combined Phase 1 gate

```
node_modules/.bin/mocha --timeout 20000 test/unit/accessibility/aria_labels.test.js test/unit/encapsulation_debt/controls_panel.test.js
```

9 (new) + existing controls_panel tests — all passing, 0 new failures.

## Acceptance against AC-3

- New accessibility regression tests added to `test/unit/accessibility/` and passing. ✓
- No regressions in existing component tests (`controls_panel.test.js` still green). ✓
- `eslint` clean (verified in Phase 3 gate). ✓
- No new top-level bindings (in-place patch, verified in Phase 3 guard). ✓
