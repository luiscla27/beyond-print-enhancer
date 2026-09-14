/**
 * Browser-e2e harness — the RE-EXPORT SHIM (track refactor_surface_20260911, Phase 6, AC-6).
 *
 * `_helpers.js` used to hold everything: the page-side plumbing AND ~520 lines of stringified in-page
 * probe functions. Those are two different kinds of asset — the stringified half can only ever be
 * moved verbatim, because MV3's CSP requires the probes to be real function objects — so they now
 * live in `_helpers/inject.js` and `_helpers/dom.js`.
 *
 * This file stays, and re-exports the SAME names, so the ~50 specs that require it need no change at
 * all. A spec that wants only the page-side half may require `_helpers/dom.js` directly.
 */
"use strict";

const dom = require("./_helpers/dom.js");
const inject = require("./_helpers/inject.js");

module.exports = {
  ...dom,
  ...inject,
};
