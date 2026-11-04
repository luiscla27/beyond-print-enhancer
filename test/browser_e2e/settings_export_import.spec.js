/**
 * Browser E2E — track ux_quick_wins_20261025, Phase 6 (AC-3 / BEYOND-12):
 * "Settings panel: Export button (downloads JSON with all customizations);
 * Import button (file picker → validate → merge)".
 *
 * WHAT THIS SPEC PROVES, and why each case exists
 * -----------------------------------------------
 * The product shipped `handleExportSettings` / `handleImportSettings` /
 * `collectSettingsBundle` / `validateSettingsBundle` / `applySettingsBundle` in
 * `js/persistence.js` and wired two panel rows for them in `js/controls.js`, but
 * NOTHING exercised the pair end to end. The gap report's evidence column read
 * "Grep for 'exportSettings|importSettings' in js/ returns 0 hits" — true when it
 * was written, and the fix has been unverified since. Six AC-3 criteria, so six
 * cases:
 *
 *   1. the panel exposes BOTH controls (the criterion's "Settings panel has an
 *      Export Settings button / an Import Settings button" is a UI fact, so it is
 *      asserted on the rendered panel);
 *   2. Export actually downloads a JSON file with the bundle's own filename
 *      (`ddb-printenhance-settings-<date>.json`) — a real `download` event, not a
 *      `Blob` that was merely constructed;
 *   3. the downloaded bytes PARSE and carry EVERY customization type the criterion
 *      names: layout, custom shapes, custom borders, global filters, AI settings
 *      (MultiSelect criterion 3, "Exported JSON includes all user customizations");
 *   4. `validateSettingsBundle` refuses a malformed bundle BY NAME and accepts a
 *      real one — the schema gate, driven through the product's own function;
 *   5. Import MERGES rather than wipes: a bundle whose filters/AI settings differ
 *      from the live store lands those values and leaves the reuse libraries
 *      intact (criterion 4, "Import validates schema and merges safely");
 *   6. G-PERSIST: export → mutate → import → the original values are back, i.e.
 *      the round trip restores state. This is the gate the plan's 6.5 names.
 *
 * WHY THE IMPORT CASES DRIVE `applySettingsBundle` AND NOT THE FILE PICKER
 * ----------------------------------------------------------------------
 * `handleImportSettings` builds an `<input type=file>` and calls `input.click()`.
 * A Playwright test cannot type into a native OS file dialog, and a probe that
 * re-implemented the merge would be asserting on its own copy of the product
 * (the exact failure `refactor_surface_20260911` warned about). So the handler
 * was split — the picker's only remaining job is "read the file's text" — and
 * `applySettingsBundle` is the merge core both the picker and this spec call.
 * The wiring between them IS asserted: case 1 finds the panel row, and the row's
 * action calls `Persistence.handleImportSettings`, whose body is pinned by the
 * unit guard as calling `applySettingsBundle`.
 *
 * ZERO NETWORK. Nothing here dials the relay; the BYOK cases write and read the
 * SAFE record only (provider/model/baseUrl) and never the credential.
 *
 * Run:
 *   npx mocha test/browser_e2e/settings_export_import.spec.js --timeout 900000
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchExtensionContext, bootPage } = require("./_helpers.js");
const { contentCall } = require("./_helpers/inject.js");

/** A distinctive filter set, so a round-trip proves VALUES moved (not shape). */
const EXPORT_FILTERS = { contrast: 137, greyscale: 42, saturate: 61, sepia: 23 };
const EXPORT_HUE = 88;

describe("AC-3 (BEYOND-12) settings export/import round trip (ux_quick_wins_20261025 Phase 6)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  // ---------------------------------------------------------------------------
  // 1. THE PANEL SURFACE — criterion 1 and 2's UI half.
  // ---------------------------------------------------------------------------
  it("the control panel exposes both Export Settings and Import Settings", async function () {
    const page = await bootPage(ctx);
    try {
      const found = await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll("#print-enhance-controls button"),
        );
        const byLabel = (needle) =>
          buttons.find((b) =>
            (b.textContent || "").replace(/\s+/g, " ").trim().includes(needle),
          ) || null;
        const exportBtn = byLabel("Export Settings");
        const importBtn = byLabel("Import Settings");
        return {
          exportPresent: !!exportBtn,
          importPresent: !!importBtn,
          exportId: exportBtn ? exportBtn.id : null,
          importId: importBtn ? importBtn.id : null,
          exportTitle: exportBtn ? exportBtn.title : null,
          importTitle: importBtn ? importBtn.title : null,
          // The rows must be REACHABLE, not merely present in the DOM: a control
          // behind a collapsed band with no head is the same as no control.
          exportVisible: exportBtn ? exportBtn.offsetParent !== null : false,
          importVisible: importBtn ? importBtn.offsetParent !== null : false,
        };
      });
      assert.ok(found.exportPresent, "an Export Settings control exists on the panel");
      assert.ok(found.importPresent, "an Import Settings control exists on the panel");
      assert.strictEqual(found.exportId, "be-btn-export-settings", "Export carries the stable id");
      assert.strictEqual(found.importId, "be-btn-import-settings", "Import carries the stable id");
      assert.ok(found.exportTitle && found.exportTitle.length > 0, "Export has an explanatory tooltip");
      assert.ok(found.importTitle && found.importTitle.length > 0, "Import has an explanatory tooltip");
      assert.ok(found.exportVisible, "the Export control is visible on the rendered panel");
      assert.ok(found.importVisible, "the Import control is visible on the rendered panel");
    } finally {
      await page.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 2. EXPORT DOWNLOADS — criterion 1's behavioural half.
  // ---------------------------------------------------------------------------
  it("Export Settings downloads a JSON settings file", async function () {
    const page = await bootPage(ctx);
    try {
      // Give the bundle something to carry, then click the REAL control. A
      // download that fires proves the button is wired to the handler; the
      // filename proves it is the SETTINGS download, not `handleSavePC`'s layout
      // one (which writes `ddb-layout-<date>.json`) — the two buttons sit next to
      // each other on the same tray, so the distinction is worth pinning.
      const seeded = await contentCall(ctx, "writeGlobalFiltersProbe", [
        { filters: EXPORT_FILTERS, hueShift: EXPORT_HUE },
      ]);
      assert.strictEqual(seeded.ok, true, `seeding the filter store: ${seeded.why || "written"}`);

      const dlPromise = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
      const clicked = await page.evaluate(() => {
        const btn = document.getElementById("be-btn-export-settings")
          || Array.from(document.querySelectorAll("#print-enhance-controls button")).find((b) =>
              (b.textContent || "").includes("Export Settings"),
            );
        if (!btn) return false;
        btn.click();
        return true;
      });
      assert.ok(clicked, "the Export Settings control was found and clicked");

      const dl = await dlPromise;
      assert.ok(dl, "clicking Export Settings starts a download");
      const name = dl.suggestedFilename() || "";
      assert.ok(/\.json$/i.test(name), "the download is a JSON file: " + name);
      assert.ok(
        /printenhance-settings/i.test(name),
        "it is the SETTINGS bundle, not the layout download (expected a " +
          "`ddb-printenhance-settings-*.json` name): " + name,
      );

      // The bytes must PARSE — a download of invalid JSON would satisfy the file
      // name and nothing else. Saved to the OS temp dir, never into the repo.
      const tmp = path.join(os.tmpdir(), "ddb-settings-export-" + Date.now() + ".json");
      await dl.saveAs(tmp);
      let parsed = null;
      try {
        parsed = JSON.parse(fs.readFileSync(tmp, "utf8"));
      } finally {
        try { fs.unlinkSync(tmp); } catch { /* a locked temp file is harmless */ }
      }
      assert.ok(parsed && typeof parsed === "object", "the downloaded file parses as JSON");
      assert.strictEqual(parsed.version, "1.0", "the bundle carries its schema version");
      assert.ok(typeof parsed.exportedAt === "string" && parsed.exportedAt.length > 0,
        "the bundle records when it was exported");
    } finally {
      await page.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 3. EVERY CUSTOMIZATION TYPE IS IN THE BUNDLE — criterion 3.
  // ---------------------------------------------------------------------------
  it("the exported bundle carries every customization type the criterion names", async function () {
    const page = await bootPage(ctx);
    try {
      // Seed each type through the product's OWN seam, so "the bundle has it"
      // is a statement about the live store and not about a fixture.
      const filterWrite = await contentCall(ctx, "writeGlobalFiltersProbe", [
        { filters: EXPORT_FILTERS, hueShift: EXPORT_HUE },
      ]);
      assert.strictEqual(filterWrite.ok, true, `filters: ${filterWrite.why || "written"}`);

      const shapeWrite = await contentCall(ctx, "saveShapeLibraryEntry", [
        { id: "ac3-export-shape-1", name: "AC3 export shape", data: "aGVsbG8=" },
      ]);
      assert.strictEqual(shapeWrite.ok, true, `custom shape: ${shapeWrite.why || "written"}`);

      const borderWrite = await contentCall(ctx, "saveBorderLibraryEntry", [
        {
          id: "ac3-export-border-1",
          name: "AC3 export border",
          svg: '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z" fill="none" stroke="#123"/></svg>',
          prompt: "ac3 probe",
        },
      ]);
      assert.strictEqual(borderWrite.ok, true, `custom border: ${borderWrite.why || "written"}`);

      const aiWrite = await contentCall(ctx, "writeAiSettingsProbe", [
        { provider: "openai", model: "gpt-4o-mini", baseUrl: "" },
      ]);
      assert.strictEqual(aiWrite.ok, true, `AI settings: ${aiWrite.why || aiWrite.error || "written"}`);

      const got = await contentCall(ctx, "collectSettingsBundleRead", []);
      assert.strictEqual(got.ok, true, `collectSettingsBundle: ${got.why || "returned"}`);
      const bundle = got.bundle;

      // (a) the SCHEMA envelope
      assert.strictEqual(bundle.version, "1.0", "the bundle declares its schema version");
      assert.ok(bundle.exportedAt, "…and when it was taken");

      // (b) LAYOUT — the spine. validateSettingsBundle refuses a bundle without it.
      assert.ok(bundle.layout && typeof bundle.layout === "object", "the layout record is in the bundle");
      assert.ok(bundle.layout.version, "the layout record carries its own schema version");
      assert.ok(bundle.layout.sections, "the layout record carries the section map");

      // (c) CUSTOM SHAPES — a separate IndexedDB store the layout record cannot hold.
      assert.ok(Array.isArray(bundle.customShapes), "custom shapes are an array");
      assert.ok(
        bundle.customShapes.some((s) => s.id === "ac3-export-shape-1"),
        "the seeded custom shape is in the bundle (" +
          bundle.customShapes.map((s) => s && s.id).join(",") + ")",
      );

      // (d) CUSTOM BORDERS — the other reuse library.
      assert.ok(Array.isArray(bundle.customBorders), "custom borders are an array");
      assert.ok(
        bundle.customBorders.some((b) => b.id === "ac3-export-border-1"),
        "the seeded custom border is in the bundle (" +
          bundle.customBorders.map((b) => b && b.id).join(",") + ")",
      );

      // (e) GLOBAL FILTERS + hue — values as seeded, so the assertion is on
      // content rather than on the key's presence.
      assert.ok(bundle.globalFilters && typeof bundle.globalFilters === "object",
        "the global filter block is in the bundle");
      assert.strictEqual(bundle.globalFilters.contrast, EXPORT_FILTERS.contrast,
        "the seeded contrast travelled");
      assert.strictEqual(bundle.globalFilters.greyscale, EXPORT_FILTERS.greyscale,
        "the seeded greyscale travelled");
      assert.strictEqual(bundle.globalFilters.saturate, EXPORT_FILTERS.saturate,
        "the seeded saturate travelled");
      assert.strictEqual(bundle.globalFilters.sepia, EXPORT_FILTERS.sepia,
        "the seeded sepia travelled");
      assert.strictEqual(bundle.globalFilters.hueShift, EXPORT_HUE,
        "the seeded hue shift travelled");

      // (f) AI SETTINGS — the safe record only.
      assert.ok(bundle.aiSettings && typeof bundle.aiSettings === "object",
        "the safe BYOK record is in the bundle");
      assert.strictEqual(bundle.aiSettings.provider, "openai", "the provider travelled");
      assert.strictEqual(bundle.aiSettings.model, "gpt-4o-mini", "the model travelled");

      // (g) AC-4's hard boundary, asserted on the SERIALIZED bundle: the
      // credential must not appear anywhere in what the user is about to keep.
      const raw = JSON.stringify(bundle);
      assert.strictEqual(/be\.ai\.key/.test(raw), false,
        "the credential key name never appears in an export");
      assert.strictEqual(/"apiKey"/.test(raw), false,
        "no apiKey field is smuggled into an export");
      assert.strictEqual(
        Object.prototype.hasOwnProperty.call(bundle.aiSettings, "key"),
        false,
        "the safe record carries no key field",
      );
    } finally {
      await contentCall(ctx, "deleteShapeLibraryEntry", ["ac3-export-shape-1"]).catch(() => {});
      await contentCall(ctx, "deleteBorderLibraryEntry", ["ac3-export-border-1"]).catch(() => {});
      await page.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 4. THE SCHEMA GATE — criterion 4's "validates schema" half.
  // ---------------------------------------------------------------------------
  it("validateSettingsBundle refuses a malformed bundle by name and accepts a real one", async function () {
    const page = await bootPage(ctx);
    try {
      const real = await contentCall(ctx, "collectSettingsBundleRead", []);
      assert.strictEqual(real.ok, true, `collectSettingsBundle: ${real.why || "returned"}`);

      const cases = [
        { name: "a real bundle", bundle: real.bundle, expect: null },
        { name: "not an object", bundle: "nope", expect: "bundle_not_object" },
        { name: "null", bundle: null, expect: "bundle_not_object" },
        {
          name: "a wrong version",
          bundle: { ...real.bundle, version: "0.1" },
          expect: "version_mismatch",
        },
        {
          name: "a missing layout",
          bundle: { version: "1.0" },
          expect: "missing_layout",
        },
        {
          name: "a layout without a version/sections",
          bundle: { version: "1.0", layout: { nothing: true } },
          expect: "layout_invalid",
        },
        {
          name: "customShapes that is not an array",
          bundle: { ...real.bundle, customShapes: "not-an-array" },
          expect: "custom_shapes_not_array",
        },
        {
          name: "customBorders that is not an array",
          bundle: { ...real.bundle, customBorders: 7 },
          expect: "custom_borders_not_array",
        },
        {
          // AC-4's boundary, from the other side: a hand-edited (or tampered)
          // file that smuggles a credential in must be refused by NAME, not
          // imported and silently stripped.
          name: "a bundle carrying a credential",
          bundle: { ...real.bundle, aiSettings: { provider: "openai", apiKey: "sk-smuggled" } },
          expect: "credential_in_bundle",
        },
      ];

      const verdicts = [];
      for (const c of cases) {
        const got = await contentCall(ctx, "validateSettingsBundleProbe", [c.bundle]);
        assert.strictEqual(got.ok, true, `probe ran for ${c.name}: ${got.why || "ok"}`);
        const v = got.verdict;
        verdicts.push({ name: c.name, verdict: v });
        if (c.expect === null) {
          assert.strictEqual(v.ok, true,
            `${c.name} must be ACCEPTED — got ${JSON.stringify(v)}`);
        } else {
          assert.strictEqual(v.ok, false, `${c.name} must be REFUSED`);
          assert.strictEqual(v.error, c.expect,
            `${c.name} must be refused BY NAME (expected "${c.expect}", got "${v.error}")`);
        }
      }

      // The negative control has teeth: the SAME function accepted the real
      // bundle in the same run, so "everything is refused" cannot pass this case.
      assert.strictEqual(verdicts[0].verdict.ok, true,
        "the control case: the product's own bundle validates");
      assert.strictEqual(verdicts.filter((v) => v.verdict.ok === false).length, cases.length - 1,
        "every malformed bundle was refused (" + verdicts.length + " inspected)");
    } finally {
      await page.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 5. IMPORT MERGES — criterion 4's "merges safely" half.
  // ---------------------------------------------------------------------------
  it("Import merges: filters and AI settings land, the reuse libraries are not wiped", async function () {
    const page = await bootPage(ctx);
    try {
      // A library row that must SURVIVE the import. "Merge" is the contract, and
      // a wipe is the failure mode that contract exists to prevent — so the row
      // is seeded BEFORE the import and read again AFTER it.
      const seededShape = await contentCall(ctx, "saveShapeLibraryEntry", [
        { id: "ac3-merge-survivor", name: "AC3 merge survivor", data: "c3Vydml2ZQ==" },
      ]);
      assert.strictEqual(seededShape.ok, true, `pre-seeded library row: ${seededShape.why || "written"}`);

      // The live store starts at DIFFERENT values than the bundle, so "the
      // import landed" is a change and not a no-op.
      const liveWrite = await contentCall(ctx, "writeGlobalFiltersProbe", [
        { filters: { contrast: 100, greyscale: 100, saturate: 100, sepia: 0 }, hueShift: 0 },
      ]);
      assert.strictEqual(liveWrite.ok, true, `pre-import live filters: ${liveWrite.why || "written"}`);
      assert.strictEqual(liveWrite.filters.contrast, 100, "precondition: contrast starts at its default");

      // Build the import bundle FROM the product's own collector, then override
      // the parts this case is about — so the bundle is valid by construction
      // (its layout is real) and the assertions are about the merge.
      const collected = await contentCall(ctx, "collectSettingsBundleRead", []);
      assert.strictEqual(collected.ok, true);
      const bundle = JSON.parse(JSON.stringify(collected.bundle));
      bundle.globalFilters = {
        contrast: EXPORT_FILTERS.contrast,
        greyscale: EXPORT_FILTERS.greyscale,
        saturate: EXPORT_FILTERS.saturate,
        sepia: EXPORT_FILTERS.sepia,
        hueShift: EXPORT_HUE,
      };
      bundle.aiSettings = {
        provider: "openai",
        model: "gpt-4o-mini",
        baseUrl: "",
      };
      // The bundle's reuse libraries are what the export saw; adding a NEW row to
      // the bundle proves an import ADDS to the library rather than replacing it.
      bundle.customShapes = [
        ...(bundle.customShapes || []),
        { id: "ac3-merge-imported", name: "AC3 imported shape", data: "aW1wb3J0ZWQ=" },
      ];

      const applied = await contentCall(ctx, "applySettingsBundleProbe", [
        { bundle, expectOk: true },
      ]);
      assert.strictEqual(applied.ok, true, `applySettingsBundle: ${applied.why || "merged"}`);
      assert.ok(applied.applied, "the merge reported what it applied: " + JSON.stringify(applied.applied));
      assert.strictEqual(applied.applied.layout, true, "the layout record was applied");
      assert.ok(applied.applied.shapes >= 1, "at least one shape was upserted");
      assert.strictEqual(applied.applied.filters, true, "the filter block was applied");
      assert.strictEqual(applied.applied.aiSettings, true, "the AI record was merged");
      assert.strictEqual(
        applied.hasKeyInBundle,
        false,
        "the bundle the merge consumed carried no credential",
      );

      // (a) the filters MOVED to the bundle's values
      const afterFilters = await contentCall(ctx, "readGlobalFiltersProbe", []);
      assert.strictEqual(afterFilters.ok, true);
      assert.strictEqual(afterFilters.filters.contrast, EXPORT_FILTERS.contrast,
        "the imported contrast landed");
      assert.strictEqual(afterFilters.filters.greyscale, EXPORT_FILTERS.greyscale,
        "the imported greyscale landed");
      assert.strictEqual(afterFilters.filters.saturate, EXPORT_FILTERS.saturate,
        "the imported saturate landed");
      assert.strictEqual(afterFilters.filters.sepia, EXPORT_FILTERS.sepia,
        "the imported sepia landed");
      assert.strictEqual(afterFilters.hueShift, EXPORT_HUE, "the imported hue shift landed");

      // (b) the AI record merged the safe fields
      const afterAi = await contentCall(ctx, "readAiSettingsProbe", []);
      assert.strictEqual(afterAi.ok, true, `readAiSettings: ${afterAi.why || "read"}`);
      assert.strictEqual(afterAi.provider, "openai", "the imported provider landed");
      assert.strictEqual(afterAi.model, "gpt-4o-mini", "the imported model landed");
      assert.strictEqual(afterAi.baseUrl, "", "the imported base URL landed (empty stays empty)");
      assert.strictEqual(afterAi.hasKeyField, false, "no key field was created by the import");
      assert.strictEqual(afterAi.hasApiKeyField, false, "no apiKey field was created by the import");

      // (c) the libraries were UPSERTED, never wiped — both rows are present.
      const library = await contentCall(ctx, "readShapeLibrary", []);
      assert.ok(Array.isArray(library), "the shape library reads back as an array");
      assert.ok(
        library.some((s) => s.id === "ac3-merge-survivor"),
        "the row that existed BEFORE the import is still there (merge, not wipe)",
      );
      assert.ok(
        library.some((s) => s.id === "ac3-merge-imported"),
        "the row the bundle brought was added",
      );

      // (d) the user was told, in the product's own words.
      assert.ok(
        applied.feedback.some((f) => /Settings imported/i.test(f.msg)),
        "a success toast was raised: " + JSON.stringify(applied.feedback),
      );
    } finally {
      await contentCall(ctx, "deleteShapeLibraryEntry", ["ac3-merge-survivor"]).catch(() => {});
      await contentCall(ctx, "deleteShapeLibraryEntry", ["ac3-merge-imported"]).catch(() => {});
      await page.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 6. G-PERSIST ROUND TRIP — the plan's 6.5 gate.
  // ---------------------------------------------------------------------------
  it("G-PERSIST: export → mutate → import restores the exported values", async function () {
    const page = await bootPage(ctx);
    try {
      // STEP 1 — seed a distinctive state and EXPORT it, through the product's
      // own collector (the same function the Export button calls).
      const seed = await contentCall(ctx, "writeGlobalFiltersProbe", [
        { filters: EXPORT_FILTERS, hueShift: EXPORT_HUE },
      ]);
      assert.strictEqual(seed.ok, true, `seeding: ${seed.why || "written"}`);
      const seededAi = await contentCall(ctx, "writeAiSettingsProbe", [
        { provider: "openai", model: "gpt-4o-mini", baseUrl: "" },
      ]);
      assert.strictEqual(seededAi.ok, true, `seeding AI: ${seededAi.why || seededAi.error || "written"}`);

      const exported = await contentCall(ctx, "collectSettingsBundleRead", []);
      assert.strictEqual(exported.ok, true, `export: ${exported.why || "collected"}`);
      const saved = JSON.parse(JSON.stringify(exported.bundle));
      assert.strictEqual(saved.globalFilters.contrast, EXPORT_FILTERS.contrast,
        "precondition: the exported bundle carries the seeded contrast");

      // STEP 2 — MUTATE the live store away from the exported values. Without
      // this the round trip would "pass" against a store that never moved.
      const mutate = await contentCall(ctx, "writeGlobalFiltersProbe", [
        { filters: { contrast: 5, greyscale: 5, saturate: 5, sepia: 5 }, hueShift: 7 },
      ]);
      assert.strictEqual(mutate.ok, true, `mutating: ${mutate.why || "written"}`);
      assert.strictEqual(mutate.filters.contrast, 5, "the live store really moved off the exported value");
      const mutatedAi = await contentCall(ctx, "writeAiSettingsProbe", [
        { provider: "custom", model: "something-else", baseUrl: "" },
      ]);
      assert.strictEqual(mutatedAi.ok, true, `mutating AI: ${mutatedAi.why || mutatedAi.error || "written"}`);

      // STEP 3 — IMPORT the saved bundle. This is the round trip's closing half.
      const applied = await contentCall(ctx, "applySettingsBundleProbe", [
        { bundle: saved, expectOk: true },
      ]);
      assert.strictEqual(applied.ok, true, `import: ${applied.why || "merged"}`);

      // STEP 4 — the values are BACK, which is the whole of G-PERSIST's
      // "settings survive a round-trip".
      const restored = await contentCall(ctx, "readGlobalFiltersProbe", []);
      assert.strictEqual(restored.ok, true);
      assert.strictEqual(restored.filters.contrast, EXPORT_FILTERS.contrast,
        "G-PERSIST: contrast round-tripped (" + restored.filters.contrast + ")");
      assert.strictEqual(restored.filters.greyscale, EXPORT_FILTERS.greyscale,
        "G-PERSIST: greyscale round-tripped");
      assert.strictEqual(restored.filters.saturate, EXPORT_FILTERS.saturate,
        "G-PERSIST: saturate round-tripped");
      assert.strictEqual(restored.filters.sepia, EXPORT_FILTERS.sepia,
        "G-PERSIST: sepia round-tripped");
      assert.strictEqual(restored.hueShift, EXPORT_HUE, "G-PERSIST: hue shift round-tripped");

      const restoredAi = await contentCall(ctx, "readAiSettingsProbe", []);
      assert.strictEqual(restoredAi.ok, true);
      assert.strictEqual(restoredAi.provider, "openai", "G-PERSIST: the AI provider round-tripped");
      assert.strictEqual(restoredAi.model, "gpt-4o-mini", "G-PERSIST: the AI model round-tripped");
      assert.strictEqual(restoredAi.baseUrl, "",
        "G-PERSIST: the AI base URL round-tripped (empty stays empty)");

      // The round trip is only meaningful if the bundle it restored FROM is the
      // one the product produced — re-collect and compare the two blocks, so
      // "identical" is checked rather than assumed.
      const reExported = await contentCall(ctx, "collectSettingsBundleRead", []);
      assert.strictEqual(reExported.ok, true);
      assert.strictEqual(
        reExported.bundle.globalFilters.contrast,
        saved.globalFilters.contrast,
        "a re-export after the round trip agrees with the bundle it restored from",
      );
      assert.strictEqual(
        reExported.bundle.aiSettings.provider,
        saved.aiSettings.provider,
        "…and the AI record agrees too",
      );
    } finally {
      await page.close();
    }
  });
});
