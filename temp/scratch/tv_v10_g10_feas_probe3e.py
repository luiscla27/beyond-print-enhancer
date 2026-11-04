# G10 curvature feasibility, probe 3e (DECISIVE two-arc asymmetric sweep):
# closure fixes R1+R2 = run/sin(thmax) with thmax = 2*atan(rise/run); the flip
# window law is dev_S ~= 4/R2 - 2/R1 (R2 = tight side at max slope); on-arc1
# windows need 8/R1 >= 0.5 (R1 <= 16); wall arc = (R1+R2)*thmax must be in G7's
# along-vine half-period band [22.5, 42.5]. Sweep R2 finely and measure the real
# window scan (the arc1->arc2 same-sign junction dip is NOT captured by the law).
import math

CURV_MIN = 0.5


def biarc_wall(run, rise, R2):
    th = 2 * math.atan(rise / run)
    Rsum = run / math.sin(th)
    R1 = Rsum - R2
    if R1 < 4 or R2 < 2:
        return None, R1, R2, th
    step = 0.5
    pts = []
    s = 0.0
    while s < R1 * th - 1e-9:
        a = s / R1
        pts.append((R1 * math.sin(a), R1 * (1 - math.cos(a))))
        s += step
    u1, d1 = R1 * math.sin(th), R1 * (1 - math.cos(th))
    k = step
    while k < R2 * th - 1e-9:
        a = th - k / R2
        pts.append((run - R2 * math.sin(a), rise - R2 * (1 - math.cos(a))))
        k += step
    pts.append((run, rise))
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) > 1e-6:
            out.append(p)
    return out, R1, R2, th


def full_period(run, rise, R2, base):
    w, R1, R2, th = biarc_wall(run, rise, R2)
    if w is None:
        return None, R1, R2, th
    pts = [(u, base + d) for u, d in w]
    for u, d in w[1:]:
        pts.append((run + u, base + rise - d))
    pts.append((2 * run, base))
    return pts, R1, R2, th


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


print("run rise | R2 sweep: flat/total worst")
best_all = (999, None)
for run, rise in ((19.6, 17.0), (19.6, 18.0), (19.0, 17.0), (20.0, 18.0), (18.5, 16.5), (20.5, 19.0)):
    th_deg = math.degrees(2 * math.atan(rise / run))
    line = f"run={run} rise={rise} thmax={th_deg:.0f}: "
    hits = []
    R2 = 3.0
    while R2 <= 7.01:
        pts, R1, _, th = full_period(run, rise, R2, 7.0)
        if pts is None:
            R2 += 0.25
            continue
        flat, total, worst = scan(pts)
        wall_arc = (2 * Rsum(run, rise)) * th if False else (run / math.sin(th)) * th
        if flat == 0:
            hits.append(f"R2={R2:.2f}(R1={R1:.1f},arc={wall_arc:.1f})")
        if flat < best_all[0]:
            best_all = (flat, (run, rise, R2, R1, worst, wall_arc))
        R2 += 0.25
    print(line + ("FEASIBLE: " + ", ".join(hits) if hits else "no zero-flat R2 in [3,7]"))


def Rsum(run, rise):
    return run / math.sin(2 * math.atan(rise / run))


print("\nbest (fewest flat):", best_all)
