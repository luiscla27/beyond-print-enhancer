#!/usr/bin/env python3
"""tv_v11_diagnose.py — WHY does v11's place_roots find no feasible placement?

For every candidate offset (0.5-unit grid, 0..40), report per-check failures of
v10/v11's `place_roots` pipeline: arc-gap check, proj-gap check, snap distance,
and assign_kinds (G9 per-edge counts + depth windows). Prints a per-offset table
and a defect tally, so the blocking gate is NAMED rather than guessed.
"""
import sys, json
from collections import Counter

sys.path.insert(0, "temp/scratch")
import importlib
import tv_construct_tile as tv

ring_d, flat = tv.build_ring()
S, total_arc = tv.gate_arc_positions(tv.dedupe(flat))
n = sum(nt + nl for nt, nl in (tv.COMBO_TB, tv.COMBO_TB, tv.COMBO_LR, tv.COMBO_LR))
scale = total_arc * len(tv.ROOT_CYCLE) / (sum(tv.ROOT_CYCLE) * n)
print(f"total_arc={total_arc:.1f} n={n} scale={scale:.4f} ROOT_CYCLE={tv.ROOT_CYCLE}")
print(f"cycle step (scaled): {[round(c*scale,1) for c in tv.ROOT_CYCLE]}")

fail_tally = Counter()
rows = []
for off_i in range(80):
    off = off_i * 0.5
    positions = []
    s = off
    gi = 0
    while len(positions) < n:
        if s >= total_arc:
            s -= total_arc
        positions.append(s)
        s += tv.ROOT_CYCLE[gi % len(tv.ROOT_CYCLE)] * scale
        gi += 1
    roots = []
    used = set()
    ok = True
    worst_snap = 0.0
    for p in positions:
        best, bd = None, 1e9
        for idx, (q, s2) in enumerate(S):
            if idx in used:
                continue
            dd = abs(s2 - p)
            if dd < bd:
                bd = dd
                best = idx
        if best is None or bd > 6.0:
            ok = False
            worst_snap = max(worst_snap, bd)
            fail_tally["snap>6"] += 1
            break
        used.add(best)
        roots.append(S[best][0])
    if not ok:
        rows.append((off, "snap>6", f"worst={worst_snap:.1f}"))
        continue
    err = tv.check_gaps(roots, S, total_arc)
    if err:
        which = err.split()[0]
        fail_tally[which] += 1
        rows.append((off, which, err))
        continue
    kinds = tv.assign_kinds(roots)
    if kinds is None:
        # diagnose per-edge
        per = {e: [] for e in ("top", "right", "bottom", "left")}
        for p in roots:
            per[tv.edge_of(*p)].append(p)
        det = []
        for e, (nt, nl) in (("top", tv.COMBO_TB), ("bottom", tv.COMBO_TB), ("left", tv.COMBO_LR), ("right", tv.COMBO_LR)):
            ps = per[e]
            cnt = len(ps)
            need = nt + nl
            thorn_ok = sum(1 for p in ps if 8.6 <= tv.depth_min(*p) <= 31.0)
            leaf_ok = sum(1 for p in ps if 12.0 <= tv.depth_min(*p) <= 28.9)
            if cnt != need:
                det.append(f"{e}:count={cnt}!={need}")
            elif thorn_ok < nt:
                det.append(f"{e}:thorn_ok={thorn_ok}<{nt}")
            elif leaf_ok < nl:
                det.append(f"{e}:leaf_ok={leaf_ok}<{nl}")
        fail_tally["assign_kinds"] += 1
        rows.append((off, "assign_kinds", " ".join(det) or "unknown"))
        continue
    print(f"FEASIBLE at off={off}")
    print(json.dumps({e: [(k, round(x, 1), round(y, 1)) for k, (x, y) in v] for e, v in kinds.items()}))
    sys.exit(0)

print("\n=== no feasible placement; per-offset failures ===")
for off, kind, det in rows:
    print(f"off={off:5.1f}  {kind:14s} {det[:110]}")
print("\n=== tally ===")
for k, v in fail_tally.most_common():
    print(f"{k}: {v}")
