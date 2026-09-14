/**
 * The recovery surfaces: the restore browser, the boot-time failure card, the destructive
 * confirmation, and the destructive gate (track refactor_surface_20260911, AC-4).
 *
 * WHY THE GATE IS HERE. The gate is not an undo concern: it writes the BACKUP record (the
 * cross-reload net) and hands the action's live pre-state to the undo offer. Recovery is what it
 * is for, which is why the backup-writing call it makes is `window.createBackupSnapshot` —
 * resolved at call time, like every other cross-module seam here.
 *
 * The restore paths deliberately do NOT push an undo record (the feedback-loop exclusion): only
 * `js/undo.js`'s `pushUndo` pushes, and nothing in this module calls it.
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
/**
 * The restore surface (AC-4): every backup, newest first, with what it was and when,
 * one control per row. Built on the SHARED modal primitive — this track adds no modal
 * surface (the parent audit's guardrail).
 */
function showRestoreSurface(opts) {
  opts = opts || {};
  const api = window.Modals;
  if (!api || typeof api.__createModal !== "function") {
    if (window.showFeedback) {
      window.showFeedback(
        "The restore dialog could not be shown. Reload the page and try again.",
        "error",
      );
    }
    return null;
  }
  const handle = api.__createModal({
    title: opts.title || "Restore a backup",
    body(ctx) {
      const status = document.createElement("div");
      status.className = "be-restore-status";
      status.setAttribute("role", "status");
      const list = document.createElement("div");
      list.className = "be-restore-list";
      ctx.bodyEl.appendChild(status);
      ctx.bodyEl.appendChild(list);

      const render = (backups) => {
        list.innerHTML = "";
        if (!backups.length) {
          status.textContent =
            "No backups yet. One is written automatically just before a destructive " +
            "action (deleting a layer or shape, merging, splitting, resetting or " +
            "loading a layout), so there is nothing to restore until one happens.";
          return;
        }
        // AC-3 (ux_gaps_20260911): the two recovery models must be distinguishable
        // WHERE THE USER HITS THE LIMIT, not only in a tooltip. Undo is a 25-deep
        // per-change inverse that lives in the SESSION; these are whole-layout copies
        // that live in this browser. A user who reloads keeps only these, and a user
        // who wants to go back further than the undo stack reaches needs to know
        // that this is the way — so the surface states both facts in one sentence.
        status.textContent =
          backups.length + " backup" + (backups.length === 1 ? "" : "s") + " - newest first. " +
          "Saved in this browser, so they are still here after a reload; undo " +
          "covers the current session only.";
        backups.forEach((rec) => {
          const row = document.createElement("div");
          row.className = "be-restore-row";

          const what = document.createElement("span");
          what.className = "be-restore-what";
          what.textContent = rec.reason || "backup";
          row.appendChild(what);

          const when = document.createElement("span");
          when.className = "be-restore-when";
          when.textContent = new Date(rec.createdAt).toLocaleString();
          row.appendChild(when);

          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "be-restore-apply be-modal-ok";
          btn.textContent = "Restore";
          btn.setAttribute("aria-label", "Restore backup: " + (rec.reason || "backup"));
          btn.addEventListener("click", async () => {
            btn.disabled = true;
            const res = await window.restoreBackupRecord(rec);
            if (res.ok) {
              handle.close(null);
              if (window.showFeedback) {
                window.showFeedback(
                  "Restored the backup from " + new Date(rec.createdAt).toLocaleString(),
                  "success",
                );
              }
              if (typeof opts.onRestored === "function") opts.onRestored(rec);
              return;
            }
            btn.disabled = false;
            status.textContent = "Could not restore that backup - " + res.message + ".";
          });
          row.appendChild(btn);

          list.appendChild(row);
        });
      };

      status.textContent = "Reading backups…";
      window.listBackups()
        .then(render)
        .catch(() => render([]));
    },
  });
  return handle;
}

/** Classify a gate failure into a specific, actionable sentence (AC-6). */
/**
 * The SHORT form: what the toast says. MEASURED against the window it has.
 *
 * The previous wording ran 21 words ("Could not save a backup before this change, so nothing
 * was changed (storage is full). Free up space and try again.") against a toast that is on
 * screen for **3000 ms + a 500 ms fade = ~3.5 s** (`js/modals.js`), which needs ~5.0 s at a
 * brisk 250 wpm and ~6.3 s at a conservative 200 wpm (track ux_gaps_20260911, Phase 0/4
 * measurement). The message outran its own window by 1.4-1.8x under EITHER rate, so this is
 * arithmetic rather than a taste call.
 *
 * Each line now leads with the OUTCOME (the user's most urgent question is "did my delete
 * happen?"), names the cause, and ends with the next step — 9-12 words, ~2.6-3.3 s.
 *
 * The reasoning that was cut is NOT deleted: it lives in `gateRefusalDetail`, which the
 * refusal opens in a dialog that stays. That is AC-4's fail condition — information is
 * MOVED, never dropped.
 */
function gateRefusalMessage(error) {
  if (error === "quota") {
    return "Nothing was changed: storage is full. Free up space, then retry.";
  }
  if (error === "serialization") {
    return "Nothing was changed: the layout could not be serialized.";
  }
  return "Nothing was changed: storage unavailable. Reload the page and try again.";
}

/**
 * The LONG form: the "why" the toast cannot afford, kept reachable in a dialog.
 *
 * This is the sentence the short form gave up, and it is the part that answers a question
 * the user will actually have: *why did a delete get refused because of a BACKUP?* The
 * answer — every destructive action snapshots first, and the action is refused rather than
 * performed unsafely — is context, not urgency, so it belongs here.
 */
function gateRefusalDetail(error) {
  const cause =
    error === "quota" ? "the browser's storage for this site is full"
    : error === "serialization" ? "the current layout could not be turned into a copy"
    : "the browser's storage could not be reached";
  return (
    "The change was refused, not applied: this extension writes a backup of your " +
    "layout before anything destructive, so a change that cannot be backed up is " +
    "never made. That safety copy could not be written because " + cause + ". " +
    "Nothing in your sheet was altered, and any selection or layer you were working " +
    "with is exactly as it was."
  );
}

/**
 * Show the refusal's long form in a modal that stays, so AC-4's "moved, not deleted"
 * requirement has somewhere to be true. Reuses the shared dialog shell (Escape / the close
 * control / backdrop all dismiss it, focus is trapped and returned) — building a second
 * modal shape here would be the defect the refactor track was created to remove.
 */
function showGateRefusalDetail(error) {
  const api = typeof window !== "undefined" ? window.Modals : null;
  const detail = gateRefusalDetail(error);
  if (!api || typeof api.__createModal !== "function") {
    // No shell available: fall back to the SHORT toast's own text rather than losing the
    // message entirely, and say the long form exists in the console log the gate wrote.
    if (window.showFeedback) window.showFeedback(gateRefusalMessage(error), "error");
    return null;
  }
  const handle = api.__createModal({
    title: "Nothing was changed",
    role: "alertdialog",
    body(ctx) {
      const p = document.createElement("p");
      p.className = "be-gate-detail";
      p.textContent = detail;
      ctx.bodyEl.appendChild(p);
      return null;
    },
  });
  return handle;
}

/**
 * THE destructive-action gate (track destructive_recovery_20260911, AC-1/AC-2/AC-6).
 *
 * Snapshot FIRST, then act — and if the snapshot cannot be written, REFUSE the
 * action. That is the contract `createBackupSnapshot` was built for and that only
 * Reset honoured (`spec.md` D-1: ten destructive sites, seven of which announce
 * "This cannot be undone", and merge/split announce nothing at all).
 *
 * `reason` is USER-FACING: it is what the recovery surface renders, so it names the
 * action AND its subject ("Delete layer \"Shapes\""), never a generic word like
 * "manual" (AC-2).
 *
 * Returns `{ok:true, record}` or `{ok:false, error, message}`. **A caller MUST
 * return early on `!ok` WITHOUT mutating** — the tests inject a failure and assert
 * the element survives, because a gate that writes the backup and proceeds anyway is
 * not this contract.
 */
/**
 * THE destructive-gate helper (track refactor_surface_20260911, AC-5).
 *
 * WHY IT EXISTS ALONGSIDE `gateDestructive`: the destructive paths live in modules that are
 * evaluated BEFORE this one (js/main.js, js/dom/layer_manager.js, js/section_cloning.js), so
 * each of them carried its own copy of the seam resolution and the deliberate fail-OPEN — three
 * copies of one policy, with three comments explaining it. They now delegate here, and this is
 * the only place the policy is written down.
 *
 * The fail-OPEN is unchanged and still deliberate: a bare harness without the persistence module
 * lets the action proceed (`{ok: true, missing: true}`) rather than silently disarming every gate,
 * and `test/unit/destructive_recovery.test.js` pins that `window.gateDestructive` exists in a full
 * boot so a regression cannot remove it unseen.
 */
async function destructiveGate(reason) {
  if (typeof window.gateDestructive === "function") return window.gateDestructive(reason);
  return { ok: true, missing: true };
}

async function gateDestructive(reason) {
  // The backup writer lives in js/persistence.js and is resolved at CALL time; it is the
  // cross-reload net the gate depends on, so a missing seam is reported by the gate's own
  // try/catch rather than by a load-time capture of `undefined`.
  const snapshot = window.createBackupSnapshot;
  let res;
  try {
    res = await snapshot(reason);
  } catch (err) {
    window.safeLog?.("error", "[DDB Print] Destructive gate threw", err);
    res = { ok: false, error: "unavailable" };
  }
  if (res && res.ok) {
    // AC-6 (undo_stack_20260911): the BACKUP is the cross-reload net and records the
    // last SAVED layout; the UNDO needs the LIVE one. Captured HERE, because this runs
    // before the caller mutates — the last moment the pre-state still exists in the DOM.
    // Attached to the record so all ten call sites converge with no change of their own.
    try {
      res.record.liveBefore = await window.captureLiveLayout();
    } catch (err) {
      window.safeLog?.("error", "[DDB Print] Live capture at the gate failed", err);
      res.record.liveBefore = null;
    }
    return { ok: true, record: res.record };
  }

  const error = (res && res.error) || "unavailable";
  const message = gateRefusalMessage(error);
  // The toast carries the SHORT form (it has ~3.5 s); the "why" travels with it so AC-4's
  // requirement is met by MOVING the information, not deleting it. `detail` is the full
  // sentence; `showDetail` opens it in a dialog that stays. Both are returned on the result
  // so a call site that wants to surface the long form itself can, without a second lookup.
  if (window.showFeedback) window.showFeedback(message, "error");
  window.safeLog?.("error", `[DDB Print] Destructive gate refused (${reason}): ${error}`);
  return {
    ok: false,
    error,
    message,
    detail: gateRefusalDetail(error),
    showDetail: () => showGateRefusalDetail(error),
  };
}

/**
 * In-app destructive confirmation (AC-1). Replaces native `confirm()` for the
 * Reset / Load / version-mismatch paths. Owns the autosave pause for its whole
 * lifetime and lifts it on EVERY close path (confirm, cancel, ✕, Esc,
 * backdrop). Resolves true only when the user confirms.
 */
function confirmDestructive({ title, message, confirmLabel = "Continue", cancelLabel = "Cancel" }) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const paused = typeof window.pauseAutosave === "function";
    if (paused) window.pauseAutosave();

    let settled = false;
    const overlay = document.createElement("div");
    overlay.className = "be-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "be-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", title);
    modal.style.position = "relative";

    const h3 = document.createElement("h3");
    h3.textContent = title;
    modal.appendChild(h3);

    const closeBtn = document.createElement("button");
    closeBtn.className = "be-modal-close";
    closeBtn.textContent = "\u2715";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.onclick = () => finish(false);

    const body = document.createElement("p");
    body.textContent = message;
    modal.appendChild(body);

    const actions = document.createElement("div");
    actions.className = "be-modal-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "be-modal-cancel";
    cancelBtn.textContent = cancelLabel;
    cancelBtn.onclick = () => finish(false);
    actions.appendChild(cancelBtn);

    const okBtn = document.createElement("button");
    okBtn.className = "be-modal-ok";
    okBtn.textContent = confirmLabel;
    okBtn.onclick = () => finish(true);
    actions.appendChild(okBtn);

    modal.appendChild(actions);
    modal.appendChild(closeBtn); // top-right, absolute
    overlay.appendChild(modal);

    function finish(value) {
      if (settled) return;
      settled = true;
      window.removeEventListener("keydown", onKey);
      if (paused && typeof window.resumeAutosave === "function") window.resumeAutosave();
      overlay.remove();
      if (prevFocus && typeof prevFocus.focus === "function") prevFocus.focus();
      resolve(value);
    }

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      }
    }

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) finish(false);
    });
    window.addEventListener("keydown", onKey);

    document.body.appendChild(overlay);
    okBtn.focus();
  });
}

/**
 * Boot-time error card (Edge 4): a saved layout exists but could not be
 * applied. Offers the recoverable actions and never leaves a blank sheet.
 *
 * Migrated onto the shared modal primitive (track modal_primitive_20260910):
 * it used to hand-roll its own overlay and had NO close X, NO backdrop cancel
 * and NO Esc — an error card the user could only leave by choosing one of the
 * two recovery actions. It keeps `role="alertdialog"` (correct for a failure),
 * which the primitive now accepts as an override.
 */
function showRestoreFailureCard(result) {
  const api = typeof window !== "undefined" ? window.Modals : null;
  if (!api || typeof api.__createModal !== "function") {
    // Fail loud rather than silently dropping the recovery UI: a blank or
    // default sheet with no explanation is the exact behaviour Edge 4 removed.
    if (typeof window !== "undefined" && window.showFeedback) {
      window.showFeedback(
        "Your saved layout could not be restored, and the recovery dialog " +
          "could not be shown. Reload the page to try again.",
        "error",
      );
    }
    return null;
  }

  const handle = api.__createModal({
    title: "Saved layout could not be restored",
    role: "alertdialog",
    body(ctx) {
      ctx.message.textContent =
        `Your saved layout could not be loaded (${result.reason}` +
        `${result.detail ? `: ${result.detail}` : ""}). ` +
        `The default template has been applied so your sheet stays printable, but ` +
        `your saved layout was NOT overwritten. Restore an automatic backup to get ` +
        `it back, or start fresh.`;

      const fresh = document.createElement("button");
      fresh.className = "be-modal-cancel";
      fresh.type = "button";
      fresh.textContent = "Start fresh (Reset to Default)";
      fresh.addEventListener("click", () => {
        handle.close(null);
        window.handleLoadDefault();
      });
      ctx.actionsRow.appendChild(fresh);

      // AC-4: the pick-and-restore lives in ONE place. This card used to carry its
      // own copy that silently restored only the NEWEST backup; it now hands off to
      // the shared surface, which lists them (newest first, with what each one was
      // and when) and is honest when there are none.
      const backupBtn = document.createElement("button");
      backupBtn.className = "be-modal-ok";
      backupBtn.type = "button";
      backupBtn.textContent = "Restore a backup";
      backupBtn.addEventListener("click", () => {
        handle.close(null);
        window.showRestoreSurface();
      });
      ctx.actionsRow.appendChild(backupBtn);
    },
  });

  return handle;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    showRestoreSurface, gateDestructive, destructiveGate, confirmDestructive, showRestoreFailureCard,
    gateRefusalMessage,
    gateRefusalDetail,
    showGateRefusalDetail,
  };
}
if (typeof window !== "undefined") {
  window.showRestoreSurface = showRestoreSurface;
  // The destructive-action gate (track destructive_recovery_20260911): resolved at CALL time by
  // every destructive path, including modules evaluated BEFORE this one.
  window.gateDestructive = gateDestructive;
  // AC-4 (ux_gaps_20260911): the refusal's long form, reachable without going through the
  // gate — the toast carries the short sentence, and this is the dialog that keeps the "why".
  window.showGateRefusalDetail = showGateRefusalDetail;
  // The two halves of the refusal copy as seams, so a suite can assert the SHORT form fits
  // its measured window and the LONG form still answers the backup question, without having
  // to provoke a real storage failure for a pure-copy claim.
  window.gateRefusalMessage = gateRefusalMessage;
  window.gateRefusalDetail = gateRefusalDetail;
  // The ONE gate helper the three earlier-evaluated destructive paths delegate to (AC-5).
  window.destructiveGate = destructiveGate;
  window.confirmDestructive = confirmDestructive;
  // Test seam (track dead_exports_20260910 — the ONLY reader; KEEP): the boot path calls the
  // internal showRestoreFailureCard directly, so this alias is reached by
  // test/unit/persistence_backup.test.js:217 to drive the card without a full boot. Remove only
  // together with that assertion.
  window.restoreFailureCard = showRestoreFailureCard;
}