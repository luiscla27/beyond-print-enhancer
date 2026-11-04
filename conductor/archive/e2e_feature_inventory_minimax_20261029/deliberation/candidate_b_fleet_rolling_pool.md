# Candidate B — fleet rolling pool: several sessions, one per feature batch

**Mechanism:** Spawn the fleet pool (the `fleet-delegation` skill's rolling pool): partition the
82 suites into N feature batches, run N sessions in parallel, each session booting its own
video-capturing Chromium contexts, each uploading its batch's videos to MiniMax concurrently; a
coordinator session merges the per-batch verdicts into one `verdict.md` and one `progress.jsonl`.

**Decision-bearing difference:** the work is partitioned across N agents rather than owned by
one, and a MERGE step becomes a first-class artifact of the run. The certifier is N concurrent
MiniMax instances rather than one contiguous seat.

**Critical assumption:** a feature's full video evidence can be assembled by a coordinator from
shards produced by different sessions without weakening the "full video of the feature" claim —
i.e. that a merged bundle is evidentially equal to a bundle captured by one session.

**Fastest falsifier:** the shard-split probe — take units.json's feature→spec mapping and run a
sharding simulation (`execution/probe_shard_split.js`: for N shards, assign the 82 inventory
files round-robin and count how many features' spec sets span more than one shard). Measured
today on the static mapping: at least 4 of the 18 units own more than one e2e spec file
(feature_03: 2 specs; feature_07: 3 specs; feature_17: 3), so ANY N>1 sharding splits those
features — the merge artifact is unavoidable, and the singular-seat reading is broken. If a
future inventory made every feature exactly one spec file AND the operator re-words the
directive, the probe would return "0 split features" and B could return.

**Primary failure mode:** the coordinator becomes a second judge — it decides which shard videos
constitute "the feature" before certification — so the operator's singular-certifier directive is
violated structurally, not just nominally. Secondary: cross-session resume state must merge,
which is a new artifact class with its own correctness question.

**Requirements covered:** AC-1 (parallel execution — the only requirement it satisfies better
than A); FAILS AC-2's bundle integrity (merge artifact needed) and AC-6's singular seat (N
concurrent certifier instances).
