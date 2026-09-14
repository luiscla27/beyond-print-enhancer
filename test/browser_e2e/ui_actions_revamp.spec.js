/**
 * Browser E2E — PR #38 "Simplify UI logic" (ui_actions_revamp_20260518):
 * the section/shape actions revamp that moved secondary actions into a
 * minimalist "More Options" context menu.
 *
 * One test per user-facing UI iteration made available by the merged PR:
 *   Sections : primary-only bar (Select / Delete-Clone visible), the ⋮
 *              trigger, menu open/close/toggle/outside-click, and the
 *              relocated menu flows (Clone, Delete clone, Border picker,
 *              Compact toggle, Split Skills).
 *   Shapes   : primary-only bar (Delete / Rotate visible), the ⋮ trigger,
 *              and the relocated menu flows (Switch asset, Clone shape)
 *              plus the visible Rotate toggle.
 *   Consistency: trigger + menu use identical classes on sections & shapes.
 *
 * Requires the real, publicly reachable demo sheet + the unpacked MV3
 * extension in Chromium (mirrors scripts/screenshot.js boot). Not part of
 * the unit gate — run via:  npm run test:e2e
 */

"use strict";

const assert = require("assert");
// The SHARED harness, not a private copy (ISSUE_browser_e2e_gate_drift_20260912, F2).
// This spec used to carry its own `launchPersistentContext` + `bootPage` + `domClick` block,
// byte-for-byte the pre-split `_helpers.js` — so the harness's boot policy lived in TWO places:
// the page-error tolerance added to `_helpers/dom.js` could not reach this spec, and this copy
// also skipped the shared profile-directory cleanup (a crashed run leaked ~48MB here).
// The F2 fix has to hold for the whole gate, so the duplicate is deleted rather than duplicated.
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #38 UI revamp — section/shape actions context menu (Playwright e2e)", function () {
  this.timeout(600000); // whole suite: live sheet + per-test boot

  let ctx;

  before(async function () {
    ctx = await launchExtensionContext();
  });

  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /** Pick a wrapper whose context menu contains `menuSel` (or any wrapper if
   *  null), returning a locator-usable selector for that wrapper. */
  async function pickWrapper(page, { shape = false, menuSel = null, needContent = false } = {}) {
    const sel = shape
      ? ".be-shape-wrapper"
      : ".be-section-wrapper:not(.be-shape-wrapper)";
    const target = await page.evaluate(
      ({ sel, menuSel, needContent }) => {
        const wrappers = Array.from(document.querySelectorAll(sel));
        // Prefer wrappers whose container has real content (clonable).
        const ordered = needContent
          ? [...wrappers].sort((a, b) => {
              const ac = a.querySelector(".print-section-container .print-section-content");
              const bc = b.querySelector(".print-section-container .print-section-content");
              return (bc ? 1 : 0) - (ac ? 1 : 0);
            })
          : wrappers;
        for (const w of ordered) {
          const bar = w.querySelector(":scope > .be-section-actions");
          if (!bar) continue;
          const menu = bar.querySelector(".be-context-menu");
          if (menuSel && !(menu && menu.querySelector(menuSel))) continue;
          if (!menuSel && !bar.querySelector(".be-more-options-button")) continue;
          const cont = w.querySelector(".print-section-container, .be-shape-container");
          return { wId: w.id || "", contId: (cont && cont.id) || "" };
        }
        return null;
      },
      { sel, menuSel, needContent },
    );
    assert.ok(target, "no wrapper matched" + (menuSel ? " with " + menuSel : ""));
    // All wrapper/container ids in this codebase are CSS-safe [A-Za-z0-9_-];
    // guard anyway and fall back to a plain id selector.
    const safeId = /^[A-Za-z0-9_-]+$/.test(target.wId);
    const wSel = target.wId && safeId
      ? "#" + target.wId
      : target.wId
        ? '[id="' + target.wId + '"]'
        : sel;
    return { wSel, contId: target.contId };
  }

  /** Click the wrapper's More Options trigger and wait for its menu to show. */
  async function openMenu(page, wSel) {
    await domClick(page, wSel + " > .be-section-actions > .be-more-options-button");
    await page.waitForFunction(
      (wSel) => {
        const w = document.querySelector(wSel);
        const menu = w && w.querySelector(":scope > .be-section-actions > .be-context-menu");
        return !!menu && menu.style.display === "block";
      },
      wSel,
      { timeout: 10000 },
    );
  }

  async function menuVisible(page, wSel) {
    return page.evaluate(
      (wSel) => {
        const w = document.querySelector(wSel);
        const menu = w && w.querySelector(":scope > .be-section-actions > .be-context-menu");
        return !!menu && menu.style.display === "block";
      },
      wSel,
    );
  }

  /** Click a menu item inside the wrapper's (open) context menu. */
  async function clickMenuItem(page, wSel, itemSel) {
    await domClick(page, wSel + " > .be-section-actions > .be-context-menu > " + itemSel);
  }

  /** Visible (non-hidden) direct children of the wrapper's action bar. */
  async function barVisibleChildren(page, wSel) {
    return page.evaluate(
      (wSel) => {
        const w = document.querySelector(wSel);
        const bar = w && w.querySelector(":scope > .be-section-actions");
        if (!bar) return [];
        return Array.from(bar.children)
          .filter((c) => c.className && c.style && c.style.display !== "none")
          .map((c) => (typeof c.className === "string" ? c.className : ""));
      },
      wSel,
    );
  }

  /* ------------------------------------------------------------------ */
  /* SECTION UI iterations                                               */
  /* ------------------------------------------------------------------ */

  it("section bar shows only primary actions + ⋮ trigger (secondary actions live in the hidden menu)", async function () {
    const page = await bootPage(ctx);
    try {
      const { wSel } = await pickWrapper(page, { menuSel: ".be-clone-button" });
      const visible = await barVisibleChildren(page, wSel);
      // Menu is hidden by default; the only visible controls are the trigger
      // and the primary Select button (clone-delete only exists on clones).
      assert.ok(visible.includes("be-more-options-button"), "⋮ trigger should be visible");
      assert.ok(visible.includes("be-select-section-button"), "Select Section primary should be visible");
      assert.ok(
        !visible.some((c) => /be-(clone|border|compact|split)-button/.test(c)),
        "relocated secondary buttons must NOT be visible in the bar: " + visible.join(","),
      );
      // Secondary buttons exist but inside the (hidden) menu container.
      const menuCls = await page.evaluate(
        (wSel) => {
          const w = document.querySelector(wSel);
          const menu = w && w.querySelector(":scope > .be-section-actions > .be-context-menu");
          return menu ? { display: menu.style.display, clone: !!menu.querySelector(".be-clone-button"), border: !!menu.querySelector(".be-border-button") } : null;
        },
        wSel,
      );
      assert.strictEqual(menuCls.display, "none", "menu starts hidden");
      assert.ok(menuCls.clone && menuCls.border, "menu should hold Clone + Border actions");
    } finally {
      await page.close();
    }
  });

  it("clicking ⋮ on a section opens the context menu with the relocated actions", async function () {
    const page = await bootPage(ctx);
    try {
      const { wSel } = await pickWrapper(page, { menuSel: ".be-border-button" });
      assert.strictEqual(await menuVisible(page, wSel), false, "menu hidden before open");
      await openMenu(page, wSel);
      assert.strictEqual(await menuVisible(page, wSel), true, "menu should be open");
      const items = await page.evaluate(
        (wSel) => {
          const w = document.querySelector(wSel);
          const menu = w.querySelector(":scope > .be-section-actions > .be-context-menu");
          return Array.from(menu.children).map((c) => c.className);
        },
        wSel,
      );
      assert.ok(items.includes("be-clone-button"), "Clone Section in menu");
      assert.ok(items.includes("be-border-button"), "Change Border Style in menu");
    } finally {
      await page.close();
    }
  });

  it("clicking ⋮ again toggles the section menu closed", async function () {
    const page = await bootPage(ctx);
    try {
      const { wSel } = await pickWrapper(page, { menuSel: ".be-clone-button" });
      await openMenu(page, wSel);
      assert.strictEqual(await menuVisible(page, wSel), true);
      await domClick(page, wSel + " > .be-section-actions > .be-more-options-button");
      await page.waitForFunction(
        (wSel) => {
          const w = document.querySelector(wSel);
          const menu = w && w.querySelector(":scope > .be-section-actions > .be-context-menu");
          return !menu || menu.style.display !== "block";
        },
        wSel,
        { timeout: 5000 },
      );
      assert.strictEqual(await menuVisible(page, wSel), false, "menu should close on second ⋮ click");
    } finally {
      await page.close();
    }
  });

  it("clicking outside closes an open section menu", async function () {
    const page = await bootPage(ctx);
    try {
      const { wSel } = await pickWrapper(page, { menuSel: ".be-clone-button" });
      await openMenu(page, wSel);
      assert.strictEqual(await menuVisible(page, wSel), true);
      // Click far from the menu (document body area, clear of the top-left
      // control panel) — the close listener is on document mousedown.
      const box = await page.evaluate(() => {
        const el = document.getElementById("print-layout-wrapper");
        const r = el.getBoundingClientRect();
        return { x: Math.max(120, r.left + r.width - 60), y: r.top + r.height / 2 };
      });
      await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(400);
      assert.strictEqual(await menuVisible(page, wSel), false, "menu should close on outside mousedown");
    } finally {
      await page.close();
    }
  });

  it("Clone Section flow from the menu creates a named clone with its own primary bar (incl. Delete Clone)", async function () {
    const page = await bootPage(ctx);
    try {
      const src = await pickWrapper(page, { menuSel: ".be-clone-button", needContent: true });
      const name = "E2E Clone " + Date.now();
      await openMenu(page, src.wSel);
      await clickMenuItem(page, src.wSel, ".be-clone-button");

      // Input modal for the clone name appears (be-modal with text input + OK).
      await page.waitForSelector(".be-modal-overlay input", { timeout: 15000 });
      const input = page.locator(".be-modal-overlay input").first();
      await input.fill(name);
      await domClick(page, ".be-modal-overlay .be-modal-ok");

      // The new clone wrapper appears, is interactive, and gets its own
      // action bar with a visible Delete-Clone primary (it is a clone).
      await page.waitForFunction(
        (name) => {
          const w = Array.from(document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"))
            .find((x) => x.dataset.title === name);
          if (!w) return false;
          const bar = w.querySelector(":scope > .be-section-actions");
          return !!bar && !!bar.querySelector(".be-clone-delete");
        },
        name,
        { timeout: 20000 },
      );
      const info = await page.evaluate(
        (name) => {
          const w = Array.from(document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"))
            .find((x) => x.dataset.title === name);
          const cont = w.querySelector(".print-section-container");
          const bar = w.querySelector(":scope > .be-section-actions");
          return { contId: cont && cont.id, isClone: cont && cont.classList.contains("be-clone"), deleteVisible: !!bar.querySelector(".be-clone-delete"), trigger: !!bar.querySelector(".be-more-options-button") };
        },
        name,
      );
      assert.ok(/^clone-/.test(info.contId || ""), "new container id should start with clone-, got " + info.contId);
      assert.ok(info.deleteVisible, "clone should expose visible Delete Clone");
      assert.ok(info.trigger, "clone should expose ⋮ trigger too");
    } finally {
      await page.close();
    }
  });

  it("Delete Clone (visible primary on a clone) removes the clone", async function () {
    const page = await bootPage(ctx);
    try {
      // Make a clone first, then delete it via its visible Delete Clone.
      const src = await pickWrapper(page, { menuSel: ".be-clone-button", needContent: true });
      const name = "E2E Del " + Date.now();
      await openMenu(page, src.wSel);
      await clickMenuItem(page, src.wSel, ".be-clone-button");
      await page.waitForSelector(".be-modal-overlay input", { timeout: 15000 });
      await page.locator(".be-modal-overlay input").first().fill(name);
      await domClick(page, ".be-modal-overlay .be-modal-ok");
      await page.waitForFunction(
        (name) =>
          Array.from(document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)")).some((x) => x.dataset.title === name),
        name,
        { timeout: 20000 },
      );
      // Click the clone's visible Delete Clone. The delete is GATED by the in-app confirm
      // (`sectionCloningAskConfirm`) and then the snapshot gate, so the modal has to be
      // driven — the old comment here claimed `confirm()` was auto-accepted, which is the
      // pre-unification contract (ISSUE_browser_e2e_gate_drift_20260912, F1).
      await page.evaluate(
        (name) => {
          const w = Array.from(document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"))
            .find((x) => x.dataset.title === name);
          const btn = w.querySelector(":scope > .be-section-actions > .be-clone-delete");
          btn.click();
        },
        name,
      );
      await page.waitForSelector(".be-modal-overlay .be-modal-ok", { timeout: 15000 });
      const verb = await page.evaluate(() => {
        const ok = document.querySelector(".be-modal-overlay .be-modal-ok");
        const text = ok.textContent.trim();
        ok.click();
        return text;
      });
      assert.strictEqual(verb, "Delete", "the in-app confirm offers the destructive verb");
      await page.waitForFunction(
        (name) =>
          !Array.from(document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)")).some((x) => x.dataset.title === name),
        name,
        { timeout: 20000 },
      );
      assert.ok(true, "clone removed after Delete Clone");
    } finally {
      await page.close();
    }
  });

  it("Change Border Style flow from the menu opens the picker and applies the chosen border class", async function () {
    const page = await bootPage(ctx);
    try {
      const src = await pickWrapper(page, { menuSel: ".be-border-button" });
      const contBefore = await page.evaluate(
        (wSel) => {
          const w = document.querySelector(wSel);
          const c = w.querySelector(".print-section-container");
          return c && c.id;
        },
        src.wSel,
      );
      await openMenu(page, src.wSel);
      await clickMenuItem(page, src.wSel, ".be-border-button");
      await page.waitForSelector(".be-modal-overlay", { timeout: 15000 });
      // Choose the "Spikes" border option then Apply.
      await domClick(page, ".be-border-option:has(.spikes_border)");
      await domClick(page, ".be-modal-overlay .be-modal-ok");
      await page.waitForFunction(
        (contId) => {
          const c = document.getElementById(contId);
          return c && c.classList.contains("spikes_border");
        },
        contBefore,
        { timeout: 10000 },
      );
      assert.ok(true, "border class spikes_border applied to " + contBefore);
    } finally {
      await page.close();
    }
  });

  it("Toggle Compact Mode flow from the menu adds/removes be-compact-mode on the section", async function () {
    const page = await bootPage(ctx);
    try {
      const src = await pickWrapper(page, { menuSel: ".be-compact-button" });
      const contSel = await page.evaluate(
        (wSel) => {
          const w = document.querySelector(wSel);
          const c = w.querySelector(".print-section-container");
          return c && c.id;
        },
        src.wSel,
      );
      await openMenu(page, src.wSel);
      await clickMenuItem(page, src.wSel, ".be-compact-button");
      await page.waitForFunction(
        (contId) => {
          const c = document.getElementById(contId);
          return c && c.classList.contains("be-compact-mode");
        },
        contSel,
        { timeout: 10000 },
      );
      // Toggle back off via the same menu flow.
      await domClick(page, src.wSel + " > .be-section-actions > .be-more-options-button");
      await clickMenuItem(page, src.wSel, ".be-compact-button");
      await page.waitForFunction(
        (contId) => {
          const c = document.getElementById(contId);
          return c && !c.classList.contains("be-compact-mode");
        },
        contSel,
        { timeout: 10000 },
      );
      assert.ok(true, "compact mode toggled ON then OFF");
    } finally {
      await page.close();
    }
  });

  it("Split Skills flow from the skills section menu splits the skills box into stat sections", async function () {
    const page = await bootPage(ctx);
    try {
      const src = await pickWrapper(page, { menuSel: ".be-split-skills-button" });
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)").length,
      );
      await openMenu(page, src.wSel);
      await clickMenuItem(page, src.wSel, ".be-split-skills-button");
      await page.waitForFunction(
        (before) =>
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)").length > before,
        before,
        { timeout: 20000 },
      );
      assert.ok(true, "skills split produced additional stat sections");
    } finally {
      await page.close();
    }
  });

  /* ------------------------------------------------------------------ */
  /* SHAPE UI iterations                                                 */
  /* ------------------------------------------------------------------ */

  it("shape bar shows only Delete + Rotate + ⋮ (Switch/Clone live in the hidden menu)", async function () {
    const page = await bootPage(ctx);
    try {
      const { wSel } = await pickWrapper(page, { shape: true, menuSel: ".be-shape-switch" });
      const visible = await barVisibleChildren(page, wSel);
      assert.ok(visible.includes("be-more-options-button"), "⋮ trigger visible on shapes");
      assert.ok(visible.includes("be-shape-delete"), "Delete Shape visible");
      assert.ok(visible.includes("be-shape-rotate"), "Rotate Shape visible");
      assert.ok(
        !visible.some((c) => /be-shape-(switch|clone)/.test(c)),
        "Switch/Clone must NOT be visible in the bar: " + visible.join(","),
      );
      const menuInfo = await page.evaluate(
        (wSel) => {
          const w = document.querySelector(wSel);
          const menu = w && w.querySelector(":scope > .be-section-actions > .be-context-menu");
          return menu ? { display: menu.style.display, sw: !!menu.querySelector(".be-shape-switch"), cl: !!menu.querySelector(".be-shape-clone") } : null;
        },
        wSel,
      );
      assert.strictEqual(menuInfo.display, "none", "shape menu starts hidden");
      assert.ok(menuInfo.sw && menuInfo.cl, "shape menu should hold Switch + Clone");
    } finally {
      await page.close();
    }
  });

  it("opening the shape ⋮ menu exposes Switch Shape Asset and Clone Shape", async function () {
    const page = await bootPage(ctx);
    try {
      const { wSel } = await pickWrapper(page, { shape: true, menuSel: ".be-shape-clone" });
      await openMenu(page, wSel);
      assert.strictEqual(await menuVisible(page, wSel), true);
      const items = await page.evaluate(
        (wSel) => {
          const w = document.querySelector(wSel);
          const menu = w.querySelector(":scope > .be-section-actions > .be-context-menu");
          return Array.from(menu.children).map((c) => c.className);
        },
        wSel,
      );
      assert.ok(items.includes("be-shape-switch"), "Switch Shape Asset in menu");
      assert.ok(items.includes("be-shape-clone"), "Clone Shape in menu");
    } finally {
      await page.close();
    }
  });

  it("Rotate Shape (visible primary) toggles the rotation handle on the shape wrapper", async function () {
    const page = await bootPage(ctx);
    try {
      const { wSel } = await pickWrapper(page, { shape: true, menuSel: ".be-shape-clone" });
      await domClick(page, wSel + " > .be-section-actions > .be-shape-rotate");
      await page.waitForFunction(
        (wSel) => !!document.querySelector(wSel + " > .be-rotation-handle"),
        wSel,
        { timeout: 10000 },
      );
      await domClick(page, wSel + " > .be-section-actions > .be-shape-rotate");
      await page.waitForFunction(
        (wSel) => !document.querySelector(wSel + " > .be-rotation-handle"),
        wSel,
        { timeout: 10000 },
      );
      assert.ok(true, "rotation handle shown then hidden by Rotate toggle");
    } finally {
      await page.close();
    }
  });

  it("Switch Shape Asset flow from the menu swaps the shape's asset", async function () {
    const page = await bootPage(ctx);
    try {
      const { wSel } = await pickWrapper(page, { shape: true, menuSel: ".be-shape-switch" });
      const before = await page.evaluate(
        (wSel) => {
          const w = document.querySelector(wSel);
          const c = w.querySelector(".be-shape-container");
          return c && c.dataset.assetPath;
        },
        wSel,
      );
      await openMenu(page, wSel);
      await clickMenuItem(page, wSel, ".be-shape-switch");
      await page.waitForSelector(".be-modal-overlay", { timeout: 15000 });
      // Pick a different asset (an option that is not the currently selected one).
      const clicked = await page.evaluate((before) => {
        const opts = Array.from(document.querySelectorAll(".be-border-option"));
        const target = opts.find((o) => o.dataset && o.title !== before && !o.classList.contains("selected")) || opts[opts.length - 1];
        if (!target) return null;
        target.click();
        return target.title || target.textContent.trim();
      }, before);
      assert.ok(clicked, "a shape asset option should be clickable");
      await domClick(page, ".be-modal-overlay .be-modal-ok");
      await page.waitForFunction(
        ({ wSel, before }) => {
          const w = document.querySelector(wSel);
          const c = w.querySelector(".be-shape-container");
          return c && c.dataset.assetPath && c.dataset.assetPath !== before;
        },
        { wSel, before },
        { timeout: 15000 },
      );
      assert.ok(true, "shape asset changed from " + before);
    } finally {
      await page.close();
    }
  });

  it("Clone Shape flow from the menu duplicates the shape wrapper", async function () {
    const page = await bootPage(ctx);
    try {
      const src = await pickWrapper(page, { shape: true, menuSel: ".be-shape-clone" });
      const countBefore = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
      await openMenu(page, src.wSel);
      await clickMenuItem(page, src.wSel, ".be-shape-clone");
      await page.waitForFunction(
        (before) => document.querySelectorAll(".be-shape-wrapper").length > before,
        countBefore,
        { timeout: 15000 },
      );
      const cloned = await page.evaluate(
        (wSel) => {
          const original = document.querySelector(wSel);
          const all = Array.from(document.querySelectorAll(".be-shape-wrapper"));
          const clone = all.find((w) => w !== original && (w.id || "").startsWith("shape-clone-"));
          return { found: !!clone, id: clone ? clone.id : null };
        },
        src.wSel,
      );
      assert.ok(cloned.found, "cloned shape wrapper should exist with a shape-clone-* id, got " + cloned.id);
    } finally {
      await page.close();
    }
  });

  /* ------------------------------------------------------------------ */
  /* Consistency across sections & shapes                                */
  /* ------------------------------------------------------------------ */

  it("section and shape use the same ⋮ trigger + menu classes and placement", async function () {
    const page = await bootPage(ctx);
    try {
      const sec = await pickWrapper(page, { menuSel: ".be-clone-button" });
      const shp = await pickWrapper(page, { shape: true, menuSel: ".be-shape-clone" });
      const common = await page.evaluate(
        ({ sec, shp }) => {
          const g = (wSel) => {
            const w = document.querySelector(wSel);
            const bar = w.querySelector(":scope > .be-section-actions");
            return {
              trigger: bar && bar.querySelector(".be-more-options-button") ? "be-more-options-button" : null,
              menu: bar && bar.querySelector(".be-context-menu") ? "be-context-menu" : null,
              triggerParent: bar ? bar.className : null,
            };
          };
          return { sec: g(sec.wSel), shp: g(shp.wSel) };
        },
        { sec, shp },
      );
      assert.strictEqual(common.sec.trigger, "be-more-options-button");
      assert.strictEqual(common.shp.trigger, common.sec.trigger, "identical trigger class");
      assert.strictEqual(common.shp.menu, "be-context-menu");
      assert.strictEqual(common.shp.menu, common.sec.menu, "identical menu class");
      assert.strictEqual(common.shp.triggerParent, "be-section-actions", "menu lives in .be-section-actions");
      assert.strictEqual(common.sec.triggerParent, common.shp.triggerParent, "identical placement");
    } finally {
      await page.close();
    }
  });
});
