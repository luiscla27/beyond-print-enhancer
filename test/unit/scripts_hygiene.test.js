/**
 * Guard test for scripts/check_scripts_hygiene.js (track scripts_inventory_hygiene_20261014).
 *
 * WHY THE FALSIFICATION HALF IS HERE AND NOT IN PROSE: the check's whole claim is that the inventory
 * cannot drift from the repository unnoticed, and a guard that cannot fail is the defect class this
 * project has already rebuilt two gates over. So every arm is exercised against a FIXTURE git repo
 * built inside the test - a real `git init`, a real `git add` - and each arm is shown to fail on the
 * violation it names and to go green again when the fixture is repaired. The last case pins the
 * exec-bit arm's INERT state on this repository, so the one arm that is advisory here cannot quietly
 * disappear from the output (its activation condition is stated in the check's own header).
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
  INVENTORY,
} = require("../../scripts/check_scripts_hygiene.js");

const ROOT = path.resolve(__dirname, "..", "..");

/** A throwaway git repo: `scripts/` with the given files, plus the inventory rows for them. */
function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scripts-hygiene-"));
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
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
  });
});
