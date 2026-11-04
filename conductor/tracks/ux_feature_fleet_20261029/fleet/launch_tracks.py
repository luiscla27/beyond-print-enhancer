#!/usr/bin/env python3
"""Launch individual fleet tracks as background reasonix.exe processes.
This script replaces the interactive launch.bat approach for non-interactive execution.
Launches tracks in a rolling pool of POOL_SIZE, monitors, and supports recovery."""
import json, os, subprocess, sys, time

FLEET_DIR = r"C:\luiscla27\projects\dndbeyond-printenhance\conductor\tracks\ux_feature_fleet_20261029\fleet"
REPO_ROOT = r"C:\luiscla27\projects\dndbeyond-printenhance"
WSROOT = os.path.join(os.environ["USERPROFILE"], "reasonix-fleet-workspaces", "ux_feature_fleet_20261029")

PRIMARY_MODEL = "anthropic-api-meta-ai/muse-spark-1.2-contributor"
FALLBACK_MODEL = "deepseek-flash/deepseek-v4-flash"
MAX_STEPS = 800
POOL_SIZE = 6

REASONIX_EXE = os.path.join(REPO_ROOT, "reasonix.exe")

def get_all_tracks():
    tracks_dir = os.path.join(FLEET_DIR, "tracks")
    return sorted([d for d in os.listdir(tracks_dir) if d.startswith("track-") and os.path.isdir(os.path.join(tracks_dir, d))])

def count_running(all_tracks):
    """Count currently running tracks based on heartbeat freshness + living processes."""
    count = 0
    running = set()
    now = time.time()
    for tid in all_tracks:
        hb_path = os.path.join(FLEET_DIR, "runtime", "heartbeats", f"{tid}.json")
        if os.path.exists(hb_path):
            try:
                with open(hb_path) as f:
                    hb = json.load(f)
                last_seen = hb.get("last_seen_epoch", 0)
                if now - last_seen < 600:  # heartbeat within 10 minutes = running
                    count += 1
                    running.add(tid)
            except:
                pass
    return count, running

def launch_track(tid):
    wsdir = os.path.join(WSROOT, tid)
    os.makedirs(wsdir, exist_ok=True)

    # Check for model fallback marker
    fb_marker = os.path.join(FLEET_DIR, "runtime", "status", tid, "model_fallback.json")
    if os.path.exists(fb_marker):
        model = FALLBACK_MODEL
        print(f"  [{tid}] Using FALLBACK model (marker present)")
    else:
        model = PRIMARY_MODEL

    task = f'Execute the file {FLEET_DIR}\\tracks\\{tid}\\LAUNCH-PROMPT.md as your complete task. Read it fully and follow every instruction exactly, including the heartbeat, lock, and deferral protocol it references.'

    cmd = [
        REASONIX_EXE, "run",
        "--dir", wsdir,
        "--add-dir", FLEET_DIR,
        "--add-dir", REPO_ROOT,
        "--model", model,
        "--permission-mode", "bypassPermissions",
        "--max-steps", str(MAX_STEPS),
        task
    ]

    log_file = os.path.join(FLEET_DIR, "logs", f"{tid}.log")
    log_f = open(log_file, "a")

    print(f"Launching {tid} on {model}...")
    proc = subprocess.Popen(cmd, stdout=log_f, stderr=subprocess.STDOUT,
                            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
    print(f"  PID: {proc.pid}")
    return proc

def main():
    os.makedirs(WSROOT, exist_ok=True)
    os.makedirs(os.path.join(FLEET_DIR, "logs"), exist_ok=True)

    all_tracks = get_all_tracks()

    # Check which tracks are already running
    _, running = count_running(all_tracks)

    pending = [t for t in all_tracks if t not in running]
    print(f"Total tracks: {len(all_tracks)}, Running: {len(running)}, Pending: {len(pending)}")
    if pending:
        print(f"Pending tracks: {pending}")

    # Launch first POOL_SIZE tracks (rolling pool)
    live = []
    for tid in pending:
        # Wait if pool is full
        while len(live) >= POOL_SIZE:
            time.sleep(10)
            still_alive = []
            for p, t in live:
                if p.poll() is None:
                    still_alive.append((p, t))
            live = still_alive
            # Also check heartbeats as an additional signal
            running_count, running_set = count_running(all_tracks)
            print(f"  [pool] {running_count} tracks running ({len(live)} in our launched set)")

        proc = launch_track(tid)
        live.append((proc, tid))
        time.sleep(3)  # Stagger launches

    print(f"\nLaunched initial pool. Monitoring {len(live)} tracks...")

    # Keep the launcher alive to support recovery via wait-recover.ps1
    # This mimics launch.bat's :WAIT_DRAIN behavior
    while live:
        time.sleep(30)
        still_alive = []
        for p, t in live:
            if p.poll() is None:
                still_alive.append((p, t))
        dead = [t for p, t in live if p.poll() is not None]
        if dead:
            print(f"  [monitor] {dead} finished")
        live = still_alive
        print(f"  [monitor] {len(live)} tracks still running")

    print("All launched tracks have completed.")

if __name__ == "__main__":
    main()
