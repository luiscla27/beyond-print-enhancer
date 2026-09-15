/**
 * Manual Verification — Phase 1 (one selection model, AC-1..AC-4) — AUTOMATED.
 *
 * The automated form of "Conductor - User Manual Verification 'Phase 1'". Per
 * vendor/conductor/workflow.md §3.1 a checkpoint is a user-facing walkthrough with
 * expected results; the walkthrough below is asserted instead of eyeballed.
 *
 * HOW THE STEPS ARE DRIVEN. Every step that a user can reach is driven the way a
 * user reaches it — a real DOM click on the 🎯 action-bar button, a layer-panel
 * chip, a layer row. One step has NO user-facing control at all:
 *
 *   * "deselect" — there is no deselect control in the product. The only
 *     `setActiveSection(null)` call is the delete-prune path
 *     (js/properties_panel.js `pruneSelection`). Phase 1's AC-1 requires that
 *     CLEARING clears all three readers, so that step drives the store's own write
 *     path via `contentCall` (the project's documented mechanism for reaching the
 *     extension's ISOLATED world — `page.evaluate` cannot see the product globals,
 *     which is exactly why the first version of this spec failed).
 *
 * The walkthrough:
 *   1. "Select a section from its action bar"    -> outlined on the sheet, the SECTIONS row is
 *                                                    marked, the panel fills with SECTION controls
 *   2. "Select a shape from the layer panel"     -> the SAME outline on the shape, the marked row
 *                                                    moves, the panel switches to the shape's controls
 *   3. "Select a layer by clicking its row"       -> the outline and the panel follow the row
 *   4. "Clear the selection"                     -> outline gone, NO row marked, panel empty again
 *   5. "Multi-select chips"                      -> a plain chip click toggles; it never wipes the set
 *
 * The seam-driven capture harness (selection_visual_capture.spec.js) covers the
 * same model from the other direction, so both entry styles are exercised.
 *
 * Run via: npm run test:e2e:verify1
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, contentCall } = require("./_helpers.js");

/** The three readers of the selection, as a user perceives them. */
const READ = () => {
  const ring = document.getElementById("print-enhance-selection-ring");
  const ringStyle = ring ? getComputedStyle(ring) : null;
  const ringRect = ring ? ring.getBoundingClientRect() : null;
  const marker = document.querySelector(".be-active-target");
  const markerRect = marker ? marker.getBoundingClientRect() : null;
  const panel = document.getElementById("print-enhance-properties-panel");
  return {
    // The user-visible outline: the ring overlay, actually rendered over the target.
    ringShown: !!(ringStyle && ringStyle.display !== "none" && ringRect.width > 0),
    ringOver: !!(
      ringRect &&
      markerRect &&
      Math.abs(ringRect.left - markerRect.left) <= 5 &&
      Math.abs(ringRect.top - markerRect.top) <= 5
    ),
    markedRows: Array.from(
      document.querySelectorAll(
        "#print-enhance-layer-manager .be-layer-row.be-selection-layer",
      ),
    ).map((r) => r.dataset.layerId),
    panelTitle: (() => {
      const t = panel && panel.querySelector("h4");
      return t ? t.textContent.trim() : null;
    })(),
    panelControls: {
      fontSlider: !!(panel && panel.querySelector('input[type="range"]')),
      compactToggle: !!(panel && panel.querySelector('input[type="checkbox"]')),
      borderButton: !!(panel && panel.querySelector(".be-prop-border-button")),
      positionInputs: panel ? panel.querySelectorAll("input[data-be-pos]").length : 0,
      emptyState: !!(panel && panel.querySelector(".be-prop-panel-empty")),
    },
    markerKind: marker
      ? marker.classList.contains("be-shape-wrapper")
        ? "shape"
        : "section"
      : null,
    markerId: marker && markerRect ? marker.id || "(no id)" : null,
  };
};

describe("Manual verification — Phase 1 (one selection model)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("the five-step selection walkthrough behaves as documented", async function () {
    const page = await bootPage(ctx);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForSelector("#print-enhance-properties-panel", { timeout: 30000 });
      await page.waitForTimeout(1500);

      /* Step 1 — "Select a section from its action bar."  (user path: a real click) */
      const picked = await page.evaluate(() => {
        const btn = document.querySelector(
          ".be-section-actions .be-select-section-button",
        );
        if (!btn) return null;
        const wrapper = btn.closest(".be-section-wrapper");
        btn.click();
        return { id: wrapper ? wrapper.id : null };
      });
      assert.ok(picked && picked.id, "a section's 🎯 Select button exists and was clicked");
      await page.waitForTimeout(800);

      const afterSection = await page.evaluate(READ);
      assert.ok(
        afterSection.ringShown && afterSection.ringOver,
        "step 1: the selected section is outlined on the sheet — ringShown=" +
          afterSection.ringShown +
          " ringOver=" +
          afterSection.ringOver,
      );
      assert.strictEqual(afterSection.markerKind, "section", "step 1: a section is selected");
      assert.deepStrictEqual(
        afterSection.markedRows,
        ["sections"],
        "step 1: the layer panel marks the SECTIONS row",
      );
      assert.ok(
        /Editing:/.test(afterSection.panelTitle || ""),
        "step 1: the properties panel filled its title: " + afterSection.panelTitle,
      );
      assert.ok(
        afterSection.panelControls.fontSlider &&
          afterSection.panelControls.compactToggle &&
          afterSection.panelControls.borderButton,
        "step 1: …offering the section's controls (font size / compact / border)",
      );

      /* Step 2 — "Select a shape, from the layer panel's shape chip."  (user path) */
      const shapeChip = await page.evaluate(() => {
        const chip = document.querySelector(
          "#print-enhance-layer-manager .be-layer-item-thumb[data-target-id]",
        );
        if (!chip) return null;
        chip.click();
        return chip.dataset.targetId;
      });
      assert.ok(shapeChip, "the layer panel offers a shape chip to click");
      await page.waitForTimeout(800);

      const afterShape = await page.evaluate(READ);
      assert.ok(
        afterShape.ringShown && afterShape.ringOver,
        "step 2: the selected shape carries the same outline treatment as a section",
      );
      assert.strictEqual(afterShape.markerKind, "shape", "step 2: a shape is selected");
      assert.notDeepStrictEqual(
        afterShape.markedRows,
        afterSection.markedRows,
        "step 2: the marked row moved to the shape's own layer: " +
          JSON.stringify(afterShape.markedRows),
      );
      assert.ok(
        /Editing:/.test(afterShape.panelTitle || ""),
        "step 2: the panel names the shape: " + afterShape.panelTitle,
      );
      assert.strictEqual(
        afterShape.panelControls.fontSlider,
        false,
        "step 2: a shape is NOT offered the section-only font-size control",
      );
      assert.strictEqual(
        afterShape.panelControls.positionInputs,
        2,
        "step 2: …it is offered the X/Y position inputs instead",
      );

      /* Step 3 — "Select a layer by clicking its row."  (user path) */
      const rowClicked = await page.evaluate(() => {
        const row = document.querySelector(
          '#print-enhance-layer-manager .be-layer-row[data-layer-id="sections"]',
        );
        const label = row && row.querySelector("span");
        if (!label) return false;
        label.click();
        return true;
      });
      assert.ok(rowClicked, "the SECTIONS layer row is clickable");
      await page.waitForTimeout(800);

      const afterRow = await page.evaluate(READ);
      assert.ok(
        afterRow.ringShown && afterRow.ringOver,
        "step 3: clicking the row selects one of its sections and outlines it",
      );
      assert.strictEqual(afterRow.markerKind, "section", "step 3: the row selected a section");
      assert.deepStrictEqual(
        afterRow.markedRows,
        ["sections"],
        "step 3: the row that was clicked is the marked one",
      );
      assert.ok(
        /Editing:/.test(afterRow.panelTitle || ""),
        "step 3: the panel followed the row: " + afterRow.panelTitle,
      );

      /* Step 4 — "Clear the selection."  No user-facing control exists for this
         (see the header note), so the store's own write path is driven. */
      await contentCall(ctx, "clearSelection");
      await page.waitForTimeout(700);
      const cleared = await page.evaluate(READ);
      assert.strictEqual(cleared.ringShown, false, "step 4: the outline is gone");
      assert.strictEqual(cleared.markerId, null, "step 4: nothing is marked on the sheet");
      assert.deepStrictEqual(
        cleared.markedRows,
        [],
        "step 4: NO layer row is marked (clearing clears all three readers)",
      );
      assert.strictEqual(
        cleared.panelControls.emptyState,
        true,
        "step 4: the panel is back to its empty state",
      );

      /* Step 5 — "Multi-select chips."  (user path) AC-3: the set is a SET.
         First, the interop claim: the chip the user clicked back in step 2 is STILL
         in the set, even though steps 3 and 4 changed and then cleared the single
         target. That is AC-3's "changing the single target does not disturb the
         set", measured on the user's own path rather than assumed. */
      const chips = await page.evaluate(() => {
        const items = Array.from(
          document.querySelectorAll("#print-enhance-layer-manager [data-target-id]"),
        );
        if (items.length < 2) return null;
        const selectedNow = items.filter((i) => i.classList.contains("be-chip-selected"));
        // Normalise with a user action (a click toggles) so the counts below are
        // absolute rather than relative to whatever step 2 left behind.
        selectedNow.forEach((i) => i.click());
        const baseline = items.filter((i) => i.classList.contains("be-chip-selected")).length;
        items[0].click();
        items[1].click();
        const afterTwo = items.filter((i) => i.classList.contains("be-chip-selected")).length;
        items[0].click(); // re-click the first: removes only that one
        const afterToggle = items.filter((i) => i.classList.contains("be-chip-selected")).length;
        return {
          survivedFromStep2: selectedNow.length,
          baseline,
          afterTwo,
          afterToggle,
        };
      });
      assert.ok(chips, "the layer panel offers at least two chips");
      assert.ok(
        chips.survivedFromStep2 >= 1,
        "step 5: the chip the user clicked in step 2 is STILL selected after the single target " +
          "changed and was cleared (the SET and the single target do not clobber each other): " +
          JSON.stringify(chips),
      );
      assert.strictEqual(
        chips.baseline,
        0,
        "step 5: toggling those chips off leaves an empty set (a click never clears on its own, " +
          "but un-clicking each one does)",
      );
      assert.strictEqual(
        chips.afterTwo,
        2,
        "step 5: two plain chip clicks leave TWO chips selected (a click toggles; it never clears)",
      );
      assert.strictEqual(
        chips.afterToggle,
        1,
        "step 5: re-clicking one chip removes just that chip",
      );
      const afterChip = await page.evaluate(READ);
      assert.ok(
        afterChip.markerId && afterChip.ringShown,
        "step 5: a chip click also makes its element the active target, so the user sees an " +
          "outline from the chip path too",
      );
    } finally {
      await page.close().catch(() => {});
    }
  });
});
