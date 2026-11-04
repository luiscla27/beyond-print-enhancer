# Counterfactual ledger — unit_track_sequencer_20261029

Every rejection with its recall condition.

1. **Rejected: candidate B (parallel pool across sessions).**
   Reason: fails the directive's singular-session clause and AC-5 (multi-writer artifact
   collision), and imports the fleet's lock/heartbeat/merge machinery for a verification
   run that needs none of it.
   **Recall condition:** if candidate A's falsifier fires (the delegated session cannot
   finish all 18 inside its budget — resume rules then produce a partial verdict), a
   2-session split of 9+9 (NOT the 6-wide pool, which is 3x the machinery for the same
   rescue) becomes admissible; recall is per-split, not per-pool.
2. **Rejected: running the 18 verifications inside the session that created this track.**
   Reason: that session is exactly the one whose context is exhausted (the operator's
   directive names it); a fresh session has full budget for the ~10-line-per-track
   summaries this run produces.
   **Recall condition:** if the separate session fails to launch at all (operator
   environment does not allow spawning reasonix.exe), the creating session may run a
   3-track pilot (tracks 01-03) to prove the certificate commands still pass, then stop —
   a partial live proof beats a stale citation.
3. **Rejected: re-landing or re-authoring certificates if a track comes back RED.**
   Reason: the fleet already landed those certificates (SHAs in metadata.json); a RED
   verdict is a finding to REPORT (and, if confirmed real, a NEW track on the delta),
   never a patch inside the verification run — patching while verifying destroys the
   measurement (AC-4 aborts on any test-file modification).
   **Recall condition:** recall applies only to a NEW track opened on a confirmed delta;
   the sequencer itself stays verification-only.
4. **Rejected: including the Playwright E2E (print_styles) as a runnable check.**
   Reason: it requires the unpacked extension and cannot run headless here; attempting it
   would produce a false RED.
   **Recall condition:** an operator with the unpacked extension may re-run just that row
   and amend the verdict by a follow-up commit (explicit paths, AC-7 shape).
