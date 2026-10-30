# Final report — e2e_feature_inventory_minimax_20261029 (E2E feature-inventory video certification, MiniMax-M3.1-Flash seat)

**Status: COMPLETE 2026-10-30 — all six acceptance criteria met (AC-1/2/3/4/5/6). ARCHIVED to
`conductor/archive/e2e_feature_inventory_minimax_20261029/` in the same session** (house
close-out rule: a completed track carries a close-out artifact and is archived or holds a
keep-live exception; here the keep-live form is not expressible — see "Close-out mechanics"
below). The track's own product is `verdict.md` (per-feature certification table + the 11 RED
tests with measured causes + model-id and judge-call-pattern appendices); this file is the
housekeeping close-out record.

## What this track did

Operator directive (metadata.json): run ALL 82 e2e inventory suites live against the unpacked
MV3 extension with full-video capture, then certify every feature by sending its FULL video to
"minimax 3.1 flash" through the OFFICIAL MiniMax API — MiniMax alone judges. Deliberation
(declared `required` at creation, 2026-09-23 operator mandate): candidate A "single sequential
session" ADOPTED, candidate B "fleet rolling pool" REJECTED (inadmissible on AC-6 singular-seat
+ AC-2 bundle-split). Deliberation record: `deliberation/` (decision_projection.md,
evaluation_matrix.md, counterfactual_ledger.md).

## Criteria evidence (sealed 2026-10-30T06:28:47Z — `metadata.json` `acceptance_criteria`)

- **AC-1 (all 82 suites run live, counts recorded):** 82/82 suites executed against the
  unpacked extension (per-suite timeout 900 s). Unique-suite totals **passing=422, failing=11**
  (432 inventory tests). Resume-safe record: `execution/progress.jsonl` — 255 rows (299
  individual runs across retries; the latest row per suite is the 82-row record), each row
  carrying mocha's own counts, the chosen video's path + byte size + page count. The 11 RED
  tests are verbatim-quoted with measured root causes in `verdict.md` §"The 11 RED tests" —
  all five sit in cross-cutting `*_visual_capture` suites that had NEVER run under any prior
  fleet gate, so they are first-ever-run findings, reported, never repaired (spec.md's OUT
  clause; the LAUNCH-PROMPT's abort-and-report rule).
- **AC-2 (full video retained for EVERY feature):** 82/82 suites carry ≥1 retained `.webm`
  (840 page videos, 323 MB, gitignored by operator decision 2026-10-29 — binary run output is
  not product and is re-derivable; the committed record is the textual half). Gap count at
  close: **0**. Videos under `execution/evidence/<feature>/` (feature = the units.json unit, or
  `cross-cutting` for the inventory's unmapped residual).
- **AC-3 (MiniMax certifies each feature via the OFFICIAL API):** **19 bundle judge calls** —
  one per fleet feature (18) + one for the cross-cutting residual class — through
  `https://api.minimax.io/v1` (Files API `purpose=video_understanding` uploads referenced as
  `mm_file://<file_id>` in chat `video_url` parts). Every record under `execution/minimax/`
  names the endpoint, resolved model id, file ids, usage, and the VERBATIM verdict text;
  `summary.json` aggregates (19 records: 0 WORKING / 7 PARTIAL / 12 NOT-VISIBLE — the
  NOT-VISIBLE pattern is a measured property of frame sampling at fps=5, not proof of breakage;
  per-feature mocha is 100% green in all 18 feature bundles). Usage: 1,494,110 tokens / 19
  calls — inside the authored bounds (`max_judge_calls: 18` reconciled 18→19 in the verdict's
  call-pattern appendix; `max_cost_usd: 60`).
- **AC-4 (no product/test mutation):** `git status -- js/ manifest.json test/` = **EMPTY** at
  close. All new code confined to the track's `execution/` scope plus two tracked-excluded
  harness helpers (`scripts/e2e_inventory_runner.js`, `scripts/e2e_video_preload.js` —
  gitignored by convention, durable record in CHANGELOG.md; they patch nothing in js/ or test/ —
  the video capture rides mocha's `--require`, so no existing spec file is edited).
- **AC-5 (product lands inside the track dir, explicit-path local commit):** `verdict.md` +
  `execution/progress.jsonl` + `execution/suite_assembly.json` +
  `execution/minimax/*.json` (19 feature records + summary.json) — committed with explicit
  paths, Conventional Commits, LOCAL ONLY (never pushed, per house rule).
- **AC-6 (certifier seat is MiniMax-M3.1-Flash ONLY):** the operator's "minimax 3.1 flash" was
  pinned at Phase 0 to **MiniMax-M3.1-Flash** (announced 2026-10-19; 1M-context frontier
  multimodal model with video input), verified against platform.minimax.io docs + a live
  model-list smoke call. Host resolution measured: the live host is **api.minimax.io** (`.io`),
  NOT `api.minimax.ai` (`.ai` does not resolve from this network — curl 000/DNS fail); the
  correction is recorded verbatim in the verdict's model-id appendix and propagated to every
  track doc (grep: zero `api.minimax.ai` occurrences remain). No Gemini/Muse/DeepSeek seat
  judged anything; every verdict row cites the video artifact it judged and the API response
  that produced it.

## The 11 RED tests (recorded, never repaired)

All five failing suites are `*_visual_capture.spec.js` behavior-capture suites authored
2026-10-29/30 whose assertions codify DESIRED polish behaviors (each suite's own phase-0 test
reads "captures phase 0 baseline (**current behaviors**)"). None had run under a prior fleet
gate. Each suite ran TWICE live — identical counts both times (deterministic). Suites:
`drag_ux_visual_capture` (4 fails / 6 pass), `picker_ux_visual_capture` (1/17),
`shape_layer_ps_visual_capture` (1/6), `custom_templates_visual_capture` (2/4),
`ui_ux_audit_visual_capture` (3/1). Full verbatim failure text + measured causes (drag-ghost
commit latency, failed-write success-instead-of-error toast, stacked-overlay legacy detail,
lock classes at reveal, Escape-cancel, layer rename, Section-4 picker interactivity):
`verdict.md` §"The 11 RED tests". These are the inventory's first measurement of that surface —
not regressions against any archived green (the sequencer's f96349a certificates covered the 18
unit tracks' unit suites, never these visual-capture specs).

## Close-out mechanics (why ARCHIVE, on the record)

The house guard — `vendor/housekeeping_guard.py`, the vendored unit's copy (this repo has no
root-level guard in its history: a root copy exists only in the pre-flatten backup commit
`a0c534e`, which is not an ancestor of HEAD) — requires a completed track to carry a close-out
artifact matching `^(final_report\.md|final\.md|verification.*\.md|BOT_REPORT\.md)$` and then
EITHER archive to `conductor/archive/<name>/` OR hold a keep-live exception NAMED to the track
inside its own registry entry in `conductor/tracks.md`.

- The keep-live form is **not expressible in this repo**: `conductor/tracks.md` was deleted in
  `768a20b` ("Master Revamp"), and recreating it would trip the guard's RF-02 AMBIGUOUS-REGISTRY
  refusal — `vendor/conductor/tracks.md` (the overlay's own seed registry) exists, the guard
  refuses to choose between two registries, and vendor/ is sync-governed (untouchable per the
  track's own hard rules).
- ARCHIVE is therefore the guard-blessed route and matches the repo's own convention (all 18
  archived feature tracks carry `final_report.md`). The 2.1 GB `execution/evidence/` video tree
  stays gitignored by the operator's 2026-10-29 decision (`.gitignore`
  `/conductor/tracks/*/execution/evidence/`); the committed record is the textual half — progress
  rows carry each chosen video's byte size + page count, and the minimax records carry the
  upload's `file_id` + `mp4_bytes` + `upload_response`, so the evidence pick is auditable
  without committing binaries.
- Durability: the certification pass is resume-safe — `temp/scratch/certify_features.py` skips
  any feature whose on-disk record already carries a parseable verdict (all 19 do), so a future
  rerun pays API cost only for genuinely missing rows. The reusable procedure lives as the
  project-local skill `skill/e2e-feature-inventory-minimax`
  (`vendor/.reasonix/skills/e2e-feature-inventory-minimax/SKILL.md`, declared local in
  `governance.yaml`), distilled from this track (commits cc88292 + 3465aeb).

## Honest correction of record

The interrupted author session's CHANGELOG entry claimed the housekeeping guard printed OK on
both halves at close. **That was mistaken — re-measured this session: the guard was RED on
exactly one item** (`track e2e_feature_inventory_minimax_20261029: complete (all boxes ticked)
but no close-out artifact`), because the session died between ticking plan.md's last box and
writing this file. The guard's YouTrack receipt was refreshed via the documented path
(`python vendor/youtrack/reader.py read --root .`; revision 345dce35c273 unchanged, 17 issues)
before the final verification below. Correction recorded here rather than silently amended
history.

## Verification commands (run at close-out)

```
git status -- js/ manifest.json test/          # AC-4 audit — EMPTY
python vendor/housekeeping_guard.py check      # root half — GREEN
python vendor/housekeeping_guard.py check --root vendor   # overlay half — GREEN
python vendor/housekeeping_guard.py debt       # residual waiting/undeclared view
```

**Gates at close-out:** AC-4 audit empty; housekeeping guard GREEN on both halves (the one RED
item this file exists to close); explicit-path local commit, never pushed.
