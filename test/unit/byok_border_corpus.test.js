/**
 * byok_border_corpus.test.js — the FROZEN border-design corpus (track
 * `byok_svg_borders_20260927`, Phase 4).
 *
 * WHY THIS SUITE EXISTS
 * ---------------------
 * The AC-V1 visual gate renders real model output through the product's own choke point and asks
 * a reviewer to judge pixels. That gate is only meaningful if its INPUT is the same on every run.
 * The generator's leg is a free, community-rate-limited model: MEASURED, the same 12 instructions
 * were accepted 6/12, 2/6, 4/4, 5/5, 1/3, 2/2 across rounds 1..4c while the corpus file did not
 * change. A gate fed from that leg cannot tell "the render path stopped drawing left/right rules"
 * from "the model answered differently this minute".
 *
 * So the accepted bytes are frozen into `test/fixtures/byok_border_corpus.json` and this suite is
 * the fence around it. Four independent properties, each of which was FALSE at least once while
 * this fixture was being built:
 *
 *  1. BYTE REPRODUCIBILITY — `node scripts/freeze_border_corpus.js` over the same round files
 *     produces the identical file. (Catches a fixture hand-edited to make a red frame go green.)
 *  2. REJECTED OUTPUT IS NOT IN THE CORPUS — the fixture holds exactly the designs the product's
 *     OWN trust root accepts, and re-validating every frozen blob returns `ok: true`. (Catches a
 *     fixture that froze a blob the sanitizer refuses, which would render nothing and read as a
 *     product render bug.)
 *  3. THE MERGE RULE IS LAST-ACCEPTED-WINS, IN GENERATION ORDER — `4b` sorts after `4`, not
 *     before it as a string; MEASURED, the twelve canonical blobs are byte-identical to the
 *     generator's own `designs-merged.json` (12/12) and a naive string sort breaks that for
 *     `05-celestial-arcs`. (Catches the ordering bug that silently swaps the frozen blob.)
 *  4. THE CORPUS IS THE INPUT THE GALLERY ACTUALLY READS — the spec's default path is the
 *     fixture, not the generator's non-deterministic run directory. (Catches a spec that quietly
 *     keeps reading `temp/`, where the bytes can change under it.)
 *
 * The corpus is the VISUAL gate's input, so its sha256 list is asserted as a whole: adding,
 * removing or re-spelling any design must be a deliberate, reviewed change to this file.
 */
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const FIXTURE = path.join(ROOT, "test", "fixtures", "byok_border_corpus.json");
const GENERATOR = path.join(ROOT, "scripts", "freeze_border_corpus.js");

const freeze = require("../../scripts/freeze_border_corpus.js");
const AiLayout = require("../../js/ai_layout.js");

const corpus = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));

/** jsdom-free validation: `validateSvg` needs a DOMParser, which the unit setup provides. */
const validateSvg = AiLayout.validateSvg;

describe("BYOK border corpus — the frozen input the visual gate renders", function () {
  it("carries the whole corpus: 12 canonical designs plus the 8 superseded variants", function () {
    assert.strictEqual(corpus.designs.length, 12, "canonical design count changed");
    assert.strictEqual(corpus.variants.length, 8, "superseded-variant count changed");
    // 20 = every accepted blob the live generator ever produced; the prompt corpus has 12 ids.
    assert.strictEqual(
      corpus.designs.length + corpus.variants.length,
      20,
      "the frozen corpus must account for all 20 accepted blobs",
    );
    const ids = corpus.designs.map((d) => d.id).sort();
    assert.deepStrictEqual(ids, [
      "01-gilded-frame", "02-runic-band", "03-thornvine", "04-dragon-scale",
      "05-celestial-arcs", "06-chainmail", "07-corner-arcs", "08-flame-crest",
      "09-frost-shards", "10-ink-brush", "11-starlit-void", "12-knotwork",
    ]);
  });

  it("every frozen blob is ACCEPTED by the product's own trust root", function () {
    const rejected = [];
    for (const d of corpus.designs.concat(corpus.variants)) {
      const verdict = validateSvg(d.svg);
      if (!verdict || verdict.ok !== true) {
        rejected.push(d.id + " (" + ((verdict && verdict.error) || "no verdict") + ")");
      }
    }
    assert.deepStrictEqual(
      rejected,
      [],
      "the corpus froze designs the sanitizer REFUSES; they would render nothing and look like a " +
        "render-path bug: " + rejected.join(", "),
    );
  });

  it("every frozen blob carries a viewBox and its recorded sha256 matches its bytes", function () {
    for (const d of corpus.designs.concat(corpus.variants)) {
      assert.ok(/viewBox\s*=/i.test(d.svg), d.id + " has no viewBox — the trust root would refuse it");
      const actual = crypto.createHash("sha256").update(d.svg, "utf8").digest("hex");
      assert.strictEqual(actual, d.sha256, d.id + ": recorded sha256 does not match the frozen bytes");
      assert.strictEqual(d.svg.length, d.svgChars, d.id + ": svgChars does not match the string length");
    }
  });

  it("carries 20 DISTINCT accepted blobs — no variant is a duplicate of a canonical design", function () {
    // MEASURED DEFECT, FIXED 2026-10-01. `buildCorpus` used to push the INCOMING design as the
    // "superseded variant" instead of the one it replaced, so all 8 variants were byte-identical to
    // their own winner: the corpus asserted "every accepted blob the generator ever produced" while
    // holding 12 distinct strings, and a gate that renders the corpus would have rendered 12
    // artworks twice and reported 20. Counting rows cannot catch that — only distinctness can.
    const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
    const all = corpus.designs.concat(corpus.variants);
    const seen = new Map();
    const collisions = [];
    for (const d of all) {
      const h = sha(d.svg);
      if (seen.has(h)) collisions.push(seen.get(h) + " == " + d.id + "@" + d.round);
      else seen.set(h, d.id + "@" + d.round);
    }
    assert.deepStrictEqual(
      collisions,
      [],
      "the frozen corpus holds duplicate blobs (a variant recorded its own winner's bytes): " +
        collisions.join(", "),
    );
    assert.strictEqual(seen.size, 20, "distinct blob count is not 20: " + seen.size);
  });

  it("attributes each superseded variant to the round it was SUPERSEDED BY, not to itself", function () {
    for (const v of corpus.variants) {
      assert.notStrictEqual(
        v.supersededByRound,
        v.round,
        v.id + ": a variant cannot be superseded by the round it came from",
      );
      const winner = corpus.designs.find((d) => d.id === v.id);
      assert.ok(winner, v.id + ": a variant with no canonical design");
      assert.strictEqual(v.supersededByRound, winner.round, v.id + ": supersededByRound is wrong");
      // And the variant really is a DIFFERENT blob from the winner.
      assert.notStrictEqual(v.svg, winner.svg, v.id + ": the variant IS the winner's bytes");
      assert.ok(
        v.svgChars < winner.svgChars || v.svgChars !== winner.svgChars,
        v.id + ": variant and winner have the same length — suspicious for a superseded blob",
      );
    }
  });

  it("is byte-reproducible: a fresh freeze over the round files equals the fixture", function () {
    // The generator's own run directory is the SOURCE of the fixture. It is `temp/` (ignored),
    // so a machine that has never run the generator cannot re-freeze — that is a skip, not a
    // failure, and the fixture itself stays the authority.
    const dir = freeze.DEFAULT_FROM;
    if (!fs.existsSync(dir)) this.skip();

    const { designs, variants } = freeze.buildCorpus(dir);
    assert.strictEqual(designs.length, corpus.designs.length, "a fresh freeze yields a different design count");
    assert.strictEqual(variants.length, corpus.variants.length, "a fresh freeze yields a different variant count");
    for (let i = 0; i < designs.length; i++) {
      assert.strictEqual(designs[i].id, corpus.designs[i].id, "design order differs at index " + i);
      assert.strictEqual(
        designs[i].sha256,
        corpus.designs[i].sha256,
        designs[i].id + ": a fresh freeze produced different bytes than the fixture",
      );
    }

    // And the same check through the CLI's own `--check` path, so the shipping command is covered
    // and not just the library function it shares an implementation with.
    const out = path.join(os.tmpdir(), "be-corpus-check-" + process.pid + ".json");
    try {
      execFileSync(process.execPath, [GENERATOR, "--out", out], { cwd: ROOT, stdio: "pipe" });
      assert.strictEqual(
        fs.readFileSync(out, "utf8"),
        fs.readFileSync(FIXTURE, "utf8"),
        "the CLI's freeze output differs from the committed fixture",
      );
    } finally {
      if (fs.existsSync(out)) fs.unlinkSync(out);
    }
  });

  it("uses LAST-accepted-wins in generation order, not a naive string sort of the round names", function () {
    // `4b` < `4` as strings. If the freeze sorted names lexicographically, `05-celestial-arcs`
    // would carry its ROUND-1 blob (1447 chars) instead of its ROUND-4b blob (1070).
    const byId = {};
    for (const d of corpus.designs) byId[d.id] = d;
    assert.strictEqual(byId["05-celestial-arcs"].round, "4b", "05-celestial-arcs must come from round 4b");
    assert.strictEqual(byId["03-thornvine"].round, "4c", "03-thornvine must come from round 4c");
    assert.strictEqual(byId["04-dragon-scale"].round, "4c", "04-dragon-scale must come from round 4c");
    assert.strictEqual(byId["01-gilded-frame"].round, "1", "01-gilded-frame was only ever accepted in round 1");
    assert.strictEqual(byId["06-chainmail"].round, "3", "06-chainmail was only ever accepted in round 3");

    // The round order itself, pinned as data.
    assert.deepStrictEqual(
      corpus.rounds.map((f) => path.basename(f)),
      [
        "designs-round1.json", "designs-round2.json", "designs-round3.json",
        "designs-round4.json", "designs-round4b.json", "designs-round4c.json",
      ],
    );
    const keys = corpus.rounds.map((f) => freeze.roundKey(path.basename(f)));
    const sorted = keys.slice().sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    assert.deepStrictEqual(keys, sorted, "the round list is not in generation order");
  });

  it("agrees with the generator's own merge file, when that file exists", function () {
    const merged = path.join(
      ROOT, "temp", "visual_logs", "byok_svg_borders_20260927", "designs-merged.json",
    );
    if (!fs.existsSync(merged)) this.skip();
    const m = JSON.parse(fs.readFileSync(merged, "utf8"));
    const byId = {};
    for (const d of m.designs || []) byId[d.id] = d.svg;
    const mismatched = corpus.designs.filter((d) => byId[d.id] !== d.svg).map((d) => d.id);
    assert.deepStrictEqual(
      mismatched,
      [],
      "the frozen corpus disagrees with designs-merged.json for: " + mismatched.join(", "),
    );
  });

  it("is read by the gallery spec as its DEFAULT source, not the generator's run directory", function () {
    const spec = fs.readFileSync(
      path.join(ROOT, "test", "browser_e2e", "byok_border_gallery.spec.js"),
      "utf8",
    );
    assert.ok(
      /test",\s*"fixtures",\s*"byok_border_corpus\.json"/.test(spec),
      "the gallery spec does not default to the frozen corpus fixture",
    );
    assert.ok(
      !/designs-round["\s]*\+\s*(r|ROUND)/.test(spec),
      "the gallery spec still builds a `designs-round<N>.json` path — the non-deterministic source",
    );
  });

  it("the fixture is NOT gitignored (a public clone must carry the gate's input)", function () {
    let ignored = true;
    try {
      execFileSync("git", ["check-ignore", "-q", "--", path.relative(ROOT, FIXTURE)], {
        cwd: ROOT,
        stdio: "pipe",
      });
    } catch (e) {
      ignored = e.status === 1 ? false : true;
    }
    assert.strictEqual(ignored, false, "test/fixtures/byok_border_corpus.json is gitignored");
  });
});
