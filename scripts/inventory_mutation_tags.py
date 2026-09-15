#!/usr/bin/env python3
"""Inventory the mutation-class tags the product actually passes, by parsing call sites.

WHY THIS EXISTS (track refactor_surface_20260911, Phase 0). The mutation-class vocabulary —
the `klass` string every capture call carries so a failed undo names its class — has no single
declaration in the code (`spec.md` F-5), so any list of it is a hand-transcription. That list
was transcribed wrong TWICE in one session, the same way both times: enumerated from a FIXED
WORD LIST instead of measured per call site. The first pass said 11 tags; the "correction"
said 13; the measured answer is 14.

  missed by the first pass : 'layer-flag' (x3 sites) and "destructive"
  missed by the correction : "position" (js/properties_panel.js) and a second 'reparent' site
                             (js/dom/layer_manager.js:272)

The lesson is not "be careful" — it is that a vocabulary without a declaration cannot be
audited by reading, only by extraction. This script is that extraction, and it is deliberately
OVER-inclusive: it prints every short lowercase literal inside every capture call's arguments,
so the classification is done by reading the output rather than by matching a guess.

Consumers:
  * `vendor/conductor/tracks/refactor_surface_20260911/phase0_reverification.md` — the Phase 0 record.
  * Phase 3 of that track — the declaration (`MUTATION_CLASSES`) must be DERIVED from this
    output, and the guard test asserts the declaration still matches it. That is what makes a
    miss LOUD rather than silent. (This script is not infallible -- see KNOWN LIMITS below; the
    guard test, not this script, is the enforcement.)

Usage:  python scripts/inventory_mutation_tags.py [--json]
Exit:   0 always (this is an inventory, not a gate — Phase 3's guard test is the gate).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "js"

#: the seam names that carry a class tag, in the order the codebase introduced them
CALL_NAMES = ("captureUndo", "pushUndo", "pushMutation", "captureMutationNow", "beginMutation")

#: a tag is a short, lowercase, hyphen-tolerant bare literal. Deliberately loose: the point is
#: to surface CANDIDATES for a human read, not to decide what a tag is.
TAG_SHAPE = re.compile(r"[a-z][a-z0-9-]{0,13}")
#: `"x"`, `'x'` AND `` `x` `` — template literals are scanned too. A tag written as a template
#: literal would otherwise be invisible, which is exactly the silent-miss class this tool exists
#: to end (a named residual of the first version).
LITERAL = re.compile(r"""(["'`])((?:\\.|(?!\1).)*)\1""")

#: Call sites that legitimately take NO tag, keyed by CALL NAME (not by file:line — a
#: file:line-keyed map was the first version's bug: its keys read "persistence.js:377" while
#: the lookup used "js/persistence.js:377", so every entry was dead code and the sites it was
#: meant to classify fell through to UNCLASSIFIED. Deleting the mechanism removes the bug class,
#: because UNCLASSIFIED is in fact the CORRECT bucket for the sites that map listed: a call that
#: forwards a `klass` it was given is one whose tag this tool genuinely cannot see.
NON_SITE_CALL_NAMES = {"beginMutation": "takes a snapshot; a tag site passes it to pushMutation"}

#: Candidate literals that are NOT tags, each with the reason — kept here rather than subtracted
#: silently so the count is reproducible and the judgement is auditable. Every entry must name
#: the site it applies to: a bare word in this map would be the same guess-the-word-list failure
#: this script exists to replace.
NON_TAGS: dict[str, str] = {
    "element": (
        "js/properties_panel.js:226 — the LABEL's fallback inside a nested expression "
        "(`wrapper.dataset.title || wrapper.id || \"element\"`), not a class tag. The tag at "
        "that call is \"position\", the next argument."
    ),
}


def is_tag(candidate: str, where: str) -> tuple[bool, str]:
    """Is this candidate a class tag at this SITE? Returns (verdict, reason).

    The exclusion is matched on the FULL `file:line` (and the named word), not on the file alone:
    keying it on the file would silently exclude a legitimate future `"element"` tag anywhere in
    properties_panel.js, which is the same "a rule that fires on the wrong shape" family this file
    has already had to fix three times. Falsified by reading: removing `:226` from the key makes
    the exclusion stop applying at that site.
    """
    for word, reason in NON_TAGS.items():
        if candidate == word and where in reason:
            return False, reason
    return True, ""


#: The declaration that owns the vocabulary (track refactor_surface_20260911, Phase 3, AC-3).
#: The module that OWNS the stack owns the vocabulary beside it. Phase 4 (AC-4) moved both from
#: js/persistence.js to js/undo.js, and this pointer follows them.
DECLARATION_FILE = JS / "undo.js"
#: `KEY: "value"` entries inside `const MUTATION_CLASSES = Object.freeze({ ... })`.
DECLARATION_BLOCK = re.compile(r"const\s+MUTATION_CLASSES\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)")
DECLARATION_ENTRY = re.compile(r"""([A-Z][A-Z0-9_]*)\s*:\s*(["'])([a-z][a-z0-9-]{0,13})\2""")
#: A REFERENCE to the declaration inside a call's arguments: `window.MUTATION_CLASSES.ROTATE`
#: or `MUTATION_CLASSES["rotate"]`.
REFERENCE = re.compile(
    r"""\b(?:window\.)?MUTATION_CLASSES\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*["']([^"']+)["']\s*\])"""
)


def declaration() -> dict[str, str]:
    """The declared `KEY -> tag` map, READ FROM THE SOURCE rather than re-declared here.

    This is what makes the chain single-sourced: the product's declaration IS the vocabulary, the
    tool resolves call sites THROUGH it, and the guard test asserts the two still agree. A
    declaration this script cannot parse yields an empty map, which the text report names loudly and
    the guard test fails on — never a silent empty vocabulary.
    """
    src = DECLARATION_FILE.read_text(encoding="utf-8", errors="replace")
    block = DECLARATION_BLOCK.search(src)
    if not block:
        return {}
    return {key: value for key, _, value in DECLARATION_ENTRY.findall(block.group(1))}


def _call_args(src: str, open_idx: int) -> tuple[str, int]:
    """`(balanced argument text, index just past the closing ')')` for a call at `open_idx`.

    Balance is tracked with string state so a `)` inside a label (or inside a nested arrow /
    default parameter) cannot terminate the scan early — the bug that makes a naive
    `src.find(")")` misjudge a definition (`pushMutation(mut, fn = () => {}, klass) {`) and, in
    an earlier revision of this file, miscount it as a call site.
    """
    depth, j, in_str, quote = 1, open_idx + 1, False, ""
    while j < len(src):
        c = src[j]
        if in_str:
            if c == "\\":
                j += 2
                continue
            if c == quote:
                in_str = False
        elif c in "\"'`":
            in_str, quote = True, c
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return src[open_idx + 1:j], j + 1
        j += 1
    return src[open_idx + 1:], len(src)


def _is_definition(src: str, name: str, name_start: int, open_idx: int) -> bool:
    """Is this occurrence a DEFINITION rather than a call?

    Both shapes exist in this tree and both must be skipped, or the scan counts a definition as
    a call site (the bug the fifth review found — `js/dom/layer_manager.js:1443 beginMutation(snap) {`
    and `:1455 pushMutation(mut, label, klass, repair) {` were being counted):

        function pushUndo(before, label, klass) {        <- declaration
        async function captureUndo(label, klass) {       <- async declaration
            pushMutation(mut, label, klass, repair) {    <- indented CLASS METHOD

    A definition is "only whitespace, optionally `async ` and/or `function `, precedes the name on
    its line, and the BALANCED argument list is closed by `{`". The balance comes from `_call_args`
    rather than `src.find(")")`, because a default parameter or a nested arrow can contain a `)`
    (`pushMutation(mut, fn = () => {}, klass) {`) and a naive find would then misjudge the shape —
    the same defect class, twice fixed, so it is fixed at the source now.
    """
    line_start = src.rfind("\n", 0, name_start) + 1
    if not re.fullmatch(r"\s*(?:async\s+)?(?:function\s+)?", src[line_start:name_start]):
        return False                      # `this.`, `window.`, `return `, `= ` — a call
    _, after = _call_args(src, open_idx)
    return src[after:].lstrip().startswith("{")


def calls() -> list[dict]:
    """Every capture CALL in product source, with its candidate tag literals."""
    out: list[dict] = []
    for path in sorted(JS.rglob("*.js")):
        rel = str(path.relative_to(ROOT)).replace("\\", "/")
        src = path.read_text(encoding="utf-8", errors="replace")
        for name in CALL_NAMES:
            for m in re.finditer(r"\b" + name + r"\s*\(", src):
                if _is_definition(src, name, m.start(), m.end() - 1):
                    continue
                args, _ = _call_args(src, m.end() - 1)
                out.append({
                    "file": rel,
                    "line": src[:m.start()].count("\n") + 1,
                    "call": name,
                    "args": re.sub(r"\s+", " ", args).strip(),
                    "candidates": [v for _, v in LITERAL.findall(args)
                                   if TAG_SHAPE.fullmatch(v)],
                })
    return out


def inventory() -> dict:
    """The tag -> sites map, plus the derived counts. Exclusions and non-sites are reported."""
    declared = declaration()
    sites: dict[str, list[str]] = {}
    excluded: dict[str, str] = {}
    unclassified: list[str] = []
    non_sites: dict[str, str] = {}
    #: AC-3's fail condition, made a REPORTED bucket rather than a reading exercise: a tag written
    #: as a bare literal at a class-bearing call site instead of a reference to the declaration.
    bare_literals: dict[str, str] = {}
    #: A reference to a KEY the declaration does not contain (a typo, or a map edited without its
    #: site). Resolved against the declaration, so this cannot be silently folded into "unknown".
    unknown_references: dict[str, str] = {}
    for c in calls():
        where = "%s:%d" % (c["file"], c["line"])
        if c["call"] in NON_SITE_CALL_NAMES:
            non_sites[where] = NON_SITE_CALL_NAMES[c["call"]]
            continue
        # REFERENCES FIRST: they are what the sites use since Phase 3, and a call carrying BOTH a
        # reference and a leftover literal must report the literal rather than choose silently.
        refs = REFERENCE.findall(c["args"])
        resolved = []
        for dotted, bracketed in refs:
            key = dotted or bracketed
            if key in declared:
                resolved.append(declared[key])
            else:
                unknown_references[where + " ref " + key] = (
                    "the call references MUTATION_CLASSES." + key + " but the declaration has no "
                    "such key (declared keys: " + ", ".join(sorted(declared)) + ")"
                )
        if resolved:
            for tag in resolved:
                if where not in sites.setdefault(tag, []):
                    sites[tag].append(where)
            for tag in c["candidates"]:
                ok, reason = is_tag(tag, where)
                if ok:
                    bare_literals[where + " " + repr(tag)] = (
                        "a bare tag literal at a class-bearing call site \u2014 AC-3 requires the site "
                        "to reference MUTATION_CLASSES instead"
                    )
                else:
                    excluded["%s @ %s" % (tag, where)] = reason
            continue
        if not c["candidates"]:
            # No tag-shaped literal at all. For a TAG-bearing call this is the dangerous case:
            # the tag is FORWARDED from a caller or computed (a variable, a concatenation, a
            # template with an expression), so this tool cannot see it. Reported rather than
            # silently skipped — every call lands in exactly one of tag site / unclassified /
            # non-site, which is why the three counts add up and are printed.
            unclassified.append("%s (%s) args: %s" % (where, c["call"], c["args"][:70]))
            continue
        for tag in c["candidates"]:
            ok, reason = is_tag(tag, where)
            if ok:
                bare_literals[where + " " + repr(tag)] = (
                    "a bare tag literal with NO MUTATION_CLASSES reference at this call site"
                )
            else:
                excluded["%s @ %s" % (tag, where)] = reason
    files = sorted({s.split(":")[0] for v in sites.values() for s in v})
    scanned = len(calls())
    bucketed = (
        sum(len(v) for v in sites.values())
        + len(unclassified)
        + len(non_sites)
        + len(bare_literals)
        + len(unknown_references)
    )
    return {
        "declaration": declared,
        "declaration_file": str(DECLARATION_FILE.relative_to(ROOT)).replace("\\", "/"),
        "tags": {t: sites[t] for t in sorted(sites)},
        "bare_literal_tags": bare_literals,
        "unknown_references": unknown_references,
        "tag_count": len(sites),
        "site_count": sum(len(v) for v in sites.values()),
        "file_count": len(files),
        "files": files,
        "excluded_candidates": excluded,
        "non_site_calls": non_sites,
        "unclassified_calls": unclassified,
        # call_site_count is the number of calls the SCAN returned, NOT the sum of the buckets —
        # taking the sum would make the totals agree by construction and hide a call that was
        # double-counted or dropped. `unbucketed` names any such discrepancy instead.
        "call_site_count": scanned,
        "unbucketed_calls": scanned - bucketed,
    }


def main(argv: list[str]) -> int:
    inv = inventory()
    if "--json" in argv:
        print(json.dumps(inv, indent=2))
        return 0
    print("mutation-tag inventory @ %s" % ROOT)
    print("")
    print("%-14s %s" % ("TAG", "SITES"))
    for tag, where in inv["tags"].items():
        print("%-14s %s" % (tag, ", ".join(where)))
    print("")
    print("=> %d tags / %d sites / %d files" % (
        inv["tag_count"], inv["site_count"], inv["file_count"]))
    print("   of %d capture/push call sites seen: %d carry a tag (by REFERENCE to the"
          % (inv["call_site_count"], inv["site_count"]))
    print("   declaration since Phase 3), %d forward or compute their tag (invisible to this"
          % len(inv["unclassified_calls"]))
    print("   tool), %d take no tag" % len(inv["non_site_calls"]))
    if inv["unbucketed_calls"]:
        # The buckets are asserted to COVER the scan, not defined to: a discrepancy means a call
        # was double-counted (more buckets than calls) or dropped (fewer), which is the
        # silent-arithmetic class this tool exists to prevent.
        if inv["unbucketed_calls"] > 0:
            print("   ** WARNING: %d scanned call(s) fell into NO bucket — a call was dropped **"
                  % inv["unbucketed_calls"])
        else:
            print("   ** WARNING: the buckets exceed the scan by %d — a call was double-counted"
                  % -inv["unbucketed_calls"])
            print("      (most likely one call carrying two tag literals) — the totals do NOT add up **")
    else:
        print("   (the buckets cover every scanned call — nothing unaccounted for)")
    for f in inv["files"]:
        print("   %s" % f)
    print("   declared in %s: %d key(s) -> %s"
          % (inv["declaration_file"], len(inv["declaration"]),
             ", ".join(sorted(inv["declaration"].values()))
             or "(NONE \u2014 the declaration did not parse, which is itself a failure)"))
    if inv["bare_literal_tags"]:
        print("")
        print("** BARE TAG LITERALS \u2014 AC-3 FAILURES: a class-bearing site writes a literal instead")
        print("   of referencing MUTATION_CLASSES. Every entry here is a defect, not a variant: **")
        for key in inv["bare_literal_tags"]:
            print("   %s" % key)
    if inv["unknown_references"]:
        print("")
        print("** UNKNOWN REFERENCES \u2014 the site names a KEY the declaration does not contain: **")
        for key, reason in inv["unknown_references"].items():
            print("   %s" % key)
            print("      %s" % reason)
    if inv["excluded_candidates"]:
        print("")
        print("EXCLUDED candidates (short literal in tag position but not a class tag):")
        for key, reason in inv["excluded_candidates"].items():
            print("   %s" % key)
            print("      %s" % reason)
    if inv["unclassified_calls"]:
        print("")
        print("UNCLASSIFIED calls — no tag-shaped literal, so the tag is FORWARDED from a caller or")
        print("computed and this tool cannot see it. Each needs a read; do not assume it has no tag:")
        for site in inv["unclassified_calls"]:
            print("   %s" % site)
        print("   (in this tree all of them are helper internals that forward a `klass` they were")
        print("    given — including the duplicate pair's body, which is F-2's footprint)")
    if inv["non_site_calls"]:
        print("")
        print("NON-SITE calls (considered and excluded by name, so nothing is skipped silently):")
        for site, reason in inv["non_site_calls"].items():
            print("   %-22s %s" % (site, reason))
    print("")
    print("KNOWN LIMITS, stated rather than discovered later — a scan only sees the shapes it is")
    print("written for, so these are blind spots rather than a claim of completeness: (1) a tag")
    print("passed as a VARIABLE or built by concatenation is invisible — the UNCLASSIFIED list")
    print("above is where that surfaces; (2) only js/ is scanned; (3) template-literal tags ARE")
    print("scanned; (4) a seam name with a COMMENT between it and its '(' is not matched at all")
    print("(neither counted nor listed); (5) an arrow function assigned to a const named for a")
    print("seam is not matched; (6) an object-literal method sharing its line with other text is")
    print("classified as a call; (7) `_call_args` models strings but NOT comments or regex")
    print("literals, so a ')' inside one of those within an argument list would still end the scan")
    print("early; (8) a `static`/`get`/generator method named for a seam would be misclassified as")
    print("a call (the prefix admits only `async `/`function `); (9) a call whose tag literals are")
    print("ALL excluded candidates would land in no bucket and trip the false 'a call was dropped'")
    print("warning — a LOUD failure by construction, not a silent one. This is why Phase 3's guard")
    print("test, not this script, is the enforcement.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
