# Inspect probe3's biarc_wall emitted chain: is it continuous? where do its
# samples land? This arbitrates the a=0 cross-check discrepancy.
import math

exec(open('temp/scratch/tv_v10_g10_feas_probe3.py').read().split('print("=== edge')[0])

pts, R, alpha = biarc_wall(12.0, 20.0)
print('run=12 rise=20: R =', round(R, 3), 'alpha deg =', round(math.degrees(alpha), 2))
print('n pts =', len(pts))
gaps = [math.dist(p, q) for p, q in zip(pts, pts[1:])]
print('max gap', round(max(gaps), 4), 'min gap', round(min(gaps), 4))
print('first 6:', [(round(x, 2), round(y, 2)) for x, y in pts[:6]])
print('last 6:', [(round(x, 2), round(y, 2)) for x, y in pts[-6:]])
big = [(i, round(g, 3), pts[i], pts[i+1]) for i, g in enumerate(gaps) if g > 0.6]
print('gaps > 0.6:', big[:8])
# arc-sum vs expected half arc
print('arc sum', round(sum(gaps), 3))
