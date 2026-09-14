/**
 * Selection-model visual-gate capture harness (track
 * selection_model_ia_20260910), per the track's visual_gate_protocol.md §1.
 *
 * Phase 1 is the unified selection language, so the gate's whole question is
 * whether a reviewer can tell FROM THE PIXELS ALONE what is selected, and whether
 * a selected SHAPE is as unmistakable as a selected SECTION. The four states of
 * the language are captured at the protocol's pinned 1440x900 viewport (set
 * explicitly — the context default is 1280x720):
 *
 *   10-section-selected.png    the section selected on the sheet (AC-1, AC-2)
 *   11-shape-selected.png      the shape selected on the sheet (AC-2, U-26)
 *   12-layer-row-selected.png  selected by clicking a LAYER ROW (AC-1)
 *   13-cleared.png             nothing selected (AC-1, the cleared state)
 *   selection-probe.json       the live read of the active target from every
 *                              component that displays a selection: the store
 *                              itself (isolated world), the on-sheet marker, the
 *                              layer row, the layer container and the panel title
 *
 * HOW SEAMS ARE DRIVEN: the enhancer runs in an ISOLATED world, so
 * `page.evaluate` cannot see `window.PropertiesPanel` (verified for this project
 * in feedback_visual_capture.spec.js). The three selection entry points are
 * therefore driven through `contentCall` (the extension's own injection path);
 * DOM reads stay in the main world, because the DOM is shared.
 *
 * Gating (graceful skip — a normal e2e run never captures and never fails):
 *   SELECTION_SHOTS=1        enable capturing
 *   SELECTION_SHOTS_DIR=...  override the artifact root
 *
 * Run:
 *   SELECTION_SHOTS=1 npx mocha test/browser_e2e/selection_visual_capture.spec.js \
 *     --timeout 900000
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, contentCall } = require("./_helpers.js");
const { captureHarness } = require("./_capture.js");

/**
 * The capture harness (track refactor_surface_20260911, Phase 6, AC-6): the enable flag, the
 * artifact root, the shots subdirectory, the pinned viewport and `cap.provenance()` come from
 * test/browser_e2e/_capture.js instead of being re-declared in this file. The names below are
 * destructured from it, so every artifact name and assertion in this spec is unchanged.
 */
const cap = captureHarness({
  flag: 'SELECTION_SHOTS',
  dirVar: 'SELECTION_SHOTS_DIR',
  defaultDir: 'docs/selection-model-ia-20260910',
  subdir: 'shots-phase1',
});
const ART_ROOT = cap.artRoot;
const CAPTURING = cap.enabled;
const SHOTS = cap.shots;
const VIEWPORT = cap.viewport;

/** Bind an artifact to the revision + viewport that produced it. */

async function frame(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name) });
  console.log("frame:", path.join("shots-phase1", name));
}

/* ------------------------------------------------------------------ *
 * Main-world DOM read: every component that DISPLAYS a selection.
 * ------------------------------------------------------------------ */
const READ_SELECTION = () => {
  const style = (el, prop) => (el ? getComputedStyle(el)[prop] : null);
  const marker = document.querySelector(".be-active-target");
  const markerRect = marker ? marker.getBoundingClientRect() : null;
  const wrappers = Array.from(document.querySelectorAll(".be-active-wrapper"));
  const rows = Array.from(
    document.querySelectorAll(
      "#print-enhance-layer-manager .be-layer-row.be-selection-layer",
    ),
  );
  const insertionRows = Array.from(
    document.querySelectorAll(
      "#print-enhance-layer-manager .be-layer-row.be-active-layer",
    ),
  );
  const panel = document.getElementById("print-enhance-properties-panel");
  const panelRect = panel ? panel.getBoundingClientRect() : null;
  const title = panel ? panel.querySelector("h4") : null;
  const layerPanel = document.getElementById("print-enhance-layer-manager");
  const lpRect = layerPanel ? layerPanel.getBoundingClientRect() : null;
  // The ring that PAINTS a selection lives on the wrapper's ::after (so no
  // descendant art can cover it). Read it as a pseudo-element: if the shape's
  // ring never renders, this says whether the reason is the rule or the paint.
  const wrapperEl = marker ? marker.closest(".be-active-wrapper") || null : null;
  const afterStyle = wrapperEl ? getComputedStyle(wrapperEl, "::after") : null;
  return {
    onSheet: {
      markerCount: document.querySelectorAll(".be-active-target").length,
      markerId: marker ? marker.id || "(no id)" : null,
      markerClasses: marker ? Array.from(marker.classList) : null,
      // The pixel contract of the shared outline, resolved by the browser (this
      // is what proves the token resolved, not merely that a rule exists).
      outlineStyle: style(marker, "outlineStyle"),
      outlineWidth: style(marker, "outlineWidth"),
      outlineColor: style(marker, "outlineColor"),
      outlineOffset: style(marker, "outlineOffset"),
      box: markerRect
        ? {
            left: Math.round(markerRect.left),
            top: Math.round(markerRect.top),
            w: Math.round(markerRect.width),
            h: Math.round(markerRect.height),
          }
        : null,
      wrapperIds: wrappers.map((w) => w.id || "(no id)"),
      wrapperGlow: wrappers.length ? style(wrappers[0], "filter") : null,
      wrapperBox: wrapperEl
        ? (() => {
            const r = wrapperEl.getBoundingClientRect();
            return {
              left: Math.round(r.left),
              top: Math.round(r.top),
              w: Math.round(r.width),
              h: Math.round(r.height),
            };
          })()
        : null,
      ring: afterStyle
        ? {
            content: afterStyle.content,
            display: afterStyle.display,
            visibility: afterStyle.visibility,
            opacity: afterStyle.opacity,
            width: afterStyle.width,
            height: afterStyle.height,
            position: afterStyle.position,
            borderWidth: afterStyle.borderTopWidth,
            borderColor: afterStyle.borderTopColor,
            borderStyle: afterStyle.borderTopStyle,
            zIndex: afterStyle.zIndex,
            top: afterStyle.top,
            left: afterStyle.left,
          }
        : null,
      // Is the body-level ring overlay present, shown, and where is it?
      ringOverlay: (() => {
        const r = document.getElementById("print-enhance-selection-ring");
        if (!r) return { present: false };
        const cs = getComputedStyle(r);
        const rect = r.getBoundingClientRect();
        return {
          present: true,
          inlineDisplay: r.style.display,
          computedDisplay: cs.display,
          position: cs.position,
          zIndex: cs.zIndex,
          border: cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor,
          rect: [
            Math.round(rect.left),
            Math.round(rect.top),
            Math.round(rect.width),
            Math.round(rect.height),
          ],
        };
      })(),
    },
    layerPanel: {
      box: lpRect
        ? {
            left: Math.round(lpRect.left),
            top: Math.round(lpRect.top),
            w: Math.round(lpRect.width),
            h: Math.round(lpRect.height),
          }
        : null,
      activeRowIds: rows.map((r) => r.dataset.layerId),
      activeRowBackground: rows.length ? style(rows[0], "backgroundColor") : null,
      activeRowBorderLeft: rows.length ? style(rows[0], "borderLeftColor") : null,
      // The SEPARATE insertion-target signal (the layer new shapes land in): it
      // must survive a cleared selection, so it is reported on its own.
      insertionRowIds: insertionRows.map((r) => r.dataset.layerId),
      activeLayerContainers: Array.from(
        document.querySelectorAll(".be-selection-layer[id^='print-enhance-']")
      ).map((c) => c.id),
    },
    propertiesPanel: {
      present: !!panel,
      title: title ? title.textContent.trim() : null,
      // What the panel offers for the current target (a shape has no font size /
      // compact / border controls, and says so instead of showing dead ones).
      controls: {
        fontSlider: panel ? !!panel.querySelector('input[type="range"]') : null,
        compactToggle: panel ? !!panel.querySelector('input[type="checkbox"]') : null,
        borderButton: panel ? !!panel.querySelector(".be-prop-border-button") : null,
        positionInputs: panel ? panel.querySelectorAll("input[data-be-pos]").length : null,
        note: panel && panel.querySelector(".be-prop-panel-note")
          ? panel.querySelector(".be-prop-panel-note").textContent.trim()
          : null,
      },
      box: panelRect
        ? {
            left: Math.round(panelRect.left),
            top: Math.round(panelRect.top),
            w: Math.round(panelRect.width),
            h: Math.round(panelRect.height),
          }
        : null,
    },
  };
};

describe("Selection-model visual captures (phase 3 — consistency)", function () {
  this.timeout(900000);
  let ctx;
  const probe = {};
  const SHOTS3 = path.join(ART_ROOT, "shots-phase3");

  before(async function () {
    if (!CAPTURING) this.skip();
    if (process.env.SELECTION_SHOTS_PHASE && process.env.SELECTION_SHOTS_PHASE !== "3") {
      this.skip();
    }
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
    // Only this phase's own run may write this probe: without the phase check a
    // PHASE=1 run overwrote it with an empty object (measured — the committed
    // probe went from 13 keys to {}), which silently destroyed the evidence.
    // The content check is a second guard: never write a probe with nothing in it.
    const ownPhase =
      !process.env.SELECTION_SHOTS_PHASE || process.env.SELECTION_SHOTS_PHASE === "3";
    if (CAPTURING && ownPhase) {
      if (Object.keys(probe).length === 0) {
        console.log("probe: skipped (this run captured nothing)");
        return;
      }
      fs.mkdirSync(SHOTS3, { recursive: true });
      fs.writeFileSync(
        path.join(SHOTS3, "consistency-probe.json"),
        JSON.stringify(probe, null, 2),
      );
      console.log("probe:", path.join("shots-phase3", "consistency-probe.json"));
    }
  });

  const frame3 = async (page, name) => {
    fs.mkdirSync(SHOTS3, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS3, name) });
    console.log("frame:", path.join("shots-phase3", name));
  };

  /** The layer panel's controls, the panels' geometry and the sheet's band. */
  const READ_CONSISTENCY = () => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
    };
    const rows = Array.from(document.querySelectorAll(".be-layer-row"));
    const controls = box(document.getElementById("print-enhance-controls"));
    const layers = box(document.getElementById("print-enhance-layer-manager"));
    const viewport = [window.innerWidth, window.innerHeight];
    // The band the two docked panels leave free for the sheet. A panel that the
    // narrow guard has taken out of the flow (display:none) measures as a zero
    // box, so it contributes no occupied width.
    const controlsHidden = !controls || controls[2] === 0;
    const layersHidden = !layers || layers[2] === 0;
    const freeLeft = controlsHidden ? 0 : controls[0] + controls[2];
    const freeRight = layersHidden ? viewport[0] : layers[0];
    return {
      viewport,
      rows: rows.length,
      panelsHidden: { controls: controlsHidden, layers: layersHidden },
      rowButtons: rows.length
        ? Array.from(rows[0].querySelectorAll(".be-layer-controls button")).map((b) => ({
            title: b.title,
            aria: b.getAttribute("aria-label"),
          }))
        : [],
      rowButtonTitles: rows.length
        ? Array.from(rows[0].querySelectorAll(".be-layer-controls button")).map((b) => b.title)
        : [],
      controlsBox: controls,
      layersBox: layers,
      freeBand: Math.round(freeRight - freeLeft),
      panelsOverlapEachOther: !!(controls && layers) &&
        !(controls[0] + controls[2] <= layers[0] || layers[0] + layers[2] <= controls[0]),
      panelsInsideViewport: [controls, layers].every(
        (b) => !b || (b[0] >= 0 && b[0] + b[2] <= viewport[0] + 1),
      ),
      // The picker/catalog cap width (AC-9) — read live at a narrow size.
      dialogsFitViewport: Array.from(document.querySelectorAll(".be-modal")).every((m) => {
        const r = m.getBoundingClientRect();
        return r.left >= -1 && r.left + r.width <= window.innerWidth + 1;
      }),
    };
  };

  it("captures the narrow viewport and the resolved layer controls", async function () {
    const page = await bootPage(ctx);
    try {
      // The resolved eye/printer labels on a real row.
      await page.setViewportSize(VIEWPORT);
      await page.waitForSelector("#print-enhance-layer-manager", { timeout: 30000 });
      await page.waitForTimeout(1500);
      probe.provenance = cap.provenance(page, "selection_visual_capture.spec.js#phase3");
      probe.wide = await page.evaluate(READ_CONSISTENCY);
      assert.ok(
        probe.wide.rowButtonTitles.includes("Skip when printing") &&
          probe.wide.rowButtonTitles.includes("Hide on sheet"),
        "the layer row carries two non-overlapping, self-describing controls: " +
          JSON.stringify(probe.wide.rowButtonTitles),
      );
      await frame3(page, "23-layer-controls-resolved.png");

      // Narrow: at and below the guard's thresholds.
      const stages = [
        [900, "22-narrow-900.png"],
        [700, "22-narrow-700.png"],
        [560, "22-narrow-560.png"],
      ];
      probe.narrow = {};
      for (const [width, frame] of stages) {
        await page.setViewportSize({ width, height: VIEWPORT.height });
        await page.waitForTimeout(700);
        const state = await page.evaluate(READ_CONSISTENCY);
        probe.narrow[width] = state;
        assert.ok(
          state.panelsInsideViewport,
          `at ${width}px both panels stay inside the viewport`,
        );
        assert.ok(
          !state.panelsOverlapEachOther,
          `at ${width}px the panels do not overlap each other`,
        );
        // "Usable" is expressed as a FRACTION of the viewport, so the claim holds
        // at every width instead of being tuned to one of them.
        const bandPct = state.freeBand / width;
        probe.narrow[`bandPct${width}`] = Number(bandPct.toFixed(3));
        assert.ok(
          bandPct >= 0.25,
          `at ${width}px the sheet keeps at least a quarter of the width ` +
            `(got ${state.freeBand}px = ${(bandPct * 100).toFixed(1)}%)`,
        );
        // AC-10's "with a way back": at the rail stage the panel's own header —
        // which holds its Restore control — is what remains visible.
        if (width === 700) {
          probe.narrow.guardDiagnostic = await contentCall(ctx, "narrowGuardState", [700]);
          const rail = await page.evaluate(() => {
            const panel = document.getElementById("print-enhance-layer-manager");
            const header = panel && panel.querySelector(".be-layer-panel-header");
            const ctrl = header && header.querySelector("button");
            const pr = panel ? panel.getBoundingClientRect() : null;
            // "Riding as its header" = the panel is the minimized rail, so its
            // box is header-height and the row list is clipped out of it (the rows
            // stay in the DOM — the panel's own minimize hides them by geometry).
            const rowsInside = Array.from(
              panel ? panel.querySelectorAll(".be-layer-row") : [],
            ).filter((r) => {
              const rr = r.getBoundingClientRect();
              return pr && rr.height > 0 && rr.top < pr.bottom - 2;
            }).length;
            return {
              height: pr ? Math.round(pr.height) : null,
              minimized: !!(panel && panel.classList.contains("minimized")),
              headerVisible: !!(header && header.getBoundingClientRect().height > 0),
              hasControl: !!ctrl,
              rowsVisibleInsidePanel: rowsInside,
            };
          });
          probe.narrow.rail = rail;
          assert.ok(
            rail.headerVisible && rail.hasControl,
            "at 700px the layer panel rides as its header, whose control is the way back: " +
              JSON.stringify(rail),
          );
          assert.ok(
            rail.minimized && rail.height <= 40 && rail.rowsVisibleInsidePanel === 0,
            "…with its rows out of the way (the rail is header-height): " +
              JSON.stringify(rail),
          );
          // THE WAY BACK, exercised: the header control restores the rows (the
          // first phase-3 round returned NOT MET here, because a CSS-only rail had
          // no way back at all).
          const restored = await page.evaluate(() => {
            const before = document.getElementById("print-enhance-layer-manager");
            const btn = before.querySelector(".be-layer-panel-header button");
            const label = btn.title;
            const heightBefore = Math.round(before.getBoundingClientRect().height);
            btn.click();
            // toggleMinimize() REBUILDS the panel (it swaps the element), so the
            // restored state has to be re-queried rather than read off the old ref.
            const after = document.getElementById("print-enhance-layer-manager");
            const pr = after.getBoundingClientRect();
            const rows = Array.from(after.querySelectorAll(".be-layer-row")).filter(
              (r) => {
                const rr = r.getBoundingClientRect();
                return rr.height > 0 && rr.top < pr.bottom - 2;
              },
            ).length;
            const btnAfter = after.querySelector(".be-layer-panel-header button");
            return {
              label,
              heightBefore,
              heightAfterClick: Math.round(pr.height),
              rowsAfterClick: rows,
              labelAfter: btnAfter && btnAfter.title,
              minimizedClassAfter: after.classList.contains("minimized"),
            };
          });
          probe.narrow.railRestored = restored;
          assert.ok(
            restored.rowsAfterClick > 0,
            "the header control brings the rows back: " + JSON.stringify(restored),
          );
          assert.strictEqual(
            restored.minimizedClassAfter,
            false,
            "…and the guard does not immediately re-minimize it (an explicit expand " +
              "outranks the guard): " + JSON.stringify(restored),
          );

          // Re-arm the guard the way a real user would — widen the window, then
          // narrow it again. This also asserts the guard's restore path: widening
          // must undo the guard's OWN minimization.
          await page.setViewportSize({ width: 1024, height: VIEWPORT.height });
          await page.waitForTimeout(600);
          probe.narrow.afterWidening = await page.evaluate(() => {
            const panel = document.getElementById("print-enhance-layer-manager");
            return {
              minimized: !!(panel && panel.classList.contains("minimized")),
              height: panel ? Math.round(panel.getBoundingClientRect().height) : null,
            };
          });
        }
        if (width === 560) {
          // DELIBERATELY UPDATED: an earlier draft hid the panel entirely at this
          // width; that is a dead end (no way back), which is exactly what the
          // AC-10 clause forbids. It rides as a rail at every narrow stage now, so
          // its own header control always remains.
          probe.narrow.guardAt560 = await contentCall(ctx, "narrowGuardState", []);
          const smallest = await page.evaluate(() => {
            const panel = document.getElementById("print-enhance-layer-manager");
            const btn = panel && panel.querySelector(".be-layer-panel-header button");
            const r = panel ? panel.getBoundingClientRect() : null;
            return {
              display: panel ? getComputedStyle(panel).display : null,
              minimized: !!(panel && panel.classList.contains("minimized")),
              height: r ? Math.round(r.height) : null,
              width: r ? Math.round(r.width) : null,
              hasControl: !!btn,
            };
          });
          probe.narrow.smallest = smallest;
          assert.notStrictEqual(
            smallest.display,
            "none",
            "the layer panel is never removed from the flow",
          );
          assert.ok(
            smallest.minimized && smallest.height <= 40 && smallest.hasControl,
            "at 560px it rides as a rail with its control available: " +
              JSON.stringify(smallest),
          );
        }
        await frame3(page, frame);
      }

      // AC-9 live: the picker at a narrow viewport fits and does not overflow.
      await page.setViewportSize({ width: 560, height: VIEWPORT.height });
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        const b = document.getElementById("be-btn-add-shape");
        if (b) b.click();
      });
      await page.waitForSelector(".be-modal-overlay .be-modal", { timeout: 20000 });
      await page.waitForTimeout(1200);
      probe.narrow.dialog = await page.evaluate(() => {
        const m = document.querySelector(".be-modal-overlay .be-modal");
        if (!m) return null;
        const r = m.getBoundingClientRect();
        return {
          box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
          viewportWidth: window.innerWidth,
          fits: r.left >= -1 && r.left + r.width <= window.innerWidth + 1,
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          inlineWidth: m.style.width || "(none)",
          maxWidth: getComputedStyle(m).maxWidth,
        };
      });
      assert.ok(probe.narrow.dialog, "the picker opened");
      assert.ok(
        probe.narrow.dialog.fits,
        "AC-9: the dialog fits the narrow viewport: " +
          JSON.stringify(probe.narrow.dialog),
      );
      assert.strictEqual(
        probe.narrow.dialog.overflow,
        false,
        "AC-9: no horizontal overflow at 560px",
      );
      assert.strictEqual(
        probe.narrow.dialog.inlineWidth,
        "(none)",
        "AC-9: no inline pixel width beats the shell",
      );
      await frame3(page, "22-narrow-picker.png");
    } finally {
      await page.close().catch(() => {});
    }
  });
});
describe("Selection-model visual captures (phase 2 — discoverability)", function () {
  this.timeout(900000);
  let ctx;
  const probe = {};
  const SHOTS2 = path.join(ART_ROOT, "shots-phase2");

  before(async function () {
    if (!CAPTURING) this.skip();
    if (process.env.SELECTION_SHOTS_PHASE && process.env.SELECTION_SHOTS_PHASE !== "2") this.skip();
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
    const ownPhase =
      !process.env.SELECTION_SHOTS_PHASE || process.env.SELECTION_SHOTS_PHASE === "2";
    if (CAPTURING && ownPhase && Object.keys(probe).length > 0) {
      fs.mkdirSync(SHOTS2, { recursive: true });
      fs.writeFileSync(
        path.join(SHOTS2, "hint-probe.json"),
        JSON.stringify(probe, null, 2),
      );
      console.log("probe:", path.join("shots-phase2", "hint-probe.json"));
    }
  });

  const frame2 = async (page, name) => {
    fs.mkdirSync(SHOTS2, { recursive: true });
    await page.setViewportSize(VIEWPORT);
    await page.screenshot({ path: path.join(SHOTS2, name) });
    console.log("frame:", path.join("shots-phase2", name));
  };

  const READ_HINT = () => {
    const card = document.getElementById("be-onboarding-hint");
    if (!card) return { present: false };
    const cs = getComputedStyle(card);
    const r = card.getBoundingClientRect();
    return {
      present: true,
      text: (card.querySelector(".be-onboarding-hint-text") || {}).textContent,
      role: card.getAttribute("role"),
      dismissLabel: (() => {
        const d = card.querySelector(".be-onboarding-hint-dismiss");
        return d ? { text: d.textContent.trim(), aria: d.getAttribute("aria-label") } : null;
      })(),
      box: [
        Math.round(r.left),
        Math.round(r.top),
        Math.round(r.width),
        Math.round(r.height),
      ],
      // Occlusion check: the card must live INSIDE the control panel column, so
      // it cannot cover the sheet the user is arranging (the criterion as
      // written; the first, sheet-floating version was rejected by this gate).
      viewportHeight: window.innerHeight,
      panelBox: (() => {
        const p = document.getElementById("print-enhance-controls");
        if (!p) return null;
        const pr = p.getBoundingClientRect();
        return [
          Math.round(pr.left),
          Math.round(pr.top),
          Math.round(pr.width),
          Math.round(pr.height),
        ];
      })(),
      background: cs.backgroundColor,
      color: cs.color,
      border: cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor,
      radius: cs.borderTopLeftRadius,
      zIndex: cs.zIndex,
    };
  };

  it("captures the fresh hint, the dismissed state, and its persistence", async function () {
    const page = await bootPage(ctx);
    try {
      await page.setViewportSize(VIEWPORT);
      await page.waitForSelector("#print-enhance-controls", { timeout: 30000 });
      await page.waitForTimeout(1500);

      probe.provenance = cap.provenance(page, "selection_visual_capture.spec.js#phase2");
      probe.fresh = await page.evaluate(READ_HINT);
      assert.ok(
        probe.fresh.present,
        "the hint must appear on a fresh state: " + JSON.stringify(probe.fresh),
      );
      assert.ok(
        probe.fresh.panelBox,
        "the control panel is present (the hint's host)",
      );
      const [cardL, cardW] = probe.fresh.box;
      const [panelL, , panelW] = probe.fresh.panelBox;
      assert.ok(
        cardL >= panelL - 1 && cardL + cardW <= panelL + panelW + 1,
        "the hint must stay within the control panel column, so it can never " +
          "cover the sheet: card=[" +
          probe.fresh.box +
          "] panel=[" +
          probe.fresh.panelBox +
          "]",
      );
      await frame2(page, "20-first-run-hint.png");

      /* dismiss it */
      const clicked = await page.evaluate(() => {
        const d = document.querySelector(
          "#be-onboarding-hint .be-onboarding-hint-dismiss",
        );
        if (!d) return null;
        const label = d.textContent.trim();
        d.click();
        return label;
      });
      assert.strictEqual(clicked, "Got it", "the dismiss control is the ratified one");
      await page.waitForTimeout(600);
      probe.dismissed = await page.evaluate(READ_HINT);
      assert.strictEqual(
        probe.dismissed.present,
        false,
        "the card is gone after dismissing",
      );
      await frame2(page, "21-hint-dismissed.png");

      /* a SECOND page in the same context shares chrome.storage: the persistence
         a real reload would carry (the unit suite simulates it the same way). */
      const page2 = await bootPage(ctx);
      try {
        await page2.setViewportSize(VIEWPORT);
        await page2.waitForSelector("#print-enhance-controls", { timeout: 30000 });
        await page2.waitForTimeout(1500);
        probe.afterFreshBoot = await page2.evaluate(READ_HINT);
        assert.strictEqual(
          probe.afterFreshBoot.present,
          false,
          "a dismissed hint must NOT reappear on a later boot: " +
            JSON.stringify(probe.afterFreshBoot),
        );
        await frame2(page2, "21b-hint-not-restored.png");
      } finally {
        await page2.close().catch(() => {});
      }
    } finally {
      await page.close().catch(() => {});
    }
  });
});

describe("Selection-model visual captures (phase 1)", function () {
  this.timeout(900000);
  let ctx;
  const probe = {};

  before(async function () {
    if (!CAPTURING) this.skip();
    if (process.env.SELECTION_SHOTS_PHASE && process.env.SELECTION_SHOTS_PHASE !== "1") this.skip();
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
    const ownPhase =
      !process.env.SELECTION_SHOTS_PHASE || process.env.SELECTION_SHOTS_PHASE === "1";
    if (CAPTURING && ownPhase && Object.keys(probe).length > 0) {
      fs.mkdirSync(SHOTS, { recursive: true });
      fs.writeFileSync(
        path.join(SHOTS, "selection-probe.json"),
        JSON.stringify(probe, null, 2),
      );
      console.log("probe:", path.join("shots-phase1", "selection-probe.json"));
    }
  });

  /** Every state is captured in ONE page, so the four frames share a session. */
  it("captures the four states of the unified selection language", async function () {
    const page = await bootPage(ctx);
    try {
      await page.setViewportSize(VIEWPORT);
      await page.waitForSelector("#print-enhance-layer-manager", { timeout: 30000 });
      await page.waitForSelector("#print-enhance-properties-panel", { timeout: 30000 });
      await page.waitForTimeout(1500);

      probe.provenance = cap.provenance(page, "selection_visual_capture.spec.js");

      /* 1 — a SECTION selected on the sheet (the existing entry point) */
      const sec = await contentCall(ctx, "selectSectionOnSheet");
      assert.ok(sec.ok, "section selection must be driven: " + JSON.stringify(sec));
      await page.waitForTimeout(700);
      probe.sectionSelected = {
        driven: sec,
        store: await contentCall(ctx, "selectionStoreRead"),
        dom: await page.evaluate(READ_SELECTION),
        geometry: await contentCall(ctx, "selectionGeometry"),
      };
      await frame(page, "10-section-selected.png");

      /* 2 — a SHAPE selected on the sheet (U-26: previously no outline at all) */
      const shape = await contentCall(ctx, "selectShapeOnSheet");
      assert.ok(shape.ok, "shape selection must be driven: " + JSON.stringify(shape));
      await page.waitForTimeout(700);
      probe.shapeSelected = {
        driven: shape,
        store: await contentCall(ctx, "selectionStoreRead"),
        dom: await page.evaluate(READ_SELECTION),
      };
      await frame(page, "11-shape-selected.png");

      /* 3 — selected by clicking a LAYER ROW (the new sync direction) */
      const rowTarget = probe.sectionSelected.dom.layerPanel.activeRowIds[0] ||
        "sections";
      const row = await contentCall(ctx, "selectLayerRow", ["sections"]);
      assert.ok(row.ok, "row selection must be driven: " + JSON.stringify(row));
      assert.ok(
        row.afterId,
        "clicking a non-empty layer row must select its element (row: " +
          JSON.stringify(row) +
          ", first active row was " + rowTarget + ")",
      );
      await page.waitForTimeout(700);
      probe.layerRowSelected = {
        driven: row,
        store: await contentCall(ctx, "selectionStoreRead"),
        dom: await page.evaluate(READ_SELECTION),
      };
      await frame(page, "12-layer-row-selected.png");

      /* 4 — cleared (the empty state of the language) */
      await contentCall(ctx, "clearSelection");
      await page.waitForTimeout(700);
      probe.cleared = {
        store: await contentCall(ctx, "selectionStoreRead"),
        dom: await page.evaluate(READ_SELECTION),
      };
      await frame(page, "13-cleared.png");

      /* ---- the agreement the gate exists to check (asserted, not just shot) ---- */
      const s = probe.sectionSelected.dom;
      assert.strictEqual(
        s.onSheet.markerCount,
        1,
        "exactly one element is selected after selecting a section",
      );
      assert.strictEqual(
        probe.sectionSelected.store.storeTargetId,
        s.onSheet.markerId,
        "the store and the on-sheet marker name the SAME element",
      );
      assert.deepStrictEqual(
        probe.sectionSelected.store.activeLayerRows,
        s.layerPanel.activeRowIds,
        "the store's view of the active row matches the DOM's",
      );
      assert.ok(
        /Editing:/.test(s.propertiesPanel.title || ""),
        "the panel names the selected section: " + s.propertiesPanel.title,
      );

      const sh = probe.shapeSelected.dom;
      assert.strictEqual(
        sh.onSheet.markerCount,
        1,
        "exactly one element is selected after selecting a shape",
      );
      // AC-2's paint, asserted where it actually happens. This block used to
      // compare the TARGET's computed `outline*` between the two kinds — which
      // became VACUOUS once the ring moved to one body-level overlay: both
      // targets now have no outline at all, so the values were equal by being
      // empty. The claim is asserted on the ring itself instead.
      const ring = sh.onSheet.ringOverlay;
      assert.ok(ring && ring.present, "the selection ring overlay exists for a shape");
      assert.strictEqual(
        ring.computedDisplay,
        "block",
        "…is SHOWN for the selected shape (not merely present in the DOM)",
      );
      assert.strictEqual(
        ring.position,
        "fixed",
        "…as the same fixed overlay a selected section uses",
      );
      assert.strictEqual(
        ring.border,
        s.onSheet.ringOverlay.border,
        "…with the SAME border as for a selected section (one visual language): " +
          ring.border,
      );
      assert.ok(
        /2px solid rgb\(198, 161, 91\)/.test(ring.border),
        "…and that border is the locked gold token RESOLVED, not an unresolved var(): " +
          ring.border,
      );
      // Over the target's own box, not the viewport origin.
      assert.ok(
        Math.abs(ring.rect[0] - sh.onSheet.box.left) <= 4 &&
          Math.abs(ring.rect[1] - sh.onSheet.box.top) <= 4,
        "…positioned over the selected shape's measured box: ring=" +
          JSON.stringify(ring.rect) +
          " box=" +
          JSON.stringify(sh.onSheet.box),
      );
      assert.notStrictEqual(
        sh.layerPanel.activeRowIds[0],
        s.layerPanel.activeRowIds[0],
        "selecting a shape moves the SELECTION row to the shape's layer",
      );
      assert.deepStrictEqual(
        sh.layerPanel.insertionRowIds,
        s.layerPanel.insertionRowIds,
        "…while the insertion target (a different question) stays put",
      );
      assert.ok(
        sh.propertiesPanel.title && /Editing:/.test(sh.propertiesPanel.title),
        "the panel is populated for a shape too: " + sh.propertiesPanel.title,
      );
      assert.strictEqual(
        sh.propertiesPanel.controls.fontSlider,
        false,
        "a shape does not get section-only controls",
      );
      assert.strictEqual(
        sh.propertiesPanel.controls.positionInputs,
        2,
        "a shape still gets the X/Y position inputs",
      );

      const lr = probe.layerRowSelected.dom;
      assert.strictEqual(
        lr.onSheet.markerCount,
        1,
        "clicking a layer row selects exactly one element",
      );
      assert.strictEqual(
        lr.propertiesPanel.title,
        s.propertiesPanel.title,
        "the row selected the same element the sheet entry point does",
      );
      assert.deepStrictEqual(
        lr.layerPanel.activeRowIds,
        ["sections"],
        "the clicked row is the active row",
      );

      const c = probe.cleared;
      assert.strictEqual(c.dom.onSheet.markerCount, 0, "cleared: no marker");
      assert.strictEqual(c.store.storeTargetId, null, "cleared: the store is empty");
      assert.ok(
        !c.dom.propertiesPanel.title,
        "cleared: the panel shows its empty state (no title)",
      );
      // AC-1's "clearing clears all three", asserted (consultation 2026-09-10:
      // the row used to fall back to the insertion target, which made this state
      // pixel-identical to the section-selected state on the layer panel).
      assert.deepStrictEqual(
        c.dom.layerPanel.activeRowIds,
        [],
        "cleared: NO row carries the selection marker",
      );
      assert.strictEqual(
        c.dom.layerPanel.activeLayerContainers.length,
        0,
        "cleared: no on-sheet layer container carries the selection marker",
      );
      assert.deepStrictEqual(
        c.store.activeLayerRows,
        [],
        "cleared: the isolated-world read agrees (no selection row)",
      );
      // …and the separate insertion-target signal survives, as designed.
      assert.deepStrictEqual(
        c.dom.layerPanel.insertionRowIds,
        ["sections"],
        "cleared: the insertion target still names where new shapes land",
      );
    } finally {
      await page.close().catch(() => {});
    }
  });
});
