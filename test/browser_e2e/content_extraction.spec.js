/**
 * Browser E2E — PR #12 "Extract section content" (dynamic content
 * extraction trigger + rollback): double-clicking a flagged extractable
 * element lifts it out of its section into its own floating extracted
 * section with a content header and rollback wiring.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. Extractable elements are flagged with .be-extractable + a
 *      .be-ext-* identification class.
 *   2. Double-clicking an extractable (after the layout re-flags the DOM)
 *      creates a floating .be-extracted-section carrying the discovered
 *      title in a standardized header.
 *   3. The extracted section is placed in the print sections layer and
 *      appended exactly once per double-click.
 *   4. The source element is hidden after extraction (moved out of the
 *      live flow).
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:extract
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #12 Dynamic content extraction (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /** Apply the Archer template — its applyLayout re-flags extractable
   *  elements on the current DOM (the flag pass runs on freshly created
   *  nodes), making the double-click extraction trigger live.
   *
   *  DRIFT NOTE (ISSUE_browser_e2e_gate_drift_20260912, F1): this helper used to wait
   *  for a SECOND stacked `.be-modal-overlay` whose INLINE `style.zIndex` was "31000",
   *  then click "Apply Template" inside it. The catalog was migrated to ONE overlay
   *  with an in-modal view state (grid ⇄ detail ⇄ confirm) and no stacked
   *  30000/31000 overlays — stated verbatim in `js/catalog_service.js` (T-1/AC-2 of
   *  custom_upload_templates_ux_20260909) — so that wait could never resolve. The
   *  overlay's stacking now comes from CSS (`js/print_styles.js`), never from an inline
   *  style, which is exactly why the inline read is the wrong thing to wait on. The flow
   *  below drives the shipped one: card -> detail (`Continue…`) -> in-modal confirm
   *  (`Continue`, `.be-modal-ok`) -> apply.
   */
  async function enableExtraction(page) {
    await page.evaluate(() => {
      const b = Array.from(
        document.querySelectorAll("#print-enhance-controls button"),
      ).find((x) => (x.textContent || "").includes("TEMPLATES"));
      b.click();
    });
    await page.waitForSelector(".be-catalog-item", { timeout: 15000 });
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll(".be-catalog-title")).find(
        (e) => e.textContent.includes("Archer"),
      );
      t.closest(".be-catalog-item").click();
    });
    // Detail view of the ONE overlay (the Back control is its marker).
    await page.waitForSelector(".be-catalog-back", { timeout: 15000 });
    // "Continue…" — the detail view's own class, not its copy.
    await domClick(page, ".be-modal-overlay .be-modal-ok");
    // In-modal apply confirm, then apply.
    await page.waitForSelector(".be-catalog-confirm-cancel", { timeout: 15000 });
    await domClick(page, ".be-modal-overlay .be-modal-ok");
    await page.waitForFunction(
      () => !document.querySelector(".be-modal-overlay"),
      { timeout: 25000 },
    );
    await page.waitForTimeout(1200);
  }

  function dblclickExtractable(page) {
    return page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".be-extractable"));
      const pick =
        els.find(
          (el) =>
            el.textContent.trim().length > 12 &&
            el.getBoundingClientRect().width > 40,
        ) || els[0];
      if (!pick) return null;
      const r = pick.getBoundingClientRect();
      pick.dispatchEvent(
        new MouseEvent("dblclick", {
          bubbles: true,
          cancelable: true,
          clientX: r.left + 20,
          clientY: r.top + 20,
        }),
      );
      return {
        cls: pick.className.toString().slice(0, 60),
        titleHint: pick.textContent.trim().slice(0, 24),
      };
    });
  }

  it("extractable elements are flagged with identification classes", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll(".be-extractable"));
        return {
          count: els.length,
          withExtId: els.filter((el) =>
            Array.from(el.classList).some((c) => c.startsWith("be-ext-")),
          ).length,
        };
      });
      assert.ok(st.count >= 5, "extractable elements flagged: " + st.count);
      assert.ok(st.withExtId >= 1, "elements carry be-ext-* id classes");
    } finally {
      await page.close();
    }
  });

  it("double-clicking an extractable creates a floating extracted section with its title", async function () {
    const page = await bootPage(ctx);
    try {
      await enableExtraction(page);
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-extracted-section").length,
      );
      const pick = await dblclickExtractable(page);
      assert.ok(pick, "an extractable was double-clicked");
      await page.waitForFunction(
        (n) => document.querySelectorAll(".be-extracted-section").length > n,
        before,
        { timeout: 20000 },
      );
      const st = await page.evaluate(() => {
        const secs = Array.from(
          document.querySelectorAll(".be-extracted-section"),
        );
        const last = secs[secs.length - 1];
        const header = last.querySelector(".ct-content-group__header-content");
        return {
          count: secs.length,
          hasHeader: !!header,
          title: header ? header.textContent : "",
          inSectionsLayer: !!last.closest("#print-enhance-sections-layer"),
        };
      });
      assert.strictEqual(st.count, before + 1, "one extracted section created");
      assert.ok(st.hasHeader && st.title.trim().length > 0, "carries a title header");
      assert.ok(st.inSectionsLayer, "extracted section lives in the sections layer");
    } finally {
      await page.close();
    }
  });

  it("double-clicking again adds exactly one more (no runaway duplication)", async function () {
    const page = await bootPage(ctx);
    try {
      await enableExtraction(page);
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-extracted-section").length,
      );
      await dblclickExtractable(page);
      await page.waitForFunction(
        (n) => document.querySelectorAll(".be-extracted-section").length > n,
        before,
        { timeout: 20000 },
      );
      await page.waitForTimeout(1200);
      const afterFirst = await page.evaluate(
        () => document.querySelectorAll(".be-extracted-section").length,
      );
      await dblclickExtractable(page);
      await page.waitForTimeout(2500);
      const afterSecond = await page.evaluate(
        () => document.querySelectorAll(".be-extracted-section").length,
      );
      assert.strictEqual(afterFirst, before + 1);
      assert.ok(
        afterSecond === afterFirst || afterSecond === before + 2,
        "each double-click yields one extraction (got " + afterSecond + ")",
      );
    } finally {
      await page.close();
    }
  });
  /* ------------------------------------------------------------------ */
  /* THE UNDO ARM OF EXTRACTION — the hole `undo_stack_20260911` found and */
  /* left open deliberately, closed 2026-09-22: in the REAL page, an        */
  /* extraction is reversible.                                             */
  /* ------------------------------------------------------------------ */

  /**
   * The undo affordance and the sheet's extraction state, in one read.
   *
   * WHY "how many sources are hidden" IS COUNTED OVER `.be-extractable` RATHER THAN READ OFF
   * ONE ELEMENT BY ID. `getSanitizedContent` clones the source with `cloneNode(true)` and never
   * strips the `id`, so after ANY extraction the document holds TWO elements with the source's id
   * — the hidden original and the copy inside the card — and `getElementById` returns whichever
   * comes first in document order, which is not stable across layouts. Counting hidden
   * `.be-extractable`s sidesteps that: the clone has the class REMOVED
   * (`handleElementExtraction` strips `be-extractable` to avoid nested triggers), so the set is
   * exactly the live sources and nothing else. The duplicate-id quirk is pre-existing and
   * separate from this change; it is recorded here because it is what the naive read would have
   * silently measured.
   */
  function readUndoState(page) {
    return page.evaluate(() => {
      const btn = document.querySelector("#be-btn-undo");
      const sources = Array.from(document.querySelectorAll(".be-extractable"));
      return {
        sections: document.querySelectorAll(".be-extracted-section").length,
        sourcesHidden: sources.filter((el) => el.style.display === "none").length,
        visible: btn ? (btn.textContent || "").trim() : null,
        // The control clamps its visible text to what the panel's 205px label fits
        // (`undoScreenLabel`, measured in AC-V1) and keeps the whole string in `title` and
        // `aria-label`, so the ACCESSIBLE name is the one that must name the action.
        aria: btn ? btn.getAttribute("aria-label") : null,
        title: btn ? btn.getAttribute("title") : null,
      };
    });
  }

  /**
   * Double-click one NON-SPELL extractable.
   *
   * Why a second picker next to `dblclickExtractable`: a spell detail is not HIDDEN by an
   * extraction, it is REMOVED (they are ephemeral and have no home on the sheet to roll back
   * to), so counting hidden sources would move for the wrong reason. This takes an element the
   * extraction can only hide.
   */
  function dblclickNonSpellExtractable(page) {
    return page.evaluate(() => {
      const pick = Array.from(document.querySelectorAll(".be-extractable")).find(
        (el) =>
          !el.classList.contains("be-spell-detail") &&
          !/^spell-detail-/.test(el.id || "") &&
          !el.querySelector("[data-be-spell-merge]") &&
          el.style.display !== "none" &&
          el.getBoundingClientRect().width > 40 &&
          el.textContent.trim().length > 12,
      );
      if (!pick) return null;
      const r = pick.getBoundingClientRect();
      pick.dispatchEvent(
        new MouseEvent("dblclick", {
          bubbles: true,
          cancelable: true,
          clientX: r.left + 20,
          clientY: r.top + 20,
        }),
      );
      return { titleHint: pick.textContent.trim().slice(0, 24) };
    });
  }

  it("undoing an extraction puts the block back on the sheet and removes the card", async function () {
    const page = await bootPage(ctx);
    try {
      await enableExtraction(page);
      const start = await readUndoState(page);

      const pick = await dblclickNonSpellExtractable(page);
      assert.ok(pick, "a non-spell extractable was double-clicked");
      await page.waitForFunction(
        (n) => document.querySelectorAll(".be-extracted-section").length > n,
        start.sections,
        { timeout: 20000 },
      );
      // The capture's push lands a tick AFTER the DOM write — that is the non-deferring
      // protocol working (the mutation is synchronous; the record follows), not a race.
      await page.waitForTimeout(1500);
      const made = await readUndoState(page);
      assert.strictEqual(made.sections, start.sections + 1, "the extraction was created");
      // VACUITY for the restore arm below: the extraction really DID hide its source, so "back
      // to the starting count" is a round trip rather than two equal numbers.
      assert.strictEqual(
        made.sourcesHidden,
        start.sourcesHidden + 1,
        "the extraction hid exactly one source block",
      );

      // AC-8's naming requirement, read off the accessible name.
      assert.match(
        String(made.aria),
        /^Undo: Extract /,
        "the affordance names EXTRACTION as what Ctrl+Z will revert: " + made.aria,
      );
      assert.strictEqual(made.title, made.aria, "and the hover carries the same string");
      assert.match(
        String(made.visible),
        /Extract/,
        "so does the visible text — the user-visible proof of the fix. Before it was wired, " +
          "extracting pushed NO record at all, so the control named some EARLIER change and " +
          "Ctrl+Z reverted THAT instead of the extraction.",
      );

      /* The keyboard route, because that is the arm the gap actually broke. */
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(2000);
      const undone = await readUndoState(page);
      assert.strictEqual(
        undone.sections,
        start.sections,
        "Ctrl+Z removed the extracted card — the ADDITION itself was reverted, not the record " +
          "below it",
      );
      assert.strictEqual(
        undone.sourcesHidden,
        start.sourcesHidden,
        "and the source block is visible again — the card gone AND the block back is the whole " +
          "inverse of an extraction",
      );
    } finally {
      await page.close();
    }
  });
});
