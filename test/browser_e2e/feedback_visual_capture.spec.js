/**
 * Feedback-lifecycle visual-gate capture harness (track
 * feedback_lifecycle_a11y_20260910), per the track's visual_gate_protocol.md.
 *
 * Captures the named frames for each build phase and writes the matching live
 * DOM probe, so the gate has machine evidence and not only photographs:
 *
 *   Phase 1 (toast lane, AC-1 + the new copy)
 *     10-toast-with-dismiss.png     a toast (raised by a REAL Save action) carrying
 *                                   its dismiss affordance
 *     11-toast-error-retained.png   both error toasts surviving a six-toast burst
 *     12-boot-restore-success.png   the restore confirmation (AC-2)
 *     12b-boot-organic.png          the confirmation the REAL boot emitted on this
 *                                   profile, whatever it was (evidence that the
 *                                   restored/default copies differ in situ)
 *     13-partial-spell-restore.png  the aggregated partial-failure message (AC-3)
 *     feedback-probe.json           the live DOM read of each state
 *
 *   Phase 2 (surfaces + keyboard, AC-5..AC-7)
 *     20-empty-state-dialog.png     the persistent "nothing found" dialog
 *     20b-empty-state-still-present.png  the same dialog after the toast dwell
 *     21-context-menu-keyboard.png  the layer context menu, opened on a real row
 *     21b-context-menu-after-walk.png  the same menu after the keyboard walk
 *     22-context-menu-clamped.png   a right-click at the bottom-right corner, clamped
 *     behaviour-probe.json          the focus walk + the clamp geometry
 *
 * HOW SEAMS ARE DRIVEN: the enhancer's content script runs in an ISOLATED world,
 * so `page.evaluate` cannot see `window.Modals` / `window.LayerManager` (verified
 * — both read `undefined` in the main world). `contentCall` from `_helpers.js`
 * injects the call into that world through the extension's own service worker,
 * which is how the extension itself injects its content script. DOM reads
 * (`READ_*` below) stay in the main world, because the DOM is shared.
 *
 * Gating (graceful skip — a normal e2e run never captures and never fails):
 *   FEEDBACK_SHOTS=1        enable capturing
 *   FEEDBACK_SHOTS_PHASE=1  capture only phase 1   (default: both phases)
 *   FEEDBACK_SHOTS_PHASE=2  capture only phase 2
 *   FEEDBACK_SHOTS_DIR=...  override the artifact root
 *
 * Run:
 *   FEEDBACK_SHOTS=1 FEEDBACK_SHOTS_PHASE=1 npx mocha \
 *     test/browser_e2e/feedback_visual_capture.spec.js --timeout 900000
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  launchExtensionContext,
  bootPage,
  contentCall,
} = require("./_helpers.js");
const { captureHarness } = require("./_capture.js");

/**
 * The capture harness (track refactor_surface_20260911, Phase 6, AC-6): the enable flag, the
 * artifact root, the shots subdirectory, the pinned viewport and `cap.provenance()` come from
 * test/browser_e2e/_capture.js instead of being re-declared in this file. The names below are
 * destructured from it, so every artifact name and assertion in this spec is unchanged.
 */
const cap = captureHarness({
  flag: 'FEEDBACK_SHOTS',
  dirVar: 'FEEDBACK_SHOTS_DIR',
  defaultDir: 'vendor/docs/feedback-lifecycle-a11y-20260910',
  phaseVar: 'FEEDBACK_SHOTS_PHASE',
  defaultPhase: "both",
});
const ART_ROOT = cap.artRoot;
const CAPTURING = cap.enabled;
const PHASE = cap.phase;
const wants = (n) => PHASE === "both" || String(n) === String(PHASE);

const shotsDir = (phase) => path.join(ART_ROOT, `shots-phase${phase}`);

/** Bind an artifact to the revision + viewport that produced it. */

function writeJson(dir, name, data) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
}

async function frame(page, phase, name) {
  const dir = shotsDir(phase);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, name) });
  console.log("frame:", path.join(`shots-phase${phase}`, name));
}

/* ------------------------------------------------------------------ *
 * Main-world DOM reads (the DOM is shared; only the GLOBALS are not).
 * ------------------------------------------------------------------ */

const READ_TOASTS = () => {
  const toasts = Array.from(document.querySelectorAll(".be-feedback"));
  const style = (el) => {
    const cs = getComputedStyle(el);
    return {
      background: cs.backgroundColor,
      border: cs.borderTopColor,
      color: cs.color,
      radius: cs.borderTopLeftRadius,
    };
  };
  return {
    count: toasts.length,
    errors: toasts.filter((t) => t.classList.contains("be-feedback-error")).length,
    nonErrors: toasts.filter((t) => !t.classList.contains("be-feedback-error")).length,
    toasts: toasts.map((t) => {
      const dismiss = t.querySelector(".be-feedback-dismiss");
      const dRect = dismiss ? dismiss.getBoundingClientRect() : null;
      const tRect = t.getBoundingClientRect();
      return {
        text: t.textContent.trim(),
        kind: t.classList.contains("be-feedback-error")
          ? "error"
          : t.classList.contains("be-feedback-success")
            ? "success"
            : "info",
        role: t.getAttribute("role"),
        ariaLive: t.getAttribute("aria-live"),
        style: style(t),
        box: {
          top: Math.round(tRect.top),
          left: Math.round(tRect.left),
          w: Math.round(tRect.width),
          h: Math.round(tRect.height),
        },
        dismiss: dismiss
          ? {
              tag: dismiss.tagName,
              label: dismiss.getAttribute("aria-label"),
              text: dismiss.textContent.trim(),
              size: dRect
                ? { w: Math.round(dRect.width), h: Math.round(dRect.height) }
                : null,
              inViewport: dRect
                ? dRect.top >= 0 &&
                  dRect.left >= 0 &&
                  dRect.bottom <= innerHeight &&
                  dRect.right <= innerWidth
                : null,
              style: style(dismiss),
            }
          : null,
      };
    }),
    announcer: (() => {
      const a = document.getElementById("be-feedback-announcer");
      return a ? { role: a.getAttribute("role"), text: a.textContent } : null;
    })(),
  };
};

const READ_EMPTY_STATE = () => {
  const overlay =
    document.querySelector(".be-modal-overlay") ||
    document.getElementById("print-enhance-overlay");
  const modal = overlay && overlay.querySelector(".be-modal");
  if (!modal) return { present: false };
  const r = modal.getBoundingClientRect();
  // The shared primitive renders the title as an aria-labelledby <h3> (there is
  // no .be-modal-title class — reading that selector returned null and would have
  // understated the evidence).
  const labelledBy = modal.getAttribute("aria-labelledby");
  const titleEl = labelledBy ? document.getElementById(labelledBy) : null;
  const hintEl = modal.querySelector(".be-modal-hint");
  return {
    present: true,
    role: modal.getAttribute("role"),
    title: titleEl ? titleEl.textContent : null,
    body: (modal.querySelector(".be-modal-message") || {}).textContent || null,
    hint: hintEl ? hintEl.textContent : null,
    actions: Array.from(modal.querySelectorAll(".be-modal-actions button")).map(
      (b) => b.textContent,
    ),
    hasCloseX: !!modal.querySelector(".be-modal-close"),
    box: { w: Math.round(r.width), h: Math.round(r.height) },
    onScreen:
      r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth,
  };
};

const READ_MENU = () => {
  const menu = document.getElementById("print-enhance-context-menu");
  if (!menu) return null;
  const r = menu.getBoundingClientRect();
  const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
  return {
    role: menu.getAttribute("role"),
    itemCount: items.length,
    itemRoles: items.map((i) => i.getAttribute("role")),
    tabbable: items.map((i) => i.getAttribute("tabindex")),
    activeIsItem: items.includes(document.activeElement),
    activeIsFirst: items.length > 0 && document.activeElement === items[0],
    activeText: document.activeElement ? document.activeElement.textContent : null,
    box: {
      left: Math.round(r.left),
      top: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
    },
    fullyOnScreen:
      r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    viewport: { w: innerWidth, h: innerHeight },
  };
};

/** Click the dismiss control of the toast whose text contains `needle`. */
const DISMISS_TOAST = (needle) => {
  const toast = Array.from(document.querySelectorAll(".be-feedback")).find((t) =>
    t.textContent.includes(needle),
  );
  const btn = toast && toast.querySelector(".be-feedback-dismiss");
  if (btn) btn.click();
  return !!btn;
};

/** Click a control-panel button by (sub)string. */
const CLICK_CONTROL = (needle) => {
  const b = Array.from(document.querySelectorAll("#print-enhance-controls button")).find(
    (x) => (x.textContent || "").includes(needle),
  );
  if (!b) return false;
  b.click();
  return true;
};

describe("feedback lifecycle visual captures", function () {
  this.timeout(900000);
  let ctx;

  before(async function () {
    if (!CAPTURING) this.skip();
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("phase 1 — toast lane: dismissal affordance, retained error, new copy (AC-1..AC-3)", async function () {
    if (!CAPTURING || !wants(1)) this.skip();
    const page = await bootPage(ctx);
    const phase = 1;
    const dir = shotsDir(phase);
    const probe = {
      provenance: null, // filled in AFTER the viewport is pinned (below)
      states: {},
      notes: {
        seams:
          "toasts are raised through the product's own helper in the extension's isolated world (contentCall); the DOM reads happen in the main world",
        frame13:
          "13-partial-spell-restore shows the toast carrying the AC-3 aggregated message. The AGGREGATION behaviour is asserted in test/unit/feedback_lifecycle.test.js (with its falsification); replaying a real Reset here would erase the sheet the other frames are captured against.",
      },
    };

    // Pin the protocol's viewport FIRST, so the provenance records the viewport
    // the frames were actually taken at (the context default is 1280x720, and
    // recording that while capturing at 1440x900 would be an evidence defect).
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1200);
    probe.provenance = cap.provenance(page, "feedback_visual_capture.spec.js phase 1");

    /* ---- 12b. whatever the REAL boot announced on this profile ---- */
    probe.states["12b-boot-organic"] = await page.evaluate(READ_TOASTS);
    if (probe.states["12b-boot-organic"].count > 0) {
      await frame(page, phase, "12b-boot-organic.png");
    }

    /* ---- 10. a toast raised by a REAL action, carrying its dismiss ✕ ---- */
    await contentCall(ctx, "clearToasts");
    const clicked = await page.evaluate(CLICK_CONTROL, "Save to Browser");
    assert.strictEqual(clicked, true, "the Save to Browser control exists");
    await page.waitForSelector(".be-feedback", { timeout: 20000 });
    await page.waitForTimeout(400);
    probe.states["10-toast-with-dismiss"] = await page.evaluate(READ_TOASTS);
    await frame(page, phase, "10-toast-with-dismiss.png");

    /* ---- 11. an ERROR toast surviving a burst of later toasts (AC-1) ---- */
    await contentCall(ctx, "clearToasts");
    // The shape that used to lose a failure: save → error → save → error →
    // save → success. The cap must never take either error.
    //
    // THE ARITHMETIC, recorded here because a previous gate round (correctly)
    // refused to infer it from the pixels: SIX toasts are raised — FOUR
    // non-error (2 success + 1 info + 1 success) and TWO errors. The cap is 3
    // NON-error toasts, so exactly ONE non-error toast is evicted and FIVE
    // remain on screen (3 non-error + 2 error). If both error toasts are on
    // screen in the frame, the policy held.
    const raised = [
      ["Layout saved", "success"],
      ["Template could not be applied", "error"],
      ["Layer added", "info"],
      ["Backup failed (storage full)", "error"],
      ["Layout saved", "success"],
      ["Clone created", "success"],
    ];
    for (const [msg, type] of raised) {
      await contentCall(ctx, "raiseToast", [msg, type]);
    }
    await page.waitForTimeout(600);
    probe.states["11-raised"] = {
      raised: raised.length,
      raisedErrors: raised.filter(([, t]) => t === "error").length,
      raisedNonErrors: raised.filter(([, t]) => t !== "error").length,
      cap: 3,
      expectedVisible: 5,
      expectedEvictedNonErrors: 1,
      note:
        "the cap of 3 applies to NON-error toasts, so one non-error toast is " +
        "evicted and 5 remain (3 non-error + 2 error, both errors intact)",
    };
    probe.states["11-toast-error-retained"] = await page.evaluate(READ_TOASTS);
    await frame(page, phase, "11-toast-error-retained.png");

    /* ---- 12. the boot-restore confirmation (AC-2), via the real seam ---- */
    await contentCall(ctx, "clearToasts");
    probe.states["12-announceReturn"] = await contentCall(ctx, "announceRestore", [
      { restored: true },
    ]);
    await page.waitForTimeout(450);
    probe.states["12-boot-restore-success"] = await page.evaluate(READ_TOASTS);
    await frame(page, phase, "12-boot-restore-success.png");

    /* ---- 12c. the OTHER AC-2 copy, so the two can be compared in pixels ---- */
    await contentCall(ctx, "clearToasts");
    await contentCall(ctx, "announceRestore", [{ restored: false, reason: "empty" }]);
    await page.waitForTimeout(450);
    probe.states["12c-default-copy"] = await page.evaluate(READ_TOASTS);
    await frame(page, phase, "12c-boot-default-copy.png");

    /* ---- 13. the aggregated partial-restore message (AC-3) ---- */
    await contentCall(ctx, "clearToasts");
    await contentCall(ctx, "raiseToast", [
      "2 merged spells could not be restored: Booming Blade, Green-Flame Blade",
      "error",
    ]);
    await page.waitForTimeout(450);
    probe.states["13-partial-spell-restore"] = await page.evaluate(READ_TOASTS);
    await frame(page, phase, "13-partial-spell-restore.png");

    /* ---- dismissal: activate the ✕ and prove the announcer reports it ---- */
    await contentCall(ctx, "clearToasts");
    await contentCall(ctx, "raiseToast", ["Layout saved", "success"]);
    await contentCall(ctx, "raiseToast", ["Backup failed (storage full)", "error"]);
    await page.waitForTimeout(300);
    probe.states["dismiss-clicked"] = await page.evaluate(
      DISMISS_TOAST,
      "Layout saved",
    );
    await page.waitForTimeout(300);
    probe.states["dismiss"] = await page.evaluate(READ_TOASTS);
    await frame(page, phase, "14-after-dismiss.png");

    writeJson(dir, "feedback-probe.json", probe);

    assert.strictEqual(
      probe.states["11-toast-error-retained"].errors,
      2,
      "both error toasts must still be on screen when 11-toast-error-retained.png is captured",
    );
    assert.strictEqual(
      probe.states["10-toast-with-dismiss"].toasts[0].dismiss !== null,
      true,
      "the toast in frame 10 carries its dismiss control",
    );
    assert.strictEqual(
      probe.states["dismiss-clicked"],
      true,
      "the dismiss control was found and activated",
    );
  });

  it("phase 2 — persistent empty state, keyboard menu, clamped menu (AC-5..AC-7)", async function () {
    if (!CAPTURING || !wants(2)) this.skip();
    const page = await bootPage(ctx);
    const phase = 2;
    const dir = shotsDir(phase);
    const probe = {
      provenance: null, // filled in AFTER the viewport is pinned (below)
      states: {},
    };

    // Pin the protocol's viewport FIRST (see the phase-1 note): the provenance
    // must record the viewport the frames were actually taken at.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1200);
    probe.provenance = cap.provenance(page, "feedback_visual_capture.spec.js phase 2");
    await contentCall(ctx, "clearToasts");

    /* ---- 20. the persistent empty-state dialog (AC-5) ---- */
    probe.states["20-open"] = await contentCall(ctx, "openEmptyState", [
      {
        title: "No clones found",
        message: "This sheet has no clones to manage yet.",
        hint: "Clone a section first, then come back here.",
      },
    ]);
    assert.strictEqual(
      probe.states["20-open"].ok,
      true,
      "the AC-5 empty-state seam exists: " + JSON.stringify(probe.states["20-open"]),
    );
    await page.waitForTimeout(500);
    probe.states["20-empty-state-dialog"] = await page.evaluate(READ_EMPTY_STATE);
    await frame(page, phase, "20-empty-state-dialog.png");

    // ...and it must STILL be there well after the old toast dwell would have
    // expired it — that is AC-5's entire point.
    await page.waitForTimeout(4200);
    probe.states["20-after-dwell"] = await page.evaluate(READ_EMPTY_STATE);
    await frame(page, phase, "20b-empty-state-still-present.png");
    assert.strictEqual(
      probe.states["20-after-dwell"].present,
      true,
      "the empty state must outlive the 3s toast dwell (read taken after 4.2s)",
    );
    await page.evaluate(() => {
      const x =
        document.querySelector(".be-modal-overlay .be-modal-close") ||
        document.querySelector(".be-modal-overlay .be-modal-ok");
      if (x) x.click();
    });
    await page.waitForTimeout(400);

    /* ---- 21. the context menu on a REAL row: ARIA + entry focus + walk ---- */
    // The contextmenu handler is on the ITEM elements (chips / item cards, which
    // carry `data-target-id`), NOT on the layer row — a right-click aimed at a
    // row's centre never reaches it. Measured: the first attempt at this frame
    // right-clicked a row and no menu opened.
    const anchor = await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll("#print-enhance-layer-manager [data-target-id]"),
      );
      const target = items[items.length - 1];
      if (!target) return null;
      const r = target.getBoundingClientRect();
      return {
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
        id: target.dataset.targetId || target.id || null,
        cls: target.className,
      };
    });
    assert.ok(anchor, "the layer panel rendered item cards to right-click");
    await page.mouse.click(anchor.x, anchor.y, { button: "right" });
    await page.waitForTimeout(500);
    probe.states["21-anchor"] = anchor;
    probe.states["21-context-menu-keyboard"] = await page.evaluate(READ_MENU);
    await frame(page, phase, "21-context-menu-keyboard.png");

    probe.states["21-focus-walk"] = await contentCall(ctx, "walkMenu");
    probe.states["21-after-walk"] = await page.evaluate(READ_MENU);
    await frame(page, phase, "21b-context-menu-after-walk.png");

    /* ---- 22. the clamp: open at the bottom-right corner through the real
       entry point, on a real row id ---- */
    await page.evaluate(() => {
      const ex = document.getElementById("print-enhance-context-menu");
      if (ex) ex.remove();
    });
    const rowId = (await contentCall(ctx, "lastLayerTargetId")) || anchor.id;
    probe.states["22-open"] = await page.evaluate(({ x, y }) => {
      return { x, y, vw: innerWidth, vh: innerHeight };
    }, { x: 1440 - 2, y: 900 - 2 });
    probe.states["22-call"] = await contentCall(ctx, "openMenuAt", [
      1440 - 2,
      900 - 2,
      rowId,
    ]);
    await page.waitForTimeout(400);
    probe.states["22-context-menu-clamped"] = await page.evaluate(READ_MENU);
    await frame(page, phase, "22-context-menu-clamped.png");

    writeJson(dir, "behaviour-probe.json", probe);

    assert.ok(
      probe.states["21-context-menu-keyboard"],
      "the context menu opened on right-click",
    );
    assert.strictEqual(
      probe.states["22-context-menu-clamped"].fullyOnScreen,
      true,
      "a corner right-click must clamp the menu inside the viewport",
    );
  });
});
