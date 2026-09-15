/**
 * Custom Upload & Templates Catalog UX visual-gate capture harness
 * (track custom_upload_templates_ux_20260909).
 *
 * Boots the unpacked MV3 extension on the demo sheet at 1440px and saves
 * named frames under vendor/docs/custom-upload-templates-ux-20260909/shots-phaseN/
 * for the per-phase visual gates (spec.md AC-V1 / visual_gate_protocol.md).
 *
 * Gating (graceful-skip — a normal e2e run never captures and never fails):
 *   CUSTOM_TEMPLATES_SHOTS=1   enable capturing (otherwise every test skips)
 *   CUSTOM_TEMPLATES_PHASE=N   only run the describe block for phase N
 *   CUSTOM_TEMPLATES_SHOTS_DIR=...  override the artifact root
 *
 * Interactions reuse the authoritative e2e selectors (custom_shapes_upload /
 * premade_templates spec files).
 *
 * Run:
 *   CUSTOM_TEMPLATES_SHOTS=1 CUSTOM_TEMPLATES_PHASE=0 npx mocha test/browser_e2e/custom_templates_visual_capture.spec.js --timeout 900000
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");
const { captureHarness } = require("./_capture.js");

/**
 * The capture harness (track refactor_surface_20260911, Phase 6, AC-6): the enable flag, the
 * artifact root, the shots subdirectory, the pinned viewport and `cap.provenance()` come from
 * test/browser_e2e/_capture.js instead of being re-declared in this file. The names below are
 * destructured from it, so every artifact name and assertion in this spec is unchanged.
 */
const cap = captureHarness({
  flag: 'CUSTOM_TEMPLATES_SHOTS',
  dirVar: 'CUSTOM_TEMPLATES_SHOTS_DIR',
  defaultDir: 'vendor/docs/custom-upload-templates-ux-20260909',
  phaseVar: 'CUSTOM_TEMPLATES_PHASE',
  defaultPhase: "",
});
const ART_ROOT = cap.artRoot;
const CAPTURING = cap.enabled;
const PHASE = cap.phase;

async function frame(page, phaseDir, name) {
  const dir = path.join(ART_ROOT, phaseDir);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, name);
  await page.screenshot({ path: out });
  return out;
}

/** Open the Add-Shape picker and switch to the Custom tab. */
async function openCustomTab(page) {
  await domClick(page, "#be-btn-add-shape");
  await page.waitForSelector(".be-modal-overlay", { timeout: 20000 });
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll(".be-modal-tab")).find(
      (x) => x.textContent.trim() === "Custom",
    );
    if (t) t.click();
  });
  await page.waitForTimeout(400);
}

/** Open the Templates catalog via the top-bar TEMPLATES button. */
async function openTemplates(page) {
  await domClick(page, "#be-btn-templates");
  await page.waitForTimeout(600);
}

describe("Custom upload + templates visual captures", function () {
  this.timeout(900000);
  let ctx;

  before(async function () {
    if (!CAPTURING) this.skip();
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /* ---------------------- phase 0 — BEFORE state --------------------- */
  describe("phase 0 baseline (current behaviors)", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "0")) this.skip();
    });

    it("captures the Custom tab upload affordance (pre-fix)", async function () {
      const page = await bootPage(ctx);
      try {
        await openCustomTab(page);
        await frame(page, "shots-before", "00-custom-tab-upload.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures the current stacked Templates catalog (grid) + detail double-overlay", async function () {
      const page = await bootPage(ctx);
      try {
        await openTemplates(page);
        await page.waitForSelector(".be-catalog-item, .be-catalog-grid img, .be-modal img", { timeout: 20000 });
        await page.waitForTimeout(600);
        await frame(page, "shots-before", "01-templates-catalog-grid.png");
        // open the first template detail (second stacked overlay)
        await page.evaluate(() => {
          const card =
            document.querySelector(".be-catalog-item") ||
            Array.from(document.querySelectorAll(".be-modal-overlay img")).find((i) => i.src && i.src.includes("thumbnails"));
          if (card) card.click();
        });
        await page.waitForTimeout(600);
        const nOverlays = await page.evaluate(() => document.querySelectorAll(".be-modal-overlay").length);
        assert.ok(nOverlays >= 2, "legacy detail stacks a second overlay");
        await frame(page, "shots-before", "02-templates-detail-stacked.png");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });

  /* ---------------------- phase 1 — upload flow ----------------------- */
  describe("phase 1 upload keeps the modal open", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "1")) this.skip();
    });

    it("captures the custom tab after a real upload (grid refreshed, new shape selected, OK enabled)", async function () {
      const page = await bootPage(ctx);
      try {
        await openCustomTab(page);
        // Stub only the heavy processing + persistence so the pipeline runs
        // deterministically in the capture page (real DOM/flow otherwise).
        await page.evaluate(() => {
          const b64 =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
          window.ImageProcessor = {
            processImage: async () => {
              window.__uploadedForCapture = b64;
              return b64;
            },
          };
          if (window.__DDBStorage) {
            window.__DDBStorage.saveCustomShape = async () => {};
            window.__DDBStorage.loadLayout = async () => null;
          }
        });
        // Drive the real Upload button → real filechooser → tiny PNG file.
        const chooserP = page.waitForEvent("filechooser", { timeout: 20000 });
        await domClick(page, ".be-modal-button");
        const chooser = await chooserP;
        const png = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64",
        );
        await chooser.setFiles({ name: "capture-upload.png", mimeType: "image/png", buffer: png });
        await page.waitForTimeout(900);
        const state = await page.evaluate(() => {
          const overlay = document.querySelector(".be-modal-overlay");
          const ok = overlay && overlay.querySelector(".be-modal-ok");
          const sel = overlay && overlay.querySelector(".be-border-option.selected");
          return {
            overlayOpen: !!overlay,
            okDisabled: ok ? ok.disabled : null,
            selected: sel ? (sel.title || sel.textContent || "").trim().slice(0, 30) : null,
            selectedAria: sel ? sel.getAttribute("aria-selected") : null,
          };
        });
        assert.strictEqual(state.overlayOpen, true, "modal stays open after upload");
        assert.strictEqual(state.okDisabled, false, "OK enabled after upload preselected");
        assert.ok(state.selected, "an uploaded cell is selected");
        await frame(page, "shots-phase1", "10-upload-modal-open-preselected.png");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });

  /* ---------------------- phase 2 — templates shell ------------------- */
  describe("phase 2 templates shell", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "2")) this.skip();
    });

    it("captures the upgraded templates grid (single overlay, cards)", async function () {
      const page = await bootPage(ctx);
      try {
        await openTemplates(page);
        await page.waitForTimeout(700);
        const n = await page.evaluate(() => document.querySelectorAll(".be-modal-overlay").length);
        assert.strictEqual(n, 1, "single overlay");
        await frame(page, "shots-phase2", "20-templates-grid.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures the in-modal detail view (no stacked overlay) + apply confirm", async function () {
      const page = await bootPage(ctx);
      try {
        await openTemplates(page);
        await page.waitForTimeout(600);
        // Open the first template's detail via keyboard (Enter on the card).
        await page.evaluate(() => {
          const card = document.querySelector(".be-catalog-card, [role=button][data-template], .be-catalog-item");
          if (card) card.focus();
        });
        await page.keyboard.press("Enter");
        await page.waitForTimeout(600);
        const n = await page.evaluate(() => document.querySelectorAll(".be-modal-overlay").length);
        assert.strictEqual(n, 1, "detail stays in the same overlay");
        await frame(page, "shots-phase2", "21-template-detail.png");
        // Apply → in-modal confirm
        const applied = await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll(".be-modal button")).find(
            (x) => /apply/i.test(x.textContent || ""),
          );
          if (b) b.click();
          return !!b;
        });
        assert.ok(applied, "apply button found");
        await page.waitForTimeout(400);
        const confirmShown = await page.evaluate(() =>
          Array.from(document.querySelectorAll(".be-modal, .be-modal *")).some(
            (el) => el.children.length === 0 && /apply this template|replace|existing shapes/i.test(el.textContent || ""),
          ),
        );
        assert.ok(confirmShown, "in-modal confirm copy visible");
        await frame(page, "shots-phase2", "22-apply-confirm.png");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });

  /* ---------------------- phase 3 — thumbnails ------------------------- */
  describe("phase 3 thumbnails", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "3")) this.skip();
    });

    it("captures the Basic template card with its real thumbnail + a placeholder card", async function () {
      const page = await bootPage(ctx);
      try {
        await openTemplates(page);
        await page.waitForTimeout(700);
        const info = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll(".be-modal img"));
          const bySrc = (part) => imgs.filter((i) => (i.src || "").includes(part)).length;
          return {
            basic: bySrc("basic"),
            archer: bySrc("archer"),
            placeholder: Array.from(document.querySelectorAll(".be-modal img")).filter(
              (i) => (i.src || "").includes("data:image") && (i.alt || "") !== "",
            ).length,
          };
        });
        assert.ok(info.basic >= 1, "basic thumbnail img present");
        await frame(page, "shots-phase3", "30-basic-thumb-real.png");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });
});

module.exports = { ART_ROOT, CAPTURING, PHASE, frame };
