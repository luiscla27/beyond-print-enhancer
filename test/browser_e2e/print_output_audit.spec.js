/**
 * PRINT OUTPUT AUDIT — the product's core job, looked at for the first time.
 * (issue `print_output_never_assessed_20260911`, handed on from track
 * `first_run_and_panel_20260911` §"The print OUTPUT audit is excluded")
 *
 * WHY A SEPARATE, GATED SUITE. Every print-related suite in this repo asserts print
 * CONFIGURATION through the DOM: "the layer container carries data-print-disabled", "the injected
 * @media print CSS has a hide rule", "the tray renders the settings". None of them asserts a
 * RENDERED PAGE, so nothing in the repo could tell whether a printed sheet is right. This suite
 * drives Chromium's own print pipeline and then measures the PDF it produced — the bytes a printer
 * receives — page by page.
 *
 * ── THREE THINGS TO KNOW BEFORE EDITING THIS FILE ────────────────────────────────────────────────
 *
 * 1. **NEVER call `page.emulateMedia({media: "screen"})` (or `null`) before `page.pdf()`.** Pinning
 *    the media type makes `page.pdf()` skip the extension's `@media print` stylesheet entirely, so
 *    the SCREEN layout prints — panel, page separators and all. MEASURED: prints 1-2 of a clean
 *    session gave 213 text-showing operators (the boot toast only) on 4 pages, while the same page
 *    printed after an interface `emulateMedia` pass gave 2,128 operators and 3,336 characters,
 *    because the tool's own chrome had come back onto the paper. The gate below caught that as a
 *    wrong-page-width/blank-page defect in a comparison run before the cause was found. A print
 *    measurement is only valid if the media type was never pinned.
 *
 * 2. **The rasteriser is pdf.js, in a page served by a dependency-free static server**
 *    (`_helpers/pdf.js`). There is no PDF rasteriser on this machine: no poppler, no ghostscript, no
 *    ImageMagick, `sharp`'s libvips is built without PDF input, and headless Chromium downloads a
 *    PDF instead of rendering it. See `_helpers/pdf.js` for the measurements.
 *
 * 3. **A toast is `position: fixed`, so it prints on EVERY page.** That is not a theory: it is the
 *    defect this suite pinned. The boot notice's sentence was the ONLY text in the whole PDF before
 *    the fix, on all four pages.
 *
 * Run:  PRINT_AUDIT=1 npx mocha test/browser_e2e/print_output_audit.spec.js --timeout 1800000
 * Artifacts: vendor/docs/print-output-audit-20260911/  (page rasters + measurements.json)
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, reinject } = require("./_helpers.js");
const { measurePdf, startStaticServer, EXT_ROOT } = require("./_helpers/pdf.js");

const ENABLED = process.env.PRINT_AUDIT === "1";
const ART = path.resolve(EXT_ROOT, process.env.PRINT_AUDIT_DIR || "vendor/docs/print-output-audit-20260911");
const WORK = path.resolve(EXT_ROOT, "temp/print-audit"); // PDFs the static server must reach
const PDFJS = "/node_modules/pdfjs-dist/legacy/build";

/** What the tool says on screen that must never reach paper. */
const CHROME_MARKERS = {
  "boot toast": "No saved layout yet",
  "first-run card": "Drag to move, drag a corner to resize",
  "panel output tray": "Manage Clones",
  "properties panel": "Select a section to edit its properties",
  "page separator": "Page 1 END",
};

/** Every text string the PDF carries, page by page, plus the operator inventory of the output. */
async function pdfFacts(page, pdfPath) {
  const { server, port } = await startStaticServer();
  try {
    await page.goto(`http://127.0.0.1:${port}/temp/print-audit/facts.html`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__factsReady, { timeout: 60000 });
    const rel = "/" + path.relative(EXT_ROOT, path.resolve(pdfPath)).split(path.sep).join("/");
    return await page.evaluate((u) => window.__pdfFacts(u), `http://127.0.0.1:${port}${rel}`);
  } finally {
    server.close();
  }
}

describe("PRINT OUTPUT audit — the printed sheet, measured (issue print_output_never_assessed_20260911)", function () {
  this.timeout(1800000);
  let ctx, page, raster, measurements = {};

  before(async function () {
    if (!ENABLED) this.skip();
    fs.mkdirSync(WORK, { recursive: true });
    fs.mkdirSync(ART, { recursive: true });
    // The page rasters are regenerated every run, so a stale count cannot make the assertion below lie.
    fs.rmSync(path.join(ART, "pages"), { recursive: true, force: true });
    fs.writeFileSync(
      path.join(WORK, "facts.html"),
      `<!doctype html><html><body><script type="module">
import * as pdfjs from '${PDFJS}/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = '${PDFJS}/pdf.worker.min.mjs';
window.__pdfFacts = async function (url) {
  const doc = await pdfjs.getDocument({ url }).promise;
  const out = { pages: doc.numPages, textOps: 0, imageOps: 0, pathOps: 0, perPage: [] };
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const o = await p.getOperatorList();
    let t = 0, im = 0;
    for (const f of o.fnArray) {
      if (f === pdfjs.OPS.showText || f === pdfjs.OPS.showSpacedText) { out.textOps++; t++; }
      if (f === pdfjs.OPS.paintImageXObject || f === pdfjs.OPS.paintInlineImageXObject) { out.imageOps++; im++; }
      if (f === pdfjs.OPS.fill || f === pdfjs.OPS.stroke) out.pathOps++;
    }
    const box = p.getViewport({ scale: 1 });
    const txt = (await p.getTextContent()).items.map((x) => x.str).join("").replace(/\\s+/g, " ").trim();
    out.perPage.push({ page: i, boxPt: [box.width, box.height], textOps: t, imageOps: im, chars: txt.length, text: txt });
  }
  return out;
};
window.__factsReady = true;
</script></body></html>`,
    );

    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    raster = await ctx.newPage();
  });

  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
    // GUARDED, and it is not cosmetic: mocha still runs `after` when `before` skipped the suite, so an
    // unguarded write here makes an ordinary `npm run test:e2e` (no PRINT_AUDIT) OVERWRITE the
    // committed evidence `measurements.json` with `{}` — found by doing exactly that, which is how the
    // audit's own numbers were lost from the working tree and had to be restored from git. The
    // probe beside this suite guards its write the same way.
    if (!ENABLED) return;
    fs.writeFileSync(path.join(ART, "measurements.json"), JSON.stringify(measurements, null, 2));
  });

  /** Print the live sheet and return { file, facts, geo }. `style` is injected for the print only. */
  async function printAndMeasure(label, { style, pdf = {} } = {}) {
    const handle = style ? await page.addStyleTag({ content: style }) : null;
    const file = path.join(WORK, `${label}.pdf`);
    await page.pdf({
      path: file,
      scale: 1,
      printBackground: false,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
      ...pdf,
    });
    if (handle) await handle.evaluate((n) => n.remove());
    const facts = await pdfFacts(raster, file);
    const geo = await measurePdf(raster, {
      pdfPath: file,
      outDir: label === "sheet" ? path.join(ART, "pages") : undefined,
      pixelRatio: 1.5,
      prefix: "page",
    });
    const row = {
      label,
      bytes: fs.statSync(file).size,
      pages: facts.pages,
      textOps: facts.textOps,
      imageOps: facts.imageOps,
      pathOps: facts.pathOps,
      perPage: facts.perPage.map((p, i) => ({
        page: p.page,
        boxPt: p.boxPt,
        chars: p.chars,
        textOps: p.textOps,
        coverage: geo.pages[i].coverage,
        inkBoxPt: geo.pages[i].inkBoxPt,
        marginsPt: geo.pages[i].marginsPt,
        maxChroma: geo.pages[i].maxChroma,
        saturatedPx: geo.pages[i].saturatedPx,
        inkBands: geo.pages[i].inkBands,
      })),
    };
    measurements[label] = row;
    return { file, facts, geo, row };
  }

  it("the sheet prints at all: four Letter pages, every one of them carrying ink", async function () {
    const { facts, geo, row } = await printAndMeasure("sheet");
    console.log(
      `\n-- printed sheet: ${row.bytes} bytes, ${facts.pages} pages, ${facts.imageOps} images, ${facts.pathOps} paths, ${facts.textOps} text ops`,
    );
    for (const p of row.perPage) {
      console.log(
        `   p${p.page} box=${p.boxPt.join("x")}pt cov=${p.coverage}% ink=${p.inkBoxPt ? `${p.inkBoxPt.x},${p.inkBoxPt.y} ${p.inkBoxPt.w}x${p.inkBoxPt.h}` : "-"} margins=${JSON.stringify(p.marginsPt)} chroma<=${p.maxChroma} bands=${p.inkBands}`,
      );
    }
    assert.strictEqual(facts.pages, 4, "the demo sheet prints as four pages");
    for (const p of geo.pages) {
      // Letter, portrait — the size the README and the product both promise.
      assert.deepStrictEqual(
        [Math.round(p.pageBoxPt[0]), Math.round(p.pageBoxPt[1])],
        [612, 792],
        `page ${p.page} is US Letter portrait`,
      );
      assert.ok(p.coverage > 1, `page ${p.page} carries ink (coverage ${p.coverage}%)`);
      assert.ok(p.inkBoxPt && p.inkBoxPt.w > 300, `page ${p.page} has a real body of content, not a stray mark`);
    }
    assert.ok(
      fs.existsSync(path.join(ART, "pages", "page-01.png")),
      "every page was rendered to a PNG that a human or a vision reviewer can look at",
    );
    assert.strictEqual(fs.readdirSync(path.join(ART, "pages")).filter((f) => f.endsWith(".png")).length, 4);
  });

  it("none of the tool's own chrome reaches the paper — with all of it provably on screen", async function () {
    // Force every surface to be present and visible FIRST, so this cannot pass by the surfaces
    // simply being absent. The boot notice needs a re-boot: it is shown once per injection.
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    await reinject(ctx, page);
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const help = document.getElementById("be-ctl-help");
      if (help) help.click(); // the shared dialog shell, WITH the scrim
    });
    await page.waitForTimeout(600);

    const onScreen = await page.evaluate((markers) => {
      const body = document.body.innerText;
      const out = {};
      for (const [name, text] of Object.entries(markers)) out[name] = body.includes(text);
      const toast = document.querySelector(".be-feedback");
      const overlay = document.querySelector(".be-modal-overlay");
      const vis = (el) => {
        if (!el) return false;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 1 && r.height > 1;
      };
      return { markers: out, toast: vis(toast), dialog: vis(overlay), toastPos: toast && getComputedStyle(toast).position };
    }, CHROME_MARKERS);

    console.log("\n-- on screen when the print was taken --\n  ", JSON.stringify(onScreen, null, 1));
    assert.ok(onScreen.toast, "precondition: the boot notice IS on screen when the print is taken");
    assert.strictEqual(onScreen.toastPos, "fixed", "…and it is position:fixed, so it would repeat on every page");
    assert.ok(onScreen.dialog, "precondition: a dialog with its scrim IS on screen");
    for (const name of ["boot toast", "first-run card"]) {
      assert.ok(onScreen.markers[name], `precondition: "${name}" is on screen (${CHROME_MARKERS[name]})`);
    }

    const { facts } = await printAndMeasure("chrome-present");
    const seen = facts.perPage.map((p) => p.text);
    const wasOnScreen = [];
    console.log("-- the tool's own text, page by page, in the printed output --");
    for (const [name, text] of Object.entries(CHROME_MARKERS)) {
      const pages = seen.map((t, i) => (t.includes(text) ? i + 1 : null)).filter(Boolean);
      if (onScreen.markers[name]) wasOnScreen.push(name);
      console.log(
        `   ${name.padEnd(20)} "${text}" -> ${pages.length ? "PAGES " + pages.join(",") : "absent"}` +
          (onScreen.markers[name] ? "" : "  [not on screen in this run]"),
      );
      assert.deepStrictEqual(
        pages,
        [],
        `"${name}" must not print (found on page(s) ${pages.join(", ")}) — an overlay is position:fixed, ` +
          "so anything left visible is repeated on every page of the output",
      );
    }
    // Anti-vacuity: absence only counts as evidence for the surfaces that were really up.
    measurements.chromeOnScreen = wasOnScreen;
    assert.ok(
      wasOnScreen.length >= 3,
      `at least three of the tool's surfaces must have been on screen for this to mean anything; ` +
        `only ${wasOnScreen.length} were (${wasOnScreen.join(", ")})`,
    );

    // THE CONTROL, and it is the reason "absent" above is worth anything: put the toast back under
    // the print rules' feet and prove this instrument CAN see one on paper. Without it, "the toast
    // did not print" and "the toast had already expired when the print was taken" look identical.
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    await reinject(ctx, page);
    await page.waitForTimeout(800);
    assert.ok(
      await page.evaluate(() => {
        const t = document.querySelector(".be-feedback");
        return !!t && getComputedStyle(t).display !== "none";
      }),
      "control precondition: a fresh toast is on screen",
    );
    const control = await printAndMeasure("chrome-control-toast-forced", {
      style: ".be-feedback { display: flex !important; visibility: visible !important; opacity: 1 !important; }",
    });
    const controlPages = control.facts.perPage
      .map((p, i) => (p.text.includes(CHROME_MARKERS["boot toast"]) ? i + 1 : null))
      .filter(Boolean);
    console.log(
      `-- CONTROL (toast forced back under the print rules): boot toast found on page(s) ${controlPages.join(", ") || "none"}`,
    );
    assert.deepStrictEqual(
      controlPages,
      [1, 2, 3, 4],
      "the instrument DOES see a toast on paper when it is left visible — on every page, because a " +
        "fixed overlay is repeated per page. This is what the shipped rule now prevents.",
    );
  });

  it("the four documented settings each still do something to the PAGE (not just to the byte size)", async function () {
    // Phase 2 (vendor/docs/first-run-and-panel-20260911/phase2_print_settings.md) measured these by BYTE
    // SIZE with a null render, because byte size was the strongest probe available at the time. This
    // test re-takes the same measurements on the page REGIONS, which is what a user sees.
    const base = measurements.sheet;
    const scale = await printAndMeasure("setting-scale-06", { pdf: { scale: 0.6 } });
    const bg = await printAndMeasure("setting-backgrounds-on", { pdf: { printBackground: true } });

    for (const [name, m] of [["scale 0.6", scale.row], ["backgrounds ON", bg.row]]) {
      const changed = m.perPage.some((p, i) => {
        const a = base.perPage[i];
        return p.coverage !== a.coverage || JSON.stringify(p.inkBoxPt) !== JSON.stringify(a.inkBoxPt);
      });
      console.log(`   ${name.padEnd(16)} bytes ${base.bytes} -> ${m.bytes}, coverage ${base.perPage.map((p) => p.coverage).join("/")} -> ${m.perPage.map((p) => p.coverage).join("/")}`);
      assert.ok(changed, `${name} must change the printed PAGE, not merely the byte size`);
    }
    // The direction, stated as the guidance states it: with Background graphics ON the sheet stops
    // being white — every page becomes full-bleed, which is why the product tells users to deselect.
    assert.ok(
      bg.row.perPage.every((p) => p.marginsPt.left === 0 && p.marginsPt.right === 0),
      "Background graphics ON prints edge to edge on every page — the reason for the instruction",
    );
  });

  it("the margins claim is confirmed on the page regions, with a control that proves the method is sensitive", async function () {
    // CLAIM (README step 4, from Phase 2): the extension's own `@page { margin: 0 }` overrides the
    // print dialog's margin setting, so changing the dialog's margins does nothing.
    const zero = await printAndMeasure("margins-dialog-0in", {
      pdf: { preferCSSPageSize: false, margin: { top: "0", bottom: "0", left: "0", right: "0" } },
    });
    const one = await printAndMeasure("margins-dialog-1in", {
      pdf: { preferCSSPageSize: false, margin: { top: "1in", bottom: "1in", left: "1in", right: "1in" } },
    });
    console.log(`\n-- dialog margins 0in vs 1in: ink box per page`);
    for (let i = 0; i < zero.row.perPage.length; i++) {
      console.log(`   p${i + 1}: ${JSON.stringify(zero.row.perPage[i].inkBoxPt)} vs ${JSON.stringify(one.row.perPage[i].inkBoxPt)}`);
    }
    assert.deepStrictEqual(
      one.row.perPage.map((p) => [p.coverage, p.inkBoxPt, p.marginsPt]),
      zero.row.perPage.map((p) => [p.coverage, p.inkBoxPt, p.marginsPt]),
      "the dialog's margin setting changes NOTHING about the printed page — the claim, at page-region level",
    );

    // CONTROL. Without this, the assertion above could be a measurement that simply cannot see a
    // margin. An author `@page` margin that does NOT get overridden must move the ink.
    const control = await printAndMeasure("margins-control-halfinch", {
      style: "@media print { @page { margin: 0.5in !important; } }",
    });
    const shifted = control.row.perPage.map((p, i) => p.inkBoxPt.x - zero.row.perPage[i].inkBoxPt.x);
    console.log(`   CONTROL (an @page margin the extension does not override): ink moved right by ${shifted.join(", ")}pt`);
    assert.ok(
      shifted.every((d) => d > 20),
      `an unprotected @page margin DOES move the printed content (shift ${shifted.join(", ")}pt) — so the ` +
        "no-op above is a property of the CSS, not of the instrument",
    );
  });

  it("records what the printer actually receives, and that the sheet's own type is TEXT", async function () {
    // This case used to be a RECORD with no assertion, on purpose: the audit's finding was that the
    // sheet reached the paper as rasterised images rather than as text, and asserting `textOps === 0`
    // would have failed the follow-up fix for fixing it. That fix is in (issue
    // print_sheet_rasterised_20260911), so the record stays and the assertion is inverted — the
    // sheet's text layer is now a REQUIREMENT of this suite rather than a reported curiosity.
    const m = measurements.sheet;
    const chars = m.perPage.reduce((a, p) => a + p.chars, 0);
    console.log(
      `\n-- what is in the output --\n   bytes=${m.bytes} pages=${m.pages} textOps=${m.textOps} ` +
        `imageOps=${m.imageOps} pathOps=${m.pathOps} chars=${chars}`,
    );
    measurements.outputCharacter = {
      bytes: m.bytes,
      textOps: m.textOps,
      imageOps: m.imageOps,
      pathOps: m.pathOps,
      charsInTextLayer: chars,
      // Histories, kept because they are what the audit measured and what the fix changed.
      // PRE-FIX (2026-09-11 audit, 1.17.1): the same sheet printed 5,976,211 bytes with 0 text ops,
      // 0 characters, 57 images and 17 paths — every section was rasterised by Chromium, because the
      // tool applied IDENTITY css filters (hue-rotate(0deg) / contrast(1) saturate(1) grayscale(1)
      // sepia(0)) to the section containers and their descendants, and an identity filter is still a
      // filter. 118 images at 300 DPI was recorded then, by walking the PDF's image XObjects and the
      // size each is placed at: every one lands at exactly 300 DPI, i.e. the sheet was rasterised at
      // printer resolution rather than handed over as a low-resolution copy. (That count's own
      // measurement is NOT in the committed evidence — it is carried here as the audit recorded it,
      // not re-derived.) It alone did NOT say whether any of those images were the page's type —
      // settled separately, by printing with the filters neutralised and comparing the renders: mean
      // 3.7-4.3/255, at most 4.1% of pixels differing by more than 32/255, so the type was on the
      // paper either way and only its ENCODING differed.
      // See vendor/docs/print-output-audit-20260911/evidence/type_present_but_encoded_as_images.txt.
      // POST-FIX (issue print_sheet_rasterised_20260911, closed): the identity chains collapse to
      // `none` (js/filters.js), so the sheet's own text and vectors reach the paper again. Numbers
      // and the two measurements behind the per-chain rule:
      // vendor/docs/print-sheet-text-layer-20260911/FIX_REPORT.md.
      imagesAt300dpiPreFix: 118,
      note:
        "the sheet's type reaches the paper as TEXT. Until the rasterisation fix it did not: the " +
        "sections were rasterised by Chromium because the tool applied an IDENTITY css filter to the " +
        "section containers (hue-rotate(0deg)), and neutralising the descendants restored 3263 " +
        "text-showing operators and 11,632 characters. The identity chains are now written as `none`, " +
        "which is where this row's numbers come from; a user's REAL filter settings are still emitted " +
        "verbatim, so a filtered sheet is still rasterised and this suite's rows move with it. " +
        "See temp/archived/ISSUE_print_sheet_rasterised_20260911.md (FIXED in 1.17.2).",
    };
    assert.ok(m.imageOps > 0, "the output does carry images (the demo sheet's own art, at 300 DPI)");
    // NOW ASSERTED, and the reason it was not before: at audit time this was the shape of the defect
    // (`textOps === 0`), and a suite that required 0 would have failed the follow-up fix for fixing
    // it. The fix exists, so the assertion is inverted — a regression that starts rasterising the
    // sheet again must fail a gate rather than be discovered in the next audit. The cause is pinned
    // at unit level by test/unit/print_identity_filters.test.js.
    console.log(
      `   text-showing operators contributed by the sheet: ${m.textOps} ` +
        `(${chars} characters; was 0 / 0 before the rasterisation fix)`,
    );
    assert.ok(
      m.textOps > 0 && chars > 1000,
      `the printed sheet must carry its own TEXT, not an image of text: measured textOps=${m.textOps} ` +
        `chars=${chars} (byte size alone would not catch this — the rasterised file is SMALLER). ` +
        "If this fails, something is rasterising the sections again: check the four --be-*-filter " +
        "custom properties on :root — an identity chain (hue-rotate(0deg), contrast(100%) saturate(100%) " +
        "grayscale(0%) sepia(0%)) must be written as `none` (js/filters.js).",
    );
  });
});
