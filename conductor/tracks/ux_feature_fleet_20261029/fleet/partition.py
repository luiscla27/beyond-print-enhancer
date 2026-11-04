#!/usr/bin/env python3
"""
partition.py — deterministic, mechanical partitioner (fleet-delegation skill §1).

Reads units.json (list of units) and bin-packs them into N mutually-exclusive
tracks by component_key (largest-first, least-loaded). No key is shared between
tracks, and write paths never overlap — the collision boundary of the fleet.

units.json schema:
[
  {
    "id": "ISSUE-123",                 # unit id (must be unique)
    "component_key": "java:qms/foo",   # partition key (collision boundary)
    "write_dir": "C:/repo/src/test/java/qms/foo",  # ABSOLUTE (repo-root-prefixed); string or list
    "files": ["C:/repo/src/main/java/qms/foo/Foo.java"], # ABSOLUTE production files (evidence)
    "test_paths": ["src/test/java/qms/foo/FooTest.java"],  # MANDATORY, see below
    "meta": {"risk": "LOW"}            # optional, copied into the manifest
  }
]

`test_paths` is the SCAFFOLD-TIME DECLARATION of the artifact(s) that will certify the unit —
emitted into `manifest.json` before any worker runs, so the worker whose work it certifies
never chooses it. Repo-relative paths are resolved against the repo root
(`<repo>/conductor/tracks/<track>/fleet` -> four levels up); absolute paths are used as-is.
Declare `[]` for a unit whose honest disposition is `documented-no-test`.

Why it is mandatory (2026-09-17, `ISSUE_fleet_gate_uncloseable_and_launcher_halt_20260917`
§1): `reconcile.py` used to derive the artifact by scanning the unit's own write_dir, which for
this repo's unit ids matches nothing — so a `tested` record could only ever classify as
`broken-record` and the integration gate was UNSATISFIABLE. The obvious repair (trust the
progress record's `test_path`) was measured to promote genuinely unfinished units, 8 spoofs of
8. A declaration fixed before dispatch is the only signal a worker cannot forge.

Outputs (into this fleet dir):
  ownership.json                       authoritative component_key -> track_id
  tracks/<track-id>/manifest.json      per-track units + component keys + write paths
  tracks/<track-id>/LAUNCH-PROMPT.md   per-track agent prompt (from track-prompt.md)

Run from the fleet dir or with --fleet-dir. Deterministic: same input -> same
partition. Re-run with the same N is stable; changing N re-balances (safe because
ownership only becomes authoritative once agents start).

Usage:
  python partition.py --tracks 8
  python partition.py --tracks 8 --units path/to/units.json
  python partition.py --check            # verify disjointness of existing outputs
"""
import argparse
import json
import os
import sys
from collections import defaultdict


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)


def pad(n, width):
    return str(n).zfill(width)


def verify(ownership, manifests, units, max_frag=8):
    """Return list of violation strings (empty = OK). max_frag = fragmentation-guard ceiling:
    n_keys > max_frag x n_tracks fails (default 8)."""
    problems = []
    keys_by_track = defaultdict(list)
    for key, track in ownership.items():
        keys_by_track[track].append(key)
    for track, keys in keys_by_track.items():
        dup = [k for k in keys if keys.count(k) > 1]
        if dup:
            problems.append(f"key duplicated in {track}: {dup[:3]}")
    # every unit's key is mapped
    unit_ids = {u["id"] for u in units}
    mapped = set()
    for m in manifests.values():
        for u in m.get("units", []):
            mapped.add(u["id"])
    if unit_ids != mapped:
        problems.append(f"unit mismatch: {len(unit_ids - mapped)} unmapped, {len(mapped - unit_ids)} foreign")
    # write paths disjoint across tracks
    # HARDENED 2026-09-17 (built-in reviewer finding): the original check compared
    # `wp.rstrip("/\\").lower()` — an EXACT string compare with no separator normalisation
    # and no nesting test, so `C:/a/b` in one track and `C:/a/b/c` (or `C:\a\b`) in another
    # were certified disjoint. The collision boundary is a subtree, so normalise separators
    # and reject ancestor/descendant overlap across DIFFERENT tracks (overlap inside ONE
    # track is legal: a track may own a directory and a file beneath it).
    def _norm(p):
        return p.replace("\\", "/").rstrip("/").lower()

    def _overlaps(a, b):
        return a == b or a.startswith(b + "/") or b.startswith(a + "/")

    owners = defaultdict(list)          # normalised path -> [(track, original)]
    for track, m in manifests.items():
        for wp in m.get("write_paths", []):
            owners[_norm(wp)].append((track, wp))
    for norm_path, holders in owners.items():
        tracks_here = sorted({t for t, _ in holders})
        if len(tracks_here) > 1:
            problems.append("write path '%s' shared by %s" % (norm_path, tracks_here))
    norm_paths = sorted(owners)
    for i, a in enumerate(norm_paths):
        for b in norm_paths[i + 1:]:
            if _overlaps(a, b):
                ta = sorted({t for t, _ in owners[a]})
                tb = sorted({t for t, _ in owners[b]})
                if ta != tb:
                    problems.append(
                        "write-path overlap across tracks: '%s' %s vs '%s' %s "
                        "(nested paths are not disjoint)" % (a, ta, b, tb))
    # SCAFFOLD-TIME DECLARATION (mandatory): every unit says up front which artifact certifies
    # it, or declares [] for a documented-no-test unit. reconcile.py refuses to certify a
    # `tested` record without it (every worker-choosable signal was measured spoofable, 8/8).
    declared_by_id = {}
    for u in list(units) + [u for m in manifests.values() for u in m.get("units", [])]:
        declared_by_id.setdefault(u.get("id"), u)
    for uid, u in sorted(declared_by_id.items(), key=lambda kv: str(kv[0])):
        if "test_paths" not in u:
            problems.append(
                f"unit {uid} declares no test_paths — the scaffold-time declaration is "
                f"mandatory (use [] for a documented-no-test unit)")
            continue
        declared = u.get("test_paths")
        if not isinstance(declared, list) or any(
                not isinstance(p, str) or not p.strip() for p in declared):
            problems.append(
                f"unit {uid} test_paths must be a list of non-empty strings (got {declared!r})")
    # balance
    counts = sorted(len(m.get("units", [])) for m in manifests.values())
    if len(counts) > 1 and counts[-1] - counts[0] > max(2, len(counts)):
        problems.append(f"unbalanced tracks: min={counts[0]} max={counts[-1]}")
    # fragmentation guard: far more keys than tracks is a symptom of a wrong partition key
    # (e.g. keying on an external label instead of the write path) — fail loudly rather than
    # launch a collision-prone fleet. (Singletons alone are NOT flagged: sparse write trees
    # legitimately produce many single-unit directories; the real failures are write-path
    # overlap, imbalance, and key count an order of magnitude above the track count.)
    n_tracks = len(manifests) or 1
    key_sizes = defaultdict(int)
    for m in manifests.values():
        for u in m.get("units", []):
            key_sizes[u["component_key"]] += 1
    n_keys = len(key_sizes)
    if n_keys > max_frag * n_tracks:
        problems.append(f"fragmented partition: {n_keys} keys for {n_tracks} tracks (>{max_frag}x) — coarsen the partition key (derive it from the write path, not labels), or raise --max-frag if the key set is legitimately dense (many coarse write-path subtrees)")
    return problems


def main():
    ap = argparse.ArgumentParser(description="fleet-delegation partitioner (§1)")
    ap.add_argument("--tracks", type=int, default=8, help="number of tracks (default 8)")
    ap.add_argument("--units", default=None, help="units.json (default <fleet-dir>/units.json)")
    ap.add_argument("--fleet-dir", default=None, help="fleet dir (default: this script's dir)")
    ap.add_argument("--check", action="store_true", help="verify existing outputs, exit 1 on violation")
    ap.add_argument("--max-frag", type=int, default=8, help="fragmentation guard: keys > max-frag x tracks fails (default 8)")
    args = ap.parse_args()

    fleet_dir = os.path.abspath(args.fleet_dir) if args.fleet_dir else os.path.dirname(os.path.abspath(__file__))
    units_path = os.path.abspath(args.units) if args.units else os.path.join(fleet_dir, "units.json")
    if not os.path.exists(units_path):
        sys.exit(f"units.json not found at {units_path} — pass --units or place units.json in the fleet dir")

    units = load(units_path)
    ids = [u["id"] for u in units]
    if len(ids) != len(set(ids)):
        sys.exit("units.json has duplicate ids")

    # FAIL FAST: the scaffold-time artifact declaration is what makes the integration gate
    # satisfiable at all, so a partition is never written without it.
    undeclared = [str(u.get("id")) for u in units if "test_paths" not in u]
    if undeclared:
        sys.exit("units.json: every unit must declare `test_paths` at scaffold time — the "
                 "artifact(s) that will certify it (repo-relative or absolute), or [] for a "
                 "documented-no-test unit. Missing for: " + ", ".join(undeclared))

    if args.check:
        ownership_path = os.path.join(fleet_dir, "ownership.json")
        tracks_dir = os.path.join(fleet_dir, "tracks")
        if not os.path.exists(ownership_path) or not os.path.isdir(tracks_dir):
            sys.exit("--check: ownership.json / tracks/ missing — run partition.py first")
        ownership = load(ownership_path)
        manifests = {}
        for name in sorted(os.listdir(tracks_dir)):
            mp = os.path.join(tracks_dir, name, "manifest.json")
            if os.path.exists(mp):
                manifests[name] = load(mp)
        problems = verify(ownership, manifests, units, args.max_frag)
        if problems:
            print("PARTITION CHECK: FAIL")
            for p in problems:
                print("  -", p)
            sys.exit(1)
        print(f"PARTITION CHECK: PASS — {len(units)} units, {len(manifests)} tracks, disjoint write paths.")
        sys.exit(0)

    # group by component_key, largest-first packing into least-loaded track
    by_key = defaultdict(list)
    for u in units:
        by_key[u["component_key"]].append(u)
    order = sorted(by_key, key=lambda k: (-len(by_key[k]), k))
    loads = [0] * args.tracks
    assignment = {}  # key -> track index
    for key in order:
        idx = min(range(args.tracks), key=lambda i: loads[i])
        assignment[key] = idx
        loads[idx] += len(by_key[key])

    width = max(2, len(str(args.tracks - 1)))
    ownership = {key: f"track-{pad(i, width)}" for key, i in assignment.items()}
    tracks = defaultdict(list)
    for key, track in ownership.items():
        tracks[track].extend(by_key[key])

    prompt_tpl = os.path.join(fleet_dir, "track-prompt.md")
    if not os.path.exists(prompt_tpl):
        sys.exit(f"track-prompt.md template not found at {prompt_tpl} — scaffold first")
    with open(prompt_tpl, encoding="utf-8") as f:
        prompt_text = f.read()

    manifests = {}
    for track, track_units in tracks.items():
        write_paths = []
        for u in track_units:
            wps = u["write_dir"] if isinstance(u["write_dir"], list) else [u["write_dir"]]
            for wp in wps:
                if wp not in write_paths:
                    write_paths.append(wp)
        manifests[track] = {
            "track_id": track,
            "code_count": len(track_units),
            "component_keys": sorted({u["component_key"] for u in track_units}),
            "write_paths": write_paths,
            "units": track_units,
        }
        save(os.path.join(fleet_dir, "tracks", track, "manifest.json"), manifests[track])
        prompt = prompt_text.replace("{{TRACK_ID}}", track)
        save_md = os.path.join(fleet_dir, "tracks", track, "LAUNCH-PROMPT.md")
        with open(save_md, "w", encoding="utf-8") as f:
            f.write(prompt)

    save(os.path.join(fleet_dir, "ownership.json"), dict(sorted(ownership.items())))

    problems = verify(ownership, manifests, units, args.max_frag)
    if problems:
        print("PARTITION: FAIL")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print(f"PARTITION: PASS — {len(units)} units / {len(by_key)} keys -> {args.tracks} tracks")
    print(f"  ownership.json, tracks/track-00..track-{pad(args.tracks - 1, width)}/manifest.json + LAUNCH-PROMPT.md written")


if __name__ == "__main__":
    main()
