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
 *   node scripts/border_design_generator.js [--out <dir>] [--model <id>] [--only <id,id>] [--round N]
 *
 *   --out    artifact directory (default temp/visual_logs/byok_svg_borders_20260927)
 *   --model  the Nous seat (default poolside/laguna-s-2.1:free — MEASURED: 200 in ~31 s, clean JSON)
 *   --only   comma-separated design ids, for a single-design retry
 *   --round  suffixed into the output filenames (default 1), so a re-polish never overwrites the
 *            frames a previous verdict was scored against
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

async function callNous(model, messages, key, maxTokens) {
  const body = JSON.stringify({ model, messages, temperature: 0.0, max_tokens: maxTokens });
  const t0 = Date.now();
  const res = await fetch(NOUS_BASE + "/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body,
  });
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
  const round = String(arg("round", "1"));
  const only = (arg("only", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const maxTokens = Number(arg("max-tokens", "6000"));

  const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, "border_designs.json"), "utf8"));
  const wanted = corpus.designs.filter((d) => only.length === 0 || only.includes(d.id));
  if (wanted.length === 0) throw new Error("no designs selected (--only matched nothing)");

  const key = resolveKey("NOUS_API_KEY");
  if (!key) {
    throw new Error("NOUS_API_KEY not resolvable (env, temp/secrets.env, or HKCU\\Environment)");
  }

  fs.mkdirSync(path.join(outDir, "raw-round" + round), { recursive: true });
  const log = [];
  const say = (line) => {
    log.push(line);
    process.stdout.write(line + "\n");
  };

  say("border design generator — round " + round);
  say("model: " + model + " @ " + NOUS_BASE);
  say("key: prefix=" + key.slice(0, 6) + "... len=" + key.length);
  say("designs: " + wanted.length + (only.length ? " (--only " + only.join(",") + ")" : ""));
  say("");

  const designs = JSON.parse(
    fs.existsSync(path.join(outDir, "designs-round" + round + ".json"))
      ? fs.readFileSync(path.join(outDir, "designs-round" + round + ".json"), "utf8")
      : JSON.stringify({ round, model, designs: [] }),
  ).designs || [];
  const byId = new Map(designs.map((d) => [d.id, d]));

  for (const entry of wanted) {
    const messages = promptFor(entry.instruction);
    const promptChars = messages.map((m) => m.content.length).reduce((a, b) => a + b, 0);
    process.stdout.write("[" + entry.id + "] " + entry.title + " — prompt " + promptChars + " chars ... ");
    let call;
    try {
      call = await callNous(model, messages, key, maxTokens);
    } catch (err) {
      call = { ok: false, status: 0, ms: 0, error: String((err && err.message) || err) };
    }
    const rawDir = path.join(outDir, "raw-round" + round);
    if (call.ok) {
      fs.writeFileSync(
        path.join(rawDir, entry.id + ".json"),
        JSON.stringify(
          {
            id: entry.id,
            title: entry.title,
            model,
            instruction: entry.instruction,
            finish: call.finish,
            usage: call.usage,
            ms: call.ms,
            content: call.content,
          },
          null,
          2,
        ),
      );
    }

    // The PRODUCT's own parser decides. A design the extension would refuse is not a design, and
    // recording it as one would make the gallery score a file the product cannot ever render.
    let verdict = { ok: false, code: "no_response", svg: null };
    if (call.ok && call.content) {
      // `liveSectionIds` is mandatory: the parser refuses a patch with no live enum
      // (`live_ids_empty`), which is correct — a border patch is validated against a sheet. The
      // stand-in rows stand in for that sheet here; the gallery applies the design to the REAL one.
      const parsed = AiLayout.parseModelOutput(call.content, LIVE_IDS, {
        capabilities: LIVE_CAPS,
      });
      if (parsed && parsed.ok && parsed.patch && parsed.patch.border) {
        const raw = String(parsed.patch.border.svg || "");
        const sv = AiLayout.validateSvg(raw);
        verdict = {
          ok: Boolean(sv && sv.ok),
          code: sv && sv.ok ? "accepted" : (sv && sv.error) || "unknown",
          chars: raw.length,
          svg: sv && sv.ok ? sv.sanitized || raw : null,
        };
      } else {
        const first = (parsed && parsed.errors && parsed.errors[0]) || null;
        verdict = { ok: false, code: (first && first.code) || "patch_rejected", detail: first || null, svg: null };
      }
    } else if (!call.ok) {
      verdict = { ok: false, code: "http_" + call.status, detail: call.error, svg: null };
    } else if (!call.content) {
      verdict = { ok: false, code: "empty_content", detail: "finish=" + call.finish, svg: null };
    }

    byId.set(entry.id, {
      id: entry.id,
      title: entry.title,
      instruction: entry.instruction,
      criterion: entry.criterion,
      model,
      ms: call.ms || 0,
      finish: call.finish || null,
      usage: call.usage || null,
      promptChars,
      accepted: verdict.ok,
      rejectCode: verdict.ok ? null : verdict.code,
      rejectDetail: verdict.detail || null,
      svgChars: verdict.chars || 0,
      svg: verdict.svg,
    });
    say(
      verdict.ok
        ? "OK  " + verdict.chars + " chars  " + (call.ms / 1000).toFixed(1) + "s"
        : "FAIL " + verdict.code + "  " + (call.ms / 1000).toFixed(1) + "s",
    );
    fs.writeFileSync(
      path.join(outDir, "designs-round" + round + ".json"),
      JSON.stringify({ round, model, generatedAt: new Date().toISOString(), designs: [...byId.values()] }, null, 2),
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

main().catch((err) => {
  console.error(String((err && err.stack) || err));
  process.exit(1);
});
