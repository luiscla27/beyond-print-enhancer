# probe3m — the TRUE tangent-continuous biarc, gate-exact scan.
# probe3 INTENDED this shape but its generator walked only th 0..alpha/2 of arc1
# and mirrored through the wall midpoint, leaving a 13.8-unit straight chord
# mid-wall (chain inspection: (5.83,3.30) -> (6.44,17.12) on gap 24) and scanning
# windows of 17 raw nodes at irregular spacing. This probe generates the real
# shape: arc1 turns slope 0 -> th_j (FULL join slope), th_j = 2*atan(rise/run);
# arc2 is arc1's point-mirror through (run/2, rise/2) (tangent-continuous there).
# Closure is exact: 2R sin(th_j) = run, 2R(1-cos th_j) = rise with R =
# run/(2 sin th_j). Analytic prediction (3a laws): the inflection sits at
# kappa = 1/R with R >= 6.8 on every constructor wall -> dev(flip window)
# ~= 2/R <= 0.29 < 0.5 -> flat windows EXPECTED. Measured here, not asserted.
import math

CURV_MIN = 0.5


def true_biarc_wall(run, rise, step=0.25):
    """crest (0,0) -> trough (run,rise): arc1 (radius R, turn 0..th_j, arc-length
    parameterized) + arc2 = point-mirror of arc1 through (run/2, rise/2)."""
    th_j = 2 * math.atan2(rise, run)
    R = run / (2 * math.sin(th_j))
    pts = [(0.0, 0.0)]
    s = step
    while True:
        th = s / R
        if th > th_j + 1e-12:
            break
        pts.append((R * math.sin(th), R * (1 - math.cos(th))))
        s += step
    # exact arc1 end at th_j
    u1, d1 = R * math.sin(th_j), R * (1 - math.cos(th_j))
    pts.append((u1, d1))
    # arc2: mirror of arc1's points, REVERSED (arc2 runs seam->trough), excluding
    # BOTH endpoints of the wall, so no point lands inside 1e-6 of
    # (run/2, rise/2) -> no degenerate seam node
    mir = [(run - u, rise - d) for u, d in reversed(pts[1:-1])
           if math.dist((u, d), (u1, d1)) > 1e-6
           and math.dist((run - u, rise - d), (u1, d1)) > 1e-6]
    pts.extend(mir)
    pts.append((run, rise))
    # dedupe consecutive
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) > 1e-9:
            out.append(p)
    return out, R, th_j


def resample05(pts):
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


def full_period(run, rise, base=7.2):
    wall, R, th_j = true_biarc_wall(run, rise)
    pts = [(u, base + d) for u, d in wall]
    for u, d in wall[1:]:
        pts.append((run + u, base + rise - d))
    return pts, R, th_j


GAPS = (24, 26, 28, 30, 32, 38, 42)
print("probe3m — TRUE biarc (exact closure, overhang allowed), gate-exact scan")
tot = 0
for g in GAPS:
    pts, R, th_j = full_period(g / 2, 20.0)
    r05 = resample05(pts)
    flat, total, worst = scan(r05, f"gap={g}")
    tot += flat
    print(f"  gap={g}: R={R:.2f} th_j={math.degrees(th_j):.1f}deg flat={flat}/{total} worst={worst:.3f} (2/R predict {2/R:.3f})")
print(f"TOTAL flat windows: {tot}")

# Corner arbitration: the hairpin is wall(3, 19.8) + mirrored wall — TRUE biarc
# walls back to back. Probe3 claimed corner flat=0 with the same broken generator.
print()
print("corner hairpin (run 3, rise 19.8) with TRUE biarc walls:")
w1, R1, t1 = true_biarc_wall(3.0, 19.8)
pts = [(u, 7.2 + d) for u, d in w1]
for u, d in w1[1:]:
    pts.append((3.0 + u, 7.2 + 19.8 - d))
r05 = resample05(pts)
flat, total, worst = scan(r05, "corner")
print(f"  corner: R={R1:.2f} th_j={math.degrees(t1):.1f}deg flat={flat}/{total} worst={worst:.3f} (2/R predict {2/R1:.3f})")
for r in (2.0, 4.0, 6.0):
    w1, R1, t1 = true_biarc_wall(r, 19.8)
    pts = [(u, 7.2 + d) for u, d in w1]
    for u, d in w1[1:]:
        pts.append((r + u, 7.2 + 19.8 - d))
    r05 = resample05(pts)
    flat, total, worst = scan(r05, f"corner run={r}")
    print(f"  corner run={r}: R={R1:.2f} flat={flat}/{total} worst={worst:.3f} (2/R {2/R1:.3f})")
