# G10 curvature feasibility, probe 2: does the ANALYTIC wave (sinusoid + H2 second
# harmonic, the constructor's rail_d profile actually SAMPLED instead of S-cubics)
# survive the gate's flat-window rule? And where are its flat zones?
import math

CURV_MIN = 0.5


def profile(g, A=10.0, H2=1.2, MID=16.0, step=0.5):
    """One full period of d(u) = MID - A cos(2pi u/g) + H2 cos(4pi u/g), resampled
    at 0.5 arc-length (approximate by projection sampling — the gate resamples by
    ARC length, which only changes density, not the sagitta scale)."""
    pts = []
    u = 0.0
    while u < 2 * g + 1e-9:
        th = 2 * math.pi * u / g
        d = MID - A * math.cos(th) + H2 * math.cos(2 * th)
        pts.append((u, d))
        u += step
    return pts


def worst_windows(pts, label):
    n = len(pts)
    worst = (1e9, None)
    flat = 0
    total = 0
    for i in range(0, n - 16, 4):
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


print("=== analytic sinusoid+H2 (rail_d as drawn), constructor gaps ===")
for g in (24, 28, 32, 38, 42):
    worst_windows(profile(g), f"g={g}")

print("=== larger amplitude / smaller period candidates ===")
for g, A in ((38, 12.0), (38, 14.0), (42, 12.0), (42, 14.0), (42, 16.0), (24, 14.0)):
    worst_windows(profile(g, A=A), f"g={g} A={A}")

print("=== H2 tuning at g=42 A=10 (the binding long gap) ===")
for H2 in (1.2, 2.0, 3.0, 4.0):
    worst_windows(profile(42, H2=H2), f"g=42 H2={H2}")
