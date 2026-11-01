"""Register + run ONE scheduled task that executes one phase's external reasonix session.

Why scheduled tasks: launching `reasonix run` directly from the orchestrator's tool session
gets the child REAPED by the host's job-object cleanup (measured: empty 0-byte log, dead pid) —
the fleet's launch.bat documents the same failure. CREATE_BREAKAWAY_FROM_JOB is denied here
(WinError 5) and /rl highest fails on a UserId/SID mapping error (measured), so the plain
scheduled task at the CURRENT user's own rights is the spawn route that survives.

Usage:  python schedule_phase.py <phase_tag> <prompt_file> [max_steps]

Writes: runtime/run_<phase>.cmd (the recipe the task runs), schedules task OrchPhase_<phase>,
runs it immediately, and appends runtime/schedule.jsonl.
"""
from __future__ import annotations

import datetime
import json
import subprocess
import time
from pathlib import Path

REPO = Path(r"C:\luiscla27\projects\dndbeyond-printenhance")
FLEET = REPO / "conductor" / "tracks" / "orchestrator_backlog_sweep_20261101"
REASONIX = REPO / "reasonix.exe"


def build(phase: str, prompt: Path, max_steps: str = "600") -> None:
    sessdir = Path.home() / "reasonix-fleet-workspaces" / "orchestrator_backlog_sweep_20261101" / phase
    log = FLEET / "logs" / f"{phase}.log"
    for d in (sessdir, FLEET / "logs", FLEET / "runtime"):
        d.mkdir(parents=True, exist_ok=True)
    log.unlink(missing_ok=True)

    task = (
        f'"{REASONIX}" run --dir "{sessdir}" --add-dir "{FLEET}" --add-dir "{REPO}" '
        f'--permission-mode yolo --max-steps {max_steps} '
        f'"Execute the file {prompt.resolve()} as your complete task. Read it FULLY and follow '
        f'every instruction exactly, including the track-record, reproduce-before-fix, '
        f'verification, commit, close-out, orchestrator-report, and token-budget-handoff rules." '
        f'1>>"{log}" 2>&1'
    )
    recipe = FLEET / "runtime" / f"run_{phase}.cmd"
    recipe.write_text(f"@echo off\n%SystemRoot%\\System32\\cmd.exe /c {task}\n", encoding="utf-8")

    # st must be in the FUTURE or schtasks /sc once refuses to create (measured).
    st = (datetime.datetime.now() + datetime.timedelta(minutes=1)).strftime("%H:%M")
    name = f"OrchPhase_{phase}"
    for cmd in (
        ["schtasks", "/delete", "/tn", name, "/f"],
        ["schtasks", "/create", "/tn", name, "/tr", f'cmd.exe /c "{recipe}"',
         "/sc", "once", "/st", st, "/f"],
        ["schtasks", "/run", "/tn", name],
    ):
        r = subprocess.run(cmd, capture_output=True)
        out = (r.stdout or b"").decode("utf-8", "replace") + (r.stderr or b"").decode("utf-8", "replace")
        print("[orch]", " ".join(cmd[:4]), "->", out.strip()[:160])

    (FLEET / "runtime" / "schedule.jsonl").open("a", encoding="utf-8").write(json.dumps({
        "phase": phase, "task": name, "prompt": str(prompt.resolve()), "log": str(log),
        "session_dir": str(sessdir), "max_steps": max_steps,
        "utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }) + "\n")
    print(f"[orch] phase {phase} scheduled as {name}; log: {log}")


if __name__ == "__main__":
    import sys
    build(sys.argv[1], Path(sys.argv[2]), sys.argv[3] if len(sys.argv) > 3 else "600")
