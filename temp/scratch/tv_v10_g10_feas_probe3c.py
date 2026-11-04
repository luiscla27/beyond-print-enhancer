# G10 curvature feasibility, probe 3c (the REAL two-arc family):
# measured law at an inflection junction (8-unit window centered on the curvature
# sign flip, tangent frame): dev ~= max(|2*k2 - 4*k1|, |4*k2 - 2*k1|).
# => with both radii >= 8 the best possible is 4/16 = 0.25 < 0.5: ONE side of every
# inflection MUST have R <= ~6.5. Equal-radii biarcs (Muse's f=0.5 spec) are
# therefore INFEASIBLE at constructor scale: measured 0.20-0.33 at R ~ 9-12.
#
# Asymmetric wall: arc1 (R1, large) turns slope 0->th*, arc2 (R2, tight) turns
# th*->0. theta* = 2 atan(rise/run) (fixed by shape, radii-independent),
# R1+R2 = run/sin(th*). Tight arc sits at max slope AND at the trough U-turn.
import math

CURV_MIN = 0.5


def wall(run, rise, split):
    """split = R2/(R1+R2); returns (pts, R1, R2, thmax_deg). Refuses thmax > 88 deg."""
    th = 2 * math.atan(rise / run)
    if th > math.radians(88):
        return None, None, None, math.degrees(th)
    Rsum = run / math.sin(th)
    R2 = split * Rsum
    R1 = Rsum - R2
    step = 0.5
    pts = []
    s = 0.0
    while s < R1 * th - 1e-9:  # arc1: angle 0..th on R1
        a = s / R1
        pts.append((R1 * math.sin(a), R1 * (1 - math.cos(a))))
        s += step
    u1, d1 = R1 * math.sin(th), R1 * (1 - math.cos(th))
    k = step
    while k < R2 * th - 1e-9:  # arc2: mirror on R2
        a = th - k / R2
        p = (R2 * math.sin(a), R2 * (1 - math.cos(a)))
        pts.append((u1 + (run - u1 - p[0]), d1 + (rise - d1 - p[1])))
        k += step
    pts.append((run, rise))
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) > 1e-6:
            out.append(p)
    return out, R1, R2, math.degrees(th)


def full_period(run, rise, split, base):
    w, R1, R2, th = wall(run, rise, split)
    if w is None:
        return None, R1, R2, th
    pts = [(u, base + d) for u, d in w]
    for u, d in w[1:]:
        pts.append((run + u, base + rise - d))
    pts.append((2 * run, base))
    return pts, R1, R2, th


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


print("=== asymmetric walls, swing 17, runs 17-23, R2 sweep ===")
for run in (17, 19.6, 21, 23):
    for split in (0.25, 0.3, 0.33, 0.4):
        pts, R1, R2, th = full_period(run, 17.0, split, 7.0)
        if pts is None:
            print(f"run={run}: thmax={th:.1f} refused")
            break
        check(pts, f"run={run} R1={R1:.1f} R2={R2:.1f} th={th:.0f}")

print("=== corner walls: run 16-18, swing 14-16 ===")
for run, swing in ((16, 14.0), (17, 15.0), (18, 16.0)):
    for split in (0.3, 0.35):
        pts, R1, R2, th = full_period(run, swing, split, 7.0)
        if pts is None:
            print(f"corner run={run} swing={swing}: th={th:.1f} refused")
            break
        check(pts, f"corner run={run} sw={swing} R1={R1:.1f} R2={R2:.1f}")
