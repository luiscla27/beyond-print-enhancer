/**
 * The STRINGIFIED in-page half of the browser-e2e harness (track refactor_surface_20260911, Phase 6).
 *
 * WHY THESE ARE A FILE OF THEIR OWN: a probe must be a REAL function object handed to
 * `chrome.scripting.executeScript`, because the extension's MV3 CSP forbids `eval`/`new Function` in
 * the service worker — so a probe cannot be rebuilt from source at call time and its text IS the
 * asset. That is also what makes this half grow without bound as specs need new seams, which is why
 * it is separated from the page-side plumbing.
 *
 * `contentCall` runs a probe INSIDE the extension's isolated world — the world the content script
 * actually runs in — because content-script globals are NOT visible from `page.evaluate` (that runs
 * in the page's MAIN world, where `window.Modals` reads as `undefined`; verified).
 */
"use strict";

const CONTENT_PROBE_NAMES = [
  "raiseToast",
  "clearToasts",
  "announceRestore",
  "openEmptyState",
  "openMenuAt",
  "walkMenu",
  "lastLayerTargetId",
  // selection_model_ia_20260910 — the selection store's own seams.
  "selectSectionOnSheet",
  "selectShapeOnSheet",
  "selectLayerRow",
  "clearSelection",
  "selectionStoreRead",
  "selectionGeometry",
  "narrowGuardState",
  // destructive_recovery_20260911 — empty the backup store for the empty-state frame.
  "deleteAllBackups",
  // ux_gaps_20260911 Phase 3 — the raised depth and the two recovery models, in the real
  // product (the copy and the depth are unit-tested; this is the "where the controls are" half).
  "recoveryDepthProbe",
  // ux_gaps_20260911 Phase 4 — the refusal copy: drive a real refusal, raise its toast, and
  // open its long form, so AC-4 can be checked against the rendered message and a real timer.
  "refusalCopyProbe",
  "raiseRefusalToast",
  "openGateRefusalDetail",
  // undo_stack_20260911 — read/invoke the undo stack, and drive the layer operations whose
  // entry points are chooser chains, so every class can be round-tripped in a real browser.
  "undoRead",
  "undoInvoke",
  "undoClear",
  // affordance e2e (2026-09-14): drive the product's own filter entry point, which lives
  // in the ISOLATED world and is therefore invisible to page.evaluate.
  "setGlobalFilters",
  "moveShapeToLayer",
  "addShapeLayer",
  "layerSnapshot",
  "closeOverlays",
  // byok_ai_layout_20260915 Phase 2 — the BYOK store + dialog, read from the ISOLATED world
  // (AC-4's runtime half: the credential's visibility is a property of which world can see it).
  "aiSettingsWorldRead",
  "aiSettingsDialogProbe",
  "aiSettingsRemoveKeyProbe",
  "aiLayoutRecordRead",
  // byok_ai_layout_20260915 Phase 3 — the BYOK relay, driven from the ISOLATED world (the only
  // world whose sender passes the worker's own gate), plus the worker's decision counters.
  "byokRelayProbe",
  // byok_ai_layout_20260915 Phase 4 — the arrange flow, its panel row, and the counters that make
  // "zero applies" / "exactly one save" observable in the REAL page.
  "aiArrangeModuleRead",
  "aiArrangeFirstSection",
  "aiArrangeEvidenceTarget",
  "aiArrangeProbe",
  "aiArrangePanelRead",
  "aiArrangePanelClick",
];

/**
 * Run a named probe INSIDE the extension's isolated world — the world the
 * content script and this enhancer actually run in — and return its
 * JSON-serializable result.
 *
 * WHY THIS EXISTS: content-script globals are NOT visible from `page.evaluate`,
 * because that runs in the page's MAIN world (`window.Modals` reads as
 * `undefined` there; verified). The enhancer's seams — `window.Modals`,
 * `window.Persistence`, `window.announceBootRestore`, `window.LayerManager` —
 * live in the isolated world, so a harness that needs to drive a product SEAM
 * injects the call the same way the extension's own content script is injected.
 */
async function contentCall(ctx, name, args = []) {
  if (!CONTENT_PROBE_NAMES.includes(name)) {
    throw new Error(
      `contentCall: unknown probe "${name}" (known: ${CONTENT_PROBE_NAMES.join(", ")})`
    );
  }
  const sw =
    ctx.serviceWorkers().find((w) => w.url().includes("background.js")) ||
    ctx.serviceWorkers()[0];
  if (!sw) throw new Error("contentCall: no extension service worker");

  const out = await sw.evaluate(
    async ({ probeName, argsJson }) => {
      // Declared HERE so every entry is a real function object: Playwright
      // compiles this body through CDP, and chrome.scripting can then serialize
      // a genuine function into the content world. (Building them from source
      // would need `new Function`, which the extension CSP rejects.)
      const probes = {
        raiseToast: (msg, type) => {
          window.Modals.showFeedback(msg, type);
          return { toasts: document.querySelectorAll(".be-feedback").length };
        },
        clearToasts: () => {
          document.querySelectorAll(".be-feedback").forEach((t) => t.remove());
          return { cleared: true };
        },
        announceRestore: (result) => {
          const fn =
            (typeof window.announceBootRestore === "function" &&
              window.announceBootRestore) ||
            (window.Persistence && window.Persistence.announceBootRestore) ||
            null;
          if (typeof fn !== "function") return { ok: false, why: "no seam" };
          fn(result);
          return { ok: true };
        },
        openEmptyState: (opts) => {
          const fn = window.Modals && window.Modals.showEmptyStateDialog;
          if (typeof fn !== "function") {
            return {
              ok: false,
              why: "no showEmptyStateDialog on window.Modals",
              modalsKeys: window.Modals ? Object.keys(window.Modals) : null,
            };
          }
          fn(opts);
          return { ok: true };
        },
        openMenuAt: (x, y, targetId) => {
          // The live LayerManager instance is owned by DomManager (LayerManager
          // itself is a CLASS with no static getInstance — measured: the first
          // attempt looked for LayerManager.getInstance and found nothing).
          const inst =
            (window.PeDom &&
              typeof window.PeDom === "function" &&
              window.PeDom().getLayerManager &&
              window.PeDom().getLayerManager()) ||
            (window.DomManager && window.DomManager.getInstance
              ? window.DomManager.getInstance().getLayerManager()
              : null) ||
            null;
          if (!inst || typeof inst.createContextMenu !== "function") {
            return {
              ok: false,
              why: "no createContextMenu",
              layerManager: typeof window.LayerManager,
              domManager: typeof window.DomManager,
              peDom: typeof window.PeDom,
            };
          }
          inst.createContextMenu(x, y, targetId);
          return {
            ok: true,
            menu: !!document.getElementById("print-enhance-context-menu"),
          };
        },
        walkMenu: () => {
          const menu = document.getElementById("print-enhance-context-menu");
          if (!menu) return null;
          const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
          const idx = () => items.indexOf(document.activeElement);
          const key = (k) =>
            menu.dispatchEvent(
              new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })
            );
          const seq = { entry: idx() };
          key("ArrowDown");
          seq.afterArrowDown = idx();
          key("ArrowDown");
          seq.afterSecondArrowDown = idx();
          key("End");
          seq.afterEnd = idx();
          key("ArrowUp");
          seq.afterArrowUp = idx();
          key("Home");
          seq.afterHome = idx();
          return { sequence: seq, itemCount: items.length };
        },
        /**
         * The menu's targets are the ITEM elements (chips / item cards), which
         * carry `data-target-id` — the layer ROW does not own the contextmenu
         * handler, so a right-click aimed at a row centre misses it entirely.
         */
        lastLayerTargetId: () => {
          const items = Array.from(
            document.querySelectorAll(
              "#print-enhance-layer-manager [data-target-id]"
            )
          );
          const last = items[items.length - 1];
          return last ? last.dataset.targetId || last.id || "(no id)" : null;
        },
        /* ---- selection_model_ia_20260910: the three SELECTION entry points ---- */
        selectSectionOnSheet: () => {
          const store = window.PropertiesPanel;
          if (!store || typeof store.setActiveSection !== "function") {
            return { ok: false, why: "no window.PropertiesPanel.setActiveSection" };
          }
          // Pick a section the user can actually SEE. The docked control panel is
          // position:fixed over the sheet's LEFT column (x < ~265) and the sheet is
          // taller than the viewport (measured content height 5458px), so a section
          // whose box sits under the panel or below the fold has its selection ring
          // half-hidden — which made an earlier capture look as if the ring did not
          // paint at all (measured: elementFromPoint over the left edge returned a
          // panel button). Choose the candidate with the largest VISIBLE area.
          const PANEL_RIGHT = 265;
          const all = Array.from(
            document.querySelectorAll(
              "#print-enhance-sections-layer .be-section-wrapper"
            )
          );
          // Shapes paint ABOVE the whole sections layer (print z banding), so a
          // shape overlapping a section covers its ring. A frame whose claim is
          // "the section is unmistakable" must not be occluded, so prefer a
          // section no shape overlaps.
          const shapeRects = Array.from(
            document.querySelectorAll(".be-shape-wrapper")
          ).map((s) => s.getBoundingClientRect());
          const overlapsAShape = (rect) =>
            shapeRects.some(
              (s) =>
                s.width > 0 &&
                s.height > 0 &&
                !(
                  s.right < rect.left - 4 ||
                  s.left > rect.right + 4 ||
                  s.bottom < rect.top - 4 ||
                  s.top > rect.bottom + 4
                )
            );
          const visibleRect = (el) => {
            const r = el.getBoundingClientRect();
            return {
              left: Math.max(r.left, PANEL_RIGHT),
              top: Math.max(r.top, 20),
              right: Math.min(r.right, window.innerWidth - 240),
              bottom: Math.min(r.bottom, window.innerHeight - 20),
            };
          };
          let best = null;
          let bestArea = 0;
          let bestUnoccluded = null;
          let bestUnoccludedArea = 0;
          all.forEach((el) => {
            const v = visibleRect(el);
            const w = v.right - v.left;
            const h = v.bottom - v.top;
            if (w < 90 || h < 70) return;
            const area = Math.round(w * h);
            if (area > bestArea) {
              bestArea = area;
              best = el;
            }
            if (!overlapsAShape(v) && area > bestUnoccludedArea) {
              bestUnoccludedArea = area;
              bestUnoccluded = el;
            }
          });
          const el = bestUnoccluded || best || all[0];
          if (!el) return { ok: false, why: "no section wrapper on the sheet" };
          store.setActiveSection(el);
          const r = el.getBoundingClientRect();
          return {
            ok: true,
            id: el.id || "(no id)",
            classes: Array.from(el.classList),
            fullyVisible: !!bestUnoccluded,
            unoccluded: !!bestUnoccluded,
            visibleArea: bestUnoccluded ? bestUnoccludedArea : bestArea,
            candidates: all.length,
            box: [
              Math.round(r.left),
              Math.round(r.top),
              Math.round(r.width),
              Math.round(r.height),
            ],
          };
        },
        selectShapeOnSheet: () => {
          const store = window.PropertiesPanel;
          if (!store || typeof store.setActiveSection !== "function") {
            return { ok: false, why: "no window.PropertiesPanel.setActiveSection" };
          }
          const el = document.querySelector(".be-shape-wrapper");
          if (!el) return { ok: false, why: "no shape wrapper on the sheet" };
          store.setActiveSection(el);
          return { ok: true, id: el.id || "(no id)", classes: Array.from(el.classList) };
        },
        selectLayerRow: (layerId) => {
          const row = document.querySelector(
            `#print-enhance-layer-manager .be-layer-row[data-layer-id="${layerId}"]`
          );
          if (!row) return { ok: false, why: `no row for layer ${layerId}` };
          const label = row.querySelector("span");
          if (!label) return { ok: false, why: "row has no label span" };
          const before = window.PropertiesPanel.getActiveTarget
            ? window.PropertiesPanel.getActiveTarget()
            : null;
          label.click();
          const after = window.PropertiesPanel.getActiveTarget
            ? window.PropertiesPanel.getActiveTarget()
            : null;
          return {
            ok: true,
            layerId,
            beforeId: before ? before.id || "(no id)" : null,
            afterId: after ? after.id || "(no id)" : null,
          };
        },
        clearSelection: () => {
          const store = window.PropertiesPanel;
          if (!store || typeof store.setActiveSection !== "function") {
            return { ok: false, why: "no window.PropertiesPanel.setActiveSection" };
          }
          store.setActiveSection(null);
          return { ok: true };
        },
        /**
         * destructive_recovery_20260911: empty the backup store, so the restore
         * surface's honest EMPTY state is the real state rather than a mock. Runs in
         * the extension's world (page.evaluate cannot see `window.listBackups` — the
         * documented isolated-world constraint), and reports what it removed.
         */
        deleteAllBackups: async () => {
          const store = window.__DDBStorage;
          const names = [store && store.STORE_NAME ? store.STORE_NAME : "layouts"];
          const list = await window.listBackups();
          const removed = [];
          await new Promise((resolve) => {
            const req = indexedDB.open(
              store && store.DB_NAME ? store.DB_NAME : "DDBPrintEnhancerDB",
            );
            req.onerror = () => resolve(false);
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction(names, "readwrite");
              const os = tx.objectStore(names[0]);
              list.forEach((rec) => {
                os.delete(rec.id);
                removed.push(rec.reason);
              });
              tx.oncomplete = () => resolve(true);
              tx.onerror = () => resolve(false);
            };
          });
          const left = await window.listBackups();
          return { removedCount: removed.length, removed, leftCount: left.length };
        },

        /* ---- ux_gaps_20260911 Phase 3 (AC-3: the two recovery models, in the real product) -- */

        /**
         * The Phase 3 probe. Runs in the EXTENSION's world — `page.evaluate` cannot see any
         * of this (the documented isolated-world constraint, see `deleteAllBackups` above) —
         * and answers the three questions AC-3 asks of the live product:
         *   * the depth actually enforced (`MAX_BACKUPS`),
         *   * whether the restore surface's copy distinguishes the two recovery models,
         *   * whether the undo control's tooltip names its session scope.
         * It writes a backup first, so the undo control is reported in its ENABLED state —
         * the scope sentence only exists when there is something to undo, which is why an
         * empty-stack read of the tooltip would be a vacuous pass.
         */
        recoveryDepthProbe: async () => {
          const cap = window.Persistence && window.Persistence.MAX_BACKUPS;
          const created = await window.createBackupSnapshot(
            'Phase 3 probe: Delete layer "x"',
          );
          // Give the stack one record so the control is enabled and its scope is set.
          if (typeof window.captureLiveLayout === "function" &&
              typeof window.pushUndo === "function") {
            const live = await window.captureLiveLayout();
            window.pushUndo(live, 'Toggle "Actions"', "layer-flag");
          }
          const btn = document.getElementById("be-btn-undo");
          const backups = await window.listBackups();
          return {
            maxBackups: cap,
            backupCreated: !!(created && created.ok),
            backupCount: backups.length,
            undoTitle: btn ? btn.title || "" : null,
            undoAria: btn ? btn.getAttribute("aria-label") || "" : null,
            undoLabel: btn && btn.querySelector(".be-ctl-label")
              ? btn.querySelector(".be-ctl-label").textContent : null,
            undoDisabled: btn ? !!btn.disabled : null,
          };
        },

        /* ---- ux_gaps_20260911 Phase 4 (AC-4: the refusal copy and its window) ------------------ */

        /**
         * Drive a REAL refusal and report both halves of the copy. Runs in the extension's
         * world (the isolated-world constraint: `page.evaluate` cannot see these seams), makes
         * the snapshot fail the way a full disk would, calls the gate as a destructive path
         * does, and returns the words so the caller can check the copy against the measured
         * toast window without hardcoding either.
         */
        refusalCopyProbe: async () => {
          const realSnapshot = window.createBackupSnapshot;
          window.createBackupSnapshot = async () => ({ ok: false, error: "quota" });
          let res;
          try {
            res = await window.gateDestructive('Phase 4 probe: Delete layer "x"');
          } finally {
            window.createBackupSnapshot = realSnapshot;
          }
          const words = (s) => (s || "").trim().split(/\s+/).filter(Boolean).length;
          return {
            refused: !!(res && res.ok === false),
            error: res && res.error,
            message: (res && res.message) || "",
            words: words(res && res.message),
            detail: (res && res.detail) || "",
            detailWords: words(res && res.detail),
            hasShowDetail: typeof (res && res.showDetail) === "function",
          };
        },

        /** Raise exactly the message the gate would, so the TOAST can be read as rendered. */
        raiseRefusalToast: (msg) => {
          if (window.showFeedback) window.showFeedback(msg, "error");
          return true;
        },

        /** Open the refusal's long form the way the product would. */
        openGateRefusalDetail: (error) => {
          if (typeof window.showGateRefusalDetail !== "function") return false;
          window.showGateRefusalDetail(error || "quota");
          return true;
        },

        /* ---- undo_stack_20260911 (per-class AC-3 verification in a real browser) ------- */

        /**
         * Close every overlay/modal the enhancer may have left open, so one class's flow
         * cannot leak its modal state into the next class's assertions. Does not touch the
         * undo stack (that is `undoClear`'s job) — only the UI.
         */
        closeOverlays: () => {
          const closed = { overlays: 0, contextMenus: 0, toasts: 0 };
          document.querySelectorAll(".be-modal-overlay").forEach((o) => {
            const x = o.querySelector(".be-modal-close, .be-modal-x, [aria-label*='Close']");
            const cancel = Array.from(o.querySelectorAll("button")).find((b) =>
              /cancel|close/i.test(b.textContent || ""),
            );
            if (x) x.click();
            else if (cancel) cancel.click();
            else o.remove();
            closed.overlays += 1;
          });
          document.querySelectorAll(".be-context-menu").forEach((m) => {
            m.style.display = "none";
            closed.contextMenus += 1;
          });
          document.querySelectorAll(".be-feedback").forEach((t) => {
            t.remove();
            closed.toasts += 1;
          });
          document.querySelectorAll(".be-drag-ghost, .be-drag-guides").forEach((n) => n.remove());
          return closed;
        },

        /**
         * The whole observable state of the undo stack, plus the LIVE layout as the same
         * serialized string the unit suite compares. `spell_cache` is dropped: it is storage
         * state, not layout, and comparing it would make every assertion here about the spell
         * store instead of the mutation.
         */
        undoRead: async () => {
          const out = { depth: null, label: null, hasOffer: false, state: null };
          try {
            out.depth = typeof window.undoDepth === "function" ? window.undoDepth() : null;
            out.label = typeof window.undoLabel === "function" ? window.undoLabel() : null;
            out.hasOffer =
              typeof window.hasUndoOffer === "function" ? window.hasUndoOffer() : false;
            if (typeof window.scanLayout === "function") {
              const L = await window.scanLayout();
              delete L.spell_cache;
              out.state = JSON.stringify(L);
            }
          } catch (err) {
            out.error = String(err && err.message ? err.message : err);
          }
          return out;
        },
        undoInvoke: async () => {
          const res = await window.applyUndo();
          return {
            ok: !!res.ok,
            reason: res.reason || null,
            depth: typeof window.undoDepth === "function" ? window.undoDepth() : null,
          };
        },
        undoClear: () => {
          if (typeof window.clearUndoStack === "function") window.clearUndoStack();
          return { depth: typeof window.undoDepth === "function" ? window.undoDepth() : null };
        },
        /**
         * AC-4 in the world the store actually lives in. Returns the module's shape plus
         * what the REAL permission set allows, so the spec can assert the no-permission path
         * instead of a fixture's idea of it.
         *
         * WHY A PROBE AND NOT `page.evaluate`: `window.AiSettings` is a content-script
         * global, invisible to the MAIN world (`js/modals.js`'s overlay has the same
         * property, documented at this file's header). A `page.evaluate` read of it is
         * UNDEFINED for a reason unrelated to whether the module loaded, so an assertion
         * written that way cannot fail — the class of vacuity `contentCall` exists to stop.
         */
        aiSettingsWorldRead: async () => {
          const api = window.AiSettings || null;
          const out = {
            moduleType: typeof api,
            keys: api ? Object.keys(api) : null,
            chromeStoragePresent: !!(
              typeof chrome !== "undefined" && chrome.storage && chrome.storage.local
            ),
          };
          if (api) {
            out.settings = await api.loadSettings();
            out.hasKey = await api.hasStoredKey();
            out.key = await api.getApiKey();
            out.layoutHasApi = null;
          }
          return out;
        },

        /**
         * Drive the REAL dialog and read the accessibility state a user's screen reader
         * would get: the masked input's `type` at first paint (flipping it later leaves the
         * value in the a11y tree as plain text), the reveal toggle's labels, the shell's
         * message node and whether it is actually shown, and what a save attempt leaves
         * behind. `opts.trySave`/`opts.tryBadBaseUrl`/`opts.typeKey` exercise the paths
         * without reaching the network.
         */
        aiSettingsDialogProbe: async (opts) => {
          const o = opts || {};
          const api = window.AiSettings;
          if (!api) return { ok: false, why: "no window.AiSettings" };
          const handle = api.showAiSettingsModal();
          if (!handle) return { ok: false, why: "showAiSettingsModal returned null" };
          await new Promise((r) => setTimeout(r, 80)); // the body's loadSettings() is async
          const m = handle.modal;
          const msg = m.querySelector(".be-modal-message");
          const keyInput = m.querySelector(".be-ai-key");
          const read = () => ({
            text: msg.textContent,
            display: getComputedStyle(msg).display,
            isError: msg.classList.contains("be-modal-message-error"),
            ariaInvalid: Array.from(m.querySelectorAll("[aria-invalid]")).map((e) => e.className),
          });
          const out = {
            ok: true,
            title: m.querySelector("h3").textContent,
            role: m.getAttribute("role"),
            ariaModal: m.getAttribute("aria-modal"),
            accessibleName: (document.getElementById(m.getAttribute("aria-labelledby")) || {}).textContent,
            keyFieldTypeAtFirstPaint: keyInput.type,
            keyFieldValueAtFirstPaint: keyInput.value,
            message: read(),
            buttons: Array.from(m.querySelectorAll(".be-modal-actions button")).map((b) => ({
              label: b.textContent,
              disabled: b.disabled,
              className: b.className,
            })),
            bodyChildClasses: Array.from(m.querySelectorAll(".be-modal-body > *")).map(
              (e) => e.tagName + "." + e.className,
            ),
          };

          // The reveal toggle — AC-4's mask is made of this attribute. The capture harness
          // passes `skipRevealCycles`: it wants the field MASKED in the frame, and this probe
          // ends its click pair on "masked" anyway — but a capture that toggled the live
          // dialog twice would photograph an animation mid-flight for no benefit.
          const reveal = m.querySelector(".be-ai-key-reveal");
          out.reveal = { className: reveal.className, label: reveal.textContent, pressed: reveal.getAttribute("aria-pressed"), type: keyInput.type };
          if (!o.skipRevealCycles) {
            reveal.click();
            out.reveal.afterFirstClick = { label: reveal.textContent, type: keyInput.type, pressed: reveal.getAttribute("aria-pressed") };
            reveal.click();
            out.reveal.afterSecondClick = { label: reveal.textContent, type: keyInput.type, pressed: reveal.getAttribute("aria-pressed") };
          }

          // O-2's gating, read off the real controls.
          out.disabledWithoutProvider = out.buttons
            .filter((b) => /Save|Test connection/.test(b.label))
            .every((b) => b.disabled);

          const provider = m.querySelector(".be-ai-provider");
          const save = m.querySelector(".be-ai-save");
          if (o.trySave || o.tryBadBaseUrl || o.typeKey) {
            provider.value = "openai";
            provider.dispatchEvent(new Event("change"));
          }
          if (o.tryBadBaseUrl) {
            m.querySelector(".be-ai-baseurl").value = o.tryBadBaseUrl;
          }
          if (o.typeKey) {
            keyInput.value = o.typeKey;
          }
          // `noSave` leaves the populated form on screen WITHOUT submitting it — the capture
          // harness needs a frame of the filled state, and clicking Save against a store the
          // manifest cannot grant would photograph the error state instead of the form.
          const clicksSave =
            (o.trySave || o.tryBadBaseUrl || o.typeKey) && !o.noSave;
          if (clicksSave) {
            save.click();
            await new Promise((r) => setTimeout(r, 150));
            out.afterSave = {
              message: read(),
              status: m.querySelector(".be-ai-status").textContent,
              keyFieldValue: keyInput.value,
              storedKey: await api.getApiKey(),
              settings: await api.loadSettings(),
              hasKey: await api.hasStoredKey(),
            };
          }

          // `leaveOpen` keeps the dialog mounted so a caller can read it from the OTHER
          // world afterwards — the shared-DOM residual case, which needs the field live in
          // the page world at assertion time.
          if (!o.leaveOpen) {
            handle.close(null);
            out.closedAndRemoved = !document.body.contains(handle.overlay);
          } else {
            out.leftOpen = true;
          }
          return out;
        },

        /**
         * Click the dialog's OWN "Remove key" control and report what the store says
         * afterwards. A probe rather than a direct `clearApiKey()` call because the button's
         * disabled state IS the product's behaviour: if `keyPresent` were wrong the control
         * would not be clickable, and the round-trip would be testing an API instead of the
         * action a user takes.
         */
        aiSettingsRemoveKeyProbe: async () => {
          const api = window.AiSettings;
          if (!api) return { ok: false, why: "no window.AiSettings" };
          const handle = api.showAiSettingsModal();
          if (!handle) return { ok: false, why: "the dialog did not open" };
          await new Promise((r) => setTimeout(r, 80));
          const btn = handle.modal.querySelector(".be-ai-remove-key");
          if (!btn) return { ok: false, why: "no .be-ai-remove-key in the dialog" };
          if (btn.disabled) {
            return { ok: false, why: "Remove key is disabled, so a key was not really stored" };
          }
          btn.click();
          await new Promise((r) => setTimeout(r, 150));
          const out = {
            ok: true,
            status: handle.modal.querySelector(".be-ai-status").textContent,
            key: await api.getApiKey(),
            hasKey: await api.hasStoredKey(),
            settings: await api.loadSettings(),
            // The status copy must not echo anything credential-shaped.
            statusHasKeyShape: /sk-[A-Za-z0-9_-]{8,}/.test(
              handle.modal.querySelector(".be-ai-status").textContent || "",
            ),
          };
          handle.close(null);
          return out;
        },

        /**
         * The LIVE layout record, through the product's own scanner, plus everything the
         * real layout store (IndexedDB `layouts`) holds for this sheet. AC-4's "never
         * persisted into a layout record" checked against the actual record shape rather
         * than a fixture's copy of it.
         */
        aiLayoutRecordRead: async () => {
          const out = { scan: null, stored: null, error: null };
          try {
            if (typeof window.scanLayout === "function") {
              const L = await window.scanLayout();
              delete L.spell_cache;
              out.scan = JSON.stringify(L);
            }
            const store = window.Storage || window.__DDBStorage;
            if (store && typeof store.loadLayout === "function") {
              // The sheet's own id, from the URL the page is on.
              const id = (location.pathname.match(/\/characters\/(\d+)/) || [])[1] || "GLOBAL";
              const rec = await store.loadLayout(id);
              out.stored = rec ? JSON.stringify(rec) : null;
            }
          } catch (err) {
            out.error = String(err && err.message ? err.message : err);
          }
          return out;
        },

        /**
         * Drive the worker's BYOK relay FROM THE ISOLATED WORLD — the only world whose sender
         * passes the gate the relay writes from scratch. Returns the worker's own reply verbatim
         * so the spec can assert on `transport`, and never on a re-implementation of it.
         *
         * `opts.extra` merges smuggle-shaped fields into an otherwise legitimate body; `opts.verbatim`
         * replaces the body outright; `opts.readCompatList` answers with the shipped compatible
         * allow-list instead of sending anything.
         */
        byokRelayProbe: async (opts) => {
          const o = opts || {};
          if (o.readCompatList) {
            const api = window.AiSettings || null;
            const list = api && api.AI_COMPAT_BASE_ORIGINS;
            return {
              compatList: Array.isArray(list) ? list.slice() : null,
              seamPresent: !!api,
            };
          }
          const body = {
            type: "BYOK_CHAT",
            provider: typeof o.provider === "string" ? o.provider : "openai",
            model: "model" in o ? o.model : "gpt-4o-mini",
            maxTokens: "maxTokens" in o ? o.maxTokens : 1,
            messages: [{ role: "user", content: "ping" }],
          };
          if (o.extra && typeof o.extra === "object") Object.assign(body, o.extra);
          const wire = "verbatim" in o ? o.verbatim : body;
          try {
            const reply = await chrome.runtime.sendMessage(wire);
            // A closed channel answers `undefined`; report it as its own shape rather than
            // letting the spec assert against a bare undefined.
            return reply || { ok: false, transport: "no_reply", message: "" };
          } catch (err) {
            return {
              ok: false,
              transport: "channel_error",
              message: String((err && err.message) || err),
            };
          }
        },

        /**
         * Phase 4's arrange flow, driven in the ISOLATED world (where `window.AiArrange`,
         * `window.scanLayout` and the undo stack actually live).
         *
         * WHY STATE LIVES ON `window.__AI_E2E`: `contentCall` injects a FRESH function per call,
         * but the world it runs in PERSISTS — so the in-flight flow promise and the two spies below
         * survive between calls. That is what lets a spec hold a preview OPEN, take an `undoRead` of
         * the live layout while the ghosts are on screen, and then answer the dialog — which is the
         * only way AC-2's "a reject changes nothing" and the ghost-invisibility claim can be observed
         * in a real page rather than in a jsdom.
         *
         * `applyLayout` and `handleSaveBrowser` are WRAPPED (count + forward), never replaced:
         * "zero applies on a refusal" and "exactly one save on an accept" are AC-2/AC-3 probes, and a
         * stubbed apply makes the first one unfalsifiable. Seeding goes through the module's OWN
         * `setApiKey`/`saveSettings`, so a case cannot pass on a hand-built store record.
         */
        aiArrangeProbe: async (opts) => {
          const o = opts || {};
          const api = window.AiArrange;
          const S = window.AiSettings;
          if (!api || !S) return { ok: false, why: "no window.AiArrange/AiSettings" };
          const st = (window.__AI_E2E = window.__AI_E2E || {});
          st.applies = st.applies || 0;
          st.saves = st.saves || 0;
          if (!st.spyInstalled) {
            st.spyInstalled = true;
            const realApply = window.applyLayout;
            window.applyLayout = function (layout) {
              st.applies += 1;
              return realApply.call(window, layout);
            };
            const realSave = window.handleSaveBrowser;
            window.handleSaveBrowser = function () {
              st.saves += 1;
              return realSave.apply(window, arguments);
            };
          }
          const count = () => ({
            ghosts: document.querySelectorAll(".be-ai-ghost").length,
            ghostBoxes: document.querySelectorAll(".be-ai-ghost-box").length,
            dialogs: document.querySelectorAll(".be-modal-overlay").length,
            previewOpen: Boolean(document.querySelector(".be-ai-preview-accept")),
            refusalText: (document.querySelector(".be-ai-refusal") || {}).textContent || "",
            toast: Array.from(document.querySelectorAll(".be-feedback"))
              .map((n) => n.textContent)
              .join(" / "),
            applies: st.applies,
            saves: st.saves,
            depth: typeof window.undoDepth === "function" ? window.undoDepth() : null,
          });
          // The flow's own promise, polled rather than slept on: the undo record is repaired from a
          // capture that settles asynchronously, so a fixed wait here would be the timing assumption
          // plan.md told this spec not to copy from undo_stack_class_verification.
          const settleOut = (ms) =>
            new Promise((resolve) => {
              const t0 = Date.now();
              const tick = () => {
                if (st.out !== undefined) return resolve(st.out);
                if (Date.now() - t0 > ms) return resolve(undefined);
                setTimeout(tick, 40);
              };
              tick();
            });

          if (o.action === "start") {
            await S.setApiKey(o.key);
            await S.saveSettings({ provider: "openai", model: o.model || "gpt-4o-mini" });
            st.applies = 0;
            st.saves = 0;
            st.out = undefined;
            st.running = api.arrangeWithAi(o.instruction);
            st.running.then(
              (r) => {
                st.out = r;
              },
              (err) => {
                st.out = { ok: false, stage: "threw", code: String((err && err.message) || err) };
              },
            );
            const seen = await new Promise((resolve) => {
              const t0 = Date.now();
              const tick = () => {
                if (document.querySelector(".be-ai-preview-accept")) return resolve("preview");
                if (st.out !== undefined) return resolve("returned");
                if (Date.now() - t0 > (o.timeoutMs || 30000)) return resolve("timeout");
                setTimeout(tick, 40);
              };
              tick();
            });
            return Object.assign({ ok: true, seen, out: st.out }, count());
          }

          if (o.action === "answer") {
            const sel = o.accept ? ".be-ai-preview-accept" : ".be-ai-preview-cancel";
            const node = document.querySelector(sel);
            if (!node) {
              const missing = { ok: false, why: "no " + sel + " to click" };
              return Object.assign(missing, count());
            }
            node.click();
            const out = await settleOut(o.timeoutMs || 20000);
            return Object.assign({ ok: true, out }, count());
          }

          if (o.action === "await") {
            return Object.assign({ ok: true, out: await settleOut(o.timeoutMs || 30000) }, count());
          }

          if (o.action === "clear") {
            // Close whatever is left through the shell's OWN close control where one exists, so a
            // leaked dialog cannot make the next case's selector match the wrong node — the exact
            // failure undo_stack_class_verification.spec.js documents for its own beforeEach.
            Array.from(document.querySelectorAll(".be-modal-close")).forEach((b) => b.click());
            Array.from(document.querySelectorAll(".be-modal-overlay")).forEach((n) => n.remove());
            document.querySelectorAll(".be-ai-ghost").forEach((n) => n.remove());
            document.querySelectorAll(".be-feedback").forEach((n) => n.remove());
            st.out = undefined;
            return Object.assign({ ok: true }, count());
          }

          if (o.action === "unseed") {
            await S.clearApiKey();
            return { ok: true, hasKey: await S.hasStoredKey() };
          }

          // Store a key WITHOUT running the flow — the half O-2's panel case needs, because
          // `saveSettings` alone cannot enable the row: it re-derives `keyPresent` from the
          // credential store (`js/ai_settings.js:313`), so a settings-only write honestly reports
          // "no key". Using `start` here would have made the request instead.
          if (o.action === "seed") {
            await S.setApiKey(o.key);
            await S.saveSettings({ provider: "openai", model: o.model || "gpt-4o-mini" });
            return { ok: true, hasKey: await S.hasStoredKey(), settings: await S.loadSettings() };
          }

          if (o.action === "settings") {
            await S.saveSettings({ provider: "openai", model: o.model || "gpt-4o-mini" });
            return { ok: true, settings: await S.loadSettings() };
          }

          return { ok: false, why: "unknown action " + o.action };
        },

        /**
         * The live sheet's own arrangeable section, as `collectSections` sees it — numbers, not
         * "200px". A spec that hard-coded a section id would name a node this sheet may not have
         * (the demo character's ids are `section-Section-1`…), and `section_id_unknown` is exactly
         * the refusal the reject case wants to produce, so the two cases could not tell each other
         * apart. `innerWidths` is reported too: the derived-width guard reads it, and a section
         * whose recorded inner width equals the patched width would be refused for the wrong reason.
         */
        aiArrangeFirstSection: async () => {
          const api = window.AiArrange;
          if (!api || typeof window.scanLayout !== "function") {
            return { ok: false, why: "no AiArrange or scanLayout in this world" };
          }
          const layout = await window.scanLayout();
          const collected = api.collectSections(layout);
          const pick =
            collected.rows.find(
              (r) =>
                r.width >= 100 &&
                Number.isFinite(r.left) &&
                Number.isFinite(r.top) &&
                Boolean(document.getElementById(r.id)),
            ) || null;
          const rec = pick ? layout.sections[pick.id] : null;
          return {
            ok: Boolean(pick),
            id: pick ? pick.id : null,
            left: pick ? pick.left : null,
            top: pick ? pick.top : null,
            width: pick ? pick.width : null,
            innerWidths: rec ? JSON.stringify(rec.innerWidths || {}) : null,
            rowCount: collected.rows.length,
            ids: collected.ids.slice(0, 12),
          };
        },

        /**
         * AC-V1's target, CHOSEN BY MEASUREMENT rather than by hand.
         *
         * WHY THIS EXISTS (the defect it fixes): the first AC-V1 run photographed a `+24px` nudge of
         * `section-Section-1`, and Muse marked G1 and G5 NOT MET. The pixels say the reviewer was
         * RIGHT about the frame and wrong about the product — the ghost drew 1,254 gold pixels and the
         * record really moved 16→40 / 160→184 (`temp/scratch/acv1_apply.json`) — but the evidence was
         * unreadable for two measurable reasons:
         *   1. that section sits at record x 16..240, and the tool's OWN control panel is
         *      `position: fixed` at viewport x 10..258 with `z-index: 10000` (the sheet's sections are
         *      z-index 10), so the section being moved was BEHIND the panel;
         *   2. a 24px shift of a 224×144 box inside a 1247×709 frame is below what a reviewer can see.
         * This probe therefore picks a row that is (a) unobstructed at its CURRENT position, (b) has a
         * free destination at least `minDist` away, and (c) keeps both boxes clear of every fixed
         * surface, of every other section, and of the area the preview dialog will occupy. It returns
         * the numbers the spec asserts against, so the choice is falsifiable instead of curated.
         *
         * All coordinates are RETURNED IN RECORD SPACE (`#print-layout-wrapper`'s own space, which is
         * what a patch speaks), and `wrapperOrigin` lets the caller convert to viewport/frame space.
         */
        aiArrangeEvidenceTarget: async (opts) => {
          const o = opts || {};
          const minDist = Number.isFinite(o.minDist) ? o.minDist : 100;
          const api = window.AiArrange;
          if (!api || typeof window.scanLayout !== "function") {
            return { ok: false, why: "no AiArrange or scanLayout in this world" };
          }
          const layout = await window.scanLayout();
          const rows = api.collectSections(layout).rows.filter(
            (r) => r.width > 40 && r.height > 40 && document.getElementById(r.id),
          );
          const wrapRect = document
            .getElementById("print-layout-wrapper")
            .getBoundingClientRect();
          // Record space -> viewport space is a translation by the wrapper's origin.
          const toRec = (x, y) => [x - wrapRect.x, y - wrapRect.y];
          // Every OPAQUE fixed surface of the tool itself: it paints over the sheet (z 10000/31000 vs
          // a section's 10), so a change under it is invisible in a screenshot.
          const chrome = Array.from(document.body.children)
            .filter((el) => {
              const s = getComputedStyle(el);
              return (
                s.position === "fixed" &&
                el.offsetWidth > 40 &&
                el.offsetHeight > 40 &&
                !el.classList.contains("be-ai-ghost")
              );
            })
            .map((el) => {
              const r = el.getBoundingClientRect();
              const p = toRec(r.x, r.y);
              return { cls: (el.id || el.className || el.tagName).toString().slice(0, 40), x0: p[0], y0: p[1], x1: p[0] + r.width, y1: p[1] + r.height };
            });
          // The preview dialog's OWN footprint, modelled generously: `js/modals.js` builds
          // `.be-modal` (`max-width: 640px; width: 92%; max-height: 86vh`) centred by the overlay's
          // flex rules. Measured for this dialog at 400×199 in a 1280×720 viewport, so 640×260 centred
          // is a superset that cannot be caught out by a longer patch list.
          const dlgW = Math.min(640, window.innerWidth * 0.92);
          const dlgH = window.innerHeight * 0.4;
          const dl = toRec((window.innerWidth - dlgW) / 2, (window.innerHeight - dlgH) / 2);
          const dialog = { x0: dl[0], y0: dl[1], x1: dl[0] + dlgW, y1: dl[1] + dlgH };
          const zones = chrome.concat([dialog]);
          const boxes = rows.map((r) => ({ id: r.id, x0: r.left, y0: r.top, x1: r.left + r.width, y1: r.top + r.height }));
          const hits = (b, list) => list.some((z) => b.x0 < z.x1 && b.x1 > z.x0 && b.y0 < z.y1 && b.y1 > z.y0);
          // The visible page area in record space: a destination outside the viewport cannot be
          // photographed at all (the clip is capped at the viewport, not at the 5,458px wrapper).
          const view = { x0: 0, y0: 0, x1: toRec(window.innerWidth, 0)[0], y1: toRec(0, window.innerHeight)[1] };
          const inside = (b) => b.x0 >= view.x0 + 4 && b.y0 >= view.y0 + 4 && b.x1 <= view.x1 - 4 && b.y1 <= view.y1 - 4;
          const ranked = [];
          for (const src of boxes) {
            if (hits(src, zones) || !inside(src)) continue;
            const others = boxes.filter((b) => b !== src);
            let best = null;
            for (let dy = -640; dy <= 640; dy += 8) {
              for (let dx = -640; dx <= 640; dx += 8) {
                const d = { id: src.id, x0: src.x0 + dx, y0: src.y0 + dy, x1: src.x1 + dx, y1: src.y1 + dy };
                if (!inside(d) || hits(d, zones) || hits(d, others)) continue;
                const dist = Math.abs(dx) + Math.abs(dy);
                if (dist < minDist) continue;
                if (!best || dist > best.dist) best = { dist, dx, dy, dest: d };
              }
            }
            if (!best) continue;
            // RANK by how visible the section itself is (the shorter side, then area), then by how
            // far it travels. A 80×96 ability box that flies 960px is a WORSE subject than a 224×176
            // section that moves 300px: the detail crop has to cover the whole path, so a big travel
            // with a small box buys a big frame and a tiny subject.
            ranked.push({
              id: src.id,
              shortSide: Math.min(src.x1 - src.x0, src.y1 - src.y0),
              area: (src.x1 - src.x0) * (src.y1 - src.y0),
              dist: best.dist,
              src,
              dest: best.dest,
            });
          }
          const score = (a) => a.shortSide * 1e6 + a.area * 1e3 + a.dist;
          ranked.sort((a, b) => score(b) - score(a));
          const pick = ranked[0] || null;
          if (!pick) {
            return { ok: false, why: "no unobstructed section has a free destination >= " + minDist + "px", chrome, dialog, rows: rows.length };
          }
          // A SECOND subject for the strip: a section the patch only HIDES. It gets no move, so its
          // ghost is the ember-dashed "will disappear" box drawn ON TOP of itself — the only place the
          // two ghost KINDS are told apart on screen, which is what G2 asks to see. It never moves, so
          // all that is required is that its current position is unobstructed.
          const hideCandidate = boxes
            .filter((b) => b.id !== pick.id && inside(b) && !hits(b, zones))
            .sort((a, b) => Math.min(b.x1 - b.x0, b.y1 - b.y0) - Math.min(a.x1 - a.x0, a.y1 - a.y0))[0];
          return {
            ok: true,
            id: pick.id,
            hideId: hideCandidate ? hideCandidate.id : null,
            // The hide subject's box, so the artifact composer can crop to include BOTH ghost kinds
            // instead of guessing a window. Without it the second subject can fall outside the frame
            // and a brief that claims "two ghost styles are visible" is unfalsifiable.
            hideBox: hideCandidate
              ? { left: hideCandidate.x0, top: hideCandidate.y0, width: hideCandidate.x1 - hideCandidate.x0, height: hideCandidate.y1 - hideCandidate.y0 }
              : null,
            from: { left: pick.src.x0, top: pick.src.y0 },
            to: { left: Math.round(pick.dest.x0), top: Math.round(pick.dest.y0) },
            size: { width: Math.round(pick.src.x1 - pick.src.x0), height: Math.round(pick.src.y1 - pick.src.y0) },
            dist: pick.dist,
            alternatives: ranked
              .slice()
              .sort((a, b) => b.shortSide - a.shortSide || b.dist - a.dist)
              .slice(0, 8)
              .map((r) => ({ id: r.id, shortSide: r.shortSide, dist: r.dist })),
            wrapperOrigin: { x: wrapRect.x, y: wrapRect.y },
            viewport: { w: window.innerWidth, h: window.innerHeight },
            clip: { x: Math.max(0, wrapRect.x), y: Math.max(0, wrapRect.y), width: Math.min(1400, window.innerWidth - Math.max(0, wrapRect.x)), height: Math.min(1100, window.innerHeight - Math.max(0, wrapRect.y)) },
            chrome,
            dialog,
            rowCount: rows.length,
          };
        },

        /** Are Phase 4's modules on the live page, with the seams the flow needs? */
        aiArrangeModuleRead: async () => {
          const api = window.AiArrange || null;
          return {
            ok: true,
            aiLayout: Boolean(window.AiLayout),
            aiArrange: Boolean(api),
            arrangeFn: api ? typeof api.arrangeWithAi : null,
            surfaceFn: api ? typeof api.showAiArrangeSurface : null,
            keys: api ? Object.keys(api) : null,
            applyLayout: typeof window.applyLayout,
            beginMutation: typeof window.beginMutation,
            pushMutation: typeof window.pushMutation,
            handleSaveBrowser: typeof window.handleSaveBrowser,
            mutationClasses: window.MUTATION_CLASSES ? Object.keys(window.MUTATION_CLASSES) : null,
          };
        },

        /**
         * O-2 in the real panel: the row exists, and its disabled state + tooltip come from the
         * STORE, read the way the product reads them. The settings row must stay clickable — a
         * disabled way out of a disabled state is a dead end, not a gate.
         */
        aiArrangePanelRead: async () => {
          const row = document.getElementById("be-btn-ai-arrange");
          const settings = document.getElementById("be-btn-ai-settings");
          return {
            ok: true,
            rowExists: Boolean(row),
            disabled: row ? row.disabled === true : null,
            title: row ? row.title : null,
            ariaLabel: row ? row.getAttribute("aria-label") : null,
            className: row ? row.className : null,
            settingsExists: Boolean(settings),
            settingsEnabled: settings ? settings.disabled !== true : null,
          };
        },

        /** Press the real row. jsdom fires clicks on disabled buttons; a real browser does not. */
        aiArrangePanelClick: async () => {
          const row = document.getElementById("be-btn-ai-arrange");
          if (!row) return { ok: false, why: "no #be-btn-ai-arrange" };
          const before = document.querySelectorAll(".be-modal-overlay").length;
          row.click();
          await new Promise((r) => setTimeout(r, 400));
          return {
            ok: true,
            disabled: row.disabled === true,
            dialogsBefore: before,
            dialogsAfter: document.querySelectorAll(".be-modal-overlay").length,
            promptOpen: Boolean(document.getElementById("be-ai-instruction")),
            toast: Array.from(document.querySelectorAll(".be-feedback"))
              .map((n) => n.textContent)
              .join(" / "),
          };
        },

        /**
         * Reparenting's real entry point is a chooser chain, and its capture point lives
         * INSIDE this method — so calling it drives the product path rather than shortcutting
         * around the thing under test.
         */
        moveShapeToLayer: (wrapperId, targetLayerId) => {
          const lm = window.DomManager
            ? window.DomManager.getInstance().getLayerManager()
            : null;
          if (!lm) return { ok: false, why: "no layer manager" };
          const moved = lm.moveShapeToExistingLayer(wrapperId, targetLayerId);
          return { ok: !!moved, depth: window.undoDepth ? window.undoDepth() : null };
        },
        addShapeLayer: () => {
          const lm = window.DomManager
            ? window.DomManager.getInstance().getLayerManager()
            : null;
          if (!lm) return { ok: false, why: "no layer manager" };
          const before = lm.shapeLayers.map((l) => l.id);
          const layer = lm.addShapeLayer();
          // The container the reparent primitive looks up by `layer.layerId` is created by
          // the app's own refresh path.
          if (typeof lm.refreshLayerContents === "function") lm.refreshLayerContents();
          return {
            ok: true,
            id: layer.id,
            label: layer.label,
            layerId: layer.layerId,
            added: lm.shapeLayers.map((l) => l.id).filter((x) => !before.includes(x)),
          };
        },
        /** What the panel currently holds, so a test can target rows and shapes by id. */
        layerSnapshot: () => {
          const lm = window.DomManager
            ? window.DomManager.getInstance().getLayerManager()
            : null;
          const layers = lm
            ? lm.shapeLayers.map((l) => ({
                id: l.id,
                label: l.label,
                layerId: l.layerId,
                isLocked: l.isLocked,
                isHidden: l.isHidden,
                isDisabledOnPrint: l.isDisabledOnPrint,
              }))
            : [];
          const shapes = Array.from(document.querySelectorAll(".be-shape-wrapper")).map((w) => {
            const c = w.querySelector(".be-shape-container") || w;
            return {
              wrapperId: w.id,
              containerId: c.id,
              layerId: w.parentElement ? w.parentElement.id : null,
            };
          });
          const sections = Array.from(document.querySelectorAll(".print-section-container"))
            .filter((s) => !s.closest(".be-drag-ghost"))
            .map((s) => s.id);
          return {
            layers,
            shapes,
            sections,
            stackDepth: window.undoDepth ? window.undoDepth() : null,
          };
        },

        /**
         * AC-10 diagnostic: the narrow-guard state inside the extension's world.
         */
        narrowGuardState: (forcedWidth) => {
          const lm =
            (window.PeDom && window.PeDom().getLayerManager()) ||
            (window.DomManager && window.DomManager.getInstance().getLayerManager());
          if (!lm) return { ok: false, why: "no layer manager" };
          const before = {
            innerWidth: window.innerWidth,
            isMinimized: !!lm.isMinimized,
            bound: !!lm._narrowGuardBound,
            guardMinimized: !!lm._narrowGuardMinimized,
            hasApply: typeof lm.applyNarrowGuard === "function",
          };
          if (typeof forcedWidth === "number" && before.hasApply) {
            lm.applyNarrowGuard(forcedWidth);
          }
          const panel = document.getElementById("print-enhance-layer-manager");
          return {
            ok: true,
            before,
            after: {
              isMinimized: !!lm.isMinimized,
              panelClass: panel ? panel.className : null,
              panelHeight: panel ? Math.round(panel.getBoundingClientRect().height) : null,
            },
          };
        },
        /**
         * Diagnostic: which element does the selection PAINT on, and where is it.
         * Used to explain a mismatch between the marker's reported box and the
         * pixels that actually change (the section case did not match; the shape
         * case did).
         */
        selectionGeometry: () => {
          const m = document.querySelector(".be-active-target");
          if (!m) return { ok: false, why: "nothing selected" };
          const box = (el) => {
            const r = el.getBoundingClientRect();
            return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
          };
          const chain = [];
          let n = m;
          while (n && n !== document.body && chain.length < 8) {
            const cs = getComputedStyle(n);
            chain.push({
              tag: n.tagName,
              cls: (n.className || "").toString().slice(0, 70),
              box: box(n),
              zoom: cs.zoom,
              position: cs.position,
              filter: cs.filter,
            });
            n = n.parentElement;
          }
          const wrapper = m.closest(".be-active-wrapper");
          const points = [
            [330, 240],
            [300, 200],
            [150, 240],
            [280, 60],
            [500, 44],
          ].map(([x, y]) => {
            const el = document.elementFromPoint(x, y);
            return {
              p: [x, y],
              el: el
                ? el.tagName + "." + (el.className || "").toString().slice(0, 44)
                : null,
            };
          });
          return {
            ok: true,
            markerId: m.id || "(no id)",
            markerBox: box(m),
            wrapperBox: wrapper ? box(wrapper) : null,
            chain,
            points,
          };
        },
        selectionStoreRead: () => {
          const store = window.PropertiesPanel;
          const t = store && store.getActiveTarget ? store.getActiveTarget() : null;
          const rows = Array.from(
            document.querySelectorAll(
              "#print-enhance-layer-manager .be-layer-row.be-selection-layer"
            )
          ).map((r) => r.dataset.layerId);
          const insertionRows = Array.from(
            document.querySelectorAll(
              "#print-enhance-layer-manager .be-layer-row.be-active-layer"
            )
          ).map((r) => r.dataset.layerId);
          return {
            storeTargetId: t ? t.id || "(no id)" : null,
            storeTargetClasses: t ? Array.from(t.classList) : null,
            activeLayerRows: rows,
            insertionRows,
            markers: Array.from(document.querySelectorAll(".be-active-target")).length,
          };
        },
        /**
         * Drive the product's OWN filter entry point with a filter set, in the
         * isolated world where `window.applyGlobalFilters` lives, and report what the
         * sheet computed afterwards.
         *
         * WHY A PROBE AND NOT `page.evaluate`: the enhancer is injected with
         * `chrome.scripting`'s default ISOLATED world, so its globals are invisible to
         * the page's MAIN world — MEASURED, a `page.evaluate` call to
         * `window.applyGlobalFilters({hue:120,…})` silently no-opped (`typeof` read
         * "undefined") and the affordance case then failed on its own vacuity guard
         * while the product was correct. `js/controls.js:474` is the real call site —
         * the hue slider's `oninput` — and it passes the whole `currentFilters`
         * object, which is why this takes a full filter set, not one number.
         */
        setGlobalFilters: (filters) => {
          if (typeof window.applyGlobalFilters !== "function") {
            return { ok: false, why: "no window.applyGlobalFilters in this world" };
          }
          window.applyGlobalFilters(filters);
          const root = getComputedStyle(document.documentElement);
          return {
            ok: true,
            hueVar: root.getPropertyValue("--be-hue-filter").trim(),
            decorationVar: root.getPropertyValue("--be-decoration-filter").trim(),
          };
        },
      };
      const probe = probes[probeName];
      if (!probe) return { ok: false, error: `unknown probe ${probeName}` };
      const tabs = await chrome.tabs.query({});
      const tab =
        tabs
          .filter((t) => t.url && t.url.includes("dndbeyond.com/characters/"))
          .pop() || tabs[0];
      if (!tab) return { ok: false, error: "no tab" };
      const res = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: probe,
        args: argsJson,
      });
      return { ok: true, result: res && res[0] ? res[0].result : null };
    },
    { probeName: name, argsJson: args }
  );
  if (!out || !out.ok) {
    throw new Error(`contentCall(${name}) failed: ${JSON.stringify(out)}`);
  }
  return out.result;
}

module.exports = {
  CONTENT_PROBE_NAMES,
  contentCall,
};
