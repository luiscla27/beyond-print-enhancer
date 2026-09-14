/**
 * Browser E2E — PR #5 "Added UI panel to save/load templates"
 * (persistence_ui_20260211): the control-panel persistence surface —
 * Save on Browser (IndexedDB), Save on PC (JSON download), Load (file
 * import) and Reset to Default; plus the page-separator /
 * layout-height visual system this PR shipped.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The control panel (top-left vertical) exposes Save to Browser,
 *      Save to PC, Load and Reset to Default.
 *   2. Save to Browser persists without error (feedback/status path).
 *   3. Save to PC downloads a JSON layout file.
 *   4. The layout-height system renders page separators between print
 *      pages and sizes the layout wrapper to fit its sections.
 *   5. The Load control survives as the icon-labelled action (no emoji prefix).
 *   6. The two asks that left this panel (Contribute, Feedback) are still reachable from
 *      the extension's action-icon menu, checked at RUNTIME in the service worker.
 *
 * DRIFT NOTE (ISSUE_browser_e2e_gate_drift_20260912, F1). Two of this spec's pins had gone
 * stale against deliberate product changes, and — because `test/browser_e2e` is not part of
 * `npm test` — nobody saw it:
 *   * `Contribute` was REMOVED from this panel on purpose (track first_run_and_panel_20260911,
 *     AC-3, 1.17.0) and now lives in the extension's action-icon menu
 *     (`js/background.js`). Asserting a control in the panel was asserting a surface the
 *     product no longer has, so the destination is now asserted where it moved TO, from the
 *     service worker, and the panel's absence is asserted here (the AC-3 contract).
 *   * `Load` became an icon action (`{ label: "Load", iconKey: "folderOpen" }`,
 *     `js/controls.js`), so the old emoji-prefixed matcher could not match the live label.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:savepanel
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #5 Control-panel save/load templates + page separators (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("the control panel exposes the persistence controls", async function () {
    const page = await bootPage(ctx);
    try {
      const has = await page.evaluate(() => {
        const texts = Array.from(
          document.querySelectorAll("#print-enhance-controls button"),
        ).map((b) => (b.textContent || "").replace(/\s+/g, " ").trim());
        return {
          saveBrowser: texts.some((t) => t.includes("Save to Browser")),
          savePC: texts.some((t) => t.includes("Save to PC")),
          // Icon-agnostic: Load has been an icon action since the icon set landed
          // (`{ label: "Load", iconKey: "folderOpen" }`), so the label text — not an
          // emoji prefix — is the stable contract.
          load: texts.some((t) => t.includes("Load")),
          reset: texts.some((t) => t.includes("Reset to Default")),
          // AC-3 (first_run_and_panel_20260911): the panel must carry NO fundraising row.
          // The destination still exists, in the action-icon menu — see the header note.
          contribute: texts.some((t) => t.includes("Contribute")),
        };
      });
      assert.ok(
        has.saveBrowser && has.savePC && has.load && has.reset,
        "persistence controls present: " + JSON.stringify(has),
      );
      assert.ok(
        !has.contribute,
        "the panel carries no fundraising row (AC-3): " + JSON.stringify(has),
      );
    } finally {
      await page.close();
    }
  });

  it("Save on Browser persists without a page error", async function () {
    const page = await bootPage(ctx);
    try {
      const errs = [];
      page.on("pageerror", (e) => errs.push(e.message));
      await page.evaluate(() => {
        const b = Array.from(
          document.querySelectorAll("#print-enhance-controls button"),
        ).find((x) => (x.textContent || "").includes("Save to Browser"));
        b.click();
      });
      // Wait for the async save; must not error.
      await page.waitForTimeout(3000);
      assert.deepStrictEqual(errs, [], "no page errors during save: " + errs.join("|"));
    } finally {
      await page.close();
    }
  });

  it("Save on PC downloads the layout as a JSON file", async function () {
    const page = await bootPage(ctx);
    try {
      const dlPromise = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
      await page.evaluate(() => {
        const b = Array.from(
          document.querySelectorAll("#print-enhance-controls button"),
        ).find((x) => (x.textContent || "").includes("Save to PC"));
        b.click();
      });
      const dl = await dlPromise;
      assert.ok(dl, "a download should be initiated");
      assert.ok(
        /\.json$/i.test(dl.suggestedFilename() || ""),
        "download is a JSON layout: " + dl.suggestedFilename(),
      );
    } finally {
      await page.close();
    }
  });

  it("the layout wrapper is sized to fit and page separators are drawn", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const layout = document.getElementById("print-layout-wrapper");
        const last = Array.from(
          document.querySelectorAll(".be-section-wrapper"),
        ).reduce((a, b) => {
          const r = b.getBoundingClientRect();
          return r.bottom > a.bottom ? { bottom: r.bottom, left: r.right } : a;
        }, { bottom: 0, left: 0 });
        const lr = layout.getBoundingClientRect();
        return {
          wrapperHeight: layout.style.height || layout.style.minHeight || lr.height + "px",
          coversContent: lr.bottom >= last.bottom - 10,
          hasSeparatorStyle: !!Array.from(document.querySelectorAll("style")).find((s) =>
            s.textContent.includes(".print-page-separator"),
          ),
          ddbStyleHasPage: (document.getElementById("ddb-print-enhance-style") || { textContent: "" }).textContent.includes("print-page-separator"),
        };
      });
      assert.ok(st.coversContent, "layout wrapper sized to cover content");
      assert.ok(
        st.hasSeparatorStyle || st.ddbStyleHasPage,
        "separator rendering CSS present in injected styles",
      );
    } finally {
      await page.close();
    }
  });

  it("the Load control is the icon-labelled action (no emoji prefix)", async function () {
    const page = await bootPage(ctx);
    try {
      // The button is found by its visible label span (the icon lives in a sibling
      // `.be-ctl-ico`), and its full label must survive in the tooltip (AC-5).
      //
      // WHY THERE IS NO CLICK HERE. The Load ACTION is `window.handleLoadFile`, which lives in
      // the extension's ISOLATED world (MV3 `chrome.scripting.executeScript` default) —
      // `page.evaluate` runs in the MAIN world and reads it as `undefined`, so a monkeypatch
      // observer cannot see the wiring and a spy would be a fiction. The action itself is
      // covered where it can be reached: `content_extraction.spec.js` / `layer_*` drive the
      // real persistence seams through the isolated-world `contentCall` probes. What this case
      // pins is the part that IS observable from the page: the control survives as an
      // icon-labelled action on this panel.
      const found = await page.evaluate(() => {
        const btn = Array.from(
          document.querySelectorAll("#print-enhance-controls button.be-ctl-btn"),
        ).find((b) => (b.querySelector(".be-ctl-label") || {}).textContent === "Load");
        if (!btn) return null;
        return {
          hasIcon: !!btn.querySelector(".be-ctl-ico svg, .be-ctl-ico"),
          title: btn.title,
          text: (btn.textContent || "").trim(),
        };
      });
      assert.ok(found, "the panel exposes a Load control");
      assert.ok(found.hasIcon, "Load is icon-labelled");
      assert.strictEqual(found.title, "Load", "the full label survives in the tooltip");
      assert.strictEqual(
        found.text,
        "Load",
        "no emoji prefix remains in the visible label — got " + JSON.stringify(found.text),
      );
    } finally {
      await page.close();
    }
  });

  it("the relocated asks are still reachable from the action-icon menu", async function () {
    const page = await bootPage(ctx);
    try {
      // AC-3b/c (first_run_and_panel_20260911): the panel lost these rows, so the only place
      // left to pin that nothing was DELETED is where they now live — the extension's own
      // action menu. `chrome.contextMenus` has no getAll(), so the runtime proof is
      // `update({id})`: it RESOLVES for an id the browser has registered and REJECTS for one
      // it has not (the technique `funding_placement_verify.spec.js` documents). Probing it
      // HERE, ungated, means the relocation is checked by the always-run browser suite rather
      // than only by a flag-gated capture pass.
      const sw =
        ctx.serviceWorkers().find((w) => w.url().includes("background.js")) ||
        ctx.serviceWorkers()[0];
      assert.ok(sw, "the extension's service worker is running");
      const relocated = await sw.evaluate(async (ids) => {
        const out = {};
        for (const id of ids) {
          try {
            await chrome.contextMenus.update(id, {});
            out[id] = "present";
          } catch (err) {
            out[id] = "MISSING: " + (err && err.message ? err.message : String(err));
          }
        }
        return out;
      }, ["contribute", "feedback"]);
      // And the panel must NOT have taken them back (the AC-3 contract this spec used to
      // assert the wrong way round).
      const inPanel = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll("#print-enhance-controls button"),
        ).some((b) => /contribute/i.test(b.textContent || "")),
      );
      assert.strictEqual(
        inPanel,
        false,
        "the relocation still holds — no Contribute row is back in the panel",
      );
      ["contribute", "feedback"].forEach((id) => {
        assert.strictEqual(
          relocated[id],
          "present",
          `"${id}" must be reachable in the action menu after the move — got ${relocated[id]}`,
        );
      });
    } finally {
      await page.close();
    }
  });
});
