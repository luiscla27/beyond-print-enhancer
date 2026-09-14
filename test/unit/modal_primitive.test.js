/**
 * The shared modal primitive — track modal_primitive_20260910.
 *
 * AC-1 one primitive / no duplicated shells
 * AC-2 every affordance, per dialog (close X, backdrop, Esc, role, aria-modal, name)
 * AC-3 focus lifecycle (move in, trap both directions, restore, detached invoker)
 * AC-4 empty submit explained; cancel distinguishable
 * AC-5 honest fallback dialog (no deprecated copy, copy names the failure)
 * AC-6 listener-leak invariant (instrumented, not read from source)
 *
 * Everything here asserts against the LIVE DOM (jsdom) or the listener registry
 * as instrumented by test/unit/helpers/listener_probe.js. Nothing asserts by
 * reading the source text, because this track exists precisely because two
 * criteria on this project were previously satisfiable vacuously.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const {
  instrumentListeners,
  diffModalEvents,
  trackedModalEvents,
  trackedLevels,
} = require("./helpers/listener_probe.js");

const MODALS_PATH = path.resolve(__dirname, "../../js/modals.js");
const MODALS = fs.readFileSync(MODALS_PATH, "utf8");

function boot() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const probe = instrumentListeners(window);
  window.eval(MODALS);
  return { window, probe };
}

const q = (window, sel) => window.document.querySelector(sel);

/**
 * Every dialog query goes through this (GATE 3 directive 3).
 *
 * The reason is not theoretical: the browser harness once reported a PASS on the
 * validation criterion because an unscoped `document.querySelector(".be-modal-ok")`
 * matched a CONTROL-PANEL button — the panel reuses that class and sits earlier
 * in the body — so the empty submit never ran and the assertion passed on the
 * dialog's description. jsdom unit tests have no control panel, which is exactly
 * why the collision could only ever appear in the browser: scoping here keeps the
 * two suites honest about the same thing.
 */
const dialogRoot = (window) =>
  window.document.querySelector(".be-modal-overlay .be-modal");
const withinDialog = (window, sel) => {
  const dialog = dialogRoot(window);
  return dialog ? dialog.querySelector(sel) : null;
};
const overlays = (window) => window.document.querySelectorAll(".be-modal-overlay");

/** The four ways a dialog can be dismissed. `open` returns its promise (or
 *  handle); each closer drives one path and leaves the promise settled. */
const CLOSERS = {
  "close X": (window, promise) => {
    withinDialog(window, ".be-modal-close").click();
    return promise;
  },
  backdrop: (window, promise) => {
    const ov = q(window, ".be-modal-overlay");
    // a real cancel is a press AND release on the backdrop itself
    ov.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
    ov.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    return promise;
  },
  Esc: (window, promise) => {
    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    return promise;
  },
  Cancel: (window, promise) => {
    withinDialog(window, ".be-modal-cancel").click();
    return promise;
  },
};

describe("AC-1 — one primitive, no duplicated shells", function () {
  it("builds the shell in exactly one place", function () {
    // The shell markup (overlay + .be-modal + role) is created once, in
    // createModal. If a dialog hand-rolls its own, this count rises.
    assert.strictEqual(
      (MODALS.match(/className = "be-modal-overlay"/g) || []).length,
      1,
      "exactly one overlay construction in js/modals.js",
    );
    assert.strictEqual(
      (MODALS.match(/className = "be-modal";/g) || []).length,
      1,
      "exactly one shell construction in js/modals.js",
    );
    assert.strictEqual(
      (MODALS.match(/setAttribute\("role", role \|\| "dialog"\)/g) || []).length,
      1,
      "the role is applied in exactly one place (defaulting to dialog; the "
        + "restore-failure card overrides it to alertdialog)",
    );
  });

  it("no migrated dialog re-introduces a hand-rolled shell (the AC-1 regression guard)", function () {
    // GATE 3 directive 1 asked for an artifact proving the legacy shells are
    // GONE, not merely that a constructor exists. A shell is three things: its
    // own overlay, its own role/aria wiring, its own title+actions scaffold. Any
    // of them reappearing inside a dialog function means the migration regressed.
    const DIALOGS = ["showInputModal", "showFallbackModal"];
    const SHELL_MARKERS = [
      ['createElement("div") + be-modal-overlay', /createElement\("div"\)[\s\S]{0,120}be-modal-overlay/],
      ['setAttribute("role"', /setAttribute\("role"/],
      ['setAttribute("aria-modal"', /setAttribute\("aria-modal"/],
      ['classList/className = "be-modal-close"', /className\s*=\s*"be-modal-close"/],
      ['classList/className = "be-modal-actions"', /className\s*=\s*"be-modal-actions"/],
    ];
    for (const fn of DIALOGS) {
      const from = MODALS.indexOf("function " + fn + "(");
      assert.ok(from > -1, fn + " exists");
      const rest = MODALS.slice(from);
      const nextFn = rest.indexOf("\n" + "function ");
      const region = nextFn > 0 ? rest.slice(0, nextFn) : rest;
      for (const [label, re] of SHELL_MARKERS) {
        assert.ok(
          !re.test(region),
          fn + " must not build its own shell: found " + label,
        );
      }
      assert.ok(region.includes("createModal({"), fn + " delegates to the primitive");
    }
  });

  it("every dialog in the module is produced by the primitive", function () {
    // Each migrated dialog calls createModal exactly once. The count is pinned
    // so a SECOND construction path cannot appear unnoticed; adding a dialog
    // that legitimately uses the primitive updates it on purpose —
    // feedback_lifecycle_a11y_20260910 (AC-5) added showEmptyStateDialog, the
    // persistent "nothing found" dialog, which is built on this primitive.
    const calls = (MODALS.match(/createModal\(\{/g) || []).length;
    assert.strictEqual(
      calls,
      4,
      "the three dialogs (input, fallback, empty-state) plus confirmAction each " +
        "call createModal once",
    );
    for (const fn of ["showInputModal", "showFallbackModal", "showEmptyStateDialog"]) {
      const body = MODALS.slice(MODALS.indexOf("function " + fn + "("));
      const next = body.indexOf("\nfunction ");
      const region = next > 0 ? body.slice(0, next) : body;
      assert.ok(region.includes("createModal({"), fn + " uses the primitive");
      assert.ok(
        !region.includes('createElement("div")') ||
          !region.includes('className = "be-modal-overlay"'),
        fn + " does not build its own overlay",
      );
    }
  });
});

describe("AC-2 — every affordance, on every in-scope dialog", function () {
  const DIALOGS = [
    {
      name: "showInputModal",
      open: (w) => w.Modals.showInputModal("T", "M", "seed"),
      actionLabel: "OK",
    },
  ];

  for (const d of DIALOGS) {
    it(d.name + " exposes role, aria-modal, an accessible name and a close X", async function () {
      const { window } = boot();
      const p = d.open(window);
      const modal = dialogRoot(window);
      assert.ok(modal, "a shell exists");
      assert.strictEqual(modal.getAttribute("role"), "dialog", "role=dialog");
      assert.strictEqual(modal.getAttribute("aria-modal"), "true", "aria-modal");
      const labelledby = modal.getAttribute("aria-labelledby");
      assert.ok(labelledby, "aria-labelledby is set");
      const named = window.document.getElementById(labelledby);
      assert.ok(named, "the labelled element exists");
      assert.ok(named.textContent.trim().length > 0, "the accessible name is not empty");
      const x = withinDialog(window, ".be-modal-close");
      assert.ok(x, "a close X exists");
      assert.strictEqual(x.getAttribute("aria-label"), "Close dialog");
      await CLOSERS["close X"](window, p);
    });

    for (const pathName of Object.keys(CLOSERS)) {
      it(d.name + " closes via " + pathName, async function () {
        const { window } = boot();
        const p = d.open(window);
        assert.strictEqual(overlays(window).length, 1, "one dialog open");
        const result = await CLOSERS[pathName](window, p);
        assert.strictEqual(overlays(window).length, 0, pathName + " closed the dialog");
        assert.strictEqual(result, null, pathName + " resolves null (cancel)");
      });
    }
  }

  it("the fallback dialog gains a close X and Esc it never had (U-23)", async function () {
    const { window } = boot();
    const handle = window.Modals.showFallbackModal('{"a":1}');
    assert.ok(withinDialog(window, ".be-modal-close"), "close X present");
    assert.strictEqual(dialogRoot(window).getAttribute("role"), "dialog");
    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    assert.strictEqual(overlays(window).length, 0, "Esc closes the JSON dialog");
    void handle;
  });

  it("a drag that starts inside the dialog and ends on the backdrop does NOT close it", async function () {
    const { window } = boot();
    const p = window.Modals.showInputModal("T", "M", "seed");
    const ov = q(window, ".be-modal-overlay");
    const input = withinDialog(window, ".be-modal-input");
    // press inside, release over the backdrop
    input.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
    ov.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.strictEqual(overlays(window).length, 1, "still open");
    withinDialog(window, ".be-modal-cancel").click();
    await p;
  });
});

describe("AC-3 — focus lifecycle", function () {
  it("moves focus into the dialog on open, and traps it at both ends", async function () {
    const { window } = boot();
    const p = window.Modals.showInputModal("T", "M", "seed");
    const modal = dialogRoot(window);
    const input = withinDialog(window, ".be-modal-input");

    assert.ok(modal.contains(window.document.activeElement), "focus starts inside the dialog");
    assert.strictEqual(window.document.activeElement, input, "and lands in the field, not the X");

    // The focusable set, in DOM order, is what the trap cycles through.
    const items = Array.from(
      modal.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])'),
    );
    assert.ok(items.length >= 2, "there is more than one focusable to cycle");

    // forward wrap: last -> first
    const last = items[items.length - 1];
    last.focus();
    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
    );
    assert.strictEqual(window.document.activeElement, items[0], "Tab from last wraps to first");

    // backward wrap: first -> last
    items[0].focus();
    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    assert.strictEqual(
      window.document.activeElement,
      last,
      "Shift+Tab from first wraps to last",
    );

    await CLOSERS.Cancel(window, p);
  });

  it("pulls focus back if it has escaped the dialog", async function () {
    const { window } = boot();
    const p = window.Modals.showInputModal("T", "M", "seed");
    const outside = window.document.createElement("button");
    outside.id = "outside";
    window.document.body.appendChild(outside);
    outside.focus();
    assert.strictEqual(window.document.activeElement, outside, "focus really escaped");

    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
    );
    assert.ok(
      dialogRoot(window).contains(window.document.activeElement),
      "the trap pulled focus back inside",
    );
    await CLOSERS.Cancel(window, p);
  });

  it("restores focus to the invoking element on EVERY close path", async function () {
    for (const pathName of Object.keys(CLOSERS)) {
      const { window } = boot();
      const invoker = window.document.createElement("button");
      invoker.id = "invoker";
      window.document.body.appendChild(invoker);
      invoker.focus();
      assert.strictEqual(window.document.activeElement, invoker);

      const p = window.Modals.showInputModal("T", "M", "seed");
      assert.notStrictEqual(window.document.activeElement, invoker, "focus left the invoker");
      await CLOSERS[pathName](window, p);

      assert.strictEqual(
        window.document.activeElement,
        invoker,
        "focus restored via " + pathName,
      );
    }
  });

  it("does not throw, and does not strand focus, when the invoker was removed", async function () {    const { window } = boot();
    const invoker = window.document.createElement("button");
    window.document.body.appendChild(invoker);
    invoker.focus();

    const p = window.Modals.showInputModal("T", "M", "seed");
    invoker.remove(); // e.g. the layer was deleted from under its own rename box

    await CLOSERS.Cancel(window, p);
    assert.strictEqual(overlays(window).length, 0, "closed without throwing");
    assert.ok(window.document.activeElement, "focus is somewhere defined");
    assert.notStrictEqual(
      window.document.activeElement,
      invoker,
      "focus was not left on the detached node",
    );
  });
});

describe("AC-4 — an empty submit is explained; cancel stays distinguishable", function () {
  it("rejects an empty submit, shows a message and keeps the dialog open", async function () {
    const { window } = boot();
    let settled = false;
    const p = window.Modals.showInputModal("T", "M", "").then((v) => {
      settled = true;
      return v;
    });
    withinDialog(window, ".be-modal-input").value = "";
    withinDialog(window, ".be-modal-ok").click();

    assert.strictEqual(overlays(window).length, 1, "the dialog stays open");
    assert.strictEqual(settled, false, "the promise has not resolved");
    const msg = withinDialog(window, ".be-modal-message");
    assert.ok(msg.textContent.trim().length > 0, "a validation message is shown");
    assert.ok(
      msg.classList.contains("be-modal-message-error"),
      "and it is marked as an error",
    );
    assert.strictEqual(msg.getAttribute("role"), "status", "and it is announced");

    await CLOSERS.Cancel(window, p);
  });

  it("treats a whitespace-only submit the same way", async function () {
    const { window } = boot();
    const p = window.Modals.showInputModal("T", "M", "   ");
    withinDialog(window, ".be-modal-ok").click();
    assert.strictEqual(overlays(window).length, 1, "still open");
    assert.ok(withinDialog(window, ".be-modal-message").textContent.trim().length > 0);
    await CLOSERS.Cancel(window, p);
  });

  it("resolves the TRIMMED value on a valid submit", async function () {
    const { window } = boot();
    const p = window.Modals.showInputModal("T", "M", "  Padded Name  ");
    withinDialog(window, ".be-modal-ok").click();
    assert.strictEqual(await p, "Padded Name");
  });

  it("resolves null (not an empty string) on cancel", async function () {
    const { window } = boot();
    const p = window.Modals.showInputModal("T", "M", "seed");
    const v = await CLOSERS.Cancel(window, p);
    assert.strictEqual(v, null);
    assert.notStrictEqual(v, "", "null and '' are distinguishable");
  });

  it("marks the message as an ERROR and the field aria-invalid, then clears on typing", async function () {
    const { window } = boot();
    const p = window.Modals.showInputModal("T", "Description text", "");
    const msg = () => withinDialog(window, ".be-modal-message");
    const input = () => withinDialog(window, ".be-modal-input");

    // before: ordinary description styling, no error class, field not invalid
    assert.ok(!msg().classList.contains("be-modal-message-error"), "not an error yet");
    assert.strictEqual(input().getAttribute("aria-invalid"), null, "field not marked");

    withinDialog(window, ".be-modal-ok").click();
    // after a rejected submit: the message is an ERROR and the field is marked,
    // so the state is unmistakable to the eye and to assistive tech — the
    // phase-1 visual gate rejected a version where this looked like help text
    assert.ok(
      msg().classList.contains("be-modal-message-error"),
      "the message is flagged as an error",
    );
    assert.strictEqual(input().getAttribute("aria-invalid"), "true", "the field is marked invalid");

    // typing is an attempt to fix it: the error state clears rather than nagging
    input().value = "x";
    input().dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.strictEqual(input().getAttribute("aria-invalid"), null, "mark cleared");
    assert.ok(
      !msg().classList.contains("be-modal-message-error"),
      "error styling cleared while the user corrects it",
    );

    await CLOSERS.Cancel(window, p);
  });

  it("Enter submits, and an empty Enter still validates", async function () {
    const { window } = boot();
    const p = window.Modals.showInputModal("T", "M", "typed");
    const input = withinDialog(window, ".be-modal-input");
    input.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    assert.strictEqual(await p, "typed");

    const p2 = window.Modals.showInputModal("T", "M", "");
    withinDialog(window, ".be-modal-input").dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    assert.strictEqual(overlays(window).length, 1, "empty Enter keeps it open");
    await CLOSERS.Cancel(window, p2);
  });
});

describe("AC-5 — the fallback dialog is honest (U-23)", function () {
  it("says the DOWNLOAD failed rather than implying a generic problem", function () {
    const { window } = boot();
    window.Modals.showFallbackModal('{"a":1}');
    const msg = withinDialog(window, ".be-modal-message");
    assert.match(msg.textContent, /DOWNLOAD/i, "names the download failure");
    assert.match(msg.textContent, /Copy the data/i, "and says what to do about it");
  });

  it("does not use the deprecated synchronous clipboard command", function () {
    // Strip comments first: the new code NAMES the deprecated call in a comment
    // explaining why it is gone, and a naive regex matches that comment — which
    // is how this assertion first reported a false failure.
    const code = MODALS.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.ok(
      !/document\.execCommand\(\s*["']copy["']\s*\)/.test(code),
      "execCommand('copy') is gone from js/modals.js (code, not comments)",
    );
    assert.match(code, /clipboard\.writeText/, "the async clipboard API is used");
  });

  it("falls back to selecting the text and saying so, when the API is unavailable", async function () {
    const { window } = boot();
    // no navigator.clipboard in this jsdom: the manual path must be taken
    assert.ok(!(window.navigator && window.navigator.clipboard), "clipboard is absent");
    window.Modals.showFallbackModal('{"a":1}');
    withinDialog(window, ".be-modal-ok").click();
    const msg = withinDialog(window, ".be-modal-message");
    assert.match(
      msg.textContent,
      /Ctrl\/Cmd\+C|copy it/i,
      "the user is told to copy manually: " + msg.textContent,
    );
    const btn = withinDialog(window, ".be-modal-ok");
    assert.notStrictEqual(
      btn.textContent,
      "Copied!",
      "it does NOT claim success when nothing was copied",
    );
  });

  it("uses the async API when it IS available, and says so", async function () {
    const { window } = boot();
    let written = null;
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: (t) => { written = t; return Promise.resolve(); } },
    });
    window.Modals.showFallbackModal('{"b":2}');
    withinDialog(window, ".be-modal-ok").click();
    await new Promise((r) => setTimeout(r, 0));
    assert.strictEqual(written, '{"b":2}', "the JSON was written to the clipboard");
    assert.strictEqual(withinDialog(window, ".be-modal-ok").textContent, "Copied!");
  });
});

describe("AC-6 — the listener-leak invariant, instrumented", function () {
  const OPENS = {
    input: (w) => w.Modals.showInputModal("T", "M", "seed"),
  };

  for (const [label, open] of Object.entries(OPENS)) {
    for (const pathName of Object.keys(CLOSERS)) {
      it(label + " leaks nothing when closed via " + pathName, async function () {
        const { window, probe } = boot();
        const before = probe.snapshot();
        const p = open(window);
        const seen = probe.snapshot();
        assert.ok(
          trackedModalEvents(seen) > 0,
          "the registry really saw the dialog's listeners (otherwise this is vacuous)",
        );
        // ...and it saw them at BOTH levels the primitive actually uses. If the
        // element-level instrumentation silently did nothing, (b) below would
        // pass vacuously — which is exactly what happened when a bad edit
        // detached the wrapper and the probe reported an empty registry.
        // (No `window` level: the primitive deliberately keeps its Esc/trap
        // listener on `document`, which is the point of the 1.11.3 lesson.)
        assert.deepStrictEqual(
          trackedLevels(seen),
          ["document", "element"],
          "listeners were observed on the document and element levels: " +
            JSON.stringify(seen),
        );
        await CLOSERS[pathName](window, p);

        // THE INVARIANT, stated precisely (GATE 3 directive 2):
        // (a) nothing may remain attached to a LONG-LIVED target — window or
        //     document — because that is the leak that can actually fire later;
        const residual = diffModalEvents(before, probe.snapshot());
        const longLivedResidual = Object.fromEntries(
          Object.entries(residual).filter(([key]) => !key.startsWith("element:")),
        );
        assert.deepStrictEqual(
          longLivedResidual,
          {},
          "residual window/document listeners after " + pathName,
        );
        // (b) any handler still attached to an ELEMENT must sit on a node that is
        //     no longer in the document — detached, so it cannot fire and is
        //     collectable. A still-connected element holding a handler would be a
        //     genuine leak.
        assert.deepStrictEqual(
          probe.connectedElementsWithHandlers(),
          [],
          "a CONNECTED element still holds a handler after " + pathName,
        );
      });
    }

    it(label + " accumulates nothing over 5 open/close cycles", async function () {
      const { window, probe } = boot();
      const before = probe.snapshot();
      for (let i = 0; i < 5; i++) {
        const p = open(window);
        await CLOSERS["close X"](window, p);
      }
      const residual = diffModalEvents(before, probe.snapshot());
      assert.deepStrictEqual(
        Object.fromEntries(
          Object.entries(residual).filter(([key]) => !key.startsWith("element:")),
        ),
        {},
        "no accumulation on window/document after 5 cycles",
      );
      assert.deepStrictEqual(
        probe.connectedElementsWithHandlers(),
        [],
        "no connected element holds a handler after 5 cycles",
      );
    });
  }

  it("teardown is owned by exactly ONE close path (no duplicate, no bypass)", async function () {
    const { window } = boot();
    // Count how many times the overlay is actually detached: every close path
    // must funnel through the single close() exactly once.
    let removals = 0;
    const realRemove = window.HTMLElement.prototype.remove;
    window.HTMLElement.prototype.remove = function () {
      if (this.classList && this.classList.contains("be-modal-overlay")) removals++;
      return realRemove.apply(this, arguments);
    };
    const p = window.Modals.showInputModal("T", "M", "seed");

    // Two close attempts on the same dialog: the second must be a no-op. The
    // OK button is detached by then, so the second attempt is an Esc (which the
    // primitive still has a live handler for until it tears itself down).
    withinDialog(window, ".be-modal-close").click();
    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await p;
    assert.strictEqual(removals, 1, "the dialog was torn down exactly once");
    assert.deepStrictEqual(
      diffModalEvents({}, { "document:keydown": 0 }),
      {},
      "sanity: the diff helper reports nothing for a zero count",
    );
    window.HTMLElement.prototype.remove = realRemove;
  });
});
