/**
 * AC-2's critical-assumption falsifier, made DURABLE (track ux_quick_wins_20261025,
 * Phase 4).
 *
 * WHY THIS IS A TEST AND NOT A PROBE. The adopted candidate
 * (`deliberation/candidate_inline_variant_tokens.md`) is conditional on one claim:
 *
 *   "The frozen border corpus SVGs use stroke-based geometry that responds to
 *    `stroke-width` and `stroke-dasharray` modifications. Sample inspection of the
 *    corpus required before committing."
 *
 * That claim was first measured with a throwaway script under `temp/scratch/`, and the
 * housekeeping guard correctly flagged the plan for resting on a scratch citation: a
 * `temp/` probe is deleted the moment it has been used, so a record that cites one can
 * never be re-checked. A premise a DESIGN DECISION rests on has to be re-runnable, so it
 * lives here — `npm test` re-measures it on every run, and a corpus that gains a fill-only
 * design fails this file by name instead of silently invalidating the UI.
 *
 * WHAT IT PINS: which designs a client-side weight/style transform can actually reach,
 * and the two it cannot. It asserts the MEASURED split (9 of 11) rather than "some designs
 * are adjustable", because the number is the thing the Phase 4 decision turns on.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const CORPUS = path.join(ROOT, "test", "fixtures", "byok_border_corpus.json");

/** The constructs a client-side `stroke-width`/`stroke-dasharray` transform must cope with. */
function inspect(svg) {
  const count = (re) => (svg.match(re) || []).length;
  const strokes = count(/stroke-width\s*=/g);
  const styleAttrs = count(/\sstyle\s*=/g);
  const risk = [];
  if (count(/<filter\b/g)) risk.push("filter");
  if (count(/<mask\b/g)) risk.push("mask");
  if (count(/<pattern\b/g)) risk.push("pattern");
  if (styleAttrs) risk.push("style-attr");
  return {
    strokes,
    dashes: count(/stroke-dasharray\s*=/g),
    risk,
    // Reachable = something carries an explicit stroke-width AND nothing makes a blind
    // transform unsafe (a filter/mask/pattern subtree would be scaled/stroked wrongly).
    adjustable: strokes > 0 && risk.length === 0,
  };
}

function readDesigns() {
  const corpus = JSON.parse(fs.readFileSync(CORPUS, "utf8"));
  return corpus.designs || corpus;
}

describe("AC-2 premise — the border corpus is stroke-based enough for client-side refinement", function () {
  it("measures every design, and the corpus still exists with designs in it", function () {
    const designs = readDesigns();
    assert.ok(Array.isArray(designs) && designs.length > 0, "the frozen corpus carries designs");
    for (const d of designs) {
      const svg = (d.border && d.border.svg) || d.svg;
      assert.ok(
        typeof svg === "string" && svg.length > 0,
        `design ${d.id || d.title} carries an SVG string`,
      );
    }
  });

  it("marks exactly the stroke-bearing designs adjustable — MEASURED 9 of 11", function () {
    const rows = readDesigns().map((d) => {
      const svg = (d.border && d.border.svg) || d.svg || "";
      return { id: d.id || d.title || "(no id)", ...inspect(svg) };
    });
    const adjustable = rows.filter((r) => r.adjustable).map((r) => r.id);
    const notAdjustable = rows.filter((r) => !r.adjustable).map((r) => r.id);

    assert.strictEqual(rows.length, 11, "the frozen corpus holds 11 designs");
    assert.strictEqual(
      adjustable.length,
      9,
      `exactly 9 designs must be client-side adjustable; measured ${adjustable.length} ` +
        `(${adjustable.join(", ")})`,
    );
    // The two fill-only designs, named. If one of them becomes stroke-bearing (a corpus
    // regeneration), THIS assertion is what tells the next session the Phase-4 decision's
    // basis moved — never a silent change of premise.
    assert.deepStrictEqual(
      notAdjustable,
      ["08-flame-crest", "10-ink-brush"],
      `the fill-only designs must stay exactly these two; measured ${notAdjustable.join(", ")}`,
    );
  });

  it("the two fill-only designs really carry no stroke-width at all (the no-op proof)", function () {
    // The reason a weight/style control cannot work on them: with zero `stroke-width`
    // occurrences, a transform has no declaration to rewrite, and their ink is FILL.
    for (const id of ["08-flame-crest", "10-ink-brush"]) {
      const d = readDesigns().find((x) => (x.id || x.title) === id);
      assert.ok(d, `design ${id} is in the corpus`);
      const svg = (d.border && d.border.svg) || d.svg || "";
      assert.strictEqual(
        inspect(svg).strokes,
        0,
        `${id} must carry ZERO stroke-width occurrences (that is why a stroke transform is a no-op)`,
      );
      assert.ok(
        /fill\s*=/.test(svg),
        `${id} paints with fill, which is what a stroke transform cannot reach`,
      );
    }
  });
});
