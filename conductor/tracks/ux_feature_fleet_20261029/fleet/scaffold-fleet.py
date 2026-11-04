#!/usr/bin/env python3
"""
scaffold-fleet.py — fleet-delegation skill (§0.5): materialize the FULL fleet
artifact set for a task so the skill ACTUALLY creates and runs a fleet.

Creates:
  <task>/fleet/
    partition.py          (copied from this skill's templates, parameterized)
    launch.bat            (rolling-pool launcher: POOL_SIZE agents concurrent at all times)
    wait-fleet.ps1        (process-liveness poller with timeout)
    fleet-monitor.ps1     (live progress board — delegates to repo-root monitor)
    reconcile.py          (progress + artifact scan -> done/has-file/broken/missing)
    track-prompt.md       (per-track worker prompt template)
    integrator-prompt.md  (verify / harvest / commit template)
    units.json            (optional, if --units given: the partition input)
    runtime/              (git-ignored) locks/ heartbeats/ deferrals/ progress/ out/ status/
    logs/                 (git-ignored) per-track launch logs — MUST stay a DIRECTORY:
                          a stray file named "logs" breaks every redirect at launch
                          ("The system cannot find the path specified."); the scaffold
                          creates it, --check gates it, launch.bat self-heals it.
    tracks/               (created by partition.py, NOT here)

Then runs partition.py (unless --no-partition) so ownership.json + per-track
manifests + LAUNCH-PROMPT.md exist BEFORE launch. Re-run with --check to run the
LAUNCH GATE: it fails (exit 1) until every artifact exists, the partition is
verified disjoint, and the runtime + gitignore entry are in place.

Usage (from repo root):
  python .reasonix/skills/fleet-delegation/templates/scaffold-fleet.py \
      --task conductor/tracks/my_new_fleet --tracks 8 --pool-size 8 \
      --units units.json --repo-root .
  python conductor/tracks/my_new_fleet/fleet/scaffold-fleet.py --check   # launch gate
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

TEMPLATE_FILES = [
    "partition.py",
    "launch.bat",
    "restart.bat",
    "guard.ps1",
    "recover-stuck.py",
    "wait-fleet.ps1",
    "wait-recover.ps1",
    "fleet-monitor.ps1",
    "reconcile.py",
    "stall-signal.py",
    "prepare_godot.ps1",
    "bottleneck_cop.ps1",
    "bottleneck-cop-prompt.md",
    "track-prompt.md",
    "integrator-prompt.md",
]
# `stall-signal.py` is in the list for a measured reason (2026-09-17): the instrument was
# built INSIDE one fleet run and never added here, so `wait-recover.ps1`'s silence clock (and
# the `python stall-signal.py derive` the prompts tell the operator to run) would have been
# absent in every subsequently scaffolded fleet — a fix that lives only in a run artifact is
# not a fix. RUNTIME_SUBDIRS carries the two log directories it READS (`heartbeat-log` for the
# append-only liveness beats, `units` for the per-unit start/end pairs) so both exist before
# the first worker boots.
RUNTIME_SUBDIRS = ["locks", "heartbeats", "heartbeat-log", "units", "deferrals", "progress",
                   "out", "status"]


def _default_reasonix_bin() -> str:
    """The reasonix binary the launch gate should ASK, resolved the way launch surfaces do.

    GATE-2 review F1 (2026-09-17): defaulting to the bare name 'reasonix' made both model-tier
    checks silently degrade to "(skipped ...)" and still print PASS, so the gate certified a tier
    it had never checked. On a host where 'reasonix' is not on PATH (the normal case — the shim
    lives in %APPDATA%\\npm) every fleet would have launched through a gate that checked nothing.
    The default is now the real shim when it exists, and a check that cannot RUN is a FAILURE
    (see the tier checks below) rather than a skip.
    """
    env_override = os.environ.get("REASONIX_BIN")
    if env_override:
        return env_override
    appdata = os.environ.get("APPDATA") or os.path.expanduser(os.path.join("~", "AppData",
                                                                          "Roaming"))
    shim = os.path.join(appdata, "npm", "reasonix.cmd")
    return shim if os.path.exists(shim) else "reasonix"


REASONIX_BIN = _default_reasonix_bin()


def write_board(fleet_dir, runtime_dir):
    """Initialize runtime/status/board.md with one row per track (status=booting)."""
    tracks_dir = os.path.join(fleet_dir, "tracks")
    rows = []
    if os.path.isdir(tracks_dir):
        for name in sorted(os.listdir(tracks_dir)):
            mp = os.path.join(tracks_dir, name, "manifest.json")
            total = 0
            if os.path.exists(mp):
                try:
                    total = json.load(open(mp, encoding="utf-8")).get("code_count", 0)
                except Exception:
                    pass
            rows.append(f"| {name} | booting | 0 | {total} | 0 | - | - |")
    board = os.path.join(runtime_dir, "status", "board.md")
    os.makedirs(os.path.dirname(board), exist_ok=True)
    header = (
        "# Fleet Status Board\n\n> Derived board (uncommitted, live). Updated by tracks and the integrator.\n\n"
        "| Track | Status | Done | Pending | Deferred | Blockers | Note |\n"
        "|---|---|---|---|---|---|---|\n"
    )
    with open(board, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(rows) + "\n")
    print(f"[scaffold] initialized runtime/status/board.md ({len(rows)} tracks)")


def rel_repo(fleet_dir, repo_root):
    """Relative path from <task>/fleet up to the repo root, with backslashes (PS)."""
    rel = os.path.relpath(repo_root, fleet_dir)
    return rel.replace("/", "\\")


def winify(p):
    return p.replace("/", "\\")


def build_substitutions(task_dir, fleet_dir, repo_root, tracks, pool_size, runtime_dir):
    return {
        "{{TASK_DIR}}": winify(os.path.relpath(task_dir, fleet_dir)),
        "{{FLEET_DIR}}": ".",
        "{{TRACK_DIR}}": "tracks",
        "{{RUNTIME_DIR}}": winify(os.path.relpath(runtime_dir, fleet_dir)),
        "{{REPO_ROOT}}": winify(os.path.relpath(repo_root, fleet_dir)),
        "{{REPO_REL_MONITOR}}": rel_repo(fleet_dir, repo_root),
        "{{N_TRACKS}}": str(tracks),
        "{{LAST_TRACK}}": str(tracks - 1),
        "{{POOL_SIZE}}": str(pool_size),
        # Worker model for the per-track sessions. MUST be set per fleet: unique --dir
        # sessions do not resolve the repo's reasonix.toml default_model (they fell back
        # to the heavy default tier; verified). USER MANDATE (2026-08-15): this project's
        # fleets run on Muse Spark 1.2 Contributor as the primary worker tier.
        "{{MODEL_DEFAULT}}": "anthropic-api-meta-ai/muse-spark-1.2-contributor",
        # Fallback worker tier (user mandate 2026-08-16): Muse Spark Contributor has a
        # 60 req/h rate limit and WILL fail under fleet load. On an identified Muse
        # failure a worker persists its state, writes runtime\status\<track>\model_fallback.json
        # and exits with MUSE_FALLBACK_REQUESTED; every launch surface then relaunches
        # THAT track on this tier (sticky per track).
        "{{MODEL_FALLBACK}}": "deepseek-flash/deepseek-v4-flash",
        # ABSOLUTE paths — injected into track-prompt.md so each track can resolve files
        # from its UNIQUE per-track --dir (Reasonix keys its session by CWD; a shared CWD
        # makes N instances collide on one session dir at startup — see SKILL.md §6).
        "{{FLEET_DIR_ABS}}": winify(os.path.abspath(fleet_dir)),
        "{{REPO_ROOT_ABS}}": winify(os.path.abspath(repo_root)),
    }


def render(text, subs):
    for k, v in subs.items():
        text = text.replace(k, v)
    return text


def ensure_gitignore(repo_root, dirs, quiet=False):
    """Append each short-lived dir (runtime + logs) to the repo-root .gitignore."""
    gitignore = os.path.join(repo_root, ".gitignore")
    existing = ""
    if os.path.exists(gitignore):
        with open(gitignore, encoding="utf-8") as f:
            existing = f.read()
    lines = existing.splitlines()
    added = False
    for d in dirs:
        rel = os.path.relpath(d, repo_root).replace("\\", "/")
        entry = "/" + rel if not rel.startswith("/") else rel
        if entry in lines:
            continue
        if existing and not existing.endswith("\n"):
            existing += "\n"
        existing += entry + "\n"
        lines.append(entry)
        if not quiet:
            print(f"[scaffold] .gitignore += {entry}")
        added = True
    if added:
        with open(gitignore, "w", encoding="utf-8") as f:
            f.write(existing)
    return added


def main():
    ap = argparse.ArgumentParser(description="fleet-delegation scaffold (skill §0.5)")
    ap.add_argument("--task", default=os.getcwd(), help="task dir that will contain fleet/ (default cwd)")
    ap.add_argument("--repo-root", default=None, help="repo root (default: walk up from --task until .git found)")
    ap.add_argument("--tracks", type=int, default=8, help="number of parallel tracks (default 8)")
    ap.add_argument("--pool-size", "--batch-size", dest="pool_size", type=int, default=4,
                    help="concurrent agents in the rolling pool at all times (default 4)")
    ap.add_argument("--units", default=None, help="units.json partition input (copied into fleet/)")
    ap.add_argument("--runtime", default=None, help="runtime dir (default <task>/fleet/runtime)")
    ap.add_argument("--no-partition", action="store_true", help="scaffold only; do NOT run partition.py")
    ap.add_argument("--check", action="store_true", help="LAUNCH GATE: verify scaffold completeness (exit 1 on failure)")
    ap.add_argument("--force", action="store_true", help="overwrite existing files")
    args = ap.parse_args()

    # When run from the COPIED instance at <task>/fleet/scaffold-fleet.py, the task
    # dir is this script's parent (not cwd, which may be the repo root).
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if args.task == os.getcwd() and os.path.basename(script_dir) == "fleet":
        task_dir = os.path.dirname(script_dir)
    else:
        task_dir = os.path.abspath(args.task)
    fleet_dir = os.path.join(task_dir, "fleet")
    templates_dir = os.path.dirname(os.path.abspath(__file__))
    runtime_dir = os.path.abspath(args.runtime) if args.runtime else os.path.join(fleet_dir, "runtime")

    if args.repo_root:
        repo_root = os.path.abspath(args.repo_root)
    else:
        repo_root = task_dir
        while not os.path.isdir(os.path.join(repo_root, ".git")):
            parent = os.path.dirname(repo_root)
            if parent == repo_root:
                sys.exit("Could not locate repo root (no .git found above --task). Pass --repo-root.")
            repo_root = parent

    # ---------- --check mode: launch gate ----------
    if args.check:
        missing = []
        for name in TEMPLATE_FILES + ["scaffold-fleet.py"]:
            if not os.path.exists(os.path.join(fleet_dir, name)):
                missing.append(f"fleet/{name}")
        if not os.path.isdir(runtime_dir):
            missing.append("runtime/ (dir)")
        for sub in RUNTIME_SUBDIRS:
            if not os.path.isdir(os.path.join(runtime_dir, sub)):
                missing.append(f"runtime/{sub}/ (dir)")
        # logs/ MUST be a directory, not a file: a stray 0-byte file named "logs" makes
        # every per-track redirect (logs\track-NN.log) fail with "The system cannot find
        # the path specified." and no worker ever boots (verified 2026-08-15 on
        # proc_consolidation_20260815 — the gate below did NOT catch it before this check).
        logs_dir = os.path.join(fleet_dir, "logs")
        if not os.path.isdir(logs_dir):
            missing.append("logs/ (dir) — a FILE named logs breaks every launch redirect "
                           "(\"The system cannot find the path specified.\"); "
                           "delete the file and re-run scaffold (materialize self-heals)")
        if not os.path.isdir(os.path.join(fleet_dir, "tracks")):
            missing.append("tracks/ (dir) — run partition.py first")
        if not os.path.exists(os.path.join(fleet_dir, "prepare_godot.ps1")):
            missing.append("prepare_godot.ps1 — per-track Godot shadow builder (SKILL.md §3)")
        if not os.path.exists(os.path.join(fleet_dir, "bottleneck_cop.ps1")):
            missing.append("bottleneck_cop.ps1 — bottlenecks cop scheduler (SKILL.md §3)")
        if not os.path.exists(os.path.join(fleet_dir, "bottleneck-cop-prompt.md")):
            missing.append("bottleneck-cop-prompt.md — bottlenecks cop audit contract (SKILL.md §3)")
        if not os.path.exists(os.path.join(fleet_dir, "ownership.json")):
            missing.append("ownership.json — run partition.py first")
        if not os.path.exists(os.path.join(fleet_dir, "tracks", "track-00", "manifest.json")):
            missing.append("tracks/track-00/manifest.json — run partition.py first")
        # Fleet fixes verified 2026-08-15 (see SKILL.md §3/§6): (a) every launch surface
        # must carry --permission-mode yolo (the `ask` default auto-declines writes/bash
        # in minimized windows and stalls every worker); (b) workers' --dir must be
        # OUTSIDE the repo (an in-repo --dir wedges all workers on the shared
        # workspace-write mutex — "Another session is writing to this workspace...").
        for fname in ("launch.bat", "wait-recover.ps1"):
            fpath = os.path.join(fleet_dir, fname)
            text = open(fpath, encoding="utf-8").read() if os.path.exists(fpath) else ""
            if "--permission-mode" not in text:
                missing.append(f"{fname} — missing --permission-mode yolo on launch surfaces")
            if "tracks\\track-!ID! --add-dir" in text or "tracks\\track-!VID! --add-dir" in text:
                missing.append(f"{fname} — in-repo --dir (must be external, see SKILL.md §3)")
            if fname == "wait-recover.ps1" and "--dir" not in text:
                missing.append("wait-recover.ps1 — recovery relaunch missing --dir (per-track session layout, SKILL.md §3)")
        # Track prompt must carry the Godot-isolation + PID-only-kill contract
        # (verified 2026-08-15: shared .godot races + image-name taskkill cross-kills).
        tp_path = os.path.join(fleet_dir, "track-prompt.md")
        tp_text = open(tp_path, encoding="utf-8").read() if os.path.exists(tp_path) else ""
        if "GODOT ISOLATION" not in tp_text:
            missing.append("track-prompt.md — missing GODOT ISOLATION section (per-track shadow project, SKILL.md §3)")
        if "Sanctioned exception" in tp_text:
            missing.append("track-prompt.md — sanctions image-name taskkill (must be PID-only kills, SKILL.md §3)")
        # launch.bat must start the bottlenecks cop alongside the pool (9th agent).
        lb_path = os.path.join(fleet_dir, "launch.bat")
        lb_text = open(lb_path, encoding="utf-8").read() if os.path.exists(lb_path) else ""
        if "bottleneck_cop.ps1" not in lb_text:
            missing.append("launch.bat — bottlenecks cop not started (bottleneck_cop.ps1 reference, SKILL.md §3)")
        # Worker MODEL's provider must resolve (verified 2026-08-15: running reasonix
        # sessions rewrite the user config.toml and drop custom [[providers]] blocks;
        # an unresolvable worker model kills the fleet at boot).
        model = ""
        m = re.search(r'set "MODEL=([^"]+)"', lb_text)
        if m and m.group(1).strip():
            model = m.group(1).strip()
        else:
            # Reviewer finding 2026-09-17: this branch used to be guarded by `if model:` with no
            # else, so DELETING the MODEL line made the gate print PASS having checked no tier at
            # all — asymmetric with the MODEL_FALLBACK check below. A gate that can be satisfied
            # by removing the thing it checks is not a gate.
            missing.append("launch.bat — MODEL not set: a fleet with no explicit worker tier "
                           "resolves the heavy default model (SKILL.md §3); the gate cannot "
                           "verify a tier that is not declared")
        if model:
            provider = model.split("/")[0]
            try:
                doc = subprocess.run([REASONIX_BIN, "doctor", "--json"], capture_output=True,
                                     text=True, timeout=30)
                import json as _json
                if doc.returncode == 0:
                    providers = [p.get("name") for p in _json.loads(doc.stdout).get("providers", [])]
                    if provider not in providers:
                        missing.append(f"worker MODEL provider '{provider}' NOT resolvable by reasonix "
                                       f"(reasonix doctor --json) — the fleet dies at boot; re-add the "
                                       f"[[providers]] block to the user config.toml (SKILL.md §3)")
                else:
                    # GATE-2 review F1: a check that cannot RUN must FAIL the gate, never print
                    # PASS. `reasonix` may simply not be on PATH — that is exactly the situation
                    # this check exists for.
                    missing.append(f"worker MODEL provider '{provider}' could NOT be checked: "
                                   f"'{REASONIX_BIN} doctor --json' exited {doc.returncode} "
                                   f"({(doc.stderr or '').strip()[:200]}) — an uncheckable tier is a "
                                   f"FAILED gate (SKILL.md §3.1); set REASONIX_BIN to the real "
                                   f"reasonix binary/shim and re-run --check")
            except Exception as e:
                missing.append(f"worker MODEL provider '{provider}' could NOT be checked: "
                               f"'{REASONIX_BIN} doctor --json' failed ({e}) — an uncheckable tier "
                               f"is a FAILED gate (SKILL.md §3.1, GATE-2 F1); set REASONIX_BIN to "
                               f"the real reasonix binary/shim and re-run --check")
        # MODEL_FALLBACK must be SET and its provider must resolve (user mandate
        # 2026-08-16): Muse Contributor's 60 req/h rate limit WILL fail under fleet
        # load, so the fallback tier is a launch precondition — an empty or
        # unresolvable fallback turns the first Muse failure into a dead fleet.
        fb_model = ""
        mfb = re.search(r'set "MODEL_FALLBACK=([^"]+)"', lb_text)
        if mfb and mfb.group(1).strip():
            fb_model = mfb.group(1).strip()
        if not fb_model:
            missing.append("launch.bat — MODEL_FALLBACK not set (user mandate 2026-08-16: "
                           "Muse 60 req/h limit requires a fallback tier)")
        else:
            fb_provider = fb_model.split("/")[0]
            try:
                doc = subprocess.run([REASONIX_BIN, "doctor", "--json"], capture_output=True,
                                     text=True, timeout=30)
                import json as _json
                if doc.returncode == 0:
                    providers = [p.get("name") for p in _json.loads(doc.stdout).get("providers", [])]
                    if fb_provider not in providers:
                        missing.append(f"MODEL_FALLBACK provider '{fb_provider}' NOT resolvable by reasonix "
                                       f"(reasonix doctor --json) — the Muse-failure fallback would dead-end; "
                                       f"re-add the [[providers]] block to the user config.toml (SKILL.md §3)")
                else:
                    missing.append(f"MODEL_FALLBACK provider '{fb_provider}' could NOT be checked: "
                                   f"'{REASONIX_BIN} doctor --json' exited {doc.returncode} "
                                   f"({(doc.stderr or '').strip()[:200]}) — an uncheckable fallback tier is a "
                                   f"FAILED gate (SKILL.md §3.1, GATE-2 F1); set REASONIX_BIN and re-run --check")
            except Exception as e:
                missing.append(f"MODEL_FALLBACK provider '{fb_provider}' could NOT be checked: "
                               f"'{REASONIX_BIN} doctor --json' failed ({e}) — an uncheckable fallback tier "
                               f"is a FAILED gate (SKILL.md §3.1, GATE-2 F1); set REASONIX_BIN and re-run --check")
        # wait-recover.ps1 is the stuck-track relaunch surface: it must honor the
        # fallback marker, or a Muse-failed stuck track would relaunch back onto the
        # dead primary forever. (The placeholder renders to the fallback value, so
        # check the marker filename — a literal that survives rendering.)
        wr_path = os.path.join(fleet_dir, "wait-recover.ps1")
        wr_text = open(wr_path, encoding="utf-8").read() if os.path.exists(wr_path) else ""
        if "model_fallback.json" not in wr_text:
            missing.append("wait-recover.ps1 — missing MODEL_FALLBACK relaunch logic "
                           "(stuck tracks must relaunch on the fallback tier when the marker exists)")
        # Workers must know the fallback protocol (persist state, write the marker,
        # exit with MUSE_FALLBACK_REQUESTED) — otherwise a rate-limited worker loops.
        if "MUSE_FALLBACK_REQUESTED" not in tp_text:
            missing.append("track-prompt.md — missing MODEL FALLBACK protocol (workers must write "
                           "the marker + exit on Muse failure, user mandate 2026-08-16)")
        # Reviewer finding 2026-09-17: the tier literals are duplicated on THREE surfaces
        # (launch.bat, wait-recover.ps1, bottleneck_cop.ps1) while only launch.bat was parsed —
        # editing one surface silently desynced the others. Compare them all.
        cop_text = ""
        cop_path = os.path.join(fleet_dir, "bottleneck_cop.ps1")
        if os.path.exists(cop_path):
            cop_text = open(cop_path, encoding="utf-8").read()
        wr_primary = re.search(r"\$primaryModel\s*=\s*'([^']+)'", wr_text)
        wr_fb = re.search(r"\$fallbackModel\s*=\s*'([^']+)'", wr_text)
        cop_primary = re.search(r"\$PrimaryModel\s*=\s*'([^']+)'", cop_text)
        cop_fb = re.search(r"\$FallbackModel\s*=\s*'([^']+)'", cop_text)
        for label, got, want in (
                ("wait-recover.ps1 $primaryModel", wr_primary.group(1) if wr_primary else None, model),
                ("wait-recover.ps1 $fallbackModel", wr_fb.group(1) if wr_fb else None, fb_model),
                ("bottleneck_cop.ps1 $PrimaryModel", cop_primary.group(1) if cop_primary else None, model),
                ("bottleneck_cop.ps1 $FallbackModel", cop_fb.group(1) if cop_fb else None, fb_model)):
            if want and got != want:
                missing.append(f"{label} = {got!r} but launch.bat declares {want!r} — the tiers "
                               f"are duplicated per surface and must agree (reviewer finding "
                               f"2026-09-17: editing one surface silently desyncs the others)")
        gitignore = os.path.join(repo_root, ".gitignore")
        gi_lines = open(gitignore, encoding="utf-8").read().splitlines() if os.path.exists(gitignore) else []
        for d in [runtime_dir, os.path.join(fleet_dir, "logs")]:
            rel = os.path.relpath(d, repo_root).replace("\\", "/")
            entry = "/" + rel if not rel.startswith("/") else rel
            if entry not in gi_lines:
                missing.append(f".gitignore entry for short-lived dir ({entry})")

        if missing:
            print("LAUNCH GATE: FAIL — missing:")
            for m in missing:
                print("  -", m)
            print("Fix: python scaffold-fleet.py --task <task> [--tracks N] [--units units.json] then re-run --check.")
            sys.exit(1)
        # Partition disjointness is verified by partition.py itself; re-run it in --check mode.
        subprocess.run([sys.executable, os.path.join(fleet_dir, "partition.py"), "--check"],
                       cwd=fleet_dir, check=True)
        print("LAUNCH GATE: PASS — scaffold complete, partition disjoint, runtime ready.")
        print("Next: open a USER console and run  fleet\\launch.bat  (never from an orchestrator session).")
        print("Watch: powershell -ExecutionPolicy Bypass -File fleet\\fleet-monitor.ps1")
        sys.exit(0)

    # ---------- materialize ----------
    os.makedirs(fleet_dir, exist_ok=True)
    for sub in RUNTIME_SUBDIRS:
        os.makedirs(os.path.join(runtime_dir, sub), exist_ok=True)
    os.makedirs(os.path.join(fleet_dir, "tracks"), exist_ok=True)
    # logs/ MUST be a directory from birth: a stray FILE named "logs" makes every launch
    # redirect fail with "The system cannot find the path specified." (verified 2026-08-15).
    # Self-heal here; launch.bat + wait-recover.ps1 also self-heal at launch time.
    logs_dir = os.path.join(fleet_dir, "logs")
    if os.path.exists(logs_dir) and not os.path.isdir(logs_dir):
        print(f"[scaffold] removing stray FILE {os.path.relpath(logs_dir, repo_root)} (must be a directory)")
        os.remove(logs_dir)
    os.makedirs(logs_dir, exist_ok=True)

    subs = build_substitutions(task_dir, fleet_dir, repo_root, args.tracks, args.pool_size, runtime_dir)
    for name in TEMPLATE_FILES:
        src = os.path.join(templates_dir, name)
        dst = os.path.join(fleet_dir, name)
        if os.path.exists(dst) and not args.force:
            print(f"[scaffold] keep existing {name}")
            continue
        with open(src, encoding="utf-8") as f:
            text = f.read()
        with open(dst, "w", encoding="utf-8") as f:
            f.write(render(text, subs))
        print(f"[scaffold] wrote {os.path.relpath(dst, repo_root)}")

    shutil.copy2(os.path.abspath(__file__), os.path.join(fleet_dir, "scaffold-fleet.py"))
    if args.units:
        shutil.copy2(os.path.abspath(args.units), os.path.join(fleet_dir, "units.json"))
        print(f"[scaffold] copied units.json")

    ensure_gitignore(repo_root, [runtime_dir, os.path.join(fleet_dir, "logs")])

    if not args.no_partition:
        part = os.path.join(fleet_dir, "partition.py")
        cmd = [sys.executable, part, "--tracks", str(args.tracks)]
        if args.units:
            cmd += ["--units", os.path.join(fleet_dir, "units.json")]
        subprocess.run(cmd, cwd=fleet_dir, check=True)

    write_board(fleet_dir, runtime_dir)

    print()
    print("Scaffold done. Run the launch gate:")
    print(f"  python {os.path.relpath(os.path.join(fleet_dir, 'scaffold-fleet.py'), repo_root)} --check")
    print("Then, from the USER's own console (never an orchestrator session):")
    print(f"  {os.path.join(fleet_dir, 'launch.bat')}")
    print(f"  powershell -ExecutionPolicy Bypass -File {os.path.join(fleet_dir, 'fleet-monitor.ps1')}")


if __name__ == "__main__":
    main()
