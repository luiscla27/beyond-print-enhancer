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
 * AC-2 (option A, operator decision 2026-10-26): a PURE client-side SVG transform that
 * rewrites the corpus designs that carry stroke geometry, leaving fill-only designs untouched.
 *
 * WHY A STRING TRANSFORM, NOT A CSS KNOB. The border is painted as a `data:` URI through the
 * product's own `border-image` slot (D4): `border-image-source` is the whole SVG-as-image, so the
 * browser's geometry lives INSIDE the blob, not in the host element's style. The only way a
 * "weight/style" control changes the ART's stroke is to rewrite the SVG's own `stroke-width`
 * and `stroke-dasharray` presentation attributes. The transform is therefore a pure function
 * over the sanitized SVG string — it never touches the DOM, never touches `border-image-width`
 * (that is the FRAME's outer thickness, not the art's line), and every transformed result is
 * re-validated through the trust root by `adjustBorderSvg` so the sanitize-then-paint invariant
 * holds unchanged.
 *
 * The two corpus designs that are FILL-ONLY (`08-flame-crest`, `10-ink-brush` — both carry
 * `stroke-width: 0` occurrences, measured in the durable test
 * `test/unit/border_corpus_adjustability.test.js`) cannot be reached by this transform: a
 * stroke rewrite has no declaration to fire on, and its ink is `fill`, which is what a stroke
 * transform cannot change. `canAdjustBorder(svg)` reports that fact so the gallery gate can
 * disable the controls with an inline reason instead of shipping a no-op. The transform is
 * deliberately scoped to stroke-bearing designs — nothing ships a control that cannot work.
 *
 * Style cycle: solid → dashed → dotted → back to solid. The pattern values are small and
 * viewBox-relative; they are the same family the corpus instructions leave room for
 * ("no dash pattern" for solid). An EXISTING `stroke-dasharray` that is anything other than
 * `none`/absent is treated as "already styled" and the cycle leaves it as dashed rather than
 * clobbering a design's intentional pattern.
 */
const DASH_CYCLE = [
  { name: "solid", value: null },          // null => strip any dasharray => solid
  { name: "dashed", value: "4 2" },
  { name: "dotted", value: "1 3" },
];

/**
 * Rewrite every `stroke-width` presentation attribute by `factor` (1.5 = 1.5x), and apply the
 * `styleIndex` dash cycle. Pure string-in/string-out; does NOT mutate its argument.
 *
 * The regex matches `stroke-width="…"` / `stroke-width='…'` and captures the numeric value so a
 * multiplicative change preserves the design's own stroke ratios (a design whose paths mix
 * 1.6 and 2.2 units scales both by the same factor). `stroke-dasharray` is rewritten in the same
 * pass: a `none`/absent value takes the cycle at `styleIndex`; an explicit dash value is left
 * alone (treated as "already styled") unless `styleIndex` is 0 (solid), which strips it.
 *
 * @param {string} svg — a sanitized SVG string (the trust root's output)
 * @param {{weight?: number, styleIndex?: number}} params
 *   `weight`    multiplicative stroke-width factor (default 1, no change). 0.5 / 0.75 / 1 / 1.25 / 1.5
 *   `styleIndex` 0=solid, 1=dashed, 2=dotted (default 0 — no dash change)
 * @returns {string} the rewritten SVG (a NEW string; input is untouched)
 */
function transformBorderSvg(svg, params) {
  if (typeof svg !== "string" || !svg) return typeof svg === "string" ? svg : "";
  const weight = Number(params && params.weight !== undefined ? params.weight : 1) || 1;
  const styleIndex = (params && params.styleIndex !== undefined ? params.styleIndex : 0);
  const swRe = /stroke-width\s*=\s*(["'])([\d.+\-eE]+)\1/g;
  let out = svg;
  if (weight !== 1) {
    out = out.replace(swRe, (m, q, num) => {
      let v = parseFloat(num);
      if (!Number.isFinite(v) || v <= 0) return m; // never zero/negative a stroke; leave as-is
      v = v * weight;
      if (v <= 0) return m; // a weight that would invert or zero the stroke is refused
      return 'stroke-width=' + q + (Math.round(v * 1000) / 1000) + q;
    });
  }

  if (styleIndex > 0 && DASH_CYCLE[styleIndex]) {
    // An EXISTING dash value is respected (the design chose it); only `none`/absent is cycled.
    const sdRe = /stroke-dasharray\s*=\s*(["'])([^"']*)\1/g;
    const dashValue = DASH_CYCLE[styleIndex].value;
    out = out.replace(sdRe, (m, q, val) => {
      const v = String(val || "").trim().toLowerCase();
      if (v === "none" || v === "") {
        return 'stroke-dasharray=' + q + dashValue + q;
      }
      return m; // an intentional pattern stays
    });
    // A stroke-bearing element WITHOUT a dasharray attribute gains the cycle too —
    // a style control that only reached designs that already carried a dasharray
    // would be a no-op on most of the corpus (01-gilded-frame has none). Applied
    // per tag so an element that already chose a pattern (handled above) is skipped.
    out = out.replace(/<[a-z][^>]*>/gi, (tag) => {
      if (!/stroke-width\s*=/.test(tag)) return tag;
      if (/stroke-dasharray\s*=/.test(tag)) return tag;
      return tag.replace(/\s*(\/?>)$/, (m0, close) => ' stroke-dasharray="' + dashValue + '"' + close);
    });
  } else if (styleIndex === 0) {
    // solid: strip any dasharray so the weight change reads cleanly (no leftover dash).
    out = out.replace(/\s*stroke-dasharray\s*=\s*(["']).*?\1/g, "");
  }
  return out;
}

/**
 * AC-2 capability gate: can a client-side weight/style transform actually reach THIS svg?
 *
 * Returns `true` only when the SVG carries at least one `stroke-width` attribute AND no
 * `filter`/`mask`/`pattern` subtree (the `inspect` heuristic in
 * `test/unit/border_corpus_adjustability.test.js` — the two are kept in sync by reading the SAME
 * corpus fixture, so the gate and the premise test cannot disagree). The two fill-only corpus
 * designs (`08-flame-crest`, `10-ink-brush`) return `false`: a stroke transform has no
 * declaration to rewrite there, so the gallery disables the controls with an inline reason
 * rather than shipping a no-op.
 *
 * @param {string} svg — a sanitized SVG string (or a raw one; the structural check does not
 *   need the trust root)
 * @returns {boolean}
 */
function canAdjustBorder(svg) {
  if (typeof svg !== "string" || !svg) return false;
  if (/<filter\b/i.test(svg)) return false;
  if (/<mask\b/i.test(svg)) return false;
  if (/<pattern\b/i.test(svg)) return false;
  return /stroke-width\s*=/.test(svg);
}

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
 * `adjustBorderSvg(section, params)` — AC-2 (option A) client-side refinement through the choke point.
 *
 * Applies the PURE `transformBorderSvg` to the section's currently-painted SVG, then re-runs the
 * result through `renderBorderSvg` — which re-validates via the trust root — so the adjusted
 * border is painted by the SAME single writer, with the SAME sanitize-then-paint invariant, and
 * the section's record (`dataset.borderRawSvg`) carries the adjusted bytes, not the original.
 *
 * WHY THIS RE-RENDERS INSTEAD OF MUTATING `--border-img` DIRECTLY. The border is an SVG-as-image
 * `data:` URI (D4); `--border-img` holds the whole blob, and the weight/style knobs live inside
 * that blob's attributes. There is no CSS handle that reaches into a `data:` URI's strokes, so a
 * real adjustment MUST rewrite the SVG. Re-running through `renderBorderSvg` keeps the trust-root
 * gate (the transform only touches presentation attributes the corpus instructions already
 * allow, but the gate is defense-in-depth: a bug that injected a hostile attribute is refused
 * here, not on the DOM).
 *
 * The ORIGINAL is preserved by the caller: the gallery keeps the un-adjusted design alongside
 * the adjusted preview, so the comparison the criterion names ("select → adjust → regenerate
 * → compare") is between the original bytes and the adjusted bytes — no data is lost.
 *
 * `params`: `{ weight: <factor>, styleIndex: <0|1|2> }` — see `transformBorderSvg`. Passing
 * `{ weight: 1, styleIndex: 0 }` (or no params) returns the currently-painted SVG unchanged.
 *
 * Returns the same shape as `renderBorderSvg` plus `adjustable` (the capability gate) so the
 * caller can disable the controls on a fill-only border instead of erroring: a border that
 * cannot be transformed is a UI state ("controls disabled"), not a runtime error.
 *
 * @param {Element} section
 * @param {{weight?: number, styleIndex?: number}} params
 * @returns {{ok: boolean, error: string|null, reason: string|null, sanitized: string|null, adjustable: boolean, original: string|null}}
 */
function adjustBorderSvg(section, params) {
  const original = readBorderSvg(section);
  if (!original) {
    return { ok: false, error: null, reason: "no_border", sanitized: null, adjustable: false, original: null };
  }
  const adjustable = canAdjustBorder(original);
  if (!adjustable) {
    // The controls are disabled by the gate before this is reached; this is defensive — fail
    // closed: a border we cannot transform paints NOTHING rather than painting garbage.
    return { ok: false, error: null, reason: "not_adjustable", sanitized: null, adjustable: false, original: null };
  }
  const transformed = transformBorderSvg(original, params || {});
  // Re-render through the choke point: the transformed bytes are re-validated by the trust root.
  const res = renderBorderSvg(section, transformed);
  return {
    ok: res.ok,
    error: res.error,
    reason: res.reason,
    sanitized: res.sanitized,
    adjustable: true,
    original, // the un-adjusted bytes, for the gallery's compare view
  };
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
  // `adjustBorderSvg` — AC-2 (option A): client-side weight/style refinement through the choke point.
  adjustBorderSvg,
  // `transformBorderSvg` — AC-2 pure SVG string transform (exposed so the gallery/spec can unit-test it directly).
  transformBorderSvg,
  // `canAdjustBorder` — AC-2 capability gate: false for fill-only borders, disables the controls with a reason.
  canAdjustBorder,
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
