# Candidate B — per-control spinners, wired one AC at a time

**Status: REJECTED** (considered, not adopted)

## What it is

For each of the seven named classes, add a bespoke busy affordance where that control lives:
a spinner inside the Print row, one in the filter panel, one in the settings dialog, one in the
shape picker, etc. — each with its own CSS, its own lifetime, its own clear.

## The case FOR it (why it was a real candidate)

- It maps 1:1 onto the judge's bullets, so the closure report can point at seven literal
  affordances, which is the easiest shape to defend in a re-judgment.
- Per-control placement is genuinely better in ONE respect: a marker anchored to the control the
  user pressed is more spatially honest than a top-of-screen pill, and the print-tray case in
  particular would read well that way.

## Why it lost

1. **It hides the shared cause.** The finding is one missing vocabulary across seven sites. Seven
   implementations of "in flight" means the eighth operation (the next thing anyone adds) has no
   precedent to copy and will invent a ninth. That is how `.be-ai-busy` came to exist as a
   private node in the first place.
2. **Seven lifetimes = seven chances to leak.** Every one needs a clear path on success, on
   error, on cancel and on unmount. The print case alone proved the point: the ONLY reliable
   clear is the browser's own `afterprint`, and a bespoke per-control timer would have had to
   rediscover that (the pre-fix code had no clear at all).
3. **Seven surfaces to keep print-safe.** Each new positioned node needs to be in the injected
   print hide list. The shared class is one addition; the per-control route is seven, and the
   `.be-ai-busy` leak we found proves this list rots silently — nobody notices until a printed
   page carries the marker.
4. **Seven styles to keep consistent** with the locked theme's pill. The theme is template-literal
   CSS read by tests from the INJECTED stylesheet; a per-control implementation would either
   duplicate those tokens (drift) or reach into the theme per control (coupling).
5. **Not actually cheaper.** The judged gaps cluster on three seams (`showBusy` for both BYOK
   flows, the print call, the filter commit). Five of the seven bullets are already covered by
   surfaces that exist — `aiSaveErrorMessage`, "Shape added", "Layout saved" — so the per-control
   route would have produced a lot of new code for the same coverage the shared marker gets in
   three call sites.

## What would have made B win

If the affordances needed to sit INSIDE a control's own box (a spinner replacing the Print row's
label, for instance, so the row is visibly the thing working), the shared top-of-screen pill is
the wrong geometry and B's spatial honesty would outweigh the maintenance argument. That is a
design call the operator can still make; it is recorded here as the live alternative rather than
a straw man.
