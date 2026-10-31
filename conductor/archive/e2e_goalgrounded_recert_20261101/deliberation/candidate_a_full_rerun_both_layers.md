# Candidate A — full re-run, both-layer rubric (ADOPTED 2026-11-01 with the operator)

## The trigger (operator's challenge, verbatim substance)

The operator reviewed `release_1_4_0.webm` + `first_run_card_verify.webm` (the two clips
whose content is mostly extension *activation*) and challenged the 19/19 certification:
the videos show "extension loaded" and almost nothing else in the early frames; the
extension's actual work is barely visible in the last frames. MiniMax never flagged the
most basic missing activation affordance the operator names — a **"loading…" overlay**
that smooths the transition from the plain D&D Beyond sheet to the enhanced UI. The
operator's diagnosis: the v1 prompt never said what the product IS or what activation is
supposed to look like, so the model priced the D&D Beyond sheet itself (which fills the
first frames of every clip) rather than the extension's contribution.

## Root cause in the instrument (verified against `temp/scratch/certify_recert.py::judge_prompt_for`)

The v1 prompt contained exactly one clause of product context ("You are certifying a
D&D Beyond Print Enhancer browser extension feature…"), grounded the behavioral contract
ONLY in the suites' own describe/it titles (for `release_1_4_0` those are literally
"boots cleanly / headline actions present / surfaces present"), never defined the verdict
scale, never said the base sheet is not our work, and rule (1) "never invent UI you
cannot see" actively discouraged absence findings. A suite-level evidence-integrity check
was therefore presented as a product certification.

## Decisions taken WITH the operator (2026-11-01, ask-tool exchange)

1. **Scope**: full re-run of all 19 bundles (not a pilot, not defer). — operator choice
2. **Rubric**: BOTH layers. LAYER 1 = the suite's asserted behavior (as before).
   LAYER 2 = product-aim conformance: basic affordances visible on camera even when no
   suite asserts them (the loading-overlay class named explicitly), with the base D&D
   sheet explicitly declared NOT the extension's work. — operator choice

## Single-answer decisions (recorded as inadmissible candidates, not padded into straw rivals)

- **Certifier seat stays MiniMax-M3.1-Flash** (official api.minimax.io): changing seats
  would confound the prompt-delta experiment; AC-6 of the prior tracks carries over.
- **Corpus stays the archived 2026-10-30 webms, verbatim**: the question being answered is
  "what does the SAME evidence certify under a goal-grounded prompt" — new captures would
  confound prompt change with capture change.
- **One bundle call per feature with the measured knobs** (reasoning=low,
  max_completion_tokens=8000, detail=default, fps=5): the call shape is measured and on
  record (recert plan.md method-correction log); only the PROMPT changes, so the delta is
  attributable to the prompt alone.
- **Cross-cutting bundle keeps its 8-suite representative selection**: widening it would
  change the bundle composition, again confounding the experiment. The other 46
  cross-cutting videos stay mocha-row-covered.

## What is deliberately out of scope

- No product code change (the loading overlay the operator names is a PRODUCT finding —
  it gets recorded in verdict.md as a certified gap, and any implementation is a NEW
  track decision, not this one).
- No re-run of the mocha suites (AC-1 counts carried from the recert).
