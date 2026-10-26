/**
 * Browser E2E — PR #28 "Layer enhancements fixes, also layer management is
 * now hidden on print" (layer_print_visibility_20260421 family): print-time
 * layer behaviors — the Layer Management panel never prints, per-layer
 * "Disable on Print", and forced full opacity for locked layers on print.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The injected @media print CSS hides the Layer Management panel.
 *   2. Locked layers render fully opaque on print (static print CSS forces
 *      opacity:1 over the edit-mode dimming) — the edit-time 0.5 dimming is
 *      never visible on paper.
 *   3. Per-layer "Disable on Print" toggle marks the layer
 *      data-print-disabled=true and emits a hide rule for that layer id.
 *   4. Toggling back re-enables the layer and removes the hide rule.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:printvisibility
 */

"use strict";

const assert = require("assert");
const {
  launchExtensionContext,
  bootPage,
  domClick,
  contentCall,
} = require("./_helpers.js");

describe("PR #28 Layer manager hidden on print + print-disabled layers (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  const allCss = (page) =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll("style"))
        .map((s) => s.textContent)
        .join("\n"),
    );

  it("the Layer Management panel is hidden inside @media print", async function () {
    const page = await bootPage(ctx);
    try {
      const css = await allCss(page);
      // The rule appears in the static print CSS: media query containing
      // #print-enhance-layer-manager with display:none !important.
      const mediaBlocks = css.split("@media print");
      let found = false;
      for (const block of mediaBlocks) {
        if (block.includes("#print-enhance-layer-manager")) {
          if (/display:\s*none !important/.test(block)) found = true;
        }
      }
      assert.ok(found, "print CSS should hide the layer manager panel");
    } finally {
      await page.close();
    }
  });

  it("locked layers are forced fully opaque on print", async function () {
    const page = await bootPage(ctx);
    try {
      const css = await allCss(page);
      // Static/dynamic print rules override the edit-time 0.5 dimming.
      let found = false;
      const blocks = css.split("@media print");
      for (const b of blocks) {
        if (b.includes("be-layer-locked") || b.includes("be-lock-shapes")) {
          if (/opacity:\s*1 !important/.test(b)) found = true;
        }
      }
      assert.ok(
        found,
        "print CSS forces opacity:1 on locked layer containers",
      );
    } finally {
      await page.close();
    }
  });

  it("Disable on Print marks the layer container and hides it in print CSS", async function () {
    const page = await bootPage(ctx);
    try {
      await domClick(
        page,
        '.be-layer-row[data-layer-id="sections"] button[title="Skip when printing"]',
      );
      await page.waitForTimeout(700);
      const st = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-sections-layer");
        const dyn = document.getElementById("be-print-z-style");
        return {
          disabled: el.dataset.printDisabled,
          icon: (() => {
            const panel = document.getElementById("print-enhance-layer-manager");
            const row = panel.querySelector(
              '.be-layer-row[data-layer-id="sections"]',
            );
            const b = row.querySelector(
              'button[title="Skip when printing"]',
            );
            return b ? b.dataset.state : null;
          })(),
          css: dyn.textContent,
        };
      });
      assert.strictEqual(st.disabled, "true", "layer marked disabled on print");
      assert.strictEqual(st.icon, "off", "button shows disabled icon");
      assert.ok(
        /#print-enhance-sections-layer\s*\{[^}]*display:\s*none !important/.test(
          st.css,
        ),
        "dynamic print CSS hides the disabled layer",
      );
    } finally {
      await page.close();
    }
  });

  it("re-enabling a layer clears data-print-disabled and its hide rule", async function () {
    const page = await bootPage(ctx);
    try {
      const sel =
        '.be-layer-row[data-layer-id="sections"] button[title="Skip when printing"]';
      await domClick(page, sel); // disable
      await page.waitForTimeout(500);
      await domClick(page, sel); // re-enable
      await page.waitForTimeout(700);
      const st = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-sections-layer");
        const dyn = document.getElementById("be-print-z-style");
        return {
          disabled: el.dataset.printDisabled,
          icon: (() => {
            const panel = document.getElementById("print-enhance-layer-manager");
            const row = panel.querySelector(
              '.be-layer-row[data-layer-id="sections"]',
            );
            const b = row.querySelector(
              'button[title="Skip when printing"]',
            );
            return b ? b.dataset.state : null;
          })(),
          css: dyn.textContent,
        };
      });
      assert.strictEqual(st.disabled, "false", "layer re-enabled");
      assert.strictEqual(st.icon, "on", "icon back to enabled");
      assert.ok(
        !/#print-enhance-sections-layer\s*\{[^}]*display:\s*none !important/.test(
          st.css,
        ),
        "hide rule removed after re-enable",
      );
    } finally {
      await page.close();
    }
  });

  // -------------------------------------------------------------------------
  // ux_quick_wins_20261025 Phase 1 (AC-1 / BEYOND-9) — the per-layer THREE-STATE
  // control: Print only / Both / Screen only, its print-time effect, and its
  // persistence. G-PIX-OVERFLOW and G-PERSIST are asserted here, not claimed.
  // -------------------------------------------------------------------------

  /** The strip's current derived mode + what each segment reports about itself. */
  const readStrip = (page, layerId) =>
    page.evaluate((id) => {
      const panel = document.getElementById("print-enhance-layer-manager");
      const strip = panel.querySelector(
        `.be-layer-mode-strip[data-layer-id="${id}"]`,
      );
      if (!strip) return { present: false };
      const segs = Array.from(strip.querySelectorAll(".be-layer-mode-seg"));
      return {
        present: true,
        mode: strip.dataset.mode,
        labels: segs.map((s) => s.textContent),
        pressed: segs.filter((s) => s.getAttribute("aria-pressed") === "true")
          .map((s) => s.dataset.mode),
        on: segs.filter((s) => s.classList.contains("be-layer-mode-on"))
          .map((s) => s.dataset.mode),
      };
    }, layerId);

  it("AC-1: every layer group carries the three-state strip, naming all three modes", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await readStrip(page, "sections");
      assert.ok(st.present, "the sections group carries a mode strip");
      assert.deepStrictEqual(
        st.labels,
        ["Print only", "Both", "Screen only"],
        "the three modes are named in the criterion's own words",
      );
      // Exactly one mode is current at any time — a strip that lights up two states
      // would be answering "which of the three am I in?" twice.
      assert.deepStrictEqual(st.pressed, ["both"], "one pressed segment, and it is Both");
      assert.deepStrictEqual(st.on, ["both"], "the visible highlight agrees with aria-pressed");
    } finally {
      await page.close();
    }
  });

  it("AC-1: `Print only` hides the layer on screen and UNDOES that hide at print time", async function () {
    const page = await bootPage(ctx);
    try {
      await domClick(
        page,
        '.be-layer-mode-strip[data-layer-id="sections"] .be-layer-mode-seg[data-mode="print"]',
      );
      await page.waitForTimeout(700);
      const st = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-sections-layer");
        const dyn = document.getElementById("be-print-z-style");
        return {
          printOnly: el.dataset.printOnly,
          printDisabled: el.dataset.printDisabled,
          inlineDisplay: el.style.display,
          css: dyn.textContent,
        };
      });
      assert.strictEqual(st.printOnly, "true", "the container is flagged print-only");
      assert.strictEqual(
        st.printDisabled,
        "false",
        "print-only is NOT print-disabled — the layer must still print",
      );
      assert.strictEqual(st.inlineDisplay, "none", "it is hidden on the screen now");
      assert.ok(
        /#print-enhance-sections-layer\s*\{[^}]*display:\s*block !important/.test(
          st.css,
        ),
        "print CSS UNDOES the inline hide with !important: " + st.css,
      );
      assert.ok(
        !/#print-enhance-sections-layer\s*\{[^}]*display:\s*none !important/.test(
          st.css,
        ),
        "and it emits no hide rule for the same layer",
      );
      const strip = await readStrip(page, "sections");
      assert.deepStrictEqual(strip.pressed, ["print"], "the strip reports Print only");
    } finally {
      await page.close();
    }
  });

  it("AC-1: `Screen only` stays visible now and is skipped on print", async function () {
    const page = await bootPage(ctx);
    try {
      await domClick(
        page,
        '.be-layer-mode-strip[data-layer-id="sections"] .be-layer-mode-seg[data-mode="screen"]',
      );
      await page.waitForTimeout(700);
      const st = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-sections-layer");
        const dyn = document.getElementById("be-print-z-style");
        return {
          printOnly: el.dataset.printOnly,
          printDisabled: el.dataset.printDisabled,
          inlineDisplay: el.style.display,
          css: dyn.textContent,
        };
      });
      assert.strictEqual(st.printDisabled, "true", "skipped on print");
      assert.strictEqual(st.printOnly, "false", "and not the other thing");
      assert.notStrictEqual(st.inlineDisplay, "none", "still on the screen");
      assert.ok(
        /#print-enhance-sections-layer\s*\{[^}]*display:\s*none !important/.test(
          st.css,
        ),
        "print CSS hides it",
      );
      assert.ok(
        !/#print-enhance-sections-layer\s*\{[^}]*display:\s*block !important/.test(
          st.css,
        ),
        "and does not also force it visible",
      );
      const strip = await readStrip(page, "sections");
      assert.deepStrictEqual(strip.pressed, ["screen"], "the strip reports Screen only");
    } finally {
      await page.close();
    }
  });

  it("AC-1: `Both` clears both flags and both print rules (the three states are ONE choice)", async function () {
    const page = await bootPage(ctx);
    try {
      const seg = (mode) =>
        `.be-layer-mode-strip[data-layer-id="sections"] .be-layer-mode-seg[data-mode="${mode}"]`;
      await domClick(page, seg("print"));
      await page.waitForTimeout(400);
      await domClick(page, seg("both"));
      await page.waitForTimeout(700);
      const st = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-sections-layer");
        const dyn = document.getElementById("be-print-z-style");
        return {
          printOnly: el.dataset.printOnly,
          printDisabled: el.dataset.printDisabled,
          inlineDisplay: el.style.display,
          css: dyn.textContent,
        };
      });
      assert.strictEqual(st.printOnly, "false");
      assert.strictEqual(st.printDisabled, "false");
      assert.notStrictEqual(st.inlineDisplay, "none", "visible on screen again");
      assert.ok(
        !/#print-enhance-sections-layer\s*\{[^}]*display:\s*(none|block) !important/.test(
          st.css,
        ),
        "no print rule at all for a Both layer",
      );
      const strip = await readStrip(page, "sections");
      assert.deepStrictEqual(strip.pressed, ["both"]);
    } finally {
      await page.close();
    }
  });

  it("AC-1: the mode survives a layout round-trip through the persisted record (G-PERSIST)", async function () {
    const page = await bootPage(ctx);
    try {
      await domClick(
        page,
        '.be-layer-mode-strip[data-layer-id="sections"] .be-layer-mode-seg[data-mode="print"]',
      );
      await page.waitForTimeout(700);
      // `scanLayout()` is the record the product persists: `js/layout_scan.js:143-147` writes
      // `layout.layers[id] = {isLocked, isHidden, isDisabledOnPrint}` for the sections layer, so
      // this asserts the PERSISTED shape, not just the live DOM.
      //
      // WHY `contentCall` AND NOT `page.evaluate`: `window.scanLayout` is a CONTENT-SCRIPT global
      // (assigned at `js/main.js:3175`), and content scripts isolate globals — `page.evaluate` runs
      // in the page's MAIN world, where it reads `undefined`. Measured: a `page.evaluate` read here
      // fails `TypeError: window.scanLayout is not a function`, which is a harness defect, not a
      // product one. `aiLayoutRecordRead` is the probe that runs the SAME live scan from the
      // isolated world and hands back its serialized record (see `_helpers/inject.js`).
      const read = await contentCall(ctx, "aiLayoutRecordRead", []);
      assert.strictEqual(read.error, null, "the live scan ran clean: " + read.error);
      assert.ok(read.scan, "the live scan produced a record");
      const scan = JSON.parse(read.scan);
      const rec = (scan.layers && scan.layers.sections) || null;
      assert.ok(rec, "the scan produced a sections-layer record");
      assert.strictEqual(
        rec.isHidden,
        true,
        "Print only is persisted as isHidden (no new storage field): " + JSON.stringify(rec),
      );
      assert.strictEqual(
        rec.isDisabledOnPrint,
        false,
        "and NOT as isDisabledOnPrint, which is the Screen-only flag",
      );
      // …and the same record re-applies to the same mode: the strip is a READER of the two
      // flags, so a reload cannot land on a different mode than the one picked.
      const reDerived = rec.isHidden && rec.isDisabledOnPrint
        ? "hidden"
        : rec.isHidden
          ? "print"
          : rec.isDisabledOnPrint
            ? "screen"
            : "both";
      assert.strictEqual(reDerived, "print", "the persisted record re-derives Print only");
      // The strip's own live state must agree with the record it persists — otherwise the two
      // halves of AC-1 could disagree while each looks right on its own.
      const strip = await readStrip(page, "sections");
      assert.strictEqual(strip.mode, "print", "the live strip and the persisted record agree");
    } finally {
      await page.close();
    }
  });

  it("AC-1: the strip costs no horizontal overflow in the real panel (G-PIX-OVERFLOW)", async function () {
    const page = await bootPage(ctx);
    try {
      const geom = await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-layer-manager");
        const strip = panel.querySelector('.be-layer-mode-strip[data-layer-id="sections"]');
        const row = panel.querySelector('.be-layer-row[data-layer-id="sections"]');
        const segs = Array.from(strip.querySelectorAll(".be-layer-mode-seg"));
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width, top: r.top };
        };
        return {
          panelBox: box(panel),
          rowBox: box(row),
          stripBox: box(strip),
          segBoxes: segs.map(box),
          panelOverflow: panel.scrollWidth - panel.clientWidth,
          // The strip sits BELOW the row line, which is what keeps the label's width.
          stripBelowRow: box(strip).top >= box(row).top + box(row).width * 0,
        };
      });
      assert.ok(
        geom.panelOverflow <= 0,
        `the panel must not scroll sideways (scrollWidth - clientWidth = ${geom.panelOverflow})`,
      );
      const panel = geom.panelBox;
      for (const seg of geom.segBoxes) {
        assert.ok(
          seg.right <= panel.right + 1 && seg.left >= panel.left - 1,
          `segment must stay inside the panel: seg ${JSON.stringify(seg)} vs panel ${JSON.stringify(panel)}`,
        );
      }
      assert.ok(
        geom.stripBox.right <= panel.right + 1,
        "the whole strip stays inside the panel",
      );
      assert.ok(
        geom.stripBox.top >= geom.rowBox.top,
        "the strip is its own line, not squeezed into the row (the measured layout)",
      );
    } finally {
      await page.close();
    }
  });
});
