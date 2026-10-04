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
 *   5. the REAL log's nine-day totals are pinned INSIDE A DECLARED WINDOW - the nine UTC days
 *      the pin was measured over - but only where the log exists (it lives on an ignored path,
 *      so a fresh clone has no copy - same shape as the overlay suite);
 *   6. the WINDOW is asserted to be the thing that holds those totals, so the pin cannot go
 *      green by measuring nothing: the slice is asserted to be exactly the records the whole-log
 *      derivation places inside the window (two mechanisms, one answer), the UN-windowed
 *      derivation of the same live log is asserted NOT to read the pinned totals (it has accrued
 *      past the window), and dropping ONE in-window event line is asserted to move a pinned
 *      total by exactly one event.
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

/**
 * The window the pin describes, as WHOLE UTC DAYS, inclusive at both ends.
 *
 * The audit log on this machine is LIVE - it kept accruing after the pin was taken - so "derive
 * the whole log and assert 78 fires" was a time bomb: the numbers moved while nothing in the
 * event stream changed (2026-10-04: `116 !== 78` on the same log; the filing's own re-run read
 * 112). The pin says what it measures - "the nine-day truth, MEASURED 2026-09-27" - so the fix
 * is to hand the deriver exactly that span instead of whatever the log has grown into.
 *
 * The bounds are MEASURED off the live log, not chosen to make the numbers come out:
 *
 *   * `2026-09-18..2026-09-26` reproduces ALL TWELVE pinned values; every neighbour window does
 *     NOT. `..09-27` reads 81 fires / 29 spawns / 12 unterminated (2026-09-27's first `fire` is
 *     `2026-09-27T20:13:47Z`), `09-19..09-26` reads 76 fires, `09-18..09-25` reads 72. The
 *     filing annotates the span as "2026-09-18 -> 2026-09-27"; that annotation is one day too
 *     wide, and the measurement is why the bound below ends at 09-26.
 *   * The slice opens at the live log's OWN first line (`2026-09-18T22:15:54Z`, asserted in the
 *     pin) and closes at 09-26's last one.
 */
const PIN_SINCE = "2026-09-18";
const PIN_UNTIL = "2026-09-26";
const PIN_FROM = `${PIN_SINCE}T00:00:00Z`;
const PIN_TO = `${PIN_UNTIL}T23:59:59Z`;
/** The pinned window's stream. Its own path, so the whole-log `idlegate-events.jsonl` a human
 *  derives for ad-hoc reading is never overwritten by a test run. */
const PINNED_EVENTS = path.join("temp", "idlegate", "idlegate-events.pinned-window.jsonl");

/** A log line's place in time is its LEADING instant - the same shape the deriver's own `ts`
 *  grammar matches (`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\s` in `scripts/idlegate_events.py`).
 *  Kept visible here because this file slices lines by it. */
const LINE_TS = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s/;

/**
 * Slice a log's TEXT to the pinned window, by the log's own line grammar.
 *
 * `--since`/`--until` flags on the deriver would do this too; they are NOT added, because the
 * window is the PIN's business and `scripts/idlegate_events.py` is what the live gate runs -
 * the derivation it performs for the gate is the whole-log one, unchanged. The two rules below
 * mirror the deriver's: a line is placed by its leading instant (after the same NUL-byte
 * stripping the deriver does for the log's torn writes), and a line with NO instant cannot be
 * placed in any window and is dropped rather than guessed into one. Returns the kept lines plus
 * the count dropped.
 */
function sliceToPinnedWindow(text) {
  const lines = [];
  let undated = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const m = LINE_TS.exec(line.replaceAll("\u0000", ""));
    if (!m) {
      undated += 1;
      continue;
    }
    if (m[1] < PIN_FROM || m[1] > PIN_TO) continue;
    lines.push(line);
  }
  return { lines, undated };
}

/** Write `lines` as an audit log in a fresh temp tree and return its path. */
function writeTempLog(lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "idlegate-slice-"));
  const p = path.join(dir, "audit.log");
  fs.writeFileSync(p, lines.join("\n") + "\n");
  return p;
}

/** Derive a log file with the project's OWN deriver, into `outAbs`. */
function deriveLog(logAbs, outAbs, tag) {
  const derived = runTool(DERIVER, ["--root", ROOT, "--log", logAbs, "--out", outAbs]);
  assert.strictEqual(derived.status, 0, `the ${tag} derivation must succeed:\n${derived.out}`);
  return outAbs;
}

/** Read a JSONL stream (absolute path). */
function readJsonl(absPath) {
  return fs
    .readFileSync(absPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/** Derive the LIVE log over the pinned window into PINNED_EVENTS, and return that path. */
function derivePinnedWindow() {
  const sliced = sliceToPinnedWindow(fs.readFileSync(REAL_LOG, "utf8"));
  assert.ok(sliced.lines.length > 0, "the pinned window must hold lines");
  return deriveLog(writeTempLog(sliced.lines), path.join(ROOT, PINNED_EVENTS), "pinned-window");
}

/** Reduce an event stream (absolute path) through the LIVE archive join, so
 *  `value.issue_closed` keeps exactly the meaning the pin gave it. */
function censusOf(eventsAbs, day) {
  const args = ["--root", ROOT, "--events", eventsAbs, "--json"];
  if (day) args.push("--date", day);
  const res = runTool(REDUCER, args);
  assert.strictEqual(res.status, 0, `${eventsAbs}${day ? ` (${day})` : ""}: ${res.out}`);
  return JSON.parse(res.stdout);
}

/** The live log derived WHOLE (no window), memoised - the accrual control the pin is read
 *  against. The un-windowed path is what the live gate runs, so it keeps coverage here. */
let wholeLogRecords = null;
function wholeLog() {
  if (wholeLogRecords === null) {
    const out = path.join(os.tmpdir(), `idlegate-whole-${process.pid}.jsonl`);
    deriveLog(REAL_LOG, out, "whole-log");
    wholeLogRecords = readJsonl(out);
  }
  return wholeLogRecords;
}

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
    const c = censusOf(derivePinnedWindow());
    // The nine-day truth, MEASURED 2026-09-27 - and asserted over the nine UTC days it was
    // measured in (PIN_SINCE..PIN_UNTIL), NOT over whatever the live log has grown into. The
    // LIVE log may accrue all it likes: these numbers must NOT move for it. If one does move,
    // the event stream changed INSIDE the window - find out why before editing this block.
    assert.strictEqual(c.fires.total, 78);
    assert.deepStrictEqual(c.fires.by_rung, { p1: 1, p2: 52, p3: 14, p4: 11 });
    assert.strictEqual(c.spawns.total, 27);
    assert.strictEqual(c.children.terminals_primary, 17);
    assert.strictEqual(c.children.completed, 0, "no child ever completed in nine days");
    assert.strictEqual(c.children.unterminated_pids, 10);
    assert.deepStrictEqual(c.children.orphan_terminals, []);
    assert.strictEqual(c.cycles.closed, 0, "every p3/p4 cycle ended blocked or declined");
    assert.strictEqual(c.value.accepted_repo_value, 0, "and no run is named as a closer");
    // SECOND live input, named so a red run is diagnosable: the reducer joins `temp/archived`
    // for this key, so an artifact archived by someone else after the pin was taken moves THIS
    // number and no other. Check the archive before suspecting the stream.
    assert.strictEqual(c.value.issue_closed, 5, "5 targeted artifacts were archived by OTHERS");
    assert.strictEqual(c.budget.builder_runs_charged, 0);
    assert.strictEqual(c.invariants.no_orphan_terminals, true);
    // And the BOUNDS are pinned too, so a red run cannot be silenced by nudging a window end
    // until the numbers come back: the slice opens at the live log's own first line and closes
    // at 2026-09-26's last one. Moving either end to change a total moves these two.
    assert.strictEqual(c.window.first_ts, "2026-09-18T22:15:54Z",
      "the window opens at the live log's first line");
    assert.strictEqual(c.window.last_ts, "2026-09-26T23:59:23Z",
      "and closes at 2026-09-26's last line");
  });

  it("the per-day slices sum to the whole window (no double-count, no dropped day)", function () {
    if (!fs.existsSync(REAL_LOG)) this.skip();
    const eventsAbs = derivePinnedWindow();
    const events = readJsonl(eventsAbs);
    const days = [...new Set(events.map((e) => e.day_utc))].sort();
    assert.deepStrictEqual(
      days,
      ["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23",
        "2026-09-24", "2026-09-25", "2026-09-26"],
      "the pinned window is exactly the nine UTC days it claims to be",
    );

    let summedFires = 0;
    let summedSpawns = 0;
    const rungs = {};
    for (const day of days) {
      const c = censusOf(eventsAbs, day);
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

    const whole = censusOf(eventsAbs);
    assert.strictEqual(summedFires, whole.fires.total, "per-day fires must sum to the total");
    assert.strictEqual(summedSpawns, whole.spawns.total, "per-day spawns must sum to the total");
    assert.deepStrictEqual(rungs, whole.fires.by_rung, "per-day rungs must sum to the total");
  });

  it("the window is what holds the pin: the slice IS its records, and CONTENT moves them",
    function () {
      if (!fs.existsSync(REAL_LOG)) this.skip();
      const live = censusOf(derivePinnedWindow());
      assert.strictEqual(live.fires.total, 78, "control: the window reads the pinned totals");

      // The slice and the window are the SAME record set, arrived at by two mechanisms: a line
      // slice by the log's own leading instant, and a `ts` filter over the whole-log derivation.
      // A slicing grammar that drifted from the deriver's would surface HERE instead of as a
      // quietly narrower window that still happened to reduce clean.
      const sliced = readJsonl(path.join(ROOT, PINNED_EVENTS));
      const inWindow = wholeLog().filter((r) => r.ts >= PIN_FROM && r.ts <= PIN_TO);
      const withoutProvenance = (r) => JSON.stringify({ ...r, seq: 0, line: 0 });
      assert.strictEqual(sliced.length, inWindow.length,
        "the slice holds exactly the records the whole-log derivation places in the window");
      assert.deepStrictEqual(sliced.map(withoutProvenance), inWindow.map(withoutProvenance),
        "and they are the same records, in the same order, field for field");

      // ...whereas the UN-windowed derivation of the same live log does NOT read them: it has
      // accrued past the window. If this ever stops being true, the log was truncated or
      // rotated - news, not noise.
      const wholeFires = wholeLog().filter((r) => r.event === "rung.fire").length;
      assert.ok(wholeFires > live.fires.total,
        `the un-windowed derivation must cover more than the window: ${wholeFires} fires vs ` +
          `the pinned ${live.fires.total}`);

      // DROP ONE FIRE inside the window: the total must move by exactly one event, and the rung
      // it belonged to must be the one that moves. A pin reading an anchored input (a fixture, a
      // cache, a nudged bound) would not budge here - that is the failure this refuses.
      const windowSlice = sliceToPinnedWindow(fs.readFileSync(REAL_LOG, "utf8"));
      const lines = windowSlice.lines;
      // The only lines the slice may drop are the ones that carry NO instant: the deriver
      // reports exactly those as records with an empty `ts` on the un-windowed path, so the two
      // counts must agree. A slice that quietly dropped a TIME-STAMPED line would show up here.
      assert.strictEqual(windowSlice.undated,
        wholeLog().filter((r) => r.ts === "").length,
        "the slice drops exactly the undated lines the deriver cannot place in any window");
      const drop = (predicate, tag) => {
        const at = lines.findIndex(predicate);
        assert.ok(at >= 0, `the window holds at least one ${tag}`);
        const out = path.join(os.tmpdir(), `idlegate-${tag}-${process.pid}.jsonl`);
        deriveLog(writeTempLog(lines.filter((_, i) => i !== at)), out, `dropped-${tag}`);
        return censusOf(out);
      };

      const noFire = drop((l) => /^\S+ fire /.test(l), "fire");
      assert.strictEqual(noFire.fires.total, live.fires.total - 1,
        "one dropped fire line is one fewer fire");
      const moved = Object.entries(live.fires.by_rung)
        .map(([rung, n]) => [rung, n - (noFire.fires.by_rung[rung] || 0)])
        .filter(([, delta]) => delta !== 0);
      assert.strictEqual(moved.length, 1, "exactly one rung loses the dropped fire");
      assert.strictEqual(moved[0][1], 1);
      assert.deepStrictEqual(noFire.children.orphan_terminals, [],
        "dropping a fire does not orphan a terminal");

      // The same shape for a spawn: the pinned block asserts fires, spawns AND terminals, so no
      // single dropped line can leave it looking satisfied.
      const noSpawn = drop((l) => / builder spawn pid=\d+ /.test(l), "spawn");
      assert.strictEqual(noSpawn.spawns.total, live.spawns.total - 1,
        "one dropped spawn line is one fewer spawn");
    });
});
