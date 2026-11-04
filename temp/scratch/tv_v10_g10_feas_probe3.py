# G10 curvature feasibility, probe 3: EXACT constructor geometry (all real gaps +
# corner hairpins) as biarc walls, gate-exact window math. Pass/fail per window.
import math

CURV_MIN = 0.5


def biarc_wall(run, rise, step=0.5):
    """One crest->trough wall in (u, d) plane: two circular arcs radius R, tangent-
    continuous, slope 0 -> alpha -> 0. Returns points starting at (0, 0)."""
    t = rise / run
    alpha = 2 * math.atan(t)
    R = run / (2 * math.sin(alpha))
    pts = []
    s = 0.0
    # arc1: center at (0, R) below? slope 0 at u=0, curving so d increases.
    # Center at (0, R) (above in d? d = R - R cos(theta), u = R sin(theta))
    while True:
        th = s / R
        if th >= alpha / 2 + 1e-9:
            break
        pts.append((R * math.sin(th), R * (1 - math.cos(th))))
        s += step
    u1 = R * math.sin(alpha / 2)
    d1 = R * (1 - math.cos(alpha / 2))
    # arc2: mirror: from (u1, d1) to (run, rise), slope alpha/2 -> 0
    # in local frame: du = R cos(phi) dd = R(1-cos... easier: full wall = point-reflection symmetry
    while True:
        th = alpha / 2 - s / R if False else None
        break
    # symmetric continuation: for k in (0, step]: point = (u1, d1) + mirror of arc1 point
    k = step
    while k <= u1 + 1e-9:
        p = (R * math.sin(alpha / 2 - k / R), R * (1 - math.cos(alpha / 2 - k / R)))
        # mirror through the wall midpoint: (run - u, rise - d)
        pts.append((run - p[0], rise - p[1]))
        k += step
    pts.append((run, rise))
    # dedupe/sort
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) > 1e-6:
            out.append(p)
    return out, R, alpha


def full_period(gap, swing=20.0, base=7.2):
    """crest(base) -> trough(base+swing) -> crest(base)."""
    wall, R, alpha = biarc_wall(gap / 2, swing)
    pts = [(u, base + d) for u, d in wall]
    for u, d in wall[1:]:
        pts.append((gap / 2 + u, base + swing - d))
    pts.append((gap, base))
    return pts, R


def corner_path(rise=19.8, run_top=3.0, run_right=3.0, base=7.2):
    """Option A corner: top-side hairpin wall (crest->trough, run 3, rise 19.8) then
    right-side wall (trough->crest, run 3). In a single (s, d) arc-length frame the
    two walls are consecutive; tile-plane rotation doesn't change sagitta."""
    w1, R1, _ = biarc_wall(run_top, rise)
    w2, R2, _ = biarc_wall(run_right, rise)
    pts = [(u, base + d) for u, d in w1]
    u_off = w1[-1][0]
    d_off = base + rise
    for u, d in w2[1:]:
        pts.append((u_off + u, d_off - d))
    return pts, R1


def check(pts, label, step_win=4):
    """Gate-exact flat-window scan (windows of 17 samples = 8u at 0.5u resampling,
    stepping 4 samples = 2u). pts here are already 0.5u-spaced."""
    n = len(pts)
    flat = 0
    total = 0
    worst = (1e9, None)
    for i in range(0, n - 17, step_win):
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


print("=== edge biarc walls at constructor gaps (swing 20) ===")
gaps_tb = [24, 38, 28, 42, 32]
gaps_lr = [26, 38, 30, 42, 32, 28]
allflat = 0
for g in gaps_tb + gaps_lr:
    pts, R = full_period(g)
    allflat += check(pts, f"gap={g} R={R:.2f}")

print("=== corner hairpin (run 3, rise 19.8) ===")
pts, R = corner_path()
allflat += check(pts, f"corner R={R:.2f}")
print("=== corner variants run 2-6 ===")
for r in (2.0, 4.0, 6.0):
    pts, R = corner_path(run_top=r, run_right=r)
    allflat += check(pts, f"corner run={r} R={R:.2f}")
print("TOTAL flat:", allflat)
