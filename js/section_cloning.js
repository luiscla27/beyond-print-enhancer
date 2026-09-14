/**
 * Section cloning & extraction ops: clone/extract section snapshots and
 * rollback of extracted/cloned sections.
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 7. Loaded before
 * js/main.js in the production script list (js/background.js) and in
 * the shared test harness boot.
 *
 * Cross-boundary seams (ratified 2026-09-07): helpers that remain owned
 * by other early modules / by main.js's public window handles are resolved
 * lazily at call time via window.X — never captured at module load, since
 * this module loads before main.js.
 */

"use strict";

/**
 * U-36: in-app confirmation instead of the native `confirm()`.
 *
 * Resolved at CALL time through the shared modal primitive (js/modals.js, which
 * is injected after this file), falling back to the native dialog when the
 * primitive is absent so bare unit boots and existing `window.confirm` stubs
 * keep working. The name is unique per file because several modules are eval'd
 * into ONE shared scope in the test harness.
 */
/**
 * Resolve the destructive-action gate at CALL time (track
 * destructive_recovery_20260911). js/persistence.js — which owns the snapshot
 * helper — is evaluated AFTER this module, so the seam is read per call and never
 * cached. Its absence (a bare harness without the persistence module) fails OPEN by
 * design; test/unit/destructive_recovery.test.js pins that the seam exists in a full
 * boot, so a regression cannot silently disarm the gates.
 */
async function cloningDestructiveGate(reason) {
  // AC-5: delegate to the ONE helper; this wrapper is only the call-time seam resolution, and
  // keeps the fail-open because this module is booted on its own by the unit harnesses.
  if (typeof window !== "undefined" && typeof window.destructiveGate === "function") {
    return window.destructiveGate(reason);
  }
  return { ok: true, missing: true };
}
function sectionCloningAskConfirm(opts) {
  const w = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null);
  if (w && typeof w.confirmAction === "function") return w.confirmAction(opts);
  const text = opts.title ? opts.title + "\n\n" + (opts.message || "") : opts.message || "";
  const nativeConfirm = w && typeof w.confirm === "function" ? w.confirm.bind(w) : null;
  return Promise.resolve(nativeConfirm ? nativeConfirm(text) : false);
}

function captureSectionSnapshot(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return null;

  const content = section.querySelector(".print-section-content");
  if (!content) return null;

  // Use centralized sanitization
  const sanitizedClone = window.SectionUtils.getSanitizedContent(content);

  const styles =
    (window.AssetCatalog && window.AssetCatalog.ALL_BORDER_STYLES) ||
    ["no-border"];
  const getBorderStyle = (el) => {
    return styles.find((style) => el.classList.contains(style)) || null;
  };

  return {
    originalId: sectionId,
    html: sanitizedClone.innerHTML,
    borderStyle: getBorderStyle(section),
    styles: {
      width: section.style.width,
      height: section.style.height,
    },
  };
}

function renderClonedSection(snapshot) {
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = snapshot.html;

  // Sanitize loaded HTML to prevent duplication
  const sanitizedClone = window.SectionUtils.getSanitizedContent(tempDiv);

  // Create the static header requested by user
  const staticHeader = document.createElement("div");
  staticHeader.className =
    ".ct-content-group__header".substring(1);
  const staticHeaderContent = document.createElement("div");
  staticHeaderContent.className =
    ".ct-content-group__header-content".substring(1);
  staticHeaderContent.textContent = snapshot.title;
  staticHeader.appendChild(staticHeaderContent);

  // Append header first
  fragment.appendChild(staticHeader);

  // Move all sanitized children to the fragment
  while (sanitizedClone.firstChild) {
    fragment.appendChild(sanitizedClone.firstChild);
  }

  const wrapper = window.createDraggableContainer(
    snapshot.title,
    fragment,
    snapshot.id,
  );
  const container = wrapper.querySelector(".print-section-container");
  container.classList.add("be-clone");
  container.dataset.originalId = snapshot.originalId;

  // Double-click to edit title
  wrapper.addEventListener("dblclick", async (e) => {
    e.stopPropagation();
    const staticTitleSpan = container.querySelector(
      ".ct-content-group__header-content",
    );
    const currentTitle =
      wrapper.dataset.title ||
      (staticTitleSpan ? staticTitleSpan.textContent.trim() : "Clone");
    // Use window reference for mockability in tests
    const newTitle = await window.showInputModal(
      "Edit Clone Title",
      "Enter new title:",
      currentTitle,
    );
    if (newTitle) {
      wrapper.dataset.title = newTitle;
      if (staticTitleSpan) staticTitleSpan.textContent = newTitle;
      window.showFeedback("Title updated");
    }
  });

  // Delete button
  const actionContainer = window.getOrCreateActionContainer(container);
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "be-clone-delete";
  deleteBtn.innerHTML = "🗑️";
  deleteBtn.title = "Delete Clone";
  deleteBtn.onclick = async (e) => {
    e.stopPropagation();
    const okToDelete = await sectionCloningAskConfirm({
      title: "Delete clone",
      message: "Delete this clone? This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (okToDelete) {
      // AC-1: snapshot first; refuse the delete when no backup can be made.
      const gate = await cloningDestructiveGate(
        `Delete clone "${(wrapper.dataset && wrapper.dataset.title) || "clone"}"`,
      );
      if (!gate.ok) return;
      wrapper.remove();
      window.showFeedback("Clone deleted");
      // AC-3: the snapshot just taken IS the undo.
      window.offerUndo && window.offerUndo(gate.record,
        `Deleted clone "${(wrapper.dataset && wrapper.dataset.title) || "clone"}"`,
      );
      window.updateLayoutBounds();
    }
  };
  actionContainer.appendChild(deleteBtn);

  // Use saved styles if available (top level for persistence, snapshot.styles for immediate)
  const width = snapshot.width || (snapshot.styles && snapshot.styles.width);
  const height =
    snapshot.height || (snapshot.styles && snapshot.styles.height);
  const left = snapshot.left;
  const top = snapshot.top;
  const zIndex = snapshot.zIndex;

  if (width) container.style.width = width;
  if (height) container.style.height = height;
  if (zIndex) wrapper.style.zIndex = zIndex;
  if (snapshot.printZIndex) wrapper.dataset.printZ = snapshot.printZIndex;
  if (snapshot.fontSize) window.SectionUtils.applyFontSize(wrapper, snapshot.fontSize);

  if (left && top) {
    wrapper.style.left = left;
    wrapper.style.top = top;
  } else {
    // Position it slightly offset from original or at top-left
    const original = document.getElementById(snapshot.originalId);
    if (original) {
      const originalWrapper =
        original.closest(".be-section-wrapper") || original;
      wrapper.style.left =
        (parseInt(originalWrapper.style.left) || 0) + 32 + "px";
      wrapper.style.top =
        (parseInt(originalWrapper.style.top) || 0) + 32 + "px";

      // Ensure it's in front of the original
      // Find max z-index in the layout
      let maxZ = 10;
      document.querySelectorAll(".be-section-wrapper").forEach((el) => {
        const z = parseInt(el.style.zIndex) || 10;
        if (z > maxZ) maxZ = z;
      });
      wrapper.style.zIndex = maxZ + 1;
    } else {
      wrapper.style.left = "32px";
      wrapper.style.top = "32px";
    }
  }

  if (snapshot.minimized) {
    container.dataset.minimized = "true";
    container.classList.add("minimized");
  }

  if (snapshot.compact) {
    container.classList.add("be-compact-mode");
    // Button style will be handled by injection or separate update if needed,
    // but let's try to set it if button exists contextually (though injection happens later usually)
  }

  if (snapshot.borderStyle) {
    container.classList.add(snapshot.borderStyle);
  }

  const layoutRoot = window.DomManager.getInstance().getLayoutRoot().element;
  if (layoutRoot) {
    window.DomManager.getInstance().getSectionsLayer().element.appendChild(wrapper);
  }

  // Re-init resize logic for the new container
  if (window.initResizeLogic) window.initResizeLogic();

  window.SectionUtils.refreshLayers();

  return wrapper;
}

function renderExtractedSection(snapshot) {
  // 1. Resolve the original element
  let original = document.getElementById(snapshot.originalId);

  // If ID lookup fails (common on reloads), use the selector path
  if (!original && snapshot.selector && snapshot.index !== undefined) {
    const matches = document.querySelectorAll(snapshot.selector);
    original = matches[snapshot.index];
    // Re-assign the ID if found so rollback works
    if (original) {
      original.id = snapshot.originalId;
    }
  }

  if (!original) {
    window.safeLog?.(
      "warn",
      `[DDB Print] Could not resolve original for extraction: ${snapshot.title}`,
    );
    return null;
  }

  // 2. Clone LIVE content
  const sanitizedClone = window.SectionUtils.getSanitizedContent(original);
  const sourceElement = sanitizedClone; // Alias for existing logic compliance
  sourceElement.style.display = "";
  sourceElement.classList.remove("be-extractable");

  // Hide original title inside the live clone to avoid duplication
  const originalHeader = sourceElement.querySelector(
    'h1, h2, h3, h4, h5, [class*="head"]',
  );
  if (originalHeader) {
    originalHeader.style.display = "none";
  }

  // 3. Assemble standardized header
  const fragment = document.createDocumentFragment();
  const header = document.createElement("div");
  header.className = "ct-content-group__header";
  const headerContent = document.createElement("div");
  headerContent.className = "ct-content-group__header-content";
  headerContent.textContent = snapshot.title;
  header.appendChild(headerContent);

  fragment.appendChild(header);

  // Promote children if it's a merge wrapper, otherwise append the clone
  if (sourceElement.classList.contains("be-merge-wrapper")) {
    while (sourceElement.firstChild) {
      fragment.appendChild(sourceElement.firstChild);
    }
  } else {
    fragment.appendChild(sourceElement);
  }

  const wrapper = window.createDraggableContainer(
    snapshot.title,
    fragment,
    snapshot.id,
  );
  wrapper.classList.add("be-extracted-section-wrapper");
  const container = wrapper.querySelector(".print-section-container");
  container.classList.add("be-extracted-section");
  container.dataset.originalId = snapshot.originalId;
  if (snapshot.parentSectionId) {
    container.dataset.parentSectionId = snapshot.parentSectionId;
  }
  if (snapshot.borderStyle) {
    container.classList.add(snapshot.borderStyle);
  }

  // Restore identification class for future merges
  if (snapshot.selector) {
    const idClass = snapshot.selector.split(".")[1]; // .be-ext-xxx.be-extractable -> be-ext-xxx
    if (idClass) container.dataset.beExtClass = idClass;
  }

  // 4. Link rollback logic — through `rollbackExtraction`, the class's one capture point.
  //
  // MEASURED DEFECT (coverage audit): the capture used to be inline here, and this handler
  // runs only for an extracted section RE-CREATED BY A RESTORE (`renderExtractedSection` is
  // called from `js/layout_apply.js` alone) — while the path a user actually takes
  // (`handleElementExtraction` in js/main.js) wired `.be-delete-button` straight to
  // `rollbackSection`. So the record was taken on the restore path and the COMMON case went
  // unrecorded. Both now call `rollbackExtraction`.
  const xBtn = wrapper.querySelector(".print-section-minimize");
  if (xBtn) {
    xBtn.title = "Rollback Extraction";
    xBtn.onclick = (e) => {
      e.stopPropagation();
      rollbackExtraction(container);
    };
  }

  // 5. Hide original in DOM
  original.style.setProperty("display", "none", "important");

  // 6. Apply styles
  if (snapshot.width)
    container.style.setProperty("width", snapshot.width, "important");
  if (snapshot.height)
    container.style.setProperty("height", snapshot.height, "important");
  if (snapshot.left)
    wrapper.style.setProperty("left", snapshot.left, "important");
  if (snapshot.top)
    wrapper.style.setProperty("top", snapshot.top, "important");
  if (snapshot.zIndex)
    wrapper.style.setProperty("z-index", snapshot.zIndex, "important");
  if (snapshot.printZIndex) wrapper.dataset.printZ = snapshot.printZIndex;
  if (snapshot.fontSize) window.SectionUtils.applyFontSize(wrapper, snapshot.fontSize);

  if (snapshot.minimized) {
    container.dataset.minimized = "true";
    container.classList.add("minimized");
  }

  if (snapshot.compact) {
    container.classList.add("be-compact-mode");
  }

  window.DomManager.getInstance().getSectionsLayer().element.appendChild(wrapper);

  if (window.injectCloneButtons) window.injectCloneButtons(container);
  if (window.injectAppendButton) window.injectAppendButton(container);
  if (window.initResizeLogic) window.initResizeLogic();

  return wrapper;
}

function rollbackSection(container) {
  const wrapper = container.closest(".be-section-wrapper") || container;
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

  wrapper.remove();
  window.updateLayoutBounds();
  window.SectionUtils.refreshLayers();
  window.showFeedback("Extraction rolled back");
}


/**
 * Roll back an extraction, recording it first — the ONE capture point for this class.
 *
 * WHY IT IS A SEPARATE FUNCTION (track undo_stack_20260911, coverage audit). Rolling back an
 * extraction had TWO user paths, and the capture was wired onto only one of them:
 *
 *   - `handleElementExtraction` (js/main.js) — what the user actually does: extract something,
 *     then roll IT back. Connected `.be-delete-button` straight to `rollbackSection`.
 *   - `renderExtractedSection` (here) — reached ONLY from `js/layout_apply.js`, i.e. the
 *     RESTORE path.
 *
 * So the capture existed, the suite was green, and the common case was NOT undoable. Both
 * handlers now call this, so one capture point covers both and there is no path left to miss.
 *
 * It deliberately does NOT replace `rollbackSection`: that stays the pure, SYNCHRONOUS
 * mutation, because a caller may drive it directly and assert immediately (an existing test
 * does exactly that, and deferring the mutation by an await would break it while changing
 * nothing a user could perceive). The recording is what needs the await, so the recording
 * lives here.
 */
async function rollbackExtraction(container) {
  if (typeof window.captureUndo === "function") {
    await window.captureUndo("Roll back extraction", window.MUTATION_CLASSES.STRUCTURAL);
  }
  rollbackSection(container);
}

const SectionCloning = {
  captureSectionSnapshot,
  renderClonedSection,
  renderExtractedSection,
  rollbackSection,
  rollbackExtraction,
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = SectionCloning;
}
if (typeof window !== "undefined") {
  window.SectionCloning = SectionCloning;
}
