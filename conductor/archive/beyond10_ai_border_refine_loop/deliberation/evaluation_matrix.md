---
type: deliberation-matrix
title: "Evaluation matrix — BEYOND-10 refinement loop"
description: "Four candidates ranked against the card's five acceptance criteria plus the project's two standing constraints, with a verdict per candidate."
tags: [deliberation, matrix, beyond-10]
status: adopted
generated: 2026-11-01
sources: [conductor/archive/beyond10_ai_border_refine_loop/spec.md, js/ai_border.js, js/properties_panel.js, test/browser_e2e/byok_border_gallery.spec.js]
---

# Evaluation matrix — BEYOND-10 / SC-D2 refinement loop

**Basis:** the card's five acceptance criteria (K1–K5), restated verbatim in `conductor/archive/beyond10_ai_border_refine_loop/spec.md`, plus this project's two standing constraints
(K6 no new storage-key family / no schema change; K7 blast radius on already-certified mechanisms) —
applied to each candidate before any verdict below. The vehicle that decides K1–K5 is
`test/browser_e2e/byok_border_gallery.spec.js` (the card's own spec) for the flow, and
`test/unit/border_refine_loop.test.js` for the contract.

| id | Criterion / constraint | How it is decided |
|----|------------------------|-------------------|
| K1 | AC-1 "controls exposed" | A case that FAILS if the weight/style control nodes are absent, disabled where they should not be, or present where the border cannot be adjusted |
| K2 | AC-2 "select → adjust → regenerate → compare" | One case driving the four gestures in order and reading the section's record between each |
| K3 | AC-3 "persist in session and settings" | A case that closes and reopens the surface, and a case whose reload returns the refined bytes AND the control position |
| K4 | AC-4 "`byok_border_gallery.spec.js` extended" | The spec file itself, extended in place |
| K5 | AC-5 G-DETECT | A measured pixel diff between the design and its refined version |
| K6 | no new key family / schema change | Diff review: the parameters ride the existing section record |
| K7 | blast radius | Diff size + which existing green cases would have to change |

**Basis tie:** the criterion matrix below is the track's sealed baseline — the five rows are
[AC-1] … [AC-5] exactly as `python vendor/housekeeping_guard.py seal --track
beyond10_ai_border_refine_loop` hashed them (`#1=7049071dfa72`, `#2=61640bbcc6f8`,
`#3=e20fa40104b8`, `#4=b2a6abe1bc7d`, `#5=ba223029ccad`), with K6/K7 added as this project's
standing constraints rather than card criteria.

## Comparison (no verdict markers in this section by design)

| Criterion | **A — panel refine strip** | **B — modal variant gallery** | **C — CSS frame-width knob** | **D — UI over the shipped relative transform** |
|-----------|---------------------------|------------------------------|------------------------------|------------------------------------------------|
| K1 controls exposed | PASS — appears on the surface a user already has open, presence-gated on an AI border | PASS, but the grid is empty on a real profile | PASS for weight, FAIL for style | PASS |
| K2 select→adjust→regenerate→compare | PASS — variant list from `custom_borders`, absolute parameters, compare reads both byte strings | PASS once the store is populated | FAIL — no dash concept at the CSS level | FAIL — cumulative: 1.5x twice is 2.25x, no way back |
| K3 session + settings | PASS — parameters + base design in the section record, written through `window.scheduleAutosave()` | same as A | PASS trivially (a custom property) | FAIL — the parameters exist nowhere, so a reopen or reload shows a wrong position |
| K4 spec extended | PASS | PASS | PASS | PASS |
| K5 G-DETECT | PASS — the refined artwork differs from the design in stroke weight and dash | PASS | weak: frame thickness changes, the art's line does not | PASS for a single step |
| K6 no new key family | PASS — rides `borderSvg`'s record | PASS | PASS | PASS |
| K7 blast radius | smallest change that meets K2/K3: one new module + one panel row + record plumbing | largest: a fifth picker mode + re-certification of 18 visual cases | smallest | smallest |
| Measured cost | 1 module, 1 panel row, 4 record fields, new unit contract | 1 mode + grid + re-certification | 1 property write | UI only |

## Candidate A — panel refine strip

**Verdict:** ADOPTED — the only option that meets K2 and K3 at the smallest blast radius. Delivered
as `js/border_refine.js` (controls + loop) with the panel row in `js/properties_panel.js` and the
absolute parameter model in `js/ai_border.js`.

## Candidate B — modal variant gallery

**Verdict:** REJECTED — meets every criterion except that its grid is empty on every real profile
(`AiBorder.saveBorder` has no product caller, so `custom_borders` is never written), and it costs a
fifth mode on an already-certified picker surface (K7). The variant list AC-2 needs is delivered inside
option A instead, where an empty library degrades to "the design currently painted".

## Candidate C — CSS frame-width knob as "weight"

**Verdict:** INADMISSIBLE — cannot express style at all and does not reach the artwork's line, so two of
the card's three parameters would be dead controls; it also conflates weight with inset.

## Candidate D — UI over the shipped relative transform

**Verdict:** REJECTED — cheapest, and it fails K2 (a ratchet is not a loop) and K3 (the parameters are
never stored, so the control shows a position the artwork does not have). Its one genuine virtue — zero
change to the 20 shipped cases — was preserved by keeping every shipped signature and making the
absolute model a superset of the relative one.
