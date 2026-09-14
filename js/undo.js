/**
 * The undo stack and the capture-and-push protocol (track refactor_surface_20260911, AC-4).
 *
 * WHY THIS MODULE EXISTS. `js/persistence.js` owned four unrelated concerns in 1,583 lines: the
 * IndexedDB backup store, the undo stack, the restore UI and the destructive gate. This file is
 * the MOVE of the second one out of it — no behaviour change, and the proof is the pre-existing
 * suites passing UNEDITED (AC-9) rather than a new test asserting the new shape.
 *
 * WHAT LIVES HERE: the bounded stack; the capture-and-push protocol (`captureUndo` for a site
 * that can await, `beginMutation`/`pushMutation` for a site whose caller asserts synchronously);
 * the mutation-class VOCABULARY (the frozen `MUTATION_CLASSES` map AC-3 declares once); the label
 * helpers; the keyboard binding; the late-capture repair primitives; and the record lifecycle
 * (offer / clear / peek / apply).
 *
 * SEAMS: every `window.*` name below is the name `js/persistence.js` used to publish. The split
 * MOVED the assignment; it renamed nothing. Cross-module calls resolve through `window.*` at CALL
 * time, which is what lets the whole split work without a boot order.
 */

/**
 * Module-local logger fallback, the same shape `js/dnd.js` carries: `window.safeLog` when the
 * logger has loaded (js/main.js is evaluated LAST), a `console` bridge otherwise. Phase 5 of
 * this track consolidates the logger shapes under AC-5; until then a module must not reach
 * across for it, because a seam read at LOAD time would be undefined.
 */
// WHY THE LOGGER IS MODULE-LOCAL AND UNIQUELY NAMED: a content script's top level shares ONE
// global scope across the injected files, so a second `const _safeLog` in a sibling module is
// a redeclaration error that kills the whole boot (measured in a real browser: "Identifier
// '_safeLog' has already been declared", and the layout never appeared). Phase 5 (AC-5)
// consolidates the logger shapes; until then each module names its own.
/** O-1 (ratified): the in-session depth bound. Oldest evicted FIFO. */
const UNDO_STACK_MAX = 25;

/**
 * THE MUTATION-CLASS VOCABULARY, DECLARED ONCE (track refactor_surface_20260911, AC-3).
 *
 * WHY IT EXISTS: the vocabulary used to be bare literals at 22 call sites whose only complete list
 * lived in an ARCHIVED track document, so a misspelt tag was indistinguishable from a new class.
 * It was transcribed wrong TWICE in one session (11, then 13; measured 14) — both times by
 * enumerating a word list instead of extracting the call sites — which is why
 * `scripts/inventory_mutation_tags.py` exists and why the guard test asserts THIS map still matches
 * that extractor's output.
 *
 * The keys are this declaration's identifiers and the values are the tags the pushed records carry;
 * every push site writes `window.MUTATION_CLASSES.<KEY>`, so AC-3's fail condition ("any tag literal
 * exists outside the declaration") is a source-scan finding rather than a reading exercise.
 * `UNKNOWN` is DECLARED rather than defaulted into: it is the value a record gets when no class was
 * supplied at all, and it is the one member no site pushes.
 */
const MUTATION_CLASSES = Object.freeze({
  ASSET: "asset",
  BORDER: "border",
  COMPACT: "compact",
  DESTRUCTIVE: "destructive",
  DRAG: "drag",
  LAYER_FLAG: "layer-flag",
  NUDGE: "nudge",
  POSITION: "position",
  RENAME: "rename",
  REPARENT: "reparent",
  RESIZE: "resize",
  RESTACK: "restack",
  ROTATE: "rotate",
  STRUCTURAL: "structural",
  UNKNOWN: "unknown",
});

/** The declared tag VALUES — the membership test `resolveMutationClass` uses. */
const MUTATION_CLASS_VALUES = Object.freeze(Object.values(MUTATION_CLASSES));

/**
 * Resolve a class tag against the declaration, LOUDLY (AC-3): "a tag that is not in it is rejected
 * in test mode and reported (not silently defaulted) in production".
 *
 * The previous behaviour was `klass || "unknown"`, which made a typo indistinguishable from a class
 * that was never declared — and because that default was UNREACHABLE in the suite, a regression to
 * it could not fail anything.
 */
function resolveMutationClass(klass) {
  if (klass && MUTATION_CLASS_VALUES.indexOf(klass) !== -1) return klass;
  // ABSENT is not the same as UNDECLARED, and the difference is the whole point: a caller that
  // supplies no class at all gets the DECLARED `UNKNOWN` (no longer a silent literal default),
  // while a caller that supplies a tag the vocabulary does not contain is a defect to be surfaced.
  if (klass === undefined || klass === null || klass === "") return MUTATION_CLASSES.UNKNOWN;
  const message =
    "[DDB Print] Undeclared mutation class " + String(klass) + " — declare it in MUTATION_CLASSES or fix the tag";
  if (window.__DDB_TEST_MODE__) {
    // REJECTED, not coerced: a suite must never be able to push a class the vocabulary does not
    // declare, which is what makes AC-3's "ignoring an arbitrary tag still yields a passing suite"
    // fail condition unreachable.
    throw new Error(message);
  }
  window.safeLog?.("error", message);
  return MUTATION_CLASSES.UNKNOWN;
}


/** The stack. Session-scoped (O-2) — deliberately NOT serialized with the layout. */
let undoStack = [];

/**
 * Capture the LIVE layout — the trust primitive's semantics change AC-6 owns.
 *
 * `createBackupSnapshot` records the layout as last SAVED, so undoing through it also
 * reverted edits made since the last save. This reads the live DOM through the same
 * serializer the autosave path uses.
 *
 * Returns the layout, or `null` when the serializer is unavailable (a bare harness) —
 * the caller decides, and `pushUndo` refuses rather than recording a phantom.
 */
async function captureLiveLayout() {
  try {
    if (typeof window.scanLayout !== "function") return null;
    return await window.scanLayout();
  } catch (err) {
    window.safeLog?.("error", "[DDB Print] Live layout capture failed", err);
    return null;
  }
}

/**
 * Push a reversible record. Returns the entry, or null when there is nothing to record.
 *
 * `before` MUST be the live layout captured BEFORE the mutation; `klass` tags the
 * mutation class (contract.md §2.1 C) so a failure names its class rather than a phase.
 */
function pushUndo(before, label, klass) {
  if (!before) return null;
  // AC-3: the class is RESOLVED against the declaration, never defaulted into silently.
  const entry = {
    before,
    label: label || "change",
    at: Date.now(),
    class: resolveMutationClass(klass),
  };
  undoStack.push(entry);
  // Bounded (O-1): evict the OLDEST, and only ever this collection — the 3-deep
  // MAX_BACKUPS FIFO lives in IndexedDB under a different key space and is never
  // touched from here (O-4: both are kept, and they cannot prune each other).
  while (undoStack.length > UNDO_STACK_MAX) undoStack.shift();
  notifyUndoStackChanged();
  return entry;
}

/** The next thing an undo would revert, or null. */
function peekUndo() {
  return undoStack.length ? undoStack[undoStack.length - 1] : null;
}

/**
 * Capture the live layout and push it, in one call — the entry point every Phase 2
 * mutation site uses.
 *
 * MUST be awaited BEFORE the mutation commits. `scanLayout` awaits storage mid-scan and
 * only then reads the rest of the DOM, so a capture left in flight across a mutation
 * would straddle it and record a torn snapshot; awaiting it first is what makes the
 * record the true pre-state. A site that cannot await before mutating (the drag engine,
 * whose commit is a synchronous pointer event) starts the capture at commit time and
 * awaits it before the DOM is actually mutated — see `js/dnd.js`.
 */
async function captureUndo(label, klass) {
  const before = await captureLiveLayout();
  return pushUndo(before, label, klass);
}

/**
 * AC-8 (track undo_stack_20260911): the affordance's LABEL, read from the stack top.
 *
 * "Undo" alone does not say what will happen. The label names the action AND its subject
 * ("Move Main"), and is null when there is nothing to undo — so a control can disable
 * itself rather than offering an undo that would do nothing.
 */
function undoLabel() {
  const top = peekUndo();
  return top ? top.label : null;
}

/**
 * How many characters the undo control can show before the panel ellipsizes them.
 *
 * MEASURED, not guessed (AC-V1 round 1): the control is 205px of usable text at the panel's
 * label font, which fits ~28 characters; `Undo: Toggle compact mode for "Actions"` (38) was
 * rendered as `Undo: Toggle compact mo...` — the SUBJECT was cut off entirely, so the
 * affordance did not actually name what it would undo. The gate failed on exactly that.
 */
// Deliberately NOT exported: nothing outside this module needs the number, and the re-rot
// guard is right that a seam with no reader is surface that rots.
const UNDO_LABEL_MAX = 24;  // ~22 chars fit the panel; measured, see the docblock above

/**
 * The label the control can actually DISPLAY.
 *
 * Shortens the SUBJECT at a word boundary (never mid-word, which is what read as "broken"),
 * and only when the full string would not fit. The full text always survives in the
 * control's `title` and `aria-label`, so nothing is lost to a screen reader or a hover —
 * but the visible default state still names the action AND a recognisable subject rather
 * than showing an ellipsis where the meaning should be.
 */
function undoScreenLabel(full) {
  if (!full) return full;
  // The "Undo: " prefix STAYS. An intermediate draft dropped it to buy width for the verb,
  // and the AC-V1 gate rejected that for a reason I had not anticipated: the reviewer read
  // the control as `Toggle "Actions"` and did not recognise it as an UNDO affordance at all
  // — "Zero instances of the string Undo: in the entire frame". A control that must be
  // inferred from its icon is not discoverable, so the prefix earns its six characters and
  // the SUBJECT is what gets shortened instead.
  const body = String(full);
  if (body.length <= UNDO_LABEL_MAX) return body;
  const cut = body.slice(0, UNDO_LABEL_MAX + 1);
  const at = cut.lastIndexOf(" ");
  const head = at > 0 ? cut.slice(0, at) : body.slice(0, UNDO_LABEL_MAX);
  return head + "…";
}

/** Tell the UI the stack changed, so a control can re-label itself. */
function notifyUndoStackChanged() {
  try {
    if (typeof window !== "undefined" && window.dispatchEvent && window.CustomEvent) {
      window.dispatchEvent(new window.CustomEvent("be-undo-stack-changed"));
    }
  } catch {
    /* a bare harness has no CustomEvent; the label simply stays as it was */
  }
}

/**
 * True when the event target is a place text is being typed, so Ctrl/Cmd+Z must keep its
 * NATIVE meaning there. Checked against the event target AND the live activeElement,
 * because a keydown can be dispatched on the document while an input holds focus.
 */
function isTextEntryTarget(el) {
  if (!el) return false;
  const tag = String(el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  // BOTH signals, because neither is universal: `isContentEditable` is the correct API but
  // is NOT implemented everywhere the extension runs (measured: jsdom returns undefined for
  // a div with contenteditable="true", so a guard resting on it alone let Ctrl+Z revert the
  // whole layout while the user was editing text), and the attribute is what actually
  // declares the region.
  if (el.isContentEditable === true) return true;
  const attr = el.getAttribute ? el.getAttribute("contenteditable") : null;
  return attr === "" || attr === "true";
}

let _undoShortcutDoc = null;

/**
 * AC-8: bind Ctrl/Cmd+Z to the stack.
 *
 * Inert while a text field has focus (a user undoing their typing must get the browser's
 * undo, not a layout revert), and a no-op when the stack is empty — so the binding never
 * claims an action it cannot perform. Returns an unbind function, so a caller (and a test)
 * can tear it down and the listener lifecycle stays observable.
 */
function installUndoShortcut(doc) {
  const target = doc || (typeof document !== "undefined" ? document : null);
  if (!target || typeof target.addEventListener !== "function") return null;
  if (_undoShortcutDoc === target) return null; // never double-bind
  const onKeyDown = (e) => {
    const key = String(e.key || "").toLowerCase();
    if (key !== "z") return;
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.shiftKey || e.altKey) return; // Ctrl+Shift+Z / Ctrl+Alt+Z are not this undo
    if (isTextEntryTarget(e.target) || isTextEntryTarget(target.activeElement)) return;
    if (!canUndo()) return;
    e.preventDefault();
    applyUndo();
  };
  target.addEventListener("keydown", onKeyDown, true);
  _undoShortcutDoc = target;
  const off = () => {
    target.removeEventListener("keydown", onKeyDown, true);
    if (_undoShortcutDoc === target) _undoShortcutDoc = null;
  };
  return off;
}

/**
 * Overwrite fields on ONE element of a captured layout, keyed by the element's id.
 *
 * WHY THIS EXISTS (track undo_stack_20260911, Phase 2): a mutation's capture is
 * asynchronous (`scanLayout` awaits storage mid-scan and only then reads the rest of the
 * DOM), so a capture taken during a gesture can finish its DOM reads AFTER the gesture's
 * writes land. Deferring the gesture's own DOM work until the capture settles is not an
 * option — it changes shipped interaction semantics (the drag ghost lingered past
 * pointerup, which the drag suite caught) — so the RECORD is repaired with values saved
 * synchronously at gesture start instead.
 *
 * The repair is only ever used to put BACK a value the class itself is about to change, so
 * it cannot overreach: callers pass the exact fields their class mutates.
 *
 * `sections` is keyed BY the id and carries no `id` field of its own — matching on
 * `entry.id` there silently matches nothing (a first draft did exactly that, and a probe
 * caught the record coming back unpatched).
 */
function patchCapturedFields(layout, id, fields) {
  if (!layout || !id || !fields) return layout;
  const put = (entry) => {
    if (!entry) return false;
    Object.keys(fields).forEach((k) => {
      entry[k] = fields[k];
    });
    return true;
  };
  const byId = (entry) => (entry && entry.id === id ? put(entry) : false);
  let hit = false;
  if (layout.sections && layout.sections[id]) {
    if (put(layout.sections[id])) hit = true;
  }
  for (const key of ["clones", "extractions", "shapes", "spell_details"]) {
    if (Array.isArray(layout[key])) {
      layout[key].forEach((e) => {
        if (byId(e)) hit = true;
      });
    }
  }
  if (Array.isArray(layout.shapeLayers)) {
    layout.shapeLayers.forEach((layer) => {
      if (Array.isArray(layer.elements)) {
        layer.elements.forEach((e) => {
          if (byId(e)) hit = true;
        });
      }
    });
  }
  if (!hit) window.safeLog?.("log",
    "[DDB Print] Undo capture could not be repaired for id " + id);
  return layout;
}

/**
 * Begin a reversible record WITHOUT deferring the mutation (track undo_stack_20260911).
 *
 * WHY THIS EXISTS ALONGSIDE `captureUndo`: `captureUndo` awaits the scan before mutating,
 * which is exact and simple — but it changes WHEN the DOM changes, and callers that assert
 * immediately after a click observe that (measured: three border-picker cases and the
 * in-sheet compact toggle went red when those sites used it). So a site whose caller may
 * assert synchronously uses this instead: the capture is STARTED here, the caller mutates
 * synchronously, and `pushMutation` pushes afterwards — repairing the record from a
 * synchronous snapshot when the scan finished its DOM reads too late.
 *
 * `snap` is whatever the caller can read synchronously before mutating.
 */
function beginMutation(snap) {
  const mut = { snap, settled: undefined, capture: null };
  if (typeof window.scanLayout === "function") {
    mut.capture = captureLiveLayout();
    mut.capture
      .then((layout) => {
        mut.settled = layout;
      })
      .catch(() => {
        /* a failed capture yields no record rather than a wrong one */
      });
  }
  return mut;
}

/** Push `beginMutation`'s record; `repair(layout, snap)` fixes one that settled late. */
function pushMutation(mut, label, klass, repair) {
  if (!mut || typeof window.pushUndo !== "function") return;
  if (mut.settled) {
    // THE SETTLED BRANCH REPAIRS TOO — a MEASURED correction, not tidiness (track
    // refactor_surface_20260911, Phase 1). `settled` means the capture FINISHED, not that its
    // DOM reads landed before the mutation: `scanLayout` awaits storage mid-scan and only
    // then walks the DOM (`js/layout_scan.js:112-122`), so a capture that settles during the
    // gesture can still read the POST-mutation value. Pushing it raw is the defect F-9 named,
    // and it is why resize/nudge/drag went AROUND this helper instead of using it. Measured
    // with the storage await held open across the mutation (the settled snapshot holds the
    // POST value) in `test/unit/undo_stack_adversarial.test.js` §1; and falsified the other
    // way too — routing the real resize site through this helper BEFORE this repair existed
    // lost its repair (recorded width 288px instead of the pre-resize 200px).
    if (repair) repair(mut.settled, mut.snap);
    window.pushUndo(mut.settled, label, klass);
    return;
  }
  if (!mut.capture) return;
  mut.capture
    .then((layout) => {
      if (!layout) return;
      if (repair) repair(layout, mut.snap);
      window.pushUndo(layout, label, klass);
    })
    .catch(() => {
      /* no record is better than a wrong one */
    });
}

/**
 * The per-section PERSISTED class flags, read synchronously: `compact` and `borderStyle`
 * are both derived from the section's classList by `scanLayout`, and both are mutated by a
 * single click whose caller asserts immediately — hence the snapshot+repair path.
 */
function snapshotSectionFlags() {
  const map = {};
  document.querySelectorAll(".print-section-container").forEach((el) => {
    if (!el.id) return;
    map[el.id] = {
      compact: el.classList.contains("be-compact-mode"),
      borderStyle:
        ((window.AssetCatalog && window.AssetCatalog.ALL_BORDER_STYLES) || [])
          .find((style) => el.classList.contains(style)) || null,
    };
  });
  return map;
}

/** Put `snapshotSectionFlags` back into a captured layout. */
function repairSectionFlags(layout, snap) {
  if (!layout || !snap) return layout;
  const put = (entry, id) => {
    if (!entry || !snap[id]) return;
    entry.compact = snap[id].compact;
    entry.borderStyle = snap[id].borderStyle;
  };
  Object.keys(layout.sections || {}).forEach((id) => put(layout.sections[id], id));
  ["clones", "extractions"].forEach((key) => {
    (layout[key] || []).forEach((e) => put(e, e.id));
  });
  return layout;
}

/**
 * The pre-mutation geometry of one container, read SYNCHRONOUSLY.
 *
 * `innerWidths` mirrors `scanLayout`'s own keying (`cIdx-dIdx` over
 * `div[class$="-row-header"], div[class$="-content"]`) so a repaired record is
 * indistinguishable from a scanned one — which the resize case asserts.
 */
function snapshotContainerGeometry(section) {
  // The WRAPPER carries the stacking the scan records (`zIndex` inline style,
  // `printZIndex` dataset), while the CONTAINER carries the size — so both are read here.
  // Stacking is included because the product's click-to-front handler runs on `mousedown`
  // (after the capture starts), so a capture can hold the RAISED z-index and an undo would
  // then leave the element brought to the front (measured in a real browser, for the drag
  // class; the resize has the same shape).
  const wrapper = (section.closest && section.closest(".be-section-wrapper")) || section;
  const geom = {
    width: section.style.width,
    height: section.style.height,
    zIndex: wrapper.style ? wrapper.style.zIndex : undefined,
    printZIndex: wrapper.dataset ? wrapper.dataset.printZ : undefined,
    innerWidths: {},
  };
  const innerContainers = section.querySelectorAll(
    'div[class$="-row-header"], div[class$="-content"]',
  );
  innerContainers.forEach((container, cIdx) => {
    Array.from(container.children).forEach((child, dIdx) => {
      if (child.tagName === "DIV" && child.style.width) {
        geom.innerWidths[`${cIdx}-${dIdx}`] = child.style.width;
      }
    });
  });
  return geom;
}

/** How many reversible mutations are on the stack (the bound's observable). */
function undoDepth() {
  return undoStack.length;
}

/** Drop every entry (a new session starts empty; tests and Reset read this). */
function clearUndoStack() {
  const n = undoStack.length;
  undoStack = [];
  return n;
}

/** The one live TOAST offer — a VIEW of the stack top, never its owner.
 *
 * There is deliberately no undo STATE kept here. The stack above is the only undo
 * mechanism; this variable holds the toast handle and nothing else. It is named
 * `_undoToast` rather than after the slot it replaced because AC-5 ("converge, do not
 * coexist") is asserted by a source search for the OLD identifier, and that search is
 * only meaningful if the old name appears nowhere in the tree. */
let _undoToast = null;

/**
 * Offer the one-control undo for the destructive action that just completed, and PUSH
 * the reversible record onto the stack.
 *
 * The previous version cleared the slot here. It does not any more: a second mutation
 * must not make the first un-undoable (AC-4, and the direct regression of U-1). Only the
 * TOAST is replaced, because there is one surface; the RECORD stays walkable.
 *
 * `record` is the gate's record, which carries `liveBefore` (captured by
 * `gateDestructive` BEFORE the caller mutated) — the live-layout source AC-6 requires.
 */
function offerUndo(record, label, opts) {
  if (!record) return null;
  const before = record.liveBefore || record.layout || null;
  pushUndo(before, label, (opts && opts.class) || record.class || window.MUTATION_CLASSES.DESTRUCTIVE);
  // Replace the TOAST only (one surface); the stack keeps every record.
  clearUndoOffer("superseded");
  const modals = window.Modals;
  if (!modals || typeof modals.showUndoToast !== "function") return null;
  const state = { label, offer: null };
  _undoToast = state;
  state.offer = modals.showUndoToast(label, () => applyUndo(), {
    // The lifetime is a documented RULE, so it is forwarded rather than hard-coded
    // here: the surface owns the default, a caller may shorten it (tests, captures).
    ms: opts && typeof opts.ms === "number" ? opts.ms : undefined,
    onExpire: (reason) => {
      if (_undoToast === state) _undoToast = null;
      window.safeLog?.("log", "[DDB Print] Undo offer closed (" + reason + ")");
    },
  });
  return state.offer;
}

/**
 * Close the current TOAST without acting on it. The stack is deliberately untouched:
 * the offer expiring is a UI event, not a loss of the ability to undo (that was the
 * single-level slot's failure mode).
 */
function clearUndoOffer(reason) {
  const state = _undoToast;
  _undoToast = null;
  if (state && state.offer) state.offer.close(reason || "cleared");
  return Boolean(state);
}

/** True while an undo is OFFERED on screen (the render path and the tests read this). */
function hasUndoOffer() {
  return Boolean(_undoToast && _undoToast.offer && _undoToast.offer.isLive());
}

/** True while there is anything to undo (the stack, which outlives the toast). */
function canUndo() {
  return undoStack.length > 0;
}

/**
 * Invoke the undo: pop the stack and re-apply the recorded live layout.
 *
 * Returns the restore result, so a caller can tell "nothing to undo" apart from "the
 * restore failed". Idempotent in the sense the contract requires (§2.1 D): calling it
 * with an empty stack changes nothing and reports `none`.
 */
async function applyUndo() {
  _undoToast = null;
  const entry = undoStack.pop();
  if (!entry) return { ok: false, reason: "none", message: "there is no undo to apply" };
  if (typeof window.applyLayout !== "function") {
    // Put it back: a failed restore must not silently consume the record.
    undoStack.push(entry);
    return { ok: false, reason: "unavailable", message: "the restore path is unavailable" };
  }
  let res;
  try {
    await window.applyLayout(entry.before);
    res = { ok: true };
  } catch (err) {
    undoStack.push(entry); // same reason: the record survives a failed restore
    window.safeLog?.("error", "[DDB Print] Undo failed", err);
    res = { ok: false, reason: "apply", message: String((err && err.message) || err) };
  }
  if (window.showFeedback) {
    if (res.ok) window.showFeedback("Undid: " + entry.label, "success");
    else window.showFeedback("Could not undo - " + res.message + ".", "error");
  }
  return res;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    pushUndo, peekUndo, captureUndo, undoLabel, undoScreenLabel, installUndoShortcut,
    isTextEntryTarget, beginMutation, pushMutation, snapshotSectionFlags, repairSectionFlags,
    patchCapturedFields, snapshotContainerGeometry, undoDepth, clearUndoStack, canUndo,
    captureLiveLayout, offerUndo, clearUndoOffer, hasUndoOffer, applyUndo,
    UNDO_STACK_MAX, MUTATION_CLASSES,
  };
}
if (typeof window !== "undefined") {
  // Resolved at CALL time by the mutation sites and by the capture points, matching the codebase
  // seam convention. Deliberately ONE function per name with no convenience namespace object on
  // top: a second way to reach the same thing is surface without a reader.
  window.pushUndo = pushUndo;
  window.peekUndo = peekUndo;
  window.captureUndo = captureUndo;
  window.undoLabel = undoLabel;
  window.undoScreenLabel = undoScreenLabel;
  window.installUndoShortcut = installUndoShortcut;
  window.isTextEntryTarget = isTextEntryTarget;
  window.beginMutation = beginMutation;
  window.pushMutation = pushMutation;
  window.snapshotSectionFlags = snapshotSectionFlags;
  window.repairSectionFlags = repairSectionFlags;
  window.patchCapturedFields = patchCapturedFields;
  window.snapshotContainerGeometry = snapshotContainerGeometry;
  window.undoDepth = undoDepth;
  window.clearUndoStack = clearUndoStack;
  window.canUndo = canUndo;
  window.captureLiveLayout = captureLiveLayout;
  window.offerUndo = offerUndo;
  window.clearUndoOffer = clearUndoOffer;
  window.hasUndoOffer = hasUndoOffer;
  window.applyUndo = applyUndo;
  // Test seam: the O-1 depth bound is asserted by test/unit/undo_stack.test.js, which reads it
  // here rather than re-declaring 25.
  window.UNDO_STACK_MAX = UNDO_STACK_MAX;
  // AC-3: the ONE declaration of the mutation-class vocabulary (frozen), kept as a seam because
  // six modules evaluated BEFORE this one push through it.
  window.MUTATION_CLASSES = MUTATION_CLASSES;
}