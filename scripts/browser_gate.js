#!/usr/bin/env node
/**
 * The browser gate — ONE entry point for the manual run and the scheduled run
 * (track `gate_coverage_20260912`, Phase 2 = AC-3, Phase 3 = AC-5).
 *
 * WHY THIS EXISTS. The parent issue (`temp/archived/ISSUE_browser_e2e_gate_drift_20260912.md`)
 * recorded 22 browser cases that had been failing **across several releases** with nobody noticing.
 * The cause was not a bug in any spec: nothing in this repository ran any gate, so the suite that
 * covers the real extension in a real browser was green only when a human remembered to look. The
 * repair fixed the 22 cases; this file is the fix for their cause.
 *
 * WHAT MAKES IT NOT A LIE. A runner that exits 0 because it reached its own end is the defect, so:
 *
 *   1. COLLECTION IS CHECKED FIRST, against the committed inventory
 *      (`test/browser_e2e/spec_inventory.json`): the spec-file LIST (not a bare count), per-file
 *      presence, and the test count per file. A spec file that drops out of collection — a rename, a
 *      bad glob, a crash at require time — is a FAILURE that NAMES THE FILE, not a smaller green run.
 *      An empty or zero-case collection fails with an explicit `collection-empty` marker and emits
 *      **no green artifact**. That is the core vacuity this track exists to remove.
 *   2. PENDING IS BOUND TO A CAUSE. `94 pending` is compatible with "skipped on purpose" AND with
 *      "never collected", which is exactly why it read as fine. The live pending set is diffed per
 *      spec file against `test/browser_e2e/spec_pending.json` (the flag-gated capture/probe
 *      harnesses), so a case that STOPS skipping, or starts skipping for a new reason, is a change
 *      rather than a quieter gate. A dry run cannot see this set at all (measured: `stats.pending`
 *      is 0 under `--dry-run`), which is why the expectation is a committed artifact read from a
 *      real run.
 *   3. THE EXIT CODE IS DERIVED FROM COLLECTION **AND** EXECUTION — non-zero on an inventory
 *      mismatch, a pending/cause mismatch, an empty collection, any failing case, or an artifact
 *      that cannot be written. Never from "the script finished".
 *   4. OVERLAP IS REFUSED, NOT RACED: a guard file is claimed before anything starts, and a second
 *      run writes an artifact carrying a `contention` marker and exits non-zero.
 *
 * USAGE (both the manual run and the scheduled run use exactly this)
 *   node scripts/browser_gate.js                  # serial, the way the release step runs it
 *   node scripts/browser_gate.js --shards 4       # bounded per-file sharding (AC-4)
 *   node scripts/browser_gate.js --compare A B     # mechanical set-identity diff of two artifacts
 *   node scripts/browser_gate.js --artifacts-dir D # where the artifact lands (scheduler passes this)
 *
 * Three options exist so the gate can be pointed at ANOTHER suite, which is what the plant steps
 * need (`--spec-dir` with a renamed spec, with a directory that collects nothing, and at a small
 * fixture whose flag-gated case can be made to fail). They move which suite is checked; they do not
 * bypass the check, because the inventory/map paths move with it.
 *
 * The artifact carries the schema AC-5 requires: the spec list AS COLLECTED, the expected count from
 * the manifest, the collected count, the pending count WITH ITS CAUSE MAP, pass/fail counts, the
 * wall-clock, a collection status flag beside the execution status flag, the per-case list (so two
 * runs can be diffed mechanically), and the `[boot] tolerated` host canary.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SPEC_DIR = path.join(ROOT, "test", "browser_e2e");
const INVENTORY = path.join(SPEC_DIR, "spec_inventory.json");
const PENDING = path.join(SPEC_DIR, "spec_pending.json");
const DEFAULT_ARTIFACTS = path.join(ROOT, "temp", "browser_gate");
const GUARD = path.join(ROOT, "temp", "browser_gate.lock");
const MOCHA = path.join(ROOT, "node_modules", "mocha", "bin", "mocha.js");
const TIMEOUT = "900000";

// The parent issue's host canary. `bootPage` tolerates a bounded class of the DEMO HOST's own
// network failures and prints them; a sharded run that raises the count is a regression against the
// third-party host, not a win, so the count is carried in the artifact for every run.
const CANARY = /\[boot\] tolerated (\d+) HOST network error/g;

const SPEC_DIR_OVERRIDE = (() => {
  const i = process.argv.indexOf("--spec-dir");
  return i >= 0 && i + 1 < process.argv.length ? path.resolve(process.argv[i + 1]) : SPEC_DIR;
})();
const INVENTORY_FILE = (() => {
  const i = process.argv.indexOf("--inventory");
  return i >= 0 && i + 1 < process.argv.length ? path.resolve(process.argv[i + 1]) : INVENTORY;
})();
const PENDING_FILE = (() => {
  const i = process.argv.indexOf("--pending-map");
  return i >= 0 && i + 1 < process.argv.length ? path.resolve(process.argv[i + 1]) : PENDING;
})();

function argOf(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}
const has = (name) => process.argv.includes(name);

/** Extract mocha's json reporter object from a stream with interleaved test logging. */
function extractJson(stdout) {
  const key = '"stats"';
  const at = stdout.indexOf(key);
  if (at < 0) return null;
  let start = stdout.lastIndexOf("{", at);
  let depth = 0;
  let inStr = false;
  for (let i = start; i < stdout.length; i++) {
    const c = stdout[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(stdout.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** COLLECTION — the spec set, from a dry run, so it cannot be influenced by the execution below. */
function collect() {
  const res = spawnSync(
    process.execPath,
    [MOCHA, path.relative(ROOT, SPEC_DIR_OVERRIDE), "--recursive", "--dry-run",
      "--reporter", "json", "--timeout", TIMEOUT],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const report = extractJson(res.stdout || "");
  // A glob that collects NOTHING is the core vacuity this gate exists to remove, so it must arrive
  // as an EMPTY COLLECTION with its marker — not as a crash and not as a green run. (Measured while
  // falsifying this very guard: mocha emits no `stats` object at all for an empty collection, so the
  // first version of this function threw and lost the marker.)
  if (!report) return { report: null, byFile: new Map(), unreadable: true };
  const byFile = new Map();
  for (const t of report.tests || []) {
    const f = path.basename(t.file || "(none)");
    byFile.set(f, (byFile.get(f) || 0) + 1);
  }
  return { report, byFile, unreadable: false };
}

function diffCollection(byFile) {
  const manifest = JSON.parse(fs.readFileSync(INVENTORY_FILE, "utf8"));
  const expected = new Map(manifest.spec_files.map((s) => [s.file, s.tests]));
  const missing = [];
  const countMismatch = [];
  for (const [file, tests] of expected) {
    if (!byFile.has(file)) missing.push(file);
    else if (byFile.get(file) !== tests) {
      countMismatch.push({ file, expected: tests, collected: byFile.get(file) });
    }
  }
  const unexpected = [...byFile.keys()].filter((f) => !expected.has(f));
  const collected = [...byFile.values()].reduce((a, b) => a + b, 0);
  const empty = byFile.size === 0 || collected === 0;
  return {
    status: empty ? "empty" : missing.length || unexpected.length || countMismatch.length ? "mismatch" : "ok",
    marker: empty ? "collection-empty" : null,
    spec_files_expected: expected.size,
    spec_files_collected: byFile.size,
    tests_expected: manifest.expected.tests_collected,
    tests_collected: collected,
    missing: missing.sort(),
    unexpected: unexpected.sort(),
    count_mismatch: countMismatch,
    spec_files: [...byFile.keys()].sort(),
  };
}

/** PENDING — the live set diffed per spec file against the committed cause map. */
function diffPending(report) {
  const map = JSON.parse(fs.readFileSync(PENDING_FILE, "utf8"));
  const expectedBySpec = Object.fromEntries(
    Object.entries(map.by_spec_file).map(([f, v]) => [f, v.cases]),
  );
  const live = {};
  for (const t of report.pending || []) {
    const f = path.basename(t.file || "(none)");
    live[f] = (live[f] || 0) + 1;
  }
  const diff = [];
  for (const f of new Set([...Object.keys(expectedBySpec), ...Object.keys(live)])) {
    const e = expectedBySpec[f] || 0;
    const a = live[f] || 0;
    if (e !== a) diff.push({ file: f, expected: e, actual: a });
  }
  const count = (report.pending || []).length;
  return {
    status: count === map.expected.case_count && diff.length === 0 ? "ok" : "mismatch",
    count,
    expected: map.expected.case_count,
    by_spec_diff: diff,
    cause_map: expectedBySpec,
  };
}

function shardByTests(files, count) {
  // Longest-processing-time first over the per-file EXECUTING count. Measured basis: every executing
  // browser test costs ~31 s regardless of which file it is in (Phase 0: the top 15 files all
  // average 30-33 s per test), so test count IS the cost model, and all-pending files cost ~0.
  //
  // KEYSPACE, and the defect that was here: `files` are repo-relative PATHS while the manifest is
  // keyed by BASENAME, so keying the lookup by `f` returned undefined for all 67 files, every weight
  // became 0, and `reduce` therefore handed EVERY file to shard 1 — shards 2-4 ran with no file
  // arguments at all. MEASURED (2026-09-12): shards 2/3/4 reported "4 passing (0 spec files)" while
  // shard 1 ran the whole suite, and the merged artifact would have said PASS. That is a green lie,
  // which is why the assertion below now refuses an empty shard as well as a mismatched total.
  const manifest = JSON.parse(fs.readFileSync(INVENTORY_FILE, "utf8"));
  const tests = new Map(manifest.spec_files.map((s) => [s.file, s.tests]));
  const pending = JSON.parse(fs.readFileSync(PENDING_FILE, "utf8")).by_spec_file;
  const weighted = files
    .map((f) => {
      const base = path.basename(f);
      return { file: f, weight: (tests.get(base) || 0) - ((pending[base] || {}).cases || 0) };
    })
    .sort((a, b) => b.weight - a.weight);
  const shards = Array.from({ length: count }, () => ({ files: [], weight: 0 }));
  for (const w of weighted) {
    const target = shards.reduce((a, b) => (a.weight <= b.weight ? a : b));
    target.files.push(w.file);
    target.weight += w.weight;
  }
  return shards;
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

function claimGuard(mode) {
  if (fs.existsSync(GUARD)) {
    let held = null;
    try {
      held = JSON.parse(fs.readFileSync(GUARD, "utf8"));
    } catch {
      held = null;
    }
    if (held && held.pid && pidAlive(held.pid)) return held;
    // A stale guard (a killed run) must not block the gate forever; it is reported, not hidden.
    fs.unlinkSync(GUARD);
  }
  fs.mkdirSync(path.dirname(GUARD), { recursive: true });
  const mine = { pid: process.pid, started_at: new Date().toISOString(), mode };
  fs.writeFileSync(GUARD, JSON.stringify(mine, null, 2));
  return null;
}

function artifactPath(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "artifact.json");
}

function writeArtifact(dir, artifact) {
  const p = artifactPath(dir);
  artifact.green = artifact.exit_code === 0;
  fs.writeFileSync(p, JSON.stringify(artifact, null, 2) + "\n");
  fs.writeFileSync(p.replace(/artifact\.json$/, "artifact-" + Date.now() + ".json"),
    JSON.stringify(artifact, null, 2) + "\n");
  return p;
}

/** The mechanical set-identity diff AC-4 is judged on. */
function compare(aPath, bPath) {
  const a = JSON.parse(fs.readFileSync(aPath, "utf8"));
  const b = JSON.parse(fs.readFileSync(bPath, "utf8"));
  const index = (art) => new Map((art.cases || []).map((c) => [c.title, c.status]));
  const A = index(a);
  const B = index(b);
  const onlyA = [...A.keys()].filter((k) => !B.has(k));
  const onlyB = [...B.keys()].filter((k) => !A.has(k));
  const changed = [...A.keys()]
    .filter((k) => B.has(k) && B.get(k) !== A.get(k))
    .map((k) => ({ title: k, a: A.get(k), b: B.get(k) }));
  const ok = onlyA.length === 0 && onlyB.length === 0 && changed.length === 0;
  console.log(JSON.stringify({
    set_identity: ok ? "IDENTICAL" : "DIFFERENT",
    cases_a: A.size,
    cases_b: B.size,
    only_in_a: onlyA,
    only_in_b: onlyB,
    changed,
  }, null, 2));
  return ok ? 0 : 1;
}

async function main() {
  if (has("--compare")) {
    const i = process.argv.indexOf("--compare");
    process.exit(compare(process.argv[i + 1], process.argv[i + 2]));
  }

  const dir = path.resolve(argOf("--artifacts-dir", DEFAULT_ARTIFACTS));
  fs.mkdirSync(dir, { recursive: true }); // the shard logs land here before the artifact does
  const shards = Math.max(1, Number(argOf("--shards", "1")) || 1);
  const started = Date.now();
  const artifact = {
    schema: 1,
    runner: "scripts/browser_gate.js",
    started_at: new Date(started).toISOString(),
    mode: shards > 1 ? `sharded:${shards}` : "serial",
    collection: null,
    pending: null,
    execution: null,
    host_canary: { boot_tolerated: 0 },
    contention: null,
    exit_code: 1,
    green: false,
  };

  // 4 — overlap is REFUSED, not raced.
  const held = claimGuard(artifact.mode);
  if (held) {
    artifact.contention = {
      marker: "contention",
      held_by_pid: held.pid,
      held_since: held.started_at,
      held_mode: held.mode,
      note: "another browser-gate run held the guard file; this run refused to start",
    };
    artifact.collection = { status: "skipped", marker: null };
    artifact.execution = { status: "skipped", failures_named: [] };
    artifact.exit_code = 1;
    const p = writeArtifact(dir, artifact);
    console.error(`browser gate REFUSED: another run is in flight (pid ${held.pid}, since ${held.started_at})`);
    console.error(`artifact: ${path.relative(ROOT, p)}`);
    process.exit(1);
  }

  let exit = 1;
  try {
    // 1 — COLLECTION, before anything is executed.
    const { byFile, unreadable } = collect();
    artifact.collection = diffCollection(byFile);
    if (unreadable) {
      artifact.collection.status = "empty";
      artifact.collection.marker = "collection-empty";
      artifact.collection.note =
        "collection produced no readable report: mocha emitted no stats object (empty glob)";
    }
    if (artifact.collection.status !== "ok") {
      artifact.execution = { status: "skipped", failures_named: [], reason: "collection failed" };
      artifact.exit_code = 1;
      const p = writeArtifact(dir, artifact);
      console.error(`browser gate COLLECTION ${artifact.collection.status}` +
        (artifact.collection.marker ? ` (${artifact.collection.marker})` : "") +
        `: expected ${artifact.collection.spec_files_expected} spec files / ` +
        `${artifact.collection.tests_expected} tests, collected ` +
        `${artifact.collection.spec_files_collected} / ${artifact.collection.tests_collected}`);
      for (const f of artifact.collection.missing) console.error(`  MISSING spec file: ${f}`);
      for (const f of artifact.collection.unexpected) console.error(`  UNEXPECTED spec file: ${f}`);
      for (const c of artifact.collection.count_mismatch) {
        console.error(`  ${c.file}: expected ${c.expected} test(s), collected ${c.collected}`);
      }
      console.error(`artifact: ${path.relative(ROOT, p)} (NOT green)`);
      return;
    }

    // 2/3 — EXECUTE. Serial by default; bounded per-file shards on request.
    //
    // The shards run CONCURRENTLY (a sequential shard matrix costs the same as the serial run, so it
    // would prove nothing about AC-4's target), staggered by a second so the two runs cannot collide
    // on the harness's `Date.now()`-named Chromium profile directory (`_helpers/dom.js`). The live
    // host is the real bound, so the `[boot] tolerated` canary is summed across shards into the
    // artifact: a sharded run that raises it is a regression, not a win.
    const files = artifact.collection.spec_files.map((f) =>
      path.join(path.relative(ROOT, SPEC_DIR_OVERRIDE), f));
    const plans = shards > 1 ? shardByTests(files, shards) : [{ files }];
    const { spawn } = require("child_process");
    const runShard = (plan, i) =>
      new Promise((resolve, reject) => {
        // A shard with NO files must never reach mocha: with no file arguments mocha falls back to its
        // default path and executes unrelated cases, which then look like passes (MEASURED: an empty
        // shard reported "4 passing (0 spec files)"). It is reported as a zero-case shard instead, and
        // `execution_coverage` fails the run on it.
        if (plan.files.length === 0) {
          console.error(`shard ${i + 1}/${plans.length}: NO SPEC FILES — not launched`);
          return resolve({
            report: { stats: { suites: 0, tests: 0, passes: 0, pending: 0, failures: 0 }, pending: [], failures: [], passes: [], tests: [] },
            canary: 0,
          });
        }
        const outStream = fs.createWriteStream(path.join(dir, `shard-${i + 1}-stdout.txt`));
        const child = spawn(
          process.execPath,
          [MOCHA, ...plan.files, "--timeout", TIMEOUT, "--reporter", "json"],
          { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
        );
        let stdout = "";
        child.stdout.on("data", (d) => {
          stdout += d;
          outStream.write(d);
        });
        child.stderr.on("data", (d) => outStream.write(d));
        child.on("error", reject);
        child.on("close", () => {
          outStream.end();
          let canary = 0;
          for (const m of stdout.matchAll(CANARY)) canary += Number(m[1]);
          const report = extractJson(stdout);
          if (!report) {
            return reject(new Error(`shard ${i + 1}: no readable json report (tail: ${stdout.slice(-300)})`));
          }
          if (plans.length > 1) {
            console.log(
              `shard ${i + 1}/${plans.length}: ${report.stats.passes} passing, ` +
                `${report.stats.pending} pending, ${report.stats.failures} failing ` +
                `(${plan.files.length} spec files)`,
            );
          }
          resolve({ report, canary });
        });
      });

    const promises = plans.map((plan, i) => {
      if (i === 0) return runShard(plan, i);
      return new Promise((r) => setTimeout(r, i * 1000)).then(() => runShard(plan, i));
    });
    const results = await Promise.all(promises);
    const reports = results.map((r) => r.report);
    const canary = results.reduce((a, r) => a + r.canary, 0);
    const merged = {
      stats: reports.reduce(
        (acc, r) => ({
          suites: acc.suites + r.stats.suites,
          tests: acc.tests + r.stats.tests,
          passes: acc.passes + r.stats.passes,
          pending: acc.pending + r.stats.pending,
          failures: acc.failures + r.stats.failures,
        }),
        { suites: 0, tests: 0, passes: 0, pending: 0, failures: 0 },
      ),
      pending: reports.flatMap((r) => r.pending || []),
      failures: reports.flatMap((r) => r.failures || []),
      passes: reports.flatMap((r) => r.passes || []),
      tests: reports.flatMap((r) => r.tests || []),
    };

    // EXECUTION MUST ACCOUNT FOR THE WHOLE COLLECTION. Without this, a shard that received no files
    // (or a mocha invocation that fell back to its default path and ran unrelated cases) would be
    // ADDED to the pass count and the run would report green over a suite it never executed — the
    // exact green-lie shape AC-4 exists to forbid. MEASURED as a real hole 2026-09-12: a shard
    // assignment bug left shards 2-4 with no files, they reported "4 passing (0 spec files)", and the
    // merged artifact read PASS. Both the keyspace bug and this hole are fixed; the assertion is what
    // makes the class impossible rather than the one instance fixed.
    const accounted = merged.stats.passes + merged.stats.pending + merged.stats.failures;
    const shardsEmpty = plans.filter((p) => p.files.length === 0).length;
    const coverage = {
      collected_tests: artifact.collection.tests_collected,
      executed_tests: merged.stats.tests,
      accounted_tests: accounted,
      shards: plans.length,
      shards_empty: shardsEmpty,
      status:
        shardsEmpty > 0
          ? "empty-shard"
          : merged.stats.tests !== artifact.collection.tests_collected
            ? "count-mismatch"
            : accounted !== merged.stats.tests
              ? "not-accounted"
              : "ok",
    };
    artifact.execution_coverage = coverage;
    if (coverage.status !== "ok") {
      artifact.execution = {
        status: "fail",
        passes: merged.stats.passes,
        failures: merged.stats.failures,
        pending: merged.stats.pending,
        tests: merged.stats.tests,
        failures_named: [],
        coverage_failure: coverage,
        reason:
          "the executed set does not account for the collected set — refusing to report green " +
          "(a shard with no files, or a mocha run that did not execute the collection)",
      };
      artifact.finished_at = new Date().toISOString();
      artifact.wall_clock_s = Math.round((Date.now() - started) / 1000);
      artifact.exit_code = 1;
      const p = writeArtifact(dir, artifact);
      console.error(
        `browser gate FAIL (coverage ${coverage.status}): collected ` +
          `${coverage.collected_tests} test(s), executed ${coverage.executed_tests}, ` +
          `accounted ${coverage.accounted_tests}, empty shards ${shardsEmpty}/${plans.length}`,
      );
      console.error(`artifact: ${path.relative(ROOT, p)} (NOT green)`);
      return;
    }
    artifact.host_canary = { boot_tolerated: canary };
    artifact.pending = diffPending(merged);

    const caseStatus = (t, list) => (list.some((x) => x.fullTitle === t.fullTitle) ? "fail" : "pass");
    artifact.cases = merged.tests.map((t) => ({
      title: t.fullTitle,
      file: path.basename(t.file || "(none)"),
      status: merged.pending.some((p) => p.fullTitle === t.fullTitle)
        ? "pending"
        : caseStatus(t, merged.failures),
      duration_ms: t.duration || 0,
    }));
    const failuresNamed = merged.failures.map((f) => ({
      spec: path.basename(f.file || "(none)"),
      case: f.fullTitle,
      error: (f.err && (f.err.message || f.err.stack || "")) + "" || null,
    }));
    const pendingOk = artifact.pending.status === "ok";
    artifact.execution = {
      status: merged.stats.failures === 0 && pendingOk ? "pass" : "fail",
      passes: merged.stats.passes,
      failures: merged.stats.failures,
      pending: merged.stats.pending,
      tests: merged.stats.tests,
      failures_named: failuresNamed,
      pending_mismatch: pendingOk ? null : artifact.pending.by_spec_diff,
    };
    artifact.finished_at = new Date().toISOString();
    artifact.wall_clock_s = Math.round((Date.now() - started) / 1000);
    artifact.exit_code = artifact.execution.status === "pass" ? 0 : 1;
    const p = writeArtifact(dir, artifact);
    console.log(
      `browser gate ${artifact.execution.status.toUpperCase()} (${artifact.mode}): ` +
        `${merged.stats.passes} passing / ${merged.stats.pending} pending / ` +
        `${merged.stats.failures} failing, ${artifact.wall_clock_s}s, ` +
        `collection ${artifact.collection.status}, pending ${artifact.pending.status}` +
        (canary ? `, host canary ${canary}` : ""),
    );
    console.log(`artifact: ${path.relative(ROOT, p)}`);
    exit = artifact.exit_code;
    if (exit !== 0) {
      for (const f of failuresNamed) console.error(`  FAILING: ${f.spec} :: ${f.case}`);
      for (const d of artifact.pending.by_spec_diff) {
        console.error(`  PENDING CHANGED: ${d.file} expected ${d.expected}, actual ${d.actual}`);
      }
    }
  } catch (err) {
    artifact.execution = { status: "fail", failures_named: [], error: String(err && err.message) };
    artifact.exit_code = 1;
    try {
      writeArtifact(dir, artifact);
    } catch (writeErr) {
      console.error("artifact could not be written: " + writeErr.message);
    }
    console.error("browser gate ERROR: " + (err && err.message));
  } finally {
    try {
      fs.unlinkSync(GUARD);
    } catch {
      /* already gone */
    }
  }
  process.exit(exit);
}

main();
