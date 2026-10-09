#!/usr/bin/env python3
"""tv_construct_tile.py — CONSTRUCTION-PATH DIAGNOSTIC v10 (muse Fix A validation, scratch only).

v9 note (superseded): its INFEASIBLE verdict used FLAT edge lengths (164) for the
G2 arc gaps; the gate measures ARC gaps on the wave-inflated ring (~290 per
top edge), so G2+G9 IS arithmetically feasible. The v7/v8 placement failures
were a single inverted formula: scale = total*len(cycle)/(sum(cycle)*n), not
total/sum*n/len.

v10 = v8 geometry (wave cubics per half-period + rounded corners) with the
fixed scale, global cyclic root walk, kind assignment per edge, dual-metric
gap validation, and the gate as the final arbiter.
"""
import math
import json
import subprocess
import sys

W, H = 224, 256
VINE = "#1A1A1A"
MID, AMP, H2 = 16.0, 10.0, 1.2
RAIL = 30.0
GAPS_TB = [24, 38, 28, 42, 32]
GAPS_LR = [26, 38, 30, 42, 32, 28]
COMBO_TB, COMBO_LR = (6, 3), (6, 3)
THORN_W, THORN_H = 7.0, 9.0
LEAF_L, LEAF_W = 14.0, 6.0
LEAF_OFF = 0.35
ROOT_CYCLE = [20, 26, 22, 32, 24, 28]
CORNER_R = 12.0


def frac_in_gaps(u, gaps):
    total = sum(gaps)
    uu = u % total
    c = 0.0
    for g in gaps:
        if uu <= c + g + 1e-9:
            return (uu - c) / g
        c += g
    return 0.0


def rail_d(u, gaps):
    th = 2 * math.pi * frac_in_gaps(u, gaps)
    return MID - AMP * math.cos(th) + H2 * math.cos(2 * th)


def wave_cubics(gaps, span):
    segs = []
    u = 0.0
    while u < span - 1e-9:
        c = 0.0
        g = None
        gg = 0.0
        for gv in gaps:
            if u < c + gv - 1e-9:
                g = gv
                gg = c
                break
            c += gv
        if g is None:
            break
        half = g / 2
        for k in (0, 1):
            ua = gg + k * half
            ub = ua + half
            pa = (ua, rail_d(ua, gaps))
            pb = (ub, rail_d(ub, gaps))
            kk = 0.9
            c1 = (pa[0] + (pb[0] - pa[0]) / 3 * kk, pa[1])
            c2 = (pb[0] - (pb[0] - pa[0]) / 3 * kk, pb[1])
            segs.append((pa, (c1, c2, pb)))
        u = gg + g
    return segs


def build_ring():
    def xform(name):
        if name == "top":
            return lambda u, y: (RAIL + u, y)
        if name == "bottom":
            return lambda u, y: (W - RAIL - u, H - y)
        if name == "right":
            return lambda u, y: (W - y, RAIL + u)
        return lambda u, y: (y, H - RAIL - u)
    order = ["top", "right", "bottom", "left"]
    segs = []
    for name in order:
        gaps, span = (GAPS_TB, W - 2 * RAIL) if name in ("top", "bottom") else (GAPS_LR, H - 2 * RAIL)
        ws = wave_cubics(gaps, span)
        f = xform(name)
        wse = [(f(p0[0], p0[1]), (f(c1[0], c1[1]), f(c2[0], c2[1]), f(p1[0], p1[1]))) for p0, (c1, c2, p1) in ws]
        segs.extend(wse)
        rail_end = wse[-1][1][2]
        nxt_name = order[(order.index(name) + 1) % 4]
        nxt = xform(nxt_name)
        ng, nspan = (GAPS_TB, W - 2 * RAIL) if nxt_name in ("top", "bottom") else (GAPS_LR, H - 2 * RAIL)
        nws = wave_cubics(ng, nspan)
        p_start = nxt(nws[0][0][0], nws[0][0][1])
        corner = {"top": (W, 0), "right": (W, H), "bottom": (0, H), "left": (0, 0)}[name]
        sx = 1 if corner[0] == 0 else -1
        sy = 1 if corner[1] == 0 else -1
        n_end = {"top": (0, 1), "right": (-1, 0), "bottom": (0, -1), "left": (1, 0)}[name]
        n_start = {"top": (-1, 0), "right": (0, 1), "bottom": (1, 0), "left": (0, -1)}[nxt_name]
        t1 = (rail_end[0] + n_end[0] * CORNER_R, rail_end[1] + n_end[1] * CORNER_R)
        t2 = (p_start[0] + n_start[0] * CORNER_R, p_start[1] + n_start[1] * CORNER_R)
        c_center = (corner[0] + sx * CORNER_R, corner[1] + sy * CORNER_R)
        k = 4 / 3 * math.tan(math.pi / 8)
        v1 = (t1[0] - c_center[0], t1[1] - c_center[1])
        v2 = (t2[0] - c_center[0], t2[1] - c_center[1])
        c1 = (t1[0] - k * v1[1], t1[1] + k * v1[0])
        c2 = (t2[0] + k * v2[1], t2[1] - k * v2[0])
        segs.append((rail_end, (c1, c2, p_start)))
    flat = flatten_cubics(segs, n=14)
    d_parts = ["M%.2f,%.2f" % segs[0][0]]
    for p0, (c1, c2, p1) in segs:
        d_parts.append("C%.2f,%.2f %.2f,%.2f %.2f,%.2f" % (c1[0], c1[1], c2[0], c2[1], p1[0], p1[1]))
    d_parts.append("Z")
    return " ".join(d_parts), flat


def flatten_cubics(segs, n=14):
    out = []
    for p0, (c1, c2, p1) in segs:
        for i in range(n):
            t = i / n
            mt = 1 - t
            out.append((mt**3 * p0[0] + 3 * mt**2 * t * c1[0] + 3 * mt * t**2 * c2[0] + t**3 * p1[0],
                        mt**3 * p0[1] + 3 * mt**2 * t * c1[1] + 3 * mt * t**2 * c2[1] + t**3 * p1[1]))
    out.append(segs[-1][1][1])
    return out


def dedupe(pts):
    out = [pts[0]]
    for p in pts[1:]:
        if math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > 1e-6:
            out.append(p)
    return out


def gate_arc_positions(flat):
    S = []
    carry = 0.0
    acc = 0.0
    for a, b in zip(flat[:-1], flat[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L == 0:
            continue
        t = carry
        while t < L:
            f = t / L
            S.append(((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f), acc + t))
            t += 0.5
        carry = t - L
        acc += L
    return S, acc


def depth_min(x, y):
    return min(y, W - x, H - y, x)


def edge_of(x, y):
    cands = [("top", y), ("right", W - x), ("bottom", H - y), ("left", x)]
    return min(cands, key=lambda c: c[1])[0]


def loop_proj(x, y):
    e = edge_of(x, y)
    if e == "top":
        return x
    if e == "right":
        return W + y
    if e == "bottom":
        return W + H + (W - x)
    return 2 * (W + H) + (H - y)


def nearest_sample_arc(p, S):
    best, bd = 0.0, 1e9
    for (q, s) in S:
        d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2
        if d < bd:
            bd = d
            best = s
    return best


def assign_kinds(roots):
    per = {e: [] for e in ("top", "right", "bottom", "left")}
    for p in roots:
        per[edge_of(*p)].append(p)
    out = {}
    for e, (nt, nl) in (("top", COMBO_TB), ("bottom", COMBO_TB), ("left", COMBO_LR), ("right", COMBO_LR)):
        ps = sorted(per[e], key=lambda p: loop_proj(*p))
        if len(ps) != nt + nl:
            return None
        thorn_ok = [i for i, p in enumerate(ps) if 8.6 <= depth_min(*p) <= 31.0]
        leaf_ok = [i for i, p in enumerate(ps) if 12.0 <= depth_min(*p) <= 28.9]
        if len(thorn_ok) < nt or len(leaf_ok) < nl:
            return None
        thorns = set()
        step = len(thorn_ok) / nt
        for k in range(nt):
            thorns.add(thorn_ok[min(int(k * step), len(thorn_ok) - 1)])
        if len(thorns) < nt:
            return None
        leaves = [i for i in leaf_ok if i not in thorns]
        if len(leaves) < nl:
            return None
        leaf_set = set(leaves[:nl])
        out[e] = [("t" if i in thorns else "l", ps[i]) for i in range(len(ps))
                  if i in thorns or i in leaf_set]
        if len(out[e]) != nt + nl:
            return None
    return out


def check_gaps(roots, S, total_arc):
    for metric in ("arc", "proj"):
        if metric == "arc":
            vals = sorted(nearest_sample_arc(p, S) for p in roots)
            tot = total_arc
        else:
            vals = sorted(loop_proj(*p) for p in roots)
            tot = 2 * (W + H)
        gaps = [(vals[(i + 1) % len(vals)] - vals[i]) % tot for i in range(len(vals))]
        if any(g < 20 - 0.4 or g > 60 + 0.4 for g in gaps):
            return "%s gaps out of [20,60]: %s" % (metric, [round(g, 1) for g in gaps])
        diffs = [abs(gaps[i] - gaps[(i + 1) % len(gaps)]) for i in range(len(gaps))]
        if any(d < 4 - 0.4 for d in diffs):
            return "%s consecutive diffs < 4: %s" % (metric, [round(d, 1) for d in diffs])
        if len(set(round(g, 1) for g in gaps)) < 3:
            return "%s fewer than 3 distinct gaps" % metric
        n = len(gaps)
        for i in range(n):
            g = [gaps[(i + k) % n] for k in range(4)]
            if abs(g[0] - g[2]) <= 0.5 and abs(g[1] - g[3]) <= 0.5:
                return "%s period-2 at %d" % (metric, i)
        for i in range(n):
            g = [gaps[(i + k) % n] for k in range(6)]
            if abs(g[0] - g[3]) <= 0.5 and abs(g[1] - g[4]) <= 0.5 and abs(g[2] - g[5]) <= 0.5:
                return "%s period-3 at %d" % (metric, i)
    return None


def place_roots(S, total_arc):
    n = sum(nt + nl for nt, nl in (COMBO_TB, COMBO_TB, COMBO_LR, COMBO_LR))
    scale = total_arc * len(ROOT_CYCLE) / (sum(ROOT_CYCLE) * n)
    for off in [x * 0.5 for x in range(0, 80)]:
        positions = []
        s = off
        gi = 0
        while len(positions) < n:
            if s >= total_arc:
                s -= total_arc
            positions.append(s)
            s += ROOT_CYCLE[gi % len(ROOT_CYCLE)] * scale
            gi += 1
        roots = []
        used = set()
        ok = True
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
                break
            used.add(best)
            roots.append(S[best][0])
        if not ok:
            continue
        err = check_gaps(roots, S, total_arc)
        if err:
            continue
        kinds = assign_kinds(roots)
        if kinds is None:
            continue
        return roots, kinds
    return None, None


def build_sprouts(kinds):
    thorns_svg, leaves_svg = [], []
    for e in ("top", "right", "bottom", "left"):
        nx, ny = {"top": (0, -1), "right": (1, 0), "bottom": (0, 1), "left": (-1, 0)}[e]
        for kind, (x, y) in kinds[e]:
            if kind == "t":
                tipx, tipy = x + nx * THORN_H, y + ny * THORN_H
                px, py = -ny, nx
                thorns_svg.append('<path fill="%s" d="M%.2f,%.2f L%.2f,%.2f L%.2f,%.2f Z"/>' % (
                    VINE, x + px * THORN_W / 2, y + py * THORN_W / 2, tipx, tipy, x - px * THORN_W / 2, y - py * THORN_W / 2))
            else:
                ang = 0.0 if e in ("top", "bottom") else 90.0
                cx, cy = x - nx * LEAF_OFF, y - ny * LEAF_OFF
                leaves_svg.append('<ellipse cx="%.2f" cy="%.2f" rx="%.2f" ry="%.2f" fill="%s" transform="rotate(%.1f %.2f %.2f)"/>' % (
                    cx, cy, LEAF_L / 2, LEAF_W / 2, VINE, ang, cx, cy))
    return thorns_svg, leaves_svg


def main():
    ring_d, flat = build_ring()
    S, total_arc = gate_arc_positions(dedupe(flat))
    roots, kinds = place_roots(S, total_arc)
    if roots is None:
        print("no feasible global placement")
        sys.exit(2)
    thorns, leaves = build_sprouts(kinds)
    svg = ('<svg viewBox="0 0 224 256" xmlns="http://www.w3.org/2000/svg">'
           '<path fill="none" stroke="%s" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="%s"/>'
           "%s%s</svg>") % (VINE, ring_d, "".join(thorns), "".join(leaves))
    out = "temp/scratch/tv_constructed_tile.svg"
    open(out, "w", encoding="utf-8").write(svg)
    print("wrote", out, "chars", len(svg), "| ring arc:", round(total_arc, 1))
    g = subprocess.run(["node", "temp/scratch/thornvine_acceptance_gate.js", out, "--json"],
                       capture_output=True, text=True)
    try:
        rep = json.loads(g.stdout)
    except Exception:
        print("gate parse fail:", g.stdout[:300], g.stderr[:300]); sys.exit(1)
    print("passing:", [k for k, v in rep["gates"].items() if v])
    det = rep.get("detail", {})
    for k in ("midEdgeChordDevs", "cornerChordDevs", "unrootedCount", "flatWindows",
              "alongGaps", "projGaps", "perEdgeSprouts"):
        if k in det:
            print(k, "=", json.dumps(det[k])[:300])
    for key in ("fail_G1_sinuous_all_edges", "fail_G2_gap_rhythm", "fail_G4_sprouts_rooted",
                "fail_G6_bands", "fail_G7_extremum_tiling", "fail_G8_corner_turns",
                "fail_G10_smoothness", "fail_G9_sprout_inventory", "fail_G5_directions"):
        v = det.get(key)
        if v:
            print(key, "->", (v[:10] if isinstance(v, list) else v))


if __name__ == "__main__":
    main()
