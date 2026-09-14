/**
 * Spells UI: floating spell-detail section creation, character-id parsing,
 * spell fetch/cache and detail-trigger injection.
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 10. Loaded before
 * js/main.js in the production script list (js/background.js) and in
 * the shared test harness boot.
 *
 * Cross-boundary seams (ratified 2026-09-07): Storage is the storage.js
 * module (window.__DDBStorage), reached lazily at call time. PeDom(),
 * createDraggableContainer, showFeedback, applyFontSize, updateLayoutBounds
 * and safeLog resolve via window.* at call time — never captured at module
 * load, since this module loads before main.js.
 */

"use strict";

function injectSpellDetailTriggers(context = document) {
  let rows;
  if (window.DomManager) {
    // If context is an ElementWrapper, DomManager handles it
    // If context is raw HTMLElement, we can wrap it or pass it if DomManager supports
    // Our getSpellRows supports HTMLElement context
    rows = window.DomManager.getInstance()
      .getSpellRows(context)
      .map((w) => w.element);
  } else {
    rows = context.querySelectorAll(".ct-spells-spell");
  }

  rows.forEach((row) => {
    if (row.querySelector(".be-spell-details-button")) return;

    const label = row.querySelector(".ct-spells-spell__label");
    if (!label) return;

    const spellName = label.textContent.trim();

    const btn = document.createElement("button");
    btn.className = "be-spell-details-button";
    btn.innerText = "Details";
    btn.onclick = (e) => {
      e.stopPropagation();
      // Coordinates for floating section
      const coords = {
        x: e.clientX,
        y: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY,
      };
      if (window.createSpellDetailSection) {
        window.createSpellDetailSection(spellName, coords);
      } else {
        window.safeLog?.(
          "log",
          `[DDB Print] Details clicked for ${spellName} at`,
          coords,
        );
      }
    };

    row.appendChild(btn);
  });
}

async function createSpellDetailSection(
  spellName,
  coords,
  restoreData = null,
) {
  // 0. Check for existing section for this spell
  const existing = Array.from(
    document.querySelectorAll(".be-spell-detail"),
  ).find((el) => {
    const wrapper = el.closest(".be-section-wrapper");
    return wrapper && wrapper.dataset.title === spellName;
  });
  if (existing && !restoreData) {
    // Bring to front
    const wrapper = existing.closest(".be-section-wrapper");
    let maxZ = 10000;
    document.querySelectorAll(".be-section-wrapper").forEach((el) => {
      const z = parseInt(el.style.zIndex) || 10;
      if (z > maxZ) maxZ = z;
    });
    if (wrapper) wrapper.style.zIndex = maxZ + 1;
    if (existing.scrollIntoView) {
      existing.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    window.showFeedback(`${spellName} is already open`);
    return;
  }

  const id = restoreData ? restoreData.id : `spell-detail-${Date.now()}`;

  // 1. Create immediate shell
  const content = document.createElement("div");
  content.className = "print-section-content";
  content.innerHTML = '<div class="be-spinner"></div>';

  const wrapper = window.createDraggableContainer(spellName, content, id);
  wrapper.classList.add(
    "be-spell-detail-wrapper",
    "be-extracted-section-wrapper",
  );
  const container = wrapper.querySelector(".print-section-container");
  container.classList.add("be-spell-detail", "be-extracted-section");

  const layoutRoot = window.DomManager.getInstance().getLayoutRoot().element;

  if (restoreData) {
    if (restoreData.left)
      wrapper.style.setProperty("left", restoreData.left, "important");
    if (restoreData.top)
      wrapper.style.setProperty("top", restoreData.top, "important");
    if (restoreData.width)
      container.style.setProperty("width", restoreData.width, "important");
    if (restoreData.height)
      container.style.setProperty("height", restoreData.height, "important");
    if (restoreData.zIndex)
      wrapper.style.setProperty("z-index", restoreData.zIndex, "important");
    if (restoreData.printZIndex)
      wrapper.dataset.printZ = restoreData.printZIndex;
    if (restoreData.fontSize) window.SectionUtils.applyFontSize(wrapper, restoreData.fontSize);

    if (restoreData.minimized) {
      container.dataset.minimized = "true";
      container.classList.add("minimized");
    }
  } else {
    // Calculate relative coordinates to the layout wrapper
    const rootRect = layoutRoot.getBoundingClientRect();

    // Use clientX/Y but subtract parent Rect to account for transforms/scrolling parent
    const x = coords.x - rootRect.left;
    const y = coords.y - rootRect.top;

    wrapper.style.position = "absolute";
    wrapper.style.left = `${x}px`;
    wrapper.style.top = `${y}px`;
    container.style.width = "300px";
    container.style.height = "auto";
    wrapper.style.zIndex = window.Z.PANEL; // AC-5 (was "10000")
  }

  window.DomManager.getInstance().getSectionsLayer().element.appendChild(wrapper);
  if (window.injectCloneButtons) window.injectCloneButtons(container);
  if (window.injectAppendButton) window.injectAppendButton(container);

  // 2. Fetch Data (lazy seam, codebase convention)
  const spell = await (window.fetchSpellWithCache || fetchSpellWithCache)(spellName);

  const contentWrapper = container.querySelector(".print-section-content");
  if (!contentWrapper) return;

  if (spell) {
    // 3. Render Data
    const header = document.createElement("div");
    header.className =
      ".ct-content-group__header".substring(1);
    const headerContent = document.createElement("div");
    headerContent.className =
      ".ct-content-group__header-content".substring(1);
    headerContent.textContent = spell.name;
    header.appendChild(headerContent);

    contentWrapper.innerHTML = `
          <div style="padding: 10px; color: black; background: white;">
              <div style="font-weight: bold; border-bottom: 1px solid #ccc; margin-bottom: 5px; padding-bottom: 2px;">
                  Level ${spell.level} ${spell.school}
              </div>
              <div style="margin-bottom: 10px; font-style: italic; font-size: 0.9em;">
                  Range: ${spell.range}
              </div>
              <div class="spell-description" style="white-space: pre-wrap; font-size: 13px;">${spell.description}</div>
          </div>
      `;
    contentWrapper.prepend(header);
  } else {
    // 4. Render Error — AC-4 (U-18): name the ACTUAL cause. The manage-spells
    // instruction only appears in the one case where it is actionable (the
    // character's spell list loaded and does not contain this spell).
    const reason =
      (window.SpellsUi &&
        typeof window.SpellsUi.getLastSpellLoadFailure === "function" &&
        window.SpellsUi.getLastSpellLoadFailure()) ||
      (typeof getLastSpellLoadFailure === "function"
        ? getLastSpellLoadFailure()
        : null);
    const failureCopy =
      reason === "not-in-list"
        ? `<strong>&ldquo;${spellName}&rdquo; is not in this character&rsquo;s spell list.</strong> ` +
          `Only spells the character has are available here. ` +
          `Please add the spell from the manage spells button and try again.`
        : reason === "no-character"
          ? `<strong>No character is open, so spell details cannot be loaded.</strong> ` +
            `Open a character sheet and try again.`
          : `<strong>Loading &ldquo;${spellName}&rdquo; failed.</strong> ` +
            `This is usually temporary. Try Retry.`;
    contentWrapper.innerHTML = `
          <div style="padding: 15px; color: #721c24; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
              ${failureCopy}
              <div class="be-error-actions">
                  <button class="ct-theme-button be-retry-button">Retry</button>
                  <button class="ct-theme-button be-delete-button">Delete</button>
              </div>
          </div>
      `;

    contentWrapper.querySelector(".be-delete-button").onclick = () =>
      container.remove();
    contentWrapper.querySelector(".be-retry-button").onclick = () => {
      contentWrapper.innerHTML = '<div class="be-spinner"></div>';
      // AC-6/U-9 (ui_ux_review_20260910): remove the old container FIRST, then
      // re-create. The old order re-entered createSpellDetailSection while the
      // container was still in the DOM, so the duplicate guard fired — it
      // toasted "…is already open" and returned — and the next line then
      // removed the container, DELETING the section instead of recovering it.
      container.remove();
      createSpellDetailSection(spellName, coords);
    };
  }

  // Re-init resize logic for the new container
  if (window.initResizeLogic) window.initResizeLogic();
  window.updateLayoutBounds();

  return container;
}

function getCharacterId() {
  return window.location.pathname.split("/").pop();
}

/**
 * WHY the most recent spell load failed (AC-4, U-18).
 *
 * The error card used to blame one cause — "add the spell from the manage spells
 * button" — for EVERY failure of this path: a transient fetch error, an
 * unavailable character id, and a genuinely absent spell all produced the same
 * instruction to go press a button that, in two of those three cases, cannot
 * help. This records which one actually happened so the copy can name it.
 *
 * Codes:
 *   "no-character" — no character id on the page (e.g. not a character sheet).
 *   "not-in-list"  — the character's spell list loaded and does NOT contain it.
 *                    The ONLY case where the manage-spells instruction helps.
 *   "fetch-error"  — the fetch/parse threw, or the character data came back
 *                    unusable. Transient; retrying is the right advice.
 */
let _lastSpellLoadFailure = null;

/** Reason code from the most recent failed load (null when it succeeded). */
function getLastSpellLoadFailure() {
  return _lastSpellLoadFailure;
}

async function fetchSpellWithCache(spellName) {
  _lastSpellLoadFailure = null;
  try {
    await window.__DDBStorage.init();

    // 1. Check Cache
    const cached = await window.__DDBStorage.getSpell(spellName);
    if (cached) {
      window.safeLog?.("log", `[DDB Print] Cache Hit: ${spellName}`);
      return cached;
    }

    window.safeLog?.(
      "log",
      `[DDB Print] Cache Miss: ${spellName}. Fetching all spells...`,
    );

    // 2. Fetch API on miss
    const charId = getCharacterId();
    if (!charId || charId === "characters") {
      window.safeLog?.(
        "error",
        "[DDB Print] Could not determine character ID for spell fetch",
      );
      _lastSpellLoadFailure = "no-character";
      return null;
    }

    const spells = await getCharacterSpells(charId);
    if (spells && spells.length > 0) {
      // 3. Update Cache with ALL spells
      await window.__DDBStorage.saveSpells(spells);

      // 4. Return the specific spell
      const found = spells.find((s) => s.name === spellName) || null;
      if (!found) _lastSpellLoadFailure = "not-in-list";
      return found;
    }
    // The character's spells came back empty/unusable rather than "the spell is
    // missing" — that is a fetch-side problem, not a manage-spells one.
    _lastSpellLoadFailure = "fetch-error";
  } catch (err) {
    window.safeLog?.("error", "[DDB Print] Error in fetchSpellWithCache", err);
    _lastSpellLoadFailure = "fetch-error";
  }
  return null;
}

async function getCharacterSpells(charId) {
  const url = `https://character-service.dndbeyond.com/character/v5/character/${charId}`;

  try {
    // In MV3, cross-origin fetch must be done from background script
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "FETCH_CHARACTER_DATA", url },
        (result) => {
          resolve(result);
        },
      );
    });

    if (!response || !response.success) {
      throw new Error(
        response
          ? response.error
          : "Could not fetch character data via background.",
      );
    }

    const json = response.data;
    const data = json.data;

    // D&D Beyond stores spells in multiple arrays (Race, Class, Feats, etc.)
    // We flatten them all into one list
    const spellSources = [
      ...(data.classSpells || []),
      ...(data.spells.race || []),
      ...(data.spells.class || []),
      ...(data.spells.feat || []),
      ...(data.spells.item || []),
    ];

    // Some sources (like classSpells) are nested differently
    const spells = [];

    spellSources.forEach((source) => {
      // Handle class-specific nested spells
      if (source.spells) {
        source.spells.forEach((s) => spells.push(s.definition));
      }
      // Handle flat spell objects (items/feats/race)
      else if (source.definition) {
        spells.push(source.definition);
      }
    });

    // Map it to a cleaner format (Name + Description)
    return spells.map((s) => ({
      name: s.name,
      level: s.level,
      description: s.description.replace(/<[^>]*>?/gm, ""), // Strips HTML tags
      range: `${s.range.rangeValue || ""} ${s.range.origin}`,
      school: s.school,
    }));
  } catch (err) {
    window.safeLog?.("error", "Error fetching spells:", err);
  }
}


const SpellsUi = {
  createSpellDetailSection,
  getCharacterId,
  fetchSpellWithCache,
  getCharacterSpells,
  injectSpellDetailTriggers,
  // AC-4 (U-18) seam: the error branch above reads the reason through here so
  // the copy can name the actual cause. Resolved via window at call time
  // (working note 5) because this module loads before js/main.js.
  getLastSpellLoadFailure,
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = SpellsUi;
}
if (typeof window !== "undefined") {
  window.SpellsUi = SpellsUi;
}
