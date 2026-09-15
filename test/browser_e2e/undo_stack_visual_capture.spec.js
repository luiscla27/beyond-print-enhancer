/**
 * Undo-stack visual-gate capture harness (track undo_stack_20260911, AC-V1).
 *
 * WHAT THE GATE HAS TO ANSWER, in pixels: can a user tell, from the frame alone, (a) that
 * there is an undo control, (b) WHAT it will undo (AC-8's naming requirement), and (c) that
 * pressing it actually put the sheet back? Plus the identity question the other gates ask:
 * does the new control read as the product's locked leather/gold chrome rather than as
 * something bolted on.
 *
 * Four states are captured at the protocol's pinned 1440x900 viewport (set explicitly —
 * the context default is 1280x720):
 *
 *   30-undo-idle.png        the control before any change: disabled, "Undo"
 *   31-undo-named.png       after a real change: enabled, naming the action + subject
 *   32-undo-applied.png     the same region after pressing it — the change reverted
 *   33-undo-keyboard.png    after the Ctrl+Z path, so the keyboard route is visible too
 *   undo-probe.json         the live read: the control's text/aria/disabled/box, its
 *                           computed colours, the stack depth, and a round-trip measurement
 *
 * Everything is driven through the REAL UI (the control-panel button, the in-sheet compact
 * control, a real Ctrl+Z keystroke) — no product seams — because the claim being gated is
 * about what the user sees and presses.
 *
 * Gating (graceful skip — a normal e2e run never captures and never fails):
 *   UNDO_SHOTS=1        enable capturing
 *   UNDO_SHOTS_DIR=...  override the artifact root
 *
 * Run:
 *   UNDO_SHOTS=1 npx mocha test/browser_e2e/undo_stack_visual_capture.spec.js --timeout 900000
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage } = require("./_helpers.js");
const { captureHarness } = require("./_capture.js");

/**
 * The capture harness (track refactor_surface_20260911, Phase 6, AC-6): the enable flag, the
 * artifact root, the shots subdirectory, the pinned viewport and `cap.provenance()` come from
 * test/browser_e2e/_capture.js instead of being re-declared in this file. The names below are
 * destructured from it, so every artifact name and assertion in this spec is unchanged.
 */
const cap = captureHarness({
  flag: 'UNDO_SHOTS',
  dirVar: 'UNDO_SHOTS_DIR',
  defaultDir: 'vendor/docs/undo-stack-20260911',
  subdir: 'shots',
});
const CAPTURING = cap.enabled;
const SHOTS = cap.shots;
const VIEWPORT = cap.viewport;


async function frame(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name) });
  console.log("frame:", path.join("shots", name));
}

/**
 * Read the UNDO control from the live DOM, plus whether it is actually on screen — a
 * control that exists but is scrolled out of the panel is discoverable only in theory.
 */
const READ_UNDO = () => {
  const btn = document.querySelector("#be-btn-undo");
  const style = (el, p) => (el ? getComputedStyle(el)[p] : null);
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  };
  const compactOn = Array.from(document.querySelectorAll(".print-section-container")).filter(
    (s) => s.classList.contains("be-compact-mode"),
  ).length;
  return {
    present: !!btn,
    label: btn ? (btn.querySelector(".be-ctl-label") || {}).textContent : null,
    // THE MEASURABLE ANTI-TRUNCATION CHECK (AC-V1 round 1 failed on exactly this): a label
    // whose scrollWidth exceeds its clientWidth is being visually clipped by the panel, so
    // the control eats its own meaning. Measured in the browser, not asserted in prose.
    labelClipped: (() => {
      const span = btn && btn.querySelector(".be-ctl-label");
      if (!span) return null;
      return span.scrollWidth > span.clientWidth + 1;
    })(),
    labelWidths: (() => {
      const span = btn && btn.querySelector(".be-ctl-label");
      return span ? { scroll: span.scrollWidth, client: span.clientWidth } : null;
    })(),
    text: btn ? btn.textContent.trim() : null,
    title: btn ? btn.getAttribute("title") : null,
    aria: btn ? btn.getAttribute("aria-label") : null,
    disabled: btn ? btn.disabled : null,
    box: box(btn),
    inViewport: btn
      ? (() => {
          const r = btn.getBoundingClientRect();
          return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
        })()
      : false,
    background: style(btn, "backgroundColor"),
    color: style(btn, "color"),
    borderColor: style(btn, "borderColor"),
    height: style(btn, "height"),
    compactSections: compactOn,
    probe: {
      // The liveness/identity markers the persona card owns, so a reviewer can see the
      // frame is the real product and not a stub.
      skin: !!document.querySelector(".be-ctl-tray"),
      gold: !!getComputedStyle(document.documentElement).getPropertyValue("--be-gold"),
    },
  };
};

describe("Undo-stack visual captures (AC-V1)", function () {
  this.timeout(900000);
  let ctx;
  const probe = {};

  before(async function () {
    if (!CAPTURING) this.skip();
    ctx = await launchExtensionContext();
  });

  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
    if (CAPTURING) {
      fs.mkdirSync(SHOTS, { recursive: true });
      fs.writeFileSync(path.join(SHOTS, "undo-probe.json"), JSON.stringify(probe, null, 2));
      console.log("probe:", path.join("shots", "undo-probe.json"));
    }
  });

  it("captures the idle, named, applied and keyboard states of the undo affordance", async function () {
    const page = await bootPage(ctx);
    page.on("console", (m) => {
      if (m.type() === "error") console.log("[page error]", m.text());
    });
    try {
      await page.setViewportSize(VIEWPORT);
      await page.waitForSelector("#print-enhance-layer-manager", { timeout: 30000 });
      await page.waitForTimeout(1800);
      probe.provenance = cap.provenance(page, "undo_stack_visual_capture.spec.js");

      /* 1 — IDLE: the control exists, is disabled, and claims nothing. */
      probe.idle = await page.evaluate(READ_UNDO);
      assert.ok(probe.idle.present, "the undo control exists in the control panel");
      assert.strictEqual(
        probe.idle.disabled,
        true,
        "with an empty stack the control is DISABLED — it must not claim an action it " +
          "cannot perform",
      );
      assert.strictEqual(probe.idle.label, "Undo", "and it reads as plain 'Undo' when idle");
      await frame(page, "30-undo-idle.png");

      /* 2 — NAMED: after a real change through the in-sheet compact control, the label
         names the action and its subject. */
      const changed = await page.evaluate(() => {
        const btn = document.querySelector(".be-compact-button");
        if (!btn) return null;
        btn.click();
        return { clicked: true };
      });
      assert.ok(changed, "the in-sheet compact control exists");
      await page.waitForTimeout(1200);

      probe.named = await page.evaluate(READ_UNDO);
      assert.strictEqual(probe.named.disabled, false, "the control is enabled after a change");
      // The VISIBLE text names the action and its subject. It deliberately carries no
      // "Undo: " prefix — the button's ICON says undo, and the prefix was spending a
      // quarter of the panel's ~22 visible characters repeating the glyph while the VERB
      // (the part a round-1 gate review flagged as missing) was being clipped away.
      assert.ok(
        /^Undo: (Toggle|Move|Resize|Rotate|Border|Print|Lock|Hide|Rename|Position|Nudge|Clone|Add|Compact|Delete|Reorder)/.test(
          String(probe.named.label),
        ),
        "the visible label announces UNDO and carries the ACTION VERB, so both the " +
          "affordance and the direction are readable: " + probe.named.label,
      );
      assert.ok(
        /^Undo: /.test(String(probe.named.aria)) && /^Undo: /.test(String(probe.named.title)),
        "…and the FULL 'Undo: <action> <subject>' string rides the accessible name and the " +
          "tooltip, so nothing is lost to a screen reader or a hover: " +
          JSON.stringify([probe.named.aria, probe.named.title]),
      );
      assert.ok(
        probe.named.compactSections > 0,
        "the change actually landed in the frame (a section is compacted)",
      );
      // AC-V1 round 1 FAILED on this: the label read `Undo: Toggle compact mo...` in the
      // pixels, cutting the subject off entirely, so the control did not name what it would
      // undo. The check is the browser's own overflow measurement.
      assert.strictEqual(
        probe.named.labelClipped,
        false,
        "the label must NOT be clipped by the panel (round 1 failed here): " +
          JSON.stringify(probe.named.labelWidths) +
          " for " +
          JSON.stringify(probe.named.label),
      );
      assert.ok(
        !/…|\.\.\.$/.test(String(probe.named.label)),
        "and it must not end in an ellipsis in its default state: " + probe.named.label,
      );
      await frame(page, "31-undo-named.png");

      /* 3 — APPLIED: press the real control; the change must revert in the pixels. */
      await page.evaluate(() => {
        const b = document.querySelector("#be-btn-undo");
        if (b) b.click();
      });
      await page.waitForTimeout(1400);
      probe.applied = await page.evaluate(READ_UNDO);
      assert.strictEqual(
        probe.applied.compactSections,
        0,
        "pressing the control REVERTED the change — the compacted section is back to normal",
      );
      await frame(page, "32-undo-applied.png");

      /* 4 — KEYBOARD: the Ctrl+Z route, through a real keystroke. */
      await page.evaluate(() => {
        const btn = document.querySelector(".be-compact-button");
        if (btn) btn.click();
      });
      await page.waitForTimeout(1000);
      probe.beforeKey = await page.evaluate(READ_UNDO);
      assert.ok(probe.beforeKey.compactSections > 0, "the change landed again");

      await page.keyboard.press("Control+z");
      await page.waitForTimeout(1400);
      probe.afterKey = await page.evaluate(READ_UNDO);
      assert.strictEqual(
        probe.afterKey.compactSections,
        0,
        "Ctrl+Z reverted it too — the keyboard route is live in the real page",
      );
      await frame(page, "33-undo-keyboard.png");

      /* 5 — the IDENTITY read: the control must wear the product's chrome. Every value is
         recorded so a reviewer can check it against the locked palette rather than take a
         claim on trust. */
      probe.identity = {
        note:
          "Recorded for the reviewer: the control must ride the existing control-panel " +
          "chrome (be-ctl-btn) rather than introduce a new look.",
        className: await page.evaluate(
          () => (document.querySelector("#be-btn-undo") || {}).className || null,
        ),
        tier: await page.evaluate(() => {
          const b = document.querySelector("#be-btn-undo");
          const hero = document.querySelector(".be-ctl-hero");
          return b && hero ? getComputedStyle(b).height + " vs hero " + getComputedStyle(hero).height : null;
        }),
      };
    } finally {
      await page.close().catch(() => {});
    }
  });
});
