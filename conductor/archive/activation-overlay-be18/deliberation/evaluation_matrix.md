# Decision space: activation-overlay-be18

Question: how is the certified absence class ("no extension-owned activation/loading affordance during
boot", BEYOND-18, found unprompted in 12/19 bundles by the goal-grounded judge) closed with the fewest
new surface concepts? Answer space: surfaces in the extension's OWN control — the website's
spinner/panels are explicitly not ours, and borrowing their look is the defect itself.

**Basis:** the three admissibility tests are the judge's verbatim language, cited from `spec.md` and the
sealed record `conductor/archive/e2e_goalgrounded_recert_20261101/verdict.md`: (i) ATTRIBUTION — "the
only spinner belongs to D&D Beyond"; (ii) SPAN — "panels appear together rather than a clear
progressive loading/transition state"; (iii) FIRST-RUN EXPLAINABILITY — the user never learns who
changed the sheet. Declared 2026-11-01 BEFORE any implementation: the module was then written to this
rubric, not the rubric to the module.

**Basis tie:** the three tests are not free-floating prose — they are the sealed acceptance criteria of
this same track, hashed into `metadata.json` at seal time: test (i) ATTRIBUTION is [AC-3], test (ii)
SPAN is [AC-2] together with [AC-4], and test (iii) FIRST-RUN EXPLAINABILITY is [AC-3] again; the
camera-witness requirement that makes all three judgeable is [AC-7]. The rubric therefore cannot drift
away from the contract it judges: changing a test means changing a sealed criterion, which the guard
reports as a supersession rather than letting both readings coexist.

## Comparison (no verdicts in this section — each option is judged under its own heading below)

| Option | Owns the transition middle? | Theme-consistent (`be-*`)? | Test-visible contract? | Dismissible? |
|---|---|---|---|---|
| `candidate_a_boot_owned_overlay_module.md` — boot-owned overlay module (`js/activation_overlay.js`, `#be-activation-overlay`) | YES — spans `Storage.init()` → restore/apply → `announceBootRestore` | YES (leather ground / bone text / antique-gold spinner, theme-owned) | YES (stable id + `data-be-activation-state`) | YES (auto on completion, click, Esc) |
| `candidate_b_c_inadmissible.md` §B — toast-only via `showFeedback` | NO — lane toast with a short dwell | YES | YES (`.be-feedback`) | auto-dismiss |
| `candidate_b_c_inadmissible.md` §C — CSS-only re-parent flash | NO — website-owned elements, no naming | n/a | NO | n/a |

## Candidate A — boot-owned overlay module

**verdict candidate_a_boot_owned_overlay_module:** ADOPTED. The only option satisfying all three basis
tests. It also matches this repo's encapsulated-module convention exactly (fail-open import in
`js/main.js`, `window.*` export at module end, idempotence guard, `__DDB_TEST_MODE__` safe) and gives
the harness a stable, queryable DOM contract, so a vision judge can SEE both halves of the transition.
Implemented 2026-11-01; verified per `verification.md` (6/6 contract, 3/3 host reproduction including a
mid-boot ACTIVE snapshot, 2/2 capture, 2241-test regression set green).

## Candidate B/C — toast-only and CSS-flash

**verdict candidate_b_c_inadmissible:** REJECTED on the basis tests. Its §B (toast-only) fails SPAN: the
toast lane is top-of-viewport with a short dwell and auto-dismiss, so it cannot span the boot it exists
to explain, and in-session progress toasts are BEYOND-19's class — folding them in would blur two
certified classes into one fix. Its §C (CSS-only re-parent flash) fails ATTRIBUTION and FIRST-RUN
EXPLAINABILITY: a transition on `.ct-subsections` stays D&D-Beyond-lookalike, is undismissable, names
nobody and exposes no test contract, so the defect would survive the fix and the next re-certification
would re-find it. Recall conditions for both halves are in `counterfactual_ledger.md`.

## What this matrix does NOT credit

- Effort or module count. A second stylesheet or an extra module would score worse here, not better;
  admissibility is whether the affordance is OURS, SPANS the transition, and is WITNESSABLE.
- The judge's 12/19 count as a score. The count selected the target; it does not grade the fix, and
  whether the class is now closed is a re-judgment question for a future certification run.
- The screenshots as decoration. The capture passes a self-verifying pixel check (it samples the
  overlay's own box corners in the PNG and fails when the backdrop is not painted) — that check found
  two harness defects, recorded in `verification.md` §3.
