/**
 * Model-call budget + telemetry — every arm proven in BOTH directions.
 *
 * WHY THIS SUITE EXISTS (track `runtime_perf_20261015`, phase 3/4). The track's own acceptance
 * criteria are about what a call DOES under pressure: it must abort at its budget, record a
 * terminal event for a failure/timeout/cancel rather than omitting it, release a cancelled caller
 * instead of hanging, and never let a retry chain run past its session cap. None of that is
 * provable from the helper's source, and all of it is exactly what the area could not do before —
 * six scripts dialled model endpoints with a per-READ socket timeout and NO telemetry at all
 * (`scripts/perf/runtime-perf-baseline.md` F-3).
 *
 * THE TRANSPORT IS SYNTHETIC, THE CODE PATH IS REAL. A local `http` server (Node) and a local
 * `http.server` (Python) stand in for the providers, so every assertion here runs the production
 * helper, its supervisor, its writer and its reader. No seat call is made and no credential is
 * needed; what is NOT covered by this is a provider's real latency distribution, and the report
 * says so in its own words rather than letting a green suite imply it.
 *
 * THE LAST TWO CASES ARE THE ANTI-VACUITY ONES, and they are the reason this file is a gate rather
 * than a demo: the validator must FAIL on a store that is missing a duration, missing a status,
 * double-terminated, unterminated, or EMPTY — a validator that can only say "yes" would let the AC-1
 * coverage figure be satisfied by nothing at all.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const HELPER_JS = path.join(ROOT, "scripts", "perf", "model_call_telemetry.js");
const VALIDATOR = path.join(ROOT, "scripts", "perf", "validate_model_call_telemetry.js");
const BUDGETS = path.join(ROOT, "scripts", "perf", "budgets.json");
const PY_HELPER = path.join(ROOT, "scripts", "perf", "model_call_telemetry.py");
const REPORT_TOOL = path.join(ROOT, "scripts", "perf", "runtime_perf_report.js");

const { callModel, CancelToken, loadBudgets, resolveBudget, fingerprint } = require(HELPER_JS);
const { validateStore, percentileSorted } = require(VALIDATOR);
const { displayPath } = require(REPORT_TOOL);

let tmpRoot = null;
function tmpdir() {
  if (!tmpRoot) tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "model-call-telemetry-"));
  return tmpRoot;
}
function tmpFile(name) {
  return path.join(tmpdir(), name);
}

/**
 * An HTTP transport built on `node:http`, NOT on the global `fetch`.
 *
 * This is not a stylistic choice. `test/unit/catalog_logic.test.js` assigns `global.fetch = ...` at
 * MODULE SCOPE and never restores it, and it sorts before this file — so by the time these cases run,
 * the ambient `fetch` is that suite's canned stub: it answers instantly, never contacts this file's
 * server and never honours the `AbortSignal` the helper passes. Measured in the full suite: every
 * case that REQUIRES the supervisor's clock (abort-at-budget, cancel, progress ticks, coalescing —
 * hits 0 instead of 1) failed here while passing in isolation. The helper is transport-agnostic by
 * design, so the test hands it a transport it OWNS; the production site still passes `fetch`.
 */
function httpTransport(url, key) {
  return ({ signal }) => new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key || "test"}` },
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({
        ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode,
        text: async () => body,
      }));
    });
    req.on("error", reject);
    req.end("{}");
  });
}

/** A tiny local transport server. `mode` decides what it does with a request. */
function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve({
      server,
      url: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((done) => server.close(done)),
    }));
  });
}

function readRecords(storePath) {
  if (!fs.existsSync(storePath)) return [];
  return fs.readFileSync(storePath, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

/** A budget source that overrides one class: the SAME file both runtimes read, narrowed in memory. */
function narrowedBudgets(className, patch) {
  const data = JSON.parse(fs.readFileSync(BUDGETS, "utf8"));
  data.classes[className] = Object.assign({}, data.classes[className], patch);
  return data;
}

const SITE = "scripts/perf/model_call_telemetry.py#sample";

describe("model-call telemetry: budget, cancellation and terminal coverage (runtime_perf_20261015)", function () {
  this.timeout(60000);

  describe("node helper (scripts/border_design_generator.js's contract)", () => {
    let stub;

    after(async () => { if (stub) await stub.close(); });

    it("records duration_ms and one terminal event on success", async () => {
      stub = await startServer((req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.end('{"ok":true}'); });
      const store = tmpFile("node-ok.jsonl");
      const r = await callModel({
        site: "scripts/border_design_generator.js", role: "reasonix-agent",
        model: "gemini-3.8-flash", provider: "stub", fingerprintMaterial: "body",
        transport: httpTransport(`${stub.url}/chat/completions`),
        store,
      });
      assert.strictEqual(r.ok, true, "the call should succeed against the stub");
      const records = readRecords(store);
      const terminals = records.filter((x) => x.event === "model_call_terminal");
      assert.strictEqual(terminals.length, 1, "EXACTLY ONE terminal event per logical call");
      assert.strictEqual(terminals[0].status, "success");
      assert.ok(typeof terminals[0].duration_ms === "number" && terminals[0].duration_ms >= 0,
        "duration_ms must be present and numeric on a terminal event");
      assert.strictEqual(terminals[0].request_class, "background_maintenance");
      assert.ok(String(terminals[0].fingerprint_hash).startsWith("sha256:"), "the fingerprint is redacted");
    });

    it("aborts at the BUDGET, not at the server's pace, and terminalises the timeout", async () => {
      const slow = await startServer((req, res) => {
        setTimeout(() => { res.writeHead(200); res.end("{}"); }, 1000);
      });
      const store = tmpFile("node-timeout.jsonl");
      const startedMs = Date.now();
      const r = await callModel({
        site: "scripts/border_design_generator.js", role: "reasonix-agent",
        model: "gemini-3.8-flash", provider: "stub", fingerprintMaterial: "body",
        transport: httpTransport(`${slow.url}/chat/completions`),
        store,
        budgets: narrowedBudgets("background_maintenance", { per_attempt_s: 0.2, session_cap_s: 0.4 }),
      });
      const elapsedMs = Date.now() - startedMs;
      assert.strictEqual(r.status, "timeout");
      assert.ok(elapsedMs < 900, `the caller must be released at the budget, not at 1000ms (took ${elapsedMs}ms)`);
      const terminal = readRecords(store).find((x) => x.event === "model_call_terminal");
      assert.strictEqual(terminal.timeout_flag, true, "status=timeout and timeout_flag=true travel together");
      assert.ok(terminal.duration_ms < 900, "the RECORDED duration is the bounded one");
      await slow.close();
    });

    it("cancels without hanging and signals it in the terminal record", async () => {
      const slow = await startServer((req, res) => {
        setTimeout(() => { res.writeHead(200); res.end("{}"); }, 2000);
      });
      const store = tmpFile("node-cancel.jsonl");
      const cancel = new CancelToken();
      setTimeout(() => cancel.set(), 60);
      const startedMs = Date.now();
      const r = await callModel({
        site: "scripts/border_design_generator.js", role: "reasonix-agent",
        model: "gemini-3.8-flash", provider: "stub", fingerprintMaterial: "body",
        transport: httpTransport(`${slow.url}/chat/completions`),
        store, cancel,
        budgets: narrowedBudgets("background_maintenance", { per_attempt_s: 30, session_cap_s: 30 }),
      });
      const elapsedMs = Date.now() - startedMs;
      assert.strictEqual(r.status, "cancelled");
      assert.ok(elapsedMs < 1500, `a cancel must not wait out the transport (took ${elapsedMs}ms)`);
      const terminal = readRecords(store).find((x) => x.event === "model_call_terminal");
      assert.strictEqual(terminal.cancel_flag, true);
      await slow.close();
    });

    it("terminalises a provider FAILURE (not omitted) and retries an error once, inside the session cap", async () => {
      const failing = await startServer((req, res) => { res.writeHead(503); res.end("nope"); });
      const store = tmpFile("node-error.jsonl");
      const r = await callModel({
        site: "scripts/border_design_generator.js", role: "reasonix-agent",
        model: "gemini-3.8-flash", provider: "stub", fingerprintMaterial: "body",
        transport: ({ signal, timeoutMs }) => httpTransport(`${failing.url}/chat/completions`)({ signal, timeoutMs })
          .then((res) => { if (!res.ok) throw new Error(`http ${res.status}`); return res; }),
        store,
        budgets: narrowedBudgets("background_maintenance", { per_attempt_s: 0.5, session_cap_s: 5 }),
      });
      assert.strictEqual(r.status, "error");
      assert.strictEqual(r.attempts, 2, "a retryable error is retried ONCE, per the declared policy");
      const terminals = readRecords(store).filter((x) => x.event === "model_call_terminal");
      assert.strictEqual(terminals.length, 1, "a retry chain still produces ONE terminal event");
      await failing.close();
    });

    it("emits progress ticks for a call that crosses the (compressed) progress threshold", async () => {
      const stub2 = await startServer((req, res) => {
        setTimeout(() => { res.writeHead(200); res.end("{}"); }, 140);
      });
      const store = tmpFile("node-ticks.jsonl");
      const data = narrowedBudgets("background_maintenance", { per_attempt_s: 2, session_cap_s: 2 });
      data.progress = { threshold_s: 0.01, tick_ms: 20 };
      await callModel({
        site: "scripts/border_design_generator.js", role: "reasonix-agent",
        model: "gemini-3.8-flash", provider: "stub", fingerprintMaterial: "body",
        transport: httpTransport(`${stub2.url}/chat/completions`),
        store, budgets: data,
      });
      const ticks = readRecords(store).filter((x) => x.event === "model_call_progress_tick");
      assert.ok(ticks.length >= 1, "a call past the progress threshold must emit at least one tick");
      assert.ok(ticks[0].elapsed_ms >= 0);
      await stub2.close();
    });

    it("COALESCES concurrent identical calls: one transport execution, two terminal records, one hit", async () => {
      let hits = 0;
      const stub3 = await startServer((req, res) => {
        hits += 1;
        setTimeout(() => { res.writeHead(200); res.end("{}"); }, 80);
      });
      const store = tmpFile("node-coalesce.jsonl");
      const data = narrowedBudgets("background_maintenance", { per_attempt_s: 2, session_cap_s: 2, coalesce: true });
      const body = "identical request body";
      const call = () => callModel({
        site: "scripts/border_design_generator.js", role: "reasonix-agent",
        model: "gemini-3.8-flash", provider: "stub", fingerprintMaterial: body,
        transport: httpTransport(`${stub3.url}/chat/completions`),
        store, budgets: data,
      });
      const [a, b] = await Promise.all([call(), call()]);
      assert.ok(hits > 0, "the transport must actually reach this file's server (a stubbed ambient "
        + "fetch would make the count 0 and the assertion below vacuous)");
      assert.strictEqual(hits, 1, "identical concurrent calls must share ONE transport execution");
      assert.strictEqual(a.status, "success");
      assert.strictEqual(b.status, "success");
      const terminals = readRecords(store).filter((x) => x.event === "model_call_terminal");
      assert.strictEqual(terminals.length, 2, "each caller gets its own terminal record");
      assert.strictEqual(terminals.filter((x) => x.cache_hit_flag === true).length, 1,
        "exactly one of the two is the coalesced hit");
      await stub3.close();
    });

    it("fingerprints a repeat identically, a different body differently, and never stores the material", async () => {
      const a = fingerprint("m", "p", SITE, "some prompt text");
      const b = fingerprint("m", "p", SITE, "some prompt text");
      const c = fingerprint("m", "p", SITE, "some other prompt text");
      assert.strictEqual(a, b);
      assert.notStrictEqual(a, c);
      assert.match(a, /^sha256:[0-9a-f]{16}$/, "the fingerprint is a truncated digest, not the material");

      // THE LEAK CLAIM, CHECKED AGAINST A REAL STORE. What stood here was
      // `assert.ok(!a.includes("prompt"))` — an assertion that could not fail whatever the helper
      // did (a `sha256:` + hex digest has no such substring), i.e. a claim with no failure mode.
      // A canary does have one: call the helper with a unique material and then scan every byte the
      // helper wrote for it. The scan is itself checked in both directions below, so a green result
      // cannot come from a scan that finds nothing anywhere.
      const canary = `LEAK-CANARY-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const stub4 = await startServer((req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); });
      const store = tmpFile("node-canary.jsonl");
      await callModel({
        site: "scripts/border_design_generator.js", role: "reasonix-agent",
        model: "gemini-3.8-flash", provider: "stub", fingerprintMaterial: canary,
        transport: httpTransport(`${stub4.url}/chat/completions`), store,
      });
      const written = fs.readFileSync(store, "utf8");
      assert.ok(!written.includes(canary),
        "the request material must never reach the store, in any field");
      assert.strictEqual(written.trim().split("\n").length, 2, "started + terminal, nothing else");
      // the same scan DOES find a canary that is there — so the line above is a check, not a tautology
      const leaking = `${store}.leak`;
      fs.writeFileSync(leaking, JSON.stringify({ event: "model_call_terminal", material: canary }) + "\n", "utf8");
      assert.ok(fs.readFileSync(leaking, "utf8").includes(canary),
        "the canary scan must fire when the material IS written");
      await stub4.close();
    });
  });

  describe("python helper (the five Python call sites' contract)", function () {
    // The driver is written OUTSIDE the repository on purpose: it is scaffolding for this suite, not
    // an artifact of the area, and the area's own guard would otherwise have to inventory it.
    const driver = path.join(tmpdir(), "model_call_telemetry_driver.py");

    before(() => {
      fs.writeFileSync(driver, DRIVER_SOURCE, "utf8");
    });

    function runDriver(args) {
      const res = spawnSync("python", [driver, PY_HELPER, ...args], {
        cwd: ROOT, encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      });
      if (res.error) {
        throw new Error(`could not run python: ${res.error.message}. This suite needs \`python\` on `
          + "PATH — the same dependency the repository's own utilities_telemetry suite requires.");
      }
      assert.strictEqual(res.status, 0, `driver failed:\n${res.stdout}\n${res.stderr}`);
      return JSON.parse(res.stdout.trim().split("\n").pop());
    }

    it("drives the real urllib transport against a local server: success, timeout, cancel, error, session, ticks, coalesce", () => {
      const out = runDriver([tmpFile("py-store.jsonl")]);
      const byCase = Object.fromEntries(out.cases.map((c) => [c.name, c]));

      assert.strictEqual(byCase.success.status, "success");
      assert.ok(byCase.success.duration_ms >= 0);
      assert.strictEqual(byCase.success.terminal_count, 1, "one terminal per call, whatever the outcome");

      assert.strictEqual(byCase.budget_expiry.status, "timeout");
      assert.strictEqual(byCase.budget_expiry.timeout_flag, true);
      assert.ok(byCase.budget_expiry.wall_ms < 900,
        `the caller must be released at its budget, not at the server's 1000ms (took ${byCase.budget_expiry.wall_ms}ms)`);

      assert.strictEqual(byCase.cancel.status, "cancelled");
      assert.strictEqual(byCase.cancel.cancel_flag, true);
      assert.ok(byCase.cancel.wall_ms < 1500, `a cancel must not hang (took ${byCase.cancel.wall_ms}ms)`);

      assert.strictEqual(byCase.error.status, "error");
      assert.strictEqual(byCase.error.attempts, 2, "a retryable error retries once");
      assert.strictEqual(byCase.error.terminal_count, 1);

      // A retry chain is bounded by the SESSION cap, not by max_attempts: five attempts were
      // authorised against a 350 ms session, and the chain stopped early — its last attempt squeezed
      // into a slice too small to finish, so it was terminalised as a timeout rather than left
      // running. `attempts` plus the bounded total are what prove the cap bit; the status is simply
      // the last outcome that actually happened.
      assert.ok(["error", "timeout"].includes(byCase.session_cap.status),
        `unexpected status ${byCase.session_cap.status}`);
      assert.ok(byCase.session_cap.attempts < 5,
        `the session cap must bind BEFORE max_attempts (ran ${byCase.session_cap.attempts} of 5)`);
      assert.ok(byCase.session_cap.duration_ms <= 350 + 400,
        `the whole retry chain must stay inside the session cap (took ${byCase.session_cap.duration_ms}ms)`);

      // and a session with NO room admits no attempt at all, terminally
      assert.strictEqual(byCase.session_exhausted.status, "timeout");
      assert.strictEqual(byCase.session_exhausted.attempts, 0);
      assert.strictEqual(byCase.session_exhausted.terminal_count, 1,
        "a call that never attempted is still terminalised");

      assert.ok(byCase.progress.ticks >= 1, "a call past the progress threshold emits ticks");

      assert.strictEqual(out.coalesce.transport_calls, 1, "identical concurrent calls share one transport run");
      assert.strictEqual(out.coalesce.cache_hits, 1, "exactly one caller is recorded as the coalesced hit");

      assert.deepStrictEqual(out.unterminated_call_ids, [], "no call may be left without a terminal event");

      // The lock that makes the token's own "exactly once" claim true. Without it this reads
      // ["before-set", "before-set", "after-set"] — one closer fired twice and the count wrong.
      assert.deepStrictEqual(out.closer_hits, ["before-set", "after-set"],
        "a cancel token must deliver every registered closer EXACTLY once: a repeated set() closes "
        + "nothing again, and a registration racing the cancel is closed once, never twice");

      // An interrupted call is the interrupt path of AC-4c and, before this session, the one way a
      // call could end with NO terminal record at all (measured: 1 started / 0 terminal, and the
      // validator failed the store). It must be terminalised AND still propagate.
      assert.strictEqual(out.interrupt.raised, "KeyboardInterrupt",
        "the interrupt must still reach the caller — terminalising it may not swallow it");
      assert.strictEqual(out.interrupt.terminal_count, 1,
        "an interrupted call must produce its terminal record rather than being omitted (AC-1c)");
      assert.strictEqual(out.interrupt.status, "cancelled");
      assert.strictEqual(out.interrupt.cancel_flag, true);
      assert.strictEqual(out.interrupt.error_class, "KeyboardInterrupt");
      assert.ok(typeof out.interrupt.duration_ms === "number" && out.interrupt.duration_ms >= 0,
        "an interrupted call still carries a measurable duration");

      // ...and a call whose terminal WRITE throws must not be terminalised twice: the record is
      // already on disk, so a second one would break "EXACTLY ONE terminal per logical call" and
      // trip the validator's double-terminal arm. Both directions are checked here: exactly one
      // terminal row AND a validator that accepts the store.
      assert.strictEqual(out.boom.raised, "KeyboardInterrupt", "the write failure must still propagate");
      assert.strictEqual(out.boom.terminal_count, 1,
        `a call must carry exactly ONE terminal row even when its terminal write throws `
        + `(got ${out.boom.terminal_count} of ${out.boom.rows} rows)`);
      const boomFindings = validateStore(out.boom.store).findings;
      assert.deepStrictEqual(boomFindings, [],
        "the store left by a failed terminal write must still pass the validator: "
        + boomFindings.join(" | "));
    });

    it("resolves the SAME effective budget in both runtimes (one budgets.json, two readers)", () => {
      const out = runDriver([tmpFile("py-store-parity.jsonl"), "--parity"]);
      const data = loadBudgets();
      for (const [site, spec] of Object.entries(data.sites)) {
        const js = resolveBudget(data, site).eff;
        assert.ok(out.parity[site], `the python half resolved no budget for ${site}`);
        assert.strictEqual(out.parity[site].per_attempt_s, js.per_attempt_s,
          `per-attempt cap drifted for ${site}`);
        assert.strictEqual(out.parity[site].session_cap_s, js.session_cap_s,
          `session cap drifted for ${site}`);
        assert.strictEqual(out.parity[site].max_attempts, js.max_attempts,
          `retry policy drifted for ${site}`);
        assert.strictEqual(out.parity[site].request_class, js.request_class);
        void spec;
      }
    });

    it("refuses a budget override that states no reason, in BOTH runtimes", () => {
      const bad = JSON.parse(fs.readFileSync(BUDGETS, "utf8"));
      bad.sites["scripts/border_design_generator.js"] = {
        request_class: "background_maintenance", cap_override_s: 999,
      };
      const badPath = tmpFile("bad-budgets.json");
      fs.writeFileSync(badPath, JSON.stringify(bad), "utf8");
      assert.throws(() => loadBudgets(badPath), /override_reason/,
        "the Node half must refuse an unexplained override");
      const res = spawnSync("python", ["-c",
        `import sys; sys.path.insert(0, r"${path.join(ROOT, "scripts", "perf")}");`
        + `from model_call_telemetry import load_budgets; load_budgets(r"${badPath}")`,
      ], { encoding: "utf8" });
      assert.notStrictEqual(res.status, 0, "the Python half must refuse it too");
      assert.ok(/override_reason/.test(res.stderr), `expected the refusal to name override_reason: ${res.stderr}`);
    });
  });

  describe("the validator cannot pass vacuously", () => {
    const good = () => ({
      schema: "perf-model-call/1", event: "model_call_terminal", ts: "2026-10-15T00:00:00.000Z",
      call_id: "c1", site: SITE, role: "reasonix-agent", model: "muse-spark-1.2-contributor",
      provider: "muse", request_class: "background_maintenance", fingerprint_hash: "sha256:abc",
      status: "success", duration_ms: 12, timeout_flag: false, cancel_flag: false,
      cache_hit_flag: false,
    });
    const write = (name, rows) => {
      const p = tmpFile(name);
      fs.writeFileSync(p, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
      return p;
    };

    it("accepts a well-formed store", () => {
      const { findings } = validateStore(write("v-good.jsonl", [good()]), { minSample: 1 });
      assert.deepStrictEqual(findings, []);
    });

    it("REFUSES a terminal event with no duration_ms", () => {
      const row = good();
      delete row.duration_ms;
      const { findings } = validateStore(write("v-nodur.jsonl", [row]), { minSample: 1 });
      assert.ok(findings.some((f) => /duration_ms/.test(f)), findings.join(" | "));
    });

    it("REFUSES a status outside the schema", () => {
      const row = Object.assign(good(), { status: "flaky" });
      const { findings } = validateStore(write("v-badstatus.jsonl", [row]), { minSample: 1 });
      assert.ok(findings.some((f) => /status is/.test(f)), findings.join(" | "));
    });

    it("REFUSES a missing required field", () => {
      const row = good();
      delete row.request_class;
      const { findings } = validateStore(write("v-missing.jsonl", [row]), { minSample: 1 });
      assert.ok(findings.some((f) => /required field/.test(f)), findings.join(" | "));
    });

    it("REFUSES two terminal events for one call", () => {
      const { findings } = validateStore(write("v-double.jsonl", [good(), good()]), { minSample: 1 });
      assert.ok(findings.some((f) => /terminal events/.test(f)), findings.join(" | "));
    });

    it("REFUSES a started call with no terminal event (the omission arm)", () => {
      const started = {
        schema: "perf-model-call/1", event: "model_call_started", ts: "2026-10-15T00:00:00.000Z",
        call_id: "orphan", site: SITE, role: "reasonix-agent", model: "m", provider: "p",
        request_class: "background_maintenance", fingerprint_hash: "sha256:abc",
      };
      const { findings } = validateStore(write("v-orphan.jsonl", [started, good()]), { minSample: 1 });
      assert.ok(findings.some((f) => /NO terminal event/.test(f)), findings.join(" | "));
    });

    it("REFUSES an unknown model with no stated cause", () => {
      const row = Object.assign(good(), { model: "unknown" });
      const { findings } = validateStore(write("v-unknown.jsonl", [row]), { minSample: 1 });
      assert.ok(findings.some((f) => /model_cause/.test(f)), findings.join(" | "));
    });

    it("FAILS CLOSED on an empty store and on a missing one", () => {
      const empty = tmpFile("v-empty.jsonl");
      fs.writeFileSync(empty, "", "utf8");
      assert.ok(validateStore(empty).findings.some((f) => /EMPTY STORE/.test(f)),
        "an empty store must not read as a clean one");
      assert.ok(validateStore(tmpFile("v-does-not-exist.jsonl")).findings.length > 0,
        "a missing store must not read as a clean one");
    });

    it("refuses a sample smaller than the cited minimum (so AC-1's 100 cannot be skipped)", () => {
      const { findings } = validateStore(write("v-small.jsonl", [good()]), { minSample: 100 });
      assert.ok(findings.some((f) => /sample too small/.test(f)), findings.join(" | "));
    });

    it("is a real process gate: the CLI exits 1 on a bad store and 0 on a good one", () => {
      const bad = spawnSync("node", [VALIDATOR, "--store", tmpFile("v-nodur.jsonl"), "--min-sample", "1"], { encoding: "utf8" });
      assert.strictEqual(bad.status, 1, "a bad store must fail the CLI");
      const ok = spawnSync("node", [VALIDATOR, "--store", tmpFile("v-good.jsonl"), "--min-sample", "1"], { encoding: "utf8" });
      assert.strictEqual(ok.status, 0, `a good store must pass: ${ok.stdout}${ok.stderr}`);
    });
  });

  describe("the coverage claim is not vacuous", () => {
    it("every declared site is either WIRED in the tracked area or explicitly marked not_wired", () => {
      const data = loadBudgets();
      const unwired = [];
      for (const [site, spec] of Object.entries(data.sites)) {
        if (spec.not_wired) continue;
        const filePath = path.join(ROOT, site);
        assert.ok(fs.existsSync(filePath), `${site} is declared but does not exist in the tracked area`);
        const body = fs.readFileSync(filePath, "utf8");
        const wired = /call_model\(|callModel\(/.test(body);
        if (!wired) unwired.push(site);
      }
      assert.deepStrictEqual(unwired, [],
        `these declared sites do not call the shared helper, so AC-1's coverage would be about the `
        + `helper rather than the area: ${unwired.join(", ")}`);
    });

    it("names the untracked model-call sites as NOT WIRED, so the gap is visible and not silent", () => {
      const data = loadBudgets();
      const notWired = Object.entries(data.sites).filter(([, s]) => s.not_wired).map(([s]) => s);
      assert.ok(notWired.includes("scripts/muse_gate.py"),
        "the GATE reviewer seat is untracked; it must appear as a declared-but-not-wired site");
      for (const site of notWired) {
        assert.ok(String(data.sites[site].override_reason).includes("NOT WIRED"),
          `${site}: a not-wired site must say so in its own declaration`);
      }
    });

    it("pins the nearest-rank percentile convention that reproduces the dossier's own numbers", () => {
      const values = [1, 2, 3, 4];
      assert.strictEqual(percentileSorted(values, 0.5), 2);
      assert.strictEqual(percentileSorted(values, 0.95), 4);
      // with linear interpolation p95 would be 3.85, and the dossier's own glm row would read 354.6s
      // where it says 356.8s — the convention is load-bearing, not cosmetic.
      assert.notStrictEqual(percentileSorted(values, 0.95), 3.85);
    });

    it("spells a store inside the checkout relative to the root, so the filed report survives its worktree", () => {
      // The first version printed the path it was handed verbatim, so the TRACKED report carried
      // `.../worktrees/<stamp>/temp/perf/model_calls.jsonl` — a disposable path naming nothing on the
      // next run. Inside the checkout: repo-relative, forward slashes. Outside it: unchanged.
      assert.strictEqual(displayPath(path.join(ROOT, "temp", "perf", "model_calls.jsonl")),
        "temp/perf/model_calls.jsonl");
      assert.strictEqual(displayPath(path.join(ROOT, "scripts", "perf", "budgets.json")),
        "scripts/perf/budgets.json");
      const outside = path.join(os.tmpdir(), "somewhere-else.jsonl");
      assert.strictEqual(displayPath(outside), outside,
        "a path outside the checkout has no relative form and must be left as it was");
    });
  });
});

/** The Python side's driver. It starts its OWN local server, so the real urllib transport is what
 *  every case exercises; it prints one JSON object on the last stdout line. */
const DRIVER_SOURCE = [
  "import json, os, sys, threading, time, http.server, socketserver, urllib.request, signal",
  "",
  "HELPER = sys.argv[1]",
  "STORE = sys.argv[2]",
  "PARITY_ONLY = '--parity' in sys.argv",
  "sys.path.insert(0, __import__('os').path.dirname(HELPER))",
  "from model_call_telemetry import (Budgets, CancelToken, _Store, call_model, load_budgets, Session)",
  "",
  "class Handler(http.server.BaseHTTPRequestHandler):",
  "    def do_POST(self):",
  "        n = int(self.headers.get('content-length', 0))",
  "        self.rfile.read(n)",
  "        if self.path.startswith('/slowfail'):",
  "            time.sleep(0.15)",
  "            self.send_response(503); self.end_headers(); self.wfile.write(b'no'); return",
  "        if self.path.startswith('/fail'):",
  "            self.send_response(503); self.end_headers(); self.wfile.write(b'no'); return",
  "        if self.path.startswith('/slow'):",
  "            time.sleep(1.0)",
  "        self.send_response(200); self.send_header('content-type', 'application/json')",
  "        self.end_headers(); self.wfile.write(b'{\"ok\":true}')",
  "    def log_message(self, *a):",
  "        pass",
  "",
  "class Server(socketserver.ThreadingTCPServer):",
  "    allow_reuse_address = True",
  "    daemon_threads = True",
  "",
  "    def handle_error(self, *a):",
  "        # a client that abandoned a timed-out request is the POINT of two of the cases below;",
  "        # its BrokenPipe must not spray a traceback over this driver's stdout contract",
  "        pass",
  "",
  "srv = Server(('127.0.0.1', 0), Handler)",
  "threading.Thread(target=srv.serve_forever, daemon=True).start()",
  "BASE = 'http://127.0.0.1:%d' % srv.server_address[1]",
  "",
  "def transport(path):",
  "    req = urllib.request.Request(BASE + path, data=b'{}', method='POST')",
  "    def call(timeout_s):",
  "        with urllib.request.urlopen(req, timeout=timeout_s) as r:",
  "            return r.read()",
  "    return call",
  "",
  "def budgets(cls='background_maintenance', per=0.25, sess=1.0, attempts=2, progress=None):",
  "    b = load_budgets()",
  "    b['classes'][cls] = dict(b['classes'][cls], per_attempt_s=per, session_cap_s=sess,",
  "                             max_attempts=attempts, retry_on=['error'])",
  "    b['sites'] = {}",
  "    b['progress'] = progress or {'threshold_s': 0.01, 'tick_ms': 20}",
  "    return Budgets(b)",
  "",
  "def records(call_id=None):",
  "    out = []",
  "    try:",
  "        with open(STORE, encoding='utf-8') as fh:",
  "            for line in fh:",
  "                if line.strip():",
  "                    rec = json.loads(line)",
  "                    if call_id is None or rec.get('call_id') == call_id:",
  "                        out.append(rec)",
  "    except FileNotFoundError:",
  "        pass",
  "    return out",
  "",
  "def run(name, path, per=0.25, sess=1.0, attempts=2, cancel=None, transport_override=None,",
  "        session=None):",
  "    before = len(records())",
  "    t0 = time.monotonic()",
  "    result = call_model('scripts/perf/model_call_telemetry.py#sample',",
  "                        transport_override or transport(path), role='reasonix-agent',",
  "                        request_class='background_maintenance',",
  "                        model='muse-spark-1.2-contributor', provider='stub',",
  "                        fingerprint_material=name, store=STORE, cancel=cancel,",
  "                        budgets=budgets(per=per, sess=sess, attempts=attempts), session=session)",
  "    wall_ms = int((time.monotonic() - t0) * 1000)",
  "    after = records()",
  "    mine = [r for r in after[before:] if r['event'] == 'model_call_terminal']",
  "    return {'name': name, 'status': result.status, 'duration_ms': result.duration_ms,",
  "            'timeout_flag': result.timeout_flag, 'cancel_flag': result.cancel_flag,",
  "            'attempts': result.attempts, 'wall_ms': wall_ms,",
  "            'terminal_count': len(mine), 'ticks': len([r for r in after[before:]",
  "            if r['event'] == 'model_call_progress_tick'])}",
  "",
  "cases = []",
  "cases.append(run('success', '/ok'))",
  "cases.append(run('budget_expiry', '/slow', per=0.2, sess=0.4, attempts=1))",
  "token = CancelToken()",
  "threading.Timer(0.06, token.set).start()",
  "cases.append(run('cancel', '/slow', per=30, sess=30, attempts=1, cancel=token))",
  "cases.append(run('error', '/fail', per=1.0, sess=5.0, attempts=2))",
  "cases.append(run('session_cap', '/slowfail', per=1.0, sess=0.35, attempts=5))",
  "cases.append(run('session_exhausted', '/ok', per=1.0, sess=1.0, attempts=1,",
  "                 session=Session(0.0)))",
  "cases.append(run('progress', '/slow', per=2.0, sess=2.0, attempts=1,",
  "                 transport_override=(lambda timeout_s: (time.sleep(0.15), b'{}')[1])))",
  "",
  "# coalescing: two threads, one identical request, one transport execution",
  "calls = {'n': 0}",
  "lock = threading.Lock()",
  "def counting_transport(timeout_s):",
  "    with lock:",
  "        calls['n'] += 1",
  "    time.sleep(0.15)",
  "    return b'{}'",
  "b = budgets(per=3.0, sess=3.0, attempts=1)",
  "b.data['classes']['background_maintenance']['coalesce'] = True",
  "results = []",
  "def one():",
  "    results.append(call_model('scripts/perf/model_call_telemetry.py#sample', counting_transport,",
  "                              role='reasonix-agent', request_class='background_maintenance',",
  "                              model='m', provider='p',",
  "                              fingerprint_material='same', store=STORE, budgets=b))",
  "threads = [threading.Thread(target=one) for _ in range(2)]",
  "for t in threads: t.start()",
  "for t in threads: t.join()",
  "",
  "started = [r for r in records() if r['event'] == 'model_call_started']",
  "terminals = [r for r in records() if r['event'] == 'model_call_terminal']",
  "unterminated = [r['call_id'] for r in started if r['call_id'] not in {t['call_id'] for t in terminals}]",
  "",
  "# EXACTLY-ONCE closer delivery (re-execution 2026-10-16). The token's docstring claimed that a",
  "# cancel racing a registration still closes the handle `exactly once` while no lock existed: a",
  "# second `set()` re-closed every handle, and a registration racing `set()` could be closed by both",
  "# sides. This case is the one that FAILS without the lock (measured on the unlocked version: 3",
  "# hits, not 2).",
  "token2 = CancelToken()",
  "closer_hits = []",
  "token2.register_closer(lambda: closer_hits.append('before-set'))",
  "token2.set()",
  "token2.set()          # a second set() must close NOTHING again",
  "token2.register_closer(lambda: closer_hits.append('after-set'))",
  "",
  "# AN INTERRUPT MUST STILL BE TERMINALISED (AC-1c; re-execution 2026-10-16). A SIGINT delivered to",
  "# the CALLING thread while a call is in flight is how a headless CLI gate's call most often ends,",
  "# and the helper as first delivered skipped the terminal record entirely: measured on it, the store",
  "# held 1 `model_call_started` and 0 terminals, and this track's own validator then FAILED the store.",
  "interrupt_marks = len(records())",
  "def slow_transport(timeout_s):",
  "    time.sleep(0.8)",
  "    return b'{}'",
  "interrupt_timer = threading.Timer(0.15, lambda: signal.raise_signal(signal.SIGINT))",
  "interrupt_timer.start()",
  "interrupted = None",
  "try:",
  "    call_model('scripts/perf/model_call_telemetry.py#sample', slow_transport,",
  "               role='reasonix-agent', request_class='background_maintenance', model='m',",
  "               provider='p', fingerprint_material='interrupt', store=STORE,",
  "               budgets=budgets(per=5.0, sess=5.0, attempts=1))",
  "except KeyboardInterrupt:",
  "    interrupted = 'KeyboardInterrupt'",
  "finally:",
  "    interrupt_timer.cancel()",
  "interrupt_terminals = [r for r in records()[interrupt_marks:] if r['event'] == 'model_call_terminal']",
  "",
  "# A STORE THAT FAILS MID-WRITE must not yield a SECOND terminal row (review finding, fixed",
  "# 2026-10-16). The interrupt handler marks the call terminalised BEFORE the write, so an exception",
  "# raised inside the terminal write is re-raised with NO second record. Without that flag this",
  "# produces 2 terminal rows for one call_id - the module's own 'one terminal per logical call'",
  "# contract broken, and the validator's double-terminal arm would (rightly) fail the store.",
  "class BoomStore(_Store):",
  "    def __init__(self, path, boom_on):",
  "        _Store.__init__(self, path)",
  "        self.n = 0",
  "        self.boom_on = boom_on",
  "    def append(self, record):",
  "        self.n += 1",
  "        _Store.append(self, record)",
  "        if self.n == self.boom_on:",
  "            raise KeyboardInterrupt('raised inside the %s write' % record['event'])",
  "",
  "boom_path = STORE + '.boom'",
  "if os.path.exists(boom_path):",
  "    os.remove(boom_path)",
  "boom_raised = None",
  "try:",
  "    call_model('scripts/perf/model_call_telemetry.py#sample', lambda timeout_s: b'{}',",
  "               role='reasonix-agent', request_class='background_maintenance', model='m',",
  "               provider='p', fingerprint_material='boom', store=BoomStore(boom_path, 2),",
  "               budgets=budgets(per=2.0, sess=2.0, attempts=1))",
  "except KeyboardInterrupt:",
  "    boom_raised = 'KeyboardInterrupt'",
  "boom_rows = [json.loads(l) for l in open(boom_path, encoding='utf-8') if l.strip()]",
  "boom_terminals = [r for r in boom_rows if r['event'] == 'model_call_terminal']",
  "",
  "out = {'cases': cases, 'unterminated_call_ids': unterminated, 'closer_hits': closer_hits,",
  "       'boom': {'raised': boom_raised, 'store': boom_path, 'rows': len(boom_rows),",
  "                'terminal_count': len(boom_terminals)},",
  "       'interrupt': {'raised': interrupted, 'terminal_count': len(interrupt_terminals),",
  "                     'status': interrupt_terminals[0]['status'] if interrupt_terminals else None,",
  "                     'cancel_flag': interrupt_terminals[0].get('cancel_flag') if interrupt_terminals else None,",
  "                     'error_class': interrupt_terminals[0].get('error_class') if interrupt_terminals else None,",
  "                     'duration_ms': interrupt_terminals[0].get('duration_ms') if interrupt_terminals else None},",
  "       'coalesce': {'transport_calls': calls['n'],",
  "                    'cache_hits': len([t for t in terminals if t.get('cache_hit_flag')])}}",
  "",
  "if PARITY_ONLY:",
  "    data = load_budgets()",
  "    bset = Budgets(data)",
  "    out['parity'] = {site: dict(bset.resolve(site)[1]) for site in data.get('sites', {})}",
  "",
  "print(json.dumps(out))",
].join("\n");
