#!/usr/bin/env python3
"""tv_v11_probe.py — root-hostable structure of the constructor ring (phase 0 vs phase-pi).

Measures, for BOTH wave phases:
  1. junction depths (the 8 straight-end points) — thorn-ok needs depth >= 8.6, leaf >= 12
  2. per-edge ok-domains: contiguous proj intervals where a root satisfies the depth
     window AND edge_of == that edge (gate-parity nearestEdge)
  3. corner-gap minimum: (max root-owned proj before corner) -> (min after) — the
     smallest corner gap any legal placement can achieve
  4. the G2 verdict each structure implies (corner gaps must land in [20,60])

This is the feasibility probe for the v11 re-derivation (muse iter-20 §5.4).
"""
import math, sys
sys.path.insert(0, "temp/scratch")
import tv_construct_tile as tv

W, H = tv.W, tv.H
THORN_LO, THORN_HI = 8.6, 31.0
LEAF_LO, LEAF_HI = 12.0, 28.9


def analyze(phase_pi: bool):
    tag = "phase-pi" if phase_pi else "phase-0"
    # monkey-patch the wave phase: rail_d's cosine argument shifted by pi
    orig_rail_d = tv.rail_d
    def rail_d_pi(u, gaps):
        f = tv.frac_in_gaps(u, gaps)
        th = 2 * math.pi * f + (math.pi if phase_pi else 0.0)
        return tv.MID - tv.AMP * math.cos(th) + tv.H2 * math.cos(2 * th)
    tv.rail_d = rail_d_pi
    try:
        ring_d, flat = tv.build_ring()
    finally:
        tv.rail_d = orig_rail_d
    S, total_arc = tv.gate_arc_positions(tv.dedupe(flat))
    print(f"\n######## {tag}: total_arc={total_arc:.1f} samples={len(S)}")

    # per-sample classification
    pts = []
    for (x, y), s in S:
        e = tv.edge_of(x, y)
        d = tv.depth_min(x, y)
        p = tv.loop_proj(x, y)
        pts.append((x, y, s, e, d, p))

    # junctions: extremes of arc position per edge straight — find per edge the
    # min/max proj owned samples with their depths
    print("-- junction depths (samples at each straight's proj extremes) --")
    for e in ("top", "right", "bottom", "left"):
        owned = [q for q in pts if q[3] == e]
        ps = [q[5] for q in owned]
        lo, hi = min(ps), max(ps)
        lo_d = min(q[4] for q in owned if abs(q[5] - lo) < 1.0)
        hi_d = min(q[4] for q in owned if abs(q[5] - hi) < 1.0)
        print(f"  {e:6s} proj [{lo:7.1f}, {hi:7.1f}]  depth@lo={lo_d:5.2f} depth@hi={hi_d:5.2f}")

    # ok-domains per edge (thorn + leaf): contiguous proj runs
    for lo_d, hi_d, name in ((THORN_LO, THORN_HI, "thorn"), (LEAF_LO, LEAF_HI, "leaf")):
        print(f"-- {name}-ok domains (depth in [{lo_d},{hi_d}]) --")
        for e in ("top", "right", "bottom", "left"):
            owned = sorted([q for q in pts if q[3] == e and lo_d <= q[4] <= hi_d], key=lambda q: q[5])
            runs = []
            for q in owned:
                if runs and q[5] - runs[-1][1] <= 1.0:
                    runs[-1][1] = q[5]
                else:
                    runs.append([q[5], q[5]])
            widths = [round(b - a, 1) for a, b in runs]
            print(f"  {e:6s} {len(runs)} runs, widths {widths}")

    # corner-gap minimum: for each corner (pair of adjacent edges), the smallest
    # achievable gap = min over (last owned-ok proj of edge A, first of edge B)
    print("-- corner-gap minimums (thorn-ok roots, proj metric) --")
    order = [("top", "right"), ("right", "bottom"), ("bottom", "left"), ("left", "top")]
    for a, b in order:
        oa = [q for q in pts if q[3] == a and THORN_LO <= q[4] <= THORN_HI]
        ob = [q for q in pts if q[3] == b and THORN_LO <= q[4] <= THORN_HI]
        if not oa or not ob:
            print(f"  {a}->{b}: NO ok root on one side")
            continue
        # smallest achievable corner gap: min over ok-root pairs of cyclic proj distance
        best = min(((q2[5] - q1[5]) % 960) for q1 in oa for q2 in ob)
        print(f"  {a:6s}->{b:6s}: min corner gap = {best:6.1f}  (max A proj {max(q[5] for q in oa):.1f}, min B proj {min(q[5] for q in ob):.1f})")
    return pts


analyze(False)
analyze(True)
