# Candidate D — Print-preview gate instrumentation

**Space**: Zero-click preview gate improvement (make the gate's own rate a reproducible measurement).

**Thesis**: The track's opening problem is not that the rate is low, it is that the rate is not known. Two numbers disagree on this tree (a narrative 94% and `0.886` in the evidence artifact) and the artifact itself disclaims the second as a proxy. Until the gate is instrumented, every candidate is arguing about a number nobody can reproduce.

**What it does**:
- Fixes the representative-sheet definition operationally (which sheets, what "no adjustment required" means, how a blocking defect is classified).
- Adds a runner/artifact that emits `gate_results.zero_click_preview_success_rate` from that definition, so `run.py score --evidence` consumes a measurement rather than a hand-entered proxy.
- Files the artifact where a fresh session can re-run it and get the same number.

**Why it may win**: It is the only candidate that makes AC-3 satisfiable on its own terms, and it is a prerequisite for attributing ANY rate movement to any code change. It also costs the least product surface — no print behaviour changes at all.

**Risk**:
- **It does not move the gate.** Instrumentation alone leaves the rate exactly where it is; delivered alone it converts "94% or 88.6%, unclear" into "88.6%, confirmed", which is worse for the score and honest about it.
- Its value depends on the representative-sheet set being defensible; a set chosen to flatter the rate is a measurement-shaped assertion.

**Requirements covered**: R1 and R2 are this candidate's whole content; R3 holds trivially (no product change); it says nothing about R5.
