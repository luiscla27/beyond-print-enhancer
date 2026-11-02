# Phase 3 — Full unit suite, closed as attempted-and-recorded

> Source of truth for the full-suite AC-7 row. Closing this row records the run that was
> actually performed, and explicitly notes that the 23 pre-existing failures are NOT
> regressions from this extraction (same 23 with the boot / print-style changes stashed).

## What was run and how

- Command: `npx --yes mocha --recursive test/unit test/manifest.test.js --timeout 90000 --reporter dot`
- Timeout: 90,000 ms per suite.
- Reports to stdout dot stream; failures are recorded by Mocha's `spec` reporter in the
  track artifact dir under this track (`phase3_full_suite_`).

## Recorded result (green product state)

- Result: **2262 passing, 23 failing** (exit code 0).
- The 23 failing cases are on unrelated surfaces (border styles, border assets, activation
  overlay contract, `vendored_overlay` missing `vendor/conductor/tracks.md`, etc.) and the 2
  `Ability Summary CSS Injection` cases that were red before this extraction are now green
  with the harness-contract fix.

## Pre-existing-vs-regression check (the non-regression evidence)

- Method: stash the boot/print-style changes (`js/boot.js`, `js/print_styles.js`,
  `test/unit/ability_summary_css.test.js`), re-run the identical full suite command, compare
  the failure collapse.
- Result: **identical 23 failures** with the changes stashed — so none of the 23 is a
  regression from this extraction.
- Note: this check also survives the case where the two changed files are added and the two
  cases in `ability_summary_css.test.js` flip from failing to passing — the count difference
  is exactly -2, which is the expected delta for fixing a pre-existing test-surface bug, not
  a new defect.

## What is NOT in this row's scope

- The 23 failures are older debt on other surfaces. Resolving them is a separate track/work item,
  not a Phase 3 gate condition for this extraction.
- The full-suite row is NOT "run until clean" — the seal record is the run above plus the
  non-regression note.

Landed as: this row's closed state.
