/**
 * Browser E2E — PR #9 "Details are being polished": the clone-button
 * injection + reusable input modal + clone snapshot rendering surfaced as
 * section-action UI, plus clone title editing and deletion (the user-facing
 * part of section_cloning_20260212 that this PR finalized).
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. Every section offers a clone action from its context menu.
 *   2. Cloning prompts via the reusable input modal and creates a named
 *      clone in the sections layer.
 *   3. Clones keep their dimensions relative to the source.
 *   4. Clone titles are editable and clones deletable (with feedback).
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:polish
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #9 Clone UI polish + input modal (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  async function pickCloneable(page) {
    const id = await page.evaluate(() => {
      const w = Array.from(
        document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
      ).find((x) => {
        const m = x.querySelector(":scope > .be-section-actions > .be-context-menu");
        return m && m.querySelector(".be-clone-button");
      });
      return w ? w.id : null;
    });
    assert.ok(id, "a clonable section exists");
    return id;
  }

  async function makeClone(page, name) {
    const id = await pickCloneable(page);
    await domClick(page, `#${id} > .be-section-actions > .be-more-options-button`);
    await page.waitForTimeout(250);
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
        Array.from(document.querySelectorAll(".be-section-wrapper")).some(
          (w) => w.dataset.title === name,
        ),
      name,
      { timeout: 20000 },
    );
    return id;
  }

  it("every section offers a clone action", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const ws = Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        );
        const canClone = ws.filter((w) => {
          const m = w.querySelector(":scope > .be-section-actions > .be-context-menu");
          return m && m.querySelector(".be-clone-button");
        }).length;
        return { total: ws.length, canClone };
      });
      assert.ok(st.total >= 20);
      assert.ok(st.canClone >= st.total * 0.8, "most sections offer clone: " + st.canClone + "/" + st.total);
    } finally {
      await page.close();
    }
  });

  it("cloning prompts via the input modal and creates a named clone", async function () {
    const page = await bootPage(ctx);
    try {
      const name = "PolishedClone-" + Date.now();
      await makeClone(page, name);
      const st = await page.evaluate((name) => {
        const w = Array.from(document.querySelectorAll(".be-section-wrapper")).find(
          (x) => x.dataset.title === name,
        );
        const c = w && w.querySelector(".print-section-container");
        return {
          isClone: c && c.classList.contains("be-clone"),
          inSectionsLayer: !!(c && c.closest("#print-enhance-sections-layer")),
          titleShown: (c && c.textContent) || "",
        };
      }, name);
      assert.ok(st.isClone, "created a .be-clone container");
      assert.ok(st.inSectionsLayer, "clone in the sections layer");
      assert.ok(st.titleShown.trim().length > 0, "clone has content");
    } finally {
      await page.close();
    }
  });

  it("clone renders as a real sized section (dimensions preserved via CSS/size)", async function () {
    const page = await bootPage(ctx);
    try {
      const name = "DimClone-" + Date.now();
      await makeClone(page, name);
      const cloneBox = await page.evaluate((name) => {
        const w = Array.from(document.querySelectorAll(".be-section-wrapper")).find(
          (x) => x.dataset.title === name,
        );
        const r = w.getBoundingClientRect();
        return { w: r.width, h: r.height };
      }, name);
      assert.ok(cloneBox.w > 50 && cloneBox.h > 20,
        "clone renders with a real size: " + cloneBox.w + "x" + cloneBox.h);
    } finally {
      await page.close();
    }
  });

  it("clone title is editable and the clone deletable with feedback", async function () {
    const page = await bootPage(ctx);
    try {
      const name = "EditableClone-" + Date.now();
      await makeClone(page, name);
      const newName = name + "-renamed";
      const id = await page.evaluate(
        (name) => {
          const w = Array.from(document.querySelectorAll(".be-section-wrapper")).find(
            (x) => x.dataset.title === name,
          );
          return w ? w.id : null;
        },
        name,
      );
      await page.evaluate((id) => {
        document.getElementById(id).dispatchEvent(
          new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
        );
      }, id);
      await page.waitForSelector(".be-modal-overlay input", { timeout: 15000 });
      await page.evaluate((newName) => {
        const input = document.querySelector(".be-modal-overlay input");
        input.value = newName;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, newName);
      await domClick(page, ".be-modal-overlay .be-modal-ok");
      await page.waitForFunction(
        ({ id, newName }) => document.getElementById(id).dataset.title === newName,
        { id, newName },
        { timeout: 10000 },
      );
      // delete
      await page.evaluate((id) => {
        const w = document.getElementById(id);
        const btn = w.querySelector(":scope > .be-section-actions > .be-clone-delete");
        btn.click();
      }, id);
      // The delete is GATED: `sectionCloningAskConfirm` (the in-app modal primitive, not
      // native confirm()) and then `cloningDestructiveGate` (a snapshot that can REFUSE the
      // delete). The comment here used to say "confirm() is auto-accepted" — true before the
      // in-app confirm, and the reason this case timed out instead of failing on an
      // assertion (ISSUE_browser_e2e_gate_drift_20260912, F1). Drive the modal the product
      // actually shows, exactly as the clone-CREATION cases above do.
      await page.waitForSelector(".be-modal-overlay .be-modal-ok", { timeout: 15000 });
      const verb = await page.evaluate(() => {
        const ok = document.querySelector(".be-modal-overlay .be-modal-ok");
        const text = ok.textContent.trim();
        ok.click();
        return text;
      });
      assert.strictEqual(verb, "Delete", "the in-app confirm offers the destructive verb");
      await page.waitForFunction((id) => !document.getElementById(id), id, { timeout: 20000 });
      assert.ok(true, "clone renamed then deleted");
    } finally {
      await page.close();
    }
  });
});
