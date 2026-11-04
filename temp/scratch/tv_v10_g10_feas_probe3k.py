# G10 curvature feasibility, probe 3k (GAUSSIAN-BUMP slope profile — the shape the
# turn-budget math says MUST exist):
# Laws established by 3a-3j (all measured against the gate's exact window scan):
#   dev(centered flip window) ~= 2k ; dev(min over positions) ~= 3k (equal-k sides);
#   dev(same-sign window) = 8k. Constraints: flip needs k >= ~0.17-0.25 within +-4
#   arc of the inflection; everywhere else k >= 0.0625; total turn = 2*thmax <= pi
#   (monotone projection); wall arc in [22.5, 42.5] (G7).
# Budget check at thmax=88deg: flip zone 8*0.17 = 1.37 rad + rest 14.5*0.0625 = 0.91
# rad => 2.28 rad <= 3.07 rad available. FEASIBLE with margin — the earlier families
# failed because they spread curvature UNIFORMLY (two/three-arc) or mis-closed
# (staircase/ramp). Profile: slope t(s) = thmax * f(x), f' = normalized
# (1 + a*cos(2pi x) with a < 0 -> curvature peaks at the flip, dips at the crest
# but stays >= f'_min). Closure: (sm, thmax) solve u=run, d=rise exactly.
import math

CURV_MIN = 0.5
GATE_STEP = 4  # samples; sample spacing 0.5 -> windows step 2u, len 8u


def wall(run, rise, a, step=0.25):
    """slope profile f'(x) = 1 + a*cos(2 pi x) on x in [0,1], a in (-1, 0):
    curvature peaks at x=0.5 (flip), min at x=0,1 (crest/trough of the half-wall —
    wait: x=0 and x=1 are the CREST and TROUGH ends where slope is 0/max. The
    full-period crest join is at x=0 of each wall; the wall covers crest->trough,
    so slope 0 at x=0 (crest) and 0 at x=1? No: wall = crest->trough has slope
    0 at BOTH ends and max at the middle. So f(x) must go 0->max->0: use
    f'(x) with integral f(1)=0? Simpler: parametrize the HALF-wall (crest->max
    slope) by slope t(s) = thmax * g(x), g(0)=0, g(1)=1, then mirror."""
    pass


def half_wall(sm, thmax, a, step=0.25):
    """Half wall: crest (s=0, slope 0) -> max slope thmax at s=sm.
    slope t(x) = thmax * g(x), x = s/sm; g' = (1 + a*(1 - cos(2 pi x))/2 *?)...
    Use g(x) = x + (a/(2pi))*sin(2 pi x): g(0)=0, g(1)=1, g' = 1 + a cos(2pi x).
    a in (-1, 0): g' min = 1+a at x=0.5?? cos(2pi*0.5)=cos(pi)=-1 -> g'(0.5)=1-a.
    For a<0: g'(0.5) = 1+|a| (max at center), g'(0) = g'(1) = 1+a = 1-|a| (min at
    ends). Curvature kappa = thmax*g'/sm: PEAKS at max slope (flip), minima at
    crest/trough ends. Exactly the profile wanted."""
    pts = []
    s = 0.0
    u = d = 0.0
    while s < sm - 1e-9:
        x = s / sm
        t = thmax * (x + (a / (2 * math.pi)) * math.sin(2 * math.pi * x))
        pts.append((u, d, t))
        ds = min(step, sm - s)
        x2 = min((s + ds) / sm, 1.0)
        t2 = thmax * (x2 + (a / (2 * math.pi)) * math.sin(2 * math.pi * x2))
        u += math.cos((t + t2) / 2) * ds
        d += math.sin((t + t2) / 2) * ds
        s += ds
    pts.append((u, d, thmax * (1 + 0)))  # g(1)=1
    return pts


def wall_full(run, rise, a):
    """Solve (sm, thmax) for closure u=run/... on the half wall: u(sm)=run/2,
    d(sm)=rise/2 (symmetric mirror). Nested bisection."""
    def close_c(sm):
        lo, hi = 0.05, math.radians(88)
        for _ in range(60):
            mid = (lo + hi) / 2
            p = half_wall(sm, mid, a)
            if p[-1][0] > run / 2:
                hi = mid
            else:
                lo = mid
        return (lo + hi) / 2

    lo, hi = 4.0, 30.0
    best = None
    for _ in range(60):
        sm = (lo + hi) / 2
        th = close_c(sm)
        p = half_wall(sm, th, a)
        resid = p[-1][1] - rise / 2
        best = (sm, th, p, resid)
        if abs(resid) < 0.05:
            break
        if resid < 0:
            lo = sm
        else:
            hi = sm
    sm, th, p, resid = best
    if abs(resid) > 0.3:
        return None
    prof = [(u, d) for u, d, t in p]
    half = prof[:]  # quarter: crest (0,0) -> max-slope point (run/2, rise/2)
    q2 = [(run - u, rise - d) for u, d in reversed(half[:-1])]  # -> trough (run, rise)
    wall1 = half + q2
    period = wall1 + [(run + u, rise - d) for u, d in wall1[1:]]  # -> crest (2run, 0)
    return period, sm, math.degrees(th)


def full_period(run, rise, a, base):
    w = wall_full(run, rise, a)
    if w is None:
        return None
    pts, sm, thdeg = w
    prof = [(u, base + d) for u, d in pts]
    return prof, sm, thdeg


def scan(pts, step=GATE_STEP):
    n = len(pts)
    flat = total = 0
    worst = 1e9
    for i in range(0, n - 17, step):
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


print("Gaussian-bump slope profiles: a in [-0.9,-0.4], run 19.6-21, rise 17-18")
found = []
for run, rise in ((19.6, 17.0), (19.6, 18.0), (20.0, 17.0), (20.5, 18.0), (21.0, 18.0)):
    best = (999, None)
    for a in (-0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -0.95):
        fp = full_period(run, rise, a, 7.0)
        if fp is None:
            continue
        prof, sm, thdeg = fp
        flat, total, worst = scan(prof)
        arc = None  # compute along-vine half-period = 2*int ds ~ estimate from pts
        if flat < best[0]:
            best = (flat, (a, round(sm, 1), round(thdeg), total, round(worst, 3)))
        if flat == 0:
            # wall arc = 2 * sm' where sm' is the true arc of the half wall
            found.append((run, rise, a, round(sm, 1), round(thdeg), total, round(worst, 3)))
    print(f"run={run} rise={rise}: best flat={best[0]} (a,sm,thmax,windows,worst)={best[1]}")
print(f"\nZERO-FLAT: {len(found)}")
for f in found[:20]:
    print("  ", f)


# --- probe3k FIX (continued after interruption): the wall() closure above never
# converged because bisecting thmax against run/2 flips discontinuously; the
# correct closure fixes thmax and solves sm by bisection on the u residual (u is
# MONOTONE in sm). Kept below as probe3k2 family; results recorded in the leg-6
# addendum, not printed by the interrupted run above.


# === ADDENDUM (session resume 2026-10-09, post-interrupt): probe3k verdict + why ===
# probe3k as written above is DEAD ON ARRIVAL and its "best flat=999 (None)" table
# is a CLOSURE BUG, not a physics verdict:
#   * close_c() bisects thmax against run/2, but u(sm, thmax) is not monotone in
#     thmax across the reachable set (at sm>=11.5 the bisection lands on the
#     thmax=0.05 edge where u ~ sm, flipping the bracket) -> the nested solve
#     never lands on u=run/2 AND d=rise/2 simultaneously; every (run,rise) pair
#     returned None and "best flat=999".
#   * Measured directly: for sm in {12..30} the solver returns thmax=2.86deg with
#     d_end ~ 0.3-0.75 vs target rise/2=8.5 — 12-25x off, i.e. never closed.
#   * probe3j's two printed "ZERO-FLAT" rows are ALSO void, independently: its
#     integrate() emits 15 samples per FULL PERIOD with arc spacing 0.40-5.59
#     (gate expectation 0.5), so scan() ran ZERO windows (total=0) and "flat=0,
#     worst=1e9" is the empty-scan artifact, not a passing wave. The 1e9 worst is
#     the giveaway.
# NET STATE at interrupt: NO shape family has yet produced a measured zero-flat
# full period under the gate's own 0.5-spaced window scan. Families ruled out with
# VALID scans: equal biarc (3b), asymmetric biarc (3c/3e), three-arc (3d/3f/3g),
# S-notch (3h: flat bottoms at 4/period), kappa-staircase (3i: no closure at all).
# The only UNMEASURED survivor is the gaussian-bump slope profile (this file) with
# a fixed closure — solve sm by bisection on u|_{thmax fixed} (monotone), thmax by
# outer bisection on d. Next session: probe3k2 with that closure, plus
# resample-to-0.5 before scan on EVERY family result.
