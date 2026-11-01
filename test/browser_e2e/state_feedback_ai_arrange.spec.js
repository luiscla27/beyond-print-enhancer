/**
 * Browser E2E — State feedback: AI arrange progress affordance (BEYOND-19 AC-1)
 *
 * GREEN PHASE: the fix is already in place (showBusy at line 793 of ai_arrange.js
 * with clearBusy in finally block at 806). This test verifies it works.
 *
 * The extension's AI arrange round trip MUST show a progress indicator
 * (`showBusy("Asking your AI…")`) BEFORE the network fetch and clear it only
 * after the preview dialog or error toast.
 *
 * ZERO NETWORK — the service worker's `self.fetch` is stubbed to delay 2s,
 * proving the progress node appears during the latency window.
 */

"use strict";

const assert = require("assert");
const { bootPage, launchExtensionContext } = require("./_helpers/dom.js");
const { contentCall } = require("./_helpers/inject.js");

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const envelope = (patch) =>
  JSON.stringify({ choices: [{ message: { content: JSON.stringify(patch) } }] });

async function livePatch(ctx) {
  const info = await contentCall(ctx, "aiArrangeFirstSection", []);
  assert.ok(info.ok, "the live sheet exposes no arrangeable section: " + JSON.stringify(info));
  return { moves: { [info.id]: { left: info.left + 24, top: info.top + 24 } }, hide: [] };
}

describe("State feedback — AI arrange progress (BEYOND-19 AC-1)", function () {
  this.timeout(180000);
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
    }, { url: OPENAI_URL, envelope: envelope(patch) });

    // Seed the AI key so the arrange flow can run
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

    // Poll for busy indicator during the 2s fetch latency
    let busyDuring = false;
    for (let i = 0; i < 30; i++) {
      const count = await page.evaluate(() => document.querySelectorAll(".be-ai-busy").length);
      if (count > 0) {
        busyDuring = true;
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }

    // Wait for the flow to fully settle (preview dialog should appear)
    await contentCall(ctx, "aiArrangeProbe", [{
      action: "await",
      timeoutMs: 10000,
    }]);

    // Assert: showBusy is cleared after preview/error (polled from the MAIN world,
    // never `waitForFunction` — that returns a JSHandle in this Playwright build and
    // serialising it back over CDP is what produced the spurious
    // "Array buffer allocation failed" this case hit first; MEASURED.)
    let busyCleared = false;
    for (let i = 0; i < 30; i++) {
      const count = await page.evaluate(() => document.querySelectorAll(".be-ai-busy").length);
      if (count === 0) { busyCleared = true; break; }
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log("busyDuring:", busyDuring, "busyCleared:", busyCleared);

    // GREEN PHASE ASSERTION: the progress indicator MUST appear during fetch latency
    assert.strictEqual(busyDuring, true,
      "GREEN: .be-ai-busy node appeared during the AI arrange fetch latency (2s stub)");
    assert.strictEqual(busyCleared, true,
      "GREEN: .be-ai-busy node was cleared after preview dialog appeared");
  });
});
