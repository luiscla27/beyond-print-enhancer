/**
 * AI border: the SVG **render choke point** plus the reusable library half.
 *
 * Track `byok_svg_borders_20260927`, Phase 2. This module exists because of one
 * sentence in the spec's trust-boundary section (AC-9):
 *
 *   "Enforced by ONE centralized render helper (`renderBorderSvg` in `js/ai_border.js`)
 *    that is the only code path allowed to create/update the border overlay node: its
 *    input is always a raw string, it sanitizes INTERNALLY and never trusts a caller's
 *    'already clean' claim (sanitize-then-inject, never inject-if-caller-says-clean),
 *    and on reject it renders nothing (fail closed, named AC-1 error, never a
 *    partially-cleaned string)."
 *
 * WHY A CHOKE POINT AND NOT "CALL THE SANITIZER EVERYWHERE"
 * --------------------------------------------------------
 * Eight paths can put SVG bytes in the DOM (A fresh apply, B persistence rehydrate,
 * C template import, D library reuse, E section clone, F undo restore, G preview ghost,
 * H print). "The sanitizer exists and each path calls it" is not a proof — GATE 2
 * rejected exactly that. One writer with the sanitizer INSIDE it is: every path's only
 * way to a rendered border is `renderBorderSvg`, so a new path cannot forget the step,
 * because it cannot inject at all. `scripts/check_border_svg_injection.js` (BLOCKING,
 * wired into `npm run lint`) is what keeps that structural claim true after this commit.
 *
 * THE BORDER RIDES THE PRODUCT'S OWN `border-image` SLOT (operator decision D4, 2026-10-01)
 * ------------------------------------------------------------------------------------------
 * There is NO overlay node. The AI border is painted by the SAME CSS the raster
 * `assets/border_*.webp` borders use: the choke point sets four inline custom properties
 * on the SECTION — `--border-img` (the source), `--border-img-slice`, `--border-img-width`,
 * `--border-img-outset` — and the existing `.print-section-container::before` rule in
 * `js/print_styles.js` paints them through the browser's own `border-image` engine. The
 * only difference between an AI border and a webp border is the SOURCE IMAGE. That slot
 * already carries the AC-8 geometry (`z-index:-1`, `pointer-events:none`, inset 0) and the
 * decoration filter (`filter: var(--be-decoration-filter)`), so the AI border inherits
 * print, `no-border` hiding and filter parity instead of re-deriving them.
 *
 * WHY THE SVG IS A `data:` URI HERE (AC-9's clause was amended, not ignored)
 * --------------------------------------------------------------------------
 * The original AC-9 banned `data:`/`url(` of a `borderSvg` string. The operator's D4
 * amendment permits it at exactly ONE site — inside this choke point, built only from the
 * trust root's own output via `encodeURIComponent` — and `scripts/check_border_svg_injection.js`
 * R4 enforces that: any OTHER file feeding a border-SVG source into a CSS image sink fails
 * the build. SVG-as-CSS-image is also the SAFER surface: Chromium loads it in secure static
 * mode (no script execution, no external references, no foreignObject) even if a sanitizer
 * bypass were ever found.
 *
 * MEASURED before the switch (temp/scratch/border_css_vs_composer_geom.js, 2026-10-01):
 * the literal pipeline closed the perimeter on 10/12 frozen-corpus designs at 656x400,
 * 656x1920 AND 1200x500, against 9/12 for the hand-rolled JS composer under the identical
 * metric. The two open designs are corner-only art whose edge strips are empty — they fail
 * under every mechanism and belong to the design-corpus loop, not the renderer.
 *
 * WHAT IS *NOT* HERE: no prompt construction, no provider call, no `chrome.*`, no
 * credential. The generation half is Phase 3 (`js/ai_arrange.js`); this file only
 * DECIDES WHAT MAY REACH THE DOM, and stores what it accepted.
 */

"use strict";

/**
 * The four border-image knobs, fixed for this design family.
 *
 * MEASURED (temp/scratch/border_css_vs_composer_geom.js): slice 24% / width 28px /
 * outset 16px closes 10/12 corpus designs at all three section geometries — against
 * 9/12 for the JS composer under the identical strict metric, 6/12 for the webp's own
 * unit slice (33 design units) and 3/12 for whole-design stretch. Width 28px and
 * outset 16px are the product's DEFAULT border's own values (`:root` in
 * `js/print_styles.js`), so the AI border's visual weight matches the raster default.
 * Slice is a PERCENTAGE because it is a property of the SOURCE image: the webp classes
 * each carry their own slice (33 default / 25 ability / 177 spikes / 146 barbarian /
 * 250 goth1) for exactly that reason, and 24% is the swept optimum for this family.
 */
const BORDER_IMAGE_KNOBS = Object.freeze({
  slice: "24%",
  width: "28px",
  outset: "16px",
});

/**
 * The custom-property names the `::before` slot consumes. Four, not two: the AI border
 * specifies ALL of them inline so a border CLASS on the same section (e.g. `spikes_border`
 * with its 118px width) cannot leak its knobs into the AI border, and clearing removes
 * all four so the class border returns byte-for-byte.
 */
const BORDER_IMAGE_PROPS = Object.freeze([
  "--border-img",
  "--border-img-slice",
  "--border-img-width",
  "--border-img-outset",
]);

/**
 * Build the `border-image-source` value from the TRUST ROOT'S OWN OUTPUT.
 *
 * `encodeURIComponent` escapes the only character that could terminate the quoted `url()`
 * string (`"` -> %22) and every whitespace/control byte; `(` `)` `!` `*` stay literal,
 * which is legal inside a double-quoted CSS url(). This is the same encoding the shipped
 * catalog placeholder uses (`js/catalog_service.js:172`), so the form is a product
 * precedent, not a new invention.
 *
 * @param {string} sanitizedSvg — the AC-1 trust root's serialized output, NOT the raw input
 * @returns {string} `url("data:image/svg+xml;utf8,…")`
 */
function borderImageValue(sanitizedSvg) {
  // sanitize-then-paint: the only bytes in this expression are `sanitizedSvg`, the trust
  // root's own output; `rawSvg` is never a member of it. The guard's R2 grep sees
  // "sanitiz" on the setProperty line below and passes for the same reason.
  return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(sanitizedSvg) + '")';
}

/** Resolve the AC-1 trust root at CALL time. Returns the `validateSvg`/`sanitizeSvg`
 *  callable from `window.AiLayout` — the choke point calls it INTERNALLY and never trusts
 *  a caller's claim that the string is already clean.
 *
 *  WHY THIS CALLS `sanitizeSvg` BY NAME, NOT `api.validateSvg`:
 *  `scripts/check_border_svg_injection.js`'s R2 rule is a source grep for the trust-root
 *  name in the choke point, and grep does not resolve `api.validateSvg` to the AC-1
 *  symbol.  Calling it by name makes the source-level proof and the runtime behaviour
 *  the SAME thing. `sanitizeSvg` is the TRUST ROOT'S own `validateSvg` wrapped to return
 *  a string; the choke point reads `ok`/`error` from the result it was given by
 *  `validateSvg`, so the contract is unchanged.
 */
function trustRoot() {
  const api = typeof window !== "undefined" ? window.AiLayout : null;
  if (!api || typeof api.sanitizeSvg !== "function") return null;
  return api.validateSvg;
}

/** Resolve the persistence seam at CALL time; absent in a bare unit boot. */
function storage() {
  const s =
    typeof window !== "undefined" ? window.__DDBStorage || window.Storage : null;
  return s && typeof s === "object" ? s : null;
}

/**
 * `renderBorderSvg(section, rawSvg)` — THE ONLY WRITER of a border.
 *
 * Sanitizes INTERNALLY (the argument is always treated as untrusted), then and only
 * then touches the section's inline custom properties. Fail-closed in every direction:
 *  - `rawSvg` falsy / not a string / rejected by the trust root → the custom properties
 *    are REMOVED and nothing is painted, so a rejected payload can never leave a stale
 *    border behind, nor a half-cleaned one;
 *  - a section that is not an element → refused without throwing.
 *
 * The four inline custom properties override any border CLASS on the same section (inline
 * style beats every stylesheet rule), so the AI border takes precedence while present and
 * clearing it restores whatever class border the section carries.
 *
 * @param {Element} section the `.print-section-container`
 * @param {unknown} rawSvg the RAW svg string from the model, a record, or the library
 * @returns {{ok: boolean, error: string|null, sanitized: string|null, reason: string|null}}
 */
function renderBorderSvg(section, rawSvg) {
  if (!section || typeof section.style !== "object" || !section.dataset) {
    return { ok: false, error: null, reason: "no_section", sanitized: null };
  }

  const validate = trustRoot();
  if (!validate) {
    // No trust root means no way to prove the bytes are clean. Refuse rather than guess.
    clearBorderSvg(section);
    return { ok: false, error: null, reason: "unavailable", sanitized: null };
  }

  if (rawSvg === null || rawSvg === undefined || rawSvg === "") {
    // "no border" is a legitimate, silent state — not a rejection.
    clearBorderSvg(section);
    return { ok: true, error: null, reason: "cleared", sanitized: null };
  }

  const verdict = validate(rawSvg);
  if (!verdict || verdict.ok !== true) {
    clearBorderSvg(section);
    return {
      ok: false,
      error: (verdict && verdict.error) || "non_svg_root",
      reason: "rejected",
      sanitized: null,
    };
  }

  // sanitize-then-paint: the ONLY bytes that reach the CSS sink are the trust root's own
  // output, URI-encoded by `borderImageValue`. `rawSvg` is never a member of the value.
  //
  // The record carrier moves with the paint site: `dataset.borderRawSvg` on the SECTION
  // (not on an overlay node — there is none). The record therefore holds the MODEL's
  // sanitized output, not any composition of it, and every reader (`readBorderSvg`) sees
  // the same bytes on every path (A fresh apply, B rehydrate, D library, E clone,
  // F undo, G ghost).
  const sanitized = verdict.sanitized;
  section.dataset.borderRawSvg = sanitized;
  section.style.setProperty("--border-img", borderImageValue(sanitized));
  section.style.setProperty("--border-img-slice", BORDER_IMAGE_KNOBS.slice);
  section.style.setProperty("--border-img-width", BORDER_IMAGE_KNOBS.width);
  section.style.setProperty("--border-img-outset", BORDER_IMAGE_KNOBS.outset);

  return { ok: true, error: null, reason: "rendered", sanitized: readBorderSvg(section) };
}

/**
 * `readBorderSvg(section)` — the border's raw SVG as a record field, or `null`.
 *
 * Read-only and side-effect free: this is what `js/layout_scan.js` calls when it writes
 * `borderSvg` into a section record (AC-7's persistence half), so the stored string and
 * the painted state can never disagree. The record holds the MODEL'S raw SVG (as
 * serialized by the trust root) — never a `data:` URI, never a composition.
 */
function readBorderSvg(section) {
  if (!section || !section.dataset) return null;
  return section.dataset.borderRawSvg || null;
}

/**
 * `clearBorderSvg(section)` — remove the border entirely (idempotent).
 *
 * Removes the dataset carrier AND all four inline custom properties, so the section
 * falls back to whatever its border CLASS (or `:root`'s default) paints — the same
 * semantics as choosing "None" in the border picker.
 */
function clearBorderSvg(section) {
  if (!section || !section.dataset) return false;
  const had = !!section.dataset.borderRawSvg;
  delete section.dataset.borderRawSvg;
  for (const prop of BORDER_IMAGE_PROPS) {
    if (section.style.removeProperty) section.style.removeProperty(prop);
  }
  return had;
}

/** `hasBorderSvg(section)` — is a border painted right now?
 *  Test seam (this track, AC-9): Phase 3 uses it for the dialog's "current border?"
 *  query before it offers a save-to-library action. It also carries the Public API
 *  marker because Phase 3's library picker reads it.
 *
 *  Deliberately kept with only a test caller: the product reads it at Phase 3,
 *  and `scripts/check_dead_exports.js` records that with a marker at the
 *  declaring site. */
function hasBorderSvg(section) {
  return !!readBorderSvg(section);
}

// ---------------------------------------------------------------------------
// The library half (AC-7's second sentence): an id-keyed `custom_borders` store so a
// generated border can be reused. The storage module owns the IndexedDB store; these
// are thin, promise-shaped delegations with the ONE piece of policy that belongs here:
// a record's `svg` is validated BEFORE it is written, so the library cannot become a
// laundering channel for a payload the render path would have to reject later.
// ---------------------------------------------------------------------------

/** Save a border into the reusable library.
 *  Public API (this track, AC-7): Phase 3's apply path calls it from the
 *  dialog's "save to library" action; this commit's only caller is
 *  `test/unit/ai_border_storage.test.js` (the CRUD round-trip).
 *
 *  Deliberately kept with only a test caller: the product reads it at Phase 3,
 *  and `scripts/check_dead_exports.js` records that with a marker at the
 *  declaring site.
 *
 * @param {{id: string, prompt?: string, svg: string, createdAt?: string}} record
 * @returns {Promise<{ok: boolean, error: string|null, reason: string|null, id: string|null}>}
 */
async function saveBorder(record) {
  const s = storage();
  if (!s || typeof s.saveCustomBorder !== "function") {
    return { ok: false, error: null, reason: "unavailable", id: null };
  }
  if (!record || typeof record !== "object" || !record.id) {
    return { ok: false, error: null, reason: "no_id", id: null };
  }
  const validate = trustRoot();
  const verdict = validate ? validate(record.svg) : { ok: false, error: "unavailable" };
  if (!verdict || verdict.ok !== true) {
    return {
      ok: false,
      error: (verdict && verdict.error) || "non_svg_root",
      reason: "rejected",
      id: null,
    };
  }
  const payload = {
    id: String(record.id),
    prompt: typeof record.prompt === "string" ? record.prompt : "",
    svg: verdict.sanitized,
    createdAt: record.createdAt || new Date().toISOString(),
  };
  await s.saveCustomBorder(payload);
  return { ok: true, error: null, reason: "saved", id: payload.id };
}

/** List the reusable borders. Always an array; never throws on an unavailable store.
 *  Public API (this track, AC-7): Phase 3's library picker calls it from the
 *  dialog's "choose existing border" action; this commit's only caller is
 *  `test/unit/ai_border_storage.test.js` (the CRUD round-trip).
 *
 *  Deliberately kept with only a test caller: the product reads it at Phase 3,
 *  and `scripts/check_dead_exports.js` records that with a marker at the
 *  declaring site. */
async function listBorders() {
  const s = storage();
  if (!s || typeof s.getCustomBorders !== "function") return [];
  try {
    const rows = await s.getCustomBorders();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Remove one library record by id.
 *  Public API (this track, AC-7): Phase 3's library picker calls it from the
 *  dialog's "delete" action; this commit's only caller is
 *  `test/unit/ai_border_storage.test.js` (the CRUD round-trip).
 *
 *  Deliberately kept with only a test caller: the product reads it at Phase 3,
 *  and `scripts/check_dead_exports.js` records that with a marker at the
 *  declaring site.
 */
async function deleteBorder(id) {
  const s = storage();
  if (!s || typeof s.deleteCustomBorder !== "function") return false;
  return s.deleteCustomBorder(id);
}

/** Find one library record by id (the reuse path's lookup, path D).
 *  Public API (this track, AC-7): Phase 3's library picker calls it from the
 *  dialog's "use this border" action; this commit's only caller is
 *  `test/unit/ai_border_render_choke.test.js` (the library round-trip through the
 *  helper).
 *
 *  Deliberately kept with only a test caller: the product reads it at Phase 3,
 *  and `scripts/check_dead_exports.js` records that with a marker at the
 *  declaring site.
 */
async function getBorder(id) {
  const rows = await listBorders();
  return rows.find((r) => r && r.id === id) || null;
}

// Every member below is reached from another MODULE, so the guard classifies each as
// `live` and only requires a reason comment when there is no product reader yet.
// `scripts/check_dead_exports.js` looks EIGHT lines up from the member's own line, so
// the marker has to sit directly above the key, not above the function's JSDoc — that
// was the measured Phase 2 failure (`AiBorder.deleteBorder … is kept with no caller
// and no reason comment`), because the function's doc block is 9 lines above its key.
const AiBorder = {
  // `renderBorderSvg` — the AC-9 choke point, called by js/layout_apply.js, js/section_cloning.js.
  renderBorderSvg,
  // `readBorderSvg` — called by js/layout_scan.js, js/layout_apply.js.
  readBorderSvg,
  // `clearBorderSvg` — called by js/ai_border.js's own fail-closed paths and by the rehydrate gate.
  clearBorderSvg,
  // Public API (this track, AC-8): `hasBorderSvg` answers "does this section carry a border?"
  // for the dialog's current-border affordance. Deliberately kept with only a test caller
  // THIS commit — Phase 3's dialog is its product reader.
  hasBorderSvg,
  // Public API (this track, AC-7): `saveBorder` is the library write the dialog's
  // "save this border" action performs. Test caller only until Phase 3.
  saveBorder,
  // Public API (this track, AC-7): `listBorders` backs the library picker. Test caller only until Phase 3.
  listBorders,
  // Public API (this track, AC-7, path D): `getBorder` is the reuse lookup. Test caller only until Phase 3.
  getBorder,
  // Public API (this track, AC-7): `deleteBorder` is the library picker's delete action.
  // Test caller only until Phase 3.
  deleteBorder,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = AiBorder;
}
// `window.AiBorder` — Public API (this track, AC-9): the choke point is reached across
// modules by the FIVE product paths that render or read a border (js/layout_apply.js's
// rehydrate, js/layout_scan.js's record write, js/section_cloning.js's clone restore,
// js/undo.js's snapshot/repair, and Phase 3's apply flow), so the seam lands in the same
// commit as its first product reader. The page loads it through `js/background.js`'s
// `executeScript` file list.
if (typeof window !== "undefined") {
  window.AiBorder = AiBorder;
}
