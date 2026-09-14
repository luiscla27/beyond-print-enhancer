/**
 * Persistence: user-facing save/load/restore/default-layout flows.
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 13 (split 1/3). Cross-module
 * seams resolved lazily at call time via window.* handles: safeLog,
 * __DDBStorage, and the scanLayout / applyLayout / applyDefaultLayout
 * serialization+apply flows (layout_scan.js / layout_apply.js) — never
 * captured at module load.
 */

"use strict";

async function handleSaveBrowser() {
  window.safeLog?.("log", "[DDB Print] handleSaveBrowser: starting...");
  try {
    await window.__DDBStorage.init();
    const layout = await window.scanLayout();
    window.safeLog?.("log", "[DDB Print] handleSaveBrowser: layout captured");
    await window.__DDBStorage.saveGlobalLayout(layout);

    // Also save for specific character for the "revert to character" feature later
    const characterId = window.getCharacterId();
    if (characterId) {
      window.safeLog?.(
        "log",
        "[DDB Print] handleSaveBrowser: saving for character:",
        characterId,
      );
      await window.__DDBStorage.saveLayout(characterId, layout);
    }

    window.safeLog?.("log", "[DDB Print] handleSaveBrowser: success");
    window.showFeedback("Saved to browser!");
  } catch (err) {
    _safeLog("error", "[DDB Print] Save failed", err);
    window.showFeedback("Failed to save layout to your browser.", "error");
  }
}

async function handleSavePC() {
  _safeLog("log", "[DDB Print] handleSavePC: capturing layout...");
  // AC-2 (U-4): scanLayout must run INSIDE the try — it used to sit outside,
  // so a scan failure became an unhandled rejection with no user feedback.
  let data = null;
  try {
    const layout = await window.scanLayout();
    data = JSON.stringify(layout, null, 2);
  } catch (err) {
    _safeLog("error", "[DDB Print] handleSavePC: could not read the layout", err);
    window.showFeedback("Could not read the current layout — nothing was downloaded.", "error");
    return;
  }
  const filename = `ddb-layout-${new Date().toISOString().split("T")[0]}.json`;

  try {
    _safeLog("log", "[DDB Print] handleSavePC: generating file...");
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    _safeLog("log", "[DDB Print] handleSavePC: clicking link...");
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);

    window.showFeedback("Download started!");
  } catch (err) {
    _safeLog("error", "[DDB Print] Download failed, showing modal", err);
    window.showFeedback("Download failed — showing the layout data instead.", "error");
    window.showFallbackModal(data);
  }
}

async function applyDefaultLayout() {
  window.safeLog?.("log", "[DDB Print] Applying Default Layouts (Archer Template)...");

  // Remove all shapes before applying the template
  document.querySelectorAll(".be-shape-wrapper").forEach((el) => {
    el.remove();
  });

  if (
    typeof CatalogService !== "undefined" &&
    typeof CatalogService.applyTemplate === "function"
  ) {
    try {
      await CatalogService.applyTemplate("archer", true);
      window.safeLog?.(
        "log",
        "[DDB Print] Default Archer template applied successfully.",
      );
    } catch (err) {
      window.safeLog?.(
        "error",
        "[DDB Print] Failed to apply default Archer template:",
        err,
      );
    }
  } else {
    window.safeLog?.(
      "error",
      "[DDB Print] CatalogService not found. Cannot apply default layout.",
    );
  }

  if (typeof updateLayoutBounds === "function") window.updateLayoutBounds();

  // Refresh print styles after applying default template
  if (typeof updatePrintStyles === "function") {
    window.updatePrintStyles();
  }
}

// ---------------------------------------------------------------------------
// Trust primitive (AC-1, ui_ux_review_20260910)
//
// Destructive flows (Reset / Load / version-mismatch) must be honest and
// recoverable: a backup is written BEFORE anything is erased, autosave is
// ref-count-paused while the confirm is open (so a queued autosave can never
// re-persist the half-erased state), and the confirm is an in-app dialog
// rather than a native `confirm()`.
// ---------------------------------------------------------------------------

const BACKUP_PREFIX = "backup_";
/**
 * The backup FIFO's depth, RAISED from 3 to 10 (track ux_gaps_20260911, Phase 3,
 * AC-3; operator decision O-3 — "definitely raise it", which overrode the spec's
 * own "re-decide, keeping 3 allowed" recommendation).
 *
 * WHY IT WAS 3, AND WHY THAT STOPPED BEING THE RIGHT ANSWER: the old comment read
 * "bounded so IndexedDB cannot grow forever" — sound in principle, but the number
 * was chosen when the backup store was the ONLY cross-reload net in the product. A
 * 25-deep undo stack now exists (`js/undo.js`), but it is SESSION-scoped: reload and
 * it is gone, so the backup store is still the only way back across a reload — and it
 * was three records deep. A user who works for an hour and then reloads has three
 * restore points for the whole session.
 *
 * THE COST, MEASURED (not estimated): one record is a full serialized layout. For a
 * realistic 24-section sheet that is **5,183 bytes (~5.1 KiB)**, so the store holds
 * 15.2 KiB at depth 3 and **50.6 KiB at depth 10** — an increase of ~35 KiB against
 * an IndexedDB quota measured in hundreds of megabytes. The bound is still a bound;
 * it is just no longer arbitrary.
 *
 * 10 (not 25, matching the undo stack) because the two are not the same job: undo is
 * a per-mutation inverse and can afford depth, while each backup is a whole-layout
 * copy. 10 gives a meaningful multi-reload history at a cost no user can notice.
 */
const MAX_BACKUPS = 10;
let _backupSeq = 0; // monotonic tie-breaker for same-millisecond resets

/** AC-5: the ONE logger is `window.safeLog` (js/main.js); this is only a CALL-time read of it. */
const _safeLog = (lvl, ...a) => {
  window.safeLog?.(lvl, ...a);
};

/** Open the layouts object store and run `fn(store)` inside one transaction. */
async function _withStore(mode, fn) {
  const database = await window.__DDBStorage.init();
  const done = new Promise((resolve, reject) => {
    const tx = database.transaction([window.__DDBStorage.STORE_NAME], mode);
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error || new Error("transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
    // Run the operation with the handlers already attached, so a fast
    // in-memory transaction can never complete before we are listening.
    Promise.resolve()
      .then(() => fn(tx.objectStore(window.__DDBStorage.STORE_NAME)))
      .then((v) => { out = v; })
      .catch((err) => { try { tx.abort(); } catch { /* already settled */ } reject(err); });
  });
  let out;
  await done;
  return out;
}

/** Every stored backup record, newest first by a DETERMINISTIC sort key. */
async function listBackups() {
  const keys = await _withStore("readonly", (store) =>
    new Promise((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }),
  );
  const backupKeys = (keys || []).filter(
    (k) => typeof k === "string" && k.startsWith(BACKUP_PREFIX),
  );
  const records = await _withStore("readonly", (store) =>
    Promise.all(
      backupKeys.map(
        (k) =>
          new Promise((resolve, reject) => {
            const req = store.get(k);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
          }),
      ),
    ),
  );
  return records
    .filter(Boolean)
    .sort((a, b) => {
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
      if (b.seq !== a.seq) return b.seq - a.seq;
      return String(b.id) < String(a.id) ? -1 : String(b.id) > String(a.id) ? 1 : 0;
    });
}

/** Keep only the newest MAX_BACKUPS (deterministic prune, Edge 1). */
async function pruneBackups() {
  const all = await listBackups();
  const doomed = all.slice(MAX_BACKUPS);
  if (!doomed.length) return 0;
  await _withStore("readwrite", (store) => {
    doomed.forEach((r) => store.delete(r.id));
    return null;
  });
  return doomed.length;
}

/**
 * Write a timestamped backup of the CURRENT saved layout before a destructive
 * action. Transactional gate (Edge 5): returns {ok:true, record} or
 * {ok:false, error} where error is a classified string — the caller MUST abort
 * the destructive action when ok is false.
 */
async function createBackupSnapshot(reason) {
  try {
    const characterId = window.getCharacterId();
    let layout = null;
    if (characterId) layout = await window.__DDBStorage.loadLayout(characterId);
    if (!layout) layout = await window.__DDBStorage.loadGlobalLayout();

    const createdAt = Date.now();
    const seq = _backupSeq++;
    const id = `${BACKUP_PREFIX}${createdAt}_${String(seq).padStart(6, "0")}`;
    const record = {
      __backup: true,
      id,
      // The layouts store is keyed by `characterId` (keyPath), so the backup's
      // own key rides in that field — `put(value)` derives the key from it.
      characterId: id,
      createdAt,
      seq,
      reason: reason || "manual",
      hasLayout: Boolean(layout),
      layout: layout || null,
    };
    await _withStore("readwrite", (store) => {
      store.put(record);
      return null;
    });
    await pruneBackups();
    _safeLog("log", `[DDB Print] Backup written: ${record.id} (${record.reason})`);
    return { ok: true, record };
  } catch (err) {
    const name = (err && err.name) || "";
    const error = /quota/i.test(name + String(err && err.message))
      ? "quota"
      : /invalid|serial/i.test(name)
        ? "serialization"
        : "unavailable";
    _safeLog("error", "[DDB Print] Backup write failed", err);
    return { ok: false, error };
  }
}

/* ------------------------------------------------------------------ *
 * Recovery (AC-3 undo, AC-4 reachable restore) — track
 * destructive_recovery_20260911.
 *
 * The snapshot the gate just wrote IS the undo: restoring it puts the layout back,
 * which is why this needs no inverse-operation machinery per mutation site.
 *
 * KNOWN LIMITATION, stated rather than hidden: `createBackupSnapshot` captures the
 * layout as last SAVED (its documented contract), not the live DOM. Autosave fires
 * about a second after a change, so the window in which they differ is small, but it
 * exists — undoing also reverts edits made since the last save. Snapshotting the LIVE
 * layout via `scanLayout` would close that, but it changes the trust primitive's
 * semantics, so it is recorded as a follow-up rather than smuggled into this phase.
 * ------------------------------------------------------------------ */

/** Apply a backup record's layout. Returns {ok} or {ok:false, reason, message}. */
async function restoreBackupRecord(record) {
  if (!record) return { ok: false, reason: "missing", message: "that backup no longer exists" };
  if (!record.layout) {
    return { ok: false, reason: "empty", message: "that backup holds no layout to restore" };
  }
  if (typeof window.applyLayout !== "function") {
    return { ok: false, reason: "unavailable", message: "the restore path is unavailable" };
  }
  try {
    await window.applyLayout(record.layout);
    return { ok: true };
  } catch (err) {
    _safeLog("error", "[DDB Print] Backup restore failed", err);
    return {
      ok: false,
      reason: "apply",
      message: String((err && err.message) || err || "the layout could not be applied"),
    };
  }
}

/* ------------------------------------------------------------------ *
 * THE UNDO STACK (track undo_stack_20260911, AC-3/AC-4/AC-5).
 *
 * Replaces the single-level slot that used to live here. The slot was ONE variable
 * (`let _undoToast = null;`) and every new offer superseded it, so a user who deleted a
 * layer and then merged two sections could no longer undo the delete. This is an ordered
 * stack instead, and the ten destructive sites plus (Phase 2) every other mutation push
 * onto it — ONE mechanism, not two that can disagree.
 *
 * The inverse is UNIFORM (contract.md §1.1): every entry records the LIVE layout as it
 * was before the mutation, and undoing is `applyLayout(entry.before)`. No per-class
 * inverse code exists or is needed, because scanLayout/applyLayout are already a
 * lossless round-trip over the whole mutation surface — which is why breadth is
 * affordable here.
 *
 * THE FEEDBACK-LOOP EXCLUSION is load-bearing: `applyLayout` is itself a mutation of
 * every recorded field, so if the restore path pushed an entry the stack would grow
 * without bound WHILE reverting. Only `pushUndo` pushes, and `applyLayout` never calls
 * it. Asserted by test/unit/undo_stack.test.js.
 * ------------------------------------------------------------------ */



/**
 * Allowlist legacy detection (Edge 6). Flags ONLY a missing / out-of-range
 * schema version or an exact known legacy marker — never "any unknown field"
 * (a forward-compatible current file must not be rejected).
 */
function detectLegacyLayout(layout) {
  if (!layout || typeof layout !== "object") return "not-an-object";
  const version = layout.version;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    return "missing-version";
  }
  const [maj] = version.split(".").map((n) => parseInt(n, 10));
  if (Number.isNaN(maj) || maj < 1) return `unsupported-version:${version}`;
  // Known legacy markers (exact signatures only).
  if (layout.shapes && !layout.shapeLayers) return "legacy-flat-shapes";
  const legacyAsset = JSON.stringify(layout).match(/\.gif["')\s]/);
  if (legacyAsset) return "legacy-gif-asset";
  return null;
}

/** Accurate version-drift copy (U-14): never claims "older" for newer files. */
function versionNotice(loaded) {
  const current = window.__DDBStorage.SCHEMA_VERSION;
  if (loaded === current) return null;
  const cmp = loaded.localeCompare(current, undefined, { numeric: true });
  return cmp < 0
    ? `This file was saved by an older version (${loaded}) than the current one (${current}). Newer features may be missing, and it is recommended to save your layout again afterwards.`
    : `This file was saved by a NEWER version (${loaded}) than the current one (${current}). Some of its settings may not be understood and could be dropped.`;
}

async function handleLoadDefault() {
  // Lazily-resolved seams (codebase convention) so tests can drive the flow.
  // Resolved at CALL time (AC-4's split moved these into their own modules, so a module-local
  // identifier would be a load-time capture of something that does not exist yet). Both are
  // REQUIRED for a destructive path: a missing gate refuses the action rather than proceeding.
  const snapshot = window.createBackupSnapshot;
  const confirmDialog = window.confirmDestructive;

  // 1. Backup FIRST — a failed backup aborts the destructive action (Edge 5).
  const backup = await snapshot("pre-reset");
  if (!backup.ok) {
    window.showFeedback(
      `Reset cancelled: could not write a backup (${backup.error}). Free up storage and try again.`,
      "error",
    );
    return;
  }

  const characterId = window.getCharacterId();
  const clones = document.querySelectorAll(".be-section-wrapper").length;
  const shapes = document.querySelectorAll(".be-shape-wrapper").length;
  const ok = await confirmDialog({
    title: "Reset to Default Layout",
    message:
      `This deletes your saved layout for ${characterId || "this character"} and the global default, ` +
      `and resets the sheet to the default template. Clones and extracted sections will be removed ` +
      `(${clones} sections, ${shapes} shapes on screen now). ` +
      `A backup was saved as "${backup.record.id}" — it is the only way back after this.`,
    confirmLabel: "Continue",
  });
  if (!ok) return;

  try {
    // Remove from IndexedDB
    await _withStore("readwrite", (store) => {
      store.delete("GLOBAL");
      if (characterId) store.delete(characterId);
      return null;
    });

    // Reset styles in DOM
    document
      .querySelectorAll(".print-section-container")
      .forEach((container) => {
        const wrapper = container.closest(".be-section-wrapper") || container;
        container.style.width = "";
        container.style.height = "";
        wrapper.style.left = "";
        wrapper.style.top = "";
        wrapper.style.zIndex = "10";
        container.dataset.minimized = "false";

        const content = container.querySelector(".print-section-content");
        if (content) content.style.display = "flex";

        // Reset inner widths
        const inners = container.querySelectorAll(
          'div[class$="-row-header"], div[class$="-content"] div',
        );
        inners.forEach((el) => {
          if (el.tagName === "DIV") {
            el.style.width = "";
            el.style.minWidth = "";
          }
        });
      });

    // Trigger default layout
    await window.applyDefaultLayout();

    // Reposition clones in front of their parents
    document
      .querySelectorAll(".print-section-container.be-clone")
      .forEach((clone) => {
        const originalId = clone.dataset.originalId;
        const original = document.getElementById(originalId);
        if (original) {
          const cloneWrapper = clone.closest(".be-section-wrapper") || clone;
          const originalWrapper =
            original.closest(".be-section-wrapper") || original;

          const x = (parseInt(originalWrapper.style.left) || 0) + 32;
          const y = (parseInt(originalWrapper.style.top) || 0) + 32;
          cloneWrapper.style.setProperty("left", `${x}px`, "important");
          cloneWrapper.style.setProperty("top", `${y}px`, "important");

          // Maintain current dimensions if they exist, otherwise they might be reset by the global query
          const currentWidth = clone.style.width;
          const currentHeight = clone.style.height;
          if (currentWidth)
            clone.style.setProperty("width", currentWidth, "important");
          if (currentHeight)
            clone.style.setProperty("height", currentHeight, "important");

          cloneWrapper.style.zIndex =
            (parseInt(originalWrapper.style.zIndex) || 10) + 1;
        }
      });

    // Handle merged sections: Rollback groups and prepare spells for recreation
    const mergedSpells = Array.from(
      document.querySelectorAll("[data-be-spell-merge]"),
    );
    const spellNamesToRecreate = [
      ...new Set(
        mergedSpells.map((el) => el.getAttribute("data-be-spell-merge")),
      ),
    ];

    document.querySelectorAll(".be-merge-wrapper").forEach((wrapper) => {
      const groupMergeId = wrapper.getAttribute("data-be-group-merge");
      if (groupMergeId) {
        const original = document.getElementById(groupMergeId);
        if (original) original.style.setProperty("display", "", "important");
      }
      wrapper.remove();
    });

    // Recreate merged spells as floating sections.
    // AC-3 (U-19): this used to be a bare `await` loop, so a spell that threw
    // simply did not come back and the user was never told — the restored layout
    // silently differed from the one they saved. Now each spell is attempted
    // independently, the failures are collected, and ONE aggregated message names
    // what did not come back.
    const spellRestoreFailures = [];
    for (const spellName of spellNamesToRecreate) {
      try {
        await window.createSpellDetailSection(spellName, { x: 0, y: 0 });
      } catch (err) {
        _safeLog("error", `[DDB Print] Merged spell "${spellName}" failed to restore`, err);
        spellRestoreFailures.push(spellName);
      }
    }
    if (spellRestoreFailures.length) {
      const show =
        typeof window !== "undefined" && typeof window.showFeedback === "function"
          ? window.showFeedback
          : null;
      if (show) {
        const names = spellRestoreFailures.join(", ");
        show(
          spellRestoreFailures.length === 1
            ? `1 merged spell could not be restored: ${names}`
            : `${spellRestoreFailures.length} merged spells could not be restored: ${names}`,
          "error",
        );
      }
    }

    // Reposition all spell detail sections to the Y of their original spell label, at left: 1200px
    document
      .querySelectorAll(".print-section-container.be-spell-detail")
      .forEach((detail) => {
        const detailWrapper = detail.closest(".be-section-wrapper") || detail;
        const spellName =
          detailWrapper.dataset.title ||
          detailWrapper
            .querySelector(".print-section-header span")
            ?.textContent.trim();
        if (spellName) {
          // Find the original spell label in the DOM (searching for exact text match)
          const labels = Array.from(
            document.querySelectorAll(".ct-spells-spell__label"),
          );
          const originalLabel = labels.find(
            (l) => l.textContent.trim() === spellName,
          );

          if (originalLabel) {
            const layoutRoot = document.getElementById(
              "print-layout-wrapper",
            );
            const rootRect = layoutRoot.getBoundingClientRect();
            const labelRect = originalLabel.getBoundingClientRect();

            // Calculate Y relative to the layout wrapper
            const y = labelRect.top - rootRect.top;
            detailWrapper.style.left = "1200px";
            detailWrapper.style.top = `${y}px`;
            detail.style.width = "300px";
            detail.style.height = "auto";
          } else {
            // Fallback: move to the right edge
            detailWrapper.style.left = "1200px";
            detail.style.width = "300px";
            detail.style.height = "auto";
          }
        }
      });

    // Rollback all OTHER extractions
    document
      .querySelectorAll(
        ".print-section-container.be-extracted-section:not(.be-spell-detail)",
      )
      .forEach((container) => {
        // Use rollbackSection logic but avoiding multiple feedbacks/bounds updates
        const originalId = container.dataset.originalId;
        const associatedIds = container.dataset.associatedIds
          ? JSON.parse(container.dataset.associatedIds)
          : [];
        const allIds = [originalId, ...associatedIds].filter((id) => id);

        allIds.forEach((id) => {
          const original = document.getElementById(id);
          if (original) {
            original.style.setProperty("display", "", "important");
          }
        });
        const wrapper = container.closest(".be-section-wrapper") || container;
        wrapper.remove();
      });

    window.updateLayoutBounds();
    window.showFeedback("Layout reset to defaults!");
  } catch (err) {
    _safeLog("error", "[DDB Print] Reset failed", err);
    window.showFeedback("Failed to reset layout.", "error");
  }
}

function handleLoadFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      let layout;
      try {
        layout = JSON.parse(event.target.result);
      } catch (err) {
        _safeLog("error", "[DDB Print] Load failed (parse)", err);
        window.showFeedback(`"${file.name}" is not valid JSON.`, "error");
        return;
      }

      if (!window.__DDBStorage.validateLayout(layout)) {
        window.showFeedback(`"${file.name}" is not a valid layout file.`, "error");
        return;
      }

      // Legacy allowlist (Edge 6): a known legacy signature aborts the load
      // loudly instead of silently rendering a broken sheet. Nothing is
      // migrated.
      const legacy = (window.detectLegacyLayout || detectLegacyLayout)(layout);
      if (legacy) {
        window.showFeedback(
          `"${file.name}" uses an unsupported legacy format (${legacy}) and cannot be loaded. ` +
            `Start fresh with Reset to Default, or open a backup.`,
          "error",
        );
        return;
      }

      const notice = window.versionNotice(layout.version);
      const ok = await window.confirmDestructive({
        title: "Load Layout",
        message:
          `Loading "${file.name}" REPLACES your current layout` +
          `${window.getCharacterId() ? ` for ${window.getCharacterId()}` : ""}: ` +
          `clones and extracted sections are removed and sections are repositioned. ` +
          `This cannot be undone from here.` +
          (notice ? `\n\n${notice}` : ""),
        confirmLabel: "Continue",
      });
      if (!ok) return;

      // Snapshot BEFORE replacing the layout (track destructive_recovery_20260911,
      // AC-1): this path's own copy says "This cannot be undone from here", and it
      // was one of the ten ungated sites. A failed snapshot refuses the load rather
      // than destroying the current layout with no record of it.
      // AC-5: the ONE gate helper, not the raw seam — the fail-open policy lives in
      // js/recovery_ui.js and this is the fifth delegating call site.
      const gate = await window.destructiveGate(
        `Load layout from "${file.name}"`,
      );
      if (!gate.ok) return;

      try {
        await window.applyLayout(layout);
        window.showFeedback("Layout loaded!");
        // AC-3: the snapshot taken before the replace IS the undo.
        if (window.offerUndo) window.offerUndo(gate.record, `Loaded layout from "${file.name}"`);
      } catch (err) {
        _safeLog("error", "[DDB Print] Load failed", err);
        window.showFeedback(`Failed to apply "${file.name}".`, "error");
      }
    };
    reader.readAsText(file);
  };

  input.click();
}

/**
 * Restores the saved layout. Returns a RESULT OBJECT (AC-1/Edge 4) so the boot
 * path can tell "nothing saved yet" apart from "a saved layout failed to
 * load" — the latter must surface an error card, never silently downgrade to
 * the default template.
 * @returns {Promise<{restored:boolean, reason?:string}>}
 */
async function restoreLayout() {
  try {
    await window.__DDBStorage.init();

    // Strategy: Load character-specific first, fallback to global
    const characterId = window.getCharacterId();
    let layout = null;

    if (characterId) {
      layout = await window.__DDBStorage.loadLayout(characterId);
    }

    if (!layout) {
      layout = await window.__DDBStorage.loadGlobalLayout();
    }

    if (!layout) return { restored: false, reason: "empty" };

    if (!window.__DDBStorage.validateLayout(layout)) {
      _safeLog("error", "[DDB Print] Saved layout failed validation");
      return { restored: false, reason: "invalid" };
    }

    await window.applyLayout(layout);
    return { restored: true };
  } catch (err) {
    _safeLog("error", "[DDB Print] Restore failed", err);
    return { restored: false, reason: "error", detail: String(err && err.message) };
  }
}

/**
 * AC-2 (U-15): say which layout the sheet ended up showing.
 *
 * WHY THIS EXISTS
 * The restore path was silent on SUCCESS: a restored layout and a defaulted one
 * looked identical, so the user could not tell "my layout loaded" from "the
 * default was applied". The FAILURE path already had a card (1.10.1); this adds
 * the missing confirmation, with different copy for the two success-ish
 * outcomes.
 *
 * Exactly ONE announcement per boot. A failed restore is deliberately NOT
 * announced here — the failure card owns that message, and saying it twice is
 * noise. Called once from the boot glue in `js/main.js`, not from a timer, so an
 * autosave immediately after a restore cannot double-fire it.
 *
 * Resolved through `window` at CALL time (working note 5): this file is loaded
 * before `js/modals.js`, so `showFeedback` does not exist yet when this module
 * is evaluated.
 *
 * @param {{restored:boolean, reason?:string}} result the object `restoreLayout()`
 *   returns.
 * @returns {"restored"|"default"|"silent"} what was announced, for tests.
 */
function announceBootRestore(result) {
  const show =
    typeof window !== "undefined" && typeof window.showFeedback === "function"
      ? window.showFeedback
      : null;
  if (result && result.restored) {
    if (show) show("Restored your saved layout.", "success");
    return "restored";
  }
  if (result && result.reason === "empty") {
    if (show) show("No saved layout yet \u2014 the default template is loaded.");
    return "default";
  }
  return "silent";
}



const Persistence = {
  handleSaveBrowser,
  handleSavePC,
  handleLoadFile,
  restoreLayout,
  applyDefaultLayout,
  handleLoadDefault,
  // Trust primitive (AC-1) — exported for tests + the boot path.
  createBackupSnapshot,
  gateDestructive: window.gateDestructive,
  offerUndo: window.offerUndo,
  clearUndoOffer: window.clearUndoOffer,
  hasUndoOffer: window.hasUndoOffer,
  applyUndo: window.applyUndo,
  // The undo stack (track undo_stack_20260911, AC-3/AC-4/AC-5).
  pushUndo: window.pushUndo,
  peekUndo: window.peekUndo,
  captureUndo: window.captureUndo,
  undoLabel: window.undoLabel,
  undoScreenLabel: window.undoScreenLabel,
  installUndoShortcut: window.installUndoShortcut,
  isTextEntryTarget: window.isTextEntryTarget,
  beginMutation: window.beginMutation,
  pushMutation: window.pushMutation,
  snapshotSectionFlags: window.snapshotSectionFlags,
  repairSectionFlags: window.repairSectionFlags,
  patchCapturedFields: window.patchCapturedFields,
  snapshotContainerGeometry: window.snapshotContainerGeometry,
  undoDepth: window.undoDepth,
  clearUndoStack: window.clearUndoStack,
  canUndo: window.canUndo,
  captureLiveLayout: window.captureLiveLayout,
  UNDO_STACK_MAX: window.UNDO_STACK_MAX,
  MUTATION_CLASSES: window.MUTATION_CLASSES,
  restoreBackupRecord,
  showRestoreSurface: window.showRestoreSurface,
  listBackups,
  pruneBackups,
  confirmDestructive: window.confirmDestructive,
  detectLegacyLayout,
  versionNotice,
  restoreFailureCard: window.restoreFailureCard,
  announceBootRestore,
  MAX_BACKUPS,
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = Persistence;
}
if (typeof window !== "undefined") {
  window.Persistence = Persistence;
  // Trust-primitive seams (AC-1): other modules + tests resolve these lazily
  // via window.*, matching the codebase convention.
  window.createBackupSnapshot = createBackupSnapshot;
  // The destructive-action gate (track destructive_recovery_20260911): resolved at
  // CALL time by every destructive path, including modules evaluated BEFORE this
  // one (js/dom/layer_manager.js, js/section_cloning.js).
  window.restoreBackupRecord = restoreBackupRecord;
  window.listBackups = listBackups;
  window.pruneBackups = pruneBackups;
  window.detectLegacyLayout = detectLegacyLayout;
  window.versionNotice = versionNotice;
  // Test seam (track dead_exports_20260910 — the ONLY reader; KEEP): the boot
  // path calls the internal showRestoreFailureCard directly, so this alias is
  // reached by test/unit/persistence_backup.test.js:217 to drive the card
  // without a full boot. Remove only together with that assertion.
  // AC-2 (U-15) seam: the boot glue in js/main.js (loaded after this file)
  // resolves it lazily; also the seam the unit suite drives.
  window.announceBootRestore = announceBootRestore;
}
