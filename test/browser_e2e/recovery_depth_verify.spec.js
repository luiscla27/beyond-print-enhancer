/**
 * Phase 3 visual/behavioural verification (track ux_gaps_20260911, AC-3c + AC-V1).
 *
 * The unit suite proves the COPY and the DEPTH. This proves both in the REAL product, in a
 * browser, because AC-3(a) is explicitly "where the controls are" — a tooltip or status line
 * that only exists in jsdom is not where the user is.
 *
 * TWO CONSTRAINTS, both hit while writing this and both worth knowing:
 *   1. The extension runs in an ISOLATED WORLD, so `page.evaluate` cannot see
 *      `window.Persistence` / `window.createBackupSnapshot` / `window.listBackups`
 *      (`TypeError: window.createBackupSnapshot is not a function`). Anything touching the
 *      extension's own seams goes through `contentCall`, which is why
 *      `_helpers/inject.js` gained a `recoveryDepthProbe`.
 *   2. The DOM IS shared, so the surfaces the user sees — the restore panel's status line,
 *      the undo control — are read with plain Playwright, which is the stronger evidence
 *      anyway: it is what a person would look at.
 *
 *   RECOVERY_DEPTH_SHOTS=1 npx mocha test/browser_e2e/recovery_depth_verify.spec.js --timeout 900000
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, contentCall } = require("./_helpers.js");

const ENABLED = process.env.RECOVERY_DEPTH_SHOTS === "1";
const ART_ROOT = process.env.RECOVERY_DEPTH_SHOTS_DIR || "docs/ux-gaps-20260911";
const SHOTS = path.join(ART_ROOT, "shots-phase3");

describe("Phase 3 — the recovery models are distinguishable in the REAL product (AC-3)", function () {
  this.timeout(900000);
  let ctx, page;

  const clickControl = (needle) => page.evaluate((n) => {
    const b = Array.from(document.querySelectorAll("#print-enhance-controls button"))
      .find((x) => (x.textContent || "").includes(n));
    if (!b) return false;
    b.click();
    return true;
  }, needle);

  const statusText = () => page.evaluate(() =>
    ((document.querySelector(".be-restore-status") || {}).textContent || "").replace(/\s+/g, " "));

  before(async function () {
    if (!ENABLED) this.skip();
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    fs.mkdirSync(SHOTS, { recursive: true });
  });
  after(async function () {
    if (ctx) await ctx.close();
  });

  it("the restore surface is REACHABLE from the panel and its empty state is honest", async function () {
    assert.ok(await clickControl("Restore backup"), "the Restore backup control is reachable");
    await page.waitForTimeout(1200);
    const empty = await statusText();
    console.log("\n-- restore surface, empty state --\n  ", JSON.stringify(empty).slice(0, 220));
    assert.ok(/No backups yet/.test(empty), `honest empty state: "${empty}"`);
    await page.screenshot({ path: path.join(SHOTS, "10-restore-empty.png") });
  });

  it("a backup can be written through the product's own path, then the surface names the depth and contrasts undo", async function () {
    // Through the extension's own world (constraint 1 above).
    const probe = await contentCall(ctx, "recoveryDepthProbe");
    console.log("\n-- extension-world probe --\n  ", JSON.stringify(probe));
    assert.strictEqual(probe.backupCreated, true, "the product's own snapshot seam wrote a backup");
    assert.ok(probe.backupCount >= 1, `the store holds it (${probe.backupCount})`);

    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(600);
    assert.ok(await clickControl("Restore backup"), "the control is still reachable");
    await page.waitForTimeout(1200);
    const flat = await statusText();
    console.log("\n-- restore surface, populated --\n  ", JSON.stringify(flat).slice(0, 300));
    await page.screenshot({ path: path.join(SHOTS, "11-restore-populated.png") });

    // The three claims AC-3(a) requires, measured on the live surface the user sees.
    assert.ok(/\d+ backups? - newest first/.test(flat), `count + order: "${flat}"`);
    assert.ok(/still here after a reload/.test(flat), `durability stated: "${flat}"`);
    assert.ok(/undo covers the current session only/.test(flat), `undo contrasted: "${flat}"`);
  });

  it("the undo control names its session scope in the real panel, and stays short on screen", async function () {
    const probe = await contentCall(ctx, "recoveryDepthProbe");
    console.log("\n-- undo control (live) --\n  ", JSON.stringify({
      undoTitle: probe.undoTitle, undoAria: probe.undoAria,
      undoLabel: probe.undoLabel, undoDisabled: probe.undoDisabled,
    }));
    assert.strictEqual(probe.undoDisabled, false, "the control is ENABLED, so the scope sentence applies");
    assert.ok(/this session only/.test(probe.undoTitle), `tooltip names the scope: "${probe.undoTitle}"`);
    assert.ok(/Restore backup/.test(probe.undoTitle), `tooltip points at the older history: "${probe.undoTitle}"`);
    assert.ok(/this session only/.test(probe.undoAria),
      `the accessible name carries it too: "${probe.undoAria}"`);
    // The VISIBLE label must NOT grow the scope: AC-V1 round 1 measured the panel
    // ellipsizing this control, which cut the subject off once already.
    assert.ok(!/session/.test(probe.undoLabel), `visible label stays short: "${probe.undoLabel}"`);
    await page.screenshot({ path: path.join(SHOTS, "12-undo-enabled.png") });
    fs.writeFileSync(path.join(SHOTS, "phase3-probe.json"), JSON.stringify(probe, null, 2));
  });

  it("the depth the LIVE product enforces is the raised one (O-3)", async function () {
    const probe = await contentCall(ctx, "recoveryDepthProbe");
    console.log("\n-- MAX_BACKUPS in the live product:", probe.maxBackups, "--");
    assert.strictEqual(probe.maxBackups, 10, "the live product enforces the raised depth");
  });
});
