#!/usr/bin/env python
"""Orchestrator dispatch harness — prepares ONE external reasonix session for ONE phase card.

WHY THIS SHAPE (measured, not guessed): the orchestrator's tool session runs inside a host job
object whose cleanup REAPS detached children (`CREATE_BREAKAWAY_FROM_JOB` is denied with
WinError 5 on this host; `schtasks /create` fails on UserId/SID mapping; a bare detached Popen
is reaped with a 0-byte log). The ONE route that works: the orchestrator itself runs
`reasonix.exe run` as a FOREGROUND command inside a long-lived background bash job — the host
job keeps the process alive across the orchestrator's turns, and the session's own inner
background jobs (e2e runs) work normally inside it. This harness does the parts the orchestrator
cannot do from the bash tool: create the external --dir, and write the session registry. It then
prints the EXACT command the orchestrator runs as its background job.

Usage:
  python spawn_session.py <phase_tag> <prompt_file> [max_steps]
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

REPO = Path(r"C:\luiscla27\projects\dndbeyond-printenhance")
FLEET = REPO / "conductor" / "tracks" / "orchestrator_backlog_sweep_20261101"
REASONIX = REPO / "reasonix.exe"
# External --dir root: same convention the fleet deck proved (outside the repo, per-fleet subfolder).
WS_ROOT = Path.home() / "reasonix-fleet-workspaces" / FLEET.name


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    phase_tag, prompt_file = argv[1], Path(argv[2])
    max_steps = argv[3] if len(argv) > 3 else "600"
    if not prompt_file.is_file():
        print(f"[orch] prompt file missing: {prompt_file}")
        return 2

    session_dir = WS_ROOT / phase_tag
    session_dir.mkdir(parents=True, exist_ok=True)
    logs = FLEET / "logs"
    logs.mkdir(exist_ok=True)
    log = logs / f"{phase_tag}.log"

    task = (
        f"Execute the file {prompt_file} as your complete task. Read it FULLY and follow every "
        f"instruction exactly, including the track-record, reproduce-before-fix, verification, "
        f"commit, close-out, orchestrator-report, and token-budget-handoff rules."
    )
    # The recipe the orchestrator runs as a background bash job (foreground reasonix inside it,
    # so the host job keeps the session alive across orchestrator turns).
    cmd = (
        f'cd "{REPO}" && ./{REASONIX.name} run '
        f'--dir "{session_dir}" '
        f'--add-dir "{FLEET}" '
        f'--add-dir "{REPO}" '
        f'--permission-mode yolo --max-steps {max_steps} '
        f'"{task}" 1> "{log}" 2>&1; echo "phase {phase_tag} exit: $?"'
    )

    entry = {
        "phase": phase_tag,
        "prompt": str(prompt_file),
        "log": str(log),
        "started_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "session_dir": str(session_dir),
        "recipe": cmd,
    }
    reg = FLEET / "runtime" / "sessions.jsonl"
    reg.parent.mkdir(exist_ok=True)
    with reg.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry) + "\n")

    print("[orch] session prepared:")
    print(f"[orch]   phase:    {phase_tag}")
    print(f"[orch]   --dir:    {session_dir}")
    print(f"[orch]   log:      {log}")
    print(f"[orch]   max-steps: {max_steps}")
    print("[orch] run EXACTLY this as a background bash job (run_in_background=true):")
    print("[orch] ---8<---")
    print(cmd)
    print("[orch] ---8<---")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
