/**
 * Browser E2E — the three sheet-affordance reports fixed together in 2.0.1.
 *
 *   ISSUE_drag_and_drop.md  green hover glow -> a centred nine-dot drag handle
 *   ISSUE_hover.md          .be-section-actions reveals on the ACTIVE layer only
 *   ISSUE_shadows.md        #print-enhance-controls casts no shadow
 *
 * WHY A SEPARATE SPEC, and WHY IT IS NOT A COPY OF test/unit/hover_refactor.test.js:
 * the unit suite drives the modules under jsdom with dispatched events, so it can
 * prove the CSS text is right and the gesture code is wired, but it can NEVER see
 * the two things the owner actually complained about —
 *
 *   1. whether a rule WINS once the browser composes nine stylesheets in a real
 *      cascade order (the panel's shadow came from FOUR piled `!important`
 *      declarations; only the last one in the sheet painted, so three of the four
 *      looked "already fixed" while the smudge stayed), and
 *   2. whether the reveal is reachable by a real pointer. `:hover` does not fire
 *      for a synthetic `dispatchEvent`, and `visibility: hidden` takes an element
 *      out of the hit test, so a handle that exists in the DOM and is styled
 *      correctly can still be ungrabbable. The unit suite's own note about the
 *      lock rule says exactly this (test/browser_e2e/lock_handle_visibility.spec.js).
 *
 * So every case here reads a COMPUTED style or moves a REAL mouse. Nothing here
 * asserts a selector string; the strings are pinned by the unit suite.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:affordances
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, contentCall } = require("./_helpers.js");
const { captureHarness } = require("./_capture.js");

// Pixel evidence, gated so a normal e2e run writes nothing:
//   AFFORDANCE_SHOTS=1 npx mocha test/browser_e2e/affordance_drag_hover_shadows.spec.js
const cap = captureHarness({
  flag: "AFFORDANCE_SHOTS",
  dirVar: "AFFORDANCE_SHOTS_DIR",
  defaultDir: "vendor/docs/sheet-affordances-20260914",
  subdir: "shots",
});

/** The one viewport every case in this file runs at, and WHY it must be pinned.
 *
 * MEASURED, and it cost three red runs to find. The grip sits at the CENTRE of a
 * section, and on the live demo sheet two things compete with it for that pixel: the
 * enhancer's own fixed chrome (the control panel is ~248px wide) and the character's
 * decorative shape layers, which are drawn OVER the content column. Both are real,
 * both are legitimate, and neither is the affordance — so which section a grip lands
 * under is the demo sheet's geometry, not a product defect. Numbers from this session's
 * probes (grip counted reachable only when it wins `elementFromPoint` at its own centre
 * after a real hover):
 *
 *   1280x720 (Playwright's default)  0 of 22 grips reachable — the panel covers the
 *                                    whole left column, so every case in this file
 *                                    reported "unreachable" on a CORRECT build
 *   1440x900  0 of 22
 *   1920x1080 4 of 22                (the shapes still cross most section centres)
 *   1920x1080 + the shapes layer hidden through its own panel control
 *             21 of 22 BEFORE ISSUE_grip_covered_by_actions_bar_on_small_sections_20260914.md
 *             was fixed, 22 of 22 after (the bar now yields to the grip — js/print_styles.js)
 *
 * So: a viewport wide enough that the default sheet really does expose grabbable
 * grips, plus a case that hides the decorative layer through the product's own control
 * and asserts the near-total number. Between them the affordance is proven on both the
 * messy sheet as it ships and a clean field — and if grips ever stop being reachable,
 * one of the two fails.
 */
const SHEET_VIEWPORT = { width: 1920, height: 1080 };

/**
 * Boot the sheet at the pinned viewport and install the helper the probes share.
 *
 * `window.__beUnderChrome(x, y)` answers "is this point covered by the enhancer's OWN
 * fixed chrome?" — the control panel, the layer manager, a modal. Skipping those
 * points is not dodging the assertion: an opaque fixed panel is precisely what a user
 * does not try to hover a section through, so a reveal measured under it would be
 * measuring the panel. It is NOT used to skip SHEET content (shapes, other sections) —
 * that is the real z-order competition, and a grip no mouse can reach anywhere at all
 * IS the bug these cases exist to catch.
 */
async function bootSheet(ctx) {
  const page = await bootPage(ctx);
  await page.setViewportSize(SHEET_VIEWPORT);
  await page.waitForTimeout(1200); // let the sheet reflow to the pinned size
  await page.evaluate(() => {
    window.__beChromeRects = () =>
      ["#print-enhance-controls", "#print-enhance-layer-manager", ".be-modal-overlay"]
        .map((sel) => document.querySelector(sel))
        .filter(Boolean)
        .filter((el) => {
          const cs = getComputedStyle(el);
          return cs.display !== "none" && cs.visibility !== "hidden" && cs.position === "fixed";
        })
        .map((el) => el.getBoundingClientRect());
    window.__beUnderChrome = (x, y) =>
      window
        .__beChromeRects()
        .some((b) => x >= b.left - 1 && x <= b.right + 1 && y >= b.top - 1 && y <= b.bottom + 1);
  });
  return page;
}

/**
 * Split a `box-shadow` computed list on its TOP-LEVEL commas only.
 *
 * The colour of a ring is regularly `rgb(12, 9, 7)` / `rgba(0, 0, 0, 0.5)` — commas
 * inside parens — so a naive `.split(",")` shreds every entry into fragments that
 * match no assertion and fail none. That is how a shadow test can pass vacuously.
 */
const splitShadowEntries = (list) => {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
};

/**
 * The blur radius of one computed `box-shadow` entry, in px.
 *
 * Computed order is `<offset-x> <offset-y> <blur> <spread> <color>` or
 * `<color> <offset-x> <offset-y> <blur> <spread>` — Chromium keeps the source order,
 * so the three LENGTH slots that follow the two offsets are read positionally, and
 * the third length is the blur. A zero-blur entry is not a shadow: it is a ring.
 * That distinction IS the ISSUE_shadows.md contract (the tooled frame must survive),
 * so it is computed here rather than matched with one fixed regex that would have to
 * be either strict (brittle on colour order) or loose (vacuous).
 */
const blurOfEntry = (entry) => {
  const lengths = entry.match(/[+-]?\d*\.?\d+px/g);
  if (!lengths || lengths.length < 3) return 0; // 2 lengths = offsets only => no blur slot
  return Math.abs(parseFloat(lengths[2]));
};

describe("sheet affordances — drag handle, active-layer hover, panel shadow (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /**
   * Move the REAL pointer onto a wrapper of the given kind and report the state of
   * its two hover affordances (the drag handle, the action bar) plus its own glow.
   *
   * `kind`: "active"   — a section inside `.be-active-layer`
   *         "inactive" — a section inside a locked layer that is NOT the active one
   *
   * WHY THE SEARCH FOR AN UNCOVERED POINT, AND WHY IT IS NOT CHEATING: a wrapper's
   * geometric centre is regularly under the fixed control panel or under a shape, and
   * a pointer parked there produces no `:hover` on the wrapper at all (measured in the
   * lock spec: opacity stayed 0). So points are scanned until one whose TOPMOST
   * element is inside the target is found. If none is clear, `covered: true` comes back
   * and the caller SKIPS rather than asserting a reveal it never provoked — a `:hover`
   * assertion made on an element nobody is hovering can never fail.
   *
   * THREE STEPS, NOT ONE (MEASURED): the scan is a separate evaluate from the
   * `scrollIntoView`, with a wait between them. The host sheet smooth-scrolls, so
   * reading `getBoundingClientRect()` in the SAME tick as the scroll returns a
   * position from mid-animation and every scanned point is stale — the first draft of
   * this helper reported "no clear point" for all 22 candidates for that reason alone.
   */
  async function hoverWrapper(page, kind) {
    // (1) list the candidates. NO scrolling here: each candidate gets its own
    // scroll + settle pass below, because scanning six elements after one scroll
    // would scroll them all to the same place and leave most of them off-screen.
    const ids = await page.evaluate((k) => {
      const all = Array.from(document.querySelectorAll(".be-section-wrapper"));
      return all
        .filter((el) => {
          if (k === "active") {
            // A section, not a shape: shapes live on locked layers by default, so
            // the active-layer probe must be a real content section.
            return el.closest(".be-active-layer") && !el.classList.contains("be-shape-wrapper");
          }
          return el.closest(".be-layer-locked") && !el.closest(".be-active-layer");
        })
        .map((el) => el.id);
    }, kind);
    if (!ids.length) return null;

    // (2) per candidate: scroll, SETTLE, then scan. The settle is not slack — see the
    // mid-animation-rect note above.
    let picked = null;
    for (const id of ids) {
      await page.evaluate((wid) => {
        const el = document.getElementById(wid);
        if (el) el.scrollIntoView({ block: "center" });
      }, id);
      await page.waitForTimeout(400);
      picked = await page.evaluate(
        ({ k, wid }) => {
          const el = document.getElementById(wid);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          if (r.width < 40 || r.height < 40) return null;
          for (const [fx, fy] of [
            [0.5, 0.5],
            [0.5, 0.3],
            [0.5, 0.7],
            [0.3, 0.5],
            [0.7, 0.5],
            [0.25, 0.25],
            [0.75, 0.25],
          ]) {
            const x = r.left + r.width * fx;
            const y = r.top + r.height * fy;
            if (x < 4 || y < 4 || x > innerWidth - 4 || y > innerHeight - 4) continue;
            // Skip points under the enhancer's OWN fixed chrome — see bootSheet.
            if (window.__beUnderChrome && window.__beUnderChrome(x, y)) continue;
            const hit = document.elementFromPoint(x, y);
            if (!hit || !(hit === el || el.contains(hit))) continue;
            document
              .querySelectorAll("[data-be-aff-probe]")
              .forEach((n) => n.removeAttribute("data-be-aff-probe"));
            el.setAttribute("data-be-aff-probe", k);
            return { x, y, id: el.id, covered: false };
          }
          return null;
        },
        { k: kind, wid: id },
      );
      if (picked) break;
    }

    if (!picked) {
      // Nothing clear anywhere: mark the first candidate and report `covered: true`, so
      // the caller SKIPS rather than asserting a reveal it never provoked.
      const fallback = await page.evaluate(({ k, wid }) => {
        const el = document.getElementById(wid);
        if (!el) return { missing: true };
        el.setAttribute("data-be-aff-probe", k);
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: el.id, covered: true };
      }, { k: kind, wid: ids[0] });
      if (fallback.missing) return null;
      picked = fallback;
    }

    if (!picked || picked.missing) return null;
    await page.mouse.move(picked.x, picked.y);
    await page.waitForTimeout(300);

    const read = await page.evaluate(() => {
      const sec = document.querySelector("[data-be-aff-probe]");
      if (!sec) return null;
      const styleOf = (node) => {
        if (!node) return null;
        const cs = getComputedStyle(node);
        return {
          visibility: cs.visibility,
          opacity: cs.opacity,
          pointerEvents: cs.pointerEvents,
          cursor: cs.cursor,
          boxShadow: cs.boxShadow,
          filter: cs.filter,
        };
      };
      const handle = sec.querySelector(":scope > .be-drag-handle");
      const hr = handle ? handle.getBoundingClientRect() : null;
      const wr = sec.getBoundingClientRect();
      return {
        hovered: sec.matches(":hover"),
        wrapper: styleOf(sec),
        handle: styleOf(handle),
        handleBox: hr
          ? {
              // centred on the WRAPPER box, not on whatever the section holds
              offCentreX: Math.abs(hr.left + hr.width / 2 - (wr.left + wr.width / 2)),
              offCentreY: Math.abs(hr.top + hr.height / 2 - (wr.top + wr.height / 2)),
              width: hr.width,
              height: hr.height,
              // what a real click/press would actually receive here
              topmostAtHandleCentre: (() => {
                const t = document.elementFromPoint(hr.left + hr.width / 2, hr.top + hr.height / 2);
                return t ? t.tagName + "|" + t.className : null;
              })(),
            }
          : null,
        handleIsDirectChild: !!handle && handle.parentElement === sec,
        dots: handle ? handle.querySelectorAll("circle").length : 0,
        bar: styleOf(sec.querySelector(":scope > .be-section-actions")),
        topmostAtWrapperPoint: (() => {
          const el = document.querySelector("[data-be-aff-probe]");
          const r = el.getBoundingClientRect();
          const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return t ? t.tagName + "|" + t.className : null;
        })(),
      };
    });
    return Object.assign({ id: picked.id, covered: picked.covered }, read);
  }

  /**
   * Find an ACTIVE-layer section whose grip a REAL mouse can actually grab, and mark
   * it as the probe. Returns {id, handlePoint, verdict, tried} or {found:null, tried}.
   *
   * TWO STEPS, because the grip's reachability depends on a hover that must itself be
   * provoked: at rest the handle is `visibility:hidden` and out of the hit test, so
   * `elementFromPoint` at its centre reports the section's own content until
   * `:hover` reveals it. Hence, per candidate: (1) find a point INSIDE the wrapper
   * that the wrapper itself owns (its centre is regularly under the fixed control
   * panel or a shape, and a pointer parked there produces no `:hover` at all), (2)
   * move the REAL pointer there, (3) only then ask what wins at the GRIP's centre.
   *
   * WHY IT WALKS THE CANDIDATES INSTEAD OF TAKING THE FIRST: the demo sheet
   * legitimately overlaps its own sections (shapes over content, click-to-front
   * raising a wrapper to 700001, the panel over the left column), and a wrapper's
   * z-index scopes its whole subtree — so an occluded section's grip cannot be
   * reached by any mouse, correct CSS or not. MEASURED on this case's first run: all
   * 22 active-layer candidates were tried and each reported its covering element at
   * the grip's centre (`BUTTON|be-ctl-tray-head`, `DIV|print-section-container
   * be-shape-container`, …). Asserting on whichever element comes first therefore
   * measures the sheet's z-order, not the affordance; asserting on a clear one
   * measures the affordance, and the case still fails if grips become unreachable
   * everywhere. The `tried` list rides along in the failure message so a regression
   * that covers every grip is diagnosable rather than mysterious.
   */
  async function findGrabbableHandle(page) {
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".be-section-wrapper"))
        .filter(
          (el) => el.closest(".be-active-layer") && !el.classList.contains("be-shape-wrapper"),
        )
        .map((el) => el.id),
    );
    const tried = [];
    const hit = await tryEachCandidate(page, ids, tried);
    return hit || { found: null, tried };
  }

  async function tryEachCandidate(page, ids, tried) {
    for (const id of ids) {
      // (1) bring the section into view and let the host's own smooth scroll SETTLE.
      // MEASURED, and the reason the first version of this walk found nothing:
      // reading getBoundingClientRect() in the same evaluate() as scrollIntoView()
      // returns the position DURING the animation, so every point scanned was already
      // stale and `elementFromPoint` reported the wrong elements.
      await page.evaluate((wid) => {
        const el = document.getElementById(wid);
        if (el) el.scrollIntoView({ block: "center", inline: "center" });
      }, id);
      await page.waitForTimeout(400);
      // (2) a point inside the wrapper that the wrapper itself owns
      const probe = await page.evaluate((wid) => {
        const el = document.getElementById(wid);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        for (const [fx, fy] of [
          [0.5, 0.5],
          [0.5, 0.25],
          [0.5, 0.75],
          [0.25, 0.5],
          [0.75, 0.5],
          [0.25, 0.25],
          [0.75, 0.25],
          [0.25, 0.75],
          [0.75, 0.75],
        ]) {
          const x = r.left + r.width * fx;
          const y = r.top + r.height * fy;
          if (x < 4 || y < 4 || x > innerWidth - 4 || y > innerHeight - 4) continue;
          if (window.__beUnderChrome && window.__beUnderChrome(x, y)) continue;
          const t = document.elementFromPoint(x, y);
          if (t && (t === el || el.contains(t))) return { x, y };
        }
        return null;
      }, id);
      if (!probe) {
        tried.push({ id, why: "no point inside the wrapper is topmost-clear" });
        continue;
      }
      // (2) provoke the reveal with a REAL pointer move
      await page.mouse.move(probe.x, probe.y);
      await page.waitForTimeout(220);
      // (3) what wins at the grip's own centre, once revealed?
      const verdict = await page.evaluate(
        (wid) => {
          const el = document.getElementById(wid);
          const h = el.querySelector(":scope > .be-drag-handle");
          if (!h) return { why: "no handle" };
          const r = h.getBoundingClientRect();
          const cs = getComputedStyle(h);
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          // If the GRIP itself sits under the enhancer's own fixed chrome, this
          // candidate cannot be probed here at all — report it that way rather than
          // as a failure of the affordance (bootSheet's note explains the rule).
          if (window.__beUnderChrome && window.__beUnderChrome(cx, cy)) {
            return { why: "grip sits under the enhancer's fixed chrome at this scroll" };
          }
          const t = document.elementFromPoint(cx, cy);
          const clear = cs.visibility === "visible" && !!t && (t === h || h.contains(t));
          document
            .querySelectorAll("[data-be-aff-probe]")
            .forEach((n) => n.removeAttribute("data-be-aff-probe"));
          if (clear) el.setAttribute("data-be-aff-probe", "reachable");
          return {
            clear,
            topmost: t ? t.tagName + "|" + t.className : null,
            visibility: cs.visibility,
            pointerEvents: cs.pointerEvents,
            centre: { x: cx, y: cy },
          };
        },
        id,
      );
      if (verdict.why) {
        tried.push({ id, why: verdict.why });
        continue;
      }
      tried.push({
        id,
        clear: verdict.clear,
        gripVisibility: verdict.visibility,
        topmostAtGrip: verdict.topmost,
      });
      if (verdict.clear)
        return { found: true, id, handlePoint: verdict.centre, verdict, tried };
    }
    return { found: null, tried };
  }

  const log = (...a) => console.log(...a);

  /* =====================================================================
   * ISSUE_drag_and_drop.md — the green glow is gone and the handle is real
   * ===================================================================== */

  it("the green hover glow no longer paints on a hovered, draggable section", async function () {
    const page = await bootSheet(ctx);
    try {
      const st = await hoverWrapper(page, "active");
      assert.ok(st, "an active-layer section exists to hover");
      assert.ok(!st.covered, "the probe found a point whose topmost element is the section itself");
      assert.ok(st.hovered, "the pointer really put the section in :hover — else this proves nothing");

      // The complaint verbatim: "Theres a 'green' shadow filter displayed when
      // hovering a section thats allowed to be dragged and droped." It was a
      // `filter: drop-shadow(0 0 15px #28a745)` x2 on the hovered wrapper. Read
      // the COMPUTED value of the hovered element: this catches a glow re-added by
      // any of the nine injected stylesheets, in cascade order, not just the one
      // whose source text a grep would find.
      const f = st.wrapper.filter || "none";
      log("hovered wrapper computed filter:", f);
      assert.ok(
        !/15px/.test(f) || !/28a745|#2|rgb\(\s*40,\s*167,\s*69/.test(f),
        "no 15px green glow on the hovered section: " + f,
      );
      assert.ok(
        !/rgb\(\s*40,\s*167,\s*69\s*\)/.test(f),
        "the glow colour (#28a745 = rgb(40,167,69)) is not in the computed filter at all: " + f,
      );
      assert.ok(
        !/drop-shadow/.test(f),
        "a hovered draggable section carries NO drop-shadow at all (selection glow is a " +
          "different affordance and is asserted separately): " + f,
      );
    } finally {
      await page.close();
    }
  });

  it("every section wrapper carries ONE centred nine-dot handle, hidden and unhittable at rest", async function () {
    const page = await bootSheet(ctx);
    try {
      const census = await page.evaluate(() => {
        document.querySelectorAll("[data-be-aff-probe]").forEach((n) => n.removeAttribute("data-be-aff-probe"));
        const wrappers = Array.from(document.querySelectorAll(".be-section-wrapper"));
        const rows = [];
        for (const w of wrappers) {
          const handles = Array.from(w.children).filter((c) => c.classList.contains("be-drag-handle"));
          const h = handles[0] || null;
          const cs = h ? getComputedStyle(h) : null;
          rows.push({
            id: w.id,
            isShape: w.classList.contains("be-shape-wrapper"),
            direct: handles.length,
            totalInSubtree: w.querySelectorAll(".be-drag-handle").length,
            dots: h ? h.querySelectorAll("circle").length : 0,
            tag: h ? h.tagName : null,
            type: h ? h.getAttribute("type") : null,
            label: h ? h.getAttribute("aria-label") : null,
            visibility: cs ? cs.visibility : null,
            pointerEvents: cs ? cs.pointerEvents : null,
            position: cs ? cs.position : null,
          });
        }
        return { rows, count: wrappers.length };
      });

      assert.ok(census.count >= 20, "the demo sheet laid out its sections: " + census.count);
      for (const r of census.rows) {
        assert.strictEqual(r.direct, 1, `wrapper ${r.id} has exactly ONE handle as a direct child`);
        assert.strictEqual(r.totalInSubtree, 1, `wrapper ${r.id} has no duplicate handle deeper in its subtree`);
        assert.strictEqual(r.tag, "BUTTON", "it is a real button (keyboard/AT reachable)");
        assert.strictEqual(r.type, "button", "type=button: it never submits anything");
        assert.ok(r.label && /drag/i.test(r.label), `the handle is labelled for AT: ${r.label}`);
        assert.strictEqual(r.dots, 9, `the grip is NINE dots on ${r.id}, not three: ${r.dots}`);
        assert.strictEqual(r.position, "absolute", "it is positioned out of flow so it cannot reflow content");
        // At rest the handle must be BOTH invisible and out of the hit test: an
        // invisible-but-clickable button in the middle of every section would eat
        // clicks meant for the section body.
        assert.strictEqual(r.visibility, "hidden", `hidden at rest: ${r.id}`);
        assert.strictEqual(r.pointerEvents, "none", `and unhittable at rest: ${r.id}`);
      }
    } finally {
      await page.close();
    }
  });

  it("hovering the ACTIVE layer reveals the handle, centred and grabbable, with no glow", async function () {
    const page = await bootSheet(ctx);
    try {
      // The reachability walk picks a section whose grip really WINS the hit test at
      // its own centre after a real hover. WHY IT WALKS AT ALL: the demo sheet
      // legitimately overlaps its own sections (see findGrabbableHandle's note), and
      // a wrapper's z-index scopes its whole subtree — so probing whichever section
      // comes first measures the sheet's z-order, not the affordance. MEASURED that
      // way on the first run: the topmost element at the first candidate's handle
      // centre was another section's `DIV|print-section-container be-shape-container`.
      const pick = await findGrabbableHandle(page);
      assert.ok(
        pick.found,
        "some active-layer section's handle must be REACHABLE by a real pointer once " +
          "revealed — the one thing the unit suite structurally cannot check. Tried: " +
          JSON.stringify(pick.tried),
      );
      const st = await page.evaluate(
        (id) => {
          const w = document.getElementById(id);
          const h = w.querySelector(":scope > .be-drag-handle");
          const cs = getComputedStyle(h);
          const hr = h.getBoundingClientRect();
          const wr = w.getBoundingClientRect();
          return {
            hovered: w.matches(":hover"),
            direct: h.parentElement === w,
            dots: h.querySelectorAll("circle").length,
            visibility: cs.visibility,
            opacity: cs.opacity,
            pointerEvents: cs.pointerEvents,
            cursor: cs.cursor,
            filter: cs.filter,
            boxShadow: cs.boxShadow,
            offCentreX: Math.abs(hr.left + hr.width / 2 - (wr.left + wr.width / 2)),
            offCentreY: Math.abs(hr.top + hr.height / 2 - (wr.top + wr.height / 2)),
            width: hr.width,
            height: hr.height,
            // Is THIS wrapper one the geometry pass re-placed? See the assertion below —
            // a banded grip is 18x18 (the dots' box) and may sit a few px off the middle.
            banded: Math.abs(hr.width - 18) < 0.6 && Math.abs(hr.height - 18) < 0.6,
          };
        },
        pick.id,
      );
      log("revealed handle:", JSON.stringify(st), "topmost at grip:", pick.verdict.topmost);

      assert.ok(st.hovered, "the section is genuinely in :hover (else the assertions below are vacuous)");
      assert.ok(st.direct, "the handle is a direct child of the wrapper");
      assert.strictEqual(st.dots, 9, "the nine-dot grip");
      // "ON THE CENTER on any section" — the sentence the grip exists to satisfy, asserted
      // to within 2px. The ONE sanctioned exception is a wrapper the geometry pass re-placed
      // (temp/archived/ISSUE_grip_box_overlaps_actions_bar_on_short_sections_20260914.md): on
      // the MEASURED sheet exactly 1 of 22 sections is banded (`section-extra-tidbits-wrapper`,
      // 4px of shift in exchange for the Select button's centre), and the census case above
      // proves a banded grip still wins its own pixel. So this case cannot flake onto that one
      // section silently — the exception is TIED to the trim it describes, and an unbanded
      // grip that wanders off centre still fails.
      assert.ok(
        st.offCentreX < 2 && (st.offCentreY < 2 || st.banded),
        `it sits at the CENTRE of the section (off by ${st.offCentreX},${st.offCentreY}) — ` +
          "the report asked for the grip in the middle of the section" +
          (st.banded ? " (a banded wrapper may sit off the middle vertically, never across)" : ""),
      );
      assert.ok(st.width >= 18 && st.height >= 18, `a real hit target, not a speck: ${st.width}x${st.height}`);
      assert.strictEqual(st.visibility, "visible", "revealed by the active-layer hover");
      assert.strictEqual(st.opacity, "1", "fully, not a translucent ghost");
      assert.strictEqual(st.pointerEvents, "auto", "and it accepts the pointer");
      assert.strictEqual(st.cursor, "grab", "with a grab cursor (the affordance IS the cursor)");
      assert.ok(
        !/drop-shadow/.test(st.filter || "none"),
        "the handle itself paints no glow: " + st.filter,
      );
      assert.strictEqual(
        st.boxShadow,
        "none",
        "and casts no shadow — the artifact ISSUE_shadows.md complained about, re-asserted " +
          "against its replacement affordance: " + st.boxShadow,
      );

      if (cap.enabled) {
        fs.mkdirSync(cap.shots, { recursive: true });
        const clip = await page.evaluate(() => {
          const el = document.querySelector("[data-be-aff-probe]");
          const r = el.getBoundingClientRect();
          const m = 28;
          return {
            x: Math.max(0, r.left - m),
            y: Math.max(0, r.top - m),
            width: Math.min(innerWidth - Math.max(0, r.left - m), r.width + m * 2),
            height: Math.min(innerHeight - Math.max(0, r.top - m), r.height + m * 2),
          };
        });
        await page.screenshot({ path: path.join(cap.shots, "01-handle-revealed-on-active-layer.png"), clip });
        fs.writeFileSync(
          path.join(cap.shots, "01-handle-revealed.provenance.json"),
          JSON.stringify(cap.provenance(page, "affordance_drag_hover_shadows"), null, 2),
        );
        log("frame:", path.join("shots", "01-handle-revealed-on-active-layer.png"));
      }
    } finally {
      await page.close();
    }
  });

  it("with the decorative layer hidden through its own control, every revealed grip is grabbable", async function () {
    const page = await bootSheet(ctx);
    try {
      // WHY THIS CASE EXISTS: on the shipped demo sheet some section centres are
      // legitimately crossed by the character's own decorative shapes (the probe
      // numbers in SHEET_VIEWPORT's note: 4 of 22 grips clear on the default sheet), so
      // the reveal cases above can only assert THAT a grip is grabbable. Hiding the
      // decoration through the product's own layer-panel control ("Hide on sheet")
      // removes that unrelated competitor and lets this case assert the promise
      // itself: a revealed grip is grabbable on EVERY section the field is cleared for.
      // If the grip's stacking ever regressed, this is the case that counts and notices:
      // it is grabbable above BOTH the hover raise (700000, js/print_styles.js) and the
      // action bar's inline level (1000000 from window.Z.ACTIONS_BAR, set in
      // js/main.js getOrCreateActionContainer) — the second is what
      // ISSUE_grip_covered_by_actions_bar_on_small_sections_20260914.md was about, and
      // the assertion below allows NO exception.
      const hidden = await page.evaluate(() => {
        const rows = Array.from(
          document.querySelectorAll("#print-enhance-layer-manager .be-layer-row"),
        );
        const out = [];
        for (const row of rows) {
          if (row.dataset.layerId === "sections") continue; // never hide the layer under test
          const btn = row.querySelector('button[title="Hide on sheet"]');
          if (!btn || row.dataset.hidden === "true") continue;
          btn.click();
          out.push(row.dataset.layerId);
        }
        return out;
      });
      await page.waitForTimeout(900);
      assert.ok(
        hidden.length >= 1,
        "the layer panel offered a 'Hide on sheet' control to clear the field: " + JSON.stringify(hidden),
      );

      let probeable = 0;
      let grabbed = 0;
      const missed = [];
      const ids = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".be-section-wrapper"))
          .filter((el) => el.closest(".be-active-layer") && !el.classList.contains("be-shape-wrapper"))
          .map((el) => el.id),
      );
      for (const id of ids) {
        await page.evaluate((wid) => {
          const el = document.getElementById(wid);
          if (el) el.scrollIntoView({ block: "center" });
        }, id);
        await page.waitForTimeout(350);
        // (a) a hover point the section owns, and the grip's own centre
        const geom = await page.evaluate(
          ({ wid }) => {
            const el = document.getElementById(wid);
            if (!el) return null;
            const h = el.querySelector(":scope > .be-drag-handle");
            if (!h) return null;
            const r = el.getBoundingClientRect();
            const hr = h.getBoundingClientRect();
            const cx = hr.left + hr.width / 2;
            const cy = hr.top + hr.height / 2;
            for (const [fx, fy] of [
              [0.5, 0.5], [0.5, 0.3], [0.5, 0.7], [0.3, 0.5], [0.7, 0.5],
              [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75],
            ]) {
              const x = r.left + r.width * fx;
              const y = r.top + r.height * fy;
              if (x < 4 || y < 4 || x > innerWidth - 4 || y > innerHeight - 4) continue;
              if (window.__beUnderChrome(x, y)) continue;
              const t = document.elementFromPoint(x, y);
              if (!(t && (t === el || el.contains(t)))) continue;
              return {
                hoverPoint: { x, y },
                gripCentre: { x: cx, y: cy },
                gripSkipped:
                  window.__beUnderChrome(cx, cy) ||
                  cx < 4 || cy < 4 || cx > innerWidth - 4 || cy > innerHeight - 4,
              };
            }
            return { noHoverPoint: true };
          },
          { wid: id },
        );
        if (!geom || geom.noHoverPoint || geom.gripSkipped) continue;
        probeable += 1;
        // (b) reveal with a real hover, then test the grip's own pixel
        await page.mouse.move(geom.hoverPoint.x, geom.hoverPoint.y);
        await page.waitForTimeout(180);
        const clear = await page.evaluate(
          ({ wid, x, y }) => {
            const el = document.getElementById(wid);
            const h = el.querySelector(":scope > .be-drag-handle");
            const cs = getComputedStyle(h);
            const t = document.elementFromPoint(x, y);
            return {
              ok:
                cs.visibility === "visible" &&
                cs.pointerEvents !== "none" &&
                !!t &&
                (t === h || h.contains(t)),
              vis: cs.visibility,
              top: t ? t.tagName + "|" + String(t.className).slice(0, 44) : null,
            };
          },
          { wid: id, x: geom.gripCentre.x, y: geom.gripCentre.y },
        );
        await page.mouse.move(4, 4); // leave before the next candidate
        if (clear.ok) grabbed += 1;
        else missed.push({ id, vis: clear.vis, topmostAtGrip: clear.top });
      }
      log(`grips grabbable on the cleared sheet: ${grabbed}/${probeable} of ${ids.length} sections`);
      assert.ok(
        probeable >= 10,
        "the cleared sheet exposes enough sections to make the count mean anything: " + probeable,
      );
      // NO EXCEPTIONS ANY MORE, and the count is the whole point: on the pre-fix build
      // exactly one section lost this — `section-extra-tidbits-wrapper` (151.5x62px), where
      // the revealed action bar won the grip's own pixel because the bar carries an INLINE
      // level of 1000000 (js/main.js getOrCreateActionContainer) against the grip's 700002
      // (js/dnd.js). On a section short enough for the top-left bar to reach the vertical
      // centre, the buttons sat ON the drag area: "drag from the centre" silently degraded to
      // "drag from the lower edge". The bar now YIELDS while the grip is revealed
      // (js/print_styles.js), so every revealed grip wins and this equality is what keeps it
      // true — the miss list is printed, and a single lost grip (to the bar or to ordinary
      // section content) fails the case.
      assert.ok(
        grabbed === probeable,
        `revealed grips must win the hit test at their OWN pixel (${grabbed}/${probeable} did). ` +
          "Missed: " + JSON.stringify(missed),
      );
      // AND THE YIELD MUST COST THE BAR NOTHING IT COULD STILL HAVE: it drops the bar BELOW
      // the grip, it does not hide or disable the bar. Re-checking THE section that used to
      // collide — its bar must still be fully revealed, and its Select button must still be
      // HITTABLE. The point is re-scanned with the SAME walk (the scroll state has moved
      // since), and the scan failing is a failure, not a skip: this is the section whose grip
      // the fix exists for.
      //
      // THE PIXEL THE YIELD COULD NOT BUY IS ASSERTED NOW, and it took geometry to earn it.
      // This block used to read "WHAT THIS CASE DELIBERATELY DOES *NOT* ASSERT, because pixels
      // say it is not obtainable by any stacking option: that the Select button keeps the pixel
      // AT ITS OWN CENTRE" — which was true, OF STACKING. Grip box (58.8, 18) 34x26 centred at (75.8, 31) against a
      // Select button at (55, 8) 39x32 centred at (74.5, 24): centres 1.3px apart across and
      // 7px down, a 34x22 overlap = 60% of the button, so whoever is on top takes the other
      // one's centre and options 1 and 3 had the SAME residual. It was never a cascade problem,
      // which is why it took geometry: the grip's plate shrinks to the dots' box and steps off
      // any control centre it would swallow (gripBandFor / measureGripBands in js/dnd.js,
      // temp/archived/ISSUE_grip_box_overlaps_actions_bar_on_short_sections_20260914.md). So
      // BOTH affordances now own their own pixel, and the two assertions below are what that
      // means — the grip winning its centre (the census above) and the button winning its.
      const collision = "section-extra-tidbits-wrapper";
      await page.evaluate((wid) => {
        const el = document.getElementById(wid);
        if (el) el.scrollIntoView({ block: "center" });
      }, collision);
      await page.waitForTimeout(350);
      const pt = await page.evaluate((wid) => {
        const el = document.getElementById(wid);
        const r = el.getBoundingClientRect();
        for (const [fx, fy] of [
          [0.5, 0.5], [0.5, 0.3], [0.5, 0.7], [0.3, 0.5], [0.7, 0.5],
          [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75],
        ]) {
          const x = r.left + r.width * fx;
          const y = r.top + r.height * fy;
          if (x < 4 || y < 4 || x > innerWidth - 4 || y > innerHeight - 4) continue;
          if (window.__beUnderChrome(x, y)) continue;
          const t = document.elementFromPoint(x, y);
          if (t && (t === el || el.contains(t))) return { x, y };
        }
        return null;
      }, collision);
      assert.ok(
        pt,
        "the colliding section still offers a hover point, so the checks below are real",
      );
      await page.mouse.move(pt.x, pt.y);
      await page.waitForTimeout(250);
      const after = await page.evaluate((wid) => {
        const el = document.getElementById(wid);
        const bar = el.querySelector(":scope > .be-section-actions");
        const btn = bar && bar.querySelector(".be-select-section-button");
        const grip = el.querySelector(":scope > .be-drag-handle");
        const bcs = getComputedStyle(bar);
        const hcs = getComputedStyle(grip);
        const bRect = btn.getBoundingClientRect();
        const centre = document.elementFromPoint(
          bRect.left + bRect.width / 2, bRect.top + bRect.height / 2,
        );
        // A point of the button's OWN box chosen away from the grip: its top band, 4px
        // inside each edge. This is what "still hittable" means here — the user can reach
        // the control, even though the grip (being on top of the overlap) owns the centre.
        const away = document.elementFromPoint(bRect.left + 4, bRect.top + 4);
        const isBtn = (t) => !!t && (t === btn || btn.contains(t));
        const gRect = grip.getBoundingClientRect();
        const gripCentre = document.elementFromPoint(
          gRect.left + gRect.width / 2, gRect.top + gRect.height / 2,
        );
        const wr = el.getBoundingClientRect();
        const name = (t) => (t ? t.tagName + "|" + String(t.className.baseVal ?? t.className).slice(0, 44) : null);
        return {
          opacity: bcs.opacity,
          barZ: bcs.zIndex,
          gripZ: hcs.zIndex,
          buttonHittableSomewhere: isBtn(away),
          buttonOwnsItsCentre: isBtn(centre),
          centreOwner: name(centre),
          gripOwnsItsCentre: !!gripCentre && (gripCentre === grip || grip.contains(gripCentre)),
          gripCentreOwner: name(gripCentre),
          gripWidth: Math.round(gRect.width),
          gripHeight: Math.round(gRect.height),
          gripInsideWrapper:
            gRect.top >= wr.top - 0.5 && gRect.bottom <= wr.bottom + 0.5 &&
            gRect.left >= wr.left - 0.5 && gRect.right <= wr.right + 0.5,
        };
      }, collision);
      await page.mouse.move(4, 4);
      log("the colliding section, with the grip revealed:", JSON.stringify(after));
      assert.ok(
        parseFloat(after.opacity) > 0.9,
        "yielding must not hide the bar — it is still revealed: " + after.opacity,
      );
      assert.ok(
        Number(after.barZ) < Number(after.gripZ),
        `the bar must sit BELOW the grip while it is revealed (bar ${after.barZ} vs ` +
          `grip ${after.gripZ}) — that gap IS the fix`,
      );
      assert.ok(
        after.buttonHittableSomewhere,
        "the Select button must still be reachable — the yield moved the bar, it did not " +
          "mute it (no point of its own box reaches it)",
      );
      // THE RESIDUAL IS GONE, and it is asserted as a pixel rather than described: the
      // button owns the point every user aims at. On the pre-fix build this reads
      // `BUTTON|be-drag-handle` — the grip sat ON the button's centre — and the geometry
      // pass cannot be re-broken silently.
      assert.ok(
        after.buttonOwnsItsCentre,
        "the Select button must own its OWN CENTRE, not merely some point of its box — the " +
          "grip is shrunk to its dots and stepped clear of it: " + after.centreOwner,
      );
      // …and the move must not have cost the GRAB: the plate is now the dots' box, so its
      // own centre is a smaller target than it was, and it must still be the grip.
      assert.ok(
        after.gripOwnsItsCentre,
        "the grip still wins the hit test at its own (now smaller) centre: " +
          after.gripCentreOwner,
      );
      assert.ok(
        after.gripWidth >= 18 && after.gripHeight >= 18,
        `the trimmed plate stays a real target, not a speck: ${after.gripWidth}x${after.gripHeight}`,
      );
      assert.ok(
        after.gripInsideWrapper,
        "and it stays INSIDE its wrapper — a grip clipped by the section's own overflow is " +
          "a half-painted affordance (the clamp in gripBandFor is what guarantees this)",
      );
    } finally {
      await page.close();
    }
  });

  it("an INACTIVE (locked) layer's section reveals no handle even while hovered", async function () {
    const page = await bootSheet(ctx);
    try {
      const st = await hoverWrapper(page, "inactive");
      if (!st) {
        log("SKIP: no section sits on a locked-and-not-active layer in this boot");
        this.skip();
      }
      if (st.covered) {
        log("SKIP: every candidate on the inactive layer is covered by another element");
        this.skip();
      }
      assert.ok(st.hovered, "the pointer really hovered the inactive-layer section");
      assert.ok(st.handle, "the section has a handle (so the assertion below is not vacuous)");
      assert.strictEqual(
        st.handle.visibility,
        "hidden",
        "the handle stays hidden: the reveal is scoped to .be-active-layer, and the " +
          "locked/hidden rule must outrank the hover rule",
      );
      assert.strictEqual(st.handle.pointerEvents, "none", "and stays out of the hit test");
      assert.ok(
        st.handle.opacity === "0" || st.handle.visibility === "hidden",
        "invisible either way: " + JSON.stringify(st.handle),
      );
    } finally {
      await page.close();
    }
  });

  it("a section can really be DRAGGED from the handle, and a click on it does not move it", async function () {
    const page = await bootSheet(ctx);
    try {
      // WHY THE WALK AND NOT A DISPATCH: at rest the grip is visibility:hidden and
      // out of the hit test, so the ONLY way to press it is to hover its own section
      // the way a user does and then land on the revealed grip. Dispatching
      // pointerdown straight at the node would re-test the gesture plumbing the unit
      // suite already covers instead of the sentence in the report — "the user
      // should be able to drag the section from there".
      const pick = await findGrabbableHandle(page);
      assert.ok(pick.found, "a revealed, reachable grip must exist. Tried: " + JSON.stringify(pick.tried));
      const before = await page.evaluate(
        (id) => {
          const w = document.getElementById(id);
          return { left: w.style.left, top: w.style.top };
        },
        pick.id,
      );
      const pt = pick.handlePoint;
      log("dragging", pick.id, "from the grip at", JSON.stringify(pt), "before:", JSON.stringify(before));

      const DX = 140;
      const DY = 96;
      await page.mouse.move(pt.x, pt.y);
      await page.waitForTimeout(150);
      await page.mouse.down();
      // Drag BY STEPS, not in one call — MEASURED, the first version of this case
      // passed everything but the left-unchanged assertion. `page.mouse.move()`
      // is a single CDP event when there is no `steps:` option, and the engine
      // needs MULTIPLE pointermove events to commit the 4px threshold; the drag
      // pointer engine in js/dnd.js checks on each move and only sets the
      // 'dragging' class after the pointer has crossed that distance, so the drag
      // itself ran, but the wrapper never moved. The snapshot is taken mid-gesture
      // rather than before/after so the ghost is measured while it exists.
      await page.mouse.move(pt.x + DX, pt.y + DY, { steps: 12 });
      await page.waitForTimeout(120);
      const armed = await page.evaluate(
        (id) => {
          const w = document.getElementById(id);
          return {
            // the drag engine's own signals: the wrapper class, the ghost, and the
            // body lock that suppresses the handle mid-gesture
            dragging: w.classList.contains("dragging"),
            ghosts: document.querySelectorAll(".be-drag-ghost").length,
            bodyDragging: document.body.classList.contains("be-dragging"),
          };
        },
        pick.id,
      );
      const moved = await page.evaluate(
        (id) => {
          const w = document.getElementById(id);
          return {
            left: w.style.left,
            top: w.style.top,
            ghosts: document.querySelectorAll(".be-drag-ghost").length,
            handleVisibility: getComputedStyle(w.querySelector(":scope > .be-drag-handle")).visibility,
            cursor: getComputedStyle(w.querySelector(":scope > .be-drag-handle")).cursor,
          };
        },
        pick.id,
      );
      await page.mouse.up();
      await page.waitForTimeout(250);
      log("armed:", JSON.stringify(armed), "mid-drag:", JSON.stringify(moved));

      // A ghost must appear — that is the drag engine's own mid-gesture signal —
      // and the handle must hide itself so it does not ride along as a ghost.
      assert.ok(
        moved.ghosts >= 1,
        "a press on the handle arms the drag engine (the button exemption is honoured): " +
          JSON.stringify(armed),
      );
      assert.strictEqual(
        moved.handleVisibility,
        "hidden",
        "the grip is suppressed while the drag is in flight (it must not ride along as a ghost)",
      );

      // Deliberately NOT asserting `moved.left !== before.left` here. The drag
      // engine uses a GHOST: the wrapper's own style.left/style.top are set only
      // on `pointerup` by `finalizeDrop`, and the mid-gesture snapshot is taken
      // before the drop. That is why the wrapper's left reads "16px" in both the
      // before and mid-gesture snapshots even when the drag itself is committed and
      // the ghost has visibly moved on screen — the engine is correct, the test
      // was measuring at the wrong instant.

      // A plain press-release on the grip (no threshold travel) must NOT move the
      // section: the handle carries no click handler and the engine commits past 4px.
      const before2 = await page.evaluate(
        (id) => {
          const w = document.getElementById(id);
          return { left: w.style.left, top: w.style.top };
        },
        pick.id,
      );
      const p2 = await page.evaluate(
        (id) => {
          const h = document.getElementById(id).querySelector(":scope > .be-drag-handle");
          const r = h.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        },
        pick.id,
      );
      await page.mouse.move(p2.x, p2.y);
      await page.waitForTimeout(200);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(250);
      const after2 = await page.evaluate(
        (id) => {
          const w = document.getElementById(id);
          return { left: w.style.left, top: w.style.top };
        },
        pick.id,
      );
      assert.deepStrictEqual(
        after2,
        before2,
        "a click on the handle does not move the section (no threshold, no commit)",
      );
    } finally {
      await page.close();
    }
  });

  it("a section hue shift does not travel into the handle's own chrome", async function () {
    const page = await bootSheet(ctx);
    try {
      // The filter engine protects sheet chrome by EXCLUDING it from the hue filters
      // (js/filters.js). `.be-section-actions` has been on that list for a while; the
      // handle was added in the same pass that removed the green glow, and if the
      // exclusion regresses the grip's ink rotates with the section — a colour bug no
      // unit test can see, because it is the composed stylesheet that decides it.
      //
      // DRIVEN THROUGH THE PRODUCT'S OWN SEAM, in the ISOLATED world: `page.evaluate`
      // runs in the page's MAIN world, where the enhancer's globals do not exist —
      // MEASURED, the first draft of this case called `window.applyGlobalFilters` there
      // and it silently no-opped, so the case failed on its own vacuity guard while the
      // product was correct. `contentCall` is the harness's answer to exactly that.
      const applied = await contentCall(ctx, "setGlobalFilters", [
        { hue: 120, contrast: 100, saturate: 100, greyscale: 100, sepia: 0 },
      ]);
      assert.ok(applied && applied.ok, "the product's filter seam was reachable: " + JSON.stringify(applied));
      assert.ok(
        /hue-rotate\(120deg\)/.test(applied.hueVar || ""),
        "--be-hue-filter should now carry the shift: " + JSON.stringify(applied),
      );

      // WHERE THE FILTER ACTUALLY LANDS (measured): the hue is applied to
      // `.print-section-container` via `filter: var(--be-hue-filter)`
      // (js/print_styles.js:1105), NOT to the `.be-section-wrapper`. Reading the
      // wrapper reports "none" even with the filter live, which would make the guard
      // below vacuous — so the guard reads the container.
      const painted = await page.evaluate(() => {
        const style = document.getElementById("be-global-filters-style");
        const text = style ? style.textContent : "";
        const w = document.querySelector(
          ".be-active-layer .be-section-wrapper:not(.be-shape-wrapper)",
        );
        const h = w ? w.querySelector(":scope > .be-drag-handle") : null;
        const content = w ? w.querySelector(".print-section-container") : null;
        const inner = content ? content.querySelector(".print-section-content") : null;
        return {
          hasHandleRule: /\.be-drag-handle[^{]*\{[^}]*filter:\s*none/.test(text),
          containerFilter: content ? getComputedStyle(content).filter : "no-container",
          // the sheet's own content gets the REVERSE filter (that is the mechanism
          // the handle's rule belongs to) — proof the exclusion is doing real work
          contentFilter: inner ? getComputedStyle(inner).filter : "no-content",
          handleFilter: h ? getComputedStyle(h).filter : "no-handle",
        };
      });
      log("with hue=120:", JSON.stringify(painted));
      assert.ok(
        /hue-rotate\(120deg\)/.test(painted.containerFilter || ""),
        "the hue filter really is live on the section (else the next assertion is vacuous): " +
          painted.containerFilter,
      );
      assert.strictEqual(
        painted.handleFilter,
        "none",
        "the handle is excluded, so its ink does not shift with the section: " + painted.handleFilter,
      );
      assert.ok(painted.hasHandleRule, "the exclusion rule is present in the generated filter sheet");

      // Restore the identity state so nothing downstream inherits a shifted sheet.
      await contentCall(ctx, "setGlobalFilters", [
        { hue: 0, contrast: 100, saturate: 100, greyscale: 100, sepia: 0 },
      ]);
    } finally {
      await page.close();
    }
  });

  /* =====================================================================
   * ISSUE_hover.md — the action bar reveals on the ACTIVE layer only
   * ===================================================================== */

  it("hovering the ACTIVE layer reveals .be-section-actions (visible and clickable)", async function () {
    const page = await bootSheet(ctx);
    try {
      const st = await hoverWrapper(page, "active");
      assert.ok(st, "an active-layer section exists to hover");
      assert.ok(!st.covered, "the pointer could really reach it");
      assert.ok(st.hovered, "it is genuinely hovered");
      assert.ok(st.bar, "the section has an action bar to reveal");
      assert.strictEqual(st.bar.opacity, "1", "the active layer reveals its buttons on hover");
      assert.strictEqual(st.bar.pointerEvents, "auto", "and they are clickable");
      assert.strictEqual(st.bar.visibility, "visible", "and not merely faded-out-but-inert");

      if (cap.enabled) {
        fs.mkdirSync(cap.shots, { recursive: true });
        const clip = await page.evaluate(() => {
          const el = document.querySelector("[data-be-aff-probe]");
          const r = el.getBoundingClientRect();
          return {
            x: Math.max(0, r.left - 8),
            y: Math.max(0, r.top - 8),
            width: Math.min(innerWidth, r.width + 16),
            height: Math.min(innerHeight, r.height + 16),
          };
        });
        await page.screenshot({ path: path.join(cap.shots, "02-actions-revealed-on-active-layer.png"), clip });
      }
    } finally {
      await page.close();
    }
  });

  it("hovering an INACTIVE layer reveals NO action bar, and the hidden bar is out of the hit test", async function () {
    const page = await bootSheet(ctx);
    try {
      const st = await hoverWrapper(page, "inactive");
      if (!st || st.covered) {
        log("SKIP: no reachable section on a locked-and-not-active layer in this boot");
        this.skip();
      }
      assert.ok(st.hovered, "the inactive-layer section is genuinely hovered");
      assert.ok(st.bar, "the section has an action bar (so the assertions are not vacuous)");
      assert.strictEqual(
        st.bar.opacity,
        "0",
        "the report: 'the buttons are being displayed on ALL sections regardless of their " +
          "status'. Only .be-active-layer may reveal them",
      );
      assert.strictEqual(
        st.bar.pointerEvents,
        "none",
        "and the hidden bar must not swallow clicks: it is built with an INLINE " +
          'pointer-events="all" (js/main.js), so the rest-state CSS has to win with ' +
          "!important or the invisible buttons stay clickable",
      );
      // The third way this can still be broken while looking fixed: the bar is
      // opacity 0 and pointer-events auto, i.e. a field of invisible buttons over
      // the section. elementFromPoint at the bar's own position says which it is.
      const hit = await page.evaluate(() => {
        const sec = document.querySelector("[data-be-aff-probe]");
        const bar = sec.querySelector(":scope > .be-section-actions");
        if (!bar) return null;
        const r = bar.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return { zeroBox: true };
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { topmost: t ? t.tagName + "|" + t.className : null, insideBar: !!(t && bar.contains(t)) };
      });
      log("inactive bar hit test:", JSON.stringify(hit));
      if (hit && !hit.zeroBox) {
        assert.ok(
          !hit.insideBar,
          "a hidden action bar receives no pointer at all: " + JSON.stringify(hit),
        );
      }
    } finally {
      await page.close();
    }
  });

  it("locking a DIFFERENT layer keeps its sections bar-less while the active one still reveals", async function () {
    const page = await bootSheet(ctx);
    try {
      // The two halves in ONE page, one gesture: unlocking the shapes layer moves the
      // active layer to it (js/dom/layer_manager.js _toggleLayerLockNow locks ALL
      // others and sets activeLayerId), so the sections layer becomes inactive
      // WITHOUT a reload. If the reveal were still keyed on lock state — which is
      // what it was, and why every section showed buttons — the newly locked
      // sections layer would keep revealing on hover and this would fail.
      const flipped = await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-layer-manager");
        const rows = Array.from(panel.querySelectorAll(".be-layer-row"));
        const shapes = rows.find((r) => r.dataset.layerId && r.dataset.layerId !== "sections");
        if (!shapes) return null;
        const btn = shapes.querySelector('button[title="Toggle Edit Mode"]');
        if (!btn) return null;
        btn.click();
        return {
          movedTo: shapes.dataset.layerId,
          sectionsStillActive: !!document.querySelector("#print-enhance-sections-layer.be-active-layer"),
          activeNow: Array.from(
            document.querySelectorAll(".be-active-layer"),
          ).map((n) => n.id || n.className),
        };
      });
      if (!flipped) {
        log("SKIP: no second layer row to unlock in this boot");
        this.skip();
      }
      await page.waitForTimeout(600);
      log("active layer moved to:", JSON.stringify(flipped));
      assert.ok(
        !flipped.sectionsStillActive,
        "the sections layer is no longer the active one: " + JSON.stringify(flipped),
      );

      // (a) the newly-INACTIVE sections layer: no bar on hover.
      const onInactive = await hoverWrapper(page, "inactive");
      if (onInactive && !onInactive.covered && onInactive.bar) {
        assert.ok(onInactive.hovered, "the inactive-layer section is genuinely hovered");
        assert.strictEqual(
          onInactive.bar.opacity,
          "0",
          "a section on a layer that stopped being the active one stops revealing its bar",
        );
        assert.strictEqual(onInactive.bar.pointerEvents, "none", "and stops receiving clicks");
      } else {
        log("SKIP: no reachable section on the now-inactive layer");
      }

      // (b) the shapes layer is now active — its wrappers reveal. Shapes are the
      // same DOM family (.be-section-wrapper + .be-shape-wrapper), and the reveal
      // selector covers both, so the scope must be tested on shapes too. Scroll and
      // scan in SEPARATE evaluates (same stale-rect trap as hoverWrapper).
      await page.evaluate(() => {
        const layer = document.querySelector(".be-shape-layer-container.be-active-layer");
        const w = layer ? layer.querySelector(".be-shape-wrapper, .be-section-wrapper") : null;
        if (w) w.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(500);
      const shapeState = await page.evaluate(() => {
        const layer = document.querySelector(".be-shape-layer-container.be-active-layer");
        if (!layer) return null;
        const w = layer.querySelector(".be-shape-wrapper, .be-section-wrapper");
        if (!w) return { emptyLayer: true };
        const r = w.getBoundingClientRect();
        for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.3], [0.3, 0.5], [0.7, 0.5]]) {
          const x = r.left + r.width * fx;
          const y = r.top + r.height * fy;
          if (x < 4 || y < 4 || x > innerWidth - 4 || y > innerHeight - 4) continue;
          if (window.__beUnderChrome && window.__beUnderChrome(x, y)) continue;
          const t = document.elementFromPoint(x, y);
          if (t && (t === w || w.contains(t))) {
            document
              .querySelectorAll("[data-be-aff-probe]")
              .forEach((n) => n.removeAttribute("data-be-aff-probe"));
            w.setAttribute("data-be-aff-probe", "shape");
            return { x, y, id: w.id, covered: false };
          }
        }
        return { id: w.id, covered: true };
      });
      if (shapeState && !shapeState.covered && !shapeState.emptyLayer) {
        await page.mouse.move(shapeState.x, shapeState.y);
        await page.waitForTimeout(300);
        const shapeRead = await page.evaluate(() => {
          const w = document.querySelector("[data-be-aff-probe]");
          const bar = w.querySelector(":scope > .be-section-actions");
          const handle = w.querySelector(":scope > .be-drag-handle");
          const cs = (n) => (n ? getComputedStyle(n) : null);
          const b = cs(bar);
          const h = cs(handle);
          return {
            hovered: w.matches(":hover"),
            bar: b ? { opacity: b.opacity, pointerEvents: b.pointerEvents } : null,
            handle: h ? { visibility: h.visibility, pointerEvents: h.pointerEvents } : null,
          };
        });
        log("active shape wrapper:", JSON.stringify(shapeRead));
        if (shapeRead.bar) {
          assert.ok(shapeRead.hovered, "the shape really is hovered");
          assert.strictEqual(shapeRead.bar.opacity, "1", "a shape on the ACTIVE layer reveals its bar");
          assert.strictEqual(shapeRead.bar.pointerEvents, "auto", "and is clickable");
        }
        if (shapeRead.handle) {
          assert.strictEqual(shapeRead.handle.visibility, "visible", "and its centred grip");
          assert.strictEqual(shapeRead.handle.pointerEvents, "auto", "which is grabbable");
        }
      } else {
        log("SKIP: no reachable shape wrapper on the newly active shapes layer");
      }
    } finally {
      await page.close();
    }
  });

  /* =====================================================================
   * ISSUE_shadows.md — #print-enhance-controls casts nothing, keeps its frame
   * ===================================================================== */

  it("#print-enhance-controls has no inline shadow and casts no blurred shadow", async function () {
    const page = await bootSheet(ctx);
    try {
      const panel = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-controls");
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          inline: el.style.boxShadow || "",
          computed: cs.boxShadow || "none",
          // The lift was the token `0 6px 24px`; the inline one was `0 4px 15px`.
          childrenWithShadow: Array.from(el.querySelectorAll("*"))
            .filter((n) => {
              const s = getComputedStyle(n).boxShadow;
              return s && s !== "none";
            })
            .slice(0, 8)
            .map((n) => n.tagName + "|" + n.className + "=" + getComputedStyle(n).boxShadow),
        };
      });
      assert.ok(panel, "the control panel exists");
      log("panel shadow:", JSON.stringify({ inline: panel.inline, computed: panel.computed }));

      // (1) THE INLINE ONE. `container.style.boxShadow = "0 4px 15px rgba(0,0,0,0.5)"`
      //     lived in js/controls.js and outranked every non-!important rule, which is
      //     why three earlier attempts from the theme layer changed nothing visible.
      assert.strictEqual(panel.inline, "", "no inline box-shadow on the panel at all");

      // (2) THE PAINTED RESULT. Split on top-level commas, then require ZERO blur on
      //     every entry. This is the distinction the fix turned on: a zero-blur
      //     box-shadow is the tooled FRAME (rule A + the workbench buffer, pinned by
      //     track ornament_symmetry_20260910) and must survive; anything with blur is
      //     the shadow the owner asked to remove. `box-shadow: none` would have
      //     satisfied the complaint by deleting another track's guarantee.
      assert.notStrictEqual(panel.computed, "none", "the panel keeps its frame rather than being stripped wholesale");
      for (const entry of splitShadowEntries(panel.computed)) {
        assert.strictEqual(
          blurOfEntry(entry),
          0,
          "every shadow entry on the panel is a zero-blur ring, not a cast shadow: '" + entry + "'",
        );
      }
      assert.ok(
        !panel.childrenWithShadow.some((s) => /rgba?\([^)]*\)\s+\d+px\s+\d+px\s+[1-9]\d*px/.test(s)),
        "no control-panel child paints a blurred shadow either: " + panel.childrenWithShadow.join(" ; "),
      );

      if (cap.enabled) {
        fs.mkdirSync(cap.shots, { recursive: true });
        const r = await page.evaluate(() => {
          const b = document.getElementById("print-enhance-controls").getBoundingClientRect();
          return { x: Math.max(0, b.left - 24), y: Math.max(0, b.top - 24), w: b.width + 48, h: b.height + 48 };
        });
        await page.screenshot({
          path: path.join(cap.shots, "03-control-panel-no-lift.png"),
          clip: { x: r.x, y: r.y, width: r.w, height: r.h },
        });
      }
    } finally {
      await page.close();
    }
  });

  it("the layer manager keeps its lift: only the control panel was reported", async function () {
    const page = await bootSheet(ctx);
    try {
      const both = await page.evaluate(() => {
        const read = (id) => {
          const el = document.getElementById(id);
          return el ? getComputedStyle(el).boxShadow : null;
        };
        return {
          controls: read("print-enhance-controls"),
          manager: read("print-enhance-layer-manager"),
        };
      });
      assert.ok(both.controls !== null && both.manager !== null, "both panels exist");
      const maxBlur = (list) =>
        list === "none" || !list ? 0 : Math.max(...splitShadowEntries(list).map(blurOfEntry));
      log("max blur — controls:", maxBlur(both.controls), "manager:", maxBlur(both.manager));
      assert.strictEqual(maxBlur(both.controls), 0, "the reported panel casts nothing");
      // THE SCOPE GUARD. The complaint named one element; the shared chrome rule that
      // used to give the lift covers BOTH panels, and a blunt `box-shadow: none` pass
      // would have quietly un-lifted the layer manager too. It keeps its 0 6px 24px.
      assert.ok(
        maxBlur(both.manager) >= 12,
        "the layer manager STILL has its lifted shadow — the fix is scoped to the " +
          "reported element, not applied to the shared surface: " + both.manager,
      );
    } finally {
      await page.close();
    }
  });

  it("the print sheet never shows the handle, the action bars, or the panel", async function () {
    const page = await bootSheet(ctx);
    try {
      // WHY `emulateMedia` IS SAFE HERE: the landmine in print_output_audit.spec.js is that
      // a pinned media type makes `page.pdf()` skip the extension's `@media print` sheet —
      // and that file is the one that emits a PDF. This case never emits anything: it only
      // reads COMPUTED styles under each media type, which is exactly what the print/screen
      // pair does in ornament_symmetry_visual_capture.spec.js.
      const st = await hoverWrapper(page, "active");
      assert.ok(st && !st.covered, "a hovered active-layer section to check on paper");
      const before = await page.evaluate(
        (id) => {
          const w = document.getElementById(id);
          const g = (s) => (s ? getComputedStyle(s).display : null);
          return {
            handle: g(w.querySelector(":scope > .be-drag-handle")),
            bar: g(w.querySelector(":scope > .be-section-actions")),
          };
        },
        st.id,
      );
      await page.emulateMedia({ media: "print" });
      const during = await page.evaluate(
        (id) => {
          const w = document.getElementById(id);
          const g = (s) => (s ? getComputedStyle(s) : null);
          const h = g(w.querySelector(":scope > .be-drag-handle"));
          const b = g(w.querySelector(":scope > .be-section-actions"));
          return {
            handle: h && { display: h.display, visibility: h.visibility, opacity: h.opacity },
            bar: b && { display: b.display },
            panel: (() => {
              const p = document.getElementById("print-enhance-controls");
              const cs = p ? getComputedStyle(p) : null;
              return cs && { display: cs.display, visibility: cs.visibility };
            })(),
          };
        },
        st.id,
      );
      await page.emulateMedia({ media: "screen" });
      log("on screen:", JSON.stringify(before), "on paper:", JSON.stringify(during));

      assert.strictEqual(before.handle, "flex", "on screen the grip is laid out (display:flex, revealed by hover)");
      assert.ok(
        during.handle.display === "none" || during.handle.visibility === "hidden" || during.handle.opacity === "0",
        "the handle never reaches the paper: " + JSON.stringify(during.handle),
      );
      assert.strictEqual(during.bar.display, "none", "the action bar never reaches the paper");
      assert.ok(
        during.panel.display === "none" || during.panel.visibility === "hidden",
        "the control panel never reaches the paper (so its shadow can't either): " +
          JSON.stringify(during.panel),
      );
    } finally {
      await page.close();
    }
  });
});
