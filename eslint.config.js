const globals = require("globals");
const pluginJs = require("@eslint/js");

/**
 * WHAT THIS CONFIG IS FOR — and the three ways it was lying about the tree
 * (track `gate_coverage_20260912`, AC-2; measured in `phase0_remeasurement.md` §R-3 and §R-7).
 *
 * The ratified `no-console` rule below has existed since `refactor_surface_20260911` and had
 * **never executed on a single file** in any tree, because nothing ever invoked eslint (`package.json`
 * had no `lint` script — a runner was added by this track's Phase 1). "Never executed" was the third
 * vacuous guard in this project's history. Fixing the invocation alone would not have made the rule
 * mean anything, because the config could not even express the tree it was pointed at:
 *
 *   1. `js/` is NOT an ES module tree. Every file ends with a CommonJS guard
 *      (`if (typeof module !== "undefined" && module.exports)`) so the suites can `require()` it,
 *      while the extension loads the same file as a classic script. Declaring `sourceType: "module"`
 *      with only browser globals made `module` an undefined identifier **52 times**.
 *   2. The product's modules talk to each other through `window.*` seams (the surface
 *      `scripts/check_dead_exports.js` tracks). Those names are defined in ONE file and read by
 *      others, so a browser-globals-only config reported **25** of them as `no-undef` — i.e. the rule
 *      was reporting the architecture, not a defect. `PRODUCT_WINDOW_SEAMS` below declares them.
 *   3. `test/` and `scripts/` were **unlintable**: 6060 + 145 config-class `no-undef` (`require`,
 *      `module`, `describe`, `it`, `process`, `__dirname`) hid everything else, including 265 real
 *      `no-console` hits whose output IS the measurement those harnesses and CLI tools exist to
 *      produce.
 *
 * WHAT WAS *NOT* DONE, which is the point of AC-2. `no-undef` is **on** (not disabled, and not
 * relaxed for the files that produced the hits), `no-console` is still `error` where it means
 * something, and the switch that the rule protects — the extension logging through one function —
 * is unchanged. A config that declares everything reports nothing, which is why
 * `test/unit/lint_config_not_vacuous.test.js` plants an undefined identifier and an unused binding
 * and requires both to be reported.
 *
 * ONE MISLEADING LINE WAS REMOVED. This block used to carry `"no-unused-vars": "warn"` while
 * `pluginJs.configs.recommended` (applied last) set the same rule to `error` — so the declared
 * severity was not the effective one, and the measured output said "145 errors, 0 warnings" while
 * the file said "warn". The severity now lives in exactly one place.
 */

/**
 * The product's own cross-file `window.*` seams, with the file that defines each.
 *
 * MEASURED (`npx eslint js/ -f json`, before this config): `ElementWrapper` ×11, `safeLog` ×5,
 * `showFeedback` ×2, `CatalogService` ×2, and one each of `clearBorderStyles`, `createShape`,
 * `updateLayoutBounds`, `updatePrintStyles`, `initDragAndDrop` — **25 of the 77 `no-undef`**.
 *
 * These are declared `writable` rather than `readonly` on purpose: they are assigned to `window` by
 * their defining module and read by name elsewhere, and a readonly declaration would be a claim about
 * assignment semantics that this config does not need to make.
 */
const PRODUCT_WINDOW_SEAMS = {
  ElementWrapper: "writable", // defined js/dom/element_wrapper.js:138
  safeLog: "writable", // defined js/main.js:267 — the single logger the no-console rule protects
  showFeedback: "writable", // defined js/main.js:1872
  CatalogService: "writable", // defined js/catalog_service.js:507
  clearBorderStyles: "writable", // defined js/main.js:1871
  createShape: "writable", // defined js/main.js:1869
  updateLayoutBounds: "writable", // defined js/main.js:2896
  updatePrintStyles: "writable", // defined js/main.js:242
  initDragAndDrop: "writable", // defined js/dnd.js:1085
};

module.exports = [
  {
    // `eslint js/ test/ scripts/` never traverses the overlay anyway, but the ignore is the
    // belt-and-braces half of "the framework's files are not this project's lint surface". The
    // vendored layout (track `vendor_root_consolidation_20260914`) puts EVERYTHING framework-
    // supplied under `vendor/` — the overlay (`vendor/conductor/`, the old root pattern this
    // replaces) and the pinned unit alike — so one pattern covers both.
    ignores: ["eslint.config.js", "vendor/"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      // O-4 (ratified, track refactor_surface_20260911 AC-5): F-4 was duplicated logger shapes PLUS
      // raw `console.*`, and it can only be kept gone by a rule rather than a review note. A
      // `console.*` call outside the logger is now a LINT FAILURE — with NO file-scoped allowlist:
      // the logger's own two console lines carry a scoped `eslint-disable-next-line` instead, so the
      // exemption covers exactly those statements and not a 2,300-line file.
      "no-console": "error",
    },
  },
  {
    // The extension itself: classic scripts, CommonJS-guarded so the suites can require them, and
    // speaking to each other through the seams declared above.
    files: ["js/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.commonjs,
        ...PRODUCT_WINDOW_SEAMS,
      },
    },
  },
  {
    // The service worker: `js/background.js` is a CLASSIC worker script (the manifest declares
    // `background.service_worker` with no `type: "module"`), so `importScripts` is available and
    // every file it imports shares ONE global scope with it.
    //
    // The declaration list below is the same CLASS of declaration as PRODUCT_WINDOW_SEAMS above,
    // not a relaxation of `no-undef`: `js/ai_layout.js` and `js/ai_settings.js` are pulled in at
    // `js/background.js:13`, and a top-level `const`/`function` in a classic script lands in the
    // global LEXICAL environment — visible to later scripts by bare name, and NOT a property of
    // `self`, so no `window.`/`self.` seam is involved and the re-rot guard does not see them.
    // Declaring each name with the file it comes from is what keeps the rule able to tell "cross-
    // file binding the architecture established" from "typo". MEASURED: without this block,
    // `npx eslint js/background.js` reported 16 `no-undef` — 1 for `importScripts` and 15 for the
    // imported bindings, i.e. the rule was reporting the wiring, exactly as it did for `js/`'s
    // `window.*` seams before PRODUCT_WINDOW_SEAMS existed.
    files: ["js/background.js"],
    languageOptions: {
      globals: {
        ...globals.serviceworker, // importScripts, self, fetch-in-worker, skipWaiting, …
        PROVIDERS: "readonly", // js/ai_layout.js:136 — the adapter table (origin + header + scheme)
        ERROR_CLASSES: "readonly", // js/ai_layout.js:895 — AC-6's typed-error copy
        buildRequest: "readonly", // js/ai_layout.js:797 — config -> {url, method, headers, body}
        parseResponse: "readonly", // js/ai_layout.js:927 — the single provider-body decode site
        redactCredentials: "readonly", // js/ai_layout.js:907 — strips key-shaped text from copy
        AI_COMPAT_BASE_ORIGINS: "readonly", // js/ai_settings.js:117 — the published compatible hosts
        loadSettings: "readonly", // js/ai_settings.js:263 — the SAFE record, never the credential
        getApiKey: "readonly", // js/ai_settings.js:276 — the one credential accessor, worker-side
      },
    },
  },
  {
    // The test tree: CommonJS mocha specs, half of them jsdom (so the browser globals from the base
    // block must stay) and half of them driving a real browser through Playwright.
    //
    // `no-console: "off"` is DELIBERATE, documented here rather than left implicit, and is O-7's
    // ratified decision. The rule exists to keep the *extension's* logging single-sourced through
    // `safeLog`; a capture/probe harness whose entire purpose is to print a measurement, or a test
    // setup file reporting what it booted, is not that defect. "Fixing" the 139 hits would delete the
    // output those harnesses exist to produce — and one of them is load-bearing: the `[boot]
    // tolerated …` marker in `_helpers/dom.js`, which is how the browser gate keeps residual host
    // flakiness countable instead of swallowed. The rule is NOT relaxed anywhere it was protecting
    // the product: that is `js/`, above, where it stays `error`.
    files: ["test/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.mocha,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    // The BYOK relay's browser probes (track byok_ai_layout_20260915, Phase 3). Same CLASS of
    // declaration as the `js/background.js` block above — a name defined in one scope and read by
    // bare identifier from another — with one difference worth stating because it is the reason
    // this is a file-scoped block rather than an addition to the `test/**` globals: Playwright's
    // `serviceWorker.evaluate(fn)` serializes `fn` and runs it INSIDE the extension's worker, so
    // these two identifiers resolve there, not in the Node/mocha scope every other test global
    // lives in. Declaring them for all of `test/` would silence `no-undef` for a typo in 60
    // unrelated specs; scoped to this file, the only place the worker's own globals are reached,
    // the rule stays live everywhere else. `chrome.storage` needs no entry (it is in
    // `globals.webextensions`, already applied to every file).
    files: ["test/browser_e2e/byok_relay.spec.js"],
    languageOptions: {
      globals: {
        byokRelaySnapshot: "readonly", // js/background.js — the counters' read-only accessor
        byokTargetProblem: "readonly", // js/background.js:359 — the origin lock's own predicate
        byokSenderProblem: "readonly", // js/background.js — the sender gate's own predicate
        byokChatReply: "readonly", // js/background.js — the relay, called with a test-supplied sender
      },
    },
  },
  {
    // The tooling tree: small Node CLIs that write their result to stdout. Same rationale as
    // `test/` (O-7), and it was never linted by anything before this track (§R-7).
    files: ["scripts/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  pluginJs.configs.recommended,
];
