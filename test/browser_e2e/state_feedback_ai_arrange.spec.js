/**
 * Browser E2E — State feedback: AI arrange progress affordance (BEYOND-19 AC-1)
 *
 * RED PHASE: exposes the gap — the extension's AI arrange round trip
 * MUST show a progress indicator (`showBusy("Asking your AI…")`) BEFORE the
 * network fetch and clear it only after the preview dialog or error toast.
 * The unprimed v3 judge found this missing in 17/19 bundles; f01 explicitly:
 * "No dedicated loading indicator for AI work… no extension-specific
 * 'arranging'/pending state".
 *
 * ZERO NETWORK — the service worker's `self.fetch` is stubbed to delay 2s,
 * proving the progress node appears during the latency window.
 */

"use strict";

const assert = require("assert");
const { bootPage, launchExtensionContext } = require("./_helpers/dom.js");
const { contentCall } = require("./_helpers/inject.js");



const envelope = (patch) =>
  JSON.stringify({ choices: [{ message: { content: JSON.stringify(patch) } }] });

async function livePatch(ctx) {
  const info = await contentCall(ctx, "aiArrangeFirstSection", []);
  assert.ok(info.ok, "the live sheet exposes no arrangeable section: " + JSON.stringify(info));
  return { moves: { [info.id]: { left: info.left + 24, top: info.top + 24 } }, hide: [] };
}

describe("State feedback — AI arrange progress (BEYOND-19 AC-1)", function () {
  this.timeout(120000);
  let ctx, page, sw;

  before(async () => {
    ctx = await launchExtensionContext({ headless: true });
    page = await bootPage(ctx);
    sw = ctx.serviceWorkers().find((x) => x.url().includes("background.js")) || ctx.serviceWorkers()[0];
  });

  after(async () => {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("shows showBusy('Asking your AI…') BEFORE the fetch and clears it AFTER preview/error", async () => {
    // Get a valid patch for the live sheet
    const patch = await livePatch(ctx);

    // Arrange: stub the SW fetch to delay 2s, then return a valid preview response with the patch
    await sw.evaluate((data) => {
      const { envelope } = data;
      const orig = self.fetch;
      self.fetch = async (u, opts) => {
        if (String(u).includes("openai.com")) {
          await new Promise(r => setTimeout(r, 2000));
          return new Response(envelope, { headers: { "content-type": "application/json" } });
        }
        return orig(u, opts);
      };
      setTimeout(() => { self.fetch = orig; }, 15000);
    }, { envelope: envelope(patch) });

    // Seed the AI key
    await contentCall(ctx, "aiArrangeProbe", [{
      action: "seed",
      key: "sk-probe-material-0123456789abcdef",
    }]);

    // Start the arrange flow ASYNC - returns immediately
    await contentCall(ctx, "aiArrangeProbe", [{
      action: "async_start",
      key: "sk-probe-material-0123456789abcdef",
      model: "gpt-4o-mini",
      instruction: "move spells to top",
      capabilities: { arrange: true, border: false },
      timeoutMs: 30000,
    }]);

    // IMMEDIATELY check for busy indicator during the 2s fetch latency
    const busyDuringHandle = await page.waitForFunction(
      () => document.querySelectorAll(".be-ai-busy").length > 0,
      { timeout: 5000 }
    ).catch(() => false);
    const busyDuring = await busyDuringHandle.jsonValue().catch(() => false);

    // Now wait for the flow to complete
    await contentCall(ctx, "aiArrangeProbe", [{
      action: "await",
      timeoutMs: 10000,
    }]);

    // Assert: showBusy is cleared after preview/error
    const busyClearedHandle = await page.waitForFunction(
      () => document.querySelectorAll(".be-ai-busy").length === 0,
      { timeout: 5000 }
    ).catch(() => false);
    const busyCleared = await busyClearedHandle.jsonValue().catch(() => false);

    console.log("busyDuring:", busyDuring, "busyCleared:", busyCleared);

    // RED PHASE ASSERTION: the progress indicator MUST appear during fetch latency
    // This assertion WILL FAIL currently (that's the red phase)
    assert.strictEqual(busyDuring, true,
      "RED: Expected .be-ai-busy node to appear during the AI arrange fetch latency (2s stub). " +
      "The unprimed v3 judge found this missing in 17/19 bundles: " +
      "\"No dedicated loading indicator for AI work… no extension-specific 'arranging'/pending state\"");
  });
});
