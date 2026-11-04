#!/usr/bin/env python3
"""
recover-stuck.py — validate + recover a fleet that hit the "stuck track" data-inconsistency
(workers resolving repo-relative paths under their unique --dir, so done stays 0 while docs land
in stray tracks/track-XX/{docs,src,conductor} dirs).

What it does (idempotent, safe to re-run):
  1. Ask the fleet's OWN classifier (`reconcile.py`) which units are not yet `done-recorded`, and
     treat a track as stuck when any of its units is one of them.
  2. Clean stray dirs under every track dir (docs/, src/, conductor/).
  3. Re-partition exactly the units the classifier does NOT certify into a fresh, collapse-safe
     partition, and re-shard those units' progress records with them so a unit's verdict survives
     its track changing. A unit the fleet already accepted leaves the partition by design; its
     records are preserved under runtime/recovered/ so the acceptance is not lost with it.

Exit code: 0 = nothing to recover (or a recovery was REFUSED, see the liveness interlock);
1 = recovered (re-partitioned) — launch.bat loops back.

Run from the fleet dir:  python recover-stuck.py

WHY THE VERDICT COMES FROM THE CLASSIFIER AND NOT FROM A COUNT (2026-09-24,
`conductor/archive/launcher_recovery_predicate_20260924/` — the measurement, not an argument):

  The predicate used to be `non-empty lines in runtime/progress/<track>.jsonl < manifest.code_count`
  — RECORDS compared against UNITS. Measured on incident-shaped fixtures, that comparison fails in
  BOTH directions:

    * FALSE NEGATIVE: one unit carrying a duplicated record covers a neighbour carrying none, so a
      tree the classifier calls `done-recorded=9 broken-record=1 missing=1` printed
      `[recover] no stuck tracks` and the run could reach its FLEET COMPLETE branch with work
      unfinished. "Delete the check" was rejected in 2026-09-17 for exactly that outcome; the count
      reached it while KEEPING the check.
    * COLLATERAL: the re-assigned set was `m.get("units")` — EVERY unit of a flagged track. On the
      incident's own shape four units were unfinished and SEVEN were re-dispatched, three of them
      already `done-recorded`.

  The 2026-09-17 reviewers had falsified every replacement predicate they could build, because the
  only sound signal (manifest-declared `test_paths`) was then absent 11/11 (`ISSUE_fleet_gate_
  uncloseable_and_launcher_halt_20260917.md` §1.4). That measurement has since expired by the
  fleet's own change: `partition.py` now REFUSES a partition whose units do not declare `test_paths`
  and emits the declaration into every manifest BEFORE any worker runs, and all 11 units of the
  incident fleet carry it. `reconcile.py` certifies against that declaration and never against a
  record's own `test_path` (measured spoofable 8/8 without it), so the verdict this script needs
  already exists and has one home.

  Bounds, stated rather than implied (measured 2026-09-24): the declaration fixes WHICH path
  certifies a unit, not that a real test is at it — a touched empty file plus a `tested` record is
  `done-recorded`. This script therefore trusts the classifier no further than the classifier
  trusts the declaration, and it does not inspect test content.

WHY THE CENSUS AND THE INTERLOCK EXIST (2026-09-17 bottleneck-cop handoff,
`modelstack_framework/temp/archived/ISSUE_fleet_launcher_validator_correctness_20260917.md`
F-B and F-C — both measured, neither patched by that role):

  * F-B, "the validator's verdict is unobservable": the no-stuck branch printed
    `[recover] no stuck tracks` WITHOUT printing the census it computed, so that line could not
    be distinguished from "the validator saw nothing at all" — the same tree, the same script,
    and the same command produced `no stuck tracks` (exit 0) in one run and a 4-track stuck
    census (exit 1) in another. Both branches now print the per-track census AND the number of
    manifests read, so a green verdict is falsifiable, and the census now names each not-done
    unit with the classifier's OWN bucket word for it.

  * F-C, "the destructive path has no liveness guard": the re-partition step
    `shutil.rmtree`d EVERY `tracks/track-*` directory, including one a RUNNING worker owned.
    Observed in one invocation: `tracks/` went from 6 directories to 1 and `ownership.json`
    collapsed to a single owner for six keys, while the pool was live. The sizing formula
    `max(1, (len(unfinished) + 21) // 22)` is the second half of the defect — for the 7
    unfinished units measured that day it evaluates to exactly 1, so a 6-track fleet on a
    24-core box became a 1-track fleet.

WHY A RECORD IS RE-SHARDED (measured 2026-09-24, E-8 of the track above): `reconcile.py` looks a
progress record up as `(track, unit id)`, so a unit that changes track loses its certification —
measured: moving one unit's record to a sibling track turned a `done-recorded` unit into `missing`.
A recovery that re-partitions without re-sharding would DEMOTE work the fleet had accepted.
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import time

FLEET_DIR = os.path.dirname(os.path.abspath(__file__))

#: The classifier's per-unit buckets, and what each one means for a RE-DISPATCH decision. Every
#: bucket except `done-recorded` puts its unit back in the queue, because the queue is the only
#: mechanism this fleet has to reach a worker — `has-file` is not "unfinished work", it is a unit
#: whose record is missing and whose artifact exists, and its action ("adopt: verify + record",
#: per `track-prompt.md` and `integrator-prompt.md`) is a worker action that can only happen if the
#: unit is queued. The bucket word is carried into this script's output so the action is never
#: inferred from membership alone.
BUCKETS = ("done-recorded", "has-file", "broken-record", "missing")

#: What each bucket asks of whoever picks the unit up (printed, never inferred downstream).
BUCKET_ACTION = {
    "has-file": "adopt: verify + record (never rework)",
    "broken-record": "fix: a terminal record without its declared artifact",
    "missing": "write",
}


def count_lines(path):
    if not os.path.exists(path):
        return 0
    return sum(1 for ln in open(path, encoding="utf-8") if ln.strip())


def stray_dirs():
    """Track dirs under this fleet, in track order (the destructive step's real subject)."""
    return sorted(glob.glob(os.path.join(FLEET_DIR, "tracks", "track-*")))


def live_worker_count():
    """How many live fleet instances carry this fleet's track pattern, or None.

    `guard.ps1` next to this file answers exactly this question — the launcher's own
    double-launch guard reads the same number, so the two can never disagree — and it is
    read-only. `None` means UNKNOWABLE (guard absent, unreadable or unrunnable), and an
    unknowable answer must never be read as "safe to delete": the step it guards DELETES
    every track directory.
    """
    guard = os.path.join(FLEET_DIR, "guard.ps1")
    if not os.path.exists(guard):
        return None
    pattern = os.path.join(FLEET_DIR, "tracks", "track-")
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", guard,
             "-Pattern", pattern],
            capture_output=True, text=True, timeout=60, cwd=FLEET_DIR)
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    try:
        return int((out.stdout or "0").strip() or 0)
    except ValueError:
        return None


def read_progress_records():
    """`{unit id: [raw jsonl line, ...]}` over every track's progress file, in file order.

    Read BEFORE the destructive step, so the records can travel with their units. The key is the
    UNIT, not the track: that is the whole point (see the E-8 note in this file's docstring).
    """
    by_unit = {}
    progress_dir = os.path.join(FLEET_DIR, "runtime", "progress")
    if not os.path.isdir(progress_dir):
        return by_unit
    for path in sorted(glob.glob(os.path.join(progress_dir, "*.jsonl"))):
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                raw = line.strip()
                if not raw:
                    continue
                try:
                    rec = json.loads(raw)
                except ValueError:
                    continue
                uid = rec.get("id") or rec.get("code") or rec.get("unit")
                if uid:
                    by_unit.setdefault(uid, []).append(raw)
    return by_unit


def classify():
    """`(verdicts, reason)` where verdicts is `{track: [(unit id, bucket), ...]}` in manifest order.

    The verdict is the fleet's OWN classifier's, read out of the artifact it already writes
    (`reconcile-report.json`, consumed by the worker and integrator prompts). ANY failure to obtain
    it is a REFUSAL, never a guess: a recovery that acts on an unknown classification is the
    behaviour that produced the 2026-09-17 collapse.
    """
    script = os.path.join(FLEET_DIR, "reconcile.py")
    if not os.path.exists(script):
        return None, "reconcile.py is not in the fleet dir — the classification cannot be obtained"
    try:
        run = subprocess.run([sys.executable, script], capture_output=True, text=True,
                             timeout=900, cwd=FLEET_DIR)
    except (OSError, subprocess.SubprocessError) as exc:
        return None, "reconcile.py could not be run (%s)" % (exc.__class__.__name__,)
    # 0 = everything done-recorded, 1 = work remains. Both are ANSWERS to this script's question;
    # anything else is the classifier failing, not reporting.
    if run.returncode not in (0, 1):
        return None, "reconcile.py exited %d (not its 0/1 verdict)" % run.returncode
    report_path = os.path.join(FLEET_DIR, "reconcile-report.json")
    if not os.path.exists(report_path):
        return None, "reconcile.py wrote no reconcile-report.json"
    # STALENESS: a report older than the newest input it claims to describe is not an answer about
    # THIS tree (a crashed classifier can leave yesterday's report in place).
    newest = 0.0
    inputs = glob.glob(os.path.join(FLEET_DIR, "tracks", "track-*", "manifest.json"))
    inputs += glob.glob(os.path.join(FLEET_DIR, "runtime", "progress", "*.jsonl"))
    for path in inputs:
        try:
            newest = max(newest, os.path.getmtime(path))
        except OSError:
            pass
    if newest and os.path.getmtime(report_path) < newest:
        return None, ("reconcile-report.json is older than the tree it describes "
                      "(stale report: %.0f < %.0f)" % (os.path.getmtime(report_path), newest))
    try:
        report = json.load(open(report_path, encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return None, "reconcile-report.json is unreadable (%s)" % (exc.__class__.__name__,)
    per_track = report.get("per_track")
    if not isinstance(per_track, dict) or not per_track:
        return None, "reconcile-report.json carries no per_track verdicts"
    verdicts = {}
    for track, data in per_track.items():
        buckets = (data or {}).get("buckets")
        if not isinstance(buckets, dict) or any(b not in buckets for b in BUCKETS):
            return None, ("reconcile-report.json is missing one of the buckets %s for %s"
                          % (", ".join(BUCKETS), track))
        rows = []
        for bucket in BUCKETS:
            for entry in buckets[bucket]:
                rows.append((entry.get("id"), bucket))
        if not rows:
            return None, "reconcile-report.json carries no units for %s" % track
        verdicts[track] = rows
    return verdicts, ""


def main():
    verdicts, why = classify()
    if verdicts is None:
        print("[recover] REFUSING to re-partition: %s." % why)
        print("[recover] Nothing was changed. The classification that drives every deletion here "
              "could not be obtained, and an unknown answer is never read as 'nothing to do'.")
        return 0

    manifests = {}
    for mp in sorted(glob.glob(os.path.join(FLEET_DIR, "tracks", "track-*", "manifest.json"))):
        man = json.load(open(mp, encoding="utf-8"))
        manifests[man.get("track_id")] = man
    units_by_id = {u["id"]: u for man in manifests.values() for u in man.get("units", [])}

    # clean stray dirs (wrong-path writes) under every track dir
    cleaned = []
    for d in stray_dirs():
        for sub in ("docs", "src", "conductor"):
            p = os.path.join(d, sub)
            if os.path.isdir(p):
                shutil.rmtree(p, ignore_errors=True)
                cleaned.append(os.path.relpath(p, FLEET_DIR))

    stuck, unfinished = [], []
    print("[recover] census: %d track(s) classified by reconcile.py" % len(verdicts))
    for track in sorted(verdicts):
        rows = verdicts[track]
        not_done = [(uid, bucket) for uid, bucket in rows if bucket != "done-recorded"]
        kinds = {b: sum(1 for _u, k in rows if k == b) for b in BUCKETS}
        print("[recover]   %s %s" % (track, " ".join("%s=%d" % (b, kinds[b]) for b in BUCKETS)))
        for uid, bucket in not_done:
            print("[recover]     not done: %s [%s] -> %s"
                  % (uid, bucket, BUCKET_ACTION.get(bucket, "?")))
        if not_done:
            stuck.append(track)
            unfinished.extend((uid, bucket) for uid, bucket in not_done)

    if not stuck:
        if cleaned:
            print("[recover] cleaned stray dirs: " + ", ".join(cleaned))
        print("[recover] no stuck tracks")
        return 0

    print("[recover] stuck tracks: %s" % ", ".join(sorted(stuck)))
    print("[recover] units to re-dispatch: %d (%s)"
          % (len(unfinished), ", ".join("%s=%s" % (u, b) for u, b in unfinished)))
    if cleaned:
        print("[recover] cleaned stray dirs: " + ", ".join(cleaned))

    units_path = os.path.join(FLEET_DIR, "units.json")
    if not os.path.exists(units_path):
        print("[recover] units.json missing - cannot re-partition")
        return 0

    # The re-partition carries EXACTLY the units the classifier does not certify - nothing else.
    # A unit classified `done-recorded` is finished work; putting it back in a manifest is the
    # collateral the incident measured (four units unfinished, seven re-dispatched, three of them
    # already accepted). The consequence is stated rather than hidden: the accepted units leave
    # the manifest census by design, so the records that proved them accepted are preserved
    # durably below (a re-partition is not a place to lose evidence).
    carried, accepted = [], []
    for track in sorted(verdicts):
        for uid, bucket in verdicts[track]:
            unit = units_by_id.get(uid)
            if unit is None:
                continue
            (carried if bucket != "done-recorded" else accepted).append(unit)
    if not carried:
        print("[recover] no unfinished unit to re-partition")
        return 0

    # ---- LIVENESS INTERLOCK (F-C) -------------------------------------------------------
    # Everything below DELETES every tracks/track-* directory. That is only ever safe when no
    # worker owns one of them, and this script cannot tell "stalled" from "busy" (every
    # replacement predicate tried on 2026-09-17 was falsified — see the cop handoff F-C). So it
    # asks the ONE question it CAN answer with an existing, read-only instrument, and refuses on
    # anything but a known-zero count.
    live = live_worker_count()
    if live is None:
        print("[recover] REFUSING to re-partition: cannot determine whether a worker is still "
              "live (guard.ps1 missing or unusable), and this step DELETES every "
              "tracks/track-* directory. Nothing was changed.")
        return 0
    if live > 0:
        print("[recover] REFUSING to re-partition: %d live fleet instance(s) detected "
              "(%s). Deleting a RUNNING worker's track directory destroys its run - on "
              "2026-09-17 one invocation collapsed tracks/ from 6 directories to 1 this way. "
              "Stop the fleet deliberately (restart.bat) or wait for it to exit, then re-run."
              % (live, os.path.join(FLEET_DIR, "tracks", "track-")))
        return 0

    records = read_progress_records()

    # remove stale track dirs so the re-partition starts clean
    for d in stray_dirs():
        shutil.rmtree(d, ignore_errors=True)

    # A unit the fleet ACCEPTED keeps its evidence even though it leaves the partition: its
    # records are written to a durable, non-progress file. (`runtime/progress/` is read by the
    # classifier per track, so a preserved record must NOT go back in there - a later partition
    # reusing a track id could otherwise certify a different unit from a stale record.)
    if accepted:
        keep_dir = os.path.join(FLEET_DIR, "runtime", "recovered")
        os.makedirs(keep_dir, exist_ok=True)
        with open(os.path.join(keep_dir, "accepted-%d.jsonl" % int(time.time())), "a",
                  encoding="utf-8") as fh:
            for unit in accepted:
                for raw in records.get(unit["id"], []):
                    fh.write(raw + chr(10))
        print("[recover] preserved %d accepted unit(s)' records in runtime/recovered/ "
              "(they leave units.json by design)" % len(accepted))

    json.dump(carried, open(units_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    # Size the NEW partition from the work that actually needs workers, and never collapse the
    # fleet below the concurrency the work supports.
    tracks = max(1, (len(unfinished) + 21) // 22)   # ~22 units/track
    existing_tracks = len(manifests)
    tracks = max(tracks, min(existing_tracks, len(unfinished)))
    max_frag = max(8, (len(carried) + tracks - 1) // tracks + 1)
    print("[recover] re-partitioning %d unit(s) (%d accepted units leave the manifest census, "
          "their records preserved) from %d track(s) into %d track(s)"
          % (len(carried), len(accepted), existing_tracks, tracks))
    subprocess.run([sys.executable, os.path.join(FLEET_DIR, "partition.py"),
                    "--tracks", str(tracks), "--units", units_path, "--max-frag", str(max_frag)],
                   cwd=FLEET_DIR, check=True)

    # ---- RE-SHARD THE RECORDS WITH THEIR UNITS (E-8) ------------------------------------
    # `reconcile.py` looks a record up as (track, unit id), so a unit that changes track would lose
    # its certification and be demoted to `has-file` by this very step. The records are therefore
    # written into their units' NEW tracks. Atomic per file (tmp + replace): an interrupted run
    # leaves the old file in place rather than a half-written one.
    assigned = {}
    for mp in sorted(glob.glob(os.path.join(FLEET_DIR, "tracks", "track-*", "manifest.json"))):
        man = json.load(open(mp, encoding="utf-8"))
        assigned[man.get("track_id")] = [u["id"] for u in man.get("units", [])]
    progress_dir = os.path.join(FLEET_DIR, "runtime", "progress")
    moved = 0
    if os.path.isdir(progress_dir):
        for track, ids in assigned.items():
            lines = []
            for uid in ids:
                lines.extend(records.get(uid, []))
                moved += len(records.get(uid, []))
            target = os.path.join(progress_dir, track + ".jsonl")
            tmp = target + ".reshard-tmp"
            with open(tmp, "w", encoding="utf-8") as fh:
                fh.write("".join(ln + "\n" for ln in lines))
            os.replace(tmp, target)
        for path in glob.glob(os.path.join(progress_dir, "*.jsonl")):
            if os.path.basename(path)[:-6] not in assigned:
                os.remove(path)          # a track that no longer exists keeps no records
    print("[recover] re-sharded %d progress record(s) into %d track(s)"
          % (moved, len(assigned)))
    print("[recover] re-partitioned %d unit(s) (%d re-dispatched) into %d track(s)"
          % (len(carried), len(unfinished), tracks))
    return 1


if __name__ == "__main__":
    sys.exit(main())
