/**
 * Browser E2E — PR #10 "Compact mode" (section_cloning_20260212): the
 * section-cloning feature — Clone via a named input modal, clones as
 * draggable sections that preserve content but exclude extension UI and
 * spell filters, editable titles (double-click), and deletion.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. Cloning a section prompts for a name (reusable input modal) and
 *      creates a .be-clone section titled with it.
 *   2. The clone preserves the source content but strips extension
 *      chrome (action bars) and spell filters from its snapshot.
 *   3. Double-clicking a clone's header lets the user rename it.
 *   4. The clone can be deleted via its visible Delete control.
 *
 * (Compact-mode toggling itself is covered by the PR #34 properties-panel
 * suite.)
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:clone
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #10 Section cloning (named clone, edit title, delete) (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  async function cloneNamed(page, name) {
    const id = await page.evaluate(() => {
      const w = Array.from(
        document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
      ).find((x) => {
        const m = x.querySelector(
          ":scope > .be-section-actions > .be-context-menu",
        );
        return m && m.querySelector(".be-clone-button");
      });
      return w ? w.id : null;
    });
    assert.ok(id, "clonable section not found");
    await domClick(page, `#${id} > .be-section-actions > .be-more-options-button`);
    await page.waitForTimeout(300);
    await domClick(page, `#${id} > .be-section-actions > .be-context-menu > .be-clone-button`);
    await page.waitForSelector(".be-modal-overlay input", { timeout: 15000 });
    await page.evaluate((name) => {
      const input = document.querySelector(".be-modal-overlay input");
      input.value = name;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, name);
    await domClick(page, ".be-modal-overlay .be-modal-ok");
    await page.waitForFunction(
      (name) =>
        Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        ).some((w) => w.dataset.title === name),
      name,
      { timeout: 20000 },
    );
    return id;
  }

  it("cloning prompts for a name and creates a titled clone", async function () {
    const page = await bootPage(ctx);
    try {
      const before = await page.evaluate(
        () => document.querySelectorAll(".print-section-container.be-clone").length,
      );
      const name = "E2EClone-" + Date.now();
      await cloneNamed(page, name);
      const after = await page.evaluate(
        (name) => {
          const w = Array.from(
            document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
          ).find((x) => x.dataset.title === name);
          const c = w && w.querySelector(".print-section-container");
          return {
            clones: document.querySelectorAll(".print-section-container.be-clone").length,
            idIsClone: c && c.id.startsWith("clone-"),
            isClone: c && c.classList.contains("be-clone"),
          };
        },
        name,
      );
      assert.strictEqual(after.clones, before + 1, "one clone created");
      assert.ok(after.idIsClone, "clone container id starts with clone-");
      assert.ok(after.isClone, "clone marked .be-clone");
    } finally {
      await page.close();
    }
  });

  it("clone preserves content but excludes extension chrome and spell filters", async function () {
    const page = await bootPage(ctx);
    try {
      const name = "E2ECloneContent-" + Date.now();
      await cloneNamed(page, name);
      const st = await page.evaluate((name) => {
        const w = Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        ).find((x) => x.dataset.title === name);
        const c = w.querySelector(".print-section-container");
        return {
          hasContent: c.textContent.trim().length > 10,
          noSectionActions: c.querySelectorAll(".be-section-actions, .be-clone-button, .be-more-options-button").length === 0,
          noSpellFilter: !c.querySelector(".ct-spells-filter"),
          noHeaderDup: c.querySelectorAll(".ct-content-group__header").length <= 1,
        };
      }, name);
      assert.ok(st.hasContent, "clone retains source content");
      assert.ok(st.noSectionActions, "extension action chrome stripped from clone");
      assert.ok(st.noSpellFilter, "spell filters excluded from clones");
      assert.ok(st.noHeaderDup, "no duplicated standardized header");
    } finally {
      await page.close();
    }
  });

  it("double-clicking the clone title renames it via the input modal", async function () {
    const page = await bootPage(ctx);
    try {
      const name = "E2ERename-" + Date.now();
      const newName = name + "-v2";
      await cloneNamed(page, name);
      const id = await page.evaluate(
        (name) => {
          const w = Array.from(
            document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
          ).find((x) => x.dataset.title === name);
          return w ? w.id : null;
        },
        name,
      );
      // double-click the clone wrapper (title edit listener on wrapper)
      await page.evaluate((id) => {
        const w = document.getElementById(id);
        w.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      }, id);
      await page.waitForSelector(".be-modal-overlay input", { timeout: 15000 });
      await page.evaluate((newName) => {
        const input = document.querySelector(".be-modal-overlay input");
        input.value = newName;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, newName);
      await domClick(page, ".be-modal-overlay .be-modal-ok");
      await page.waitForFunction(
        ({ id, newName }) => {
          const w = document.getElementById(id);
          return w && w.dataset.title === newName;
        },
        { id, newName },
        { timeout: 10000 },
      );
      assert.ok(true, "clone renamed to " + newName);
    } finally {
      await page.close();
    }
  });

  it("a clone can be deleted via its visible Delete control", async function () {
    const page = await bootPage(ctx);
    try {
      const name = "E2EDeleteClone-" + Date.now();
      await cloneNamed(page, name);
      const id = await page.evaluate(
        (name) => {
          const w = Array.from(
            document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
          ).find((x) => x.dataset.title === name);
          return w ? w.id : null;
        },
        name,
      );
      await page.evaluate((id) => {
        const w = document.getElementById(id);
        const btn = w.querySelector(
          ":scope > .be-section-actions > .be-clone-delete",
        );
        btn.click();
      }, id);
      // The delete is GATED by the in-app confirm + snapshot (`section_cloning.js`), so
      // nothing auto-accepts it — the modal must be driven, exactly as the clone-creation
      // cases in this file do (ISSUE_browser_e2e_gate_drift_20260912, F1).
      await page.waitForSelector(".be-modal-overlay .be-modal-ok", { timeout: 15000 });
      const verb = await page.evaluate(() => {
        const ok = document.querySelector(".be-modal-overlay .be-modal-ok");
        const text = ok.textContent.trim();
        ok.click();
        return text;
      });
      assert.strictEqual(verb, "Delete", "the in-app confirm offers the destructive verb");
      await page.waitForFunction(
        (id) => !document.getElementById(id),
        id,
        { timeout: 20000 },
      );
      assert.ok(true, "clone removed by its Delete control");
    } finally {
      await page.close();
    }
  });
});
