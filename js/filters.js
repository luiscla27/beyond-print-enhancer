/**
 * Filters: global composite-filter CSS injection (hue/contrast/saturate/
 * greyscale/sepia) and border-style class apply/clear helpers.
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 9. Loaded before
 * js/main.js in the production script list (js/background.js) and in
 * the shared test harness boot.
 *
 * Cross-boundary seams (ratified 2026-09-07): ALL_BORDER_STYLES (now an
 * AssetCatalog export) and updateLayoutBounds are resolved lazily at call
 * time via window.* — never captured at module load.
 */

"use strict";

/**
 * Numbers only: a stray value must never be mistaken for a neutral setting and dropped. Note that
 * `Number("")` is 0 and `Number(null)` is 0 too, which is exactly how "an empty setting reads as a
 * neutral one" would slip through — so only a real number, or a non-empty numeric string, counts.
 */
function filterNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Is this one filter FUNCTION a no-op? (`hue-rotate(n*360deg)`, `contrast(100%)`, ...)
 *
 * Only exact, provable identities count; anything unparseable is NOT neutral, so its chain is
 * emitted exactly as before. `hue-rotate(-0deg)` and `hue-rotate(360deg)` are identities too, and
 * the slider is 0-360, so the test is `% 360` rather than `=== 0`.
 */
function isIdentityHue(hue) {
  return hue !== null && hue % 360 === 0;
}

function isIdentityDecoration({ contrast, saturate, greyscale, sepia }) {
  return contrast === 100 && saturate === 100 && greyscale === 0 && sepia === 0;
}

function applyGlobalFilters(filters) {
  const { hue, contrast, greyscale, saturate, sepia } = filters;

  // AN IDENTITY FILTER IS STILL A FILTER, AND IT COSTS THE PRINTED SHEET ITS TEXT LAYER.
  // Chromium rasterises a filtered subtree when it prints, so a container carrying
  // `hue-rotate(0deg)` reaches the paper as an IMAGE: measured on the live sheet, the whole
  // printed file was 0 text-showing operators / 0 characters / 17 vector paths (issue
  // print_sheet_rasterised_20260911). Writing `none` where the chain is provably an identity
  // transformation gives that back — 3,263 text ops, 11,632 characters, 12,613 paths, measured —
  // while a chain that can change a pixel is still emitted verbatim, so every setting the user
  // actually made keeps working exactly as before.
  //
  // The asymmetry is deliberate, and it is the reason this is decided PER CHAIN rather than on
  // "all sliders at their defaults": the product's DEFAULT greyscale is 100%, and `grayscale(100%)`
  // is NOT an identity — it is what makes the ornaments grey on purpose. Treating "defaults" as
  // neutral would silently un-grey them (measured: 5,458 -> 66,740 saturated pixels on page 1
  // alone), which is a behaviour change nobody asked for. Evidence and both measurements:
  // docs/print-sheet-text-layer-20260911/.
  const hueIsIdentity = isIdentityHue(filterNumber(hue));
  const decorationIsIdentity = isIdentityDecoration({
    contrast: filterNumber(contrast),
    saturate: filterNumber(saturate),
    greyscale: filterNumber(greyscale),
    sepia: filterNumber(sepia),
  });

  // Full composite filter (for isolated elements)
  const fullFilterStr = hueIsIdentity && decorationIsIdentity
    ? "none"
    : `
      hue-rotate(${hue}deg)
      contrast(${contrast}%)
      saturate(${saturate}%)
      grayscale(${greyscale}%)
      sepia(${sepia}%)
  `
        .replace(/\s+/g, " ")
        .trim();

  // Decoration-only filters (excludes hue-rotate to prevent double-application when parent is hue-rotated)
  const decorationFilterStr = decorationIsIdentity
    ? "none"
    : `
      contrast(${contrast}%)
      saturate(${saturate}%)
      grayscale(${greyscale}%)
      sepia(${sepia}%)
  `
        .replace(/\s+/g, " ")
        .trim();

  // Reversible filter for main containers (protects content from destructive filters)
  const containerFilterStr = hueIsIdentity
    ? "none"
    : `
      hue-rotate(${hue}deg)
  `
        .replace(/\s+/g, " ")
        .trim();

  const inverseContainerFilterStr = hueIsIdentity
    ? "none"
    : `
      hue-rotate(-${hue}deg)
  `
        .replace(/\s+/g, " ")
        .trim();

  // Apply to document root for global CSS variable access
  const root = document.documentElement;
  root.style.setProperty("--be-full-filter", fullFilterStr);
  root.style.setProperty("--be-decoration-filter", decorationFilterStr);
  root.style.setProperty("--be-hue-filter", containerFilterStr);
  root.style.setProperty("--be-inv-hue-filter", inverseContainerFilterStr);

  // Keep the dynamic style block for non-variable-aware elements or specific exclusions
  let style = document.getElementById("be-global-filters-style");
  if (!style) {
    style = document.createElement("style");
    style.id = "be-global-filters-style";
    document.head.appendChild(style);
  }

  style.textContent = `
      /* Shape assets and borders get decoration filters when they are INSIDE a hue-rotated container.
         Otherwise they need the full filter (including hue-rotate). */
      
      /* Default for standalone shapes (like those added with "Add Shape") */
      .be-shape-container,
      img.be-shape-asset {
          filter: var(--be-full-filter) !important;
      }

      /* If nested inside a container that already has hue-rotate, only apply decoration filters */
      .print-section-container .be-shape-container,
      .print-section-container img.be-shape-asset,
      .print-shape-container {
          filter: var(--be-decoration-filter) !important;
      }

      /* Border pseudo-elements (the ::before of .print-section-container)
         already inherit from the container, so they always use decoration-only. */
      .print-section-container::before {
          filter: var(--be-decoration-filter) !important;
      }

      /* Focus Highlight for Layer Management */
      .be-focus-highlight {
          filter: drop-shadow(0 0 15px gold) drop-shadow(0 0 15px gold) !important;
          transition: filter 0.3s ease-in-out;
          z-index: 700000 !important;
      }

      /* Exclude text, fonts, icons, images by inverting the hue filter */
      .print-section-content,
      .be-section-actions,
      .ct-spell-damage-type__icon,
      .ct-item-status__icon,
      .ct-character-portrait__img,
      .ct-extra-row__img,
      .ddbc-character-avatar__portrait,
      .ddbc-file-icon,
      [class$="__attack-save-icon"],
      [class$="__range-icon"],
      [class$="__casting-time-icon"],
      [class$="__damage-effect-icon"],
      img:not(.be-shape-asset):not(.print-section-content img) {
          filter: var(--be-inv-hue-filter) !important;
      }

      /* Prevent double-inversion for elements already inside an inverted container */
      .print-section-content img,
      .print-section-content [class*="icon"],
      .print-section-content *,
      .be-section-actions * {
          filter: none !important;
      }

      /* Ensure the control panel is NEVER affected */
      #print-enhance-controls,
      #print-enhance-controls * {
          filter: none !important;
      }
  `;
}

function clearBorderStyles(el) {
  if (!el) return;
  const styles =
    (window.AssetCatalog && window.AssetCatalog.ALL_BORDER_STYLES) ||
    ["no-border"];
  el.classList.remove(...styles);
}

function applyBorderStyle(section, style) {
  if (!section || !style) return;
  const styleId = typeof style === "string" ? style : style.style;
  clearBorderStyles(section);
  if (styleId && styleId !== "no-border") {
    section.classList.add(styleId);
  }
  if (typeof updateLayoutBounds === "function") window.updateLayoutBounds();
}

const Filters = { applyGlobalFilters, clearBorderStyles, applyBorderStyle };
if (typeof module !== "undefined" && module.exports) {
  module.exports = Filters;
}
if (typeof window !== "undefined") {
  window.Filters = Filters;
}
