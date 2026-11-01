# Evaluation matrix — BEYOND-9 certification pass

**Basis:** the card's five acceptance criteria (K1–K5), restated verbatim in `conductor/archive/beyond09_layer_three_state/spec.md`, plus this project's two standing constraints (K6 storage schema unchanged, K7 blast radius on already-certified mechanisms) — applied to each option before any verdict below. The vehicle that decides K1–K5 is `test/browser_e2e/layer_print_visibility.spec.js`.


| id | Criterion / constraint | How it is decided |
|----|------------------------|-------------------|
| K1 | AC-1 "selector per layer" | A case that fails if a layer group loses its strip |
| K2 | AC-2 "print preview respects Print Only / Screen Only" | A case that emulates print media and reads the RENDERED computed style |
| K3 | AC-3 "persist three-state selection across reloads" | A case whose user flow is ONE click and ONE reload — no Save click |
| K4 | AC-4 "`layer_print_visibility.spec.js` extended" | The spec file itself, extended in place |
| K5 | AC-5 G-PIX-OVERFLOW / G-PERSIST pass for the new states | The spec's own two gate cases |
| K6 | storage contract — ratified decision #4, "storage schema unchanged" | No new object store / field / key family |
| K7 | blast radius — a card's fix must not rewrite an already-certified mechanism | Diff size + which existing green cases would have to change |

## Comparison (no verdict markers in this section by design)

| Criterion | **A — verify only** | **B — persist from the writers** | **C — screen-media hide** |
|-----------|--------------------|----------------------------------|---------------------------|
| K1 AC-1 per layer | PASS (case-only) | PASS (no behaviour change) | PASS |
| K2 AC-2 rendered print media | PASS (case-only) | PASS (no behaviour change) | PASS, after rewriting 3 certified cases |
| K3 AC-3 across a reload, no Save | FAIL — the case has to persist explicitly, which is the BEYOND-14 pattern and answers a different question | PASS — measured: RED before the change (stored record still said both), GREEN after | PASS |
| K4 AC-4 spec extended | PASS | PASS | PASS |
| K5 AC-5 gates | FAIL for AC-3 (see K3) | PASS | PASS |
| K6 schema unchanged | PASS | PASS — rides `isHidden` + `isDisabledOnPrint`, both already persisted | PASS |
| K7 blast radius | smallest | smallest change that fixes the gap: one guarded helper + 4 one-line asks; 0 existing cases change | largest: rewrites the hide mechanism and 3 existing assertions inside a certification pass |
| Measured cost | 0 | 4 unit cases (4/4 green) + the e2e reload case (1/1 green) | same tests, plus re-certification of the rewritten mechanism |

## Candidate A — verify only

**Verdict:** INADMISSIBLE — meets K1/K2/K4 and fails K3/K5. The failure is not stylistic: measured, a
user's `Print only` pick is discarded by a reload, and the mode strip lives in a panel that offers no
per-layer save step — so "save first" is not a flow the UI supports. Recorded rather than hidden: the
first draft of the AC-3 case DID persist explicitly (copying the precedent from the sibling reload
spec), and that version passed; reverting that line to the card's actual user flow produced the RED
this track is built on.

## Candidate B — persist from the writers

**Verdict:** ADOPTED — the only option that turns AC-3 green without touching K6 or K7. Delivered as
`LayerManager.requestLayerPersist()` called from the four layer-flag writers
(`_setLayerModeNow`, `_toggleLayerPrintNow`, `toggleLayerVisibility`, `toggleLayerLock`).

## Candidate C — screen-media hide

**Verdict:** REJECTED — correct long-term shape, wrong pass to land it in: K7 loses because the print
mechanism's substituted `display:block` was MEASURED equal to each container's own display, so the
rewrite fixes no observed defect while invalidating three green cases.

## Candidate D — a fourth persisted `visibilityMode` field

**Verdict:** INADMISSIBLE — contradicts the ratified decision #4 that the shipped mechanism cites
("storage schema unchanged"), and a fourth field can disagree with the two flags it would be derived
from — the exact drift class the derivation was chosen to prevent.
