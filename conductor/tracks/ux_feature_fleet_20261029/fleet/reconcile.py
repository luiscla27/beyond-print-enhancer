#!/usr/bin/env python3
"""
reconcile.py — progress + disk classifier (fleet-delegation skill §4, reference semantics).

Authoritative sources: per-track manifests (unit list + write paths), the runtime
progress records (progress/<track>.jsonl), and the WORKING TREE (test files on disk).

Classification per unit (same buckets the reference fleet proved):
  done-recorded   progress has a terminal disposition AND that disposition is corroborated
                  by an artifact the SCAFFOLD declared (see AUTHORITY below). A
                  'documented-no-test' disposition needs no artifact -> always done.
  broken-record   progress says 'tested' but the unit's SCAFFOLD-DECLARED test_paths are
                  absent from disk, or the unit declares none and cannot be certified at all
  has-file        no progress record, but the declared (or derived) artifact exists in the
                  working tree -> verify + record, never rework
  missing         no progress and no artifact -> still to do

Resume = skip done-recorded, adopt has-file (verify + record), fix broken-record,
write only missing. Never redoes done work.

AUTHORITY (the fix for the 2026-09-17 "gate UNCLOSEABLE" finding — handoff
modelstack_framework/temp/archived/ISSUE_fleet_gate_uncloseable_and_launcher_halt_20260917.md §1):
  The ONLY artifact signal a `tested` record may rest on is the unit's `test_paths`
  declaration, which is emitted at SCAFFOLD TIME (units.json -> manifest.json, before any
  worker runs) and is therefore not choosable by the worker whose work it certifies.
  Two alternatives were measured and rejected:
    - keying on the progress record's own `test_path` field: promotes genuinely unfinished
      units — measured 8 spoofs out of 8 (§1.4);
    - deriving the path from a basename scan of the unit's own write_dir: equally
      spoofer-chosen (a worker may create a file whose name contains its own unit id), so
      it may only ever produce the advisory `has-file` bucket, never a `done-recorded`.
  A unit that declares `test_paths: []` is declaring "this unit has no test artifact"; its
  honest record is `documented-no-test`, and a `tested` record on it is a broken record.

Derived test file detection (advisory only, for the record-less `has-file` bucket):
  scan the unit's write_dir(s) for files whose name (letters+digits only, lowercased)
  CONTAINS the unit id (letters+digits only, lowercased) — e.g. id "ISSUE-123" matches
  "Issue123RegressionTest.java".

Outputs:
  reconcile-report.json   per-track per-code buckets (feeds resume prompts) + summary
  printed per-track table
  --check: exit 1 unless every unit is done-recorded (the integrator gate)

Usage:
  python reconcile.py
  python reconcile.py --check
"""
import argparse
import json
import os
import re
import sys
from collections import defaultdict

KEY_RE = re.compile(r"[^a-z0-9]+")


def norm(s):
    return KEY_RE.sub("", s.lower())


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def repo_root(fleet_dir):
    """The root that repo-relative declared test paths resolve against.

    A fleet dir is `<repo>/conductor/tracks/<track>/fleet`, i.e. four levels below the root.
    """
    return os.path.abspath(os.path.join(fleet_dir, os.pardir, os.pardir, os.pardir, os.pardir))


def declared_test_paths(unit, root=None):
    """Return `(resolved_paths, declared_key_present)` for a unit.

    AUTHORITY (see module docstring): this is the only artifact signal a `tested` record may
    rest on. `test_paths` is emitted at scaffold time, so the worker whose work it certifies
    cannot choose it. The record's own `test_path` field is NEVER consulted here.
    """
    if "test_paths" not in unit:
        return [], False
    raw = unit.get("test_paths")
    if raw is None:
        return [], True
    if isinstance(raw, str):
        raw = [raw]
    out = []
    for p in raw:
        p = str(p)
        if root and not os.path.isabs(p):
            p = os.path.join(root, p)
        out.append(p)
    return out, True


def derived_candidates(unit):
    """ADVISORY ONLY (never a `done-recorded` verdict): files in the unit's write_dir(s)
    whose (letters+digits, lowercased) name contains the (letters+digits, lowercased) unit id.
    A worker can create such a file itself, which is why it cannot certify completion."""
    wps = unit["write_dir"] if isinstance(unit["write_dir"], list) else [unit["write_dir"]]
    unit_norm = norm(unit["id"])
    found = []
    for wp in wps:
        if not os.path.isdir(wp):
            continue
        for name in sorted(os.listdir(wp)):
            if norm(name).find(unit_norm) != -1:
                found.append(os.path.join(wp, name))
    return found


def main():
    ap = argparse.ArgumentParser(description="fleet-delegation reconcile (§4)")
    ap.add_argument("--fleet-dir", default=None, help="fleet dir (default: this script's dir)")
    ap.add_argument("--runtime", default=None, help="runtime dir (default <fleet-dir>/runtime)")
    ap.add_argument("--check", action="store_true", help="exit 1 unless every unit is done-recorded")
    args = ap.parse_args()

    fleet_dir = os.path.abspath(args.fleet_dir) if args.fleet_dir else os.path.dirname(os.path.abspath(__file__))
    runtime = os.path.abspath(args.runtime) if args.runtime else os.path.join(fleet_dir, "runtime")

    tracks_dir = os.path.join(fleet_dir, "tracks")
    if not os.path.isdir(tracks_dir):
        sys.exit(f"no tracks/ at {tracks_dir} — partition first")
    progress_dir = os.path.join(runtime, "progress")

    # authoritative unit list per track
    units_by_track = {}
    for name in sorted(os.listdir(tracks_dir)):
        mp = os.path.join(tracks_dir, name, "manifest.json")
        if os.path.exists(mp):
            units_by_track[name] = load(mp).get("units", [])

    # progress records: (track, unit id) -> record (last wins)
    progress = {}
    if os.path.isdir(progress_dir):
        for fname in sorted(os.listdir(progress_dir)):
            if not fname.endswith(".jsonl"):
                continue
            track = fname[:-6]
            with open(os.path.join(progress_dir, fname), encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rec = json.loads(line)
                    except ValueError:
                        continue
                    uid = rec.get("id") or rec.get("code") or rec.get("unit")
                    if uid:
                        progress[(track, uid)] = rec

    report = {"summary": {}, "per_track": {}}
    root = repo_root(fleet_dir)
    all_units = 0
    not_done = []
    ignored_record_paths = 0
    for track in sorted(units_by_track):
        stats = {"total": len(units_by_track[track]), "done-recorded": 0, "has-file": 0,
                 "broken-record": 0, "missing": 0}
        buckets = {"done-recorded": [], "has-file": [], "broken-record": [], "missing": []}
        for u in units_by_track[track]:
            uid = u["id"]
            all_units += 1
            rec = progress.get((track, uid))
            declared, declared_key = declared_test_paths(u, root)
            artifacts_exist = bool(declared) and all(os.path.isfile(p) for p in declared)
            absent = [p for p in declared if not os.path.isfile(p)]
            reason = None
            if rec and rec.get("status") == "documented-no-test":
                kind = "done-recorded"
            elif rec and rec.get("status") == "tested":
                if not declared:
                    # NO DECLARATION => nothing can certify this record. This branch is the
                    # anti-spoof property: a record's own `test_path` is never consulted, so
                    # pointing it at a file that happens to exist cannot promote a unit.
                    kind = "broken-record"
                    reason = ("no test_paths declared at scaffold time"
                              if declared_key else
                              "no test_paths key at all (pre-declaration scaffold)")
                elif absent:
                    kind = "broken-record"
                    reason = "declared test artifact(s) missing: " + ", ".join(absent)
                else:
                    kind = "done-recorded"
            elif rec:
                # non-terminal status in progress (e.g. in-flight) — treat as missing
                kind = "missing"
                reason = "non-terminal progress status: %r" % (rec.get("status"),)
            elif artifacts_exist or derived_candidates(u):
                kind = "has-file"
            else:
                kind = "missing"
            # DIAGNOSTIC ONLY — the record's own field is reported, never trusted.
            rec_path = (rec or {}).get("test_path")
            if rec_path and declared and rec_path not in declared:
                ignored_record_paths += 1
            stats[kind] += 1
            entry = {"id": uid, "test_paths": declared,
                     "test_paths_declared": declared_key,
                     "progress": rec if rec else None}
            if reason:
                entry["reason"] = reason
            if rec_path:
                entry["record_test_path_ignored"] = rec_path
            buckets[kind].append(entry)
            if kind != "done-recorded":
                not_done.append((track, uid, kind, reason))
        report["per_track"][track] = {"stats": stats, "buckets": buckets}
    report["summary"] = {
        "units": all_units,
        "done-recorded": sum(report["per_track"][t]["stats"]["done-recorded"] for t in report["per_track"]),
        "has-file": sum(report["per_track"][t]["stats"]["has-file"] for t in report["per_track"]),
        "broken-record": sum(report["per_track"][t]["stats"]["broken-record"] for t in report["per_track"]),
        "missing": sum(report["per_track"][t]["stats"]["missing"] for t in report["per_track"]),
        # the anti-spoof declaration, recorded in the artifact so a reader can audit the
        # classifier instead of trusting its verdicts
        "artifact_signal": "scaffold-declared test_paths (a record's own test_path is NEVER trusted)",
        "record_test_paths_ignored": ignored_record_paths,
        "not_done": [{"track": t, "id": i, "kind": k, "reason": r} for t, i, k, r in not_done],
    }
    with open(os.path.join(fleet_dir, "reconcile-report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1, ensure_ascii=False)

    print("RECONCILE")
    s = report["summary"]
    print(f"  units={s['units']}  done-recorded={s['done-recorded']}  "
          f"has-file={s['has-file']}  broken-record={s['broken-record']}  missing={s['missing']}")
    for track in report["per_track"]:
        st = report["per_track"][track]["stats"]
        print(f"  {track}: total={st['total']} done={st['done-recorded']} "
              f"adopt={st['has-file']} broken={st['broken-record']} missing={st['missing']}")
    for item in s["not_done"]:
        if item["reason"]:
            print(f"    {item['id']} [{item['kind']}]: {item['reason']}")

    if args.check:
        if s["has-file"] + s["broken-record"] + s["missing"] > 0:
            print("RECONCILE CHECK: FAIL — not every unit is done-recorded "
                  "(see reconcile-report.json per-track buckets for the resume lists).")
            sys.exit(1)
        print("RECONCILE CHECK: PASS — every unit done-recorded.")
        sys.exit(0)


if __name__ == "__main__":
    main()
