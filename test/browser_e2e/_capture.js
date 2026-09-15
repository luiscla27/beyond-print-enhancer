/**
 * ONE capture harness for the visual-gate specs (track refactor_surface_20260911, Phase 6, AC-6).
 *
 * WHY THIS EXISTS: eleven `*_visual_capture.spec.js` files each re-declared the same ~40 lines of
 * plumbing — the artifact root, the `*_SHOTS` enable flag, the `*_SHOTS_DIR` override, the shots
 * subdirectory, the pinned viewport, a `provenance()` git reader and the graceful-skip pattern —
 * with the copies drifting in small ways (one grew a `harness` argument, another did not). Adding a
 * capture spec should be a few lines, not a copy of a preamble.
 *
 * WHAT IT DOES NOT DO: it owns no assertions and no artifact NAMES. A spec keeps its own filenames,
 * its own `page.screenshot` calls and its own expectations, so migrating a spec is a byte-identical
 * change to its artifacts.
 *
 * USAGE (a spec keeps its module-level constants, now supplied by the harness):
 *
 *   const { captureHarness } = require("./_capture.js");
 *   const cap = captureHarness({
 *     flag: "UNDO_SHOTS",            // the enable env var
 *     dirVar: "UNDO_SHOTS_DIR",      // the override env var
 *     defaultDir: "vendor/docs/undo-stack-20260911",
 *     subdir: "shots",               // joined onto the root, or "" for the root itself
 *   });
 *   // cap.enabled / cap.artRoot / cap.shots / cap.viewport / cap.phase / cap.provenance(page, name)
 *   //   / cap.skipIfDisabled(ctx)  — the graceful skip, in one place
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

/** The one place the pinned capture viewport is written down (it was in three specs). */
const VIEWPORT = { width: 1440, height: 900 };

/**
 * Build the capture harness for one spec.
 *
 * @param {object} o
 * @param {string} o.flag          the enable env var (`UNDO_SHOTS`)
 * @param {string} o.dirVar        the artifact-root override (`UNDO_SHOTS_DIR`)
 * @param {string} o.defaultDir    the root when `dirVar` is unset
 * @param {string} [o.subdir]      a subdirectory of the root (e.g. `shots`, `shots-phase2`)
 * @param {string} [o.phaseVar]    an optional phase-selection env var
 * @param {string} [o.defaultPhase] its default
 */
function captureHarness(o) {
  const artRoot = path.resolve(ROOT, process.env[o.dirVar] || o.defaultDir);
  const shots = o.subdir ? path.join(artRoot, o.subdir) : artRoot;
  const phase = o.phaseVar ? process.env[o.phaseVar] || o.defaultPhase || "" : undefined;

  return {
    enabled: !!process.env[o.flag],
    artRoot,
    shots,
    subdir: o.subdir || "",
    viewport: VIEWPORT,
    phase,
    /** `{commit, viewport, capturedAt, harness}` — the record every capture writes beside its frames. */
    provenance(page, harnessName) {
      let sha = "(unknown)";
      try {
        sha = require("child_process")
          .execSync("git rev-parse --short HEAD", { cwd: ROOT })
          .toString()
          .trim();
      } catch {
        /* not a repo */
      }
      return {
        commit: sha,
        viewport: page.viewportSize(),
        capturedAt: new Date().toISOString(),
        harness: harnessName || null,
      };
    },
    /**
     * The graceful skip, in ONE place: a normal `npm run test:e2e` must not capture and must not
     * fail, so a disabled harness skips rather than asserting.
     */
    skipIfDisabled(ctx) {
      if (!this.enabled) ctx.skip();
    },
    /** `mkdir -p` the shots directory and write one frame; returns the path it wrote. */
    async frame(page, name) {
      fs.mkdirSync(shots, { recursive: true });
      const full = path.join(shots, name);
      await page.screenshot({ path: full });
      console.log("frame:", path.join(o.subdir || "", name));
      return full;
    },
    /** Write a JSON probe beside the frames, with the same logging shape the specs had. */
    probe(name, value) {
      fs.mkdirSync(shots, { recursive: true });
      const full = path.join(shots, name);
      fs.writeFileSync(full, JSON.stringify(value, null, 2));
      console.log("probe:", path.join(o.subdir || "", name));
      return full;
    },
  };
}

module.exports = { captureHarness, CAPTURE_VIEWPORT: VIEWPORT };
