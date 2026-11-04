# G10 curvature feasibility probe (leg 6b): can ANY G7-conforming depth profile keep
# the gate's worst-window sagitta >= 0.5 on EVERY 8-unit window?
#
# Gate math mirrored exactly: S resampled at 0.5; windows step 2u, length 8u;
# dev = max perpendicular distance of window points from the window-endpoint chord.
#
# Design family: per half-period wall, a monotone circular-arc chain [r1 arc, r2 arc]
# with the curvature-sign flip at wall fraction f (near the trough/crest, NOT mid-wall).
# Troughs are local depth MAXima (depth = distance from edge, so trough depth 24-30.5),
# crests MINima 1.5-8, swing 16-29, half-period (along-vine) 22.5-42.5.
import math, sys

CURV_MIN = 0.5
TOL = 0.25


def profile_arcs(halfperiod, swing, f, r1, nflip_sign):
    """Depth profile over one full period (trough->crest->trough), built from
    circular arcs in (u, d) with d = depth. Wall = trough->crest: two arcs,
    r1 (small) covering wall-fraction f, r2 covering the rest, tangent-continuous.
    Returns dense samples (u, d) over [0, 2*halfperiod]."""
    # Wall geometry: rise = swing over horizontal run = halfperiod (approx; the gate's
    # half-period is ALONG-VINE but we build near-vertical walls small correction later).
    # Circular arc with radius r turning through angle ph: du = r*sin increments...
    # Construct via angle: start slope s0 at the trough (0), end slope at the crest (0).
    # Arc1: radius R1, tangent angle 0 -> a1; Arc2: radius R2, angle a1 -> 0 (mirrored).
    # Horizontal run: R1*sin(a1) + R2*(sin(a0tot) - ...). Solve R2 for the given run.
    run = halfperiod
    rise = swing
    a1 = f * math.pi  # total turn of wall = pi (slope 0 -> steep -> 0); arc1 takes f of the TURN
    # arc1: from slope-angle 0 to a1 (curving so depth increases)
    # arc2: from a1 back to 0
    # du1 = R1*(sin a1 - 0) with angle measured from horizontal; dd1 = R1*(1-cos a1)
    # du2 = R2*sin a1; dd2 = R2*(1-cos a1)
    # total rise = (R1+R2)(1-cos a1) = swing ; run = (R1+R2) sin a1 = halfperiod
    # => (1-cos a1)/sin a1 = swing/halfperiod => tan(a1/2) = swing/run
    # So a1 is FIXED by swing/run; f then only chooses the split R1/(R1+R2).
    t2 = rise / run
    a1 = 2 * math.atan(t2)
    Rtot = run / math.sin(a1)
    R1 = f * Rtot
    R2 = Rtot - R1
    if R1 < 0.3 or R2 < 0.3:
        return None
    pts = []
    step = 0.5
    # arc1: angle 0..a1
    s = 0.0
    ang = 0.0
    du = 0.0
    dd = 0.0
    while ang < a1 - 1e-9:
        pts.append((du, dd))
        dang = step / R1
        ang = min(ang + dang, a1)
        du = R1 * math.sin(ang)
        dd = R1 * (1 - math.cos(ang))
    u1, d1 = du, dd
    # arc2: angle a1..0 on radius R2 (mirror)
    ang = a1
    while ang > 1e-9:
        u2 = u1 + R2 * math.sin(ang)
        d2 = d1 + R2 * (1 - math.cos(a1)) - R2 * (1 - math.cos(ang))
        pts.append((u2, d2))
        dang = step / R2
        ang = max(ang - dang, 0.0)
    pts.append((u1 + R2 * math.sin(a1), d1 + R2 * (1 - math.cos(a1))))
    return pts


def worst_window(pts):
    """Gate-exact: resample at 0.5 (pts already ~0.5), windows of 8u step 2u,
    dev = max perp distance from endpoint chord."""
    worst = 1e9
    wi = None
    n = len(pts)
    for i in range(0, n - 16, 4):
        w = pts[i:i+17]
        a, b = w[0], w[-1]
        dx, dy = b[0]-a[0], b[1]-a[1]
        L = math.hypot(dx, dy)
        if L == 0:
            continue
        dev = max(abs((p[0]-a[0])*dy - (p[1]-a[1])*dx)/L for p in w)
        if dev < worst:
            worst = dev
            wi = a[0]
    return worst, wi


print("=== full-period profile: trough(0)->crest->trough, half-period 30, swing 20 ===")
best = (0, None)
for f in (0.05, 0.1, 0.15, 0.2, 0.3, 0.5):
    wall = profile_arcs(30.0, 20.0, f, None, 1)
    if not wall:
        continue
    # full period: wall + mirrored wall
    full = [(u, 27.0 - d) for u, d in wall]  # trough at depth 27, crest at 7
    full += [(2*wall[-1][0] - u, 27.0 - d) for u, d in reversed(wall)]
    w, at = worst_window(full)
    print(f"  flip fraction f={f}: worst-window sagitta {w:.3f} at u={at:.1f}")
    if w > best[0]:
        best = (w, f)
print(f"  BEST f={best[1]} sagitta {best[0]:.3f} -> {'PASS' if best[0] >= CURV_MIN - 0 else 'FAIL'} G10 curvature")

print("=== can a near-corner-placed flip help? try asymmetric: flip pinned 2u after trough ===")
for f in (0.02, 0.03, 0.04):
    for hp in (22.5, 30.0, 42.5):
        for sw in (16.0, 20.0, 29.0):
            wall = profile_arcs(hp, sw, f, None, 1)
            if not wall:
                continue
            full = [(u, 27.0 - d) for u, d in wall]
            full += [(2*wall[-1][0] - u, 27.0 - d) for u, d in reversed(wall)]
            w, at = worst_window(full)
            flag = "PASS" if w >= CURV_MIN else "fail"
            if w >= 0.4:
                print(f"  hp={hp} sw={sw} f={f}: worst {w:.3f} {flag}")
