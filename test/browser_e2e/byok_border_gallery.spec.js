/**
 * Browser E2E — BYOK SVG border gallery (AC-V1 gallery + prompt-corpus evidence).
 *
 * WHAT THIS SPEC IS
 * -----------------
 * A gallery E2E that applies MULTIPLE live-NOUS-generated SVG borders through the real
 * extension on the README's demo sheet (https://www.dndbeyond.com/characters/151911403),
 * and captures one labelled frame per design.
 *
 * The byok_border_roundtrip spec already proves the choke point contract, undo, and one
 * clean-vs-hostile path. This spec is NOT that contract: it is a MEASUREMENT of the
 * generator's real output against the product's real render path, so a visual gate can
 * score whether the generated borders look right.
 *
 * WHY THE DESIGN FILE IS THE AUTHORITY, AND WHY THAT FILE IS FROZEN
 * ----------------------------------------------------------------
 * The corpus the gallery renders is `test/fixtures/byok_border_corpus.json` — the frozen output of
 * `scripts/border_design_generator.js`, taken from the live NOUS free leg with the PRODUCT's own
 * prompt. It is frozen (not read live) because the generator's leg is non-deterministic: the same
 * instruction is accepted in one round and refused in the next (MEASURED 6/12, 2/6, 4/4, 5/5, 1/3,
 * 2/2 across rounds 1..4c for the SAME 12 instructions). A visual gate whose input changes between
 * runs cannot distinguish "the render path is broken" from "the model sent something else this
 * minute", so the accepted bytes are frozen byte-for-byte and this spec renders THOSE. Each entry
 * carries its own sha256, so a red frame names its input. Regenerate with
 * `node scripts/freeze_border_corpus.js`; `test/unit/byok_border_corpus.test.js` fails on drift.
 *
 * `scripts/border_designs.json` remains the PROMPT corpus (id/title/instruction/criterion); the
 * frozen fixture carries the same fields per design so the gallery is independent of the generator's
 * run directory existing at all.
 *
 * WHY THE EXTENSION'S OWN SEAMS ARE DRIVEN
 * ----------------------------------------
 * The gallery applies each SVG through `window.AiBorder.renderBorderSvg` — the SAME choke point
 * every real apply path uses. It never reaches the DOM directly; it never calls the sanitizer
 * outside the choke point. Each design is one call, one `readBorderSvg`, one DOM measurement, one
 * page.screenshot. That is the ONLY proof the gallery needs to carry: what the code does with the
 * design.
 *
 * GATING (graceful skip — a normal e2e run must never capture and never fail):
 *   BORDER_GALLERY_SHOTS=1          enable capturing
 *   BORDER_GALLERY_SHOTS_DIR=...    override the artifact root
 *   BORDER_GALLERY_ROUND=...        label for the CAPTURE run (default: 1)
 *   BORDER_GALLERY_DESIGNS=...      override the frozen corpus (default: the fixture above)
 *
 * Run:
 *   BORDER_GALLERY_SHOTS=1 npx mocha test/browser_e2e/byok_border_gallery.spec.js --timeout 900000
 *
 * Or:
 *   npm run test:e2e:byokgallery
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage } = require("./_helpers.js");
const { contentCall } = require("./_helpers/inject.js");
const { captureHarness } = require("./_capture.js");

const ROOT = path.resolve(__dirname, "..", "..");
const cap = captureHarness({
  flag: "BORDER_GALLERY_SHOTS",
  dirVar: "BORDER_GALLERY_SHOTS_DIR",
  defaultDir: "temp/visual_logs/byok_svg_borders_20260927",
  subdir: "gallery-round" + (process.env.BORDER_GALLERY_ROUND || "1"),
});
const CAPTURING = cap.enabled;
const ROUND = process.env.BORDER_GALLERY_ROUND || "1";

/**
 * A hairline sentinel along the section's own border box, drawn into the CAPTURED frame only.
 *
 * WHY THIS IS IN THE HARNESS AND NOT AN ASSERTION
 * ----------------------------------------------
 * MEASURED (round 9): the target section is 656x1920 at viewport y 3499 while the capture viewport
 * is 1440x900, so the close-up clip `{x:617,y:0,w:688,h:900}` shows the TOP 900px of a 1920px
 * section — and `page.screenshot` does not paint the fixed control tray the way a full-page shot
 * does. The reviewer's frame therefore contains a border's top edge and two side stubs, and NOT
 * the bottom edge. A design whose top rule is present but whose bottom rule is not cannot be
 * distinguished from one whose bottom rule was never drawn, and Muse's round-8 sentence ("only
 * fragmented top/bottom dotted segments") is exactly that ambiguity.
 *
 * So the harness draws a 1px magenta rectangle on the SECTION's screen rect when
 * `BORDER_GALLERY_MARK=1`. It is drawn INSIDE the screenshot, is not part of the product, and is
 * what lets the brief say "the magenta line is the section edge" — turning "is the frame complete?"
 * into a question about the pixels rather than about the camera.
 */
const MARK_SECTION = process.env.BORDER_GALLERY_MARK === "1";

async function markSection(page, sectionId) {
  if (!MARK_SECTION) return null;
  return page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const old = document.getElementById("be-gallery-mark");
    if (old) old.remove();
    const d = document.createElement("div");
    d.id = "be-gallery-mark";
    d.style.cssText =
      "position:fixed;left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height +
      "px;border:1px solid #ff00ff;pointer-events:none;z-index:2147483647;box-sizing:border-box";
    document.body.appendChild(d);
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, sectionId);
}

async function clearMark(page) {
  if (!MARK_SECTION) return;
  await page.evaluate(() => {
    const el = document.getElementById("be-gallery-mark");
    if (el) el.remove();
  });
}

/**
 * Read the FROZEN corpus.
 *
 * The default source is `test/fixtures/byok_border_corpus.json` (see the header): a tracked,
 * byte-reproducible freeze of every design the live generator accepted. `BORDER_GALLERY_DESIGNS`
 * still overrides it, keeping the "point the gate at a different corpus without editing the spec"
 * affordance — a path, or a filename under the generator's own artifact dir.
 *
 * The fixture is read with a HARD failure rather than a skip if it is missing or empty: an empty
 * corpus would make every case below a no-op, and a gate that captures nothing must not read green.
 */
function loadDesigns() {
  const overridden = process.env.BORDER_GALLERY_DESIGNS;
  const fixture = path.join(ROOT, "test", "fixtures", "byok_border_corpus.json");
  const dir = path.join(ROOT, "temp", "visual_logs", "byok_svg_borders_20260927");

  let file = fixture;
  if (overridden) {
    file = path.isAbsolute(overridden)
      ? overridden
      : (fs.existsSync(overridden) ? overridden : path.join(dir, overridden));
  }
  if (!fs.existsSync(file)) {
    throw new Error(
      "the border corpus is missing: " + file + " — run `node scripts/freeze_border_corpus.js`",
    );
  }
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const designs = (data.designs || []).filter((d) => d.accepted !== false && d.svg);
  if (!designs.length) {
    throw new Error("the border corpus at " + file + " carries no designs with an svg field");
  }
  console.log(
    "gallery: " + path.relative(ROOT, file) + " — " + designs.length + " frozen designs" +
      (overridden ? " (BORDER_GALLERY_DESIGNS override)" : ""),
  );
  return { designs, source: path.relative(ROOT, file).split(path.sep).join("/"), variants: data.variants || [] };
}

describe("BYOK SVG border gallery — FROZEN corpus through the real choke point, real page", function () {
  this.timeout(900000);
  let ctx;
  let page;
  const loaded = loadDesigns();
  // EVERY frozen blob is rendered, not just the 12 canonical designs. The user's requirement is
  // "use all the SVGs created until now", and the corpus holds 20 DISTINCT accepted artworks (12
  // canonical + 8 superseded). A gate that renders only the winners leaves 8 real model outputs
  // unmeasured — and those 8 are the ones the model produced for the SAME instructions and then
  // rejected a second time, i.e. the most likely to expose a render-path weakness.
  const designs = loaded.designs.concat(
    (loaded.variants || []).map((v) => Object.assign({}, v, { variant: true })),
  );

  before(async function () {
    if (!CAPTURING) this.skip();
    if (designs.length === 0) this.skip();
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    const injected = await contentCall(ctx, "aiArrangeFirstSection", []);
    if (!injected.ok) this.skip();
    // `bootPage` already replayed the toolbar click that injects the file list, and the probe
    // above confirms the content script answered — but the file-list includes `js/ai_border.js`
    // which sets the seam, so wait for the choke point to actually resolve before anything else.
    // `window.AiBorder` is set in the ISOLATED world (the one `contentCall` drove above), not in
    // the MAIN world `page.evaluate` runs in; the byok_border_roundtrip spec measures it from the
    // MAIN world and sees it there because `executeScript` defines the property on `window` in that
    // world too, but there is a race between the service worker's `executeScript` call and the main
    // frame's readiness. The safest signal is the content-call probe itself: if the isolated world
    // can answer `aiArrangeFirstSection`, the file list was already injected.
    await page.setViewportSize(cap.viewport);
  });

  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("window.AiBorder is live in the ISOLATED world (the world the product's own code runs in)", async function () {
    // The byok_border_roundtrip spec reads `window.AiBorder` from the MAIN world, which is the
    // `page.evaluate` default. `contentCall` drives the ISOLATED world — the world the
    // extension's own content script and the choke point live in — so it is the honest place to
    // assert the seam: `renderBorderSvg` / `readBorderSvg` / `clearBorderSvg` all exist there.
    const modules = await contentCall(ctx, "aiArrangeProbe", [{ action: "probeAiBorder" }]);
    assert.ok(modules && modules.render === "function", "renderBorderSvg is not on the isolated-world seam");
    assert.ok(modules && modules.read === "function", "readBorderSvg is not on the isolated-world seam");
    assert.ok(modules && modules.clear === "function", "clearBorderSvg is not on the isolated-world seam");
  });

  it("the README's demo sheet exposes a section a border can actually be SEEN on", async function () {
    // ROUND-1 DEFECT, MEASURED (2026-09-29). This spec used `aiArrangeFirstSection` (first row with
    // `width >= 100`). On the demo sheet that is the section at record x 16..240, and the
    // extension's OWN control tray is `position: fixed` at viewport x 10..258, `z-index: 10000`
    // (window.Z.PANEL, js/controls.js:104) while a section is z-index 10 — so the border overlay
    // (`z-index: -1`, behind the section content) was behind an opaque `rgb(25, 20, 16)` panel, and
    // Muse's round-1 verdict said "dark gray/black spiky barbed rectangle" in ALL SIX cells. The
    // border was never in the frame. `pickBorderTarget` scores every section by whether its centre
    // AND its four corners are clear of every fixed surface above z 1000, and returns the numbers.
    const pick = await contentCall(ctx, "aiArrangeProbe", [{ action: "pickBorderTarget" }]);
    assert.ok(pick && pick.ok, "no border-visible section on the demo sheet: " + JSON.stringify(pick).slice(0, 400));
    assert.deepStrictEqual(
      pick.pick.obstructions,
      [],
      "the chosen section is still obstructed at " +
        JSON.stringify(pick.pick.viewport) +
        " by " +
        JSON.stringify(pick.pick.obstructions) +
        " — the round-1 defect would repeat",
    );
    assert.ok(pick.pick.viewport.w >= 150 && pick.pick.viewport.h >= 100, "the target is too small to judge a border");
  });

  for (const d of designs) {
    it("renders " + d.id + " (" + d.title + ") behind content and captures a frame", async function () {
      const pick = await contentCall(ctx, "aiArrangeProbe", [{ action: "pickBorderTarget" }]);
      assert.ok(pick && pick.ok, "no section available for " + d.id);
      const sectionId = pick.pick.id;

      // Clear any prior border on this section.
      await page.evaluate((id) => {
        const section = document.getElementById(id);
        if (section && window.AiBorder) window.AiBorder.clearBorderSvg(section);
      }, sectionId);

      // Apply the design through the real choke point, in the ISOLATED world where the extension's
      // own code lives. `window.AiBorder` in the MAIN world is a race on some boots (measured:
      // `contentCall`'s own probe sees the seam while `page.evaluate` does not), and the point of
      // this spec is the choke point, not the seam resolution speed. The gallery spec already asserts
      // the seam exists in the isolated world (the `"window.AiBorder is live in the ISOLATED world"`
      // case above), so the per-design case only needs the choke point's OWN answer: whether the
      // SVG rendered, whether it is hostile, and what the geometry looks like.
      //
      // The `rawSvg` field is the MODEL'S OWN ANSWER, not a hand-written fixture: each design
      // comes from `scripts/border_design_generator.js`, which calls the live NOUS free leg with
      // the product's own prompt and decides acceptance with the product's own parser. That is
      // why the test exists: what a real model sent, through the real choke point, on the real page.
      const applied = await contentCall(ctx, "aiArrangeProbe", [{ action: "applyBorder", sectionId, rawSvg: d.svg }]);
      assert.ok(applied && applied.ok, "renderBorderSvg refused " + d.id + ": " + JSON.stringify(applied));
      assert.strictEqual(applied.rendered, true, "the border did not render for " + d.id);
      assert.strictEqual(applied.hostile, false, "the rendered border contains hostile markup: " + d.id);
      // D4: the geom probe reads the product's ::before border-image slot — the same
      // slot the webp borders paint through, which is the whole point of the operator's
      // "only the source image differs" requirement.
      assert.ok(applied.geom, "no ::before border slot for " + d.id);
      assert.strictEqual(applied.geom.position, "absolute", d.id + ": border slot not absolutely positioned");
      assert.strictEqual(applied.geom.pointerEvents, "none", d.id + ": border slot intercepts pointer events");
      assert.ok(applied.geom.zIndex < 0, d.id + ": border slot does not sit behind content (z-index " + applied.geom.zIndex + ")");
      assert.ok(
        applied.geom.borderImageSource && applied.geom.borderImageSource.includes("data:image/svg+xml"),
        d.id + ": the ::before slot is not fed the AI SVG source",
      );

      // Clear the border for the next design.
      await page.evaluate((id) => {
        const section = document.getElementById(id);
        if (section && window.AiBorder) window.AiBorder.clearBorderSvg(section);
      }, sectionId);
    });
  }

  if (CAPTURING && designs.length > 0) {
    it("captures a labelled frame for every accepted design", async function () {
      const pick = await contentCall(ctx, "aiArrangeProbe", [{ action: "pickBorderTarget" }]);
      assert.ok(pick && pick.ok, "no section for gallery capture");
      const sectionId = pick.pick.id;
      // The CLOSE-UP WINDOW, derived from the chosen section's own viewport rect and padded — the
      // rule `scripts/byok_acv1_collage.js` already states for the geometry gate: a hand-chosen
      // window is what burned round 1, so the window is DERIVED and applied identically to every
      // design. A border is a thin frame; at full-page scale a 2px rule is a sub-pixel smudge, and
      // the reviewer judges edges and corners, so the cell has to BE the section.
      //
      // HARNESS DEFECT, MEASURED AND FIXED (2026-09-30). This used to take `pick.pick.viewport`,
      // scroll the section into view, then call `pickBorderTarget` a SECOND time and clip to
      // whatever THAT call returned. Two things were wrong with it:
      //   1. the re-pick re-scores every section, so after the scroll it can select a DIFFERENT
      //      section than `sectionId` — the clip then frames a node no design was applied to
      //      (MEASURED: round 12 clipped a 656x1920 section, round 13 a 640x1376 one);
      //   2. `pick.pick.viewport` is a PRE-scroll measurement, so `viewport - clip` is not the
      //      section's rect inside the image (MEASURED: the frame's left rule sits at image
      //      x=6..11 where the pre-scroll numbers imply x=8 for a rect the post-scroll pick
      //      reports at x=24 — three different numbers).
      // The rect is now measured ONCE, after the scroll, from the SECTION ID ITSELF, and the clip
      // is derived from that same measurement. `clip` and the section's position inside it are
      // therefore self-consistent and reproducible, which is what lets a pixel metric measure the
      // band the composition actually painted instead of a band that merely looks plausible.
      // THE CAMERA DEFECT, MEASURED AND FIXED (2026-10-01). `page.screenshot({clip})` CANNOT capture
      // beyond the viewport: MEASURED in a 400x300 viewport, a `{x:0,y:0,w:200,h:2000}` clip returns
      // a 200x300 image and the far rule is GONE. The pinned capture viewport is 1440x900 and the
      // target section is 656x1920, so EVERY frame captured before this fix was the middle 900px of
      // the border — the reviewer was asked "is the frame closed?" while the top and bottom edges
      // were outside the picture, and `temp/scratch/frame_ink.js` is what caught it (0/12 frames
      // with a closed perimeter at BAND=28 while the same designs measure 8-10/12 when rendered
      // whole). The route that fits is to GROW the viewport until the clip fits, then re-scroll and
      // re-measure: MEASURED, a 1440x1970 viewport returns the full 704x1968 clip with both end
      // rules present at image y=1 and y=1918.
      const PAD = 24;
      const measureClip = async (id) => {
        const r = await page.evaluate((sid) => {
          const el = document.getElementById(sid);
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return { x: b.x, y: b.y, w: b.width, h: b.height };
        }, id);
        if (!r) return null;
        return {
          rect: r,
          clip: {
            x: Math.max(0, Math.round(r.x - PAD)),
            y: Math.max(0, Math.round(r.y - PAD)),
            width: Math.round(r.w + PAD * 2),
            height: Math.round(r.h + PAD * 2),
          },
        };
      };
      let measured = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ block: "start", behavior: "instant" });
        }, sectionId);
        await page.waitForTimeout(200);
        measured = await measureClip(sectionId);
        if (!measured) throw new Error("the chosen section " + sectionId + " is not in the document");
        const vp = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
        const needW = Math.max(vp.w, measured.clip.x + measured.clip.width + 2);
        const needH = Math.max(vp.h, measured.clip.y + measured.clip.height + 2);
        if (needW === vp.w && needH === vp.h) break;
        await page.setViewportSize({ width: needW, height: needH });
      }
      const rectAtCapture = measured.rect;
      const clip = measured.clip;
      // The clip must CONTAIN the section: a camera that crops the thing under judgement is the
      // defect this block exists to prevent, so it fails loudly rather than capturing a partial
      // section again.
      assert.ok(
        rectAtCapture.y >= clip.y && rectAtCapture.y + rectAtCapture.h <= clip.y + clip.height,
        "the capture clip " + JSON.stringify(clip) + " does not contain the section's full height " +
          JSON.stringify(rectAtCapture) + " — the reviewer would judge a cropped border",
      );
      // Where the section sits INSIDE the clip, for this capture's own page state. Recorded on
      // every frame (a per-design scroll can move the page) and used by the pixel metric.
      const frameRect = {
        x: Math.round(rectAtCapture.x - clip.x),
        y: Math.round(rectAtCapture.y - clip.y),
        w: Math.round(rectAtCapture.w),
        h: Math.round(rectAtCapture.h),
      };
      const frames = [];

      // Optional: a 1px magenta rectangle on the section's screen rect, drawn INSIDE the frames
      // when BORDER_GALLERY_MARK=1. It is harness-only (not product chrome) and it is what lets the
      // brief say "the magenta line is the section edge", turning "is the frame complete?" into a
      // question about pixels rather than about the camera.
      await markSection(page, sectionId);

      for (const d of designs) {
        // Clear prior border.
        await page.evaluate((id) => {
          const section = document.getElementById(id);
          if (section && window.AiBorder) window.AiBorder.clearBorderSvg(section);
        }, sectionId);

        // Apply design.
        const applied = await contentCall(ctx, "aiArrangeProbe", [{ action: "applyBorder", sectionId, rawSvg: d.svg }]);
        if (!applied || !applied.ok) continue;

        await page.waitForTimeout(400);
        // A SUPERSEDED variant has the same id as its canonical design, so `d.id + ".png"` would
        // overwrite the winner's frame — MEASURED in the first 20-design capture run: 20 cases,
        // 12 files, and the 8 real model outputs the user asked to see were gone. A variant frame
        // therefore carries its own round in the name.
        const name = (d.variant ? d.id + "-v" + d.round : d.id) + ".png";
        fs.mkdirSync(cap.shots, { recursive: true });
        await page.screenshot({ path: path.join(cap.shots, name), clip });
        console.log("frame:", path.join(cap.subdir || "", name), "(close-up", clip.width + "x" + clip.height + ")");
        frames.push({
          id: d.id,
          title: d.title,
          // A superseded blob keeps its own identity so the collage can label it separately from
          // the canonical design it lost to (same id, different bytes, different round).
          variant: Boolean(d.variant),
          label: (d.variant ? d.id + " v" + d.round + " (superseded)" : d.id),
          // The frozen design's own identity, so a red Muse cell in the collage can be traced to
          // the exact bytes that were rendered (and to the round that produced them).
          sha256: d.sha256 || null,
          round: d.round || null,
          criterion: d.criterion || null,
          file: name,
          svgChars: (applied.read || "").length,
          sectionId,
          clip,
          // The section's rect INSIDE this frame, measured in the same page state the
          // screenshot was taken in (see the comment on `frameRect` above the loop).
          frameRect,
        });
      }

      cap.probe("gallery-manifest.json", {
        round: ROUND,
        source: loaded.source,
        corpusDir: path.relative(ROOT, path.join(ROOT, "test", "fixtures")).split(path.sep).join("/"),
        generatedAt: new Date().toISOString(),
        provenance: cap.provenance(page, "byok_border_gallery.spec.js"),
        target: pick.pick,
        clip,
        // WHERE THE SECTION IS INSIDE THE CLIP, for the page state the last frame was taken in.
        // (Per-frame values are on each entry in `designs`; this top-level copy is the one a
        // reader sees first.) `target.viewport` is a PRE-scroll measurement and the clip is
        // derived from the POST-scroll rect, so the two disagree — MEASURED 2026-09-30: the
        // frame's left rule sits at image x=6..11, the pre-scroll numbers imply x=8, and the
        // post-scroll pick reports x=24. Only this rect describes the pixels in the frames.
        frameRect,
        designs: frames,
      });

      // Clean up last border.
      await page.evaluate((id) => {
        const section = document.getElementById(id);
        if (section && window.AiBorder) window.AiBorder.clearBorderSvg(section);
      }, sectionId);
      await clearMark(page);

      assert.ok(frames.length >= 1, "the gallery captured zero frames");
    });
  }
});