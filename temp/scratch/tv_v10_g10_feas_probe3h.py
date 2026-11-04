# G10 curvature feasibility, probe 3h (NOTCH hypothesis):
# Established laws (3a-3g, all measured):
#   L1 centered flip window dev = 2k (equal R both sides) => R <= 4 needed;
#   L2 asymmetric flip dev = max(|2k2-4k1|, |4k2-2k1|);
#   L3 off-center windows through a SINGLE flip dip below L1/L2 (cancellation);
#   L4 circular two/three-arc walls bottom out at flat=2 per period (3e/3g sweeps);
#   L5 wall arc >= 22.5 (G7 half-period floor) + R <= 4 everywhere => total turn
#      > pi => slope > 90 deg (doubling back) => gate's sort-by-proj reads garbage.
# Hypothesis 3h: hide EXTRA tight S-notches at max slope (slope stays > 0, depth
# monotone -> no pivots -> G7/G10 pivot scans see nothing; notch amplitude
# ~ Rn(1-cos d) ~ sub-unit at Rn=3.5, d=0.4 -> visually invisible), so every
# 8-window's curvature sign flips happen only between TIGHT arcs.
import math

CURV_MIN = 0.5


def notch_wall(run, rise, Ra_turn_deg, Rb, Rc, delta, Rn=3.5):
    """slope: 0 ->A (Ra,+) ->A+Tb (Rb,+) ->notch S (Rn,-/+ , turn 2*delta) ->
    max slope -> 0 (Rc,-). Solve Rc bisection for rise closure given run."""
    A = math.radians(Ra_turn_deg)
    # geometry: fix Ra by choosing its turn; the rest by angles.
    # free: Ra, Tb (turn on Rb), then notch at slope Am = A+Tb, then Rc to 0.
    # We instead specify Ra and Tb, compute positions, and solve Rc for closure.
    pass


def build(run, rise, Ra, Tb_deg, Rb, Rc, delta, Rn=3.5):
    """Build wall with explicit radii; returns pts or None (no closure)."""
    # arc1: +1/Ra, slope 0 -> A where A chosen s.t. arc1 consumes some run.
    # We solve A from: we need the whole chain to close at (run, rise) with final
    # slope 0. Unknowns: A (end slope of arc1) and Rc. Two equations (run, rise).
    # Parametrize by A; compute the pre-notch end state; then Rc must take slope
    # Am -> 0 and close the remaining (run', rise'): for a -1/Rc arc turning Am:
    # run' = Rc sin Am, rise' = Rc (1 - cos Am) -> determined by Rc. So solve both.
    def state(A):
        a = math.radians(A)
        # arc1: turn 0->a on Ra
        u = Ra * math.sin(a)
        d = Ra * (1 - math.cos(a))
        # arc2: +1/Rb, turn a -> a+Tb
        Tb = math.radians(Tb_deg)
        b = a + Tb
        u += Rb * (math.sin(b) - math.sin(a))
        d += Rb * (math.cos(a) - math.cos(b))
        # notch: -1/Rn turn delta, then +1/Rn turn delta (slope b -> b-d -> b)
        # net displacement of a symmetric S-notch at slope b:
        # approx: du = 2*Rn*sin(b)*sin(delta)... compute exactly:
        # seg1 (-1/Rn, turn -delta): slope b -> b-delta
        u1 = Rn * (math.sin(b) - math.sin(b - delta))
        d1 = Rn * (math.cos(b - delta) - math.cos(b))
        # seg2 (+1/Rn, turn +delta): slope b-delta -> b, starting at that point
        # displacement: rotate frame; exact: du2 = Rn*(sin(b) - sin(b-delta)) in
        # the local frame aligned at slope b-delta:
        u2 = Rn * (math.sin(b) - math.sin(b - delta))
        d2 = Rn * (math.cos(b - delta) - math.cos(b))
        # seg2 direction: its du is along cos(b-delta) rotated... proper calc:
        # for +1/Rn from slope t0=b-delta turning +delta: du = Rn(sin(t0+delta)-sin t0)
        # dd = Rn(cos t0 - cos(t0+delta)) -- same numbers by symmetry of sin/cos diff.
        u += u1 + u2
        d += d1 + d2
        # arc3: -1/Rc, turn b -> 0. run3 = Rc sin b, rise3 = Rc(1-cos b).
        # closure: u + Rc sin b = run ; d + Rc (1 - cos b) = rise
        sinb, cosb = math.sin(b), math.cos(b)
        Rc_from_run = (run - u) / sinb
        Rc_from_rise = (rise - d) / (1 - cosb)
        return u, d, b, Rc_from_run, Rc_from_rise

    lo, hi = 10.0, 70.0
    f_lo = state(lo)
    f_hi = state(hi)
    def resid(A):
        s = state(A)
        return s[3] - s[4]
    if resid(lo) * resid(hi) > 0:
        return None
    for _ in range(60):
        mid = (lo + hi) / 2
        if resid(lo) * resid(mid) <= 0:
            hi = mid
        else:
            lo = mid
    A = (lo + hi) / 2
    u, d, b, Rc_run, Rc_rise = state(A)
    if abs(Rc_run - Rc_rise) > 0.05 or Rc_run < 3 or Rc_run > 30:
        return None
    Rc = Rc_run
    # build full point chain
    step = 0.5
    pts = []
    a = math.radians(A)
    s = 0.0
    while s < Ra * a - 1e-9:
        t = s / Ra
        pts.append((Ra * math.sin(t), Ra * (1 - math.cos(t))))
        s += step
    u1, d1 = Ra * math.sin(a), Ra * (1 - math.cos(a))
    Tb = math.radians(Tb_deg)
    b = a + Tb
    s = 0.0
    while s < Rb * Tb - 1e-9:
        t = a + s / Rb
        pts.append((u1 + Rb * (math.sin(t) - math.sin(a)), d1 + Rb * (math.cos(a) - math.cos(t))))
        s += step
    un, dn = u1 + Rb * (math.sin(b) - math.sin(a)), d1 + Rb * (math.cos(a) - math.cos(b))
    # notch seg1: -1/Rn slope b -> b-delta
    s = 0.0
    while s < Rn * delta - 1e-9:
        t = b - s / Rn
        pts.append((un + Rn * (math.sin(b) - math.sin(t)), dn + Rn * (math.cos(t) - math.cos(b))))
        s += step
    un2 = un + Rn * (math.sin(b) - math.sin(b - delta))
    dn2 = dn + Rn * (math.cos(b - delta) - math.cos(b))
    # notch seg2: +1/Rn slope b-delta -> b
    s = 0.0
    while s < Rn * delta - 1e-9:
        t = (b - delta) + s / Rn
        pts.append((un2 + Rn * (math.sin(t) - math.sin(b - delta)),
                    dn2 + Rn * (math.cos(b - delta) - math.cos(t))))
        s += step
    un3 = un2 + Rn * (math.sin(b) - math.sin(b - delta))
    dn3 = dn2 + Rn * (math.cos(b - delta) - math.cos(b))
    # arc3: -1/Rc slope b -> 0
    s = 0.0
    while s < Rc * b - 1e-9:
        t = b - s / Rc
        pts.append((un3 + Rc * (math.sin(b) - math.sin(t)), dn3 + Rc * (math.cos(t) - math.cos(b))))
        s += step
    pts.append((run, rise))
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) > 1e-6:
            out.append(p)
    arc = Ra * a + Rb * Tb + 2 * Rn * delta + Rc * b
    return out, Rc, math.degrees(b), arc


def full_period(run, rise, Ra, Tb, Rb, Rc, delta, Rn, base):
    w = build(run, rise, Ra, Tb, Rb, Rc, delta, Rn)
    if w is None:
        return None
    pts, Rc_f, bdeg, arc = w
    prof = [(u, base + d) for u, d in pts]
    for u, d in pts[1:]:
        prof.append((run + u, base + rise - d))
    prof.append((2 * run, base))
    return prof, Rc_f, bdeg, arc


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


found = []
for run, rise in ((19.6, 17.0), (19.6, 18.0), (18.5, 16.5), (21.0, 18.0)):
    best = (999, None)
    for Ra in (12, 14, 16):
        for Tb in (15, 25, 35):
            for Rb in (8, 10, 12):
                for Rn in (3.0, 3.5):
                    for delta in (0.35, 0.5):
                        fp = full_period(run, rise, Ra, Tb, Rb, 4.0, delta, Rn, 7.0)
                        if fp is None:
                            continue
                        p, Rc, bdeg, arc = fp
                        flat, total, worst = scan(p)
                        if flat < best[0]:
                            best = (flat, (Ra, Tb, Rb, Rn, delta, round(Rc, 1), round(bdeg), round(arc, 1), round(worst, 3)))
                        if flat == 0 and 22.5 <= arc <= 42.5:
                            found.append((run, rise, Ra, Tb, Rb, Rn, delta, round(Rc, 1), round(bdeg), round(arc, 1), round(worst, 3)))
    print(f"run={run} rise={rise}: best flat={best[0]} (Ra,Tb,Rb,Rn,d,Rc,b,arc,worst)={best[1]}")
print(f"\nZERO-FLAT solutions: {len(found)}")
for f in found[:20]:
    print("  ", f)
