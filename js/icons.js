/**
 * Icons: 16px single-weight SVG line-icon set (1.5px stroke, currentColor)
 * for the extension chrome — the fantasy print-shop icon language locked in
 * consultant round 3 (ui_ux_overhaul_20260908).
 *
 * Loaded by js/background.js after js/ui_theme.js and before js/main.js;
 * mirrored in test/unit/encapsulation_debt/debt_harness.js. Modules reach the
 * set lazily at render time via `window.Icons.get(name)` (fail-open to a text
 * fallback), so load order never matters for correctness.
 */

"use strict";

const ICON_PATHS = {
  printer:
    '<rect x="2.5" y="3" width="11" height="7" rx="1.5"></rect>' +
    '<path d="M4.5 10v2.5h7V10"></path>' +
    '<path d="M4 6h.01"></path>',
  printerOff:
    '<rect x="2.5" y="3" width="11" height="7" rx="1.5"></rect>' +
    '<path d="M4.5 10v2.5h7V10"></path>' +
    '<path d="M1.5 1.5l13 13"></path>',
  eye: '<path d="M1.5 8s2.4-4.2 6.5-4.2S14.5 8 14.5 8s-2.4 4.2-6.5 4.2S1.5 8 1.5 8z"></path><circle cx="8" cy="8" r="1.9"></circle>',
  eyeOff:
    '<path d="M1.5 8s2.4-4.2 6.5-4.2S14.5 8 14.5 8s-2.4 4.2-6.5 4.2S1.5 8 1.5 8z"></path>' +
    '<path d="M1.5 1.5l13 13"></path>',
  lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.2" fill="currentColor" stroke="none"></rect><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"></path>',
  lockOpen: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.2"></rect><path d="M5.5 7V5.2a2.5 2.5 0 0 1 4.6-1.3"></path>',
  trash:
    '<path d="M2.5 4h11"></path><path d="M6.5 4V2.8h3V4"></path>' +
    '<path d="M4 4l.7 9.2h6.6L12 4"></path><path d="M6.5 7v3.5M9.5 7v3.5"></path>',
  plus: '<path d="M8 3v10M3 8h10"></path>',
  folderOpen: '<path d="M2 4.5h4l1.5 2H14v7H2z"></path><path d="M2 6.5h12"></path>',
  reset: '<path d="M3 4.5V1M3 1l2.6 2.6A6 6 0 1 1 2.6 10"></path>',
  layers: '<path d="M8 1.5l6 3-6 3-6-3z"></path><path d="M2 8l6 3 6-3"></path>',
  stack: '<path d="M2.5 9l5.5 3.5L13.5 9"></path><path d="M2.5 6.2L8 9.7l5.5-3.5L8 2.7z"></path>',
  clone: '<rect x="3" y="2.5" width="9" height="9" rx="1"></rect><path d="M5.5 13.5h6a2 2 0 0 0 2-2v-6"></path>',
  compact: '<path d="M3 4.5h10M3 8h10M3 11.5h6.5"></path>',
  download: '<path d="M8 2v8.5M4.5 7L8 10.5 11.5 7"></path><path d="M2.5 13.5h11"></path>',
  savePc: '<rect x="2.5" y="2.5" width="11" height="8.5" rx="1"></rect><path d="M5 11v2.5h6V11"></path>',
  bug:
    '<circle cx="8" cy="7.5" r="3.5"></circle><path d="M8 4V2"></path>' +
    '<path d="M4.5 5.5L2.5 4.5M11.5 5.5l2-1M4.2 8.5l-2 1M11.8 8.5l2 1"></path><path d="M8 11v2.5"></path>',
  heart: '<path d="M8 13S2 9.8 2 6a2.9 2.9 0 0 1 5.2-1.7L8 5.4l.8-1.1A2.9 2.9 0 0 1 14 6c0 3.8-6 7-6 7z"></path>',
  x: '<path d="M4 4l8 8M12 4l-8 8"></path>',
  check: '<path d="M2.5 8.5l3.5 3.5L13.5 4"></path>',
  border: '<rect x="3" y="3" width="10" height="10" rx="1"></rect><path d="M3 7.5h1M12 7.5h1M7.5 3v1M7.5 12v1"></path>',
  shape: '<circle cx="8" cy="8" r="2.2"></circle><rect x="8.5" y="8.5" width="5" height="5" rx="0.8"></rect>',
  rotate: '<path d="M3 8a5 5 0 1 0 1.6-3.7"></path><path d="M3 1.5V5h3.5"></path>',
  split: '<path d="M8 2v5"></path><path d="M8 7c0 3-4 2.5-4 5M8 7c0 3 4 2.5 4 5"></path>',
  extract: '<path d="M2.5 3.5h11"></path><path d="M4.5 1.8L2.5 3.5l2 1.7"></path><path d="M8 3.5V6a3 3 0 0 1-3 3H3"></path><path d="M9.5 13.5h3"></path>',
  grid: '<rect x="2.5" y="2.5" width="11" height="11" rx="1"></rect><path d="M8 2.5v11M2.5 8h11"></path>',
  expand: '<path d="M3.5 6.5v-3h3M12.5 6.5v-3h-3M3.5 9.5v3h3M12.5 9.5v3h-3"></path>',
  grip: '<circle cx="5.5" cy="8" r="0.9" fill="currentColor" stroke="none"></circle><circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none"></circle><circle cx="10.5" cy="8" r="0.9" fill="currentColor" stroke="none"></circle>',
  // The centred nine-dot drag handle (ISSUE_drag_and_drop, 2026-09-14). The existing `grip`
  // is a THREE-dot horizontal strip — the same dot family, in the layout a centred
  // move-target affordance cannot use. NINE dots on a 3x3 grid (5/8/11 x 4/8/12 on the
  // 16px viewBox); filled, stroke-free, so a 12px render reads as dots and not rings.
  gripVertical:
    '<circle cx="5" cy="4" r="1" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="8" cy="4" r="1" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="11" cy="4" r="1" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="5" cy="8" r="1" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="11" cy="8" r="1" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="8" cy="12" r="1" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="11" cy="12" r="1" fill="currentColor" stroke="none"></circle>',
  sparkle:
    '<path d="M8 1.8l1.1 3.4 3.4 1.1-3.4 1.1L8 10.8 6.9 7.4 3.5 6.3l3.4-1.1z"></path>' +
    '<path d="M12.5 10l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z"></path>',
  target: '<circle cx="8" cy="8" r="5.5"></circle><circle cx="8" cy="8" r="2.2"></circle><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15"></path>',
  switchArrows: '<path d="M4.5 2.5v9M2 4.5l2.5-2 2.5 2"></path><path d="M11.5 13.5v-9"></path><path d="M14 11.5l-2.5 2-2.5-2"></path>',
  select: '<path d="M4 2l8 6-3.6.8L6.6 12z"></path>',
  // AC-4 (first_run_and_panel_20260911): the power symbol, for the panel's "turn the tool off"
  // control. A circle broken at the top with a vertical bar through the gap — the universal
  // affordance for "stop this", and the only icon in the set whose meaning is "off the page"
  // rather than "change the sheet".
  power: '<path d="M8 2.2v5.4"></path><path d="M4.7 4.4a4.7 4.7 0 1 0 6.6 0"></path>',
};

const SOLID_FILL = new Set(["lock"]); // brass-solid lock uses fill currentColor

/**
 * Returns an inline SVG string for the named icon.
 * @param {string} name
 * @param {number} [size=16]
 */
function svg(name, size) {
  const paths = ICON_PATHS[name];
  if (!paths) return "";
  const fill = SOLID_FILL.has(name) ? "" : ' fill="none"';
  return (
    `<svg class="be-icon be-icon-${name}" width="${size}" height="${size}" viewBox="0 0 16 16"${fill}` +
    ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    paths +
    "</svg>"
  );
}

const Icons = { svg };
if (typeof module !== "undefined" && module.exports) {
  module.exports = Icons;
}
if (typeof window !== "undefined") {
  window.Icons = Icons;
}
