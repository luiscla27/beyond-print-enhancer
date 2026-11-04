"""WCAG 2.1 relative-luminance / contrast audit of the CURRENT locked palette (js/ui_theme.js TOKENS).

Read-only probe used by the orchestrator to give the BEYOND-11 phase an accurate starting fact:
does the EXISTING theme already clear 4.5:1 on its stated text pairings, or is the card's AC-2
("all UI elements meet WCAG 2.1 AA in high contrast mode") partly a defect of the base theme?
"""
import re
import sys
from pathlib import Path

ROOT = Path(r"C:\luiscla27\projects\dndbeyond-printenhance")
src = (ROOT / "js/ui_theme.js").read_text(encoding="utf-8")
block = src[src.index("const TOKENS = {"): src.index("const TIERS =")]
tokens = dict(re.findall(r'(\w+):\s*"(#[0-9A-Fa-f]{6})"', block))
print(f"{len(tokens)} color tokens parsed")


def lum(hexstr):
    r, g, b = (int(hexstr[i:i + 2], 16) / 255 for i in (1, 3, 5))

    def f(c):
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


GROUNDS = ["groundPanel", "groundTray", "groundWell", "groundModal"]
TEXTS = ["bone", "boneDim", "taupe", "taupeFaint", "gold", "goldHi", "ember", "goldShadow"]
pairs = []
for t in TEXTS:
    for g in GROUNDS:
        if t in tokens and g in tokens:
            pairs.append((t, g, ratio(tokens[t], tokens[g])))

pairs.sort(key=lambda p: p[2])
print("\nLOWEST text-on-ground ratios (AA text needs >= 4.5, large text >= 3.0):")
for t, g, r in pairs[:14]:
    verdict = "PASS" if r >= 4.5 else ("large-only" if r >= 3.0 else "FAIL")
    print(f"  {t:12s} on {g:12s} = {r:5.2f}:1  {verdict}")

fails = [p for p in pairs if p[2] < 4.5]
print(f"\n{len(fails)} of {len(pairs)} text/ground pairs are below 4.5:1 in the BASE theme")

# A high-contrast candidate: pure values already in (or absent from) the palette.
print("\nCandidate high-contrast readings against the darkest ground (groundWell):")
for name, hx in (("pure white", "#FFFFFF"), ("near-white bone", "#E9DDC2"),
                 ("gold-hi", tokens.get("goldHi", "?"))):
    print(f"  {name:14s} {hx} on groundWell = {ratio(hx, tokens['groundWell']):5.2f}:1")
sys.exit(0)
