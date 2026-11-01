/**
 * AI border refinement LOOP — the surface a user actually refines a border with.
 *
 * Track `beyond10_ai_border_refine_loop` (BEYOND-10, SC-D2). The pure transform, the capability gate
 * and the choke-point seam already shipped in `js/ai_border.js` — with NO product caller, so the
 * card's "parameter adjustment UI + refinement loop" was missing its user-reachable half. This module
 * is that half, and it is deliberately thin: every pixel still goes through `window.AiBorder`, so the
 * module cannot become a second writer of border bytes (the invariant
 * `scripts/check_border_svg_injection.js` enforces at build time).
 *
 * WHY EVERY TOP-LEVEL NAME HERE IS `refine*`-PREFIXED (measured, not stylistic)
 * --------------------------------------------------------------------------
 * A content script's top level shares ONE global scope across every file in the injected list
 * (`chrome.scripting.executeScript({files})` evaluates them as classic scripts in one world), so two
 * modules declaring the same top-level binding is not a warning — it is a fatal `SyntaxError` that
 * kills the WHOLE second file. This module first shipped as `const state = {…}` while `js/dnd.js`
 * declares `let state = null` at line 437; `js/dnd.js` is injected AFTER this file, so dnd.js never
 * executed, `window.initDragAndDrop` / `window.scheduleAutosave` were never published, `js/main.js`'s
 * boot threw at `initDragAndDrop()`, and the layout wrapper stayed at height 0. Measured in a real
 * browser: `Identifier 'state' has already been declared` + `initDragAndDrop is not defined`, and
 * EVERY e2e spec in the repo then died at `bootPage`'s readiness wait — a boot timeout that looks
 * exactly like a broken host.
 *
 * `js/undo.js` and `js/recovery_ui.js` carry the same rule for the same reason (`_safeLog`), and
 * `test/unit/injected_scope_collision.test.js` now fails the fast suite instead of letting the next
 * module rediscover this in a browser. `refineOpen` / `refineClose` are also deliberately not named
 * `open` / `close`: those are real `window` members, and a top-level function declaration would
 * shadow them for every other file in the shared scope.
 *
 * THE LOOP (AC-2), in the order the criterion names it
 * ----------------------------------------------------
 *   select variant  → `[data-be-refine-variant]` paints a saved design through the choke point
 *   adjust          → `[data-be-refine-weight]` / `[data-be-refine-style]` set the two parameters
 *   regenerate      → `[data-be-refine-regenerate]` re-derives the artwork from the DESIGN and paints it
 *   compare         → `[data-be-refine-compare]` reports the design against the refined bytes
 *
 * "REGENERATE" MEANS RE-DERIVE, NOT RE-ROLL. The border generator is non-deterministic (see the header
 * of `test/fixtures/byok_border_corpus.json`: the same instruction is accepted in one round and refused
 * in the next), and the refinement the card asks for is over PARAMETERS. A regenerate that called the
 * model again would destroy the comparison the same criterion asks for — and spend the user's
 * credential to do it. So regenerate = `transform(design, {weight, styleIndex})`, which is pure,
 * instant, and always comparable.
 *
 * WHY THE PARAMETERS ARE ABSOLUTE (and why this lives in `js/ai_border.js`, not here)
 * ----------------------------------------------------------------------------------
 * `weight` is a multiple of the DESIGN's stroke, never of what is currently painted. The state lives
 * on the section's own dataset (`data-border-base-svg` / `data-border-weight` / `data-border-style`)
 * because that is the carrier `js/layout_scan.js` reads for the record — so session state, the saved
 * record and the surface's own position cannot disagree (AC-3).
 *
 * THE DISABLED STATE IS A FEATURE. `AiBorder.canAdjustBorder` is false for a fill-only design (no
 * `stroke-width` to rewrite: 2 of the 11 corpus designs). Rather than shipping a control that provably
 * cannot change its variant's pixels, the surface disables the adjustment controls and states the
 * reason inline. That is AC-1's honest half.
 */

"use strict";

/** The five weight steps the surface offers — multiples of the DESIGN's own stroke width. */
const REFINE_WEIGHT_STEPS = Object.freeze([0.5, 0.75, 1, 1.25, 1.5]);

/** The three style steps, mirroring `js/ai_border.js`'s `DASH_CYCLE` by index. */
const REFINE_STYLE_STEPS = Object.freeze([
  { name: "solid", index: 0 },
  { name: "dashed", index: 1 },
  { name: "dotted", index: 2 },
]);

/** The inline reason a fill-only border gives instead of a dead control. */
const REFINE_NOT_ADJUSTABLE_REASON =
  "This border is drawn with fills only — no stroke to make heavier or dashed.";

/** The surface's root marker. One attribute, so a re-open can find and replace the old surface. */
const REFINE_ROOT_ATTR = "data-be-border-refine";

/** Resolve the border seam at CALL time (the module may load in a harness without it). */
function refineAiBorder() {
  const api = typeof window !== "undefined" ? window.AiBorder : null;
  return api && typeof api.adjustBorderSvg === "function" ? api : null;
}

/**
 * The surface's own state. One surface at a time (a second `open` on the same section returns the
 * live one), because a user refining a border has exactly one section in front of them.
 */
const refineSurfaceState = {
  root: null,
  section: null,
  weight: 1,
  styleIndex: 0,
  variantId: "current",
  compared: null,
};

/** Read the section's absolute refinement state, tolerating a bare boot. */
function refineReadState(section) {
  const api = refineAiBorder();
  if (!api || typeof api.readBorderAdjust !== "function") {
    return { weight: 1, styleIndex: 0, base: null, adjusted: false, adjustable: false };
  }
  const adj = api.readBorderAdjust(section);
  const painted = typeof api.readBorderSvg === "function" ? api.readBorderSvg(section) : null;
  const adjustable = !!(adj.base || painted) && api.canAdjustBorder(adj.base || painted);
  return { weight: adj.weight, styleIndex: adj.styleIndex, base: adj.base, adjusted: adj.adjusted, adjustable };
}

/**
 * Ask the product's own debounced save to run — the EXACT seam `js/dom/layer_manager.js` asks through
 * (`requestLayerPersist`, BEYOND-9's AC-3) and the same one `js/properties_panel.js` uses for a
 * property commit. Resolved at CALL time and fail-open: a harness without `js/dnd.js` has no autosave,
 * and a refinement must not throw because of it.
 */
function refineRequestPersist() {
  if (typeof window !== "undefined" && typeof window.scheduleAutosave === "function") {
    window.scheduleAutosave();
    return true;
  }
  return false;
}

/** A short, announced message. The panel's rule: feedback through the product's one toast. */
function refineAnnounce(message, level) {
  if (typeof window !== "undefined" && typeof window.showFeedback === "function") {
    window.showFeedback(message, level || "info");
  }
}

/**
 * Apply an absolute refinement to a section: paint it, then ask for the save that persists it.
 *
 * Returns the seam's own result plus `persisted` (whether the debounced save was available), so a
 * caller (and the contract) can tell "the write happened" from "there was nothing to write with".
 *
 * @param {Element} section
 * @param {{weight?: number, styleIndex?: number}} params
 * @returns {{ok: boolean, reason: string|null, weight: number, styleIndex: number, changed: boolean, persisted: boolean}}
 */
function refineApplyAdjust(section, params) {
  const api = refineAiBorder();
  if (!api) {
    return { ok: false, reason: "unavailable", weight: 1, styleIndex: 0, changed: false, persisted: false };
  }
  const res = api.adjustBorderSvg(section, params || {});
  if (!res.ok) {
    if (res.reason === "not_adjustable") refineAnnounce(REFINE_NOT_ADJUSTABLE_REASON, "error");
    return {
      ok: false,
      reason: res.reason,
      weight: res.weight !== undefined ? res.weight : 1,
      styleIndex: res.styleIndex !== undefined ? res.styleIndex : 0,
      changed: false,
      persisted: false,
    };
  }
  const persisted = refineRequestPersist();
  const live = refineReadState(section);
  if (refineSurfaceState.section === section) {
    refineSurfaceState.weight = live.weight;
    refineSurfaceState.styleIndex = live.styleIndex;
    refineSurfaceState.compared = null;
    refineSync();
  }
  return {
    ok: true,
    reason: res.reason,
    weight: live.weight,
    styleIndex: live.styleIndex,
    changed: !!res.changed,
    persisted,
  };
}

/**
 * Compare the DESIGN against the artwork the current parameters derive from it (AC-2's last step).
 *
 * Byte-level, not pixel-level: both strings are already in hand, the transform is pure, and a byte
 * difference is exactly the fact the reviewer of a refinement needs ("did the parameter do anything?").
 * The pixel question — "is the change VISIBLE" — is G-DETECT's, measured separately by
 * `scripts/border_refine_gdetect.js` on a rendered frame.
 *
 * @param {Element} section
 * @returns {{ok: boolean, reason: string|null, original: string|null, refined: string|null, differs: boolean, weight: number, styleIndex: number}}
 */
function refineCompare(section) {
  const api = refineAiBorder();
  const live = refineReadState(section);
  const painted = api && typeof api.readBorderSvg === "function" ? api.readBorderSvg(section) : null;
  const design = live.base || painted;
  if (!design) {
    return { ok: false, reason: "no_border", original: null, refined: null, differs: false, weight: live.weight, styleIndex: live.styleIndex };
  }
  const refined = api.transformBorderSvg(design, { weight: live.weight, styleIndex: live.styleIndex });
  return {
    ok: true,
    reason: null,
    original: design,
    refined,
    differs: design !== refined,
    weight: live.weight,
    styleIndex: live.styleIndex,
  };
}

/** Return the artwork to the design (weight 1, solid) — the loop's other direction. */
function refineRevert(section) {
  return refineApplyAdjust(section, { weight: 1, styleIndex: 0 });
}

/** Human label for a style index, used by the compare line. */
function refineStyleName(index) {
  const step = REFINE_STYLE_STEPS.find((s) => s.index === index);
  return step ? step.name : "solid";
}

/** The one-line comparison the surface shows. Kept here so the DOM builder stays about the DOM. */
function refineDescribeCompare(cmp) {
  if (!cmp.ok) return "Nothing to compare — this section has no AI border.";
  const weight = "weight " + cmp.weight + "x";
  const style = "style " + refineStyleName(cmp.styleIndex);
  return weight + ", " + style + " — " + (cmp.differs ? "the refined border differs from the design" : "no difference from the design yet");
}

/** Update every control from the live state. The ONE place the surface renders state. */
function refineSync() {
  const root = refineSurfaceState.root;
  if (!root) return;
  const live = refineReadState(refineSurfaceState.section);

  const disabled = !live.adjustable;
  // The PRESSED state is the SELECTION (`refineSurfaceState.weight` / `.styleIndex`), not the painted
  // state: the loop's own order is "adjust the parameters, THEN regenerate", so the surface shows what
  // the user has asked for while the artwork still shows what was last applied. They are equal the
  // moment Regenerate runs, and equal again whenever the surface is opened on an already-refined border.
  root.querySelectorAll("[data-be-refine-weight]").forEach((node) => {
    const step = Number(node.getAttribute("data-be-refine-weight"));
    node.setAttribute("aria-pressed", String(step === refineSurfaceState.weight));
    node.disabled = disabled;
  });
  root.querySelectorAll("[data-be-refine-style]").forEach((node) => {
    const name = node.getAttribute("data-be-refine-style");
    const step = REFINE_STYLE_STEPS.find((s) => s.name === name);
    node.setAttribute("aria-pressed", String(!!step && step.index === refineSurfaceState.styleIndex));
    node.disabled = disabled;
  });
  const regenerate = root.querySelector("[data-be-refine-regenerate]");
  if (regenerate) regenerate.disabled = disabled;
  const revertBtn = root.querySelector("[data-be-refine-revert]");
  if (revertBtn) revertBtn.disabled = disabled;

  const reason = root.querySelector("[data-be-refine-reason]");
  if (reason) reason.textContent = disabled ? REFINE_NOT_ADJUSTABLE_REASON : "";

  const diff = root.querySelector("[data-be-refine-diff]");
  if (diff) diff.textContent = refineSurfaceState.compared ? refineDescribeCompare(refineSurfaceState.compared) : "";

  root.setAttribute("data-be-refine-adjustable", String(live.adjustable));
}

/** A button with the surface's shared shape (the panel's own affordance language). */
function refineMakeButton(doc, attrs, label, onClick) {
  const btn = doc.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  Object.keys(attrs).forEach((name) => btn.setAttribute(name, attrs[name]));
  btn.addEventListener("click", onClick);
  return btn;
}

/** Build the variant cells: the design currently painted, plus every saved AI border variant. */
function refineRenderVariants(root, section) {
  const list = root.querySelector("[data-be-refine-variants]");
  if (!list) return;
  const doc = root.ownerDocument;
  const api = refineAiBorder();
  const addCell = (id, label) => {
    const cell = refineMakeButton(
      doc,
      { "data-be-refine-variant": id, "aria-pressed": String(refineSurfaceState.variantId === id) },
      label,
      () => {
        refineSurfaceState.variantId = id;
        if (id === "current") {
          // "The design on the section" is not a stored variant — re-deriving with the CURRENT
          // parameters is exactly "leave the user where they are".
          refineSync();
          return;
        }
        const chosen = list.__variants ? list.__variants.find((v) => v && v.id === id) : null;
        if (!chosen || typeof chosen.svg !== "string") return;
        // A new design resets the refinement (renderBorderSvg does that) — the parameters belonged
        // to the old artwork.
        if (api && typeof api.renderBorderSvg === "function") {
          api.renderBorderSvg(section, chosen.svg);
          refineRequestPersist();
        }
        refineSync();
      },
    );
    cell.className = "be-border-refine-variant";
    list.appendChild(cell);
  };

  addCell("current", "Current border");
  if (!api || typeof api.listBorders !== "function") return;
  Promise.resolve(api.listBorders())
    .then((rows) => {
      const variants = (Array.isArray(rows) ? rows : []).filter((r) => r && r.id && r.svg);
      list.__variants = variants;
      variants.forEach((v) => addCell(String(v.id), String(v.id)));
    })
    .catch(() => {
      /* a library that cannot be read is simply "no saved variants" — never a thrown surface */
    });
}

/**
 * Open the refinement surface for a section.
 *
 * @param {Element} section the `.print-section-container` whose border is being refined
 * @param {{container?: Element}} [opts] where to mount (defaults to `document.body`)
 * @returns {Element|null} the surface root, or null when there is no section to refine
 */
function refineOpen(section, opts) {
  if (!section || !section.dataset) return null;
  if (refineSurfaceState.root && refineSurfaceState.section === section) return refineSurfaceState.root;
  refineClose();

  const doc = (opts && opts.container && opts.container.ownerDocument) || document;
  const host = (opts && opts.container) || doc.body;
  const live = refineReadState(section);

  const root = doc.createElement("div");
  root.className = "be-border-refine";
  root.setAttribute(REFINE_ROOT_ATTR, "1");
  root.setAttribute("data-section-id", section.id || "");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Refine AI border");
  root.style.cssText =
    "position:fixed;right:16px;top:120px;z-index:2147483000;box-sizing:border-box;padding:10px;" +
    "border-radius:8px;background:#1c1c1c;border:1px solid #444;color:#ddd;font-size:12px;" +
    "width:260px;display:flex;flex-direction:column;gap:8px;box-shadow:0 6px 24px rgba(0,0,0,0.5)";

  const header = doc.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";
  const title = doc.createElement("strong");
  title.textContent = "Refine AI border";
  header.appendChild(title);
  header.appendChild(
    refineMakeButton(
      doc,
      { "data-be-refine-close": "1", "aria-label": "Close the refine panel" },
      "✕",
      () => refineClose(),
    ),
  );
  root.appendChild(header);

  // The elements the user has to know about, in the criterion's own order.
  const weightRow = doc.createElement("div");
  weightRow.style.cssText = "display:flex;gap:4px;align-items:center";
  const weightLabel = doc.createElement("span");
  weightLabel.textContent = "Weight";
  weightLabel.style.cssText = "width:52px;color:#aaa";
  weightRow.appendChild(weightLabel);
  REFINE_WEIGHT_STEPS.forEach((step) => {
    weightRow.appendChild(
      refineMakeButton(
        doc,
        {
          "data-be-refine-weight": String(step),
          "aria-pressed": String(step === live.weight),
          "aria-label": "Border weight " + step + "x",
        },
        step + "x",
        () => {
          if (refineSurfaceState.section !== section) return;
          // ADJUST — the first half of the loop's middle step: the selection changes, the artwork
          // does not. Regenerate is what paints. (Writing on every click would make a user sliding
          // through five weights ask for five saves and paint five intermediates.)
          refineSurfaceState.weight = step;
          refineSurfaceState.compared = null;
          refineSync();
        },
      ),
    );
  });
  root.appendChild(weightRow);

  const styleRow = doc.createElement("div");
  styleRow.style.cssText = "display:flex;gap:4px;align-items:center";
  const styleLabel = doc.createElement("span");
  styleLabel.textContent = "Style";
  styleLabel.style.cssText = "width:52px;color:#aaa";
  styleRow.appendChild(styleLabel);
  REFINE_STYLE_STEPS.forEach((step) => {
    styleRow.appendChild(
      refineMakeButton(
        doc,
        {
          "data-be-refine-style": step.name,
          "aria-pressed": String(step.index === live.styleIndex),
          "aria-label": "Border style " + step.name,
        },
        step.name,
        () => {
          if (refineSurfaceState.section !== section) return;
          refineSurfaceState.styleIndex = step.index;
          refineSurfaceState.compared = null;
          refineSync();
        },
      ),
    );
  });
  root.appendChild(styleRow);

  const variantBox = doc.createElement("div");
  variantBox.setAttribute("data-be-refine-variants", "1");
  variantBox.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;align-items:center";
  const variantLabel = doc.createElement("span");
  variantLabel.textContent = "Variant";
  variantLabel.style.cssText = "width:52px;color:#aaa";
  variantBox.appendChild(variantLabel);
  root.appendChild(variantBox);

  const actions = doc.createElement("div");
  actions.style.cssText = "display:flex;gap:4px;flex-wrap:wrap";
  actions.appendChild(
    refineMakeButton(doc, { "data-be-refine-regenerate": "1" }, "Regenerate", () => {
      if (refineSurfaceState.section !== section) return;
      // REGENERATE — the loop's third step: paint the artwork these parameters derive from the DESIGN.
      refineApplyAdjust(section, { weight: refineSurfaceState.weight, styleIndex: refineSurfaceState.styleIndex });
    }),
  );
  actions.appendChild(
    refineMakeButton(doc, { "data-be-refine-compare": "1" }, "Compare", () => {
      if (refineSurfaceState.section !== section) return;
      refineSurfaceState.compared = refineCompare(section);
      refineSync();
    }),
  );
  actions.appendChild(
    refineMakeButton(doc, { "data-be-refine-revert": "1" }, "Revert", () => {
      if (refineSurfaceState.section !== section) return;
      refineRevert(section);
    }),
  );
  root.appendChild(actions);

  const diff = doc.createElement("div");
  diff.setAttribute("data-be-refine-diff", "1");
  diff.style.cssText = "color:#aaa;line-height:1.4";
  root.appendChild(diff);

  const reason = doc.createElement("div");
  reason.setAttribute("data-be-refine-reason", "1");
  reason.style.cssText = "color:#e8b365;line-height:1.4";
  root.appendChild(reason);

  host.appendChild(root);

  refineSurfaceState.root = root;
  refineSurfaceState.section = section;
  refineSurfaceState.weight = live.weight;
  refineSurfaceState.styleIndex = live.styleIndex;
  refineSurfaceState.variantId = "current";
  refineSurfaceState.compared = null;

  refineRenderVariants(root, section);
  refineSync();
  return root;
}

/** Remove the surface (idempotent). The refinement itself is a DOM write and survives the close. */
function refineClose() {
  if (refineSurfaceState.root && refineSurfaceState.root.parentNode) {
    refineSurfaceState.root.parentNode.removeChild(refineSurfaceState.root);
  }
  refineSurfaceState.root = null;
  refineSurfaceState.section = null;
  refineSurfaceState.compared = null;
}

/** The surface's live state — what the contract and the e2e probe read instead of scraping badges. */
function refineGetState() {
  const live = refineSurfaceState.section
    ? refineReadState(refineSurfaceState.section)
    : { weight: 1, styleIndex: 0, adjustable: false };
  return {
    open: !!refineSurfaceState.root,
    sectionId: refineSurfaceState.section ? refineSurfaceState.section.id || null : null,
    weight: live.weight,
    styleIndex: live.styleIndex,
    adjustable: !!live.adjustable,
    reason: live.adjustable ? null : "not_adjustable",
    variantId: refineSurfaceState.variantId,
    compared: refineSurfaceState.compared
      ? {
          differs: !!refineSurfaceState.compared.differs,
          weight: refineSurfaceState.compared.weight,
          styleIndex: refineSurfaceState.compared.styleIndex,
        }
      : null,
  };
}

const BorderRefine = {
  // Public API (this track, AC-1): js/properties_panel.js's "Refine AI border" row opens the surface
  // from here.
  open: refineOpen,
  // Test seam (this track, AC-1/AC-3): the surface's own buttons call the module-local painters, and
  // the unit contract + the e2e probe drive these SAME members — a surface exercised only through its
  // own DOM handlers would leave the seam unproven. None of them has a product caller by design.
  close: refineClose,
  applyAdjust: refineApplyAdjust,
  compare: refineCompare,
  revert: refineRevert,
  getState: refineGetState,
  // The two step vocabularies are deliberately NOT exported: the surface builds its buttons from them
  // and the contract asserts the VOCABULARY through those buttons' own `data-be-refine-*` attributes
  // (the thing a user can press), so a `BorderRefine.WEIGHT_STEPS` would be an export with no reader —
  // the exact re-rot `scripts/audit_dead_exports.js` refuses. They shipped exported once, invisible to
  // that audit because a shorthand property carries no `name: value` pair to census; this note is what
  // replaced the false claim that the contract read them.
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = BorderRefine;
}
if (typeof window !== "undefined") {
  // `window.BorderRefine` — Public API (this track, AC-1): the properties panel's refine row is the
  // product caller; `js/background.js`'s `executeScript` file list loads the module on the page.
  window.BorderRefine = BorderRefine;
}
