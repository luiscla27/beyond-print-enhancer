/**
 * Browser E2E — PR #35 "Print per layer fixes": layer-manager behaviors that
 * drive the printed output — per-layer print visibility, front-to-back
 * z-index sync, layer visibility/lock toggles and the generated print CSS.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The Layer Management panel lists the layer rows (Sections + Shape
 *      layers) each with Print / Visibility / Edit (lock) controls.
 *   2. Toggling Print Visibility on a layer disables it on print: the layer
 *      DOM container gets data-print-disabled="true", the panel button flips
 *      to the 🖨️❌ state and the injected @media print CSS gains a hide rule.
 *   3. Toggling Visibility hides/shows the layer's DOM container.
 *   4. Locking/unlocking (Edit mode) flips the lock control and applies the
 *      locked-layer styling (be-layer-locked on the container).
 *   5. The section content list mirrors the sheet (top-of-list = visually
 *      front) and print z-indexes are synced so the top item carries the
 *      highest data-print-z.
 *   6. The injected print CSS enforces layer priority (sections layer vs
 *      shape layer containers) inside @media print.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:layer
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #35 Print per layer fixes (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("Layer Management panel lists layer rows with Print/Visibility/Edit controls", async function () {
    const page = await bootPage(ctx);
    try {
      const panel = await page.evaluate(() => {
        const p = document.getElementById("print-enhance-layer-manager");
        if (!p) return null;
        const rows = Array.from(p.querySelectorAll(".be-layer-row")).map((r) => ({
          id: r.dataset.layerId,
          label: r.querySelector("span") && r.querySelector("span").textContent,
          titles: Array.from(r.querySelectorAll(".be-layer-controls button")).map(
            (b) => b.title,
          ),
        }));
        return { rows, addLayer: !!p.querySelector("#print-enhance-add-layer") };
      });
      assert.ok(panel, "Layer Management panel should exist");
      assert.ok(panel.addLayer, "Add Shape Layer button should exist");
      const ids = panel.rows.map((r) => r.id);
      assert.ok(ids.includes("sections"), "Sections layer row expected");
      assert.ok(
        ids.some((i) => i.startsWith("shapes")),
        "at least one shapes layer row expected",
      );
      for (const r of panel.rows) {
        assert.ok(
          r.titles.includes("Skip when printing") &&
            r.titles.includes("Hide on sheet") &&
            r.titles.includes("Toggle Edit Mode"),
          "each layer row should have print/visibility/edit controls: " +
            r.titles.join(","),
        );
      }
    } finally {
      await page.close();
    }
  });

  it("toggling Print Visibility disables the layer on print (data + button + CSS)", async function () {
    const page = await bootPage(ctx);
    try {
      await domClick(
        page,
        '.be-layer-row[data-layer-id="sections"] button[title="Skip when printing"]',
      );
      await page.waitForTimeout(800);
      const st = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-sections-layer");
        const panel = document.getElementById("print-enhance-layer-manager");
        const row = panel.querySelector('.be-layer-row[data-layer-id="sections"]');
        const css = document.getElementById("be-print-z-style");
        return {
          disabled: el ? el.dataset.printDisabled : null,
          state:
            (row.querySelector('button[title="Skip when printing"]') || {}).dataset
              ? row.querySelector('button[title="Skip when printing"]').dataset.state
              : null,
          css: css ? css.textContent : "",
        };
      });
      assert.strictEqual(st.disabled, "true", "layer marked disabled on print");
      assert.strictEqual(st.state, "off", "panel button shows print-disabled");
      assert.ok(
        /#print-enhance-sections-layer\s*\{[^}]*display:\s*none !important/.test(
          st.css,
        ),
        "print CSS should hide the disabled layer",
      );
    } finally {
      await page.close();
    }
  });

  it("toggle back re-enables print visibility and clears the print-disabled rule", async function () {
    const page = await bootPage(ctx);
    try {
      const sel =
        '.be-layer-row[data-layer-id="sections"] button[title="Skip when printing"]';
      await domClick(page, sel); // disable
      await page.waitForTimeout(500);
      await domClick(page, sel); // re-enable
      await page.waitForTimeout(800);
      const st = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-sections-layer");
        const panel = document.getElementById("print-enhance-layer-manager");
        const row = panel.querySelector('.be-layer-row[data-layer-id="sections"]');
        const css = document.getElementById("be-print-z-style");
        return {
          disabled: el ? el.dataset.printDisabled : null,
          state:
            (row.querySelector('button[title="Skip when printing"]') || {}).dataset
              ? row.querySelector('button[title="Skip when printing"]').dataset.state
              : null,
          css: css ? css.textContent : "",
        };
      });
      assert.strictEqual(st.disabled, "false", "layer re-enabled on print");
      assert.strictEqual(st.state, "on", "button back to enabled");
      assert.ok(
        !/#print-enhance-sections-layer\s*\{[^}]*display:\s*none !important/.test(
          st.css,
        ),
        "print CSS hide rule removed after re-enable",
      );
    } finally {
      await page.close();
    }
  });

  it("toggling layer Visibility hides and restores the layer DOM container", async function () {
    const page = await bootPage(ctx);
    try {
      const rowSel = '.be-layer-row[data-layer-id="shapes-default"]';
      const layerEl = "#print-enhance-shapes-layer";
      const btnSel =
        rowSel + ' button[title="Hide on sheet"]';
      // default shapes layer may be visible already; toggle to hide.
      await domClick(page, btnSel);
      await page.waitForTimeout(600);
      const hidden = await page.evaluate(
        (layerEl) => {
          const el = document.querySelector(layerEl);
          const panel = document.getElementById("print-enhance-layer-manager");
          const row = panel.querySelector(
            '.be-layer-row[data-layer-id="shapes-default"]',
          );
          return {
            display: el.style.display,
            state:
              (row.querySelector('button[title="Hide on sheet"]') || {}).dataset
                ? row.querySelector('button[title="Hide on sheet"]').dataset.state
                : null,
          };
        },
        layerEl,
      );
      assert.strictEqual(hidden.display, "none", "layer container hidden");
      assert.strictEqual(hidden.state, "hidden", "visibility button shows hidden");
      // toggle back
      await domClick(page, btnSel);
      await page.waitForTimeout(600);
      const restored = await page.evaluate(
        (layerEl) => {
          const el = document.querySelector(layerEl);
          const panel = document.getElementById("print-enhance-layer-manager");
          const row = panel.querySelector(
            '.be-layer-row[data-layer-id="shapes-default"]',
          );
          return {
            display: el.style.display,
            state:
              (row.querySelector('button[title="Hide on sheet"]') || {}).dataset
                ? row.querySelector('button[title="Hide on sheet"]').dataset.state
                : null,
          };
        },
        layerEl,
      );
      assert.notStrictEqual(restored.display, "none", "layer container restored");
      assert.strictEqual(restored.state, "visible");
    } finally {
      await page.close();
    }
  });

  it("locking/unlocking a shape layer flips the Edit control and applies locked styling", async function () {
    const page = await bootPage(ctx);
    try {
      const rowSel = '.be-layer-row[data-layer-id="shapes-default"]';
      const layerSel = "#print-enhance-shapes-layer";
      const btnSel = rowSel + ' button[title="Toggle Edit Mode"]';
      const initial = await page.evaluate(
        (layerSel) => {
          const el = document.querySelector(layerSel);
          const panel = document.getElementById("print-enhance-layer-manager");
          const row = panel.querySelector(
            '.be-layer-row[data-layer-id="shapes-default"]',
          );
          return {
            state:
              (row.querySelector('button[title="Toggle Edit Mode"]') || {}).dataset
                ? row.querySelector('button[title="Toggle Edit Mode"]').dataset.state
                : null,
            locked: el.classList.contains("be-layer-locked"),
          };
        },
        layerSel,
      );
      // default shapes layer starts locked -> unlock it
      if (initial.state === "locked") {
        await domClick(page, btnSel);
        await page.waitForTimeout(600);
      }
      const unlocked = await page.evaluate(
        (layerSel) => {
          const el = document.querySelector(layerSel);
          const panel = document.getElementById("print-enhance-layer-manager");
          const row = panel.querySelector(
            '.be-layer-row[data-layer-id="shapes-default"]',
          );
          return {
            state:
              (row.querySelector('button[title="Toggle Edit Mode"]') || {}).dataset
                ? row.querySelector('button[title="Toggle Edit Mode"]').dataset.state
                : null,
            locked: el.classList.contains("be-layer-locked"),
            active: el.classList.contains("be-active-layer"),
          };
        },
        layerSel,
      );
      assert.strictEqual(unlocked.state, "unlocked", "edit mode unlocked");
      assert.strictEqual(unlocked.locked, false, "locked styling removed");
      assert.strictEqual(unlocked.active, true, "unlocked layer becomes active");
    } finally {
      await page.close();
    }
  });

  it("section list mirrors front-to-back order and syncs print z-index (top = highest)", async function () {
    const page = await bootPage(ctx);
    try {
      const info = await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-layer-manager");
        const list = panel.querySelector(
          '.be-layer-content-list[data-layer="sections"]',
        );
        const items = Array.from(list.querySelectorAll(".be-layer-item-card"));
        if (items.length < 2) return { ok: false, count: items.length };
        const first = document.getElementById(items[0].dataset.targetId);
        const last = document.getElementById(
          items[items.length - 1].dataset.targetId,
        );
        return {
          ok: true,
          count: items.length,
          firstTitle: items[0].textContent,
          lastTitle: items[items.length - 1].textContent,
          firstZ: first ? first.dataset.printZ : null,
          lastZ: last ? last.dataset.printZ : null,
          // DOM order in the layer container is bottom-to-top: the top-of-list
          // item must be the LAST child of the layer container.
          containerFirst: (() => {
            const c = document.getElementById("print-enhance-sections-layer");
            return c && c.firstElementChild ? c.firstElementChild.id : null;
          })(),
          containerLast: (() => {
            const c = document.getElementById("print-enhance-sections-layer");
            return c && c.lastElementChild ? c.lastElementChild.id : null;
          })(),
        };
      });
      assert.ok(info.ok, "at least 2 sections expected in the layer list");
      assert.ok(
        parseInt(info.firstZ, 10) > parseInt(info.lastZ, 10),
        `top list item (${info.firstTitle}, z=${info.firstZ}) should carry a higher print z than the bottom (${info.lastTitle}, z=${info.lastZ})`,
      );
    } finally {
      await page.close();
    }
  });

  it("print CSS enforces layer priority (sections 1000 vs shape layers 2000)", async function () {
    const page = await bootPage(ctx);
    try {
      const css = await page.evaluate(() => {
        const s = document.getElementById("be-print-z-style");
        return s ? s.textContent : "";
      });
      assert.ok(css.includes("@media print"), "print css should be media-scoped");
      assert.ok(
        /print-enhance-sections-layer\s*\{\s*z-index:\s*1000\s*!important/.test(
          css,
        ),
        "sections layer should print at z-index 1000",
      );
      assert.ok(
        /be-shape-layer-container\s*\{\s*z-index:\s*2000\s*!important/.test(css),
        "shape layer containers should print at z-index 2000",
      );
    } finally {
      await page.close();
    }
  });
});
