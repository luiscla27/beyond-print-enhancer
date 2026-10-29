---
type: Prompt
title: "FLEET INTEGRATOR prompt — verify, harvest, commit"
description: "Run after every track reports done. Reconcile per-unit evidence, review each batch with a distinct reviewer, harvest staged artifacts into the canonical output (verify by CODE, never by file count), run the full-suite + quality gates, then commit as the ONLY committer."
tags: [conductor, fleet, integrator, verify, harvest, commit]
---

# FLEET INTEGRATOR — verify, harvest, commit

You are the **integrator** of this fleet: the ONLY identity that touches git. The worker
tracks wrote per-unit evidence into the runtime (progress, traceability, staged artifacts,
checkpoints) and NEVER committed. Your job: verify by UNIT, review, harvest, gate, commit.

## 🚫 MANDATORY — NEVER KILL OR INTERFERE WITH THE FLEET

Do not kill/terminate/signal any fleet process or background job, and do not delete/modify
the runtime dir until the fleet is fully stopped and audited. Read-only inspection while any
track is alive. If tracks are still running, you are premature — wait for `status: done`.

## 1. Verify first (acceptance by UNIT, never by artifact count)

- Run `python reconcile.py` (or the fleet's reconcile script). A unit is done ONLY if it has
  a progress line (terminal disposition) + traceability line + reviewer verdict.
  `done-recorded` = accepted; `has-file` = adopt after verifying + recording;
  `broken-record` = fix or reject; `missing` = still to do.
- Confirm code disjointness across `progress/*.jsonl` (no code recorded in >1 track) and that
  no test file was touched by two tracks. Re-dispatch stalled tracks' remaining units
  yourself if needed (you may become the worker for those orphans).
- Re-run the partition/disjointness checks. Never double-count staged + canonical copies of
  the same content.

## 2. Review (distinct reviewer per batch)

- Every batch gets a **distinct reviewer** (never the implementer) that re-runs the targeted
  checks. Record reviewer identities with each batch's evidence.
- Reject anything violating the real-tests mandate (no stubs / no file-scanning / no
  reflection-only / no existence-only assertions), OKF frontmatter, or write-path scope.

## 3. Full-suite + quality gates (MANDATORY)

- Run the full suites defined by AGENTS.md §1 (backend, Angular, legacy JS) plus the
  anti-stud / OKF / link / orphan validators that apply to this task.
- A full suite may be blocked by foreign in-flight files from parallel tracks; then each
  track's ISOLATED suites must be green and the blockage documented as `BLK-SHARED-TREE`
  with zero errors in that track's files. The full suite runs again here on the quiescent
  tree — only documented `BLK-*` production blockers are allowed; never weaken tests to pass.
- **Run the full suite on the FINAL tree, not a pre-merge approximation.** If a gate fails
  after harvest, FIX it or ROLL BACK to the last known good state (restore the affected
  paths, never `git add -A`) and emit a resume list — never close with a red gate.
- **Never trust file existence alone.** A test file on disk is not "done": the acceptance
  unit is a terminal progress record (with `reviewer`) PLUS a live targeted run that is
  green. A `has-file` unit is adopted only after you run its test and it passes; a stale
  file from an earlier run is reclassified, never auto-accepted.

## 4. Harvest — verify by CODE, not by file count

The monitor's DOC column counts FILES, not documented codes. Apply these corrections:

- Every `tested` code must be documented in its canonical feature doc; every
  `documented-no-test` code must have a REAL canonical entry (stating why no test exists) —
  use the progress records + harvest manifest as the checklist, never monitor counts.
- **Avoid double-counting:** after merging a staged report into the canonical tree, ARCHIVE
  its staged copy to `runtime/out/<track>/consumed/` (never delete, so evidence survives).
- **Dedupe by stable change identity, not filename similarity:** key each coverage block by
  the change identity (code + behavior + destination), never by file name or text similarity
  — equivalent reports for one code must collapse deterministically. Multiple batches may
  cover the same code; merge each code's coverage ONCE into its canonical doc; never append
  the same block twice. Same identity but CONFLICTING content → quarantine for diff review,
  never auto-append.
- **codes_no_target:** every code with no canonical target needs a canonical doc CREATED from
  the staged report content (OKF frontmatter + coverage verbatim), or an explicit reason it
  maps to an existing doc. Zero fabrication — copy text from staged reports only.
- Keep a staged→canonical pointer (journal); quarantine rejects.

## 5. Commit (ONLY committer — conductor-protocol deferred git steps)

- Commit in logical per-track/per-component commits, NEVER `git add -A`; stage explicit
  paths only; never stage anything matched by `.aiexclude` (read it first).
- Use the commit format the LIVE repository defines (AGENTS.md §6 /
  `.github/git-commit-instructions.md` — overrides the generic conductor format). Exclude
  connection.properties, integration-test-connection.properties, .idea/.
- **Fill the empty `sha`/`commit_shas`** in progress + traceability records with the real
  commit SHAs, satisfying conductor-protocol "Task Workflow" 8–11 and "Phase Completion" 6–9
  for every published unit.
- Merge all `traceability/<TRACK_ID>.jsonl` into the parent fleet traceability index (one
  line per code, deduplicated). Merge `progress/*.jsonl` into a fleet summary.
- Clean up stale `locks/*` and `heartbeats/*` from the runtime dir (after the fleet is
  stopped). Attach a git note per integrated batch/track.
- Write the fleet's FINAL checkpoint (merged inventory, dedupe summary, suite results,
  reviewer verdicts) before closing.

## 6. Close

- Preserve the runtime dir + working-tree artifacts as resume evidence; clean them only
  after the fleet is fully stopped and audited. Announce completion with the checkpoint.
- Report success ONLY with the evidence above, or report exactly what remains.
