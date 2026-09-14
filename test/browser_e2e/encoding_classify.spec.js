/**
 * Phase 1 classification probe (track ux_gaps_20260911, AC-1a).
 *
 * Answers ONE question with pixels: for each user-visible glyph site, does the
 * character that reaches the DOM match the character the source intends?
 *
 * It is a probe, not a gate: it prints a table and never fails on a finding.
 * Enable with ENCODING_SHOTS=1 (the house pattern for capture harnesses).
 *
 *   ENCODING_SHOTS=1 npx mocha test/browser_e2e/encoding_classify.spec.js --timeout 900000
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage} = require("./_helpers.js");

const ENABLED = process.env.ENCODING_SHOTS === "1";
const ART_ROOT = process.env.ENCODING_SHOTS_DIR || "docs/ux-gaps-20260911";
const SHOTS = path.join(ART_ROOT, "shots-phase1");

/** The sites to classify: glyph -> where the product renders it. */

describe("encoding classification — what actually reaches the DOM (AC-1a)", function () {
  this.timeout(900000);
  let ctx, page;

  before(async function () {
    if (!ENABLED) this.skip();
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
  });

  after(async function () {
    if (ctx) await ctx.close();
  });

  it("reads the rendered text of every glyph site and classifies it", async function () {
    fs.mkdirSync(SHOTS, { recursive: true });

    // Open the surfaces the sites live on, then read what is actually in the DOM.
    // No product seams: every read is off the live document. The panel's id is
    // `print-enhance-controls` (js/controls.js:29) — NOT `...-container`.
    const report = await page.evaluate(() => {
      const out = { panelExists: false, panelLabels: [], titleAttrs: [], html: "" };
      const panel = document.getElementById("print-enhance-controls");
      out.panelExists = !!panel;
      if (panel) {
        out.html = panel.innerHTML.slice(0, 4000);
        panel.querySelectorAll("label, span, button, div").forEach((el) => {
          // leaf text only: an ancestor repeats its children's text
          const own = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent.trim())
            .join(" ")
            .trim();
          if (own) out.panelLabels.push(own);
        });
        panel.querySelectorAll("[title]").forEach((el) => out.titleAttrs.push(el.getAttribute("title")));
      }
      return out;
    });

    console.log("\n== panel present:", report.panelExists, "==");
    console.log("== CONTROL PANEL: rendered label text ==");
    for (const t of [...new Set(report.panelLabels)]) {
      const nonAscii = [...t].filter((c) => c.codePointAt(0) > 127);
      const cps = nonAscii.map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase()).join(" ");
      console.log(`   ${JSON.stringify(t)}${cps ? "   [" + cps + "]" : ""}`);
    }

    console.log("\n== TITLE ATTRIBUTES ==");
    for (const t of [...new Set(report.titleAttrs)].slice(0, 30)) {
      const nonAscii = [...t].filter((c) => c.codePointAt(0) > 127);
      const cps = nonAscii.map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase()).join(" ");
      console.log(`   ${JSON.stringify(t)}${cps ? "   [" + cps + "]" : ""}`);
    }

    await page.screenshot({ path: path.join(SHOTS, "01-panel-before.png") });
    console.log("\nframe:", path.join("shots-phase1", "01-panel-before.png"));

    // Now the decisive read: does the emoji the source intends appear as ONE codepoint
    // (correct decode) or as the 3-4 latin-1 chars its UTF-8 bytes spell (mojibake)?
    const verdicts = [];
    for (const cp of ["\u{1F3A8}", "\u{1F313}", "\u{1F308}", "\u{1F4DC}", "\u{1F311}", "\u00B0", "\u2026"]) {
      const mojibake = Buffer.from(cp, "utf8").toString("latin1");
      const foundIntended = report.panelLabels.some((t) => t.includes(cp)) ||
                            report.titleAttrs.some((t) => t && t.includes(cp));
      const foundMojibake = report.panelLabels.some((t) => t.includes(mojibake)) ||
                            report.titleAttrs.some((t) => t && t.includes(mojibake));
      verdicts.push({ cp, mojibake, foundIntended, foundMojibake });
    }

    console.log("\n== VERDICT per glyph ==");
    console.log("   glyph  intended  mojibake  verdict");
    for (const v of verdicts) {
      const verdict = v.foundIntended && !v.foundMojibake ? "RENDERS CORRECTLY"
        : v.foundMojibake ? "MOJIBAKE (renders WRONG)"
        : "not visible on this surface";
      console.log(`   ${v.cp}      ${String(v.foundIntended).padEnd(9)} ${String(v.foundMojibake).padEnd(9)} ${verdict}`);
      console.log(`        (mojibake spelling would be ${JSON.stringify(v.mojibake)})`);
    }

    fs.writeFileSync(path.join(SHOTS, "classification-raw.json"), JSON.stringify({ report, verdicts }, null, 2));
    assert.ok(true, "probe complete");
  });

  it("classifies the OFF-PANEL surfaces: the restore list, a modal close, the layer menu", async function () {
    // Click a control-panel button by (sub)string — the same shape the feedback
    // capture spec uses (test/browser_e2e/feedback_visual_capture.spec.js:222).
    const clickControl = async (needle) => page.evaluate((n) => {
      const b = Array.from(document.querySelectorAll("#print-enhance-controls button"))
        .find((x) => (x.textContent || "").includes(n));
      if (!b) return false;
      b.click();
      return true;
    }, needle);

    const read = () => page.evaluate(() => {
      const grab = (sel) => Array.from(document.querySelectorAll(sel))
        .map((el) => (el.textContent || "").trim())
// deliberate: the control characters ARE the measurement (a byte-level
// encoding probe), not an accident this rule exists to catch.
// eslint-disable-next-line no-control-regex
        .filter((t) => t && /[^\x00-\x7F]/.test(t));
      return {
        surfaces: document.querySelectorAll(".be-modal-overlay, .be-feedback").length,
        nonAsciiText: [...new Set([...grab(".be-modal-overlay *"), ...grab(".be-restore-status"),
                                   ...grab(".be-feedback-msg"), ...grab(".be-restore-row *")])],
        titles: [...new Set(Array.from(document.querySelectorAll(".be-modal-overlay [title], .be-modal-overlay [aria-label]"))
                  .map((el) => el.getAttribute("title") || el.getAttribute("aria-label"))
// deliberate: the control characters ARE the measurement (a byte-level
// encoding probe), not an accident this rule exists to catch.
// eslint-disable-next-line no-control-regex
                  .filter((t) => t && /[^\x00-\x7F]/.test(t)))],
        // the close control's rendered text, whatever it is
        closeText: Array.from(document.querySelectorAll(".be-modal-overlay button"))
          .map((b) => (b.textContent || "").trim())
          .filter((t) => t && t.length <= 4),
      };
    });

    console.log("\n== OFF-PANEL SURFACES ==");

    // 1. the restore surface (carries the U+2026 sites)
    const opened = await clickControl("Restore backup");
    await page.waitForTimeout(1200);
    const restore = await read();
    console.log("-- restore surface (opened:", opened, ") --");
    console.log("   non-ASCII text:", JSON.stringify(restore.nonAsciiText));
    console.log("   close-ish controls:", JSON.stringify(restore.closeText));
    await page.screenshot({ path: path.join(SHOTS, "02-restore-surface.png") });

    // 2. a modal that has a close control (Manage Clones)
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(600);
    const opened2 = await clickControl("Manage Clones");
    await page.waitForTimeout(1200);
    const modal = await read();
    console.log("-- Manage Clones modal (opened:", opened2, ") --");
    console.log("   non-ASCII text:", JSON.stringify(modal.nonAsciiText));
    console.log("   short controls (the close glyph):", JSON.stringify(modal.closeText));
    await page.screenshot({ path: path.join(SHOTS, "03-modal-close.png") });

    fs.writeFileSync(path.join(SHOTS, "offpanel-raw.json"),
      JSON.stringify({ restore, modal }, null, 2));

    // The decisive comparisons, printed as raw codepoints so a shell/console
    // re-encoding cannot be mistaken for a render failure.
    console.log("\n== CODEPOINT CHECK (what the DOM actually holds) ==");
    const joined = JSON.stringify([...restore.nonAsciiText, ...restore.closeText,
                                   ...modal.nonAsciiText, ...modal.closeText]);
    for (const [label, cp] of [["ellipsis", "\u2026"], ["close X", "\u2715"], ["em dash", "\u2014"],
                               ["warning", "\u26A0"], ["check", "\u2713"]]) {
      const intended = joined.includes(cp);
      const moji = joined.includes(Buffer.from(cp, "utf8").toString("latin1"));
      console.log(`   ${label.padEnd(9)} U+${cp.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`
        + `  intended=${intended}  mojibake=${moji}`);
    }
    assert.ok(true, "off-panel probe complete");
  });

  it("measures U+2026 itself (the exact character the original claim was about) and the CSS glyph", async function () {
    const clickControl = async (needle) => page.evaluate((n) => {
      const b = Array.from(document.querySelectorAll("#print-enhance-controls button"))
        .find((x) => (x.textContent || "").includes(n));
      if (!b) return false;
      b.click();
      return true;
    }, needle);

    console.log("\n== U+2026 AND THE REMAINING VECTORS ==");

    // --- the shape/section picker's search placeholder: `Search borders, shapes, corners…`
    //     (js/shape_picker.js:262) — a live U+2026 site.
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500);
    const openedShape = await clickControl("Add Shape");
    await page.waitForTimeout(1500);
    const picker = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input[placeholder], textarea[placeholder]"));
      const tabs = Array.from(document.querySelectorAll(".be-modal-overlay *"))
// deliberate: the control characters ARE the measurement (a byte-level
// encoding probe), not an accident this rule exists to catch.
// eslint-disable-next-line no-control-regex
        .map((el) => (el.textContent || "").trim()).filter((t) => /[^\x00-\x7F]/.test(t));
      return {
        placeholders: inputs.map((i) => i.getAttribute("placeholder")),
        overlayText: [...new Set(tabs)],
      };
    });
    console.log("-- Add Shape picker (opened:", openedShape, ") --");
    console.log("   placeholders:", JSON.stringify(picker.placeholders));
    console.log("   non-ASCII overlay text:", JSON.stringify(picker.overlayText).slice(0, 400));
    await page.screenshot({ path: path.join(SHOTS, "04-picker-placeholder.png") });

    // --- the context-menu trigger glyph `⋮` (js/context_menu.js:59) lives in the
    //     layer panel's row menu; read the layer panel directly.
    const layerGlyphs = await page.evaluate(() => {
      const out = { triggers: [], nonAscii: [] };
      document.querySelectorAll("*").forEach((el) => {
        const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim()).join("");
// deliberate: the control characters ARE the measurement (a byte-level
// encoding probe), not an accident this rule exists to catch.
// eslint-disable-next-line no-control-regex
        if (own && own.length <= 3 && /[^\x00-\x7F]/.test(own)) out.triggers.push(own);
      });
      out.triggers = [...new Set(out.triggers)];
      return out;
    });
    console.log("-- short non-ASCII glyphs found anywhere in the live DOM --");
    console.log("  ", JSON.stringify(layerGlyphs.triggers));

    // --- the CSS-generated glyph: `content: '↻'` on the rotation affordance
    //     (js/print_styles.js:1492). Generated content is not in textContent, so
    //     read it through getComputedStyle on the ::after pseudo-element.
    const cssGlyph = await page.evaluate(() => {
      const want = "\u21BB"; // ↻ expected from js/print_styles.js:1492
      const moji = "\u00E2\u0086\u00BB";
      const hits = { intended: [], mojibake: [] };
      document.querySelectorAll("*").forEach((el) => {
        for (const pseudo of ["::after", "::before"]) {
          const c = getComputedStyle(el, pseudo).content;
          if (!c || c === "none" || c === "normal") continue;
          const v = c.replace(/^"|"$/g, "");
          if (v.includes(want)) hits.intended.push(el.className || el.tagName);
          if (v.includes(moji)) hits.mojibake.push(el.className || el.tagName);
        }
      });
      return { intended: [...new Set(hits.intended)].slice(0, 6),
               mojibake: [...new Set(hits.mojibake)].slice(0, 6) };
    });
    console.log("-- CSS `content:` glyph (js/print_styles.js:1492, U+21BB) --");
    console.log("   intended:", JSON.stringify(cssGlyph.intended), " mojibake:", JSON.stringify(cssGlyph.mojibake));

    // --- THE DECISIVE ONES, as codepoints ---
    const joined = JSON.stringify([picker.placeholders, picker.overlayText, layerGlyphs.triggers]);
    console.log("\n== CODEPOINT CHECK ==");
    for (const [label, cp] of [["ellipsis", "\u2026"], ["close X", "\u2715"], ["reset", "\u21BA"],
                               ["menu dots", "\u22EE"], ["degree", "\u00B0"]]) {
      console.log(`   ${label.padEnd(10)} U+${cp.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`
        + `  intended=${joined.includes(cp)}`
        + `  mojibake=${joined.includes(Buffer.from(cp, "utf8").toString("latin1"))}`);
    }
    fs.writeFileSync(path.join(SHOTS, "ellipsis-and-css-raw.json"),
      JSON.stringify({ picker, layerGlyphs, cssGlyph }, null, 2));
    assert.ok(true, "U+2026 + CSS probe complete");
  });
});
