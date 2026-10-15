#!/usr/bin/env node
/**
 * validate_model_call_telemetry.js — the gate on the scripts area's own model-call telemetry.
 *
 * WHY THIS EXISTS (track `runtime_perf_20261015`, phase 2). A telemetry store is only evidence if
 * something refuses a bad row. Without this file the store would accept a terminal event with no
 * `duration_ms` (the exact gap the dossier's table showed: 1,093 rows with `latency n/a` and no way
 * to tell "not measured" from "not a model call"), two terminal events for one call, or a status
 * outside the schema — and every one of those would be counted as coverage by whoever read the
 * store next.
 *
 * WHAT IT REFUSES, each arm falsified in BOTH directions by `test/unit/model_call_telemetry.test.js`:
 *   1. a terminal event with no numeric `duration_ms` — the criterion AC-1 names directly;
 *   2. a terminal event whose `status` is missing or outside `success|error|timeout|cancelled`;
 *   3. a terminal event missing any required field (`role`, `model`, `provider`, `request_class`,
 *      `fingerprint_hash`, `timeout_flag`, `cancel_flag`, `cache_hit_flag`);
 *   4. MORE THAN ONE terminal event for one `call_id`, or a `model_call_started` with no terminal —
 *      the "exactly once" half of the contract, a rule a count of terminals cannot see;
 *   5. an empty or absent store — FAIL CLOSED (a green line over "no data" is the vacuous pass this
 *      repository has been burned by twice);
 *   6. fewer than `--min-sample` terminal events, when the AC being cited needs a sample size.
 *
 * It has NO opinion about latency: a slow call is the budget's business (AC-2) and the report's, not
 * the schema's. Keeping verdicts out of here is what lets the same tool judge a synthetic sample and
 * a production store without either being able to hide behind the other.
 *
 * USAGE
 *   node scripts/perf/validate_model_call_telemetry.js [--store P] [--json] [--min-sample N]
 *
 * Exit codes: 0 clean; 1 findings (or an empty store); 2 usage.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const { DEFAULT_STORE, STATUSES } = require("./model_call_telemetry.js");

const TERMINAL = "model_call_terminal";
const REQUIRED_TERMINAL = [
  "ts", "role", "model", "provider", "request_class", "fingerprint_hash",
  "status", "duration_ms", "timeout_flag", "cancel_flag", "cache_hit_flag",
];

/** Nearest-rank percentile over an ALREADY SORTED ascending array. Nearest-rank (not linear
 *  interpolation) is used everywhere in this track, including the dossier baseline reproduction, so
 *  the dossier's own numbers come back unchanged (see scripts/perf/runtime-perf-baseline.md §F-1). */
function percentileSorted(sorted, q) {
  if (!sorted.length) return null;
  const rank = Math.max(1, Math.ceil(q * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1];
}

function readStore(storePath) {
  const findings = [];
  const events = [];
  if (!fs.existsSync(storePath)) {
    return { findings: [`store does not exist: ${storePath}`], events, empty: true };
  }
  const text = fs.readFileSync(storePath, "utf8");
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch (err) {
      findings.push(`${storePath}:${i + 1}: not valid JSON (${err.message}) — a torn line is a lost `
        + "terminal event, so it is a finding and never a skip");
      return;
    }
    events.push({ rec, line: i + 1 });
  });
  return { findings, events, empty: events.length === 0 };
}

function validateStore(storePath, options = {}) {
  const { minSample = 0 } = options;
  const { findings, events, empty } = readStore(storePath);
  if (empty) {
    findings.push(`${storePath}: EMPTY STORE — refusing to report a clean bill of health over no `
      + "rows at all: an instrument that cannot say \"nothing was measured\" is the vacuous pass this "
      + "check exists to prevent");
    return { findings, metrics: null, events: 0 };
  }

  const started = new Map();
  const terminals = new Map();
  let unknownModel = 0;
  let cacheHits = 0;
  let progressTicks = 0;

  for (const { rec, line } of events) {
    const where = `${path.basename(storePath)}:${line}`;
    if (rec.schema !== "perf-model-call/1") {
      findings.push(`${where}: schema is "${rec.schema}", expected "perf-model-call/1"`);
    }
    if (!rec.call_id) findings.push(`${where}: no call_id — a row that cannot be tied to a call cannot be counted as one`);
    if (rec.event === "model_call_started") {
      started.set(rec.call_id, (started.get(rec.call_id) || 0) + 1);
      continue;
    }
    if (rec.event === "model_call_progress_tick") {
      progressTicks += 1;
      continue;
    }
    if (rec.event !== TERMINAL) {
      findings.push(`${where}: unknown event "${rec.event}"`);
      continue;
    }
    for (const field of REQUIRED_TERMINAL) {
      if (!(field in rec)) findings.push(`${where}: terminal event is missing required field \`${field}\``);
    }
    if (typeof rec.duration_ms !== "number" || Number.isNaN(rec.duration_ms)) {
      findings.push(`${where}: terminal event has duration_ms=${JSON.stringify(rec.duration_ms)} — AC-1 `
        + "requires a measurable duration on EVERY terminal call");
    }
    if (!STATUSES.includes(rec.status)) {
      findings.push(`${where}: status is ${JSON.stringify(rec.status)}, expected one of ${STATUSES.join("|")}`);
    }
    if (rec.status === "timeout" && rec.timeout_flag !== true) {
      findings.push(`${where}: status=timeout but timeout_flag=${JSON.stringify(rec.timeout_flag)}`);
    }
    if (rec.status === "cancelled" && rec.cancel_flag !== true) {
      findings.push(`${where}: status=cancelled but cancel_flag=${JSON.stringify(rec.cancel_flag)}`);
    }
    if (rec.model === "unknown" && !rec.model_cause) {
      findings.push(`${where}: model=unknown with no \`model_cause\` — AC-1 requires an unknown model `
        + "to carry its cause, not just the word \"unknown\"");
    }
    if (rec.model === "unknown") unknownModel += 1;
    if (rec.cache_hit_flag === true) cacheHits += 1;
    terminals.set(rec.call_id, (terminals.get(rec.call_id) || 0) + 1);
  }

  for (const [callId, n] of terminals) {
    if (n > 1) findings.push(`call_id ${callId}: ${n} terminal events — the contract is EXACTLY ONE per `
      + "logical call, so two rows for one call is a double count, not an extra measurement");
  }
  for (const [callId] of started) {
    if (!terminals.has(callId)) {
      findings.push(`call_id ${callId}: model_call_started with NO terminal event — a failed, timed-out `
        + "or cancelled call must still be terminalised (AC-1)");
    }
  }

  const terminalRecords = events.filter((e) => e.rec.event === TERMINAL).map((e) => e.rec);
  if (terminalRecords.length < minSample) {
    findings.push(`sample too small: ${terminalRecords.length} terminal event(s), --min-sample ${minSample}`);
  }

  const durations = terminalRecords
    .map((r) => (typeof r.duration_ms === "number" ? r.duration_ms : null))
    .filter((d) => d !== null)
    .sort((a, b) => a - b);
  const byStatus = {};
  const byClass = {};
  for (const rec of terminalRecords) {
    byStatus[rec.status] = (byStatus[rec.status] || 0) + 1;
    const cls = rec.request_class || "unknown_default";
    byClass[cls] = byClass[cls] || { n: 0, durations: [] };
    byClass[cls].n += 1;
    if (typeof rec.duration_ms === "number") byClass[cls].durations.push(rec.duration_ms);
  }
  for (const cls of Object.keys(byClass)) byClass[cls].durations.sort((a, b) => a - b);

  const metrics = {
    store: storePath,
    events: events.length,
    terminal: terminalRecords.length,
    coverage_pct: terminalRecords.length
      ? Number(((durations.length / terminalRecords.length) * 100).toFixed(2)) : null,
    unknown_model_pct: terminalRecords.length
      ? Number(((unknownModel / terminalRecords.length) * 100).toFixed(2)) : null,
    by_status: byStatus,
    by_class: Object.fromEntries(Object.entries(byClass).map(([cls, v]) => [cls, {
      n: v.n,
      p50_ms: percentileSorted(v.durations, 0.5),
      p95_ms: percentileSorted(v.durations, 0.95),
      p99_ms: percentileSorted(v.durations, 0.99),
      max_ms: v.durations.length ? v.durations[v.durations.length - 1] : null,
    }])),
    latency: {
      n: durations.length,
      p50_ms: percentileSorted(durations, 0.5),
      p95_ms: percentileSorted(durations, 0.95),
      p99_ms: percentileSorted(durations, 0.99),
      max_ms: durations.length ? durations[durations.length - 1] : null,
    },
    timeout_count: byStatus.timeout || 0,
    cancel_count: byStatus.cancelled || 0,
    error_count: byStatus.error || 0,
    cache_hit_count: cacheHits,
    cache_hit_rate: terminalRecords.length
      ? Number((cacheHits / terminalRecords.length).toFixed(4)) : null,
    progress_ticks: progressTicks,
  };
  return { findings, metrics, events: events.length };
}

function main(argv) {
  const args = argv.slice(2);
  const json = args.includes("--json");
  const storeIdx = args.indexOf("--store");
  const minIdx = args.indexOf("--min-sample");
  const store = path.resolve(storeIdx >= 0 ? args[storeIdx + 1] : DEFAULT_STORE);
  const minSample = minIdx >= 0 ? Number(args[minIdx + 1]) : 0;
  const { findings, metrics } = validateStore(store, { minSample });
  if (json) {
    process.stdout.write(JSON.stringify({ ok: findings.length === 0, metrics, findings }, null, 2) + "\n");
    return findings.length ? 1 : 0;
  }
  if (metrics) {
    process.stdout.write(`store ${metrics.store}\n  events=${metrics.events} terminal=${metrics.terminal} `
      + `coverage=${metrics.coverage_pct}% unknown_model=${metrics.unknown_model_pct}% `
      + `timeouts=${metrics.timeout_count} cancels=${metrics.cancel_count} errors=${metrics.error_count} `
      + `cache_hits=${metrics.cache_hit_count} ticks=${metrics.progress_ticks}\n`);
    process.stdout.write(`  latency n=${metrics.latency.n} p50=${metrics.latency.p50_ms}ms `
      + `p95=${metrics.latency.p95_ms}ms p99=${metrics.latency.p99_ms}ms max=${metrics.latency.max_ms}ms\n`);
  }
  if (!findings.length) {
    process.stdout.write("MODEL-CALL TELEMETRY OK\n");
    return 0;
  }
  process.stdout.write(`MODEL-CALL TELEMETRY FAIL — ${findings.length} finding(s)\n`);
  for (const f of findings) process.stdout.write(`  - ${f}\n`);
  return 1;
}

if (require.main === module) process.exit(main(process.argv));

module.exports = { validateStore, percentileSorted, readStore, REQUIRED_TERMINAL, TERMINAL, STATUSES };
