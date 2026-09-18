/**
 * Browser E2E — track byok_ai_layout_20260915, Phase 3: the BYOK relay's THREE named
 * refusals, executed in a real browser against the real extension.
 *
 * WHY THE UNIT SUITE IS NOT ENOUGH. `test/unit/byok_relay.test.js` asserts the worker's
 * SOURCE SHAPE — the gate exists, the allow-list is consulted, nothing is logged. That is
 * necessary and it is not the gate: a gate that is present in text and wrong in behaviour
 * passes a source scan. The sender's identity in particular is produced by the RUNTIME, not
 * by this code, so "a page cannot reach this handler" is a claim about Chrome's messaging
 * semantics that no amount of reading `js/background.js` can settle. Phase 0 measured that
 * this project has NO sender gate anywhere in its worker (2 listeners, 3 message types,
 * `chrome.runtime.id` 0 hits), so there is also no sibling whose proven behaviour I could
 * inherit — the gate has to be shown working on its own.
 *
 * THE THREE PROBES, as plan.md §Phase 3 names them:
 *   1. `no_sender_check_inheritance` — a message that does not arrive as this extension's own
 *      content script on dndbeyond.com must never reach the handler. Driven from BOTH other
 *      vantage points: the page's MAIN world (where `chrome.runtime.sendMessage` is not the
 *      extension's messaging API at all) and the extension's OWN service worker (where
 *      `sender.id` DOES match — so a reply of `sender_origin` there is proof the tab-URL half
 *      is independent and identity alone is not enough).
 *   2. `provider_origin_lock` — a relay whose finished target URL names a host the manifest
 *      does not host is refused, and the worker never dials it. The attacker's version of this
 *      needs no stolen key: a 200 from their own endpoint with an `Authorization` header built
 *      from the stored credential drains the account while the key never crosses a boundary
 *      they control. The planted baseUrl is written DIRECTLY into `chrome.storage.local`,
 *      bypassing `saveSettings`' validator, because the point is what the transport does with
 *      a value the store boundary failed to catch.
 *   3. `key_shape` — a body that smuggles its own `apiKey` / `url` / `base_url` is REFUSED
 *      rather than silently trimmed, from a sender that passes every other check. "Refused, not
 *      ignored" is the assertion: a dropped field would let a caller believe it had sent a key.
 *
 * WHAT THIS SPEC DOES NOT DO: it never sends a real credential to a real provider. Every case
 * below is refused BEFORE the `fetch`, and the "no dial" claim is checked against the worker's
 * own counters (`byokRelayStats`), read straight out of the worker's global scope — a test-only
 * read of production state, not a production message type added for the test's benefit.
 *
 * Run: npm run test:e2e:byokrelay
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { launchExtensionContext, bootPage } = require("./_helpers.js");
const { contentCall } = require("./_helpers/inject.js");

/** A credential with a recognisable shape, so a leak anywhere would be visible in the reply. */
const PROBE_KEY = "sk-probe-material-0123456789abcdef";
/** An origin this extension does NOT host, in `host_permissions` or in the code. */
const ATTACKER_ORIGIN = "https://attacker.example";

const MANIFEST = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "..", "manifest.json"), "utf8"),
);

function serviceWorker(ctx) {
  const sw =
    ctx.serviceWorkers().find((w) => w.url().includes("background.js")) ||
    ctx.serviceWorkers()[0];
  assert.ok(sw, "the extension has a service worker");
  return sw;
}

/**
 * The worker's OWN decision counters, reached through `byokRelaySnapshot()`. Deliberately NOT a
 * new message type: `BYOK_CHAT` is the only thing this handler answers, and a production surface
 * added so a test can peek would be exactly the kind of extra door Phase 0 is about.
 *
 * WHY A FUNCTION AND NOT THE OBJECT: MEASURED with a throwaway probe (`temp/scratch/
 * probe_worker_scope.spec.js`, deleted) — `sw.evaluate` reaches `background.js`'s top-level
 * FUNCTIONS (`byokSenderProblem`, `byokTargetProblem`, `byokChatReply` are all properties of
 * `self`, which is why the lock's predicate is drivable below) but NOT its top-level `const`s:
 * `byokRelayStats` and `BYOK_PAGE_ORIGIN_PREFIX` both answered `not defined`, while
 * `PROVIDERS` / `AI_COMPAT_BASE_ORIGINS` / `buildRequest` — `const`s from the two
 * `importScripts`-loaded files — resolve fine. So the counters need an accessor function, which
 * is also the honest shape: a copy of three fields, never the live object.
 */
async function relayStats(ctx) {
  const stats = await serviceWorker(ctx).evaluate(() => byokRelaySnapshot());
  assert.ok(stats, "the worker answered the snapshot call");
  return stats;
}

/** Write the store directly, the way a corrupted or hand-edited record would look. */
async function plantStore(ctx, values) {
  await serviceWorker(ctx).evaluate(async (v) => {
    await chrome.storage.local.set(v);
  }, values);
}

async function clearStore(ctx) {
  await serviceWorker(ctx).evaluate(async () => {
    await chrome.storage.local.remove(["be.ai", "be.ai.key"]);
  });
}

/**
 * Load `js/ai_layout.js` in a bare VM to answer one question a live request cannot: what
 * would the worker have DIALLED for this stored config? `buildRequest` is the code that
 * decides, so running the shipped file — not a re-implementation of its rules — is the honest
 * way to name the target the lock is protecting against.
 */
function builtTargetFor(config) {
  const src = fs.readFileSync(path.resolve(__dirname, "..", "..", "js", "ai_layout.js"), "utf8");
  const box = vm.runInNewContext(
    src + "\n;({ buildRequest: buildRequest, PROVIDERS: PROVIDERS });",
    { URL, console },
    { filename: "js/ai_layout.js" },
  );
  return box.buildRequest(
    Object.assign(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 1,
        apiKey: PROBE_KEY,
      },
      config,
    ),
  );
}

describe("AC-5 — the BYOK relay's three named refusals, in a real browser (byok_ai_layout_20260915 Phase 3)", function () {
  this.timeout(900000);

  let ctx;
  let page;

  before(async function () {
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
  });

  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  beforeEach(async function () {
    // A credential and a valid stored config, so every refusal below is a refusal of the
    // MESSAGE and not an artifact of an empty store (`api_key_required` would answer first).
    await plantStore(ctx, {
      "be.ai.key": PROBE_KEY,
      "be.ai": { provider: "openai", model: "gpt-4o-mini", baseUrl: "", keyPresent: true },
    });
  });

  afterEach(async function () {
    await clearStore(ctx);
  });

  // -------------------------------------------------------------------------
  // Premise: the extension's own surface, as the real manifest ships it.
  // -------------------------------------------------------------------------

  it("the manifest hosts the provider origins the relay can dial — and nothing else", async function () {
    const hosted = (MANIFEST.host_permissions || []).map((p) => new URL(p).origin);
    // Every published provider base must be hosted, or a legitimate arrange request would be
    // refused by the very lock this spec tests.
    const published = ["https://api.openai.com", "https://api.anthropic.com"];
    for (const origin of published) {
      assert.ok(
        hosted.includes(origin),
        `${origin} is a published provider but is not in host_permissions: ${hosted.join(", ")}`,
      );
    }
    // …and the attacker origin is not, which is what makes probe 2 a real refusal.
    assert.ok(!hosted.includes(ATTACKER_ORIGIN), "the attacker origin must not be hosted");
    // `storage` is the Phase 3 grant, present so the store-backed probes below can run.
    assert.ok(MANIFEST.permissions.includes("storage"), "storage is granted (AC-V0 option (i))");
    const probe = await contentCall(ctx, "aiSettingsWorldRead", []);
    assert.strictEqual(
      probe.chromeStoragePresent,
      true,
      "the no-permission premise in byok_settings_storage.spec.js is now the OPPOSITE of what ships",
    );
  });

  // -------------------------------------------------------------------------
  // Probe 1 — no_sender_check_inheritance
  // -------------------------------------------------------------------------

  it("no_sender_check_inheritance: the page's MAIN world cannot reach the handler at all", async function () {
    // The strongest form of the claim: not "the handler refuses" but "the call cannot be made".
    // dndbeyond.com's own scripts have no `externally_connectable` grant to work with, so
    // `chrome.runtime.sendMessage` is not the extension's messaging API in that world.
    const before = await relayStats(ctx);
    const result = await page.evaluate(async () => {
      try {
        if (!globalThis.chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
          return { reachable: false, why: "no chrome.runtime.sendMessage in the page world" };
        }
        const reply = await chrome.runtime.sendMessage({
          type: "BYOK_CHAT",
          provider: "openai",
          model: "gpt-4o-mini",
          maxTokens: 1,
          messages: [{ role: "user", content: "from the page" }],
        });
        return { reachable: true, reply };
      } catch (err) {
        return { reachable: false, threw: String(err && err.message ? err.message : err) };
      }
    });
    assert.strictEqual(
      result.reachable,
      false,
      "a hostile page must not even be able to CALL the relay. Got: " + JSON.stringify(result),
    );
    assert.ok(result.why || result.threw, "and the refusal is a real API absence, not a silent no-op");
    // Nothing counted, because nothing arrived.
    const after = await relayStats(ctx);
    assert.strictEqual(after.handled, before.handled, "the page call did not reach the handler");
    assert.strictEqual(
      after.refused.request_smuggling,
      before.refused.request_smuggling,
      "nor did it trigger any refusal path",
    );
  });

  it("no_sender_check_inheritance: a message from the extension's OWN context never reaches the handler", async function () {
    // The channel half of the claim, and it is Chrome's behaviour rather than this code's:
    // `chrome.runtime.sendMessage` does not deliver to the sender's own context, so a request
    // raised from the service worker has no receiver — and the popup/options-page shape of
    // sender cannot be produced through the channel at all in a manifest that ships neither.
    // MEASURED, verbatim: `Could not establish connection. Receiving end does not exist.`
    //
    // WHY THIS IS NOT THE WHOLE PROBE. It proves no extension surface can get IN by this route;
    // it proves nothing about what the gate WOULD do with a sender whose `id` matches and whose
    // tab URL does not, because the handler never runs. The next case drives exactly that sender
    // through the production entry point, since this build has no page from which to send one.
    const before = await relayStats(ctx);
    const reply = await serviceWorker(ctx).evaluate(async () => {
      try {
        return await chrome.runtime.sendMessage({
          type: "BYOK_CHAT",
          provider: "openai",
          model: "gpt-4o-mini",
          maxTokens: 1,
          messages: [{ role: "user", content: "ping" }],
        });
      } catch (err) {
        return { ok: false, threw: String(err && err.message ? err.message : err) };
      }
    });
    assert.strictEqual(reply.ok, false, "the worker's own send is not answered by itself");
    assert.match(
      String(reply.threw || ""),
      /Receiving end does not exist|Could not establish connection/,
      "and the reason is the absence of a receiver, not a refusal: " + JSON.stringify(reply),
    );
    const after = await relayStats(ctx);
    assert.deepStrictEqual(after, before, "the handler never ran, so nothing was counted");
  });

  it("no_sender_check_inheritance: extension identity ALONE is refused (sender_origin)", async function () {
    // THE CASE A "check chrome.runtime.id" IMPLEMENTATION WOULD PASS. A sender that IS this
    // extension but is not a dndbeyond.com tab — a future popup, an options page, any other
    // extension surface — shares the identity and has no business dialing an AI provider on a
    // stored credential.
    //
    // HOW IT IS DRIVEN, and its honest limit: the sender object below is assembled by the test
    // and handed to `byokChatReply` — the SAME function the real listener calls after threading
    // Chrome's own `sender` through it (`js/background.js`: `byokChatReply._sender = sender`).
    // So the gate's LOGIC runs unmodified; only the provenance of the sender object differs,
    // because this manifest ships no popup and no options page, and a service worker cannot send
    // itself a message (the case above proves it). The predicate is also called bare, so a
    // refusal here is attributable to the tab-URL half and not to the identity half.
    const before = await relayStats(ctx);
    const out = await serviceWorker(ctx).evaluate(async () => {
      const body = {
        type: "BYOK_CHAT",
        provider: "openai",
        model: "gpt-4o-mini",
        maxTokens: 1,
        messages: [{ role: "user", content: "ping" }],
      };
      const id = chrome.runtime.id;
      const call = async (sender) => {
        byokChatReply._sender = sender;
        return byokChatReply(body);
      };
      return {
        noTab: await call({ id }),
        otherHostTab: await call({ id, tab: { id: 7, url: "https://example.com/characters/1" } }),
        wrongIdentity: await call({ id: "another-extension", tab: { id: 8, url: "https://www.dndbeyond.com/characters/1" } }),
        predicate: {
          identityOnly: byokSenderProblem({ id }),
          nonSheetTab: byokSenderProblem({ id, tab: { url: "https://example.com/" } }),
          wrongId: byokSenderProblem({ id: "another-extension", tab: { url: "https://www.dndbeyond.com/characters/1" } }),
          // The positive control inside the predicate: the same shape the accepted sender has.
          sheetTab: byokSenderProblem({ id, tab: { url: "https://www.dndbeyond.com/characters/1" } }),
        },
      };
    });
    assert.strictEqual(out.noTab.ok, false, "a sender with no tab is refused");
    assert.strictEqual(out.noTab.transport, "sender_origin", "…for its ORIGIN, not its identity");
    assert.strictEqual(out.otherHostTab.transport, "sender_origin", "…and so is one on another host");
    assert.strictEqual(out.wrongIdentity.transport, "sender_identity", "a foreign id is refused by name");
    assert.notStrictEqual(
      out.wrongIdentity.transport,
      "sender_origin",
      "the two halves are distinguishable in the reply, so one cannot be mistaken for the other",
    );
    assert.strictEqual(out.predicate.identityOnly, "sender_origin", "identity alone is not enough");
    assert.strictEqual(out.predicate.nonSheetTab, "sender_origin");
    assert.strictEqual(out.predicate.wrongId, "sender_identity");
    assert.strictEqual(out.predicate.sheetTab, "", "…while a real sheet tab passes (the control)");
    assert.ok(
      !/sk-|Bearer/.test(JSON.stringify(out)),
      "no refusal echoes anything credential-shaped",
    );

    const after = await relayStats(ctx);
    assert.strictEqual(after.handled, before.handled, "nothing was dialed");
    assert.strictEqual(after.refused.sender_origin, before.refused.sender_origin + 2, "both origin refusals counted");
    assert.strictEqual(after.refused.sender_identity, before.refused.sender_identity + 1, "and the identity one");
    assert.strictEqual(after.lastTargetOrigin, before.lastTargetOrigin, "no target origin was recorded");
  });

  it("no_sender_check_inheritance: the content-script world IS the only accepted sender", async function () {
    // The positive control, without which the two cases above prove nothing: a call from the
    // isolated world on a dndbeyond tab must get PAST the sender gate. It is given a provider
    // that has no adapter, so it stops at `unknown_provider` INSIDE the gate's shadow — the
    // proof is which refusal answered, and no request ever leaves the worker. (A real provider
    // here would put a live HTTP call to api.openai.com in the test suite, with a fake key, for
    // no assertion value.)
    const reply = await contentCall(ctx, "byokRelayProbe", [{ provider: "positive-control-x" }]);
    for (const gate of ["sender_identity", "sender_origin", "request_smuggling"]) {
      assert.notStrictEqual(
        reply.transport,
        gate,
        `the content script was refused by the sender gate ${gate}: ` + JSON.stringify(reply),
      );
    }
    assert.strictEqual(
      reply.transport,
      "unknown_provider",
      "the control must stop BEHIND the sender gate, not at a dial: " + JSON.stringify(reply),
    );
    const after = await relayStats(ctx);
    assert.strictEqual(after.handled, 0, "the positive control dialed nothing either");
  });

  // -------------------------------------------------------------------------
  // Probe 2 — provider_origin_lock
  // -------------------------------------------------------------------------

  it("provider_origin_lock: a stored baseUrl naming an unhosted origin is never dialed", async function () {
    // Plant it DIRECTLY in the store — `saveSettings` would refuse this value, and the point of
    // the lock is that it does not depend on the caller having gone through `saveSettings`.
    await plantStore(ctx, {
      "be.ai": {
        provider: "openai",
        model: "gpt-4o-mini",
        baseUrl: ATTACKER_ORIGIN + "/v1",
        keyPresent: true,
      },
    });
    // The shipped builder must be the thing that decides, so this names the target rather than
    // asserting a hypothesis about it. Either it throws (O-1's rule at the transport boundary)
    // or it hands back the attacker URL — and in that second case the worker's OWN lock is the
    // only thing left between this config and a real dial, which is exactly what probe 2 tests.
    let built;
    try {
      built = { ok: true, url: builtTargetFor({ baseUrl: ATTACKER_ORIGIN + "/v1" }).url };
      assert.ok(
        built.url.startsWith(ATTACKER_ORIGIN + "/"),
        "if the builder ever ACCEPTS an unhosted origin, the lock is the last line: " + built.url,
      );
    } catch (err) {
      built = { ok: false, code: String((err && err.code) || "") };
      assert.strictEqual(
        built.code,
        "base_url_not_allowed",
        "the builder refused, but with an unplanned code: " + built.code,
      );
    }
    const reply = await contentCall(ctx, "byokRelayProbe", [{}]);
    assert.strictEqual(reply.ok, false, "the relay must not report success against an unhosted host");
    assert.ok(
      ["base_url_not_allowed", "provider_origin_lock"].includes(reply.transport),
      "refused by a NAMED origin rule, not incidentally: " + JSON.stringify(reply),
    );
    const after = await relayStats(ctx);
    assert.strictEqual(after.handled, 0, "the lock fires before the fetch: nothing was handled");
    assert.strictEqual(after.lastTargetOrigin, "", "no target origin was ever recorded");
    assert.ok(
      !JSON.stringify(after).includes("attacker.example"),
      "the attacker origin never appears as a dialed target",
    );
    // And the reply carries no credential, whichever rule answered.
    assert.ok(
      !JSON.stringify(reply).includes(PROBE_KEY),
      "the refusal must not echo the stored key: " + JSON.stringify(reply),
    );
  });

  it("provider_origin_lock: the lock's own predicate accepts the published pair and refuses the rest", async function () {
    // Probe 2 above shows the OUTCOME (nothing dials), but on this configuration
    // `buildRequest` is what refuses, so the lock's own branch is not what answered. Rather
    // than leave that branch unexecuted, call it directly in the worker with the exact shapes
    // it is written to judge. This is a test reading a production function in the worker's own
    // scope — not a production code path added for the test.
    const verdicts = await serviceWorker(ctx).evaluate(() => {
      const target = (url) => ({ url, method: "POST", headers: {}, body: {} });
      return {
        openai: byokTargetProblem(target("https://api.openai.com/v1/chat/completions")),
        anthropic: byokTargetProblem(target("https://api.anthropic.com/v1/messages")),
        attacker: byokTargetProblem(target("https://attacker.example/v1/chat/completions")),
        // The shapes a lock must not be fooled by: userinfo, a port, a suffix-match host, and
        // a protocol-relative string.
        userinfo: byokTargetProblem(target("https://api.openai.com@attacker.example/v1")),
        suffix: byokTargetProblem(target("https://api.openai.com.attacker.example/v1")),
        notAUrl: byokTargetProblem(target("not a url")),
        noTarget: byokTargetProblem(null),
      };
    });
    assert.strictEqual(verdicts.openai, "", "the published OpenAI origin is dialable");
    assert.strictEqual(verdicts.anthropic, "", "the published Anthropic origin is dialable");
    assert.match(verdicts.attacker, /attacker\.example/, "an unhosted origin is refused by name");
    assert.notStrictEqual(verdicts.userinfo, "", "userinfo cannot smuggle an approved-looking host");
    assert.notStrictEqual(verdicts.suffix, "", "a subdomain suffix is not an origin match");
    assert.notStrictEqual(verdicts.notAUrl, "", "an unparseable target is refused");
    assert.notStrictEqual(verdicts.noTarget, "", "a missing target is refused");
  });

  it("provider_origin_lock: an EMPTY compatible allow-list means no third-party host is dialable", async function () {
    // D5/D6's carryover, stated as a fact about the shipped pair rather than a comment: the
    // allow-list is empty in v1, so ONLY the two published provider origins are reachable. The
    // unit case that asserts the list is empty must change in the same commit that adds a host,
    // and this is the paired statement of that rule for the transport.
    const compat = await contentCall(ctx, "byokRelayProbe", [{ readCompatList: true }]);
    assert.strictEqual(compat.seamPresent, true, "window.AiSettings must be live in the world");
    assert.deepStrictEqual(compat.compatList, [], "AI_COMPAT_BASE_ORIGINS ships empty in v1");
    // An origin is dialable only if the manifest hosts it: check the pair the other direction.
    const hosted = (MANIFEST.host_permissions || []).map((p) => new URL(p).origin);
    assert.deepStrictEqual(
      hosted.filter((o) => o.startsWith("https://api.")),
      ["https://api.openai.com", "https://api.anthropic.com"],
      "the hosted provider set is exactly the published pair while the allow-list is empty",
    );
  });

  // -------------------------------------------------------------------------
  // Probe 3 — key_shape
  // -------------------------------------------------------------------------

  it("key_shape: a body smuggling its own credential or URL is refused, not trimmed", async function () {
    // Every smuggle shape must be refused from a sender that passes the other two gates — so the
    // assertion is about the FIELD, not the sender. A silently-dropped field would answer
    // something else (or succeed against the real provider) and the caller would never learn.
    const before = await relayStats(ctx);
    const shapes = [
      { apiKey: "sk-smuggled-material-0123456789" },
      { api_key: "sk-smuggled-material-0123456789" },
      { API_KEY: "sk-smuggled-material-0123456789" },
      { key: "sk-smuggled-material-0123456789" },
      { token: "sk-smuggled-material-0123456789" },
      { url: ATTACKER_ORIGIN + "/v1/chat/completions" },
      { baseUrl: ATTACKER_ORIGIN + "/v1" },
      { base_url: ATTACKER_ORIGIN + "/v1" },
      { allowedBaseOrigins: [ATTACKER_ORIGIN] },
      { headers: { Authorization: "Bearer smuggled" } },
      { host: ATTACKER_ORIGIN.replace("https://", "") },
      { origin: ATTACKER_ORIGIN },
      { unknownFutureField: "anything" },
    ];
    for (const extra of shapes) {
      const reply = await contentCall(ctx, "byokRelayProbe", [{ extra }]);
      const field = Object.keys(extra)[0];
      assert.strictEqual(reply.ok, false, `smuggled field ${field} was accepted`);
      assert.strictEqual(
        reply.transport,
        "request_smuggling",
        `smuggled field ${field} refused for the wrong reason: ` + JSON.stringify(reply),
      );
      assert.ok(
        String(reply.message || "").includes(field),
        `the refusal should name the field ${field} so a caller can fix it: ${reply.message}`,
      );
      assert.ok(
        !JSON.stringify(reply).includes(String(extra[field])),
        `the refusal must not echo the smuggled VALUE for ${field}`,
      );
    }
    const after = await relayStats(ctx);
    assert.strictEqual(after.refused.request_smuggling, before.refused.request_smuggling + shapes.length);
    assert.strictEqual(after.handled, before.handled, "a smuggled body never reaches the fetch");
    assert.strictEqual(after.lastTargetOrigin, "", "…and no origin was ever dialed");
  });

  // -------------------------------------------------------------------------
  // The reply's own shape: nothing the request said rides back out.
  // -------------------------------------------------------------------------

  it("the worker answers with its OWN field list, never the request's shape", async function () {
    // Build the reply from the verdict's fields. If it ever spread the request instead, an
    // unexpected body key (or a provider echo) could leave the worker in a response the page
    // can read. Drive a refusal with a NOVEL key that no code path could have invented.
    const canary = "canary_marker_never_reply_with_this";
    const reply = await contentCall(ctx, "byokRelayProbe", [{ extra: { [canary]: "kept-intact" } }]);
    assert.strictEqual(reply.transport, "request_smuggling");
    assert.ok(
      !Object.keys(reply).includes(canary),
      "the reply echoed a request field back: " + JSON.stringify(Object.keys(reply)),
    );
    assert.ok(
      !JSON.stringify(reply).includes("kept-intact"),
      "the reply echoed a request VALUE back: " + JSON.stringify(reply),
    );
    // The reply's vocabulary is closed: ok/transport/errorClass/message, plus text/status/
    // retryAfterSeconds only when they are the answer's own.
    const allowed = ["ok", "transport", "errorClass", "message", "text", "status", "retryAfterSeconds"];
    for (const key of Object.keys(reply)) {
      assert.ok(allowed.includes(key), `the reply carries an unplanned key ${key}`);
    }
  });

  it("the key never appears in anything the relay can hand back, on every path", async function () {
    // The AC-5 gate, phrased as the plan phrases it: name the SINK, not just the secret. The
    // sinks here are the reply body and the worker's counters — the two things that leave the
    // handler's scope. Both are read directly, so a leak in either would be in this assertion.
    await plantStore(ctx, {
      "be.ai": { provider: "openai", model: "gpt-4o-mini", baseUrl: ATTACKER_ORIGIN + "/v1", keyPresent: true },
    });
    const paths = [
      {},
      { extra: { apiKey: "x" } },
      { provider: "nope" },
      { model: 42 },
      { maxTokens: "many" },
      { rawString: true },
      { notAnObject: true },
    ];
    for (const opts of paths) {
      const reply = await contentCall(ctx, "byokRelayProbe", [opts]);
      const wire = JSON.stringify(reply);
      assert.ok(!wire.includes(PROBE_KEY), `the stored key leaked into a reply: ${wire}`);
      assert.ok(!/sk-[A-Za-z0-9_-]{16,}/.test(wire), `a key-shaped string is in a reply: ${wire}`);
      assert.ok(
        !wire.includes("Bearer "),
        `an Authorization header value is in a reply: ${wire}`,
      );
    }
    const stats = JSON.stringify(await relayStats(ctx));
    assert.ok(!stats.includes(PROBE_KEY), "the worker's counters carry no credential: " + stats);
    assert.ok(!/"body"|"headers"/.test(stats), "the counters carry no request body or headers: " + stats);
  });
});
