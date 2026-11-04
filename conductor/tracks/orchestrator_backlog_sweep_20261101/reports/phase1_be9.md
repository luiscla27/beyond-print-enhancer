# PHASE 1 REPORT — BEYOND-9: per-layer three-state control (Print only / Screen only / Both)

Session: external reasonix clone, phase `phase1_be9` · 2026-11-01 · repo
`C:\luiscla27\projects\dndbeyond-printenhance` · **local commits only, nothing pushed**.

## OUTCOME: COMPLETE — all five ACs met and measured

| AC | Verdict | Measured proof |
|----|---------|----------------|
| 1. Three-state selector per layer | MET | strip on EVERY layer group (sections + shapes), `Print only / Both / Screen only`, exactly one pressed; the shapes group's own strip drives its own mode |
| 2. Print preview respects the states | MET | print media EMULATED (`page.emulateMedia({media:"print"})`) + `getComputedStyle`: `none` on screen and the container's own display in print for Print only; `none` in print for Screen only; unchanged for Both |
| 3. Persists across reloads | MET — after a product fix | one click, real `page.reload()` + reinject, no Save click: the reloaded page restores `Print only` (strip + flags + print rule + print-media rendering). Was RED before the fix |
| 4. `layer_print_visibility.spec.js` extended | MET | 10 → 14 cases, same file, no fork (`--grep "BEYOND-9 certification pass"` runs the new four alone) |
| 5. G-PIX-OVERFLOW + G-PERSIST | MET | both gate cases pass; G-PERSIST now measured at BOTH boundaries (record shape + real reload) |

**The card's premises were stale.** The mechanism exists — `ac3c72f`
(`ux_quick_wins_20261025`, 2026-10-26) shipped `LAYER_MODES` / `layerModeOf()` / `setLayerMode()` /
the `.be-layer-mode-strip` / the `data-print-only` print rule / the themed segments. The card's
"Quick win: YES — UI addition only" is HALF TRUE: the storage path already carried both per-layer
flags unchanged (so no schema work), but it was not UI-only — `Print only` needed a new `!important`
print rule in `js/print_styles.js` because the on-screen hide is an inline `display:none`.

## NEW CODE

| File | Change | Purpose |
|------|--------|---------|
| `js/dom/layer_manager.js` | +35 lines | `LayerManager.requestLayerPersist()` — the guarded, call-time `window.scheduleAutosave()` seam (the one `js/properties_panel.js:234` uses) — called from the four layer-flag writers: `_setLayerModeNow`, `_toggleLayerPrintNow`, `toggleLayerVisibility`, `toggleLayerLock` |
| `test/browser_e2e/layer_print_visibility.spec.js` | +408 lines | the certification pass: per-layer strips, rendered print media, the real reload, and the legacy both-flags corner |
| `test/unit/layer_mode_persist_request.test.js` | new, 4 cases | which writer asks for the write; the ask is fail-open; the undo record is unchanged |
| `conductor/archive/beyond09_layer_three_state/**` | new | spec / plan / metadata / deliberation (3 candidates + matrix + ledger) / verification / final_report |

**Commit: `e20a02c`** (13 files, +1177). The track was ARCHIVED at close-out, not left live:
`vendor/housekeeping_guard.py` refuses a COMPLETE track that is neither archived nor named by a
keep-live exception in `conductor/tracks.md` — and that registry does not exist in this repo
(deleted in `768a20b`, per the precedent in `conductor/archive/e2e_feature_inventory_minimax_20261029/final_report.md`).

## ARCHITECTURE DECISIONS a future session must know

1. **The mode is DERIVED, never stored.** `layerModeOf()` maps `(isHidden, isDisabledOnPrint)` to one of
   three modes. No fourth field (decision #4, "storage schema unchanged"; a fourth field can disagree
   with the flags it derives from).
2. **`Print only` needs the print-time UNDO, `Screen only` does not.** `isHidden` is an inline
   `display:none`, so only an `!important` print rule can undo it (keyed on `data-print-only`);
   `Screen only` rides the existing `data-print-disabled` hide.
3. **The strip is its own LINE.** Measured: the 248px panel leaves 0px for the label with three segments
   beside the printer/eye/lock cluster. Do not inline it.
4. **Autosave is now the layer panel's persistence mechanism**, matching drags/nudges/property commits.
   Any NEW layer-flag writer must call `requestLayerPersist()` or it silently reintroduces AC-3's loss.
5. **The legacy fourth corner is honest, not a fourth segment**: a record with BOTH flags set lights no
   segment, reports `data-mode="hidden"`, and one press on `Both` recovers it.

## PLAN AMENDMENTS (deviations, stated)

- **The AC-3 case was tightened mid-track**: its first version read the persisted state via
  `aiLayoutRecordRead`, which runs a LIVE `scanLayout()` — so its "precondition" proved the DOM, not
  storage. Replaced with a direct IndexedDB read (`DDBPrintEnhancerDB` → `layouts`) so the assertion is
  about what the reload will actually restore.
- **The lock toggle was included** in the writer set although AC-3 names only the three-state
  selection: `isLocked` rides the same record, and leaving one of four row controls unsaved would make
  the strip a special case to the user.
- **Rejected candidate C** (replace the inline hide + print undo with a `@media screen`-scoped hide) —
  REJECTED on measurement (the substituted `display:block` equals each container's own display, so the
  rewrite fixes no observed defect while invalidating three certified cases). Recall condition recorded
  in the track's `counterfactual_ledger.md`.
- **AC-1 / AC-2 new cases came back GREEN on the shipped code.** Those were COVERAGE gaps, not product
  gaps, and the record says so instead of dressing them up as fixes.

## STRUGGLES / HARNESS FINDINGS (for the orchestrator's ledger)

1. **Two e2e spec files in ONE mocha process break the harness's reload helper.** Running
   `print_per_layer.spec.js` + `byok_settings_persistence_types.spec.js` in a single invocation made all
   five reload cases fail inside `reinject()` (`waitForSelector` timeout for the ready selector after
   `page.reload()`), while each file alone passes (7/7 and 5/5). The project's `test:e2e:*` scripts run
   one spec per process, which is why this has not surfaced before. **Do not batch specs in one mocha
   invocation.**
2. **`test/unit/input_budget_alignment.test.js` is red on a clean tree** (2 failing: `FINDING F4
   unreachable`, `FINDING F8 ceiling-starved` — model-window / prompt-budget arithmetic). Proved
   pre-existing by stashing the whole change and running that file alone: identical. Unrelated to this
   card, but it means `npm test` is red for ANY session in this tree right now.
3. **Env is fine**: network to `dndbeyond.com` works, Playwright chromium 1243 installed, every e2e gate
   ran for real. No harness boot failure to report.
4. **World sensitivity cost real time**: `page.evaluate` is the MAIN world, so anything touching
   `window.scanLayout` / `__DDBStorage` must go through `contentCall`; IndexedDB is origin-scoped and is
   therefore readable from the MAIN world. Mixing these up yields a silent `undefined`.

## KNOWLEDGE TO PERSIST (other cards will need this)

- A layer-panel click now persists itself ~1s later. Any spec that clicks a layer row control and then
  reads storage must wait past the 1000ms debounce (this track waits 3000ms) — or it will read the
  previous state and call it a defect.
- Corollary for e2e isolation: a case that leaves a layer in a non-default mode will hand the NEXT case
  in the same file a restored non-default mode. Reset through the product's own save seam
  (`contentCall(ctx,"persistLayoutNow")`) and each case starts where it asserts.
- The card vocabulary `G-PIX-OVERFLOW` / `G-PERSIST` exists ONLY as e2e case titles in this repo (plus
  archived `report.json` evidence) — there is no gate framework by that name. Do not go looking for one;
  make the named case pass.
- BEYOND-9's twin work (BEYOND-12 export/import, BEYOND-13 retry, BEYOND-14 reload persistence,
  BEYOND-15 reorder) shipped in the same `ac3c72f` commit — check that commit before treating any of
  those cards as greenfield.

## GATE RESULTS — exact commands, exact counts

| Gate | Command | Result |
|------|---------|--------|
| Owning e2e BEFORE | `npx mocha test/browser_e2e/layer_print_visibility.spec.js --timeout 900000 --reporter spec` | **10 passing / 0 failing (5m)** |
| Owning e2e AFTER | same | **14 passing / 0 failing (8m)** |
| Certification pass alone (after fix) | same spec `--grep "BEYOND-9 certification pass"` | **4 passing / 0 failing** |
| Certification pass alone (RED run, before fix) | same | **3 passing / 1 failing** — AC-3 returned `['both']` |
| Unit contract AFTER | `npx mocha test/unit/layer_mode_persist_request.test.js` | **4 passing** |
| Unit contract BEFORE (fix stashed) | same | **2 failing / 2 passing** (`asked 0`) |
| Regression: legacy layer buttons | `npx mocha test/browser_e2e/print_per_layer.spec.js --timeout 900000` | **7 passing / 0 failing** |
| Regression: reload persistence (BEYOND-14) | `npx mocha test/browser_e2e/byok_settings_persistence_types.spec.js --timeout 900000` (own process) | **5 passing / 0 failing (3m)** |
| Lint | `npm run lint` | clean — eslint + `35 check(s) passed, 0 violation(s)` + `SCRIPTS HYGIENE OK` |
| Syntax | `node --check` on the three touched files | OK |
| Unit composite BEFORE | `npx mocha --recursive test/unit test/e2e test/manifest.test.js --reporter dot` (product change stashed, new unit file moved out) | **2249 passing / 2 failing** |
| Unit composite AFTER | same | **2253 passing / 2 failing** — +4 = the new contract cases; the 2 failures are the SAME pre-existing `input_budget_alignment` ones |
| Housekeeping | `PYTHONDONTWRITEBYTECODE=1 python vendor/housekeeping_guard.py check` | **HOUSEKEEPING GUARD OK — no issues/tracks debt**; deliberation ADMITTED (3 candidates + matrix + ledger) |

## TRACKER

BEYOND-9 is NOT closed by this session (tracker writes are the orchestrator's act). Suggested close
comment: the certification verdict above, the archived track path
`conductor/archive/beyond09_layer_three_state/`, and commit `e20a02c`.
