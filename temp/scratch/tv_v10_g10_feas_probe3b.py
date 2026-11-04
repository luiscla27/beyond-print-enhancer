# G10 curvature feasibility, probe 3b (CORRECTED): the previous probe3 built walls
# whose actual rise was ~6.6 instead of the requested 20 (the arc1 loop cut at
# alpha/2 while R was solved for the full alpha — a construction bug, so its sagitta
# numbers described the wrong geometry). This version builds the biarc correctly:
#
#   wall (crest->trough): two circular arcs radius R; arc1 tangent-angle 0 -> thmax,
#   arc2 thmax -> 0 (point-mirror through the wall midpoint). run = 2 R sin(thmax),
#   rise = 2 R (1 - cos(thmax))  =>  thmax = 2 atan(rise/run), R = run/(2 sin thmax).
#
# Also reports thmax: > 90 deg means the wall doubles back on itself (projection is
# NOT monotone), which jumbles the gate's sort-by-proj depth scans — flagged.
import math

CURV_MIN = 0.5


def biarc_wall(run, rise, step=0.5):
    thmax = 2 * math.atan(rise / run)
    if thmax > math.radians(90):
        return None, None, math.degrees(thmax)  # doubling back: refuse
    R = run / (2 * math.sin(thmax))
    pts = []
    s = 0.0
    while s < R * thmax - 1e-9:
        th = s / R
        pts.append((R * math.sin(th), R * (1 - math.cos(th))))
        s += step
    u1, d1 = R * math.sin(thmax), R * (1 - math.cos(thmax))
    k = step
    while k <= R * thmax - 1e-9:  # k is ARC length on arc2 (bug in 3a: bounded by u1)
        p = (R * math.sin(thmax - k / R), R * (1 - math.cos(thmax - k / R)))
        pts.append((run - p[0], rise - p[1]))
        k += step
    pts.append((run, rise))
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) > 1e-6:
            out.append(p)
    return out, R, math.degrees(thmax)


def full_period(run, rise, base):
    wall, R, th = biarc_wall(run, rise)
    if wall is None:
        return None, R, th
    pts = [(u, base + d) for u, d in wall]
    for u, d in wall[1:]:
        pts.append((run + u, base + rise - d))
    pts.append((2 * run, base))
    return pts, R, th


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
    print(f"{label}: windows={total} flat={flat} worst={worst[0]:.3f}")
    return flat


print("=== v12 design: half-periods 18-23 projection, swing 17 (crest 7 -> trough 24) ===")
allflat = 0
for run in (18, 19, 19.6, 20, 20.5, 21, 22, 23):
    pts, R, th = full_period(run, 17.0, 7.0)
    if pts is None:
        print(f"run={run}: thmax={th:.1f} deg > 90 (doubles back) — REFUSED")
        continue
    allflat += check(pts, f"run={run} swing=17 R={R:.2f} thmax={th:.1f}")

print("=== old constructor gaps at swing 20 (the doubling-back problem) ===")
for run in (12, 14, 16, 19, 21):
    pts, R, th = full_period(run, 20.0, 7.2)
    if pts is None:
        print(f"run={run} swing=20: thmax={th:.1f} deg > 90 — REFUSED (projection not monotone)")
        continue
    allflat += check(pts, f"run={run} swing=20 R={R:.2f} thmax={th:.1f}")

print("=== corner walls: swing 14-16, run 16-17 ===")
for run, swing in ((16, 14.0), (16.5, 15.0), (17, 16.0), (17, 14.0)):
    pts, R, th = full_period(run, swing, 7.0)
    if pts is None:
        print(f"corner run={run} swing={swing}: thmax={th:.1f} — REFUSED")
        continue
    allflat += check(pts, f"corner run={run} swing={swing} R={R:.2f} thmax={th:.1f}")
print("TOTAL flat:", allflat)
