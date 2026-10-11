#!/usr/bin/env node
/**
 * border_design_generator.js — produce a real set of AI border designs from the LIVE NOUS free leg.
 *
 * Track `byok_svg_borders_20260927`, Phase 4. This is the "generate a real SVG border" half of the
 * AC-V1 visual gate, widened from ONE border to a gallery: every entry in `scripts/border_designs.json`
 * is turned into a real design that the gallery E2E then applies through the PRODUCT's own choke
 * point on the README's demo sheet.
 *
 * WHY IT CALLS THE PRODUCT'S `buildMessages` INSTEAD OF RE-TYPING A SYSTEM PROMPT
 * ----------------------------------------------------------------------------
 * The thing being polished is the extension's prompt, not a generator's private one. So the request
 * this tool sends is composed by `js/ai_layout.js` itself — `buildMessages(rows, instruction,
 * {capabilities:{arrange:false, border:true}})` — and the answer is read back with the product's own
 * `parseModelOutput`. A hand-copied system message would drift from the shipped one and the gallery
 * would score a prompt the extension never sends. The consequence to know: this tool has no opinion
 * about the prompt, so a prompt fix IS a `js/ai_layout.js` edit and the designs must be regenerated.
 *
 * WHY THE LIVE LEG IS DIALED HERE AND NOT THROUGH THE EXTENSION
 * -----------------------------------------------------------
 * The extension is deliberately not a Nous client: `js/ai_layout.js`'s frozen `PROVIDERS` holds
 * `openai` and `anthropic` only, and `js/ai_settings.js:117` `AI_COMPAT_BASE_ORIGINS` is empty (O-1:
 * "add on demand", and a host must land in the manifest's `host_permissions` first). Adding a third
 * adapter just to make a test possible would be a PRODUCT change smuggled in as tooling. So the live
 * call happens HERE, in Node, and only its TEXT OUTPUT crosses into the browser: the gallery spec
 * feeds each design to `window.AiBorder.renderBorderSvg` — the same AC-9 choke point a real model
 * answer reaches — and the sanitizer decides what renders. Nothing about the trust boundary is
 * weakened by generating off-browser.
 *
 * CREDENTIAL
 * ----------
 * `NOUS_API_KEY` resolves through the same 3-step chain `scripts/byok_vision_gate.py` uses (process
 * env -> `temp/secrets.env` -> HKCU\Environment) and is NEVER printed; only a prefix and a length are
 * logged, so a run log cannot leak it. Nothing is written outside `temp/` and the artifact dir.
 *
 * Usage:
 *   node scripts/border_design_generator.js [--out <dir>] [--model <id>] [--only <id,id>]
 *                                           [--round N] [--overwrite-round]
 *                                           [--temperature T] [--top-p P] [--samples K]
 *                                           [--retries R] [--degenerate-ids id,id]
 *
 *   --out    artifact directory (default temp/visual_logs/byok_svg_borders_20260927)
 *   --model  the Nous seat (default poolside/laguna-s-2.1:free — MEASURED: 200 in ~31 s, clean JSON)
 *   --only   comma-separated design ids, for a single-design retry
 *   --round  suffixed into the output filenames (default 1), so a re-polish never overwrites the
 *            frames a previous verdict was scored against
 *   --overwrite-round
 *            re-cut a round file that ALREADY holds accepted designs. Without it such a write is
 *            REFUSED, because `test/fixtures/byok_border_corpus.json` is frozen over these files —
 *            see "A ROUND FILE THAT HAS BEEN FROZEN IS NOT SCRATCH" below. The dangerous
 *            invocation is a RETRY (`--only`, no `--round`) against a round already frozen.
 *   --temperature / --top-p / --samples
 *            sampling controls (default temperature 0.0, one sample — the pre-2026-10-06 behavior,
 *            byte-identical). Track byok_border_prompt_adoption_20261006 added them after the muse
 *            6-loop consultation MEASURED a greedy-decode envelope attractor on three ids at T=0
 *            (retries were replays, not trials). Every sample records its temperature/seed in
 *            `raw-round<N>/<id>[.sampleK].json` and its verdict line in the round file, so a
 *            corpus blob's provenance stays readable.
 *   --retries R  additional attempts per sample on a 429/502 (exponential backoff). A rate-limit is
 *            a transient leg state, never a design verdict; retries are NOT design attempts.
 *   --degenerate-ids id,id
 *            gate these ids' "valid" answers on minimum artwork: >= 6 drawing elements
 *            (rect/path/circle/polygon/line/ellipse) AND >= 300 chars, else the sample is recorded
 *            as `degenerate` and CANNOT become an accepted entry (an empty frame that passes the
 *            trust root is not a design — 04-dragon-scale produced two such frames before this
 *            gate existed). The gate is deliberately per-id, never global: the accepted corpus
 *            legitimately contains short real artworks (01 532 chars, 07 623, 10 581 — measured).
 *
 * Outputs (all under --out):
 *   designs-round<N>.json   every design + its provenance (model, ms, usage, sanitizer verdicts)
 *   raw-round<N>/<id>.json  the model's exact answer, per design (the polish evidence)
 *   generator-round<N>.log  the run log (secrets redacted by construction)
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const AiLayout = require(path.join(ROOT, "js", "ai_layout.js"));

/** MEASURED default seat (2026-09-30): the only probed free leg that answers a border patch reliably.
 *  `inclusionai/ling-3.0-flash-sante:free` answers 200 but returns EMPTY content at 2000 tokens
 *  (reasoning-only), and `inclusionai/ling-3.0-flash-fin:free` is a 404, so neither is dialable. */
const DEFAULT_MODEL = "poolside/laguna-s-2.1:free";
const NOUS_BASE = process.env.NOUS_BASE_URL || "https://inference-api.nousresearch.com/v1";

/** The GEMINI seat (operator ruling 2026-10-11, track byok_border_prompt_adoption_20261006):
 *  Google's official OpenAI-compatible endpoint with the PROJECT's own credentials — the same
 *  host and key-resolver order the serving relay uses for the visual lane
 *  (`vendor/relay/adapters/__init__.py`: GEMINI_OPENAI_BASE default
 *  `https://generativelanguage.googleapis.com/v1beta/openai`; keys GEMINI_PAID_API_KEY then
 *  GEMINI_FREE_TIER_API_KEY). The fleet's visual-lane model id is `gemini-3.8-flash`
 *  (vendor/stack/instances/uppercore.v1.json `visual_primary`). Credential resolution mirrors
 *  `resolveKey` above (env -> temp/secrets.env -> HKCU\Environment) so a run log can only ever
 *  leak a prefix + length.
 *
 *  SAMPLING KNOBS ARE RETIRED ON THIS HOST (measured in the vendored wire module:
 *  `GOOGLE_RETIRED_PARAMS` = temperature/top_p/top_k/thinking_budget — Google's 2026-10-07
 *  notice makes them a hard 400 INVALID_ARGUMENT on upcoming Gemini models). The Gemini leg
 *  therefore sends NO sampling fields: the provider default is the trial, and the round file
 *  records `sampling: null` so the provenance stays honest. The per-id degenerate gate and
 *  the first-accepted-pass freeze rule are unchanged. */
const GEMINI_BASE = (
  process.env.REASONIX_PROXY_GEMINI_BASE ||
  "https://generativelanguage.googleapis.com/v1beta/openai"
).replace(/\/+$/, "");
const GEMINI_MODEL = process.env.GEMINI_BORDER_MODEL || "gemini-3.8-flash";
const DEFAULT_OUT = path.join(ROOT, "temp", "visual_logs", "byok_svg_borders_20260927");

/** A section row in the shape `ai_arrange.collectSections` produces — numbers, not "200px". Values
 *  are deliberately generic: the border capability does not read geometry to draw, and the real
 *  section the gallery is applied to is chosen in the browser by measurement. */
function standInRow(id, title, w, h) {
  return { id, title, left: 16, top: 16, width: w, height: h, zIndex: 10, minimized: false };
}

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/**
 * A ROUND FILE THAT HAS BEEN FROZEN IS NOT SCRATCH — the write guard (2026-10-04).
 *
 * `test/fixtures/byok_border_corpus.json` is a freeze OVER these files: the visual gate renders the
 * fixture, and `scripts/freeze_border_corpus.js --check` (and the unit suite) require a fresh freeze
 * to reproduce it byte-for-byte. So an accepted entry in a `designs-round<N>.json` is an INPUT of a
 * tracked artifact, and rewriting the round silently breaks the corpus.
 *
 * MEASURED, 2026-10-04: one run overwrote `designs-round1.json` (`generatedAt
 * 2026-10-04T11:38:08Z`, SIX of its twelve entries refusals, and `01-gilded-frame`'s accepted blob
 * replaced by 431 chars of parser-recovered malformed markup) where the fixture had frozen a
 * 719-char artwork — and the corpus stopped reproducing. Seven rewritten entries and not twelve
 * means the run carried `--only`: a RETRY ("re-dial the ones that came back bad"), which has no
 * reason to mention `--round`, and this tool's `--round` default is 1. Issue:
 * `temp/issues/ISSUE_byok_border_corpus_round1_drift_vs_frozen_fixture_20261004.md`.
 *
 * Two rules, both pure so they are testable without a live seat (see the corpus suite):
 *   1. a round file that already holds accepted designs is NOT rewritten unless the operator passes
 *      `--overwrite-round`; the refusal names both sanctioned ways forward;
 *   2. a FAILED attempt never replaces an accepted entry, with or without `--overwrite-round` — a
 *      429 or a refused answer must not erase the record of an accepted blob. A SUCCESSFUL attempt
 *      still supersedes it: that is what a re-cut is.
 */
function isAccepted(d) {
  return Boolean(d && d.accepted === true && d.svg);
}

/** The refusal to throw BEFORE any network call or write, or null when this run may write the file. */
function roundWriteRefusal(designs, round, overwriteRound) {
  if (overwriteRound) return null;
  const accepted = (designs || []).filter(isAccepted).length;
  if (accepted === 0) return null;
  return new Error(
    "refusing to overwrite designs-round" + round + ".json: it already holds " + accepted +
      " accepted design(s) that a TRACKED artifact (test/fixtures/byok_border_corpus.json) is " +
      "frozen over, so rewriting this round breaks the corpus. Pass --round <new> to ADD a round, " +
      "or --overwrite-round to re-cut this one deliberately (a FAILED attempt still cannot replace " +
      "an accepted entry).",
  );
}

/** Merge ONE attempt into its id's entry. A failed attempt cannot displace an accepted blob. */
function mergeAttempt(existing, attempt) {
  if (isAccepted(existing) && !isAccepted(attempt)) return existing;
  return attempt;
}

/** process env -> `temp/secrets.env` -> HKCU\Environment, mirroring scripts/byok_vision_gate.py. */
function resolveKey(envName) {
  const fromEnv = (process.env[envName] || "").trim();
  if (fromEnv) return fromEnv;
  const secrets = path.join(ROOT, "temp", "secrets.env");
  if (fs.existsSync(secrets)) {
    for (let line of fs.readFileSync(secrets, "utf8").split(/\r?\n/)) {
      line = line.trim();
      if (line.startsWith("export ")) line = line.slice(7);
      if (line.startsWith(envName + "=")) {
        const v = line.slice(envName.length + 1).trim().replace(/^["']|["']$/g, "");
        if (v) return v;
      }
    }
  }
  return "";
}

/** The gallery ladder. One row is enough for the prompt; two keeps the table non-degenerate so a
 *  model cannot learn "the only id is the answer" from a one-row payload.
 *
 *  `capabilities: {arrange: false, border: true}` is the REAL product combination — `js/ai_arrange.js`
 *  forwards the dialog's switches straight to `validatePatch`/`buildMessages` (js/ai_arrange.js:616
 *  -> :719), so "border design only" is a state a user can put the extension in, and it is the state
 *  this gallery is about. Turning arrange off is what makes the model's answer narrow: the patch it
 *  is asked for has exactly one writable member. */
function promptFor(instruction) {
  const rows = [standInRow("section-Section-1", "Traits", 224, 144), standInRow("section-Section-2", "Actions", 224, 256)];
  const messages = AiLayout.buildMessages(rows, instruction, {
    capabilities: LIVE_CAPS,
    liveSectionIds: rows.map((r) => r.id),
  });
  return messages;
}

/** The parser's own gate set — kept in lockstep with `promptFor` by construction: both read this
 *  one constant, so the prompt cannot offer a capability the parser then refuses.
 *
 *  `SECTION_TABLE_MARKER` + `SECTION_CONTEXT_KEYS` make the prompt's contract with the test suite,
 *  and their presence here is the boundary the panel validates against: these are the only fields the
 *  model may name, and the only ids the model may reply with. */
const LIVE_CAPS = { arrange: false, border: true };
const LIVE_IDS = [standInRow("section-Section-1", "Traits", 224, 144).id, standInRow("section-Section-2", "Actions", 224, 256).id];

async function callNous(model, messages, key, maxTokens, sampling) {
  const s = sampling || {};
  const body = JSON.stringify({
    model,
    messages,
    // Sampling config: temperature 0.0 was the default through round 16 (MEASURED,
    // muse 6-loop consultation 20261006: at T=0 the leg's greedy decoder locked three
    // ids into a malformed-JSON-envelope attractor — retries were replays, not trials).
    // `--temperature` is a generator (tooling) choice; the round file records it.
    temperature: s.temperature !== undefined ? s.temperature : 0.0,
    top_p: s.top_p !== undefined ? s.top_p : undefined,
    seed: s.seed !== undefined ? s.seed : undefined,
    max_tokens: maxTokens,
  });
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(NOUS_BASE + "/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body,
    });
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: String((err && err.message) || err) };
  }
  const ms = Date.now() - t0;
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, ms, error: text.slice(0, 400) };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, ms, error: "response was not JSON: " + text.slice(0, 200) };
  }
  const choice = (data.choices || [])[0] || {};
  const message = choice.message || {};
  return {
    ok: true,
    status: res.status,
    ms,
    finish: choice.finish_reason || null,
    usage: data.usage || null,
    content: typeof message.content === "string" ? message.content : "",
  };
}

async function callGemini(model, messages, key, maxTokens) {
  // No temperature/top_p/seed: RETIRED on Google's official host (GOOGLE_RETIRED_PARAMS).
  const body = JSON.stringify({ model, messages, max_tokens: maxTokens });
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(GEMINI_BASE + "/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body,
    });
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: String((err && err.message) || err) };
  }
  const ms = Date.now() - t0;
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, ms, error: text.slice(0, 400) };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, ms, error: "response was not JSON: " + text.slice(0, 200) };
  }
  const choice = (data.choices || [])[0] || {};
  const message = choice.message || {};
  return {
    ok: true,
    status: res.status,
    ms,
    finish: choice.finish_reason || null,
    usage: data.usage || null,
    content: typeof message.content === "string" ? message.content : "",
  };
}

async function main() {
  const outDir = path.resolve(arg("out", DEFAULT_OUT));
  const model = arg("model", DEFAULT_MODEL);
  // SEAT SELECTOR (operator ruling 2026-10-11): `--provider gemini` dials Google's official
  // OpenAI-compatible endpoint with the project's own Gemini credentials. Default stays `nous`
  // so an un-flagged run behaves exactly as before (the write guard depends on that stability).
  const provider = (arg("provider", "nous") || "nous").toLowerCase();
  if (provider !== "nous" && provider !== "gemini") {
    throw new Error("unknown --provider " + provider + " (expected: nous | gemini)");
  }
  const round = String(arg("round", "1"));
  const only = (arg("only", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const maxTokens = Number(arg("max-tokens", "6000"));
  // SAMPLING (added 2026-10-06, track byok_border_prompt_adoption_20261006). Through round 16 the
  // request pinned `temperature: 0.0`, and the muse 6-loop consultation MEASURED what that cost:
  // three ids fell into a malformed-JSON-envelope attractor and every retry was a REPLAY of the
  // same token sequence (r15/r16 byte-identical failure shapes), not an independent trial.
  // `--temperature` / `--top-p` / `--samples` are the generator's answer — a tooling choice, never
  // a product one — and the round file records what was sent, so a corpus blob's provenance stays
  // readable. Defaults are UNCHANGED (0.0, one sample) so an un-flagged run behaves exactly as it
  // did before this edit.
  const temperature = arg("temperature", null) === null ? 0.0 : Number(arg("temperature", "0"));
  const topP = arg("top-p", null) === null ? undefined : Number(arg("top-p", "1"));
  const samples = Math.max(1, Number(arg("samples", "1")));
  const maxRetries = Math.max(0, Number(arg("retries", "0")));
  const sampling = { temperature, top_p: topP };
  // DEGENERATE GATE (per SAMPLE id only, never a global length rule). A validity pass is not an
  // artwork: 04 returned 395- and 415-char empty frames (one rect outline, one path) that the trust
  // root ACCEPTS, and under last-accepted-wins such a frame becomes the canonical blob. The gate is
  // restricted to the ids named here because the accepted corpus legitimately contains short, real
  // artworks (01 532 chars, 07 623, 10 581 — measured), so a global floor would block them.
  const degenerateIds = (arg("degenerate-ids", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const overwriteRound = process.argv.includes("--overwrite-round");

  const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, "border_designs.json"), "utf8"));
  const wanted = corpus.designs.filter((d) => only.length === 0 || only.includes(d.id));
  if (wanted.length === 0) throw new Error("no designs selected (--only matched nothing)");

  const roundPath = path.join(outDir, "designs-round" + round + ".json");
  const existing = fs.existsSync(roundPath)
    ? JSON.parse(fs.readFileSync(roundPath, "utf8")).designs || []
    : [];

  // THE WRITE GUARD FIRST: before the credential is resolved, before the first network call and
  // before anything is written. A refused run costs nothing and touches nothing.
  const refusal = roundWriteRefusal(existing, round, overwriteRound);
  if (refusal) throw refusal;

  const keyName = provider === "gemini" ? "GEMINI_PAID_API_KEY" : "NOUS_API_KEY";
  const keyNames =
    provider === "gemini" ? ["GEMINI_PAID_API_KEY", "GEMINI_FREE_TIER_API_KEY"] : ["NOUS_API_KEY"];
  let key = "";
  for (const name of keyNames) {
    key = resolveKey(name);
    if (key) break;
  }
  if (!key) {
    throw new Error(keyNames.join(" / ") + " not resolvable (env, temp/secrets.env, or HKCU\\Environment)");
  }

  fs.mkdirSync(path.join(outDir, "raw-round" + round), { recursive: true });
  const log = [];
  const say = (line) => {
    log.push(line);
    process.stdout.write(line + "\n");
  };

  say("border design generator — round " + round);
  say("provider: " + provider + (provider === "gemini" ? " @ " + GEMINI_BASE : " @ " + NOUS_BASE));
  say("model: " + (provider === "gemini" ? (model === DEFAULT_MODEL ? GEMINI_MODEL : model) : model));
  say("key: " + keyName + " prefix=" + key.slice(0, 6) + "... len=" + key.length);
  say("designs: " + wanted.length + (only.length ? " (--only " + only.join(",") + ")" : ""));
  say("sampling: temperature=" + temperature + " top_p=" + (topP === undefined ? "-" : topP) +
      " samples=" + samples + " max_tokens=" + maxTokens + " retries=" + maxRetries +
      (degenerateIds.length ? " degenerate-gate=" + degenerateIds.join(",") : ""));
  say("");

  // Async sleep for backoff — a 429 is a TRANSIENT leg state, never a design verdict.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Count drawing elements the degenerate gate reads (Muse amendment, muse_6loop_consultation):
   *  at least 6 of rect/path/circle/polygon/line/ellipse AND at least 300 chars. A validity pass
   *  is not an artwork — 04's empty frames (1 rect + 1 path) must not become canonical blobs. */
  function degenerate(svg) {
    const s = String(svg || "");
    const n = (s.match(/<(rect|path|circle|polygon|line|ellipse)\b/g) || []).length;
    return { elements: n, chars: s.length, bad: n < 6 || s.length < 300 };
  }

  // The round's own entries, read once by the write guard above so the refusal and the merge agree
  // on what "already accepted" means.
  const byId = new Map(existing.map((d) => [d.id, d]));

  for (const entry of wanted) {
    const messages = promptFor(entry.instruction);
    const promptChars = messages.map((m) => m.content.length).reduce((a, b) => a + b, 0);
    process.stdout.write("[" + entry.id + "] " + entry.title + " — prompt " + promptChars + " chars, " + samples + " sample(s) ... ");
    const sampleRecords = [];
    let acceptedAttempt = null;
    let lastFail = null;

    for (let k = 1; k <= samples && !acceptedAttempt; k++) {
      // Per-call seed: two samples at the same temperature must not be replays of one trajectory.
      // (Nous leg only — the Gemini leg sends no sampling knobs, so there is no seed to vary.)
      const seed = Math.floor(Math.random() * 1e9);
      let call = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          call =
            provider === "gemini"
              ? await callGemini(provider === "gemini" && model === DEFAULT_MODEL ? GEMINI_MODEL : model, messages, key, maxTokens)
              : await callNous(model, messages, key, maxTokens, Object.assign({}, sampling, { seed }));
        } catch (err) {
          call = { ok: false, status: 0, ms: 0, error: String((err && err.message) || err) };
        }
        if (call && (call.status === 429 || call.status === 502) && attempt < maxRetries) {
          await sleep(2000 * Math.pow(2, attempt));
          continue;
        }
        break;
      }

      const rawDir = path.join(outDir, "raw-round" + round);
      const rawName = k === 1 ? entry.id + ".json" : entry.id + ".sample" + k + ".json";
      if (call.ok) {
        fs.writeFileSync(
          path.join(rawDir, rawName),
          JSON.stringify({
            id: entry.id, title: entry.title, provider, model: provider === "gemini" && model === DEFAULT_MODEL ? GEMINI_MODEL : model,
            instruction: entry.instruction,
            temperature: provider === "gemini" ? null : temperature, top_p: provider === "gemini" || topP === undefined ? null : topP, seed: provider === "gemini" ? null : seed, sample: k,
            finish: call.finish, usage: call.usage, ms: call.ms, content: call.content,
          }, null, 2),
        );
      }

      // The PRODUCT's own parser decides. A design the extension would refuse is not a design, and
      // recording it as one would make the gallery score a file the product cannot ever render.
      let verdict = { ok: false, code: "no_response", svg: null };
      if (call.ok && call.content) {
        // `liveSectionIds` is mandatory: the parser refuses a patch with no live enum
        // (`live_ids_empty`), which is correct — a border patch is validated against a sheet. The
        // stand-in rows stand in for that sheet here; the gallery applies the design to the REAL one.
        const parsed = AiLayout.parseModelOutput(call.content, LIVE_IDS, { capabilities: LIVE_CAPS });
        if (parsed && parsed.ok && parsed.patch && parsed.patch.border) {
          const raw = String(parsed.patch.border.svg || "");
          const sv = AiLayout.validateSvg(raw);
          const deg = degenerateIds.includes(entry.id) && sv && sv.ok ? degenerate(sv.sanitized || raw) : null;
          if (sv && sv.ok && deg && deg.bad) {
            // A "valid" empty frame is a DEGENERATE pass, not an acceptance: recorded as such and
            // it cannot displace a real artwork (mergeAttempt keeps accepted > failed).
            verdict = { ok: false, code: "degenerate", detail: deg, chars: deg.chars, svg: null };
          } else {
            verdict = {
              ok: Boolean(sv && sv.ok),
              code: sv && sv.ok ? "accepted" : (sv && sv.error) || "unknown",
              chars: raw.length,
              svg: sv && sv.ok ? sv.sanitized || raw : null,
              deg: deg || null,
            };
          }
        } else {
          const first = (parsed && parsed.errors && parsed.errors[0]) || null;
          verdict = { ok: false, code: (first && first.code) || "patch_rejected", detail: first || null, svg: null };
        }
      } else if (!call.ok) {
        verdict = { ok: false, code: "http_" + call.status, detail: call.error, svg: null };
      } else if (!call.content) {
        verdict = { ok: false, code: "empty_content", detail: "finish=" + call.finish, svg: null };
      }

      sampleRecords.push({ sample: k, seed, ok: verdict.ok, code: verdict.code, chars: verdict.chars || 0, finish: call.finish || null });
      if (verdict.ok) {
        acceptedAttempt = {
          id: entry.id, title: entry.title, instruction: entry.instruction, criterion: entry.criterion,
          provider, model: provider === "gemini" && model === DEFAULT_MODEL ? GEMINI_MODEL : model,
          ms: call.ms || 0, finish: call.finish || null, usage: call.usage || null, promptChars,
          temperature: provider === "gemini" ? null : temperature, seed: provider === "gemini" ? null : seed, sample: k, samplesRequested: samples,
          accepted: true, rejectCode: null, rejectDetail: null,
          svgChars: verdict.chars || 0, svg: verdict.svg,
        };
        break; // Muse's rule: freeze only the FIRST non-degenerate PASS and stop sampling this id.
      }
      lastFail = verdict;
      if (samples > 1 && k < samples) await sleep(700); // gentle pacing on the rate-limited leg
    }

    if (!acceptedAttempt) {
      const d = lastFail || { code: "no_response", chars: 0 };
      byId.set(entry.id, mergeAttempt(byId.get(entry.id), {
        id: entry.id, title: entry.title, instruction: entry.instruction, criterion: entry.criterion,
        provider, model: provider === "gemini" && model === DEFAULT_MODEL ? GEMINI_MODEL : model,
        ms: 0, finish: null, usage: null, promptChars,
        temperature: provider === "gemini" ? null : temperature, samplesRequested: samples,
        accepted: false, rejectCode: d.code, rejectDetail: d.detail || null,
        svgChars: d.chars || 0, svg: null,
      }));
    } else {
      byId.set(entry.id, mergeAttempt(byId.get(entry.id), acceptedAttempt));
    }

    const entry2 = byId.get(entry.id);
    say(
      acceptedAttempt
        ? "OK  sample " + acceptedAttempt.sample + "/" + samples + "  " + acceptedAttempt.svgChars + " chars  (deg: " +
            (acceptedAttempt.deg ? acceptedAttempt.deg.elements + " elements" : "-") + ")"
        : "FAIL " + (lastFail && lastFail.code) + "  [" + sampleRecords.map((s) => "s" + s.sample + ":" + s.code).join(" ") + "]" +
            (isAccepted(entry2) ? "  (this round's ACCEPTED entry for " + entry.id + " is PRESERVED)" : ""),
    );
    fs.writeFileSync(
      path.join(outDir, "designs-round" + round + ".json"),
      JSON.stringify({ round, provider, model: provider === "gemini" && model === DEFAULT_MODEL ? GEMINI_MODEL : model,
        generatedAt: new Date().toISOString(),
        sampling: provider === "gemini" ? null : { temperature, top_p: topP === undefined ? null : topP, max_tokens: maxTokens, retries: maxRetries, samples, degenerateIds },
        designs: [...byId.values()] }, null, 2),
    );
  }

  const landed = [...byId.values()].filter((d) => d.accepted);
  say("");
  say("accepted: " + landed.length + " / " + byId.size);
  for (const d of byId.values()) {
    if (!d.accepted) say("  REFUSED " + d.id + " — " + d.rejectCode);
  }
  fs.writeFileSync(path.join(outDir, "generator-round" + round + ".log"), log.join("\n") + "\n");
  say("wrote " + path.relative(ROOT, path.join(outDir, "designs-round" + round + ".json")));
}

// A MODULE IMPORT MUST NOT DIAL THE LIVE LEG (added 2026-10-04 with the write guard above): without
// this, `require("./border_design_generator.js")` from a test would run a generation against the free
// seat and the guard could not be tested at all. Nothing else imports this file.
if (require.main === module) {
  main().catch((err) => {
    console.error(String((err && err.stack) || err));
    process.exit(1);
  });
}

module.exports = { isAccepted, roundWriteRefusal, mergeAttempt, arg, main };
