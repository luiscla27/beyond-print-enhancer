# Candidate A — ONE delegated session runs all 82 suites sequentially

**Mechanism:** A single fresh Reasonix session, POOL_SIZE=1, executes the e2e inventory
suite-by-suite in the inventory's own order. That session boots the video-capturing extension
context itself (reusing `test/browser_e2e/_helpers/dom.js`'s `launchExtensionContext` with
Playwright `video: "on"`), retains one full video per suite, groups the videos into one evidence
bundle per feature, uploads each bundle to the pinned MiniMax model through the official API,
and writes `verdict.md` + `progress.jsonl`.

**Decision-bearing difference:** the certifier seat is a SINGLE contiguous context that both
captured and judges the evidence. One session owns the whole feature bundle, so no cross-session
merge artifact exists: the mocha counts it just produced, the videos it just retained, and the
API prompt it composes are one artifact written by one agent.

**Critical assumption:** a single session's context budget can carry 82 suite launches / 432
test results because the per-suite facts are externalized to `progress.jsonl` rows rather than
held in conversation — and the pause rule (commit partial + relaunch resumes from the last row)
makes an interrupted run lossless.

**Fastest falsifier:** run the resume probe — relaunch this session after a pause (or replay it
from progress.jsonl in a sandbox) and check whether any suite already recorded in progress.jsonl
is re-executed. Instrument: `execution/probe_resume.js` (a dry-run mode of the Phase-1 launcher
that reads progress.jsonl, prints the next unrecorded suite, and refuses to re-run a recorded
one). If the probe shows a re-run, candidate A's central claim — resume safety without a merge
artifact — is false, and the sequential shape must be replaced.

**Primary failure mode:** context exhaustion mid-run is handled by the pause rule, but the
bottleneck that remains is SERIAL upload latency: ~18 feature bundles uploaded one after another.
If MiniMax's per-request latency is large, wall-clock time grows linearly with feature count and
nothing in A can parallelize it (that is deliberate — see candidate B's rejection).

**Requirements covered:** AC-1 (all 82 suites live, per-suite counts), AC-2 (one full video per
feature, one owner of the bundle), AC-3 + AC-6 (one MiniMax seat judges each feature against the
video it received), AC-5 (two artifacts inside the track dir, resume via progress.jsonl).
