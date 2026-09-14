/**
 * The browser harness's boot-error tolerance — its LIMITS (ISSUE_browser_e2e_gate_drift_20260912, F2).
 *
 * WHY THIS TEST EXISTS. F2's fix lets `bootPage` ignore ONE class of page error: a network
 * failure produced by the live demo host while a page is booting. A tolerance is the easiest
 * way to turn a red gate green for the wrong reason, so this file pins the three things that
 * keep it honest, each as an executable claim rather than a comment:
 *
 *   1. POLICY — the split is a pure function (`classifyBootErrors`), and everything that is NOT
 *      a host network failure is still FATAL, in either phase. A TypeError must never be
 *      tolerated (that is the exact shape of "green by ignoring everything").
 *   2. AUTHOR — an UNHANDLED `Failed to fetch` cannot be the extension's, because every `fetch`
 *      in `js/` is rejection-guarded. This test IS that invariant: if a future change adds an
 *      unguarded fetch, the tolerance would start masking a real defect, so this fails first.
 *      (The check is a heuristic on purpose — a forward window — and it is falsified below on a
 *      snippet with a bare `fetch(`, so it cannot pass vacuously.)
 *   3. CAP — the tolerance is bounded. A host that fails MORE than a couple of fetches is not
 *      flaky, it is broken, and the boot must fail.
 *
 * The readiness-gate precondition (the tolerance is only reached after `READY_SELECTOR` + the
 * action-bar count have passed) is structural and asserted at the end of this file, because it
 * is what makes a tolerated message unable to hide a boot that never came up.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const {
  HOST_NETWORK_ERROR,
  MAX_HOST_ERRORS,
  isHostNetworkError,
  classifyBootErrors,
} = require("../browser_e2e/_helpers/dom.js");

const ROOT = path.resolve(__dirname, "..", "..");
const HARNESS = fs.readFileSync(
  path.join(ROOT, "test", "browser_e2e", "_helpers", "dom.js"),
  "utf8",
);

const err = (message, phase = "host") => ({ message, phase });

describe("browser harness boot tolerance (F2)", function () {
  describe("1. the policy tolerates the measured class and nothing else", function () {
    it("tolerates the measured Chromium message", function () {
      // The verbatim message from the issue's evidence and from this session's reproduction.
      assert.strictEqual(isHostNetworkError("Failed to fetch"), true);
    });

    it("tolerates the equivalent messages another engine produces", function () {
      ["Load failed", "NetworkError when attempting to fetch resource."].forEach((m) => {
        assert.strictEqual(isHostNetworkError(m), true, `"${m}" is a network failure`);
      });
      assert.strictEqual(isHostNetworkError("net::ERR_NAME_NOT_RESOLVED"), true);
    });

    it("does NOT tolerate a code defect — the 'green by ignoring everything' shape", function () {
      [
        "Cannot read properties of undefined (reading 'click')",
        "TypeError: Failed to execute 'querySelector' on 'Document'",
        "ReferenceError: applyTemplate is not defined",
        "SyntaxError: Unexpected token '<'",
        "Extension service worker not found",
        // A network-looking message that is NOT the class: a fetch that failed for a
        // non-network reason must still surface.
        "Failed to fetch catalog: 404",
      ].forEach((m) => {
        assert.strictEqual(
          isHostNetworkError(m),
          false,
          `"${m}" must stay FATAL — the tolerance is one class, not a pattern that grows`,
        );
      });
    });

    it("keeps every non-network error fatal, whatever the phase", function () {
      const { tolerated, fatal } = classifyBootErrors([
        err("Failed to fetch", "host"),
        err("Failed to fetch", "live"),
        err("TypeError: x is not a function", "host"),
        err("TypeError: x is not a function", "live"),
      ]);
      assert.strictEqual(tolerated.length, 2, "the network class is tolerated in both phases");
      assert.deepStrictEqual(
        fatal.map((e) => e.message),
        ["TypeError: x is not a function", "TypeError: x is not a function"],
        "a code defect is fatal in BOTH phases",
      );
    });

    it("an empty boot is trivially tolerated = 0, fatal = 0", function () {
      const { tolerated, fatal } = classifyBootErrors([]);
      assert.deepStrictEqual([tolerated, fatal], [[], []]);
    });

    it("names its patterns rather than matching a bare substring", function () {
      assert.ok(Array.isArray(HOST_NETWORK_ERROR), "the tolerance is an explicit list");
      assert.ok(HOST_NETWORK_ERROR.length >= 3, "one entry per engine's spelling");
      HOST_NETWORK_ERROR.forEach((re) => {
        assert.ok(re instanceof RegExp, "each entry is a RegExp");
        assert.ok(re.source.startsWith("^"), `every pattern is anchored at the start: ${re}`);
      });
    });
  });

  describe("2. the AUTHOR invariant: every extension fetch is rejection-guarded", function () {
    /** Collect `<file>:<line>` for each `fetch(` in the shipped `js/` tree. */
    const fetchSites = () => {
      const sites = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(p);
            continue;
          }
          if (!entry.name.endsWith(".js")) continue;
          const lines = fs.readFileSync(p, "utf8").split("\n");
          lines.forEach((line, i) => {
            if (/(?<![\w.])fetch\(/.test(line)) {
              sites.push({
                file: path.relative(ROOT, p),
                line: i + 1,
                // `.catch(` on the call's own expression, or a `catch` block that can wrap it.
                guarded:
                  lines.slice(i, i + 6).join("\n").includes(".catch(") ||
                  lines.slice(i, i + 40).join("\n").includes("catch"),
              });
            }
          });
        }
      };
      walk(path.join(ROOT, "js"));
      return sites;
    };

    it("finds the extension's fetch sites (so the check cannot pass on an empty set)", function () {
      const sites = fetchSites();
      assert.ok(sites.length >= 3, `expected the 3 known sites, got ${sites.length}`);
    });

    it("has no unguarded fetch — which is why an unhandled network pageerror is not ours", function () {
      const unguarded = fetchSites().filter((s) => !s.guarded);
      assert.deepStrictEqual(
        unguarded.map((s) => `${s.file}:${s.line}`),
        [],
        "an unguarded fetch would make the F2 tolerance mask a real extension failure",
      );
    });

    it("FALSIFICATION: the same rule flags a bare fetch in a function with no catch", function () {
      const snippet = ["async function f(u) {", "  const r = await fetch(u);", "  return r;", "}"].join(
        "\n",
      );
      const lines = snippet.split("\n");
      const idx = lines.findIndex((l) => /(?<![\w.])fetch\(/.test(l));
      assert.ok(idx >= 0, "the snippet has a fetch");
      const guarded =
        lines.slice(idx, idx + 6).join("\n").includes(".catch(") ||
        lines.slice(idx, idx + 40).join("\n").includes("catch");
      assert.strictEqual(guarded, false, "the detector must call this UNGUARDED");
    });
  });

  describe("3. the cap, and the readiness precondition", function () {
    it("caps the tolerance at a couple of errors", function () {
      assert.ok(Number.isInteger(MAX_HOST_ERRORS), "the cap is an integer");
      assert.ok(
        MAX_HOST_ERRORS >= 1 && MAX_HOST_ERRORS <= 5,
        `a cap of ${MAX_HOST_ERRORS} would tolerate a broken host`,
      );
    });

    it("bootPage applies the cap as a failing assertion, not a silent trim", function () {
      assert.match(
        HARNESS,
        /assert\.ok\(\s*tolerated\.length <= MAX_HOST_ERRORS/,
        "over the cap must FAIL the boot",
      );
    });

    it("bootPage reaches the readiness gates BEFORE the tolerance is applied", function () {
      const readyAt = HARNESS.indexOf('page.waitForSelector(READY_SELECTOR');
      const barsAt = HARNESS.indexOf('querySelectorAll(".be-more-options-button").length > 0');
      const policyAt = HARNESS.indexOf("= classifyBootErrors(pageErrors)");
      assert.ok(readyAt > -1 && barsAt > -1 && policyAt > -1, "all three steps are present");
      assert.ok(
        readyAt < policyAt && barsAt < policyAt,
        "a tolerance reached before the enhancer is proven up could hide a failed boot",
      );
    });

    it("marks what it tolerated instead of swallowing it", function () {
      assert.match(
        HARNESS,
        /page\.__bootHostErrors = tolerated\.map/,
        "the tolerated messages must stay readable on the returned page",
      );
      assert.match(HARNESS, /\[boot\] tolerated/, "and be printed, so flakiness stays countable");
    });
  });
});
