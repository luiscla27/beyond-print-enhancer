#!/usr/bin/env python
"""byok_border_visual_seat.py — the Phase-4 VISUAL CHARTER driver (R2.17's third seat).

Runs the project's vision gate (`scripts/byok_vision_gate.py`, Muse Spark primary) once per
JUDGED CELL — the per-design native-scale images `scripts/byok_border_judged.js` emits — with a
focused brief per design, and writes one transcript per call plus a manifest of what ran.

WHY ONE CALL PER DESIGN (the round-23b defect this driver exists to prevent)
--------------------------------------------------------------------------
The first judged-cell builder packed three designs (one band) per image; the seat then answered
CONTRADICTORILY about the same design across its horizontal and rail images ("TOP band pixels
show uniform white field" on a band measuring 0.0202-0.7886 ink; rail answers arguing from
absent horizontal pixels). Instrument probes proved the emitted pixels byte-faithful
(192/192 slots), so the defect was legibility: a multi-design single-band image gives a
reviewer no way to know which strip is which edge. One design per image, all four edges, every
edge tagged, interior side marked in the pixels (see the builder's own header) — and one
REVIEWER CALL per image, so a verdict can never be about the wrong design.

The seat is ALWAYS HARD TO PLEASE (the gate's scope block is verbatim in `byok_vision_gate.py`):
a criterion is MET only when the shapes it names are visible in the pixels; a claim not backed
by pixels is NOT MET and the defect is named. Nothing in the brief asks for a softened verdict.

The aggregated binding verdict is NOT written here — it is filed by hand in the track
(`phase4_consultant_verification_visual_r2N.txt`), because aggregation is a judgement about
which lines are binding (canonical criteria vs variant closure vs the supplementary overview),
not a concatenation. This driver produces the EVIDENCE the aggregation cites.

This file promotes `temp/scratch/psc_seat_r23c.py` (the round-23c run's driver) to a tracked
script after the preparation charter named "the seat's re-run is one command only if the
gitignored scratch driver survives" as a re-runnability limitation (gate re-run 2026-10-01,
`phase4_consultant_verification_preparation_and_integration_r2.md` §0).

Usage:
  python scripts/byok_border_visual_seat.py [--round-dir <dir>] [--out <dir>] [--only <substr>]
  [--force]
  (defaults: the latest temp/visual_logs/byok_svg_borders_20260927/gallery-roundN with a
   judged-meta.json, and <round-dir>/seat/)

Round 24 added `--force` for the MANDATED RE-CONFIRMATION (operator instruction 2026-10-01):
when a design's verdict flips between rounds on a BYTE-IDENTICAL judged cell, that verdict is
not full evidence — the seat is stochastic even at temperature 0.0 — so it must reproduce
before anything is read off it (`temp/scratch/psc_hashrounds.py` proves the byte identity).
`--force` re-asks the same image the same brief WITHOUT touching the round's first transcript,
writing rep2/rep3 files beside it, so the first answer stays intact as evidence. It is also
what the diagnostic CHALLENGE uses (`--challenge <design> --points <file>`): the same seat, the
same pixels, plus the measured coordinates it is asked to falsify. The challenge is DIAGNOSTIC,
never persuasive — the seat is told in the brief that raising a score, softening, or agreeing
without the pixels is VOID and that its original verdict then stands.
"""
import argparse
import importlib.util
import json
import os
import sys
import time

# The verdicts are reviewer TEXT and legitimately contain characters outside cp1252 (≥, ×, —);
# a console that cannot ENCODE them must not kill a 24-call run after the transcript was already
# written (MEASURED: round-24 run crashed at cell 2 on '\\u2265' mid-print).
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
GATE = os.path.join(HERE, "byok_vision_gate.py")
TRACK_DIR = os.path.join(ROOT, "temp", "visual_logs", "byok_svg_borders_20260927")

HEADER = """# Judged native cell — ONE design, all four edges at 1:1 device pixels

This image is ONE design's JUDGED CELL from the shipped print pipeline of a printable D&D
character sheet. It is a binding artifact under operator ruling D-A: the per-design
native-scale cell IS the judged artifact (deviceScaleFactor 2, nothing resized, nothing
downsampled).

## Reading the image

The image carries, top to bottom:

1. a caption block (design id, the criterion VERBATIM, the geometry, and the reading order);
2. the `TOP edge band` — the painted band that sits UNDER the section's top edge, full
   section width, %(bandpx)d device px deep, at 1:1;
3. the `BOTTOM edge band` — the band that sits OVER the section's bottom edge, same depth;
4. the `LEFT edge` rail, then the `RIGHT edge` rail — each the rail's own pixels, UNSLICED,
   cut into 2-3 segments printed side by side (the leftmost segment is the top of the rail;
   consecutive segments overlap by 96 device px);
5. the `CORNERS` row — the four boxes at the section's own four corners (TL, TR, BL, BR,
   printed left to right), 28x28 CSS px each at the same 1:1 scale.

READ THE WHOLE IMAGE BEFORE ANSWERING. Some bands of a design are genuinely blank — the
criterion decides what counts, not the ink; a band carrying only a faint line is not "blank",
and "blank" is a word about pixels that are WHITE, not about pixels that are grey.

EVERY strip has a %(mark)s MARKER BAR printed BESIDE it (never over it, so no judged pixel is
covered): that bar is on the side of the strip that faces the section's CENTRE. "The ornament
points inward" therefore means "toward the marker bar". The blank field on the other side of a
strip is the page outside the section — an ornament that stops short of the section edge is
NOT a defect the criterion names; an ornament with no pixels at all is.

The painted band runs from 16 CSS px OUTSIDE the section edge to 12 CSS px inside it (the
product's own `border-image-outset: 16px` / `border-image-width: 28px`); the strip is exactly
that band, so the section edge is 32 device px from the OUTER end of each strip (the end away
from the marker bar) and the paint continues 24 device px past it toward the marker.

## Your verdict

You are the VISUAL CHARTER and you are ALWAYS HARD TO PLEASE: a criterion is MET only when the
shapes it names are actually visible in these pixels; a claim not backed by pixels is NOT MET,
and you name the defect you can see. Nothing here asks you to soften a verdict — a FAIL is as
acceptable as a PASS.

Answer with exactly %(critcount)d line(s) in this format, then stop:

    CRITERION %(label)s: MET | NOT MET - <one-line pixel justification>

%(critlead)s

Then, on the FINAL line, alone:

    VISUAL VERDICT: PASS | FAIL

PASS only if %(passcond)s. Nothing else follows that line.
"""

CANON_EXTRA = """Also answer this acceptance line about the SAME pixels (it is the ring-coherence
line for the whole corpus, and it is judged on the native cells, never on a downsample):

    CRITERION AC-V1-c: MET | NOT MET - <one-line pixel justification>

AC-V1-c: the border survives at the judged native scale as a coherent ring — no
dashed/broken artefact introduced by the RENDER PATH itself, distinct from the artwork's own
style. A dash or gap that the frozen source drawing itself contains is the ARCHITECTURE's own
style and does NOT make this line NOT MET; say so explicitly when that is what you see. What
does make it NOT MET is geometry that is present in the source but arrives fragmented,
offset, or absent in the pixels.

"""

VARIANT_EXTRA = """This design is a SUPERSEDED variant, so it has NO criterion. Judge only this:
its cell shows a border ring CLOSED around the section rect (paint present along all four
edges, no gap that would leave the ring open). Say which edge is open if one is.

"""


def latest_round_dir():
    """The most recent gallery-roundN directory that carries a judged-meta.json."""
    if not os.path.isdir(TRACK_DIR):
        raise SystemExit("no gallery rounds under " + TRACK_DIR + " — run the gallery capture first")
    rounds = []
    for name in os.listdir(TRACK_DIR):
        if name.startswith("gallery-round") and os.path.isfile(
                os.path.join(TRACK_DIR, name, "judged-meta.json")):
            try:
                rounds.append((int(name[len("gallery-round"):]), os.path.join(TRACK_DIR, name)))
            except ValueError:
                continue
    if not rounds:
        raise SystemExit("no gallery-roundN with judged-meta.json under " + TRACK_DIR)
    return max(rounds)[1]


def build_brief(img, challenge_points=None):
    if challenge_points is not None:
        return challenge_points
    extra = CANON_EXTRA if not img["variant"] else VARIANT_EXTRA
    critlines = 1 + (1 if not img["variant"] else 0)
    return HEADER % {
        "bandpx": 56,
        "mark": "#ffd27f",
        "label": img["label"],
        "critcount": critlines,
        "critlead": extra,
        "passcond": ("the criterion above is MET" if not img["variant"]
                     else "the closed-ring line above is MET"),
    }


def main():
    ap = argparse.ArgumentParser(description="Phase-4 visual charter driver (one Muse call per judged cell)")
    ap.add_argument("--round-dir", default=None, help="gallery round directory (default: latest with judged-meta.json)")
    ap.add_argument("--out", default=None, help="transcript directory (default: <round-dir>/seat)")
    ap.add_argument("--only", default="", help="only images whose file name contains this substring")
    ap.add_argument("--force", action="store_true",
                    help="re-ask even a cached cell, writing repN files BESIDE the first transcript "
                         "(mandated re-confirmation of a verdict that flipped on identical pixels)")
    ap.add_argument("--reps", type=int, default=1,
                    help="with --force: how many repeats of the same call to write (rep2, rep3, ...)")
    ap.add_argument("--challenge", default="",
                    help="with --force: judge this design against the verbatim brief in --points "
                         "instead of its own brief (diagnostic challenge of a filed verdict)")
    ap.add_argument("--points", default="", help="the challenge brief file (verbatim, used as-is)")
    args = ap.parse_args()

    round_dir = os.path.abspath(args.round_dir) if args.round_dir else latest_round_dir()
    meta_path = os.path.join(round_dir, "judged-meta.json")
    if not os.path.isfile(meta_path):
        raise SystemExit("no judged-meta.json in " + round_dir + " — run scripts/byok_border_judged.js first")
    out_dir = os.path.abspath(args.out) if args.out else os.path.join(round_dir, "seat")
    brief_dir = os.path.join(out_dir, "briefs")
    os.makedirs(brief_dir, exist_ok=True)

    challenge_text = None
    if args.challenge:
        if not args.points or not os.path.isfile(args.points):
            raise SystemExit("--challenge needs --points <file> with the verbatim challenge brief")
        challenge_text = open(args.points, encoding="utf-8").read()

    meta = json.load(open(meta_path, encoding="utf-8"))
    spec = importlib.util.spec_from_file_location("byok_vision_gate", GATE)
    gate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gate)

    todo = [i for i in meta["images"] if args.only in i["file"]]
    if args.challenge:
        todo = [i for i in todo if args.challenge in i["file"] or args.challenge == i["label"]]
        if not todo:
            raise SystemExit("--challenge %r matched no image in %s" % (args.challenge, round_dir))
    print("visual seat: %d image(s) from %s%s" % (
        len(todo), round_dir, " [FORCED]" if args.force else ""))
    for n, img in enumerate(todo, 1):
        base = os.path.join(out_dir, "seat_" + img["file"].replace(".png", ""))
        out = base + ".txt"
        if os.path.isfile(out) and os.path.getsize(out) > 0 and not args.force:
            print("[%d/%d] cached %s" % (n, len(todo), img["file"]))
            continue
        if challenge_text is not None:
            brief = os.path.join(brief_dir, img["file"].replace(".png", "") + "-challenge.md")
            with open(brief, "w", encoding="utf-8") as f:
                f.write(challenge_text)
        else:
            brief = os.path.join(brief_dir, img["file"].replace(".png", ".md"))
            with open(brief, "w", encoding="utf-8") as f:
                f.write(build_brief(img))
        targets = [out] if not (args.force and challenge_text is None) else \
            [base + "_rep%d.txt" % r for r in range(2, 2 + max(1, args.reps))]
        for out_path in targets:
            if os.path.isfile(out_path) and os.path.getsize(out_path) > 0 and args.force:
                print("[%d/%d] cached %s" % (n, len(todo), os.path.basename(out_path)))
                continue
            print("[%d/%d] %s -> %s" % (n, len(todo), img["file"], os.path.basename(out_path)))
            verdict = None
            for attempt in (1, 2):
                try:
                    verdict = gate.dispatch(gate.REVIEWERS["muse"],
                                            os.path.join(round_dir, img["file"]), brief)
                    break
                except Exception as exc:            # noqa: BLE001 — outage: retry once, then fail loudly
                    print("   attempt %d failed: %s" % (attempt, exc))
                    if attempt == 2:
                        raise
                    time.sleep(5)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(verdict)
            print("   " + verdict.strip().replace("\n", "\n   "))
    print("transcripts under " + out_dir)


if __name__ == "__main__":
    main()
