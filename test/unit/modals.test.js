"use strict";

/**
 * feature_15_modals — Modals toolkit (js/modals.js).
 *
 * Covers the entire public surface built on the shared createModal primitive:
 *  - createModal shell + a11y + single close path + focus lifecycle
 *  - showInputModal validation + trimmed resolve + Cancel/Edit semantics
 *  - confirmAction destructive-style confirmation (false on dismiss)
 *  - showFallbackModal (honest DOWNLOAD copy, async clipboard vs manual)
 *  - showFeedback toast lance (cap, error immunity, dismiss, lane stacking, live regions)
 *  - showUndoToast one-shot offer (fixed overlay, isLive, timer vs invoke)
 *  - showEmptyStateDialog persistent empty-state dialog
 *  - listener-leak invariant via listener_probe instrumentation (AC-6)
 *
 * Drive the REAL js/modals.js in jsdom; every assertion executes production
 * code. No file-existence or null checks.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const {
  instrumentListeners,
  assertNoLeak,
  diffModalEvents,
  trackedModalEvents,
} = require("./helpers/listener_probe.js");

const MODALS_SRC = fs.readFileSync(path.resolve(__dirname, "../../js/modals.js"), "utf8");

// ---------------------------------------------------------------------------
// Boot helpers
// ---------------------------------------------------------------------------

function bootWindow(extra = {}) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost",
  });
  const w = dom.window;
  global.window = w;
  global.document = w.document;
  global.HTMLElement = w.HTMLElement;
  global.Element = w.Element;
  global.Node = w.Node;
  global.NodeList = w.NodeList;
  w.__DDB_TEST_MODE__ = true;
  w.safeLog = () => {};
  Object.assign(w, extra);
  const probe = instrumentListeners(w);
  w.eval(MODALS_SRC);
  return { w, dom, probe, document: w.document };
}

function cleanupBoot(dom) {
  if (dom) dom.window.close();
  delete global.window;
  delete global.document;
  delete global.HTMLElement;
  delete global.Element;
  delete global.Node;
  delete global.NodeList;
}

const dialogRoot = (w) => w.document.querySelector(".be-modal-overlay .be-modal");
const overlay = (w) => w.document.querySelector(".be-modal-overlay");
const overlays = (w) => w.document.querySelectorAll(".be-modal-overlay");
const withinDialog = (w, sel) => {
  const r = dialogRoot(w);
  return r ? r.querySelector(sel) : null;
};
const toasts = (w) => Array.from(w.document.querySelectorAll(".be-feedback"));
const errorToasts = (w) => toasts(w).filter((el) => el.classList.contains("be-feedback-error"));

// The four canonical dismissals for a generic modal promise.
const CLOSERS = {
  "close X": (w, promise) => {
    withinDialog(w, ".be-modal-close").click();
    return promise;
  },
  backdrop: (w, promise) => {
    const ov = overlay(w);
    ov.dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true }));
    ov.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    return promise;
  },
  Esc: (w, promise) => {
    w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return promise;
  },
  Cancel: (w, promise) => {
    const c = withinDialog(w, ".be-modal-cancel");
    if (c) c.click();
    else withinDialog(w, ".be-modal-close").click();
    return promise;
  },
};

// ---------------------------------------------------------------------------
// Exports + source-shape guards
// ---------------------------------------------------------------------------

describe("feature_15_modals — exports & source shape", function () {
  it("publishes window.Modals + window.confirmAction + module.exports surface", function () {
    const { w, dom } = bootWindow();
    try {
      assert.ok(w.Modals, "window.Modals exists");
      assert.strictEqual(typeof w.Modals.showInputModal, "function");
      assert.strictEqual(typeof w.Modals.showFallbackModal, "function");
      assert.strictEqual(typeof w.Modals.showFeedback, "function");
      assert.strictEqual(typeof w.Modals.showEmptyStateDialog, "function");
      assert.strictEqual(typeof w.Modals.showUndoToast, "function");
      assert.strictEqual(typeof w.Modals.confirmAction, "function");
      assert.strictEqual(typeof w.Modals.__createModal, "function");
      assert.strictEqual(typeof w.confirmAction, "function", "window.confirmAction seam");
      const exported = require("../../js/modals.js");
      assert.strictEqual(typeof exported.showInputModal, "function");
      assert.strictEqual(typeof exported.__createModal, "function");
    } finally {
      cleanupBoot(dom);
    }
  });

  it("shell is built in exactly one place (AC-1 primitive)", function () {
    assert.strictEqual((MODALS_SRC.match(/className = "be-modal-overlay"/g) || []).length, 1);
    assert.strictEqual((MODALS_SRC.match(/className = "be-modal";/g) || []).length, 1);
    assert.strictEqual((MODALS_SRC.match(/setAttribute\("role", role \|\| "dialog"\)/g) || []).length, 1);
  });

  it("every public dialog delegates to createModal exactly once", function () {
    const calls = (MODALS_SRC.match(/createModal\(\{/g) || []).length;
    assert.strictEqual(calls, 4, "input + fallback + empty-state + confirmAction each call createModal");
    for (const fn of ["showInputModal", "showFallbackModal", "showEmptyStateDialog", "confirmAction"]) {
      const at = MODALS_SRC.indexOf("function " + fn + "(");
      assert.ok(at > -1, fn + " exists");
      const tail = MODALS_SRC.slice(at);
      const next = tail.indexOf("\nfunction ");
      const region = next > 0 ? tail.slice(0, next) : tail;
      assert.ok(region.includes("createModal({"), fn + " delegates to primitive");
    }
  });

  it("feedback lane constants are the locked values", function () {
    assert.match(MODALS_SRC, /const FEEDBACK_CAP = 3/);
    assert.match(MODALS_SRC, /const FEEDBACK_LANE_TOP = 36/);
    assert.match(MODALS_SRC, /const FEEDBACK_LANE_GAP = 6/);
  });
});

// ---------------------------------------------------------------------------
// createModal primitive
// ---------------------------------------------------------------------------

describe("feature_15_modals — createModal primitive (AC-2/AC-3)", function () {
  it("builds correct shell: overlay, role, aria-modal, name, close X, live message", function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.showInputModal("My Title", "desc", "v");
      const ov = overlay(w);
      const m = dialogRoot(w);
      assert.ok(ov, "overlay exists");
      assert.strictEqual(ov.className, "be-modal-overlay");
      assert.ok(m, "modal exists");
      assert.strictEqual(m.className, "be-modal");
      assert.strictEqual(m.getAttribute("role"), "dialog");
      assert.strictEqual(m.getAttribute("aria-modal"), "true");
      const by = m.getAttribute("aria-labelledby");
      assert.ok(by, "aria-labelledby");
      const h3 = w.document.getElementById(by);
      assert.ok(h3 && h3.textContent === "My Title");
      const msg = withinDialog(w, ".be-modal-message");
      assert.ok(msg);
      assert.strictEqual(msg.getAttribute("role"), "status");
      assert.strictEqual(msg.getAttribute("aria-live"), "polite");
      const close = withinDialog(w, ".be-modal-close");
      assert.ok(close, "close X");
      assert.strictEqual(close.getAttribute("aria-label"), "Close dialog");
      assert.strictEqual(close.textContent, "\u2715");
      return CLOSERS["close X"](w, p);
    } finally {
      cleanupBoot(dom);
    }
  });

  it("respects id and role overrides", function () {
    const { w, dom } = bootWindow();
    try {
      const h = w.Modals.__createModal({ title: "T", id: "print-enhance-overlay", role: "alertdialog" });
      const ov = overlay(w);
      assert.strictEqual(ov.id, "print-enhance-overlay");
      assert.strictEqual(dialogRoot(w).getAttribute("role"), "alertdialog");
      h.close(null);
    } finally {
      cleanupBoot(dom);
    }
  });

  it("closes via close X, backdrop, and Esc", async function () {
    for (const name of ["close X", "backdrop", "Esc"]) {
      const { w, dom } = bootWindow();
      try {
        const p = w.Modals.showInputModal("T", "", "x");
        assert.strictEqual(overlays(w).length, 1);
        const result = await CLOSERS[name](w, p);
        assert.strictEqual(overlays(w).length, 0, name + " closed it");
        assert.strictEqual(result, null);
      } finally {
        cleanupBoot(dom);
      }
    }
  });

  it("drag starting inside dialog and ending on backdrop does NOT close", function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.showInputModal("T", "", "x");
      const ov = overlay(w);
      const input = withinDialog(w, ".be-modal-input");
      input.dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true }));
      ov.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
      assert.strictEqual(overlays(w).length, 1, "still open");
      return CLOSERS.Cancel(w, p);
    } finally {
      cleanupBoot(dom);
    }
  });

  it("focus moves into dialog, lands in body content not on X", function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.showInputModal("T", "", "seed");
      const input = withinDialog(w, ".be-modal-input");
      assert.ok(dialogRoot(w).contains(w.document.activeElement), "focus inside");
      assert.strictEqual(w.document.activeElement, input, "lands in input not X");
      return CLOSERS.Cancel(w, p);
    } finally {
      cleanupBoot(dom);
    }
  });

  it("traps Tab at both ends and pulls back escaped focus", function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.showInputModal("T", "", "seed");
      const modal = dialogRoot(w);
      const items = Array.from(modal.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])'));
      assert.ok(items.length >= 2);
      const last = items[items.length - 1];
      last.focus();
      w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
      assert.strictEqual(w.document.activeElement, items[0], "Tab wrap last->first");
      items[0].focus();
      w.document.dispatchEvent(
        new w.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })
      );
      assert.strictEqual(w.document.activeElement, last, "Shift+Tab wrap first->last");
      // escape then Tab should pull back
      const outside = w.document.createElement("button");
      w.document.body.appendChild(outside);
      outside.focus();
      w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
      assert.ok(dialogRoot(w).contains(w.document.activeElement), "trap pulled focus back");
      return CLOSERS.Cancel(w, p);
    } finally {
      cleanupBoot(dom);
    }
  });

  it("restores focus to invoker on every close path, falls back when invoker detached", async function () {
    for (const name of Object.keys(CLOSERS)) {
      const { w, dom } = bootWindow();
      try {
        const invoker = w.document.createElement("button");
        invoker.id = "invoker";
        w.document.body.appendChild(invoker);
        invoker.focus();
        const p = w.Modals.showInputModal("T", "", "seed");
        await CLOSERS[name](w, p);
        assert.strictEqual(w.document.activeElement, invoker, "restored via " + name);
      } finally {
        cleanupBoot(dom);
      }
    }
    // detached invoker
    {
      const { w, dom } = bootWindow();
      try {
        const invoker = w.document.createElement("button");
        w.document.body.appendChild(invoker);
        invoker.focus();
        const p = w.Modals.showInputModal("T", "", "seed");
        invoker.remove();
        await CLOSERS.Cancel(w, p);
        assert.strictEqual(overlays(w).length, 0);
        assert.ok(w.document.activeElement, "focus somewhere");
        assert.notStrictEqual(w.document.activeElement, invoker);
      } finally {
        cleanupBoot(dom);
      }
    }
  });

  it("single close path: double close resolves once, second call is no-op", async function () {
    const { w, dom } = bootWindow();
    try {
      const h = w.Modals.__createModal({ title: "T" });
      let count = 0;
      h.promise.then(() => count++);
      h.close("first");
      h.close("second");
      await h.promise;
      assert.strictEqual(count, 1);
      assert.strictEqual(overlays(w).length, 0);
    } finally {
      cleanupBoot(dom);
    }
  });

  it("setMessage/clearMessage toggles error style + aria-invalid, field param honored", async function () {
    const { w, dom } = bootWindow();
    try {
      const h = w.Modals.__createModal({ title: "T", body(ctx) {
        const inp = w.document.createElement("input");
        inp.id = "field-a";
        ctx.bodyEl.appendChild(inp);
      }});
      const inp = withinDialog(w, "#field-a");
      // error on default field
      h.setMessage("bad", true);
      const msg = withinDialog(w, ".be-modal-message");
      assert.ok(msg.textContent.includes("bad"));
      assert.ok(msg.classList.contains("be-modal-message-error"));
      assert.strictEqual(inp.getAttribute("aria-invalid"), "true");
      // clear via field=null should clear aria-invalid
      h.setMessage("generic problem", true, null);
      assert.strictEqual(inp.getAttribute("aria-invalid"), null, "null field clears invalid");
      h.clearMessage();
      assert.strictEqual(msg.textContent, "");
      assert.ok(!msg.classList.contains("be-modal-message-error"));
      h.close(null);
    } finally {
      cleanupBoot(dom);
    }
  });
});

// ---------------------------------------------------------------------------
// showInputModal
// ---------------------------------------------------------------------------

describe("feature_15_modals — showInputModal (AC-4)", function () {
  it("empty submit stays open, shows error, marks aria-invalid", async function () {
    const { w, dom } = bootWindow();
    try {
      let settled = false;
      const p = w.Modals.showInputModal("T", "M", "").then((v) => { settled = true; return v; });
      withinDialog(w, ".be-modal-input").value = "";
      withinDialog(w, ".be-modal-ok").click();
      assert.strictEqual(overlays(w).length, 1, "stays open");
      assert.strictEqual(settled, false);
      const msg = withinDialog(w, ".be-modal-message");
      assert.ok(msg.textContent.length > 0);
      assert.ok(msg.classList.contains("be-modal-message-error"));
      assert.strictEqual(withinDialog(w, ".be-modal-input").getAttribute("aria-invalid"), "true");
      await CLOSERS.Cancel(w, p);
    } finally {
      cleanupBoot(dom);
    }
  });

  it("whitespace-only submit is treated as empty", async function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.showInputModal("T", "M", "   ");
      withinDialog(w, ".be-modal-ok").click();
      assert.strictEqual(overlays(w).length, 1);
      assert.ok(withinDialog(w, ".be-modal-message").textContent.length > 0);
      await CLOSERS.Cancel(w, p);
    } finally {
      cleanupBoot(dom);
    }
  });

  it("valid submit resolves TRIMMED value and closes", async function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.showInputModal("T", "M", "  Padded Name  ");
      withinDialog(w, ".be-modal-ok").click();
      assert.strictEqual(await p, "Padded Name");
      assert.strictEqual(overlays(w).length, 0);
    } finally {
      cleanupBoot(dom);
    }
  });

  it("typing after error clears aria-invalid and error styling", async function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.showInputModal("T", "desc", "");
      const input = withinDialog(w, ".be-modal-input");
      withinDialog(w, ".be-modal-ok").click();
      assert.strictEqual(input.getAttribute("aria-invalid"), "true");
      input.value = "x";
      input.dispatchEvent(new w.Event("input", { bubbles: true }));
      assert.strictEqual(input.getAttribute("aria-invalid"), null);
      assert.ok(!withinDialog(w, ".be-modal-message").classList.contains("be-modal-message-error"));
      await CLOSERS.Cancel(w, p);
    } finally {
      cleanupBoot(dom);
    }
  });

  it("Cancel resolves null distinguishable from empty string", async function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.showInputModal("T", "M", "seed");
      const v = await CLOSERS.Cancel(w, p);
      assert.strictEqual(v, null);
      assert.notStrictEqual(v, "");
    } finally {
      cleanupBoot(dom);
    }
  });

  it("Enter submits, empty Enter keeps open and validates", async function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.showInputModal("T", "M", "typed");
      withinDialog(w, ".be-modal-input").dispatchEvent(
        new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
      );
      assert.strictEqual(await p, "typed");
      const p2 = w.Modals.showInputModal("T", "M", "");
      withinDialog(w, ".be-modal-input").dispatchEvent(
        new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
      );
      assert.strictEqual(overlays(w).length, 1, "empty Enter keeps open");
      await CLOSERS.Cancel(w, p2);
    } finally {
      cleanupBoot(dom);
    }
  });

  it("defaultValue seeds input; message param seeds description", function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.showInputModal("Title", "Hello desc", "seedVal");
      assert.strictEqual(withinDialog(w, ".be-modal-input").value, "seedVal");
      assert.match(withinDialog(w, ".be-modal-message").textContent, /Hello desc/);
      return CLOSERS.Cancel(w, p);
    } finally {
      cleanupBoot(dom);
    }
  });
});

// ---------------------------------------------------------------------------
// confirmAction
// ---------------------------------------------------------------------------

describe("feature_15_modals — confirmAction (U-36 replacement for native confirm)", function () {
  it("renders title+message and both buttons with default labels", async function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.confirmAction({ title: "Delete?", message: "Sure?" });
      assert.ok(dialogRoot(w).textContent.includes("Delete?"));
      assert.ok(dialogRoot(w).textContent.includes("Sure?"));
      assert.ok(withinDialog(w, ".be-modal-cancel"), "Cancel exists");
      assert.strictEqual(withinDialog(w, ".be-modal-cancel").textContent, "Cancel");
      assert.ok(withinDialog(w, ".be-modal-ok"), "OK exists");
      assert.strictEqual(withinDialog(w, ".be-modal-ok").textContent, "Continue");
      await CLOSERS.Cancel(w, p);
    } finally {
      cleanupBoot(dom);
    }
  });

  it("confirm resolves true, cancel and any dismiss resolve false (safe direction)", async function () {
    const { w, dom } = bootWindow();
    try {
      let p = w.Modals.confirmAction({ title: "T" });
      withinDialog(w, ".be-modal-ok").click();
      assert.strictEqual(await p, true, "OK -> true");
    } finally { cleanupBoot(dom); }
    {
      const { w, dom } = bootWindow();
      try {
        const p = w.Modals.confirmAction({ title: "T" });
        withinDialog(w, ".be-modal-cancel").click();
        assert.strictEqual(await p, false, "Cancel -> false");
      } finally { cleanupBoot(dom); }
    }
    {
      const { w, dom } = bootWindow();
      try {
        const p = w.Modals.confirmAction({ title: "T" });
        withinDialog(w, ".be-modal-close").click();
        assert.strictEqual(await p, false, "X -> false");
      } finally { cleanupBoot(dom); }
    }
    {
      const { w, dom } = bootWindow();
      try {
        const p = w.Modals.confirmAction({ title: "T" });
        w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        assert.strictEqual(await p, false, "Esc -> false");
      } finally { cleanupBoot(dom); }
    }
  });

  it("honors confirmLabel, cancelLabel, and danger styling", async function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.confirmAction({ title: "T", confirmLabel: "Delete", cancelLabel: "Keep", danger: true });
      assert.strictEqual(withinDialog(w, ".be-modal-ok").textContent, "Delete");
      assert.strictEqual(withinDialog(w, ".be-modal-cancel").textContent, "Keep");
      assert.ok(withinDialog(w, ".be-modal-ok").classList.contains("be-modal-danger"), "danger class");
      await CLOSERS.Cancel(w, p);
    } finally { cleanupBoot(dom); }
  });

  it("backdrop and Esc both dismiss as false", async function () {
    const { w, dom } = bootWindow();
    try {
      let p = w.Modals.confirmAction({ title: "T" });
      const ov = overlay(w);
      ov.dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true }));
      ov.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
      assert.strictEqual(await p, false);
    } finally { cleanupBoot(dom); }
    {
      const { w, dom } = bootWindow();
      try {
        const p = w.Modals.confirmAction({ title: "T" });
        w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        assert.strictEqual(await p, false);
      } finally { cleanupBoot(dom); }
    }
  });
});

// ---------------------------------------------------------------------------
// showFallbackModal
// ---------------------------------------------------------------------------

describe("feature_15_modals — showFallbackModal (U-23 honest download failure)", function () {
  it("says DOWNLOAD failed, shows textarea with jsonData, has Close and Copy buttons", function () {
    const { w, dom } = bootWindow();
    try {
      const h = w.Modals.showFallbackModal('{"a":1}');
      const msg = withinDialog(w, ".be-modal-message");
      assert.match(msg.textContent, /DOWNLOAD/i);
      assert.match(msg.textContent, /Copy the data/i);
      assert.ok(msg.classList.contains("be-modal-message-error"));
      const ta = withinDialog(w, ".be-modal-json");
      assert.ok(ta, "textarea exists");
      assert.strictEqual(ta.value, '{"a":1}');
      assert.strictEqual(ta.getAttribute("aria-label"), "Layout JSON data");
      assert.ok(withinDialog(w, ".be-modal-cancel"), "Close");
      assert.ok(withinDialog(w, ".be-modal-ok"), "Copy to Clipboard");
      assert.strictEqual(overlay(w).id, "print-enhance-overlay");
      h.close(null);
    } finally { cleanupBoot(dom); }
  });

  it("does not use deprecated document.execCommand('copy') in code (comments excluded)", function () {
    const code = MODALS_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!/document\.execCommand\(\s*["']copy["']\s*\)/.test(code), "execCommand('copy') absent from code");
    assert.match(code, /clipboard\.writeText/);
  });

  it("without clipboard API: Copy selects text and warns, does not claim Copied! ", function () {
    const { w, dom } = bootWindow();
    try {
      assert.ok(!(w.navigator && w.navigator.clipboard), "clipboard absent in this jsdom");
      const h = w.Modals.showFallbackModal('{"a":1}');
      withinDialog(w, ".be-modal-ok").click();
      const msg = withinDialog(w, ".be-modal-message");
      assert.match(msg.textContent, /Ctrl\/Cmd\+C|copy it/i);
      assert.notStrictEqual(withinDialog(w, ".be-modal-ok").textContent, "Copied!");
      h.close(null);
    } finally { cleanupBoot(dom); }
  });

  it("with clipboard API: writes jsonData and flashes Copied!", async function () {
    const { w, dom } = bootWindow();
    try {
      let written = null;
      Object.defineProperty(w.navigator, "clipboard", {
        configurable: true,
        value: { writeText: (t) => { written = t; return Promise.resolve(); } },
      });
      const h = w.Modals.showFallbackModal('{"b":2}');
      withinDialog(w, ".be-modal-ok").click();
      await new Promise((r) => setTimeout(r, 0));
      assert.strictEqual(written, '{"b":2}');
      assert.strictEqual(withinDialog(w, ".be-modal-ok").textContent, "Copied!");
      h.close(null);
    } finally { cleanupBoot(dom); }
  });

  it("clipboard rejection falls back to manual select + message", async function () {
    const { w, dom } = bootWindow();
    try {
      Object.defineProperty(w.navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("denied")) },
      });
      const h = w.Modals.showFallbackModal('{"c":3}');
      withinDialog(w, ".be-modal-ok").click();
      await new Promise((r) => setTimeout(r, 0));
      const msg = withinDialog(w, ".be-modal-message");
      assert.match(msg.textContent, /would not let|Ctrl\/Cmd\+C/i);
      h.close(null);
    } finally { cleanupBoot(dom); }
  });
});

// ---------------------------------------------------------------------------
// showFeedback
// ---------------------------------------------------------------------------

describe("feature_15_modals — showFeedback toasts (AC-1/AC-3)", function () {
  it("creates positioned toast with role/live, tick+drain, correct kind classes", function () {
    const { w, dom } = bootWindow();
    try {
      const el = w.Modals.showFeedback("Hello", "info");
      assert.ok(el.classList.contains("be-feedback"));
      assert.ok(el.classList.contains("be-feedback-info"));
      assert.strictEqual(el.getAttribute("role"), "status");
      assert.strictEqual(el.getAttribute("aria-live"), "polite");
      assert.ok(el.querySelector(".be-feedback-tick"));
      assert.ok(el.querySelector(".be-feedback-drain"));
      assert.ok(el.querySelector(".be-feedback-msg").textContent.includes("Hello"));
      assert.strictEqual(el.style.position, "fixed");
      assert.strictEqual(el.style.left, "50%");
      assert.ok(el.querySelector(".be-feedback-dismiss"), "dismiss control");
    } finally { cleanupBoot(dom); }
  });

  it("error kind uses alert+assertive and warning glyph", function () {
    const { w, dom } = bootWindow();
    try {
      const el = w.Modals.showFeedback("boom", "error");
      assert.ok(el.classList.contains("be-feedback-error"));
      assert.strictEqual(el.getAttribute("role"), "alert");
      assert.strictEqual(el.getAttribute("aria-live"), "assertive");
      assert.match(el.querySelector(".be-feedback-msg").textContent, /\u26A0|boom/);
    } finally { cleanupBoot(dom); }
  });

  it("success kind prefixes checkmark", function () {
    const { w, dom } = bootWindow();
    try {
      const el = w.Modals.showFeedback("saved", "success");
      assert.ok(el.classList.contains("be-feedback-success"));
      assert.match(el.querySelector(".be-feedback-msg").textContent, /\u2713|saved/);
    } finally { cleanupBoot(dom); }
  });

  it("cap evicts oldest NON-error toasts only; errors are never evicted", function () {
    const { w, dom } = bootWindow();
    try {
      w.Modals.showFeedback("ok1", "success");
      w.Modals.showFeedback("Template could not be applied", "error");
      w.Modals.showFeedback("ok2", "info");
      w.Modals.showFeedback("Backup failed (quota)", "error");
      w.Modals.showFeedback("ok3", "success");
      w.Modals.showFeedback("ok4", "success");
      assert.strictEqual(errorToasts(w).length, 2, "both errors survive");
      const txt = errorToasts(w).map((e) => e.textContent).join(" | ");
      assert.match(txt, /Template could not be applied/);
      assert.match(txt, /Backup failed/);
      const non = toasts(w).filter((e) => !e.classList.contains("be-feedback-error"));
      assert.ok(non.length <= 3, "non-error cap 3 but was " + non.length);
    } finally { cleanupBoot(dom); }
  });

  it("non-error cap is exactly 3: oldest evicted, newest survive", function () {
    const { w, dom } = bootWindow();
    try {
      for (let i = 1; i <= 6; i++) w.Modals.showFeedback("saved " + i, "success");
      const non = toasts(w).filter((e) => !e.classList.contains("be-feedback-error"));
      assert.strictEqual(non.length, 3);
      const txt = non.map((e) => e.textContent).join(" | ");
      assert.match(txt, /saved 6/);
      assert.ok(!/saved 1\b/.test(txt), "oldest evicted");
    } finally { cleanupBoot(dom); }
  });

  it("every toast has keyboard-reachable dismiss control with labeled aria-label", function () {
    const { w, dom } = bootWindow();
    try {
      w.Modals.showFeedback("Layout saved", "success");
      const toast = toasts(w)[0];
      const btn = toast.querySelector(".be-feedback-dismiss");
      assert.ok(btn, "dismiss exists");
      assert.strictEqual(btn.tagName, "BUTTON");
      assert.notStrictEqual(btn.getAttribute("tabindex"), "-1");
      assert.match(btn.getAttribute("aria-label") || "", /dismiss/i);
      assert.match(btn.getAttribute("aria-label"), /Layout saved/);
      assert.strictEqual(btn.textContent, "\u2715");
    } finally { cleanupBoot(dom); }
  });

  it("dismiss removes THAT toast only and announces via polite live region", function () {
    const { w, dom } = bootWindow();
    try {
      w.Modals.showFeedback("first", "info");
      w.Modals.showFeedback("SECOND — the one to dismiss", "info");
      w.Modals.showFeedback("third", "info");
      assert.strictEqual(toasts(w).length, 3);
      const target = toasts(w).find((e) => e.textContent.includes("the one to dismiss"));
      target.querySelector(".be-feedback-dismiss").click();
      const left = toasts(w).map((e) => e.textContent);
      assert.strictEqual(left.length, 2);
      assert.ok(!left.some((t) => t.includes("the one to dismiss")));
      assert.ok(left.some((t) => t.includes("first")));
      assert.ok(left.some((t) => t.includes("third")));
      const lane = w.document.getElementById("be-feedback-announcer");
      assert.ok(lane, "announcer exists");
      assert.strictEqual(lane.getAttribute("role"), "status");
      assert.strictEqual(lane.getAttribute("aria-live"), "polite");
      assert.match(lane.textContent, /dismissed/i);
      assert.match(lane.textContent, /the one to dismiss/);
      assert.strictEqual(toasts(w).some((e) => e.id === "be-feedback-announcer"), false);
    } finally { cleanupBoot(dom); }
  });

  it("stacks lane: each toast has distinct top, ordered top-to-bottom", function () {
    const { w, dom } = bootWindow();
    try {
      w.Modals.showFeedback("first", "info");
      w.Modals.showFeedback("second", "error");
      w.Modals.showFeedback("third", "success");
      const items = toasts(w);
      assert.strictEqual(items.length, 3);
      const tops = items.map((t) => t.style.top);
      assert.strictEqual(new Set(tops).size, 3, "distinct tops: " + tops);
      const nums = items.map((t) => parseFloat(t.style.top));
      assert.deepStrictEqual(nums.slice().sort((a, b) => a - b), nums, "ordered");
      assert.ok(nums[1] > nums[0] && nums[2] > nums[1]);
      // removing first re-lays to anchor
      items[0].querySelector(".be-feedback-dismiss").click();
      const after = toasts(w).map((t) => parseFloat(t.style.top));
      assert.strictEqual(after.length, 2);
      assert.strictEqual(after[0], 36);
    } finally { cleanupBoot(dom); }
  });

  it("Escape on toast dismisses it and announces", function () {
    const { w, dom } = bootWindow();
    try {
      w.Modals.showFeedback("Escape me", "info");
      const t = toasts(w)[0];
      t.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      assert.strictEqual(toasts(w).length, 0);
      assert.match(w.document.getElementById("be-feedback-announcer").textContent, /dismissed/i);
    } finally { cleanupBoot(dom); }
  });
});

// ---------------------------------------------------------------------------
// showUndoToast
// ---------------------------------------------------------------------------

describe("feature_15_modals — showUndoToast (one-shot reversible offer)", function () {
  it("renders fixed overlay with Undo button and exposes handle", function () {
    const { w, dom } = bootWindow();
    try {
      let invoked = 0;
      const h = w.Modals.showUndoToast("Deleted layer", () => invoked++, { ms: 5000 });
      assert.ok(h.element, "element");
      assert.ok(h.element.classList.contains("be-feedback-undo"));
      assert.strictEqual(h.element.style.position, "fixed");
      assert.strictEqual(h.element.style.top, "36px");
      assert.ok(h.control, "control button");
      assert.strictEqual(h.control.textContent, "Undo");
      assert.strictEqual(h.control.className, "be-feedback-undo-btn");
      assert.match(h.control.getAttribute("aria-label"), /Undo/);
      assert.strictEqual(h.isLive(), true);
      assert.strictEqual(typeof h.close, "function");
      h.close("test cleanup");
      assert.strictEqual(h.isLive(), false);
      assert.strictEqual(invoked, 0, "close alone does not invoke");
    } finally { cleanupBoot(dom); }
  });

  it("clicking Undo invokes once, closes offer, and prevents second invoke", function () {
    const { w, dom } = bootWindow();
    try {
      let calls = 0;
      let expireReason = null;
      const h = w.Modals.showUndoToast("Delete shape", () => calls++, { ms: 5000, onExpire: (r) => expireReason = r });
      h.control.click();
      assert.strictEqual(calls, 1, "invoked once");
      assert.strictEqual(expireReason, "invoked");
      assert.strictEqual(h.isLive(), false);
      assert.strictEqual(w.document.body.contains(h.element), false, "removed from DOM");
      // second click is no-op
      h.control.click();
      assert.strictEqual(calls, 1, "second click ignored");
    } finally { cleanupBoot(dom); }
  });

  it("expires after ms and fires onExpire with 'expired' then removes element", async function () {
    const { w, dom } = bootWindow();
    try {
      let reason = null;
      const h = w.Modals.showUndoToast("temp", () => {}, { ms: 40, onExpire: (r) => reason = r });
      assert.strictEqual(h.isLive(), true);
      await new Promise((r) => setTimeout(r, 80));
      assert.strictEqual(h.isLive(), false, "no longer live after timeout");
      assert.strictEqual(reason, "expired");
      assert.strictEqual(w.document.body.contains(h.element), false);
    } finally {
      cleanupBoot(dom);
    }
  });

  it("close(reason) is idempotent, fires onExpire exactly once", function () {
    const { w, dom } = bootWindow();
    try {
      let count = 0;
      const h = w.Modals.showUndoToast("x", () => {}, { ms: 5000, onExpire: () => count++ });
      h.close("first");
      h.close("second");
      assert.strictEqual(count, 1);
    } finally { cleanupBoot(dom); }
  });
});

// ---------------------------------------------------------------------------
// showEmptyStateDialog
// ---------------------------------------------------------------------------

describe("feature_15_modals — showEmptyStateDialog (AC-5 persistent empty state)", function () {
  it("shows title, message, optional hint, and Continue button", async function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.showEmptyStateDialog({ title: "Nothing to show", message: "No clones found", hint: "Try adding one" });
      const m = dialogRoot(w);
      assert.ok(m.textContent.includes("Nothing to show"));
      assert.ok(m.textContent.includes("No clones found"));
      const hint = withinDialog(w, ".be-modal-hint");
      assert.ok(hint, "hint exists");
      assert.strictEqual(hint.textContent, "Try adding one");
      const ok = withinDialog(w, ".be-modal-ok");
      assert.ok(ok, "Continue button");
      assert.strictEqual(ok.textContent, "Continue");
      ok.click();
      await p;
      assert.strictEqual(overlays(w).length, 0);
    } finally { cleanupBoot(dom); }
  });

  it("defaults title when omitted, persists past toast dwell", async function () {
    const { w, dom } = bootWindow();
    try {
      const p = w.Modals.showEmptyStateDialog({ message: "No targets" });
      const title = dialogRoot(w).querySelector("h3").textContent;
      assert.ok(title.length > 0, "default title: " + title);
      // wait longer than toast dwell (3s) — the dialog must still be there
      await new Promise((r) => setTimeout(r, 120));
      assert.strictEqual(overlays(w).length, 1, "empty-state persists, does not auto-expire like a toast");
      withinDialog(w, ".be-modal-ok").click();
      await p;
    } finally { cleanupBoot(dom); }
  });

  it("closes via Esc, backdrop, and close X, each resolving null", async function () {
    for (const closer of ["Esc", "close X", "backdrop"]) {
      const { w, dom } = bootWindow();
      try {
        const p = w.Modals.showEmptyStateDialog({ title: "T", message: "M" });
        const v = await CLOSERS[closer](w, p);
        assert.strictEqual(v, null, closer + " resolves null");
      } finally { cleanupBoot(dom); }
    }
  });
});

// ---------------------------------------------------------------------------
// Listener-leak invariant (AC-6)
// ---------------------------------------------------------------------------

describe("feature_15_modals — listener-leak invariant (AC-6, instrumented)", function () {
  const MODAL_OPENS = {
    input: (w) => w.Modals.showInputModal("T", "M", "seed"),
    fallback: (w) => { const h = w.Modals.showFallbackModal('{"x":1}'); return h.promise || Promise.resolve(null); },
    empty: (w) => w.Modals.showEmptyStateDialog({ title: "T", message: "M" }),
    feedback: null, // toasts are not modals; skip
  };

  for (const [label, open] of Object.entries(MODAL_OPENS)) {
    if (!open) continue;
    for (const closer of Object.keys(CLOSERS)) {
      // fallback has no Cancel button; skip that closer there
      it(label + " leaks nothing when closed via " + closer, async function () {
        const { w, probe, dom } = bootWindow();
        try {
          const before = probe.snapshot();
          const p = open(w);
          // prove instrumentation saw the dialog's listeners — else vacuous pass
          assert.ok(trackedModalEvents(probe.snapshot()) > 0, "instrumentation sees modal listeners while open");
          // fallback's Cancel closer would hit close X instead — both valid, but
          // skip Cancel for fallback to avoid asserting the wrong target
          if (label === "fallback" && closer === "Cancel") {
            withinDialog(w, ".be-modal-close").click();
            await p;
          } else {
            await CLOSERS[closer](w, p);
          }
          assertNoLeak(assert, probe, before, label + " via " + closer);
        } finally {
          cleanupBoot(dom);
        }
      });
    }

    it(label + " accumulates nothing over 5 open/close cycles", async function () {
      const { w, probe, dom } = bootWindow();
      try {
        const before = probe.snapshot();
        for (let i = 0; i < 5; i++) {
          const pr = open(w);
          withinDialog(w, ".be-modal-close").click();
          await pr;
          assertNoLeak(assert, probe, before, label + " cycle #" + (i + 1));
        }
        // Element-level handlers on the detached overlay are collectable, not a leak.
        // Only window/document residue would be a genuine accumulation.
        const residual = diffModalEvents(before, probe.snapshot());
        const longLived = Object.fromEntries(
          Object.entries(residual).filter(([k]) => !k.startsWith("element:"))
        );
        assert.deepStrictEqual(longLived, {}, "no accumulation on window/document after 5 cycles");
        assert.deepStrictEqual(
          probe.connectedElementsWithHandlers(),
          [],
          "no connected element holds a handler after 5 cycles"
        );
      } finally {
        cleanupBoot(dom);
      }
    });
  }

  it("a keypress after a mouse close does nothing and leaves no leak", async function () {
    const { w, probe, dom } = bootWindow();
    try {
      const before = probe.snapshot();
      const p = w.Modals.showInputModal("T", "M", "seed");
      withinDialog(w, ".be-modal-cancel").click();
      await p;
      for (const key of ["Enter", "Escape"]) {
        w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key, bubbles: true }));
      }
      assertNoLeak(assert, probe, before, "keypress after mouse close");
      assert.strictEqual(overlay(w), null);
    } finally {
      cleanupBoot(dom);
    }
  });
});
