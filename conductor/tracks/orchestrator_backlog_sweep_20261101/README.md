<!--
  ORCHESTRATOR BACKLOG SWEEP — fleet deck for the sequential external-session execution of
  this project's YouTrack (BEYOND) backlog. Created 2026-11-01 by the orchestrator session.

  HOW THIS FLEET RUNS (sequential, NOT parallel — the orchestrator's mandate):
    * ONE external `reasonix run` session executes ONE card (or one grouped phase) at a time.
    * The orchestrator spawns it, watches its token budget, and on YELLOW makes it write a
      HANDOFF that a fresh session resumes; the orchestrator replays the handoff into the next
      fresh session. The orchestrator never reads the handoff for content — it relays it.
    * The spawned session is a CLONE of the orchestrator: same relay (127.0.0.1:38116 via
      reasonix.toml `px-dndb-flash`), same vendor skills ([skills] paths), same --permission-mode
      yolo, and WRITE access to this repo (--add-dir). The orchestrator's own --dir lives OUTSIDE
      the repo so it never takes the workspace-write lock; the agent works in-tree freely.
    * Gemini PAID is the VERIFIER seat only (operator ruling 2026-10-27 + verdict via JEV).

  Deck contents:
    TRACE.md              — the orchestrator's own running ledger (phases, tokens, dispositions).
    prompts/LAUNCH-PROMPT-TEMPLATE.md — the skeleton every spawned session's task text is built from.
    prompts/<phase>.md    — the concrete per-card task text (built by the orchestrator).
    handoffs/<phase>.md   — token-budget handoffs written by a yellow session for its successor.
    reports/<phase>.md    — what the agent reports back: new code, architecture decisions,
                            plan amendments, struggles, knowledge worth persisting.
-->
