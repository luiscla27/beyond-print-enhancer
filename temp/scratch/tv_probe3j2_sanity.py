# Sanity check for probe3j2: print the reachable u/d ratio range at the grid
# corners (is the bracket test failing because the family truly cannot reach
# run/rise = 0.6-1.05, or because the bisection bracket is inverted?).
import math

exec(open('temp/scratch/tv_v10_g10_feas_probe3j2.py').read().split('REAL =')[0])

for (Rlead, Rflip, p) in ((16.0, 2.5, 1.0), (16.0, 2.5, 4.0), (8.0, 4.0, 1.0), (8.0, 2.5, 2.0), (12.0, 3.0, 1.5)):
    for th in (math.radians(30), math.radians(60), math.radians(88)):
        _, u, d, arc = half_wall(1.0, th, Rlead, Rflip, p)
        print(f"Rlead={Rlead} Rflip={Rflip} p={p} th={math.degrees(th):.0f}: u/d={u/d:.3f} d={d:.3f} arc={arc:.2f}")
    print(f"  needed ratio (run/rise) for gaps 24..42: {12/20:.3f} .. {21/20:.3f}")
