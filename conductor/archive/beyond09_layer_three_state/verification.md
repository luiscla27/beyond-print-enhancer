# verification — BEYOND-9 / SC-C2 per-layer three-state control

Track `beyond09_layer_three_state` · 2026-11-01 · commit `e20a02c` (archived at
`conductor/archive/beyond09_layer_three_state/`) · every number below is from a command that actually
ran in this session, on this tree.

## The headline

| AC | Verdict | What proves it (measured) |
|----|---------|---------------------------|
| AC-1 selector per layer | **MET** | The strip exists on EVERY layer group (sections + shapes), names `Print only / Both / Screen only`, exactly one pressed — and the shapes group's own strip drives its own mode. Case: "AC-1: EVERY layer group carries the three-state strip…" |
| AC-2 print preview respects the states | **MET** | Print media EMULATED; the rendered computed `display` is `none` on screen and the container's own display in print for `Print only`; `none` in print for `Screen only`; unchanged for `Both`. Case: "AC-2: the PRINT PREVIEW renders the three states…" |
| AC-3 persists across reloads | **MET — after a product fix** | One click, one relay reload, no Save click: the reloaded page restores `Print only` (strip + container flags + print rule + print-media rendering). Case: "AC-3: the mode a user picks survives a RELOAD with no Save click". Was RED before the fix; see "RED evidence" below. |
| AC-4 spec extended | **MET** | `test/browser_e2e/layer_print_visibility.spec.js` extended in place: 10 → 14 cases, same file, no fork. |
| AC-5 G-PIX-OVERFLOW + G-PERSIST | **MET** | Both gate cases still pass, and G-PERSIST is now measured at BOTH boundaries: the record's shape (pre-existing case) and a real reload (new case). |

## Gate results — exact commands and exact counts

| Gate | Command | Result |
|------|---------|--------|
| Owning e2e, **BEFORE** | `npx mocha test/browser_e2e/layer_print_visibility.spec.js --timeout 900000 --reporter spec` | **10 passing / 0 failing (5m)** |
| Owning e2e, **AFTER** | same command | **14 passing / 0 failing (8m)** |
| Certification pass only, after the fix | same spec `--grep "BEYOND-9 certification pass"` | **4 passing / 0 failing** |
| Unit contract, **AFTER** | `npx mocha test/unit/layer_mode_persist_request.test.js` | **4 passing** |
| Unit contract, **BEFORE** (fix stashed) | same command | **2 failing / 2 passing** |
| Regression: per-layer print buttons | `npx mocha test/browser_e2e/print_per_layer.spec.js --timeout 900000` | **7 passing / 0 failing** |
| Regression: reload persistence (BEYOND-14) | `npx mocha test/browser_e2e/byok_settings_persistence_types.spec.js --timeout 900000` (its own process) | **5 passing / 0 failing (3m)** |
| Lint | `npm run lint` | eslint clean; `35 check(s) passed, 0 violation(s)`; `SCRIPTS HYGIENE OK` |
| Syntax | `node --check js/dom/layer_manager.js` (+ the two touched test files) | OK on all three |
| Unit composite, **BEFORE** | `npx mocha --recursive test/unit test/e2e test/manifest.test.js --reporter dot` (product change stashed, new unit file moved out) | **2249 passing / 2 failing (2m)** |
| Unit composite, **AFTER** | same command | **2253 passing / 2 failing (1m)** — the +4 are exactly the new contract cases; the 2 failures are the SAME pre-existing ones |
| Housekeeping | `PYTHONDONTWRITEBYTECODE=1 python vendor/housekeeping_guard.py check` | **HOUSEKEEPING GUARD OK — no issues/tracks debt**; deliberation ADMITTED |

## RED evidence (reproduce before fix)

1. **e2e (behaviour).** The first full run of the new cases: **3 passing / 1 failing**, the failure being
   AC-3 with `the reloaded page restores Print only — the same mode the user picked` / actual `['both']`.
   Diagnosis measured in the same run: the LIVE scan said `isHidden: true` (the flag moved), so the gap
   was not the flag — it was that nothing WROTE it. That is why the case was then tightened to read
   IndexedDB instead of a live scan: the first version's precondition was reading the DOM and was
   vacuous with respect to persistence (corrected before the fix, not after).
2. **unit (contract).** With the product fix stashed
   (`git stash push -- js/dom/layer_manager.js`), `test/unit/layer_mode_persist_request.test.js` reported
   **2 failing**: `choosing "print" asked for exactly one persist (asked 0)` and `the print toggle asked
   for a persist`. Restored, it is 4/4 green. This is the RED→GREEN pair for the writers.

An honest note about the AC-1/AC-2 coverage cases: they were written as RED-first but came back **GREEN
on the shipped code**. That is a real finding, recorded rather than dressed up: the product was already
correct at those two layers, and what was missing was the MEASUREMENT (no case looked at more than one
layer group; no case rendered print media). Candidate C in the deliberation record was rejected on
exactly this measurement.

## What the fix was (and was not)

- **Was:** `LayerManager.requestLayerPersist()` — a guarded, call-time seam for `window.scheduleAutosave()`
  (the seam `js/properties_panel.js:234` already uses) — called from the four layer-flag writers
  (`_setLayerModeNow`, `_toggleLayerPrintNow`, `toggleLayerVisibility`, `toggleLayerLock`). 35 inserted
  lines in `js/dom/layer_manager.js`, of which 15 are the doc-comment explaining the measurement.
- **Was not:** no storage-schema change (still `isHidden` + `isDisabledOnPrint` in the existing record),
  no change to `js/print_styles.js`, no change to `js/ui_theme.js`, and **no existing case in the owning
  spec was modified** — the 10 pre-existing cases ran unchanged before and after.

## Regression

- `print_per_layer.spec.js` — **7/7 passing** (the spec that owns the legacy print/visibility/lock
  buttons my writer-side change touches).
- `byok_settings_persistence_types.spec.js` — **5/5 passing** when run in its own process (the way the
  project's `test:e2e:*` scripts run every spec). A NOTE ON A HARNESS ARTEFACT: when this file and
  `print_per_layer.spec.js` were run in ONE mocha process, all five of its reload cases failed inside
  `reinject` (`waitForSelector` timeout for the ready selector after `page.reload()`), while the same
  file alone passes 5/5 and `print_per_layer` passes 7/7. Two persistent Chromium contexts in one mocha
  process is not a shape the project's own scripts use, and the failure is in the harness's reload
  helper, not in the product — recorded as a harness finding, not smoothed over.
- `npm test` — **2249 passing / 2 failing before, 2253 passing / 2 failing after**. The two failures are
  PRE-EXISTING and unrelated: `test/unit/input_budget_alignment.test.js` fails on the model window /
  prompt-budget alignment (`FINDING F4 unreachable`, `FINDING F8 ceiling-starved`), which is telemetry
  and `AGENTS.md` size arithmetic. Proved pre-existing by stashing the whole product change and running
  that file alone: `7 passing / 2 failing` — identical.

## Final gate run — nothing left un-run

Every gate above was executed in this session; there is no vehicle claimed without a command. The only
non-green result anywhere is the pre-existing `input_budget_alignment.test.js` pair, which is red on a
clean tree too (measured, stashed). The harness artefact naming two-specs-in-one-process is recorded in
"Regression" rather than hidden, because the next session that runs `npm run test:e2e` (the whole
directory in one process) will meet it.

Housekeeping guard at close-out: **HOUSEKEEPING GUARD OK — no issues/tracks debt**, deliberation
ADMITTED, no temp/issues debt created.
