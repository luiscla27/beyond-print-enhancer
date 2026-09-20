/**
 * The privacy policy must name EVERY permission the manifest declares — both directions.
 *
 * Track byok_ai_layout_20260915, Phase 5. The plan's own words for why this exists:
 * "Check `icons_privacy_surface.spec.js` / `manifest_surface.spec.js` for copy-pinned assertions
 * first — `manifest_surface.spec.js:43` only checks the array SHAPE, so nothing pins the doc to
 * the manifest today. ADD a case asserting the policy names every permission the manifest
 * declares: that case is the falsifiable half, and it is what stops the doc and the manifest
 * drifting apart again."
 *
 * That was true when it was written and is still true of the two files it names: `test/manifest.test.js:25`
 * asserts `permissions.includes(perm)` against a HARDCODED list of three (INCLUSION-only, so it
 * cannot fail on an addition — Phase 0's finding), and the browser `manifest_surface.spec.js`
 * asserts only `Array.isArray(m.permissions)`. So the fifth permission (`storage`, added by AC-V0's
 * operator answer) and the two BYOK `host_permissions` entries were, until this file, explained
 * nowhere that anything CHECKED.
 *
 * WHY BOTH DIRECTIONS MATTER. Doc→manifest (a bullet naming a permission that was revoked) is a
 * false privacy claim, which is the worse failure: it tells a user we hold something we no longer
 * ask for. Manifest→doc (a permission granted and never disclosed) is a store-review problem and
 * the reason §2's own promise — "the minimum permissions necessary to function" — is worth a test.
 *
 * WHY IT IS A UNIT TEST AND NOT A BROWSER SPEC. Both inputs are files in the package; there is no
 * DOM, no world, no page. A browser case would cost 35 seconds of Playwright to read two strings.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const POLICY = fs.readFileSync(path.join(ROOT, "PRIVACY_POLICY.md"), "utf8");

/** §2's bullets, each as `<code>`-quoted text. The policy's own convention is `` `activeTab` ``. */
function policyBullets() {
  const section = POLICY.split(/^##\s+/m).find((b) => /^2\.\s/.test(b));
  assert.ok(section, "PRIVACY_POLICY.md has no section 2 to check");
  const bullets = [];
  for (const line of section.split("\n")) {
    // TOP-LEVEL bullets only: `\*` with no leading whitespace. §2's `host_permissions` entry now
    // carries indented sub-bullets that quote raw ORIGIN PATTERNS (`https://api.openai.com/*`), and
    // those are origins, not permissions — accepting them here would make the stale-bullet scan
    // below report them as undeclared permissions.
    const m = line.match(/^\*\s+`([^`]+)`/);
    if (m) bullets.push(m[1]);
  }
  return { bullets, section };
}

describe("PRIVACY_POLICY §2 <-> manifest permission parity (byok_ai_layout Phase 5)", function () {
  const { bullets, section } = policyBullets();

  it("the policy lists permissions in `code` bullets, so this test is not reading an empty list", function () {
    assert.ok(bullets.length >= 4, "§2 names " + bullets.length + " permissions: " + JSON.stringify(bullets));
  });

  it("every `permissions` entry the manifest declares is named in the policy", function () {
    const missing = MANIFEST.permissions.filter((p) => !bullets.includes(p));
    assert.deepStrictEqual(
      missing,
      [],
      "manifest.json grants permissions the privacy policy never mentions: " +
        JSON.stringify(missing) +
        " — §2 promises 'the minimum permissions necessary to function', which is only a promise until this case runs",
    );
  });

  it("the policy names NO permission the manifest dropped (a revoked permission cannot stay disclosed)", function () {
    const declared = new Set(MANIFEST.permissions);
    // `host_permissions` is disclosed as its own bullet (see below), so it is excluded from the
    // stale-bullet scan rather than treated as an undeclared permission.
    const stale = bullets.filter((b) => b !== "host_permissions" && !declared.has(b));
    assert.deepStrictEqual(
      stale,
      [],
      "§2 discloses permissions the manifest no longer requests: " + JSON.stringify(stale),
    );
  });

  it("`storage` — the BYOK credential's home — is disclosed with what it holds and where it stays", function () {
    // The AC-V0 answer added the FIFTH permission, and the plan's condition on it was specific:
    // "what is stored, on-device only, never synced, never sent to us". Checking the words is
    // checking the promise; an entry that says "to save settings" would pass a name-only test.
    const bullet = section
      .split("\n")
      .find((l) => /^\s*\*\s*`storage`/.test(l));
    assert.ok(bullet, "`storage` is not named in §2");
    for (const phrase of ["API key", "never synced", "never sent to us"]) {
      assert.ok(
        bullet.toLowerCase().includes(phrase.toLowerCase()),
        "the `storage` bullet omits '" + phrase + "': " + bullet.trim(),
      );
    }
  });

  it("every `host_permissions` origin is named, and the provider origins the BYOK relay can dial are among them", function () {
    // The relay can only be pointed at an origin the manifest publishes; `js/background.js`
    // enforces that as `provider_origin_lock`, so the set here is the same set the gate allows.
    const hostPerms = MANIFEST.host_permissions || [];
    assert.ok(hostPerms.length > 0, "the manifest declares no host_permissions at all");
    const body = POLICY;
    for (const origin of hostPerms) {
      const bare = origin.replace(/^\*?\*?/, "").replace(/\/\*$/, "").replace(/\/$/, "");
      assert.ok(
        body.includes(bare) || body.includes(origin),
        "host permission " + origin + " appears nowhere in PRIVACY_POLICY.md",
      );
    }
    assert.ok(
      hostPerms.some((h) => /openai\.com/.test(h)) && hostPerms.some((h) => /anthropic\.com/.test(h)),
      "the two O-1 provider origins are not both published: " + JSON.stringify(hostPerms),
    );
  });
});
