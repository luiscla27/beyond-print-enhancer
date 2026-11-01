# final report — BEYOND-9 / SC-C2 per-layer three-state control

Track `beyond09_layer_three_state` · parent + tracked issue **BEYOND-9** · 2026-11-01 · LOCAL commits
only, nothing pushed.

## OUTCOME: COMPLETE — all five acceptance criteria met and measured

| AC | Met | Proof |
|----|-----|-------|
| AC-1 three-state selector per layer | YES | strip on EVERY layer group, three modes in the criterion's words, one pressed; the shapes group's own strip drives its own mode |
| AC-2 print preview respects the states | YES | print media EMULATED, rendered computed `display` asserted per state |
| AC-3 persists across reloads | YES (after a product fix) | one click → real `page.reload()` → restored mode; measured RED before the fix |
| AC-4 `layer_print_visibility.spec.js` extended | YES | 10 → 14 cases in the same file |
| AC-5 G-PIX-OVERFLOW + G-PERSIST | YES | both gate cases pass; G-PERSIST now measured at the record AND the reload boundary |

Owning spec: **14 passing / 0 failing** (was 10 passing / 0 failing before the new cases).

## What this card actually was

The card says the three-state mechanism "does not exist in the codebase". **It does** — commit
`ac3c72f` (track `ux_quick_wins_20261025`, 2026-10-26) shipped `LAYER_MODES` / `layerModeOf()` /
`setLayerMode()` / the `.be-layer-mode-strip` strip / the `data-print-only` print rule / the themed
segments. The card's premises were stale, so this track is the certification pass, and the pass found
ONE real product gap.

The card's "Quick win: YES — UI addition only, no backend changes needed" is **half true**: the storage
path did already carry both per-layer flags (`isHidden`, `isDisabledOnPrint`) unchanged, which is why no
schema work was needed; but it was not UI-only — the `Print only` mode required a new `!important` print
rule in `js/print_styles.js`, because the on-screen hide is an inline `display:none`.

## The one real product gap: a layer-panel edit never persisted itself

- **Symptom (measured):** pick `Print only`, wait past the autosave debounce, reload — the page comes
  back on `Both`. The user's selection is silently discarded.
- **Cause:** every layer-panel writer mutated the in-memory flag and repainted, and nothing else. The two
  places that DO persist are trigger-based (`js/dnd.js:654` on a drop, `:1195` on a keyboard nudge,
  `js/properties_panel.js:234` on a property commit) — a layer-panel click is none of those.
- **Fix:** `LayerManager.requestLayerPersist()` in `js/dom/layer_manager.js` — the SAME call-time,
  fail-open seam the property panel uses — called from the four layer-flag writers (mode strip, printer
  button, eye button, lock button). 35 inserted lines, 15 of them the comment that records the
  measurement.

## Files changed

| File | Purpose |
|------|---------|
| `js/dom/layer_manager.js` | +35: `requestLayerPersist()` + asks from the four flag writers (AC-3) |
| `test/browser_e2e/layer_print_visibility.spec.js` | +408: the certification pass (per-layer strip, rendered print media, real reload, legacy both-flags corner) |
| `test/unit/layer_mode_persist_request.test.js` | new: 4 contract cases for which writer asks for the write, and that the ask is fail-open |
| `conductor/archive/beyond09_layer_three_state/**` | the track record (spec, plan, metadata, deliberation, verification, this report) |

## Architecture decisions a future session must know

1. **The mode is DERIVED, never stored.** `layerModeOf(layer)` maps the pair `(isHidden,
   isDisabledOnPrint)` to one of three modes; there is no fourth field. Decision #4 ("storage schema
   unchanged") is why, and a fourth field could disagree with the flags it derives from.
2. **`Print only` needs the print-time UNDO, `Screen only` does not.** `isHidden` is an inline
   `display:none`, so only an `!important` print rule can undo it — that rule is keyed on
   `data-print-only`. A `Screen only` layer rides the existing `data-print-disabled` hide.
3. **The strip is its own LINE, not part of the row.** Measured: the 248px panel leaves 0px for the
   label once three segments sit beside the printer/eye/lock cluster. Do not inline it.
4. **The fourth corner is honest, not a fourth segment.** A record with BOTH flags set (hidden on
   screen AND skipped on print) reads as `hidden`: the strip lights NO segment rather than mislabelling
   it, and one press on `Both` recovers it. Pinned by a case.
5. **Autosave is now the layer panel's persistence mechanism**, matching property edits and drags. Any
   future layer-flag writer must call `requestLayerPersist()` or it reintroduces the same silent loss.

## Plan amendments (deviations, stated)

- **The AC-3 case was tightened mid-track.** Its first version read the persisted state with
  `aiLayoutRecordRead`, which runs a LIVE `scanLayout()` — so its "precondition" proved the DOM, not
  storage. Replaced with a direct IndexedDB read (`DDBPrintEnhancerDB` → `layouts` → the rows that carry
  a sections layer) so the assertion is about what the reload will actually restore. The e2e RED is
  recorded from the version that satisfied the final assertion shape.
- **The lock toggle was included** in the writer set even though AC-3 names only the three-state
  selection: `isLocked` is persisted by the same record, and leaving one of four row controls unsaved
  would have made the strip a special case to the user.
- **The deliberation record was rewritten twice** to satisfy the housekeeping guard's contract
  (`**Basis:**` / `**Verdict:**` marker forms, per-candidate attribution, ledger recall conditions). No
  verdict changed between drafts; only the format did.
- **Candidate C (a `@media screen`-scoped hide instead of the inline hide + print undo) was considered and
  REJECTED** on measurement, not taste: the emitted `display:block !important` was measured equal to
  each container's own display, so the rewrite would fix no observed defect while invalidating three
  certified cases. Its recall condition is in `deliberation/counterfactual_ledger.md`.

## Struggles / findings worth carrying

1. **Two e2e spec files in ONE mocha process breaks the harness's reload helper.** Running
   `print_per_layer.spec.js` + `byok_settings_persistence_types.spec.js` in a single invocation made all
   five reload cases fail inside `reinject()` (`waitForSelector` timeout on the ready selector after
   `page.reload()`), while each file alone passes (`7/7` and `5/5`). The project's own `test:e2e:*`
   scripts run one spec per process, which is why this has not bitten before. Not a product defect; the
   reload helper does not tolerate a second live context.
2. **`nav.getCharacterId`-style reads are world-sensitive.** The AC-2/AC-3 cases read the rendered box
   with `page.evaluate` (MAIN world) and the persisted record via IndexedDB (origin-scoped, so also MAIN
   world) — while anything touching `window.scanLayout` / `__DDBStorage` must go through `contentCall`.
   Mixing these up is a silent `undefined`.
3. **The demo sheet needs the network.** Everything above ran against the real
   `dndbeyond.com/characters/151911403`; a run without network cannot boot this harness at all.

## Verification vehicles that actually ran

`npx mocha` on the owning spec (before and after), the certification pass alone, the new unit contract
(with a stashed-fix RED run), `print_per_layer.spec.js`, `byok_settings_persistence_types.spec.js`
(own process), `npm run lint`, `node --check` on all three touched files, `npm test`, and
`python vendor/housekeeping_guard.py check`. Nothing in this record is inferred from reading code.
