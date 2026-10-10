# G10 curvature feasibility, probe 3i (KAPPA-STAIRCASE hypothesis — the untested
# middle ground between smooth-crossing families (probe2: kappa passes through 0
# at every inflection -> flat) and arc chains with big kappa jumps (3b-3g: the
# jump windows dip below 0.5 -> flat=2).
#
# Shape: |kappa| >= kbase everywhere (dev = 8*kbase >= 0.5); at the inflection
# kappa JUMPS +kflip/-kflip (centered window dev = 2*kflip >= 0.5 -> kflip >= 0.25);
# between them a staircase of small jumps (ratio <= 1.25) approximates a ramp.
# Turn budget per wall = 2*thmax <= pi (monotone projection); min-turn baseline
# 0.0625*arc ~ 1.56 rad at arc 25 leaves ~1.5 rad of thickening budget.
#
# Built as a chain of circular arcs; every jump ratio reported so the dip law can
# be measured per-ratio.
import math

CURV_MIN = 0.5


def staircase_wall(run, rise, kbase, kflip, nstage=4):
    """Wall crest->trough. kappa profile (as function of arc s from crest):
    stages on the lead-in: kbase * ramp up to kflip over the first half,
    flip at midpoint, mirror down. Radii: R = 1/k. Angles: turn = k*ds.
    Closure solved by scaling the arc parametrization to (run, rise) — we build
    in (u,d) from the angle-integral and then affine-correct? NO: build exactly,
    then check closure residual and reject."""
    # Build via slope integration: slope t(s), u = int cos t ds, d = int sin t ds.
    # total wall arc unknown; parametrize by s until slope returns to 0.
    # kappa schedule: symmetric about midpoint sm; |kappa| = kbase + (kflip-kbase)*shape
    # shape: linear ramp over [0, sm] measured from the flip? Simpler: |kappa(s)| =
    # kbase for |s-sm| > W; linear from kbase to kflip on [sm-W, sm-]; jump sign at sm.
    # Choose W = sm (whole wall ramps).
    # Unknowns: sm (half arc), and the schedule fixes everything. Solve sm so that
    # slope(sm) = thmax and slope(2sm) = 0 automatically (symmetric), then match
    # (run, rise) by choosing kbase/kflip per the targets — instead, fix schedule
    # shape and solve sm + a global curvature scale c: kappa = c * shape(s).
    # rise/run sets thmax = 2 atan(rise/run) implicitly; slope(sm) must equal thmax.
    thmax_target = None  # not needed directly
    step = 0.5

    def integrate(sm, c):
        pts = [(0.0, 0.0, 0.0)]  # u, d, slope
        s = 0.0
        while s < 2 * sm - 1e-9:
            x = abs(s - sm) / sm  # 0 at flip, 1 at crest/trough ends
            # TIGHT at the flip (kflip), GENTLE at the ends (kbase): the flip
            # window law needs kappa >= 0.25 both sides; end windows (same-sign,
            # straddling the extremum in the full period) need kappa >= 0.0625.
            k = c * (kflip + (kbase - kflip) * x)
            sign = 1.0 if s < sm else -1.0
            # wait: kappa is + (curving toward trough) before the flip, - after.
            # slope increases before flip (kappa>0), decreases after (kappa<0).
            kap = sign * k if False else (k if s < sm else -k)
            u, d, t = pts[-1]
            ds = min(step, 2 * sm - s)
            t2 = t + kap * ds
            u2 = u + math.cos((t + t2) / 2) * ds
            d2 = d + math.sin((t + t2) / 2) * ds
            pts.append((u2, d2, t2))
            s += ds
        return pts

    # solve (sm, c): inner solves u(run) for c at fixed sm; OUTER solves d(rise)
    # by adjusting sm (nested solve — 3i's first version adjusted sm on resid_u,
    # which never closes both targets; that was the "no closure" bug).
    lo_sm, hi_sm = 5.0, 40.0
    best = None
    for _ in range(60):
        sm = (lo_sm + hi_sm) / 2
        lo_c, hi_c = 0.005, 0.8
        for _ in range(60):
            c = (lo_c + hi_c) / 2
            p = integrate(sm, c)
            if p[-1][0] > run:
                hi_c = c
            else:
                lo_c = c
        c = (lo_c + hi_c) / 2
        p = integrate(sm, c)
        resid_u = p[-1][0] - run
        resid_d = p[-1][1] - rise
        best = (sm, c, p, resid_u, resid_d)
        if abs(resid_d) < 0.15:
            break
        if resid_d < 0:
            lo_sm = sm
        else:
            hi_sm = sm
    sm, c, p, ru, rd = best
    if abs(ru) > 1.0 or abs(rd) > 0.8:
        return None, None
    prof = [(u, d) for u, d, t in p]
    if prof[-1][0] < run - 0.01:
        prof.append((run, p[-1][1]))
    prof.append((run, rise))
    out = []
    for q in prof:
        if not out or math.dist(q, out[-1]) > 1e-6:
            out.append(q)
    thmax = p[len(p)//2][2]
    return out, (sm, c, math.degrees(thmax), 2 * sm)


def full_period(run, rise, kbase, kflip, base):
    w, info = staircase_wall(run, rise, kbase, kflip)
    if w is None:
        return None, None
    pts = [(u, base + d) for u, d in w]
    for u, d in w[1:]:
        pts.append((run + u, base + rise - d))
    pts.append((2 * run, base))
    return pts, info


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


print("kbase sweep (min |kappa|), kflip sweep (flip jump), run 19.6 rise 17")
for kbase in (0.0625, 0.07, 0.08, 0.09):
    for kflip in (0.25, 0.3, 0.35, 0.4):
        fp, info = full_period(19.6, 17.0, kbase, kflip, 7.0)
        if fp is None:
            print(f"kbase={kbase} kflip={kflip}: no closure")
            continue
        flat, total, worst = scan(fp)
        print(f"kbase={kbase} kflip={kflip}: flat={flat}/{total} worst={worst:.3f} info(sm,c,thmax,wallarc)={tuple(round(x,2) for x in info)}")
