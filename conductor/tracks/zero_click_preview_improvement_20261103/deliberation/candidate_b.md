# Candidate B — Print-defect root-cause remediation

**Space**: Zero-click preview gate improvement (fix the recurring blocking defects that require user adjustment).

**Thesis**: Raise the rate by fixing the highest-frequency or highest-impact print defects that still require manual adjustment before a sheet is print-ready.

**What it does**:
- Targets specific recurring defects in print preview: clipping, overlapping, blank or unexpectedly hidden content, pagination, default pagination/margins/scale/colors/borders.
- Changes the product behavior that causes those defects.

**Why it may win**: Directly improves the user-facing preview experience and is the most concrete path to "fewer sheets need adjustment".

**Risk**:
- Defect clustering matters. If the remaining failures are many small unrelated issues, this becomes a diffuse fix effort.
- Must not regress the 94% rate while improving it; the evidence artifact must catch regressions.
