# Candidate A — one separate Reasonix session, sequential order (ADOPTED)

**Mechanism:** the operator's own framing (declared in-repo at `conductor/tracks/unit_track_sequencer_20261029/metadata.json`, `operator_directive` field) — a single fresh Reasonix session runs the 18 unit tracks one after another (POOL_SIZE=1, no parallelism), off the creating session's context budget.

**Decision-bearing difference:** vs candidate B (parallel pool), sequential execution trades wall-clock speed for context discipline: the delegated session's context grows linearly (one verdict at a time) and its pause rules make it resumable at any track boundary (`progress.jsonl`); vs running inside the creating session, it removes the context-exhaustion risk entirely (the creating session's own receipt: "context summary failed: compaction ladder exhausted without a shippable candidate") instead of managing it.

**Critical assumption:** one session's context budget comfortably holds 18 mocha summaries + 1 full-suite run (min reporter keeps per-track output ~10 lines, full-suite output ~10 lines). This assumption was already falsified once on the creating session — but that session carried the entire fleet-creation context, which the fresh session never loads.

**Fastest falsifier:** the progress-row count is the measurement: if the delegated session hits context pressure before track 10 and pause rules produce a partial progress.jsonl artifact holding fewer than 18 rows, the linear-context assumption is falsified; resume rules still hold, but the operation should then be re-issued as 2 sessions of 9 tracks (stated as a fallback shape, not executed).

**Primary failure mode:** silent drift — the session edits a certificate "to make it pass" (AC-4's git-status guard exists precisely to catch this: any modified test file aborts the run and is reported).

**Requirements covered:** operator directive verbatim ("separate reasonix session"); AC-1 (fresh session, sequential), AC-2/AC-3 (live re-verification), AC-4 (no mutation), AC-5/AC-7 (exactly two artifacts, one local commit).
