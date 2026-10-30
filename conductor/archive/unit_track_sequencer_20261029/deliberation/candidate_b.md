# Candidate B — parallel pool of Reasonix sessions (fleet style, POOL_SIZE=6) (NOT ADMITTED)

**Mechanism:** relaunch the proven rolling-pool machinery described in conductor/tracks/ux_feature_fleet_20261029/fleet/launch_tracks.py (POOL_SIZE=6, heartbeat/lock/deferral protocol, per-track workspaces under the user-profile reasonix-fleet-workspaces dir) — and verify the 18 tracks concurrently across six sessions.

**Decision-bearing difference:** faster wall-clock, but it reintroduces the machinery cost the operator's directive exists to avoid: per-track workspaces, heartbeats, locks, deferrals, a launcher script, and — critically — 6 simultaneous sessions each writing into the SAME track directory (AC-5 pins exactly two artifacts from ONE session; a pool needs the fleet's runtime merge-and-report step, which this track deliberately does not re-import).

**Critical assumption:** the work is trivially parallelizable (the tracks are disjoint). True — but disjointness was never the problem; context budget and artifact simplicity were, and the pool is strictly worse on both.

**Fastest falsifier:** the close-out gate run on a pool-run tree is the measurement: the housekeeping check would surface multi-writer evidence (partial concurrent progress.jsonl fragments or AC-5 violations from files beyond the two expected artifacts), which no single-session run can produce; if a pool never executes so the gate cannot observe anything, the option stays inadmissible by shape, not by measurement.

**Primary failure mode:** artifact collision and merge debt — 6 sessions writing verdict fragments into one track directory, exactly the class the fleet's runtime merge machinery existed to solve (and exactly what this track must not rebuild for a verification-only run).

**Requirements covered:** AC-1 partially (separate sessions, but not "a" session); AC-2/AC-3 yes; AC-4 yes (locks); AC-5 violates as designed (many writers); AC-7 needs a merge commit the house template does not cover for verdict files.
