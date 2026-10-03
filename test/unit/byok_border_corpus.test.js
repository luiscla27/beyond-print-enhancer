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
 * the fence around it. Five independent properties, each of which was FALSE at least once while
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
 *  5. THE OPERATOR'S TWO CORPUS RULINGS LANDED AS RULINGS, NOT AS SILENT SWAPS —
 *     D-B (2026-10-01): 01/05/08 were RE-GENERATED under closed-rule prompts, so their
 *     canonical blobs come from rounds 5/5b, carry no `stroke-dasharray`, and their old
 *     bytes survive as variants (nothing the generator ever accepted is dropped);
 *     D-C: 04-dragon-scale keeps its round-4c BYTES but is judged by the override criterion,
 *     with `criterionGenerated` preserving what the round actually recorded and
 *     `criterionOverride` carrying {supersedes, ruledBy, ruledOn, reason} — an override on
 *     any OTHER id, or one missing its provenance, fails here.
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
  it("carries the whole corpus: 12 canonical designs plus every superseded variant", function () {
    assert.strictEqual(corpus.designs.length, 12, "canonical design count changed");
    // 14 variants since the 2026-10-02 R-6/R-7 RE-CUT + REGENERATION leg: the D-B set (12) plus
    // 05@5 and 07@4, whose canonicals moved to the freshly generated round-6 / round-8 blobs.
    // The count grew because the leg produced NEW artwork, not because history was dropped —
    // the previous canonicals are still here, as variants.
    assert.strictEqual(corpus.variants.length, 14, "superseded-variant count changed");
    // 26 = every accepted blob the live generator ever produced (rounds 1..8); the prompt
    // corpus has 12 ids. (24 before the R-6/R-7 regeneration added 05@6 and 07@8.)
    assert.strictEqual(
      corpus.designs.length + corpus.variants.length,
      26,
      "the frozen corpus must account for all 26 accepted blobs",
    );
    const ids = corpus.designs.map((d) => d.id).sort();
    assert.deepStrictEqual(ids, [
      "01-gilded-frame", "02-runic-band", "03-thornvine", "04-dragon-scale",
      "05-celestial-arcs", "06-chainmail", "07-corner-arcs", "08-flame-crest",
      "09-frost-shards", "10-ink-brush", "11-starlit-void", "12-knotwork",
    ]);
  });

  it("every frozen blob is ACCEPTED by the product's own trust root", function () {
    // 24 blobs since the D-B re-freeze; jsdom's DOMParser costs ~40-80ms per validation and
    // the default 2s mocha timeout was measured on 20 — the property is unchanged, the
    // corpus grew, so the timeout grows with it (a timeout here is NOT a pass: the loop
    // below still asserts every blob).
    this.timeout(20000);
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

  it("carries 26 DISTINCT accepted blobs — no variant is a duplicate of a canonical design", function () {
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
    // 26 distinct since the 2026-10-02 R-6/R-7 re-cut + regeneration leg: 24 distinct at the D-B
    // re-freeze + the two freshly accepted blobs (05@6, 07@8) whose superseded predecessors stay.
    assert.strictEqual(seen.size, 26, "distinct blob count is not 26: " + seen.size);
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
    // would carry its ROUND-1 blob (1447 chars) instead of its latest accepted one.
    const byId = {};
    for (const d of corpus.designs) byId[d.id] = d;
    // D-B (2026-10-01): 01/05/08 were re-generated under closed-rule prompts — 01/08 in round 5,
    // 01 also in round 5b (round 5's own 01 answer drew black rules and was superseded).
    // R-6/R-7 (2026-10-02): 05 and 07 were re-cut AND REGENERATED — 05 in round 6, 07 in round 8
    // (round 7's 07 answer was REFUSED by the trust root: the model emitted a `<style>` block).
    assert.strictEqual(byId["05-celestial-arcs"].round, "6", "05-celestial-arcs must come from round 6");
    assert.strictEqual(byId["01-gilded-frame"].round, "5b", "01-gilded-frame must come from round 5b (the gold answer)");
    assert.strictEqual(byId["07-corner-arcs"].round, "8", "07-corner-arcs must come from round 8");
    assert.strictEqual(byId["08-flame-crest"].round, "5", "08-flame-crest must come from round 5");
    assert.strictEqual(byId["03-thornvine"].round, "4c", "03-thornvine must come from round 4c");
    assert.strictEqual(byId["04-dragon-scale"].round, "4c", "04-dragon-scale must come from round 4c (D-C kept its bytes)");
    assert.strictEqual(byId["06-chainmail"].round, "3", "06-chainmail was only ever accepted in round 3");

    // The round order itself, pinned as data.
    assert.deepStrictEqual(
      corpus.rounds.map((f) => path.basename(f)),
      [
        "designs-round1.json", "designs-round2.json", "designs-round3.json",
        "designs-round4.json", "designs-round4b.json", "designs-round4c.json",
        "designs-round5.json", "designs-round5b.json", "designs-round6.json",
        "designs-round7.json", "designs-round8.json",
      ],
    );
    const keys = corpus.rounds.map((f) => freeze.roundKey(path.basename(f)));
    const sorted = keys.slice().sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    assert.deepStrictEqual(keys, sorted, "the round list is not in generation order");
  });

  it("agrees with the generator's own merge file, when that file exists", function () {
    // `designs-merged.json` is the GENERATOR's own last-accepted-wins merge, written when the
    // generator's merge leg last ran (round field `merged-5`, 2026-10-01). MEASURED 2026-10-02:
    // it is now STALE for exactly the two ids the R-6/R-7 leg regenerated, because it was not
    // re-run after them. That staleness is the EXPECTED state, not a defect, so the assertion is
    // directional: the two regenerated ids must have moved FORWARD to their new rounds (asserted
    // separately in the round-order case), and every OTHER id must still agree byte for byte.
    // A re-run of the generator's merge leg becomes a no-op for the fixture.
    const merged = path.join(
      ROOT, "temp", "visual_logs", "byok_svg_borders_20260927", "designs-merged.json",
    );
    if (!fs.existsSync(merged)) this.skip();
    const m = JSON.parse(fs.readFileSync(merged, "utf8"));
    const byId = {};
    for (const d of m.designs || []) byId[d.id] = d.svg;
    const regenerated = new Set(["05-celestial-arcs", "07-corner-arcs"]);
    const mismatched = corpus.designs
      .filter((d) => !regenerated.has(d.id) && byId[d.id] !== d.svg)
      .map((d) => d.id);
    assert.deepStrictEqual(
      mismatched,
      [],
      "the frozen corpus disagrees with designs-merged.json for: " + mismatched.join(", "),
    );
    for (const id of regenerated) {
      assert.notStrictEqual(
        byId[id],
        corpus.designs.find((d) => d.id === id).svg,
        id + ": the R-6/R-7 regeneration is not visible against the stale merge file — either " +
          "the regeneration did not land in the fixture, or the merge file was rebuilt and this " +
          "exclusion should be removed",
      );
    }
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

  it("D-B: the re-frozen closed-rule designs are CLOSED and their old bytes survive as variants", function () {
    // Operator ruling D-B (2026-10-01): 01/05/08 were re-generated with prompts that demand
    // closed rules after the round-22 seat found 01/05 drawing `stroke-dasharray` BY DESIGN
    // and 08's pigment below resolvability. The fence: the CANONICAL blobs carry no dash
    // pattern, and every superseded blob (including the old dashed 01/05 and the thin 08)
    // is still accounted for — a re-freeze that DROPPED history would fail here.
    const byId = {};
    for (const d of corpus.designs) byId[d.id] = d;
    for (const id of ["01-gilded-frame", "05-celestial-arcs", "08-flame-crest"]) {
      assert.ok(byId[id], id + " missing from the canonical set");
      assert.ok(
        !/stroke-dasharray/i.test(byId[id].svg),
        id + ": the re-frozen canonical blob still carries stroke-dasharray — the D-B " +
          "closed-rule prompt did not land in the bytes",
      );
      const superseded = corpus.variants.filter((v) => v.id === id);
      assert.ok(superseded.length >= 1, id + ": its pre-D-B blob vanished from the variants");
      assert.ok(
        superseded.every((v) => v.supersededByRound === byId[id].round),
        id + ": a variant's supersededByRound does not name the D-B winner",
      );
    }
    // 01's own history is the sharpest case: round 1 (dashed) AND round 5 (solid but black)
    // were both accepted and both superseded by the round-5b gold answer.
    const gilded = corpus.variants.filter((v) => v.id === "01-gilded-frame").map((v) => v.round).sort();
    assert.deepStrictEqual(gilded, ["1", "5"], "01-gilded-frame's superseded rounds changed: " + gilded.join(","));
  });

  it("operator overrides: exactly the four ruled ids carry a criterion override, each with provenance", function () {
    // Operator rulings. D-C and R-3 are dated 2026-10-01, both re-cutting a judged TEXT while
    // the frozen bytes stay the winning round's:
    //   D-C — 04-dragon-scale: aspect-independent scale criterion (the anisotropy of the
    //         product's border-image edge scaling on a tall section).
    //   R-3 — 01-gilded-frame: the colour clause ("gold tone") dropped to shape-only, because
    //         the product's default decoration filter (grayscale(100%)) removes every hue from
    //         the judged band before any pixel exists (operator ruling R-2 keeps the judged
    //         instrument at PRINT defaults). The re-cut text is measured against the judged
    //         frame: two rules per edge (95.5-99.0% line coverage) and a diamond at each of the
    //         four corners (ink deltas +41/+22/+32/+19 over an identical control box).
    // R-6 and R-7 are the operator's 2026-10-02 RE-CUT instruction for the two designs whose
    // criteria named features no pipeline stage can paint (05's source-mid-viewBox star marks;
    // 07's corner groups, which no EDGE strip covers). Their measured basis is filed as
    // `phase4_round25_recut_evidence.md`; the bytes are likewise unchanged.
    // An override on ANY other id fails here — that is the fence that keeps a re-cut from
    // arriving unreviewed.
    const withOverride = corpus.designs.filter((d) => d.criterionOverride);
    assert.deepStrictEqual(
      withOverride.map((d) => d.id).sort(),
      ["01-gilded-frame", "04-dragon-scale", "05-celestial-arcs", "07-corner-arcs"],
      "criterion overrides must exist on exactly the ruled ids (D-C, R-3, R-6, R-7) — another " +
        "id carrying one means an unreviewed re-cut reached the fixture",
    );
    const byId = {};
    for (const d of withOverride) byId[d.id] = d;

    const d04 = byId["04-dragon-scale"];
    const ov = d04.criterionOverride;
    assert.strictEqual(ov.ruledBy, "D-C", "04's override must name the ruling that made it");
    assert.strictEqual(ov.ruledOn, "2026-10-01", "04's override must carry its ruling date");
    assert.ok(ov.reason && ov.reason.length > 40, "04's override must carry its reason");
    assert.strictEqual(
      d04.criterionGenerated,
      ov.supersedes,
      "04: supersedes must equal the text the winning round actually generated",
    );
    assert.notStrictEqual(
      d04.criterion,
      d04.criterionGenerated,
      "04: the override criterion must differ from the generated one — an override that " +
        "changes nothing is a silently swapped field",
    );
    // The judged criterion is the ASPECT-INDEPENDENT text; the anisotropy fact is in it.
    assert.ok(
      /anisotropic/i.test(d04.criterion),
      "04: the judged criterion must state the anisotropic-scaling basis the ruling rests on",
    );
    // The bytes are UNTOUCHED by the override: the same blob the round-4c freeze produced
    // (sha256 pinned from the pre-override fixture, so an accidental regeneration of 04
    // would fail here rather than silently re-anchoring the ruling).
    assert.strictEqual(d04.round, "4c", "04: D-C re-cut the criterion, not the artwork");
    assert.strictEqual(
      d04.sha256,
      "9c25ad91590462baa779cae2f6f8ce3693e4660b67930525d7dc2f94efe79481",
      "04: the frozen bytes changed under an override that only re-cuts the criterion",
    );

    const d01 = byId["01-gilded-frame"];
    const o1 = d01.criterionOverride;
    assert.strictEqual(o1.ruledBy, "R-3", "01's override must name the ruling that made it");
    assert.strictEqual(o1.ruledOn, "2026-10-01", "01's override must carry its ruling date");
    assert.ok(o1.reason && o1.reason.length > 40, "01's override must carry its reason");
    assert.strictEqual(
      d01.criterionGenerated,
      o1.supersedes,
      "01: supersedes must equal the text the winning round actually generated",
    );
    assert.notStrictEqual(d01.criterion, d01.criterionGenerated, "01: an override that changes nothing");
    // The judged criterion must be SHAPE-ONLY and must not DEMAND a hue — the whole point of
    // R-3, and the property that makes it satisfiable at the product's PRINT defaults.
    // The re-cut text deliberately KEEPS a disclaimer ("no hue is expected ... an absence of
    // colour is NOT a failure") so the visual seat is told, in the judged text itself, that
    // greyscale is the shipped state — that disclaimer is a feature, not a demand, so the
    // fence tests for colour DEMANDS (the phrase forms the superseded text used), not for the
    // words in a negative sentence.
    assert.ok(
      !/gold\s*tone|gold-tone|in\s+a?\s*gold|stroke[d]?\s+(the\s+)?(rules|lines|marks|frame)\s+in\s+gold/i.test(d01.criterion),
      "01: the re-cut criterion still DEMANDS a hue — R-3 makes it shape-only",
    );
    assert.ok(
      /greyscale|grayscale|no hue|absence of colour|absence of color/i.test(d01.criterion),
      "01: the re-cut criterion must carry the disclaimer that greyscale is the shipped state " +
        "(the seat failed 01 on colour exactly once already — the judged text must say so)",
    );
    assert.ok(
      /continu/i.test(d01.criterion) && /corner/i.test(d01.criterion),
      "01: the re-cut criterion must keep the two clauses the pixels support (continuity + corner marks)",
    );
    assert.strictEqual(d01.round, "5b", "01: R-3 re-cut the criterion, not the artwork");
    assert.strictEqual(
      d01.sha256,
      "99605fc36fcc243fa11f4e1109207b8310fb0dae8999c98453e8cc7bef713e3d",
      "01: the frozen bytes changed under an override that only re-cuts the criterion",
    );

    // ---- R-6 / R-7 (2026-10-02): the two RE-CUT designs, both fenced the same way as above.
    // Each must: name its own ruling + date, carry a reason, keep `criterionGenerated` equal to
    // the text its round actually generated, CHANGED (an override that changes nothing is a
    // silently swapped field), and leave the frozen bytes at the winning round's hash.
    const recuts = [
      {
        id: "05-celestial-arcs",
        ruledBy: "R-6",
        round: "6",
        previousSha256: "bce88831e291b19a1694ce2cce1747231efa68ca1423efe6f51e99fe06f709cb",
        // The clause the pipeline cannot satisfy must be REMOVED as a demand: the re-cut may
        // mention the stars (as a recorded residual) but must not require them.
        mustNotDemand: /at least four separate four-pointed star shapes are visible/i,
      },
      {
        id: "07-corner-arcs",
        ruledBy: "R-7",
        round: "8",
        previousSha256: "84f10f2575423b320ce6ca9b370fadb1ca81654105d10ab41bbe870d1db380e4",
        mustNotDemand: /each of the four corners shows at least three nested quarter-circle arcs/i,
      },
    ];
    for (const r of recuts) {
      const d = byId[r.id];
      assert.ok(d, `${r.id}: the re-cut override is missing from the fixture`);
      const o = d.criterionOverride;
      assert.strictEqual(o.ruledBy, r.ruledBy, `${r.id}: override must name its ruling`);
      assert.strictEqual(o.ruledOn, "2026-10-02", `${r.id}: override must carry its ruling date`);
      assert.ok(o.reason && o.reason.length > 80, `${r.id}: override must carry its measured reason`);
      // R-6/R-7 were the operator's 2026-10-02 instruction to RE-CUT **and regenerate**: the
      // criterion moved to what the pipeline can paint, and the artwork was regenerated under it.
      // So on these two ids the override's `supersedes` is the pre-regeneration JUDGED text (the
      // text the previous seat actually judged), NOT the text the new winning round generated —
      // `criterionGenerated` is that new round's own text, by construction. Pinning both keeps
      // the history readable: the SUPERSEDED criterion survives even though the bytes moved.
      assert.ok(
        typeof o.supersedes === "string" && o.supersedes.length > 60,
        `${r.id}: the override must preserve the superseded judged text`,
      );
      assert.notStrictEqual(d.criterion, d.criterionGenerated, `${r.id}: override changes nothing`);
      // `criterionGenerated` is the WINNING ROUND's own text — for these two ids that is the NEW
      // round's criterion, and the round file is the authority for it.
      const roundFile = path.join(freeze.DEFAULT_FROM, "designs-round" + d.round + ".json");
      if (fs.existsSync(roundFile)) {
        const rf = JSON.parse(fs.readFileSync(roundFile, "utf8"));
        const gen = (rf.designs || []).find((x) => x.id === r.id);
        assert.strictEqual(
          d.criterionGenerated,
          gen.criterion,
          `${r.id}: criterionGenerated must equal the criterion of the WINNING round file ` +
            `(round ${d.round})`,
        );
      }
      assert.ok(
        !r.mustNotDemand.test(d.criterion),
        `${r.id}: the re-cut still DEMANDS the clause the pipeline cannot paint`,
      );
      // R-6/R-7 were a RE-CUT **plus REGENERATION**: the canonical bytes must be the NEW round's
      // blob, the superseded predecessor must survive as a variant, and the OLD bytes must NOT
      // still be canonical (that would mean only the text moved).
      assert.strictEqual(
        d.round,
        r.round,
        `${r.id}: the R-6/R-7 leg regenerated this design — the canonical round must be the new one`,
      );
      assert.ok(
        corpus.variants.some((v) => v.id === r.id && v.svg !== d.svg),
        `${r.id}: the previous canonical blob vanished — a regeneration must keep its predecessor`,
      );
      assert.notStrictEqual(
        d.sha256,
        r.previousSha256,
        `${r.id}: the bytes did NOT change — only the criterion moved, which is NOT what ` +
          `R-6/R-7 ordered (they ordered a re-cut AND a regeneration)`,
      );
    }
    // 05 judged by continuity, 07 judged at the corners — the property each re-cut exists to
    // establish, asserted on the JUDGED text (not on the superseded one).
    assert.ok(
      /unbroken|continu/i.test(byId["05-celestial-arcs"].criterion),
      "05: the re-cut must keep the clause the frame measurably satisfies (unbroken strokes)",
    );
    assert.ok(
      /corner/i.test(byId["07-corner-arcs"].criterion) &&
        /does not require the corner groups to be visible inside an edge strip/i.test(
          byId["07-corner-arcs"].criterion,
        ),
      "07: the re-cut must move the judged location to the corners AND say why an edge strip " +
        "is not the place to look",
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
