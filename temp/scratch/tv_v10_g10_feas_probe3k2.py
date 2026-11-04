# G10 curvature feasibility, probe 3k2 (GAUSSIAN-BUMP slope profile, FIXED CLOSURE).
# Continues tv_v10_g10_feas_probe3k.py, whose table is VOID (leg-6 record §7 item 3):
# its close_c() bisected thmax against run/2, but u(sm, thmax) is not monotone in
# thmax across the reachable set, so the nested solve never landed and every
# (run, rise) pair returned None. The hypothesis SURVIVED; the probe did not.
#
# THE FIX (leg-6 §7 item 5, this file):
#   * the (run, rise) pair is a fixed DIRECTION from the origin: closure u=rise/2
#     AND d=rise/2 simultaneously <=> the end point lies on the ray d = (rise/run) u
#     <=> the RATIO r = u_end/d_end equals run/rise. u/d is STRICTLY MONOTONE in
#     thmax at fixed sm (bigger tilt: d grows superlinearly, u sublinearly), so ONE
#     bisection on r-th-ratio solves both equations exactly. No bracket flip.
#   * INVARIANT (anti-probe3j): the integrator emits 0.25-arc-spaced samples;
#     scan() consumes a RESAMPLED exactly-0.5-spaced chain and ASSERTS the spacing
#     plus a non-empty window count, so an empty-scan "flat=0, worst=1e9" artifact
#     cannot recur.
# Profile (3k's, kept): half wall slope t(x) = thmax * (x + (a/(2pi)) sin(2 pi x)),
#   x = s/sm in [0,1]; g' = 1 + a cos(2 pi x) with a in (-1, 0) peaks kappa at the
#   max-slope flip point and floors it at the crest/trough ends. Mirror the half
#   wall 4x into a full crest->trough->crest period; scan with the gate's own
#   window math (17 samples = 8u, step 4 = 2u, CURV_MIN 0.5).
import math

CURV_MIN = 0.5
STEP = 0.25          # integrator arc step
STEP_DEN = 4         # 1/0.25


def half_wall(sm, thmax, a):
    """crest (0,0) -> max-slope point, slope profile as in 3k. Returns (u, d) pts
    at exactly-0.25 arc spacing (last segment may be short)."""
    n = int(math.ceil(sm * STEP_DEN - 1e-9))
    pts = [(0.0, 0.0)]
    u = d = 0.0
    for i in range(n):
        s0 = i * STEP
        s1 = min((i + 1) * STEP, sm)
        ds = s1 - s0
        if ds <= 0:
            break
        x0, x1 = s0 / sm, s1 / sm
        t0 = thmax * (x0 + (a / (2 * math.pi)) * math.sin(2 * math.pi * x0))
        t1 = thmax * (x1 + (a / (2 * math.pi)) * math.sin(2 * math.pi * x1))
        u += math.cos((t0 + t1) / 2) * ds
        d += math.sin((t0 + t1) / 2) * ds
        pts.append((u, d))
    return pts


def solve_half(sm, target_ratio, a):
    """Bisect thmax so that u_end/d_end == target_ratio (monotone: ratio decreases
    as thmax grows). Returns (thmax, u, d)."""
    lo, hi = 0.05, math.radians(88.0)

    def ratio(th):
        u, d = half_wall(sm, th, a)[-1]
        return u / d if d > 1e-12 else 1e9

    r_lo, r_hi = ratio(lo), ratio(hi)
    if not (r_hi <= target_ratio <= r_lo):
        return None
    for _ in range(70):
        mid = (lo + hi) / 2
        if ratio(mid) > target_ratio:
            lo = mid
        else:
            hi = mid
    th = (lo + hi) / 2
    u, d = half_wall(sm, th, a)[-1]
    return th, u, d


def close_wall(run, rise, a):
    """Outer bisection on sm ONLY (u_end along the solved ray is monotone in sm):
    solve the half wall so (u_end, d_end) == (run/2, rise/2) to 1e-6. The seam
    between the half wall and its mirror is then C1 to ~1e-4 — a sloppy closure
    (resid ~0.2) kinks the seam by degrees and the resampler paces across the
    kink (the 0.4962 '0.5-arc' gap this probe's first run caught)."""
    target_ratio = run / rise
    lo, hi = 3.0, 40.0
    for _ in range(80):
        sm = (lo + hi) / 2
        sol = solve_half(sm, target_ratio, a)
        if sol is None:
            # ratio unreachable at this sm: need more arc — consistent direction
            lo = sm
            continue
        th, u, d = sol
        if u < run / 2:
            lo = sm
        else:
            hi = sm
    sm = (lo + hi) / 2
    sol = solve_half(sm, target_ratio, a)
    if sol is None:
        return None
    th, u, d = sol
    resid = math.hypot(u - run / 2, d - rise / 2)
    if resid > 1e-3:
        return None
    return sm, th, half_wall(sm, th, a)


def full_period(run, rise, a):
    """crest -> trough -> crest: mirror the half wall to a wall, then mirror the
    wall to the period. Returns (pts, sm, thmax_deg, end_resid)."""
    w = close_wall(run, rise, a)
    if w is None:
        return None
    sm, th, half = w
    u_end, d_end = half[-1]
    resid = math.hypot(u_end - run / 2, d_end - rise / 2)
    wall = half + [(run - u, rise - d) for u, d in reversed(half[:-1])]
    period = wall + [(run + u, rise - d) for u, d in wall[1:]]
    return period, sm, math.degrees(th), resid


def resample05(pts):
    """INVARIANT: walk the polyline emitting a point every EXACTLY 0.5 of arc
    length; returns the resampled chain for scan()."""
    out = [pts[0]]
    need = 0.5
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        s = 0.0
        while seg - s >= need - 1e-9:
            s += need
            t = s / seg
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
            need = 0.5
        need -= (seg - s)
    return out


def scan(pts, label):
    """Gate-exact window scan with the anti-empty-scan invariant ASSERTED.

    The invariant checks ARC spacing, not chord spacing: consecutive samples are
    emitted 0.5 of ARC apart, so on curvature R their CHORD is 0.5 - L^3/(24 R^2)
    (L=0.5). Measured + derived floor across this family: the sharpest node is
    the flip point of the a=-0.95 profile (kappa_max ~= 0.19, R ~= 5.26); the
    constant-R deficit there is 1.88e-4 and the measured varying-kappa factor
    (node 74, a=-0.8: deficit 2.20e-4 vs constant-R 1.53e-4) is ~1.44x, so the
    family floor is <= 2.7e-4 and the assert bound is 3.5e-4 — four orders above
    probe3j's void gaps (0.40-5.59) and far below 1e-6-equality false-asserts on
    a CORRECT chain."""
    gaps = [math.dist(p, q) for p, q in zip(pts, pts[1:])]
    assert len(pts) >= 20 and gaps and all(
        0.5 - 3.5e-4 <= g <= 0.5 + 1e-9 for g in gaps
    ), f"{label}: resample invariant violated (min/max gap {min(gaps):.4f}/{max(gaps):.4f})"
    flat = total = 0
    worst = 1e9
    for i in range(0, len(pts) - 16, 4):
        w = pts[i:i + 17]
        a, b = w[0], w[-1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        if L == 0:
            continue
        dev = max(abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L for p in w)
        total += 1
        if dev < CURV_MIN:
            flat += 1
        worst = min(worst, dev)
    assert total > 0, f"{label}: ZERO windows"
    return flat, total, worst


GAPS = ((19.6, 17.0), (19.6, 18.0), (20.0, 17.0), (20.5, 18.0), (21.0, 18.0))

print("probe3k2 — gaussian-bump slope profile, fixed closure (ratio bisection),")
print("resample-to-0.5 invariant asserted before every scan")
found = []
for run, rise in GAPS:
    best = (999, None)
    for a in (-0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -0.95):
        w = full_period(run, rise, a)
        if w is None:
            continue
        pts, sm, thdeg, resid = w
        r05 = resample05([(u, d) for u, d in pts])
        flat, total, worst = scan(r05, f"run={run} rise={rise} a={a}")
        if flat < best[0]:
            best = (flat, (a, round(sm, 2), round(thdeg, 1), total, round(worst, 3), round(resid, 3)))
        if flat == 0:
            found.append((run, rise, a, round(sm, 2), round(thdeg, 1), total, round(worst, 3), round(resid, 3)))
    print(f"run={run} rise={rise}: best flat={best[0]} (a,sm,thmax,win,worst,resid)={best[1]}")
print(f"\nZERO-FLAT (valid scans only): {len(found)}")
for f in found[:24]:
    print("  ", f)
