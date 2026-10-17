/**
 * Guard test for scripts/check_scripts_hygiene.js (tracks scripts_inventory_hygiene_20261014 and
 * scripts_inventory_hygiene_20261017).
 *
 * WHY THE FALSIFICATION HALF IS HERE AND NOT IN PROSE: the check's whole claim is that the inventory
 * cannot drift from the repository unnoticed, and a guard that cannot fail is the defect class this
 * project has already rebuilt two gates over. So every arm is exercised against a FIXTURE git repo
 * built inside the test - a real `git init`, a real `git add` - and each arm is shown to fail on the
 * violation it names and to go green again when the fixture is repaired. The last case pins the
 * exec-bit arm's INERT state on this repository, so the one arm that is advisory here cannot quietly
 * disappear from the output (its activation condition is stated in the check's own header).
 *
 * THE TWO ARMS ADDED 2026-10-17 ARE TESTED THE SAME WAY, and for a measured reason: the composition
 * arm exists because the inventory's declared shape was FALSE in three of four classes for two cycles
 * while every other arm was green, and the Python arm exists because no gate in this repository read a
 * .py file at all. A happy-path test would have reproduced both blind spots, so each new case drives
 * the violation, repairs it, and requires green - and the interpreter-absent path is driven by PASSING
 * names that cannot resolve, rather than by hoping the host has no Python.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  check,
  parseInventory,
  headerProblem,
  shebangProblem,
  parseComposition,
  compositionOf,
  compositionProblems,
  pythonSyntax,
  INVENTORY,
} = require("../../scripts/check_scripts_hygiene.js");

const ROOT = path.resolve(__dirname, "..", "..");
const PY_SHEBANG = "#!/usr/bin/env python3";

/**
 * Rewrite the fixture's declared shape from its own tracked set — the same derivation the guard's arm
 * 5 does, in four lines. A fixture that changes its file set calls this, exactly as a real edit to the
 * inventory must: the declaration is a claim about the repository, so it moves when the repository does.
 */
function reshape(dir) {
  const tracked = spawnSync("git", ["ls-files", "scripts"], { cwd: dir, encoding: "utf8" })
    .stdout.split("\n").map((s) => s.trim()).filter(Boolean);
  const classes = {};
  for (const rel of tracked) {
    const ext = path.extname(rel).replace(/^\./, "");
    classes[ext] = (classes[ext] || 0) + 1;
  }
  const declared = Object.keys(classes).sort()
    .map((k) => `${classes[k]} \`.${k}\``).join(", ");
  const file = path.join(dir, INVENTORY);
  const text = fs.readFileSync(file, "utf8");
  const shape = `**${tracked.length} file${tracked.length === 1 ? "" : "s"}**: ${declared}.`;
  const rewritten = /\*\*\d+ files?\*\*:[^\n]*/.test(text)
    ? text.replace(/\*\*\d+ files?\*\*:[^\n]*/, shape)
    : `${text.trimEnd()}\n\n${shape}\n`;
  fs.writeFileSync(file, rewritten, "utf8");
}

/** A throwaway git repo: `scripts/` with the given files, plus the inventory rows for them. */
function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scripts-hygiene-"));
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body, "utf8");
  }
  const rows = Object.keys(files).map((rel) =>
    `| \`${rel}\` | purpose | \`node ${rel}\` | node | low |`);
  fs.writeFileSync(path.join(dir, INVENTORY),
    `# fixture\n\n| path | purpose | invocation | runtime / dependencies | risk |\n` +
    `| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n`, "utf8");
  const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("add", ".");
  reshape(dir);
  return dir;
}

const GOOD_JS = `${"#!/usr/bin/env node"}\n// good.js - a fixture script with a purpose header.\n"use strict";\n`;
const GOOD_PY = `${"#!/usr/bin/env python3"}\n"""good.py - a fixture script with a module docstring."""\n`;

describe("scripts hygiene guard", function () {
  describe("the repository as delivered", function () {
    it("passes: the inventory and the tracked surface agree in both directions", function () {
      const { failures } = check(ROOT);
      assert.deepStrictEqual(failures, [], "scripts hygiene:\n" + failures.join("\n"));
    });

    it("judges every documented script individually, so a failure names the file", function () {
      const doc = fs.readFileSync(path.join(ROOT, INVENTORY), "utf8");
      const { rows, problems } = parseInventory(doc);
      assert.deepStrictEqual(problems, [], "inventory row shape:\n" + problems.join("\n"));
      assert.ok(rows.length >= 50, `only ${rows.length} rows parsed from ${INVENTORY}`);
      for (const row of rows) {
        if (!/\.(js|py)$/.test(row.path)) continue;
        const body = fs.readFileSync(path.join(ROOT, row.path), "utf8");
        assert.strictEqual(headerProblem(row.path, body), null);
        assert.strictEqual(shebangProblem(row.path, body), null);
      }
    });

    it("reports the exec bit as NOT TRACKED rather than silently skipping that arm", function () {
      const { advisories } = check(ROOT);
      assert.ok(
        advisories.some((a) => a.includes("exec bit") && a.includes("NOT TRACKED")),
        "the inert exec-bit arm must say so on every run: " + JSON.stringify(advisories),
      );
    });
  });

  describe("falsified on a fixture repository", function () {
    it("goes green on a clean fixture (the control)", function () {
      const dir = fixture({ "scripts/good.js": GOOD_JS, "scripts/good.py": GOOD_PY });
      assert.deepStrictEqual(check(dir).failures, []);
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("FAILS on a tracked script with no inventory row", function () {
      const dir = fixture({ "scripts/good.js": GOOD_JS });
      fs.writeFileSync(path.join(dir, "scripts", "added.js"), GOOD_JS, "utf8");
      spawnSync("git", ["add", "scripts/added.js"], { cwd: dir });
      const { failures } = check(dir);
      assert.ok(failures.some((f) => f.includes("scripts/added.js") && f.includes("NO row")),
        "expected a missing-row failure, got " + JSON.stringify(failures));
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("FAILS on a stale row, and goes green again once the file is restored", function () {
      const dir = fixture({ "scripts/good.js": GOOD_JS });
      fs.writeFileSync(path.join(dir, INVENTORY),
        fs.readFileSync(path.join(dir, INVENTORY), "utf8") +
        "| `scripts/deleted.js` | purpose | `node x` | node | low |\n", "utf8");
      const { failures } = check(dir);
      assert.ok(failures.some((f) => f.includes("scripts/deleted.js") && f.includes("stale")),
        "expected a stale-row failure, got " + JSON.stringify(failures));
      fs.writeFileSync(path.join(dir, "scripts", "deleted.js"), GOOD_JS, "utf8");
      spawnSync("git", ["add", "scripts/deleted.js"], { cwd: dir });
      reshape(dir);   // the tracked set moved, so the inventory's own shape claim moves with it
      assert.deepStrictEqual(check(dir).failures, []);
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("FAILS on a missing purpose header, and on a wrong shebang", function () {
      const dir = fixture({
        "scripts/noheader.js": `${"#!/usr/bin/env node"}\nconst a = 1;\n`,
        "scripts/noshebang.js": `// has a header, no shebang\n"use strict";\n`,
      });
      const { failures } = check(dir);
      assert.ok(failures.some((f) => f.includes("scripts/noheader.js") && f.includes("purpose header")),
        JSON.stringify(failures));
      assert.ok(failures.some((f) => f.includes("scripts/noshebang.js") && f.includes("line 1")),
        JSON.stringify(failures));
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("FAILS on a risk column outside low/medium/high, and on a short row", function () {
      const dir = fixture({ "scripts/good.js": GOOD_JS });
      fs.writeFileSync(path.join(dir, INVENTORY),
        "# fixture\n\n| path | purpose | invocation | runtime / dependencies | risk |\n" +
        "| --- | --- | --- | --- | --- |\n" +
        "| `scripts/good.js` | purpose | `node x` | node | SPICY |\n" +
        "| `scripts/good.js` | purpose | node |\n", "utf8");
      const { failures } = check(dir);
      assert.ok(failures.some((f) => f.includes("risk column") && f.includes("SPICY")),
        JSON.stringify(failures));
      assert.ok(failures.some((f) => f.includes("columns, expected")), JSON.stringify(failures));
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("names a new, untracked script as an ADVISORY, not a failure", function () {
      const dir = fixture({ "scripts/good.js": GOOD_JS });
      fs.writeFileSync(path.join(dir, "scripts", "brand-new.js"), GOOD_JS, "utf8");
      const { failures, advisories } = check(dir);
      assert.deepStrictEqual(failures, []);
      assert.ok(advisories.some((a) => a.includes("brand-new.js")), JSON.stringify(advisories));
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("does NOT report a DIRECTORY under scripts/ as an undocumented entry", function () {
      // The counterexample is the real repository's own `scripts/perf/`: 12 tracked, rowed files, and
      // the arm still said "neither tracked nor documented: perf" — a directory is not a row-able
      // entry, and the row->file comparison already walks every tracked path at any depth.
      const dir = fixture({ "scripts/good.js": GOOD_JS, "scripts/perf/helper.js": GOOD_JS });
      const clean = check(dir);
      assert.deepStrictEqual(clean.failures, []);
      assert.ok(!clean.advisories.some((a) => a.includes("neither tracked nor documented")),
        "a directory must not be reported as an undocumented entry: " + JSON.stringify(clean.advisories));
      // ...and the arm still fires for an untracked FILE beside it, so skipping directories did not
      // silence the check it exists for.
      fs.writeFileSync(path.join(dir, "scripts", "loose.js"), GOOD_JS, "utf8");
      const dirty = check(dir);
      assert.ok(dirty.advisories.some((a) => a.includes("neither tracked nor documented")
        && a.includes("loose.js")), JSON.stringify(dirty.advisories));
      fs.rmSync(dir, { recursive: true, force: true });
    });

    // --- arm 5 (composition) and arm 6 (python syntax), added by scripts_inventory_hygiene_20261017 ---
    // Both arms exist because the measured defect they name was invisible: the inventory's declared
    // shape was false in three of four classes for two cycles (every other arm green), and no gate in
    // the repository read a .py file at all. A falsification that only checks the happy path would
    // reproduce that: each case below drives the violation, then repairs it and requires green.

    it("FAILS when the declared shape disagrees with the tracked set, and goes green when repaired", function () {
      const dir = fixture({ "scripts/good.js": GOOD_JS, "scripts/good.py": GOOD_PY });
      const file = path.join(dir, INVENTORY);
      const honest = fs.readFileSync(file, "utf8");
      // The exact defect measured in the real inventory: the total is right, a class count is not.
      fs.writeFileSync(file, honest.replace(/\*\*2 files\*\*:[^\n]*/,
        "**2 files**: 1 `.js`, 4 `.py`."), "utf8");
      const { failures } = check(dir);
      assert.ok(failures.some((f) => f.includes("shape: .py declared 4, measured 1")),
        JSON.stringify(failures));
      assert.ok(!failures.some((f) => f.includes("declared 2 files")),
        "the total is unchanged, so it must not be reported as a second finding: "
        + JSON.stringify(failures));
      fs.writeFileSync(file, honest, "utf8");
      assert.deepStrictEqual(check(dir).failures, []);
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("FAILS when the inventory states no shape at all, so deleting the sentence cannot disarm the arm", function () {
      const dir = fixture({ "scripts/good.js": GOOD_JS });
      const file = path.join(dir, INVENTORY);
      fs.writeFileSync(file,
        fs.readFileSync(file, "utf8").replace(/\*\*1 file\*\*:[^\n]*\n?/, ""), "utf8");
      const { failures } = check(dir);
      assert.ok(failures.some((f) => f.includes("states no shape sentence")), JSON.stringify(failures));
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("FAILS on a .py that does not parse, and goes green when it is repaired", function () {
      const dir = fixture({ "scripts/good.py": GOOD_PY });
      const broken = `${PY_SHEBANG}\n"""broken.py - a fixture with a syntax error."""\ndef f(:\n`;
      assert.deepStrictEqual(check(dir).failures, [], "the control must be green first");
      fs.writeFileSync(path.join(dir, "scripts", "good.py"), broken, "utf8");
      const { failures, advisories } = check(dir);
      if (advisories.some((a) => a.includes("python syntax: NOT CHECKED"))) {
        fs.rmSync(dir, { recursive: true, force: true });
        return this.skip();   // no interpreter on this host: the advisory path is covered below
      }
      assert.ok(failures.some((f) => f.includes("scripts/good.py") && f.includes("python syntax")),
        JSON.stringify(failures));
      fs.writeFileSync(path.join(dir, "scripts", "good.py"), GOOD_PY, "utf8");
      assert.deepStrictEqual(check(dir).failures, []);
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("reports an ADVISORY, never a failure, when no interpreter answers", function () {
      const dir = fixture({ "scripts/good.py": GOOD_PY });
      const { failures, advisories } = check(dir, { pythonInterpreters: ["python-not-installed-xyz"] });
      assert.deepStrictEqual(failures, [], "an absent optional interpreter is not a defect in the tree");
      assert.ok(advisories.some((a) => a.includes("python syntax: NOT CHECKED")
        && a.includes("python-not-installed-xyz")), JSON.stringify(advisories));
      // ...and the arm says what it did NOT cover, so a green run cannot be read as parsed
      assert.ok(advisories.some((a) => a.includes("unparsed by every gate")), JSON.stringify(advisories));
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("the pure rules", function () {
    it("accepts a directive prologue followed by a comment, rejects code first", function () {
      assert.strictEqual(headerProblem("scripts/a.js", `"use strict";\n// why\nconst a = 1;\n`), null);
      assert.strictEqual(headerProblem("scripts/b.js", `${"#!/usr/bin/env node"}\n/* why */\n`), null);
      assert.match(headerProblem("scripts/c.js", `const a = 1;\n// why\n`), /purpose header/);
    });

    it("accepts a Python module docstring or comment, rejects an import", function () {
      assert.strictEqual(headerProblem("scripts/a.py", `"""why"""\nimport os\n`), null);
      assert.strictEqual(headerProblem("scripts/b.py", `# why\nimport os\n`), null);
      assert.match(headerProblem("scripts/c.py", `import os\n`), /module\s+docstring/);
    });

    it("requires the declared interpreter on line 1", function () {
      assert.strictEqual(shebangProblem("scripts/a.js", `${"#!/usr/bin/env node"}\n`), null);
      assert.match(shebangProblem("scripts/b.js", `${"#!/usr/bin/env python3"}\n`), /expected/);
      assert.strictEqual(shebangProblem("scripts/c.py", `${"#!/usr/bin/env python3"}\n`), null);
      assert.match(shebangProblem("scripts/d.py", `${"#!/usr/bin/env python"}\n`), /expected/);
    });

    it("reads the declared shape from its wording, not from a line number", function () {
      assert.deepStrictEqual(parseComposition("… **66 files**: 48 `.js`, 9 `.py`, 3 `.json`, 6 `.md`."),
        { total: 66, classes: { js: 48, py: 9, json: 3, md: 6 } });
      // re-flowed across lines is still one sentence to a reader, so it must still parse
      assert.deepStrictEqual(parseComposition("**1 file**: 1 `.js`."), { total: 1, classes: { js: 1 } });
      assert.strictEqual(parseComposition("no numbers here"), null);
    });

    it("counts the tracked set by extension, and names every difference", function () {
      assert.deepStrictEqual(compositionOf(["scripts/a.js", "scripts/perf/b.js", "scripts/c.py"]),
        { total: 3, classes: { js: 2, py: 1 } });
      const problems = compositionProblems(
        "**3 files**: 2 `.js`, 2 `.py`.", ["scripts/a.js", "scripts/perf/b.js", "scripts/c.py"]);
      assert.deepStrictEqual(problems, ["shape: .py declared 2, measured 1"]);
      // a class the tree has and the sentence omits is a difference too, not a silent pass
      assert.deepStrictEqual(compositionProblems("**1 file**: 1 `.js`.",
        ["scripts/a.js", "scripts/b.md"]),
      ["shape: declared **1 files**, measured 2 tracked path(s) - the sentence and `git ls-files scripts` disagree",
        "shape: .md declared no count, measured 1"]);
    });

    it("compiles python through the interpreter it is given, and reports which one answered", function () {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scripts-hygiene-py-"));
      fs.writeFileSync(path.join(dir, "ok.py"), `${PY_SHEBANG}\n"""ok"""\nx = 1\n`, "utf8");
      fs.writeFileSync(path.join(dir, "bad.py"), `${PY_SHEBANG}\n"""bad"""\ndef f(:\n`, "utf8");
      const broken = pythonSyntax(dir, ["ok.py", "bad.py"], ["python3", "python"]);
      if (broken.advisory.includes("NOT CHECKED")) {
        fs.rmSync(dir, { recursive: true, force: true });
        return this.skip();   // no interpreter on this host: covered by the advisory case above
      }
      assert.strictEqual(broken.failures.length, 1, JSON.stringify(broken.failures));
      assert.ok(broken.failures[0].includes("bad.py") && broken.failures[0].includes("arm 6"));
      assert.match(broken.advisory, /2 file\(s\) compiled via `(python3|python)` \(\d+\.\d+/);
      // compiling must not leave a bytecode cache behind: this is a read-only gate
      assert.deepStrictEqual(fs.readdirSync(dir).sort(), ["bad.py", "ok.py"]);
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });
});
