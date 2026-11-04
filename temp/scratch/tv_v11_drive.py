#!/usr/bin/env python3
"""tv_v11_drive.py — joint corner-combination drive for v11 with full outcome tally."""
import sys
sys.path.insert(0, "temp/scratch")
import tv_construct_tile_v11 as v
from collections import Counter

ring_d, total_arc, samples = v.build(False)
combo = v.COMBOS[0]
(nt_t, nl_t), (nt_b, nl_b), (nt_l, nl_l), (nt_r, nl_r) = combo
per_need = {"top": (nt_t, nl_t), "bottom": (nt_b, nl_b), "left": (nt_l, nl_l), "right": (nt_r, nl_r)}
by_edge = {e: sorted([q for q in samples if q["e"] == e], key=lambda q: q["p"]) for e in per_need}
corner_lists = v.pick_corners(total_arc, by_edge)
outcomes = []
found = None
for ti, trp in enumerate(corner_lists["TR"][:8]):
    for ri, rbp in enumerate(corner_lists["RB"][:3]):
        for bi, blp in enumerate(corner_lists["BL"][:3]):
            for li, ltp in enumerate(corner_lists["LT"][:8]):
                corner_roots = {"TR": (trp[2], trp[3]), "RB": (rbp[2], rbp[3]),
                                "BL": (blp[2], blp[3]), "LT": (ltp[2], ltp[3])}
                per = {}
                ok = True
                kinds_all = {}
                spans = {}
                for e, (cf, cl) in v.EDGE_CORNER_ORDER.items():
                    sr = corner_roots[cf][1]
                    er = corner_roots[cl][0]
                    if sr["p"] > er["p"]:
                        sr, er = er, sr
                    spans[e] = (sr["p"], er["p"])
                    res, err = v.plan_edge(total_arc, by_edge[e], sr, er, *per_need[e])
                    if err:
                        per[e] = "FAIL " + err[:70]
                        ok = False
                        break
                    per[e] = "ok"
                    kinds_all[e] = res
                key = (ti, ri, bi, li)
                if not ok:
                    fail_e = [e for e, s in per.items() if s.startswith("FAIL")][0]
                    outcomes.append((fail_e, per[fail_e]))
                    continue
                rr = []
                for e in ("top", "right", "bottom", "left"):
                    for k, q in kinds_all[e]:
                        rr.append({"x": q["x"], "y": q["y"], "e": e, "k": k,
                                   "s": q["s"], "p": q["p"]})
                rr.sort(key=lambda r: r["s"])
                rerr = v.full_rhythm_ok(rr, total_arc)
                if rerr:
                    outcomes.append(("rhythm", str(rerr)[:90]))
                else:
                    found = (key, corner_roots, kinds_all, spans)
                    break
            if found:
                break
        if found:
            break
    if found:
        break
if found:
    key, corner_roots, kinds_all, spans = found
    print(f"FULL SUCCESS at combo {key}")
    for e, (lo, hi) in spans.items():
        print(f"  {e}: span {hi - lo:.1f}")
    for cn, (a, b) in corner_roots.items():
        print(f"  {cn}: ({a['x']:.0f},{a['y']:.0f})p{a['p']:.0f} + ({b['x']:.0f},{b['y']:.0f})p{b['p']:.0f}")
else:
    print(Counter((o[0], o[1][:60]) for o in outcomes).most_common(10))
