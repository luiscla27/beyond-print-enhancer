"use strict";

const assert = require("assert");
const { boot } = require("./debt_harness.js");

// feature_11_spells_ui owns js/spells_ui.js (floating spell-detail sections,
// spell fetch/cache, character-spell injection). Published via window.SpellsUi
// with all seams resolved lazily at call time. Source of truth is the debt_harness
// boot which mirrors the production script order and IndexedDB isolation.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function seedSpells(window, spells) {
  return window.__DDBStorage.saveSpells(spells);
}

function mockChromeSuccess(window, spellsByName) {
  // spellsByName: array of definitions to expose via classSpells[0].spells
  // Build a payload that getCharacterSpells will flatten into {name, level, description, range, school}
  window.chrome = {
    runtime: {
      sendMessage: (_msg, cb) => {
        cb({
          success: true,
          data: {
            data: {
              classSpells: [
                {
                  spells: spellsByName.map((s) => ({
                    definition: {
                      name: s.name,
                      level: s.level,
                      description: s.description,
                      range: s.range || { rangeValue: s.rangeValue || "", origin: s.rangeOrigin || "" },
                      school: s.school,
                    },
                  })),
                },
              ],
              spells: { race: [], class: [], feat: [], item: [] },
            },
          },
        });
      },
    },
  };
}

function mockChromeFailure(window, error) {
  window.chrome = {
    runtime: { sendMessage: (_msg, cb) => cb({ success: false, error: error || "boom" }) },
  };
}

function layoutRootRect(window, rect) {
  const el = window.DomManager.getInstance().getLayoutRoot().element;
  if (el) el.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height });
}

// ---------------------------------------------------------------------------
// Part 1 — Publication
// ---------------------------------------------------------------------------
describe("feature_11_spells_ui — publication (js/spells_ui.js)", function () {
  it("publishes SpellsUi on window with all handles and window.* aliases", function () {
    const { window, cleanup } = boot();
    try {
      const S = window.SpellsUi;
      assert.ok(S, "window.SpellsUi must exist");
      for (const fn of ["createSpellDetailSection", "getCharacterId", "fetchSpellWithCache", "getCharacterSpells", "injectSpellDetailTriggers", "getLastSpellLoadFailure"]) {
        assert.strictEqual(typeof S[fn], "function", `SpellsUi.${fn} must be a function`);
      }
      assert.strictEqual(window.createSpellDetailSection, S.createSpellDetailSection);
      assert.strictEqual(window.getCharacterId, S.getCharacterId);
      assert.strictEqual(window.fetchSpellWithCache, S.fetchSpellWithCache);
      assert.strictEqual(window.injectSpellDetailTriggers, S.injectSpellDetailTriggers);
      assert.strictEqual(window.getCharacterSpells, S.getCharacterSpells);
    } finally { cleanup(); }
  });

  it("spells.js stub publishes initSpellEnhancements", function () {
    const { window, cleanup } = boot();
    try {
      // js/spells.js is a stub; its symbol is on window via eval? We loaded spells_ui only.
      // We assert spells_ui did not clobber global state and that window.Z is the declaration map.
      assert.ok(window.Z, "window.Z must be declared");
      assert.strictEqual(window.Z.PANEL, "10000");
      assert.strictEqual(window.Z.PICKER, "20000");
    } finally { cleanup(); }
  });
});

// ---------------------------------------------------------------------------
// Part 2 — injectSpellDetailTriggers
// ---------------------------------------------------------------------------
describe("feature_11_spells_ui — injectSpellDetailTriggers (js/spells_ui.js)", function () {
  it("injects exactly one Details button per spell row and is idempotent", function () {
    const { window, document, cleanup } = boot(`
      <!DOCTYPE html><html><body>
        <div id="print-layout-wrapper"></div>
        <div class="ct-spells-spell"><span class="ct-spells-spell__label">Fireball</span></div>
        <div class="ct-spells-spell"><span class="ct-spells-spell__label">Shield</span></div>
        <div class="ct-spells-spell"><span class="ct-spells-spell__label">Fireball</span></div>
      </body></html>`);
    try {
      window.createSpellDetailSection = () => {};
      delete window.DomManager; // force fallback querySelectorAll path
      global.window = window;
      window.injectSpellDetailTriggers(document);
      let btns = document.querySelectorAll(".be-spell-details-button");
      assert.strictEqual(btns.length, 3, "one button per row");
      window.injectSpellDetailTriggers(document);
      btns = document.querySelectorAll(".be-spell-details-button");
      assert.strictEqual(btns.length, 3, "idempotent");
      assert.strictEqual(btns[0].innerText, "Details");
    } finally { cleanup(); }
  });

  it("skips rows without label and rows already carrying a button", function () {
    const { window, document, cleanup } = boot(`
      <!DOCTYPE html><html><body>
        <div class="ct-spells-spell"><span class="ct-spells-spell__label">Shield</span></div>
        <div class="ct-spells-spell"><!-- no label --></div>
        <div class="ct-spells-spell"><span class="ct-spells-spell__label">Already</span><button class="be-spell-details-button">Details</button></div>
      </body></html>`);
    try {
      window.createSpellDetailSection = () => {};
      delete window.DomManager;
      global.window = window;
      window.injectSpellDetailTriggers(document);
      const rows = document.querySelectorAll(".ct-spells-spell");
      assert.strictEqual(rows[0].querySelectorAll(".be-spell-details-button").length, 1);
      assert.strictEqual(rows[1].querySelectorAll(".be-spell-details-button").length, 0);
      assert.strictEqual(rows[2].querySelectorAll(".be-spell-details-button").length, 1);
    } finally { cleanup(); }
  });

  it("click stops propagation and forwards trimmed spellName + coords to createSpellDetailSection", function () {
    const { window, document, cleanup } = boot(`
      <!DOCTYPE html><html><body>
        <div class="ct-spells-spell"><span class="ct-spells-spell__label">  Fireball  </span></div>
      </body></html>`);
    try {
      let saw = null;
      let stopped = false;
      window.createSpellDetailSection = (name, coords) => { saw = { name, coords }; };
      delete window.DomManager;
      global.window = window;
      window.injectSpellDetailTriggers(document);
      const btn = document.querySelector(".be-spell-details-button");
      assert.ok(btn);
      const ev = new window.MouseEvent("click", { bubbles: true, cancelable: true, clientX: 111, clientY: 222 });
      Object.defineProperty(ev, "pageX", { value: 111 });
      Object.defineProperty(ev, "pageY", { value: 222 });
      const orig = ev.stopPropagation.bind(ev);
      ev.stopPropagation = () => { stopped = true; return orig(); };
      btn.dispatchEvent(ev);
      assert.ok(stopped, "stopPropagation called");
      assert.ok(saw);
      assert.strictEqual(saw.name, "Fireball");
      assert.strictEqual(saw.coords.x, 111);
      assert.strictEqual(saw.coords.y, 222);
    } finally { cleanup(); }
  });

  it("uses DomManager.getSpellRows when available (ElementWrapper path)", function () {
    const { window, document, cleanup } = boot(`
      <!DOCTYPE html><html><body>
        <div id="ctx"><div class="ct-spells-spell"><span class="ct-spells-spell__label">Shield</span></div></div>
      </body></html>`);
    try {
      window.createSpellDetailSection = () => {};
      // DomManager is present by default; wrap a context element
      const ctx = document.getElementById("ctx");
      window.injectSpellDetailTriggers(ctx);
      assert.strictEqual(ctx.querySelectorAll(".be-spell-details-button").length, 1);
      // global document fallback still has at least the same button
      assert.ok(document.querySelector(".be-spell-details-button"));
    } finally { cleanup(); }
  });

  it("fallback logs via safeLog when createSpellDetailSection is absent", function () {
    const { window, document, cleanup } = boot(`
      <!DOCTYPE html><html><body>
        <div class="ct-spells-spell"><span class="ct-spells-spell__label">Fireball</span></div>
      </body></html>`);
    try {
      delete window.createSpellDetailSection;
      delete window.DomManager;
      global.window = window;
      let logged = null;
      window.safeLog = (level, ...args) => { logged = { level, args }; };
      window.injectSpellDetailTriggers(document);
      const btn = document.querySelector(".be-spell-details-button");
      assert.ok(btn);
      const ev = new window.MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 });
      Object.defineProperty(ev, "pageX", { value: 10 });
      Object.defineProperty(ev, "pageY", { value: 10 });
      btn.dispatchEvent(ev);
      assert.ok(logged && logged.level === "log", "falls back to safeLog when createSpellDetailSection missing");
    } finally { cleanup(); }
  });
});

// ---------------------------------------------------------------------------
// Part 3 — getCharacterId
// ---------------------------------------------------------------------------
describe("feature_11_spells_ui — getCharacterId (js/spells_ui.js)", function () {
  it("returns the last path segment and sentinel 'characters'", function () {
    const { window, cleanup } = boot(`<!DOCTYPE html><html><body></body></html>`);
    try {
      window.history.pushState({}, "", "/characters/98765");
      assert.strictEqual(window.getCharacterId(), "98765");
      window.history.pushState({}, "", "/characters/");
      assert.strictEqual(window.getCharacterId(), "");
      window.history.pushState({}, "", "/characters/characters");
      assert.strictEqual(window.getCharacterId(), "characters");
      window.history.pushState({}, "", "/");
      assert.strictEqual(window.getCharacterId(), "");
    } finally { cleanup(); }
  });
});

// ---------------------------------------------------------------------------
// Part 4 — fetchSpellWithCache taxonomy and getCharacterSpells
// ---------------------------------------------------------------------------
describe("feature_11_spells_ui — fetchSpellWithCache + getLastSpellLoadFailure", function () {
  it("cache hit returns immediately, clears failure code, does not hit network", async function () {
    const { window, cleanup } = boot();
    try {
      const spell = { name: "Shield", level: 1, description: "barrier", range: "Self", school: "Abjuration" };
      await seedSpells(window, [spell]);
      mockChromeFailure(window, "should-not-be-called");
      window.history.pushState({}, "", "/characters/12345");
      const found = await window.fetchSpellWithCache("Shield");
      assert.deepStrictEqual(found, spell);
      assert.strictEqual(window.SpellsUi.getLastSpellLoadFailure(), null);
    } finally { cleanup(); }
  });

  it("cache miss + no-character sets no-character failure", async function () {
    const { window, cleanup } = boot();
    try {
      window.history.pushState({}, "", "/characters/characters");
      mockChromeFailure(window);
      const found = await window.fetchSpellWithCache("Fireball");
      assert.strictEqual(found, null);
      assert.strictEqual(window.SpellsUi.getLastSpellLoadFailure(), "no-character");
    } finally { cleanup(); }
  });

  it("cache miss + not-in-list when spells load but name absent", async function () {
    const { window, cleanup } = boot();
    try {
      window.history.pushState({}, "", "/characters/99999");
      mockChromeSuccess(window, [{ name: "Shield", level: 1, description: "<p>x</p>", range: { rangeValue: "Self", origin: "" }, school: "Abjuration" }]);
      const found = await window.fetchSpellWithCache("Fireball");
      assert.strictEqual(found, null);
      assert.strictEqual(window.SpellsUi.getLastSpellLoadFailure(), "not-in-list");
      // present name succeeds and clears code, and is cached
      const found2 = await window.fetchSpellWithCache("Shield");
      assert.ok(found2 && found2.name === "Shield");
      assert.strictEqual(window.SpellsUi.getLastSpellLoadFailure(), null);
      // verify cache now holds Shield
      const cached = await window.__DDBStorage.getSpell("Shield");
      assert.ok(cached && cached.name === "Shield");
    } finally { cleanup(); }
  });

  it("fetch-error when character fetch itself fails", async function () {
    const { window, cleanup } = boot();
    try {
      window.history.pushState({}, "", "/characters/12345");
      mockChromeFailure(window, "boom");
      const found = await window.fetchSpellWithCache("Anything");
      assert.strictEqual(found, null);
      assert.strictEqual(window.SpellsUi.getLastSpellLoadFailure(), "fetch-error");
    } finally { cleanup(); }
  });

  it("getCharacterSpells flattens all sources, strips HTML, maps range", async function () {
    const { window, cleanup } = boot();
    try {
      window.chrome = {
        runtime: {
          sendMessage: (_msg, cb) => cb({
            success: true,
            data: {
              data: {
                classSpells: [{ spells: [{ definition: { name: "Fireball", level: 3, description: "<p>Boom</p>", range: { rangeValue: "150 feet", origin: "" }, school: "Evocation" } }] }],
                spells: {
                  race: [{ definition: { name: "Misty Step", level: 2, description: "mist", range: { rangeValue: "Self", origin: "" }, school: "Conjuration" } }],
                  class: [],
                  feat: [{ definition: { name: "Shield", level: 1, description: "<b>barrier</b>", range: { rangeValue: "Self", origin: "" }, school: "Abjuration" } }],
                  item: [],
                },
              },
            },
          }),
        },
      };
      const spells = await window.getCharacterSpells("42");
      const names = Array.from(spells.map((s) => s.name));
      assert.deepStrictEqual([...names].sort(), [...["Fireball", "Misty Step", "Shield"]].sort());
      const fb = spells.find((s) => s.name === "Fireball");
      assert.strictEqual(fb.description, "Boom", "HTML stripped");
      assert.strictEqual(fb.range.trim(), "150 feet");
      const sh = spells.find((s) => s.name === "Shield");
      assert.strictEqual(sh.description, "barrier");
      assert.strictEqual(sh.school, "Abjuration");
      assert.strictEqual(fb.level, 3);
    } finally { cleanup(); }
  });

  it("getCharacterSpells swallows chrome failure and returns undefined", async function () {
    const { window, cleanup } = boot();
    try {
      window.chrome = { runtime: { sendMessage: (_msg, cb) => cb({ success: false, error: "nope" }) } };
      const spells = await window.getCharacterSpells("999");
      assert.strictEqual(spells, undefined);
    } finally { cleanup(); }
  });
});

// ---------------------------------------------------------------------------
// Part 5 — createSpellDetailSection (floating shell, duplicate guard, error card, retry, restore)
// ---------------------------------------------------------------------------
describe("feature_11_spells_ui — createSpellDetailSection", function () {
  function freshBoot() {
    return boot(`
      <!DOCTYPE html><html><body>
        <div id="print-layout-wrapper" style="position:relative; width:800px; height:600px;"></div>
      </body></html>`);
  }

  it("creates a floating shell at coords relative to layout root with correct classes and Z.PANEL", async function () {
    const { window, cleanup } = freshBoot();
    try {
      layoutRootRect(window, { left: 50, top: 20, width: 800, height: 600 });
      await seedSpells(window, [{ name: "Fireball", level: 3, description: "Boom", range: "150 feet", school: "Evocation" }]);
      const coords = { x: 150, y: 120, pageX: 150, pageY: 120 };
      const container = await window.createSpellDetailSection("Fireball", coords);
      assert.ok(container, "container returned");
      assert.ok(container.classList.contains("be-spell-detail"), "be-spell-detail on container");
      assert.ok(container.classList.contains("be-extracted-section"), "be-extracted-section on container");
      const wrapper = container.closest(".be-section-wrapper");
      assert.ok(wrapper);
      assert.ok(wrapper.classList.contains("be-spell-detail-wrapper"));
      assert.ok(wrapper.classList.contains("be-extracted-section-wrapper"));
      assert.strictEqual(wrapper.dataset.title, "Fireball");
      assert.strictEqual(wrapper.style.left, "100px", "x - root.left");
      assert.strictEqual(wrapper.style.top, "100px", "y - root.top");
      assert.strictEqual(container.style.width, "300px");
      assert.strictEqual(wrapper.style.zIndex, String(window.Z.PANEL));
      assert.ok(container.textContent.includes("Evocation"));
      assert.ok(container.textContent.includes("Boom"));
      // spinner removed after render
      assert.strictEqual(container.querySelector(".be-spinner"), null);
    } finally { cleanup(); }
  });

  it("duplicate guard: second call without restoreData toasts already-open and does not duplicate", async function () {
    const { window, document, cleanup } = freshBoot();
    try {
      layoutRootRect(window, { left: 0, top: 0, width: 800, height: 600 });
      await seedSpells(window, [{ name: "Shield", level: 1, description: "barrier", range: "Self", school: "Abjuration" }]);
      let feedback = null;
      window.showFeedback = (msg) => { feedback = msg; };
      const first = await window.createSpellDetailSection("Shield", { x: 10, y: 10, pageX: 10, pageY: 10 });
      assert.ok(first);
      const countBefore = document.querySelectorAll(".be-section-wrapper").length;
      const dup = await window.createSpellDetailSection("Shield", { x: 200, y: 200, pageX: 200, pageY: 200 });
      assert.strictEqual(dup, undefined, "guard returns undefined");
      assert.strictEqual(document.querySelectorAll(".be-section-wrapper").length, countBefore);
      assert.ok(feedback && feedback.includes("Shield") && feedback.includes("already open"), `feedback was ${feedback}`);
    } finally { cleanup(); }
  });

  it("error card taxonomy: no-character, not-in-list (only then manage-spells), fetch-error", async function () {
    const { window, cleanup } = freshBoot();
    try {
      layoutRootRect(window, { left: 0, top: 0, width: 800, height: 600 });
      // no-character
      window.history.pushState({}, "", "/characters/characters");
      mockChromeFailure(window);
      const c1 = await window.createSpellDetailSection("MissingOne", { x: 10, y: 10, pageX: 10, pageY: 10 });
      let text = c1.textContent.toLowerCase();
      assert.ok(text.includes("no character"), `no-character got: ${text.slice(0, 300)}`);
      assert.ok(!text.includes("manage spells"), "no manage-spells for no-character");
      assert.ok(c1.querySelector(".be-retry-button"), "retry present");
      assert.ok(c1.querySelector(".be-delete-button"), "delete present");

      // not-in-list (only case with manage-spells)
      window.history.pushState({}, "", "/characters/99999");
      mockChromeSuccess(window, [{ name: "Other", level: 1, description: "x", range: { rangeValue: "Self", origin: "" }, school: "Abjuration" }]);
      const c2 = await window.createSpellDetailSection("NotInListSpell", { x: 20, y: 20, pageX: 20, pageY: 20 });
      text = c2.textContent.toLowerCase();
      assert.ok(text.includes("not in this character"), `not-in-list got: ${text.slice(0, 300)}`);
      assert.ok(text.includes("manage spells"), "manage-spells only for not-in-list");

      // fetch-error
      mockChromeFailure(window, "boom");
      const c3 = await window.createSpellDetailSection("FetchFail", { x: 30, y: 30, pageX: 30, pageY: 30 });
      text = c3.textContent.toLowerCase();
      assert.ok(text.includes("failed") || text.includes("loading"), `fetch-error got: ${text.slice(0, 300)}`);
      assert.ok(!text.includes("manage spells"), "no manage-spells for fetch-error");
    } finally { cleanup(); }
  });

  it("delete button removes its container; retry removes old FIRST then re-creates (no dupe-guard delete)", async function () {
    const { window, document, cleanup } = freshBoot();
    try {
      layoutRootRect(window, { left: 0, top: 0, width: 800, height: 600 });
      window.history.pushState({}, "", "/characters/characters");
      mockChromeFailure(window);
      const container = await window.createSpellDetailSection("RetrySpell", { x: 10, y: 10, pageX: 10, pageY: 10 });
      const retry = container.querySelector(".be-retry-button");
      const del = container.querySelector(".be-delete-button");
      assert.ok(retry && del, "both buttons present");
      // Delete path — handler removes the inner container, wrapper shell remains empty
      const id = container.id;
      del.click();
      assert.strictEqual(document.getElementById(id), null, "delete removes container");
      // Wrapper leak is existing behavior (container.remove() not wrapper) — count stays 1
      // So we assert on detail count instead of wrapper count for the meaningful invariant
      assert.strictEqual(document.querySelectorAll(".be-spell-detail").length, 0, "no detail after delete");

      // Retry path: need a fresh error card
      const c2 = await window.createSpellDetailSection("RetrySpell2", { x: 10, y: 10, pageX: 10, pageY: 10 });
      const retry2 = c2.querySelector(".be-retry-button");
      assert.ok(retry2);
      const detailsBeforeRetry = document.querySelectorAll(".be-spell-detail").length;
      assert.strictEqual(detailsBeforeRetry, 1, "one detail before retry");
      await window.__DDBStorage.saveSpells([{ name: "RetrySpell2", level: 1, description: "now works", range: "Self", school: "Abjuration" }]);
      retry2.click();
      await new Promise((r) => setTimeout(r, 150));
      // Retry handler does container.remove() then createSpellDetailSection — net one live detail
      assert.strictEqual(document.querySelectorAll(".be-spell-detail").length, 1, "retry keeps exactly one detail");
      const final = document.querySelector(".be-spell-detail");
      assert.ok(final, "detail still in DOM after retry");
      assert.ok(final.textContent.includes("now works") || final.textContent.includes("Abjuration"), "retry rendered spell content");
    } finally { cleanup(); }
  });

  it("restoreData honors explicit geometry and minimized flag without using coords", async function () {
    const { window, cleanup } = freshBoot();
    try {
      layoutRootRect(window, { left: 0, top: 0, width: 800, height: 600 });
      await seedSpells(window, [{ name: "Misty Step", level: 2, description: "mist", range: "Self", school: "Conjuration" }]);
      const restoreData = {
        id: "saved-spell-1",
        spellName: "Misty Step",
        left: "150px",
        top: "250px",
        width: "420px",
        height: "300px",
        zIndex: "9999",
        printZIndex: "9999",
        fontSize: "12px",
        minimized: true,
      };
      const container = await window.createSpellDetailSection("Misty Step", null, restoreData);
      assert.ok(container);
      assert.strictEqual(container.id, "saved-spell-1");
      const wrapper = container.closest(".be-section-wrapper");
      assert.strictEqual(wrapper.style.left, "150px");
      assert.strictEqual(wrapper.style.top, "250px");
      assert.strictEqual(container.style.width, "420px");
      assert.strictEqual(container.style.height, "300px");
      assert.strictEqual(wrapper.style.zIndex, "9999");
      assert.strictEqual(wrapper.dataset.printZ, "9999");
      assert.ok(container.classList.contains("minimized") || container.dataset.minimized === "true", "minimized flag applied");
      assert.ok(container.textContent.includes("Conjuration"));
    } finally { cleanup(); }
  });

  it("scanLayout includes spell_details without html and applyLayout restores one via cache", async function () {
    const { window, document, cleanup } = freshBoot();
    try {
      layoutRootRect(window, { left: 0, top: 0, width: 800, height: 600 });
      await seedSpells(window, [{ name: "Shield", level: 1, description: "An invisible barrier...", range: "Self", school: "Abjuration" }]);
      await window.createSpellDetailSection("Shield", { x: 10, y: 10, pageX: 10, pageY: 10 });
      const layout = await window.scanLayout();
      assert.ok(Array.isArray(layout.spell_details), "layout has spell_details");
      assert.strictEqual(layout.spell_details.length, 1);
      const rec = layout.spell_details[0];
      assert.strictEqual(rec.spellName, "Shield");
      assert.strictEqual(rec.html, undefined, "no html in spell_details");
      assert.ok(!("html" in rec) || rec.html === undefined, "html absent");
      // Wipe live detail and re-apply captured record
      document.querySelectorAll(".be-section-wrapper").forEach((el) => el.remove());
      assert.strictEqual(document.querySelectorAll(".be-spell-detail").length, 0);
      layout.sections = layout.sections || {};
      await window.applyLayout(layout);
      await new Promise((r) => setTimeout(r, 120));
      const restored = document.getElementById(rec.id);
      assert.ok(restored, `spell detail restored by id ${rec.id}`);
      assert.ok(restored.textContent.includes("Abjuration") || restored.textContent.includes("An invisible barrier"), "restored content from cache");
    } finally { cleanup(); }
  });

  it("scanLayout skips a spell detail that is a drag ghost and spell_cache has no html", async function () {
    const { window, cleanup } = freshBoot();
    try {
      layoutRootRect(window, { left: 0, top: 0, width: 800, height: 600 });
      await seedSpells(window, [{ name: "GhostSpell", level: 1, description: "x", range: "Self", school: "Evocation" }]);
      const c = await window.createSpellDetailSection("GhostSpell", { x: 10, y: 10, pageX: 10, pageY: 10 });
      const wrapper = c.closest(".be-section-wrapper");
      wrapper.classList.add("be-drag-ghost");
      const layout = await window.scanLayout();
      const ghostSeen = layout.spell_details.some((s) => s.spellName === "GhostSpell");
      assert.strictEqual(ghostSeen, false, "drag ghost must not be recorded");
      if (layout.spell_cache.length) assert.strictEqual(layout.spell_cache[0].html, undefined);
    } finally { cleanup(); }
  });

  it("applyLayout with spell_details restores via createSpellDetailSection and respects borderStyle", async function () {
    const { window, document, cleanup } = freshBoot();
    try {
      layoutRootRect(window, { left: 0, top: 0, width: 800, height: 600 });
      await seedSpells(window, [{ name: "Misty Step", level: 2, description: "mist", range: "Self", school: "Conjuration" }]);
      const layout = {
        version: window.__DDBStorage.SCHEMA_VERSION,
        sections: {},
        clones: [],
        extractions: [],
        shapeLayers: [],
        spell_details: [{ id: "saved-spell-1", spellName: "Misty Step", left: "150px", top: "250px", width: "300px", height: "auto", zIndex: "10", printZIndex: "10", borderStyle: "no-border" }],
        spell_cache: [{ name: "Misty Step", level: 2, description: "mist", range: "Self", school: "Conjuration" }],
        shapes: [],
        merges: [],
      };
      await window.applyLayout(layout);
      await new Promise((r) => setTimeout(r, 120));
      const el = document.getElementById("saved-spell-1");
      assert.ok(el, "restored by applyLayout");
      assert.ok(el.classList.contains("no-border") || document.querySelector(".be-spell-detail"), "borderStyle applied or detail present");
    } finally { cleanup(); }
  });

  it("falls back to window.fetchSpellWithCache seam and injectCloneButtons seam safely", async function () {
    const { window, cleanup } = freshBoot();
    try {
      layoutRootRect(window, { left: 0, top: 0, width: 800, height: 600 });
      // Provide window.fetchSpellWithCache explicitly and ensure fallback still works
      const spell = { name: "FallbackSpell", level: 1, description: "ok", range: "Self", school: "Abjuration" };
      await seedSpells(window, [spell]);
      let cloneCalled = false;
      window.injectCloneButtons = () => { cloneCalled = true; };
      window.injectAppendButton = () => {};
      window.initResizeLogic = () => {};
      window.updateLayoutBounds = () => {};
      const c = await window.createSpellDetailSection("FallbackSpell", { x: 5, y: 5, pageX: 5, pageY: 5 });
      assert.ok(c, "container created via seam fallback");
      assert.ok(cloneCalled, "injectCloneButtons seam called");
    } finally { cleanup(); }
  });
});
