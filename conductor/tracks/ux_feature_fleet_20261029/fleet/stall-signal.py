#!/usr/bin/env python3
"""
stall-signal.py — the missing instrument (fleet-delegation §7.2 watchdog).

WHY THIS EXISTS (the 2026-09-17 cop handoff on the stall clock,
`modelstack_framework/temp/archived/ISSUE_fleet_launcher_halt_and_stall_signal_20260917.md` §3):
  The watchdog's stall clock was the LINE COUNT of `runtime/progress/<track>.jsonl`, and
  `track-prompt.md` writes that line only AFTER a unit is verified. So the clock measured
  "no unit COMPLETED in V minutes", not silence — for a track's first long unit, ZERO progress
  lines is the correct state of a HEALTHY worker. The rule could not separate "long unit" from
  "stalled" at ANY threshold, so all three of its candidate values (700 -> 90 -> 45) were
  falsified and none was shipped. The blocked remedy was named precisely: two different clocks
  need two different measurements.

  This script supplies both, and refuses to invent a threshold from too small a sample:
    * UNIT DURATION -> `runtime/units/<track>.jsonl`, one `start`/`end` pair per unit.
    * TRUE LIVENESS  -> `runtime/heartbeat-log/<track>.jsonl`, one line per heartbeat beat
                        (append-only, so SILENCE is measurable independently of unit
                        completion — the snapshot file `runtime/heartbeats/<track>.json` has
                        no history and cannot yield a gap).
  `derive` prints the p95 of each SEPARATELY and the two thresholds each yields; `silence`
  answers the only question the watchdog needs per track.

Subcommands:
  derive  --fleet-dir DIR              p95 unit duration + p95 heartbeat gap -> the two thresholds
  silence --fleet-dir DIR --track ID   seconds since the track's last heartbeat (or UNINSTRUMENTED)

Exit codes:
  0  ok
  3  INSUFFICIENT DATA / UNINSTRUMENTED — deliberately non-zero: a threshold must never be
     derived, and a track must never be called healthy, from a sample too small to support it.
  2  usage error
"""
import argparse
import json
import math
import os
import sys
import time

# protocol constants the derivation is bounded by (track-prompt.md)
HEARTBEAT_INTERVAL_S = 120
STALL_THRESHOLD_S = 360          # a track's OWN self-reporting clause (3 missed beats)
MIN_UNIT_SAMPLES = 3             # p95 of < 3 durations is not a percentile, it is an anecdote
MIN_GAP_SAMPLES = 5


def p95(values):
    """Nearest-rank 95th percentile (no interpolation: every value is a real observation)."""
    if not values:
        return None
    ordered = sorted(values)
    idx = max(0, math.ceil(0.95 * len(ordered)) - 1)
    return ordered[idx]


def _read_jsonl(path):
    if not os.path.isfile(path):
        return []
    out = []
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except ValueError:
                continue
    return out


def unit_durations(runtime, track):
    """Seconds per unit, from paired `start`/`end` records (unpaired records are reported)."""
    recs = _read_jsonl(os.path.join(runtime, "units", f"{track}.jsonl"))
    starts, ends = {}, {}
    for r in recs:
        uid, ev, epoch = r.get("unit"), r.get("event"), r.get("epoch")
        if uid is None or not isinstance(epoch, (int, float)):
            continue
        if ev == "start":
            starts.setdefault(uid, epoch)
        elif ev == "end":
            ends[uid] = epoch
    durations, unpaired = [], []
    for uid, start in starts.items():
        if uid in ends and ends[uid] >= start:
            durations.append(ends[uid] - start)
        else:
            unpaired.append(uid)
    for uid in ends:
        if uid not in starts:
            unpaired.append(uid)
    return durations, sorted(set(unpaired))


def heartbeat_gaps(runtime, track):
    """Seconds between consecutive heartbeat beats (the true-liveness signal)."""
    recs = _read_jsonl(os.path.join(runtime, "heartbeat-log", f"{track}.jsonl"))
    epochs = sorted(r["epoch"] for r in recs
                    if isinstance(r.get("epoch"), (int, float)))
    return [b - a for a, b in zip(epochs, epochs[1:]) if b >= a]


def tracks(runtime):
    d = os.path.join(runtime, "heartbeat-log")
    if not os.path.isdir(d):
        return []
    return sorted(f[:-6] for f in os.listdir(d) if f.endswith(".jsonl"))


def cmd_derive(args):
    runtime = os.path.join(os.path.abspath(args.fleet_dir), "runtime")
    ts = tracks(runtime)
    all_durations, all_gaps = [], []
    print("STALL INSTRUMENT — derivation")
    print(f"  runtime: {runtime}")
    if not ts:
        print("  tracks: NONE — no runtime/heartbeat-log/<track>.jsonl exists")
    for t in ts:
        durations, unpaired = unit_durations(runtime, t)
        gaps = heartbeat_gaps(runtime, t)
        all_durations += durations
        all_gaps += gaps
        print(f"  {t}: unit_durations={len(durations)} (unpaired={len(unpaired)}) "
              f"heartbeat_gaps={len(gaps)}")
        if unpaired:
            print(f"      unpaired unit records (no start or no end): {', '.join(unpaired)}")
    p95_unit = p95(all_durations)
    p95_gap = p95(all_gaps)
    print("")
    print(f"  p95 unit duration : {p95_unit if p95_unit is not None else 'n/a'} s "
          f"(n={len(all_durations)})")
    print(f"  p95 heartbeat gap : {p95_gap if p95_gap is not None else 'n/a'} s "
          f"(n={len(all_gaps)})")
    problems = []
    if len(all_durations) < MIN_UNIT_SAMPLES:
        problems.append(f"unit durations: {len(all_durations)} sample(s) < {MIN_UNIT_SAMPLES}")
    if len(all_gaps) < MIN_GAP_SAMPLES:
        problems.append(f"heartbeat gaps: {len(all_gaps)} sample(s) < {MIN_GAP_SAMPLES}")
    if problems:
        print("")
        print("INSUFFICIENT DATA — refusing to derive a threshold:")
        for p in problems:
            print(f"  - {p}")
        print("  A threshold derived from this sample would be an anecdote. Keep the current")
        print("  windows (launch.bat TRACK_TIMEOUT / PROGRESS_STALL = 700 min) unchanged.")
        return 3
    # Two clocks, two quantities. UNIT_DEADLINE is a ceiling on ONE unit; STALL_SILENCE is a
    # liveness window on the heartbeat and never reuses the unit duration.
    unit_deadline = int(math.ceil(p95_unit))
    stall_silence = max(3 * HEARTBEAT_INTERVAL_S, int(math.ceil(p95_gap * 3)))
    print("")
    print(f"  DERIVED UNIT_DEADLINE  = {unit_deadline} s  ({unit_deadline/60:.1f} min) "
          f"= ceil(p95 unit duration)")
    print(f"  DERIVED STALL_SILENCE  = {stall_silence} s  ({stall_silence/60:.1f} min) "
          f"= max(3 x {HEARTBEAT_INTERVAL_S}s, ceil(3 x p95 heartbeat gap))")
    print(f"  (the track's own self-reporting STALL_THRESHOLD_S is {STALL_THRESHOLD_S} s)")
    return 0


def _track_is_a_stem(track: str) -> bool:
    """A track id is a FILE STEM — never a path.

    `--track` is interpolated into `runtime/heartbeat-log/<track>.jsonl`, so a value
    carrying a separator (or `..`) reads an arbitrary file outside the fleet. The CLI
    is operator-invoked, but "the caller is trusted" is not a property this instrument
    should need: it is read-only, so the cheapest correct answer is to refuse.
    """
    t = str(track or "")
    if not t or t in (".", ".."):
        return False
    return not any(c in t for c in ("/", "\\", ":", "\x00"))


def cmd_silence(args):
    if not _track_is_a_stem(args.track):
        print(f"BAD TRACK ID {args.track!r} — a track id is a file stem, "
              f"not a path (nothing was read)")
        return 2
    runtime = os.path.join(os.path.abspath(args.fleet_dir), "runtime")
    path = os.path.join(runtime, "heartbeat-log", f"{args.track}.jsonl")
    recs = _read_jsonl(path)
    now = time.time()
    # A beat is a PAST, finite instant. A future one is not a beat (a worker writing
    # its own log could otherwise look alive forever by stamping `now + 1e9`), and a
    # non-finite one (`json` accepts Infinity/NaN) used to reach `int()` and raise
    # OUT of the watchdog's verdict.
    epochs = [float(r["epoch"]) for r in recs
              if isinstance(r.get("epoch"), (int, float))
              and not isinstance(r.get("epoch"), bool)
              and math.isfinite(float(r["epoch"]))
              and 0 < float(r["epoch"]) <= now]
    if not epochs:
        print(f"UNINSTRUMENTED {args.track}")
        return 3
    silence = int(max(0, now - max(epochs)))
    print(f"{'SILENT' if args.silent_after and silence >= args.silent_after else 'ALIVE'} "
          f"{silence} {args.track}")
    return 0


def main():
    ap = argparse.ArgumentParser(description="fleet stall instrument (two clocks)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("derive", help="p95 unit duration + p95 heartbeat gap -> two thresholds")
    d.add_argument("--fleet-dir", required=True)
    s = sub.add_parser("silence", help="seconds since a track's last heartbeat")
    s.add_argument("--fleet-dir", required=True)
    s.add_argument("--track", required=True)
    s.add_argument("--silent-after", type=int, default=0,
                   help="classify SILENT at/above this many seconds (0 = always ALIVE)")
    args = ap.parse_args()
    return cmd_derive(args) if args.cmd == "derive" else cmd_silence(args)


if __name__ == "__main__":
    sys.exit(main())
