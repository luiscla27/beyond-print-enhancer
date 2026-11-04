# G10 curvature feasibility, probe 3g (three-arc, PROPER closure):
# given (a, Rb, Rc) bisect b in (a+5, 88] for rise closure — a 1-D root find per
# triple instead of probe3f's measure-zero grid check. Then window-scan.
import math

CURV_MIN = 0.5


def closed_wall(run, rise, a_deg, Rb, Rc):
    a = math.radians(a_deg)
    sa, ca = math.sin(a), math.cos(a)

    def prof_at(b):
        sb, cb = math.sin(b), math.cos(b)
        Ra = (run - Rb * (sb - sa) - Rc * sb) / sa
        d = Ra * (1 - ca) + Rb * (ca - cb) + Rc * (1 - cb)
        return Ra, d

    lo, hi = a + math.radians(6), math.radians(88)
    Ra_lo, d_lo = prof_at(lo)
    Ra_hi, d_hi = prof_at(hi)
    if not (d_lo <= rise <= d_hi) or Ra_hi < 5:
        return None
    for _ in range(60):
        mid = (lo + hi) / 2
        Ra_m, d_m = prof_at(mid)
        if Ra_m < 5:
            hi = mid
            continue
        if d_m < rise:
            lo = mid
        else:
            hi = mid
    b = (lo + hi) / 2
    Ra, d = prof_at(b)
    if Ra < 5 or abs(d - rise) > 0.15:
        return None
    # build
    step = 0.5
    pts = []
    s = 0.0
    while s < Ra * a - 1e-9:
        t = s / Ra
        pts.append((Ra * math.sin(t), Ra * (1 - math.cos(t))))
        s += step
    u1, d1 = Ra * math.sin(a), Ra * (1 - math.cos(a))
    sb, cb = math.sin(b), math.cos(b)
    s = 0.0
    while s < Rb * (b - a) - 1e-9:
        t = a + s / Rb
        pts.append((u1 + Rb * (math.sin(t) - math.sin(a)), d1 + Rb * (math.cos(a) - math.cos(t))))
        s += step
    u2 = u1 + Rb * (sb - math.sin(a))
    d2 = d1 + Rb * (math.cos(a) - cb)
    s = 0.0
    while s < Rc * b - 1e-9:
        t = b - s / Rc
        pts.append((u2 + Rc * (sb - math.sin(t)), d2 + Rc * (math.cos(t) - cb)))
        s += step
    pts.append((run, rise))
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) > 1e-6:
            out.append(p)
    arc = Ra * a + Rb * (b - a) + Rc * b
    return out, Ra, math.degrees(b), arc


def full_period(run, rise, a, Rb, Rc, base):
    w = closed_wall(run, rise, a, Rb, Rc)
    if w is None:
        return None
    pts, Ra, bdeg, arc = w
    prof = [(u, base + d) for u, d in pts]
    for u, d in pts[1:]:
        prof.append((run + u, base + rise - d))
    prof.append((2 * run, base))
    return prof, Ra, bdeg, arc


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


targets = [(19.6, 17.0), (19.6, 18.0), (21.0, 18.0), (18.5, 16.5), (20.5, 19.0), (22.0, 18.0)]
found = []
for run, rise in targets:
    best = (999, None)
    for a in (20, 30, 40, 50, 60):
        for Rb in (5, 6, 8, 10, 12, 14):
            for Rc in (3.0, 3.5, 4.0, 4.5, 5.0, 6.0):
                fp = full_period(run, rise, a, Rb, Rc, 7.0)
                if fp is None:
                    continue
                p, Ra, bdeg, arc = fp
                flat, total, worst = scan(p)
                if flat < best[0]:
                    best = (flat, (a, Rb, Rc, round(Ra, 1), round(bdeg), round(arc, 1), round(worst, 3)))
                if flat == 0 and 22.5 <= arc <= 42.5:
                    found.append((run, rise, a, Rb, Rc, round(Ra, 1), round(bdeg), round(arc, 1), round(worst, 3)))
    print(f"run={run} rise={rise}: best flat={best[0]} (a,Rb,Rc,Ra,b,arc,worst)={best[1]}")
print(f"\nZERO-FLAT + G7-arc-band solutions: {len(found)}")
for f in found[:25]:
    print("  ", f)
