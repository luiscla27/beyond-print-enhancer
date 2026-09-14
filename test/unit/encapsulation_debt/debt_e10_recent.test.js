/**
 * E10 — Encapsulation-debt regression suite (2026-05-08..18).
 * Pins, per commit, behaviors introduced in the current monolith:
 *   907c7b6 WIP character name + template catalogs (#36)
 *   bb76b46 WIP Skill splitter (#37)
 *   831aa23 Simplify UI logic (#38)
 * Complementary to test/unit/skill_box_splitting, context_menu,
 * section_actions_revamp, shape_actions_revamp, active_section.
 */
"use strict";

const assert = require("assert");
const { boot, skillsBoxHtml } = require("./debt_harness.js");

const SHEET = `<!DOCTYPE html><html><body>
  <div class="ct-character-sheet-desktop">
    <div class="ct-character-sheet__inner">
      <div class="be-section-wrapper" data-title="Traits">
        <div class="ct-subsection" id="section-traits">
          <div class="print-section-header"><span>Traits</span></div>
        </div>
      </div>
      <div class="be-section-wrapper" data-title="Equipment">
        <div class="ct-subsection" id="section-equipment">
          <div class="print-section-header"><span>Equipment</span></div>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

describe("E10 907c7b6 — active-section state & properties panel", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = boot(SHEET);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.injectCloneButtons();
  });
  afterEach(function () {
    cleanup();
  });

  it("marks the section and its .be-section-wrapper when set active", function () {
    const section = document.getElementById("section-traits");
    window.setActiveSection(section);
    assert.ok(section.classList.contains("be-active-section"));
    const wrapper = section.closest(".be-section-wrapper");
    assert.ok(wrapper.classList.contains("be-active-wrapper"));
  });

  it("clears previous active classes when setActiveSection(null) is called", function () {
    const section = document.getElementById("section-traits");
    window.setActiveSection(section);
    window.setActiveSection(null);
    assert.ok(!section.classList.contains("be-active-section"));
    assert.ok(!section.closest(".be-section-wrapper").classList.contains("be-active-wrapper"));
  });

  it("only one wrapper carries the active state at a time", function () {
    const s1 = document.getElementById("section-traits");
    const s2 = document.getElementById("section-equipment");
    window.setActiveSection(s1);
    window.setActiveSection(s2);
    assert.ok(s2.classList.contains("be-active-section"));
    assert.ok(!s1.classList.contains("be-active-section"));
  });

  it("renders the properties panel title from the section header span", function () {
    const panel = document.createElement("div");
    panel.id = "print-enhance-properties-panel";
    document.body.appendChild(panel);
    window.setActiveSection(document.getElementById("section-traits"));
    const h4 = panel.querySelector("h4");
    assert.ok(h4, "panel should render a title");
    assert.ok(h4.textContent.includes("Traits"), `title=${h4 && h4.textContent}`);
  });

  it("builds font-size, compact and border controls in the panel", function () {
    const panel = document.createElement("div");
    panel.id = "print-enhance-properties-panel";
    document.body.appendChild(panel);
    window.setActiveSection(document.getElementById("section-traits"));
    assert.ok(panel.querySelector('input[type="range"]'), "font slider");
    assert.ok(panel.querySelector('input[type="checkbox"]'), "compact toggle");
    assert.ok(panel.querySelector(".be-prop-border-button"), "border button");
  });

  it("border preview falls back to the default-border class", function () {
    const panel = document.createElement("div");
    panel.id = "print-enhance-properties-panel";
    document.body.appendChild(panel);
    window.setActiveSection(document.getElementById("section-traits"));
    const preview = panel.querySelector(".be-border-preview");
    assert.ok(preview, "preview element exists");
    assert.ok(preview.classList.contains("default-border"));
  });
});

describe("E10 907c7b6 — catalog service (premade templates)", function () {
  let window, cleanup;
  beforeEach(function () {
    const b = boot("<!DOCTYPE html><html><body></body></html>", {
      catalogService: true,
    });
    window = b.window;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("exposes CatalogService and showPremadeCatalogModal on window", function () {
    assert.ok(window.CatalogService);
    assert.strictEqual(typeof window.CatalogService.loadCatalog, "function");
    assert.strictEqual(typeof window.CatalogService.applyTemplate, "function");
    assert.strictEqual(typeof window.showPremadeCatalogModal, "function");
  });

  it("wraps a flat template layout (no .data) into {name,version,data}", async function () {
    window.fetch = async () => ({
      ok: true,
      json: async () => ({ name: "Flat", sections: { s1: {} }, shapes: [] }),
    });
    const tpl = await window.CatalogService.loadTemplate("templates/flat.json");
    assert.ok(tpl.data, "should be wrapped with .data");
    assert.strictEqual(tpl.name, "Flat");
    assert.deepStrictEqual(Object.keys(tpl.data.sections), ["s1"]);
  });

  it("passes through a template that already has .data", async function () {
    window.fetch = async () => ({
      ok: true,
      json: async () => ({ name: "Wrapped", data: { shapes: [] } }),
    });
    const tpl = await window.CatalogService.loadTemplate("templates/x.json");
    assert.ok(tpl.data);
    assert.strictEqual(tpl.data.shapes.length, 0);
  });

  it("returns null for a malformed flat template", async function () {
    const origError = console.error;
    console.error = () => {};
    try {
      window.fetch = async () => ({
        ok: true,
        json: async () => ({ name: "Empty" }), // neither sections nor shapes
      });
      const tpl = await window.CatalogService.loadTemplate("templates/bad.json");
      assert.strictEqual(tpl, null);
    } finally {
      console.error = origError;
    }
  });

  it("applyTemplate rejects an unknown template id", async function () {
    window.fetch = async () => ({
      ok: true,
      json: async () => ({ templates: [{ id: "known", path: "a.json" }] }),
    });
    const applied = await window.CatalogService.applyTemplate("nope", true);
    assert.strictEqual(applied, false);
  });
});

describe("E10 bb76b46 — skill splitter internals", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = boot(skillsBoxHtml());
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.skillsSplit = false;
  });
  afterEach(function () {
    cleanup();
  });

  async function split() {
    // The fixture wrapper already exists (skillsBoxHtml) — re-inject for realism.
    await window.splitSkillsBox(true);
  }

  it("sets window.skillsSplit and removes the original wrapper", async function () {
    const original = document.querySelector(".ct-skills__box").closest(".be-section-wrapper");
    assert.ok(original, "fixture must have a wrapper");
    await split();
    assert.strictEqual(window.skillsSplit, true);
    assert.strictEqual(document.getElementById("section-skills-wrapper"), null, "original wrapper should be gone");
  });

  it("creates one clone per ability stat (STR/INT/WIS/CHA/DEX)", async function () {
    await split();
    const wrappers = Array.from(document.querySelectorAll(".be-section-wrapper"));
    const ids = wrappers
      .map((w) => (w.id || w.querySelector(".print-section-container")?.id || ""))
      .filter((id) => /^skills-(str|int|wis|cha|dex)-/.test(id));
    assert.strictEqual(ids.length, 5, `found ${ids.join(",")}`);
  });

  it("keeps only matching-stat rows in each stat clone", async function () {
    await split();
    const wrappers = Array.from(document.querySelectorAll(".be-section-wrapper"));
    for (const w of wrappers) {
      const container = w.querySelector(".print-section-container");
      if (!container || !/^skills-/.test(container.id)) continue;
      const stat = container.id.split("-")[1].toUpperCase();
      const rows = Array.from(container.querySelectorAll(".ct-skills__item"));
      assert.ok(rows.length >= 1, `${container.id} should keep rows`);
      rows.forEach((row) => {
        const statEl =
          row.querySelector(".ct-skills__item--stat") ||
          row.querySelector(".ct-skills__col--stat");
        assert.strictEqual(statEl.textContent.trim().toUpperCase(), stat);
      });
    }
  });

  it("removes the splitter button from generated clones", async function () {
    await split();
    document.querySelectorAll(".be-section-wrapper").forEach((w) => {
      assert.strictEqual(w.querySelectorAll(".be-split-skills-button").length, 0);
    });
  });

  it("is a silent no-op when no skills box exists (no throw, no feedback)", async function () {
    const b2 = boot("<!DOCTYPE html><html><body><div id='x'></div></body></html>");
    let feedbackCalls = 0;
    b2.window.showFeedback = () => {
      feedbackCalls += 1;
    };
    await b2.window.splitSkillsBox(true);
    assert.strictEqual(feedbackCalls, 0);
    b2.cleanup();
  });
});

describe("E10 831aa23 — simplified UI (context menu wiring)", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const html = `<!DOCTYPE html><html><body>
      <div class="be-section-wrapper" data-title="Traits">
        <div class="ct-subsection" id="section-traits">
          <div class="print-section-header"><span>Traits</span></div>
        </div>
      </div>
      <div class="be-section-wrapper">
        <div class="ct-subsection" id="clone-99">
          <div class="print-section-header"><span>Clone A</span></div>
        </div>
      </div>
      <div class="be-shape-wrapper" id="shape-wrapper-1">
        <div class="be-shape-container" id="shape-1" data-asset-path="assets/star.png">
          <img src="assets/star.png" />
        </div>
      </div>
    </body></html>`;
    const b = boot(html);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.injectCloneButtons();
  });
  afterEach(function () {
    cleanup();
  });

  it("injects a visible select button and a More Options trigger per section", function () {
    const section = document.getElementById("section-traits");
    const actions = section.closest(".be-section-wrapper").querySelector(".be-section-actions");
    assert.ok(actions.querySelector(".be-select-section-button"));
    assert.ok(actions.querySelector(".be-more-options-button"));
  });

  it("keeps secondary buttons inside the context menu, not the main bar", function () {
    const section = document.getElementById("section-traits");
    const actions = section.closest(".be-section-wrapper").querySelector(".be-section-actions");
    const barButtons = Array.from(actions.querySelectorAll(":scope > button"))
      .map((b) => b.className)
      .join(",");
    assert.ok(barButtons.includes("be-select-section-button"));
    assert.ok(!barButtons.includes("be-clone-button"), `bar=${barButtons}`);
    const menu = actions.querySelector(".be-context-menu");
    assert.ok(menu.querySelector(".be-clone-button"));
    assert.ok(menu.querySelector(".be-border-button"));
  });

  it("toggles the context menu open on trigger click and closed on second click", function () {
    const section = document.getElementById("section-traits");
    const actions = section.closest(".be-section-wrapper").querySelector(".be-section-actions");
    const trigger = actions.querySelector(".be-more-options-button");
    const menu = actions.querySelector(".be-context-menu");
    trigger.click();
    assert.strictEqual(menu.style.display, "block");
    trigger.click();
    assert.strictEqual(menu.style.display, "none");
  });

  it("shows a visible delete button only for clones, in the main bar", function () {
    const section = document.getElementById("clone-99");
    const actions = section.closest(".be-section-wrapper").querySelector(".be-section-actions");
    const deleteBtn = actions.querySelector(":scope > button.be-clone-delete");
    assert.ok(deleteBtn, "clone delete should be a direct main-bar button");
    const regular = document.getElementById("section-traits")
      .closest(".be-section-wrapper")
      .querySelector(".be-section-actions");
    assert.strictEqual(
      regular.querySelectorAll(":scope > button.be-clone-delete").length,
      0,
    );
  });

  it("getOrCreateActionContainer reuses the existing container", function () {
    const section = document.getElementById("section-traits");
    const wrapper = section.closest(".be-section-wrapper");
    const first = wrapper.querySelector(".be-section-actions");
    const again = window.getOrCreateActionContainer(section);
    assert.strictEqual(again, first);
    assert.strictEqual(wrapper.querySelectorAll(".be-section-actions").length, 1);
  });

  it("clicks a secondary (menu) button close the menu again", function () {
    const section = document.getElementById("section-traits");
    const actions = section.closest(".be-section-wrapper").querySelector(".be-section-actions");
    const trigger = actions.querySelector(".be-more-options-button");
    trigger.click();
    assert.strictEqual(actions.querySelector(".be-context-menu").style.display, "block");
    const cloneBtn = actions.querySelector(".be-context-menu .be-clone-button");
    cloneBtn.click();
    assert.strictEqual(actions.querySelector(".be-context-menu").style.display, "none");
  });

  it("wires shape actions: visible delete/rotate + menu with switch/clone", function () {
    const shape = document.getElementById("shape-1");
    const actions = shape.querySelector(".be-section-actions");
    assert.ok(actions, "shape should get an action container");
    assert.ok(actions.querySelector(":scope > button.be-shape-delete"));
    assert.ok(actions.querySelector(":scope > button.be-shape-rotate"));
    const menu = actions.querySelector(".be-context-menu");
    assert.ok(menu.querySelector(".be-shape-switch"));
    assert.ok(menu.querySelector(".be-shape-clone"));
  });
});
