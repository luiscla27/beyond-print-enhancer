/**
 * Reusable listener-leak instrumentation (track modal_primitive_20260910, AC-6).
 *
 * WHY THIS EXISTS AS A HELPER
 * A listener leak is invisible to behaviour tests: a second `resolve()` on a
 * settled promise is a silent no-op, and a detached button simply never gets
 * clicked again. The 1.11.3 fix learned that the hard way — it had to instrument
 * the listener registry to prove the slider dialog leaked, and that test
 * correctly failed against the pre-fix code. The consultant's stated failure
 * mode for a half-migrated dialog system is exactly "leaks listeners on every
 * surface", so this technique is generalized here and every in-scope dialog is
 * checked the same way.
 *
 * WHAT IS INSTRUMENTED, AND WHY BOTH LEVELS
 *  - `window` and `document`: a dialog's Esc / focus-trap listener belongs on
 *    `document` (so the trap holds when focus escapes), while older code used
 *    `window`. Counting only one silently misses a leak on the other — which is
 *    exactly how the first version of this test was wrong.
 *  - element-level, via `Element.prototype`: the primitive also attaches click
 *    handlers to the overlay, the close button and the dialog's own action
 *    buttons. Instrumenting only document/window would report a clean net-zero
 *    while saying nothing about those. (The overlay is removed from the DOM on
 *    close, so those handlers are collectable in principle — but "collectable in
 *    principle" is the kind of claim that hid the original leak, so they are
 *    counted rather than assumed.)
 */

"use strict";

/**
 * Wrap add/removeEventListener on the given targets and on Element.prototype,
 * and record what is currently attached.
 *
 * @param {object} win  the jsdom window to instrument
 * @param {{elements?: boolean}} [opts]  elements:false skips Element.prototype
 * @returns {{ snapshot: () => object, total: () => number, restore: () => void }}
 */
function instrumentListeners(win, opts) {
  const withElements = !opts || opts.elements !== false;
  const targets = [win, win.document].filter(Boolean);
  // Map<key, Map<type, Set<handler>>>; key is "window" | "document" | "element"
  const live = new Map();
  const originals = [];
  const elemCount = new Map();

  const bucket = (key, type) => {
    if (!live.has(key)) live.set(key, new Map());
    const byType = live.get(key);
    if (!byType.has(type)) byType.set(type, new Set());
    return byType.get(type);
  };

  const wrap = (owner, key) => {
    const realAdd = owner.addEventListener;
    const realRemove = owner.removeEventListener;
    originals.push({ owner, realAdd, realRemove });
    owner.addEventListener = function (type, fn, options) {
      if (fn) {
        bucket(key, type).add(fn);
        // Remember WHICH element carries a handler, with a count, so a residual
        // handler can be judged by whether its element is still in the document.
        // (Element-level handlers on a detached node are collectable, so they are
        // not a leak — but that is a claim to verify, not assume.)
        if (key === "element") elemCount.set(this, (elemCount.get(this) || 0) + 1);
      }
      return realAdd.call(this, type, fn, options);
    };
    owner.removeEventListener = function (type, fn, options) {
      if (fn && bucket(key, type).has(fn)) {
        bucket(key, type).delete(fn);
        if (key === "element") {
          const n = (elemCount.get(this) || 0) - 1;
          if (n <= 0) elemCount.delete(this);
          else elemCount.set(this, n);
        }
      }
      return realRemove.call(this, type, fn, options);
    };
  };

  // Wire the wrapper up. (A previous splice removed these two lines and the
  // probe silently reported an empty registry — every assertion downstream then
  // "passed" by measuring nothing. Caught by the debug script, not by the tests,
  // which is why the tests now assert the levels they observed.)
  targets.forEach((target, idx) => wrap(target, idx === 0 ? "window" : "document"));
  if (withElements && win.Element && win.Element.prototype) {
    wrap(win.Element.prototype, "element");
  }

  return {
    /** { "window:keydown": 1, "element:click": 2 } — only non-zero counts */
    snapshot() {
      const out = {};
      for (const [key, byType] of live) {
        for (const [type, handlers] of byType) {
          if (handlers.size) out[key + ":" + type] = handlers.size;
        }
      }
      return out;
    },
    total() {
      let n = 0;
      for (const byType of live.values()) {
        for (const handlers of byType.values()) n += handlers.size;
      }
      return n;
    },
    /** Elements that still carry a handler AND are still in the document.
     *  Empty is the healthy state after a close: any remaining handler lives on
     *  a node that is detached (and therefore cannot fire and is collectable). */
    connectedElementsWithHandlers() {
      const out = [];
      for (const [el, n] of elemCount) {
        if (n > 0 && el && el.isConnected) {
          out.push(el.tagName + (el.className ? "." + String(el.className).split(" ")[0] : ""));
        }
      }
      return out;
    },
    /** Elements still carrying a handler, connected or not (diagnostic). */
    elementsWithHandlers() {
      return Array.from(elemCount.entries())
        .filter(([, count]) => count > 0)
        .map(([el, count]) => ({
          node: el.tagName + (el.className ? "." + String(el.className).split(" ")[0] : ""),
          handlers: count,
          connected: !!el.isConnected,
        }));
    },
    restore() {
      for (const { owner, realAdd, realRemove } of originals) {
        owner.addEventListener = realAdd;
        owner.removeEventListener = realRemove;
      }
    },
  };
}

/** Subtract two snapshots: keys present in `after` but not `before` (or with a
 *  higher count) are the leak. */
function diff(before, after) {
  const out = {};
  for (const key of Object.keys(after)) {
    const was = before[key] || 0;
    if (after[key] > was) out[key] = after[key] - was;
  }
  return out;
}

/**
 * The event types the modal primitive owns. A leak assertion scoped to these is
 * precise; scoping it to everything would be flaky on unrelated page noise
 * (jsdom itself attaches a `document:load` during a run), and scoping it to
 * nothing is the vacuous assertion this track exists to remove. Callers must
 * still prove the types were actually seen while the dialog was open — see
 * `trackedModalEvents`, or the filter itself becomes the new vacuity.
 */
const MODAL_EVENT_TYPES = ["keydown", "mousedown", "click"];

/** diff(), restricted to the modal's own event types, across every level. */
function diffModalEvents(before, after) {
  const out = {};
  for (const [key, n] of Object.entries(diff(before, after))) {
    const type = key.split(":").slice(1).join(":");
    if (MODAL_EVENT_TYPES.indexOf(type) !== -1) out[key] = n;
  }
  return out;
}

/** How many of the modal's own event types are currently attached, per level.
 *  Used to prove the instrumentation is not blind before asserting an absence. */
function trackedModalEvents(snapshot) {
  return Object.keys(snapshot).filter(
    (key) => MODAL_EVENT_TYPES.indexOf(key.split(":").slice(1).join(":")) !== -1,
  ).length;
}

/** Which levels actually carried handlers — so a test can assert the element
 *  level is covered and not silently skipped. */
function trackedLevels(snapshot) {
  const levels = new Set();
  for (const key of Object.keys(snapshot)) levels.add(key.split(":")[0]);
  return Array.from(levels).sort();
}

/**
 * The invariant, in one place so both leak suites check the SAME thing:
 *   (a) nothing may remain attached to a long-lived target (window/document) —
 *       that is the leak that can actually fire later and is the reason this
 *       helper exists;
 *   (b) any handler still attached to an ELEMENT must sit on a node that is no
 *       longer in the document — detached, hence unable to fire and collectable.
 *       A still-connected element holding a handler IS a leak.
 *
 * @param {object} assert  the assertion module
 * @param {object} probe   an instrumented probe
 * @param {object} before  snapshot taken before the dialog opened
 * @param {string} label   close path name, for the failure message
 */
function assertNoLeak(assert, probe, before, label) {
  const residual = diffModalEvents(before, probe.snapshot());
  const longLived = Object.fromEntries(
    Object.entries(residual).filter(([key]) => !key.startsWith("element:")),
  );
  assert.deepStrictEqual(
    longLived,
    {},
    "residual window/document listeners after " + label,
  );
  assert.deepStrictEqual(
    probe.connectedElementsWithHandlers(),
    [],
    "a CONNECTED element still holds a handler after " + label,
  );
}

module.exports = {
  instrumentListeners,
  assertNoLeak,
  diff,
  diffModalEvents,
  trackedModalEvents,
  trackedLevels,
  MODAL_EVENT_TYPES,
};
