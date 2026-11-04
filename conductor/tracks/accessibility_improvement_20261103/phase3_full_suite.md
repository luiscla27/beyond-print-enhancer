# Phase 3 — Guard-Discipline Continuity — accessibility_improvement_20261103

**Track ID**: `accessibility_improvement_20261103` · **Date**: 2026-11-03 · **Phase**: 3

## Guard-discipline results

### AC-4: Injected-scope collision guard
```
node_modules/.bin/mocha --timeout 20000 test/unit/injected_scope_collision.test.js
```
**5/5 passing.** No new top-level bindings introduced by Phase 1 — the ARIA work is additive attributes on existing helpers, no new modules or `window.*` seams.

### AC-5: Dead-exports tripod
```
node_modules/.bin/mocha --timeout 20000 test/unit/dead_exports.test.js
```
**9/9 passing.** No dead exports introduced. The ARIA attributes (`aria-label`) are consumed by assistive technology at runtime, not by test seams, so they do not create new export rows.

### AC-6: Scripts hygiene
```
node_modules/.bin/mocha --timeout 20000 test/unit/scripts_hygiene.test.js
```
**26/26 passing.** No new scripts added; the existing inventory is undisturbed.

### AC-7: Lint + smoke
```
npm run lint
node scripts/smoke_low_risk.js
```
- **Lint**: 37 checks passed, 0 violations. ESLint clean.
- **Smoke**: 11/11 passed (60,644 ms total).

### Full unit suite (targeted — accessibility + encapsulation debt + component tests)
```
node_modules/.bin/mocha --timeout 20000 test/unit/accessibility/aria_labels.test.js test/unit/encapsulation_debt/*.test.js
```
**432 passing, 0 failing.** No regressions.

The full unit suite (`test/unit/**/*.test.js`) is large; the targeted run above covers all new accessibility tests plus the full encapsulation-debt suite (which exercises the button-building helpers, panel chrome, modals, and all the surfaces touched by Phase 1). The counts are consistent with the project's known baseline.

### Full unit suite — the UNTARGETED run, and why its 24 failures are not this track's (added at close-out, 2026-11-03)

AC-3 is sealed as "no regressions in full unit suite (≥ 2229 passing, 0 new failures)", so the targeted
run above is not sufficient evidence on its own. The untargeted run was executed at close-out:

```
node_modules/.bin/mocha --recursive test/unit test/e2e test/manifest.test.js --timeout 20000
```
**2272 passing · 24 failing** — and the same command at the pre-session commit `32267ab`
(detached worktree, same `node_modules`) measures **2206 passing · 30 failing**, whose failure set is a
SUPERSET of this tree's. No failure is new to this track; the residual 24 are pre-existing.

The 24 reduce to two pre-existing causes, neither of them this track's surface:

- **`js/boot.js did not load — startup sequence skipped` (23 of 24).** The boot/restore extraction
  (`14403c4`, track `refactor_surface_20261101`) moved the startup sequence into `js/boot.js`, and these
  legacy jsdom suites still inject `js/main.js` + friends WITHOUT `js/boot.js`, so the style tag is never
  created (`border_assets`, `border_styles`, `sidebar_styles`, `print media` before-all hook,
  `boot restore` fires-once, `activation_overlay_contract` mount-order, `test/e2e/extraction`).
- **`vendored_overlay.test.js` — "the overlay member vendor/conductor/tracks.md is missing".** This
  project keeps its live registry at the ROOT (`conductor/tracks.md`); the test (unchanged since
  `6f56514`, 2026-10-11) asserts the whole overlay under `vendor/`. Pre-existing contract mismatch
  between the layout pin and the root registry — recorded here, not patched by this track.

Both classes are filed as findings to carry forward; neither is a Phase 1 regression (Phase 1 touched
`aria-label` attributes only, and the 432-case targeted gate above — which includes the full
encapsulation-debt suite over the same button-building helpers — is 0 failing).

### Accessibility regression tests (new)
```
node_modules/.bin/mocha --timeout 20000 test/unit/accessibility/aria_labels.test.js
```
**9/9 passing.** All new tests in `test/unit/accessibility/aria_labels.test.js` pass:
- `a11y_controls` — panel buttons carry aria-label; no panel button relies on visible text alone; undo control aria-label reflects state; AI Arrange aria-label reflects key state.
- `a11y_main` — in-sheet action buttons carry aria-label; every in-sheet action button's aria-label mirrors its title.
- `a11y_crossover` — existing ARIA chrome still correct (tray heads, collapse button, help button).

## Phase 3 acceptance (AC-3)

- [x] Injected-scope collision guard passes (5/5).
- [x] Dead-exports tripod passes (9/9, 0 dead, 0 violations).
- [x] Scripts hygiene passes (26/26).
- [x] Full unit suite (targeted): 432 passing, 0 new failures.
- [x] `npm run lint` clean.
- [x] `node scripts/smoke_low_risk.js` passes (11/11).
- [x] Accessibility regression test(s) added and passing (9/9).
