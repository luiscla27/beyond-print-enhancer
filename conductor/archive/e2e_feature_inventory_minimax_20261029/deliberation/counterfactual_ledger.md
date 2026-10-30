# Counterfactual ledger — e2e_feature_inventory_minimax_20261029

Every rejection carries the requirement it failed AND the condition that would recall it.
A rejection with no recall condition is a deletion — none here is deletion-only.

## Candidate B — fleet rolling pool (N parallel sessions) — REJECTED

**Recall condition:** the operator re-words the directive to allow multiple certifier seats, OR
the official MiniMax API is confirmed to accept a multi-video batch per request with per-video
verdicts in one call (in which case B's shards collapse back to one seat anyway, so B returns
only under a literal re-interpretation of "pool").

- **Failed requirement 1 — [AC-6] (singular certifier seat; sealed hash f5839229ee99):** the
  operator directive says "make minimax 3.1 flash as the one to certify". N parallel sessions
  each holding a MiniMax seat makes the certifier N concurrent instances, a class-of-one
  violation.
- **Failed requirement 2 — [AC-2] (bundle integrity; sealed hash 6e0da1fc0955):** a feature's
  full-video evidence would be produced by shards in different sessions; at least 4 of the 18
  fleet units own more than one e2e spec file (feature_03: 2 specs; feature_07: 3 specs;
  feature_17: 3 specs), so the coordinator must merge shards before MiniMax sees the feature —
  a new coordination artifact the sequential shape does not need.

**Recall condition (for: candidate_b_fleet_rolling_pool.md):** as stated at the head of this
section — the singular-seat directive must be re-worded by the operator, or MiniMax's official
API must expose a one-request multi-video batch verdict endpoint.

## Not carried — substitute certifier model — NOT SELECTED

**Recall condition:** the operator explicitly names a different model id in a new directive.

- **Failed requirement — [AC-6] (sealed hash f5839229ee99):** AC-6 names MiniMax-3.1-Flash as
  the certifier, per the operator's directive. Substituting a different model is a different
  decision, not an alternative answer to the execution-shape question, so it was never carried
  in this deliberation.

## Not carried — screenshot-strip evidence instead of full video — NOT SELECTED

**Recall condition:** the operator accepts stills as equivalent (directive re-word).

- **Failed requirement — the operator directive ("Send him full videos"):** a strip of stills is
  a different evidence class; Playwright's video capture is strictly more evidence, not less.

## Not carried — run only the 18 fleet-unit spec files — NOT SELECTED

**Recall condition:** the operator narrows the scope to the 18 fleet units explicitly.

- **Failed requirement — the operator directive ("all features inventory"):** it names the whole
  inventory — 82 files / 432 tests per the committed `test/browser_e2e/spec_inventory.json`;
  the 18-unit subset covers only ~24 files.

**Accepted-risk note on the ADOPTED candidate (not a rejection):** A's serial upload chain is its
principal cost. It is accepted because the directive made the certifier singular by fiat; the
plan's Phase 4 bundles per FEATURE (not per suite) so the chain length is the feature count, and
the pause rule keeps an interrupted chain lossless.
