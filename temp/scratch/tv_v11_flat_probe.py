# Probe: where are the v11 tile's 424 flat G10 windows? (sagitta < 0.5 over 8-unit stretches)
# Mirrors the gate's chordDeviations + arcResample + the G10 loop exactly.
import json, math, re, sys

SVG = sys.argv[1] if len(sys.argv) > 1 else "temp/scratch/tv_constructed_tile_v11.svg"
src = open(SVG, encoding="utf-8").read()
d = re.search(r'<path fill="none"[^>]*\sd="([^"]+)"', src).group(1)

def flatten_path(d, steps=16):
    toks = re.findall(r"[MLCZzQqSsAaHhVv]|-?\d+(?:\.\d+)?", d)
    pts, i, cur, start, last = [], 0, None, None, None
    def num():
        nonlocal i
        v = float(toks[i]); i += 1; return v
    while i < len(toks):
        cmd = toks[i]; i += 1
        if re.match(r"-?\d", cmd):
            i -= 1; cmd = last or "L"
        C = cmd.upper(); last = cmd
        if C == "M":
            cur = (num(), num()); start = cur; pts.append(cur)
            while i < len(toks) and re.match(r"-?\d", toks[i]):
                cur = (num(), num()); pts.append(cur)
        elif C == "L":
            cur = (num(), num()); pts.append(cur)
        elif C == "C":
            p0 = cur
            c1 = (num(), num()); c2 = (num(), num()); p1 = (num(), num())
            for s in range(1, steps + 1):
                t = s / steps; mt = 1 - t
                x = mt**3*p0[0] + 3*mt*mt*t*c1[0] + 3*mt*t*t*c2[0] + t**3*p1[0]
                y = mt**3*p0[1] + 3*mt*mt*t*c1[1] + 3*mt*t*t*c2[1] + t**3*p1[1]
                pts.append((x, y))
            cur = p1
        elif C == "Z":
            if start and cur and math.dist(start, cur) > 1e-9:
                pts.append(start); cur = start
    return pts

def arc_resample(pts, step=0.5):
    out, carry = [], 0.0
    for a, b in zip(pts, pts[1:]):
        L = math.dist(a, b)
        if L == 0: continue
        t = carry
        while t < L:
            out.append((a[0]+(b[0]-a[0])*t/L, a[1]+(b[1]-a[1])*t/L))
            t += step
        carry = t - L
    return out

def chord_dev(w):
    a, b = w[0], w[-1]
    dx, dy = b[0]-a[0], b[1]-a[1]
    L = math.hypot(dx, dy)
    if L == 0: return 0
    return max(abs((p[0]-a[0])*dy - (p[1]-a[1])*dx)/L for p in w)

S = arc_resample(flatten_path(d))
step = 16
flat = []
for i in range(0, len(S) - step, 4):
    w = S[i:i+step+1]
    dev = chord_dev(w)
    if dev < 0.5:
        flat.append((round(i*0.5, 1), round(dev, 3), round(w[0][0],1), round(w[0][1],1)))
print("total windows:", len(range(0, len(S)-step, 4)), "flat:", len(flat))
print("worst 12:", flat[:12])
# bucket by s region
edges = {"top": lambda p: p[1] <= 128 and p[0] <= 112 or p[1] < 32,
         }
def region(p):
    x, y = p
    if y < 32 and x < 192: return "top-band"
    if x > 192 and y < 224: return "right-band"
    if y > 224 and x > 32: return "bottom-band"
    if x < 32 and y > 32: return "left-band"
    return "corner"
from collections import Counter
print(Counter(region((f[2], f[3])) for f in flat))
