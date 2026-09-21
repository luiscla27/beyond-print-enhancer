/**
 * The release gate must be able to FAIL.
 *
 * Why (measured 2026-09-20): `2.1.0` shipped while the nightly browser gate was red — the 09-19 and
 * 09-20 runs never EXECUTED at all (collection mismatched over a spec file the committed inventory did
 * not list, so the arrange suite that IS that release's evidence ran zero cases), and the 09-17 run
 * before them failed `manual_verification_phase0`. Nothing compared any of that against a release, so
 * `scripts/release_gate.js` exists. A check nobody can skip is worth nothing unless it can be shown to
 * refuse: `test/unit/housekeeping_guard.test.js` is this file's direct ancestor in shape for exactly
 * that reason — a guard that printed OK whatever the tree contained had two archived-late issues
 * behind it (`temp/archived/ISSUE_housekeeping_guard_vacuous_root_20260910.md`).
 *
 * The three layers, all asserted here:
 *   1. the LINK: `npm run release:check` exists and points at the real script, and the script exists;
 *   2. each finding FIRES on a synthetic artifact (R0, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10);
 *   3. the same machinery PASSES on a synthetic green — so case 2 is not passing because the gate
 *      always fails. That is the half that makes the other halves mean anything.
 *
 * Everything runs in a temp directory against fixture artifacts; nothing here executes the browser
 * suite, touches `test/browser_e2e/`, or depends on `temp/` existing in a fresh clone.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "release_gate.js");
const REQUIRED_SPEC = "byok_arrange_roundtrip.spec.js";

describe("The release gate — the link, and the eleven findings it can name", function () {
  this.timeout(120000);

  it("the script exists and is syntactically valid", function () {
    assert.ok(fs.existsSync(SCRIPT), "scripts/release_gate.js must exist — the link is worthless without it");
    assert.strictEqual(fs.readFileSync(SCRIPT, "utf8").trim().length > 3000, true,
      "the gate is a real implementation, not a stub");
  });

  it("package.json LINKS a release step to the gate (the half that was missing for 2.1.0)", function () {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    assert.ok(pkg.scripts["release:check"], "a `release:check` script must exist");
    assert.ok(/node\s+scripts\/release_gate\.js/.test(pkg.scripts["release:check"]),
      "release:check must invoke scripts/release_gate.js, got: " + pkg.scripts["release:check"]);
    // It must not be wired INTO `npm test` — the gate reads run evidence that needs the 88-minute
    // browser suite, so folding it into the fast gate would make every fresh clone red. Pin that too.
    assert.ok(!/release_gate/.test(pkg.scripts.test || ""),
      "npm test must NOT run the release gate (it needs a browser-suite artifact to exist)");
    assert.ok(!pkg.scripts.pretest.includes("release_gate"), "nor may pretest");
  });

  it("the README documents the release step, so the link is discoverable", function () {
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
    assert.ok(/npm run release:check/.test(readme),
      "README must show `npm run release:check` — an unenforced link is a remembered one");
    assert.ok(/release_gate/.test(readme), "README must name the script it runs");
  });

  // --------------------------------------------------------------------------- harness
  // Build a throwaway repo-shaped tree: scripts/ holds a copy of the gate (so ROOT resolves inside
  // the fixture), with test/browser_e2e/spec_inventory.json, temp/browser_gate/scheduled/ and js/.
  // The gate's required surface is read from the script itself (--print-required) rather than
  // re-typed here, so the fixture can never drift from what the gate actually demands.
  const REQUIRED = (() => {
    const res = spawnSync(process.execPath, [SCRIPT, "--print-required"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.strictEqual(res.status, 0, "--print-required must exit 0: " + (res.stderr || ""));
    return JSON.parse(res.stdout).required;
  })();

  function fixture(opts = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "relgate-"));
    fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
    fs.copyFileSync(SCRIPT, path.join(dir, "scripts", "release_gate.js"));
    fs.mkdirSync(path.join(dir, "test", "browser_e2e"), { recursive: true });
    fs.mkdirSync(path.join(dir, "temp", "browser_gate", "scheduled"), { recursive: true });
    fs.mkdirSync(path.join(dir, "js"), { recursive: true });
    fs.writeFileSync(path.join(dir, "js", "main.js"), "// fixture\n");
    const covered = opts.covered === undefined ? REQUIRED : opts.covered;
    const cases = (opts.cases === undefined ? true : opts.cases)
      ? covered.map((f) => ({ title: f + " :: a case", file: f, status: "pass", duration_ms: 10 }))
      : [];
    if (opts.noFixtureArtifact) {
      return dir;
    }
    const artifact = {
      schema: 1,
      runner: "scripts/browser_gate.js",
      started_at: new Date(opts.startedMs === undefined ? Date.now() - 3600e3 : opts.startedMs).toISOString(),
      mode: "serial",
      collection: Object.assign(
        { status: "ok", spec_files_expected: covered.length, tests_expected: covered.length },
        opts.collection,
      ),
      pending: { status: "ok" },
      execution: Object.assign(
        { status: "pass", passes: covered.length, failures: 0, pending: 0, tests: covered.length, failures_named: [] },
        opts.execution,
      ),
      host_canary: { boot_tolerated: 0 },
      contention: null,
      exit_code: opts.exit_code === undefined ? 0 : opts.exit_code,
      green: opts.green === undefined ? true : opts.green,
      cases,
    };
    fs.writeFileSync(
      path.join(dir, "temp", "browser_gate", "scheduled", "artifact.json"),
      JSON.stringify(artifact, null, 2),
    );
    const inventory = {
      expected: { spec_files: covered.length, tests_collected: covered.length },
      spec_files: covered.map((f) => ({
        file: f,
        tests: f === REQUIRED_SPEC && opts.inventoryCount !== undefined ? opts.inventoryCount : 1,
      })),
    };
    fs.writeFileSync(
      path.join(dir, "test", "browser_e2e", "spec_inventory.json"),
      JSON.stringify(inventory, null, 2),
    );
    return dir;
  }

  function run(dir, extra = []) {
    return spawnSync(process.execPath, [path.join(dir, "scripts", "release_gate.js"), ...extra], {
      cwd: dir,
      encoding: "utf8",
    });
  }

  /** markers present in the failure output ("PASS" when the gate is satisfied). */
  function outcome(res) {
    const out = (res.stdout || "") + (res.stderr || "");
    return { code: res.status, text: out, markers: [...out.matchAll(/\[(R\d+) /g)].map((m) => m[1]) };
  }

  // --------------------------------------------------------------------------- the PASS side first
  it("PASSES a fresh green artifact that covers the required surface", function () {
    const dir = fixture();
    const r = outcome(run(dir, ["--skip-git-check"]));
    assert.strictEqual(r.code, 0, "a green, fresh, complete run must pass:\n" + r.text);
    assert.match(r.text, /RELEASE GATE PASS/);
    assert.ok(r.text.includes(REQUIRED_SPEC), "it names the surface it certified");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // --------------------------------------------------------------------------- each finding fires
  const cases = [
    {
      name: "R1 — no artifact at all fails closed (an absence is never a pass)",
      dir: () => fixture({ noFixtureArtifact: true }),
      expect: "R1",
    },
    {
      name: "R0 — an unreadable inventory fails closed: without the witness, R7 proves nothing",
      dir: () => {
        const d = fixture();
        fs.writeFileSync(path.join(d, "test", "browser_e2e", "spec_inventory.json"), "{not json");
        return d;
      },
      expect: "R0",
    },
    {
      name: "R2 — an unparseable artifact is named, not treated as absent",
      dir: () => {
        const d = fixture();
        fs.writeFileSync(path.join(d, "temp", "browser_gate", "scheduled", "artifact.json"), "{not json");
        return d;
      },
      expect: "R2",
    },
    {
      name: "R3 — the nightly's own NOT-green verdict fails the release (the 09-19/09-20 shape)",
      dir: () => fixture({ green: false, exit_code: 1 }),
      expect: "R3",
    },
    {
      name: "R4 — a stale green cannot certify code changed since",
      dir: () => fixture({ startedMs: Date.now() - 20 * 86400e3 }),
      expect: "R4",
    },
    {
      name: "R5 — collection mismatch (a spec file dropped out) fails even if execution says pass",
      dir: () => fixture({ collection: { status: "mismatch", missing: ["gone.spec.js"] } }),
      expect: "R5",
    },
    {
      name: "R6 — the required suite contributing ZERO cases fails: green over a run that skipped it",
      dir: () => fixture({ cases: false }),
      expect: "R6",
    },
    {
      name: "R7 — fewer cases than the committed inventory pins for a required spec fails",
      dir: () => fixture({ inventoryCount: 7 }),
      expect: "R7",
    },
    {
      name: "R8 — a required case that pending-ed or failed inside a nominally green run fails",
      dir: () => {
        const d = fixture();
        const p = path.join(d, "temp", "browser_gate", "scheduled", "artifact.json");
        const a = JSON.parse(fs.readFileSync(p, "utf8"));
        a.cases[0].status = "pending";
        fs.writeFileSync(p, JSON.stringify(a, null, 2));
        return d;
      },
      expect: "R8",
    },
    {
      name: "R9 — an artifact older than the last product commit predates the release's own edits",
      dir: () => {
        const d = fixture();
        // Make js/ look newer than the run by committing it in a throwaway repo.
        const git = (args) => spawnSync("git", args, { cwd: d, encoding: "utf8" });
        git(["init", "-q"]);
        git(["config", "user.email", "fixture@example.invalid"]);
        git(["config", "user.name", "fixture"]);
        git(["add", "-A"]);
        git(["commit", "-q", "-m", "fixture"]);
        // The artifact claims it started BEFORE that commit's committer date.
        const head = git(["log", "-1", "--format=%cI"]).stdout.trim();
        assert.ok(head, "the fixture repo must be committable for this case to mean anything");
        const p = path.join(d, "temp", "browser_gate", "scheduled", "artifact.json");
        const a = JSON.parse(fs.readFileSync(p, "utf8"));
        a.started_at = new Date(Date.parse(head) - 3600e3).toISOString();
        fs.writeFileSync(p, JSON.stringify(a, null, 2));
        return d;
      },
      expect: "R9",
    },
    {
      name: "R10 — uncommitted js/ changes fail: no artifact can have run them",
      dir: () => {
        const d = fixture();
        const git = (args) => spawnSync("git", args, { cwd: d, encoding: "utf8" });
        git(["init", "-q"]);
        git(["config", "user.email", "fixture@example.invalid"]);
        git(["config", "user.name", "fixture"]);
        git(["add", "-A"]);
        git(["commit", "-q", "-m", "fixture"]);
        fs.appendFileSync(path.join(d, "js", "main.js"), "// unreleased edit\n");
        return d;
      },
      expect: "R10",
    },
  ];

  for (const c of cases) {
    it(c.name, function () {
      // R9/R10 ARE the git checks, so those two must run with git enabled; everything else skips it
      // to stay independent of the fixture repo's state.
      const flags = c.expect === "R9" || c.expect === "R10" ? [] : ["--skip-git-check"];
      let dir;
      try {
        dir = c.dir();
        const r = outcome(run(dir, flags));
        assert.notStrictEqual(r.code, 0, `the gate must REFUSE (${c.expect})`);
        assert.ok(
          r.markers.includes(c.expect),
          `${c.expect} must be named in the output. Got [${r.markers.join(", ")}]:\n${r.text}`,
        );
      } finally {
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  it("the artifact chosen is the newest RUN, not the newest file", function () {
    // The runner writes `artifact.json` in BOTH the scheduled dir and the default dir, so the gate
    // reads across two locations. If it ordered by mtime or directory order, a resurrected or
    // copied-over stale file would certify a release. The stale run is written LAST (newest mtime)
    // and describes a 30-day-old nightly: the gate must still pick the fresh one.
    const dir = fixture();
    const src = path.join(dir, "temp", "browser_gate", "scheduled", "artifact.json");
    const stale = fs
      .readFileSync(src, "utf8")
      .replace(/"started_at": "[^"]+"/,
        `"started_at": "${new Date(Date.now() - 30 * 86400e3).toISOString()}"`);
    fs.writeFileSync(path.join(dir, "temp", "browser_gate", "artifact.json"), stale);
    const r = outcome(run(dir, ["--skip-git-check"]));
    assert.strictEqual(r.code, 0, "the newer RUN must be chosen and must pass:\n" + r.text);
    assert.ok(!r.markers.includes("R4"), "R4 belongs to the stale artifact and must not fire:\n" + r.text);
    assert.ok(r.text.includes(path.join("scheduled", "artifact.json")),
      "the output must name WHICH artifact it read:\n" + r.text);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("--require-spec extends the surface, so a new feature can be gated before its nightly", function () {
    const dir = fixture();
    const r = outcome(run(dir, ["--skip-git-check", "--require-spec", "test/browser_e2e/a_new_feature.spec.js"]));
    assert.notStrictEqual(r.code, 0, "an extra required spec with no cases must fail the run");
    assert.ok(r.markers.includes("R6"), "and say so with R6:\n" + r.text);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // --------------------------------------------------------------------------- the live tree
  it("the live tree's own artifact state is REFUSED on 2.1.0's facts (the gate is not decorative)", function () {
    // Against THIS repo, when written: the newest nightly artifact was the 2026-09-20 run that never
    // executed (collection mismatch over byok_arrange_roundtrip.spec.js) and js/ changed after it.
    // If a future green+fresh+complete run lands, this case's premise expires — so it asserts the
    // SHAPE (a refusal that names R3 or R6) rather than a date. See the 2026-09-20 record in
    // scripts/release_gate.js's header for the evidence it was written against.
    //
    // THE PREMISE GUARD MUST ASK THE SAME QUESTION THE GATE ASKS. The first version read
    // `scheduled/artifact.json` alone, but `pickArtifact` chooses the newest RUN across BOTH output
    // directories (`temp/browser_gate/scheduled` and `temp/browser_gate`) — so the moment a green
    // serial run lands in the default dir (measured 2026-09-21: the 98-minute manual run wrote
    // `temp/browser_gate/artifact.json`, green, 325 cases), the guard still saw the stale RED nightly,
    // refused to skip, and asserted a refusal from a gate that had just correctly PASSED. The
    // assertion was not protecting anything; it was comparing the guard's eyes to the gate's.
    // Reading the newest-by-`started_at` artifact across both dirs makes the premise expire exactly
    // when the tree becomes releasable, which is what its own comment always claimed.
    const dirs = [path.join(ROOT, "temp", "browser_gate", "scheduled"),
                  path.join(ROOT, "temp", "browser_gate")];
    const candidates = dirs.map((d) => path.join(d, "artifact.json")).filter((p) => fs.existsSync(p));
    if (!candidates.length) this.skip(); // a fresh clone has no run evidence; nothing to assert against
    const newest = candidates.map((p) => {
      let a = null;
      try { a = JSON.parse(fs.readFileSync(p, "utf8")); } catch { a = null; }
      return { path: p, a, at: (a && Date.parse(a.started_at || "")) || fs.statSync(p).mtimeMs };
    }).sort((x, y) => y.at - x.at)[0];
    if (!newest.a) this.skip(); // unreadable JSON is the gate's R2 finding, not this case's premise
    const a = newest.a;
    const stillTheRedRun = a.green !== true || (a.collection || {}).status !== "ok" || !(a.cases || []).length;
    if (!stillTheRedRun) this.skip();
    const r = outcome(run(ROOT, ["--skip-git-check"]));
    assert.notStrictEqual(r.code, 0,
      "the release gate must refuse the artifact this project currently holds (it never executed)");
    assert.ok(r.markers.includes("R3") || r.markers.includes("R6"),
      "and name why: " + r.markers.join(", "));
  });
});
