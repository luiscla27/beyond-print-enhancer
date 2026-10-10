# probe3j2 — RAMP-RADIUS family, corrected instrument + muse iter-23 falsification
# criterion. probe3j's rows were void (empty-scan artifact, leg-6 §7.4). Muse
# iter-23: "compute closure residual and avg_k for p in [1,4], Rflip in [2.5,4],
# Rlead in [8,16] with gate-exact 0.5u resample. If no point yields residual
# <1e-9 AND dev_flip>=0.5 AND dev_flank>=0.5, then family is excluded and loop
# is at arithmetic dead end."
#
# Family: R(t) = s * (Rlead + (Rflip-Rlead) * (t/thmax)^p), t = slope angle.
# Half wall: integrate t 0->thmax; wall = point-mirror through the half-wall end
# (so wall end = (2u_end, 2d_end)); period = depth-mirror of the wall.
# Closure: s factors out of u/d, so for each grid point bisect thmax on the
# RATIO u_end/d_end == run/rise (monotone, same trick as probe3k2), set
# s = run/(2*u_end_unit), then rise_err = |2*s*d_end_unit - rise| is DETERMINED
# by the grid point — closure exists iff some grid point lands rise_err ~ 0.
import math

CURV_MIN = 0.5
STEP = 0.25  # integration step in t (radians); arc step then varies


def half_wall(s, thmax, Rlead, Rflip, p):
    """Integrate t 0->thmax with ds = R(t) dt. Returns (pts, u_end, d_end, arc)."""
    pts = [(0.0, 0.0)]
    u = d = arc = 0.0
    n = 2000
    dt = thmax / n
    for i in range(n):
        t0, t1 = i * dt, (i + 1) * dt
        tm = (t0 + t1) / 2
        R = s * (Rlead + (Rflip - Rlead) * (tm / thmax) ** p)
        dsm = R * dt
        um = math.cos(tm) * dsm
        dm = math.sin(tm) * dsm
        u += um
        d += dm
        arc += dsm
        pts.append((u, d))
    return pts, u, d, arc


def solve_ratio(ratio, Rlead, Rflip, p):
    """Bisect thmax so u_end/d_end == ratio (u/d decreases as thmax grows)."""
    lo, hi = math.radians(30), math.radians(88.0)

    def r(th):
        _, u, d, _ = half_wall(1.0, th, Rlead, Rflip, p)
        return u / d if d > 1e-12 else 1e9

    r_lo, r_hi = r(lo), r(hi)
    if not (r_hi <= ratio <= r_lo):
        return None
    for _ in range(60):
        mid = (lo + hi) / 2
        if r(mid) > ratio:
            lo = mid
        else:
            hi = mid
    th = (lo + hi) / 2
    _, u, d, arc = half_wall(1.0, th, Rlead, Rflip, p)
    return th, u, d, arc


def try_close(run, rise, Rlead, Rflip, p):
    sol = solve_ratio(run / rise, Rlead, Rflip, p)
    if sol is None:
        return None
    th, u1, d1, arc1 = sol
    s = run / (2 * u1)
    rise_hat = 2 * s * d1
    rise_err = rise_hat - rise
    return th, s, rise_err, arc1 * s


def period_pts(run, rise, s, thmax, Rlead, Rflip, p):
    half, u1, d1, _ = half_wall(s, thmax, Rlead, Rflip, p)
    wall = half + [(2 * u1 - u, 2 * d1 - d) for u, d in reversed(half[:-1])]
    per = wall + [(run + u, rise - d) for u, d in wall[1:]]
    # dedupe consecutive
    out = []
    for q in per:
        if not out or math.dist(q, out[-1]) > 1e-9:
            out.append(q)
    return out


def resample05(pts):
    out = [pts[0]]
    need = 0.5
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        st = 0.0
        while seg - st >= need - 1e-9:
            st += need
            t = st / seg
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
            need = 0.5
        need -= (seg - st)
    return out


def scan(pts, label):
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


REAL = (24, 26, 28, 30, 32, 38, 42)  # constructor gaps; run = g/2, rise = 20
print("probe3j2 — ramp-radius family, muse iter-23 falsification criterion")
print("closure landscape (min |rise_err| over the grid, per gap):")
landscape = {}
closers = []
for g in REAL:
    run, rise = g / 2, 20.0
    best_err = (1e9, None)
    for p in (1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0):
        for Rflip in (2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0):
            for Rlead in (8.0, 9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 16.0):
                r = try_close(run, rise, Rlead, Rflip, p)
                if r is None:
                    continue
                th, s, rise_err, arc = r
                if abs(rise_err) < abs(best_err[0]):
                    best_err = (rise_err, (p, Rflip, Rlead, round(math.degrees(th), 1), round(s, 3), round(arc, 1)))
                if abs(rise_err) < 0.05:
                    closers.append((g, p, Rflip, Rlead, round(rise_err, 4), round(math.degrees(th), 1), round(arc, 1)))
    landscape[g] = best_err
    print(f"  gap={g}: min |rise_err| = {abs(best_err[0]):.4f} at (p,Rflip,Rlead,th,s,arc)={best_err[1]}")

print(f"\nclosure hits (|rise_err| < 0.05): {len(closers)}")
for c in closers[:20]:
    print("  ", c)

print("\nscans of the closure hits (gate-exact, invariant asserted):")
any_pass = False
for (g, p, Rflip, Rlead, rerr, thdeg, arc) in closers[:20]:
    run, rise = g / 2, 20.0
    th, s, rise_err, arcw = try_close(run, rise, Rlead, Rflip, p)
    pts = period_pts(run, rise_hat := 2 * s * (try_close(run, rise, Rlead, Rflip, p)[3] / s and 0 or 0) + rise if False else rise, s, th, Rlead, Rflip, p)
    # scan the TRUE closed shape (rise_hat), not the target — what the family can actually draw
    pts_true = period_pts(run, rise_hat, s, th, Rlead, Rflip, p)
    try:
        flat, total, worst = scan(resample05(pts_true), f"gap={g} p={p} Rflip={Rflip} Rlead={Rlead}")
        print(f"  gap={g} (p={p},Rflip={Rflip},Rlead={Rlead},th={thdeg},arc={arc}): flat={flat}/{total} worst={worst:.3f}")
        if flat == 0:
            any_pass = True
    except AssertionError as e:
        print(f"  gap={g} (p={p},Rflip={Rflip},Rlead={Rlead}): INVARIANT {e}")

print(f"\nVERDICT CRITERION (muse iter-23): family excluded = {not any_pass}")
