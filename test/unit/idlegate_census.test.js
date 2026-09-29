/**
 * The idle-gate census must be a PURE FUNCTION of a typed event stream, and it must be able to
 * FAIL — both about the gate and about itself.
 *
 * Why this suite exists (2026-09-27 audit): the gate wrote 7092 lines of prose into
 * `temp/idlegate/idlegate-audit.log` over nine days and every summary anyone could quote came
 * from a regex someone re-invented that day. Two of those measurements contradicted each other
 * (`tech-debt 4 / runtime-perf 4` vs `14 / 11`) and one of them, `executor issue-fixes ok`,
 * meant "the gate handled its own state" while sitting next to `closed=0` — so a reader could
 * conclude the gate had delivered 32 times when it had delivered zero.
 *
 * `scripts/idlegate_events.py` + `scripts/idlegate_census_v2.py` replace that with one typed
 * stream and one reducer. This file is the falsifiability proof for BOTH halves:
 *
 *   1. a SYNTHETIC log with hand-counted contents reduces to exactly those counts, so the
 *      reducer cannot be passing by agreeing with itself on the real (unread) log;
 *   2. `executor ... ok` is asserted to contribute to NO value key — the semantic collapse
 *      that started the audit is now a failing test if anyone reintroduces it;
 *   3. the reconciliation against the gate's own `idlegate census` line is asserted to FAIL
 *      (exit 3) on a log whose census contradicts its events, so `--check` is not a rubber
 *      stamp;
 *   4. dropping a terminal line is asserted to move `unterminated_pids` — proving the key
 *      measures the stream rather than a constant;
 *   5. the REAL log's nine-day totals are pinned, but only where the log exists (it lives on
 *      an ignored path, so a fresh clone has no copy - same shape as the overlay suite).
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const DERIVER = path.join(ROOT, "scripts", "idlegate_events.py");
const REDUCER = path.join(ROOT, "scripts", "idlegate_census_v2.py");
const REAL_LOG = path.join(ROOT, "temp", "idlegate", "idlegate-audit.log");

/** A synthetic day with hand-counted contents. Every number in the expectations below is
 *  readable off these 15 lines, which is the point: nothing is taken on faith. */
const SYNTHETIC = [
  "2026-01-01T00:00:00Z evaluate idle=false idleFor=0s reason=not-idle",
  "2026-01-01T00:15:00Z fire issue-fixes",
  "2026-01-01T00:15:00Z maintenance verdict row=0 reason=local_config_ok allow=true rung=p2 run=orch-20260101T001500.000000000-1 budget_source=local-config (no maintenance surface configured - the local [idle_gate] money keys decided)",
  "2026-01-01T00:15:01Z builder spawn pid=111 task=Fix temp/issues/ISSUE_synthetic_20260101.md per its own evidence standards; close its Status marker",
  "2026-01-01T00:45:02Z executor issue-fixes error: builder run killed after 30m0s: context deadline exceeded",
  "2026-01-01T01:15:00Z fire issue-fixes",
  "2026-01-01T01:15:00Z maintenance verdict row=0 reason=local_config_ok allow=true rung=p2 run=orch-20260101T011500.000000000-1 budget_source=local-config",
  "2026-01-01T01:15:01Z builder spawn refused: idle-gate: builder max runs per day (6) reached (per-day backstop)",
  "2026-01-01T01:15:02Z executor issue-fixes error: idle-gate: builder max runs per day (6) reached",
  "2026-01-01T02:15:00Z fire issue-fixes",
  "2026-01-01T02:15:00Z maintenance verdict row=0 reason=local_config_ok allow=true rung=p2 run=orch-20260101T021500.000000000-1 budget_source=local-config",
  "2026-01-01T02:15:01Z issue-fixes all open issues parked; oldest ISSUE_synthetic_20260101.md parked_at=2026-01-01T00:45:02Z attempts=2 rearms=2026-01-01T06:45:02Z",
  "2026-01-01T02:15:02Z executor issue-fixes ok",
  "2026-01-01T03:00:00Z builder liveness ok pid=111 bytes=0 cpu=-1h0m0.123456789s",
  "2026-01-01T06:30:00Z idlegate census 2026-01-01: fires=p2:3 closed=0 closeout_failed=0 parked=1 escalated=0 refused=1 spend=0.02USD builder_runs=0",
];

function runTool(script, args, cwd) {
  const res = spawnSync("python", [script, ...args], { cwd: cwd || ROOT, encoding: "utf8" });
  if (res.error) {
    throw new Error(
      `could not run ${path.basename(script)}: ${res.error.message}. These tests need ` +
        "`python` on PATH.",
    );
  }
  return {
    status: res.status,
    out: `${res.stdout || ""}${res.stderr || ""}`,
    stdout: res.stdout || "",
  };
}

/** Write a synthetic audit log into a fresh temp tree and reduce it to JSON. */
function reduce(lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "idlegate-"));
  fs.writeFileSync(path.join(dir, "audit.log"), lines.join("\n") + "\n");
  const derived = runTool(DERIVER, ["--root", dir, "--log", "audit.log", "--out", "events.jsonl"],
    dir);
  assert.strictEqual(derived.status, 0, "the deriver must accept the synthetic grammar:\n" +
    derived.out);
  const census = runTool(REDUCER, ["--root", dir, "--events", "events.jsonl", "--json"], dir);
  assert.strictEqual(census.status, 0, "the reducer must accept the derived stream:\n" +
    census.out);
  const events = fs
    .readFileSync(path.join(dir, "events.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  return { dir, events, census: JSON.parse(census.out), raw: census.out };
}

describe("idlegate census v2 (typed stream + reducer)", function () {
  this.timeout(60000);

  it("reduces a synthetic day to exactly the counts its lines imply", function () {
    const { census, events } = reduce(SYNTHETIC);
    const byVerb = {};
    for (const e of events) byVerb[e.event] = (byVerb[e.event] || 0) + 1;

    assert.strictEqual(byVerb["tick"], 1, "one evaluate line -> one tick");
    assert.strictEqual(byVerb["rung.fire"], 3, "three fire lines -> three fires");
    assert.strictEqual(byVerb["rung.verdict"], 3, "each fire has a verdict");
    assert.strictEqual(byVerb["child.spawn"], 1, "exactly one real spawn");
    assert.strictEqual(byVerb["child.refused"], 1, "the backstop refusal is its own verb");
    assert.strictEqual(byVerb["child.terminal"], 1, "one terminal, from the executor error");
    assert.strictEqual(byVerb["rung.parked"], 1, "the parked rung is its own verb");
    assert.strictEqual(byVerb["unparsed"], undefined, "no line may fall through the grammar");

    assert.deepStrictEqual(census.fires.by_rung, { p2: 3 }, "all three fires are p2");
    assert.strictEqual(census.children.terminals_primary, 1);
    assert.deepStrictEqual(census.children.by_reason, { "killed after 30m0s": 1 });
    assert.deepStrictEqual(census.refused.by_reason, { "max-runs-per-day": 1 });
    assert.strictEqual(census.parked.total, 1);
    assert.deepStrictEqual(census.parked.by_rung, { p2: 1 });
    assert.deepStrictEqual(census.invariants, {
      no_orphan_terminals: true,
      every_fire_has_verdict: true,
      every_verdict_allows: true,
      charges_without_value: false,
      unparsed_ratio: 0,
    });
  });

  it("`executor ... ok` is a state report and contributes to NO value key", function () {
    const { census } = reduce(SYNTHETIC);
    // The synthetic day has one `executor issue-fixes ok` line and one real spawn.
    assert.strictEqual(census.rung_executors.ok, 1, "the ok line IS counted, as a verb");
    assert.strictEqual(
      census.value.accepted_repo_value,
      0,
      "but it may never be counted as accepted value",
    );
    assert.strictEqual(
      census.children.completed,
      0,
      "and there is no success verb, so no child may be reported as completed",
    );
    assert.strictEqual(
      census.children.success_verb_present,
      false,
      "the absence is asserted, not assumed",
    );
    assert.match(census.rung_executors.note, /NOT a value claim/);
  });

  it("reconciles against the gate's own census line, and FAILS when they disagree", function () {
    const { census, dir } = reduce(SYNTHETIC);
    assert.deepStrictEqual(census.gateway_census.fires, { p2: 3 });
    assert.strictEqual(census.gateway_census.parked, 1);
    assert.strictEqual(census.gateway_census.spend_usd, 0.02);
    for (const [key, r] of Object.entries(census.reconciled)) {
      if (r.events === "not modelled") continue; // named honestly rather than guessed
      assert.strictEqual(r.match, true, `${key} must reconcile: ${JSON.stringify(r)}`);
    }
    assert.strictEqual(
      census.reconciled.closeout_failed.events,
      "not modelled",
      "the one key the event stream cannot express must say so instead of faking a match",
    );

    // Falsify it: the same events, with the census line claiming a close that never happened.
    // --check must exit 3 - a reconciliation that cannot disagree is decoration.
    const lying = SYNTHETIC.map((l) =>
      l.replace("closed=0 closeout_failed=0", "closed=1 closeout_failed=0"),
    );
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "idlegate-"));
    fs.writeFileSync(path.join(dir2, "audit.log"), lying.join("\n") + "\n");
    runTool(DERIVER, ["--root", dir2, "--log", "audit.log", "--out", "events.jsonl"], dir2);
    const checked = runTool(
      REDUCER,
      ["--root", dir2, "--events", "events.jsonl", "--date", "2026-01-01", "--check"],
      dir2,
    );
    assert.strictEqual(checked.status, 3, "a contradicting census line must fail --check:\n" +
      checked.out);
    assert.match(checked.out, /closed/, "the failing key is named");
    assert.ok(fs.existsSync(path.join(dir, "events.jsonl")), "control run left its own tree");
  });

  it("measures the stream: dropping a terminal line moves `unterminated_pids`", function () {
    const before = reduce(SYNTHETIC).census;
    assert.deepStrictEqual(before.children.unterminated, [], "nothing is unterminated here");

    const dropped = SYNTHETIC.filter(
      (l) => !l.includes("executor issue-fixes error: builder run killed"),
    );
    const after = reduce(dropped).census;
    assert.deepStrictEqual(
      after.children.unterminated,
      ["111"],
      "the spawned child with no terminal must be reported, not silently assumed fine",
    );
    assert.strictEqual(after.children.terminals_primary, 0);
    assert.strictEqual(after.value.accepted_repo_value, 0);
  });

  it("pins the real nine-day log's totals where that log exists", function () {
    if (!fs.existsSync(REAL_LOG)) {
      this.skip(); // ignored path: a fresh public clone has no audit log to check
    }
    const derived = runTool(DERIVER, [
      "--root", ROOT, "--log", path.join("temp", "idlegate", "idlegate-audit.log"),
      "--out", path.join("temp", "idlegate", "idlegate-events.jsonl"),
    ]);
    assert.strictEqual(derived.status, 0, derived.out);
    const res = runTool(REDUCER, [
      "--events", path.join("temp", "idlegate", "idlegate-events.jsonl"), "--json",
    ]);
    assert.strictEqual(res.status, 0, res.out);
    const c = JSON.parse(res.stdout);
    // The nine-day truth, MEASURED 2026-09-27. If a number moves, the event stream changed -
    // find out why before editing this block.
    assert.strictEqual(c.fires.total, 78);
    assert.deepStrictEqual(c.fires.by_rung, { p1: 1, p2: 52, p3: 14, p4: 11 });
    assert.strictEqual(c.spawns.total, 27);
    assert.strictEqual(c.children.terminals_primary, 17);
    assert.strictEqual(c.children.completed, 0, "no child ever completed in nine days");
    assert.strictEqual(c.children.unterminated_pids, 10);
    assert.deepStrictEqual(c.children.orphan_terminals, []);
    assert.strictEqual(c.cycles.closed, 0, "every p3/p4 cycle ended blocked or declined");
    assert.strictEqual(c.value.accepted_repo_value, 0, "and no run is named as a closer");
    assert.strictEqual(c.value.issue_closed, 5, "5 targeted artifacts were archived by OTHERS");
    assert.strictEqual(c.budget.builder_runs_charged, 0);
    assert.strictEqual(c.invariants.no_orphan_terminals, true);
  });

  it("the per-day slices sum to the whole window (no double-count, no dropped day)", function () {
    if (!fs.existsSync(REAL_LOG)) this.skip();
    runTool(DERIVER, [
      "--root", ROOT, "--log", path.join("temp", "idlegate", "idlegate-audit.log"),
      "--out", path.join("temp", "idlegate", "idlegate-events.jsonl"),
    ]);
    const events = fs
      .readFileSync(path.join(ROOT, "temp", "idlegate", "idlegate-events.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const days = [...new Set(events.map((e) => e.day_utc))].sort();

    let summedFires = 0;
    let summedSpawns = 0;
    const rungs = {};
    for (const day of days) {
      const res = runTool(REDUCER, [
        "--root", ROOT, "--events", path.join("temp", "idlegate", "idlegate-events.jsonl"),
        "--date", day, "--json",
      ]);
      assert.strictEqual(res.status, 0, `${day}: ${res.out}`);
      const c = JSON.parse(res.stdout);
      summedFires += c.fires.total;
      summedSpawns += c.spawns.total;
      for (const [rung, n] of Object.entries(c.fires.by_rung)) {
        rungs[rung] = (rungs[rung] || 0) + n;
      }
      // Every spawned pid in a day's window must be accounted for as terminated or
      // unterminated - a child that silently vanishes from a slice is the failure mode this
      // exists to catch.
      assert.deepStrictEqual(
        c.children.orphan_terminals,
        [],
        `${day}: a terminal landed in a window its spawn did not`,
      );
    }

    const whole = JSON.parse(
      runTool(REDUCER, [
        "--root", ROOT, "--events", path.join("temp", "idlegate", "idlegate-events.jsonl"),
        "--json",
      ]).stdout,
    );
    assert.strictEqual(summedFires, whole.fires.total, "per-day fires must sum to the total");
    assert.strictEqual(summedSpawns, whole.spawns.total, "per-day spawns must sum to the total");
    assert.deepStrictEqual(rungs, whole.fires.by_rung, "per-day rungs must sum to the total");
  });
});
