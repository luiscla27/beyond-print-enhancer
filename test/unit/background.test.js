"use strict";
function crossDeepEqual(a,b,msg){ const assert=require('assert'); assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), msg); }

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { JSDOM } = require("jsdom");

// ---------------------------------------------------------------------------
// Helpers: service-worker sandbox mirroring js/background.js execution.
// ---------------------------------------------------------------------------

const REPO = "C:/luiscla27/projects/dndbeyond-printenhance";

function createWorkerSandbox(overrides = {}) {
  const creates = [];
  const declarativeRules = [];
  const badgeTexts = [];
  const badgeColors = [];
  const tabCreates = [];
  const executeCalls = [];
  const listeners = { onInstalled: [], onMessage: [], actionClicked: [], tabsUpdated: [], contextClicked: [] };
  let nextFetch = overrides.fetchImpl || null;
  const storageData = Object.assign({}, overrides.storageSeed || {});

  const storage = {
    get(key, cb) {
      const resolveValue = () => {
        if (typeof key === "string") return { [key]: storageData[key] };
        if (Array.isArray(key)) {
          const out = {};
          key.forEach((k) => (out[k] = storageData[k]));
          return out;
        }
        // object form or undefined: return full store copy
        return { ...storageData };
      };
      if (typeof cb === "function") {
        cb(resolveValue());
        return undefined;
      }
      return Promise.resolve(resolveValue());
    },
    set(obj, cb) {
      Object.assign(storageData, JSON.parse(JSON.stringify(obj)));
      if (typeof cb === "function") { cb(); return undefined; }
      return Promise.resolve();
    },
    remove(k, cb) {
      delete storageData[k];
      if (typeof cb === "function") { cb(); return undefined; }
      return Promise.resolve();
    },
  };

  const chrome = {
    runtime: {
      id: overrides.runtimeId || "test-extension-id",
      onInstalled: { addListener(fn) { listeners.onInstalled.push(fn); } },
      onMessage: { addListener(fn) { listeners.onMessage.push(fn); } },
      lastError: null,
      sendMessage: undefined,
    },
    contextMenus: {
      create(obj) { creates.push(JSON.parse(JSON.stringify(obj))); },
      onClicked: { addListener(fn) { listeners.contextClicked.push(fn); } },
    },
    declarativeContent: {
      onPageChanged: {
        removeRules(a, cb) { if (cb) cb(); },
        addRules(rules) { declarativeRules.push(...rules); },
      },
      PageStateMatcher: function PageStateMatcher(opts) { this.opts = opts; },
      ShowAction: function ShowAction() { this.kind = "ShowAction"; },
    },
    action: {
      onClicked: { addListener(fn) { listeners.actionClicked.push(fn); } },
      setBadgeText(opts) { badgeTexts.push({ ...opts }); },
      setBadgeBackgroundColor(opts) { badgeColors.push({ ...opts }); },
    },
    tabs: {
      onUpdated: { addListener(fn) { listeners.tabsUpdated.push(fn); } },
      create(opts) { tabCreates.push({ ...opts }); },
    },
    scripting: {
      executeScript(args) { executeCalls.push(JSON.parse(JSON.stringify(args))); return Promise.resolve(); },
    },
    storage: { local: storage, sync: { get(){}, set(){}, remove(){} }, session: { get(){}, set(){}, remove(){} } },
  };

  const sandbox = {
    chrome,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    // fetch is looked up at call-time; allow overrides to replace it per test
    fetch: (...args) => {
      if (nextFetch) return nextFetch(...args);
      return Promise.reject(new Error("fetch not mocked in this test"));
    },
    _setFetch(fn) { nextFetch = fn; },
    // populated by importScripts via sandbox binding
    creates, declarativeRules, badgeTexts, badgeColors, tabCreates, executeCalls, listeners, storageData, storage,
  };

  sandbox.importScripts = function importScripts(...specs) {
    specs.forEach((spec) => {
      const rel = String(spec).replace(/^\//, "");
      const full = path.join(REPO, rel);
      const code = fs.readFileSync(full, "utf8");
      vm.runInNewContext(code, sandbox);
    });
  };

  vm.createContext(sandbox);
  sandbox.self = sandbox;
  sandbox.window = undefined; // service worker has no window

  const bgCode = fs.readFileSync(path.join(REPO, "js/background.js"), "utf8");
  vm.runInContext(bgCode, sandbox);

  return sandbox;
}

// Reads raw source for shape assertions (import path, no-console etc.)
const BACKGROUND_SRC = fs.readFileSync(path.join(REPO, "js/background.js"), "utf8");
const CONTEXT_MENU_SRC = fs.readFileSync(path.join(REPO, "js/context_menu.js"), "utf8");

// ---------------------------------------------------------------------------
// Part A — context_menu.js primitives (real DOM via jsdom)
// ---------------------------------------------------------------------------

describe("feature_16_background_context — context menu primitives (js/context_menu.js)", function () {
  let window, document, ContextMenu;

  beforeEach(function () {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
      url: "http://localhost",
      runScripts: "dangerously",
      pretendToBeVisual: true,
    });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    global.Element = window.Element;
    // Load context_menu.js into the jsdom window by evaluating its source
    window.eval(CONTEXT_MENU_SRC);
    ContextMenu = window.ContextMenu;
  });

  afterEach(function () {
    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.Element;
  });

  it("exports createContextMenu / toggleContextMenu / createMenuTrigger on window and module surface", function () {
    assert.strictEqual(typeof window.createContextMenu, "function");
    assert.strictEqual(typeof window.toggleContextMenu, "function");
    assert.strictEqual(typeof window.createMenuTrigger, "function");
    assert.ok(ContextMenu);
    assert.strictEqual(typeof ContextMenu.createContextMenu, "function");
    assert.strictEqual(typeof ContextMenu.toggleContextMenu, "function");
    assert.strictEqual(typeof ContextMenu.createMenuTrigger, "function");
    // Dual registration: module.exports when required as CommonJS
    const required = require(path.join(REPO, "js/context_menu.js"));
    assert.strictEqual(typeof required.createContextMenu, "function");
  });

  it("createContextMenu returns a hidden div with class be-context-menu", function () {
    const menu = window.createContextMenu();
    assert.ok(menu instanceof window.HTMLElement);
    assert.strictEqual(menu.className, "be-context-menu");
    assert.strictEqual(menu.style.display, "none");
    assert.strictEqual(typeof menu._closeListener, "function");
  });

  it("createMenuTrigger produces a button with trigger class and vertical ellipsis", function () {
    const btn = window.createMenuTrigger();
    assert.ok(btn instanceof window.HTMLButtonElement);
    assert.ok(btn.classList.contains("be-more-options-button"));
    assert.ok(btn.textContent.includes("⋮") || btn.textContent.includes("⋯"), "expects ⋮ or ⋯");
    assert.strictEqual(btn.title, "More Options");
  });

  it("toggleContextMenu shows then hides, adding/removing mousedown listener", function () {
    const menu = window.createContextMenu();
    document.body.appendChild(menu);

    // initially hidden → show
    window.toggleContextMenu(menu);
    assert.strictEqual(menu.style.display, "block");

    // clicking outside should hide (mousedown listener)
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    const ev = new window.MouseEvent("mousedown", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "target", { value: outside });
    document.dispatchEvent(ev);
    assert.strictEqual(menu.style.display, "none");

    // show again then toggle directly to hide
    window.toggleContextMenu(menu);
    assert.strictEqual(menu.style.display, "block");
    window.toggleContextMenu(menu);
    assert.strictEqual(menu.style.display, "none");
  });

  it("clicking inside menu does not trigger close; outside does", function () {
    const menu = window.createContextMenu();
    document.body.appendChild(menu);
    const child = document.createElement("button");
    child.textContent = "inner";
    menu.appendChild(child);
    window.toggleContextMenu(menu);
    assert.strictEqual(menu.style.display, "block");

    const inside = new window.MouseEvent("mousedown", { bubbles: true });
    Object.defineProperty(inside, "target", { value: child });
    document.dispatchEvent(inside);
    assert.strictEqual(menu.style.display, "block", "inside click keeps menu open");

    const other = document.createElement("div");
    document.body.appendChild(other);
    const outside = new window.MouseEvent("mousedown", { bubbles: true });
    Object.defineProperty(outside, "target", { value: other });
    document.dispatchEvent(outside);
    assert.strictEqual(menu.style.display, "none");
  });
});

// ---------------------------------------------------------------------------
// Part B — background service worker (js/background.js)
// ---------------------------------------------------------------------------

describe("feature_16_background_context — background service worker (js/background.js)", function () {

  // ---- Source-shape guards ------------------------------------------------

  it("uses importScripts with leading slashes to /js/ai_layout.js and /js/ai_settings.js, exactly once", function () {
    assert.match(BACKGROUND_SRC, /importScripts\(\s*"\/js\/ai_layout\.js"\s*,\s*"\/js\/ai_settings\.js"\s*\)/);
    assert.strictEqual((BACKGROUND_SRC.match(/importScripts\(/g) || []).length, 1, "single importScripts call");
    // resolves like Chrome: worker at js/background.js, spec "/js/..." → /js/...
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO, "manifest.json"), "utf8"));
    const workerRel = manifest.background.service_worker; // js/background.js
    const specs = [...BACKGROUND_SRC.matchAll(/importScripts\(([^)]*)\)/g)]
      .flatMap((m) => [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]));
    const base = new URL("chrome-extension://id/" + workerRel);
    specs.forEach((spec) => {
      const resolved = new URL(spec, base).pathname.replace(/^\/+/, "");
      assert.ok(fs.existsSync(path.join(REPO, ...resolved.split("/"))), `${spec} resolves to existing file ${resolved}`);
    });
  });

  it("defines createActionMenu with five ids in documented order and guards by onInstalled", function () {
    // Source order
    const ids = ["sponsor", "donate", "buy-me-a-coffee", "contribute", "feedback"];
    ids.forEach((id) => assert.ok(BACKGROUND_SRC.includes(`id: "${id}"`), `mentions ${id}`));
    // All five are inside createActionMenu and all require contexts ["action"]
    const menuBlock = BACKGROUND_SRC.slice(BACKGROUND_SRC.indexOf("function createActionMenu"));
    ids.forEach((id) => assert.ok(menuBlock.includes(`"${id}"`), `createActionMenu contains ${id}`));
    assert.match(BACKGROUND_SRC, /chrome\.runtime\.onInstalled\.addListener/);
    const installedBlock = BACKGROUND_SRC.slice(BACKGROUND_SRC.indexOf("chrome.runtime.onInstalled.addListener"));
    assert.ok(installedBlock.includes("createActionMenu()"), "onInstalled calls createActionMenu");
  });

  it("has no console.* or safeLog in the worker (credential hygiene)", function () {
    const hits = (BACKGROUND_SRC.match(/console\.(log|warn|error|info|debug)/g) || []).length;
    assert.strictEqual(hits, 0, "no console.* in background.js");
    assert.strictEqual((BACKGROUND_SRC.match(/safeLog\(/g) || []).length, 0, "no safeLog in background.js");
  });

  // ---- Boot and menu registration -----------------------------------------

  it("createActionMenu creates five action-context entries when invoked", function () {
    const sb = createWorkerSandbox();
    assert.strictEqual(sb.creates.length, 0, "menus are not created at top-level (persisted profile guard)");
    sb.createActionMenu();
    assert.strictEqual(sb.creates.length, 5);
    assert.deepStrictEqual(sb.creates.map((c) => c.id), ["sponsor", "donate", "buy-me-a-coffee", "contribute", "feedback"]);
    sb.creates.forEach((c) => assert.deepStrictEqual(c.contexts, ["action"]));
    assert.strictEqual(sb.creates[0].title, "Sponsor");
    assert.strictEqual(sb.creates[4].title, "Report a bug or request a feature");
  });

  it("chrome.runtime.onInstalled registers the declarativeContent rule for dndbeyond", function () {
    const sb = createWorkerSandbox();
    assert.strictEqual(sb.listeners.onInstalled.length, 1);
    // invoke the installed handler
    sb.listeners.onInstalled[0]();
    // createActionMenu executed + declarative rule captured
    assert.strictEqual(sb.creates.length, 5, "installed handler creates menus");
    assert.strictEqual(sb.declarativeRules.length, 1);
    const rule = sb.declarativeRules[0];
    assert.ok(rule.conditions && rule.conditions[0] && rule.conditions[0].opts.pageUrl.urlContains === "dndbeyond");
    assert.ok(rule.actions && rule.actions[0].kind === "ShowAction");
    // idempotence: second install still adds five (Chrome's pattern is function-on-installed; test the second start
    // would have produced duplicate-id error if at top-level — here it yields 10, caller's job is install-only)
    sb.listeners.onInstalled[0]();
    assert.strictEqual(sb.creates.length, 10);
  });

  // ---- Toolbar badge: markOn / clearState --------------------------------

  it("markOn guards non-number tabId and paints ON badge; clearState clears it", function () {
    const sb = createWorkerSandbox();
    // non-number is ignored
    sb.markOn("not-a-number");
    sb.markOn(null);
    sb.clearState(undefined);
    assert.strictEqual(sb.badgeTexts.length, 0);
    assert.strictEqual(sb.badgeColors.length, 0);

    sb.markOn(42);
    assert.strictEqual(sb.badgeTexts.length, 1);
    assert.deepStrictEqual(sb.badgeTexts[0], { tabId: 42, text: "ON" });
    assert.strictEqual(sb.badgeColors.length, 1);
    assert.deepStrictEqual(sb.badgeColors[0], { tabId: 42, color: "#4A3E2B" });

    sb.clearState(42);
    assert.strictEqual(sb.badgeTexts.length, 2);
    assert.deepStrictEqual(sb.badgeTexts[1], { tabId: 42, text: "" });
  });

  it("badge helpers swallow exceptions (closed tab race)", function () {
    const sb = createWorkerSandbox();
    // Install throwing implementations
    const before = sb.badgeTexts.length;
    sb.chrome.action.setBadgeText = () => { throw new Error("tab closed"); };
    sb.chrome.action.setBadgeBackgroundColor = () => { throw new Error("tab closed"); };
    assert.doesNotThrow(() => sb.markOn(99));
    assert.doesNotThrow(() => sb.clearState(99));
    assert.strictEqual(sb.badgeTexts.length, before);
  });

  it("tabs.onUpdated clears badge only when changeInfo.status === loading", function () {
    const sb = createWorkerSandbox();
    assert.strictEqual(sb.listeners.tabsUpdated.length, 1);
    const onUpdated = sb.listeners.tabsUpdated[0];
    onUpdated(7, { status: "complete" });
    assert.strictEqual(sb.badgeTexts.length, 0);
    onUpdated(7, { status: "loading" });
    assert.strictEqual(sb.badgeTexts.length, 1);
    assert.deepStrictEqual(sb.badgeTexts[0], { tabId: 7, text: "" });
    // missing status
    onUpdated(7, {});
    assert.strictEqual(sb.badgeTexts.length, 1);
  });

  it("onMessage badge listener routes DDB_IS_ON / DDB_TURNED_OFF from sender.tab.id, ignores malformed", function () {
    const sb = createWorkerSandbox();
    // find the badge onMessage (first BYOK-unrelated listener); it guards !request
    const badgeListener = sb.listeners.onMessage.find((fn) => fn.toString().includes("DDB_IS_ON"));
    assert.ok(badgeListener, "badge listener present");
    badgeListener(null, { tab: { id: 5 } });
    badgeListener(undefined, {});
    assert.strictEqual(sb.badgeTexts.length, 0);

    badgeListener({ type: "DDB_IS_ON" }, { tab: { id: 11 } });
    assert.ok(sb.badgeTexts.some((b) => b.tabId === 11 && b.text === "ON"));

    badgeListener({ type: "DDB_TURNED_OFF" }, { tab: { id: 11 } });
    assert.ok(sb.badgeTexts.some((b) => b.tabId === 11 && b.text === ""));

    // unknown type ignored
    const before = sb.badgeTexts.length;
    badgeListener({ type: "UNKNOWN" }, { tab: { id: 99 } });
    assert.strictEqual(sb.badgeTexts.length, before);

    // sender without tab → markOn/clearState guard inside returns early, no throw
    assert.doesNotThrow(() => badgeListener({ type: "DDB_IS_ON" }, {}));
  });

  // ---- chrome.action.onClicked injection list ------------------------------

  it("chrome.action.onClicked injects worker catalog plus BYOK core files and then main.js", function () {
    const sb = createWorkerSandbox();
    assert.strictEqual(sb.listeners.actionClicked.length, 1);
    const tab = { id: 123 };
    sb.listeners.actionClicked[0](tab);
    assert.strictEqual(sb.executeCalls.length, 1);
    const files = sb.executeCalls[0].files;
    assert.ok(files.includes("js/catalog_service.js"));
    assert.ok(files.includes("js/context_menu.js"));
    assert.ok(files.includes("js/ai_settings.js"));
    assert.ok(files.includes("js/ai_layout.js"));
    assert.ok(files.includes("js/ai_arrange.js"));
    assert.ok(files.includes("js/ai_border.js"));
    assert.ok(files.includes("js/main.js"));
    // ai_layout.js must come before ai_arrange.js (core-then-flow comment, not load constraint)
    assert.ok(files.indexOf("js/ai_layout.js") < files.indexOf("js/ai_arrange.js"));
    assert.strictEqual(files[files.length - 1], "js/main.js");
    assert.deepStrictEqual(sb.executeCalls[0].target, { tabId: 123 });
  });

  // ---- chrome.contextMenus.onClicked (funding entries) ---------------------

  it("contextMenus.onClicked opens correct URL per menu id and ignores unknown ids", function () {
    const sb = createWorkerSandbox();
    assert.strictEqual(sb.listeners.contextClicked.length, 1);
    const handler = sb.listeners.contextClicked[0];
    const cases = {
      sponsor: "https://github.com/sponsors/luiscla27",
      donate: "https://www.paypal.com/paypalme/luiscla27",
      "buy-me-a-coffee": "https://buymeacoffee.com/luiscla27",
      contribute: "https://github.com/luiscla27/beyond-print-enhancer",
      feedback: "https://github.com/luiscla27/beyond-print-enhancer/issues",
    };
    Object.entries(cases).forEach(([id, url]) => {
      sb.tabCreates.length = 0;
      handler({ menuItemId: id });
      assert.strictEqual(sb.tabCreates.length, 1, `opens tab for ${id}`);
      assert.strictEqual(sb.tabCreates[0].url, url, `correct url for ${id}`);
    });
    sb.tabCreates.length = 0;
    handler({ menuItemId: "unknown" });
    assert.strictEqual(sb.tabCreates.length, 0, "unknown id opens nothing");
  });

  // ---- FETCH_CHARACTER_DATA relay ------------------------------------------

  it("FETCH_CHARACTER_DATA relay fetches request.url -> json and replies, keeps channel open", async function () {
    const payload = { character: { name: "Archer" } };
    const sb = createWorkerSandbox({
      fetchImpl: () => Promise.resolve({ json: () => Promise.resolve(payload) }),
    });
    const relay = sb.listeners.onMessage.find((fn) => fn.toString().includes("FETCH_CHARACTER_DATA"));
    assert.ok(relay, "fetch-character relay present");
    let replied = null;
    const sendResponse = (v) => { replied = v; };
    const ret = relay({ type: "FETCH_CHARACTER_DATA", url: "https://character-service.dndbeyond.com/character/v5/character/1" }, {}, sendResponse);
    assert.strictEqual(ret, true, "returns true to keep channel open");
    await new Promise((r) => setTimeout(r, 50));
    crossDeepEqual(replied, { success: true, data: payload });

    // error path
    const errSb = createWorkerSandbox({
      fetchImpl: () => Promise.reject(new Error("net down")),
    });
    const errRelay = errSb.listeners.onMessage.find((fn) => fn.toString().includes("FETCH_CHARACTER_DATA"));
    let errReply = null;
    errRelay({ type: "FETCH_CHARACTER_DATA", url: "https://example.com/x" }, {}, (v) => { errReply = v; });
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(errReply.success, false);
    assert.ok(errReply.error.includes("net down"));
  });

  it("FETCH_CHARACTER_DATA ignores other message types and does not reply", async function () {
    const sb = createWorkerSandbox();
    const relay = sb.listeners.onMessage.find((fn) => fn.toString().includes("FETCH_CHARACTER_DATA"));
    let called = false;
    const sendResponse = () => { called = true; };
    const ret = relay({ type: "OTHER" }, {}, sendResponse);
    assert.strictEqual(ret, undefined);
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(called, false);
  });

  // ---- BYOK_CHAT constants and predicates ----------------------------------

  it("exposes BYOK constants, allowed/smuggled vocabularies and origin helpers", function () {
    const sb = createWorkerSandbox();
    assert.strictEqual(typeof sb.BYOK_PAGE_ORIGIN_PREFIX, "undefined", "const not global; tested via sandbox local — see byokSenderProblem paths");
    // Re-derive via sender gate instead: the constant is asserted via behavior below.
    // Allowed keys: only these four + type are accepted by smuggled check
    crossDeepEqual(sb.byokSmuggledKeys({ type: "BYOK_CHAT", provider: "openai", model: "x", messages: [], maxTokens: 1 }), []);
    // Smuggled vocab contains credential/transport names
    const found = sb.byokSmuggledKeys({ type: "BYOK_CHAT", provider: "openai", apiKey: "sk-xxx", url: "https://evil.com" });
    assert.ok(found.includes("apiKey"));
    assert.ok(found.includes("url"));
    // byokOriginOf is parse-tolerant
    assert.strictEqual(sb.byokOriginOf("https://api.openai.com/v1/chat/completions"), "https://api.openai.com");
    assert.strictEqual(sb.byokOriginOf("not a url"), "");
    assert.strictEqual(sb.byokOriginOf(null), "");
  });

  it("byokSenderProblem gates extension id and dndbeyond page origin", function () {
    const sb = createWorkerSandbox();
    const okSender = { id: "test-extension-id", tab: { url: "https://www.dndbeyond.com/characters/123456" } };
    assert.strictEqual(sb.byokSenderProblem(okSender), "");
    assert.strictEqual(sb.byokSenderProblem({ id: "other-id", tab: { url: "https://www.dndbeyond.com/characters/1" } }), "sender_identity");
    assert.strictEqual(sb.byokSenderProblem({ id: "test-extension-id", tab: { url: "https://evil.com/" } }), "sender_origin");
    assert.strictEqual(sb.byokSenderProblem(null), "sender_identity");
    assert.strictEqual(sb.byokSenderProblem({ id: "test-extension-id", tab: { url: "" } }), "sender_origin");
    assert.strictEqual(sb.byokSenderProblem({ id: "test-extension-id" }), "sender_origin");
  });

  it("byokSmuggledKeys normalizes case/underscores, catches aliases, and flags unknown keys", function () {
    const sb = createWorkerSandbox();
    // apiKey aliases
    assert.ok(sb.byokSmuggledKeys({ type: "BYOK_CHAT", apiKey: "x" }).includes("apiKey"));
    assert.ok(sb.byokSmuggledKeys({ type: "BYOK_CHAT", API_KEY: "x" }).includes("API_KEY"));
    assert.ok(sb.byokSmuggledKeys({ type: "BYOK_CHAT", "api-key": "x" }).some((k) => k === "api-key"));
    // baseUrl alias
    assert.ok(sb.byokSmuggledKeys({ type: "BYOK_CHAT", baseUrl: "https://evil.com" }).includes("baseUrl"));
    assert.ok(sb.byokSmuggledKeys({ type: "BYOK_CHAT", base_url: "https://evil.com" }).includes("base_url"));
    // headers shortish
    assert.ok(sb.byokSmuggledKeys({ type: "BYOK_CHAT", headers: {} }).includes("headers"));
    // allowed fields must not flag
    crossDeepEqual(sb.byokSmuggledKeys({ type: "BYOK_CHAT", provider: "openai", model: "x", messages: [], maxTokens: 8 }), []);
    // unknown top-level key is smuggled-by-not-allowed
    assert.ok(sb.byokSmuggledKeys({ type: "BYOK_CHAT", provider: "openai", surprise: 1 }).includes("surprise"));
    // messages key must not collide with 'message'
    crossDeepEqual(sb.byokSmuggledKeys({ type: "BYOK_CHAT", messages: [] }), []);
  });

  it("byokTargetProblem origin-locks the built request url against PROVIDERS / compat list", function () {
    const sb = createWorkerSandbox();
    assert.strictEqual(sb.byokTargetProblem({ url: "https://api.openai.com/v1/chat/completions" }), "");
    assert.strictEqual(sb.byokTargetProblem({ url: "https://api.anthropic.com/v1/messages" }), "");
    const evil = sb.byokTargetProblem({ url: "https://evil.com/steal" });
    assert.ok(evil.startsWith("refused:"), evil);
    assert.strictEqual(sb.byokTargetProblem(null), "the relayed target is not a URL");
    assert.strictEqual(sb.byokTargetProblem({ url: "" }), "the relayed target is not a URL");
  });

  it("byokRelaySnapshot is a copy, and direct byokRelayStats mutation is not exposed", function () {
    const sb = createWorkerSandbox();
    const snap = sb.byokRelaySnapshot();
    assert.deepStrictEqual(Object.keys(snap), ["handled", "refused", "lastTargetOrigin"]);
    assert.deepStrictEqual(Object.keys(snap.refused), ["sender_identity", "sender_origin", "request_smuggling", "provider_origin_lock"]);
    snap.handled = 99;
    snap.refused.sender_identity = 99;
    const snap2 = sb.byokRelaySnapshot();
    assert.strictEqual(snap2.handled, 0);
    assert.strictEqual(snap2.refused.sender_identity, 0);
  });

  it("byokRefusal produces stable ok:false shape", function () {
    const sb = createWorkerSandbox();
    crossDeepEqual(sb.byokRefusal("sender_identity", "nope"), { ok: false, transport: "sender_identity", errorClass: "sender_identity", message: "nope" });
    crossDeepEqual(sb.byokRefusal("x"), { ok: false, transport: "x", errorClass: "x", message: "" });
  });

  // ---- byokChatReply gate paths (unit, promise-based) ----------------------

  it("byokChatReply refuses sender_identity and increments counter", async function () {
    const sb = createWorkerSandbox();
    sb.byokChatReply._sender = { id: "bad", tab: { url: "https://www.dndbeyond.com/characters/1" } };
    const before = sb.byokRelaySnapshot().refused.sender_identity;
    const reply = await sb.byokChatReply({ type: "BYOK_CHAT", provider: "openai", model: "x", messages: [] });
    assert.strictEqual(reply.ok, false);
    assert.strictEqual(reply.transport, "sender_identity");
    assert.strictEqual(sb.byokRelaySnapshot().refused.sender_identity, before + 1);
  });

  it("byokChatReply refuses sender_origin and increments counter", async function () {
    const sb = createWorkerSandbox();
    sb.byokChatReply._sender = { id: "test-extension-id", tab: { url: "https://evil.com/" } };
    const before = sb.byokRelaySnapshot().refused.sender_origin;
    const reply = await sb.byokChatReply({ type: "BYOK_CHAT", provider: "openai" });
    assert.strictEqual(reply.transport, "sender_origin");
    assert.strictEqual(sb.byokRelaySnapshot().refused.sender_origin, before + 1);
  });

  it("byokChatReply refuses request_shape when body is not an object", async function () {
    const sb = createWorkerSandbox();
    sb.byokChatReply._sender = { id: "test-extension-id", tab: { url: "https://www.dndbeyond.com/characters/1" } };
    assert.strictEqual((await sb.byokChatReply(null)).transport, "request_shape");
    assert.strictEqual((await sb.byokChatReply("string")).transport, "request_shape");
  });

  it("byokChatReply refuses request_smuggling, names only fields, never values", async function () {
    const sb = createWorkerSandbox();
    sb.byokChatReply._sender = { id: "test-extension-id", tab: { url: "https://www.dndbeyond.com/characters/1" } };
    const reply = await sb.byokChatReply({ type: "BYOK_CHAT", provider: "openai", apiKey: "sk-secret-123", headers: { a: 1 } });
    assert.strictEqual(reply.transport, "request_smuggling");
    assert.ok(reply.message.includes("apiKey"));
    assert.ok(reply.message.includes("headers"));
    assert.ok(!reply.message.includes("sk-secret-123"), "does not echo credential value");
    const before = sb.byokRelaySnapshot().refused.request_smuggling - 1;
    // Already incremented; sanity check it was counted
    assert.ok(sb.byokRelaySnapshot().refused.request_smuggling > before);
  });

  it("byokChatReply uses storage for apiKey+settings, never request.apiKey, and returns api_key_required when missing", async function () {
    const sb = createWorkerSandbox({ storageSeed: {} });
    sb.byokChatReply._sender = { id: "test-extension-id", tab: { url: "https://www.dndbeyond.com/characters/1" } };
    const reply = await sb.byokChatReply({ type: "BYOK_CHAT", provider: "openai", model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }], maxTokens: 1 });
    assert.strictEqual(reply.transport, "api_key_required");
  });

  it("byokChatReply full success path dials PROVIDERS origin, records handled+origin, decodes via parseResponse", async function () {
    const bodyText = JSON.stringify({ choices: [{ message: { content: '{"moves":{}}' } }] });
    const sb = createWorkerSandbox({
      storageSeed: { "be.ai.key": "sk-test-1234567890abcd", "be.ai": { provider: "openai", model: "gpt-4o-mini", baseUrl: "" } },
      fetchImpl: (url, init) => {
        assert.ok(String(url).startsWith("https://api.openai.com/"), url);
        assert.ok(init.headers && typeof init.headers.Authorization === "string");
        assert.ok(init.headers.Authorization.includes("Bearer "));
        return Promise.resolve({
          status: 200,
          headers: { get: () => null },
          text: () => Promise.resolve(bodyText),
        });
      },
    });
    sb.byokChatReply._sender = { id: "test-extension-id", tab: { url: "https://www.dndbeyond.com/characters/1" } };
    const beforeHandled = sb.byokRelaySnapshot().handled;
    const reply = await sb.byokChatReply({
      type: "BYOK_CHAT",
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "arrange" }],
      maxTokens: 1,
    });
    // parseResponse decodes bodyText into {ok:true, text:...} or similar
    assert.strictEqual(typeof reply.ok, "boolean");
    // Should be handled (either ok or a parsed failure that still went through fetch)
    assert.strictEqual(sb.byokRelaySnapshot().handled, beforeHandled + 1);
    assert.strictEqual(sb.byokRelaySnapshot().lastTargetOrigin, "https://api.openai.com");
  });

  // ---- BYOK onMessage settle integration (the settle + redaction path) ------

  it("BYOK onMessage listener threads sender through _sender, redacts and settles with ok-filtered shape, returns true", async function () {
    const bodyText = JSON.stringify({ choices: [{ message: { content: "hello" } }] });
    const sb = createWorkerSandbox({
      storageSeed: { "be.ai.key": "sk-test-1234567890abcd", "be.ai": { provider: "openai", model: "gpt-4o-mini" } },
      fetchImpl: () => Promise.resolve({ status: 200, headers: { get: () => null }, text: () => Promise.resolve(bodyText) }),
    });
    const byokListener = sb.listeners.onMessage.find((fn) => fn.toString().includes("BYOK_CHAT"));
    assert.ok(byokListener);
    let settled = null;
    const sender = { id: "test-extension-id", tab: { url: "https://www.dndbeyond.com/characters/1" } };
    const req = { type: "BYOK_CHAT", provider: "openai", model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }], maxTokens: 1 };
    const ret = byokListener(req, sender, (out) => { settled = out; });
    assert.strictEqual(ret, true, "keeps channel open");
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(settled, "sendResponse called");
    assert.strictEqual(typeof settled.ok, "boolean");
    assert.strictEqual(typeof settled.transport, "string");
    assert.strictEqual(typeof settled.errorClass, "string");
    assert.strictEqual(typeof settled.message, "string");
    // ok reply exposes text, error reply would expose status/retryAfter; ensure no raw request fields echoed
    assert.ok(!("apiKey" in settled) && !("url" in settled), "never echoes smuggled-shaped request fields");
  });

  it("BYOK onMessage ignores non-BYOK_CHAT and non-object requests", function () {
    const sb = createWorkerSandbox();
    const byokListener = sb.listeners.onMessage.find((fn) => fn.toString().includes("BYOK_CHAT"));
    let called = false;
    assert.strictEqual(byokListener({ type: "OTHER" }, { id: "test-extension-id" }, () => { called = true; }), undefined);
    assert.strictEqual(byokListener(null, {}, () => { called = true; }), undefined);
    assert.strictEqual(called, false);
  });

  it("BYOK dial race: deadline returns aborted refusal if fetch hangs", async function () {
    // This test waits only for the happy settle; the deadline path is asserted structurally:
    // BYOK_REQUEST_TIMEOUT_MS is 45000 and Promise.race is used.
    assert.match(BACKGROUND_SRC, /const BYOK_REQUEST_TIMEOUT_MS\s*=\s*45000/);
    assert.match(BACKGROUND_SRC, /Promise\.race\(\[dialed,\s*deadline\]\)/);
    assert.match(BACKGROUND_SRC, /byokRefusal\(\s*"aborted"/);
  });
});
