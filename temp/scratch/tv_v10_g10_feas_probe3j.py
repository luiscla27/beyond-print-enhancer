# G10 curvature feasibility, probe 3j (the RAMP-RADIUS hypothesis — final shape family):
# R(t) = s * (Rlead + (Rflip - Rlead) * (t/thmax)^p) as a function of SLOPE ANGLE t:
#   Rlead at the crest (gentle), Rflip at max slope (tight, the flip zone).
# Radius changes CONTINUOUSLY (no junction jumps -> no jump-dips), stays positive,
# and the flip is a point (sign change of curvature at max slope, where depth stays
# monotone). Unknowns (s, thmax); targets (run, rise) by 2D bisection.
# Turn budget: int dt over 2*thmax; arc = int R dt must land in [22.5, 42.5].
import math

CURV_MIN = 0.5


def wall(run, rise, Rlead, Rflip, p):
    def integrate(s, thmax, step=0.25):
        # first half: t 0 -> thmax
        u = d = 0.0
        t = 0.0
        pts = [(0.0, 0.0, 0.0)]
        arc = 0.0
        while t < thmax - 1e-9:
            tt = min(t + step, thmax)
            Rm = s * (Rlead + (Rflip - Rlead) * (((t + tt) / 2) / thmax) ** p)
            ds = Rm * (tt - t)
            um = math.cos((t + tt) / 2) * ds
            dm = math.sin((t + tt) / 2) * ds
            u += um
            d += dm
            arc += ds
            pts.append((u, d, tt))
            t = tt
        return pts, u, d, arc

    # solve s for run closure at given thmax (u monotone decreasing in s)
    def close_s(thmax):
        lo, hi = 0.2, 3.0
        for _ in range(60):
            mid = (lo + hi) / 2
            _, u, _, _ = integrate(mid, thmax)
            if u > run:  # u increases with s (larger radii -> longer reach)
                hi = mid
            else:
                lo = mid
        return (lo + hi) / 2

    lo_t, hi_t = math.radians(60), math.radians(88)
    best = None
    for _ in range(60):
        thmax = (lo_t + hi_t) / 2
        s = close_s(thmax)
        pts, u, d, arc = integrate(s, thmax)
        if d < rise:
            lo_t = thmax
        else:
            hi_t = thmax
        best = (s, thmax, pts, u, d, arc)
    s, thmax, pts, u, d, arc = best
    if abs(u - run) > 0.3 or abs(d - rise) > 0.3:
        return None
    # mirror second half: u-symmetric wave (d(2run-x) = d(x)) — trough at u=run
    prof = [(x, y) for x, y, t in pts]
    for x, y, t in reversed(pts[:-1]):
        prof.append((2 * run - x, y))
    out = []
    for q in prof:
        if not out or math.dist(q, out[-1]) > 1e-6:
            out.append(q)
    return out, math.degrees(thmax), arc, s


def full_period(run, rise, Rlead, Rflip, p, base):
    w = wall(run, rise, Rlead, Rflip, p)
    if w is None:
        return None
    pts, thdeg, arc, s = w
    # wall() already returns a full crest->trough->crest period on [0, 2*run]
    prof = [(u, base + dd) for u, dd in pts]
    return prof, thdeg, arc


def scan(pts):
    n = len(pts)
    flat = total = 0
    worst = 1e9
    for i in range(0, n - 17, 4):
        w = pts[i:i+17]
        a, b = w[0], w[-1]
        dx, dy = b[0]-a[0], b[1]-a[1]
        L = math.hypot(dx, dy)
        if L == 0:
            continue
        dev = max(abs((p[0]-a[0])*dy - (p[1]-a[1])*dx)/L for p in w)
        total += 1
        if dev < CURV_MIN:
            flat += 1
        worst = min(worst, dev)
    return flat, total, worst


print("Ramp-radius walls: Rlead 10-16, Rflip 3.5-5, p 1.5-3, run 19.6 rise 17 (and neighbors)")
found = []
for run, rise in ((19.6, 17.0), (19.6, 18.0), (18.5, 16.5), (21.0, 18.0), (20.0, 17.0)):
    best = (999, None)
    for Rlead in (10, 12, 14, 16):
        for Rflip in (3.5, 4.0, 4.5, 5.0):
            for p in (1.5, 2.0, 3.0):
                fp = full_period(run, rise, Rlead, Rflip, p, 7.0)
                if fp is None:
                    continue
                prof, thdeg, arc = fp
                flat, total, worst = scan(prof)
                if flat < best[0]:
                    best = (flat, (Rlead, Rflip, p, round(thdeg), round(arc, 1), round(worst, 3)))
                if flat == 0 and 22.5 <= arc <= 42.5:
                    found.append((run, rise, Rlead, Rflip, p, round(thdeg), round(arc, 1), round(worst, 3)))
    print(f"run={run} rise={rise}: best flat={best[0]} (Rlead,Rflip,p,thmax,arc,worst)={best[1]}")
print(f"\nZERO-FLAT + in-band solutions: {len(found)}")
for f in found[:25]:
    print("  ", f)
