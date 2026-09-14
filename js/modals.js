/**
 * Modal toolkit: input/slider/border-picker/fallback modals and the
 * transient feedback toast.
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 11 (split A). Pure-DOM,
 * zero main-closure deps — loaded before js/main.js in the production
 * script list (js/background.js) and in the shared test harness boot.
 */

"use strict";

/**
 * The ONE modal primitive (track modal_primitive_20260910).
 *
 * Every dialog in this module is built by `createModal`. Before this, each one
 * hand-rolled its own overlay, title and buttons, and they had drifted apart:
 * a live audit found `role=dialog` on only 3 of the 10 modal surfaces in the
 * extension, a close X on 3, focus restore on 1, and none of the three dialogs
 * in this file had any of it. A consultant's ruling is the reason there is one
 * constructor instead of three "fixed" dialogs: converting them one at a time
 * "would ship a half-baked modal system that leaks listeners on every surface".
 *
 * It owns: the overlay + shell classes (so the locked 1.8.0 ornament contract
 * applies automatically), `role=dialog` + `aria-modal` + an accessible name,
 * a close X, backdrop cancel, Esc, focus moved in on open, focus trapped while
 * open, focus restored to the invoker on close, and — the part that is easy to
 * get wrong and is invisible to behaviour tests — EXACTLY ONE close path, so no
 * listener can survive a close. That last property is why the listener-leak
 * invariant is asserted by instrumenting add/removeEventListener rather than by
 * reading this code.
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

let modalSeq = 0;

/** Focusable descendants, in DOM order. */
function focusableWithin(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));
}

/**
 * @param {object} opts
 * @param {string} opts.title                    dialog title (its accessible name)
 * @param {(ctx: object) => void} [opts.body]    fills the body area
 * @param {(ctx: object) => void} [opts.actions] fills the action row
 * @returns {object} handle { overlay, modal, close, setMessage, clearMessage, promise }
 */
function createModal(opts) {
  const { title, body, actions, role, id } = opts;
  const overlay = document.createElement("div");
  overlay.className = "be-modal-overlay";
  // Some overlays carry an id for a reason beyond tests: #print-enhance-overlay
  // is the selector js/controls.js uses to hide this dialog in print.
  if (id) overlay.id = id;

  const modal = document.createElement("div");
  modal.className = "be-modal";
  modal.setAttribute("role", role || "dialog");
  modal.setAttribute("aria-modal", "true");

  // The title IS the accessible name: an aria-modal dialog with no name is
  // announced as an unlabelled dialog, which is barely better than nothing.
  const titleId = "be-modal-title-" + ++modalSeq;
  const h3 = document.createElement("h3");
  h3.id = titleId;
  h3.textContent = title;
  modal.setAttribute("aria-labelledby", titleId);
  modal.appendChild(h3);

  // Inline message area (validation errors / explanatory copy). A live region,
  // so a rejected submit is ANNOUNCED and not merely shown.
  const message = document.createElement("p");
  message.className = "be-modal-message";
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  modal.appendChild(message);

  const bodyEl = document.createElement("div");
  bodyEl.className = "be-modal-body";
  modal.appendChild(bodyEl);

  const actionsRow = document.createElement("div");
  actionsRow.className = "be-modal-actions";
  modal.appendChild(actionsRow);

  const closeBtn = document.createElement("button");
  closeBtn.className = "be-modal-close";
  closeBtn.type = "button";
  closeBtn.textContent = "\u2715";
  closeBtn.setAttribute("aria-label", "Close dialog");
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);

  const ctx = { overlay, modal, title: h3, bodyEl, actionsRow, closeBtn, message, close };
  if (body) body(ctx);
  if (actions) actions(ctx);

  // ---- focus lifecycle -----------------------------------------------------
  // Captured BEFORE the dialog takes focus, so a close can hand focus back to
  // whatever the user was on.
  const invoker =
    document.activeElement && document.activeElement !== document.body
      ? document.activeElement
      : null;

  let settled = false;
  let resolveFn = null;
  let onKeyDown = null;
  let downOnOverlay = false;

  // Backdrop cancel. Tracked from mousedown so a drag that STARTS inside the
  // dialog and ENDS on the backdrop does not count as a cancel.
  function onOverlayMouseDown(e) {
    downOnOverlay = e.target === overlay;
  }
  function onOverlayClick(e) {
    if (e.target === overlay && downOnOverlay) close(null);
    downOnOverlay = false;
  }

  function restoreFocus() {
    // The invoker may have been removed while the dialog was open (a layer can
    // be deleted from under its own rename box). Focusing a detached node
    // silently does nothing, leaving focus stranded, so fall back deliberately.
    if (invoker && invoker.isConnected && typeof invoker.focus === "function") {
      invoker.focus();
      return;
    }
    if (document.body && typeof document.body.focus === "function") {
      document.body.focus();
    }
  }

  /** The single close path. Every affordance funnels here exactly once. */
  function close(result) {
    if (settled) return;
    settled = true;
    if (onKeyDown) {
      document.removeEventListener("keydown", onKeyDown, true);
      onKeyDown = null;
    }
    overlay.removeEventListener("mousedown", onOverlayMouseDown);
    overlay.removeEventListener("click", onOverlayClick);
    closeBtn.removeEventListener("click", onCloseClick);
    overlay.remove();
    restoreFocus();
    if (resolveFn) resolveFn(result);
  }

  function onCloseClick() {
    close(null);
  }
  closeBtn.addEventListener("click", onCloseClick);
  overlay.addEventListener("mousedown", onOverlayMouseDown);
  overlay.addEventListener("click", onOverlayClick);

  // Esc + the focus trap, captured on `document` so the trap still holds when
  // focus has escaped the dialog.
  onKeyDown = function (e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close(null);
      return;
    }
    if (e.key !== "Tab") return;
    const items = focusableWithin(modal);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (!modal.contains(active)) {
      // focus escaped (or never entered): pull it back to the boundary
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", onKeyDown, true);

  const promise = new Promise((r) => {
    resolveFn = r;
  });

  document.body.appendChild(overlay);
  // Land in the body content, not on the close X: for a form dialog the user
  // should end up in the field.
  const initial = focusableWithin(modal).filter((el) => el !== closeBtn);
  if (initial.length) initial[0].focus();

  const handle = {
    overlay,
    modal,
    close,
    setMessage(text, isError) {
      message.textContent = text || "";
      message.classList.toggle("be-modal-message-error", !!isError);
      message.style.display = text ? "" : "none";
      // Mark the field, not just the message: aria-invalid is both the
      // accessible signal and the style hook (.be-modal [aria-invalid="true"]),
      // so an error is announced and seen through the same attribute.
      const field = modal.querySelector("input, textarea");
      if (field) {
        if (isError) field.setAttribute("aria-invalid", "true");
        else field.removeAttribute("aria-invalid");
      }
    },
    clearMessage() {
      message.textContent = "";
      message.classList.remove("be-modal-message-error");
      message.style.display = "none";
    },
    get isOpen() {
      return !settled;
    },
    promise,
  };
  // Hide the message area unless the body builder filled it. Calling
  // clearMessage() unconditionally here would wipe a message the dialog had
  // deliberately set (the fallback card sets its explanatory copy during
  // construction) — so the initial state is derived, not forced blank.
  if (!message.textContent) {
    message.style.display = "none";
  } else {
    message.style.display = "";
  }
  return handle;
}

function showInputModal(title, message, defaultValue) {
  let input;
  const handle = createModal({
    title,
    body(ctx) {
      if (message) ctx.message.textContent = message;

      input = document.createElement("input");
      input.type = "text";
      input.className = "be-modal-input";
      input.value = defaultValue === undefined ? "" : defaultValue;
      ctx.bodyEl.appendChild(input);

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "be-modal-cancel";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";
      ctx.actionsRow.appendChild(cancelBtn);
      cancelBtn.addEventListener("click", () => handle.close(null));

      const okBtn = document.createElement("button");
      okBtn.className = "be-modal-ok";
      okBtn.type = "button";
      okBtn.textContent = "Continue";
      ctx.actionsRow.appendChild(okBtn);
      okBtn.addEventListener("click", submit);

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          submit();
        }
      });
      // Typing is an attempt to fix it: drop the error state rather than
      // nagging while the user is mid-correction.
      input.addEventListener("input", () => {
        if (input.getAttribute("aria-invalid") === "true") {
          input.removeAttribute("aria-invalid");
          handle.clearMessage();
        }
      });
    },
  });

  /**
   * Validate, then close. An empty value used to close the dialog and do
   * NOTHING at all: the user could not tell whether the app had ignored them or
   * rejected the value, and the caller just saw a falsy result and returned
   * quietly (audit U-16/U-21). Now the dialog stays open and says why.
   */
  function submit() {
    const trimmed = input ? input.value.trim() : "";
    if (!trimmed) {
      handle.setMessage("Enter a name to continue \u2014 the field cannot be empty.", true);
      if (input) input.focus();
      return;
    }
    handle.close(trimmed);
  }

  if (input && typeof input.select === "function") input.select();
  return handle.promise;
}

/**
 * In-app confirmation, replacing the native `confirm()` (U-36).
 *
 * WHY THIS EXISTS
 * Ten destructive paths still called the browser's own `confirm()`: deleting a
 * shape layer and its contents, batch-deleting selected shapes, deleting
 * sections/clones/shapes, applying a template over existing shapes. A native
 * confirm is unstyled, announced as browser chrome rather than as part of the
 * product, cannot be themed, and — the part that actually matters — a user who
 * has ticked "prevent this page from creating additional dialogs" gets **no
 * dialog at all**, so the handler proceeds with `undefined` and the delete is
 * silently skipped, or worse, silently performed depending on the branch. A
 * destructive action must not be able to fail that way.
 *
 * Built on the shared primitive, so it gets the same one-close-path guarantee,
 * focus handling and escape/backdrop/✕ dismissal as every other dialog.
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.confirmLabel]
 * @param {string} [opts.cancelLabel]
 * @param {boolean} [opts.danger]  styles the confirm button as destructive
 * @returns {Promise<boolean>}     true only when the user confirms
 */
function confirmAction(opts) {
  const {
    title,
    message,
    confirmLabel = "Continue",
    cancelLabel = "Cancel",
    danger = false,
  } = opts || {};

  const handle = createModal({
    title,
    body(ctx) {
      if (message) ctx.message.textContent = message;

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "be-modal-cancel";
      cancelBtn.type = "button";
      cancelBtn.textContent = cancelLabel;
      ctx.actionsRow.appendChild(cancelBtn);
      cancelBtn.addEventListener("click", () => handle.close(false));

      const okBtn = document.createElement("button");
      okBtn.className = "be-modal-ok" + (danger ? " be-modal-danger" : "");
      okBtn.type = "button";
      okBtn.textContent = confirmLabel;
      ctx.actionsRow.appendChild(okBtn);
      okBtn.addEventListener("click", () => handle.close(true));
    },
  });

  // Every close path that is NOT the confirm button resolves false, which is the
  // safe direction for a destructive action: a dialog the user simply dismissed
  // must never be read as consent.
  return handle.promise.then((result) => result === true);
}

function showFallbackModal(jsonData) {
  let textarea;
  let copyBtn;
  const handle = createModal({
    title: "Layout JSON Data",
    // preserved: this id is the print-hide selector in js/controls.js
    id: "print-enhance-overlay",
    body(ctx) {
      ctx.message.textContent =
        "The layout file could not be DOWNLOADED, so nothing was saved to your " +
        "computer. Copy the data below to keep it, then paste it into a .json " +
        "file yourself.";
      ctx.message.classList.add("be-modal-message-error");

      textarea = document.createElement("textarea");
      textarea.className = "be-modal-json";
      textarea.value = jsonData;
      textarea.readOnly = true;
      textarea.setAttribute("aria-label", "Layout JSON data");
      ctx.bodyEl.appendChild(textarea);

      const doneBtn = document.createElement("button");
      doneBtn.className = "be-modal-cancel";
      doneBtn.type = "button";
      doneBtn.textContent = "Close";
      ctx.actionsRow.appendChild(doneBtn);
      doneBtn.addEventListener("click", () => handle.close(null));

      copyBtn = document.createElement("button");
      copyBtn.className = "be-modal-ok";
      copyBtn.type = "button";
      copyBtn.textContent = "Copy to Clipboard";
      ctx.actionsRow.appendChild(copyBtn);
      copyBtn.addEventListener("click", copyJson);
    },
  });

  /**
   * Copy, without the deprecated synchronous command and without pretending it
   * worked. document.execCommand("copy") is deprecated and returns false when
   * the browser refuses; the async clipboard API needs a secure context. When
   * neither is usable the honest move is to select the text and say so, rather
   * than to flash "Copied!" over a no-op.
   */
  function copyJson() {
    const value = textarea ? textarea.value : "";
    const label = "Copy to Clipboard";
    const flash = (text, isError) => {
      if (!copyBtn) return;
      copyBtn.textContent = text;
      copyBtn.classList.toggle("be-modal-message-error", !!isError);
      setTimeout(() => {
        copyBtn.textContent = label;
        copyBtn.classList.remove("be-modal-message-error");
      }, 2000);
    };
    const manual = () => {
      if (textarea && typeof textarea.select === "function") textarea.select();
      handle.setMessage(
        "This browser would not let the page copy automatically \u2014 the text " +
          "is selected, press Ctrl/Cmd+C to copy it.",
        true,
      );
      flash("Copy manually", true);
    };
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
      nav.clipboard.writeText(value).then(
        () => flash("Copied!"),
        () => manual(),
      );
      return;
    }
    manual();
  }

  return handle;
}

/**
 * How many NON-error toasts may stack before the oldest one is evicted (AC-1,
 * U-11). Errors are deliberately outside this cap — see the eviction block in
 * `showFeedback` for why.
 */
const FEEDBACK_CAP = 3;

/** The lane's locked anchor and spacing. */
const FEEDBACK_LANE_TOP = 36;
const FEEDBACK_LANE_GAP = 6;

/**
 * The polite live region that reports a DISMISSAL (AC-1). A dismissed toast
 * cannot announce its own removal, because the element is gone by the time the
 * screen reader would read it — so the removal is mirrored here instead. Kept
 * out of the `.be-feedback` class so it never counts as a toast.
 */
function announceDismissal(msg) {
  let lane = document.getElementById("be-feedback-announcer");
  if (!lane) {
    lane = document.createElement("div");
    lane.id = "be-feedback-announcer";
    lane.setAttribute("role", "status");
    lane.setAttribute("aria-live", "polite");
    // Visually hidden, but NOT `display:none` / `visibility:hidden`, which would
    // take it out of the accessibility tree and make the announcement a no-op.
    lane.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;" +
      "overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);" +
      "white-space:nowrap;border:0";
    document.body.appendChild(lane);
  }
  lane.textContent = `${msg} \u2014 dismissed`;
}

/**
 * Lay the toast lane out top-to-bottom.
 *
 * WHY THIS EXISTS (measured, Phase 1 of feedback_lifecycle_a11y_20260910): every
 * toast is `position: fixed` at the SAME anchor (top 36, left 50% centred), so
 * with two or more on screen they were drawn on top of EACH OTHER — the live DOM
 * read showed five toasts all at `top: 36, height: 38`. Only the last-painted
 * one was fully visible, which made the earlier toasts' dismiss controls
 * unclickable (a covered button is not a button) and made an evicted-error claim
 * impossible to see in a frame. The locked recipe — pill radius, grounds, brass
 * tick, drain bar — is untouched; only the lane's vertical offsets are computed.
 */
function layoutFeedbackLane() {
  const toasts = Array.from(document.querySelectorAll(".be-feedback"));
  let y = FEEDBACK_LANE_TOP;
  toasts.forEach((el) => {
    const h = el.getBoundingClientRect().height || 38;
    el.style.setProperty("top", `${y}px`, "important");
    y += h + FEEDBACK_LANE_GAP;
  });
}

/**
 * AC-5 (U-17): a persistent "nothing found" dialog.
 *
 * WHY THIS EXISTS
 * "No clones found", "No available targets found" and "No compact-compatible
 * sections found" were `showFeedback()` calls, so they expired after 3 seconds. A
 * user who looked away came back to a sheet that simply had not changed, with no
 * explanation of why nothing happened. This is the same message in a dialog that
 * stays until it is dismissed, plus a next-step hint — and it is built on the
 * shared `createModal` primitive, so it carries the locked shell, `role=dialog`,
 * an accessible name, a close ✕, backdrop cancel, Esc and focus handling without
 * a second hand-rolled overlay.
 *
 * @param {{title?:string, message?:string, hint?:string, confirmLabel?:string}} opts
 * @returns {Promise<null>} resolves when the dialog is dismissed.
 */
function showEmptyStateDialog(opts) {
  const o = opts || {};
  const handle = createModal({
    title: o.title || "Nothing to show",
    body(ctx) {
      if (o.message) ctx.message.textContent = o.message;
      if (o.hint) {
        const hint = document.createElement("p");
        hint.className = "be-modal-hint";
        hint.textContent = o.hint;
        ctx.bodyEl.appendChild(hint);
      }
      const ok = document.createElement("button");
      ok.className = "be-modal-ok";
      ok.type = "button";
      // AC-8: the informational dialog's single control is an affirmative
      // commit, so it uses the ratified commit verb like every other one.
      ok.textContent = o.confirmLabel || "Continue";
      ctx.actionsRow.appendChild(ok);
      ok.addEventListener("click", () => handle.close(null));
    },
  });
  return handle.promise;
}

/**
 * Toast feedback.
 * @param {string} msg
 * @param {"info"|"success"|"error"} [type] AC-3 (U-10): the type is honoured —
 *   errors get the ember/oxblood treatment and an alert glyph so a failure can
 *   never be mistaken for a success. The toast is a live region so screen
 *   readers announce it (a failure that is never announced is the same as no
 *   feedback at all).
 *   AC-1 (U-11): every toast carries a dismiss control, and the stack cap can
 *   never discard an error toast.
 */
function showFeedback(msg, type) {
  const kind = type === "error" ? "error" : type === "success" ? "success" : "info";
  const feedback = document.createElement("div");
  feedback.className = `be-feedback be-feedback-${kind}`;
  feedback.setAttribute("role", kind === "error" ? "alert" : "status");
  feedback.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
  // Round-5/6 toast: charcoal pill over the sheet canvas, 3px brass tick +
  // drain bar. Icon/tick markup is empty of text so textContent == msg.
  const tick = document.createElement("span");
  tick.className = `be-feedback-tick be-feedback-tick-${kind}`;
  tick.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.className = "be-feedback-msg";
  const plain =
    kind === "error" ? `\u26A0\uFE0F ${msg}` : kind === "success" ? `\u2713 ${msg}` : msg;
  text.textContent = plain;
  const drain = document.createElement("span");
  drain.className = `be-feedback-drain be-feedback-drain-${kind}`;
  drain.setAttribute("aria-hidden", "true");
  feedback.appendChild(tick);
  feedback.appendChild(text);
  feedback.appendChild(drain);
  feedback.style.position = "fixed";
  feedback.style.top = `${FEEDBACK_LANE_TOP}px`;
  feedback.style.left = "50%";
  feedback.style.transform = "translateX(-50%)";
  feedback.style.display = "flex";
  feedback.style.alignItems = "center";
  feedback.style.gap = "8px";

  // AC-1 (U-11): the stack cap applies to NON-error toasts only. It used to
  // slice the FRONT of the list — the oldest — regardless of type, so a rapid
  // sequence (save → error → save → error) could discard a FAILURE notice the
  // user had not read yet. An error now leaves only by its own dwell, by its
  // dismiss control, or not at all; that is the one rule this track's AC-1
  // asserts by count.
  const existing = Array.from(document.querySelectorAll(".be-feedback"));
  const nonErrors = existing.filter((el) => !el.classList.contains("be-feedback-error"));
  if (kind !== "error" && nonErrors.length >= FEEDBACK_CAP) {
    // Keep the newest (FEEDBACK_CAP - 1) plus the toast being added.
    nonErrors
      .slice(0, nonErrors.length - (FEEDBACK_CAP - 1))
      .forEach((el) => el.remove());
    layoutFeedbackLane();
  }

  // Dismiss control (AC-1): a real <button> so it is Tab-reachable and operable
  // by Enter/Space, labelled for assistive tech, and it removes THIS toast while
  // leaving the others alone.
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "be-feedback-dismiss";
  dismiss.setAttribute("aria-label", `Dismiss notification: ${msg}`);
  dismiss.textContent = "\u2715";
  feedback.appendChild(dismiss);

  document.body.appendChild(feedback);
  // Stack the lane (see layoutFeedbackLane): without this the toasts would all
  // sit at the same anchor and cover each other's dismiss controls.
  layoutFeedbackLane();

  const hide = () => {
    feedback.style.transition = "opacity 0.5s";
    feedback.style.opacity = "0";
    setTimeout(() => {
      feedback.remove();
      layoutFeedbackLane();
    }, 500);
  };
  const removeNow = (announce) => {
    clearTimeout(hideTimer);
    if (announce) announceDismissal(msg);
    feedback.remove();
    layoutFeedbackLane();
  };
  // Pause drain + hide while hovered (round 6).
  let hideTimer = setTimeout(hide, 3000);
  feedback.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  feedback.addEventListener("mouseleave", () => {
    hideTimer = setTimeout(hide, 1200);
  });
  dismiss.addEventListener("click", (e) => {
    e.stopPropagation();
    removeNow(true);
  });
  // Escape dismisses while the control (or the toast itself) has focus — the
  // keyboard equivalent of clicking ✕.
  feedback.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      removeNow(true);
    }
  });
  setTimeout(() => {
    drain.style.width = "0%";
  }, 30);

  return feedback;
}


/**
 * The UNDO OFFER (track destructive_recovery_20260911, AC-3).
 *
 * A destructive action that just happened gets one control that reverses it. This
 * lives in the feedback lane because that is where the product already tells the
 * user what it did, so the offer arrives WITH the news rather than somewhere the
 * user has to go looking (the whole point of AC-3/AC-4: recovery was previously
 * reachable only from a load FAILURE).
 *
 * LIFETIME, and why it is honest: the offer lives `ms` then REMOVES ITSELF. An
 * expired offer is not merely inert — it is gone from the DOM, so a Tab walk cannot
 * reach a control that would silently do nothing. The owner (js/persistence.js)
 * clears it early on the next destructive action; `onExpire` fires exactly once
 * either way.
 *
 * Returns { close, isLive, control } so the owner can drive and assert it.
 */
function showUndoToast(label, onInvoke, opts = {}) {
  const ms = typeof opts.ms === "number" ? opts.ms : 8000;
  let live = true;
  let timer = null;

  const feedback = document.createElement("div");
  feedback.className = "be-feedback be-feedback-undo";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");

  const text = document.createElement("span");
  text.className = "be-feedback-msg";
  text.textContent = label;
  feedback.appendChild(text);

  const undo = document.createElement("button");
  undo.type = "button";
  // NOTE the name: the TOAST is `be-feedback-undo` (the lane's kind suffix, like
  // `be-feedback-error`), so the control must NOT share it — a shared class made
  // `querySelector(".be-feedback-undo")` match the container and return the label
  // text instead of the button.
  undo.className = "be-feedback-undo-btn";
  undo.textContent = "Undo";
  undo.setAttribute("aria-label", `Undo: ${label}`);
  feedback.appendChild(undo);

  const done = (reason) => {
    if (!live) return;
    live = false;
    if (timer) clearTimeout(timer);
    feedback.remove();
    layoutFeedbackLane();
    if (typeof opts.onExpire === "function") opts.onExpire(reason);
  };

  undo.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!live) return;
    // Close the offer BEFORE invoking: an undo is a one-shot, and leaving the
    // control up would invite a second click on a spent action.
    done("invoked");
    onInvoke();
  });

  // POSITIONING — measured defect caught by the phase-2 visual gate: without these the
  // toast inherits `position: relative` from the `.be-feedback` stylesheet rule, so it
  // FLOWED in the document and landed at top=5549px, i.e. thousands of pixels below the
  // 900px viewport. The offer existed, was styled, was reachable by code — and was
  // invisible to the user. It must be a fixed overlay like every other toast.
  feedback.style.position = "fixed";
  feedback.style.top = `${FEEDBACK_LANE_TOP}px`;
  feedback.style.left = "50%";
  feedback.style.transform = "translateX(-50%)";
  feedback.style.display = "flex";
  feedback.style.alignItems = "center";
  feedback.style.gap = "8px";

  document.body.appendChild(feedback);
  layoutFeedbackLane();
  timer = setTimeout(() => done("expired"), ms);

  return {
    close: done,
    isLive: () => live,
    control: undo,
    element: feedback,
  };
}

const Modals = {
  // Internal seam (track modal_primitive_20260910). js/persistence.js is loaded
  // BEFORE this file in both js/background.js and the shared test harness, so it
  // cannot reference createModal directly — it resolves this at call time via
  // window.Modals. Not public API; named with __ to say so.
  __createModal: createModal,
  confirmAction,
  showInputModal,
  showFallbackModal,
  showFeedback,
  // AC-3 (destructive_recovery_20260911): the one-control undo offer.
  showUndoToast,
  // AC-5 (U-17): the persistent empty-state dialog. Called from js/main.js's
  // three "nothing found" paths.
  showEmptyStateDialog,
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = Modals;
}
if (typeof window !== "undefined") {
  window.Modals = Modals;
  // Convenience seam for the non-modular callers (js/dom/layer_manager.js,
  // js/main.js, js/section_cloning.js, js/catalog_service.js), which are loaded
  // BEFORE this file and therefore resolve it at call time.
  window.confirmAction = confirmAction;
}
