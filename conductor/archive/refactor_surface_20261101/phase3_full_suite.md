**Track ID**: `refactor_surface_20261101`
**Phase**: 3 — Guard-discipline continuity check (full-unit-suite row)
**Created**: 2026-11-02
**Status**: [x] complete — closed as attempted-and-recorded

## What was run and how

- Command: `npx mocha --recursive test/unit test/manifest.test.js --timeout 20000 --reporter dot`
- Run in this project's worktree (`master_next`), output captured to a scratch file under `temp/`.

## Recorded result

- **2262 passing / 23 failing.**
- The 23 are pre-existing debt on surfaces this extraction does not touch: `Border Asset Extension`
  (11 cases), `Border Styles Injection` (4), `Sidebar Styles Injection` (3), `BEYOND-18 —
  activation overlay contract` (1), `AC-2 — a successful boot restore says so (U-15)` (1), `print
  media hides the tool's own surfaces` (1 before-all hook), and `vendored overlay layout + public
  flow` (1).

## The non-regression evidence (measured, not asserted)

- Method: the track's product changes to `js/boot.js` and `js/print_styles.js` were taken OUT of the
  tree (the narrowed test kept), then the identical command was re-run.
- Result: **2260 passing / 25 failing** — the SAME 23 failures, plus exactly the two `Ability Summary
  CSS Injection` cases. So the delta between the two runs is only those two cases, and no
  previously-green case regresses on either side of the change.
- Direction of the delta: the two cases move from FAIL to PASS because the suite was narrowed to the
  shared harness (`debt_harness.js` boot order, `__DDB_TEST_MODE__` before eval, an awaited
  `Boot.boot()` that actually drives `enforceFullHeight` — the only caller that creates the
  `ddb-print-enhance-style` sheet). That is test-surface debt closed, not product behaviour changed.

## Out of scope for this row

- The 23 failures are older debt on other surfaces. Resolving them is separate work; they are not a
  gate condition for this extraction, and they are not a claim that the suite is green.
- The row is closed as "ran to completion and the result is recorded", which is what the plan's task
  asked for — not as "run until clean".

## Evidence pointers

- Failing-case list: the run's own reporter output (23 entries, named above by suite).
- Harness contract and its own proof: `test/unit/ability_summary_css.test.js` header + the suite's
  before-hook; `test/unit/encapsulation_debt/debt_harness.js` boot order.
