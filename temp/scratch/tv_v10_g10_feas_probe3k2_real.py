# 3k2 on the CONSTRUCTOR'S REAL geometry (probe3's gap list: period = gap,
# swing = 20, base = 7.2 -> half-period run = gap/2, rise = 20), plus the a=0
# instrument cross-check: a=0 IS the linear-slope S = probe3's biarc topology,
# so it must reproduce probe3's flat=0 / worst 0.75-2.3 on these gaps.
import math

exec(open('temp/scratch/tv_v10_g10_feas_probe3k2.py').read().split('GAPS =')[0])

REAL = ((12.0, 20.0), (13.0, 20.0), (14.0, 20.0), (15.0, 20.0),
        (16.0, 20.0), (19.0, 20.0), (21.0, 20.0))  # run=gap/2, rise=swing 20

print('a=0 cross-check on real gaps (expect flat=0, worst 0.75-2.3 per probe3):')
for run, rise in REAL:
    w = full_period(run, rise, 0.0)
    if w is None:
        print(f'  run={run}: NO CLOSURE')
        continue
    pts, sm, thdeg, resid = w
    r05 = resample05(pts)
    flat, total, worst = scan(r05, f'a=0 run={run}')
    print(f'  run={run} (gap={2*run:.0f}) R={sm/thdeg and run and (run/2)/math.tan(math.radians(thdeg)/2) or 0:5.2f}: flat={flat}/{total} worst={worst:.3f} sm={sm:.2f} th={thdeg:.1f}')

print()
print('gaussian-bump family on real gaps (a grid):')
found = []
for run, rise in REAL:
    best = (999, None)
    for a in (-0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -0.95):
        w = full_period(run, rise, a)
        if w is None:
            continue
        pts, sm, thdeg, resid = w
        r05 = resample05(pts)
        flat, total, worst = scan(r05, f'run={run} a={a}')
        if flat < best[0]:
            best = (flat, (a, round(sm, 2), round(thdeg, 1), round(worst, 3)))
        if flat == 0:
            found.append((run, rise, a, round(sm, 2), round(thdeg, 1), round(worst, 3)))
    print(f'  run={run} (gap={2*run:.0f}): best flat={best[0]} {best[1]}')
print(f'\nZERO-FLAT on real geometry: {len(found)}')
for f in found[:24]:
    print('  ', f)
