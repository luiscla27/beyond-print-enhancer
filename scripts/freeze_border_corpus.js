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
 * across 12 corpus ids before the 2026-10-01 re-freeze (round 5 added 3 more for the three
 * ids operator ruling D-B re-prompted, so 23 blobs / 11 variants after it; the count is
 * simply "every accepted round entry", asserted by the unit suite either way) — split into
 * two arrays:
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
 * CRITERION OVERRIDES (`test/fixtures/byok_border_criteria_overrides.json`) — the ONE
 * sanctioned way to re-cut a per-design `criterion` WITHOUT regenerating the artwork. A
 * canonical id named there keeps its winning round's bytes but is judged by the override
 * text; the fixture entry then carries three fields instead of silently swapping one:
 * `criterion` (the override — what the seat judges), `criterionGenerated` (the winning
 * round's own text, preserved) and `criterionOverride` ({supersedes, ruledBy, ruledOn,
 * reason}). The override file is a freeze INPUT, so byte-reproducibility is unchanged.
 * This exists because operator ruling D-C (2026-10-01) re-cut 04-dragon-scale's criterion
 * aspect-independently while KEEPING the round-4c bytes — editing the round file would
 * falsify the generator's record, and regenerating was not what the ruling ordered.
 *
 * DETERMINISM
 * -----------
 * No timestamps, no absolute paths, no `usage` counters — the round files carry those and
 * they change on every regeneration. The fixture is a pure function of the accepted bytes,
 * so re-running this script over the same rounds must produce an identical file, and
 * `test/unit/byok_border_corpus.test.js` fails if it does not.
 *
 * LINE ENDINGS (`normalizeEol`, added 2026-10-04) — the comparison forgives the CHECKOUT, not the
 * content. This script writes `\n`; git checks the tracked fixture out with whatever the machine's
 * `core.autocrlf` says (CRLF here), so a byte comparison reds on a fresh Windows worktree/clone even
 * with a perfect corpus. `--check` therefore normalises CRLF on both sides; any content difference
 * still fails it. The attribute half (`test/fixtures/*.json -text` in `.gitattributes`) is
 * deliberately NOT used: that file is gitignored (`.gitignore:194`), so it cannot travel.
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
 * The ONE line-ending rule, applied on BOTH sides of every comparison in this script.
 *
 * WHY (MEASURED 2026-10-04, `temp/issues/ISSUE_byok_border_corpus_round1_drift_vs_frozen_fixture_20261004.md`):
 * the fixture is compared BYTE-for-byte against this CLI's `\n` output, but the tracked fixture is
 * checked out by git according to the machine's `core.autocrlf` — `true` here, so a fresh worktree
 * or clone gets 75,288 B with 308 CRs against this script's 74,980 B with 0. `/.gitattributes` is
 * the natural home for the attribute and CANNOT be used here: it is listed in `.gitignore:194`
 * (`/.gitattributes`), so it is untracked, absent from every worktree and clone, and an edit there
 * fixes exactly one machine. The comparison is the half that travels with the repository.
 *
 * It forgives the CHECKOUT's line endings and nothing else: any content difference still fails, so
 * `--check` cannot go green over a drifted corpus (proved by the negative control in
 * `test/unit/byok_border_corpus.test.js`).
 */
function normalizeEol(text) {
  return text.replace(/\r\n/g, "\n");
}

const OVERRIDES_PATH = path.join(ROOT, "test", "fixtures", "byok_border_criteria_overrides.json");

/**
 * The sanctioned criterion overrides (see the docstring). Missing file -> no overrides;
 * a malformed file FAILS LOUDLY rather than silently dropping a ruling on the floor.
 */
function loadOverrides() {
  if (!fs.existsSync(OVERRIDES_PATH)) return {};
  const raw = JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));
  const ov = raw && raw.overrides;
  if (ov === undefined || ov === null) return {};
  if (typeof ov !== "object" || Array.isArray(ov)) {
    throw new Error("criterion overrides file has a non-object `overrides` member: " + OVERRIDES_PATH);
  }
  return ov;
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
  const overrides = loadOverrides();
  const designs = Array.from(lastById.values()).map(({ round, design }) => {
    const entry = {
      id: design.id,
      title: design.title,
      instruction: design.instruction,
      criterion: design.criterion,
    };
    // Criterion override (operator ruling, e.g. D-C): the BYTES stay the winning round's;
    // the judged TEXT comes from the overrides file, and both texts plus the provenance
    // ride on the entry so nothing is silently swapped.
    const ov = overrides[design.id];
    if (ov && ov.criterion) {
      entry.criterionGenerated = design.criterion;
      entry.criterionOverride = {
        supersedes: typeof ov.supersedes === "string" ? ov.supersedes : design.criterion,
        ruledBy: ov.ruledBy || null,
        ruledOn: ov.ruledOn || null,
        reason: ov.reason || null,
      };
      entry.criterion = ov.criterion;
    }
    entry.model = design.model;
    entry.round = round;
    entry.svgChars = design.svg.length;
    entry.sha256 = sha256(design.svg);
    entry.svg = design.svg;
    return entry;
  });
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
    _source:
      "designs-round*.json (generation order) + test/fixtures/byok_border_criteria_overrides.json "
      + "(criterion overrides, the sanctioned way to re-cut a judged TEXT without touching the bytes)",
    _rule:
      "designs = one canonical blob per id, LAST accepted wins; variants = superseded blobs; "
      + "a canonical id named in the overrides file carries criterion=override + "
      + "criterionGenerated (the winning round's own text) + "
      + "criterionOverride {supersedes, ruledBy, ruledOn, reason}",
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
        String(d.svgChars).padStart(5) + " chars  " + d.sha256.slice(0, 12) +
        (d.criterionOverride ? "  [criterion override by " + d.criterionOverride.ruledBy + "]" : "")
    );
  }

  if (args.check) {
    const existing = fs.existsSync(args.out) ? fs.readFileSync(args.out, "utf8") : null;
    // EOL-insensitive on BOTH sides (see normalizeEol): a CRLF checkout of the fixture is not
    // "CORPUS DRIFT", a content difference still is.
    if (existing === null || normalizeEol(existing) !== normalizeEol(text)) {
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

module.exports = { buildCorpus, collectRounds, roundKey, ord, sha256, normalizeEol, DEFAULT_FROM, DEFAULT_OUT };
