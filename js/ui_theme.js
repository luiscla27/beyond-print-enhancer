/**
 * UI theme: design-token layer for the extension chrome — "3.5 Codex on the
 * Workbench" identity (D&D 3.5 nostalgia look, dnd35_nostalgia_look_20260908,
 * ratified by the 3-round Muse Spark art-direction consultation in
 * docs/dnd35-nostalgia-20260908/).
 *
 * Replaces the 1.7.0 fantasy print-shop tokens (charcoal/parchment/brass)
 * with the locked leather-and-bone set: leather-black grounds, bone as text
 * only (never fill), antique gold as light (never flat fill outside the
 * Signet Print plaque), oxblood/ember retained for selected/destructive
 * semantics, blind-tooled seams, and the 2px antique-gold focus ring.
 *
 * Visual-only: it never changes behavior, DOM structure, ids or the class
 * contract tests rely on. Injects a single <style id="ddb-print-ui-theme">
 * carrying the token custom properties on :root plus component "skin" rules
 * for every chrome surface. Loaded by js/background.js after
 * js/print_styles.js and before js/main.js; mirrored in
 * test/unit/encapsulation_debt/debt_harness.js. Fail-open: the module only
 * appends a <style> when document.head exists.
 */

"use strict";

// Token palette + primitives (consult rounds 2-3; AA-guaranteed pairings —
// gold-shadow/taupe-faint are forbidden as text, icons/ticks only).
const TOKENS = {
  // Grounds — leather-black family (pure color, no grain; ratified 2026-09-08)
  groundPanel: "#191410", // left tray outer ground (replaces --panel)
  groundTray: "#221C16", // inner groups / rows (replaces --tray)
  groundWell: "#120D0A", // sockets, PROPERTIES empty state, picker card
  groundModal: "#1E1813", // modal shell
  // Seams / dividers
  seamDeep: "#0C0907", // outer edges + between tray groups (replaces --line)
  hairGold: "#4A3E2B", // 1px top-lights, row separators, slider rules
  hairBone: "#2E2820", // modal tab dividers, context-menu separators
  // Bone — text only, never fill
  bone: "#E9DDC2", // titles/body on leather (replaces --parchment)
  boneDim: "#CFC2A4", // secondary descriptions
  // Taupe — secondary tool text
  taupe: "#AB9F86", // tool labels, slider values (replaces --muted)
  taupeFaint: "#7E7460", // icons/ticks/reset only — never 11px text (replaces --dim)
  // Antique gold — light, not fill
  gold: "#C6A15B", // hairlines, icon strokes, focus, Print plaque (replaces --brass)
  goldHi: "#E9D6A4", // hover light + focus ring + Print highlight (replaces --brass-hover)
  goldShadow: "#6B5A36", // Print lower bevel/pressed — never 11px text
  goldInk: "#2A1F12", // dark-on-gold text (Print plaque / TEMPLATES tag)
  // Oxblood — accent only (selected/active wash + danger)
  oxblood: "#5E1F1E", // replaces #7A1F1E
  oxbloodDeep: "#3A1211", // pressed selected, danger row hover wash
  // Ember — error / destructive
  ember: "#D86A3D", // replaces #B3402E
  emberDim: "#8A4430", // error hairline, print-off icon
  // Row states
  rowHover: "#2A231B", // + 1px hair-gold top line
  rowSelected: "#2B1A17", // oxblood-tinted wash + 2px gold left bar
  // Range chrome (all sliders)
  rangeTrack: "#2E2820",
  rangeFill: "#6B5A36",
  thumb: "#E9DDC2",
  thumbRing: "#0C0907",
  thumbInner: "#4A3E2B",
  // Focus ring
  focusRing: "#E9D6A4",
  focusInk: "#0C0907",
  // Radii (mostly-square, 3-4px buttons per trap 3)
  radius: "10px",
  radiusInner: "6px",
  shadowPanel: "0 6px 24px rgba(0,0,0,0.55)",
  // Type families (display = engraved serif lineage; tool = clean sans)
  fontDisplay:
    'Cinzel, "Trajan Pro", "Cormorant Garamond", "Times New Roman", serif',
  fontTool: 'Inter, "Source Sans 3", system-ui, sans-serif',
};

// ---------------------------------------------------------------------------
// Ornament primitives (track ornament_symmetry_20260910)
//
// Contract amendment to the 1.8.0 "3.5 Codex on the Workbench" identity the
// owner asked for ("golden ornamental double borders … plus spiky golden
// corners"): a DOUBLE 1px HAIRLINE WITH A 6px BARE-LEATHER GAP plus 12px
// corner L-terminations — never a gold fill, never a rule >= 2px. The
// consultant's failure mode for the literal request was "it will read as World
// of Warcraft"; every value below is derived from the locked palette, so no new
// hex enters the system. Geometry is pinned in spec.md AC-1/AC-2 and each
// number is asserted by test/unit/ui_ornament.test.js.
// ---------------------------------------------------------------------------
const ORNAMENT = {
  gap: 6, // border box -> inner hairline (rule C): the leather gap
  arm: 12, // corner-L arm length
  stroke: TOKENS.gold, // #C6A15B — corner strokes ONLY, always 1px
  highlight: TOKENS.goldHi, // #E9D6A4 — the 1px inner foil line
  innerPanel: TOKENS.hairGold, // #4A3E2B — rule C on the two docked panels
  innerModal: TOKENS.goldShadow, // #6B5A36 — rule C on the modal shell
  diamond: 5, // primary-ornament diamond size (panels + modal)
};

const ORNAMENT_CORNERS = {
  all: ["tl", "tr", "bl", "br"], // modal shell
  top: ["tl", "tr"], // docked panels (no bottom pair on the workbench side)
};

// The three surface sets are DISJOINT (spec.md AC-3, muse_review_2.md step 2):
// only `full` receives the ornament layer. `quiet` keeps its pre-existing single
// blind-tooled rule; `plain` is content inside an ornamented container and gets
// nothing — ornamenting it is the "fractal framing" failure the consultation
// named. The disjointness is asserted by test/unit/ui_ornament.test.js.
const ORNAMENT_SURFACES = {
  full: [
    "#print-enhance-controls",
    "#print-enhance-layer-manager, .be-layer-panel",
    ".be-modal",
  ],
  quiet: [
    ".be-context-menu",
    ".be-color-picker-popup",
    'div[style*="z-index: 20000"]',
  ],
  plain: [
    ".be-feedback",
    ".be-section-actions",
    // The centred drag handle is in-sheet chrome, in the same rank as the
    // section action bar it sits beside (ISSUE_drag_and_drop.md). Declared here
    // so the ornament hierarchy names it rather than leaving it unclassified:
    // ornamenting a node that floats over the CONTENT would be the "fractal
    // framing" failure muse_review_2 step 2 named.
    ".be-drag-handle",
    ".be-more-options-button",
    ".be-layer-item-card",
    ".be-modal-tags",
    ".be-modal-tabs",
    ".be-picker-search",
  ],
};

/** Corner-L background layers for one corner-box: 4 gradient layers per corner
 *  with coordinates relative to that box's own corners. Backgrounds cannot
 *  capture pointer events, never enter layout, and are clipped by the host
 *  radius — which is why this beats 4 positioned nodes (and border-image /
 *  clip-path, both rejected by the consultation). */
function cornerLayers(corners) {
  const a = ORNAMENT.arm;
  const image = [];
  const position = [];
  const size = [];
  const push = (color, pos, w, h) => {
    image.push(`linear-gradient(${color}, ${color})`);
    position.push(pos);
    size.push(`${w}px ${h}px`);
  };
  for (const corner of corners) {
    const v = corner.charAt(0) === "t" ? "top" : "bottom";
    const h = corner.charAt(1) === "l" ? "left" : "right";
    // the gold L, drawn where rule C turns the corner
    push(ORNAMENT.stroke, `${h} 0 ${v} 0`, a, 1);
    push(ORNAMENT.stroke, `${h} 0 ${v} 0`, 1, a);
    // its 1px foil highlight, offset 1px inward on both axes
    push(ORNAMENT.highlight, `${h} 1px ${v} 1px`, a, 1);
    push(ORNAMENT.highlight, `${h} 1px ${v} 1px`, 1, a);
  }
  return { image, position, size };
}

/** Emit one ornamented surface. The rule stack, verified by a raw-pixel
 *  scanline probe (docs/ornament-symmetry-20260910/pixel-probe.json, produced
 *  by temp/ornament_pixel_probe.js) and measured from the BORDER BOX edge:
 *
 *    [-1, 0]px  rule A  1px #0C0907  the outer BLIND TOOL (a box-shadow ring)
 *    [ 0, 1]px  rule B  1px #4A3E2B  the stamped hairline (the CSS border)
 *    [ 1, 6]px  bare leather ground (5px of ground; rule C starts 6px in)
 *    [ 6, 7]px  rule C  1px inner     (a pseudo-element, inset 5px of the
 *                                      padding box, which starts at 1px)
 *
 *  The blind tool must be OUTERMOST, per the consultation ("outer blind tool …
 *  outermost, creates depth"); a ring lives outside the border box, so the
 *  border itself carries the hairline. `rings` carries the surface's
 *  pre-existing shadow entries (the 12px/13px workbench buffer) so the single
 *  !important box-shadow declaration does not drop them. The corner Ls go on a
 *  SECOND layer ABOVE rule C, sharing its inset box, so the gold L lands
 *  exactly on rule C's corner instead of being painted over by it. */
function ornamentSurface(selectors, rings, corners, inner, extra) {
  const l = cornerLayers(corners);
  const parts = selectors.split(",").map((s) => s.trim());
  const pseudo = (suffix) => parts.map((s) => s + suffix).join(",\n");
  return `${selectors} {
  border-color: ${TOKENS.hairGold} !important;
  box-shadow: 0 0 0 1px ${TOKENS.seamDeep}, ${rings} !important;
  ${extra || ""}
}
${pseudo("::before")} {
  content: "";
  position: absolute;
  inset: ${ORNAMENT.gap - 1}px;
  border: 1px solid ${inner};
  border-radius: ${TOKENS.radiusInner};
  pointer-events: none;
}
${pseudo("::after")} {
  content: "";
  position: absolute;
  inset: ${ORNAMENT.gap - 1}px;
  /* SQUARE, deliberately. A radius here clips the L's own corner into two
   * detached 6px stubs (proven by the raw-pixel probe: the 12px arms never
   * met). The L must cap rule C's rounded corner as a crisp tool mark — that
   * IS the "spiky golden corner" — so its box stays square while the host and
   * rule C keep the radius family. */
  border-radius: 0;
  pointer-events: none;
  background-image: ${l.image.join(",\n    ")};
  background-position: ${l.position.join(", ")};
  background-size: ${l.size.join(", ")};
  background-repeat: no-repeat;
}`;
}

// ---------------------------------------------------------------------------
// Height tiers (track ornament_symmetry_20260910, spec.md AC-4/AC-5)
//
// The owner's report ("buttons with different heights") was measured, not
// impression: NINE distinct rendered heights across one control family
// (20/22/24/26/27/30/32/34/36px plus a 39.6px row outlier). The fix is FIXED
// heights in four tiers (O-5 = tier parity, ratified: every control inside a
// tier is pixel-identical; forcing pills and icon-only controls to the text
// button height would destroy the tray density). `height`, never `min-height` —
// a min-height silently grows when a label wraps, which is exactly how the
// asymmetry appeared.
// ---------------------------------------------------------------------------
const TIERS = {
  action: 32, // T1 — text/action buttons
  icon: 28, // T2 — icon-only square controls
  chip: 22, // T3 — chips, tag pills
  input: 32, // T4 — text inputs and search fields (aligns with T1 rows)
  row: 40, // list rows (not buttons: a row has its own fixed height)
  // The compressed layer-panel header is a 32px row with 4px padding, so its
  // control takes the CHIP size (22px) instead of the 28px T2 square — the
  // larger control would overflow the compressed row (spec.md AC-3C).
  compactIcon: 22,
};

const THEME_CSS = `
:root {
  --be-ground-panel: ${TOKENS.groundPanel};
  --be-ground-tray: ${TOKENS.groundTray};
  --be-ground-well: ${TOKENS.groundWell};
  --be-ground-modal: ${TOKENS.groundModal};
  --be-seam-deep: ${TOKENS.seamDeep};
  --be-hair-gold: ${TOKENS.hairGold};
  --be-hair-bone: ${TOKENS.hairBone};
  --be-bone: ${TOKENS.bone};
  --be-bone-dim: ${TOKENS.boneDim};
  --be-taupe: ${TOKENS.taupe};
  --be-taupe-faint: ${TOKENS.taupeFaint};
  --be-gold: ${TOKENS.gold};
  --be-gold-hi: ${TOKENS.goldHi};
  --be-gold-shadow: ${TOKENS.goldShadow};
  --be-gold-ink: ${TOKENS.goldInk};
  --be-oxblood: ${TOKENS.oxblood};
  --be-oxblood-deep: ${TOKENS.oxbloodDeep};
  --be-ember: ${TOKENS.ember};
  --be-ember-dim: ${TOKENS.emberDim};
  --be-row-hover: ${TOKENS.rowHover};
  --be-row-selected: ${TOKENS.rowSelected};
  --be-radius: ${TOKENS.radius};
  --be-radius-inner: ${TOKENS.radiusInner};
  --be-shadow-panel: ${TOKENS.shadowPanel};
  --be-font-display: ${TOKENS.fontDisplay};
  --be-font-tool: ${TOKENS.fontTool};
  --be-font-caps: 11px;
}

/* ---------- global chrome focus ring (2px antique gold + dark ink) ---------- */
#print-enhance-controls button:focus-visible,
#print-enhance-layer-manager button:focus-visible,
.be-modal button:focus-visible,
.be-context-menu button:focus-visible,
.be-more-options-button:focus-visible {
  outline: 2px solid ${TOKENS.focusRing} !important;
  outline-offset: 2px;
  box-shadow: 0 0 0 1px ${TOKENS.focusInk} !important;
}

/* ---------- shared chrome surface language (leather grounds + seams) ---------- */
#print-enhance-controls {
  background: ${TOKENS.groundPanel} !important;
  border: 1px solid ${TOKENS.seamDeep} !important;
  border-radius: 12px !important;
  /* ISSUE_shadows.md: NO box-shadow at all — the shared block used to carry
     TOKENS.shadowPanel here for all three panels; the two that were not
     complained about keep it, this one does not. */
  font-family: ${TOKENS.fontTool};
  max-height: calc(100vh - 20px) !important;
  overflow-y: auto !important;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: ${TOKENS.goldShadow} transparent;
}
#print-enhance-layer-manager,
.be-layer-panel {
  background: ${TOKENS.groundPanel} !important;
  border: 1px solid ${TOKENS.seamDeep} !important;
  border-radius: 12px !important;
  box-shadow: ${TOKENS.shadowPanel} !important;
  font-family: ${TOKENS.fontTool};
  /* Same reachability rule as the control panel: the layer manager already
   * overflows at shorter viewports, and it is position:fixed too. Its floating
   * menus are appended to document.body (js/dom/layer_manager.js:1282) and the
   * drag ghost likewise (:561, :970), so scrolling the panel cannot clip them.
   * .be-layer-panel.minimized is more specific and keeps its own
   * overflow:hidden. */
  max-height: calc(100vh - 20px) !important;
  overflow-y: auto !important;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: ${TOKENS.goldShadow} transparent;
}
/* ---------- ISSUE_shadows.md: the control panel casts NO shadow ----------
 * The owner's words: "The shadows on #print-enhance-controls look bad, remove
 * them. they aren't necessary." FOUR declarations piled blurred black onto this
 * one element, which is why calming just one of them never worked: each is
 * !important and the LAST one in the sheet wins, so touching an earlier one
 * only lets a later one show through.
 *   1. an INLINE 0 4px 15px rgba(0,0,0,0.5) set in js/controls.js — deleted AT
 *      THE SOURCE, because an inline declaration outranks anything that is not
 *      also !important and was therefore invisible to every previous attempt;
 *   2. the shared chrome lift shadowPanel (0 6px 24px) directly
 *      above — the only surface that keeps it is the layer manager / layer
 *      panel, so the entry is now inert for this id (3 and 4 both name it later
 *      and outrank it);
 *   3. the same lift again inside the sheet-edge workbench buffer below;
 *   4. the same lift a third time inside the ornament ring stack emitted by
 *      ornamentSurface() — the one that actually painted.
 * shadowPanel is now ABSENT from every box-shadow list naming this panel
 * rather than being overridden with none: a final box-shadow: none would
 * have looked tidier but would also have deleted the panel's ornament frame,
 * which is the thing track ornament_symmetry_20260910 exists to pin.
 * WHAT SURVIVES is not shadow: a box-shadow with zero offset-blur is a frame.
 * The panel still gets 0 0 0 1px #0C0907 (rule A, the blind tool), the
 * 12px 0 0 / 13px 0 0 solid workbench buffer, rule B (its 1px hairGold border)
 * and rule C / the corner Ls. background, border, border-radius and the
 * hover transform are untouched. Net effect: the leather tray keeps its tooled
 * edge and stops floating a black smudge over the bone sheet. */
.be-layer-panel::-webkit-scrollbar,
.be-ctl-scroll::-webkit-scrollbar {
  width: 8px;
}
.be-layer-panel::-webkit-scrollbar-track,
.be-ctl-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.be-layer-panel::-webkit-scrollbar-thumb,
.be-ctl-scroll::-webkit-scrollbar-thumb {
  background: ${TOKENS.goldShadow};
  border-radius: 4px;
}
.be-layer-panel::-webkit-scrollbar-thumb:hover,
.be-ctl-scroll::-webkit-scrollbar-thumb:hover {
  background: ${TOKENS.gold};
}

/* ---------- sheet-edge workbench buffer (gate fix, round-3 spec) ----------
 * Never butt leather directly to bone: each floating tray carries a 12px
 * ground-well strip + 1px gold hairline on its sheet-facing side, so the
 * visible order is leather > dark well > hairline > bone sheet. The sheets
 * sit exactly at the tray edges (measured: sheet bone starts at the panel
 * right edge and ends at the layer-manager left edge).
 *
 * ISSUE_shadows.md (2026-09-14) — the control panel's entry lost its
 * shadowPanel lift and now carries ONLY the buffer. FOUR blurred
 * declarations used to pile up on #print-enhance-controls, each !important,
 * so the last one in the sheet won and calming any single earlier one changed
 * nothing:
 *   1. an INLINE 0 4px 15px rgba(0,0,0,0.5) in js/controls.js — deleted AT THE
 *      SOURCE, an inline declaration outranks anything not also !important and
 *      was therefore invisible to every previous attempt;
 *   2. the shared chrome lift in the surface block above (removed here too);
 *   3. this buffer rule;
 *   4. the ornament ring stack emitted by ornamentSurface() — the one that
 *      actually painted.
 * shadowPanel is now absent from every list naming this panel rather than
 * overridden with box-shadow: none: a final none would have looked tidier
 * and would also have deleted the panel's ornament frame, which is exactly what
 * track ornament_symmetry_20260910 exists to pin. What survives here is NOT a
 * shadow — a box-shadow with zero offset-blur is a frame: rule A (the 1px
 * #0C0907 blind tool), rules B and C (the hairlines) and the corner Ls all
 * stand, background / border / border-radius / the hover transform are
 * untouched. Net effect: the leather tray keeps its tooled edge and stops
 * floating a black smudge over the bone sheet. The layer manager keeps its
 * lift — it was not part of the complaint, and the two trays must not be
 * silently re-tiered by a fix aimed at one of them. */
#print-enhance-controls {
  box-shadow: 12px 0 0 ${TOKENS.groundWell}, 13px 0 0 ${TOKENS.hairGold} !important;
}
#print-enhance-layer-manager {
  box-shadow: ${TOKENS.shadowPanel}, -12px 0 0 ${TOKENS.groundWell}, -13px 0 0 ${TOKENS.hairGold} !important;
}

/* ---------- control panel surface (tome-spine tray IA) ---------- */
#print-enhance-controls {
  padding: 10px !important;
  gap: 6px !important;
  width: 248px;
  /* The panel's content is taller than a laptop viewport (measured 1156px in a
   * 900px window) and the panel is position:fixed, so the page cannot scroll to
   * what falls below the fold. Cap it and scroll the body instead. */
  max-height: calc(100vh - 20px) !important;
  overflow: hidden !important;
}
/* The scrollport under the pinned topbar. min-height:0 is required: a flex item
 * defaults to min-height:auto, which would refuse to shrink and defeat the
 * scrollbar. */
.be-ctl-scroll {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  /* leather-toned scrollbar (a default light one fights the identity) —
   * shared with the layer panel; the rules live with the panel surfaces */
  scrollbar-width: thin;
  scrollbar-color: ${TOKENS.goldShadow} transparent;
}
.be-ctl-topbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 6px 16px;
  margin-bottom: 8px;
  position: relative;
}
/* One row of the topbar. space-between + the title's flexible basis below
 * is what keeps every header on a single line. */
.be-ctl-topbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
/* Blind-tooled rule + center diamond — the ONE ornament per panel (round 3) */
.be-ctl-topbar::after {
  content: "";
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: 5px;
  height: 3px;
  pointer-events: none;
  background:
    linear-gradient(${TOKENS.seamDeep}, ${TOKENS.seamDeep}) 0 0 / 100% 1px no-repeat,
    linear-gradient(${TOKENS.hairGold}, ${TOKENS.hairGold}) 0 100% / 100% 1px no-repeat;
}
.be-ctl-topbar::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 4px;
  width: 5px;
  height: 5px;
  transform: translateX(-50%) rotate(45deg);
  background: ${TOKENS.goldShadow};
  border: 1px solid ${TOKENS.gold};
  pointer-events: none;
}
.be-ctl-title {
  color: ${TOKENS.bone};
  font-family: ${TOKENS.fontDisplay};
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  text-shadow: 0 1px 0 ${TOKENS.seamDeep};
  /* its own full-width line inside the topbar's first row: the title is the
   * longest header in the chrome and must never wrap (measured: it needs
   * ~141px and was being given 80px before, so it broke onto two lines) */
  flex: 1 1 auto;
  min-width: 0;
  padding: 2px 0 4px;
}
#be-ctl-collapse {
  background: transparent !important;
  border: none !important;
  color: ${TOKENS.taupeFaint} !important;
  width: ${TIERS.icon}px; /* T2 (AC-4) */
  height: ${TIERS.icon}px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
}
#be-ctl-collapse:hover {
  background: ${TOKENS.rowHover} !important;
  color: ${TOKENS.bone} !important;
}
/* AC-2 (ux_gaps_20260911): the help control. Same T2 recipe as the collapse control beside it,
   so the header reads as one group rather than a bolted-on affordance; the "?" is text rather
   than an icon because the question mark IS the signifier — an info glyph here would be a
   weaker recognition target at 12px.

   AC-4 (first_run_and_panel_20260911): the turn-off control joins this recipe rather than getting
   its own. Same tier, same header row, same "the panel's own control" role — and an ID selector
   does not match a class, which is exactly how the first cut rendered at 30px: it carried the
   help control's CLASS while the rule was written as an ID. Measured in the browser suite
   (30 !== 28), which is the kind of thing a pixel test catches and a source read does not. */
#be-ctl-help,
#be-ctl-off {
  background: transparent !important;
  border: none !important;
  color: ${TOKENS.taupeFaint} !important;
  width: ${TIERS.icon}px;
  height: ${TIERS.icon}px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  font-family: ${TOKENS.fontTool};
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}
#be-ctl-help:hover,
#be-ctl-off:hover {
  background: ${TOKENS.rowHover} !important;
  color: ${TOKENS.goldHi || TOKENS.gold} !important;
}
#be-ctl-help:focus-visible,
#be-ctl-off:focus-visible {
  outline: 2px solid ${TOKENS.focusRing} !important;
  outline-offset: 2px;
}
/* The help surface's own content (AC-2). A definition list, because that is what the content
   is: a gesture and how to perform it. */
.be-help-lead,
.be-help-note {
  color: ${TOKENS.boneDim} !important;
  font-family: ${TOKENS.fontTool};
  font-size: 12px;
  line-height: 1.45;
  margin: 0 0 10px 0;
}
.be-help-note {
  margin: 10px 0 0 0;
  padding-top: 8px;
  border-top: 1px solid ${TOKENS.seamDeep} !important;
}
.be-help-list {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 14px;
  margin: 0;
}
.be-help-what {
  color: ${TOKENS.bone} !important;
  font-family: ${TOKENS.fontTool};
  font-size: 12px;
}
.be-help-how {
  color: ${TOKENS.boneDim} !important;
  font-family: ${TOKENS.fontTool};
  font-size: 12px;
  margin: 0;
}
.be-ctl-templates {
  margin-left: auto;
  background: transparent !important;
  border: 1px solid ${TOKENS.gold} !important;
  color: ${TOKENS.bone} !important;
  border-radius: 999px;
  font-family: ${TOKENS.fontDisplay};
  font-size: 10px !important;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  height: ${TIERS.chip}px; /* T3 (AC-4) */
  padding: 0 12px !important;
  display: inline-flex;
  align-items: center;
  line-height: 1;
  cursor: pointer;
}
.be-ctl-templates:hover {
  border-color: ${TOKENS.goldHi} !important;
  color: ${TOKENS.goldHi} !important;
}
.be-ctl-templates:focus-visible {
  outline: 2px solid ${TOKENS.gold} !important;
  outline-offset: 2px;
}
.be-ctl-tray,
.be-ctl-band {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.be-ctl-tray-head {
  color: ${TOKENS.boneDim} !important;
  font-family: ${TOKENS.fontDisplay};
  font-size: 14px !important;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  padding: 12px 4px 8px;
  margin: 4px 0 6px;
  display: flex;
  align-items: center;
  gap: 7px;
  text-shadow: 0 1px 0 ${TOKENS.seamDeep};
  border-bottom: 1px solid ${TOKENS.seamDeep};
  box-shadow: 0 1px 0 ${TOKENS.hairBone};
}
/* AC-5 (first_run_and_panel_20260911): the fold control.
 *
 * The header is now a real BUTTON, because a disclosure control has to be keyboard-reachable and
 * carry aria-expanded — and because the only other option (a click handler on a div) is the
 * pattern whose keyboard failure this phase is explicitly forbidden from shipping. A button brings
 * browser defaults, so they are reset here while the MEASURED recipe above is preserved exactly:
 * "padding: 12px 4px 8px" and "margin: 4px 0 6px" are pinned by the pre-existing ui_headers
 * contract, which asserts one type recipe across every chrome header. width:100% and
 * text-align:left keep it spanning the tray as the label div did, and the transparent, borderless
 * treatment keeps the ornament rules (gold hairline + nail dot) unchanged.
 *
 * (NOTE, for whoever edits this file next: the CSS above lives inside a JS TEMPLATE LITERAL, so a
 * backtick anywhere in these comments TERMINATES THE STRING and the module fails to parse. It has
 * cost this track four full suite runs. Plain text only, in this file.) */
.be-ctl-fold {
  background: transparent !important;
  border: none !important;
  border-bottom: 1px solid ${TOKENS.seamDeep} !important;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.be-ctl-fold:hover {
  color: ${TOKENS.bone} !important;
}
.be-ctl-fold:focus-visible {
  outline: 2px solid ${TOKENS.focusRing} !important;
  outline-offset: 2px;
}
/* The label takes the free space so the caret sits hard right, whatever the label's length. */
.be-ctl-fold-label {
  flex: 1 1 auto;
}
/* The caret is CSS-drawn rather than a shipped icon: it has to ROTATE to state the fold, and the
 * 16px icon set has no orientation variant. Unchanged at rest, pointing down when folded. */
.be-ctl-fold-caret {
  flex: 0 0 auto;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid ${TOKENS.taupeFaint};
  transition: transform 120ms ease;
}
.be-ctl-fold[aria-expanded="false"] .be-ctl-fold-caret {
  transform: rotate(-90deg);
}
/* A folded group hides its CONTENT and nothing else. display:none on the non-header children is
 * deliberate and is the mechanism AC-5's reachability clause depends on: the nodes stay in the DOM,
 * so re-expanding restores the SAME elements rather than rebuilt copies — and the suite proves it by
 * holding a reference across a fold/unfold cycle. Removing them (the naive way to "save space") is
 * an explicit AC-5 fail condition. */
.be-ctl-folded > :not(.be-ctl-tray-head) {
  display: none !important;
}
/* group-head nail dot (round 3) — gold-shadow square, no other row ornament */
.be-ctl-tray-head::before {
  content: "";
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  background: ${TOKENS.goldShadow};
  border: 1px solid ${TOKENS.hairGold};
}
.be-ctl-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  background: ${TOKENS.groundTray} !important;
  border: 1px solid ${TOKENS.seamDeep} !important;
  color: ${TOKENS.bone} !important;
  border-radius: ${TOKENS.radiusInner} !important;
  font-family: ${TOKENS.fontTool};
  font-size: 13px !important;
  height: ${TIERS.action}px !important; /* T1 (AC-4) — fixed, never min-height */
  flex: 0 0 auto; /* the tier height is not negotiable (see the T4 note) */
  padding: 0 14px !important;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}
.be-ctl-btn:hover {
  border-color: ${TOKENS.goldShadow} !important;
  background: ${TOKENS.rowHover} !important;
}
.be-ctl-btn:active {
  background: rgba(91,77,40,0.18) !important;
}
.be-ctl-ico {
  display: inline-flex;
  flex: 0 0 auto;
  color: ${TOKENS.taupe};
}
.be-ctl-btn:hover .be-ctl-ico {
  color: ${TOKENS.goldHi};
}
/* AC-5: a long label can never change a tiered control's height. The label
 * lives in its own span (a flex item needs min-width:0 before it can shrink),
 * clips with an ellipsis, and the button carries the full text in its title. */
.be-ctl-btn .be-ctl-label,
.be-modal-actions button span,
.be-modal-tags button span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.be-ctl-hero-wrap {
  background: ${TOKENS.groundWell};
  border: 1px solid ${TOKENS.seamDeep};
  border-radius: 9px;
  padding: 4px;
  margin: 2px 0 1px;
}
.be-ctl-btn.be-ctl-hero {
  justify-content: center;
  background: ${TOKENS.gold} !important;
  border: 1px solid ${TOKENS.goldShadow} !important;
  box-shadow: inset 0 1px 0 ${TOKENS.goldHi}, inset 0 -1px 0 ${TOKENS.goldShadow};
  color: ${TOKENS.goldInk} !important;
  /* O-5: the hero is pulled from 36px to the common T1 height and
   * differentiated by being the ONLY gold fill + weight 700 + wider padding.
   * Height is never the differentiator. */
  height: ${TIERS.action}px !important;
  padding: 0 18px !important;
  font-family: ${TOKENS.fontDisplay};
  font-size: 13px !important;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-shadow: 0 1px 0 rgba(233,214,164,0.65);
  border-radius: 6px !important;
}
.be-ctl-btn.be-ctl-hero .be-ctl-ico {
  color: ${TOKENS.goldInk};
}
.be-ctl-btn.be-ctl-hero:hover {
  background: ${TOKENS.goldHi} !important;
  border-color: ${TOKENS.gold} !important;
}
.be-ctl-btn.be-ctl-hero:active {
  background: ${TOKENS.goldShadow} !important;
}
/* Add Shape = create action: ghost pill (transparent, 1px gold stroke, bone) —
 * visually distinct from the filled dark LAYOUT rows, matches TEMPLATES. */
#be-btn-add-shape {
  background: transparent !important;
  border: 1px solid ${TOKENS.gold} !important;
  color: ${TOKENS.bone} !important;
}
#be-btn-add-shape .be-ctl-ico {
  color: ${TOKENS.gold} !important;
}
#be-btn-add-shape:hover {
  border-color: ${TOKENS.goldHi} !important;
  background: rgba(91,77,40,0.08) !important;
}
#be-btn-add-shape:hover .be-ctl-ico {
  color: ${TOKENS.goldHi} !important;
}
#be-btn-add-shape:focus-visible {
  outline: 2px solid ${TOKENS.gold} !important;
  outline-offset: 2px;
}
/* AC-3 (first_run_and_panel_20260911): the .be-ctl-contribute rules were REMOVED with the row they
 * styled. The class no longer exists in js/controls.js, and an orphaned rule is the same class of
 * stale artifact as a dead export — it reads as a live surface to the next person who greps for it.
 * Its .be-ctl-collapsed .be-ctl-tray sibling immediately above is what the panel's minimise control
 * hides, which is why the tray CSS stays. */
.be-ctl-collapsed .be-ctl-tray,
.be-ctl-collapsed .be-ctl-band {
  display: none !important;
}
.be-ctl-band {
  border-top: 1px solid ${TOKENS.seamDeep};
  padding-top: 4px;
  margin-top: 2px;
}

/* ---------- properties panel ---------- */
#print-enhance-properties-panel {
  background: ${TOKENS.groundPanel} !important;
  border-top: 1px solid ${TOKENS.seamDeep} !important;
  border-radius: 8px !important;
}
#print-enhance-properties-panel label,
#print-enhance-properties-panel div {
  color: ${TOKENS.bone};
  font-family: ${TOKENS.fontTool};
}
#print-enhance-properties-panel h4 {
  color: ${TOKENS.bone} !important;
  font-family: ${TOKENS.fontDisplay};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-left: 3px solid ${TOKENS.oxblood};
  padding-left: 8px;
  line-height: 1.3;
}
.be-prop-control {
  background: rgba(233,221,194,0.02);
  border: 1px solid transparent;
  border-radius: ${TOKENS.radiusInner};
  padding: 4px 6px;
}
.be-prop-control:hover {
  border-color: ${TOKENS.hairBone};
}
.be-prop-control button,
.be-prop-panel-empty + * button {
  color: ${TOKENS.bone} !important;
}
#be-font-size-value,
.be-prop-control span {
  font-variant-numeric: tabular-nums;
}
.be-prop-panel-empty {
  border: 1px dashed ${TOKENS.hairBone};
  border-radius: ${TOKENS.radiusInner};
  color: ${TOKENS.bone} !important;
  font-style: normal !important;
  padding: 12px 10px;
  font-size: 12px;
  line-height: 1.5;
  background: ${TOKENS.groundWell};
}

/* ---------- filters + sliders (unified bone/gold recipe) ---------- */
.be-filters-container {
  border-top: 1px solid ${TOKENS.seamDeep} !important;
}
.be-filters-container > div {
  margin-bottom: 10px !important;
}
.be-filters-container label {
  color: ${TOKENS.taupe} !important;
  font-family: ${TOKENS.fontTool};
  font-weight: 500 !important;
  font-size: 12px !important;
  letter-spacing: 0.01em;
}
.be-filters-container label span {
  font-variant-numeric: tabular-nums;
}
.be-filters-container button {
  color: ${TOKENS.taupeFaint} !important;
  background: none !important;
  border: none !important;
  font-size: 13px !important;
  min-width: 24px;
  min-height: 24px;
  border-radius: ${TOKENS.radiusInner};
}
.be-filters-container button:hover {
  color: ${TOKENS.goldHi} !important;
  background: rgba(91,77,40,0.12) !important;
}
/* custom range slider skin — 3px leather track, bone ringed thumb (unified) */
.be-filters-container input[type="range"],
.be-modal-slider,
#print-enhance-layer-manager input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  height: 3px !important;
  border-radius: 2px;
  background: ${TOKENS.rangeTrack} !important;
  outline: none;
}
.be-filters-container input[type="range"]::-webkit-slider-thumb,
.be-modal-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: ${TOKENS.thumb};
  border: 1px solid ${TOKENS.thumbRing};
  box-shadow: 0 0 0 1px ${TOKENS.thumbInner};
  cursor: pointer;
}
.be-filters-container input[type="range"]::-moz-range-thumb,
.be-modal-slider::-moz-range-thumb {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: ${TOKENS.thumb};
  border: 1px solid ${TOKENS.thumbRing};
  cursor: pointer;
}
.be-filters-container input[type="range"]::-moz-range-track,
.be-modal-slider::-moz-range-track {
  background: ${TOKENS.rangeTrack};
  height: 3px; border-radius: 2px;
}
.be-filters-container input[type="range"]:focus-visible::-webkit-slider-thumb {
  border: 1px solid ${TOKENS.gold};
}

/* ---------- color picker popup ---------- */
div[style*="z-index: 20000"],
.be-color-picker-popup {
  background: ${TOKENS.groundWell} !important;
  border: 1px solid ${TOKENS.hairGold} !important;
  border-radius: ${TOKENS.radius} !important;
  box-shadow: ${TOKENS.shadowPanel} !important;
}
div[style*="z-index: 20000"] label {
  color: ${TOKENS.taupe} !important;
  font-family: ${TOKENS.fontTool};
  font-size: 10px !important;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* ---------- layer manager ---------- */
#print-enhance-layer-manager,
.be-layer-panel {
  color: ${TOKENS.bone};
}
.be-layer-panel-header {
  color: ${TOKENS.bone};
  font-family: ${TOKENS.fontDisplay};
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-shadow: 0 1px 0 ${TOKENS.seamDeep};
  position: relative;
  /* !important: js/print_styles.js re-injects its sheet on layout changes and
   * can land later in the document than this one, so these metrics cannot rely
   * on source order (measured: the 4px/8px values from that file were winning). */
  padding: 2px 4px 12px !important;
  margin: 0 0 6px !important;
}
.be-layer-panel-header button {
  color: ${TOKENS.taupeFaint} !important;
  background: transparent !important;
  width: ${TIERS.icon}px; /* T2 (AC-4) */
  height: ${TIERS.icon}px;
  padding: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
/* AC-3C: the compressed panel header is a 32px row, so its control uses the
 * compact size instead of overflowing into the header's own padding. */
.be-layer-panel.minimized .be-layer-panel-header button {
  width: ${TIERS.compactIcon}px;
  height: ${TIERS.compactIcon}px;
}
.be-layer-panel-header button:hover {
  color: ${TOKENS.goldHi} !important;
}
.be-layer-panel-header::after {
  content: "";
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: 4px;
  height: 3px;
  pointer-events: none;
  background:
    linear-gradient(${TOKENS.seamDeep}, ${TOKENS.seamDeep}) 0 0 / 100% 1px no-repeat,
    linear-gradient(${TOKENS.hairGold}, ${TOKENS.hairGold}) 0 100% / 100% 1px no-repeat;
}
.be-layer-panel-header::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 3px;
  width: 5px;
  height: 5px;
  transform: translateX(-50%) rotate(45deg);
  background: ${TOKENS.goldShadow};
  border: 1px solid ${TOKENS.gold};
  pointer-events: none;
}
.be-layer-section-header {
  color: ${TOKENS.boneDim} !important;
  font-family: ${TOKENS.fontDisplay};
  font-size: 14px !important;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  font-weight: 700;
  text-shadow: 0 1px 0 ${TOKENS.seamDeep};
}
.be-layer-section-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 7px;
  padding: 12px 4px 8px;
  margin: 4px 0 6px;
  border-bottom: 1px solid ${TOKENS.seamDeep};
  box-shadow: 0 1px 0 ${TOKENS.hairBone};
}
.be-layer-section-header[data-group="sections"] {
  margin-top: 0;
}
.be-layer-section-header::before {
  content: "";
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  background: ${TOKENS.goldShadow};
  border: 1px solid ${TOKENS.hairGold};
}
.be-layer-row {
  background: ${TOKENS.groundTray} !important;
  border: 1px solid transparent !important;
  border-radius: ${TOKENS.radiusInner} !important;
  color: ${TOKENS.bone} !important;
  /* AC-5: rows are list items, not buttons — one FIXED row height kills the
   * measured 32px vs 39.6px pair, which was a min-height + label-wrap bug. */
  height: ${TIERS.row}px !important;
  padding: 0 6px 0 9px !important;
  gap: 4px;
  margin-bottom: 3px;
}
.be-layer-row > span:first-child {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.be-layer-row-hidden {
  opacity: 0.4;
}
.be-layer-row-hidden > span:first-child {
  color: ${TOKENS.taupe} !important;
  font-style: italic;
}
.be-layer-row:hover {
  border-color: ${TOKENS.hairGold} !important;
  background: ${TOKENS.rowHover} !important;
}
/* TWO layer-row signals, one writer each (selection_model_ia_20260910, AC-1).
 *
 * be-selection-layer — the layer that HOLDS THE SELECTED ELEMENT. This is the
 * layer panel's rendering of the one selection store, so it is present only while
 * something is selected (clearing removes it everywhere). The strong treatment
 * (rowSelected wash + gold left bar) belongs to it, because a selection is the
 * thing the user must be able to locate.
 *
 * be-active-layer — the INSERTION TARGET: the layer the next shape lands in
 * (moved by unlocking a layer or adding one). A different question with a
 * different lifetime, so it gets its own class and a deliberately QUIETER marker:
 * a dim hairline, no gold bar, no wash. Keeping one class for both meanings was
 * measured to make "a section is selected" and "nothing is selected" pixel-equal
 * on the layer panel (0 differing pixels) — see the phase-1 consultation.
 *
 * When both coincide (the common case: the selection lives in the insertion
 * target) the selection's treatment wins visually, which is correct. */
/* The insertion target FIRST and the selection SECOND: both rules set the same
 * property, so document order decides which wins when a row carries both — and
 * the selection must win (it is the state the user is acting on). */
.be-layer-row.be-active-layer {
  border-left: 2px solid ${TOKENS.hairGold} !important;
  padding-left: 7px !important;
}
.be-layer-row.be-selection-layer {
  background: ${TOKENS.rowSelected} !important;
  border-left: 2px solid ${TOKENS.gold} !important;
  padding-left: 7px !important;
}
.be-layer-row.be-layer-locked {
  opacity: 0.9;
}
.be-layer-controls button {
  background: transparent !important;
  border: none !important;
  border-radius: 4px;
  color: ${TOKENS.taupe} !important;
  width: ${TIERS.icon}px; /* T2 (AC-4) */
  height: ${TIERS.icon}px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}
.be-layer-controls button:hover {
  background: ${TOKENS.rowHover} !important;
  color: ${TOKENS.goldHi} !important;
}
.be-layer-controls .be-delete-layer-btn:hover {
  background: ${TOKENS.oxbloodDeep} !important;
  color: ${TOKENS.ember} !important;
}
.be-layer-controls button[data-state="locked"] {
  color: ${TOKENS.taupeFaint} !important;
}
.be-layer-controls button[data-state="off"],
.be-layer-controls button[data-state="hidden"] {
  color: ${TOKENS.emberDim} !important;
}
.be-add-layer-btn {
  background: transparent !important;
  border: 1px dashed ${TOKENS.gold} !important;
  border-radius: ${TOKENS.radiusInner} !important;
  color: ${TOKENS.bone} !important;
  font-family: ${TOKENS.fontTool};
}
.be-add-layer-btn:hover {
  color: ${TOKENS.goldHi} !important;
  border-color: ${TOKENS.goldHi} !important;
}
.be-add-layer-btn:focus-visible {
  outline: 2px solid ${TOKENS.gold} !important;
  outline-offset: 2px;
}
.be-add-layer-btn {
  width: 100% !important;
  margin-top: 6px;
  height: ${TIERS.action}px; /* T1 (AC-4) */
  flex: 0 0 auto; /* a tier height is not negotiable: no flex shrink */
  padding: 0 10px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px !important;
}
.be-layer-content-list {
  background: rgba(233,221,194,0.02) !important;
  border-radius: ${TOKENS.radiusInner} !important;
  border: 1px solid ${TOKENS.seamDeep};
}
.be-shape-layer-container .be-layer-item-card,
.be-layer-item-card {
  background: ${TOKENS.groundTray} !important;
  border: 1px solid ${TOKENS.seamDeep} !important;
  border-radius: ${TOKENS.radiusInner} !important;
}
.be-layer-item-card.be-selected {
  border-color: ${TOKENS.gold} !important;
  box-shadow: 0 0 0 1px ${TOKENS.gold} inset;
  background: ${TOKENS.rowSelected} !important;
}

/* ---------- context menu + section action bars ---------- */
.be-context-menu {
  background: ${TOKENS.groundTray} !important;
  border: 1px solid ${TOKENS.seamDeep} !important;
  box-shadow: 0 0 0 1px ${TOKENS.hairGold}, ${TOKENS.shadowPanel} !important;
  border-radius: ${TOKENS.radiusInner} !important;
  color: ${TOKENS.bone};
  overflow: hidden;
}
.be-context-menu-item {
  background: transparent !important;
  border: none !important;
  color: ${TOKENS.bone} !important;
  font-family: ${TOKENS.fontTool};
  font-size: 13px !important;
  min-height: 28px;
  text-align: left;
  border-radius: 4px;
}
.be-context-menu-item:hover {
  background: ${TOKENS.rowHover} !important;
  color: ${TOKENS.bone} !important;
}
.be-context-menu-item.be-danger-item,
.be-context-menu-item[data-danger="true"] {
  color: ${TOKENS.ember} !important;
  border-top: 1px solid ${TOKENS.hairBone};
  margin-top: 2px;
  border-radius: 0;
}
.be-context-menu-item.be-danger-item:hover,
.be-context-menu-item[data-danger="true"]:hover {
  background: ${TOKENS.oxbloodDeep} !important;
  color: ${TOKENS.ember} !important;
}
.be-section-actions button[data-danger="true"]:hover,
.be-more-options-button[data-danger="true"]:hover {
  border-color: ${TOKENS.ember} !important;
  color: ${TOKENS.ember} !important;
}
.be-more-options-button,
.be-section-actions button {
  background: ${TOKENS.groundTray} !important;
  border: 1px solid ${TOKENS.seamDeep} !important;
  border-radius: ${TOKENS.radiusInner} !important;
  color: ${TOKENS.bone} !important;
  font-size: 13px;
  height: ${TIERS.action}px !important; /* T1 (AC-4) */
  padding: 0 6px !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.be-more-options-button:hover,
.be-section-actions button:hover {
  border-color: ${TOKENS.goldShadow} !important;
  color: ${TOKENS.goldHi} !important;
}

/* ---------- modals ---------- */
.be-modal-overlay {
  background: rgba(10,7,4,0.55) !important;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
.be-modal {
  background: ${TOKENS.groundModal} !important;
  border: 1px solid ${TOKENS.seamDeep} !important;
  box-shadow: 0 0 0 1px ${TOKENS.hairGold}, ${TOKENS.shadowPanel} !important;
  border-radius: 12px !important;
  color: ${TOKENS.bone};
  font-family: ${TOKENS.fontTool};
}
.be-modal {
  max-width: 640px;
  width: 92%;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.be-modal h3 {
  color: ${TOKENS.bone};
  font-family: ${TOKENS.fontDisplay};
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 2px 0 4px;
  text-shadow: 0 1px 0 ${TOKENS.seamDeep};
}
.be-modal p {
  color: ${TOKENS.taupe};
  font-size: 13px;
  margin: 0 0 10px;
}
.be-modal input[type="text"],
.be-modal input[type="number"],
.be-modal input[type="search"],
.be-modal textarea,
.be-picker-search {
  /* !important on the paint properties, for the same reason the rest of this
   * sheet uses it: the host page ships a CROSS-ORIGIN stylesheet we cannot read
   * (reading its cssRules throws SecurityError), and one of its rules was
   * winning the background of the migrated dialogs' text field — the input
   * rendered as the browser-default near-white rgb(249,250,250) on the dark
   * leather ground. Found by disabling sheets one at a time and watching the
   * computed background, since a cascade scan literally cannot see a
   * cross-origin sheet. */
  background: ${TOKENS.groundTray} !important;
  border: 1px solid ${TOKENS.hairBone} !important;
  color: ${TOKENS.bone} !important;
  border-radius: ${TOKENS.radiusInner};
  height: ${TIERS.input}px; /* T4 (AC-4) — aligns with the T1 row it sits in */
  /* A tier height is NOT negotiable: the picker modal is a column flex
   * container capped at 86vh, so without this the declared 32px was shrunk to
   * the input's 17px content height once the asset grid overflowed (measured
   * live, 2026-09-10 — a real defect the tier probe caught). */
  flex: 0 0 auto;
  padding: 0 9px;
  font-size: 13px;
  box-sizing: border-box;
}
/* The modal's inline message area. It carries BOTH the dialog's description and
 * validation errors, so the error state must be visually unmistakable — the
 * phase-1 visual gate rejected an earlier version where the rejected-submit
 * message was styled identically to ordinary help text, which is a fair finding:
 * a validation message that looks like the description does not tell the user
 * anything went wrong. */
.be-modal-message {
  color: ${TOKENS.taupe};
  font-size: 13px;
  margin: 0 0 10px;
}
.be-modal-message-error {
  color: ${TOKENS.ember} !important;
  font-weight: 600;
  border-left: 3px solid ${TOKENS.ember};
  padding-left: 8px;
}
/* An invalid field is marked both for assistive tech (aria-invalid) and to the
 * eye — the same signal, not two. */
.be-modal input[aria-invalid="true"],
.be-modal textarea[aria-invalid="true"] {
  border-color: ${TOKENS.ember} !important;
  box-shadow: 0 0 0 1px ${TOKENS.ember};
}
.be-modal textarea {
  height: auto !important;
  min-height: 200px;
  padding: 10px !important;
  font-family: monospace;
  resize: vertical;
}
.be-modal input:focus {
  outline: 2px solid ${TOKENS.focusRing};
  outline-offset: 2px;
  box-shadow: 0 0 0 1px ${TOKENS.focusInk};
}
.be-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
}
.be-modal-actions button,
.be-modal-cancel,
.be-modal-ok,
.be-modal-button {
  border-radius: ${TOKENS.radiusInner} !important;
  font-family: ${TOKENS.fontTool};
  font-size: 13px !important;
  height: ${TIERS.action}px !important; /* T1 (AC-4) */
  flex: 0 0 auto; /* the tier height is not negotiable (see the T4 note) */
  padding: 0 14px !important;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.be-modal-cancel {
  background: transparent !important;
  border: 1px solid ${TOKENS.taupe} !important;
  color: ${TOKENS.taupe} !important;
}
.be-modal-cancel:hover {
  border-color: ${TOKENS.bone} !important;
  color: ${TOKENS.bone} !important;
  background: rgba(233,221,194,0.04) !important;
}
.be-modal-ok,
.be-modal-actions .be-modal-ok {
  background: ${TOKENS.gold} !important;
  border: 1px solid ${TOKENS.goldShadow} !important;
  box-shadow: inset 0 1px 0 ${TOKENS.goldHi};
  color: ${TOKENS.goldInk} !important;
  font-weight: 600;
}
.be-modal-ok:hover {
  background: ${TOKENS.goldHi} !important;
  border-color: ${TOKENS.gold} !important;
}
.be-modal-tabs button {
  background: transparent !important;
  border: none !important;
  color: ${TOKENS.taupe} !important;
  border-bottom: 2px solid transparent !important;
  font-family: ${TOKENS.fontTool};
  font-size: 11px !important;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  /* Tabs are NOT buttons (consultation Q5): they keep the T1 height so the
   * strip aligns with the row, but the active state is a bottom-border
   * indicator, not a contained button. */
  height: ${TIERS.action}px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
}
.be-modal-tabs button:hover {
  color: ${TOKENS.bone} !important;
}
.be-modal-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid ${TOKENS.hairBone};
  padding: 0 4px;
}
.be-modal-tabs button.be-active,
.be-modal-tabs button.active {
  color: ${TOKENS.gold} !important;
  border-bottom-color: ${TOKENS.gold} !important;
  font-weight: 700;
}
.be-modal-tags button,
.be-border-option button,
.be-border-options button {
  background: ${TOKENS.groundWell} !important;
  border: 1px solid ${TOKENS.hairBone} !important;
  border-radius: 999px !important;
  color: ${TOKENS.taupe} !important;
  font-size: 12px !important;
  height: ${TIERS.chip}px; /* T3 (AC-4) */
  padding: 0 10px !important;
  display: inline-flex;
  align-items: center;
  line-height: 1;
}
.be-modal-tags button:hover,
.be-border-option button:hover {
  border-color: ${TOKENS.gold} !important;
  color: ${TOKENS.bone} !important;
}
.be-border-option {
  background: ${TOKENS.groundWell} !important;
  border: 1px solid ${TOKENS.hairBone} !important;
  border-radius: 8px !important;
}
.be-border-option.be-selected,
.be-border-option.selected {
  border-color: ${TOKENS.gold} !important;
  box-shadow: 0 0 0 1px ${TOKENS.gold} inset;
  background: ${TOKENS.rowSelected} !important;
}

/* Reset All Filters lives inside the control panel (not a modal): it must not
 * reuse the gold modal-ok fill — PRINT is the chrome's only gold fill. */
#be-reset-all-filters {
  background: ${TOKENS.groundTray} !important;
  border: 1px solid ${TOKENS.hairBone} !important;
  color: ${TOKENS.boneDim} !important;
  border-radius: ${TOKENS.radiusInner} !important;
  box-shadow: none !important;
  font-weight: 600;
  height: ${TIERS.action}px; /* T1 (AC-4) */
  padding: 0 12px !important;
}
#be-reset-all-filters:hover {
  border-color: ${TOKENS.goldShadow} !important;
  color: ${TOKENS.bone} !important;
}

/* ---------- narrow-viewport guard (AC-10 / U-34) ----------
 * The two docked panels are fixed-width (248px control, 250px layer) and the
 * sheet's stack layers span the whole viewport, so below roughly 520px the panels
 * leave the sheet no usable band. The guard narrows both panels proportionally,
 * and the layer panel additionally rides MINIMIZED (header only) below 700px —
 * driven by the panel's own minimized state, so its own header control is the way
 * back and it is never a dead end. Earlier drafts hid the panel's rows with CSS
 * (no way back: the first phase-3 round measured exactly that) and removed the
 * panel entirely below 560px (also no way back); both were rejected.
 * The sheet is never moved: sections are absolutely positioned in content space,
 * so insetting the layers would relocate every existing layout. */
@media (max-width: 900px) {
  #print-enhance-controls {
    width: min(32vw, 248px) !important;
  }
  .be-layer-panel {
    width: min(32vw, 250px) !important;
  }
}
@media (max-width: 700px) {
  #print-enhance-controls {
    width: min(30vw, 220px) !important;
  }
  .be-layer-panel {
    width: min(30vw, 220px) !important;
  }
  /* The rail keeps its own fixed width otherwise (180px), which starves the sheet
     at the narrow end — the phase-3 capture measured a 135px band at 560px. */
  .be-layer-panel.minimized {
    width: min(28vw, 180px) !important;
  }
}
@media (max-width: 560px) {
  #print-enhance-controls {
    width: min(32vw, 170px) !important;
  }
  .be-layer-panel {
    width: min(30vw, 170px) !important;
  }
  .be-layer-panel.minimized {
    width: min(26vw, 150px) !important;
  }
}

/* ---------- first-run discoverability hint (AC-5 / U-28, O-1) ----------
 * One-time dismissible card. Locked identity only: the leather ground, a
 * hair-gold 1px seam, bone text and a T1-tier gold action button.
 * It lives INSIDE the control panel column rather than floating over the sheet:
 * the phase-2 visual gate measured the first version (a fixed card on the sheet's
 * bottom strip) covering sheet content that the dismissed frame showed
 * unobstructed, and "must not obscure the sheet content the user is trying to
 * arrange" is the criterion as written. */
#be-onboarding-hint {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  margin: 0 0 8px 0 !important;
  padding: 8px 10px !important;
  background: ${TOKENS.groundTray} !important;
  border: 1px solid ${TOKENS.hairGold} !important;
  border-radius: 8px !important;
  box-shadow: 0 0 0 1px ${TOKENS.seamDeep} !important;
  color: ${TOKENS.bone} !important;
  font-family: ${TOKENS.fontTool};
  font-size: 12px;
  line-height: 1.35;
}
#be-onboarding-hint .be-onboarding-hint-text {
  flex: 1 1 auto;
  color: ${TOKENS.bone} !important;
}
#be-onboarding-hint .be-onboarding-hint-dismiss {
  flex: 0 0 auto;
  height: ${TIERS.action}px;
  padding: 0 12px;
  background: ${TOKENS.gold} !important;
  color: ${TOKENS.goldInk} !important;
  border: 1px solid ${TOKENS.goldShadow} !important;
  border-radius: 4px !important;
  font-family: ${TOKENS.fontTool};
  font-size: 12px;
  cursor: pointer;
}
#be-onboarding-hint .be-onboarding-hint-dismiss:hover {
  background: ${TOKENS.goldHi} !important;
}
#be-onboarding-hint .be-onboarding-hint-dismiss:focus-visible {
  outline: 2px solid ${TOKENS.focusRing} !important;
  outline-offset: 2px;
}
/* AC-1b (first_run_and_panel_20260911): the card's path to the gestures reference. Sized and
 * styled on the ICON tier (28x28), the same treatment the panel header's own "?" gets, because
 * this row is a single line inside the panel's 232px tray — a wider text button would either wrap
 * the row or squeeze the hint down to two words. Quiet ground at rest so "Got it" stays the
 * primary action the user reaches for, with the gold hairline appearing on hover/focus. */
#be-onboarding-hint .be-onboarding-hint-more {
  flex: 0 0 auto;
  width: ${TIERS.icon}px;
  height: ${TIERS.icon}px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent !important;
  color: ${TOKENS.bone} !important;
  border: 1px solid ${TOKENS.hairGold} !important;
  border-radius: 4px !important;
  font-family: ${TOKENS.fontTool};
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}
#be-onboarding-hint .be-onboarding-hint-more:hover {
  background: ${TOKENS.rowHover} !important;
  color: ${TOKENS.goldHi} !important;
}
#be-onboarding-hint .be-onboarding-hint-more:focus-visible {
  outline: 2px solid ${TOKENS.focusRing} !important;
  outline-offset: 2px;
}

/* ---------- destructive-recovery surfaces (track destructive_recovery_20260911) ----------
 * The undo offer (AC-3) and the restore list (AC-4). Locked identity only: the toast
 * pill's leather ground, the antique-gold action, bone/taupe text, T1 tier for the
 * control. The undo button is deliberately the ONE gold-filled control in the lane —
 * it is the affordance the user must be able to find without looking. */
.be-feedback-undo-btn {
  flex: 0 0 auto;
  height: ${TIERS.action}px;
  padding: 0 12px;
  background: ${TOKENS.gold} !important;
  color: ${TOKENS.goldInk} !important;
  border: 1px solid ${TOKENS.goldShadow} !important;
  border-radius: 4px !important;
  font-family: ${TOKENS.fontTool};
  font-size: 12px;
  cursor: pointer;
}
.be-feedback-undo-btn:hover {
  background: ${TOKENS.goldHi} !important;
}
.be-feedback-undo-btn:focus-visible {
  outline: 2px solid ${TOKENS.focusRing} !important;
  outline-offset: 2px;
}
.be-restore-status {
  color: ${TOKENS.boneDim} !important;
  font-family: ${TOKENS.fontTool};
  font-size: 12px;
  margin: 0 0 8px 0;
}
.be-restore-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 46vh;
  overflow-y: auto;
}
.be-restore-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: ${TOKENS.groundWell} !important;
  border: 1px solid ${TOKENS.hairGold} !important;
  border-radius: 6px;
}
.be-restore-what {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${TOKENS.bone} !important;
  font-family: ${TOKENS.fontTool};
  font-size: 12px;
}
.be-restore-when {
  flex: 0 0 auto;
  color: ${TOKENS.taupe} !important;
  font-family: ${TOKENS.fontTool};
  font-size: 11px;
}
.be-restore-apply {
  flex: 0 0 auto;
  height: ${TIERS.action}px;
  padding: 0 12px;
  cursor: pointer;
}
/* ---------- feedback toast (canvas lane) ---------- */
.be-feedback {
  background: ${TOKENS.groundWell} !important;
  color: ${TOKENS.bone} !important;
  border: 1px solid ${TOKENS.hairGold} !important;
  border-radius: 999px !important;
  padding: 8px 18px !important;
  top: 36px !important;
  box-shadow: ${TOKENS.shadowPanel} !important;
  font-family: ${TOKENS.fontTool};
  font-size: 13px;
  letter-spacing: 0.01em;
  z-index: 800 !important;
  position: relative;
  overflow: hidden;
  max-width: 70vw;
}
.be-feedback-tick {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: ${TOKENS.gold};
}
.be-feedback-msg {
  flex: 0 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.be-feedback-drain {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  width: 100%;
  background: ${TOKENS.goldShadow};
  border-radius: 0 0 999px 999px;
  transition: width 2.8s linear;
}
/* AC-3 (U-10): typed toasts — an error must never read as a success. */
.be-feedback-error {
  background: ${TOKENS.oxbloodDeep} !important;
  border-color: ${TOKENS.ember} !important;
  color: ${TOKENS.bone} !important;
}
.be-feedback-error .be-feedback-tick {
  background: ${TOKENS.ember} !important;
}
.be-feedback-error .be-feedback-drain {
  background: ${TOKENS.ember} !important;
}
.be-feedback-success .be-feedback-tick {
  background: ${TOKENS.goldHi || TOKENS.gold} !important;
}
/* AC-1 (U-11): the toast's dismiss control. Same T2 28x28 icon-control recipe as
   the layer-row buttons (transparent ground, taupe at rest, rowHover + goldHi on
   hover/focus) so the affordance reads as part of the locked identity rather than
   bolted on. No new hex. */
.be-feedback-dismiss {
  flex: 0 0 auto;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: ${TOKENS.taupeFaint};
  width: ${TIERS.icon}px; /* T2 (AC-4) */
  height: ${TIERS.icon}px;
  padding: 0;
  margin: -4px -10px -4px 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}
.be-feedback-dismiss:hover,
.be-feedback-dismiss:focus-visible {
  background: ${TOKENS.rowHover};
  color: ${TOKENS.goldHi};
  outline: none;
}
.be-feedback-error .be-feedback-dismiss {
  color: ${TOKENS.emberDim};
}
.be-feedback-error .be-feedback-dismiss:hover,
.be-feedback-error .be-feedback-dismiss:focus-visible {
  color: ${TOKENS.ember};
}
.be-color-picker-title {
  color: ${TOKENS.bone};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding-bottom: 2px;
  border-bottom: 1px solid ${TOKENS.hairBone};
  margin-bottom: 6px;
}

/* A tier height is NEVER negotiable (AC-4, measured 2026-09-10): a column flex
 * container that overflows (the picker modal is capped at 86vh) will otherwise
 * shrink a declared height down to the control's content height — a 32px search
 * field rendered at 17px. No tiered control may be flex-shrunk.
 *
 * AC-4 (first_run_and_panel_20260911) added the header's help and turn-off controls
 * to this list, and the reason is the rule's own sentence: they are T2 tier controls
 * (28x28) and they were simply missing. It was not a theoretical gap — adding the
 * turn-off control to the header made the row tight enough to shrink it, and the
 * browser suite measured 23px where the declared tier said 28. The collapse control
 * was already here; its two neighbours were not. */
.be-ctl-btn,
.be-ctl-templates,
#be-ctl-collapse,
#be-ctl-help,
#be-ctl-off,
#be-reset-all-filters,
.be-add-layer-btn,
.be-layer-row,
.be-layer-controls button,
.be-layer-panel-header button,
.be-modal-actions button,
.be-modal-cancel,
.be-modal-ok,
.be-modal-button,
.be-modal-tags button,
.be-modal-tabs button,
.be-more-options-button,
.be-section-actions button,
.be-modal input,
.be-picker-search {
  flex-shrink: 0;
}

/* ==========================================================================
 * ONE HEADER RECIPE — every chrome header is a SINGLE LINE at ONE size.
 *
 * Measured before this rule: the panel title ("Beyond Print") was given 80px
 * for 131px of text and broke onto two lines, and the header sizes spanned
 * 12/13/14/18px (layer panel header 12, panel title 13, tray/section heads 14,
 * modal title 18). Now every header shares one family, size, weight, tracking,
 * casing and single-line behaviour; the remaining differences are structural
 * (the nail dot on group heads, the rule band + diamond on panel headers, the
 * bone/boneDim primary-vs-group colour split) rather than typographic.
 *
 * !important on these metrics is deliberate: js/print_styles.js re-injects
 * its sheet on layout changes and can end up later in the document than this
 * one, so source order is NOT a safe tie-break here (measured: that file's
 * padding/margin values were winning on the layer panel header, and its
 * .be-layer-panel { font-size: 12px } kept the layer header's own BOX at 12px
 * even after its inner strong was unified — so the header CONTAINERS are in
 * this list too, not only the text leaves).
 * ========================================================================== */
.be-ctl-title,
.be-ctl-tray-head,
.be-layer-panel-header,
.be-layer-panel-header > strong,
.be-layer-section-header,
.be-layer-section-header > span,
.be-modal > h3,
.be-modal h3 {
  font-family: ${TOKENS.fontDisplay} !important;
  font-size: 14px !important;
  font-weight: 700 !important;
  line-height: 1.25 !important;
  letter-spacing: 0.13em !important;
  text-transform: uppercase !important;
  text-shadow: 0 1px 0 ${TOKENS.seamDeep} !important;
  /* single line, always: a header that wraps is the defect this fixes */
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  min-width: 0 !important;
}

/* ==========================================================================
 * ORNAMENT LAYER (track ornament_symmetry_20260910) — three FULL surfaces only
 *
 * Rule stack per surface, measured from the BORDER BOX edge and verified with
 * a raw-pixel scanline probe (docs/ornament-symmetry-20260910/pixel-probe.json):
 *   A blind tool  1px #0C0907  at [-1, 0]px  (a box-shadow ring, OUTERMOST)
 *   B outer hair  1px #4A3E2B  at [ 0, 1]px  (the CSS border)
 *   C inner hair  1px          at [ 6, 7]px  (::before, inset 5px of the padding box)
 * Rule C starts 6px in from the border box, so the visible bare-leather run
 * between B and C is 5px. Never a gold fill, never a rule >= 2px.
 * HIERARCHY IS BINDING: the quiet surfaces (context menu, colour picker) and
 * every plain surface (toast, in-sheet action bars, cards, pills, tabs, inputs)
 * must keep matching NOTHING below.
 * ========================================================================== */

${ornamentSurface(
  ORNAMENT_SURFACES.full[0],
  // ISSUE_shadows.md: `${TOKENS.shadowPanel}` is NOT in this list. The
  // ornament's own ring stack was the LAST of the four declarations and
  // therefore the one that actually painted, which is why removing it anywhere
  // else in the sheet changed nothing. Rules A (the 1px #0C0907 blind tool
  // `0 0 0 1px`, emitted by ornamentSurface itself) and the zero-blur workbench
  // buffer stay: a shadow with no blur is the frame, and the frame is what this
  // track exists to pin. The other two full surfaces keep their lift.
  `12px 0 0 ${TOKENS.groundWell}, 13px 0 0 ${TOKENS.hairGold}`,
  ORNAMENT_CORNERS.top,
  ORNAMENT.innerPanel,
)}

${ornamentSurface(
  ORNAMENT_SURFACES.full[1],
  `${TOKENS.shadowPanel}, -12px 0 0 ${TOKENS.groundWell}, -13px 0 0 ${TOKENS.hairGold}`,
  ORNAMENT_CORNERS.top,
  ORNAMENT.innerPanel,
)}

${ornamentSurface(
  ORNAMENT_SURFACES.full[2],
  TOKENS.shadowPanel,
  ORNAMENT_CORNERS.all,
  ORNAMENT.innerModal,
  "position: relative !important;",
)}

/* Primary ornament on the modal shell (O-4 = B1, spec.md AC-3B): the SAME
 * blind-tooled rule + centre diamond construction the panels carry
 * (.be-ctl-topbar / .be-layer-panel-header). It sits under the modal title
 * rather than on the frame edge because a frame-edge marker is clipped by the
 * modals that set inline overflow:hidden (js/catalog_service.js:181). */
.be-modal > h3 {
  position: relative;
  padding-bottom: 14px;
  margin: 0 0 2px;
  /* The modal is a column flex container capped at max-height 86vh, and
   * overflow: hidden (from the shared header recipe) makes a flex item's
   * automatic minimum size ZERO — so the title was being shrunk from 31.5px to
   * 17.6px, silently eating its bottom padding and letting the ornament rule
   * band paint across the title text (measured 2026-09-10). The title's box is
   * not negotiable, exactly like the tiered controls. */
  flex: 0 0 auto;
}
.be-modal > h3::after {
  content: "";
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: 5px;
  height: 3px;
  pointer-events: none;
  background:
    linear-gradient(${TOKENS.seamDeep}, ${TOKENS.seamDeep}) 0 0 / 100% 1px no-repeat,
    linear-gradient(${TOKENS.hairGold}, ${TOKENS.hairGold}) 0 100% / 100% 1px no-repeat;
}
.be-modal > h3::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 4px;
  width: ${ORNAMENT.diamond}px;
  height: ${ORNAMENT.diamond}px;
  transform: translateX(-50%) rotate(45deg);
  background: ${TOKENS.goldShadow};
  border: 1px solid ${ORNAMENT.stroke};
  pointer-events: none;
}

/* AC-3C — compressed states drop the primary ornament (and, where the frame
 * itself would intersect content, the inset frame too). Both states are
 * reachable in production: .be-layer-panel.minimized is 32px tall with 4px
 * vertical padding (js/print_styles.js:581), so a 6px-inset rule and 12px
 * corner arms would cross the header text; the panel therefore degrades to the
 * OUTER pair of rules (A+B) and keeps its radius. */
.be-layer-panel.minimized::before,
.be-layer-panel.minimized::after,
.be-layer-panel.minimized .be-layer-panel-header::before,
.be-layer-panel.minimized .be-layer-panel-header::after {
  display: none !important;
}
/* The collapsed control panel keeps its height (the trays are display:none, the
 * topbar does not shrink) — the frame ornament stays, only the diamond is
 * dropped while the tray is closed, per spec.md AC-3C. Measured in the phase-1
 * probe. */
.be-ctl-collapsed .be-ctl-topbar::before {
  display: none !important;
}

/* Print reinforcement: the ornament lives on chrome that is already hidden in
 * print (js/controls.js:635, js/print_styles.js:38) — this makes the guarantee
 * explicit for the overlay surfaces too, and is proven by a print-emulation
 * frame in the capture harness (spec.md AC-2/AC-3F). */
@media print {
  .be-modal-overlay,
  .be-modal,
  .be-context-menu,
  .be-color-picker-popup,
  div[style*="z-index: 20000"] {
    display: none !important;
  }
}
`;

function injectTheme() {
  if (typeof document === "undefined" || !document.head) return;
  if (document.getElementById("ddb-print-ui-theme")) return;
  const style = document.createElement("style");
  style.id = "ddb-print-ui-theme";
  style.textContent = THEME_CSS;
  document.head.appendChild(style);
}

injectTheme();

const UiTheme = {
  injectTheme,
  tokens: TOKENS,
  // Test seam (track ornament_symmetry_20260910): the emitted stylesheet, the
  // ornament primitives and the height tiers are asserted directly, instead of
  // by re-parsing the source text — the geometry claims are numeric.
  css: THEME_CSS,
  tiers: TIERS,
  ornament: {
    ...ORNAMENT,
    corners: ORNAMENT_CORNERS,
    surfaces: ORNAMENT_SURFACES,
    cornerLayers,
    surface: ornamentSurface,
  },
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = UiTheme;
}
