/**
 * Drag and Drop Engine for Print Sections
 *
 * Track drag_ux_overhaul_20260909 (Phase 1): the engine is rewritten from
 * native HTML5 DnD to a **pointer-events** model so that
 *   - mouse + touch + pen are unified (AC-1),
 *   - a small movement threshold (~4px) separates "click / text selection"
 *     from "drag the section" — below the threshold nothing is prevented and
 *     selection/click behave natively (AC-2),
 *   - the engine is drivable by Playwright raw pointer sequences (visual-gate
 *     harness), which native HTML5 DnD was not.
 *
 * Phase 2 adds live grid snap + alignment guides; Phase 3 adds viewport-wide
 * tracking/auto-scroll/clamped drops + persistence. Drop coordinates keep the
 * historical 16px grid-snap on release until Phase 2's live snap removes the
 * release jump.
 *
 * Wrappers are absolute-positioned inside the layout root. The wrapper itself
 * is never a native drag source anymore (`draggable` is not set); a delegated
 * `dragstart` suppressor neutralizes stray native drags (e.g. images) inside
 * wrappers so the only mover is this pointer engine.
 */

/**
 * AC-5 (track refactor_surface_20260911): ONE logger, resolved at CALL time.
 *
 * This used to be a module-level `window.safeLog || (console bridge)` — a LOAD-time capture whose
 * fallback also DIFFERED from the real logger's (it had no test-mode silencing), so a suite that
 * booted this module alone printed what every other module silenced. Reading the seam per call
 * removes both problems, and a missing seam simply drops the line — the same outcome the
 * silencing already gives, and the price of having exactly one implementation.
 */
const safeLog = (method, ...args) => {
  window.safeLog?.(method, ...args);
};

const DRAG_THRESHOLD = 4; // px of pointer travel before a drag commits (AC-2)
const GRID_STEP = 16; // snap step (Phase 2: live snap — AC-4)
const ALIGN_TOLERANCE = 4; // px within which a guide line is drawn (AC-4)

// Sheet auto-scroll (track sheet_autoscroll_20260909, AC-S2): the editor
// sheet is a fixed overlay whose sections layer (#print-enhance-sections-
// layer, a .pe-layer) is now an internal vertical scrollport. While a drag
// is held within AUTOSCROLL_EDGE_PX of the scrollport's top/bottom edge the
// engine steps its scrollTop by AUTOSCROLL_STEP_PX every
// AUTOSCROLL_INTERVAL_MS, so content below the fold can be reached mid-drag.
const AUTOSCROLL_EDGE_PX = 48;
const AUTOSCROLL_STEP_PX = 16;
const AUTOSCROLL_INTERVAL_MS = 16;

// ---------------------------------------------------------------------------
// Interaction predicates (shared safety contract, spec.md I-1 / AC-1)
// ---------------------------------------------------------------------------

/**
 * Checks if the layer containing the given element is currently locked.
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isElementLocked(el) {
  if (!el) return true;

  const lm = window.DomManager ? window.DomManager.getInstance().getLayerManager() : null;
  if (!lm) return false; // Default to editable if no LayerManager

  const wrapper = el.closest('.be-section-wrapper');
  if (!wrapper) return true;

  const layer = lm.getLayerForElement(wrapper.id);
  return layer ? layer.isLocked : false;
}

/**
 * The wrapper's own centred nine-dot MOVE handle (ISSUE_drag_and_drop.md).
 * @param {EventTarget|null} target
 * @returns {boolean}
 */
function isDragHandle(target) {
  return Boolean(
    target &&
      typeof target.closest === 'function' &&
      target.closest('.be-drag-handle'),
  );
}

/**
 * True when the pointer target is interactive content that must never arm a
 * drag: the section action bar and native controls/links (spec.md I-1).
 * @param {EventTarget|null} target
 * @returns {boolean}
 */
function isInteractiveTarget(target) {
  if (!target || typeof target.closest !== 'function') return true;
  // THE ONE EXCEPTION, ASSERTED FIRST (ISSUE_drag_and_drop.md): the centred
  // nine-dot handle is a <button> that sits inside a wrapper, and every rule
  // below would exempt it (`button`, and `.be-section-actions` once the
  // section bars became pointer-transparent at rest). It is the ONLY thing on
  // a section the user is meant to grab, so the exemption is checked BEFORE
  // them rather than added to their selector list — a `:not()` on the broad
  // `button` term would be one more place the same fact has to be spelled out.
  if (isDragHandle(target)) return false;
  return Boolean(
    target.closest(
      // AC-4/U-6 (ui_ux_review_20260910): the rotation and resize handles are
      // divs/spans, so they used to arm the MOVE drag — grabbing the rotate
      // handle both rotated and moved the element. They are interactive
      // targets: a pointerdown on them must never start a move.
      '.be-section-actions, .be-rotation-handle, .print-section-resize-handle, ' +
        'button, input, select, textarea, a',
    ),
  );
}

/**
 * THE CENTRED NINE-DOT MOVE HANDLE (ISSUE_drag_and_drop.md).
 *
 * WHAT CHANGED: the green `drop-shadow` that used to appear over a hovered
 * section ("Theres a 'green' shadow filter displayed when hovering a section
 * thats allowed to be dragged … The UX of that is extremely bad") is gone, and
 * the affordance is now a handle with NINE dots, sitting at the CENTRE of the
 * section, from which the section is dragged.
 *
 * WHY IT LIVES IN THIS MODULE: `dnd.js` owns the drag gesture, so it owns the
 * thing you grab — one owner for the node, its cursor, its reveal and its
 * exemption from the interactive-target rule. It is a DIRECT CHILD of the
 * wrapper (a sibling of `.print-section-container`), so it is centred on the
 * wrapper box itself rather than on whatever content a section happens to hold,
 * and no section re-render (compact / border / responsive scale all paint INTO
 * `.print-section-container`) can remove it.
 *
 * WHY A <button>: keyboard/AT reachable (it is focusable, and
 * `:focus-within` reveals it exactly like `:hover`), and the product's whole
 * tiered-control convention (track ornament_symmetry_20260910, spec.md AC-4) is
 * that a clickable control IS a button, so the sheet's own `button` element
 * rules — including "never a native drag source" and the focus-ring recipe —
 * apply to it for free rather than needing a third copy.
 *
 * WHY IT IS EXEMPT, NOT ABSENT FROM THE RULES: `isInteractiveTarget` would
 * otherwise refuse it twice over (`button`, and `.be-section-actions` once the
 * action bar became pointer-transparent at rest), and `isDragHandle` is checked
 * FIRST so there is exactly one place that states which control is the grab
 * target.
 *
 * WHY NO CLICK HANDLER: the drag engine starts on `pointerdown` and commits
 * after 4px, so the click that follows a plain press-release (click-to-select,
 * click-to-front) must still reach the wrapper untouched — the same reason
 * `handlePointerDown` deliberately does not `preventDefault`. This is NOT HTML5
 * drag-and-drop: wrappers are not native drag sources (the pointer engine's
 * AC-1, pinned by the `draggable="true"` query in
 * test/browser_e2e/drag_glow_layers.spec.js), and `initDragAndDrop` cancels
 * stray `dragstart` events.
 *
 * @param {HTMLElement} wrapper
 * @returns {HTMLElement|null} the wrapper's handle
 */
function ensureDragHandle(wrapper) {
  if (!wrapper || typeof wrapper.querySelector !== 'function') return null;
  let handle = wrapper.querySelector(':scope > .be-drag-handle');
  if (!handle) {
    handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'be-drag-handle';
    handle.title = 'Drag to move this section';
    handle.setAttribute('aria-label', handle.title);
    // THE GRID OF NINE. `Icons.svg` is the 16px single-weight set every other
    // in-sheet control uses; `gripVertical` is its nine-dot entry (filled
    // circles, stroke-free, so a 12px render reads as dots and not rings). It
    // is built through the SAME primitive instead of a hand-written <svg>, and
    // fails open to the U+22EE9 character when the icon module has not been
    // evaluated in this host.
    if (
      typeof window !== 'undefined' &&
      window.Icons &&
      typeof window.Icons.svg === 'function'
    ) {
      handle.innerHTML = window.Icons.svg('gripVertical', 12);
    } else {
      handle.textContent = '\u22EE9';
    }
    wrapper.appendChild(handle);
  }
  return handle;
}

/**
 * Give every wrapper the sheet currently holds its handle. The boot pass:
 * sections are (re)built after `initDragAndDrop()` in some flows and a
 * MutationObserver covers the rest (see `watchDragHandles`), so this is
 * deliberately idempotent.
 * @returns {number} how many wrappers were visited
 */
function syncDragHandles() {
  if (typeof document === 'undefined') return 0;
  const wrappers = document.querySelectorAll('.be-section-wrapper');
  Array.prototype.forEach.call(wrappers, ensureDragHandle);
  return wrappers.length;
}

/**
 * Keep the handles in the document as sections come and go.
 *
 * WHY AN OBSERVER AND NOT A CALL IN THE SECTION FACTORY: wrappers are created
 * in SEVEN places (the extraction pass, `createShape`, clones, skill split,
 * ability/extraction loads, spell cards, layout apply) and every one of them
 * goes through an insertion into the sheet, so one observer covers all seven
 * where seven call sites would each be a new thing to forget. Records are
 * coalesced into a microtask flush, and only the wrapper an added/removed node
 * belongs to is visited — the observer never walks the document.
 *
 * @param {Node} [target] what to observe (defaults to the document element)
 * @returns {MutationObserver|null}
 */
function watchDragHandles(target) {
  if (typeof MutationObserver !== 'function') return null;
  const host =
    target ||
    (typeof document !== 'undefined' ? document.documentElement : null);
  if (!host || typeof host.addEventListener !== 'function') return null;

  const pending = new Set();
  let flushQueued = false;

  const collect = (node) => {
    if (!node || node.nodeType !== 1) return;
    if (node.classList && node.classList.contains('be-section-wrapper')) {
      pending.add(node);
    }
    if (node.closest && node.closest('.be-section-wrapper')) {
      pending.add(node.closest('.be-section-wrapper'));
    }
  };

  const flush = () => {
    flushQueued = false;
    for (const wrapper of pending) {
      if (wrapper.isConnected === false) continue; // removed again before we looked
      ensureDragHandle(wrapper);
    }
    pending.clear();
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes && record.addedNodes.forEach(collect);
      // A REMOVED wrapper needs nothing: its handle went with it. A removed
      // HANDLE is what this arm exists for — a section rebuilt in place keeps
      // its wrapper, so the added arm above would never see it again.
      record.removedNodes &&
        record.removedNodes.forEach((node) => {
          if (
            node &&
            node.nodeType === 1 &&
            node.classList &&
            node.classList.contains('be-drag-handle') &&
            node.parentNode
          ) {
            pending.add(node.parentNode);
          }
        });
    }
    if (pending.size && !flushQueued) {
      flushQueued = true;
      Promise.resolve().then(flush).catch(() => {
        flushQueued = false;
      });
    }
  });

  observer.observe(host, { childList: true, subtree: true });
  return observer;
}


// ---------------------------------------------------------------------------
// Phase 2 helpers: grid snap + alignment guides (pure, unit-tested)
// ---------------------------------------------------------------------------


/**
 * Snap a container-space coordinate to the 16px grid.
 * @param {number} x container-space x
 * @param {number} y container-space y
 * @returns {{x:number, y:number}}
 */
function snapToGrid(x, y) {
  return {
    x: Math.round(x / GRID_STEP) * GRID_STEP + 0,
    y: Math.round(y / GRID_STEP) * GRID_STEP + 0,
  };
}

function alignmentCandidates(r) {
  return {
    left: r.left,
    right: r.right,
    hcenter: (r.left + r.right) / 2,
    top: r.top,
    bottom: r.bottom,
    vcenter: (r.top + r.bottom) / 2,
  };
}

/**
 * Compute alignment guides between a dragged rect and other rects (client
 * coordinate space). A guide coordinate is emitted whenever an edge or
 * center of `rect` is within `tolerance` of an edge or center of another
 * rect (or of the container).
 * @param {{left:number,right:number,top:number,bottom:number}} rect dragged rect
 * @param {Array<{left:number,right:number,top:number,bottom:number}>} others
 * @param {{left:number,right:number,top:number,bottom:number}} [container]
 * @param {number} [tolerance]
 * @returns {{v:number[], h:number[]}} vertical and horizontal guide coords
 */
function findAlignmentGuides(rect, others, container, tolerance = ALIGN_TOLERANCE) {
  const R = alignmentCandidates(rect);
  const targets = others.map(alignmentCandidates);
  if (container) targets.push(alignmentCandidates(container));

  const v = [];
  const h = [];
  const H_PAIRS = [
    ['left', 'left'], ['left', 'hcenter'], ['left', 'right'],
    ['hcenter', 'left'], ['hcenter', 'hcenter'], ['hcenter', 'right'],
    ['right', 'left'], ['right', 'hcenter'], ['right', 'right'],
  ];
  const V_PAIRS = [
    ['top', 'top'], ['top', 'vcenter'], ['top', 'bottom'],
    ['vcenter', 'top'], ['vcenter', 'vcenter'], ['vcenter', 'bottom'],
    ['bottom', 'top'], ['bottom', 'vcenter'], ['bottom', 'bottom'],
  ];
  const push = (arr, a, b) => {
    for (const t of targets) {
      if (Math.abs(R[a] - t[b]) <= tolerance) {
        const mid = Math.round((R[a] + t[b]) / 2);
        if (arr.indexOf(mid) === -1) arr.push(mid);
      }
    }
  };
  for (const [a, b] of H_PAIRS) push(v, a, b);
  for (const [a, b] of V_PAIRS) push(h, a, b);
  return { v, h };
}

// ---------------------------------------------------------------------------
// Engine state
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} DragState
 * @property {HTMLElement} wrapper
 * @property {number} pointerId
 * @property {number} startX clientX at pointerdown
 * @property {number} startY clientY at pointerdown
 * @property {number} offsetX grab offset inside the wrapper (clientX - rect.left)
 * @property {number} offsetY
 * @property {boolean} committed true once the threshold has been crossed
 * @property {HTMLElement} [ghost]
 * @property {number} [snapLeft] last snapped container-space left (AC-4)
 * @property {number} [snapTop]
 * @property {number} [lastClientX] latest pointer clientX (auto-scroll)
 * @property {number} [lastClientY]
 */

let state = null;
let initialized = false;
let guideLayer = null;

// ---------------------------------------------------------------------------
// Phase 3: debounced autosave. Drag-time viewport auto-scroll was deferred
// from drag_ux_overhaul_20260909 (operator decision O-5, 2026-09-09) because
// the sheet is a fixed full-viewport overlay — window scrolling is a no-op.
// Implemented here by track sheet_autoscroll_20260909: the sections layer is
// now an internal scrollport (print_styles.js AC-S1) and this engine drives
// its scrollTop while a drag is held near the edge (AC-S2..AC-S5). See
// temp/issues/ISSUE_sheet_overlay_autoscroll_20260909.md.
// ---------------------------------------------------------------------------

const AUTOSAVE_DEBOUNCE_MS = 1000; // idle time after the last drop/nudge

// Phase 2a (track undo_stack_20260911): the nudge burst coalescer. A held arrow key is
// ONE user intent, so its key-repeat burst is ONE undo record — otherwise the O-1 bound
// fills with a single action. Reset by any different wrapper or by an idle gap.
let nudgeBurstWrapper = null;
let nudgeBurstAt = 0;

let autosaveTimer = null;
// AC-1 (ui_ux_review_20260910): autosave pausing is a REF-COUNT so two
// overlapping destructive modals keep autosave paused until the last one
// closes (a boolean would resume on the first close). `autosaveDirty`
// remembers that a write is owed so `resumeAutosave()` can re-arm it —
// pausing never drops the pending save, it defers it.
let autosavePauseCount = 0;
let autosaveDirty = false;

/** True while any destructive flow holds autosave paused. */
function isAutosavePaused() {
  return autosavePauseCount > 0;
}

/**
 * Pause autosave (ref-counted). Cancels any ALREADY-ARMED debounce timer so a
 * save queued just before the modal opened can never fire during it — the
 * dirty flag survives so the write is deferred, not lost.
 */
function pauseAutosave() {
  autosavePauseCount += 1;
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
}

/** Resume autosave; on the last release, re-arm a pending (dirty) save. */
function resumeAutosave() {
  autosavePauseCount = Math.max(0, autosavePauseCount - 1);
  if (autosavePauseCount === 0 && autosaveDirty) {
    scheduleAutosave();
  }
}

/**
 * Debounced persistence (AC-8, O-3a): ~1s after the last drop the layout is
 * saved through the existing scanLayout + __DDBStorage seam (matching
 * handleSaveBrowser), then a "Layout saved" toast is shown. No JSON schema
 * change. Silently skips when the save seam is unavailable (unit tests).
 */
function scheduleAutosave() {
  autosaveDirty = true;
  if (isAutosavePaused()) return; // deferred until the destructive flow closes
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    persistLayout();
  }, AUTOSAVE_DEBOUNCE_MS);
}

async function persistLayout() {
  try {
    if (isAutosavePaused()) return; // never persist mid-destructive-flow
    if (
      typeof window.scanLayout !== 'function' ||
      !window.__DDBStorage
    ) {
      return;
    }
    const layout = await window.scanLayout();
    const characterId =
      typeof window.getCharacterId === 'function'
        ? window.getCharacterId()
        : null;
    const storage = window.__DDBStorage;
    if (characterId && typeof storage.saveLayout === 'function') {
      await storage.saveLayout(characterId, layout);
      if (typeof storage.saveGlobalLayout === 'function') {
        await storage.saveGlobalLayout(layout);
      }
    } else if (typeof storage.saveGlobalLayout === 'function') {
      await storage.saveGlobalLayout(layout);
    }
    autosaveDirty = false;
    if (typeof window.showFeedback === 'function') {
      window.showFeedback('Layout saved');
    }
    safeLog('log', '[DDB Print] Layout auto-saved');
  } catch (err) {
    safeLog('error', '[DDB Print] Autosave failed', err);
  }
}

/**
 * A user-facing name for the element a mutation moved, for the undo affordance's label
 * (`contract.md` §2.1 C — the label names the action AND its subject, never a generic
 * word). Falls back through the same fields the layer panel and scan use.
 */
function undoLabelFor(wrapper) {
  if (!wrapper) return 'element';
  const title = (wrapper.dataset && wrapper.dataset.title) || '';
  if (title) return title;
  const header = wrapper.querySelector && wrapper.querySelector('.print-section-header span');
  if (header && header.textContent && header.textContent.trim()) {
    return header.textContent.trim();
  }
  return wrapper.id || 'element';
}

/**
 * Put the PRE-gesture position back into a captured layout for one element id.
 *
 * WHY THIS EXISTS (track undo_stack_20260911, Phase 2a): the drag's capture begins at
 * pointerdown and resolves asynchronously. `scanLayout` awaits storage mid-scan, so a
 * capture started before the drop can finish its DOM reads AFTER `finalizeDrop` has
 * written — recording the POST-drop position. Rather than deferring the drop (which would
 * leave the drag ghost in the document a storage round-trip past pointerup, a real
 * regression the drag suite caught) or refusing to record (which would make a fast flick
 * silently un-undoable), the record is REPAIRED with the position that was saved
 * synchronously at pointerdown.
 *
 * The repair is sound because a drag's ONLY writes are the two in `finalizeDrop`; nothing
 * else a scan reads is touched between pointerdown and the drop, and a live ghost is
 * excluded from the scan. The flick case asserts the repaired record is EXACTLY the
 * pre-drag layout, which is what keeps this from being a hopeful patch.
 */
function patchCapturedPosition(layout, id, left, top, zIndex, printZ) {
  if (!layout || !id) return layout;
  // ONE implementation of the "find this element in a captured layout" lookup lives in
  // js/persistence.js (`patchCapturedFields`), so this and the resize/rotate repairs
  // cannot drift apart — the keyed-vs-`id`-field trap that a probe caught here would
  // otherwise have to be re-learned per class.
  const fields = { left, top };
  // Stacking is repaired too: the click that selects a section also raises it to the
  // front, inside the same gesture, so a record read late would hold the RAISED z and the
  // undo would leave the section stacked to the front (measured).
  if (zIndex !== undefined) fields.zIndex = zIndex;
  if (printZ !== undefined) fields.printZIndex = printZ;
  if (typeof window.patchCapturedFields === 'function') {
    return window.patchCapturedFields(layout, id, fields);
  }
  return layout;
}

/**
 * Nudge the active wrapper by a container-space delta (clamped to the sheet
 * origin). Any 1px / 16px shift that leaves the drag's bounds contract.
 * @param {number} dx
 * @param {number} dy
 * @returns {boolean} true when a wrapper moved
 */
async function nudgeActiveWrapper(dx, dy) {
  const active = document.querySelector('.be-active-wrapper');
  if (!active) return false;
  const wrapper = active.classList.contains('be-section-wrapper')
    ? active
    : active.closest('.be-section-wrapper');
  if (!wrapper || isElementLocked(wrapper)) return false;

  // Phase 2a: capture BEFORE the write, and coalesce. A held arrow key is ONE user
  // action, so a key-repeat burst must be ONE record rather than one per keydown —
  // otherwise the O-1 bound fills with a single intent. The coalescing window matches
  // the autosave debounce, which is the product's own notion of "the same edit".
  const now = Date.now();
  const sameBurst =
    nudgeBurstWrapper === wrapper && now - nudgeBurstAt < AUTOSAVE_DEBOUNCE_MS;

  // The PRE-nudge values, read synchronously. The capture below awaits a storage round-trip
  // and only then reads the DOM, so it can finish AFTER this function's own writes — a
  // measured consequence was a record holding the POST-nudge `left` (undo left the section
  // one step away from where it started). The record is repaired from these values, the same
  // pattern the drag uses.
  const preLeft = wrapper.style.left;
  const preTop = wrapper.style.top;
  const preZ = wrapper.style.zIndex;
  const prePrintZ = wrapper.dataset ? wrapper.dataset.printZ : undefined;

  // THE BURST MARKERS ARE SET SYNCHRONOUSLY, BEFORE THE CAPTURE IS AWAITED — and that
  // ordering is a MEASURED FIX, not a style choice. The capture awaits a storage
  // round-trip, so when the markers were written *after* it, a second keypress that
  // arrived during that await still saw the previous burst state and started its own
  // record. Measured in a real browser: two ArrowRight presses produced TWO records
  // (16px -> 17px -> 18px) instead of one burst. It went unnoticed in jsdom only because
  // fake-indexeddb resolves the scan fast enough that back-to-back calls never overlap.
  if (!sameBurst) {
    nudgeBurstWrapper = wrapper;
    nudgeBurstAt = now;
  }
  // Phase 2 (track refactor_surface_20260911): the record comes from the ONE shared protocol.
  // The write still WAITS for the capture — that ordering is a MEASURED fix (see the burst
  // markers above: when the markers were written after the await, a second keypress during it
  // started its own record). Awaiting `mut.capture` keeps the ordering while `pushMutation`
  // owns the push and the repair.
  let mut = null;
  if (!sameBurst && typeof window.beginMutation === 'function') {
    mut = window.beginMutation({ left: preLeft, top: preTop, zIndex: preZ, printZ: prePrintZ });
    if (mut.capture) await mut.capture;
  }

  const left = Math.max(0, (parseInt(wrapper.style.left) || 0) + dx);
  const top = Math.max(0, (parseInt(wrapper.style.top) || 0) + dy);
  wrapper.style.setProperty('left', left + 'px', 'important');
  wrapper.style.setProperty('top', top + 'px', 'important');
  if (window.updateLayoutBounds) window.updateLayoutBounds();
  scheduleAutosave();
  notifyLayoutMoved();

  if (mut && typeof window.pushMutation === 'function') {
    const name = (wrapper.dataset && wrapper.dataset.title) || 'element';
    const id =
      (wrapper.querySelector && wrapper.querySelector('.print-section-container') || {}).id ||
      wrapper.id;
    // Repaired, not used raw: the capture's DOM reads can land after the writes above. The
    // repair is now the SHARED one and runs for a settled capture too (Phase 1), which is what
    // lets every class hand the same shape to the same helper without losing its repair.
    window.pushMutation(mut, 'Nudge ' + name, window.MUTATION_CLASSES.NUDGE, (layout, snap) =>
      patchCapturedPosition(layout, id, snap.left, snap.top, snap.zIndex, snap.printZ));
  }
  return true;
}

function notifyLayoutMoved() {
  try {
    window.dispatchEvent(new window.CustomEvent('be-layout-moved'));
  } catch {
    /* CustomEvent/dispatch may be unavailable in bare harnesses */
  }
  if (
    window.PropertiesPanel &&
    typeof window.PropertiesPanel.syncPositionInputs === 'function'
  ) {
    window.PropertiesPanel.syncPositionInputs();
  }
}

/**
 * Arrow-key nudge: 1px per press, 16px (one grid step) with Shift. Only acts
 * on the active wrapper and only when focus is not inside a form control.
 */
function handleNudgeKeyDown(e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target;
  if (
    t &&
    (t.tagName === 'INPUT' ||
      t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' ||
      t.isContentEditable)
  ) {
    return;
  }
  const map = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  if (!(e.key in map)) return;
  if (!document.querySelector('.be-active-wrapper')) return;
  e.preventDefault();
  const step = e.shiftKey ? 16 : 1;
  const [dx, dy] = map[e.key];
  nudgeActiveWrapper(dx * step, dy * step);
}

// ---------------------------------------------------------------------------
// Sheet auto-scroll (AC-S2..AC-S5, track sheet_autoscroll_20260909)
// ---------------------------------------------------------------------------

let autoscrollTimer = null;

/**
 * The drag's sheet-internal scroll host: the `.pe-layer` that contains the
 * wrapper being dragged (in production `#print-enhance-sections-layer`, which
 * print_styles.js makes the sheet's scrollport). Returns null when the wrapper
 * is not inside a scrollable layer — legacy harnesses that place wrappers
 * directly in the layout root simply never auto-scroll.
 * @param {HTMLElement} wrapper
 * @returns {HTMLElement|null}
 */
function scrollHostFor(wrapper) {
  return wrapper && typeof wrapper.closest === 'function'
    ? wrapper.closest('.pe-layer')
    : null;
}

/**
 * One auto-scroll tick on `host`: when `pointerY` is inside the top/bottom
 * edge band (AUTOSCROLL_EDGE_PX) of the host's scrollport, step `scrollTop`
 * one AUTOSCROLL_STEP_PX toward the content (bottom band) or the origin (top
 * band). Clamped to [0, scrollHeight - clientHeight]. Mutates only the host's
 * scrollTop; exported for unit tests (AC-S2).
 * @param {HTMLElement} host the sheet-internal scroll container
 * @param {number} pointerY client-space pointer Y
 * @returns {number} the applied scrollTop delta (0 when idle or at a limit)
 */
function autoscrollTick(host, pointerY) {
  if (!host || typeof pointerY !== 'number') return 0;
  const rect =
    typeof host.getBoundingClientRect === 'function'
      ? host.getBoundingClientRect()
      : null;
  if (!rect || typeof rect.top !== 'number' || typeof rect.bottom !== 'number') {
    return 0;
  }
  let dy = 0;
  if (pointerY < rect.top + AUTOSCROLL_EDGE_PX) {
    dy = -AUTOSCROLL_STEP_PX;
  } else if (pointerY > rect.bottom - AUTOSCROLL_EDGE_PX) {
    dy = AUTOSCROLL_STEP_PX;
  }
  if (dy === 0) return 0;
  const maxScroll =
    typeof host.scrollHeight === 'number' && typeof host.clientHeight === 'number'
      ? Math.max(0, host.scrollHeight - host.clientHeight)
      : 0;
  const current = host.scrollTop || 0;
  const target = Math.min(maxScroll, Math.max(0, current + dy));
  const applied = target - current;
  host.scrollTop = target;
  return applied;
}

/**
 * Starts the 16ms auto-scroll ticker for the current committed drag (AC-S3).
 * Each tick steps the host's scrollTop when the held pointer sits in an edge
 * band, then re-places the ghost at the (stationary) pointer so the snapped
 * content coordinate follows the scroll — the drop lands where the ghost
 * shows, in content space (AC-S4).
 */
function startAutoScroll() {
  if (autoscrollTimer) return;
  if (!state || !state.committed || !state.wrapper) return;
  if (!scrollHostFor(state.wrapper)) return;
  autoscrollTimer = setInterval(() => {
    if (!state || !state.committed || !state.wrapper) {
      stopAutoScroll();
      return;
    }
    const host = scrollHostFor(state.wrapper);
    if (!host) {
      stopAutoScroll();
      return;
    }
    const dy = autoscrollTick(host, state.lastClientY);
    if (dy !== 0 && typeof state.lastClientX === 'number') {
      positionGhost(state.lastClientX, state.lastClientY);
    }
  }, AUTOSCROLL_INTERVAL_MS);
}

/** Stops the auto-scroll ticker. Called from cleanupDrag (drop AND cancel,
 *  AC-S5) so no orphaned interval survives a finished gesture. */
function stopAutoScroll() {
  if (autoscrollTimer) {
    clearInterval(autoscrollTimer);
    autoscrollTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Alignment guide overlay (AC-4: 1px gold hairlines)
// ---------------------------------------------------------------------------

function ensureGuideLayer() {
  if (guideLayer) return guideLayer;
  guideLayer = document.createElement('div');
  guideLayer.className = 'be-drag-guides';
  guideLayer.style.setProperty('position', 'fixed', 'important');
  guideLayer.style.setProperty('inset', '0', 'important');
  guideLayer.style.setProperty('pointer-events', 'none', 'important');
  guideLayer.style.setProperty('z-index', '100001', 'important');
  document.body.appendChild(guideLayer);
  return guideLayer;
}

function removeGuideLayer() {
  if (guideLayer && guideLayer.parentNode) {
    guideLayer.parentNode.removeChild(guideLayer);
  }
  guideLayer = null;
}

/**
 * Position the ghost at a snapped position and render alignment guides.
 * All coordinates passed in client space; placement is done in container
 * space so the drop reuses the very same snapped values (zero release jump).
 * @param {number} clientX
 * @param {number} clientY
 * @param {{rect: DOMRect, container: HTMLElement, containerRect: DOMRect, scale: number}} geo
 */
function placeGhost(clientX, clientY, geo) {
  if (!state || !state.ghost) return;

  // Scroll compensation (AC-S4, track sheet_autoscroll_20260909): when the
  // sheet-internal scrollport is scrolled by S, the stored drop coordinate
  // must be CONTENT-space (client-derived + S) while the ghost itself stays
  // locked to the pointer in CLIENT space (content − S). At S = 0 both terms
  // vanish → placement is byte-identical to the pre-fix behaviour.
  const host = scrollHostFor(state.wrapper);
  const scrollLeft = host ? host.scrollLeft || 0 : 0;
  const scrollTop = host ? host.scrollTop || 0 : 0;

  const csX =
    Math.max(0, (clientX - geo.containerRect.left - state.offsetX) / geo.scale) +
    scrollLeft;
  const csY =
    Math.max(0, (clientY - geo.containerRect.top - state.offsetY) / geo.scale) +
    scrollTop;
  const snap = snapToGrid(csX, csY);
  state.snapLeft = snap.x;
  state.snapTop = snap.y;

  // Ghost is position: fixed → client-space top-left of the snapped cell
  // (the content-space snap minus the scroll offset).
  const left = geo.containerRect.left + (snap.x - scrollLeft) * geo.scale;
  const top = geo.containerRect.top + (snap.y - scrollTop) * geo.scale;
  state.ghost.style.setProperty('left', left + 'px', 'important');
  state.ghost.style.setProperty('top', top + 'px', 'important');

  // Alignment guides against siblings + container.
  const layer = ensureGuideLayer();
  layer.textContent = '';
  const ghostRect = {
    left,
    right: left + state.wrapper.offsetWidth * geo.scale,
    top,
    bottom: top + state.wrapper.offsetHeight * geo.scale,
  };
  const others = Array.from(
    geo.container.querySelectorAll('.be-section-wrapper'),
  )
    .filter((el) => el !== state.wrapper)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });
  const guides = findAlignmentGuides(ghostRect, others, {
    left: geo.containerRect.left,
    right: geo.containerRect.right,
    top: geo.containerRect.top,
    bottom: geo.containerRect.bottom,
  });
  const band = {
    top: geo.containerRect.top,
    bottom: geo.containerRect.bottom,
    left: geo.containerRect.left,
    right: geo.containerRect.right,
  };
  for (const x of guides.v) {
    const line = document.createElement('div');
    line.className = 'be-drag-guide';
    line.style.position = 'absolute';
    line.style.left = Math.round(x) + 'px';
    line.style.top = Math.round(band.top) + 'px';
    line.style.width = '1px';
    line.style.height = Math.max(0, Math.round(band.bottom - band.top)) + 'px';
    line.style.background = '#C6A15B';
    line.style.boxShadow = '0 0 3px rgba(198,161,91,0.9)';
    layer.appendChild(line);
  }
  for (const y of guides.h) {
    const line = document.createElement('div');
    line.className = 'be-drag-guide';
    line.style.position = 'absolute';
    line.style.top = Math.round(y) + 'px';
    line.style.left = Math.round(band.left) + 'px';
    line.style.height = '1px';
    line.style.width = Math.max(0, Math.round(band.right - band.left)) + 'px';
    line.style.background = '#C6A15B';
    line.style.boxShadow = '0 0 3px rgba(198,161,91,0.9)';
    layer.appendChild(line);
  }
}

/**
 * @returns {{rect: DOMRect, container: HTMLElement, containerRect: DOMRect, scale: number}}
 */
function currentGeometry() {
  const container = window.DomManager.getInstance().getLayoutRoot().element;
  const containerRect = container ? container.getBoundingClientRect() : null;
  let scale = 1;
  if (container) {
    const transform = window.getComputedStyle(container).transform;
    if (transform && transform !== 'none') {
      const values = transform.split('(')[1].split(')')[0].split(',');
      scale = parseFloat(values[0]);
    }
  }
  return { container, containerRect, scale };
}

// ---------------------------------------------------------------------------
// Ghost mirroring (visual parity with the pre-rewrite custom ghost)
// ---------------------------------------------------------------------------

function buildGhost(wrapper) {
  const ghost = wrapper.cloneNode(true);
  ghost.classList.add('be-drag-ghost');

  // Force styles for the ghost.
  // IMPORTANT: setProperty with 'important' overrides inherited inline styles
  // from the clone. Ghost is ~opaque with a gold frame (1.8.0 chrome tokens)
  // so it reads as a distinct lifted copy against the bone sheet even when it
  // partially overlaps the dimmed source (visual-gate Phase 1 finding).
  ghost.style.setProperty('position', 'fixed', 'important');
  ghost.style.setProperty('pointer-events', 'none', 'important');
  ghost.style.setProperty('opacity', '0.95', 'important');
  // NOTE (AC-5): left as a literal on purpose. This is a TENTH stacking literal the analysis's
  // F-6 inventory did not list (it counted nine), and js/dnd.js is booted ALONE by five unit
  // harnesses that never evaluate the declaring module, so reaching for the map here would trade a
  // constant for a load-order dependency in those harnesses. Recorded as a finding rather than
  // silently mapped or silently left.
  ghost.style.setProperty('z-index', '100000', 'important');
  ghost.style.setProperty('width', wrapper.offsetWidth + 'px', 'important');
  ghost.style.setProperty('height', wrapper.offsetHeight + 'px', 'important');
  ghost.style.setProperty('margin', '0', 'important');
  ghost.style.setProperty('visibility', 'visible', 'important');
  ghost.style.setProperty('display', 'block', 'important');
  ghost.style.setProperty('border', '2px solid #C6A15B', 'important');

  // Mirror rotation of the source wrapper.
  const rotation = wrapper.dataset.rotation || '0';
  const ghostContainer =
    ghost.querySelector('.be-shape-container') ||
    ghost.querySelector('.print-section-container');
  if (ghostContainer) {
    ghostContainer.style.setProperty(
      'transform',
      `rotate(${rotation}deg)`,
      'important',
    );
  }

  // Remove interactive handles from the ghost.
  const handles = ghost.querySelectorAll(
    '.be-rotation-handle, .print-section-resize-handle',
  );
  handles.forEach((h) => h.remove());

  document.body.appendChild(ghost);
  return ghost;
}

function positionGhost(clientX, clientY) {
  if (!state || !state.ghost) return;
  // Phase 2: live snap + alignment guides (AC-4). Placement is computed in
  // container space and mirrored to the fixed ghost; the drop reuses the
  // exact same snapped values so release causes no jump.
  placeGhost(clientX, clientY, currentGeometry());
}

// ---------------------------------------------------------------------------
// Pointer handlers
// ---------------------------------------------------------------------------

function handlePointerDown(e) {
  // Mouse: primary button only (right-click opens the context menu).
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  const wrapper = e.target && e.target.closest
    ? e.target.closest('.be-section-wrapper')
    : null;
  if (!wrapper) return;

  // Safety: locked layers and interactive content never arm (AC-1).
  if (isElementLocked(wrapper) || isInteractiveTarget(e.target)) return;

  const rect = wrapper.getBoundingClientRect();
  state = {
    wrapper,
    pointerId: e.pointerId ?? 1,
    startX: e.clientX,
    startY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    committed: false,
    // Phase 2: the reversible record for this gesture, produced by the ONE shared protocol. The
    // capture still STARTS here (pointerdown, pristine DOM — see the note below the literal), but
    // the record, its settled value and the repair are the shared ones.
    mut: null,
    // The moved wrapper's geometry and stacking BEFORE the gesture, for the late-capture
    // repair (see handlePointerEnd).
    //
    // This used to claim a drag writes "only these two fields". MEASURED FALSE in a real
    // browser: clicking a section also raises it to the front (`zIndex` -> 700001, a
    // separate click handler that fires between pointerdown and the capture's DOM reads),
    // so an undo restored the position but left the section stacked to the front — an
    // earlier per-class browser run showed exactly that diff (`zIndex: "10"` before,
    // `"700001"` after the undo). zIndex/printZIndex are snapshotted here for the same
    // reason.
    preLeft: wrapper.style.left,
    preTop: wrapper.style.top,
    preZ: wrapper.style.zIndex,
    prePrintZ: wrapper.dataset ? wrapper.dataset.printZ : undefined,
  };
  // Phase 2a (track undo_stack_20260911): begin the reversible capture HERE, on the
  // pristine pre-gesture DOM, and let it settle while the user drags. Starting it at
  // commit instead is a trap: `scanLayout` awaits storage mid-scan and only then reads the
  // rest of the DOM, so a capture started at commit completes AFTER the drop has written
  // — recording the post-drop position. Starting at pointerdown gives the whole gesture
  // for it to finish. A click below the threshold never pushes, so capturing here costs
  // nothing when the gesture turns out not to be a drag.
  if (typeof window.beginMutation === 'function') {
    state.mut = window.beginMutation({
      left: state.preLeft,
      top: state.preTop,
      zIndex: state.preZ,
      printZ: state.prePrintZ,
    });
  }

  // Intentionally do NOT preventDefault here: below the movement threshold
  // the gesture stays a native click/selection (AC-2).
}

function commitDrag(e) {
  const wrapper = state.wrapper;

  // Re-verify the layer is still unlocked at commit time. The interactive-
  // content check happened against the pressed element in handlePointerDown —
  // the move event's target is NOT re-checked (mid-gesture the pointer may
  // legitimately travel over action bars or the document itself).
  if (isElementLocked(wrapper)) {
    abortDrag();
    return false;
  }

  state.committed = true;
  state.ghost = buildGhost(wrapper);

  wrapper.style.opacity = '0.4';
  wrapper.classList.add('dragging');
  document.body.classList.add('be-dragging');
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';

  state.lastClientX = e.clientX;
  state.lastClientY = e.clientY;
  positionGhost(e.clientX, e.clientY);
  startAutoScroll(); // edge-band scrollTop driver while the drag is held
  safeLog('log', '[DDB Print] Drag committed on:', wrapper.id);
  return true;
}

function handlePointerMove(e) {
  if (!state) return;
  const pid = e.pointerId ?? 1;
  if (pid !== state.pointerId) return;

  state.lastClientX = e.clientX;
  state.lastClientY = e.clientY;

  if (!state.committed) {
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      if (!commitDrag(e)) return;
      // Fall through to position this very move.
      positionGhost(e.clientX, e.clientY);
    }
    return;
  }

  e.preventDefault(); // stop native selection from extending mid-drag
  positionGhost(e.clientX, e.clientY);
}

function handlePointerCancel(e) {
  if (!state) return;
  const pid = e.pointerId ?? 1;
  if (pid !== state.pointerId) return;
  // Browser took over the gesture (e.g. scroll): abort WITHOUT applying a
  // drop (AC-7 cleanup on pointerup AND pointercancel).
  abortDrag();
  safeLog('log', '[DDB Print] Pointer drag cancelled');
}

function finalizeDrop() {
  const wrapper = state.wrapper;
  const container = window.DomManager.getInstance().getLayoutRoot().element;
  if (container) {
    // Phase 2 (AC-4): the drop reuses the ghost's last live-snapped values,
    // so the released section lands exactly where the ghost was — zero jump.
    const x = typeof state.snapLeft === 'number' ? state.snapLeft : 0;
    const y = typeof state.snapTop === 'number' ? state.snapTop : 0;
    // snapLeft/snapTop are CONTENT-space (they already include the scrollport
    // offset from placeGhost, AC-S4), so the wrapper lands exactly where the
    // ghost showed even when the sheet was auto-scrolled mid-drag.
    safeLog('log', `[DDB Print] Dropping at: ${x}, ${y}`);
    wrapper.style.setProperty('left', x + 'px', 'important');
    wrapper.style.setProperty('top', y + 'px', 'important');
    // NOTE: no margin mutation here — AC-7 removed the historical
    // `wrapper.style.margin = '0'` side effect on drop.
  } else {
    safeLog('log', '[DDB Print] Drop failed: layout root not found');
  }
}

function cleanupDrag() {
  stopAutoScroll(); // drop AND cancel must stop the ticker (AC-S5)
  if (state) {
    if (state.wrapper) {
      state.wrapper.style.opacity = '1';
      state.wrapper.classList.remove('dragging');
    }
    if (state.ghost && state.ghost.parentNode) {
      state.ghost.parentNode.removeChild(state.ghost);
    }
    state = null;
  }
  removeGuideLayer();
  document.body.classList.remove('be-dragging');
  document.body.style.userSelect = '';
  document.body.style.webkitUserSelect = '';
}

function abortDrag() {
  cleanupDrag();
}

async function handlePointerEnd(e) {
  if (!state) return;
  const pid = e.pointerId ?? 1;
  if (pid !== state.pointerId) return;
  e.preventDefault();

  if (!state.committed) {
    // Below the threshold the gesture never became a drag: drop the candidate
    // state without touching the wrapper (click/selection already happened
    // natively). NOTHING is pushed — this is the no-op guard for the drag class.
    state = null;
    return;
  }

  // Phase 2a: the release path is FULLY SYNCHRONOUS — the ghost is gone the instant the
  // pointer is released, exactly as before this track. Two earlier drafts got this wrong:
  // awaiting the capture before the drop left the ghost in the document (the drag suite
  // caught it), and refusing to record when the capture had not settled made a fast flick
  // silently un-undoable.
  const movedWrapper = state.wrapper;
  const mut = state.mut;

  finalizeDrop(e);
  if (window.updateLayoutBounds) window.updateLayoutBounds();
  scheduleAutosave();
  cleanupDrag();
  notifyLayoutMoved();
  safeLog('log', '[DDB Print] Pointer drag ended');

  if (!mut || typeof window.pushMutation !== 'function') return;

  // THE RECORD IS ALWAYS REPAIRED FROM THE SYNCHRONOUS SNAPSHOT — both branches, not just
  // the late one. Measured why: the capture starts at `pointerdown`, and the product's
  // click-to-front handler runs on `mousedown` (which follows `pointerdown`), raising the
  // wrapper's `zIndex` to 700001 BEFORE the capture's DOM reads finish. So a capture that
  // had already "settled" during the drag could still hold the RAISED stacking, and undo
  // left the section brought to the front (a real browser run showed exactly that diff).
  // Repairing unconditionally makes the record the pre-GESTURE state, which is what an
  // inverse is supposed to restore.
  const label = 'Move ' + undoLabelFor(movedWrapper);
  const id =
    (movedWrapper.querySelector && movedWrapper.querySelector('.print-section-container') || {}).id ||
    movedWrapper.id;
  window.pushMutation(mut, label, window.MUTATION_CLASSES.DRAG, (layout, snap) =>
    patchCapturedPosition(layout, id, snap.left, snap.top, snap.zIndex, snap.printZ));
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initializes pointer-driven drag listeners on the layout wrapper.
 */
function initDragAndDrop() {
  const container = window.DomManager.getInstance().getLayoutRoot().element;
  if (!container) {
    safeLog('log', '[DDB Print] DnD Init Failed: container not found');
    return;
  }
  if (initialized) return;

  container.addEventListener('pointerdown', handlePointerDown);
  // Document-level move/end: the drag keeps tracking anywhere in the page.
  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerEnd);
  document.addEventListener('pointercancel', handlePointerCancel);
  // Precision path: arrow-key nudge of the active wrapper (AC-9).
  document.addEventListener('keydown', handleNudgeKeyDown);

  // Neutralize stray native drags (e.g. images inside wrappers) — the only
  // mover is this pointer engine (AC-1: wrappers are not native drag sources).
  container.addEventListener('dragstart', (e) => {
    if (e.target && e.target.closest && e.target.closest('.be-section-wrapper')) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // THE CENTRED HANDLE (ISSUE_drag_and_drop.md): the sheet may already be
  // populated when the engine boots, so give every existing wrapper its handle
  // now, then keep it true as sections come and go. Both are guarded so a host
  // without a live DOM (unit harness) still gets a working engine.
  syncDragHandles();
  watchDragHandles();

  initialized = true;
  safeLog('log', '[DDB Print] Pointer Drag Engine Initialized on:', container.id);
}

/**
 * Injects necessary styles for the Drag and Drop system.
 * Idempotent — a second call reuses the existing #ddb-print-dnd-style block
 * (encapsulation debt #3 fix, pinned by debt_e1).
 */
function injectDnDStyles() {
  if (document.getElementById('ddb-print-dnd-style')) return;

  const style = document.createElement('style');
  style.id = 'ddb-print-dnd-style';
  style.textContent = `
      .be-section-wrapper {
          touch-action: none; /* pointermove keeps firing during touch drags */
          -webkit-user-drag: none;
      }
      /* Locked layers communicate their state on the cursor (AC-5): no grab
         affordance on locked wrappers — not-allowed instead. */
      body.be-lock-sections .be-section-wrapper,
      body.be-lock-shapes .be-shape-wrapper,
      .be-layer-locked .be-section-wrapper,
      .be-layer-locked .be-shape-wrapper {
          cursor: not-allowed !important;
      }
      .be-section-wrapper.dragging {
          opacity: 0.4 !important;
          /* Origin marker while dragging: honest 'source is here' feedback
             and the contrast the dim alone cannot give on the bone sheet
             (visual-gate Phase 1 finding). Dashed gold, never green. */
          outline: 2px dashed #C6A15B !important;
          outline-offset: 2px !important;
      }
      .be-drag-ghost {
          pointer-events: none !important;
          box-shadow: 0 16px 32px rgba(0,0,0,0.45) !important;
          outline: 1px solid #0C0907 !important;
          outline-offset: 1px !important;
          background-color: rgba(255, 255, 255, 0.98) !important;
      }
      /* While a drag is committed, suppress the section hover glow (green
         drop-shadow) on every wrapper and on the ghost so the gold drag
         feedback is not drowned out (visual-gate Phase 1 finding). */
      html body.be-dragging .be-section-wrapper:hover,
      html body.be-dragging .be-shape-wrapper:hover,
      html body.be-dragging .be-section-wrapper.dragging,
      .be-drag-ghost {
          filter: none !important;
          -webkit-filter: none !important;
      }
      /* Locked wrappers never show the hover glow either: locked = inert,
         no affordance that could read as a drag target (visual-gate
         Phase 2 finding). */
      body.be-lock-sections .be-section-wrapper:hover,
      body.be-lock-shapes .be-shape-wrapper:hover,
      .be-layer-locked .be-section-wrapper:hover,
      .be-layer-locked .be-shape-wrapper:hover {
          filter: none !important;
          -webkit-filter: none !important;
      }

      /* =====================================================================
         THE CENTRED NINE-DOT MOVE HANDLE (ISSUE_drag_and_drop.md)
         =====================================================================
         The owner's words: "There's a 'green' shadow filter displayed when
         hovering a section that's allowed to be dragged and dropped. The UX of
         that is extremely bad, let's replace it for a 'drag area', a '9 points
         button' should be displayed on the center on any section on the ACTIVE
         layer, and the user should be able to drag the section from there."

         So the glow is gone and this is the affordance instead. Three rules
         carry that sentence, and each is stated in ONE place:

           REST        invisible AND untouchable. 'visibility' (not 'opacity')
                       because it takes the node out of the hit-testing AND the
                       accessibility tree at once, so a hidden handle cannot be
                       tabbed to, clicked through, or read out — and unlike
                       'display:none' it still animates, so the reveal is a fade.
                       'opacity' alone would have left a 26px dead square in the
                       middle of every section swallowing clicks on the content
                       beneath it (the exact class of bug the action bars already
                       hit: js/main.js:2513 pins 'pointerEvents = "all"' inline).
           REVEAL      only inside '.be-active-layer', on hover AND on
                       focus-within. Same scope the action bars now use
                       (js/print_styles.js:1060) — one definition of "the layer
                       you're working on", two consumers.
           NEVER       locked layer, locked body-mode, print. A locked section
                       shows 'cursor: not-allowed' above; a grab handle there
                       would contradict it. */
      .be-drag-handle {
          position: absolute !important;
          /* THE CENTRE of the WRAPPER box. Being a direct child of the wrapper
             (not of .print-section-container) is what makes "centred" mean the
             section rather than whatever content it happens to hold, and
             margin:auto + inset:0 does it without knowing either size — no
             transform, so the wrapper's own transforms (responsive scale) stay
             untouched. */
          inset: 0 !important;
          margin: auto !important;
          width: 34px !important;
          height: 26px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          /* Square, not a pill: it reads as a tool handle, matching the tier
             geometry the rest of the chrome uses. */
          border-radius: 4px !important;
          padding: 0 !important;
          background: #0C0907 !important;
          border: 1px solid #4A3E2B !important;
          color: #C6A15B !important;
          /* THE GRAB CURSOR — the sentence's "the user should be able to drag
             the section from there". 'grab' arms, 'grabbing' is the held state
             (the body-level rule below wins while a drag is committed). */
          cursor: grab !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          transition: opacity 0.12s ease-in-out, visibility 0.12s !important;
          /* The handle is chrome, not sheet content: it must sit above the
             section's own text (wrappers stack at z-index 10, action bars at 20)
             and above the wrapper the hover raised to 700000 — hence above that.

             IT MUST ALSO WIN THE PIXEL IT IS REVEALED FOR, and that ordering is the
             whole of ISSUE_grip_covered_by_actions_bar_on_small_sections_20260914.md.
             The action bar is built with an INLINE z-index: 1000000 (js/main.js
             getOrCreateActionContainer, reading ACTIONS_BAR from the ONE map in
             js/section_utils.js) and is anchored at
             top: 8px; left: 8px with 39x32 buttons, so on a section short enough for
             that band to reach the vertical centre the bar's buttons landed ON the
             grip's own pixel — and they become hittable at exactly the moment the
             grip is revealed, so the two affordances the user is shown at the same
             instant fought over the same ~26x26px. MEASURED on the live demo sheet
             (1920x1080, decorative layers hidden through their own control):
             section-extra-tidbits-wrapper (151.5x62px) reported
             BUTTON|be-select-section-button at the grip's centre — "drag from the
             centre" silently degraded to "drag from the lower edge". 700002 < 1000000
             is the whole cause.

             THE FIX MOVED THE BAR, NOT THIS NUMBER (operator chose option 3: the bar
             yields while the grip is revealed). js/print_styles.js drops the bar to
             700001 on the SAME hover that reveals this handle, so the order is
             hovered wrapper 700000 < bar 700001 < grip 700002, both controls stay
             fully usable, and the grip never has to be pushed off centre or cover a
             button. This file stays the single owner of the grip's level; the bar's
             yielded level and its reason live with the bar. */
          z-index: 700002 !important;
          /* No box-shadow, and that is deliberate (ISSUE_shadows.md): the whole
             complaint about the old affordance was a *shadow filter* painted over
             the section. A drop-shadow here would re-introduce the same class of
             artifact at the centre of the page. */
          box-shadow: none !important;
          filter: none !important;
          line-height: 0 !important;
      }
      .be-drag-handle svg {
          display: block;
          pointer-events: none;
      }

      /* REVEAL: active layer only, on hover or keyboard focus. */
      .be-active-layer .be-section-wrapper:hover .be-drag-handle,
      .be-active-layer .be-shape-wrapper:hover .be-drag-handle,
      .be-active-layer .be-section-wrapper:focus-within .be-drag-handle,
      .be-active-layer .be-shape-wrapper:focus-within .be-drag-handle {
          visibility: visible !important;
          opacity: 1 !important;
          /* The one place the handle is clickable. 'auto' (not 'all'): it is not
             a stacking-context question, and 'auto' keeps the hit-test on the
             normal path so the pointerdown reaches the delegated drag engine. */
          pointer-events: auto !important;
      }

      /* NEVER: locked layers and locked body modes. Listed explicitly rather
         than left to the rest state because a locked wrapper can still be
         :hover and still contain focus; the ':not()' form would need one guard on
         every arm above instead of one block here. */
      body.be-lock-sections .be-drag-handle,
      body.be-lock-shapes .be-drag-handle,
      .be-layer-locked .be-drag-handle {
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
      }

      /* HELD STATE: while a drag is committed, the handle goes away.
         The source wrapper is STILL :hover under the pointer, so without this
         its handle rides along in the middle of the dimmed source — one grip
         left behind on a section that is already being carried. The cursor fact
         is stated here too, so "grab arms / grab holds" lives in one block.

         THE SELECTOR LIST IS NOT COSMETIC. The reveal rule above is
         .be-active-layer .be-section-wrapper:hover .be-drag-handle — four
         class-level selectors, specificity (0,4,0) — and BOTH rules are
         !important, so a shorter held-state rule loses the cascade and the
         handle simply stays visible: html body.be-dragging .be-drag-handle is
         (0,2,2) and even html body.be-dragging .be-section-wrapper
         .be-drag-handle is (0,3,2). Each arm below therefore repeats the
         reveal rule's own class chain and ADDS body.be-dragging, giving
         (0,5,2) — the reveal it overrides, plus one. The ghost needs no arm: it
         is appended to document.body, so no .be-active-layer ancestor matches
         it and the base hidden state already applies to its cloned handle. */
      html body.be-dragging .be-active-layer .be-section-wrapper:hover .be-drag-handle,
      html body.be-dragging .be-active-layer .be-shape-wrapper:hover .be-drag-handle,
      html body.be-dragging .be-active-layer .be-section-wrapper:focus-within .be-drag-handle,
      html body.be-dragging .be-active-layer .be-shape-wrapper:focus-within .be-drag-handle {
          cursor: grabbing !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
      }

      /* Print: never on the page. Also carried by the sheet's own print hide
         list (js/print_styles.js) — belt and braces, because this stylesheet is
         injected by dnd.js and a page that skips it must still not print the
         handle. */
      @media print {
          .be-drag-handle {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
          }
      }
  `;
  document.head.appendChild(style);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initDragAndDrop,
    injectDnDStyles,
    DRAG_THRESHOLD,
    GRID_STEP,
    ALIGN_TOLERANCE,
    AUTOSCROLL_EDGE_PX,
    AUTOSCROLL_STEP_PX,
    AUTOSCROLL_INTERVAL_MS,
    autoscrollTick,
    startAutoScroll,
    stopAutoScroll,
    isElementLocked,
    isInteractiveTarget,
    isDragHandle,
    ensureDragHandle,
    syncDragHandles,
    watchDragHandles,
    snapToGrid,
    findAlignmentGuides,
    scheduleAutosave,
    AUTOSAVE_DEBOUNCE_MS,
    nudgeActiveWrapper,
    notifyLayoutMoved,
  };
} else {
  window.initDragAndDrop = initDragAndDrop;
  window.injectDnDStyles = injectDnDStyles;
  /* The handle helpers (isDragHandle / ensureDragHandle / syncDragHandles /
     watchDragHandles) are deliberately NOT published on `window`: the drag
     engine consumes them itself (initDragAndDrop), the unit suite reaches them
     through module.exports, and this module's own predicates
     (isElementLocked, isInteractiveTarget) follow the same rule. Four
     zero-caller globals is exactly the re-rot the dead_exports_20260910 guard
     exists to refuse. */
  window.snapToGrid = snapToGrid;
  window.findAlignmentGuides = findAlignmentGuides;
  window.scheduleAutosave = scheduleAutosave;
  window.pauseAutosave = pauseAutosave;
  window.resumeAutosave = resumeAutosave;
  window.isAutosavePaused = isAutosavePaused;
  window.nudgeActiveWrapper = nudgeActiveWrapper;
  window.notifyLayoutMoved = notifyLayoutMoved;
  window.autoscrollTick = autoscrollTick;
  window.startAutoScroll = startAutoScroll;
  window.stopAutoScroll = stopAutoScroll;
}
