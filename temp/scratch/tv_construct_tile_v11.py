#!/usr/bin/env python3
"""tv_construct_tile_v11.py — CONSTRUCTION-PATH v11: the joint G2+G9 re-derivation.

leg-5b record §6 / muse iter-20 §5 item 4: "10/10 claims need a re-derived placement
satisfying BOTH metrics jointly (v11)." v10's fixed ROOT_CYCLE arc walk is measured
INFEASIBLE (all 80 offsets fail proj gaps [20,60]; probe tv_v11_diagnose.py).

v11 replaces the walk with a two-stage coupled planner in the gate's own coordinates:

  Stage C (corners): for each corner in traversal order, pick the pair (root on the
      corner's FIRST edge, root on its SECOND edge) that MINIMIZES the projection
      corner gap subject to gp in [24,59.5] and arc gap in [20.5,59.5] (gate bands
      with margin). Minimal gp maximizes BOTH adjacent edges' interior spans —
      measured span at min-gp: top ~189 proj units vs the 168 needed for 8 gaps
      >= 21 (mid-band pairs leave only ~127 and are measured infeasible).
  Stage E (per edge): the edge's roots are its two corner roots + 7 interior roots
      (combo (6,3) etc.). Plan the n+1 interior gap SEQUENCE first: values from a
      menu within [20,43] (arc ~ 1.2-1.4x proj on the wave, so proj <= 43 keeps
      BOTH metrics inside [20,60]), consecutive cyclic diffs >= 3.75 (gate's
      GAP_DIFF 4 minus tol), sum == span +/- 2.5, >= 3 distinct values pairwise
      >= 4 apart. Then place positions by cumulative sum, snapping each to the
      nearest ring sample of the required kind (thorn-ok / leaf-ok depth windows)
      within 2.5 proj units, and verify the REAL arc gaps >= 20 and proj gaps in
      [20,60.25] on the snapped samples.
  Stage V (full gate): the tracked gate itself is the final arbiter (all 10 gates,
      G8 disabled).

Geometry (ring, waves, sizes) is v10's, imported unchanged from tv_construct_tile.py;
only the PLACEMENT is re-derived. Scratch-only: no tracked file is touched.
"""
import math, sys, json, subprocess
from itertools import combinations

sys.path.insert(0, "temp/scratch")
import tv_construct_tile as tv

W, H = tv.W, tv.H
THORN_LO, THORN_HI = 8.6, 31.0
LEAF_LO, LEAF_HI = 12.0, 28.9
MIN_GAP = 20.0
GAP_TOL = 0.25          # the gate's own tolerance
GAP_DIFF_INNER = 4 - GAP_TOL  # consecutive cyclic diffs >= 4 (gate) minus tolerance
PROJ_LEN = 2 * (W + H)  # 960
MENU = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32, 34, 36, 38, 40, 42, 43]
COMBOS = [
    (tv.COMBO_TB, tv.COMBO_TB, tv.COMBO_LR, tv.COMBO_LR),
    ((6, 4), (6, 4), (7, 3), (7, 3)),
    ((7, 3), (7, 3), (6, 4), (6, 4)),
]
CORNERS = [  # (name, edgeA (first in traversal), edgeB (second), corner point)
    ("TR", "top", "right", (W, 0)),
    ("RB", "right", "bottom", (W, H)),
    ("BL", "bottom", "left", (0, H)),
    ("LT", "left", "top", (0, 0)),
]
EDGE_CORNER_ORDER = {  # edge -> (corner providing its START root, corner providing its END root)
    "top": ("LT", "TR"), "right": ("TR", "RB"), "bottom": ("RB", "BL"), "left": ("BL", "LT"),
}


def build(phase_pi: bool):
    orig = tv.rail_d
    def rail_d_pi(u, gaps):
        th = 2 * math.pi * tv.frac_in_gaps(u, gaps) + (math.pi if phase_pi else 0.0)
        return tv.MID - tv.AMP * math.cos(th) + tv.H2 * math.cos(2 * th)
    tv.rail_d = rail_d_pi
    try:
        ring_d, flat = tv.build_ring()
    finally:
        tv.rail_d = orig
    S, total_arc = tv.gate_arc_positions(tv.dedupe(flat))
    samples = []
    for (x, y), s in S:
        e = tv.edge_of(x, y)
        d = tv.depth_min(x, y)
        samples.append({"x": x, "y": y, "s": s, "e": e, "d": d, "p": tv.loop_proj(x, y),
                        "t": THORN_LO <= d <= THORN_HI, "l": LEAF_LO <= d <= LEAF_HI})
    return ring_d, total_arc, samples


def pwrap(a, b):
    return (b - a) % PROJ_LEN


def awrap(a, b, total):
    return (b - a) % total


def pick_corners(total_arc, by_edge):
    """Corner roots with EDGE-SPECIFIC tie-breaks (measured v11c):

    - TR pair (top end-root, right start-root): the TOP edge is the binding span
      (183 available vs 176.4 legal minimum for 8 gaps), so MAXIMIZE the top
      root's proj first — pure gp-minimization picks er=193 and kills the top
      span (measured). Key: (-top_p, gp).
    - RB (right end, bottom start) / BL (bottom end, left start) / LT (left end,
      top start): gp-minimization ALIGNS with both adjacent spans (measured),
      key: (gp, secondary).
    """
    corner_roots = {}

    def legal_pairs(ea, eb):
        ca = [q for q in by_edge[ea] if q["t"]]
        cb = [q for q in by_edge[eb] if q["t"]]
        pairs = []
        for qa in ca:
            for qb in cb:
                gp = pwrap(qa["p"], qb["p"])
                ga = awrap(qa["s"], qb["s"], total_arc)
                if not (24.0 <= gp <= 59.5 and 20.5 <= ga <= 59.5):
                    continue
                pairs.append((gp, ga, qa, qb))
        return pairs

    # Span-targeted tie-breaks (measured v11d — spans, not gp, are the binding need):
    #   TR: MAXIMIZE the top root's p (top's end late; right span is wide ~178-220).
    #   RB: min gp, then MINIMIZE the bottom root's p (bottom's start early).
    #   BL: min gp, then MAXIMIZE the bottom root's p (bottom's end late; bottom
    #       span = BL_p - RB_p peaks ~183 vs the 176.4 legal minimum — tight).
    #   LT: MINIMIZE the top root's p (top's start early -> span = TR_p - LT_top_p
    #       peaks ~184 vs the 176.4 legal minimum — the binding edge). The early top
    #       roots live on the TL corner arc (p 21-32, s 1305-1331): they need a left
    #       root with s <= ~1292 so the arc straddle reaches 20 — the left root rides
    #       p ~932-936, and the proj straddle 960-left_p+top_p stays in [24,59.5]
    #       (e.g. 960-934+21 = 47). gp is the SECONDARY key.
    tr = sorted(legal_pairs("top", "right"), key=lambda t: (-t[2]["p"], t[0]))
    rb = sorted(legal_pairs("right", "bottom"), key=lambda t: (t[0], t[3]["p"]))
    bl = sorted(legal_pairs("bottom", "left"), key=lambda t: (t[0], -t[2]["p"]))
    lt = sorted(legal_pairs("left", "top"), key=lambda t: (t[3]["p"], t[0]))
    return {"TR": tr, "RB": rb, "BL": bl, "LT": lt}


def gap_sequences(n_gaps, span):
    """Legal interior gap sequences summing to ~span.

    Measured (v11c): the tight TB spans (~183) need NEAR-FLOOR values with the
    period-2 ban dodged by a 0.55/pair DRIFT (the gate's eq tolerance is 0.5;
    consecutive diffs must stay >= 3.75 = GAP_DIFF - TOL). Family: alternating
    low/high pairs v = lo + k*drift / lo + U + k*drift, U solved from the span;
    plus a coarse-DFS fallback for variety. All values within [19.75, 43].
    """
    lo_floor, hi_cap = 20 - GAP_TOL, 43.0
    need_diff = 4 - GAP_TOL
    out = []

    def ok_seq(seq):
        # NOTE: the gate's ">= 3 values pairwise >= 4 apart" pools the edge's own gaps
        # WITH the two adjacent corner gaps (gate code: all = [...values, ...cornerGaps]),
        # so it CANNOT be checked per-edge in isolation — the corner straddles (~24-52)
        # supply the third independent value. Enforced in full_rhythm_ok instead.
        for i in range(len(seq) - 3):
            g = seq[i:i + 4]
            if abs(g[0] - g[2]) <= 0.5 and abs(g[1] - g[3]) <= 0.5:
                return False
        return True

    # drift family (even n_gaps): alternating up/down pairs with drift d
    if n_gaps % 2 == 0:
        pairs = n_gaps // 2
        for d in (0.56, 0.6, 0.65, 0.7, 0.8):
            for lo in (lo_floor, lo_floor + 0.25, lo_floor + 0.5):
                base = n_gaps * lo + 2 * d * (pairs * (pairs - 1) // 2) * 2 / 2
                # sum = n*lo + pairs*U + 2*d*(0+1+..+(pairs-1))  -> solve U
                s_fixed = n_gaps * lo + d * (pairs - 1) * pairs
                U = (span - s_fixed) / pairs
                if not (need_diff <= U <= 24.0):
                    continue
                seq = []
                for k in range(pairs):
                    seq.append(lo + k * d)
                    seq.append(lo + U + k * d)
                if all(lo_floor <= v <= hi_cap for v in seq) and \
                   all(abs(seq[i + 1] - seq[i]) >= need_diff for i in range(n_gaps - 1)) and \
                   abs(seq[-1] - seq[0]) >= need_diff and ok_seq(seq):
                    out.append(seq)
    # coarse DFS fallback (variety for wide spans)
    menu = [19.75, 20.5, 21.5, 22.5, 24, 25.5, 27, 29, 31, 33, 35, 37, 39, 41, 43]
    def dfs(seq, total):
        if len(out) >= 48:
            return
        k = len(seq)
        if k == n_gaps:
            if abs(total - span) <= 2.5 and abs(seq[0] - seq[-1]) >= need_diff and ok_seq(seq):
                out.append(list(seq))
            return
        rem = n_gaps - k
        for v in menu:
            if seq and abs(v - seq[-1]) < need_diff:
                continue
            if total + v > span + 2.5 or total + v + 20 * (rem - 1) > span + 2.5:
                continue
            seq.append(v)
            dfs(seq, total + v)
            seq.pop()
    dfs([], 0.0)
    return out


def plan_edge_variants(total_arc, edge_samples, lo, hi, nt, nl, k=5,
                       open_arc=None, open_proj=None, close_arc=None, close_proj=None):
    """Up to k chain-verified placements for one edge (different gap sequences).

    open_*/close_* are the corner-straddle gaps ADJACENT to this edge (arc + proj);
    the global rhythm's consecutive-diff check spans them, so per-edge planning
    verifies |interior gap - straddle gap| >= GAP_DIFF - TOL at both boundaries and
    >= GAP_DIFF - TOL between consecutive interior gaps (both metrics).
    The global rhythm check (period bans, per-edge pairwise-3) stays in full_rhythm_ok."""
    n_int = nt + nl - 2
    span = hi["p"] - lo["p"]
    seqs = gap_sequences(n_int + 1, span)
    if not seqs:
        return None, f"no gap sequence for span {span:.1f} ({n_int + 1} gaps)"
    outs = []
    for seq in seqs:
        pos = lo["p"]
        targets = []
        # the LAST gap of the sequence is the closing gap TO hi — its target is hi
        # itself, so only the first n_gaps-1 gaps produce interior pick targets.
        for g in seq[:-1]:
            pos += g
            targets.append(pos)
        if targets and (targets[0] < lo["p"] + MIN_GAP - GAP_TOL or targets[-1] > hi["p"] - MIN_GAP + GAP_TOL):
            continue
        # for kind assignment: candidates per slot
        cand = []
        seq_ok = True
        for t in targets:
            cs = [q for q in edge_samples if q["t"] and abs(q["p"] - t) <= 2.5]
            clq = [q for q in edge_samples if q["l"] and abs(q["p"] - t) <= 2.5]
            if not cs and not clq:
                seq_ok = False
                break
            cand.append((cs, clq))
        if not seq_ok:
            continue
        # choose which n_l slots carry leaves; others thorns. Per slot, DFS over the
        # nearest candidates with chain verification + backtracking (nearest-only
        # picks measurably snap 19.75-planned gaps down to 19.7 real — under the
        # gate's 19.75 floor — with no retry).
        for leaf_slots in combinations(range(n_int), nl):
            leaf_set = set(leaf_slots)
            pools = []
            feasible = True
            for i, (cs, clq) in enumerate(cand):
                pool = clq if i in leaf_set else cs
                if not pool:
                    feasible = False
                    break
                t = targets[i]
                pool = sorted(pool, key=lambda q: abs(q["p"] - t))[:4]
                pools.append(pool)
            if not feasible:
                continue
            picks = [None] * n_int

            def pick_dfs(i):
                if i == n_int:
                    chain = [lo] + picks + [hi]
                    links = []
                    for a, b in zip(chain[:-1], chain[1:]):
                        links.append((b["p"] - a["p"], awrap(a["s"], b["s"], total_arc)))
                    for dp, da in links:
                        if dp < MIN_GAP - GAP_TOL or dp > 60 + GAP_TOL:
                            return False
                        if da < MIN_GAP - GAP_TOL or da > 60 + GAP_TOL:
                            return False
                    # consecutive diffs inside the chain + at both straddle boundaries
                    seq_vals = [g for g in links]
                    if open_arc is not None:
                        seq_vals = [(open_proj, open_arc)] + seq_vals
                    if close_arc is not None:
                        seq_vals = seq_vals + [(close_proj, close_arc)]
                    for m in (0, 1):
                        vals = [sv[m] for sv in seq_vals]
                        for a, b in zip(vals[:-1], vals[1:]):
                            if abs(a - b) < GAP_DIFF_INNER:
                                return False
                    return True
                for q in pools[i]:
                    picks[i] = q
                    # prune: link against the previous placed element
                    prev = lo if i == 0 else picks[i - 1]
                    if prev is not None:
                        dp = q["p"] - prev["p"]
                        da = awrap(prev["s"], q["s"], total_arc)
                        if dp < MIN_GAP - GAP_TOL or dp > 60 + GAP_TOL:
                            continue
                        if da < MIN_GAP - GAP_TOL or da > 60 + GAP_TOL:
                            continue
                    if pick_dfs(i + 1):
                        return True
                picks[i] = None
                return False

            if pick_dfs(0):
                outs.append([("t", lo)] + [("l" if i in leaf_set else "t", picks[i]) for i in range(n_int)] + [("t", hi)])
                if len(outs) >= k:
                    return outs, None
    if not outs:
        return None, f"no legal placement over {len(seqs)} sequences"
    return outs, None


def derive(phase_pi, combo_idx):
    combo = COMBOS[combo_idx]
    ring_d, total_arc, samples = build(phase_pi)
    (nt_t, nl_t), (nt_b, nl_b), (nt_l, nl_l), (nt_r, nl_r) = combo
    per_need = {"top": (nt_t, nl_t), "bottom": (nt_b, nl_b), "left": (nt_l, nl_l), "right": (nt_r, nl_r)}
    by_edge = {e: sorted([q for q in samples if q["e"] == e], key=lambda q: q["p"]) for e in per_need}
    corner_lists = pick_corners(total_arc, by_edge)
    # try several corner-pick combinations before giving up (per-edge span needs differ)
    attempts = []
    for trp in corner_lists["TR"][:6]:
        for rbp in corner_lists["RB"][:3]:
            for blp in corner_lists["BL"][:3]:
                for ltp in corner_lists["LT"][:6]:
                    corner_roots = {"TR": (trp[2], trp[3]), "RB": (rbp[2], rbp[3]),
                                    "BL": (blp[2], blp[3]), "LT": (ltp[2], ltp[3])}
                    # per-edge VARIANTS (different gap sequences), then a product walk
                    # against the GLOBAL cyclic rhythm check. Straddle gaps are passed
                    # in so per-edge planning can respect the cyclic consecutive-diff
                    # constraint at both boundaries (the global check spans them).
                    corner_gaps = {}
                    for cname, ea, eb, _cpt in CORNERS:
                        qa, qb = corner_roots[cname]
                        corner_gaps[cname] = (awrap(qa["s"], qb["s"], total_arc),
                                              pwrap(qa["p"], qb["p"]))
                    edge_vars = {}
                    ok = True
                    for e, (cf, cl) in EDGE_CORNER_ORDER.items():
                        # UNIFORM slot rule: pair = (root on the corner's FIRST edge,
                        # root on its SECOND edge) in traversal order; an edge's START
                        # comes from c_first as that corner's SECOND edge (slot [1]),
                        # its END from c_last as that corner's FIRST edge (slot [0]).
                        sr = corner_roots[cf][1]
                        er = corner_roots[cl][0]
                        if sr["p"] > er["p"]:
                            sr, er = er, sr
                        nt, nl = per_need[e]
                        oa, op_ = corner_gaps[cf]
                        ca_, cp_ = corner_gaps[cl]
                        res, err = plan_edge_variants(total_arc, by_edge[e], sr, er, nt, nl,
                                                      open_arc=oa, open_proj=op_,
                                                      close_arc=ca_, close_proj=cp_)
                        if err:
                            attempts.append(f"{e}[span {er['p'] - sr['p']:.0f}]: {err}")
                            ok = False
                            break
                        edge_vars[e] = res
                    if not ok:
                        continue
                    from itertools import product as iproduct
                    for combo_vars in iproduct(*[edge_vars[e] for e in ("top", "right", "bottom", "left")]):
                        roots = []
                        for e, plan in zip(("top", "right", "bottom", "left"), combo_vars):
                            for k, q in plan:
                                roots.append({"x": q["x"], "y": q["y"], "e": e, "k": k,
                                              "s": q["s"], "p": q["p"]})
                        roots.sort(key=lambda r: r["s"])
                        rerr = full_rhythm_ok(roots, total_arc)
                        if rerr:
                            attempts.append(f"rhythm: {rerr}")
                            continue
                        kinds = {e: [(k, (q["x"], q["y"])) for k, q in plan]
                                 for e, plan in zip(("top", "right", "bottom", "left"), combo_vars)}
                        return (kinds, None), ring_d, total_arc, samples, None
    return None, ring_d, total_arc, samples, "; ".join(attempts[-4:]) or "no corner/edge combination feasible"


def full_rhythm_ok(roots, total_arc):
    def check(vals, tot, name):
        gaps = [(vals[(i + 1) % len(vals)] - vals[i]) % tot for i in range(len(vals))]
        if any(g < 20 - GAP_TOL or g > 60 + GAP_TOL for g in gaps):
            return f"{name} gap out of [20,60]: {[round(g,1) for g in gaps]}"
        diffs = [abs(gaps[i] - gaps[(i + 1) % len(gaps)]) for i in range(len(gaps))]
        if any(d < 4 - 2 * GAP_TOL for d in diffs):
            return f"{name} consecutive diffs < 4"
        if len(set(round(g, 1) for g in gaps)) < 3:
            return f"{name} fewer than 3 distinct gaps"
        n = len(gaps)
        for i in range(n):
            g = [gaps[(i + k) % n] for k in range(4)]
            if abs(g[0] - g[2]) <= 0.5 and abs(g[1] - g[3]) <= 0.5:
                return f"{name} period-2 at {i}"
        for i in range(n):
            g = [gaps[(i + k) % n] for k in range(6)]
            if abs(g[0] - g[3]) <= 0.5 and abs(g[1] - g[4]) <= 0.5 and abs(g[2] - g[5]) <= 0.5:
                return f"{name} period-3 at {i}"
        return None
    e1 = check(sorted(r["s"] for r in roots), total_arc, "arc")
    if e1:
        return e1
    e2 = check(sorted(r["p"] for r in roots), PROJ_LEN, "proj")
    if e2:
        return e2
    roots_sorted = sorted(roots, key=lambda r: r["s"])
    key_of = {"arc": "s", "proj": "p"}
    for metric, tot in (("arc", total_arc), ("proj", PROJ_LEN)):
        vals = sorted(r[key_of[metric]] for r in roots)
        gaps = []
        for i in range(len(vals)):
            a, b = roots_sorted[i], roots_sorted[(i + 1) % len(roots_sorted)]
            gaps.append(((vals[(i + 1) % len(vals)] - vals[i]) % tot, a, b))
        for e in ("top", "right", "bottom", "left"):
            own = [g[0] for g in gaps if tv.edge_of(g[1]["x"], g[1]["y"]) == e]
            if not own:
                continue
            allv = list(own)
            for g, a, b in gaps:
                ea, eb = tv.edge_of(a["x"], a["y"]), tv.edge_of(b["x"], b["y"])
                if ea != eb:
                    mx, my = (a["x"] + b["x"]) / 2, (a["y"] + b["y"]) / 2
                    dd = {"top": my, "right": W - mx, "bottom": H - my, "left": mx}
                    if sorted(dd.items(), key=lambda c: c[1])[0][0] == e:
                        allv.append(g)
            allv.sort()
            chosen = []
            for v in allv:
                if all(abs(v - c) >= 4 - GAP_TOL for c in chosen):
                    chosen.append(v)
            if len(chosen) < 3:
                return f"{e} ({metric}) pairwise-3 holds only {len(chosen)}"
    return None


def main():
    attempts = []
    for phase in (False, True):
        for ci in range(len(COMBOS)):
            res, ring_d, total_arc, samples, err = derive(phase, ci)
            tag = f"phase-{'pi' if phase else '0'} combo{ci}"
            if err:
                attempts.append(f"[{tag}] {err}")
                continue
            kinds, rerr = res
            if rerr:
                attempts.append(f"[{tag}] rhythm: {rerr}")
                continue
            print(f"[{tag}] FEASIBLE root set found")
            thorns, leaves = tv.build_sprouts(kinds)
            svg = ('<svg viewBox="0 0 224 256" xmlns="http://www.w3.org/2000/svg">'
                   '<path fill="none" stroke="#1A1A1A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="%s"/>'
                   "%s%s</svg>") % (ring_d, "".join(thorns), "".join(leaves))
            out = "temp/scratch/tv_constructed_tile_v11.svg"
            open(out, "w", encoding="utf-8").write(svg)
            print("wrote", out, "chars", len(svg), "| ring arc:", round(total_arc, 1))
            g = subprocess.run(["node", "scripts/thornvine_acceptance_gate.js", out, "--json"],
                               capture_output=True, text=True)
            rep = json.loads(g.stdout)
            passing = [k for k, v in rep["gates"].items() if v]
            print("tracked gate passing:", passing, f"({len(passing)}/10, G8 disabled counts as pass)")
            det = rep.get("detail", {})
            for k in ("alongGaps", "projGaps", "unrootedCount", "midEdgeChordDevs", "cornerChordDevs"):
                if k in det:
                    print(" ", k, "=", json.dumps(det[k])[:220])
            for key in sorted(det):
                if key.startswith("fail_"):
                    print(" ", key, "->", json.dumps(det[key])[:300])
            return 0
    print("v11: no feasible placement across phases x combos")
    for a in attempts:
        print(" ", a)
    return 2


if __name__ == "__main__":
    sys.exit(main())
