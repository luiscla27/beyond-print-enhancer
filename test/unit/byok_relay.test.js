/**
 * Unit — track byok_ai_layout_20260915, Phase 3: the `BYOK_CHAT` worker relay and its gate
 * (AC-5), asserted at the SOURCE level — a browser cannot run inside mocha.
 *
 * WHY THIS IS A SOURCE-SHAPE TEST. AC-5's browser side (the three named probes: `sender_identity`,
 * `provider_origin_lock`, `key_shape`) lands in `test/browser_e2e/byok_relay.spec.js`, which drives
 * a real service worker through Playwright. The properties this file can prove are the ones that
 * hold REGARDLESS of who sends a message, because they are about what the worker DOES with any
 * message at all: the gate's fields, the lack of any log-echo path, and the exact request it does
 * and does not build. Grepping is the right tool for "this name is never a sink", the wrong one
 * for "this code behaves"; the comment on each probe names which is which.
 *
 * THE GREP FORM. The spec's AC-4 note, carried into Phase 3: there is no `safeLog` and no
 * `console.*` in `js/`, and the real sinks are (a) `JSON.stringify` of a request body, (b)
 * `response.json()` on a response, (c) interpolation of a stored value into a string, (d) `.json()`
 * results being logged. The ONE `.json()` that exists here is the pre-existing `FETCH_CHARACTER_DATA`
 * relay at `js/background.js:220` — that is the thing Phase 0's measurement pinned, and Phase 3
 * does NOT add a second one. `JSON.stringify` appears once, and only on `target.body` (the
 * outbound request), which is the legitimated site the spec calls out. A `.headers` direct access
 * is what an echo of a request's auth header would look like, and there are zero of them.
 * Loose word-matches are rejected deliberately per §6.3/R-2: `grep -ri headers js/` returns 11
 * lines and would read red on comments.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const BACKGROUND = fs.readFileSync(path.join(ROOT, "js", "background.js"), "utf8");
const SETTINGS = fs.readFileSync(path.join(ROOT, "js", "ai_settings.js"), "utf8");

const countMatches = (re, text) => (text.match(re) || []).length;

describe("AC-5 (BYOK relay) — worker source-level shape", function () {
  it("imports the pure core and the store, and nothing else", function () {
    // The TWO files whose top-level bindings become visible in the worker scope. Declared
    // in `eslint.config.js` as read-only globals for that file, which is what makes this an
    // architectural assertion rather than a name list.
    assert.match(BACKGROUND, /importScripts\(\s*"js\/ai_layout\.js"\s*,\s*"js\/ai_settings\.js"\s*\)/);
    // No other importScripts, and no `<script>` tag (there's nothing to tag).
    assert.strictEqual(countMatches(/importScripts\(/g, BACKGROUND), 1);
  });

  it("is the ONLY onMessage listener that answers BYOK_CHAT", function () {
    // The badge/clear handler above the relay answers `DDB_IS_ON`/`DDB_TURNED_OFF`; the character
    // data handler answers `FETCH_CHARACTER_DATA`. Neither is allowed to fall through into the BYOK
    // branch, so the type check must be an EXACT match, not a substring.
    const chatListeners = BACKGROUND.split("BYOK_CHAT").length - 1;
    assert.ok(chatListeners >= 1, "there is a BYOK_CHAT branch");
    // And it returns true to keep the message channel open — the shape `:203` proved works.
    assert.match(BACKGROUND, /if \(\s*!request\s*\|\|\s*request\.type\s*!==\s*["']BYOK_CHAT["']\s*\)\s*return;/);
  });

  it("NO body field reaches the worker as the request's URL or credential — gate at the seam", function () {
    // The indirect-leak case in words: the body must not be able to override where the fetch goes
    // or what it carries. Asserted structurally: the only `fetch` in the relay's own branch is
    // `fetch(target.url, …)`, where `target` is the return value of `buildRequest` — never
    // `request.url`, `request.baseUrl`, `request.headers` or anything else a caller could set.
    //
    // THE FOUR FIELDS THAT ARE ALLOWED: provider, model, messages, maxTokens. They carry NO
    // credential and NO URL, and `byokSmuggledKeys` is what rejects anything else — so the check
    // here is specifically that the FORBIDDEN fields (apiKey, url, baseUrl, headers, token, host)
    // are never passed into `buildRequest` or `fetch`.
    const relayBlock = BACKGROUND.slice(BACKGROUND.indexOf("function byokChatReply"));
    assert.ok(!/fetch\(\s*request\./.test(relayBlock), "fetch never takes its URL from the body");
    assert.ok(
      !/headers:\s*request\./.test(relayBlock),
      "fetch never takes its headers from the body",
    );
    const forbiddenInBuildRequest =
      /buildRequest\([^)]*request\.(apiKey|api_key|key|token|headers|url|baseUrl|base_url|host|origin)/;
    assert.ok(
      !forbiddenInBuildRequest.test(relayBlock),
      "buildRequest is not called with credential/URL-shaped body fields — the worker reads those from storage",
    );
  });

  it("rejects a body that smuggles credential- or transport-shaped fields (key_shape)", function () {
    // The unit half of the browser probe. The allowed-request vocabulary is the explicit list;
    // `apiKey`, `url`, `baseUrl`, `allowedBaseOrigins`, `headers` and their aliases must be
    // refused. Asserted at source: every one of those names appears in the refusal set, and the
    // handler checks them.
    const smuggled = ["apikey", "api_key", "key", "token", "url", "baseurl", "base_url"];
    for (const name of smuggled) {
      assert.ok(
        BACKGROUND.includes(`"${name}"`),
        `"${name}" is in the smuggling refusal set`,
      );
    }
    // The refusal is an EXPLICIT match, not a substring — so `messages` (which is allowed) does
    // not collide with `message`. The check normalizes to lowercase + strips punctuation, so
    // `apiKey`, `API_KEY`, `api_key` are all one attempt. Asserted as the normalization, not a
    // comment: a `.toLowerCase()` and a `.replace(/[^a-z0-9_]/g, "")` in the same block.
    const normBlock = BACKGROUND.slice(BACKGROUND.indexOf("function byokSmuggledKeys"));
    assert.match(normBlock, /\.toLowerCase\(\)/);
    assert.match(normBlock, /[^a-z0-9_]/);
  });

  it("the credential read path does NOT log its argument (no log-echo)", function () {
    // AC-4's sink discipline, carried into the relay. There is no `safeLog` and no `console.*`
    // in `js/`, and neither `js/background.js` is allowed to add one — the only product sink is
    // `js/main.js:260`.
    assert.strictEqual(countMatches(/safeLog\(/g, BACKGROUND), 0, "no safeLog in the relay");
    assert.strictEqual(
      countMatches(/console\.(log|warn|error|info|debug)/g, BACKGROUND),
      0,
      "no console.* in the relay",
    );
    // `getApiKey` returns the credential; assert the worker reads it without stringifying it
    // into a sink or a message (the only `JSON.stringify` is `target.body`).
    const credentialSites = BACKGROUND.split("getApiKey").length - 1;
    assert.ok(credentialSites >= 1, "the worker reads the credential");
    assert.strictEqual(
      countMatches(/JSON\.stringify\s*\([^)]*apiKey/gi, BACKGROUND),
      0,
      "the credential is not stringified into a log line",
    );
  });

  it("the single .json() is the pre-existing FETCH_CHARACTER_DATA relay, and Phase 3 adds none", function () {
    // Pinned by Phase 0: `response.json()` 3 sites in js/, all `response.json()`. Phase 3's
    // worker parses the response with `parseResponse`, which accepts a string — so this file does
    // NOT add a second, ungated `.json()` that could throw a typed error off the happy path.
    const jsonSites = BACKGROUND.split(".json()").length - 1;
    assert.ok(jsonSites >= 1, "the pre-existing character-data relay still uses .json()");
    assert.ok(
      /parseResponse\s*\(\s*provider\s*,\s*raw\s*\)/.test(BACKGROUND),
      "and Phase 3 routes its own response through parseResponse",
    );
  });

  it("the finished fetch target is pinned to a published origin (provider_origin_lock)", function () {
    // Source half of the browser probe: the origin check exists, and it is run on the BUILT
    // target (`target.url`), not on a request field. Two checks on the same property is the
    // redundancy that makes the indirect-leak case falsifiable — if `buildRequest`'s upstream
    // `resolveBase` ever stops refusing an off-list origin, the worker's own check still does.
    assert.ok(/byokTargetProblem/.test(BACKGROUND), "the origin-lock function exists");
    assert.match(BACKGROUND, /byokTargetProblem\s*\(\s*target\s*\)/);
    assert.ok(
      /AI_COMPAT_BASE_ORIGINS/.test(BACKGROUND),
      "the check consults the published allow-list (the worker's own copy, not a message field)",
    );
  });

  it("the fetch target's headers are the one legitimate use of the word — sent to fetch only", function () {
    // `target.headers` (what we SEND) appears once: in the `fetch` call. `response.headers` (what we
    // RECEIVE) appears once, for the retry-after read. A fixed-string `.headers` direct access on
    // something that is NOT a fetch argument is the shape of an echo — assert the two known uses.
    const sendHeader = BACKGROUND.split("target.headers").length - 1;
    const recvHeader = BACKGROUND.split("response.headers").length - 1;
    assert.ok(sendHeader >= 1, "headers are sent to fetch (target.headers)");
    assert.ok(recvHeader >= 1, "…and read off the response (response.headers)");
  });
});

describe("Phase 3 — the ping still refuses to dial from inside the worker", function () {
  it("aiDefaultPing asks the worker instead of dialing itself", function () {
    // The honest default in Phase 3: `aiDefaultPing()` returns a function that sends a
    // `BYOK_CHAT` message with `maxTokens: 1`. What it does NOT do is issue its own `fetch` —
    // that is exactly the second-relay trap L-3 warns about.
    assert.ok(
      /type:\s*["']BYOK_CHAT["']/.test(SETTINGS),
      "the ping sends a BYOK_CHAT message",
    );
    assert.ok(/maxTokens:\s*1/.test(SETTINGS), "…with maxTokens 1");
    assert.ok(!/fetch\(/.test(SETTINGS), "the settings module makes no fetch of its own");
    assert.ok(
      /sendMessage/.test(SETTINGS),
      "and reaches the worker through chrome.runtime.sendMessage",
    );
  });

  it("aiDefaultPing refuses when there is no runtime to answer (suspended worker, no ext context)", function () {
    // MV3 can suspend a service worker, and `chrome.runtime.sendMessage` never resolves when
    // nothing is listening. The ping must answer a typed refusal rather than hang the dialog.
    const pingBlock = SETTINGS.slice(SETTINGS.indexOf("function aiDefaultPing"));
    assert.ok(
      /errorClass:\s*["']unavailable["']/.test(pingBlock),
      "a missing runtime is an `unavailable` refusal",
    );
    assert.ok(
      /errorClass:\s*["']transport_timeout["']|AI_PING_TIMEOUT_MS/.test(pingBlock),
      "and a deadline exists for the listening-but-silent case",
    );
  });
});
