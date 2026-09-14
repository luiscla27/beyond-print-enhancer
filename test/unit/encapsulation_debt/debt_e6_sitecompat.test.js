/**
 * E6 — Encapsulation-debt regression suite (2026-03-05..07).
 *   ffa8f8e fix(dom): prevent #site-main from being hidden
 *   002c490 fix(layout): update DIALOG_SIBLING selector (site structure)
 *   028310d fix(layout): getCharacterSheet + dialog-sibling visibility
 *   34ccbde fix(ui): extension UI excluded from dialog-sibling hiding
 *   938227d Corners (#20)
 *   154def6 Refinements (#21)
 * Complementary to dom_manager/site_main_visibility/new_layout_features.
 */
"use strict";

const assert = require("assert");
const { boot } = require("./debt_harness.js");

function bootSheet(mainBody = "") {
  return boot(`<!DOCTYPE html><html><body>
    <header class="main">Site Header</header>
    <div class="site-bar">sitebar</div>
    <div id="site-main">
      <div class="ct-character-sheet-desktop">
        <div class="ct-character-sheet__inner">${mainBody}</div>
      </div>
    </div>
    <footer>Footer</footer>
    <div class="mega-menu-target" id="mega-menu-target">menu</div>
  </body></html>`);
}

/* ------------------------------------------------------------------ */
/* ffa8f8e / 028310d — #site-main + character sheet visibility         */
/* ------------------------------------------------------------------ */
describe("E6 ffa8f8e/028310d — character sheet visibility guards", function () {
  let window, document, cleanup, dom;
  beforeEach(function () {
    const b = bootSheet();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    dom = window.DomManager.getInstance();
  });
  afterEach(function () {
    cleanup();
  });

  it("getCharacterSheet prefers the desktop sheet over #site-main", function () {
    const sheet = dom.getCharacterSheet().element;
    assert.ok(sheet.classList.contains("ct-character-sheet-desktop"));
    assert.notStrictEqual(sheet.id, "site-main");
  });

  it("getCharacterSheet falls back to #site-main when the desktop class is absent", function () {
    const bare = boot(
      "<!DOCTYPE html><html><body><div id='site-main'><div id='x'></div></div></body></html>",
    );
    const el = bare.window.DomManager.getInstance().getCharacterSheet().element;
    assert.strictEqual(el.id, "site-main");
    bare.cleanup();
  });

  it("hideCoreInterface never hides #site-main or the desktop sheet", function () {
    dom.hideCoreInterface();
    const siteMain = document.getElementById("site-main");
    const desktop = document.querySelector(".ct-character-sheet-desktop");
    assert.notStrictEqual(siteMain.style.display, "none");
    assert.notStrictEqual(desktop.style.display, "none");
  });

  it("hideCoreInterface hides page furniture but not the sheet", function () {
    dom.hideCoreInterface();
    assert.strictEqual(document.querySelector("header.main").style.display, "none");
    assert.strictEqual(document.querySelector("footer").style.display, "none");
    assert.strictEqual(document.querySelector(".site-bar").style.display, "none");
    const desktop = document.querySelector(".ct-character-sheet-desktop");
    assert.strictEqual(desktop.style.display, "");
  });
});

/* ------------------------------------------------------------------ */
/* 34ccbde — extension UI survives dialog-sibling hiding               */
/* ------------------------------------------------------------------ */
describe("E6 34ccbde — extension overlays excluded from cleanup", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const html = `<!DOCTYPE html><html><body>
      <div id="site-main">
        <div class="ct-character-sheet-desktop"><div class="ct-character-sheet__inner">
          <div class="ct-sidebar">
            <div class="ct-sidebar__portal">
              <div id="print-enhance-shapes-container"></div>
            </div>
          </div>
        </div></div>
      </div>
      <div id="be-modal-root"><div class="be-modal">modal</div></div>
      <div class="sidebar-like">shrink me</div>
    </body></html>`;
    const b = boot(html);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("does not hide the sidebar portal container (holds modals/extension UI)", function () {
    const dom = window.DomManager.getInstance();
    dom.hideCoreInterface();
    const portal = document.querySelector(".ct-sidebar__portal");
    assert.notStrictEqual(portal.style.display, "none");
  });

  it("hides generic sidebar-like elements outside the portal", function () {
    const dom = window.DomManager.getInstance();
    dom.hideCoreInterface();
    assert.strictEqual(document.querySelector(".sidebar-like").style.display, "none");
  });

  it("never hides elements nested inside the portal", function () {
    const dom = window.DomManager.getInstance();
    dom.hideCoreInterface();
    const shapesContainer = document.getElementById("print-enhance-shapes-container");
    assert.notStrictEqual(shapesContainer.style.display, "none");
  });

  it("keeps the character sheet visible after the full cleanup pass", function () {
    const dom = window.DomManager.getInstance();
    dom.hideCoreInterface();
    const desktop = document.querySelector(".ct-character-sheet-desktop");
    assert.strictEqual(desktop.style.display, "");
  });
});

/* ------------------------------------------------------------------ */
/* 938227d — Corners (corner/vertical shape assets in the catalog)     */
/* ------------------------------------------------------------------ */
describe("E6 938227d — corner shape assets", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = boot("<!DOCTYPE html><html><body></body></html>");
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.PeDom = () => ({
      getLayerManager: () => ({
        activeLayerId: "shapes-default",
        refreshUI: () => {},
        getActiveLayerContainer: () => ({ element: document.body }),
      }),
    });
  });
  afterEach(function () {
    cleanup();
  });

  async function openShapeTab() {
    const p = window.showShapePickerModal("", "assets/shapes/");
    p.catch(() => {});
    await new Promise((r) => setTimeout(r, 150));
  }

  it("lists corner assets under the shapes tab", async function () {
    await openShapeTab();
    const titles = Array.from(document.querySelectorAll(".be-border-option")).map(
      (o) => o.title || "",
    );
    const corners = titles.filter((t) => t.toLowerCase().includes("corner"));
    assert.ok(corners.length >= 5, `expected corner assets, got ${corners.join(", ")}`);
  });

  it("lists only .webp corner files (post-migration catalog)", async function () {
    await openShapeTab();
    const previews = Array.from(document.querySelectorAll(".be-border-option .be-border-preview"));
    assert.ok(previews.length > 0);
    previews.forEach((p) => {
      const css = (p.style.borderImageSource || p.style.backgroundImage || "") + p.className;
      assert.ok(!css.includes(".png"), "no png assets may remain");
    });
  });

  it("createShape with a corner asset produces a positioned shape container", function () {
    const html = `<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
    </body></html>`;
    const b = boot(html);
    const w = b.window;
    const wrapper = w.createShape("assets/shapes/corner_ornament.webp");
    assert.ok(wrapper);
    const container = wrapper.querySelector(".be-shape-container");
    assert.ok(container, "shape container class present");
    assert.strictEqual(container.dataset.assetPath, "assets/shapes/corner_ornament.webp");
    assert.ok(parseInt(wrapper.style.zIndex, 10) >= 111, `z=${wrapper.style.zIndex}`);
    b.cleanup();
  });

  it("restoreData overrides default shape placement", function () {
    const html = `<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
    </body></html>`;
    const b = boot(html);
    const w = b.window;
    const wrapper = w.createShape("assets/shapes/corner_dwarf.webp", {
      id: "shape-restored",
      left: "300px",
      top: "400px",
      width: "120px",
      height: "90px",
    });
    assert.strictEqual(wrapper.querySelector(".be-shape-container").id, "shape-restored");
    assert.strictEqual(wrapper.style.getPropertyValue("left"), "300px");
    assert.strictEqual(wrapper.style.getPropertyValue("top"), "400px");
    const container = wrapper.querySelector(".be-shape-container");
    assert.strictEqual(container.style.getPropertyValue("width"), "120px");
    assert.strictEqual(container.style.getPropertyValue("height"), "90px");
    b.cleanup();
  });
});

/* ------------------------------------------------------------------ */
/* 154def6 — Refinements: default-placement + rotation snapping        */
/* ------------------------------------------------------------------ */
describe("E6 154def6 — refinement behaviors", function () {
  let window, cleanup;
  beforeEach(function () {
    const b = boot(
      "<!DOCTYPE html><html><body><div id='print-layout-wrapper'></div></body></html>",
    );
    window = b.window;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("new shapes default to left 50px / top 160px", function () {
    const wrapper = window.createShape("assets/shapes/archer_main.webp");
    assert.strictEqual(wrapper.style.getPropertyValue("left"), "50px");
    assert.strictEqual(wrapper.style.getPropertyValue("top"), "160px");
  });

  it("restores a saved rotation on the container, snapped", function () {
    const wrapper = window.createShape("assets/shapes/star.webp", {
      rotation: "23", // snap(15) -> 30
    });
    const container = wrapper.querySelector(".be-shape-container");
    assert.strictEqual(container.style.transform, "rotate(30deg)");
    assert.strictEqual(wrapper.dataset.rotation, "30");
  });

  it("keeps rotation off the wrapper element (avoids transform conflicts)", function () {
    const wrapper = window.createShape("assets/shapes/star.webp", { rotation: "45" });
    assert.strictEqual(wrapper.style.transform, "");
    const container = wrapper.querySelector(".be-shape-container");
    assert.strictEqual(container.style.transform, "rotate(45deg)");
  });

  it("unrotated shapes leave no rotation data or transform", function () {
    const wrapper = window.createShape("assets/shapes/star.webp");
    assert.strictEqual(wrapper.dataset.rotation, undefined);
    const container = wrapper.querySelector(".be-shape-container");
    assert.strictEqual(container.style.transform, "");
  });
});
