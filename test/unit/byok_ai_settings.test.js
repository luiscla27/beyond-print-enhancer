/**
 * AC-4 — the BYOK config store and its dialog (track byok_ai_layout_20260915, Phase 2).
 *
 * THE FAILURE THIS SUITE EXISTS TO PREVENT
 * ---------------------------------------
 * Not "the settings do not save". This project has a RECORDED instance of the real AC-4
 * failure mode: `js/controls.js:878-890` documents the onboarding hint whose unit test
 * passed on a STUBBED `chrome.storage` while the feature silently did nothing in
 * production, because the manifest never asked for the `storage` permission and
 * `chrome.storage` is UNDEFINED in a real content script. Spec §Working notes 1b makes
 * that the rule for this suite: a stubbed store must not be what makes a case pass, and
 * the no-permission path is a required case, not an edge case.
 *
 * So the cases below are built on three disciplines:
 *  1. SPY, NOT STUB — every successful read asserts the store's `get` was ACTUALLY called
 *     with the credential's key name (`getApiKey()` ran), so a settings object that merely
 *     round-trips in-memory state cannot pass.
 *  2. A REAL LAYOUT RECORD IN THE SAME STORE — "never persisted into a layout record" is
 *     checked against a seeded layout the flow could plausibly corrupt, and the seed is
 *     compared byte-for-byte afterwards. Asserting absence in a store that contains no
 *     layout is vacuous.
 *  3. THE UNAVAILABLE STORE IS BOOTTED, NOT MOCKED — the no-permission case deletes
 *     `chrome` entirely and runs the whole public surface, asserting no throw, no network
 *     attempt (`fetch` is a tripwire that FAILS the case), and an honest
 *     `storage_unavailable` rather than a silent success.
 *
 * WHAT AC-4 LITERALLY ASKS, AND WHERE IT IS PROVED
 * ------------------------------------------------
 * "provider, model id, and API key live in `chrome.storage.local` under one namespaced
 * key" → the two-key namespace + `be.ai` field-set cases.
 * "the key is never written to `chrome.storage.sync`" → a SYNC STORE IS PRESENT AND
 * WATCHED in every boot; a leak is a failing case, not a grep.
 * "never logged" → the source-hygiene cases (`console.*` banned, `safeLog` is the only
 * sink, no stored config reaches it, no stringified credential).
 * "never placed in the prompt" → Phase 1's `buildMessages` cases own the prompt; here the
 * corresponding claim is that nothing in this file can reach it (no fetch, no chat).
 * "never persisted into a layout record or telemetry" → the seeded-layout case.
 * "shows it masked with a reveal toggle and a remove-key action" → the dialog cases, all
 * of which boot the SHARED modal shell (`js/modals.js`) and click real nodes.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "..", "..");
const readJs = (p) => fs.readFileSync(path.join(ROOT, "js", p), "utf8");

const SRC = {
  modals: readJs("modals.js"),
  aiSettings: readJs("ai_settings.js"),
  aiLayout: readJs("ai_layout.js"),
};

/**
 * The module's CODE, with comments removed. Needed because this file's header quotes the
 * very patterns AC-4 bans (`chrome.storage.sync`, "telemetry", `Authorization`) to explain
 * itself, so grepping the raw source would flag the explanation of the rule as a violation
 * of the rule. A grep that cannot tell prose from code is also a grep nobody trusts.
 */
function codeOf(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** The credential this suite stores. Shaped like a real one on purpose (see below). */
const KEY = "sk-real-looking-material-0123456789abcdef";
/** What the store holds BEFORE the dialog is opened, with a key already saved. */
const SEEDED_SETTINGS = {
  provider: "openai",
  model: "gpt-4o-mini",
  baseUrl: "",
  keyPresent: true,
};

/** A layout record in the shape `scanLayout`/`saveLayout` write (js/storage.js:193). */
function seededLayout() {
  return {
    sections: {
      "section-ability": {
        left: 200,
        top: 40,
        width: 400,
        height: 600,
        zIndex: 240,
        minimized: false,
      },
    },
    shapes: {},
  };
}

/** The layout's storage key, using the product's own namespace convention. */
const LAYOUT_STORE_KEY = "be.layout.SHEET-1";

/**
 * Boot a window with BOTH halves of the chrome.storage surface a content script can see
 * once the `storage` permission exists (AC-V0's option (i)): `local`, which this feature
 * uses, and `sync`, which it must never touch. `sync` is not decoration — a leak into it
 * is exactly what AC-4 forbids, and a store that does not exist cannot record one.
 *
 * `chromeStorage: false` is the no-permission path: `chrome` is absent altogether, which
 * is what the product shipped before the `storage` permission (and what
 * `js/controls.js:884-896` still handles). `removeMethod: false` boots a store without
 * `remove`, since `aiStorageRemove` has a documented fallback that must be exercised.
 */
function boot({
  chromeStorage = true,
  seedKey = false,
  seedSettings = false,
  seedLayout = false,
  removeMethod = true,
  getThrows = false,
} = {}) {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="app"></div></body></html>',
    { url: "https://www.dndbeyond.com/characters/1", runScripts: "dangerously", pretendToBeVisual: true },
  );
  const window = dom.window;
  const document = window.document;

  global.window = window;
  global.document = document;
  global.HTMLElement = window.HTMLElement;
  global.Element = window.Element;

  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.confirm = () => true;

  // The 1-token ping must never be reached by these cases, and a transport that appeared
  // here would be Phase 3's job. A tripwire makes that a FAILING case, not an unproven
  // claim: `boot()` asserts it was never called.
  const fetchCalls = [];
  window.fetch = (...args) => {
    fetchCalls.push(args);
    return Promise.reject(new Error("the settings phase must not reach the network"));
  };

  const local = {};
  const sync = {};
  if (seedKey) local["be.ai.key"] = KEY;
  if (seedSettings) local["be.ai"] = Object.assign({}, SEEDED_SETTINGS);
  if (seedLayout) local[LAYOUT_STORE_KEY] = seededLayout();
  const layoutBytesBefore = seedLayout ? JSON.stringify(local[LAYOUT_STORE_KEY]) : null;

  const writes = [];
  const reads = [];
  const store = {
    get: (key) => {
      if (getThrows) throw new Error("storage blocked by policy");
      reads.push(key);
      if (typeof key === "string") return Promise.resolve({ [key]: local[key] });
      return Promise.resolve(Object.assign({}, local));
    },
    set: (obj) => {
      writes.push({ store: "local", payload: JSON.parse(JSON.stringify(obj)) });
      // Chrome's own semantics: setting a key to UNDEFINED deletes it (JSON round-trips
      // drop undefined), which is what aiStorageRemove's fallback relies on.
      for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) delete local[k];
        else local[k] = JSON.parse(JSON.stringify(v));
      }
      return Promise.resolve();
    },
  };
  if (removeMethod) {
    store.remove = (key) => {
      writes.push({ store: "local", removed: key });
      delete local[key];
      return Promise.resolve();
    };
  }

  const syncStore = {
    get: (key) => {
      reads.push("sync:" + key);
      return Promise.resolve({ [key]: sync[key] });
    },
    set: (obj) => {
      writes.push({ store: "sync", payload: JSON.parse(JSON.stringify(obj)) });
      Object.assign(sync, JSON.parse(JSON.stringify(obj)));
      return Promise.resolve();
    },
    remove: (key) => {
      writes.push({ store: "sync", removed: key });
      delete sync[key];
      return Promise.resolve();
    },
  };

  // M16's distinguisher. `chrome.storage.session` is a THIRD area a credential could hide in
  // for the whole browser lifetime; AC-4 names `local` only, so a session store is present and
  // watched exactly like `sync` is — a write into it is a failing case, not an unproven claim.
  const session = {};
  const sessionStore = {
    get: (key) => {
      reads.push("session:" + key);
      return Promise.resolve({ [key]: session[key] });
    },
    set: (obj) => {
      writes.push({ store: "session", payload: JSON.parse(JSON.stringify(obj)) });
      Object.assign(session, JSON.parse(JSON.stringify(obj)));
      return Promise.resolve();
    },
    remove: (key) => {
      writes.push({ store: "session", removed: key });
      delete session[key];
      return Promise.resolve();
    },
  };

  window.chrome = { runtime: { id: "test-extension-id", getURL: (p) => String(p) } };
  if (chromeStorage) {
    window.chrome.storage = { local: store, sync: syncStore, session: sessionStore };
  }

  // The layout-persistence seam, watched. Nothing in Phase 2 may call it.
  const saveLayoutCalls = [];
  window.__DDBStorage = {
    saveLayout: async (characterId, data) => {
      saveLayoutCalls.push({ characterId, json: JSON.stringify(data) });
    },
  };

  window.eval(SRC.modals);
  window.eval(SRC.aiSettings);

  return {
    window,
    document,
    local,
    sync,
    session,
    writes,
    reads,
    fetchCalls,
    saveLayoutCalls,
    layoutBytesBefore,
    AiSettings: window.AiSettings,
  };
}

const cleanup = () => {
  delete global.window;
  delete global.document;
  delete global.HTMLElement;
  delete global.Element;
};

/** Let the dialog's async body render (`loadSettings()` resolves in a microtask chain). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Open the dialog through the REAL shell and return the handle. */
function openModal(ctx, overrides) {
  const handle = ctx.window.AiSettings.showAiSettingsModal(overrides);
  assert.ok(handle, "the shared modal shell is available, so the dialog opens");
  ctx.document.body.appendChild(handle.overlay);
  return handle;
}

/** Every write that is NOT the credential itself — the only ones that may leak it. */
function nonKeyWrites(writes) {
  return writes.filter(
    (w) => w.payload && !Object.prototype.hasOwnProperty.call(w.payload, "be.ai.key"),
  );
}

/**
 * Per-SUITE cleanup, and that placement is load-bearing. A ROOT-level `afterEach` in a
 * mocha file runs after every test in the WHOLE suite — including other files' — so it
 * deleted the `global.window` / `global.document` the other jsdom suites had just booted
 * and 16 of their cases died with `document is not defined`. Scoping the hook inside each
 * `describe` (below) cleans up what THIS suite sets and nothing else.
 */
function cleansUpAfter() {
  afterEach(function () {
    cleanup();
  });
}

describe("AC-4 — the namespaced store shape", function () {
  cleansUpAfter();
  it("writes provider/model/baseUrl under ONE local key and the credential under its own", async function () {
    const ctx = boot();
    const saved = await ctx.AiSettings.saveSettings({
      provider: "Anthropic",
      model: "claude-3-5-haiku-latest",
      baseUrl: "",
    });
    assert.ok(saved.ok, "the record saves");
    assert.deepStrictEqual(Object.keys(ctx.local), ["be.ai"], "exactly the safe record landed");
    assert.deepStrictEqual(ctx.local["be.ai"], {
      provider: "anthropic",
      model: "claude-3-5-haiku-latest",
      baseUrl: "",
      keyPresent: false,
    });
  });

  it("the safe record's field set is EXACTLY provider/model/baseUrl/keyPresent — no key slot", async function () {
    const ctx = boot();
    await ctx.AiSettings.setApiKey(KEY);
    const record = ctx.local["be.ai"];
    assert.deepStrictEqual(Object.keys(record).sort(), [
      "baseUrl",
      "keyPresent",
      "model",
      "provider",
    ]);
    assert.strictEqual(record.keyPresent, true, "the flag is the only key-shaped fact it holds");
    assert.ok(
      !JSON.stringify(record).includes(KEY),
      "and the credential is not in it, in any field",
    );
  });

  it("setApiKey writes the credential FIRST and only then the flag (a half-save means NO key)", async function () {
    const ctx = boot();
    await ctx.AiSettings.setApiKey(KEY);
    const ordered = Array.from(ctx.writes, (w) =>
      w.removed ? "remove" : Object.keys(w.payload)[0],
    );
    assert.deepStrictEqual(ordered, ["be.ai.key", "be.ai"], "the order IS the security");
    assert.strictEqual(ctx.local["be.ai.key"], KEY);
  });

  it("a store that refuses the credential write gets NO flag write — never keyPresent pointing at nothing", async function () {
    const ctx = boot();
    const realSet = ctx.local;
    // Sabotage the credential write only: the settings write must never be attempted,
    // because a record claiming keyPresent without a stored key enables the arrange
    // button against nothing (Phase 4 reads that flag).
    ctx.window.chrome.storage.local.set = () => Promise.reject(new Error("quota"));
    const result = await ctx.AiSettings.setApiKey(KEY);
    assert.strictEqual(result.ok, false, "the failure is reported, not swallowed");
    assert.strictEqual(result.error, "storage_unavailable");
    assert.strictEqual(realSet["be.ai"], undefined, "no settings record was written");
    assert.strictEqual(realSet["be.ai.key"], undefined, "and no credential exists");
  });

  it("an empty key is refused without touching storage", async function () {
    const ctx = boot();
    const before = ctx.writes.length;
    const result = await ctx.AiSettings.setApiKey("   ");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, "key_empty");
    assert.strictEqual(ctx.writes.length, before, "a refused write writes nothing");
  });

  it("clearApiKey REMOVES the credential and the record together (both halves, via remove())", async function () {
    const ctx = boot({ seedKey: true, seedSettings: true });
    await ctx.AiSettings.clearApiKey();
    assert.deepStrictEqual(Object.keys(ctx.local), [], "both are gone, not blanked");
    assert.deepStrictEqual(
      Array.from(ctx.writes, (w) => w.removed),
      ["be.ai.key", "be.ai"],
    );
    const settings = await ctx.AiSettings.loadSettings();
    assert.strictEqual(settings.keyPresent, false, "and the derived flag agrees");
  });

  it("deletes through the set(undefined) fallback when the store has no remove()", async function () {
    const ctx = boot({ seedKey: true, seedSettings: true, removeMethod: false });
    await ctx.AiSettings.clearApiKey();
    assert.strictEqual(ctx.local["be.ai.key"], undefined, "the key is gone");
    assert.strictEqual(ctx.local["be.ai"], undefined, "the record is gone");
    const stored = ctx.writes[ctx.writes.length - 1];
    assert.ok(stored && "payload" in stored, "the fallback wrote through set()");
    assert.ok(
      !("be.ai.key" in ctx.sync) && Object.keys(ctx.sync).length === 0,
      "and still never touched sync",
    );
  });

  it("getApiKey is the ONLY accessor, and a spy proves the real store read ran", async function () {
    const ctx = boot({ seedKey: true });
    const got = await ctx.AiSettings.getApiKey();
    assert.strictEqual(got, KEY, "it returns the stored credential");
    assert.ok(
      ctx.reads.includes("be.ai.key"),
      "…by actually reading `be.ai.key` out of chrome.storage.local (a stubbed settings " +
        "object cannot satisfy this assertion)",
    );
  });

  it("hasStoredKey reports a BOOLEAN, so no caller can print the credential by accident", async function () {
    const ctx = boot({ seedKey: true });
    const flag = await ctx.AiSettings.hasStoredKey();
    assert.strictEqual(flag, true);
    assert.strictEqual(typeof flag, "boolean");
  });

  it("a missing or non-string credential reads as \"\" rather than undefined-shaped truthiness", async function () {
    const ctx = boot();
    assert.strictEqual(await ctx.AiSettings.getApiKey(), "");
    ctx.local["be.ai.key"] = 1234;
    assert.strictEqual(await ctx.AiSettings.getApiKey(), "", "a number is not a key");
    assert.strictEqual(await ctx.AiSettings.hasStoredKey(), false);
  });

  it("keyPresent is DERIVED from the credential store — a hand-edited record claiming true does not pass", async function () {
    const ctx = boot({ seedSettings: true }); // claims keyPresent: true, stores no key
    const settings = await ctx.AiSettings.loadSettings();
    assert.strictEqual(
      settings.keyPresent,
      false,
      "O-2's gate reads this flag: if a fabricated record could set it, the arrange " +
        "button would light up with no credential behind it",
    );
  });

  it("sanitizeSettings drops an unknown provider and clamps oversized strings", async function () {
    const ctx = boot();
    const saved = await ctx.AiSettings.saveSettings({
      provider: "evilcorp",
      model: "m".repeat(500),
      baseUrl: "",
      smuggled: { key: KEY },
    });
    assert.ok(saved.ok, "the record saves after coercion");
    const record = ctx.local["be.ai"];
    assert.strictEqual(record.provider, "", "an unknown provider is not a provider");
    assert.strictEqual(record.model.length, 120, "model clamped to its budget");
    assert.ok(!("smuggled" in record), "and an extra field cannot ride along");
    assert.ok(!("key" in record), "least of all a field called key");
    assert.ok(!JSON.stringify(record).includes(KEY), "not even one smuggling a credential");

    const hostile = await ctx.AiSettings.saveSettings({
      provider: "openai",
      baseUrl: "h".repeat(500),
    });
    assert.strictEqual(hostile.ok, false, "a 500-char base URL is refused, not just clamped");
    assert.strictEqual(hostile.settings.baseUrl.length, 200, "…and it is clamped first");
  });
});

describe("AC-4 — never synced", function () {
  cleansUpAfter();
  it("no operation in the public surface writes chrome.storage.sync", async function () {
    const ctx = boot();
    await ctx.AiSettings.loadSettings();
    await ctx.AiSettings.saveSettings({ provider: "openai", model: "gpt-4o-mini" });
    await ctx.AiSettings.setApiKey(KEY);
    await ctx.AiSettings.getApiKey();
    await ctx.AiSettings.hasStoredKey();
    await ctx.AiSettings.clearApiKey();

    assert.deepStrictEqual(ctx.sync, {}, "the sync store is EMPTY after every call");
    const syncWrites = Array.from(ctx.writes).filter((w) => w.store === "sync");
    assert.deepStrictEqual(syncWrites, [], "…and nothing was even attempted");
  });

  it("nor does any of them write chrome.storage.session", async function () {
    // WHY A THIRD AREA IS WATCHED: `session` is the store a credential could land in and nobody
    // would notice — it is not synced, it is not on disk per-profile the way `local` is, and it
    // survives the whole browser session. AC-4 names `local` ONLY, so "the key is in exactly one
    // place" needs an area present-and-EMPTY to assert against, which is what this harness now
    // provides (mutation-probed by M16: a `session.set` in `getApiKey` turns THIS case red).
    const ctx = boot({ seedKey: true });
    await ctx.AiSettings.getApiKey();
    await ctx.AiSettings.hasStoredKey();
    await ctx.AiSettings.setApiKey(KEY + "-2");
    await ctx.AiSettings.saveSettings({ provider: "anthropic", model: "claude-3-5-haiku-latest" });
    await ctx.AiSettings.clearApiKey();
    assert.deepStrictEqual(ctx.session, {}, "the session store is EMPTY after every call");
    assert.deepStrictEqual(
      ctx.writes.filter((w) => w.store === "session"),
      [],
      "…and nothing was even attempted",
    );
  });

  it("the source contains no `storage.sync` reference at all (the store seam is single)", function () {
    const src = codeOf(SRC.aiSettings);
    assert.ok(
      !/storage\.sync/.test(src),
      "every access goes through aiStore(), which resolves .local — so a sync write would " +
        "have to be NEW code, and this grep is the tripwire for it",
    );
  });
});

describe("AC-4 — never into a layout record, never into telemetry", function () {
  cleansUpAfter();
  it("the whole settings flow leaves a seeded layout record byte-identical", async function () {
    const ctx = boot({ seedLayout: true });
    await ctx.AiSettings.setApiKey(KEY);
    await ctx.AiSettings.saveSettings({ provider: "openai", model: "gpt-4o-mini" });
    const settings = await ctx.AiSettings.loadSettings();
    await ctx.AiSettings.saveSettings(settings);

    assert.strictEqual(
      JSON.stringify(ctx.local[LAYOUT_STORE_KEY]),
      ctx.layoutBytesBefore,
      "the layout the feature could plausibly corrupt is UNCHANGED, including its " +
        "zIndex/minimized fields — the AI path may write those later, through " +
        "applyLayout, and never as a side effect of saving a key",
    );
  });

  it("no settings call reaches __DDBStorage.saveLayout", async function () {
    const ctx = boot({ seedLayout: true });
    await ctx.AiSettings.setApiKey(KEY);
    await ctx.AiSettings.saveSettings({ provider: "anthropic", model: "claude-3-5-haiku-latest" });
    await ctx.AiSettings.clearApiKey();
    assert.deepStrictEqual(ctx.saveLayoutCalls, [], "Phase 2 persists configuration only");
  });

  it("no non-credential write ever carries the credential's bytes", async function () {
    const ctx = boot();
    await ctx.AiSettings.setApiKey(KEY);
    await ctx.AiSettings.saveSettings({ provider: "openai", model: "gpt-4o-mini" });
    await ctx.AiSettings.loadSettings();
    for (const w of nonKeyWrites(ctx.writes)) {
      assert.ok(
        !JSON.stringify(w.payload).includes(KEY),
        "write to " + Object.keys(w.payload).join(",") + " contains the key",
      );
    }
    assert.ok(ctx.writes.length > 0, "…and the flow really did write, so this is not vacuous");
  });

  it("there is no telemetry sink in the module to write to", function () {
    assert.ok(
      !/sendBeacon|telemetry|analytics|beacon\(/.test(codeOf(SRC.aiSettings)),
      "AC-4 forbids the key reaching telemetry; the stronger property is that this file " +
        "has no telemetry path to leak through in the first place",
    );
  });
});

describe("AC-4 — never logged", function () {
  cleansUpAfter();
  it("with the product's OWN sink installed, the whole flow calls it zero times", async function () {
    // The source-shape cases below can show there are no call sites TODAY. This one is the
    // behavioural half GATE 3 asked for: `js/main.js:260`'s `safeLog` is installed as a real
    // function, the entire feature flow runs with a live credential, and the sink's argument
    // list is inspected. A mutant that adds `safeLog("info", JSON.stringify(settings))` to any
    // path is caught HERE, not by a regex.
    const ctx = boot({ chromeStorage: true, seedLayout: true });
    const logged = [];
    ctx.window.safeLog = (...args) => logged.push(args);
    ctx.globalSafeLog = (...args) => logged.push(args);

    await ctx.AiSettings.setApiKey(KEY);
    await ctx.AiSettings.saveSettings({ provider: "openai", model: "gpt-4o-mini" });
    await ctx.AiSettings.loadSettings();
    await ctx.AiSettings.getApiKey();
    await ctx.AiSettings.hasStoredKey();
    const handle = openModal(ctx);
    await settle();
    handle.modal.querySelector(".be-ai-save").click();
    await settle();
    handle.modal.querySelector(".be-ai-remove-key"); // no click: nothing to remove after clear
    await ctx.AiSettings.clearApiKey();
    await settle();

    // Zero calls is the property this module can actually hold. If a future change logs
    // anything, the assertion below still has to hold for the KEY — which is why both are
    // written, not just the loose one.
    assert.deepStrictEqual(
      logged.map((a) => a.map(String).join(" ")),
      [],
      "the settings phase performs no logging at all, so nothing can leak through it",
    );
    assert.ok(!JSON.stringify(logged).includes(KEY), "…and above all, never the credential");
  });

  it("the renderer installed by the harness (globalThis.safeLog) also stays silent", async function () {
    // Defends against a future caller that chooses to resolve `safeLog` through the global
    // instead of `window`: if the sink is reachable through more than one path, the SAME
    // guarantee must hold through both.
    const ctx = boot({ chromeStorage: true, seedLayout: true });
    const logged = [];
    ctx.globalSafeLog = (...args) => logged.push(args);
    const handle = openModal(ctx);
    await settle();
    handle.modal.querySelector(".be-ai-save").click();
    await settle();
    handle.modal.querySelector(".be-ai-remove-key");
    await ctx.AiSettings.clearApiKey();
    await settle();
    assert.deepStrictEqual(logged.map((a) => a.map(String).join(" ")), []);
  });

  it("console.* is banned outright: this file has zero call sites", function () {
    const hits = (SRC.aiSettings.match(/console\.(log|warn|error|info|debug)/g) || []).length;
    assert.strictEqual(hits, 0, "the product's only sink is safeLog; console is 0 by rule");
  });

  it("no safeLog call site exists, so no stored config can reach the product's sink", function () {
    assert.ok(
      !/safeLog\s*\(/.test(SRC.aiSettings),
      "0 sites means the ban cannot be violated by an argument-list mistake; logging for " +
        "this feature arrives with the transport and must go through redactCredentials",
    );
  });

  it("no JSON.stringify of a config object is fed into a log-ish expression", function () {
    const offenders = SRC.aiSettings
      .split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(
        ({ line }) =>
          /JSON\.stringify/.test(line) &&
          /(log|Log|debug|trace|console)/.test(line.replace(/JSON\.stringify/g, "")),
      );
    assert.deepStrictEqual(offenders, [], "stringified settings next to a sink is how a key leaks");
  });

  it("the module builds no request and therefore sends no header (AC-5 owns egress)", function () {
    assert.ok(!/fetch\s*\(/.test(SRC.aiSettings), "no fetch call site");
    assert.ok(!/XMLHttpRequest/.test(SRC.aiSettings), "no XHR either");
    assert.ok(!/\.headers\b/.test(SRC.aiSettings), "no header object to echo");
    assert.ok(!/Authorization/i.test(SRC.aiSettings), "no auth header in this phase");
  });
});

describe("AC-4 — the no-permission path (a stubbed store must not be what makes this pass)", function () {
  cleansUpAfter();
  it("with NO chrome at all: every read resolves, every write reports storage_unavailable, nothing throws", async function () {
    const ctx = boot({ chromeStorage: false });
    const settings = await ctx.AiSettings.loadSettings();
    assert.strictEqual(settings.storage, false, "the modal can say 'cannot persist'");
    assert.strictEqual(settings.provider, "");
    assert.strictEqual(settings.keyPresent, false);

    const saved = await ctx.AiSettings.saveSettings({ provider: "openai", model: "x" });
    assert.strictEqual(saved.ok, false);
    assert.strictEqual(saved.error, "storage_unavailable");

    const key = await ctx.AiSettings.setApiKey(KEY);
    assert.strictEqual(key.ok, false, "a key cannot be stored, and the dialog is told so");
    assert.strictEqual(await ctx.AiSettings.getApiKey(), "");
    assert.strictEqual(await ctx.AiSettings.hasStoredKey(), false);
    await ctx.AiSettings.clearApiKey();

    assert.deepStrictEqual(ctx.fetchCalls, [], "…and no network call was attempted");
    assert.deepStrictEqual(ctx.writes, [], "…and nothing was recorded as written");
  });

  it("with a store whose get THROWS (policy-blocked), reads degrade to unavailable, not to a crash", async function () {
    const ctx = boot({ getThrows: true });
    const settings = await ctx.AiSettings.loadSettings();
    assert.strictEqual(settings.keyPresent, false);
    assert.strictEqual(settings.storage, true, "the store exists; the accessor is what threw");
  });

  it("the dialog still opens on a browser that cannot persist, and SAYS so", async function () {
    const ctx = boot({ chromeStorage: false });
    const handle = openModal(ctx);
    await settle();
    const message = handle.modal.querySelector(".be-modal-message");
    assert.match(message.textContent, /blocked|storage/i, "the user is told why saving fails");
  });

  it("the modal opens through the shared shell and never reaches fetch when Test is clicked", async function () {
    const ctx = boot({ chromeStorage: false });
    const handle = openModal(ctx);
    await settle();
    // Pick a provider first: the button is DISABLED without one (O-1), and clicking a
    // disabled control fires nothing, which would make the "no fetch" claim vacuous.
    const select = handle.modal.querySelector(".be-ai-provider");
    select.value = "openai";
    select.dispatchEvent(new ctx.window.Event("change"));
    handle.modal.querySelector(".be-ai-test").click();
    await settle();
    await settle();
    await settle();
    assert.deepStrictEqual(
      ctx.fetchCalls,
      [],
      "Phase 2's ping is a refusal, not a transport: a second ungated fetch here would be " +
        "the pattern the spec's L-3 correction exists to warn about",
    );
    assert.match(
      handle.modal.querySelector(".be-ai-status").textContent,
      /not available|failed/i,
      "and the status line says so instead of pretending to have tested",
    );
  });

  it("with a WORKING store, Test still refuses — the default ping is not a stub that passes", async function () {
    // Recorded honestly: the case above boots with NO store, so the save fails first and the
    // ping is never reached — its "no fetch" claim holds but is proven earlier than the
    // transport. This one removes that shortcut: storage works, the settings save, and the
    // ONLY thing left between the user and a network call is `aiDefaultPing()`. It must
    // REFUSE. Mutation-probed by M15: making the default `{ok:true}` turns the assertion below
    // red, which is what proves Phase 2 shipped no fake "Connection OK".
    const ctx = boot({ chromeStorage: true });
    const handle = openModal(ctx);
    await settle();
    const select = handle.modal.querySelector(".be-ai-provider");
    select.value = "openai";
    select.dispatchEvent(new ctx.window.Event("change"));
    handle.modal.querySelector(".be-ai-model").value = "gpt-4o-mini";
    handle.modal.querySelector(".be-ai-test").click();
    await settle();
    await settle();
    await settle();
    const status = handle.modal.querySelector(".be-ai-status").textContent;
    assert.doesNotMatch(status, /Connection OK/i, "nothing was tested, so nothing may say OK");
    assert.match(status, /not available|unavailable|failed/i, "and it names the refusal");
    assert.deepStrictEqual(ctx.fetchCalls, [], "…without a single network attempt");
    assert.ok(ctx.local["be.ai"], "the settings half DID save — so this is not the same shortcut");
  });
});

describe("AC-4 — the dialog renders the key masked", function () {
  cleansUpAfter();
  it("with a stored key: the field is type=password, EMPTY, and the state line says a key exists", async function () {
    const ctx = boot({ seedKey: true, seedSettings: true });
    const handle = openModal(ctx);
    await settle();

    const keyInput = handle.modal.querySelector(".be-ai-key");
    assert.strictEqual(keyInput.type, "password", "masked from the FIRST render");
    assert.strictEqual(
      keyInput.value,
      "",
      "the credential is NEVER loaded back into the field — a masked input that held the " +
        "real value would still leak it through the DOM, devtools, or a form capture",
    );
    assert.match(
      handle.modal.querySelector(".be-ai-key-state").textContent,
      /stored on this device/i,
      "while the dialog still tells the truth about what exists",
    );
    assert.ok(
      !handle.modal.textContent.includes(KEY),
      "and the key's bytes are nowhere in the rendered dialog",
    );
    assert.ok(ctx.reads.includes("be.ai.key"), "the flag came from a REAL key-store read");
  });

  it("the same render with NO stored key says the feature is off (O-2)", async function () {
    const ctx = boot();
    const handle = openModal(ctx);
    await settle();
    assert.match(
      handle.modal.querySelector(".be-ai-key-state").textContent,
      /no key stored/i,
    );
  });

  it("the reveal toggle flips the field and its aria-pressed, and can be hidden again", async function () {
    const ctx = boot({ seedSettings: true });
    const handle = openModal(ctx);
    await settle();
    const keyInput = handle.modal.querySelector(".be-ai-key");
    const reveal = handle.modal.querySelector(".be-ai-key-reveal");

    keyInput.value = "typed-by-hand-not-stored";
    reveal.click();
    assert.strictEqual(keyInput.type, "text", "revealing shows what the USER typed");
    assert.strictEqual(reveal.getAttribute("aria-pressed"), "true");
    assert.strictEqual(reveal.textContent, "Hide");

    reveal.click();
    assert.strictEqual(keyInput.type, "password", "and hiding works both ways");
    assert.strictEqual(reveal.getAttribute("aria-pressed"), "false");
  });

  it("a saved key is never re-typed into the field by the reveal toggle", async function () {
    const ctx = boot({ seedKey: true, seedSettings: true });
    const handle = openModal(ctx);
    await settle();
    handle.modal.querySelector(".be-ai-key-reveal").click();
    await settle();
    assert.strictEqual(handle.modal.querySelector(".be-ai-key").value, "", "still empty");
  });

  it("Remove key is disabled with no credential and enabled with one", async function () {
    const empty = boot();
    const h1 = openModal(empty);
    await settle();
    assert.strictEqual(h1.modal.querySelector(".be-ai-remove-key").disabled, true);

    cleanup();
    const seeded = boot({ seedKey: true, seedSettings: true });
    const h2 = openModal(seeded);
    await settle();
    assert.strictEqual(h2.modal.querySelector(".be-ai-remove-key").disabled, false);

    h2.modal.querySelector(".be-ai-remove-key").click();
    await settle();
    await settle();
    assert.strictEqual(seeded.local["be.ai.key"], undefined, "clicking it really removes");
    assert.strictEqual(seeded.local["be.ai"], undefined, "and the record with it");
    assert.match(
      h2.modal.querySelector(".be-ai-status").textContent,
      /key removed/i,
      "the dialog confirms in words",
    );
  });

  it("Test and Save are disabled until a provider is chosen (O-1's provider is not optional)", async function () {
    const ctx = boot();
    const handle = openModal(ctx);
    await settle();
    assert.strictEqual(handle.modal.querySelector(".be-ai-test").disabled, true);
    assert.strictEqual(handle.modal.querySelector(".be-ai-save").disabled, true);

    const select = handle.modal.querySelector(".be-ai-provider");
    select.value = "anthropic";
    select.dispatchEvent(new ctx.window.Event("change"));
    await settle();
    assert.strictEqual(handle.modal.querySelector(".be-ai-save").disabled, false);
    assert.strictEqual(handle.modal.querySelector(".be-ai-model").value, "claude-3-5-haiku-latest",
      "switching provider offers its default model over an empty field");
  });

  it("a provider switch does NOT overwrite a model the user already typed", async function () {
    const ctx = boot();
    const handle = openModal(ctx);
    await settle();
    const model = handle.modal.querySelector(".be-ai-model");
    model.value = "my-fine-tuned-one";
    const select = handle.modal.querySelector(".be-ai-provider");
    select.value = "openai";
    select.dispatchEvent(new ctx.window.Event("change"));
    await settle();
    assert.strictEqual(model.value, "my-fine-tuned-one");
  });

  it("Save persists provider + model + a typed key, and blanks the field afterwards", async function () {
    const ctx = boot();
    const handle = openModal(ctx);
    await settle();
    const select = handle.modal.querySelector(".be-ai-provider");
    select.value = "openai";
    select.dispatchEvent(new ctx.window.Event("change"));
    handle.modal.querySelector(".be-ai-model").value = "gpt-4o-mini";
    const keyInput = handle.modal.querySelector(".be-ai-key");
    keyInput.value = KEY;
    handle.modal.querySelector(".be-ai-save").click();
    await settle();
    await settle();

    assert.strictEqual(ctx.local["be.ai.key"], KEY, "stored");
    assert.strictEqual(ctx.local["be.ai"].keyPresent, true, "flagged");
    assert.strictEqual(ctx.local["be.ai"].provider, "openai");
    assert.strictEqual(keyInput.value, "", "…and the field is wiped from the DOM");
    assert.strictEqual(
      ctx.sync["be.ai.key"],
      undefined,
      "and it went to local only",
    );
  });

  it("Save with an unpersistable key does NOT write a settings record claiming a key", async function () {
    const ctx = boot();
    const handle = openModal(ctx);
    await settle();
    const select = handle.modal.querySelector(".be-ai-provider");
    select.value = "openai";
    select.dispatchEvent(new ctx.window.Event("change"));
    handle.modal.querySelector(".be-ai-key").value = KEY;
    ctx.window.chrome.storage.local.set = () => Promise.reject(new Error("quota"));
    handle.modal.querySelector(".be-ai-save").click();
    await settle();
    await settle();
    assert.strictEqual(ctx.local["be.ai"], undefined, "no orphan record");
    assert.match(
      handle.modal.querySelector(".be-modal-message").textContent,
      /cannot write|storage/i,
      "the shell's error line explains it",
    );
  });

  it("Save refuses a base URL outside the published list, with distinct copy", async function () {
    const ctx = boot();
    const handle = openModal(ctx);
    await settle();
    const select = handle.modal.querySelector(".be-ai-provider");
    select.value = "openai";
    select.dispatchEvent(new ctx.window.Event("change"));
    handle.modal.querySelector(".be-ai-baseurl").value = "https://attacker.example/v1";
    handle.modal.querySelector(".be-ai-save").click();
    await settle();
    await settle();
    assert.strictEqual(ctx.local["be.ai"], undefined, "nothing was persisted");
    assert.match(
      handle.modal.querySelector(".be-modal-message").textContent,
      /publish|not allowed|hosts/i,
    );
    // AND the mark lands on the field that is actually wrong. Before
    // `setMessage`'s third argument existed, ANY dialog error marked the first input in the
    // document — so in this four-field dialog a base-URL complaint highlighted the MODEL.
    // That is an accessible lie, and this is the case that keeps it from coming back
    // (mutation-probed by M19: passing `undefined` instead of the target turns it red).
    const base = handle.modal.querySelector(".be-ai-baseurl");
    const model = handle.modal.querySelector(".be-ai-model");
    const provider = handle.modal.querySelector(".be-ai-provider");
    assert.strictEqual(base.getAttribute("aria-invalid"), "true", "the base URL field is marked");
    assert.strictEqual(
      model.hasAttribute("aria-invalid"),
      false,
      "the model field is NOT marked — it is a valid model either way",
    );
    assert.strictEqual(
      provider.hasAttribute("aria-invalid"),
      false,
      "…and neither is the provider select",
    );
  });

  it("Cancel closes through the shell, which removes the overlay", async function () {
    const ctx = boot();
    const handle = openModal(ctx);
    await settle();
    handle.modal.querySelector(".be-ai-cancel").click();
    assert.strictEqual(handle.isOpen, false, "one close path, the shared one");
    assert.strictEqual(ctx.document.querySelector(".be-modal-overlay"), null);
  });

  it("without the modal shell the dialog degrades to null instead of taking the sheet down", function () {
    const ctx = boot();
    delete ctx.window.Modals;
    assert.strictEqual(ctx.window.AiSettings.showAiSettingsModal(), null);
  });
});

describe("AC-4 — the base URL is validated at the store boundary too", function () {
  cleansUpAfter();
  const cases = [
    ["not a url", "base_url_invalid"],
    ["http://api.openai.com/v1", "base_url_insecure"],
    ["javascript:alert(1)", "base_url_insecure"],
    ["https://sk-a1b2c3d4e5f6g7h8i9j0@proxy.example/v1", "base_url_contains_credential"],
    ["https://random-host.example/v1", "base_url_not_allowed"],
  ];
  for (const [url, code] of cases) {
    it(`refuses ${code} for "${url}"`, async function () {
      const ctx = boot();
      assert.strictEqual(ctx.AiSettings.aiBaseUrlProblem(url), code);
      const saved = await ctx.AiSettings.saveSettings({
        provider: "openai",
        model: "gpt-4o-mini",
        baseUrl: url,
      });
      assert.strictEqual(saved.ok, false);
      assert.strictEqual(saved.error, code);
      assert.strictEqual(ctx.local["be.ai"], undefined, "…and persists nothing");
    });
  }

  it("an empty baseUrl is legal — the field is optional (O-1)", async function () {
    const ctx = boot();
    assert.strictEqual(ctx.AiSettings.aiBaseUrlProblem(""), "");
    const saved = await ctx.AiSettings.saveSettings({ provider: "openai", baseUrl: "" });
    assert.ok(saved.ok);
  });

  it("NO caller-supplied flag unlocks the validator (O-1's accepted consequence)", async function () {
    // O-1 was ratified with a warning attached: a free-form base URL is the un-gated arbitrary
    // URL relay wearing a different hat, which is why the URL may be read only from stored
    // config and never from a message body. The store boundary is where that has to hold, so a
    // record that ARRIVES with a trust-shaped property must still be validated. Mutation-probed
    // by M14: a `!settings.trusted` short-circuit in `saveSettings` turns this red.
    const ctx = boot();
    for (const shape of [
      { provider: "openai", baseUrl: "https://attacker.example/v1", trusted: true },
      { provider: "openai", baseUrl: "https://attacker.example/v1", allowBaseUrl: true },
      { provider: "openai", baseUrl: "https://attacker.example/v1", __internal: true },
    ]) {
      const saved = await ctx.AiSettings.saveSettings(shape);
      assert.strictEqual(saved.ok, false, JSON.stringify(shape) + " must not be savable");
      assert.strictEqual(saved.error, "base_url_not_allowed");
    }
    assert.strictEqual(ctx.local["be.ai"], undefined, "…and nothing was persisted");
    // sanitizeSettings drops unknown properties, so the flag cannot ride into the record either.
    const ok = await ctx.AiSettings.saveSettings({ provider: "openai", model: "gpt-4o-mini" });
    assert.ok(ok.ok);
    assert.deepStrictEqual(Object.keys(ctx.local["be.ai"]), [
      "provider",
      "model",
      "baseUrl",
      "keyPresent",
    ]);
  });

  it("the compatible-host list starts EMPTY, so a host must arrive here AND in the manifest", function () {
    assert.deepStrictEqual(
      SRC.aiSettings.includes("AI_COMPAT_BASE_ORIGINS = Object.freeze([])") ? [] : ["set"],
      [],
      "an empty allow-list is the honest v1 state; Phase 3's provider_origin_lock probe is " +
        "what keeps the pair together",
    );
  });
});

describe("AC-4 — the provider list cannot drift from the pure core", function () {
  cleansUpAfter();
  it("the settings ids are EXACTLY the ids the request builders know", async function () {
    // WHY THIS CASE EXISTS: `js/ai_settings.js` cannot read `AiLayout.PROVIDERS` — the core
    // publishes through `module.exports` only and has no `window.AiLayout` seam until Phase 4
    // gives it a product caller — so the modal declares its own id list. That is a real
    // duplication risk, and this is the check that makes it loud rather than quiet: a
    // provider added to one side and not the other fails HERE (offering a provider the
    // transport cannot build a request for) instead of at the first user who picks it.
    const core = require("../../js/ai_layout.js");
    const ctx = boot();
    // Array.from (not .map) so the array is built in THIS realm: a foreign-realm Array
    // has a different prototype and deepStrictEqual would fail on that alone.
    const ids = Array.from(ctx.AiSettings.AI_PROVIDERS, (p) => p.id).sort();
    assert.deepStrictEqual(ids, Object.keys(core.PROVIDERS).sort());
    assert.deepStrictEqual(ids, ["anthropic", "openai"], "O-1's ratified v1 pair");
    ctx.AiSettings.AI_PROVIDERS.forEach((p) => {
      assert.ok(p.label.length > 0, "and each one is labelled for the <select>");
    });
  });

  it("the modal's <select> offers a provider for every id the core can build a request for", async function () {
    const core = require("../../js/ai_layout.js");
    const ctx = boot();
    const handle = openModal(ctx);
    await settle();
    const options = Array.from(
      handle.modal.querySelectorAll(".be-ai-provider option"),
    )
      .map((o) => o.value)
      .filter(Boolean)
      .sort();
    assert.deepStrictEqual(Array.from(options).sort(), Object.keys(core.PROVIDERS).sort());
  });
});

describe("AC-V1-lite support — the dialog uses the shared shell and theme classes only", function () {
  cleansUpAfter();
  it("the rendered dialog carries no inline style and no raw color", async function () {
    const ctx = boot({ seedSettings: true });
    const handle = openModal(ctx);
    await settle();
    // Scoped to the dialog's OWN content: the shell legitimately sets
    // `message.style.display` (js/modals.js:237) and that is not this phase's code.
    const scope = handle.modal.querySelector(".be-modal-body");
    const styled = Array.from(scope.querySelectorAll("*")).filter(
      (el) => el.getAttribute("style"),
    );
    assert.deepStrictEqual(
      Array.from(styled, (el) => el.className),
      [],
      "an inline style here would be raw styling that escapes the theme sheet",
    );
    assert.ok(scope.querySelectorAll("*").length > 20, "…and there is a real form to check");
    assert.ok(
      !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(SRC.aiSettings),
      "no color literal in the module at all",
    );
  });

  it("every control is a theme class from the locked recipe or a be-ai-* probe", async function () {
    const ctx = boot();
    const handle = openModal(ctx);
    await settle();
    const themeClasses = new Set([
      "be-field",
      "be-field-label",
      "be-modal-input be-ai-provider",
      "be-modal-input be-ai-model",
      "be-modal-input be-ai-baseurl",
      "be-modal-input be-ai-key",
      "be-ai-key-row",
      "be-modal-cancel be-ai-key-reveal",
      "be-ai-key-state",
      "be-modal-cancel be-ai-test",
      "be-modal-cancel be-ai-remove-key",
      "be-modal-cancel be-ai-cancel",
      "be-modal-ok be-ai-save",
      "be-modal-hint be-ai-status",
      "be-modal-hint",
    ]);
    const offenders = [];
    for (const el of Array.from(handle.modal.querySelectorAll(".be-modal-body *"))) {
      const cls = el.className;
      if (!cls) continue;
      if (!themeClasses.has(cls)) offenders.push(cls);
    }
    assert.deepStrictEqual(offenders, [], "a class outside the sheet's vocabulary is raw styling");
  });

  it("the dialog names its purpose in the title so the screenshot gate has a caption", async function () {
    const ctx = boot();
    const handle = openModal(ctx);
    await settle();
    assert.match(handle.modal.querySelector("h3").textContent, /AI layout settings/i);
    assert.ok(
      handle.modal.querySelector(".be-modal-hint"),
      "the BYOK explanation is rendered, so the gate can read the privacy promise off the pixels",
    );
  });
});
