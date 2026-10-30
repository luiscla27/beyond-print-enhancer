# Decision projection — execution shape for e2e_feature_inventory_minimax_20261029

**Decision id:** e2e_feature_inventory_minimax_20261029-execution-shape-20261029
**Scope:** `alternatives` — the execution shape of the e2e inventory run and video
certification fleet (one session vs. a fleet pool). The evidence class (full video) and the
certifier (MiniMax-3.1-Flash via the official API) are NOT re-decided here; they are operator
directives this decision must honor.

**Basis tie:** the operator directive's own words — "make minimax 3.1 flash as the one to
certify" (singular certifier seat), "Send him full videos" (whole-video evidence class), "all
features inventory" (the 82-file inventory, not the 18-unit subset) — projected onto the track's
sealed acceptance criteria from `conductor/tracks/e2e_feature_inventory_minimax_20261029/spec.md`:
[AC-1]=464bbfa24882, [AC-2]=6e0da1fc0955, [AC-3]=eb4c2b44e27a, [AC-4]=40706b96b470,
[AC-5]=3922b306bf80, [AC-6]=f5839229ee99. AC-6 binds the seat, AC-2 binds the evidence class,
AC-1 binds the scope.

**Chosen candidate:** candidate_a_single_session_sequential.md — one delegated session,
sequential, POOL_SIZE=1 (as judged by the ADMISSIBLE verdict in
`deliberation/evaluation_matrix.md`, where candidate_b_fleet_rolling_pool.md was eliminated on
[AC-2] and [AC-6]).

**Locked invariants:** (1) the certifier is exactly one MiniMax seat per certification, singular
and contiguous with the capture; (2) every feature's evidence is one full-video bundle owned by
one agent, never a cross-session merge; (3) the 82 inventory spec files are read-only inputs —
no js/, manifest.json, or existing test file is written by the run ([AC-4]); (4) the track's
product is verdict.md + progress.jsonl inside the track directory, resume-safe from the last
progress row; (5) the requested model id "minimax 3.1 flash" is pinned to the exact id the
official api.minimax.io accepts, with the resolution (or mismatch) recorded — never a silent
substitution.

**Expected observable outcomes:** 82 progress.jsonl rows (one per suite, each with its mocha
counts and video path); 18+ feature bundles under execution/evidence/, each a full Playwright
video; execution/minimax/<feature>.json per feature carrying the API request (key redacted),
the resolved model id, and the verbatim verdict; a verdict.md table with mocha counts, video
citations, MiniMax verdicts, and regression flags; a commit whose diff touches only this track's
directory.

**Retained alternatives:** candidate_b_fleet_rolling_pool.md — REJECTED, recallable if the
operator re-words the singular-certifier directive, or if the official MiniMax API is confirmed
to accept multi-video batches with per-video verdicts per request. Not carried: substitute
certifier model (recall: a new directive naming a different id), screenshot-strip evidence
(recall: operator accepts stills), unit-subset scope (recall: operator narrows scope).

**Component-identity reading:** the certifier seat (pinned MiniMax model via the official API)
is the track's one identity-bearing component; the videography launcher and MiniMax uploader
are NEW project-local code confined to this track's execution/ directory; the inventory specs
are read-only inputs. Write-dir ownership: none — verification-only ([AC-4] aborts on any
violation).

**Projection recorded at creation** (fleet rule 2026-09-23): the decision is declared now, in
the same change that creates the track, with its full deliberation set in deliberation/ — not
retro-declared at close-out.
