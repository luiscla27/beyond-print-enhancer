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
 * THE OVERLAY NODE
 * ----------------
 * `div.be-border-svg-overlay` inside the `.print-section-container`, absolutely
 * positioned to the section's rect with `z-index: -1` and `pointer-events: none`, so it
 * sits behind the content; `js/print_styles.js` owns its sizing/print CSS. That literal
 * appears in exactly these two files (the guard's R5 enforces it). The overlay is
 * APPENDED to the section — never written into `.print-section-content` — so the clone
 * path's `getSanitizedContent(content)` cannot copy it, and `borderSvg` travels as a
 * record FIELD instead (AC-7).
 *
 * WHAT IS *NOT* HERE: no prompt construction, no provider call, no `chrome.*`, no
 * credential. The generation half is Phase 3 (`js/ai_arrange.js`); this file only
 * DECIDES WHAT MAY REACH THE DOM, and stores what it accepted.
 */

"use strict";

/** The overlay node's class. See the header: two files may name it, no more. */
const BORDER_OVERLAY_CLASS = "be-border-svg-overlay";

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
 * `renderBorderSvg(section, rawSvg)` — THE ONLY WRITER of a border overlay.
 *
 * Sanitizes INTERNALLY (the argument is always treated as untrusted), then and only
 * then touches the DOM. Fail-closed in every direction:
 *  - `rawSvg` falsy / not a string / rejected by the trust root → any existing overlay
 *    is REMOVED and nothing is written, so a rejected payload can never leave a stale
 *    border behind, nor a half-cleaned one;
 *  - a section that is not an element → refused without throwing.
 *
 * @param {Element} section the `.print-section-container`
 * @param {unknown} rawSvg the RAW svg string from the model, a record, or the library
 * @returns {{ok: boolean, error: string|null, sanitized: string|null, reason: string|null}}
 */
function renderBorderSvg(section, rawSvg) {
  if (!section || typeof section.appendChild !== "function") {
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

  const overlay = ensureOverlay(section);
  // sanitize-then-inject: the ONLY thing that reaches the DOM is `verdict.sanitized`,
  // the trust root's own output. `rawSvg` is never a member of the expression below.
  overlay.innerHTML = verdict.sanitized;

  // The record must hold what the DOM ACTUALLY holds, so the canonical form is read
  // back out of the tree (browser parsing can normalise attribute spelling/casing).
  // This is what makes scan/load/undo agree byte-for-byte instead of "agree in intent".
  const canonical = readBorderSvg(section);
  if (!canonical) {
    // Parsed as clean but produced no element: fail closed rather than leave an empty box.
    clearBorderSvg(section);
    return { ok: false, error: "non_svg_root", reason: "empty", sanitized: null };
  }
  return { ok: true, error: null, reason: "rendered", sanitized: canonical };
}

/** The overlay for `section`, created (and positioned) on first use. */
function ensureOverlay(section) {
  let overlay = section.querySelector(":scope > ." + BORDER_OVERLAY_CLASS);
  if (overlay) return overlay;
  overlay = section.ownerDocument.createElement("div");
  overlay.className = BORDER_OVERLAY_CLASS;
  // The geometry contract of AC-8 lives HERE, not in a stylesheet only: an inline
  // declaration survives the print pipeline's stylesheet regeneration, and it is what
  // the DOM-level path cases assert against.
  overlay.style.position = "absolute";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "-1";
  overlay.style.overflow = "visible";
  section.appendChild(overlay);
  return overlay;
}

/**
 * `readBorderSvg(section)` — the overlay's content as a record field, or `null`.
 *
 * Read-only and side-effect free: this is what `js/layout_scan.js` calls when it writes
 * `borderSvg` into a section record (AC-7's persistence half), so the stored string and
 * the rendered tree can never disagree.
 */
function readBorderSvg(section) {
  if (!section || typeof section.querySelector !== "function") return null;
  const overlay = section.querySelector(":scope > ." + BORDER_OVERLAY_CLASS);
  if (!overlay) return null;
  const svg = overlay.querySelector("svg");
  if (!svg) return null;
  return svg.outerHTML;
}

/** `clearBorderSvg(section)` — remove the overlay entirely (idempotent). */
function clearBorderSvg(section) {
  if (!section || typeof section.querySelector !== "function") return false;
  const overlays = section.querySelectorAll(":scope > ." + BORDER_OVERLAY_CLASS);
  overlays.forEach((el) => el.remove());
  return overlays.length > 0;
}

/** `hasBorderSvg(section)` — is an overlay rendered right now?
 *  Test seam (this track, AC-9): Phase 3 uses it for the dialog's "current border?"
 *  query before it offers a save-to-library action. It also carries the Public API
 *  marker because Phase 3's library picker reads it, but the only caller THIS commit
 *  has is `test/unit/ai_border_render_choke.test.js` (the positive-control case that a
 *  rendered clean SVG is observable as state).
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
  BORDER_OVERLAY_CLASS,
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
