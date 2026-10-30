# Evaluation matrix — e2e_feature_inventory_minimax_20261029 execution shape

**Basis:** admissibility FIRST against the sealed criteria in `conductor/archive/e2e_feature_inventory_minimax_20261029/spec.md`, then utility (which admissible candidate costs less / fails less often). The rubric below is applied to both candidates in the same order, so a candidate that cannot satisfy [AC-6] or [AC-2] is eliminated before any cost comparison — ranking an inadmissible candidate is a confidently wrong decision. **Basis tie:** the track's sealed acceptance criteria from that spec.md: [AC-1]=464bbfa24882, [AC-2]=6e0da1fc0955, [AC-3]=eb4c2b44e27a, [AC-4]=40706b96b470, [AC-5]=3922b306bf80, [AC-6]=f5839229ee99 — the rubric's rows are those six criteria verbatim.

Both candidates were drafted from `spec.md` alone, before either was compared with the other.

## Admissibility rubric (requirement satisfaction)

| Requirement | Candidate A: single session | Candidate B: fleet rolling pool |
|---|---|---|
| [AC-1] all 82 suites live, per-suite counts recorded | ADMISSIBLE — sequential, one row per suite | ADMISSIBLE — parallel, per-shard rows |
| [AC-2] one FULL video per feature, bundle integrity | ADMISSIBLE — the session owns the whole bundle | INADMISSIBLE — multi-spec features split across shards need a merge artifact first |
| [AC-3] each feature certified by MiniMax against its full video | ADMISSIBLE | PARTIAL — depends on B's merge artifact being accepted as evidentially equal |
| [AC-4] no js/, manifest.json, or existing test file mutated | ADMISSIBLE — new code confined to track execution/ | ADMISSIBLE — same confinement, but N sessions each must respect it |
| [AC-5] verdict.md + progress.jsonl in the track dir, resume-safe | ADMISSIBLE — last row is the resume point | PARTIAL — needs cross-session merge resume state |
| [AC-6] MiniMax-3.1-Flash as the ONE certifier seat | ADMISSIBLE — one session, one seat | INADMISSIBLE — N sessions = N concurrent certifier instances |

## Verdict for Candidate A — single session, sequential

**Verdict (for: candidate_a_single_session_sequential.md):** ADMISSIBLE on all six sealed
criteria — it is the only candidate that satisfies [AC-6] (one MiniMax seat, singular and
contiguous with the capture) and [AC-2] (one agent owns the whole per-feature video bundle)
without a new coordination artifact. **Verdict (for: candidate_a_single_session_sequential.md):**
ADOPTED at utility stage — its cost (serial upload chain) is mitigated by bundling per feature
and the pause rule; its failure mode (context exhaustion) is mitigated by progress.jsonl rows.

## Verdict for Candidate B — fleet rolling pool

**Verdict (for: candidate_b_fleet_rolling_pool.md):** INADMISSIBLE — eliminated at the
admissibility stage on [AC-2] (bundle integrity: at least 4 of the 18 fleet units own more than
one e2e spec file, so any N>1 sharding splits those features and forces a coordinator merge
before MiniMax ever sees the whole video) and [AC-6] (singular certifier seat: N parallel
sessions are N concurrent MiniMax instances, violating the operator directive's "the ONE to
certify").

**Verdict (cross-record, for: evaluation_matrix.md):** Candidate B ELIMINATED at admissibility;
Candidate A ADOPTED. Stage-2 utility was therefore evaluated for Candidate A alone (cost: serial
~18-bundle upload chain, mitigated by per-feature bundling + pause-resume; failure mode: context
exhaustion, mitigated by progress.jsonl externalization).

## Not carried as candidates (recorded, not a straw rival)

A model substitution (certifying with a different provider) is not a variant of THIS decision:
[AC-6] names MiniMax-3.1-Flash as the certifier by operator directive, so the alternative is a
different decision the operator did not make. Recorded here rather than padded into the candidate
set.
