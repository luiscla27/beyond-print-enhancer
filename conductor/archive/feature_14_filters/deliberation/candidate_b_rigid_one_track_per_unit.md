# Candidate B — rigid one-track-per-unit atomic delivery (REJECTED for the batch run)

**Mechanism:** each unit gets exactly its own conductor track and writes
nothing outside it — no fleet wrapper, no shared instrument, no integrator,
no cross-unit orchestration.

**Decision-bearing difference:** vs candidate A, B natively produces the
per-unit canonical record with zero orchestration, but it has no mechanism to
write the shared audit instrument once (18 copies) and no cross-unit
disjointness witness — its failure modes are structural.

**Critical assumption:** a batch of 18 units is best executed as 18 independent
atomic tracks — an assumption the 2026-10-29 batch falsified by needing the
same instrument and the same close-out arithmetic 18 times over.

**Fastest falsifier:** the browser-gate inventory check — the gate's
`spec_inventory.json` census (`scripts/gen_spec_inventory.js`, read-only)
would show 18 divergent audit-instrument copies under B (one per track) versus
the single canonical one the partitioned run shipped; a census count above one
falsifies B's single-locus promise.

**Primary failure mode:** instrument duplication — 18 parser copies drifting
independently, precisely the class the centralized instrument was built to
prevent.

**Requirements covered:** fleet AC-1..AC-4 for the unit in isolation, nothing
that spans units.

**Why inadmissible for the 2026-10-29 run — and NOT a constraint violation:**
the "no code touched by two units" rule was tested verbatim and held with ZERO
violations under BOTH shapes; the constraint is not what ruled B out. Batch
shape is. B remains the correct shape for a SINGLE isolated unit with no batch
siblings — the state of any future re-run of this unit.
