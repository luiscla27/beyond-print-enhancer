/**
 * AI arrange: the BYOK arranger's PRODUCT FLOW — track byok_ai_layout_20260915, Phase 4.
 *
 * AC-3's stance in one line: **AI proposes, code disposes.** This file is where the proposal
 * becomes either a preview the user accepts or a refusal that changed nothing. It is the first
 * product caller of `js/ai_layout.js` (the pure core), which is also why the core's
 * `window.AiLayout` seam exists NOW rather than in Phase 1 — the re-rot guard
 * (`scripts/check_dead_exports.js`) fails a published seam with no reader, and until this file
 * there was none.
 *
 * WHAT THIS FILE DOES NOT DO, and which owner does it instead
 * ----------------------------------------------------------
 * - It does not validate. `AiLayout.validatePatch` / `parseModelOutput` decide legality against
 *   the ids a LIVE `scanLayout` produced; this file only refuses to act on a `ok:false` verdict.
 *   That distinction is the whole of AC-2, and it is why the verdict is checked BEFORE the first
 *   write rather than inside the apply.
 * - It does not mutate the layout record or the DOM. The apply goes through the existing
 *   `scan → merge → window.applyLayout → save` path that a drag uses (`js/layout_apply.js:179`),
 *   and the undo record goes through `beginMutation`/`pushMutation` (`js/undo.js:344`,`:360`) —
 *   the same pair `captureUndo` and the keyboard route use. AC-3's "one undo click fully restores"
 *   is inherited, not re-implemented, and a hand-rolled capture around an async apply is exactly
 *   the phantom-entry failure `js/undo.js:362-374` documents.
 * - It does not own the credential or the transport. The chat goes out as one `BYOK_CHAT`
 *   message (`js/background.js`), whose body carries `type/provider/model/messages/maxTokens`
 *   and NOTHING else — no key, no URL (AC-4, AC-5). The worker reads storage itself.
 * - It does not guess at a model's answer. `parseModelOutput` refuses a fenced block or prose
 *   rather than unwrapping it, and this file surfaces that refusal.
 *
 * THE PREVIEW IS THE SAFETY DEVICE (GATE-3 D1 closed it the other way from a `confirm` field).
 * A valid patch is drawn as dashed ghost outlines on the sheet BEFORE any state changes, with
 * the counts the SAME normalised patch will produce. Accept applies; Cancel, Escape, the ✕ and a
 * backdrop click all return `null` and the sheet is what it was — zero DOM writes, zero saves,
 * zero undo entries. "Hide everything" dies here, in front of the user, not in a schema.
 *
 * CROSS-MODULE SEAMS RESOLVE AT CALL TIME, always (`window.X`, never a captured reference): this
 * file is injected with the content scripts and evaluated before `js/main.js` assigns the seams it
 * reads — the failure the fleet's `js/ai_settings.js` header documents.
 */
"use strict";

/** The prompt's hard cap, kept local so the flow can check it without reaching into the core. */
const AI_ARRANGE_MAX_INSTRUCTION = 4000;

/**
 * AC-6's tail: each error class the transport or the parser can return gets its OWN sentence.
 * "distinct user-visible message" is the acceptance text, so the map is exhaustive over
 * `AiLayout.ERROR_CLASSES` (a unit case asserts that exhaustiveness — a class added to the core
 * without copy here fails it, which is the only way this table cannot rot silently).
 */
const AI_ARRANGE_ERROR_COPY = Object.freeze({
  auth: "Your AI provider rejected the key - open AI settings and check it.",
  rate_limit: "Your AI provider is rate-limiting this key. Try again in a moment.",
  provider_unavailable: "Your AI provider is not answering right now. Nothing was changed.",
  network: "The browser could not reach your AI provider. Nothing was changed.",
  aborted: "The request was cancelled. Nothing was changed.",
  malformed: "Your AI provider sent back something unreadable. Nothing was changed.",
  model_output_not_json:
    "The AI answered in prose instead of the layout patch it was asked for. Nothing was changed.",
  unknown: "The AI request failed. Nothing was changed.",
  // NOT a member of `AiLayout.ERROR_CLASSES`: this one is raised by THIS file's transport wrapper
  // before the worker is ever reached (no messaging channel, or the worker is gone), so the core
  // has no reason to name it. A unit case asserts ERROR_CLASSES is a SUBSET of this map (a class
  // added upstream without copy fails) and that this key is the one local addition — so the map
  // cannot accumulate orphans either.
  unavailable: "The extension could not reach its own background worker. Nothing was changed.",
});

/**
 * The codes `parseModelOutput`/`validatePatch` report as findings, mapped to copy. These are
 * REFUSALS of a well-formed conversation (the model asked for a section that is not on the sheet),
 * which are a different event from a transport error and must not wear the same sentence.
 */
const AI_ARRANGE_REJECT_COPY = Object.freeze({
  live_ids_empty: "Nothing was arranged - the sheet reported no sections to the AI.",
  envelope_shape: "The AI's answer was not a layout patch. Nothing was changed.",
  envelope_key: "The AI asked to change something outside its permissions. Nothing was changed.",
  envelope_empty: "The AI proposed no changes.",
  section_id_unknown: "The AI named a section that is not on this sheet. Nothing was changed.",
  // THE CODE IS `section_id_duplicated`, WITH the d — and a unit case below asserts this map's
  // keys are EXACTLY the codes `validatePatch` emits, because the first draft of this table said
  // `section_id_duplicate` and nothing noticed: the miss falls through to the generic
  // `envelope_shape` sentence, so the user reads "the AI's answer was not a layout patch" about an
  // answer that was perfectly well-formed. A silent fall-through is the rot this map exists to
  // prevent, and AC-6's "distinct message" clause is what makes it a finding rather than a nit.
  section_id_duplicated: "The AI named the same section twice. Nothing was changed.",
  geometry_shape: "The AI sent a size or position it cannot mean. Nothing was changed.",
  geometry_value: "The AI sent a size or position outside what the sheet can hold.",
  stack_order_shape: "The AI sent a stacking order that is not a whole number.",
  stack_order_value: "The AI sent a stacking order outside the sheet's range.",
  minimized_shape: "The AI's collapse flag is neither true nor false.",
  derived_width: "The AI re-sent a width the sheet derives itself. Nothing was changed.",
  derived_width_unchecked:
    "The AI proposed a width that could not be checked against the live sheet.",
  model_output_not_json: AI_ARRANGE_ERROR_COPY.model_output_not_json,
});

/**
 * The ONE mutation class this flow pushes, written at the call site as a reference to the
 * declaration (`window.MUTATION_CLASSES.POSITION`) exactly like every other site — the nudge at
 * `js/dnd.js:922`, the drag at `:1477`, the resize at `js/main.js:2365`.
 *
 * WHY THERE IS NO LOCAL ALIAS FOR IT. An earlier draft of this file held
 * `const AI_ARRANGE_MUTATION_CLASS = () => window.MUTATION_CLASSES.POSITION` and passed the call
 * result, which reads as equally DRY and is measurably worse: `scripts/inventory_mutation_tags.py`
 * classifies a push site by whether the declaration is VISIBLE IN THE ARGUMENTS of the call, so the
 * alias made this the fifth UNCLASSIFIED tag-bearing call in the tree — and AC-3 of
 * `refactor_surface_20260911` exists precisely so that "one declaration is referenced by every push
 * site" is checkable rather than believable. `test/unit/mutation_class_guard.test.js` is the case
 * that caught it, and it is the reason the rule is: name the declaration at the call.
 */

// ---------------------------------------------------------------------------
// The section table (O-3's payload) — harvested, never invented
// ---------------------------------------------------------------------------

/**
 * Build the rows the model is shown, from a FRESH scan of the live sheet.
 *
 * Why not just `Object.entries(layout.sections)`: the standard-section record `scanLayout`
 * writes (`js/layout_scan.js:227`) carries geometry and stacking but NOT the heading — only the
 * clone/extraction/spell records do. O-3 ratified `title` as part of the payload (it is how the
 * model tells combat from utility apart), so the title is read back the same way the scan reads
 * it (`js/layout_scan.js:118-121`: the wrapper's `data-title`, else the header span). That keeps
 * "what we send" and "what we scanned" one rule instead of two.
 *
 * The ids returned here ARE the validator's universe. A section the model is not shown cannot be
 * named in a patch, and `buildMessages` throws if a row's id is not in `liveSectionIds` — so the
 * two lists come from one pass and cannot drift.
 *
 * @param {object} layout a record from `await window.scanLayout()`.
 * @return {{rows: Array<object>, ids: string[]}}
 */
function collectSections(layout) {
  const rows = [];
  const ids = [];
  if (!layout || !layout.sections) return { rows, ids };
  // `typeof document` is checked, not assumed: this module is `require`d by its unit suite, which
  // exercises the harvest against synthetic records in plain Node where there IS no document. The
  // row data comes from the SCAN RECORD, so only the title lookup needs the DOM — falling back to
  // the id keeps the function total instead of throwing at the first `getElementById`.
  const hasDom = typeof document !== "undefined" && document && document.getElementById;
  for (const id of Object.keys(layout.sections)) {
    const record = layout.sections[id];
    if (!record) continue;
    ids.push(id);
    const el = hasDom ? document.getElementById(id) : null;
    const wrapper = el && el.closest ? el.closest(".be-section-wrapper") || el : el;
    const header = wrapper ? wrapper.querySelector(".print-section-header span") : null;
    const title = wrapper && wrapper.dataset
      ? wrapper.dataset.title || (header ? header.textContent.trim() : null)
      : null;
    rows.push({
      id: id,
      title: title || id,
      // O-3's fields, read off the scan record. Numbers, not "200px": the patch speaks numbers
      // (`js/ai_layout.js`'s `classifyNumber`), and the row is what the model is TOLD, so the
      // unit of the conversation is fixed here rather than per-field.
      left: parsePx(record.left),
      top: parsePx(record.top),
      width: parsePx(record.width),
      height: parsePx(record.height),
      zIndex: parsePx(record.zIndex),
      minimized: record.minimized === true,
    });
  }
  return { rows, ids };
}

/** `"200px"` / `"200"` / 200 → a finite number, or 0 when there is nothing to say. */
function parsePx(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = parseFloat(String(value == null ? "" : value));
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// The transport (AC-5's content-script side)
// ---------------------------------------------------------------------------

/**
 * Ask the service worker one question, and get an answer or a typed failure — never a hang.
 *
 * The body is built key-by-key from the five the worker accepts. There is deliberately NO way to
 * pass a sixth through this function, which is what keeps "this caller cannot smuggle a URL or a
 * key" true of the product flow rather than only of the guard on the other end.
 *
 * `chrome.runtime.lastError` is READ, because MV3 reports a dead worker through it and a
 * `sendMessage` that never calls back is indistinguishable from a suspended extension otherwise.
 * The local deadline covers the third case: a worker that receives the message and never answers.
 *
 * @return {Promise<{ok: boolean, text?: string, errorClass?: string, message?: string}>}
 */
function sendByokChat(messages, meta) {
  const payload = {
    type: "BYOK_CHAT",
    provider: meta.provider,
    model: meta.model,
    maxTokens: meta.maxTokens,
    messages: messages,
  };
  return new Promise((resolve) => {
    let runtime = null;
    try {
      if (typeof chrome !== "undefined" && chrome.runtime) runtime = chrome.runtime;
    } catch {
      runtime = null;
    }
    if (!runtime || typeof runtime.sendMessage !== "function") {
      resolve({ ok: false, errorClass: "unavailable", message: "no messaging channel" });
      return;
    }
    let settled = false;
    const reply = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    // The deadline is `meta.timeoutMs`, overridable for tests that must exercise the deadline
    // path without waiting a real minute. A worker that never answers (an updating MV3
    // extension suspends its service worker mid-request) is the only case this covers that the
    // worker's OWN 45 s deadline does not, so the default sits ABOVE that.
    const deadlineMs =
      meta.timeoutMs || (typeof window !== "undefined" && window.__AI_ARRANGE_TEST_TIMEOUT_MS__) || 60000;
    const timer = setTimeout(() => {
      reply({ ok: false, errorClass: "aborted", message: "the request took too long" });
    }, deadlineMs);
    let returned;
    try {
      returned = runtime.sendMessage(payload, (response) => {
        if (runtime.lastError) {
          reply({
            ok: false,
            errorClass: "unavailable",
            message: String(runtime.lastError.message || "the extension did not answer"),
          });
          return;
        }
        reply(response && typeof response === "object"
          ? response
          : { ok: false, errorClass: "malformed", message: "no reply from the service worker" });
      });
    } catch (err) {
      reply({ ok: false, errorClass: "unavailable", message: String(err && err.message) });
      return;
    }
    if (returned && typeof returned.then === "function") {
      returned.then(
        (response) => reply(response && typeof response === "object"
          ? response
          : { ok: false, errorClass: "malformed", message: "no reply" }),
        (err) => reply({ ok: false, errorClass: "unavailable", message: String(err && err.message) }),
      );
    }
  });
}

// ---------------------------------------------------------------------------
// The apply
// ---------------------------------------------------------------------------

/**
 * Turn a normalised patch into the field map `applyLayout` consumes, then apply it through the
 * existing path. AC-3's "an ordinary mutation": merge → `applyLayout` → `pushMutation` → save.
 *
 * WHY A MERGE AND NOT A REWRITE: `layout.sections[id]` holds strings with units (`"200px"`) and a
 * pile of fields this feature must not touch (`innerWidths`, `compact`, `borderStyle`,
 * `fontSize`, …). So the patch's numbers are formatted into the SAME unit the scan writes and
 * assigned over a CLONE of the live record, and the whole record goes to `window.applyLayout` —
 * the function every other gesture funnels through. A patch cannot reach a field it has no key for
 * because only the five AC-1 fields are ever assigned here.
 *
 * `minimized` and the print-hidden flag are written on the record too, so the scan that happens
 * INSIDE `pushUndo`'s capture and this apply agree about what "before" was.
 *
 * @param {object} layout the live record (mutated? NO — a structural clone of the touched rows).
 * @param {object} patch a VALIDATED patch (`verdict.patch`).
 * @return {number} how many sections the patch actually changed.
 */
function mergePatchIntoLayout(layout, patch) {
  const moves = patch && patch.moves ? patch.moves : {};
  const hide = patch && Array.isArray(patch.hide) ? patch.hide : [];
  let touched = 0;
  for (const id of Object.keys(moves)) {
    const record = layout.sections[id];
    if (!record) continue;
    const move = moves[id];
    if (move.left !== undefined) record.left = px(move.left);
    if (move.top !== undefined) record.top = px(move.top);
    if (move.width !== undefined) record.width = px(move.width);
    if (move.zIndex !== undefined) {
      record.zIndex = String(move.zIndex);
      // `applyLayout` restores the PRINT stacking from `dataset.printZ` (js/layout_apply.js:206),
      // which scanLayout defaults from the inline z-index. Leaving it stale would undo the visual
      // restack on the next print, i.e. two answers to "what order is this in".
      record.printZIndex = String(move.zIndex);
    }
    if (move.minimized !== undefined) record.minimized = move.minimized === true;
    touched += 1;
  }
  for (const id of hide) {
    const record = layout.sections[id];
    if (!record) continue;
    record.printHidden = true;
    touched += 1;
  }
  return touched;
}

/** The unit the record speaks. Integers stay integers — `"319.5px"` is not something a gesture writes. */
function px(n) {
  const value = Number(n);
  return (Number.isInteger(value) ? value : Math.round(value * 2) / 2) + "px";
}

/**
 * The inverse of `mergePatchIntoLayout`, for the UNDO record that `beginMutation` starts before
 * this flow writes anything. Same reason the resize/nudge sites pass a `repair`: the capture's
 * DOM reads can land AFTER the mutation (`js/undo.js:362-374`), which would record the post-state
 * as the pre-state and make undo restore what was already there.
 *
 * `snap` is the live record read SYNCHRONOUSLY before the apply, keyed by id.
 */
function repairAiLayout(layout, snap) {
  if (!layout || !snap) return layout;
  for (const id of Object.keys(snap)) {
    const target = layout.sections && layout.sections[id];
    if (!target) continue;
    Object.assign(target, snap[id]);
  }
  return layout;
}

/** A synchronous per-section snapshot of exactly the fields this flow can write. */
function snapshotAiFields(layout) {
  const snap = {};
  if (!layout || !layout.sections) return snap;
  for (const id of Object.keys(layout.sections)) {
    const r = layout.sections[id];
    if (!r) continue;
    snap[id] = {
      left: r.left,
      top: r.top,
      width: r.width,
      zIndex: r.zIndex,
      printZIndex: r.printZIndex,
      minimized: r.minimized,
      printHidden: r.printHidden,
    };
  }
  return snap;
}

// ---------------------------------------------------------------------------
// The preview (AC-2's Cancel half, and the user's only look at the proposal)
// ---------------------------------------------------------------------------

/**
 * Draw the proposal as dashed ghosts over the sheet, and wait for the user's answer.
 *
 * NOTHING HERE MUTATES THE LAYOUT. Each ghost is a positioned copy of the section's own box in a
 * dedicated overlay layer that `scanLayout` ignores the same way it ignores a drag ghost
 * (`js/layout_scan.js:31` — a `.be-drag-ghost` copy is excluded for exactly this reason, and a
 * preview copy is the same kind of transient node), and removing the layer returns the sheet to
 * what it was. The overlay class is declared in `js/layout_scan.js`'s transient-node test rather
 * than being a convention this file hopes the scanner happens to miss.
 *
 * @return {Promise<boolean>} true = Accept, false = anything else.
 */
function showPreviewDialog(patch, summary, layout) {
  const api = window.Modals;
  if (!api || typeof api.__createModal !== "function") {
    window.showFeedback?.("Could not open the preview dialog - nothing was changed.", "error");
    return Promise.resolve(false);
  }
  const ghosts = createGhostLayer(patch, layout);
  const handle = api.__createModal({
    title: "Preview the AI arrangement",
    body: (ctx) => {
      const wrap = document.createElement("div");
      wrap.className = "be-ai-preview";

      const counts = document.createElement("p");
      counts.className = "be-ai-preview-counts";
      counts.textContent = summaryLine(summary);
      wrap.appendChild(counts);

      if (patch.note) {
        const note = document.createElement("p");
        note.className = "be-ai-preview-note";
        note.textContent = patch.note;
        wrap.appendChild(note);
      }

      const list = document.createElement("ul");
      list.className = "be-ai-preview-list";
      for (const line of describeChanges(patch, layout)) {
        const li = document.createElement("li");
        li.textContent = line;
        list.appendChild(li);
      }
      wrap.appendChild(list);
      ctx.bodyEl.appendChild(wrap);
    },
    actions: (ctx) => {
      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "be-modal-btn be-modal-btn-primary be-ai-preview-accept";
      accept.textContent = "Apply";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "be-modal-btn be-ai-preview-cancel";
      cancel.textContent = "Cancel";
      accept.addEventListener("click", () => {
        ctx.close(true);
      });
      cancel.addEventListener("click", () => {
        ctx.close(false);
      });
      ctx.actionsRow.appendChild(cancel);
      ctx.actionsRow.appendChild(accept);
    },
  });
  // ONE close path: the shell's ✕, Escape and a backdrop click all resolve `promise` with `null`,
  // which is false below — a Cancel that only the button honoured would be an AC-2 hole.
  return handle.promise.then((result) => {
    removeGhostLayer(ghosts);
    return result === true;
  });
}

/** What the dialog says the patch will do — from `summarizePatch`, never from a re-count here. */
function summaryLine(summary) {
  const parts = [];
  if (summary.moves) parts.push(summary.moves + (summary.moves === 1 ? " section moves" : " sections move"));
  if (summary.resized) parts.push(summary.resized + " resized");
  if (summary.restacked) parts.push(summary.restacked + " restacked");
  if (summary.hides) parts.push(summary.hides + (summary.hides === 1 ? " prints nothing" : " print nothing"));
  return "This will " + (parts.length ? parts.join(", ") : "change nothing") + ".";
}

/**
 * Per-section lines, so the user can see WHICH section, not just how many. Section names are the
 * ones already shown in the panel's own labels — the sheet's heading text, which is what the model
 * was sent in the first place (O-3).
 */
function describeChanges(patch, layout) {
  const lines = [];
  const moves = patch.moves || {};
  for (const id of Object.keys(moves)) {
    const move = moves[id];
    const bits = [];
    if (move.left !== undefined || move.top !== undefined) {
      bits.push(`to ${move.left !== undefined ? move.left : parsePx(layout.sections[id].left)} × ${move.top !== undefined ? move.top : parsePx(layout.sections[id].top)}`);
    }
    if (move.width !== undefined) bits.push(`width ${move.width}px`);
    if (move.zIndex !== undefined) bits.push(`stack ${move.zIndex}`);
    if (move.minimized !== undefined) bits.push(move.minimized ? "collapse" : "expand");
    if (bits.length) lines.push(`${nameOf(id)}: ${bits.join(", ")}`);
  }
  for (const id of patch.hide || []) lines.push(`${nameOf(id)}: hidden from print (undo restores it)`);
  return lines;
}

function nameOf(id) {
  const el = document.getElementById(id);
  if (!el) return id;
  const wrapper = el.closest(".be-section-wrapper") || el;
  const header = wrapper.querySelector(".print-section-header span");
  return (wrapper.dataset && wrapper.dataset.title) || (header && header.textContent.trim()) || id;
}

/**
 * The ghost layer. Drawn as dashed outlines where each moved box WOULD go, with the real content
 * LEFT OUT — never a second copy of the character sheet (which would print, and would be scanned).
 *
 * `.be-ai-ghost` is registered as a TRANSIENT node in `js/layout_scan.js`, so a preview that is
 * open cannot be saved into a layout. That registration is load-bearing and asserted by a unit
 * case: without it, accepting a patch is the only safe moment in the flow.
 *
 * WHY IT LIVES ON `document.body` AND NOT ON `#print-layout-wrapper`. A child's `z-index` is scoped
 * to its enclosing stacking context, and a sheet node above the wrapper creates one — so a child
 * z-index, however large, is trapped under that ancestor and the modal overlay beats it. MEASURED
 * in `temp/scratch/p4_z_wait.js`: a ghost left inside the wrapper shows 0 gold pixels under the
 * preview backdrop; the same node moved to `document.body` shows 1868. The layer is therefore
 * positioned FIXED and placed on the body at a level just above the modal overlay (which the shell
 * draws at 100000), so the preview is visible above its own dimming. The z-index is a LITERAL,
 * not a map reference, for a reason that is also a load-bearing ordering fact: `js/section_utils.js`
 * assigns the band map at `js/background.js:69`, AFTER this file is injected at `:94`, so `window.Z`
 * is `undefined` at the time this code runs. `test/unit/ac5_consolidation_guard.test.js` enumerates
 * the map's readers and this file stays off that list — and must, because a reference here would be
 * a silent no-op that no reviewer would catch.
 */
function createGhostLayer(patch, layout) {
  if (typeof document === "undefined" || !document.body) return null;
  const layer = document.createElement("div");
  layer.className = "be-ai-ghost";
  layer.setAttribute("aria-hidden", "true");
  layer.style.position = "fixed";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "100001";
  // The layer is viewport-fixed, but the scan records positions in `#print-layout-wrapper`'s
  // own coordinate space. A box at `left: 16px` is 16px from the wrapper's top-left, NOT from the
  // viewport's — so the ghosts would be misaligned by the wrapper's screen offset. MEASURED in
  // `temp/scratch/p4_fixed_ghost.js`: without this correction the box sat at viewport (40, 184)
  // while its section was at (48.5, 171) — off by exactly the wrapper's bounding rect (32.5, 11).
  // Each box is therefore shifted by the wrapper's measured origin. The wrapper is expected to be
  // at a stable position while a preview is open (the modal overlay suppresses scrolling), and the
  // layer is rebuilt each time the preview opens, so a scroll that happens between opens cannot
  // leave a stale offset behind.
  const wrap = document.getElementById("print-layout-wrapper");
  const wrapRect = wrap ? wrap.getBoundingClientRect() : { left: 0, top: 0 };
  const wrapX = wrapRect.left || 0;
  const wrapY = wrapRect.top || 0;
  const moves = patch.moves || {};
  for (const id of Object.keys(moves)) {
    const record = layout.sections[id];
    if (!record) continue;
    const el = document.getElementById(id);
    const wrapper = el ? el.closest(".be-section-wrapper") || el : null;
    if (!wrapper) continue;
    const ghost = document.createElement("div");
    const move = moves[id];
    ghost.className = "be-ai-ghost-box";
    ghost.style.position = "absolute";
    ghost.style.left = px((move.left !== undefined ? move.left : parsePx(record.left)) + wrapX);
    ghost.style.top = px((move.top !== undefined ? move.top : parsePx(record.top)) + wrapY);
    ghost.style.width = px(move.width !== undefined ? move.width : parsePx(record.width));
    // Height is NEVER taken from the patch: AC-1's writable set (`PATCH_SECTION_KEYS`) has no
    // `height` key, so a ghost that honoured one would be previewing a change the validator would
    // refuse. The box is as tall as the section is.
    ghost.style.height = px(parsePx(record.height));
    const label = document.createElement("span");
    label.className = "be-ai-ghost-label";
    label.textContent = nameOf(id);
    ghost.appendChild(label);
    if ((patch.hide || []).indexOf(id) !== -1) ghost.classList.add("be-ai-ghost-box-hidden");
    layer.appendChild(ghost);
  }
  for (const id of patch.hide || []) {
    if (moves[id]) continue;
    const el = document.getElementById(id);
    const wrapper = el ? el.closest(".be-section-wrapper") || el : null;
    const record = layout.sections[id];
    if (!wrapper || !record) continue;
    const ghost = document.createElement("div");
    ghost.className = "be-ai-ghost-box be-ai-ghost-box-hidden";
    ghost.style.position = "absolute";
    // THE SAME VIEWPORT CORRECTION AS THE MOVE BRANCH. A hidden section keeps its own record box,
    // and the record lives in `#print-layout-wrapper`'s coordinate space while this layer is fixed
    // to the viewport — so omitting `wrapX/wrapY` here draws the "will disappear" outline offset
    // from the thing that disappears. MEASURED in `temp/scratch/p4_hide_geom.js` (a hide-only
    // patch, no moves): the box sat 34.5px left and 13px above its own section, i.e. exactly the
    // wrapper's screen origin subtracted twice. The first draft of this function had the offset on
    // one branch only.
    ghost.style.left = px(parsePx(record.left) + wrapX);
    ghost.style.top = px(parsePx(record.top) + wrapY);
    ghost.style.width = px(parsePx(record.width));
    ghost.style.height = px(parsePx(record.height));
    const label = document.createElement("div");
    label.className = "be-ai-ghost-label";
    label.textContent = nameOf(id) + " - hidden from print";
    ghost.appendChild(label);
    layer.appendChild(ghost);
  }
  document.body.appendChild(layer);
  return layer;
}

function removeGhostLayer(layer) {
  if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
}

// ---------------------------------------------------------------------------
// The flow
// ---------------------------------------------------------------------------

/**
 * One arrangement request, start to finish. The only thing a caller needs.
 *
 * The order of operations IS AC-2 and AC-3:
 *   1. `hasStoredKey()` — O-2: no network call before consent, and the button is disabled until
 *      then anyway; this is the second gate, because the button state can be stale.
 *   2. scan → section table → `buildMessages` (which THROWS on an id not in the live scan, so the
 *      enum and the universe are one list).
 *   3. one `BYOK_CHAT`.
 *   4. `parseModelOutput` on the reply text — validate against the live ids, before any write.
 *      Every path from here that does not hold a `ok:true` verdict ends in a toast and NO DOM
 *      touch: that is what makes "reject = byte-identical layout" a property of the control flow
 *      rather than of a test.
 *   5. preview. Cancel → done, nothing changed.
 *   6. `beginMutation` with the synchronous snapshot → merge → `window.applyLayout` →
 *      `pushMutation` → save.
 *      The record is taken BEFORE the write and repaired from the synchronous snapshot if the
 *      async scan settled late (AC-3's phantom-entry mode), and the save is the product's normal
 *      `handleSaveBrowser` — the same call the panel's "Save to Browser" makes, so an accepted
 *      patch persists exactly like a dragged one.
 *
 * @param {string} instruction what the user asked for.
 * @return {Promise<{ok: boolean, stage?: string, code?: string, message?: string}>}
 */
async function arrangeWithAi(instruction) {
  const core = window.AiLayout;
  const text = typeof instruction === "string" ? instruction.trim() : "";
  if (!core) {
    return fail("the AI layout module is not loaded");
  }
  if (!text) {
    window.showFeedback?.("Type what you want arranged first.", "error");
    return { ok: false, stage: "instruction", code: "instruction_required" };
  }
  if (text.length > AI_ARRANGE_MAX_INSTRUCTION) {
    window.showFeedback?.("That instruction is too long to send.", "error");
    return { ok: false, stage: "instruction", code: "instruction_too_long" };
  }

  // O-2's second gate. The button is disabled without a key, but a stale button state must not
  // become a request; `getApiKey` is the store, which is the only authority on this.
  const settings = window.AiSettings;
  if (!settings || typeof settings.hasStoredKey !== "function") {
    return fail("the AI settings store is not available");
  }
  if (!(await settings.hasStoredKey())) {
    window.showFeedback?.("Add your AI key in AI settings first.", "error");
    return { ok: false, stage: "key", code: "api_key_required" };
  }

  if (typeof window.scanLayout !== "function") {
    return fail("the sheet is not ready yet - nothing was changed.");
  }

  let layout;
  try {
    layout = await window.scanLayout();
  } catch {
    window.showFeedback?.("Could not read the current layout - nothing was changed.", "error");
    return { ok: false, stage: "scan", code: "scan_failed" };
  }
  const collected = collectSections(layout);
  if (!collected.rows.length) {
    window.showFeedback?.("The sheet has no sections to arrange.", "error");
    return { ok: false, stage: "scan", code: "live_ids_empty" };
  }

  let messages;
  try {
    messages = core.buildMessages(collected.rows, text, { liveSectionIds: collected.ids });
  } catch (err) {
    // `buildMessages` throws ONLY for caller mistakes that must never reach the network — an
    // instruction carrying a pasted key, an id not in the scan. Both are refusals with copy.
    const code = err && err.code ? String(err.code) : "request_shape";
    window.showFeedback?.(instructionProblem(code), "error");
    return { ok: false, stage: "prompt", code };
  }

  let cfg;
  try {
    cfg = await settings.loadSettings();
  } catch {
    cfg = null;
  }
  const busy = showBusy("Asking your AI…");
  let reply;
  try {
    reply = await sendByokChat(messages, {
      provider: cfg && cfg.provider ? cfg.provider : "",
      model: cfg && cfg.model ? cfg.model : "",
      maxTokens: core.DEFAULT_MAX_TOKENS,
      // NO hardcoded timeout here: `sendByokChat` reads `meta.timeoutMs` (60 s default) and
      // falls back to `window.__AI_ARRANGE_TEST_TIMEOUT_MS__` for tests that exercise the
      // content-side deadline (a suspended MV3 service worker mid-request). Hardcoding it here
      // would override both and the test would hang a full minute.
    });
  } finally {
    clearBusy(busy);
  }
  if (!reply || reply.ok !== true) {
    const cls = reply && reply.errorClass ? String(reply.errorClass) : "unknown";
    window.showFeedback?.(AI_ARRANGE_ERROR_COPY[cls] || AI_ARRANGE_ERROR_COPY.unknown, "error");
    return { ok: false, stage: "transport", code: cls };
  }
  // A reply that claims success but carries no text is a transport boundary failure, not a model
  // one: the worker's `byokChatReply` always sets `text` on `ok:true`, so a missing string here is
  // the worker's own reply being malformed. Calling it `model_output_not_json` would blame the
  // model for the extension's own bug.
  if (typeof reply.text !== "string") {
    window.showFeedback?.(AI_ARRANGE_ERROR_COPY.malformed, "error");
    return { ok: false, stage: "transport", code: "malformed" };
  }

  // AC-2 begins here: from this line to the preview, NOTHING writes to the DOM or to storage.
  const verdict = core.parseModelOutput(reply.text, collected.ids, {
    current: layout.sections,
  });
  if (!verdict.ok) {
    const first = verdict.errors && verdict.errors.length ? verdict.errors[0] : null;
    const code = first && first.code ? String(first.code) : verdict.code || "envelope_shape";
    window.showFeedback?.(AI_ARRANGE_REJECT_COPY[code] || AI_ARRANGE_REJECT_COPY.envelope_shape, "error");
    return { ok: false, stage: "validate", code };
  }

  const patch = verdict.patch;
  const summary = core.summarizePatch(patch);
  if (!summary.moves && !summary.hides) {
    // An empty patch is a refusal like any other: the model answered in shape but proposed
    // nothing. It shares the `envelope_empty` code with the validator, and it must carry the SAME
    // error-kind toast and the SAME copy the rest of the refusals use — an "info" toast that
    // drains in ~3.5 s is exactly the failure mode AC-6's "distinct user-visible message" exists
    // to prevent. Marking it "error" is the fix; the copy comes from the one table, not a literal.
    window.showFeedback?.(AI_ARRANGE_REJECT_COPY.envelope_empty, "error");
    return { ok: false, stage: "preview", code: "envelope_empty" };
  }

  const accepted = await showPreviewDialog(patch, summary, layout);
  if (!accepted) {
    // AC-2's Cancel half, asserted as a fact about this code path: the ONLY writes below are
    // reached from here, so a cancel cannot have touched anything.
    return { ok: false, stage: "cancelled", code: "cancelled" };
  }

  // ---- AC-3: an ordinary mutation, through the machinery every gesture uses ----------------
  const mut = window.beginMutation(snapshotAiFields(layout));
  mergePatchIntoLayout(layout, patch);
  if (typeof window.applyLayout !== "function") {
    return fail("the layout apply path is unavailable - nothing was changed.");
  }
  try {
    await window.applyLayout(layout);
  } catch {
    // `applyLayout` is the same call a drag makes; a throw means the record was refused. The
    // capture is dropped rather than pushed, so the stack cannot gain an entry for a change that
    // did not land (js/undo.js:109's rule, from the other side).
    window.showFeedback?.("The arrangement could not be applied - nothing was changed.", "error");
    return { ok: false, stage: "apply", code: "apply_failed" };
  }
  window.pushMutation(mut, "AI arrange", window.MUTATION_CLASSES.POSITION,
    (layout, snap) => repairAiLayout(layout, snap));
  if (typeof window.handleSaveBrowser === "function") {
    await window.handleSaveBrowser();
  } else {
    window.showFeedback?.("Arranged - but nothing saved yet (the save control is unavailable).", "error");
  }
  return { ok: true, stage: "applied", summary };
}

/** The copy for a prompt-constructor refusal, which is about the user's text, not the provider. */
function instructionProblem(code) {
  switch (code) {
    case "instruction_contains_credential":
      return "That looks like an API key - put it in AI settings instead of the instruction.";
    case "instruction_too_long":
      return "That instruction is too long to send.";
    case "instruction_required":
      return "Type what you want arranged first.";
    default:
      return "Could not build the request - nothing was changed.";
  }
}

/** A refusal that should never have been reachable: say it plainly, change nothing. */
function fail(message) {
  window.showFeedback?.(message, "error");
  return { ok: false, stage: "guard", code: "unavailable" };
}

/**
 * The busy affordance. A separate node rather than `showFeedback("…")` because the toast drains
 * after ~3.5 s and a provider round trip takes longer than that — a request with no answer on
 * screen reads as a dead extension (the same reasoning as the worker's 45 s deadline).
 */
function showBusy(text) {
  if (typeof document === "undefined" || !document.body) return null;
  const node = document.createElement("div");
  node.className = "be-ai-busy";
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  node.textContent = text;
  document.body.appendChild(node);
  return node;
}

function clearBusy(node) {
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

// ---------------------------------------------------------------------------
// The surface
// ---------------------------------------------------------------------------

/**
 * The AI bar's prompt surface: a text box, an "Ask" submit, and the refusal copy INSIDE the
 * dialog rather than only as a toast.
 *
 * WHY A DIALOG AND NOT AN INLINE PANEL ROW. Three measured reasons. (1) The tray is 232px wide
 * and its labels already ellipsize at ~28 characters (`js/controls.js:833-836` documents that for
 * Undo), so a free-text instruction has no room to be typed in. (2) AC-6 wants each failure
 * readable; a refusal that only lands in a toast drains in ~3.5 s while the user is deciding
 * whether to rephrase, and the fleet already learned that once (the 21-word gate refusal sentence
 * that `ux_gaps_20260911` AC-4 split in two). Keeping the dialog open on a refusal and writing the
 * sentence into the shell's own live-region message area (`js/modals.js:81-85`) means the copy is
 * both read and announced. (3) It reuses `Modals.__createModal`, so it inherits the focus trap,
 * Escape, the ✕, the backdrop and the theme — a hand-rolled bar would re-implement all five and
 * drift from them.
 *
 * The instruction is never sent from here: this returns the text and `arrangeWithAi` owns the
 * order of operations, so the prompt surface cannot become a second path to the network.
 *
 * @return {Promise<void>} resolves when the surface is closed (accepted, cancelled, or refused
 *   without a retry) — there is no value because no caller acts on it.
 */
function showAiArrangeSurface() {
  const api = window.Modals;
  if (!api || typeof api.__createModal !== "function") {
    window.showFeedback?.("Could not open the AI arrange dialog - nothing was changed.", "error");
    return Promise.resolve();
  }
  // A plain box, NOT a property on `handle`: `body(ctx)` runs INSIDE `__createModal`, before the
  // `const handle` below has been initialised, so touching it here is a TDZ ReferenceError — the
  // same capture hazard `js/ai_settings.js`'s header documents for cross-module seams.
  const refs = {};
  const handle = api.__createModal({
    title: "Ask your AI to arrange the sheet",
    body: (ctx) => {
      const wrap = document.createElement("div");
      wrap.className = "be-ai-prompt";

      const field = document.createElement("label");
      field.className = "be-field";
      const lab = document.createElement("span");
      lab.className = "be-field-label";
      lab.textContent = "What should change?";
      const input = document.createElement("textarea");
      input.className = "be-modal-input be-ai-instruction";
      input.id = "be-ai-instruction";
      input.rows = 3;
      input.maxLength = AI_ARRANGE_MAX_INSTRUCTION;
      input.placeholder = "e.g. group the combat sections top-left and collapse the rest";
      input.setAttribute("aria-label", "Arrangement instruction");
      field.appendChild(lab);
      field.appendChild(input);
      wrap.appendChild(field);

      const hint = document.createElement("p");
      hint.className = "be-modal-hint be-ai-prompt-hint";
      hint.textContent = AI_ARRANGE_PRIVACY_HINT;
      wrap.appendChild(hint);
      ctx.bodyEl.appendChild(wrap);
      refs.input = input;
      refs.hint = hint;
      // The dialog exists to type into, so focus the field rather than the first action.
      setTimeout(() => input.focus(), 0);
    },
    actions: (ctx) => {
      const ask = document.createElement("button");
      ask.type = "button";
      ask.className = "be-modal-ok be-ai-ask";
      ask.textContent = "Ask";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "be-modal-cancel be-ai-cancel-ask";
      cancel.textContent = "Cancel";
      ask.addEventListener("click", () => {
        const text = (refs.input && refs.input.value) || "";
        if (!text.trim()) {
          ctx.setMessage("Type what you want arranged first.", "error", refs.input);
          return;
        }
        // Close FIRST, then run: the flow draws its own preview dialog, and two modals stacked
        // on one host would leave the preview underneath the prompt.
        ctx.close({ instruction: text.trim() });
      });
      cancel.addEventListener("click", () => ctx.close(null));
      ctx.actionsRow.appendChild(cancel);
      ctx.actionsRow.appendChild(ask);
    },
  });
  // Name the route once, asynchronously, rather than blocking the paint on a storage read. The
  // generic privacy sentence is already on screen, so the dialog is never missing an explanation.
  handle.refs = refs;
  loadRouteHint(handle);
  return handle.promise.then((result) => {
    if (!result || !result.instruction) return undefined;
    return arrangeWithAi(result.instruction).then((outcome) => {
      // A refusal from the flow (bad key, prose answer, invalid patch) reopens the prompt with
      // the sentence IN it, so the user can rephrase without hunting for the button again. A
      // cancel or a refusal to even start (`stage: "cancelled"`) stays closed — re-asking the
      // same thing is not what a Cancel means.
      if (outcome && outcome.ok) return outcome;
      const stage = outcome ? outcome.stage : "";
      if (stage === "cancelled" || stage === "preview" || stage === "instruction") return outcome;
      const copy =
        AI_ARRANGE_ERROR_COPY[outcome.code] ||
        AI_ARRANGE_REJECT_COPY[outcome.code] ||
        "Nothing was changed.";
      return showAiRefusal(copy).then(() => outcome);
    });
  });
}

/** A refusal that keeps the user's place: the copy, and the same Ask/Cancel pair. */
function showAiRefusal(copy) {
  const api = window.Modals;
  if (!api || typeof api.__createModal !== "function") return Promise.resolve(null);
  const handle = api.__createModal({
    title: "Nothing was arranged",
    body: (ctx) => {
      const p = document.createElement("p");
      p.className = "be-modal-hint be-ai-refusal";
      p.textContent = copy;
      ctx.bodyEl.appendChild(p);
    },
    actions: (ctx) => {
      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "be-modal-ok be-ai-refusal-ok";
      ok.textContent = "OK";
      ok.addEventListener("click", () => ctx.close(null));
      ctx.actionsRow.appendChild(ok);
    },
  });
  return handle.promise;
}

/**
 * The privacy sentence the prompt shows BEFORE the route is known, so the dialog never renders
 * without an explanation of what leaves the machine. O-3's widened field set is what this lists —
 * headings, position, size and stacking order. It does NOT say "no text", because a section
 * heading is text and on a live sheet can carry a monster's or NPC's name (AC-D1's copy rule).
 */
const AI_ARRANGE_PRIVACY_HINT =
  "Sends the section headings, positions, sizes and stacking order to your AI provider. " +
  "Your key stays on this device and is never sent with it.";

/**
 * Name the provider + model actually configured, once, under the generic hint.
 *
 * A storage read, so it runs after the paint rather than blocking it. Written from the STORED
 * record (`loadSettings()`), never from a re-typed list: a hint that names a model the product
 * would not dial is a worse lie than no hint, and this is the one place the dialog claims what
 * the request will contain.
 */
function loadRouteHint(handle) {
  const settings = window.AiSettings;
  if (!settings || typeof settings.loadSettings !== "function" || !handle.refs) return;
  Promise.resolve()
    .then(() => settings.loadSettings())
    .then((current) => {
      if (!current || !current.provider || !current.model) return;
      const core = window.AiLayout;
      const known = core && core.PROVIDERS && core.PROVIDERS[current.provider];
      const label = (known && known.label) || current.provider;
      handle.refs.hint.textContent =
        AI_ARRANGE_PRIVACY_HINT + " Route: " + label + " / " + current.model + ".";
    })
    .catch(() => {
      // The generic hint already on screen is the answer; a failed read must not remove it.
    });
}

const AiArrange = {
  AI_ARRANGE_ERROR_COPY,
  AI_ARRANGE_REJECT_COPY,
  AI_ARRANGE_MAX_INSTRUCTION,
  AI_ARRANGE_PRIVACY_HINT,
  arrangeWithAi,
  showAiArrangeSurface,
  collectSections,
  // Test seam (track byok_ai_layout_20260915 Phase 4 — KEEP): the record's unit reader. Its product
  // caller is `collectSections` above (and the ghost/preview geometry), and it is published because
  // totality here is what keeps a scan record with a missing or non-numeric field from throwing in
  // the middle of an arrange — a case the flow itself cannot reach by any other route.
  parsePx,
  mergePatchIntoLayout,
  snapshotAiFields,
  repairAiLayout,
  showPreviewDialog,
  createGhostLayer,
  removeGhostLayer,
  // Test seam (track byok_ai_layout_20260915 Phase 4 — KEEP): the transport wrapper is driven
  // directly by test/unit/ai_arrange.test.js, which asserts the body it builds carries EXACTLY
  // the five keys the worker accepts. The reader is that suite plus the product flow above;
  // deleting the line means deleting the claim.
  sendByokChat,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = AiArrange;
}
if (typeof window !== "undefined") {
  // Test seam (track byok_ai_layout_20260915 Phase 4 — KEEP): the module's ONLY window seam. It has
  // TWO kinds of reader, and both are named rather than assumed: `js/controls.js` reaches the
  // product entry point through it (`window.AiArrange.showAiArrangeSurface`, the panel's "AI
  // Arrange" row), and `test/unit/ai_arrange.test.js` drives `mergePatchIntoLayout`,
  // `snapshotAiFields`, `repairAiLayout`, `collectSections` and `sendByokChat` through the same
  // object in a stubbed DOM.
  //
  // It deliberately does NOT also publish bare `window.arrangeWithAi` /
  // `window.showAiArrangeSurface`: a second route to the same function is surface with no reader,
  // and the audit counts each `window.*` line as its own claim (this file's first draft published
  // three and the guard was right to object to two of them).
  window.AiArrange = AiArrange;
}
