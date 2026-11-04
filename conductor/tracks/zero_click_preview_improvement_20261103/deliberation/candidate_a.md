# Candidate A — Representative-sheet coverage and defect inventory

**Space**: Zero-click preview gate improvement (print readiness measurement and root-cause inventory).

**Thesis**: Before changing code, enumerate the representative sheets and defect classes behind the current 94% rate. Make the rate reproducible and the failures diagnosable.

**What it does**:
- Defines or audits the representative-sheet set used to judge "print-ready without adjustment".
- Classifies current failures by root cause (clipping, overlapping, blank/hidden content, pagination, defaults).
- Produces or improves the evidence artifact a fresh session can re-run and `run.py` can consume.

**Why it may win**: Highest leverage per change when the rate is only 1 point short of the threshold and the failure set is not yet fully inventoried. It also makes AC-3 (evidence, not assertion) achievable.

**Risk**:
- If the inventory is large or the failures are scattered, this can become a measurement-only track with no code change, which may not be what a later session wants.
- Requires the session to define what "representative sheet" means operationally.
