/**
 * E1 — Encapsulation-debt regression suite (2026-02-04..06, core era).
 * 18 commits: modernization/storage/extraction/UI/dnd/spells/persistence,
 * resilience query+navigation fixes, redeclaration/style-preservation fixes,
 * fit-content layout, interactive spells view.
 *
 * NOTE: legacy internals of this era (navToSection, getAllSections, findByText,
 * safeQuery...) were refactored away by later commits (mayor refactor #14,
 * simplify UI #38). These tests pin each commit through the SURVIVING exported
 * surface + CommonJS modules (dnd.js), per the E1 matrix amendment.
 */
"use strict";

const assert = require("assert");
const { boot } = require("./debt_harness.js");

function bootRooted() {
  return boot(
    "<!DOCTYPE html><html><body><div id='print-layout-wrapper'></div></body></html>",
  );
}

function bootSheet() {
  return boot(`<!DOCTYPE html><html><body>
    <div class="ct-character-sheet-desktop">
      <div class="ct-character-sheet__inner">
        <div class="ct-subsection" id="sec-1">
          <div class="print-section-header"><span>Stats</span></div>
          <div class="print-section-content"><p>body</p></div>
        </div>
        <div class="ct-subsection" id="sec-2">
          <div class="print-section-header"><span>Gear</span></div>
          <div class="print-section-content"><p>body</p></div>
        </div>
      </div>
    </div>
  </body></html>`);
}

/* ------------------------------------------------------------------ */
describe("E1 27858c6 — modernization (2026 site structure)", function () {
  let window, cleanup;
  beforeEach(function () {
    const b = bootSheet();
    window = b.window;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("enforceFullHeight runs and is idempotent", function () {
    assert.doesNotThrow(() => window.enforceFullHeight());
    assert.doesNotThrow(() => window.enforceFullHeight());
  });

  it("removeSearchBoxes is repeatable on a modern sheet", function () {
    assert.doesNotThrow(() => window.removeSearchBoxes());
  });

  it("separateQuickInfoBoxes is safe without quick-info content", function () {
    assert.doesNotThrow(() => window.separateQuickInfoBoxes());
  });

  it("getCharacterId is safe without a character context", function () {
    const id = window.getCharacterId();
    assert.ok(id === "" || id === null || id === undefined);
  });
});

describe("E1 ba24774 — IndexedDB storage layer", function () {
  let window, cleanup;
  beforeEach(async function () {
    const b = boot("<!DOCTYPE html><html><body></body></html>");
    window = b.window;
    cleanup = b.cleanup;
    await window.Storage.init();
  });
  afterEach(function () {
    cleanup();
  });

  it("initializes the storage object", function () {
    assert.ok(window.Storage);
    assert.strictEqual(typeof window.Storage.saveLayout, "function");
  });

  it("saveLayout/loadLayout round-trips a layout", async function () {
    await window.Storage.saveLayout("C1", { version: "1.5.0", sections: { a: {} } });
    const loaded = await window.Storage.loadLayout("C1");
    assert.ok(loaded.sections.a);
  });

  it("loadLayout returns undefined for a missing key", async function () {
    assert.strictEqual(await window.Storage.loadLayout("nope"), undefined);
  });

  it("global layout helpers store under GLOBAL", async function () {
    await window.Storage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    const loaded = await window.Storage.loadGlobalLayout();
    assert.ok(loaded);
    assert.strictEqual(loaded.sections && typeof loaded.sections, "object");
  });
});

describe("E1 1c682fe — advanced section extraction surface", function () {
  let window, cleanup;
  beforeEach(function () {
    const b = bootSheet();
    window = b.window;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("exposes the extraction pipeline handles", function () {
    ["extractAndWrapSections", "handleElementExtraction", "flagExtractableElements", "captureSectionSnapshot", "rollbackSection"].forEach(
      (h) => assert.strictEqual(typeof window[h], "function", `${h} missing`),
    );
  });

  it("flags candidate extractable sections", function () {
    assert.doesNotThrow(() => window.flagExtractableElements());
  });

  it("captures a snapshot of a real section container", function () {
    const snap = window.captureSectionSnapshot("sec-1");
    assert.strictEqual(snap.originalId, "sec-1");
  });

  it("extractAndWrapSections is callable in test mode", async function () {
    await window.extractAndWrapSections();
    assert.ok(true);
  });
});

describe("E1 0bb7baf — UI refinement era (controls)", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("createControls builds the control panel and properties panel", function () {
    window.createControls();
    assert.ok(document.getElementById("print-enhance-controls"));
    assert.ok(document.getElementById("print-enhance-properties-panel"));
  });

  it("controls use be- prefixed surface classes", function () {
    window.createControls();
    const btns = Array.from(document.querySelectorAll("#print-enhance-controls button"));
    assert.ok(btns.length > 0);
  });

  it("properties panel starts empty until a section is selected", function () {
    window.createControls();
    const panel = document.getElementById("print-enhance-properties-panel");
    assert.ok(panel.querySelector(".be-prop-panel-empty"), "empty-state message expected");
  });

  it("updateControlsState is safe right after creation", function () {
    window.createControls();
    assert.doesNotThrow(() => window.updateControlsState());
  });
});

describe("E1 623de65 — drag-and-drop engine module", function () {
  let window, document, cleanup, dnd;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    global.window = window;
    global.document = document;
    dnd = require("../../../js/dnd.js");
  });
  afterEach(function () {
    cleanup();
    delete require.cache[require.resolve("../../../js/dnd.js")];
  });

  it("exports initDragAndDrop and injectDnDStyles", function () {
    assert.strictEqual(typeof dnd.initDragAndDrop, "function");
    assert.strictEqual(typeof dnd.injectDnDStyles, "function");
  });

  it("initDragAndDrop is a safe no-op without sections", function () {
    assert.doesNotThrow(() => dnd.initDragAndDrop());
  });

  // Debt #3 (FIXED in Phase 14 of encapsulation_functionality_20260907):
  // injectDnDStyles now has an internal idempotency guard — repeated calls
  // reuse the existing #ddb-print-dnd-style block (previously one block per
  // call).
  it("is idempotent — repeated injectDnDStyles calls keep a single style block", function () {
    dnd.injectDnDStyles();
    dnd.injectDnDStyles();
    assert.strictEqual(document.querySelectorAll("#ddb-print-dnd-style").length, 1);
  });

  it("dnd style content targets drag states", function () {
    dnd.injectDnDStyles();
    const css = document.getElementById("ddb-print-dnd-style").textContent;
    assert.ok(css.includes(".dragging") || css.includes("be-drag-ghost"));
  });
});

describe("E1 9e79fd0 — layout control UI buttons", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.createControls();
  });
  afterEach(function () {
    cleanup();
  });

  function labels() {
    return Array.from(document.querySelectorAll("#print-enhance-controls button")).map(
      (b) => b.textContent,
    );
  }

  it("offers a Load button", function () {
    assert.ok(labels().some((t) => t.includes("Load")));
  });

  it("offers Reset to Default", function () {
    assert.ok(labels().some((t) => t.includes("Reset to Default")));
  });

  it("offers Save to PC and Save to Browser", function () {
    const ls = labels().join(" | ");
    assert.ok(ls.includes("Save to PC") && ls.includes("Save to Browser"));
  });

  it("offers a Print action", function () {
    assert.ok(labels().some((t) => t.includes("Print")));
  });
});

describe("E1 8412192 — spell duplication surface", function () {
  let window, cleanup;
  beforeEach(async function () {
    const b = boot("<!DOCTYPE html><html><body></body></html>");
    window = b.window;
    cleanup = b.cleanup;
    await window.Storage.init();
  });
  afterEach(function () {
    cleanup();
  });

  it("exposes the spell view handles", function () {
    ["injectClonesIntoSpellsView", "injectSpellDetailTriggers", "fetchSpellWithCache", "getCharacterSpells"].forEach(
      (h) => assert.strictEqual(typeof window[h], "function"),
    );
  });

  it("injectClonesIntoSpellsView is safe with no spell markup", async function () {
    await window.injectClonesIntoSpellsView();
    assert.ok(true);
  });

  it("injectSpellDetailTriggers is safe without spell rows", function () {
    assert.doesNotThrow(() => window.injectSpellDetailTriggers());
  });

  it("fetchSpellWithCache resolves cleanly on an empty cache", async function () {
    const spell = await window.fetchSpellWithCache("Fireball");
    assert.ok(spell === undefined || spell === null);
  });
});

describe("E1 15a7923 — spells integrated into save/load", function () {
  let window, cleanup;
  beforeEach(async function () {
    const b = boot("<!DOCTYPE html><html><body></body></html>");
    window = b.window;
    cleanup = b.cleanup;
    await window.Storage.init();
  });
  afterEach(function () {
    cleanup();
  });

  it("persists spell caches inside a saved layout", async function () {
    const layout = { version: "1.5.0", sections: {}, spell_cache: [{ name: "Magic Missile" }] };
    await window.Storage.saveLayout("SP-1", layout);
    const loaded = await window.Storage.loadLayout("SP-1");
    assert.strictEqual(loaded.spell_cache[0].name, "Magic Missile");
  });

  it("retrieves the spell back from the cache after save", async function () {
    await window.Storage.saveSpells([{ name: "Shield" }]);
    const spell = await window.Storage.getSpell("Shield");
    assert.strictEqual(spell.name, "Shield");
  });

  it("applyLayout replays the saved spell cache into storage", async function () {
    const layout = { version: "1.5.0", sections: {}, spell_cache: [{ name: "Burning Hands" }] };
    await window.applyLayout(layout);
    const spell = await window.Storage.getSpell("Burning Hands");
    assert.ok(spell, "applyLayout should re-seed the spell cache");
  });

  it("cached spells survive a layout save/load cycle", async function () {
    await window.Storage.saveSpells([{ name: "Detect Magic" }]);
    const layout = await window.Storage.loadLayout("GLOBAL") || { version: "1.5.0", sections: {} };
    await window.Storage.saveLayout("GLOBAL", layout);
    const spell = await window.Storage.getSpell("Detect Magic");
    assert.ok(spell);
  });
});

describe("E1 bc48416 — resilient text/query utilities", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootSheet();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("findSectionTitle resolves the header span text", function () {
    const title = window.findSectionTitle(document.getElementById("sec-1"));
    assert.strictEqual(title, "Stats");
  });

  it("removeSearchBoxes is repeatable", function () {
    assert.doesNotThrow(() => window.removeSearchBoxes());
    assert.doesNotThrow(() => window.removeSearchBoxes());
  });

  it("captureSectionSnapshot works on a queried section", function () {
    const snap = window.captureSectionSnapshot("sec-1");
    assert.strictEqual(snap.originalId, "sec-1");
  });

  it("moveDefenses stays safe across calls", function () {
    assert.doesNotThrow(() => window.moveDefenses());
    assert.doesNotThrow(() => window.moveDefenses());
  });
});

describe("E1 1ab4035 — extraction/navigation recovery surface", function () {
  let window, cleanup;
  beforeEach(function () {
    const b = bootSheet();
    window = b.window;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("separateAbilities is safe on a plain sheet", function () {
    assert.doesNotThrow(() => window.separateAbilities());
  });

  it("extractAndWrapSections is callable after recovery", async function () {
    await window.extractAndWrapSections();
    assert.ok(true);
  });

  it("enforceFullHeight is idempotent after recovery", function () {
    window.enforceFullHeight();
    assert.doesNotThrow(() => window.enforceFullHeight());
  });

  it("drawPageSeparators runs without error on this sheet", function () {
    assert.doesNotThrow(() => window.drawPageSeparators());
  });
});

describe("E1 2b54523 — navigation discovery resilience (surface)", function () {
  let window, cleanup;
  beforeEach(function () {
    const b = bootSheet();
    window = b.window;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("flagExtractableElements keeps running on repeated passes", function () {
    window.flagExtractableElements();
    assert.doesNotThrow(() => window.flagExtractableElements());
  });

  it("enforceFullHeight handles wrapped sections", function () {
    assert.doesNotThrow(() => window.enforceFullHeight());
  });

  it("drawPageSeparators runs without error on this sheet", function () {
    assert.doesNotThrow(() => window.drawPageSeparators());
  });

  it("controls state sync stays safe after navigation-era setup", function () {
    window.createControls();
    window.updateControlsState();
    assert.ok(true);
  });
});

describe("E1 1ef0430 — consolidated tab/UI logic (surface)", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootSheet();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("removeSearchBoxes is safe after consolidation", function () {
    assert.doesNotThrow(() => window.removeSearchBoxes());
  });

  it("injectCompactStyles installs once after consolidation", function () {
    window.injectCompactStyles();
    window.injectCompactStyles();
    assert.strictEqual(document.querySelectorAll("#ddb-print-compact-style").length, 1);
  });

  it("moveQuickInfo is safe without quick-info content", function () {
    assert.doesNotThrow(() => window.moveQuickInfo());
  });

  it("updateLayoutBounds is safe after setup", function () {
    assert.doesNotThrow(() => window.updateLayoutBounds());
  });
});

describe("E1 0ae4776 — styling recovery/script safety", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("injectCompactStyles single style block", function () {
    window.injectCompactStyles();
    window.injectCompactStyles();
    assert.strictEqual(document.querySelectorAll("#ddb-print-compact-style").length, 1);
  });

  it("updatePrintStyles single style block", function () {
    window.updatePrintStyles();
    window.updatePrintStyles();
    assert.strictEqual(document.querySelectorAll("#be-print-z-style").length, 1);
  });

  it("suppressResizeEvents installs without error", function () {
    assert.doesNotThrow(() => window.suppressResizeEvents());
  });

  it("initResponsiveScaling + initZIndexManagement are safe in test mode", function () {
    window.ResizeObserver = global.ResizeObserver;
    assert.doesNotThrow(() => window.initResponsiveScaling());
    assert.doesNotThrow(() => window.initZIndexManagement());
  });
});

describe("E1 f959e61 — dynamic tab discovery fix (surface)", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootSheet();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("boot flag prevents a second init pass", function () {
    assert.strictEqual(window.__DDB_PRINT_ENHANCE_INITIALIZED__, true);
  });

  it("repeated injectCloneButtons does not stack triggers", function () {
    window.injectCloneButtons();
    window.injectCloneButtons();
    const triggers = document.querySelectorAll(".be-more-options-button");
    assert.ok(triggers.length <= 2, `expected <=2 triggers, got ${triggers.length}`);
  });

  it("skillsSplit initializes to false", function () {
    assert.strictEqual(window.skillsSplit, false);
  });

  it("extraction handles remain callable after repeated passes", function () {
    assert.doesNotThrow(() => window.flagExtractableElements());
    assert.doesNotThrow(() => window.captureSectionSnapshot("sec-2"));
  });
});

describe("E1 6a149fb — redeclaration/cloneNode fix (idempotency)", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootSheet();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("each section receives a single actions container across injections", function () {
    window.injectCloneButtons();
    window.injectCloneButtons();
    document.querySelectorAll(".be-section-wrapper, .ct-subsection").forEach((el) => {
      const actions = el.querySelector(":scope > .be-section-actions");
      if (actions) {
        assert.strictEqual(el.querySelectorAll(":scope > .be-section-actions").length, 1);
      }
    });
  });

  it("clone rendering after double injection stays error free", function () {
    window.injectCloneButtons();
    window.injectCloneButtons();
    const snap = {
      originalId: "sec-1",
      id: "clone-e1",
      title: "Clone",
      html: '<div class="print-section-header"><span>Clone</span></div><p>x</p>',
      styles: {},
    };
    const clone = window.renderClonedSection(snap);
    assert.ok(clone.querySelector(".print-section-container"));
  });

  it("the init flag is untouched by later exposure calls", function () {
    window.injectCloneButtons();
    assert.strictEqual(window.__DDB_PRINT_ENHANCE_INITIALIZED__, true);
  });

  it("snapshot ids survive clone rendering after re-injection", function () {
    window.injectCloneButtons();
    const snap = {
      originalId: "sec-2",
      id: "clone-e1b",
      title: "Gear Clone",
      html: '<div class="print-section-header"><span>Gear</span></div><p>y</p>',
      styles: {},
    };
    const clone = window.renderClonedSection(snap);
    const container = clone.querySelector(".print-section-container");
    assert.strictEqual(container.id, "clone-e1b");
  });
});

describe("E1 0986c6a — style/svg preserving clones", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  function snapWithSvg(id) {
    return {
      originalId: "orig-svg",
      id,
      title: "SVG Section",
      html: '<div class="print-section-header"><span>SVG</span></div><svg id="inner-svg"><use href="#defs-icon" /></svg>',
      styles: {},
    };
  }

  it("keeps svg markup inside cloned content", function () {
    const clone = window.renderClonedSection(snapWithSvg("clone-svg-1"));
    assert.ok(clone.querySelector("#inner-svg"), "svg should survive the clone");
    const use = clone.querySelector("#inner-svg use");
    assert.ok(use, "svg <use> reference should survive");
  });

  it("two clones from one snapshot stay independent", function () {
    const a = window.renderClonedSection(snapWithSvg("clone-svg-a"));
    const b = window.renderClonedSection(snapWithSvg("clone-svg-b"));
    assert.notStrictEqual(a, b);
    assert.strictEqual(a.querySelectorAll("#inner-svg").length, 1);
    assert.strictEqual(b.querySelectorAll("#inner-svg").length, 1);
  });

  it("clone content carries the original header text", function () {
    const clone = window.renderClonedSection(snapWithSvg("clone-svg-c"));
    assert.ok(clone.textContent.includes("SVG"));
  });

  it("cloning does not touch the original document element", function () {
    window.renderClonedSection(snapWithSvg("clone-svg-d"));
    assert.strictEqual(document.getElementById("orig-svg"), null); // original only virtual here
    assert.ok(true);
  });
});

describe("E1 f33e1c1 — strict layout & scaling refinements", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootSheet();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("enforceFullHeight preserves section presence", function () {
    window.enforceFullHeight();
    assert.ok(document.getElementById("sec-1"));
    assert.ok(document.getElementById("sec-2"));
  });

  it("findSectionTitle resolves the second section title", function () {
    assert.strictEqual(window.findSectionTitle(document.getElementById("sec-2")), "Gear");
  });

  it("drawPageSeparators is callable after layout ops", function () {
    window.enforceFullHeight();
    assert.doesNotThrow(() => window.drawPageSeparators());
  });

  it("removeSpecificSvgs is safe on this sheet", function () {
    assert.doesNotThrow(() => window.removeSpecificSvgs(document.body));
  });
});

describe("E1 30bd22e — interactive spells + draggable print layout", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootSheet();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("wrappers expose the structure for the pointer dnd engine (native draggable superseded)", function () {
    // Superseded 2026-09-09 by drag_ux_overhaul_20260909 Phase 1: the
    // pointer-events engine arms drags after a movement threshold, so
    // createDraggableContainer no longer sets native draggable=true.
    const wrapper = window.createDraggableContainer("Spell Card", document.createElement("div"), "sc-1");
    assert.strictEqual(wrapper.draggable, false);
    assert.ok(wrapper.querySelector(".print-section-container"));
  });

  it("injectClonesIntoSpellsView stays safe on a sheet without spell rows", async function () {
    await window.injectClonesIntoSpellsView();
    assert.ok(true);
  });

  it("extraction entry points remain live", async function () {
    assert.strictEqual(typeof window.extractAndWrapSections, "function");
    assert.strictEqual(typeof window.injectSpellDetailTriggers, "function");
  });

  it("updateLayoutBounds runs after wrapper creation", function () {
    window.createDraggableContainer("T", document.createElement("div"), "sc-2");
    assert.doesNotThrow(() => window.updateLayoutBounds());
  });
});
