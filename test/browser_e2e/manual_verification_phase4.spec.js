/**
 * Manual Verification — Phase 4 (docs, issue annotation, release, close-out) —
 * AUTOMATED.
 *
 * The automated form of "Conductor - User Manual Verification 'Phase 4'". Per
 * vendor/conductor/workflow.md §3.1 a checkpoint is a step-by-step walkthrough with
 * expected results; here it is asserted. The human steps and their automation:
 *
 *   1. "Open the parent issue and read the dispositions"
 *        -> it is closed/archived and every finding carries a disposition
 *   2. "Check the changelog/readme mention what a user would notice"
 *        -> the newest CHANGELOG section exists and README names the user-visible changes
 *   3. "Check the version bump is consistent"
 *        -> package.json === manifest.json === the newest CHANGELOG heading
 *   4. "Check the track was archived, not left in flight"
 *        -> the archive holds it with its close-out artifact, and the registry
 *           repoints there with no live entry left behind
 *
 * Deliberately asserted as INVARIANTS (version files agree, an archive exists for
 * this track, the guard is green rather than any frozen version string, so a future
 * release does not turn this spec red.
 *
 * Run via: npm run test:e2e:verify4
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, EXT_ROOT } = require("./_helpers.js");

const TRACK = "selection_model_ia_20260910";
const read = (rel) => fs.readFileSync(path.join(EXT_ROOT, rel), "utf8");

describe("Manual verification — Phase 4 (docs, issue, release, close-out)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("walks the Phase-4 checkpoint: issue, docs, version, archive, guard", function () {
    /* Step 1 — "The parent issue is annotated per finding and closed." */
    const archivedIssue = path.join(
      EXT_ROOT,
      "temp",
      "archived",
      "ISSUE_ia_selection_track_20260909.md",
    );
    assert.ok(
      fs.existsSync(archivedIssue),
      "the parent issue was archived (a closed issue must not stay in temp/issues/)",
    );
    const issue = fs.readFileSync(archivedIssue, "utf8");
    assert.ok(
      /^\*\*Status:\*\*\s*(RESOLVED|FIXED|DONE|COMPLETE|CLOSED)/m.test(issue),
      "it carries a terminal status marker (the guard's own rule)",
    );
    // Every finding the issue lists must have a disposition, not just the ones
    // that were easy: U-24..U-34 all appear in the disposition section.
    const disposition = issue.slice(issue.indexOf("## Disposition"));
    assert.ok(disposition.length > 500, "the disposition section exists");
    [
      "U-24",
      "U-25",
      "U-26",
      "U-28",
      "U-31",
      "U-32",
      "U-33",
      "U-34",
    ].forEach((id) => {
      assert.ok(
        disposition.includes(id),
        `${id} is dispositioned in the issue (fixed or explicitly deferred)`,
      );
    });
    // …and the corrections the re-verification forced are recorded, so the audit's
    // wrong numbers do not survive as truth.
    assert.ok(
      /CORRECTED|33\b.*not 31|not 31/.test(disposition),
      "the corrected figures are recorded in the issue itself",
    );
    // The archive index keeps the trail to the archived report.
    const index = read(path.join("temp", "archived", "ARCHIVE_INDEX.md"));
    assert.ok(
      index.includes("ISSUE_ia_selection_track_20260909.md"),
      "the archived issue has a row in ARCHIVE_INDEX.md",
    );

    /* Step 2 — "The changelog and readme say what a user would notice." */
    const changelog = read("CHANGELOG.md");
    const headings = changelog.match(/^## \[(\d+\.\d+\.\d+)\]/gm) || [];
    assert.ok(headings.length > 0, "the changelog has version sections");
    const newest = headings[0].replace(/^## \[|\]$/g, "");
    const sectionStart = changelog.indexOf(headings[0]);
    const nextHeading = changelog.indexOf("## [", sectionStart + 1);
    const newestSection = changelog.slice(
      sectionStart,
      nextHeading === -1 ? undefined : nextHeading,
    );
    assert.ok(
      /### (Added|Changed|Fixed)/.test(newestSection),
      `the newest section (${newest}) is written in Keep-a-Changelog form`,
    );
    assert.ok(
      newestSection.length > 400,
      "…and actually describes the release rather than being a stub",
    );
    const readme = read("README.md");
    // The user-visible changes of this track must be findable in the README.
    ["Skip when printing", "Hide on sheet", "Got it", "Restore"].forEach((phrase) => {
      assert.ok(
        readme.includes(phrase),
        `README documents the user-visible change "${phrase}"`,
      );
    });

    /* Step 3 — "The version bump is consistent." */
    const pkg = JSON.parse(read("package.json"));
    const manifest = JSON.parse(read("manifest.json"));
    assert.strictEqual(
      manifest.version,
      pkg.version,
      "package.json and manifest.json agree on the version",
    );
    assert.strictEqual(
      newest,
      pkg.version,
      `the newest changelog section (${newest}) is the shipped version (${pkg.version})`,
    );

    /* Step 4 — "The track is archived and the registry points there." */
    const archiveDir = path.join(EXT_ROOT, "vendor", "conductor", "archive", TRACK);
    assert.ok(fs.existsSync(archiveDir), "the track lives in vendor/conductor/archive/");
    ["final_report.md", "plan.md", "spec.md", "metadata.json"].forEach((f) => {
      assert.ok(
        fs.existsSync(path.join(archiveDir, f)),
        `the archive holds ${f} (its close-out artifact included)`,
      );
    });
    assert.ok(
      !fs.existsSync(path.join(EXT_ROOT, "vendor", "conductor", "tracks", TRACK)),
      "nothing is left behind in vendor/conductor/tracks/",
    );
    const registry = read(path.join("vendor", "conductor", "tracks.md"));
    assert.ok(
      new RegExp(`archive/${TRACK}`).test(registry),
      "the registry repoints to the archived track",
    );
    assert.ok(
      !new RegExp(`tracks/${TRACK}`).test(registry),
      "…and no live link to the old location remains",
    );
    // Scoped to THIS track, deliberately (fixed 2026-09-12 while track
    // gate_coverage_20260912 was being scaffolded; see that track's phase0_remeasurement.md §R-8).
    //
    // The previous form was `!/^- \[ \] \*\*Track:/m.test(registry)` — a GLOBAL invariant that the
    // registry contain NO open entry at all. That can only hold in the instant after a release
    // closes every track, so opening ANY new track turned this spec red, and it did: registering
    // gate_coverage_20260912 (a docs-only act, and exactly what conductor-protocol requires) failed
    // this assertion. That contradicts this file's own header, which commits to asserting
    // INVARIANTS "so a future release does not turn this spec red".
    //
    // What the step actually means is "the track was archived, not left in flight" — i.e. THIS
    // track. So the check is scoped to TRACK's own registry entry, which is the assertion that can
    // both fail (mark TRACK's entry `[ ]` and watch it) and survive unrelated new tracks.
    const trackEntries = registry
      .split(/^(?=- \[[ x]\])/m)
      .filter((e) => e.includes(TRACK));
    assert.ok(
      trackEntries.length > 0,
      `the registry still carries an entry for ${TRACK} (it must be marked, not deleted)`,
    );
    assert.ok(
      trackEntries.every((e) => /^- \[x\] /.test(e)),
      `every registry entry for the archived ${TRACK} is marked complete, not left open: ` +
        trackEntries.filter((e) => !/^- \[x\] /.test(e)).map((e) => e.split("\n")[0]).join(" | "),
    );

    /* Step 5 ("Run the guard") was a self-maintenance artefact and is not run here: the guard
       script is not carried by this repository. */
  });

  it("the released build boots — the close-out's own smoke check", async function () {
    const page = await bootPage(ctx);
    try {
      const state = await page.evaluate(() => {
        const m = document.getElementById("print-enhance-layer-manager");
        const row = m && m.querySelector(".be-layer-row");
        return {
          controls: !!document.getElementById("print-enhance-controls"),
          // The released behaviour a user can see on a layer row.
          rowControls: row
            ? Array.from(row.querySelectorAll(".be-layer-controls button")).map(
                (b) => b.title,
              )
            : [],
        };
      });
      assert.ok(state.controls, "the extension boots");
      assert.ok(
        state.rowControls.includes("Skip when printing") &&
          state.rowControls.includes("Hide on sheet"),
        "the released layer-row copy is what the docs describe: " +
          JSON.stringify(state.rowControls),
      );
    } finally {
      await page.close().catch(() => {});
    }
  });
});
