# a=0 limit check + kappa_min table for the leg-6 §8 record.
import math

exec(open('temp/scratch/tv_v10_g10_feas_probe3k2.py').read().split('GAPS =')[0]
     + "\nGAPS = ((19.6, 17.0), (19.6, 18.0), (20.0, 17.0), (20.5, 18.0), (21.0, 18.0))\n")

print('a=0 limit (the two-arc S = probe3 biarc topology) + kappa_min table')
for run, rise in GAPS:
    row = []
    for a in (0.0, -0.2, -0.4, -0.6, -0.8):
        w = full_period(run, rise, a)
        if w is None:
            row.append((a, 'noclose'))
            continue
        pts, sm, thdeg, resid = w
        kmin = math.radians(thdeg) * (1 - abs(a)) / sm
        r05 = resample05(pts)
        try:
            flat, total, worst = scan(r05, f'a={a}')
            row.append((a, flat, round(kmin, 4), round(worst, 3)))
        except AssertionError:
            row.append((a, 'assert'))
    print(f'run={run} rise={rise}:', row)
