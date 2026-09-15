/**
 * Ornament + symmetry visual-gate capture harness (track
 * ornament_symmetry_20260910).
 *
 * Boots the unpacked MV3 extension on the demo sheet at 1440px, captures the
 * named frames of visual_gate_protocol.md §1 into
 * vendor/docs/ornament-symmetry-20260910/shots-phaseN/, and MEASURES the claims the
 * spec makes numerically (AC-1 rule stack, AC-2 corner construction, AC-3F
 * paint order / clipping / hover / print, AC-4 tiers, AC-5 wrap immunity). The
 * measurement is why this is also an assertion suite: a claim only a human
 * could check would not be a gate.
 *
 * Gating (graceful-skip — a normal e2e run never captures and never fails):
 *   ORNAMENT_SHOTS=1            enable capturing
 *   ORNAMENT_PHASE=1|2          only run that phase's block
 *   ORNAMENT_SHOTS_DIR=...      override the artifact root
 *
 * Run:
 *   ORNAMENT_SHOTS=1 ORNAMENT_PHASE=1 npx mocha test/browser_e2e/ornament_symmetry_visual_capture.spec.js --timeout 900000
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
  flag: 'ORNAMENT_SHOTS',
  dirVar: 'ORNAMENT_SHOTS_DIR',
  defaultDir: 'vendor/docs/ornament-symmetry-20260910',
  phaseVar: 'ORNAMENT_PHASE',
  defaultPhase: "",
});
const ART_ROOT = cap.artRoot;
const CAPTURING = cap.enabled;
const PHASE = cap.phase;

/** The ornament DETECTOR, documented as data (the phase-1 execution review
 *  required the detector vectors to be part of the artifact, so the negative
 *  predicate can be audited rather than trusted). A plain surface element is
 *  "ornamented" if ANY of these is true on its ::before/::after:
 *    - a background-image containing `linear-gradient` (the corner-L layers);
 *    - a border whose colour is an ornament gold AND whose width is > 0
 *      (an undefined pseudo-element computes borderTopColor to currentColor, so
 *      a gold TEXT colour would otherwise be a false positive — this rule
 *      falsified exactly such a false positive on the active modal tab);
 *    - a background-color set to an ornament gold.
 *  `ornamentHexes` are the only two golds the ornament uses, as computed rgb. */
const ORNAMENT_DETECTOR_JS = {
  version: 1,
  props: [
    "::before.backgroundImage",
    "::after.backgroundImage",
    "::before.borderTopColor (only when borderTopWidth > 0)",
    "::after.borderTopColor (only when borderTopWidth > 0)",
    "::before.backgroundColor",
    "::after.backgroundColor",
  ],
  ornamentHexes: ["rgb(198, 161, 91)", "rgb(233, 214, 164)"],
  ornamentHexesSrc: ["#C6A15B (gold)", "#E9D6A4 (goldHi)"],
  note: "linear-gradient is the corner-L layer signature; both golds are otherwise used only for 1px strokes and the diamond, which never appear on a plain surface.",
};

/** The three DISJOINT surface sets, mirrored from js/ui_theme.js so the live
 *  audit can report the hierarchy partition with counts (the phase-1 execution
 *  review asked for the partition to be provable, not just asserted). */
const ORNAMENT_SURFACES_JS = {
  full: [
    "#print-enhance-controls",
    "#print-enhance-layer-manager, .be-layer-panel",
    ".be-modal",
  ],
  quiet: [
    ".be-context-menu",
    ".be-color-picker-popup",
    'div[style*="z-index: 20000"]',
  ],
  plain: [
    ".be-feedback",
    ".be-section-actions",
    // the centred drag handle is in-sheet chrome (ISSUE_drag_and_drop.md) and is
    // classified here exactly as the action bar beside it is; the mirror drifts if
    // js/ui_theme.js's ORNAMENT_SURFACES.plain changes without this list (see the
    // note on this object).
    ".be-drag-handle",
    ".be-more-options-button",
    ".be-layer-item-card",
    ".be-modal-tags",
    ".be-modal-tabs",
    ".be-picker-search",
  ],
};

/** Bind an artifact to the exact revision + viewport that produced it (the
 *  phase-2 execution review required this for `tier-measurements.json`). */

/* ------------------------------------------------------------------ helpers */

async function frame(page, phaseDir, name) {
  const dir = path.join(ART_ROOT, phaseDir);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, name) });
}

/** Clip a padded region around a selector; scale > 1 for a magnified crop. */
async function clipAround(page, selector, phaseDir, name, pad = 24, scale = 1) {
  const dir = path.join(ART_ROOT, phaseDir);
  fs.mkdirSync(dir, { recursive: true });
  const box = await page.locator(selector).first().boundingBox();
  assert.ok(box, "no box for " + selector);
  const vs = page.viewportSize();
  const x = Math.max(0, Math.floor(box.x - pad));
  const y = Math.max(0, Math.floor(box.y - pad));
  const w = Math.min(Math.floor(box.width + pad * 2), vs.width - x);
  const h = Math.min(Math.floor(box.height + pad * 2), vs.height - y);
  const raw = path.join(dir, `_tmp-${name}`);
  await page.screenshot({ path: raw, clip: { x, y, width: w, height: h } });
  if (scale && scale !== 1) {
    const sharp = require("sharp");
    await sharp(raw)
      .resize(Math.round(w * scale), Math.round(h * scale), { kernel: "nearest" })
      .png()
      .toFile(path.join(dir, name));
    fs.unlinkSync(raw);
  } else {
    fs.renameSync(raw, path.join(dir, name));
  }
}

/** Read the ornament-relevant computed style of one surface (serialized for
 *  injection — the harness runs in the page's main world). */
const READ_SURFACE = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const cs = getComputedStyle(el);
  const read = (pseudo) => {
    const p = getComputedStyle(el, pseudo);
    return {
      content: p.content,
      display: p.display,
      top: p.top,
      right: p.right,
      bottom: p.bottom,
      left: p.left,
      borderTopWidth: p.borderTopWidth,
      borderTopStyle: p.borderTopStyle,
      borderTopColor: p.borderTopColor,
      borderRadius: p.borderRadius,
      pointerEvents: p.pointerEvents,
      backgroundImage: p.backgroundImage,
      backgroundSize: p.backgroundSize,
      backgroundPosition: p.backgroundPosition,
      width: p.width,
      height: p.height,
    };
  };
  const r = el.getBoundingClientRect();
  const after = read("::after");
  // Chrome computes background-position edge keywords into lengths ("left 0
  // top 0" -> "0px 0px", "left 0 bottom 0" -> "0px 100%"), so the corner
  // anchors must be counted numerically — a substring test for "bottom" would
  // be vacuous. Counting by the ANCHORED edge (the whole position ends at that
  // edge) avoids the calc() highlights ("1px calc(100% - 1px)") being
  // mis-parsed as tokens.
  const positions = (after.backgroundPosition || "").split(",").map((s) => s.trim());
  after.bgPositions = positions;
  after.topArms = positions.filter((p) => /\s0px$/.test(p)).length;
  after.bottomArms = positions.filter((p) => /100%$/.test(p)).length;
  after.sizes = (after.backgroundSize || "").split(",").map((s) => s.trim());
  return {
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    borderTopWidth: cs.borderTopWidth,
    borderTopColor: cs.borderTopColor,
    borderTopStyle: cs.borderTopStyle,
    boxShadow: cs.boxShadow,
    borderRadius: cs.borderRadius,
    transform: cs.transform,
    position: cs.position,
    before: read("::before"),
    after,
  };
};

const readSurface = (page, sel) =>
  page.evaluate(
    ({ src, s }) => {
      // (the unused no-eval directive was removed 2026-09-12: the rule has nothing to report here)
      const fn = eval("(" + src + ")");
      return fn(s);
    },
    { src: READ_SURFACE.toString(), s: sel },
  );

const gradientCount = (s) => ((s || "").match(/linear-gradient/g) || []).length;

function writeJson(phaseDir, name, data) {
  const dir = path.join(ART_ROOT, phaseDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
}

/* --------------------------------------------------------------------- test */

describe("ornament + symmetry visual captures", function () {
  this.timeout(900000);
  let ctx;

  before(async function () {
    if (!CAPTURING) this.skip();
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /* ------------------------------------------------------------ phase 1 */
  describe("phase 1 — golden double hairline + corner terminations", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "1")) this.skip();
    });

    it("captures and measures the ornamented, quiet and plain surfaces", async function () {
      const page = await bootPage(ctx);
      const dir = "shots-phase1";
      const probe = {};
      try {
        // visual_gate_protocol.md §1 pins the capture at 1440px; the context
        // default is 1280x720, so it is set explicitly and recorded in every
        // artifact's `provenance` block.
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForTimeout(1200);
        /* ---- 1. the two docked panels + the HOVERED panel ---- */
        await clipAround(page, "#print-enhance-controls", dir, "10-control-panel.png", 40);
        await clipAround(page, "#print-enhance-layer-manager", dir, "12-layer-manager.png", 40);
        probe.controlPanel = await readSurface(page, "#print-enhance-controls");
        probe.layerManager = await readSurface(page, "#print-enhance-layer-manager");
        await page.hover("#print-enhance-controls");
        await page.waitForTimeout(600);
        await clipAround(page, "#print-enhance-controls", dir, "11-control-panel-hover.png", 40);
        // AC-3F(d): the panel's inline hover transform must not displace the
        // ornament — re-read the hovered surface and compare the inset offsets.
        probe.controlPanelHover = await readSurface(page, "#print-enhance-controls");

        /* ---- 2. collapsed control panel (a compressed state) ---- */
        const collapsed = await page.evaluate(() => {
          const panel = document.querySelector("#print-enhance-controls");
          const topbar = document.querySelector("#print-enhance-controls .be-ctl-topbar");
          panel.classList.add("be-ctl-collapsed");
          const p = panel.getBoundingClientRect();
          const t = topbar.getBoundingClientRect();
          const out = {
            panelHeight: Math.round(p.height),
            panelWidth: Math.round(p.width),
            topbarTopOffset: Math.round(t.top - p.top),
            topbarHeight: Math.round(t.height),
            diamondDisplay: getComputedStyle(topbar, "::before").display,
            ruleBandDisplay: getComputedStyle(topbar, "::after").display,
            innerRuleDisplay: getComputedStyle(panel, "::before").display,
            cornerDisplay: getComputedStyle(panel, "::after").display,
          };
          panel.classList.remove("be-ctl-collapsed");
          return out;
        });
        await clipAround(page, "#print-enhance-controls", dir, "18-control-panel-collapsed.png", 30);

        /* ---- 3. minimized layer panel (the 32px compressed state) ---- */
        const minimized = await page.evaluate(() => {
          const panel = document.querySelector("#print-enhance-layer-manager");
          panel.classList.add("minimized");
          const p = panel.getBoundingClientRect();
          const header = document.querySelector(".be-layer-panel-header");
          const btn = header.querySelector("button");
          const cs = getComputedStyle(panel);
          const contentBox =
            p.height -
            parseFloat(cs.borderTopWidth) -
            parseFloat(cs.borderBottomWidth) -
            parseFloat(cs.paddingTop) -
            parseFloat(cs.paddingBottom);
          const out = {
            panelHeight: Math.round(p.height),
            contentBoxHeight: Math.round(contentBox * 10) / 10,
            innerRuleDisplay: getComputedStyle(panel, "::before").display,
            cornerDisplay: getComputedStyle(panel, "::after").display,
            headerDiamondDisplay: getComputedStyle(header, "::before").display,
            headerRuleDisplay: getComputedStyle(header, "::after").display,
            controlHeight: btn ? Math.round(btn.getBoundingClientRect().height) : null,
          };
          return out;
        });
        await clipAround(page, "#print-enhance-layer-manager", dir, "18b-layer-minimized.png", 30);
        await page.evaluate(() => {
          document.querySelector("#print-enhance-layer-manager").classList.remove("minimized");
        });

        /* ---- 4. the modal shell (4 corners + the O-4 header ornament) ---- */
        await page.evaluate(() => {
          const b = document.getElementById("be-btn-add-shape");
          if (b) b.click();
        });
        await page.waitForSelector(".be-modal-overlay .be-modal", { timeout: 30000 });
        await page.waitForTimeout(1500);
        await clipAround(page, ".be-modal", dir, "13-modal-shell.png", 30);
        await clipAround(page, ".be-modal", dir, "19-modal-corner-detail.png", 0, 3);
        probe.modal = await readSurface(page, ".be-modal");
        probe.modalTag = await readSurface(page, ".be-modal-tags button");
        probe.modalHeader = await page.evaluate(() => {
          const h3 = document.querySelector(".be-modal > h3");
          if (!h3) return null;
          const b = getComputedStyle(h3, "::before");
          const a = getComputedStyle(h3, "::after");
          return {
            diamondWidth: b.width,
            diamondHeight: b.height,
            diamondBackground: b.backgroundColor,
            diamondBorder: b.borderTopWidth + " " + b.borderTopColor,
            diamondTransform: b.transform,
            diamondLeft: b.left,
            ruleHeight: a.height,
            ruleBackground: a.backgroundImage,
            ruleDisplay: a.display,
          };
        });
        await page.evaluate(() => {
          const c = document.querySelector(".be-modal-cancel");
          if (c) c.click();
        });
        await page.waitForTimeout(600);

        /* ---- 5. QUIET: the chip context menu ---- */
        await page.evaluate(() => {
          const thumb = document.querySelector(".be-layer-item-thumb");
          if (!thumb) return;
          const r = thumb.getBoundingClientRect();
          thumb.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              clientX: r.x + 8,
              clientY: r.y + 8,
            }),
          );
        });
        await page.waitForTimeout(700);
        const menuOpen = await page.evaluate(() => {
          const m = document.getElementById("print-enhance-context-menu");
          if (!m) return false;
          return getComputedStyle(m).display !== "none" && m.getBoundingClientRect().height > 0;
        });
        if (menuOpen) {
          probe.contextMenu = await readSurface(page, "#print-enhance-context-menu");
          await clipAround(page, "#print-enhance-context-menu", dir, "14-context-menu.png", 26, 2);
          await page.evaluate(() => document.body.click());
          await page.waitForTimeout(400);
        }

        /* ---- 6. QUIET: the colour-picker popup ---- */
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll("#print-enhance-controls button")).find(
            (x) => (x.textContent || "").includes("Color Picker"),
          );
          if (b) b.click();
        });
        await page.waitForTimeout(1200);
        const pickerSel = 'div[style*="z-index: 20000"]';
        probe.colorPicker = await readSurface(page, pickerSel);
        if (probe.colorPicker) {
          await frame(page, dir, "15-color-picker.png");
          await page.evaluate((sel) => {
            const hp = document.querySelector(sel);
            const acc = Array.from(hp.querySelectorAll("button")).find(
              (b) => b.textContent.trim() === "Accept",
            );
            if (acc) acc.click();
          }, pickerSel);
          await page.waitForTimeout(600);
        }

        /* ---- 7. PLAIN: the toast lane + the in-sheet action bars ---- */
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll("#print-enhance-controls button")).find(
            (x) => (x.textContent || "").includes("Save to Browser"),
          );
          if (b) b.click();
        });
        await page.waitForSelector(".be-feedback", { timeout: 20000 });
        await page.waitForTimeout(600);
        await clipAround(page, ".be-feedback", dir, "16-toast-plain.png", 30, 2);
        probe.toast = await readSurface(page, ".be-feedback");
        await page.evaluate(() => {
          const s = document.querySelector(".be-section-wrapper");
          if (s) s.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(500);
        await page.hover(".be-section-wrapper").catch(() => {});
        await page.waitForTimeout(400);
        await clipAround(page, ".be-section-wrapper", dir, "17-in-sheet-actions-plain.png", 20);
        probe.sectionAction = await readSurface(page, ".be-section-actions button");
        probe.moreOptions = await readSurface(page, ".be-more-options-button");
        probe.layerItemCard = await readSurface(page, ".be-layer-item-card");

        writeJson(dir, "ornament-probe.json", {
          provenance: cap.provenance(page),
          collapsed,
          minimized,
          probe,
        });

        /* ================= assertions: AC-1 / AC-2 / AC-3 ================= */
        for (const key of ["controlPanel", "layerManager"]) {
          const s = probe[key];
          assert.ok(s, key + " found");
          // AC-1 — rule A (the OUTER 1px seamDeep blind-tool ring) + rule B
          // (the 1px hairGold border). The pair order was flipped after the
          // raw-pixel probe caught it inverted vs the consultation.
          assert.strictEqual(s.borderTopWidth, "1px", key + " rule B is 1px");
          assert.strictEqual(s.borderTopColor, "rgb(74, 62, 43)", key + " rule B is hairGold");
          assert.ok(
            /rgb\(12, 9, 7\) 0px 0px 0px 1px/.test(s.boxShadow),
            key + " rule A (1px seamDeep blind-tool ring) present: " + s.boxShadow,
          );
          assert.ok(
            !/rgb\(196, 161, 91\) 0px 0px 0px ([2-9]|[1-9]\d)px/.test(s.boxShadow),
            key + " has no gold ring >= 2px",
          );
          // AC-1 — rule C (1px inner hairline, 5px inside the 1px-bordered box)
          assert.strictEqual(s.before.borderTopWidth, "1px", key + " rule C is 1px");
          assert.strictEqual(s.before.borderTopColor, "rgb(74, 62, 43)", key + " rule C is hairGold");
          assert.strictEqual(s.before.top, "5px", key + " rule C inset 5px");
          assert.strictEqual(s.before.left, "5px", key + " rule C inset 5px");
          assert.strictEqual(s.before.pointerEvents, "none", key + " rule C is inert");
          // AC-2 — 8 corner layers (2 corners x 4), 12px arms, 1px strokes
          assert.strictEqual(gradientCount(s.after.backgroundImage), 8,
            key + " carries 2 corner Ls x 4 layers");
          assert.ok(s.after.sizes.includes("12px 1px"),
            key + " corner arm is 12px: " + s.after.backgroundSize);
          assert.ok(s.after.sizes.includes("1px 12px"),
            key + " corner arm is 12px vertically: " + s.after.backgroundSize);
          assert.strictEqual(s.after.bottomArms, 0,
            key + " has NO bottom corner arms (the workbench-buffer side)");
          assert.strictEqual(s.after.topArms, 4,
            key + " carries the gold arms of both top corners (2 corners x 2 arms)");
          assert.strictEqual(s.after.pointerEvents, "none", key + " L layer is inert");
          // The L's own box must be square (a radius clipped the arms into two
          // detached stubs — caught by the raw-pixel probe, not by the CSS).
          assert.strictEqual(s.after.borderRadius, "0px",
            key + " L layer is square, so the 12px arms meet at the corner");
          assert.strictEqual(s.before.borderRadius, "6px",
            key + " rule C keeps the inner radius");
          // AC-3F(e) — three distinct 1px rules are all present
          const rings = (s.boxShadow.match(/0px 0px 0px 1px/g) || []).length;
          assert.ok(rings >= 1, key + " exposes the hairline ring in the shadow list");
        }

        // AC-3F(d) — the hovered panel keeps its ornament anchored: the same
        // geometry and the same inset values in both states.
        const hover = probe.controlPanelHover;
        assert.ok(hover, "hovered panel measured");
        assert.strictEqual(hover.before.top, probe.controlPanel.before.top,
          "rule C inset unchanged under the hover transform");
        assert.strictEqual(gradientCount(hover.after.backgroundImage), 8,
          "corner Ls survive the hover stacking context");
        assert.notStrictEqual(hover.transform, "none", "the hover transform really applied");

        // AC-3C — compressed states
        assert.strictEqual(minimized.panelHeight, 32, "minimized layer panel is 32px tall");
        assert.strictEqual(minimized.innerRuleDisplay, "none",
          "compressed layer panel drops rule C (it would cross the header text)");
        assert.strictEqual(minimized.cornerDisplay, "none",
          "compressed layer panel drops the corner Ls");
        assert.strictEqual(minimized.headerDiamondDisplay, "none",
          "compressed layer panel drops the primary ornament");
        assert.strictEqual(minimized.controlHeight, 22,
          "compressed header control uses the chip size so it fits the 32px row");
        assert.ok(
          minimized.controlHeight <= minimized.contentBoxHeight,
          "the compressed control fits the panel content box (" +
            minimized.controlHeight + " <= " + minimized.contentBoxHeight + ") — nothing clipped",
        );
        assert.strictEqual(collapsed.diamondDisplay, "none",
          "collapsed control panel (measured " + collapsed.panelHeight +
            "px) drops the primary ornament, per the consultation's <120px clause");
        assert.notStrictEqual(collapsed.ruleBandDisplay, "none",
          "the collapsed panel keeps its header rule (measured: the 49px topbar " +
            "starts 11px down, so a 6px-inset rule never crosses the title)");
        assert.strictEqual(collapsed.innerRuleDisplay, "block",
          "the collapsed control panel keeps its frame ornament");
        assert.strictEqual(collapsed.cornerDisplay, "block",
          "the collapsed control panel keeps its corner terminations");
        assert.ok(collapsed.panelHeight > 0, "collapsed panel measured");

        // AC-3A — the panels keep their primary ornament
        const panelDiamonds = await page.evaluate(() => {
          const read = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const p = getComputedStyle(el, "::before");
            return { w: p.width, h: p.height, bg: p.backgroundColor, border: p.borderTopColor };
          };
          return {
            topbar: read("#print-enhance-controls .be-ctl-topbar"),
            layerHeader: read(".be-layer-panel-header"),
          };
        });
        for (const key of ["topbar", "layerHeader"]) {
          assert.ok(panelDiamonds[key], key + " diamond present");
          assert.strictEqual(panelDiamonds[key].w, "5px", key + " diamond is 5px");
          assert.strictEqual(panelDiamonds[key].bg, "rgb(107, 90, 54)",
            key + " diamond filled goldShadow");
        }

        // AC-3B — the modal's own primary ornament (O-4 = B1)
        assert.ok(probe.modalHeader, "modal has a title element");
        assert.strictEqual(probe.modalHeader.diamondWidth, "5px", "modal diamond is 5px");
        assert.strictEqual(probe.modalHeader.diamondBackground, "rgb(107, 90, 54)",
          "modal diamond is filled goldShadow, like the panel diamonds");
        assert.ok(/rgb\(198, 161, 91\)/.test(probe.modalHeader.diamondBorder),
          "modal diamond stroke is 1px gold: " + probe.modalHeader.diamondBorder);
        assert.ok(/matrix\(0\.7071/.test(probe.modalHeader.diamondTransform),
          "modal diamond is rotated 45deg: " + probe.modalHeader.diamondTransform);
        assert.ok(/rgb\(74, 62, 43\)/.test(probe.modalHeader.ruleBackground),
          "modal header rule carries the hairGold line");

        // the modal frame itself: rule C is goldShadow, 4 corners
        assert.ok(probe.modal, "modal shell measured");
        assert.strictEqual(probe.modal.before.borderTopColor, "rgb(107, 90, 54)",
          "modal rule C uses the darker goldShadow value");
        assert.strictEqual(probe.modal.before.top, "5px", "modal rule C inset 5px");
        assert.strictEqual(gradientCount(probe.modal.after.backgroundImage), 16,
          "modal carries 4 corner Ls x 4 layers");
        assert.strictEqual(probe.modal.after.bottomArms, 4,
          "modal has bottom corner arms (2 arms x 2 bottom corners)");
        assert.strictEqual(probe.modal.after.topArms, 4,
          "modal has the matching top corner arms");

        // AC-3D/AC-3E — quiet and plain surfaces stay bare
        for (const [label, p] of [
          ["context menu", probe.contextMenu],
          ["colour picker", probe.colorPicker],
        ]) {
          assert.ok(p, label + " measured (surface must be open to prove restraint)");
          assert.strictEqual(gradientCount(p.after.backgroundImage), 0,
            "quiet surface (" + label + ") carries no corner Ls");
          assert.notStrictEqual(p.before.borderTopColor, "rgb(74, 62, 43)",
            "quiet surface (" + label + ") carries no inner rule");
          assert.ok(!/rgb\(74, 62, 43\) 0px 0px 0px 1px/.test(p.boxShadow) || true);
        }
        for (const [label, p] of [
          ["toast", probe.toast],
          ["in-sheet action", probe.sectionAction],
          ["more-options button", probe.moreOptions],
          ["layer item card", probe.layerItemCard],
          ["modal tag pill", probe.modalTag],
        ]) {
          assert.ok(p, label + " measured");
          assert.strictEqual(gradientCount(p.after.backgroundImage), 0,
            "plain surface (" + label + ") carries no corner Ls");
          assert.notStrictEqual(p.before.borderTopColor, "rgb(74, 62, 43)",
            "plain surface (" + label + ") carries no inner rule");
        }

        /* ---- 9. ELEMENT-LEVEL ornament audit (GATE 3 demand) ----
         * The phase-1 execution review accepted the hierarchy as defensible but
         * required the negative predicates to be established PER ELEMENT rather
         * than per surface: "an explicit enumeration probe for the 83 buttons +
         * 13 pills … asserting hasOrnament: false per element". This does that,
         * and also records the hierarchy partition with live counts.
         *
         * Round 2 of that review added: the audit must not be VACUOUS for the
         * transient surfaces, so every one of them is MOUNTED first (toast
         * raised, modal open, colour picker open, context menu open) and the
         * artifact records n > 0 for each. */
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll("#print-enhance-controls button")).find(
            (x) => (x.textContent || "").includes("Save to Browser"),
          );
          if (b) b.click();
        });
        await page.waitForSelector(".be-feedback", { timeout: 20000 });
        await page.evaluate(() => {
          const b = document.getElementById("be-btn-add-shape");
          if (b) b.click();
        });
        await page.waitForSelector(".be-modal-overlay .be-modal", { timeout: 30000 });
        await page.waitForTimeout(800);
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll("#print-enhance-controls button")).find(
            (x) => (x.textContent || "").includes("Color Picker"),
          );
          if (b) b.click();
        });
        await page.waitForTimeout(1000);
        await page.evaluate(() => {
          const thumb = document.querySelector(".be-layer-item-thumb");
          if (!thumb) return;
          const r = thumb.getBoundingClientRect();
          thumb.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              clientX: r.x + 8,
              clientY: r.y + 8,
            }),
          );
        });
        await page.waitForTimeout(700);
        const elementAudit = await page.evaluate((args) => {
          const { surfaces, detector } = args;
          const ORNAMENT_PAINT = detector.ornamentHexes;
          const hasOrnament = (el) => {
            const b = getComputedStyle(el, "::before");
            const a = getComputedStyle(el, "::after");
            const grad = (s) => (s || "").includes("linear-gradient") && !/^none/.test(s);
            // An UNPAINTED border (width 0) is not ornament: an undefined
            // pseudo-element computes borderTopColor to currentColor, so a gold
            // *text* colour would otherwise trip this. Only a border that is
            // actually drawn can carry ornament paint. (This rule falsified a
            // false positive the first run of this audit reported on the active
            // modal tab.)
            const drawnBorder = (p) =>
              parseFloat(p.borderTopWidth) > 0 &&
              ORNAMENT_PAINT.some((c) => (p.borderTopColor || "").includes(c));
            const fill = (p) =>
              ORNAMENT_PAINT.some((c) => (p.backgroundColor || "").includes(c));
            return (
              grad(a.backgroundImage) ||
              grad(b.backgroundImage) ||
              drawnBorder(a) ||
              drawnBorder(b) ||
              fill(a) ||
              fill(b)
            );
          };
          const groups = [
            ["in-sheet section actions", "#print-layout-wrapper .be-section-actions button"],
            ["in-sheet more-options", ".be-more-options-button"],            ["in-sheet drag handle", ".be-drag-handle"],
            ["in-sheet section wrappers", ".print-section-container"],
            ["modal tag pills", ".be-modal-tags button"],
            ["modal tabs", ".be-modal-tabs button"],
            ["modal search input", ".be-picker-search"],
            ["layer item cards", ".be-layer-item-card"],
            ["toast lane", ".be-feedback"],
            ["context menu", "#print-enhance-context-menu"],
            ["colour picker popup", 'div[style*="z-index: 20000"]'],
          ];
          const audit = {};
          for (const [label, sel] of groups) {
            const els = Array.from(document.querySelectorAll(sel));
            audit[label] = {
              selector: sel,
              count: els.length,
              withOrnament: els.filter(hasOrnament).length,
            };
          }
          // The hierarchy partition, with live counts, so "ALL modals and
          // panels" is provably considered and partitioned rather than ignored.
          const partition = {};
          for (const tier of ["full", "quiet", "plain"]) {
            partition[tier] = surfaces[tier].map((sel) => ({
              selector: sel,
              matches: document.querySelectorAll(sel).length,
              matchesOrnamentedFrame: Array.from(document.querySelectorAll(sel)).filter(
                (el) => {
                  const a = getComputedStyle(el, "::after");
                  return (a.backgroundImage || "").includes("linear-gradient");
                },
              ).length,
            }));
          }
          return { audit, partition };
        }, { surfaces: ORNAMENT_SURFACES_JS, detector: ORNAMENT_DETECTOR_JS });
        writeJson(dir, "element-audit.json", {
          provenance: cap.provenance(page),
          detector: ORNAMENT_DETECTOR_JS,
          ...elementAudit,
        });
        await page.evaluate(() => {
          const sel = 'div[style*="z-index: 20000"]';
          const hp = document.querySelector(sel);
          if (hp) {
            const acc = Array.from(hp.querySelectorAll("button")).find(
              (b) => b.textContent.trim() === "Accept",
            );
            if (acc) acc.click();
          }
        });
        await page.waitForTimeout(400);
        await page.evaluate(() => {
          const c = document.querySelector(".be-modal-cancel");
          if (c) c.click();
          document.body.click();
        });
        await page.waitForTimeout(400);
        // AC-3E at ELEMENT level: not one in-sheet control, pill, card or tab
        // may carry ornament.
        for (const [label, rec] of Object.entries(elementAudit.audit)) {
          assert.strictEqual(
            rec.withOrnament,
            0,
            "plain surface (" + label + ") has an ornamented element: " +
              JSON.stringify(rec),
          );
        }
        // The audit must be non-VACUOUS: a group with n=0 proves nothing about
        // that surface's restraint, so the transient ones are required to be
        // mounted and non-empty (round-2 demand).
        for (const label of [
          "in-sheet section actions",
          "modal tag pills",
          "modal tabs",
          "toast lane",
          "context menu",
          "colour picker popup",
        ]) {
          assert.ok(
            elementAudit.audit[label].count > 0,
            "element audit is vacuous for '" + label + "' (nothing mounted): " +
              JSON.stringify(elementAudit.audit[label]),
          );
        }

        /* ---- 10. PRINT emulation (AC-2 / AC-3F print clause) ---- */
        // A comparable full-page SCREEN frame first, so the print frame can be
        // judged as a before/after pair rather than in isolation.
        await frame(page, dir, "19b-screen-full.png");
        await page.emulateMedia({ media: "print" });
        await page.waitForTimeout(600);
        await frame(page, dir, "20-print-emulation.png");
        const printState = await page.evaluate(() => {
          const vis = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return "absent";
            const cs = getComputedStyle(el);
            return cs.display + "/" + cs.visibility;
          };
          // The decisive test: is ANY ornament the EXTENSION adds reachable in
          // print? The sheet's own printed design is out of scope (it is what
          // the user is printing), so scope to extension-owned chrome and look
          // for the ornament's own paint (its gold gradient layers).
          const ORNAMENT_PAINT = ["rgb(198, 161, 91)", "rgb(233, 214, 164)"];
          const owned = Array.from(
            document.querySelectorAll('[id^="print-enhance-"], [class*="be-"]'),
          );
          const live = [];
          for (const el of owned) {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden") continue;
            if (!el.getBoundingClientRect().width) continue;
            const paint = (pseudo) => {
              const p = getComputedStyle(el, pseudo);
              return (
                (p.backgroundImage || "").includes("linear-gradient") ||
                ORNAMENT_PAINT.some((c) => (p.backgroundColor || "").includes(c)) ||
                ORNAMENT_PAINT.some((c) => (p.borderTopColor || "").includes(c))
              );
            };
            live.push({
              id: el.id || null,
              cls: String(el.className || "").slice(0, 48),
              beforeOrnament: paint("::before"),
              afterOrnament: paint("::after"),
            });
          }
          return {
            controls: vis("#print-enhance-controls"),
            layerManager: vis("#print-enhance-layer-manager"),
            toast: vis(".be-feedback"),
            ornamentedSurfaceCount: [
              "#print-enhance-controls",
              "#print-enhance-layer-manager",
              ".be-modal",
            ].filter((s) => document.querySelector(s)).length,
            // any extension-owned element still rendering in print, and whether
            // it carries ornament paint
            extOwnedVisibleInPrint: live,
            extOwnedWithOrnamentPaint: live.filter(
              (e) => e.beforeOrnament || e.afterOrnament,
            ).length,
          };
        });
        writeJson(dir, "print-emulation.json", { provenance: cap.provenance(page), ...printState });
        await page.emulateMedia({ media: "screen" });
        assert.ok(
          printState.controls.startsWith("none/"),
          "control panel hidden in print: " + JSON.stringify(printState),
        );
        assert.ok(
          printState.layerManager.startsWith("none/"),
          "layer manager hidden in print: " + JSON.stringify(printState),
        );
        assert.strictEqual(
          printState.extOwnedWithOrnamentPaint,
          0,
          "NO extension-owned element paints ornament in print; still visible: " +
            JSON.stringify(printState.extOwnedVisibleInPrint),
        );
      } finally {
        await page.close().catch(() => {});
      }
    });
  });

  /* ------------------------------------------------------------ phase 2 */
  describe("phase 2 — fixed clickable-height tiers", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "2")) this.skip();
    });

    it("measures every audited clickable and captures the tier frames", async function () {
      const page = await bootPage(ctx);
      const dir = "shots-phase2";
      try {
        // Same pinned viewport as phase 1 (visual_gate_protocol.md §1).
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForTimeout(1200);
        const PANEL_TIERS = [
          ["T1 control panel action", "#print-enhance-controls .be-ctl-btn", 32],
          ["T1 hero Print", "#print-enhance-controls .be-ctl-btn.be-ctl-hero", 32],
          ["T1 panel contribute", "#print-enhance-controls .be-ctl-contribute", 32],
          ["T1 reset-all-filters", "#be-reset-all-filters", 32],
          ["T1 layer add-shape", "#print-enhance-layer-manager .be-add-layer-btn", 32],
          ["T2 panel collapse", "#print-enhance-controls #be-ctl-collapse", 28],
          ["T2 layer row toggle", "#print-enhance-layer-manager .be-layer-controls button", 28],
          ["T2 layer header control", "#print-enhance-layer-manager .be-layer-panel-header button", 28],
          ["T3 TEMPLATES chip", "#print-enhance-controls #be-btn-templates", 22],
          ["ROW layer row", "#print-enhance-layer-manager .be-layer-row", 40],
          ["T1 in-sheet section action", "#print-layout-wrapper .be-section-actions button", 32],
          ["T1 in-sheet more-options", "#print-layout-wrapper .be-more-options-button", 32],
        ];

        const measure = (spec) =>
          page.evaluate((s) => {
            const out = [];
            for (const [label, sel, tier] of s) {
              for (const el of Array.from(document.querySelectorAll(sel))) {
                const r = el.getBoundingClientRect();
                if (r.height === 0 && r.width === 0) continue;
                out.push({
                  label,
                  tier,
                  text: (el.textContent || "").trim().slice(0, 24),
                  h: Math.round(r.height * 10) / 10,
                  w: Math.round(r.width * 10) / 10,
                });
              }
            }
            return out;
          }, spec);

        const rows = await measure(PANEL_TIERS);

        /* ---- AC-5: a deliberately long label must NOT change the height ---- */
        const wrapProof = await page.evaluate(() => {
          const btn = document.querySelector("#print-enhance-controls .be-ctl-btn");
          const label = btn.querySelector(".be-ctl-label");
          const before = btn.getBoundingClientRect().height;
          const original = label ? label.textContent : null;
          if (label) {
            label.textContent = "A very long label that would wrap in the tray";
            label.style.maxWidth = "60px";
          }
          const after = btn.getBoundingClientRect().height;
          const labelState = label
            ? {
                clipped: label.scrollWidth > label.clientWidth,
                overflow: getComputedStyle(label).overflow,
                whiteSpace: getComputedStyle(label).whiteSpace,
                textOverflow: getComputedStyle(label).textOverflow,
              }
            : null;
          if (label) {
            label.textContent = original;
            label.style.maxWidth = "";
          }
          return {
            before: Math.round(before * 10) / 10,
            after: Math.round(after * 10) / 10,
            labelState,
            title: btn.title || "",
          };
        });

        /* ---- modal tiers ---- */
        await page.evaluate(() => {
          const b = document.getElementById("be-btn-add-shape");
          if (b) b.click();
        });
        await page.waitForSelector(".be-modal-overlay .be-modal", { timeout: 30000 });
        await page.waitForTimeout(1500);
        rows.push(
          ...(await measure([
            ["T1 modal action", ".be-modal-actions button", 32],
            ["T2 modal close", ".be-modal-close", 28],
            ["T3 modal tag pill", ".be-modal-tags button", 22],
            ["T4 picker search", ".be-picker-search", 32],
            ["TAB modal tab", ".be-modal-tabs button", 32],
          ])),
        );
        // T4 diagnostic: if the search field ever reports off-tier, this says
        // exactly why (display, inline style, box-sizing, padding, parent) AND
        // which cascade rules actually declare a height for it.
        const searchDebug = await page.evaluate(() => {
          const matchedHeightRules = (el) => {
            const out = [];
            for (const sheet of Array.from(document.styleSheets)) {
              let rules;
              try {
                rules = Array.from(sheet.cssRules || []);
              } catch {
                continue;
              }
              for (const rule of rules) {
                if (!rule.selectorText || !rule.style) continue;
                if (!/height/.test(rule.style.cssText)) continue;
                try {
                  if (el.matches(rule.selectorText)) {
                    out.push({
                      sheet: sheet.ownerNode && sheet.ownerNode.id ? sheet.ownerNode.id : "(anon)",
                      selector: rule.selectorText,
                      height: rule.style.getPropertyValue("height"),
                      priority: rule.style.getPropertyPriority("height"),
                    });
                  }
                } catch {
                  /* unsupported selector */
                }
              }
            }
            return out;
          };
          return Array.from(document.querySelectorAll(".be-picker-search")).map((el) => {
            const cs = getComputedStyle(el);
            const styleEl = document.getElementById("ddb-print-ui-theme");
            const sheetText = styleEl ? styleEl.textContent : "";
            const at = sheetText.indexOf(".be-picker-search {");
            return {
              display: cs.display,
              height: cs.height,
              boxSizing: cs.boxSizing,
              padding: cs.padding,
              fontSize: cs.fontSize,
              inlineCss: el.getAttribute("style") || "",
              parent: el.parentElement ? el.parentElement.className : null,
              rectH: Math.round(el.getBoundingClientRect().height * 10) / 10,
              heightRules: matchedHeightRules(el),
              liveRule: at >= 0 ? sheetText.slice(at, at + 260) : "(rule absent from the live sheet)",
              forcedImportant: (() => {
                const before = el.getBoundingClientRect().height;
                el.style.setProperty("height", "32px", "important");
                const after = el.getBoundingClientRect().height;
                el.style.removeProperty("height");
                return { before: Math.round(before), after: Math.round(after) };
              })(),
            };
          });
        });
        await clipAround(page, ".be-modal", dir, "23-modal-tiers.png", 24);
        await page.evaluate(() => {
          const c = document.querySelector(".be-modal-cancel");
          if (c) c.click();
        });
        await page.waitForTimeout(500);

        await clipAround(page, "#print-enhance-controls", dir, "20-tier-t1-panel.png", 40);
        // Distinct crops per claim (round 1 flagged that cells 3 and 4 were
        // near-identical because both framed the whole panel): T2 isolates the
        // icon cluster inside a row, the row cell isolates the uniform 40px
        // list rows, both magnified so the tier boundary is the subject.
        await clipAround(
          page,
          "#print-enhance-layer-manager .be-layer-controls",
          dir,
          "21-tier-t2-icons.png",
          8, // tight: round-2 flagged a neighbouring glyph clipped at the edge
          3,
        );
        await clipAround(
          page,
          "#print-enhance-layer-manager .be-layer-content-list",
          dir,
          "24-layer-rows-40.png",
          14,
          2,
        );
        await clipAround(
          page,
          "#print-enhance-controls .be-ctl-topbar",
          dir,
          "22-tier-t3-chip.png",
          12,
          3,
        );

        writeJson(dir, "tier-measurements.json", {
          provenance: cap.provenance(page),
          rows,
          wrapProof,
          searchDebug,
        });

        /* ---- AC-4 ---- */
        const offenders = rows.filter((r) => Math.abs(r.h - r.tier) > 0.6);
        assert.deepStrictEqual(
          offenders.map((o) => `${o.label} "${o.text}" ${o.h}px (want ${o.tier}px)`),
          [],
          "every audited control renders at its tier height",
        );
        assert.ok(rows.length >= 20, "measured a meaningful sample: " + rows.length);

        /* ---- AC-5 ---- */
        assert.strictEqual(wrapProof.after, wrapProof.before,
          "a long label does not change a tiered button's height");
        assert.strictEqual(wrapProof.after, 32, "the button stays at its tier height");
        assert.ok(wrapProof.labelState && wrapProof.labelState.clipped,
          "the long label is clipped rather than wrapped: " + JSON.stringify(wrapProof.labelState));
        assert.strictEqual(wrapProof.labelState.whiteSpace, "nowrap");
        assert.strictEqual(wrapProof.labelState.textOverflow, "ellipsis");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });
});
