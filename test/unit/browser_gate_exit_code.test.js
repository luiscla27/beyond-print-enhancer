/**
 * The browser gate's EXIT CODE must agree with its own artifact — and the inventory generator must
 * survive a spec that logs while being required.
 *
 * WHY THESE TWO, TOGETHER (fresh audit 2026-10-28, findings 1-3).
 *
 * The gate's header opens with "a runner that exits 0 because it reached its own end is the defect";
 * that is the class this file exists to keep closed. It was NOT closed:
 *
 *   - `scripts/browser_gate.js` computed an exit code, then called `process.exit(exit)` AFTER the
 *     try/finally. Every rejection path in the body (collection mismatch, execution-coverage
 *     failure) ends with `return`, and a `return` inside `try` skips everything after the block. So
 *     those paths wrote an artifact saying `green: false, exit_code: 1`, printed "(NOT green)", and
 *     then let the process end 0. MEASURED before the fix: `--inventory <stale>` → COLLECTION
 *     mismatch, `REAL_EXIT=0`. A CI job, a release script, or a scheduler reading the exit status
 *     saw a pass over a suite that never executed — which is also how the committed inventory went
 *     stale for a whole release without anyone noticing (finding 1).
 *
 *   - and the tool that exists to REFRESH that inventory could not run at all: a gallery spec
 *     printed its corpus banner at require time, so `mocha --dry-run --reporter json`'s stdout was
 *     not JSON, and `gen_spec_inventory.js` died in `JSON.parse`. That is why "regenerate the
 *     inventory" was not an available move (finding 3).
 *
 * So this file pins BOTH ends of the same failure, in a fixture repo where each half is plantable:
 *
 *   1. a stale inventory makes the gate exit NON-ZERO while its artifact says not-green;
 *   2. a spec that logs at require time STILL lets the inventory be regenerated (the class fix in
 *      `gen_spec_inventory.js`, not just the one spec that happened to log);
 *   3. and the gate on that regenerated inventory is GREEN — so 1 and 2 are not passing because the
 *      gate always fails or the generator always writes something.
 *
 * Falsification rule for this file: if case 1 ever passes with exit 0, the gate has regressed to the
 * defect it names. If case 2 ever passes while `extractJson` is a bare `JSON.parse`, the fixture has
 * stopped planting the corruption (the banner is unconditional below, on purpose).
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const GATE = path.join(ROOT, "scripts", "browser_gate.js");
const GEN = path.join(ROOT, "scripts", "gen_spec_inventory.js");

/** A spec file that prints AT REQUIRE TIME — the exact shape that broke the generator. */
const BANNER = 'console.log("fixture banner: printed while mocha was requiring this file");\n';
const SPEC = (withBanner) =>
  (withBanner ? BANNER : "") +
  'describe("fixture spec", function () {\n' +
  '  it("passes", function () {});\n' +
  "});\n";

/**
 * Build a throwaway repo-shaped tree with the two scripts copied in, one spec file, and a
 * `node_modules` junction so the copied gate can launch the REAL mocha. `fixtureRoot` is only used
 * by the scripts themselves (both resolve paths from their own location), so nothing here touches
 * the real `test/browser_e2e/`.
 */
function fixture({ withBanner = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "browsergate-exit-"));
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.copyFileSync(GATE, path.join(dir, "scripts", "browser_gate.js"));
  fs.copyFileSync(GEN, path.join(dir, "scripts", "gen_spec_inventory.js"));
  fs.mkdirSync(path.join(dir, "test", "browser_e2e"), { recursive: true });
  fs.writeFileSync(path.join(dir, "test", "browser_e2e", "sample.spec.js"), SPEC(withBanner));
  // The gate resolves mocha from ITS OWN root, so the fixture needs one. A junction needs no
  // privilege on Windows and keeps the real node_modules as the single source of the dependency.
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"), "junction");
  return dir;
}

const PENDING_MAP = {
  expected: { case_count: 0, stats: { tests: 1, passes: 1, pending: 0, failures: 0 } },
  by_spec_file: {},
};

/** An inventory that expects a spec file the fixture does not have — a STALE manifest. */
function writeStaleInventory(dir) {
  fs.writeFileSync(
    path.join(dir, "test", "browser_e2e", "spec_inventory.json"),
    JSON.stringify(
      {
        expected: { loaded_js_files: 2, spec_files: 2, tests_collected: 7 },
        spec_files: [
          { file: "sample.spec.js", tests: 1 },
          { file: "gone.spec.js", tests: 6 },
        ],
        loader_only_files: [],
      },
      null,
      2,
    ),
  );
}

function writePendingMap(dir) {
  fs.writeFileSync(
    path.join(dir, "test", "browser_e2e", "spec_pending.json"),
    JSON.stringify(PENDING_MAP, null, 2),
  );
}

function runGate(dir, tag) {
  const artifacts = path.join(dir, "temp", "art-" + tag);
  const res = spawnSync(
    process.execPath,
    [path.join(dir, "scripts", "browser_gate.js"), "--artifacts-dir", artifacts],
    { cwd: dir, encoding: "utf8", timeout: 240000 },
  );
  const artifactPath = path.join(artifacts, "artifact.json");
  const artifact = fs.existsSync(artifactPath)
    ? JSON.parse(fs.readFileSync(artifactPath, "utf8"))
    : null;
  return { res, artifact, artifacts };
}

describe("The browser gate's exit code — it must never say PASS by reaching its own end", function () {
  this.timeout(300000);

  it("exits NON-ZERO on a COLLECTION mismatch, and its artifact agrees (finding 2)", function () {
    const dir = fixture();
    writeStaleInventory(dir);
    writePendingMap(dir);
    const { res, artifact } = runGate(dir, "stale");

    assert.ok(artifact, "the gate must write an artifact even when it refuses — got none");
    assert.strictEqual(
      artifact.collection.status,
      "mismatch",
      "the fixture must plant a collection mismatch, or this case proves nothing: " +
        JSON.stringify(artifact.collection),
    );
    assert.strictEqual(artifact.green, false, "a mismatched collection is not green");
    assert.strictEqual(artifact.exit_code, 1, "the artifact records the failure");
    // THE ASSERTION THIS FILE EXISTS FOR. Before the fix this was 0 (MEASURED): the collection
    // path ends in `return`, and the `process.exit(exit)` after the try/finally never ran.
    assert.strictEqual(
      res.status,
      1,
      "the process exit code must be 1 (the artifact's own number), not 0. " +
        "stderr: " + JSON.stringify((res.stderr || "").slice(0, 400)),
    );
  });

  it("regenerates the inventory even when a spec logs at REQUIRE time (finding 3, the class)", function () {
    const dir = fixture({ withBanner: true });
    const gen = spawnSync(process.execPath, [path.join(dir, "scripts", "gen_spec_inventory.js")], {
      cwd: dir,
      encoding: "utf8",
      timeout: 240000,
    });
    assert.strictEqual(
      gen.status,
      0,
      "the generator must survive a banner printed during require — that is what made the " +
        "inventory unreachable. stderr: " + JSON.stringify((gen.stderr || "").slice(0, 500)),
    );
    const inv = JSON.parse(
      fs.readFileSync(path.join(dir, "test", "browser_e2e", "spec_inventory.json"), "utf8"),
    );
    assert.strictEqual(inv.expected.spec_files, 1, "the fixture has exactly one spec file");
    assert.strictEqual(inv.expected.tests_collected, 1, "and it collects exactly one case");
    assert.deepStrictEqual(
      inv.spec_files.map((f) => f.file),
      ["sample.spec.js"],
      "the collected set is recorded, not an empty or partial one",
    );
  });

  it("is GREEN on a matching inventory — so the cases above are not passing trivially", function () {
    const dir = fixture({ withBanner: true });
    writePendingMap(dir);
    const gen = spawnSync(process.execPath, [path.join(dir, "scripts", "gen_spec_inventory.js")], {
      cwd: dir,
      encoding: "utf8",
      timeout: 240000,
    });
    assert.strictEqual(gen.status, 0, "regeneration must succeed: " + (gen.stderr || ""));

    const { res, artifact } = runGate(dir, "green");
    assert.ok(artifact, "a green run must write an artifact");
    assert.strictEqual(artifact.collection.status, "ok", JSON.stringify(artifact.collection));
    assert.strictEqual(
      artifact.execution.status,
      "pass",
      "the one fixture case must execute and pass: " + JSON.stringify(artifact.execution),
    );
    assert.strictEqual(artifact.green, true, "a matching inventory + passing case is green");
    assert.strictEqual(res.status, 0, "and the process exits 0 — the honest 0 this time");
  });
});
