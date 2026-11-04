# G10 curvature feasibility, probe 3f (DECISIVE three-arc grid search):
# free params (a, b, Rb, Rc); Ra solved from run-closure; rise residual checked.
# Segments: arc_a (+1/Ra, slope 0->a), arc_b (+1/Rb, slope a->b), arc_c (-1/Rc,
# slope b->0 = trough). The flip is b->0 between arc_b (+) and arc_c (-); the
# arc_a->arc_b junction is a mild same-sign ratio. Full-period windows scanned
# with the gate's exact math. Zero-flat = G10 curvature PASS for that wall.
import math

CURV_MIN = 0.5


def wall(run, rise, a_deg, b_deg, Rb, Rc):
    a = math.radians(a_deg)
    b = math.radians(b_deg)
    if not (b > a + 5 and b <= 88):
        return None
    sb, sa, cb, ca = math.sin(b), math.sin(a), math.cos(b), math.cos(a)
    Ra = (run - Rb * (sb - sa) - Rc * sb) / sa
    if Ra < 6 or Ra > 30:
        return None
    d = Ra * (1 - ca) + Rb * (ca - cb) + Rc * (1 - cb)
    if abs(d - rise) > 0.35:
        return None
    step = 0.5
    pts = []
    s = 0.0
    while s < Ra * a - 1e-9:
        t = s / Ra
        pts.append((Ra * math.sin(t), Ra * (1 - math.cos(t))))
        s += step
    u1, d1 = Ra * sa, Ra * (1 - ca)
    s = 0.0
    while s < Rb * (b - a) - 1e-9:
        t = a + s / Rb
        pts.append((u1 + Rb * (math.sin(t) - sa), d1 + Rb * (ca - math.cos(t))))
        s += step
    u2 = u1 + Rb * (sb - sa)
    d2 = d1 + Rb * (ca - cb)
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
    return out, Ra


def full_period(run, rise, a, b, Rb, Rc, base):
    w = wall(run, rise, a, b, Rb, Rc)
    if w is None:
        return None
    pts, Ra = w
    prof = [(u, base + d) for u, d in pts]
    for u, d in pts[1:]:
        prof.append((run + u, base + rise - d))
    prof.append((2 * run, base))
    return prof, Ra


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


targets = [(19.6, 17.0), (19.6, 18.0), (21.0, 18.0), (22.0, 19.0), (18.5, 16.5), (20.5, 19.0)]
print("grid: a in 20..70 x5, b in max(a+10,55)..88 x3, Rb in 6..14 x2, Rc in 3..6 x1.5")
found = []
for run, rise in targets:
    best = (999, None)
    a = 20.0
    while a <= 70.01:
        b = max(a + 10, 55.0)
        while b <= 88.01:
            Rb = 6.0
            while Rb <= 14.01:
                Rc = 3.0
                while Rc <= 6.01:
                    prof = full_period(run, rise, a, b, Rb, Rc, 7.0)
                    if prof:
                        p, Ra = prof
                        flat, total, worst = scan(p)
                        if flat < best[0]:
                            best = (flat, (a, b, Rb, Rc, Ra, worst, total))
                        if flat == 0:
                            found.append((run, rise, a, b, Rb, Rc, Ra, worst, total))
                    Rc += 1.5
                Rb += 2.0
            b += 16.0
        a += 15.0
    print(f"run={run} rise={rise}: best flat={best[0]} params={best[1]}")
print()
print(f"ZERO-FLAT solutions: {len(found)}")
for f in found[:20]:
    print("  ", f)
