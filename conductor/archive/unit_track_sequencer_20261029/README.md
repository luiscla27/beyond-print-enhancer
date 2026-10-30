# Track: Sequential unit-track re-verification fleet (unit_track_sequencer_20261029)

**Status:** COMPLETE — all 7 acceptance criteria met; execution was delegated to a SEPARATE
Reasonix session (see LAUNCH-PROMPT.md), which landed `sequencer_verdict.md` + `progress.jsonl`
(committed `f96349a`, 2026-10-29) proving 18/18 certificates green (648 live passing), full suite
green (2229/0), browser-gate collection green (432/82, zero drift), AC-4 disjointness proven.

**Operator directive (verbatim):** "Create new track to sequentially run all those tracks
on a separate reasonix session, that is meant so you don't run out of context on this session."

**What this track is:** a conductor track whose product is EXECUTION DELEGATION — it
launches one fresh Reasonix session that sequentially runs the 18 re-homed unit tracks
(`conductor/archive/feature_01_ai_arrange` … `feature_18_image_processor`) as live
verification runs, then files the verdicts. The tracks themselves are already COMPLETE
and archived (all four acceptance criteria met during `ux_feature_fleet_20261029`, landed
2026-10-29); this track exists because the operator asked for the runs to happen again,
in sequence, off this session's context budget.

**What it is NOT:** not a re-landing track. Nothing this track runs may commit product
code or certificates — the fleet already landed those (SHAs `1059ad3`…`f8755b0`, evidence
commit `49074da`, re-homing commit `8e8db91`). The sequencer's product is the verdict
file (`sequencer_verdict.md` + `progress.jsonl`), nothing else.

## Operating picture (node-meets-context baseline)

**Component:** the sequencer track itself (conductor record + delegated session).
**Primary obligations:** launch one fresh session; have it re-run all 18 certificates live
in order; have it file exactly two artifacts; verify no mutation occurred (AC-4).
**Supporting:** metadata.json (declared order + fleet landing SHAs); deliberation set
(fixed the execution shape before any launch); the archived unit tracks (read-only inputs).
**Verification owner:** the delegated session's live runs (primary), this session's guard
+ commit check (secondary).
**Interface:** LAUNCH-PROMPT.md / track_launcher.json (operator-facing); progress.jsonl
+ sequencer_verdict.md (output-facing).
**Required integration evidence:** the committed verdict + the guard's OK at close-out.
