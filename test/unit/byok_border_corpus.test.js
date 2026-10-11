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
 *  6. A RETIREMENT IS DECLARED, NOT AN OMISSION — D3 (2026-10-05) gave 05-celestial-arcs one
 *     regeneration and then a binding-metric verdict, retiring it on failure. The regeneration
 *     FAILED the metric, so 05 left the canonical set: it is absent from `designs`, all five of
 *     its accepted blobs are in `variants`, and `test/fixtures/byok_border_retirements.json`
 *     (a freeze INPUT) carries the ruling, the condition, the measured verdict and the evidence
 *     paths. Without this fence a dropped id and a retired one would look identical.
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
  it("carries the whole corpus: 11 canonical designs plus every superseded variant", function () {
    assert.strictEqual(corpus.designs.length, 11, "canonical design count changed");
    // 42 variants since the 2026-10-11 Gemini regeneration round (operator ruling in
    // `vendor/conductor/archive/byok_border_prompt_adoption_20261006/operator_ruling_20261011.md`):
    // the 35 of the adoption leg plus the 4 blobs round 23 (the Gemini seat) superseded —
    // 01 (r20 winner), 04 (r19 winner), 10 (r22 winner), 12 (r20 winner) — plus the round-24
    // 8/10-bar sample (2026-10-11, same session) whose 01 blob re-emitted the same artwork and
    // superseded the round-23 winner, plus the round-25 draw the same ruling's remedy produced
    // when round 24's re-emission measured cornerDeltaMin 14 < 15 (01 only; the seat's MET is
    // corroborating-only, the D2 metric binds in both directions).
    assert.strictEqual(corpus.variants.length, 42, "superseded-variant count changed");
    // 53 = every accepted blob the live generator ever produced (rounds 1..27). It was 27
    // through the D3 leg, 41 after the 2026-10-06 prompt-adoption regeneration (rounds 10-19),
    // grew by exactly 5 with the close-out consult's ordered RESAMPLES (01/08/12 in round
    // 20, 02/10 in round 22 — rounds 21 accepted nothing; 04 stayed at its r19 blob after three
    // consecutive refused resample rounds, the consult's own escalation boundary), by exactly
    // 4 more with the 2026-10-11 operator-ordered regeneration on the GEMINI seat (round 23,
    // all four escalated ids accepted on their first sample), and by 1 more with the 8/10-bar
    // round 24 (01 only; the blob turned out to be a re-emission of the same artwork). A
    // retirement, an adoption or a resample moves history, it never deletes it.
    assert.strictEqual(
      corpus.designs.length + corpus.variants.length,
      53,
      "the frozen corpus must account for all 53 accepted blobs",
    );
    const ids = corpus.designs.map((d) => d.id).sort();
    assert.deepStrictEqual(ids, [
      "01-gilded-frame", "02-runic-band", "03-thornvine", "04-dragon-scale",
      "06-chainmail", "07-corner-arcs", "08-flame-crest",
      "09-frost-shards", "10-ink-brush", "11-starlit-void", "12-knotwork",
    ]);
    // The retired id is ABSENT from the canonical set and PRESENT in the record — the two
    // halves of "retire (canonical: false)" in the form this corpus actually has.
    assert.ok(
      !corpus.designs.some((d) => d.id === "05-celestial-arcs"),
      "the D3-retired design is still canonical",
    );
    assert.strictEqual(
      corpus.variants.filter((v) => v.id === "05-celestial-arcs").length,
      5,
      "05's accepted blobs (rounds 1, 4b, 5, 6, 9) must all survive the retirement",
    );
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

  it("carries 27 DISTINCT accepted blobs — no variant is a duplicate of a canonical design", function () {
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
    // 53 distinct since the 2026-10-11 Gemini regeneration round: the 46 blobs of the adoption
    // leg plus the 4 accepted blobs round 23 added (one per escalated id), plus 3 — the
    // round-24 01 sample re-emitted the round-23 artwork with DIFFERENT BYTES (attribute order
    // differs, geometry identical), and the round-25/round-27 draws (the same ruling's remedy,
    // run after r24's blob measured cornerDeltaMin 14 < 15) added two more distinct artworks.
    // History is preserved — which is exactly what this count proves.
    assert.strictEqual(seen.size, 53, "distinct blob count is not 53: " + seen.size);
  });

  it("attributes each superseded variant to the round it was SUPERSEDED BY, not to itself", function () {
    for (const v of corpus.variants) {
      assert.notStrictEqual(
        v.supersededByRound,
        v.round,
        v.id + ": a variant cannot be superseded by the round it came from",
      );
      const winner = corpus.designs.find((d) => d.id === v.id);
      // A RETIRED id has no canonical entry at all — that is the retirement, and
      // `supersededByRound` is null for its blobs. Every non-retired id must still name its winner.
      if (!winner) {
        assert.ok(
          corpus.retirements && corpus.retirements[v.id],
          v.id + ": a variant with no canonical design that is not declared retired — a dropped " +
            "id and a retired one must not look identical",
        );
        assert.strictEqual(
          v.supersededByRound, null,
          v.id + ": a retired design's blob must carry no supersededByRound",
        );
        continue;
      }
      assert.strictEqual(v.supersededByRound, winner.round, v.id + ": supersededByRound is wrong");
      // And the variant really is a DIFFERENT blob from the winner.
      assert.notStrictEqual(v.svg, winner.svg, v.id + ": the variant IS the winner's bytes");
      // 01's history carries TWO measured same-length distinct pairs: r23→r24 (the re-emission,
      // same artwork in a different attribute order, 517 chars both) and r25→r27 (two DISTINCT
      // artworks that both serialize to 499 chars — different sha256, already proven distinct by
      // the distinct-blob count above). Both are recorded history; everything else stays suspicious.
      const sameLengthOk =
        (v.id === "01-gilded-frame" && v.round === "23" && winner.round === "24") ||
        (v.id === "01-gilded-frame" && v.round === "25" && winner.round === "27");
      assert.ok(
        sameLengthOk || v.svgChars !== winner.svgChars,
        v.id + ": variant and winner have the same length — suspicious for a superseded blob",
      );
    }
  });

  it("is byte-reproducible: a fresh freeze over the round files + retirements equals the fixture", function () {
    // The generator's own run directory is the SOURCE of the fixture. It is `temp/` (ignored),
    // so a machine that has never run the generator cannot re-freeze — that is a skip, not a
    // failure, and the fixture itself stays the authority.
    const dir = freeze.DEFAULT_FROM;
    if (!fs.existsSync(dir)) this.skip();

    const { designs, variants, retirements } = freeze.buildCorpus(dir);
    assert.deepStrictEqual(
      Object.keys(retirements).sort(),
      Object.keys(corpus.retirements || {}).sort(),
      "the retirement set changed — a retirement is a corpus-fidelity ruling, not a build option",
    );
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
      // LINE-WISE and EOL-INSENSITIVE. Line-wise so a red NAMES the drift instead of dumping both
      // 70 kB strings into the transcript (the assertion that produced 64,608 characters of mocha
      // output and no diagnosis); EOL-insensitive so a Windows checkout of this fixture is not read
      // as corpus drift — git checks it out with `core.autocrlf` (MEASURED here: 75,288 B / 308 CRs
      // on disk vs 74,980 B / 0 in the blob), and the CLI writes `\n`. The rule is the shipping one,
      // `freeze.normalizeEol`, shared with `--check`, and it forgives ONLY the checkout's line
      // endings: a content difference still fails, which is what the negative control below pins.
      const cliLines = freeze.normalizeEol(fs.readFileSync(out, "utf8")).split("\n");
      const fixLines = freeze.normalizeEol(fs.readFileSync(FIXTURE, "utf8")).split("\n");
      const firstDiff = cliLines.findIndex((line, i) => line !== fixLines[i]);
      if (cliLines.length !== fixLines.length || firstDiff !== -1) {
        const at = firstDiff === -1 ? Math.min(cliLines.length, fixLines.length) : firstDiff;
        assert.fail(
          "the CLI's freeze output differs from the committed fixture at line " + (at + 1) +
            " of " + fixLines.length + " (a NORMALISED difference IS a content difference): " +
            "cli=" + JSON.stringify(String(cliLines[at]).slice(0, 120)) +
            " fixture=" + JSON.stringify(String(fixLines[at]).slice(0, 120)),
        );
      }
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
    // D3 (2026-10-05): 05 was regenerated ONCE more (round 9) and its id RETIRED out of `designs`
    // entirely, so it has no canonical round to check here — the retirement fence below pins its
    // blob history instead.
    assert.ok(
      !byId["05-celestial-arcs"],
      "05-celestial-arcs is D3-retired and must not be a canonical design",
    );
    // The 2026-10-06 prompt-adoption leg (track byok_border_prompt_adoption_20261006) REGENERATED
    // every canonical id under the adopted 10/10 prompts: 01/06/07/10 in round 10, 08 in 11,
    // 12 in 12, 09/11 in 13, and — after the Muse 6-loop consult diagnosed the T=0 greedy-decode
    // envelope attractor and ordered T>0 sampling — 02/03 in round 17 (T=0.75) and 04 in round 19
    // (T=0.8; round 18 went 0/5, its two envelope failures repair diagnostically and were NOT
    // frozen). 04's r11/r14 "acceptances" were degenerate empty frames and are variants.
    // The 2026-10-11 operator ruling (regenerate+re-judge on the GEMINI seat) then moved the four
    // escalated ids to round 23 — all four accepted on their first sample.
    assert.strictEqual(byId["01-gilded-frame"].round, "27", "01-gilded-frame must come from round 27 (the ruling's remedy draw after r24/r25 both measured cornerDeltaMin 14 < 15)");
    assert.strictEqual(byId["07-corner-arcs"].round, "10", "07-corner-arcs must come from round 10 (the adoption regeneration)");
    assert.strictEqual(byId["08-flame-crest"].round, "20", "08-flame-crest must come from round 20 (the close-out consult's ordered resample)");
    assert.strictEqual(byId["03-thornvine"].round, "17", "03-thornvine must come from round 17 (the sampled-leg remedy)");
    assert.strictEqual(byId["04-dragon-scale"].round, "23", "04-dragon-scale must come from round 23 (the operator's Gemini-seat regeneration)");
    assert.strictEqual(byId["10-ink-brush"].round, "23", "10-ink-brush must come from round 23 (the operator's Gemini-seat regeneration)");
    assert.strictEqual(byId["12-knotwork"].round, "23", "12-knotwork must come from round 23 (the operator's Gemini-seat regeneration)");
    assert.strictEqual(byId["06-chainmail"].round, "10", "06-chainmail must come from round 10 (the adoption regeneration; its r3 blob is the superseded predecessor)");

    // The round order itself, pinned as data.
    assert.deepStrictEqual(
      corpus.rounds.map((f) => path.basename(f)),
      [
        "designs-round1.json", "designs-round2.json", "designs-round3.json",
        "designs-round4.json", "designs-round4b.json", "designs-round4c.json",
        "designs-round5.json", "designs-round5b.json", "designs-round6.json",
        "designs-round7.json", "designs-round8.json", "designs-round9.json",
        "designs-round10.json", "designs-round11.json", "designs-round12.json",
        "designs-round13.json", "designs-round14.json", "designs-round15.json",
        "designs-round16.json", "designs-round17.json", "designs-round18.json",
        "designs-round19.json", "designs-round20.json", "designs-round21.json",
        "designs-round22.json", "designs-round23.json", "designs-round24.json",
        "designs-round25.json", "designs-round27.json",
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
    // STALE-BY-DESIGN (2026-10-06): the merge leg last ran at round "merged-5" (2026-10-01).
    // The 2026-10-06 prompt-adoption leg then regenerated EVERY canonical id (rounds 10-19), so
    // the corpus now intentionally leads the merge file on all eleven non-retired ids. The
    // fence's shape is preserved but inverted for this leg: every adoption-regenerated id must
    // have moved FORWARD, and only 05 (retired, absent from both) is exempt. A later re-run of
    // the merge leg becomes a no-op again and this exclusion should then be narrowed.
    const merged = path.join(
      ROOT, "temp", "visual_logs", "byok_svg_borders_20260927", "designs-merged.json",
    );
    if (!fs.existsSync(merged)) this.skip();
    const m = JSON.parse(fs.readFileSync(merged, "utf8"));
    const byIdM = {};
    for (const d of m.designs || []) byIdM[d.id] = d.svg;
    const adoptionRound = new Set(["10", "11", "12", "13", "17", "19", "20", "22", "23", "24", "25", "27"]);
    const regenerated = new Set(["05-celestial-arcs", "07-corner-arcs"].concat(
      corpus.designs.filter((d) => adoptionRound.has(d.round)).map((d) => d.id),
    ));
    const mismatched = corpus.designs
      .filter((d) => !regenerated.has(d.id) && byIdM[d.id] !== d.svg)
      .map((d) => d.id);
    assert.deepStrictEqual(
      mismatched,
      [],
      "the frozen corpus disagrees with designs-merged.json for: " + mismatched.join(", "),
    );
    for (const id of regenerated) {
      const canonical = corpus.designs.find((d) => d.id === id);
      if (!canonical) {
        // D3 retired 05 out of the canonical set; against the stale merge file it survives only as
        // a variant, and the retirement record is what names why.
        assert.ok(
          corpus.retirements[id] &&
            corpus.variants.some((v) => v.id === id),
          id + ": a regenerated id with no canonical entry must be a DECLARED retirement whose " +
            "blobs survive as variants",
        );
        continue;
      }
      assert.notStrictEqual(
        byIdM[id],
        canonical.svg,
        id + ": the R-6/R-7 regeneration is not visible against the stale merge file — either " +
          "the regeneration did not land in the fixture, or the merge file was rebuilt and this " +
          "exclusion should be removed",
      );
    }
  });

  it("D3 (2026-10-05): the retired design is DECLARED — its blobs survive and the retirement " +
    "carries its ruling, condition and measured verdict", function () {
    // The failure mode this fence exists for: a dropped id and a retired one look identical in the
    // frozen data. The retirement file is the difference, and it must name the ruling that ordered
    // it, the condition that was met, the metric reading that met it, and the round it was judged
    // on — enough for a reader to tell an executed branch from an agent's improvisation.
    const r = corpus.retirements;
    assert.ok(r && r["05-celestial-arcs"], "the D3 retirement is not declared in the fixture");
    const t = r["05-celestial-arcs"];
    assert.strictEqual(t.ruledBy, "D3", "the retirement must name the ruling that ordered it");
    assert.strictEqual(t.ruledOn, "2026-10-05", "the retirement must carry its ruling date");
    assert.ok(/regenerate once/i.test(t.condition), "the retirement must state the condition it met");
    assert.strictEqual(t.regenerationRound, "9", "the retirement must name the one permitted generation");
    assert.ok(/FAIL/.test(t.verdict), "the retirement must record the verdict as measured");
    assert.ok(
      /0\.0231|2063|solidStrokeP50PxMin/.test(t.measured),
      "the retirement must carry the metric reading the verdict was read from",
    );
    // The ONE regeneration was performed and IS in the corpus: round 9's blob exists as a variant
    // (nothing the generator accepted is dropped by a retirement).
    const rounds = corpus.variants.filter((v) => v.id === "05-celestial-arcs").map((v) => v.round);
    assert.deepStrictEqual(
      rounds.sort(),
      ["1", "4b", "5", "6", "9"],
      "05's four predecessor blobs plus the D3 regeneration must all survive: " + rounds.join(","),
    );
    // And the metric fixture agrees: a retired design carries NO binding criterion (VOID with a
    // reason), so D5's fence can never count it as a MET or a NOT MET row.
    const metrics = JSON.parse(
      fs.readFileSync(path.join(ROOT, "test", "fixtures", "byok_border_criteria_metrics.json"), "utf8"),
    );
    const me = metrics.criteria["05-celestial-arcs"];
    assert.strictEqual(me.metric, null, "a retired design may not carry a binding metric");
    assert.ok(
      /RETIRED/.test(me.voidReason) && me.retired && me.retired.verdict === "FAIL",
      "the metrics fixture must record the retirement, not merely omit a metric",
    );
    assert.ok(
      Array.isArray(me.terms) && me.terms.length === 5,
      "the terms the verdict was read with must be retained on the retired entry",
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

  it("D-B: the re-frozen closed-rule designs are CLOSED and their old bytes survive as variants", function () {
    // Operator ruling D-B (2026-10-01): 01/05/08 were re-generated with prompts that demand
    // closed rules after the round-22 seat found 01/05 drawing `stroke-dasharray` BY DESIGN
    // and 08's pigment below resolvability. The fence: the CANONICAL blobs carry no dash
    // pattern, and every superseded blob (including the old dashed 01/05 and the thin 08)
    // is still accounted for — a re-freeze that DROPPED history would fail here.
    const byId = {};
    for (const d of corpus.designs) byId[d.id] = d;
    for (const id of ["01-gilded-frame", "08-flame-crest"]) {
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
    // 05 was the third D-B id and is now RETIRED (D3, 2026-10-05), so the property is asserted on
    // its blobs instead of on a canonical entry. A retirement does NOT rewrite history: the blobs
    // the D-B leg produced (rounds 5 and later) are dash-free, while 05's PRE-D-B blobs (rounds 1
    // and 4b) keep the dash pattern they were frozen with — which is why 4b is the one variant in
    // the corpus that still carries `stroke-dasharray`, exactly as 01's round-1 blob does.
    const five = corpus.variants.filter((v) => v.id === "05-celestial-arcs");
    assert.strictEqual(five.length, 5, "05's blob history changed");
    const dashed = five.filter((v) => /stroke-dasharray/i.test(v.svg)).map((v) => v.round).sort();
    assert.deepStrictEqual(
      dashed,
      ["4b"],
      "05's pre-D-B dash pattern must be preserved as history (and only there): " + dashed.join(","),
    );
    assert.ok(
      five.filter((v) => ["5", "6", "9"].includes(v.round))
        .every((v) => !/stroke-dasharray/i.test(v.svg)),
      "05: a D-B-era blob still carries stroke-dasharray",
    );
    assert.ok(
      five.every((v) => v.supersededByRound === null),
      "05 is retired: none of its blobs may name a canonical winner",
    );
    // 01's own history is the sharpest case: round 1 (dashed), round 5 (solid but black),
    // round 5b (the gold answer R-3 later judged), round 10 (the adoption regeneration), round 20
    // (the close-out consult's ordered resample), round 23 (the operator's Gemini-seat
    // regeneration), round 24 (the 8/10-bar re-emission) and rounds 25/27 (the remedy draws) were
    // all accepted, and round 27 holds the canonical status.
    const gilded = corpus.variants.filter((v) => v.id === "01-gilded-frame").map((v) => v.round).sort();
    assert.deepStrictEqual(gilded, ["1", "10", "20", "23", "24", "25", "5", "5b"].sort(), "01-gilded-frame's superseded rounds changed: " + gilded.join(","));
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
    //
    // D3 (2026-10-05) removed 05 from the CANONICAL set, so its override is no longer a canonical
    // entry either. The override file still carries 05's re-cut text (the overrides file is the
    // record of the ruling, not of membership), so the fence below names the canonical ids that
    // remain and asserts 05's retirement separately — an override that silently disappeared would
    // otherwise read as "05 was never re-cut".
    const withOverride = corpus.designs.filter((d) => d.criterionOverride);
    assert.deepStrictEqual(
      withOverride.map((d) => d.id).sort(),
      ["01-gilded-frame", "04-dragon-scale", "07-corner-arcs"],
      "criterion overrides must exist on exactly the ruled CANONICAL ids (D-C, R-3, R-6, R-7 minus " +
        "the D3 retirement) — another id carrying one means an unreviewed re-cut reached the fixture",
    );
    const overridesRaw = JSON.parse(
      fs.readFileSync(path.join(ROOT, "test", "fixtures", "byok_border_criteria_overrides.json"), "utf8"),
    );
    assert.deepStrictEqual(
      Object.keys(overridesRaw.overrides).sort(),
      ["01-gilded-frame", "04-dragon-scale", "05-celestial-arcs", "07-corner-arcs"],
      "the override FILE must keep the four ruled ids — including the retired 05, whose re-cut is " +
        "part of the record and whose retirement is recorded in byok_border_retirements.json",
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
    // The bytes are the 2026-10-11 OPERATOR REGENERATION's (round 23, the Gemini seat, 10451
    // chars of real scale rows — r4c's old bytes survive as a variant pinned below, and
    // r11/r14's degenerate empty frames are variants too, as is the r19 adoption blob). D-C's
    // rulings still govern the JUDGED text: the override's reason, ruledOn and aspect-independent
    // clause are unchanged.
    assert.strictEqual(d04.round, "23", "04: the operator's Gemini-seat regeneration moved the canonical blob to round 23");
    assert.strictEqual(
      d04.sha256,
      "8bc68e19bcca4ec72eb5d0716e51738c80a97ae0d422d8a0d940afbd9b0efdf3",
      "04: the canonical bytes are not round 23's regeneration blob",
    );
    {
      const r4cVariant = corpus.variants.find((v) => v.id === "04-dragon-scale" && v.round === "4c");
      assert.ok(r4cVariant, "04: the r4c blob the D-C ruling was measured against must survive as a variant");
      assert.strictEqual(
        r4cVariant.sha256,
        "9c25ad91590462baa779cae2f6f8ce3693e4660b67930525d7dc2f94efe79481",
        "04: the r4c bytes changed in the variants record",
      );
      // The superseded r19 adoption blob must survive the 2026-10-11 regeneration too —
      // a regeneration keeps its predecessor.
      const r19Variant = corpus.variants.find((v) => v.id === "04-dragon-scale" && v.round === "19");
      assert.ok(r19Variant, "04: the r19 adoption blob vanished from the variants");
      assert.strictEqual(
        r19Variant.sha256,
        "eb2bbff687b60eaff5ad4cb79c8a787eff5c0eeeb12ced86c4fc959b2625cd02",
        "04: the r19 bytes changed in the variants record",
      );
    }

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
    // The 2026-10-06 adoption leg REGENERATED 01 (round 10, two-rule frame + four diamond
    // corners). R-3's rulings still govern the JUDGED text — the override's reason, ruledOn and
    // shape-only clause are unchanged — but the bytes and their provenance are the new round's,
    // and the OLD r5b bytes survive as a variant pinned by hash below (a regeneration keeps its
    // predecessor; an adoption must not be able to quietly erase the blob a ruling was measured
    // against).
    // The 2026-10-11 operator ruling (regenerate+re-judge on the GEMINI seat) REGENERATED 01
    // (round 23, a two-rule frame + four diamond corners at #111111). R-3's rulings still govern
    // the JUDGED text — the override's reason, ruledOn and shape-only clause are unchanged — but
    // the bytes and their provenance are the new round's, and the r20 resample bytes survive as a
    // variant pinned by hash below (a regeneration keeps its predecessor; an adoption must not be
    // able to quietly erase the blob a ruling was measured against).
    // The same session's 8/10-bar sample (round 24) re-emitted the SAME artwork (attribute order
    // differs, geometry identical) and superseded the round-23 winner per the freeze's own
    // last-accepted-wins rule. That r24 blob then measured cornerDeltaMin 14 < 15 on the D2
    // binding metric, and the ruling's remedy (regenerate + re-judge) produced the round-25
    // draw now canonical — the r24 bytes survive as a variant.
    assert.strictEqual(d01.round, "27", "01: the canonical blob is round 27 (the ruling's remedy draw; r24/r25 both measured cornerDeltaMin 14 < 15)");
    assert.strictEqual(
      d01.sha256,
      "1fe5f9f794b3877bd255f49c19964be8cb052b23039c46655cf20e983b0adb1c",
      "01: the canonical bytes are not round 27's sample blob",
    );
    {
      const r5bVariant = corpus.variants.find((v) => v.id === "01-gilded-frame" && v.round === "5b");
      assert.ok(r5bVariant, "01: the r5b blob the R-3 ruling was measured against must survive as a variant");
      assert.strictEqual(
        r5bVariant.sha256,
        "99605fc36fcc243fa11f4e1109207b8310fb0dae8999c98453e8cc7bef713e3d",
        "01: the r5b bytes changed in the variants record",
      );
      // The superseded r20 resample blob must survive the 2026-10-11 regeneration too.
      const r20Variant = corpus.variants.find((v) => v.id === "01-gilded-frame" && v.round === "20");
      assert.ok(r20Variant, "01: the r20 resample blob vanished from the variants");
      assert.strictEqual(
        r20Variant.sha256,
        "f36388288892286d7ceb596d1bc9302fed11b9a411b656fe1204b0673bb9a4c3",
        "01: the r20 bytes changed in the variants record",
      );
      // The round-23 Gemini-seat regeneration blob must survive the round-24 re-emission too.
      const r23Variant = corpus.variants.find((v) => v.id === "01-gilded-frame" && v.round === "23");
      assert.ok(r23Variant, "01: the r23 regeneration blob vanished from the variants");
      assert.strictEqual(
        r23Variant.sha256,
        "efaab92b4d46ef6995f78ce7488460271de5867ea6b6fd3e59cca8212219e493",
        "01: the r23 bytes changed in the variants record",
      );
      // The round-24 8/10-bar re-emission and the round-25 remedy draw must survive round 27 too.
      const r24Variant = corpus.variants.find((v) => v.id === "01-gilded-frame" && v.round === "24");
      assert.ok(r24Variant, "01: the r24 re-emission blob vanished from the variants");
      assert.strictEqual(
        r24Variant.sha256,
        "b8c3d3973928eed0c5cd1e90704c04527697156f823b31c47b811a702296de0b",
        "01: the r24 bytes changed in the variants record",
      );
      const r25Variant = corpus.variants.find((v) => v.id === "01-gilded-frame" && v.round === "25");
      assert.ok(r25Variant, "01: the r25 remedy blob vanished from the variants");
      assert.strictEqual(
        r25Variant.sha256,
        "42efdec2ac306dc7b495ee91712983505baadf2bf04d90872809800deacc1a6d",
        "01: the r25 bytes changed in the variants record",
      );
    }

    // ---- R-6 / R-7 (2026-10-02): the two RE-CUT designs, both fenced the same way as above.
    // Each must: name its own ruling + date, carry a reason, keep `criterionGenerated` equal to
    // the text its round actually generated, CHANGED (an override that changes nothing is a
    // silently swapped field), and leave the frozen bytes at the winning round's hash.
    const recuts = [
      {
        id: "07-corner-arcs",
        ruledBy: "R-7",
        // R-7 (2026-10-02) regenerated 07 into round 8. The 2026-10-06 adoption leg regenerated
        // it AGAIN (round 10) under the adopted 10/10 prompt — a later sanctioned regeneration —
        // so the canonical round is now 10 and R-7's own round-8 bytes survive as a variant,
        // pinned by hash below.
        round: "10",
        previousSha256: "1684ff40bb8de67ec7e448ff05c544c332f76e503e4b413233864d2f61e343d1",
        priorRegeneration: { round: "8", sha256: "d572fee1de68bc7845e5e6782246e613328dff2f8c60cfbf7bce690f1c85b9c9" },
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
      assert.strictEqual(
        d.sha256,
        r.previousSha256,
        `${r.id}: the canonical bytes are not the adoption regeneration's blob`,
      );
      if (r.priorRegeneration) {
        // The PRIOR regeneration's bytes survive in the variants record (nothing accepted is
        // dropped by a later regeneration).
        const prior = corpus.variants.find((v) => v.id === r.id && v.round === r.priorRegeneration.round);
        assert.ok(
          prior,
          `${r.id}: the prior regeneration's blob (round ${r.priorRegeneration.round}) vanished from the variants`,
        );
        assert.strictEqual(
          prior.sha256,
          r.priorRegeneration.sha256,
          `${r.id}: the prior regeneration's bytes changed in the variants record`,
        );
      }
    }
    // 05 judged by continuity, 07 judged at the corners — the property each re-cut exists to
    // establish, asserted on the JUDGED text (not on the superseded one). 05's text is read from
    // the OVERRIDE FILE now that the design is retired from the canonical set: the re-cut is part
    // of the record even though the id is gone from `designs`.
    assert.ok(
      /unbroken|continu/i.test(overridesRaw.overrides["05-celestial-arcs"].criterion),
      "05: the re-cut must keep the clause the frame measurably satisfies (unbroken strokes)",
    );
    assert.ok(
      !/at least four separate four-pointed star shapes are visible/i.test(
        overridesRaw.overrides["05-celestial-arcs"].criterion,
      ),
      "05: the re-cut still DEMANDS the star clause the pipeline cannot paint",
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

/**
 * THE 2026-10-04 CORPUS BREAK, fenced at BOTH ends (issue
 * `temp/issues/ISSUE_byok_border_corpus_round1_drift_vs_frozen_fixture_20261004.md`).
 *
 * The break had two causes and neither was the product: (1) a live generator run REWROTE
 * `designs-round1.json` — `--only` retry, no `--round`, so the default 1 — replacing the accepted
 * 719-char `01-gilded-frame` blob this fixture had frozen with 431 chars of parser-recovered
 * malformed markup, so the freeze stopped reproducing; (2) the fixture is compared byte-for-byte
 * against an LF-emitting CLI while git checks it out CRLF here, so a fresh Windows checkout reds
 * even over a perfect corpus. Cause (1) is fenced in `border_design_generator.js`, cause (2) in the
 * comparison itself; these cases are the fence around the fences.
 */
describe("BYOK border corpus — the 2026-10-04 break cannot come back", function () {
  const generator = require("../../scripts/border_design_generator.js");

  it("a round file that holds accepted designs is REFUSED a rewrite unless --overwrite-round", function () {
    const accepted = { id: "01-gilded-frame", accepted: true, svg: "<svg/>" };
    const refused = { id: "01-gilded-frame", accepted: false, rejectCode: "http_429", svg: null };
    const empty = { id: "01-gilded-frame", accepted: false, svg: null };

    // 1. The dangerous invocation: the file has an accepted entry, no --overwrite-round.
    const err = generator.roundWriteRefusal([accepted], "1", false);
    assert.ok(err, "rewriting a frozen round was allowed");
    assert.ok(
      /--round <new>[\s\S]*--overwrite-round/.test(err.message),
      "the refusal must name BOTH sanctioned ways forward: " + err.message,
    );
    // 2. The same rewrite, deliberately re-cut.
    assert.strictEqual(generator.roundWriteRefusal([accepted], "1", true), null);
    // 3. A round that has never held accepted artwork is scratch — a brand new --round is not blocked.
    assert.strictEqual(generator.roundWriteRefusal([empty, refused], "2", false), null);
    assert.strictEqual(generator.roundWriteRefusal([], "1", false), null);

    // 4. And the second rule: a FAILED attempt can never displace an accepted blob, with or without
    //    --overwrite-round (the exact mechanism that lost the frozen round-1 record).
    assert.strictEqual(generator.mergeAttempt(accepted, refused), accepted);
    assert.strictEqual(generator.mergeAttempt(empty, refused), refused);
    // 5. A SUCCESSFUL attempt still supersedes: that is what a re-cut is.
    const winner = { id: "01-gilded-frame", accepted: true, svg: "<svg id='new'/>" };
    assert.strictEqual(generator.mergeAttempt(accepted, winner), winner);
  });

  it("--check forgives a CRLF copy of a fresh freeze and still fails on one character of drift", function () {
    const dir = freeze.DEFAULT_FROM;
    if (!fs.existsSync(dir)) this.skip();

    const fresh = path.join(os.tmpdir(), "be-corpus-fresh-" + process.pid + ".json");
    const crlfCopy = path.join(os.tmpdir(), "be-corpus-crlf-" + process.pid + ".json");
    const drifted = path.join(os.tmpdir(), "be-corpus-drift-" + process.pid + ".json");
    const check = (file) => {
      try {
        execFileSync(process.execPath, [GENERATOR, "--check", "--out", file], { cwd: ROOT, stdio: "pipe" });
        return 0;
      } catch (e) {
        return e.status;
      }
    };
    try {
      execFileSync(process.execPath, [GENERATOR, "--out", fresh], { cwd: ROOT, stdio: "pipe" });
      // PREMISE: this case is about the EOL rule, so it only runs where the corpus actually
      // reproduces. A corpus that does not reproduce is the byte-reproducibility case's red — it
      // names the drifting record — and it must not be reported here as an EOL finding.
      const lf = fs.readFileSync(fresh, "utf8");
      if (freeze.normalizeEol(lf) !== freeze.normalizeEol(fs.readFileSync(FIXTURE, "utf8"))) this.skip();
      assert.ok(!/\r\n/.test(lf), "a fresh freeze emitted CRLF: the CLI's own output carries a CR");

      // THE FIX, at the CLI: the SAME bytes with a CRLF checkout's line endings pass. This is the
      // exact state a fresh Windows worktree/clone is in (and the state that reds at HEAD).
      fs.writeFileSync(crlfCopy, lf.replace(/\n/g, "\r\n"), "utf8");
      assert.ok(/\r\n/.test(fs.readFileSync(crlfCopy, "utf8")), "the CRLF plant has no CR");
      assert.strictEqual(check(crlfCopy), 0, "--check calls a CRLF checkout CORPUS DRIFT");

      // NEGATIVE CONTROL: one character inside one frozen blob, CRLF or not, still fails. Without
      // this the normalisation could hide exactly the drift the suite exists to catch.
      assert.ok(lf.includes('"svgChars": 719'), "the plant's anchor is not in a fresh freeze");
      fs.writeFileSync(drifted, lf.replace('"svgChars": 719', '"svgChars": 718').replace(/\n/g, "\r\n"), "utf8");
      assert.notStrictEqual(fs.readFileSync(drifted, "utf8"), fs.readFileSync(crlfCopy, "utf8"), "the content-drift plant changed nothing");
      assert.strictEqual(check(drifted), 1, "--check passed a fixture with drifted content");
    } finally {
      for (const f of [fresh, crlfCopy, drifted]) if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });
});
