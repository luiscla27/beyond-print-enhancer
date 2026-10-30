# Decision projection — unit_track_sequencer_20261029

**Decision id:** unit-track-sequencer-execution-delegation-20261029
**Locked invariants:** the 18 unit tracks in `conductor/archive/feature_*/` are read-only inputs (certificates landed under SHAs `1059ad3`…`f8755b0`, commit 49074da, re-homing commit 8e8db91 — never edited by this track); exactly one separate Reasonix session executes; exactly two artifacts return (`sequencer_verdict.md`, `progress.jsonl`); no `js/**`, `manifest.json`, or test file is ever modified (AC-4 aborts); the run order is `metadata.json` `execution.track_order`
**Chosen candidate:** candidate_a.md
**Expected observable outcomes:** 18 per-track mocha rows in `sequencer_verdict.md`, each green or a named RED with a delta-track recommendation; one full-suite row (expected 2228 passing / 0 failing / 1 pending — pre-existing release_gate skip-by-design, any other count is itself a finding); one browser-gate inventory row green; `git status -- js/` empty at start AND end
**Retained alternatives:** candidate B retained under ledger recall condition 1 (session-budget exhaustion → 9+9 split, never the 6-wide pool); in-session 3-track pilot retained under recall condition 2 (launcher impossible)
**Obligations:** the delegated session owes per-track LIVE execution (not citation of archived results), the abort-on-modification check (AC-4), and the resume-safe pause rules; this track's owning session owes the launcher artifacts and the close-out guard check
**Cross-cutting:** session-context budget (the reason the track exists) is tracked by the delegated session's own pause rules, not by repo-level instrumentation
