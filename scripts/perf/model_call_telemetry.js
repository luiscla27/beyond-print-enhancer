#!/usr/bin/env node
/**
 * model_call_telemetry.js — the Node half of the scripts area's model-call budget + telemetry.
 *
 * WHY THIS FILE EXISTS (track `runtime_perf_20261015`). `scripts/border_design_generator.js` is the
 * one tracked Node script that dials a model directly, and its `fetch` had NO timeout at all: a hung
 * provider held the process open for as long as the socket stayed half-alive, and nothing anywhere
 * recorded that the call had happened (`scripts/perf/runtime-perf-baseline.md` F-3 — this project's
 * relay store holds 45,589 terminal rows and NOT ONE of them is a script-originated call, because
 * the relay instruments its own traffic and these scripts bypass it).
 *
 * IT IS THE SAME CONTRACT AS THE PYTHON HALF, ON PURPOSE. Both halves read `scripts/perf/budgets.json`
 * and write the same `perf-model-call/1` record to the same store, so a cap can never drift between
 * them; `test/unit/model_call_telemetry.test.js` pins the parity by driving both against one budget
 * file. A record written here and a record written there are indistinguishable to the validator, the
 * report, and whoever reads the store next.
 *
 * WHAT IT GUARANTEES (the Python half's contract, with ONE named gap)
 *   * ONE terminal record per logical call for every outcome the TRANSPORT reports — `success`,
 *     `error`, `timeout` or `cancelled`. A failure, a budget expiry and a cancel are all terminal
 *     telemetry, never an omission.
 *   * A TOTAL deadline, not a socket one: the caller is released at the deadline whether or not the
 *     transport has settled, so a late response is DISCARDED and its record is written once.
 *   * A REAL cancellation signal: `CancelToken.set()` aborts the transport through the
 *     `AbortController` the site is handed — the site's `fetch` rejects and the caller is released.
 *   * A session budget SEPARATE from the per-attempt one, so a retry chain cannot accumulate past the
 *     hard cap. `timeout` and `cancelled` are never auto-retried; only a retryable `error` is.
 *   * A REDACTED fingerprint: the request material is hashed, never stored.
 *
 * NAMED GAP — THE INTERRUPT PATH (measured 2026-10-16, re-execution of this track). The PYTHON half
 * terminalises a `KeyboardInterrupt` delivered to the calling thread (`status=cancelled`), so an
 * interrupted Python call cannot end with a `model_call_started` and no terminal row. THIS half
 * cannot: a Ctrl+C on Windows is a `TerminateProcess`, so no handler in this process runs, and the
 * one Node call site (`scripts/border_design_generator.js`) can therefore leave an unterminated call
 * behind for the store's next validation to report. A `process.on("SIGINT")` handler was considered
 * and REJECTED rather than written-but-unfalsifiable: a signal cannot be delivered to a child process
 * on this platform, so no test here could ever show the handler working. The gap is stated instead,
 * and the recovery is that the store never hides it — `validate_model_call_telemetry.js` fails on an
 * unterminated call, which is the signal a re-run should read.
 *
 * USAGE
 *   const { callModel } = require("./model_call_telemetry.js");
 *   const r = await callModel({
 *     site: "scripts/border_design_generator.js",
 *     role: "reasonix-agent", model: "gemini-3.8-flash", provider: "gemini",
 *     fingerprintMaterial: body,
 *     transport: ({ signal, timeoutMs }) => fetch(url, { signal, ... }),
 *   });
 *   if (!r.ok) ...   // r.status / r.timeoutFlag / r.cancelFlag are all recorded already
 *
 * Exit codes when run as a CLI: 0 ok (self-test), 1 refused (budget data is malformed).
 */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HERE = __dirname;
const BUDGETS_PATH = path.join(HERE, "budgets.json");
const ROOT = path.resolve(HERE, "..", "..");
const DEFAULT_STORE = path.join(ROOT, "temp", "perf", "model_calls.jsonl");
const STORE_ENV = "MODEL_CALL_TELEMETRY_STORE";
const SCHEMA = "perf-model-call/1";
const STATUSES = ["success", "error", "timeout", "cancelled"];

class BudgetError extends Error {}

function loadBudgets(p) {
  const file = p || BUDGETS_PATH;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new BudgetError(`budget source unreadable: ${file} (${err.message})`);
  }
  const classes = data.classes || {};
  for (const [name, spec] of Object.entries(classes)) {
    for (const key of ["target_p95_s", "hard_cap_s", "per_attempt_s", "session_cap_s", "max_attempts"]) {
      if (typeof spec[key] !== "number") throw new BudgetError(`class ${name} declares no numeric ${key}`);
    }
    spec.retry_on = spec.retry_on || [];
    spec.cacheable = spec.cacheable || false;
    spec.coalesce = spec.coalesce || false;
  }
  if (!classes.unknown_default) {
    throw new BudgetError("budgets.json declares no `unknown_default` class: an unclassified call must "
      + "still be bounded, and a missing class is a defect, not a default");
  }
  for (const [site, spec] of Object.entries(data.sites || {})) {
    if (!classes[spec.request_class]) {
      throw new BudgetError(`site ${site} names class ${spec.request_class}, which budgets.json does not declare`);
    }
    if (spec.cap_override_s != null && !String(spec.override_reason || "").trim()) {
      throw new BudgetError(`site ${site} declares cap_override_s=${spec.cap_override_s} with no `
        + "override_reason: an override above the class cap must state WHY");
    }
  }
  return data;
}

function resolveBudget(data, site, requestClass) {
  const siteSpec = (data.sites || {})[site] || {};
  const name = requestClass || siteSpec.request_class || "unknown_default";
  if (!data.classes[name]) throw new BudgetError(`unknown request class ${name} (site ${site})`);
  const eff = Object.assign({}, data.classes[name]);
  const override = siteSpec.cap_override_s;
  if (override != null) {
    eff.per_attempt_s = override;
    eff.session_cap_s = Math.max(override, eff.session_cap_s);
    eff.cap_override_s = override;
    eff.override_reason = siteSpec.override_reason || "";
  } else {
    eff.cap_override_s = null;
  }
  eff.request_class = name;
  eff.site = site;
  return { name, eff };
}

class CancelToken {
  constructor() {
    this.aborted = false;
    this._controller = new AbortController();
  }

  set() {
    if (this.aborted) return;
    this.aborted = true;
    this._controller.abort();
  }

  /** STABLE per token, so the signal a transport is handed is the one a cancel aborts. */
  signal() {
    if (this.aborted) this._controller.abort();
    return this._controller.signal;
  }
}

class Session {
  constructor(capS) {
    this.capS = Number(capS);
    this.spentS = 0;
    this.attempts = 0;
  }

  remainingS() { return Math.max(0, this.capS - this.spentS); }
  charge(s) { this.spentS += Number(s); }
  canAttempt(min = 0.05) { return this.remainingS() > min; }
}

function fingerprint(model, provider, site, material) {
  const digest = crypto.createHash("sha256");
  digest.update(String(model || ""), "utf8");
  digest.update("\u0000" + String(provider || ""), "utf8");
  digest.update("\u0000" + String(site || ""), "utf8");
  digest.update("\u0000", "utf8");
  const blob = material == null ? Buffer.alloc(0)
    : Buffer.isBuffer(material) ? material : Buffer.from(String(material), "utf8");
  digest.update(crypto.createHash("sha256").update(blob).digest());
  return "sha256:" + digest.digest("hex").slice(0, 16);
}

function utcNow() { return new Date().toISOString().replace(/(\.\d{3})\d*Z$/, "$1Z"); }

class Store {
  constructor(p) {
    const env = process.env[STORE_ENV];
    this.path = p === "" ? null : (p || env || DEFAULT_STORE);
    if (this.path) fs.mkdirSync(path.dirname(this.path), { recursive: true });
  }

  append(record) {
    if (!this.path) return;
    fs.appendFileSync(this.path, JSON.stringify(record) + os.EOL, "utf8");
  }
}

function record(event, base, extra) {
  const rec = Object.assign({
    schema: SCHEMA,
    event,
    ts: utcNow(),
    site: base.site,
    role: base.role,
    model: base.model || "unknown",
    model_cause: base.model ? null : "call site passed no model label",
    provider: base.provider || "unknown",
    request_class: base.requestClass,
    fingerprint_hash: base.fp,
    call_id: base.callId,
  }, extra);
  return rec;
}

const INFLIGHT = new Map();

/**
 * Run one logical model call under its declared budget, emitting exactly one terminal record.
 *
 * `transport({ signal, timeoutMs })` is the site's own dialect — fetch, http.request, anything that
 * honours an AbortSignal. This function owns timing, budget, cancel and telemetry, never the payload.
 */
async function callModel(options) {
  const {
    site, transport, role, model, provider, fingerprintMaterial,
    requestClass, store, cancel, session, budgets, retryable = true, emit = true,
  } = options;
  const data = budgets || loadBudgets();
  const { name, eff } = resolveBudget(data, site, requestClass);
  const storeObj = store instanceof Store ? store : new Store(store);
  const fp = fingerprint(model, provider, site, fingerprintMaterial);
  const callId = crypto.randomBytes(8).toString("hex");
  const started = Date.now();
  const sess = session || new Session(eff.session_cap_s);
  const base = { site, role, model, provider, requestClass: name, fp, callId };
  const coalesceKey = eff.coalesce ? fp : null;

  if (coalesceKey) {
    const existing = INFLIGHT.get(coalesceKey);
    if (existing) {
      const shared = await existing;
      return terminal(storeObj, base, started, {
        status: shared.status, value: shared.value, error: shared.error,
        timeoutFlag: shared.timeoutFlag, cancelFlag: shared.cancelFlag, attempts: shared.attempts,
        cacheHit: true, cachePolicy: "coalesce", errorClass: shared.errorClass, emit,
      });
    }
  }

  if (emit) {
    storeObj.append(record("model_call_started", base, {
      budget_s: eff.per_attempt_s,
      session_cap_s: eff.session_cap_s,
    }));
  }

  const tickMs = Number((data.progress || {}).tick_ms || 5000);
  const thresholdS = Number((data.progress || {}).threshold_s || 10);

  /** One retry chain. It returns the OUTCOME OBJECT so a coalesced waiter can share it verbatim. */
  const run = async () => {
    let value = null;
    let error = null;
    let outcome = null;
    let attempts = 0;
    let budgetS = eff.per_attempt_s;
    while (true) {
      if (!sess.canAttempt()) {
        outcome = "timeout";
        error = new Error("session budget exhausted before an attempt");
        break;
      }
      attempts += 1;
      budgetS = Math.min(eff.per_attempt_s, sess.remainingS());
      const attemptStart = Date.now();
      const got = await supervise(transport, budgetS, cancel,
        budgetS > thresholdS ? tickMs : 0,
        (elapsedMs) => storeObj.append(record("model_call_progress_tick", base, { elapsed_ms: elapsedMs })),
        emit);
      sess.charge((Date.now() - attemptStart) / 1000);
      outcome = got.outcome;
      value = got.value;
      error = got.error;
      if (outcome === "success" || outcome === "cancelled" || outcome === "timeout") break;
      const retryableOutcome = (eff.retry_on || []).includes("error");
      if (retryable && retryableOutcome && attempts < eff.max_attempts && sess.canAttempt()) continue;
      break;
    }
    const status = outcome === "timeout" ? "timeout"
      : outcome === "cancelled" ? "cancelled"
        : outcome === "success" ? "success" : "error";
    return {
      status, value, error, attempts, budgetS, sessionCapS: eff.session_cap_s,
      timeoutFlag: status === "timeout",
      cancelFlag: status === "cancelled",
      errorClass: status === "error" && error ? error.name : null,
    };
  };

  const outcome = await (async () => {
    if (!coalesceKey) return run();
    const shared = run();
    INFLIGHT.set(coalesceKey, shared);
    try {
      return await shared;
    } finally {
      INFLIGHT.delete(coalesceKey);
    }
  })();

  return terminal(storeObj, base, started, Object.assign({}, outcome, {
    cacheHit: false,
    cachePolicy: coalesceKey ? "coalesce" : "disabled",
    emit,
  }));
}

/** The supervisor: releases the caller at the deadline, whatever the transport is doing. */
async function supervise(transport, deadlineS, cancel, tickMs, onTick, emit) {
  const controller = new AbortController();
  const outer = cancel ? cancel.signal() : null;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", () => controller.abort(), { once: true });
  }
  const started = Date.now();
  const deadlineMs = Math.max(1, Math.round(deadlineS * 1000));
  let timedOut = false;
  let tick = null;
  let poll = null;
  const stop = () => {
    if (tick) clearInterval(tick);
    if (poll) clearInterval(poll);
    tick = null;
    poll = null;
  };
  const classify = (err) => {
    const name = (err && err.name) || "";
    if (name === "AbortError" || (cancel && cancel.aborted)) return timedOut ? "timeout" : "cancelled";
    if (name === "TimeoutError" || /timed? ?out/i.test(String(err && err.message))) return "timeout";
    return "error";
  };

  const transportPromise = Promise.resolve()
    .then(() => transport({ signal: controller.signal, timeoutMs: deadlineMs }))
    .then(
      (value) => ({ outcome: "success", value, error: null }),
      (err) => ({ outcome: classify(err), value: null, error: err }),
    )
    .then((got) => { stop(); return got; });

  const timer = new Promise((resolve) => {
    if (tickMs > 0 && emit) {
      tick = setInterval(() => onTick(Date.now() - started), tickMs);
      if (tick.unref) tick.unref();
    }
    poll = setInterval(() => {
      if (cancel && cancel.aborted) {
        stop();
        resolve({ outcome: "cancelled", value: null, error: null });
        return;
      }
      if (Date.now() - started >= deadlineMs) {
        timedOut = true;
        stop();
        resolve({ outcome: "timeout", value: null, error: null });
      }
    }, 10);
    if (poll.unref) poll.unref();
  });

  // The loser of this race is abandoned AND aborted: a transport that would settle after the
  // deadline is torn down instead of being left to trickle, which is what "a late response is
  // discarded" means in code. The poll/tick intervals are cleared either way, so a supervised call
  // can never hold the process open after it has answered.
  const result = await Promise.race([transportPromise, timer]);
  stop();
  if (result.outcome !== "success" && !controller.signal.aborted) {
    try { controller.abort(); } catch { /* a late abort of an already-settled transport is a no-op */ }
  }
  return result;
}

function terminal(storeObj, base, started, o) {
  const durationMs = Date.now() - started;
  if (o.emit) {
    storeObj.append(record("model_call_terminal", base, {
      status: o.status,
      duration_ms: durationMs,
      timeout_flag: !!o.timeoutFlag,
      cancel_flag: !!o.cancelFlag,
      cache_hit_flag: !!o.cacheHit,
      cache_age_ms: null,
      cache_policy: o.cachePolicy,
      attempts: o.attempts,
      budget_s: o.budgetS == null ? null : o.budgetS,
      session_cap_s: o.sessionCapS == null ? null : o.sessionCapS,
      error_code: o.error ? String(o.error.message || o.error).slice(0, 200) : null,
      error_class: o.errorClass || null,
    }));
  }
  return {
    ok: o.status === "success",
    status: o.status,
    durationMs,
    value: o.value,
    error: o.error,
    timeoutFlag: !!o.timeoutFlag,
    cancelFlag: !!o.cancelFlag,
    cacheHitFlag: !!o.cacheHit,
    cachePolicy: o.cachePolicy,
    attempts: o.attempts,
    requestClass: base.requestClass,
    site: base.site,
    callId: base.callId,
  };
}

module.exports = {
  callModel, CancelToken, Session, Store, BudgetError, loadBudgets, resolveBudget, fingerprint,
  DEFAULT_STORE, BUDGETS_PATH, STATUSES, SCHEMA,
};

async function selfTest() {
  const data = loadBudgets();
  const { eff } = resolveBudget(data, "scripts/border_design_generator.js");
  const store = new Store(path.join(os.tmpdir(), "perf-node-selftest.jsonl"));
  const r = await callModel({
    site: "scripts/border_design_generator.js",
    role: "reasonix-agent", model: "gemini-3.8-flash", provider: "gemini",
    fingerprintMaterial: "self-test body",
    transport: async () => { await new Promise((res) => setTimeout(res, 5)); return "{}"; },
    store,
  });
  if (!r.ok || r.status !== "success") throw new Error(`self-test call did not succeed: ${r.status}`);
  const rec = JSON.parse(fs.readFileSync(store.path, "utf8").trim().split("\n").pop());
  for (const field of ["status", "duration_ms", "timeout_flag", "cancel_flag", "cache_hit_flag"]) {
    if (!(field in rec)) throw new Error(`terminal record is missing ${field}`);
  }
  process.stdout.write(`node helper OK — class=${eff.request_class} store=${store.path}\n`);
}

if (require.main === module) {
  if (process.argv[2] === "--self-test") {
    selfTest().catch((err) => {
      process.stderr.write(`REFUSED: ${err.message}\n`);
      process.exit(1);
    });
  } else {
    process.stdout.write("usage: node scripts/perf/model_call_telemetry.js --self-test\n");
    process.exit(2);
  }
}
