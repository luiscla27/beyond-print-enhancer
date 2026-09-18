/**
 * First-run discoverability (selection_model_ia_20260910, Phase 2: AC-5 / U-28).
 *
 * The operator decision O-1 (spec.md §Operator decisions) ratified a ONE-TIME
 * DISMISSIBLE HINT CARD. These tests assert the acceptance criterion as written:
 * the hint appears on a fresh state, is dismissible, the dismissal PERSISTS, and
 * it does not reappear after a later boot. The "reload" is simulated the way the
 * product actually sees one: a fresh window whose chrome.storage.local already
 * holds the dismissal flag, booted through the same createControls() path.
 *
 * Phase 3 granted the `storage` permission, so this test's chromeStorage=true case is now
 * the production path. The chromeStorage=false case still runs — it is the fallback path
 * (a future commit revoking the permission would bring it back as production) AND the
 * regression guard that catches the hint re-appearing on every boot, which was the exact
 * failure that shipped once before.
 */
"use strict";

const assert = require("assert");
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const read = (p) => fs.readFileSync(path.resolve(__dirname, "../../js", p), "utf8");

const SRC = {
  elementWrapper: read("dom/element_wrapper.js"),
  domManager: read("dom/dom_manager.js"),
  storage: read("storage.js"),
  imageProcessor: read("image_processor.js"),
  sectionUtils: read("section_utils.js"),
  printStyles: read("print_styles.js"),
  uiTheme: read("ui_theme.js"),
  icons: read("icons.js"),
  assetCatalog: read("asset_catalog.js"),
  contextMenu: read("context_menu.js"),
  sectionCloning: read("section_cloning.js"),
  layoutOps: read("layout_ops.js"),
  filters: read("filters.js"),
  spellsUi: read("spells_ui.js"),
  modals: read("modals.js"),
  shapePicker: read("shape_picker.js"),
  propertiesPanel: read("properties_panel.js"),
  controls: read("controls.js"),
  layoutScan: read("layout_scan.js"),
  layoutApply: read("layout_apply.js"),
  persistence: read("persistence.js"),
  main: read("main.js"),
};

const SHEET = `<!DOCTYPE html><html><body>
  <div class="ct-character-sheet-desktop">
    <div class="ct-character-sheet__inner">
      <div id="print-layout-wrapper">
        <div id="print-enhance-sections-layer" class="pe-layer">
          <div class="be-section-wrapper" id="wrapper-one">
            <div class="print-section-container" id="section-one">
              <div class="print-section-header"><span>One</span></div>
            </div>
          </div>
        </div>
        <div id="print-enhance-shapes-layer" class="pe-layer">
          <div class="be-shape-layer-container pe-layer" id="shapes-default"></div>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

/**
 * Boot a window the way the extension does. `storedDismissal` seeds
 * chrome.storage.local, which is the persistence a real reload would carry.
 * `chromeStorage: false` boots WITHOUT chrome.storage at all — the LEGACY path: every
 * existing user who dismissed the hint before Phase 3 did so under localStorage, so this
 * case reads the fallback path and asserts a dismissal made before the permission grant
 * still holds after it. It is also the regression guard that catches the hint re-appearing
 * on every boot (the failure that shipped once before), because the same code path is what
 * a future commit revoking the permission would bring back as production.
 */
function boot({ storedDismissal = undefined, chromeStorage = true, hostFlag = null } = {}) {
  const dom = new JSDOM(SHEET, {
    url: "http://localhost",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  const window = dom.window;
  const document = window.document;

  global.window = window;
  global.document = document;
  global.HTMLElement = window.HTMLElement;
  global.NodeList = window.NodeList;
  global.Element = window.Element;
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  const { indexedDB, IDBKeyRange } = require("fake-indexeddb");
  window.indexedDB = indexedDB;
  window.IDBKeyRange = IDBKeyRange;
  global.indexedDB = indexedDB;
  global.IDBKeyRange = IDBKeyRange;

  window.confirm = () => true;
  window.alert = () => {};
  window.HTMLElement.prototype.scrollIntoView = function () {};

  // The store the product reads/writes (chrome.storage.local). Both call shapes
  // are supported by the product code; the promise shape is what MV3 gives.
  const store = {};
  if (storedDismissal !== undefined) store[window.__beHintKey || "beOnboardingHintDismissed"] = storedDismissal;
  window.__hintStoreWrites = [];
  window.__hintStore = store;
  window.chrome = {
    runtime: { getURL: (p) => (p ? String(p) : "") },
  };
  if (chromeStorage) {
    window.chrome.storage = {
      local: {
        get: (key) => Promise.resolve({ [key]: store[key] }),
        set: (obj) => {
          window.__hintStoreWrites.push(obj);
          Object.assign(store, obj);
          return Promise.resolve();
        },
      },
    };
  }
  // The host-origin path production actually uses.
  if (hostFlag) {
    window.localStorage.setItem(
      "ddbPrintEnhancer.onboardingHintDismissed",
      hostFlag,
    );
  }
  window.__DDB_TEST_MODE__ = true;

  [
    SRC.elementWrapper,
    SRC.domManager,
    SRC.storage,
    SRC.imageProcessor,
    SRC.sectionUtils,
    SRC.printStyles,
    SRC.uiTheme,
    SRC.icons,
    SRC.assetCatalog,
    SRC.contextMenu,
    SRC.sectionCloning,
    SRC.layoutOps,
    SRC.filters,
    SRC.spellsUi,
    SRC.modals,
    SRC.shapePicker,
    SRC.propertiesPanel,
    SRC.controls,
    SRC.layoutScan,
    SRC.layoutApply,
    SRC.persistence,
    SRC.main,
  ].forEach((src) => window.eval(src));

  // The control panel is the hint's host; the product creates it in
  // createControls(), and one case below exercises that real path.
  if (!document.getElementById("print-enhance-controls")) {
    const panel = document.createElement("div");
    panel.id = "print-enhance-controls";
    const body = document.createElement("div");
    body.className = "be-ctl-scroll";
    panel.appendChild(body);
    document.body.appendChild(panel);
  }

  return { window, document, store };
}

const cleanupGlobals = () => {
  delete global.window;
  delete global.document;
  delete global.HTMLElement;
  delete global.NodeList;
  delete global.Element;
  delete global.indexedDB;
  delete global.IDBKeyRange;
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

describe("first-run discoverability hint (AC-5, O-1)", function () {
  afterEach(function () {
    cleanupGlobals();
  });

  it("appears on a fresh state and states the three manipulation verbs", async function () {
    const { window, document } = boot();
    await window.Controls.mountOnboardingHint();
    await tick();

    const card = document.getElementById("be-onboarding-hint");
    assert.ok(card, "the hint card is mounted on a fresh state");
    assert.strictEqual(card.getAttribute("role"), "note", "it is a note, not a dialog");
    const text = card.querySelector(".be-onboarding-hint-text").textContent;
    ["Drag", "resize", "rotate"].forEach((verb) => {
      assert.ok(
        text.includes(verb),
        `the hint must name the manipulation verb "${verb}", got: ${text}`,
      );
    });
    assert.ok(
      card.querySelector(".be-onboarding-hint-dismiss"),
      "it carries a dismiss control",
    );
  });

  it("is dismissible, and dismissing PERSISTS the flag", async function () {
    const { window, document, store } = boot();
    await window.Controls.mountOnboardingHint();
    await tick();

    const card = document.getElementById("be-onboarding-hint");
    const dismiss = card.querySelector(".be-onboarding-hint-dismiss");
    dismiss.click();

    assert.strictEqual(
      document.getElementById("be-onboarding-hint"),
      null,
      "the card is gone after dismissal",
    );
    assert.strictEqual(
      store.beOnboardingHintDismissed,
      true,
      "the dismissal was written to the persistent store",
    );
    assert.ok(
      window.__hintStoreWrites.length >= 1,
      "…through the store's set()",
    );
  });

  it("does NOT reappear after a simulated reload (same store, new window)", async function () {
    // Session 1: dismiss.
    const first = boot();
    await first.window.Controls.mountOnboardingHint();
    await tick();
    first.window.document
      .querySelector(".be-onboarding-hint-dismiss")
      .click();
    const persisted = { ...first.store };
    cleanupGlobals();

    // Session 2: a fresh window that only shares the persistent store — this is
    // what a page reload looks like to the product.
    const second = boot({ storedDismissal: persisted.beOnboardingHintDismissed });
    await second.window.Controls.mountOnboardingHint();
    await tick();

    assert.strictEqual(
      second.window.document.getElementById("be-onboarding-hint"),
      null,
      "a dismissed hint must not come back on a later boot",
    );
    assert.ok(
      second.window.Controls.hintDismissed().then !== undefined,
      "the read accessor is async (store-backed)",
    );
    assert.strictEqual(
      await second.window.Controls.hintDismissed(),
      true,
      "and it reports the persisted dismissal",
    );
  });

  it("persists through the HOST-ORIGIN store when chrome.storage is absent", async function () {
    // WHAT THIS CASE DESCRIBED, AND WHAT IT DESCRIBES NOW. Until Phase 3 this was the REAL
    // production path: the manifest did not request the `storage` permission, so chrome.storage
    // was undefined in a content script. The first version of this feature relied on
    // chrome.storage and its test stubbed it — so the suite passed while the hint reappeared on
    // every real boot, and the phase-2 browser capture caught it.
    //
    // Phase 3 GRANTED `storage` (AC-V0 option (i)), so `chromeStorage: false` is no longer what
    // a shipped build boots with. It stays as a case because the API can still be absent: a user
    // can revoke the permission, and the write path must keep recording the dismissal in the
    // host store either way (that is what makes `rememberHintDismissed()` write BOTH stores).
    // The store-first production path and the empty-store read-through are the two cases after
    // this one; together the three pin every configuration this feature can run in.
    const first = boot({ chromeStorage: false });
    assert.strictEqual(
      typeof first.window.chrome.storage,
      "undefined",
      "precondition: no extension storage API, as in a revoked-permission install",
    );
    await first.window.Controls.mountOnboardingHint();
    await tick();
    const card = first.window.document.getElementById("be-onboarding-hint");
    assert.ok(card, "the hint still appears when chrome.storage is absent");
    card.querySelector(".be-onboarding-hint-dismiss").click();

    const hostValue = first.window.localStorage.getItem(
      "ddbPrintEnhancer.onboardingHintDismissed",
    );
    assert.strictEqual(
      hostValue,
      "true",
      "the dismissal was written to the host-origin store",
    );
    cleanupGlobals();

    // A later boot that carries only that stored value must not show the hint.
    const second = boot({ chromeStorage: false, hostFlag: hostValue });
    await second.window.Controls.mountOnboardingHint();
    await tick();
    assert.strictEqual(
      second.window.document.getElementById("be-onboarding-hint"),
      null,
      "a dismissed hint must not reappear on a later boot (host-origin path)",
    );
  });

  it("does NOT re-show a pre-grant dismissal once storage is granted (the read-through)", async function () {
    // Phase 3's side effect, asserted rather than promised. Granting `storage` makes
    // chrome.storage.local the preferred store — and for EVERY existing user it starts out
    // EMPTY, because their dismissal was recorded under the host-origin key. A `false` there is
    // "no record", not "never dismissed", so the lookup must fall through to localStorage.
    // Without the read-through, this is the exact state a real user boots into after the update
    // and the hint comes back.
    const legacy = boot({ chromeStorage: false });
    await legacy.window.Controls.mountOnboardingHint();
    await tick();
    legacy.window.document.querySelector(".be-onboarding-hint-dismiss").click();
    const hostValue = legacy.window.localStorage.getItem(
      "ddbPrintEnhancer.onboardingHintDismissed",
    );
    assert.strictEqual(hostValue, "true", "precondition: dismissed under the legacy key");
    cleanupGlobals();

    // The upgrade: same host flag, but now the extension HAS a store, and it has nothing in it.
    const upgraded = boot({ chromeStorage: true, hostFlag: hostValue });
    assert.deepStrictEqual(
      upgraded.store,
      {},
      "precondition: chrome.storage.local is empty, as it is for every existing user",
    );
    await upgraded.window.Controls.mountOnboardingHint();
    await tick();
    assert.strictEqual(
      upgraded.window.document.getElementById("be-onboarding-hint"),
      null,
      "the hint must not reappear for a user who already dismissed it (plan.md §Phase 3 carryover)",
    );
    assert.strictEqual(
      await upgraded.window.Controls.hintDismissed(),
      true,
      "and the accessor reports it, so no other caller re-derives the opposite",
    );
  });

  it("reports NOT dismissed when neither store has anything (a genuinely fresh install)", async function () {
    // The read-through's other side: falling back must not become "assume dismissed". A user
    // with an empty store and no host flag sees the hint — that is AC-5's first-run case, and
    // it is what keeps the previous assertion from passing by always returning true.
    const { window } = boot({ chromeStorage: true });
    assert.strictEqual(await window.Controls.hintDismissed(), false, "fresh install shows the hint");
    await window.Controls.mountOnboardingHint();
    await tick();
    assert.ok(
      window.document.getElementById("be-onboarding-hint"),
      "…and the mount path agrees with the accessor",
    );
  });

  it("is mounted by the REAL boot path (createControls), inside the panel", async function () {
    const { window, document } = boot();
    const panel = document.getElementById("print-enhance-controls");
    panel.remove(); // force createControls to build a fresh panel
    if (!document.getElementById("be-onboarding-hint")) {
      // fresh boot: no card yet, exactly as production starts
    }
    window.createControls();
    await tick();
    const card = document.getElementById("be-onboarding-hint");
    assert.ok(card, "the control panel's boot path mounts the hint");
    assert.strictEqual(
      card.parentElement.className,
      "be-ctl-scroll",
      "…inside the panel's scrolled body, so it covers neither the sheet nor panel rows",
    );
  });

  it("mounting twice is idempotent (one card, never two)", async function () {
    const { window, document } = boot();
    await window.Controls.mountOnboardingHint();
    await tick();
    await window.Controls.mountOnboardingHint();
    await tick();
    assert.strictEqual(
      document.querySelectorAll("#be-onboarding-hint").length,
      1,
      "exactly one card exists",
    );
  });

  it("lives INSIDE the control panel (never over the sheet), on-identity and token-based", async function () {
    const { window, document } = boot();
    await window.Controls.mountOnboardingHint();
    await tick();

    // The theme module (window.UiTheme was retired as a dead export by track
    // dead_exports_20260910, so the CSS is read from the module itself).
    const UiTheme = require("../../js/ui_theme.js");
    const css = UiTheme.css;
    const t = UiTheme.tokens;
    const cardRule = css.slice(
      css.indexOf("#be-onboarding-hint"),
      css.indexOf("#be-onboarding-hint .be-onboarding-hint-text"),
    );

    // The card must not obscure the sheet: it is a CHILD of the control panel,
    // never a floating overlay (the phase-2 gate rejected the overlay version
    // for covering sheet content), and its paint comes from the locked tokens.
    assert.strictEqual(
      document.getElementById("be-onboarding-hint").parentElement.className,
      "be-ctl-scroll",
      "the card sits in the panel's own SCROLLED body (its own space, no overlap)",
    );
    assert.ok(
      !/position: fixed !important/.test(cardRule),
      "it is not a fixed overlay over the sheet",
    );
    assert.ok(
      cardRule.includes(`background: ${t.groundTray} !important`),
      `the card's ground is the groundTray token (${t.groundTray})`,
    );
    assert.ok(
      cardRule.includes(`border: 1px solid ${t.hairGold} !important`),
      `its seam is the hairGold token (${t.hairGold})`,
    );
    assert.ok(
      cardRule.includes(`color: ${t.bone} !important`),
      `its text is the bone token (${t.bone})`,
    );
    // …and the dismiss control takes the T1 action tier.
    const dismissRule = css.slice(
      css.indexOf("#be-onboarding-hint .be-onboarding-hint-dismiss"),
      css.indexOf("#be-onboarding-hint .be-onboarding-hint-dismiss:hover"),
    );
    assert.ok(
      dismissRule.includes(`height: ${UiTheme.tiers.action}px`),
      `the dismiss button is a T1 action (${UiTheme.tiers.action}px)`,
    );
    // No hex that is NOT a locked token value in these two rules.
    const tokenValues = new Set(Object.values(t).filter((v) => typeof v === "string"));
    const hexes = `${cardRule} ${dismissRule}`.match(/#[0-9a-fA-F]{6}\b/g) || [];
    hexes.forEach((hex) => {
      assert.ok(
        tokenValues.has(hex) || tokenValues.has(hex.toUpperCase()),
        `${hex} in the hint's rules is not a locked token value`,
      );
    });
    assert.ok(document.getElementById("be-onboarding-hint"), "card present");
  });

  it("never prints", function () {
    const src = read("print_styles.js");
    assert.ok(
      src.includes("#be-onboarding-hint"),
      "the hint is listed in the print hide rules",
    );
    const idx = src.indexOf("#be-onboarding-hint");
    const surroundings = src.slice(idx, idx + 200);
    assert.ok(
      /display: none !important/.test(surroundings),
      "…where it is hidden",
    );
  });
});
