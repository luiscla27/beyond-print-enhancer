# Spec — Sequential unit-track re-verification fleet (unit_track_sequencer_20261029)

**Status:** IN PROGRESS — execution delegated to a separate Reasonix session.

## Audit evidence (mandatory section)

- `conductor/archive/feature_01_ai_arrange` … `feature_18_image_processor` — the 18
  re-homed unit tracks (commit 8e8db91, 162 files), each COMPLETE with sealed criteria,
  landed certificate SHAs (fleet run commit 49074da).
- `conductor/tracks/ux_feature_fleet_20261029/fleet/runtime/progress/*.jsonl` — the
  original per-track progress records this sequencer re-verifies against.
- `test/unit/*.test.js` + `test/browser_e2e/spec_inventory.json` — the live certificates
  on the current tree (the current HEAD is the object under test).
- The operator directive itself: re-run all those tracks on a separate session so THIS
  session does not run out of context. Nothing in this spec invents new work; the work
  product is a fresh, live verdict on the archive.

## Acceptance criteria (SEALED 2026-10-29T17:30:00Z, before any execution)

- **AC-1** — a separate Reasonix session (fresh context, not the session that created
   this track) is launched by the launcher and executes ALL 18 unit tracks sequentially,
   in the order in `metadata.json`'s `execution.track_order`.
- **AC-2** — every unit track's certificate files are executed live with `npx mocha`
   and the result (pass/fail/count) is recorded per track in `sequencer_verdict.md`.
- **AC-3** — the full unit suite is re-run live once, after the per-track runs
   (`npx mocha --recursive test/unit --timeout 30000`), final counts recorded.
- **AC-4** — no file under `js/**`, no `manifest.json`, and no test file is modified by
   the sequencer run (`git status -- js/` must remain empty; any modification aborts the
   run and is reported in the verdict).
- **AC-5** — the sequencer session writes exactly two artifacts:
   `sequencer_verdict.md` and `progress.jsonl` (both inside this track's directory) —
   nothing else is committed.
- **AC-6** — `python vendor/housekeeping_guard.py check` reports no issue/track debt
   attributable to this track at close-out.
- **AC-7** — the run lands as a local commit only (Conventional Commits, explicit
   paths, never `git add -A`), no push.

## Scope boundary

- **Verification only.** The unit tracks' certificates were already authored and landed;
  this track re-executes them against the CURRENT tree and records whether they still
  pass. It must not re-author, re-land, or patch anything.
- `test/browser_e2e/spec_inventory.json` gate (`node scripts/browser_gate.js`) is run
  once as part of AC-3, since several unit certificates feed it.
- Out of scope: the Playwright E2E suite (`test/browser_e2e/print_styles.spec.js`)
  requires the unpacked extension; it is recorded as "not runnable headless" in the
  verdict rather than attempted.

## Non-goals

- Re-running the original fleet (`ux_feature_fleet_20261029`) — that run already landed.
- Re-ratifying product decisions — the archive holds them; this track only re-measures.
