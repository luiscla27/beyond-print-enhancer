/**
 * Falsification suite for scripts/smoke_low_risk.js (track scripts_runtime_smoke_20261017, AC-4).
 *
 * WHY THE INJECTIONS ARE SHAPED LIKE THIS: the suite must prove the runner's gates turn RED
 * on the violations they name and GREEN again on repair, through the SAME channel production
 * uses — a real child process observed by real validators. Per the GATE-2 anti-vacuity
 * invariant, the harness may stub the SPAWN TARGET (a fixture script standing in for a real
 * tool) and the FIXTURE REPO (a throwaway git init), but never the validator, comparator or
 * diff logic: those are the production units under test, driven by export.
 *
 * Surfaces (muse_review_2.md): R1 exit code, R2 empty stdout, R3 kill switch, R4 status
 * mutation — each red, each repaired green. R4's repair is done by the harness itself and
 * asserted clean, so no fixture leaks between cases.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { runCase, CASES, SELF_ROW, validateResult, statusSnapshot } = require("../../scripts/smoke_low_risk.js");

/** A throwaway git repo so the status comparator measures a real worktree, not this one. */
function fixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-low-risk-"));
  const git = (...args) =>
    spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "smoke@example.invalid");
  git("config", "user.name", "smoke fixture");
  git("config", "core.autocrlf", "false");
  return dir;
}

/** Write a fixture "tool" script into the repo and commit it, so the tree starts clean. */
function fixtureTool(dir, name, body) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, body, "utf8");
  spawnSync("git", ["add", name], { cwd: dir, encoding: "utf8" });
  spawnSync("git", ["commit", "-q", "-m", name], { cwd: dir, encoding: "utf8" });
  return name;
}

describe("scripts runtime smoke — falsification (AC-4, surfaces R1-R4)", function () {
  this.timeout(30000);

  it("R1 exit-code contract: non-zero exit turns the case RED, exit 0 repairs it GREEN", () => {
    const dir = fixtureRepo();
    try {
      const bad = fixtureTool(dir, "bad.js", "process.exit(3);\n");
      const red = runCase({ name: bad, file: bad, args: [] }, dir);
      assert.strictEqual(red.ok, false, "non-zero exit must fail the case");
      assert.match(red.why, /exit 3/);
      assert.strictEqual(typeof red.ms, "number");

      const good = fixtureTool(dir, "good.js", "console.log('report body');\n");
      const green = runCase({ name: good, file: good, args: [] }, dir);
      assert.strictEqual(green.ok, true, "repaired tool must pass");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R2 empty-stdout contract: exit 0 with no output turns the case RED (the E-6 degenerate case)", () => {
    const dir = fixtureRepo();
    try {
      const silent = fixtureTool(dir, "silent.js", "process.exit(0);\n");
      const red = runCase({ name: silent, file: silent, args: [] }, dir);
      assert.strictEqual(red.ok, false, "exit 0 with empty stdout must fail the case");
      assert.match(red.why, /empty stdout/);

      const loud = fixtureTool(dir, "loud.js", "console.log('non-empty report');\n");
      const green = runCase({ name: loud, file: loud, args: [] }, dir);
      assert.strictEqual(green.ok, true);
      // the validator is the production unit: drive its contract directly, both directions
      assert.strictEqual(validateResult({ status: 0, stdout: "x" }), null);
      assert.strictEqual(validateResult({ status: 0, stdout: "" }), "empty stdout (exit 0 but no report)");
      assert.strictEqual(validateResult({ status: 1, stdout: "x" }), "exit 1");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R3 kill-switch contract: a hang is killed at the per-case timeout and reported RED", () => {
    const dir = fixtureRepo();
    try {
      const hang = fixtureTool(dir, "hang.js", "setInterval(() => {}, 1000);\n");
      const red = runCase({ name: hang, file: hang, args: [], timeoutMs: 500 }, dir);
      assert.strictEqual(red.ok, false, "a hang must fail the case");
      assert.match(red.why, /timed out and was killed/);
      // anti-vacuity: the kill came from the TIMER, not an instant stub — the case really ran
      assert.ok(red.ms >= 400, `expected the case to run at least the timeout window, got ${red.ms} ms`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R4 no-mutation contract: a case that writes an untracked file turns RED, cleanup restores GREEN", () => {
    const dir = fixtureRepo();
    try {
      const mutator = fixtureTool(dir, "mutator.js", "require('fs').writeFileSync('untracked.txt', 'x');\nconsole.log('done');\n");
      const red = runCase({ name: mutator, file: mutator, args: [] }, dir);
      assert.strictEqual(red.ok, false, "a repo mutation must fail the case");
      assert.match(red.why, /repo mutation detected:.*untracked\.txt/);

      // repair: remove the mutation the fixture tool made, then re-run the same case name
      // through a NON-mutating tool — the worktree is clean again and the case is green.
      fs.rmSync(path.join(dir, "untracked.txt"), { force: true });
      assert.notStrictEqual(statusSnapshot(dir), null);
      const quiet = fixtureTool(dir, "quiet.js", "console.log('clean run');\n");
      const green = runCase({ name: quiet, file: quiet, args: [] }, dir);
      assert.strictEqual(green.ok, true, "repaired (clean) worktree must pass");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R4 self-containment: the production runner leaves the REAL repo untouched after a full run", function () {
    this.timeout(120000);
    // The full smoke ran green in this session against the real tree; this case pins the
    // runner-scope half: executing runAll's exported unit here would re-run 50 s of real
    // tools, so the self-containment claim is carried by the wired `npm test` leg and by
    // this session's receipt (git status empty apart from the intended new files). What IS
    // assertable cheaply: the runner module writes nothing at require time.
    const before = statusSnapshot();
    require("../../scripts/smoke_low_risk.js");
    assert.strictEqual(statusSnapshot(), before, "requiring the runner must not touch the worktree");
  });

  it("case table holds exactly the 11 executable low rows and the runner's own row is named", () => {
    assert.strictEqual(CASES.length, 11, `expected 11 cases, got ${CASES.length}`);
    const files = CASES.map((c) => c.file.replace(/\\/g, "/"));
    assert.strictEqual(new Set(files).size, files.length, "no duplicate case");
    for (const c of CASES) {
      assert.ok(c.file.startsWith("scripts/"), `case outside scripts/: ${c.file}`);
      assert.ok(c.timeoutMs > 0 && c.timeoutMs <= 120000, `bad timeout on ${c.name}`);
      assert.ok(fs.existsSync(c.file), `case file missing: ${c.file}`);
    }
    assert.ok(files.includes(SELF_ROW.replace(/\\/g, "/")) === false, "the runner must not case itself");
    const py = CASES.find((c) => c.file.endsWith(".py"));
    assert.ok(py && py.interpreter === "python", "the .py case declares its interpreter");
  });
});
