#!/usr/bin/env node
/**
 * smoke_low_risk.js — the runtime smoke for the `scripts` area's executable low-risk tools
 * (track scripts_runtime_smoke_20261017; closes TECH_DEBT_SCRIPTS.md T-4).
 *
 * WHAT IT DOES
 * ------------
 * Executes every row of CASES below END-TO-END as a child process with its documented
 * invocation, and requires for each case: exit code 0, NON-EMPTY stdout, and an unchanged
 * `git status --porcelain` report across the run. A hang trips the per-case timeout and is
 * a failure, never a sleep. Nothing here mutates the repository; the runner's own scratch
 * (if any) lives under os.tmpdir().
 *
 * REACH, stated in the run header rather than hidden: `git status --porcelain` reports
 * tracked-file changes and untracked files, NOT writes into gitignored paths. `temp/**`
 * and `__pycache__/` are sanctioned scratch and correctly invisible; any OTHER gitignored
 * path a tool writes is out of this check's reach.
 *
 * WIRING: `npm run smoke` (standalone) and the prefix of `npm test`. The fast gate
 * (`npm run lint`) is deliberately untouched — the two dead-export tools cost ~23 s each
 * (measured 2026-10-17), which would multiply the ~3 s lint gate ~16x.
 *
 * THE CROSS-CHECK: guard arm 7 of check_scripts_hygiene.js compares TECH_DEBT_SCRIPTS.md
 * §3's executable `low` rows against CASES in BOTH directions; this file's own row is
 * exempt there by name (SELF_ROW), because a smoke cannot execute itself.
 *
 * Read-only. Serial. Deterministic order.
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");

/** The runner's own row in TECH_DEBT_SCRIPTS.md §3 — exempt from arm 7's case check. */
const SELF_ROW = "scripts/smoke_low_risk.js";

/**
 * The case table — one entry per executable `low` row of TECH_DEBT_SCRIPTS.md §3 (11 rows).
 * `args` is the documented invocation minus the interpreter and the script path.
 * `timeoutMs` is the per-case kill switch (default 120 s).
 * Kept EXPLICIT (no directory scans): the case set is a claim about the inventory, and the
 * guard's arm 7 holds this table and §3 equal in both directions.
 */
const CASES = [
  { name: "audit_dead_exports.js", file: "scripts/audit_dead_exports.js", args: [], timeoutMs: 120000 },
  { name: "check_border_svg_injection.js", file: "scripts/check_border_svg_injection.js", args: [], timeoutMs: 120000 },
  { name: "check_css_template_backticks.js", file: "scripts/check_css_template_backticks.js", args: [], timeoutMs: 120000 },
  { name: "check_dead_exports.js", file: "scripts/check_dead_exports.js", args: [], timeoutMs: 120000 },
  { name: "check_scripts_hygiene.js", file: "scripts/check_scripts_hygiene.js", args: [], timeoutMs: 120000 },
  { name: "check_theme_backticks.js", file: "scripts/check_theme_backticks.js", args: [], timeoutMs: 120000 },
  // argument-driven: a tracked asset a fresh clone already has (its no-arg default reads an absent demo sheet)
  { name: "get_image_metadata.js", file: "scripts/get_image_metadata.js", args: ["assets/border_default.webp"], timeoutMs: 120000 },
  { name: "inventory_mutation_tags.py", file: "scripts/inventory_mutation_tags.py", args: [], interpreter: "python", timeoutMs: 120000 },
  { name: "measure_css_content.js", file: "scripts/measure_css_content.js", args: [], timeoutMs: 120000 },
  { name: "measure_encodings.js", file: "scripts/measure_encodings.js", args: [], timeoutMs: 120000 },
  // argument-driven: the committed synthetic rasters (E-5; a fresh clone has them)
  { name: "print_raster_diff.js", file: "scripts/print_raster_diff.js", args: ["test/fixtures/smoke/page-a-NN.png", "test/fixtures/smoke/page-b-NN.png", "01"], timeoutMs: 120000 },
];

/** `git status --porcelain` at REPO_ROOT; empty string on git failure (reported, not hidden). */
function statusSnapshot(cwd) {
  const r = spawnSync("git", ["status", "--porcelain"], { cwd: cwd || REPO_ROOT, encoding: "utf8" });
  if (r.error || r.status !== 0) return null;
  return r.stdout;
}

/** The per-case contract: exit 0 + non-empty stdout. Returns a failure string or null. */
function validateResult(res) {
  if (res.error) {
    if (res.error.code === "ABORT" || res.signal) return "timed out and was killed";
    return String(res.error.message || res.error);
  }
  if (res.status !== 0) return `exit ${res.status}`;
  if (!res.stdout || !res.stdout.trim()) return "empty stdout (exit 0 but no report)";
  return null;
}

/**
 * Run ONE case: snapshot, spawn serially, validate, snapshot, compare.
 * Exported for the falsification suite (AC-4 surfaces R1-R4); `cwd` is injectable so the
 * suite can drive it against a fixture repo without touching this one.
 */
function runCase(c, cwd) {
  const base = cwd || REPO_ROOT;
  const before = statusSnapshot(base);
  if (before === null) return { ok: false, why: "git status probe failed before the case" };
  const started = Date.now();
  const cmd = c.interpreter === "python"
    ? (process.platform === "win32" ? "python" : "python3")
    : process.execPath;
  const res = spawnSync(cmd, [c.file, ...c.args], { cwd: base, encoding: "utf8", timeout: c.timeoutMs, killSignal: "SIGKILL" });
  const ms = Date.now() - started;
  const fail = validateResult(res);
  if (fail) return { ok: false, why: fail, ms };
  const after = statusSnapshot(base);
  if (after === null) return { ok: false, why: "git status probe failed after the case", ms };
  if (after !== before) {
    const changed = after.split("\n").filter((l) => l && !before.split("\n").includes(l)).join("; ");
    return { ok: false, why: `repo mutation detected: ${changed}`, ms };
  }
  return { ok: true, ms };
}

/** Smoke all cases serially; prints per-case lines, the total wall time, and the reach note. */
function runAll(cwd) {
  const t0 = Date.now();
  const failures = [];
  console.log(`scripts runtime smoke — ${CASES.length} cases, serial, per-case timeout ${CASES[0].timeoutMs / 1000}s`);
  console.log("reach note: git-status equality cannot see writes into gitignored paths (temp/**, __pycache__/ are sanctioned scratch); any other gitignored write is out of this check's reach");
  for (const c of CASES) {
    const r = runCase(c, cwd);
    if (r.ok) {
      console.log(`  PASS ${c.name} (${r.ms} ms)`);
    } else {
      console.log(`  FAIL ${c.name} (${r.ms == null ? "?" : r.ms + " ms"}): ${r.why}`);
      failures.push(c.name);
    }
  }
  const total = Date.now() - t0;
  console.log(`total: ${total} ms — ${CASES.length - failures.length}/${CASES.length} passed`);
  return { failures, total };
}

module.exports = { CASES, SELF_ROW, REPO_ROOT, runCase, runAll, statusSnapshot, validateResult };

if (require.main === module) {
  const { failures } = runAll();
  process.exit(failures.length ? 1 : 0);
}
