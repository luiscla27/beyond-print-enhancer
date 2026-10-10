# G10 curvature feasibility, probe 3d: THREE-ARC walls.
# Established by 3a-3c: two-arc walls are PROVABLY infeasible — the flip-straddling
# 8-unit window needs R <= 4 on both sides (dev_S law = 2/R), but the wall's total
# arc must be >= 22.5 (G7 half-period floor), forcing R1+R2 >= 15.7 at constructor
# swing/run ratios. Measured: two-arc walls bottom out at worst-window 0.19-0.33.
#
# 3d: crest-side arc (+1/Ra, gentle) -> tightening arc (+1/Rb) -> flip at max slope
# -> scoop arc (-1/Rc) into the trough. Tight pair (Rb=Rc~4) carries the flip window
# (dev_S = 2/R >= 0.5); the long gentle arc carries the arc-length budget and the
# offset windows. Numeric closure: given (phi_a, Rb, Rc, phi_max) solve Ra from the
# run equation, verify the rise equation target by scanning phi_max.
import math

CURV_MIN = 0.5


def three_arc_wall(run, rise, phi_a_deg, Rb, Rc, phi_max_deg):
    """slope: 0 ->phi_a (Ra, +) ->phi_max (Rb, +) ->flip-> 0 (Rc, -).
    Solve Ra from run closure; return wall points or None."""
    pa = math.radians(phi_a_deg)
    pm = math.radians(phi_max_deg)
    if pm <= pa + 1e-6 or pm > math.radians(88):
        return None
    # run = Ra sin(pa) + Rb(sin pm - sin pa) + Rc sin pm
    s1 = math.sin(pa)
    Ra = (run - Rb * (math.sin(pm) - s1) - Rc * math.sin(pm)) / s1
    if Ra < 5 or Ra > 40:
        return None
    d = Ra * (1 - math.cos(pa)) + Rb * (math.cos(pa) - math.cos(pm)) + Rc * (1 - math.cos(pm))
    if abs(d - rise) > 0.6:
        return None
    step = 0.5
    pts = []
    s = 0.0
    while s < Ra * pa - 1e-9:  # arc1
        a = s / Ra
        pts.append((Ra * math.sin(a), Ra * (1 - math.cos(a))))
        s += step
    u1, d1 = Ra * math.sin(pa), Ra * (1 - math.cos(pa))
    s = 0.0
    while s < Rb * (pm - pa) - 1e-9:  # arc2
        a = pa + s / Rb
        pts.append((u1 + Rb * (math.sin(a) - math.sin(pa)),
                    d1 + Rb * (math.cos(pa) - math.cos(a))))
        s += step
    u2 = u1 + Rb * (math.sin(pm) - math.sin(pa))
    d2 = d1 + Rb * (math.cos(pa) - math.cos(pm))
    s = 0.0
    while s < Rc * pm - 1e-9:  # arc3 (negative curvature, slope pm -> 0)
        a = pm - s / Rc
        pts.append((u2 + Rc * (math.sin(pm) - math.sin(a)),
                    d2 + Rc * (math.cos(a) - math.cos(pm))))
        s += step
    pts.append((run, rise))
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) > 1e-6:
            out.append(p)
    return out


def full_period(run, rise, phi_a, Rb, Rc, base):
    # solve phi_max for rise closure by bisection
    lo, hi = phi_a + 1.0, 88.0
    best = None
    for _ in range(40):
        mid = (lo + hi) / 2
        w = three_arc_wall(run, rise, phi_a, Rb, Rc, mid)
        # closure residual: recompute rise at this phi_max
        pm = math.radians(mid)
        pa = math.radians(phi_a)
        s1 = math.sin(pa)
        Ra = (run - Rb * (math.sin(pm) - s1) - Rc * math.sin(pm)) / s1
        if Ra < 5:
            lo = mid
            continue
        d = Ra * (1 - math.cos(pa)) + Rb * (math.cos(pa) - math.cos(pm)) + Rc * (1 - math.cos(pm))
        if d < rise:
            lo = mid
        else:
            hi = mid
        best = mid
    w = three_arc_wall(run, rise, phi_a, Rb, Rc, best if best else (phi_a + 88) / 2)
    if w is None:
        return None, None
    pts = [(u, base + dd) for u, dd in w]
    for u, dd in w[1:]:
        pts.append((run + u, base + rise - dd))
    pts.append((2 * run, base))
    return pts, best


def check(pts, label):
    n = len(pts)
    flat = total = 0
    worst = (1e9, None)
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
        if dev < worst[0]:
            worst = (dev, a[0])
    print(f"{label}: windows={total} flat={flat} worst={worst[0]:.3f} at u={worst[1]:.1f}")
    return flat


print("=== three-arc walls: run 19.6 swing 17, tight flip pair sweep ===")
for Rb, Rc in ((4.5, 4.5), (4.0, 4.0), (4.0, 3.5), (3.5, 3.5), (5.0, 4.0), (6.0, 4.0)):
    for phi_a in (40, 55, 65):
        pts, pm = full_period(19.6, 17.0, phi_a, Rb, Rc, 7.0)
        if pts is None:
            continue
        flat = check(pts, f"Rb={Rb} Rc={Rc} phi_a={phi_a} phi_max={pm:.0f}")
print("=== run 21 swing 17 ===")
for Rb, Rc in ((4.0, 4.0), (3.5, 3.5), (4.5, 3.5)):
    pts, pm = full_period(21.0, 17.0, 55, Rb, Rc, 7.0)
    if pts is None:
        print(f"run 21 Rb={Rb} Rc={Rc}: no closure")
        continue
    check(pts, f"run21 Rb={Rb} Rc={Rc} phi_max={pm:.0f}")
print("=== corner: run 17 swing 15 ===")
for Rb, Rc in ((4.0, 4.0), (3.5, 3.5)):
    pts, pm = full_period(17.0, 15.0, 55, Rb, Rc, 7.0)
    if pts is None:
        print(f"corner Rb={Rb} Rc={Rc}: no closure")
        continue
    check(pts, f"corner Rb={Rb} Rc={Rc} phi_max={pm:.0f}")
