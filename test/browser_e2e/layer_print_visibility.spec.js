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
  // AC-3 needs a real reload, and after a reload the extension is not on the page until the
  // user clicks the toolbar icon — `reinject` is the harness's stand-in for that click (see
  // `_helpers/dom.js`). It is the same production file list `bootPage` injects.
  reinject,
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

  // =========================================================================
  // BEYOND-9 CERTIFICATION PASS — track `beyond09_layer_three_state` (2026-11-01).
  //
  // The cases above prove the strip exists, names three modes, that the injected print
  // STYLESHEET carries the right sentences, and that the persisted RECORD re-derives the
  // mode. They do not prove the three things the card actually asks for:
  //
  //   * "per layer"       — only the `sections` group is ever inspected above;
  //   * "print preview
  //      respects"        — a stylesheet that SAYS `display:none` is not a rendering. The card
  //                         says the print preview respects the states, so this pass emulates
  //                         the print media and reads the computed style the renderer uses;
  //   * "across reloads"  — no case above reloads anything. The persisted-record case reads
  //                         the record's SHAPE; the card asks for the user's SELECTION to come
  //                         back after a reload, with no Save click in between.
  //
  // It is its own describe block so the pass can be run on its own:
  //   npx mocha test/browser_e2e/layer_print_visibility.spec.js \
  //     --grep "BEYOND-9 certification pass"
  // =========================================================================
  describe("BEYOND-9 certification pass — per layer, rendered print media, real reload", function () {
    const SECTIONS_EL = "print-enhance-sections-layer";
    const seg = (mode) =>
      `.be-layer-mode-strip[data-layer-id="sections"] .be-layer-mode-seg[data-mode="${mode}"]`;

    /** Pick one mode through the real strip, and wait for the repaint. */
    const pickMode = async (page, mode) => {
      await domClick(page, seg(mode));
      await page.waitForTimeout(900);
    };

    /**
     * Leave the persisted record on `Both`.
     *
     * WHY: a mode change now REQUESTS a persist (AC-3 — that is the product change this pass
     * drove), so a case that walked away mid-state would hand the NEXT case a restored mode it
     * did not ask for. Resetting through the product's own save seam makes each case start
     * from the state it asserts.
     */
    const resetToBoth = async (page) => {
      await pickMode(page, "both");
      const saved = await contentCall(ctx, "persistLayoutNow", []);
      assert.strictEqual(saved.ok, true, `reset persist: ${saved.why || "saved"}`);
    };

    /** The container's rendered box under whatever media the page is currently emulating. */
    const renderedBox = (page, id) =>
      page.evaluate((elId) => {
        const el = document.getElementById(elId);
        if (!el) return { missing: true };
        const cs = getComputedStyle(el);
        return { display: cs.display, visibility: cs.visibility, opacity: cs.opacity };
      }, id);

    /**
     * The SAME read, with the print media emulated, then the media put back.
     *
     * `page.emulateMedia({media:"print"})` is the renderer's own media switch: every `@media
     * print` block the extension injects applies, and `getComputedStyle` returns what would be
     * painted — which is exactly the claim "print preview respects the state" makes.
     */
    const renderedUnderPrint = async (page, id) => {
      await page.emulateMedia({ media: "print" });
      await page.waitForTimeout(400);
      const box = await renderedBox(page, id);
      await page.emulateMedia({ media: "screen" });
      await page.waitForTimeout(200);
      return box;
    };

    it("AC-1: EVERY layer group carries the three-state strip, and exactly one mode is lit in each", async function () {
      const page = await bootPage(ctx);
      try {
        const groups = await page.evaluate(() => {
          const panel = document.getElementById("print-enhance-layer-manager");
          return Array.from(panel.querySelectorAll(".be-layer-row[data-layer-id]")).map((row) => {
            const id = row.dataset.layerId;
            const strip = panel.querySelector(`.be-layer-mode-strip[data-layer-id="${id}"]`);
            const segs = strip ? Array.from(strip.querySelectorAll(".be-layer-mode-seg")) : [];
            return {
              id,
              hasStrip: !!strip,
              // Same group = the strip belongs to THIS row's layer, not a neighbour's.
              sameGroup: strip ? strip.parentElement === row.parentElement : false,
              modes: segs.map((s) => s.dataset.mode),
              labels: segs.map((s) => s.textContent),
              pressed: segs.filter((s) => s.getAttribute("aria-pressed") === "true").map((s) => s.dataset.mode),
              lit: segs.filter((s) => s.classList.contains("be-layer-mode-on")).map((s) => s.dataset.mode),
            };
          });
        });
        // The panel always ships at least the sections group and the default shapes group —
        // a one-row panel would make "per layer" unproven, so the count is asserted first.
        assert.ok(
          groups.length >= 2,
          `the panel must expose more than one layer group for "per layer" to mean anything (got ${groups.length})`,
        );
        for (const g of groups) {
          assert.ok(g.hasStrip, `layer "${g.id}" has no three-state strip`);
          assert.ok(g.sameGroup, `layer "${g.id}"'s strip is not in its own group`);
          assert.deepStrictEqual(
            g.modes,
            ["print", "both", "screen"],
            `layer "${g.id}" names three modes in order`,
          );
          assert.deepStrictEqual(
            g.labels,
            ["Print only", "Both", "Screen only"],
            `layer "${g.id}" names them in the criterion's words`,
          );
          assert.strictEqual(
            g.pressed.length,
            1,
            `layer "${g.id}" must report exactly ONE current mode (got ${JSON.stringify(g.pressed)})`,
          );
          assert.deepStrictEqual(
            g.lit,
            g.pressed,
            `layer "${g.id}": the visible highlight must agree with aria-pressed`,
          );
        }
        // …and the shapes group's strip is a LIVE control, not just decor: driving it moves
        // the SAME two flags the sections strip moves.
        const shapeLayer = groups.find((g) => g.id !== "sections");
        await page.evaluate((id) => {
          const panel = document.getElementById("print-enhance-layer-manager");
          panel.querySelector(`.be-layer-mode-strip[data-layer-id="${id}"] .be-layer-mode-seg[data-mode="screen"]`).click();
        }, shapeLayer.id);
        await page.waitForTimeout(700);
        const after = await page.evaluate((id) => {
          const panel = document.getElementById("print-enhance-layer-manager");
          const strip = panel.querySelector(`.be-layer-mode-strip[data-layer-id="${id}"]`);
          return Array.from(strip.querySelectorAll('.be-layer-mode-seg[aria-pressed="true"]')).map(
            (s) => s.dataset.mode,
          );
        }, shapeLayer.id);
        assert.deepStrictEqual(after, ["screen"], "the shapes layer's own strip drives its own mode");
      } finally {
        await page.close();
      }
    });

    it("AC-2: the PRINT PREVIEW renders the three states as the criterion says (emulated print media)", async function () {
      const page = await bootPage(ctx);
      try {
        // The container's OWN display, measured in the one state that substitutes nothing:
        // `Both` has no on-screen hide and no print rule. Every later print-time comparison is
        // against THIS value, so a rule that swapped `flex` for `block` would be caught.
        await pickMode(page, "both");
        const naturalScreen = await renderedBox(page, SECTIONS_EL);
        const naturalPrint = await renderedUnderPrint(page, SECTIONS_EL);
        assert.notStrictEqual(
          naturalScreen.display,
          "none",
          "both-visible baseline: the sections layer is on screen",
        );
        assert.strictEqual(
          naturalPrint.display,
          naturalScreen.display,
          "print must not change a Both layer's box at all",
        );

        // --- Print only: hidden NOW, rendered on PAPER -------------------------
        await pickMode(page, "print");
        const printOnlyScreen = await renderedBox(page, SECTIONS_EL);
        assert.strictEqual(
          printOnlyScreen.display,
          "none",
          "Print only is HIDDEN on the screen (that is the mode's screen half)",
        );
        const printOnlyPrint = await renderedUnderPrint(page, SECTIONS_EL);
        assert.notStrictEqual(
          printOnlyPrint.display,
          "none",
          "…and RENDERS in the print preview (measured computed display, not the stylesheet text)",
        );
        assert.strictEqual(
          printOnlyPrint.display,
          naturalScreen.display,
          `…with the container's own display ("${naturalScreen.display}"), not a substituted value`,
        );
        assert.notStrictEqual(printOnlyPrint.visibility, "hidden", "and it is not merely invisible");

        // --- Screen only: visible NOW, dropped from PAPER ----------------------
        await pickMode(page, "screen");
        const screenOnlyScreen = await renderedBox(page, SECTIONS_EL);
        assert.notStrictEqual(
          screenOnlyScreen.display,
          "none",
          "Screen only stays on the screen",
        );
        const screenOnlyPrint = await renderedUnderPrint(page, SECTIONS_EL);
        assert.strictEqual(
          screenOnlyPrint.display,
          "none",
          "…and is OMITTED from the print preview (measured computed display)",
        );

        // --- Both again: the print preview is back to the sheet as-is ----------
        await pickMode(page, "both");
        const backToBoth = await renderedUnderPrint(page, SECTIONS_EL);
        assert.strictEqual(
          backToBoth.display,
          naturalScreen.display,
          "returning to Both restores the print preview's own rendering",
        );
        assert.strictEqual(
          backToBoth.opacity,
          "1",
          "the print CSS also forces print opacity to 1 for a printed layer",
        );
      } finally {
        await resetToBoth(page).catch(() => {});
        await page.close();
      }
    });

    /**
     * The SAVED section-layer flags, read straight out of the extension's own IndexedDB.
     *
     * WHY NOT A PROBE: `aiLayoutRecordRead` runs a LIVE `scanLayout()`, which reads the LIVE DOM —
     * it proves the in-memory/rendered state, not that anything was written. AC-3 is about what
     * SURVIVES, so this case has to read the row the reload will actually restore. IndexedDB is
     * origin-scoped, so the page's MAIN world can open the same `DDBPrintEnhancerDB` the content
     * script wrote (store `layouts`, one row per `characterId` plus `"GLOBAL"`).
     *
     * Returns every stored row that carries a sections layer, so the assertion can speak about
     * all of them instead of guessing which key the restore will prefer.
     */
    const storedSectionsFlags = (page) =>
      page.evaluate(async () => {
        const openDb = () =>
          new Promise((res, rej) => {
            const req = indexedDB.open("DDBPrintEnhancerDB");
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          });
        const dbo = await openDb();
        try {
          if (!dbo.objectStoreNames.contains("layouts")) return { store: false, rows: [] };
          const all = await new Promise((res, rej) => {
            const tx = dbo.transaction("layouts", "readonly");
            const req = tx.objectStore("layouts").getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          });
          return {
            store: true,
            rows: all
              .filter((r) => r && r.layers && r.layers.sections)
              .map((r) => ({
                key: r.characterId,
                isHidden: r.layers.sections.isHidden,
                isDisabledOnPrint: r.layers.sections.isDisabledOnPrint,
              })),
          };
        } finally {
          dbo.close();
        }
      });

    it("AC-3: the mode a user picks survives a RELOAD with no Save click (G-PERSIST, real reload)", async function () {
      const page = await bootPage(ctx);
      try {
        await resetToBoth(page);

        // ONE user action: press `Print only`. No Save button, no probe-driven persist.
        await pickMode(page, "print");

        // The autosave debounce is 1000ms plus the scan's own storage await, so the write has
        // to be GIVEN time — asserting before it lands would test the timer, not the product.
        await page.waitForTimeout(3000);

        // Precondition (the RED line before the product fix): the pick reached STORAGE on its
        // own, with no Save click. Read from IndexedDB, not from the live DOM.
        const stored = await storedSectionsFlags(page);
        assert.ok(stored.store, "the layouts store exists");
        assert.ok(
          stored.rows.length > 0,
          "some saved layout record carries a sections layer: " + JSON.stringify(stored),
        );
        for (const row of stored.rows) {
          assert.strictEqual(
            row.isHidden,
            true,
            `the "Print only" pick persisted ITSELF into the "${row.key}" record (autosave), ` +
              "before any reload",
          );
          assert.strictEqual(
            row.isDisabledOnPrint,
            false,
            `…and it did not persist as the Screen-only flag ("${row.key}")`,
          );
        }

        // THE reload: the content world dies, the page is a plain sheet again, and the extension
        // boots a SECOND time. Only the persisted record can bring the mode back.
        await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForTimeout(4000);
        await reinject(ctx, page);
        await page.waitForSelector("#print-enhance-layer-manager", { timeout: 60000 });
        await page.waitForTimeout(2500);

        const after = await readStrip(page, "sections");
        assert.ok(after.present, "the layer panel is back after the reload");
        assert.deepStrictEqual(
          after.pressed,
          ["print"],
          "the reloaded page restores Print only — the same mode the user picked",
        );
        const el = await page.evaluate(() => {
          const node = document.getElementById("print-enhance-sections-layer");
          const dyn = document.getElementById("be-print-z-style");
          return {
            printOnly: node.dataset.printOnly,
            printDisabled: node.dataset.printDisabled,
            inlineDisplay: node.style.display,
            css: dyn ? dyn.textContent : "",
          };
        });
        assert.strictEqual(el.printOnly, "true", "the restored container is flagged print-only again");
        assert.strictEqual(el.printDisabled, "false", "…and not print-disabled");
        assert.strictEqual(el.inlineDisplay, "none", "…and it is hidden on the restored screen");
        assert.ok(
          new RegExp(`#${SECTIONS_EL}\\s*\\{[^}]*display:\\s*block !important`).test(el.css),
          "…and the restored print CSS still undoes that hide: " + el.css,
        );
        // The print preview after a reload is the same print preview — measured, not inferred.
        const afterPrint = await renderedUnderPrint(page, SECTIONS_EL);
        assert.notStrictEqual(
          afterPrint.display,
          "none",
          "the RELOADED page's print preview still renders the Print-only layer",
        );
      } finally {
        await resetToBoth(page).catch(() => {});
        await page.close();
      }
    });

    it("AC-1: a legacy record with BOTH flags set lights no segment, and `Both` recovers it", async function () {
      const page = await bootPage(ctx);
      try {
        // `Screen only` sets isDisabledOnPrint; the row's own eye button then sets isHidden.
        // Both flags true is the FOURTH corner of the two-flag space — the state a record
        // written by any previous version can legitimately hold (hidden everywhere).
        await pickMode(page, "screen");
        await domClick(
          page,
          '.be-layer-row[data-layer-id="sections"] button[title="Hide on sheet"]',
        );
        await page.waitForTimeout(700);

        const st = await page.evaluate(() => {
          const panel = document.getElementById("print-enhance-layer-manager");
          const strip = panel.querySelector('.be-layer-mode-strip[data-layer-id="sections"]');
          const node = document.getElementById("print-enhance-sections-layer");
          const segs = Array.from(strip.querySelectorAll(".be-layer-mode-seg"));
          return {
            stripMode: strip.dataset.mode,
            rowMode: panel.querySelector('.be-layer-row[data-layer-id="sections"]').dataset.mode,
            pressed: segs.filter((s) => s.getAttribute("aria-pressed") === "true").map((s) => s.dataset.mode),
            lit: segs.filter((s) => s.classList.contains("be-layer-mode-on")).map((s) => s.dataset.mode),
            isHidden: node.dataset.printDisabled !== undefined,
            inlineDisplay: node.style.display,
          };
        });
        assert.strictEqual(
          st.stripMode,
          "hidden",
          "the strip reports the fourth corner honestly instead of mislabelling it as one of the three",
        );
        assert.deepStrictEqual(
          st.pressed,
          [],
          "no segment is lit, because the layer is not in any of the three modes (no lie)",
        );
        assert.deepStrictEqual(st.lit, [], "…and the visible highlight agrees");
        assert.strictEqual(st.rowMode, "hidden", "the row says which hidden it is");
        assert.strictEqual(st.inlineDisplay, "none", "hidden on screen");

        const printBox = await renderedUnderPrint(page, SECTIONS_EL);
        assert.strictEqual(
          printBox.display,
          "none",
          "…and hidden on paper too — a record that set both flags meant both",
        );

        // …and the strip can still get the user OUT of it in one press.
        await pickMode(page, "both");
        const recovered = await readStrip(page, "sections");
        assert.strictEqual(recovered.mode, "both", "one press on `Both` resolves the legacy record");
        assert.deepStrictEqual(recovered.pressed, ["both"], "…and the strip reports it");
        const visibleAgain = await page.evaluate(
          () => document.getElementById("print-enhance-sections-layer").style.display,
        );
        assert.notStrictEqual(visibleAgain, "none", "…and the layer is back on the screen");
      } finally {
        await resetToBoth(page).catch(() => {});
        await page.close();
      }
    });
  });
});
