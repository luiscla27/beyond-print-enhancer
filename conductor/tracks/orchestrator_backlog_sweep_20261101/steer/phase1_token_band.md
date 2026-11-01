ORCHESTRATOR TOKEN-BAND NOTICE (continue working in THIS session — do not create files yet)

Your session context is ~141k tokens = YELLOW band (green<100k, yellow 100-120k, red>150k).
The host orchestrator is watching your telemetry. Decision from orchestrator: you still
have real work left (finish the BEYOND-9 implementation, get G-PIX-OVERFLOW + G-PERSIST +
the extended e2e suite ALL GREEN, then commit + write final_report.md + verifier-seat-record.md).
That will likely push you toward RED. So:

1. Keep working in THIS session for now to push the three gates to GREEN and make the commit.
2. The moment you observe RED symptoms (turn failures, truncation, refusals, a request that
   comes back short, OR your context estimate crosses ~150k), STOP immediately at a clean
   boundary and write ORCHESTRATOR_HANDOFF.md in your track dir
   (conductor/tracks/beyond09_layer_three_state/ORCHESTRATOR_HANDOFF.md) containing EXACTLY:
   - every AC's status with proof (command + result + committed SHA or 'UNPROVEN'),
   - the exact next command(s) to run,
   - files opened/in-flight,
   - assumptions, anti-goals, what the next session must NOT do,
   - verification commands to re-run FIRST (idempotent),
   - the single next outCOME.
3. Do NOT recreate your todo list in the handoff (the next session rebuilds it from ACs).

Meanwhile: are the three gates GREEN right now? If bash-4's full e2e re-run is PASSING,
proceed to commit + close-out artifacts. If it is still RED/partial, say WHICH test fails
and keep iterating the implementation FIRST — gates before commit, commit before handoff.

Reply to this message in ONE line: either "GREEN: <gate summary>" or "RED-STILL: <which test>".
Then continue.
