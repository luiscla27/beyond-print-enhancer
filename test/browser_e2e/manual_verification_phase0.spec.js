/**
 * Manual Verification — Phase 0 (scaffold, Muse gate, audit re-verification,
 * blast radius, baselines) — AUTOMATED.
 *
 * This is the automated form of the checkpoint the plan called
 * "Conductor - User Manual Verification 'Phase 0'". The conductor workflow
 * (vendor/conductor/workflow.md §3.1) defines such a checkpoint as a step-by-step plan of
 * user-facing actions with expected results; the steps below are that walkthrough,
 * in the same order, asserted instead of eyeballed. Each step's human wording is in
 * the comment above its assertions.
 *
 * The walkthrough (derived from the archived track's Phase-0 record):
 *   1. "Read the gate artifacts"        -> three reviews exist, each with its provider footer
 *   2. "Check the baseline is real"     -> the debt oracle suite RUNS and has no failures
 *   3. "Check the audit was re-verified"-> the per-claim table and the corrected figures are recorded
 *   4. "Check the blast radius was read"-> the read and its budget verdict are recorded, and the
 *                                          store lives where that read said it would
 *   5. "Check the scaffold is complete" -> the track's documents and metadata are present/parsable
 *   6. "Boot it and look"               -> the extension boots clean and exposes the seams the
 *                                          blast-radius read enumerated
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:verify0
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { launchExtensionContext, bootPage, EXT_ROOT } = require("./_helpers.js");

const TRACK_DIR = path.join(EXT_ROOT, "vendor", "conductor", "archive", "selection_model_ia_20260910");
const read = (p) => fs.readFileSync(path.join(TRACK_DIR, p), "utf8");
const readJs = (p) => fs.readFileSync(path.join(EXT_ROOT, "js", p), "utf8");

describe("Manual verification — Phase 0 (scaffold, gate, audit, baselines)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  // ---------------------------------------------------------------- steps 1-5
  it("walks the Phase-0 checkpoint: artifacts, baseline, audit re-read, blast radius, scaffold", function () {
    /* Step 1 — "The Muse 3-review gate ran before any build task." */
    ["muse_review_1.md", "muse_review_2.md", "muse_review_3.md"].forEach((f) => {
      const body = read(f);
      assert.ok(body.trim().length > 500, `${f} has substantive content`);
      assert.ok(
        /provider=\w+/.test(body),
        `${f} records which provider answered (the gate's own provenance)`,
      );
    });
    // The two mandatory consultations are kept beside the reviews, so the
    // dispositions they produced are auditable rather than folklore.
    ["consult_phase1_reply.md", "consult_phase1_round7_reply.md"].forEach((f) => {
      assert.ok(read(f).includes("provider="), `${f} is a real consultation record`);
    });

    const plan = read("plan.md");
    const spec = read("spec.md");

    /* Step 2 — "Re-measure the baselines and confirm they hold."  The debt oracle
       is the one baseline a spec can re-run cheaply and unambiguously; it must be
       green NOW, which is the durable half of the phase's claim. */
    const oracle = execFileSync(
      process.execPath,
      [
        require.resolve("mocha/bin/mocha.js"),
        "--recursive",
        path.join(EXT_ROOT, "test", "unit", "encapsulation_debt"),
      ],
      { cwd: EXT_ROOT, encoding: "utf8" },
    );
    assert.ok(
      /\d+ passing/.test(oracle),
      "the debt oracle suite ran and reported passing cases",
    );
    assert.ok(
      !/\b[1-9]\d* failing/.test(oracle),
      "the debt oracle has NO failures right now (this is the phase's baseline claim)",
    );
    // …and the phase RECORDED its numbers, so "record any delta" was satisfied.
    assert.ok(
      /debt oracle .*resolve|debt oracle \(`npx mocha --recursive test\/unit\/encapsulation_debt`\)/i.test(
        plan,
      ),
      "the plan records the re-measured debt-oracle baseline",
    );
    assert.ok(
      /full mocha suite[^\n]*\*\*\d+\/\d+\*\*/i.test(plan) ||
        /\d+\/\d+\*\*, not 853/.test(plan),
      "the plan records the re-measured full-suite baseline",
    );

    /* Step 3 — "The audit was re-verified at file level before building." */
    assert.ok(
      /Audit re-verification \(file level/.test(plan),
      "the per-claim re-verification table is in the record",
    );
    // The two corrections the re-read produced: a drifted line number and a wrong
    // count. If someone "tidies" the record back to the audit's numbers, this fails.
    assert.ok(
      /CONFIRMED, line numbers DRIFTED|:1355/.test(plan),
      "U-25's drifted line numbers are recorded as a correction",
    );
    assert.ok(
      /DISCREPANCY — 33, not 31|33, not 31/.test(plan),
      "U-32's corrected count (33, not 31) is recorded",
    );
    assert.ok(
      /spec\.md.*Audit Evidence|Baseline for the phase gates/.test(spec),
      "spec.md carries the corrected baseline pointer",
    );

    /* Step 4 — "The blast radius was read before any code, with a budget verdict." */
    assert.ok(
      /A\. Sheet-active target|Blast-radius read \(required before any code/.test(plan),
      "the blast-radius read is recorded",
    );
    assert.ok(
      /Budget verdict:/.test(plan),
      "…with its budget verdict (the phase's stop-or-proceed decision)",
    );
    // The read concluded the store belongs in the properties panel. Assert the
    // product still matches that conclusion rather than trusting the note.
    const panel = readJs("properties_panel.js");
    assert.ok(
      /let activeTarget = null;/.test(panel) && /function setActiveSection\(/.test(panel),
      "the store lives where the blast-radius read said it would (js/properties_panel.js)",
    );
    assert.ok(
      /setActiveSection/.test(panel) &&
        (panel.match(/function setActiveSection\(/g) || []).length === 1,
      "…and it is still the single write path the read promised",
    );

    /* Step 5 — "The scaffold is complete." */
    ["spec.md", "plan.md", "index.md", "metadata.json", "final_report.md"].forEach((f) => {
      assert.ok(fs.existsSync(path.join(TRACK_DIR, f)), `${f} exists in the track`);
    });
    const meta = JSON.parse(read("metadata.json"));
    assert.strictEqual(
      meta.track_id,
      "selection_model_ia_20260910",
      "metadata identifies the track",
    );
    assert.ok(
      /COMPLETE/.test(meta.status),
      "metadata records the terminal status: " + meta.status.slice(0, 60),
    );
    assert.ok(meta.baseline && meta.audit_evidence, "metadata carries baseline + audit evidence");
  });

  // ---------------------------------------------------------------- step 6
  it("boots the extension clean and exposes the seams the blast-radius read enumerated", async function () {
    /* Step 6 — "Open a character sheet and confirm the editor comes up." */
    const page = await bootPage(ctx);
    try {
      const state = await page.evaluate(() => ({
        controls: !!document.getElementById("print-enhance-controls"),
        layers: !!document.getElementById("print-enhance-layer-manager"),
        sectionsLayer: !!document.getElementById("print-enhance-sections-layer"),
        shapesLayer: !!document.getElementById("print-enhance-shapes-layer"),
        panel: !!document.getElementById("print-enhance-properties-panel"),
      }));
      assert.deepStrictEqual(
        state,
        {
          controls: true,
          layers: true,
          sectionsLayer: true,
          shapesLayer: true,
          panel: true,
        },
        "every surface the blast-radius read enumerated is present after boot",
      );
    } finally {
      await page.close().catch(() => {});
    }
  });
});
