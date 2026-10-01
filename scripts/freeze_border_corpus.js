/**
 * freeze_border_corpus.js — freeze the BYOK border design corpus into a TRACKED fixture.
 *
 * WHY THIS EXISTS (and why the fixture, not the generator, is the durable artifact)
 * -------------------------------------------------------------------------------
 * `scripts/border_design_generator.js` dials a LIVE, free, community-rate-limited model
 * (`poolside/laguna-s-2.1:free` via NOUS). Its output is therefore:
 *
 *   - not reproducible (the same instruction is accepted in one round and refused in the
 *     next — MEASURED 6/12, 2/6, 4/4, 5/5, 1/3, 2/2 across rounds 1..4c for the SAME 12
 *     instructions), and
 *   - not always available (the free leg 429s, times out, or returns reasoning-only content).
 *
 * A visual gate whose INPUT is non-deterministic cannot be a gate: a red frame might mean
 * "the product's render path is broken" or "the model happened to send a bad design this
 * minute", and the two are indistinguishable after the fact. So the SVGs the generator has
 * already produced are frozen here, byte-for-byte, and every later run reads THIS file.
 *
 * WHAT IS FROZEN
 * --------------
 * Every accepted blob from every `designs-round*.json` the generator ever wrote — 20 of them
 * across 12 corpus ids (8 ids were re-accepted in a later round) — split into two arrays:
 *
 *   `designs`  — the 12 CANONICAL blobs, one per id = LAST-ACCEPTED-WINS in generation order
 *                (rounds 1, 2, 3, 4, 4b, 4c). This is the merge rule the generator's own
 *                `designs-merged.json` used; MEASURED 2026-10-01: all 12 canonical blobs are
 *                byte-identical to that file (12/12), which is what licenses calling this
 *                array the corpus. (An earlier reading of this script said FIRST-accepted-wins;
 *                the 12/12 last-wins comparison falsifies that and the rule is now measured,
 *                not assumed.)
 *   `variants` — the 8 superseded blobs, kept because they are real model output for a real
 *                instruction and are the only artifact that records how a design EVOLVED
 *                across rounds. A gate can render them to check the render path is
 *                instruction-independent; it must not judge them against the criterion,
 *                which belongs to the canonical blob.
 *
 * Round order is parsed, not lexicographic: `4b` sorts BEFORE `4` as a string, which would
 * silently pick the wrong canonical blob for `05-celestial-arcs` (round 1 accepted it, round
 * 4b re-accepted it) and make the fixture disagree with `designs-merged.json`.
 *
 * `instruction` is NOT stable for a re-accepted id (MEASURED: 8 of 12 ids carry two distinct
 * instruction strings across rounds — the corpus file was edited between them), so each entry
 * records the instruction of the round that WON, which is the one the frozen bytes answer.
 *
 * DETERMINISM
 * -----------
 * No timestamps, no absolute paths, no `usage` counters — the round files carry those and
 * they change on every regeneration. The fixture is a pure function of the accepted bytes,
 * so re-running this script over the same rounds must produce an identical file, and
 * `test/unit/byok_border_corpus.test.js` fails if it does not.
 *
 * Usage:
 *   node scripts/freeze_border_corpus.js [--from <dir>] [--out <file>] [--check]
 *
 *   --from   directory holding designs-round*.json
 *            (default temp/visual_logs/byok_svg_borders_20260927)
 *   --out    fixture path (default test/fixtures/byok_border_corpus.json)
 *   --check  do not write; exit 1 if the fixture on disk differs from a fresh freeze
 */

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/** Repo root, independent of cwd. */
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_FROM = path.join(ROOT, "temp", "visual_logs", "byok_svg_borders_20260927");
const DEFAULT_OUT = path.join(ROOT, "test", "fixtures", "byok_border_corpus.json");

/**
 * Round files in GENERATION order.
 *
 * The generator's rounds are named `<major>` optionally suffixed `<letter>` (4, 4b, 4c) —
 * the letter marks a RE-RUN of the same instruction set, which is why it must sort after
 * its major. Sorting the names as strings puts `4b` before `4`; sorting by
 * `(major, letterIndex)` puts them back in the order the model was actually asked.
 */
function roundKey(file) {
  const m = /^designs-round(\d+)([a-z]*)$/.exec(path.basename(file, ".json"));
  if (!m) return null;
  return [Number(m[1]), m[2]];
}

/** Sort key for a round label already stripped of its prefix ("4", "4b", "4c"). */
function ord(label) {
  const m = /^(\d+)([a-z]*)$/.exec(String(label));
  if (!m) return 0;
  return Number(m[1]) * 1000 + (m[2] ? m[2].charCodeAt(0) - 96 : 0);
}

/** Every accepted design in `dir`, in generation order, each tagged with its round. */
function collectRounds(dir) {  const files = fs
    .readdirSync(dir)
    .filter((f) => roundKey(f) !== null)
    .sort((a, b) => {
      const [am, al] = roundKey(a);
      const [bm, bl] = roundKey(b);
      return am - bm || (al < bl ? -1 : al > bl ? 1 : 0);
    });

  const out = [];
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const label = path.basename(f, ".json").replace("designs-round", "");
    for (const d of data.designs || []) {
      if (!d.accepted || !d.svg) continue;
      out.push({ round: label, design: d });
    }
  }
  return { files, out };
}

/** sha256 over the UTF-8 bytes — the identity a gate can name when a frame goes red. */
function sha256(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * The frozen corpus: one CANONICAL blob per id (last-accepted-wins) plus the superseded
 * variants, each carrying its own sha256 so a red frame can name its input.
 *
 * `instruction` / `criterion` are taken from the round that WON, so the criterion a design is
 * judged against is the one its frozen bytes were generated for.
 */
function buildCorpus(dir) {
  const { files, out } = collectRounds(dir);
  /** @type {Map<string, {round: string, design: object}>} */
  const lastById = new Map();
  /** @type {object[]} */
  const variants = [];
  for (const { round, design } of out) {
    const prev = lastById.get(design.id);
    if (prev) {
      // THE SUPERSEDED blob is `prev`, NOT the one being read. MEASURED DEFECT, FIXED 2026-10-01:
      // this pushed the INCOMING design, so every variant recorded the WINNER's bytes and all 8
      // "variants" hashed to a blob already in `designs` — the corpus claimed to carry 20
      // accepted artworks while holding 12, and the number that is supposed to prove "every SVG
      // created so far" was counted twice from the same string.
      variants.push({
        id: prev.design.id,
        title: prev.design.title,
        supersededByRound: null, // filled below, once the winner is known
        round: prev.round,
        svgChars: prev.design.svg.length,
        sha256: sha256(prev.design.svg),
        svg: prev.design.svg,
      });
    }
    lastById.set(design.id, { round, design });
  }
  const designs = Array.from(lastById.values()).map(({ round, design }) => ({
    id: design.id,
    title: design.title,
    instruction: design.instruction,
    criterion: design.criterion,
    model: design.model,
    round,
    svgChars: design.svg.length,
    sha256: sha256(design.svg),
    svg: design.svg,
  }));
  designs.sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const v of variants) {
    const winner = designs.find((d) => d.id === v.id);
    v.supersededByRound = winner ? winner.round : null;
  }
  variants.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : ord(a.round) - ord(b.round)));
  return { files, designs, variants };
}

function main(argv) {
  const args = { from: DEFAULT_FROM, out: DEFAULT_OUT, check: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--from") args.from = path.resolve(argv[++i]);
    else if (argv[i] === "--out") args.out = path.resolve(argv[++i]);
    else if (argv[i] === "--check") args.check = true;
    else throw new Error("unknown argument: " + argv[i]);
  }

  const { files, designs, variants } = buildCorpus(args.from);
  const payload = {
    _comment:
      "FROZEN BYOK border-design corpus. Deterministic input for the gallery gate " +
      "(test/browser_e2e/byok_border_gallery.spec.js) and the render-path unit tests. " +
      "Regenerate with `node scripts/freeze_border_corpus.js`; do NOT hand-edit. The live " +
      "generator (scripts/border_design_generator.js) is a non-deterministic free leg, so " +
      "its accepted output is frozen here or the visual gate is not a gate.",
    _source: "designs-round*.json (generation order 1, 2, 3, 4, 4b, 4c)",
    _rule: "designs = one canonical blob per id, LAST accepted wins; variants = superseded blobs",
    rounds: files,
    designs,
    variants,
  };
  const text = JSON.stringify(payload, null, 2) + "\n";

  console.log("rounds (generation order): " + files.join(", "));
  console.log("canonical designs: " + designs.length + " (last-accepted-wins per id)");
  console.log("superseded variants: " + variants.length);
  for (const d of designs) {
    console.log(
      "  " + d.id.padEnd(20) + " round " + d.round.padEnd(3) + " " +
        String(d.svgChars).padStart(5) + " chars  " + d.sha256.slice(0, 12)
    );
  }

  if (args.check) {
    const existing = fs.existsSync(args.out) ? fs.readFileSync(args.out, "utf8") : null;
    if (existing !== text) {
      console.error("CORPUS DRIFT: " + args.out + " does not match a fresh freeze");
      process.exit(1);
    }
    console.log("check OK — " + path.relative(ROOT, args.out) + " matches a fresh freeze");
    return;
  }

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, text, "utf8");
  console.log("wrote " + path.relative(ROOT, args.out) + " (" + text.length + " B)");
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { buildCorpus, collectRounds, roundKey, ord, sha256, DEFAULT_FROM, DEFAULT_OUT };
