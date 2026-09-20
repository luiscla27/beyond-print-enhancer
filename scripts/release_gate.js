#!/usr/bin/env node
/**
 * The release gate — refuse a version bump on a browser suite that is RED, STALE or UNVERIFIED.
 *
 * WHY THIS EXISTS (measured 2026-09-20, the day `2.1.0` shipped). `scripts/browser_gate.js` is the
 * suite that drives the REAL extension in Chromium, and the nightly registered task
 * (`reasonix-browser-gate-dndbeyond-printenhance`) does run it every day. But NOTHING compared its
 * verdict against a release, so `2.1.0` was tagged while that gate was red and its own feature suite
 * was not in the executed set. The verbatim evidence, read out of the committed run artifacts:
 *
 *   09-14  exec fail 180/94/2     `manual_verification_phase0` ENOENT + `responsive_scaling` misfit
 *   09-15  exec fail 193/94/2     (the same two)
 *   09-16  exec fail 194/94/1     (phase0)
 *   09-17  exec fail 194/94/1     (phase0)
 *   09-18  exec fail 164/95/59 + coverage count-mismatch (a `[host]` page-error burst, 5 files booting)
 *   09-19  collection MISMATCH, execution SKIPPED  — unexpected: byok_arrange_roundtrip.spec.js
 *   09-20  collection MISMATCH, execution SKIPPED  — the same
 *
 * and `2.1.0` (package + manifest bumped in `2c37561`, 2026-09-20 13:18) landed 10 hours after the
 * last nightly, which had NOT EXECUTED at all. The commit's own words: "The full browser gate
 * (`npm run test:browser-gate`) has still not been executed for this track"
 * (`vendor/conductor/archive/byok_ai_layout_20260915/final_report.md`).
 *
 * The gap was NOT "nobody runs the browser suite" — `gate_coverage_20260912` fixed that with a
 * scheduled task and a runner that cannot pass by skipping. The gap is the LINK: a release step
 * nobody can skip. This file is that link, and it checks things `browser_gate.js` is structurally
 * blind to, because each of them is only knowable by comparing a run against something OUTSIDE it:
 *
 *   * FRESHNESS — the gate says what passed; it cannot say whether it passed against THIS code. A
 *     3-day-old green is not evidence about a diff made yesterday. R4 and R9 measure that gap from
 *     the two clocks that exist (the run's `started_at`, and the last commit touching `js/`).
 *   * COMPLETENESS OF WHAT A RELEASE DEPENDS ON — a green artifact over a run that never reached the
 *     suite you care about is exactly the 09-19/09-20 shape (collection failed, execution skipped,
 *     zero `byok_*` cases) and the 09-18 shape (59 failures, `failures_named: []` because the
 *     coverage guard short-circuits before the names are read). `cases[]` is per-case, so R6/R7/R8
 *     can NAME the file whose cases are missing, miscounted or not passing — where "green: false"
 *     names nothing.
 *   * THE COMMITTED INVENTORY AS THE WITNESS — R7 compares the artifact's per-file case count
 *     against `test/browser_e2e/spec_inventory.json`, not against a number typed into this file. A
 *     case silently deleted from a required spec therefore fails the release check even if the
 *     nightly stayed green, and the only way to clear it is the deliberate act the inventory
 *     already requires (`node scripts/gen_spec_inventory.js`, with a diff to review).
 *   * THE WORKTREE — R10 refuses while `js/` carries uncommitted changes: no artifact, however
 *     fresh, can have run the bytes being released.
 *
 * FAIL CLOSED, because a release check that can be satisfied by an absence is not a check: no
 * artifact, an unparseable artifact, an artifact with no `cases[]`, an UNREADABLE inventory (without
 * the per-file witness R7 proves nothing — R0), an inventory that does not list a required spec, and
 * a `git` that cannot answer are all FINDINGS `R0`…`R10` (exit non-zero), never skips.
 *
 * USAGE
 *   npm run release:check                     # the default required set, newest artifact
 *   node scripts/release_gate.js --json       # machine-readable, for a release step to quote
 *   node scripts/release_gate.js --artifact temp/browser_gate/scheduled/artifact.json
 *   node scripts/release_gate.js --max-age-hours 26
 *   node scripts/release_gate.js --require-spec test/browser_e2e/my_new_feature.spec.js
 *
 * The default required set is this project's own release surface: the BYOK arrange round-trip (the
 * feature `2.1.0` shipped — AC-3's real Ctrl+Z and AC-V1's evidence live only there) and the five
 * `manual_verification_phase0..4` specs, which `README.md` calls "the automated form of the
 * project's per-phase user manual verification step". `--require-spec` adds to it.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it does not run the browser gate. The full gate is ~88 min
 * serial / ~23 min at 4 shards against a live third-party host, which is why it is SCHEDULED
 * (`gate_coverage_20260912`); a check that tried to run it here would be skipped precisely when it
 * matters. It reads the evidence the schedule produces and refuses when that evidence does not
 * cover the release. Run `npm run test:browser-gate` (or let tonight's task do it), then this.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const INVENTORY = path.join(ROOT, "test", "browser_e2e", "spec_inventory.json");
const ARTIFACT_DIRS = [
  path.join(ROOT, "temp", "browser_gate", "scheduled"),
  path.join(ROOT, "temp", "browser_gate"),
];
const PRODUCT_DIR = "js";

/** The release surface: every one of these must have run, at its inventoried count, and passed. */
const DEFAULT_REQUIRED = [
  "byok_arrange_roundtrip.spec.js",
  "manual_verification_phase0.spec.js",
  "manual_verification_phase1.spec.js",
  "manual_verification_phase2.spec.js",
  "manual_verification_phase3.spec.js",
  "manual_verification_phase4.spec.js",
];

// A green nightly is at most one day + a slack margin old. 26h, not 24: the task fires at 03:30
// local, so a release cut late in the evening is checking a run from that same morning, and a
// morning release would otherwise fail on the schedule's own boundary rather than on a real gap.
const DEFAULT_MAX_AGE_HOURS = 26;

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}
const has = (name) => process.argv.includes(name);

function argAll(name) {
  const out = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === name && i + 1 < process.argv.length) out.push(process.argv[i + 1]);
  }
  return out;
}

const norm = (p) => String(p || "").split(/[\\/]+/).join("/");
const basename = (p) => norm(p).split("/").pop();

/** The newest artifact across the runner's output directories, by the run's OWN start time. */
function findArtifacts() {
  const found = [];
  for (const dir of ARTIFACT_DIRS) {
    const p = path.join(dir, "artifact.json");
    if (fs.existsSync(p)) found.push(p);
  }
  return found;
}

function pickArtifact(explicit) {
  const candidates = explicit ? [path.resolve(ROOT, explicit)] : findArtifacts();
  const readable = [];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue; // an absent file is R1 (nothing to look at), not R2
    let a = null;
    try {
      a = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (e) {
      // R2: an unparseable artifact is a FINDING, not "no artifact". Say which file and why.
      return { error: { path: p, message: String(e.message || e) } };
    }
    readable.push({ path: p, artifact: a, at: Date.parse(a.started_at || "") || fs.statSync(p).mtimeMs });
  }
  if (!readable.length) return { missing: candidates };
  readable.sort((x, y) => y.at - x.at);
  return readable[0];
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null; // the callers fail closed
  }
}

function main() {
  // A machine-readable dump of the release surface, so anything that must know it (the unit suite's
  // fixture, a release script) reads the SAME list instead of re-typing it and drifting.
  if (has("--print-required")) {
    console.log(JSON.stringify({ required: DEFAULT_REQUIRED, max_age_hours_default: DEFAULT_MAX_AGE_HOURS }));
    return;
  }

  const findings = [];
  const note = [];
  const add = (marker, detail) => findings.push({ marker, detail });

  // ---- the artifact -------------------------------------------------------------
  const chosen = pickArtifact(arg("--artifact", null));
  if (chosen.error) {
    add("R2 artifact-unreadable", `${path.relative(ROOT, chosen.error.path)} is not readable JSON: ` +
      `${chosen.error.message}`);
  } else if (chosen.missing) {
    add(
      "R1 artifact-missing",
      "no browser-gate artifact found in " +
        ARTIFACT_DIRS.map((d) => path.relative(ROOT, d)).join(" or ") +
        ". Run `npm run test:browser-gate` (or wait for the nightly task) and re-check. An " +
        "absent run is never a pass: " +
        (chosen.missing.length ? `looked for ${chosen.missing.join(", ")}` : "nothing to look at"),
    );
  }
  const a = chosen.artifact || null;

  let inventory = null;
  try {
    inventory = JSON.parse(fs.readFileSync(INVENTORY, "utf8"));
  } catch (e) {
    add("R0 inventory-unreadable", `${path.relative(ROOT, INVENTORY)} cannot be read: ${e.message}. ` +
      "The per-file witness for R7 is the committed inventory; without it this check cannot prove " +
      "anything, so it fails closed rather than skipping.");
  }

  const required = [...new Set([...DEFAULT_REQUIRED, ...argAll("--require-spec").map(basename)])];

  if (a) {
    const c = a.collection || {};
    const e = a.execution || {};
    const info = {
      artifact: path.relative(ROOT, chosen.path),
      mode: a.mode,
      started_at: a.started_at,
      wall_clock_s: a.wall_clock_s,
      green: a.green,
      exit_code: a.exit_code,
      collection: c.status,
      execution: e.status,
      counts: `${e.passes ?? "?"} passing / ${e.pending ?? "?"} pending / ${e.failures ?? "?"} failing`,
      host_canary: a.host_canary,
      contention: a.contention ? a.contention.marker : null,
    };
    note.push(info);

    // R3 — the run's own verdict. Read green AND exit_code: the artifact's `green` is derived from
    // the exit code by the writer, so a mismatch means a hand-edited or truncated file.
    if (a.green !== true || a.exit_code !== 0) {
      add(
        "R3 not-green",
        `${info.artifact} (started ${info.started_at}) is NOT green: exit_code=${a.exit_code}, ` +
          `collection=${info.collection}, execution=${info.execution} (${info.counts}). ` +
          (c.unexpected && c.unexpected.length
            ? `The nightly refused to execute because collection mismatched — unexpected spec file(s): ` +
              `${c.unexpected.join(", ")}; regenerate the inventory deliberately: ` +
              `node scripts/gen_spec_inventory.js. `
            : "") +
          (c.missing && c.missing.length ? `missing spec file(s): ${c.missing.join(", ")}. ` : "") +
          (e.coverage_failure ? `coverage: ${JSON.stringify(e.coverage_failure)}. ` : "") +
          (e.failures_named || []).slice(0, 5).map((f) => `\n    FAIL ${f.spec} :: ${f.case}`).join(""),
      );
    }

    // R5 — belt and braces on the collection half, so a future writer that forgets `green` cannot
    // hide a suite that stopped being collected.
    if (c.status !== "ok") {
      add("R5 collection-not-ok", `collection.status = ${JSON.stringify(c.status)} (expected "ok") — ` +
        `expected ${c.spec_files_expected} spec files / ${c.tests_expected} tests, ` +
        `collected ${c.spec_files_collected} / ${c.tests_collected}.`);
    }

    // R4 — the run must be recent enough to be about THIS release.
    const maxAge = Number(arg("--max-age-hours", String(DEFAULT_MAX_AGE_HOURS)));
    const started = Date.parse(a.started_at || "");
    if (!Number.isFinite(started)) {
      add("R4 stale", `the artifact carries no parseable started_at (${JSON.stringify(a.started_at)}), ` +
        "so its age cannot be established — an undated run is not evidence about this release.");
    } else {
      const ageH = (Date.now() - started) / 3600000;
      if (ageH > maxAge) {
        add("R4 stale", `${(ageH / 24).toFixed(1)} days old (limit ${maxAge} h): the nightly at ` +
          `${a.started_at} cannot speak for code changed since. Re-run the gate: ` +
          `npm run test:browser-gate`);
      } else {
        note.push({ age_hours: Math.round(ageH * 10) / 10, max_age_hours: maxAge });
      }
    }

    // R6/R7/R8 — the release surface, case by case, against the committed inventory.
    const cases = Array.isArray(a.cases) ? a.cases : null;
    if (!cases) {
      add("R6 required-spec-missing", "the artifact carries no `cases[]` array, so NOTHING can be shown " +
        "to have passed in it. A run that died before execution (collection failure, contention) " +
        "writes exactly this shape.");
    } else {
      const byFile = new Map();
      for (const t of cases) {
        const f = basename(t.file);
        if (!byFile.has(f)) byFile.set(f, []);
        byFile.get(f).push(t);
      }
      const invByFile = new Map((inventory ? inventory.spec_files : []).map((s) => [s.file, s.tests]));
      const report = [];
      for (const spec of required) {
        const got = byFile.get(spec) || [];
        const expected = invByFile.get(spec);
        if (expected === undefined) {
          add("R6 required-spec-missing", `${spec} is required by the release surface but is not in ` +
            `${path.relative(ROOT, INVENTORY)} — the inventory and this check disagree, so neither ` +
            "can vouch for the suite. Fix the requirement or regenerate the inventory deliberately.");
          continue;
        }
        if (got.length === 0) {
          add("R6 required-spec-missing", `not one case of ${spec} ran in ${info.artifact} ` +
            `(the inventory expects ${expected}). That suite is this release's evidence; a run that ` +
            "skipped or never reached it says nothing about it.");
          continue;
        }
        if (got.length !== expected) {
          add("R7 required-spec-count", `${spec}: the artifact carries ${got.length} case(s) but ` +
            `${path.relative(ROOT, INVENTORY)} pins ${expected} — the suite that ran is not the suite ` +
            "this project committed to. A case was lost (or added without regenerating the inventory).");
          continue;
        }
        const bad = got.filter((t) => t.status !== "pass");
        if (bad.length) {
          add("R8 required-spec-not-passing", `${spec}: ${bad.length} of ${got.length} case(s) did not ` +
            "pass — " + bad.map((t) => `${t.status} "${t.title}"`).join("; "));
          continue;
        }
        report.push(`${spec}: ${got.length}/${expected} pass`);
      }
      if (report.length) note.push({ required_surface: report });
    }

    // R9/R10 — the artifact must be about the bytes being released.
    if (!has("--skip-git-check")) {
      const lastTouch = git(["log", "-1", "--format=%cI", "--", PRODUCT_DIR]);
      if (!lastTouch) {
        add("R9 predates-product-change", `cannot establish the last commit touching ${PRODUCT_DIR}/ ` +
          "(git unavailable or this is not a worktree), so the artifact cannot be shown to be newer " +
          "than the product it is supposed to certify. Pass --skip-git-check only when you know why.");
      } else {
        const t = Date.parse(lastTouch);
        if (Number.isFinite(started) && t > started) {
          add("R9 predates-product-change", `${info.artifact} started ${a.started_at}, but ${PRODUCT_DIR}/ ` +
            `changed later (${lastTouch}). The release's product edits have never been through the ` +
            "browser gate. Re-run it: npm run test:browser-gate");
        } else {
          note.push({ product_last_change: lastTouch, artifact_covers_it: true });
        }
      }
      const dirty = git(["status", "--porcelain", "--", PRODUCT_DIR]);
      if (dirty === null) {
        add("R10 uncommitted-product-changes", "cannot read `git status` for " + PRODUCT_DIR + "/.");
      } else if (dirty) {
        add("R10 uncommitted-product-changes", `${PRODUCT_DIR}/ carries uncommitted changes, which no ` +
          "run can have certified:\n    " + dirty.split(/\r?\n/).join("\n    ") +
          "\n  Commit them and re-run the gate, or the release ships bytes the suite never saw.");
      }
    }
  }

  const json = has("--json");
  const ok = findings.length === 0;
  if (json) {
    console.log(JSON.stringify({ release_gate: ok ? "PASS" : "FAIL", findings, notes: note }, null, 2));
  } else {
    for (const n of note) {
      if (n.artifact) {
        console.log(`browser-gate artifact : ${n.artifact}`);
        console.log(`  run                : ${n.mode}, started ${n.started_at}` +
        (n.wall_clock_s === undefined ? "" : `, ${n.wall_clock_s}s`) +
        `, ${n.counts}, host canary ${JSON.stringify(n.host_canary)}`);
      }
      if (n.age_hours !== undefined) console.log(`  age                : ${n.age_hours} h (limit ${n.max_age_hours} h)`);
      if (n.product_last_change) console.log(`  product covered    : js/ last changed ${n.product_last_change}`);
      if (n.required_surface) {
        for (const r of n.required_surface) console.log(`  required surface   : ${r}`);
      }
    }
    if (ok) {
      console.log("RELEASE GATE PASS — the browser suite is green, fresh, and covers this release's surface.");
      console.log("  next: bump package.json + manifest.json TOGETHER (manual_verification_phase4.spec.js)");
      console.log("        and quote the artifact above in CHANGELOG.md.");
    } else {
      console.error(`RELEASE GATE FAIL — ${findings.length} finding(s):`);
      for (const f of findings) console.error(`  [${f.marker}] ${f.detail}`);
    }
  }
  process.exit(ok ? 0 : 1);
}

main();
