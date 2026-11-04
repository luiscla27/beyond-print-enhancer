# Evaluation matrix — unit_track_sequencer_20261029

**Basis (declared before any verdict, fixed from in-repo evidence `conductor/tracks/unit_track_sequencer_20261029/metadata.json` `operator_directive` field + the creating session's context-exhaustion receipt in this session's own transient record, weights fixed here):** the operator's directive itself fixes the two non-negotiables — (1) a SEPARATE session, (2) sequential execution, (3) explicitly to preserve the creating session's context; the measurable weights come from the house's own prior evidence — the creating session's compaction failure on 2026-10-29 ("context summary failed: compaction ladder exhausted") and the fleet's measured pool-machinery cost (`conductor/tracks/ux_feature_fleet_20261029/fleet/launch.bat` + `conductor/tracks/ux_feature_fleet_20261029/fleet/launch_tracks.py`, POOL_SIZE=6 rolling pool). Weights: context discipline 0.35, artifact simplicity 0.25, wall-clock 0.15, machinery reuse 0.15, merge/collision risk 0.10.

### candidate_a.md

- **Component subject:** one fresh Reasonix session, sequential order (POOL_SIZE=1), resume-safe at every track boundary via progress.jsonl.
- Meets the directive verbatim: one separate session, sequential execution. Context discipline: full (verdicts accumulate linearly). Artifact simplicity: exact (two files, one writer). Wall-clock: slower but irrelevant for a verification run. Machinery: none beyond a launcher prompt. Collision risk: zero (single writer).
**Verdict (for: candidate_a.md):** ADMITTED — adopted; the single-session shape is the only option meeting the operator directive verbatim while keeping AC-5's exactly-two-artifacts contract.

### candidate_b.md

- **Component subject:** relaunch the fleet's rolling-pool machinery (POOL_SIZE=6, heartbeat/lock/deferral protocol from `conductor/tracks/ux_feature_fleet_20261029/fleet/launch_tracks.py`) across six concurrent sessions.
- Beats candidate A on wall-clock only. Fails the directive's own clause ("a separate reasonix session" — singular) and AC-5 as designed: six writers into one track directory each emit verdict fragments, importing the fleet's runtime merge-and-report machinery this track must not rebuild for a verification-only run.
**Verdict (for: candidate_b.md):** NOT ADMITTED — inadmissible for this run; admissible only under ledger recall condition 1 (the sequential-budget falsifier firing), and then as a 9+9 split, never the 6-wide pool.

**Attribution:** each verdict sits under its own `### candidate_*.md` heading (the heading is the attribution anchor), names its subject, and declares after the basis block that predates both verdicts. A clean-matrix question is distinguishable from an empty one because the verdict markers exist in both sections.
**Basis tie:** this evaluation is sealed against the track's own acceptance baseline AC-1 through AC-7 (criteria #1-#7 of the 2026-10-29 seal stored in metadata.json) - the weights grade how each candidate serves those seven locked criteria and the verdicts bind to the same baseline, so any criteria edit re-opens this matrix by construction.
