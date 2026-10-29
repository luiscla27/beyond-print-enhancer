# Candidate A — adaptive fleet partition (ADOPTED)

**Mechanism:** the unit runs as one slice of a partitioned 18-unit fleet — an
exclusive component key (`js/dnd`), disjoint write paths, the fleet's shared
centralized audit instrument, integrator harvest control, and a per-unit
explicit-path landing commit by the integrator.

**Decision-bearing difference:** vs candidate B, this shape is the only one in
which the shared zero-click audit instrument exists exactly once AND every
unit's disjointness is witnessed across units by a single integration run — B
cannot produce either artifact by construction.

**Critical assumption:** the 18 units of 2026-10-29 form a batch that must land
together (operator-scoped as one UX feature fleet), so a per-batch
orchestration layer is real work, not overhead.

**Fastest falsifier:** the manifest cross-check probe — read the write-path
fields of all 18 unit manifests and test them pairwise for intersection; a
single shared path between two units falsifies the partition's disjointness
claim (measured 2026-10-29: empty intersection, and the integration-tree
snapshot `git status -- js/` read empty throughout the landing window).

**Primary failure mode:** a shared instrument becomes a single point of drift
if its central copy is edited ad hoc — mitigated by declaring it the single
locus (the anti-drift rule: one copy, no forks).

**Requirements covered:** fleet AC-1..AC-4 (certificate green, disjoint
writes, explicit-path landing, SHA recorded) plus the operator's verbatim
ownership rule.

**Measured results:** all four criteria met 2026-10-29; landing `f167c3f`;
disjointness proven live; full suite 2228 passing / 0 failing.
