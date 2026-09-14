/**
 * E2 — Encapsulation-debt regression suite (2026-02-08..12).
 *   bee0303 absolute positioning engine (#1)
 *   496a00b targeted SVG removal + box styling (#2)
 *   c121755 portrait positioning enhancements (#4)
 *   d98e64e UI panel to save/load templates (#5)
 *   2f2b888 extension manifest era (init stability, #6)
 *   4eb32a8 section border rendering on clones (#8)
 *   26666ad details polish (#9)
 */
"use strict";

const assert = require("assert");
const { boot } = require("./debt_harness.js");

function bootRooted() {
  return boot(
    "<!DOCTYPE html><html><body><div id='print-layout-wrapper'></div></body></html>",
  );
}

/* ------------------------------------------------------------------ */
/* bee0303 — absolute positioning engine handles                       */
/* ------------------------------------------------------------------ */
describe("E2 bee0303 — absolute positioning engine surface", function () {
  let window, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("exposes the positioning engine handles", function () {
    ["autoArrangeSections", "updateLayoutBounds", "suppressResizeEvents", "initResizeLogic"].forEach(
      (h) => assert.strictEqual(typeof window[h], "function", `${h} missing`),
    );
  });

  it("suppressResizeEvents is repeatable and side-effect free", function () {
    assert.doesNotThrow(() => window.suppressResizeEvents());
    assert.doesNotThrow(() => window.suppressResizeEvents());
  });

  it("updateLayoutBounds runs without error on an empty layout", function () {
    assert.doesNotThrow(() => window.updateLayoutBounds());
  });

  it("autoArrangeSections runs without error when there are no sections", function () {
    assert.doesNotThrow(() => window.autoArrangeSections());
  });

  it("initResizeLogic initializes without error", function () {
    assert.doesNotThrow(() => window.initResizeLogic());
  });
});

/* ------------------------------------------------------------------ */
/* 496a00b — targeted SVG removal                                      */
/* ------------------------------------------------------------------ */
describe("E2 496a00b — removeSpecificSvgs targeting", function () {
  function runWith(innerHtml) {
    const b = boot(`<!DOCTYPE html><html><body><div id="box">${innerHtml}</div></body></html>`);
    b.window.removeSpecificSvgs(b.window.document.getElementById("box"));
    return b;
  }

  it("hides the first background when it is unprotected", function () {
    const b = runWith(
      '<div class="ddbc-box-background"><svg id="bg-svg"></svg></div>',
    );
    const bg = b.window.document.querySelector(".ddbc-box-background");
    assert.strictEqual(bg.style.display, "none");
    b.cleanup();
  });

  it("keeps the first background when it belongs to an armor-class box", function () {
    const b = runWith(
      '<div class="ddbc-armor-class-box"><div class="ddbc-box-background"><svg id="ac-svg"></svg></div></div>',
    );
    const bg = b.window.document.querySelector(".ddbc-box-background");
    assert.notStrictEqual(bg.style.display, "none");
    b.cleanup();
  });

  it("hides stray nested section svgs", function () {
    const b = runWith('<section><div><svg id="nested-svg"></svg></div></section>');
    assert.strictEqual(b.window.document.getElementById("nested-svg").style.display, "none");
    b.cleanup();
  });

  it("protects the armor-class svg class", function () {
    const b = runWith(
      '<section><div><svg class="ddbc-armor-class-box-svg" id="ac-nested"></svg></div></section>',
    );
    const svg = b.window.document.getElementById("ac-nested");
    assert.notStrictEqual(svg.style.display, "none");
    b.cleanup();
  });
});

/* ------------------------------------------------------------------ */
/* c121755 — portrait positioning                                      */
/* ------------------------------------------------------------------ */
describe("E2 c121755 — portrait move behavior", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = boot(`<!DOCTYPE html><html><body>
      <div class="ct-character-sheet-desktop">
        <div class="ct-character-sheet__inner">
          <div class="ddbc-character-avatar__portrait" id="portrait"><img id="portrait-img" /></div>
          <div class="ct-subsection ct-subsection--primary-box" id="primary-box"></div>
        </div>
      </div>
      <div id="print-layout-wrapper"></div>
    </body></html>`);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("keeps the portrait image intact after the move", function () {
    window.movePortrait();
    assert.ok(document.getElementById("portrait-img"));
  });

  it("relocates the portrait into the primary box", function () {
    window.movePortrait();
    const primary = document.getElementById("primary-box");
    const portrait = primary.querySelector("#portrait");
    assert.ok(portrait, "portrait should live inside the primary box");
  });

  it("is safe to run when no portrait exists", function () {
    const b2 = bootRooted();
    assert.doesNotThrow(() => b2.window.movePortrait());
    b2.cleanup();
  });

  it("is repeatable without duplicating the portrait", function () {
    window.movePortrait();
    window.movePortrait();
    const portraits = document.querySelectorAll("#portrait");
    assert.strictEqual(portraits.length, 1);
  });
});

/* ------------------------------------------------------------------ */
/* d98e64e — save/load template era                                    */
/* ------------------------------------------------------------------ */
describe("E2 d98e64e — save/load surface", function () {
  let window, cleanup;
  beforeEach(async function () {
    const b = bootRooted();
    window = b.window;
    cleanup = b.cleanup;
    await window.Storage.init();
  });
  afterEach(function () {
    cleanup();
  });

  it("scanLayout returns a versioned layout object", async function () {
    const layout = await window.scanLayout();
    assert.ok(layout);
    assert.strictEqual(layout.version, "1.5.0");
  });

  it("applyLayout tolerates an empty layout", async function () {
    await window.applyLayout({ version: "1.5.0", sections: {} });
    assert.ok(true);
  });

  // fake-indexeddb is process-shared, so a previous suite may already have saved
  // a GLOBAL layout; assert the contract (a RESULT OBJECT, no throw) instead.
  // AC-1/Edge 4 (ui_ux_review_20260910): the result grew from boolean to
  // {restored, reason} so the boot path can tell "nothing saved" apart from
  // "a saved layout FAILED to load" and surface an error card for the latter.
  it("restoreLayout resolves cleanly when nothing was saved for this suite", async function () {
    const restored = await window.restoreLayout();
    assert.strictEqual(typeof restored, "object");
    assert.strictEqual(typeof restored.restored, "boolean");
  });

  it("migrateLayout stamps the current schema version", function () {
    const out = window.Storage.migrateLayout({ version: "1.4.0", sections: {} });
    assert.strictEqual(out.version, "1.5.0");
  });
});

/* ------------------------------------------------------------------ */
/* 2f2b888 — manifest-era init stability                               */
/* ------------------------------------------------------------------ */
describe("E2 2f2b888 — boot stability", function () {
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

  it("sets the single-init guard on boot", function () {
    assert.strictEqual(window.__DDB_PRINT_ENHANCE_INITIALIZED__, true);
  });

  it("keeps test handles intact after init", function () {
    ["injectCloneButtons", "extractAndWrapSections", "createControls", "restoreLayout"].forEach(
      (h) => assert.strictEqual(typeof window[h], "function"),
    );
  });

  it("repeated button injection does not duplicate controls", function () {
    const html = `<!DOCTYPE html><html><body>
      <div class="be-section-wrapper">
        <div class="ct-subsection" id="sec"><div class="print-section-header"><span>S</span></div></div>
      </div>
    </body></html>`;
    const b2 = boot(html);
    b2.window.injectCloneButtons();
    b2.window.injectCloneButtons();
    const wrapper = b2.document.querySelector(".be-section-wrapper");
    assert.strictEqual(wrapper.querySelectorAll(".be-section-actions").length, 1);
    b2.cleanup();
  });

  it("core print styles regenerate idempotently", function () {
    window.updatePrintStyles();
    window.updatePrintStyles();
    assert.strictEqual(document.querySelectorAll("#be-print-z-style").length, 1);
  });
});

/* ------------------------------------------------------------------ */
/* 4eb32a8 — border rendering on rendered clones                       */
/* ------------------------------------------------------------------ */
describe("E2 4eb32a8 — clone border rendering", function () {
  let window, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  function snap(extra) {
    return Object.assign(
      {
        originalId: "orig-1",
        id: "clone-b1",
        title: "Stats",
        html: '<div class="print-section-header"><span>Stats</span></div><p>data</p>',
        styles: {},
      },
      extra,
    );
  }

  it("applies the snapshot border style class to the clone container", function () {
    const clone = window.renderClonedSection(snap({ borderStyle: "spikes_border" }));
    const container = clone.querySelector(".print-section-container");
    assert.ok(container.classList.contains("spikes_border"));
  });

  it("leaves no border class when the snapshot has none", function () {
    const clone = window.renderClonedSection(snap());
    const container = clone.querySelector(".print-section-container");
    assert.ok(!container.classList.contains("spikes_border"));
  });

  it("restores saved dimensions onto the container", function () {
    const clone = window.renderClonedSection(
      snap({ styles: { width: "420px", height: "300px" } }),
    );
    const container = clone.querySelector(".print-section-container");
    assert.strictEqual(container.style.width, "420px");
    assert.strictEqual(container.style.height, "300px");
  });

  it("marks clones with be-clone and the original id", function () {
    const clone = window.renderClonedSection(snap());
    const container = clone.querySelector(".print-section-container");
    assert.ok(container.classList.contains("be-clone"));
    assert.strictEqual(container.dataset.originalId, "orig-1");
  });
});

/* ------------------------------------------------------------------ */
/* 26666ad — polish-era defensive behaviors                            */
/* ------------------------------------------------------------------ */
describe("E2 26666ad — polish (defensive layout ops)", function () {
  let window, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("applyDefaultLayout fails soft when the catalog is unavailable", async function () {
    window.fetch = async () => {
      throw new Error("offline");
    };
    await window.applyDefaultLayout();
    assert.ok(true); // must not reject
  });

  it("moveDefenses is a safe no-op without defense content", function () {
    assert.doesNotThrow(() => window.moveDefenses());
    assert.doesNotThrow(() => window.moveDefenses());
  });

  it("moveQuickInfo is a safe no-op without quick-info content", function () {
    assert.doesNotThrow(() => window.moveQuickInfo());
  });

  it("removeSearchBoxes is a safe no-op without search boxes", function () {
    assert.doesNotThrow(() => window.removeSearchBoxes());
  });
});
