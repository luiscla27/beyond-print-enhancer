"use strict";

/**
 * feature_07_persistence — Persistence (Save/Load + Serialization)
 * Uses the proven debt_harness boot pattern (encapsulation_debt/debt_harness)
 * for correct IndexedDB isolation (IDBFactory per boot) and extension order.
 */

const assert = require("assert");
const { boot } = require("./encapsulation_debt/debt_harness.js");

// Each test boots fresh via debt_harness (private IDBFactory per boot),
// then evals undo/recovery if needed — but debt_harness already does.

describe("feature_07_persistence — Storage constants & migrateLayout", function () {
  it("exposes DB constants and SCHEMA_VERSION", function () {
    const { window } = boot();
    const S = window.__DDBStorage;
    assert.strictEqual(S.DB_NAME, "DDBPrintEnhancerDB");
    assert.strictEqual(S.STORE_NAME, "layouts");
    assert.strictEqual(S.SPELL_CACHE_STORE, "spell_cache");
    assert.strictEqual(S.CUSTOM_SHAPES_STORE, "custom_shapes");
    assert.strictEqual(S.CUSTOM_BORDERS_STORE, "custom_borders");
    assert.match(S.SCHEMA_VERSION, /^\d+\.\d+\.\d+$/);
    // via Persistence re-export
    assert.strictEqual(window.Persistence.MAX_BACKUPS, 10);
    assert.match(window.Persistence.SETTINGS_BUNDLE_VERSION, /^\d+\.\d+$/);
  });

  it("migrateLayout returns falsy as-is and stamps version + shapeLayers", function () {
    const { window } = boot();
    const S = window.__DDBStorage;
    assert.strictEqual(S.migrateLayout(null), null);
    assert.strictEqual(S.migrateLayout(undefined), undefined);
    const out = S.migrateLayout({ version: "1.5.0", sections: { a: {} } });
    assert.strictEqual(out.version, S.SCHEMA_VERSION);
    assert.ok(Array.isArray(out.shapeLayers));
  });

  it("migrateLayout does not create phantom shape layer for modern record", function () {
    const { window } = boot();
    const out = window.__DDBStorage.migrateLayout({ version: "1.5.0", sections: {}, shapeLayers: [] });
    assert.strictEqual(out.shapeLayers.length, 0);
  });

  it("creates Default Shapes Layer only for legacy flat shapes", function () {
    const { window } = boot();
    const legacy = { version: "1.5.0", sections: {}, shapes: [{ id: "x" }], layers: { shapes: { isLocked: true, isHidden: false } } };
    const out = window.__DDBStorage.migrateLayout(legacy);
    assert.strictEqual(out.shapeLayers.length, 1);
    assert.strictEqual(out.shapeLayers[0].id, "shapes-default");
    assert.strictEqual(out.shapeLayers[0].isLocked, true);
    assert.deepStrictEqual(out.shapeLayers[0].elements, [{ id: "x" }]);
  });

  it("does not invent borderSvg (AC-7 NO-OP)", function () {
    const { window } = boot();
    const out = window.__DDBStorage.migrateLayout({ version: "1.5.0", sections: { s1: { name: "A" } } });
    assert.ok(!Object.prototype.hasOwnProperty.call(out.sections.s1, "borderSvg"));
  });

  it("validateLayout distinguishes valid vs invalid", function () {
    const { window } = boot();
    const S = window.__DDBStorage;
    assert.strictEqual(S.validateLayout(null), false);
    assert.strictEqual(S.validateLayout({}), false);
    assert.strictEqual(S.validateLayout({ version: "1.6.0" }), false);
    assert.strictEqual(S.validateLayout({ version: "1.6.0", sections: "nope" }), false);
    assert.strictEqual(S.validateLayout({ version: "1.6.0", sections: {} }), true);
    assert.strictEqual(S.validateLayout({ version: "1.6.0", sections: {}, extra: 1 }), true);
  });
});

describe("feature_07_persistence — Storage save/load lifecycle (real IndexedDB)", function () {
  it("save/load per-character and global round-trips; missing returns undefined", async function () {
    const { window } = boot();
    const S = window.__DDBStorage;
    await S.saveLayout("char-99", { version: S.SCHEMA_VERSION, sections: { a: { w: 100 } } });
    const loaded = await S.loadLayout("char-99");
    assert.deepStrictEqual(loaded.sections, { a: { w: 100 } });
    const missing = await S.loadLayout("nope");
    assert.ok(missing === undefined || missing === null);
    await S.saveGlobalLayout({ version: S.SCHEMA_VERSION, sections: { g: {} } });
    const g = await S.loadGlobalLayout();
    assert.ok(g && g.sections && Object.prototype.hasOwnProperty.call(g.sections, "g"));
  });

  it("getHueShift defaults to 0 and round-trips", async function () {
    const { window } = boot();
    const S = window.__DDBStorage;
    assert.strictEqual(await S.getHueShift(), 0);
    await S.saveHueShift(42);
    assert.strictEqual(await S.getHueShift(), 42);
    await S.saveHueShift(0);
    assert.strictEqual(await S.getHueShift(), 0);
  });

  it("getFilters defaults and reflects saved contrast + hue", async function () {
    const { window } = boot();
    const S = window.__DDBStorage;
    const d = await S.getFilters();
    assert.strictEqual(d.contrast, 100);
    assert.strictEqual(d.greyscale, 100);
    assert.strictEqual(d.saturate, 100);
    assert.strictEqual(d.sepia, 0);
    await S.saveFilter("contrast", 130);
    await S.saveHueShift(15);
    const after = await S.getFilters();
    assert.strictEqual(after.contrast, 130);
    assert.strictEqual(await S.getHueShift(), 15);
  });

  it("custom shapes upsert via saveCustomShape / getCustomShapes", async function () {
    const { window } = boot();
    const S = window.__DDBStorage;
    await S.saveCustomShape({ id: "shape-1", name: "S1", data: "abc" });
    let list = await S.getCustomShapes();
    assert.ok(list.some((s) => s.id === "shape-1" && s.name === "S1"));
    await S.saveCustomShape({ id: "shape-1", name: "S1b", data: "xyz" });
    list = await S.getCustomShapes();
    const hit = list.find((s) => s.id === "shape-1");
    assert.strictEqual(hit.name, "S1b");
    assert.strictEqual(hit.data, "xyz");
  });

  it("custom borders upsert and delete", async function () {
    const { window } = boot();
    const S = window.__DDBStorage;
    await S.saveCustomBorder({ id: "border-1", svg: "<svg></svg>", prompt: "p" });
    let list = await S.getCustomBorders();
    assert.ok(list.some((b) => b.id === "border-1"));
    await S.saveCustomBorder({ id: "border-1", svg: "<svg>2</svg>" });
    list = await S.getCustomBorders();
    assert.ok(list.find((b) => b.id === "border-1").svg.includes("2"));
    const ok = await S.deleteCustomBorder("border-1");
    assert.strictEqual(ok, true);
    list = await S.getCustomBorders();
    assert.ok(!list.some((b) => b.id === "border-1"));
  });

  it("spell cache saveSpells / getSpell / getAllSpells", async function () {
    const { window } = boot();
    const S = window.__DDBStorage;
    await S.saveSpells([{ name: "Fireball", level: 3 }, { name: "Shield", level: 1 }]);
    const one = await S.getSpell("Fireball");
    assert.strictEqual(one.name, "Fireball");
    const all = await S.getAllSpells();
    assert.ok(Array.isArray(all) && all.length >= 2);
    assert.ok(all.some((s) => s.name === "Shield"));
  });
});

describe("feature_07_persistence — handleSaveBrowser & handleSavePC", function () {
  it("handleSaveBrowser saves global and character and toasts success", async function () {
    const { window } = boot();
    const P = window.Persistence;
    const toasts = [];
    window.showFeedback = (msg, type) => toasts.push({ msg, type });
    window.scanLayout = async () => ({ version: window.__DDBStorage.SCHEMA_VERSION, sections: { a: {} } });
    window.getCharacterId = () => "char-1";
    await P.handleSaveBrowser();
    assert.ok(toasts.some((t) => /Saved to browser/.test(t.msg)), JSON.stringify(toasts));
    const g = await window.__DDBStorage.loadGlobalLayout();
    assert.ok(g && g.sections.a);
    const c = await window.__DDBStorage.loadLayout("char-1");
    assert.ok(c && c.sections.a);
  });

  it("handleSaveBrowser surfaces error when scan fails", async function () {
    const { window } = boot();
    const P = window.Persistence;
    const toasts = [];
    window.showFeedback = (msg, type) => toasts.push({ msg, type });
    window.scanLayout = async () => { throw new Error("scan boom"); };
    await P.handleSaveBrowser();
    assert.ok(toasts.some((t) => t.type === "error"), JSON.stringify(toasts));
  });

  it("handleSavePC triggers download and shows success toast", async function () {
    const { window } = boot();
    const P = window.Persistence;
    const toasts = [];
    window.showFeedback = (msg, type) => toasts.push({ msg, type });
    window.scanLayout = async () => ({ version: window.__DDBStorage.SCHEMA_VERSION, sections: { s: {} } });
    window.URL.createObjectURL = () => "blob:fake";
    window.URL.revokeObjectURL = () => {};
    global.URL.createObjectURL = window.URL.createObjectURL;
    global.URL.revokeObjectURL = window.URL.revokeObjectURL;
    let clicked = false;
    const origCreate = window.document.createElement.bind(window.document);
    window.document.createElement = (tag) => {
      const el = origCreate(tag);
      if (tag === "a") { const oc = el.click.bind(el); el.click = () => { clicked = true; try { oc(); } catch (_e) { void _e; } }; }
      return el;
    };
    await P.handleSavePC();
    assert.strictEqual(clicked, true, "anchor click triggered");
    assert.ok(toasts.some((t) => /Download started/.test(t.msg)), JSON.stringify(toasts));
  });

  it("handleSavePC reports scan failure with typed error and no download", async function () {
    const { window } = boot();
    const P = window.Persistence;
    const toasts = [];
    window.showFeedback = (msg, type) => toasts.push({ msg, type });
    window.scanLayout = async () => { throw new Error("scan blew up"); };
    let clicked = false;
    const origCreate = window.document.createElement.bind(window.document);
    window.document.createElement = (tag) => {
      const el = origCreate(tag);
      if (tag === "a") el.click = () => { clicked = true; };
      return el;
    };
    await P.handleSavePC();
    assert.strictEqual(clicked, false);
    const err = toasts.find((t) => t.type === "error");
    assert.ok(err && /Could not read/.test(err.msg), JSON.stringify(toasts));
  });
});

describe("feature_07_persistence — backup / prune / restore", function () {
  it("createBackupSnapshot writes record; listBackups newest-first", async function () {
    const { window } = boot();
    await window.__DDBStorage.saveGlobalLayout({ version: window.__DDBStorage.SCHEMA_VERSION, sections: { a: {} } });
    const a = await window.createBackupSnapshot("test-1");
    assert.strictEqual(a.ok, true);
    assert.ok(a.record.id.startsWith("backup_"));
    const b = await window.createBackupSnapshot("test-2");
    assert.notStrictEqual(a.record.id, b.record.id);
    const listed = await window.listBackups();
    assert.ok(listed.length >= 2);
    for (let i = 1; i < listed.length; i++) assert.ok(listed[i - 1].createdAt >= listed[i].createdAt);
  });

  it("same-millisecond backups get distinct ids via seq", async function () {
    const { window } = boot();
    const a = await window.createBackupSnapshot("t");
    const b = await window.createBackupSnapshot("t");
    assert.notStrictEqual(a.record.id, b.record.id);
    assert.notStrictEqual(a.record.seq, b.record.seq);
  });

  it("pruneBackups honours MAX_BACKUPS (deterministic FIFO)", async function () {
    const { window } = boot();
    const P = window.Persistence;
    await window.__DDBStorage.saveGlobalLayout({ version: window.__DDBStorage.SCHEMA_VERSION, sections: {} });
    const ids = [];
    for (let i = 0; i < P.MAX_BACKUPS + 2; i++) ids.push((await window.createBackupSnapshot("bulk")).record.id);
    const listed = await window.listBackups();
    assert.strictEqual(listed.length, P.MAX_BACKUPS, "cap " + listed.length);
    assert.ok(!listed.some((r) => r.id === ids[0]), "oldest evicted");
    assert.ok(listed.some((r) => r.id === ids[ids.length - 1]), "newest survives");
  });

  it("restoreBackupRecord handles missing / empty / success / apply-failure", async function () {
    const { window } = boot();
    assert.strictEqual((await window.restoreBackupRecord(null)).ok, false);
    assert.strictEqual((await window.restoreBackupRecord({ id: "x", layout: null })).reason, "empty");
    let applied = false;
    window.applyLayout = async () => { applied = true; };
    assert.strictEqual((await window.restoreBackupRecord({ layout: { version: window.__DDBStorage.SCHEMA_VERSION, sections: {} } })).ok, true);
    assert.strictEqual(applied, true);
    window.applyLayout = async () => { throw new Error("boom"); };
    const fail = await window.restoreBackupRecord({ layout: { version: window.__DDBStorage.SCHEMA_VERSION, sections: {} } });
    assert.strictEqual(fail.ok, false);
    assert.strictEqual(fail.reason, "apply");
  });
});

describe("feature_07_persistence — restoreLayout & announce & legacy & version", function () {
  it("restoreLayout: empty / invalid / restored", async function () {
    const { window } = boot();
    const P = window.Persistence;
    // isolated DB starts empty already
    const empty = await P.restoreLayout();
    assert.strictEqual(empty.restored, false);
    assert.strictEqual(empty.reason, "empty");

    await window.__DDBStorage.saveGlobalLayout({ version: window.__DDBStorage.SCHEMA_VERSION, bogus: true });
    const invalid = await P.restoreLayout();
    assert.strictEqual(invalid.restored, false);
    assert.strictEqual(invalid.reason, "invalid");

    await window.__DDBStorage.saveGlobalLayout({ version: window.__DDBStorage.SCHEMA_VERSION, sections: {} });
    const ok = await P.restoreLayout();
    assert.strictEqual(ok.restored, true);
  });

  it("announceBootRestore: restored / default / silent", async function () {
    const { window } = boot();
    const toasts = [];
    window.showFeedback = (msg, type) => toasts.push({ msg, type });
    assert.strictEqual(window.announceBootRestore({ restored: true }), "restored");
    assert.ok(toasts.some((t) => /Restored your saved layout/.test(t.msg)));
    toasts.length = 0;
    assert.strictEqual(window.announceBootRestore({ restored: false, reason: "empty" }), "default");
    assert.ok(toasts.some((t) => /No saved layout/.test(t.msg)));
    toasts.length = 0;
    assert.strictEqual(window.announceBootRestore({ restored: false, reason: "invalid" }), "silent");
    assert.strictEqual(toasts.length, 0);
  });

  it("detectLegacyLayout allowlist: null for current, flags legacy", function () {
    const { window } = boot();
    assert.strictEqual(window.detectLegacyLayout({ version: window.__DDBStorage.SCHEMA_VERSION, sections: {} }), null);
    assert.strictEqual(window.detectLegacyLayout({ version: window.__DDBStorage.SCHEMA_VERSION, sections: {}, futureThing: 1 }), null);
    assert.ok(window.detectLegacyLayout({ version: window.__DDBStorage.SCHEMA_VERSION, shapes: [] }));
    assert.ok(window.detectLegacyLayout({ version: "nope", sections: {} }));
    assert.ok(window.detectLegacyLayout({ version: window.__DDBStorage.SCHEMA_VERSION, sections: { a: { borderImage: "assets/x.gif" } } }));
    assert.strictEqual(window.detectLegacyLayout(null), "not-an-object");
  });

  it("versionNotice: null for current, older/newer copy", function () {
    const { window } = boot();
    const cur = window.__DDBStorage.SCHEMA_VERSION;
    assert.strictEqual(window.versionNotice(cur), null);
    assert.ok(/older version/.test(window.versionNotice("1.0.0")));
    assert.ok(/NEWER version/.test(window.versionNotice("9.9.9")));
  });
});

describe("feature_07_persistence — settings bundle collect / validate / apply", function () {
  it("collectSettingsBundle gathers layout + libraries + filters + safe AI", async function () {
    const { window } = boot();
    await window.__DDBStorage.saveCustomShape({ id: "cs-1", name: "CS", data: "d" });
    await window.__DDBStorage.saveCustomBorder({ id: "cb-1", svg: "<svg></svg>" });
    await window.__DDBStorage.saveHueShift(12);
    await window.__DDBStorage.saveFilter("contrast", 125);
    window.AiSettings = {
      loadSettings: async () => ({ provider: "openai", model: "gpt-4", baseUrl: "https://x", keyPresent: true }),
      saveSettings: async () => {},
    };
    const P = window.Persistence;
    window.scanLayout = async () => ({ version: window.__DDBStorage.SCHEMA_VERSION, sections: { s: {} } });
    const bundle = await P.collectSettingsBundle();
    assert.strictEqual(bundle.version, P.SETTINGS_BUNDLE_VERSION);
    assert.ok(bundle.layout && bundle.layout.sections);
    assert.ok(Array.isArray(bundle.customShapes) && bundle.customShapes.some((s) => s.id === "cs-1"));
    assert.ok(Array.isArray(bundle.customBorders) && bundle.customBorders.some((b) => b.id === "cb-1"));
    assert.ok(bundle.globalFilters && typeof bundle.globalFilters.contrast === "number");
    assert.ok(bundle.aiSettings && bundle.aiSettings.provider === "openai" && bundle.aiSettings.keyPresent === true);
    assert.ok(!JSON.stringify(bundle).includes("sk-"), "no raw key");
  });

  it("validateSettingsBundle rejects bad shapes, version mismatch, missing layout, credential smuggling", function () {
    const { window } = boot();
    const P = window.Persistence;
    const good = { version: P.SETTINGS_BUNDLE_VERSION, layout: { version: window.__DDBStorage.SCHEMA_VERSION, sections: {} } };
    assert.strictEqual(P.validateSettingsBundle(null).ok, false);
    assert.strictEqual(P.validateSettingsBundle({}).ok, false);
    assert.strictEqual(P.validateSettingsBundle({ version: "0.0", layout: { version: "1.6.0", sections: {} } }).ok, false);
    assert.strictEqual(P.validateSettingsBundle({ version: P.SETTINGS_BUNDLE_VERSION }).ok, false);
    assert.strictEqual(P.validateSettingsBundle({ version: P.SETTINGS_BUNDLE_VERSION, layout: { version: "1.6.0" } }).ok, false);
    assert.strictEqual(P.validateSettingsBundle({ version: P.SETTINGS_BUNDLE_VERSION, layout: { version: "1.6.0", sections: {} }, customShapes: "nope" }).ok, false);
    assert.strictEqual(P.validateSettingsBundle({ version: P.SETTINGS_BUNDLE_VERSION, layout: { version: "1.6.0", sections: {} }, customBorders: "nope" }).ok, false);
    assert.strictEqual(P.validateSettingsBundle(good).ok, true);
    const withKey = { version: P.SETTINGS_BUNDLE_VERSION, layout: { version: "1.6.0", sections: {} }, evil: "be.ai.key=sk-123" };
    const c = P.validateSettingsBundle(withKey);
    assert.strictEqual(c.ok, false);
    assert.strictEqual(c.error, "credential_in_bundle");
    assert.strictEqual(P.validateSettingsBundle({ version: P.SETTINGS_BUNDLE_VERSION, layout: { version: "1.6.0", sections: {} }, note: "apiKey sk-abc" }).ok, false);
  });

  it("applySettingsBundle merges: layout replace, shape/border upsert, filters, safe AI merge; rejects validation/cancel/backup", async function () {
    const { window } = boot();
    const P = window.Persistence;
    window.destructiveGate = async () => ({ ok: true, record: { id: "snap-1" } });
    window.createBackupSnapshot = async () => ({ ok: true, record: { id: "snap-1" } });
    window.offerUndo = () => {};
    window.showFeedback = () => {};
    window.AiSettings = {
      loadSettings: async () => ({ provider: "old", model: "old-m", baseUrl: "", keyPresent: false }),
      saveSettings: async (m) => { window.__savedAI = m; },
    };
    let appliedLayout = null;
    window.applyLayout = async (l) => { appliedLayout = l; };
    const bundle = {
      version: P.SETTINGS_BUNDLE_VERSION,
      layout: { version: window.__DDBStorage.SCHEMA_VERSION, sections: { imported: {} } },
      customShapes: [{ id: "imp-shape", name: "I", data: "d" }],
      customBorders: [{ id: "imp-border", svg: "<svg>imp</svg>" }],
      globalFilters: { contrast: 111, greyscale: 100, saturate: 100, sepia: 0, hueShift: 7 },
      aiSettings: { provider: "anthropic", model: "claude", baseUrl: "https://anthropic" },
    };
    const res = await P.applySettingsBundle(bundle, { source: "test.json" });
    assert.strictEqual(res.ok, true, JSON.stringify(res));
    assert.ok(res.applied.layout);
    assert.ok(appliedLayout && appliedLayout.sections.imported !== undefined);
    assert.ok((await window.__DDBStorage.getCustomShapes()).some((s) => s.id === "imp-shape"));
    assert.ok((await window.__DDBStorage.getCustomBorders()).some((b) => b.id === "imp-border"));
    assert.ok(window.__savedAI && window.__savedAI.provider === "anthropic" && window.__savedAI.keyPresent === false, JSON.stringify(window.__savedAI));

    // validation fail
    const r1 = await P.applySettingsBundle({ version: "0.0", layout: { version: "1.6.0", sections: {} } });
    assert.strictEqual(r1.ok, false);
    assert.strictEqual(r1.error, "validation");
    // gate cancelled
    window.destructiveGate = async () => ({ ok: false });
    window.createBackupSnapshot = async () => ({ ok: true, record: { id: "x" } });
    const good = { version: P.SETTINGS_BUNDLE_VERSION, layout: { version: window.__DDBStorage.SCHEMA_VERSION, sections: {} } };
    const r2 = await P.applySettingsBundle(good);
    assert.strictEqual(r2.ok, false);
    assert.strictEqual(r2.error, "cancelled");
    // backup fail
    window.destructiveGate = async () => ({ ok: true, record: { id: "x" } });
    window.createBackupSnapshot = async () => ({ ok: false, error: "quota" });
    const r3 = await P.applySettingsBundle(good);
    assert.strictEqual(r3.ok, false);
    assert.strictEqual(r3.error, "backup");
  });
});

describe("feature_07_persistence — handleLoadDefault gate & Persistence surface", function () {
  it("aborts before confirm when backup fails and toasts quota", async function () {
    const { window } = boot();
    const P = window.Persistence;
    assert.ok(typeof P.handleLoadDefault === "function");
    const toasts = [];
    window.showFeedback = (msg, type) => toasts.push({ msg, type });
    window.createBackupSnapshot = async () => ({ ok: false, error: "quota" });
    let confirmed = 0;
    window.confirmDestructive = async () => { confirmed += 1; return true; };
    await P.handleLoadDefault();
    assert.strictEqual(confirmed, 0);
    const err = toasts.find((t) => t.type === "error");
    assert.ok(err && /quota/.test(err.msg), JSON.stringify(toasts));
  });

  it("cancelling confirm leaves layout untouched", async function () {
    const { window } = boot();
    const P = window.Persistence; assert.ok(typeof P.handleLoadDefault === "function");
    window.createBackupSnapshot = async () => ({ ok: true, record: { id: "b1" } });
    window.confirmDestructive = async () => false;
    let applied = 0;
    window.applyDefaultLayout = async () => { applied += 1; };
    await window.Persistence.handleLoadDefault();
    assert.strictEqual(applied, 0);
  });

  it("Persistence surface fully exported", function () {
    const { window } = boot();
    const P = window.Persistence;
    const required = [
      "handleSaveBrowser","handleSavePC","handleLoadFile","handleExportSettings","handleImportSettings",
      "collectSettingsBundle","validateSettingsBundle","applySettingsBundle","SETTINGS_BUNDLE_VERSION",
      "restoreLayout","applyDefaultLayout","handleLoadDefault",
      "createBackupSnapshot","listBackups","pruneBackups","restoreBackupRecord",
      "detectLegacyLayout","versionNotice","announceBootRestore","MAX_BACKUPS",
    ];
    for (const k of required) assert.ok(k in P, "Persistence." + k);
    assert.strictEqual(typeof P.handleSaveBrowser, "function");
    assert.strictEqual(typeof P.SETTINGS_BUNDLE_VERSION, "string");
    assert.strictEqual(typeof P.MAX_BACKUPS, "number");
  });
});

describe("feature_07_persistence — applyDefaultLayout", function () {
  it("removes .be-shape-wrapper nodes and calls CatalogService.applyTemplate", async function () {
    const { window } = boot();
    const el = window.document.createElement("div");
    el.className = "be-shape-wrapper";
    window.document.body.appendChild(el);
    let tpl = null;
    window.CatalogService = { applyTemplate: async (id, f) => { tpl = { id, force: f }; } };
    // persistence.js resolves CatalogService via global at call time; expose on window
    window.eval("if(typeof CatalogService==='undefined') var CatalogService = window.CatalogService;");
    // ensure global visible: set as global var
    global.CatalogService = window.CatalogService;
    try {
      await window.Persistence.applyDefaultLayout();
      assert.strictEqual(window.document.querySelector(".be-shape-wrapper"), null);
      assert.ok(tpl && tpl.id === "archer" && tpl.force === true, JSON.stringify(tpl));
    } finally { delete global.CatalogService; }
  });
});
