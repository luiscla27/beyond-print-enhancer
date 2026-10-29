---
type: Prompt
title: "Launch prompt — e2e_feature_inventory_minimax_20261029 (e2e inventory + MiniMax-3.1-Flash video certification, 1 session)"
description: "Copy-paste into ONE fresh Reasonix session with this repo as its workspace. Runs all 82 browser_e2e suites live with full-video capture, then certifies every feature by sending its FULL video to MiniMax 3.1 flash through the official MiniMax API. Resume-safe; verification-only; never patches certificates."
tags: [conductor, track, e2e, minimax, video-certification, context-isolation]
---

# LAUNCH-PROMPT — e2e_feature_inventory_minimax_20261029

You are the **delegated verification+certification session** for conductor track
`e2e_feature_inventory_minimax_20261029`. Fresh context; the session that created this track
deliberately did NOT run the work. Your product is a verdict: 82 live e2e suite runs with
full-video evidence + 1 MiniMax certification per feature, written into the track's
`verdict.md` and `progress.jsonl`.

## HARD RULES (abort-and-report, never repair)

- You are VERIFICATION-ONLY over EXISTING test files. If a suite fails RED, do NOT edit the spec.
  Record it, continue, and still send its video to MiniMax (a red run is itself evidence the
  certifier should see).
- After all phases, `git status -- js/` and `git status -- manifest.json` and
  `git status -- test/` MUST be empty. Any mutation there = STOP, write the violation into the
  verdict, do not commit product/test state.
- Your own NEW code (the videography launcher, the MiniMax uploader) lives ONLY under this
  track's `execution/` directory — never beside js/, never in test/.
- Commit the track's artifacts with explicit paths (never `git add -A`), Conventional Commits
  message `docs(e2e-minimax): feature-inventory video certification verdict (<date>)`.
  NEVER push.
- Do NOT kill other reasonix/bot processes; do NOT touch `vendor/` (sync-governed) except to
  RUN `python vendor/housekeeping_guard.py check`.

## Phase 0 — Orientation + MODEL-ID PINNING (do this FIRST, before any run)

1. Read spec.md (esp. the Model-id pinning clause), metadata.json, plan.md,
   `test/browser_e2e/spec_inventory.json` (82 files / 432 tests / 88 js files), and
   `conductor/tracks/ux_feature_fleet_20261029/units.json` (the 18 feature -> spec map).
2. **Pin the certifier id.** The operator asked for "minimax 3.1 flash" through the OFFICIAL
   MiniMax API (api.minimax.ai). Resolve that to the exact model id the official API accepts —
   query the official model list/documentation and record the resolution process. If
   "3.1 flash" is not a name the official API exposes, record the mismatch verbatim, name the
   closest official id, and proceed with the official id — the verdict must show the resolution,
   never a silent substitution.

## Phase 1 — Videography launcher (AC-2 enabling)

Write `execution/run_inventory_e2e.js` (NODE, under this track dir) that reuses the harness's
own `launchExtensionContext` (see `test/browser_e2e/_helpers/dom.js`) with Playwright
`video: "on"` so EVERY suite runs in a context whose full video is retained on close. Run the
82 suites suite-by-suite (mocha programmatically per suite, or the harness's own boot path),
timeout 900 s per suite (package.json's test:e2e value). Retain videos at
`execution/evidence/<feature>/<suite>.webm` (feature = the units.json unit, or
`cross-cutting` for inventory files not mapped to a unit).

## Phase 2 — Sequential execution + recording (AC-1)

Append ONE progress.jsonl row per suite:
`{"suite":"<file>","feature":"<unit id or cross-cutting>","passing":N,"failing":N,"video":"<rel path>","ts":<epoch>}`

## Phase 3 — Evidence assembly (AC-2)

Confirm a full video exists for EVERY feature (18 units + cross-cutting). A feature with no
video fails AC-2 — recorded, not fabricated.

## Phase 4 — MiniMax certification (AC-3, AC-6)

For each feature, send its FULL video(s) to the pinned MiniMax model via the OFFICIAL MiniMax
API (api.minimax.ai), as VISUAL evidence of the feature working. Record per feature under
`execution/minimax/<feature>.json`: the endpoint used, the resolved model id, the request you
sent (redact the API key — never commit a secret), and the VERBATIM verdict text. Ask the model
to judge, from the video, whether the feature's e2e behavior visibly completes its intended
interaction (the suite's purpose — read the spec file's describe blocks to know what "working"
means for that feature). ONLY MiniMax judges; no proxy substitution without a verdict note.

## Phase 5 — Verdict (verdict.md)

Per-feature table (18 units + cross-cutting): mocha counts, video path, MiniMax verdict
(verbatim quote), regression flag vs the fleet's archived green, model-id resolution appendix.
Overall verdict line: e.g. "N/18 features certified working" + suite totals (x/432 passing).

## Pause rules (resume-safe)

Context pressure (the reason this track exists): commit progress.jsonl + a PARTIAL verdict
listing what ran, then end the turn cleanly. A relaunch resumes from the last progress row —
never redo a completed suite.
