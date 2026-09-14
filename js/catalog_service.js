/**
 * Service for managing premade templates.
 */

/**
 * U-36 seams: in-app confirmation and error notice instead of the native
 * `confirm()` / `alert()`. Resolved at CALL time (js/modals.js is injected after
 * this file); a bare unit boot falls back to the native dialog so existing
 * `window.confirm` stubs keep working. Names are unique per file because several
 * modules are eval'd into ONE shared scope in the test harness.
 */
function catalogAskConfirm(opts) {
    const w = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null);
    if (w && typeof w.confirmAction === "function") return w.confirmAction(opts);
    const text = opts.title ? opts.title + "\n\n" + (opts.message || "") : opts.message || "";
    const nativeConfirm = w && typeof w.confirm === "function" ? w.confirm.bind(w) : null;
    return Promise.resolve(nativeConfirm ? nativeConfirm(text) : false);
}

/** Errors go to the themed, announced error toast rather than a blocking
 *  native alert; a bare boot logs instead of throwing. */
function catalogNotifyError(msg) {
    const w = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null);
    if (w && typeof w.showFeedback === "function") w.showFeedback(msg, "error");
    // AC-5: the ONE logger, resolved at call time — no direct console use outside it.
    else if (w && typeof w.safeLog === "function") w.safeLog("error", "[DDB Print] " + msg);
}
const CatalogService = {
    async loadCatalog() {
        try {
            const response = await fetch(chrome.runtime.getURL('catalog.json'));
            if (!response.ok) throw new Error('Failed to load catalog');
            return await response.json();
        } catch (err) {
            window.safeLog?.("error", '[DDB Print] Error loading catalog:', err);
            return { templates: [] };
        }
    },

    async loadTemplate(path) {
        try {
            const response = await fetch(chrome.runtime.getURL(path));
            if (!response.ok) throw new Error(`Failed to load template: ${path}`);
            const template = await response.json();
            
            if (!template) return null;

            // Compatibility: If template is a flat layout (no .data), wrap it
            if (!template.data) {
                // If it's already a layout (has sections or shapes), wrap it
                if (template.sections || template.shapes) {
                    return {
                        name: template.name || 'Custom Template',
                        version: template.version || '1.0.0',
                        data: template
                    };
                }
                throw new Error('Invalid template format: missing sections or shapes');
            }

            return template;
        } catch (err) {
            window.safeLog?.("error", `[DDB Print] Error loading template at ${path}:`, err);
            return null;
        }
    },

    async applyTemplate(templateId, skipConfirm = false) {
        const catalog = await this.loadCatalog();
        const entry = catalog.templates.find(t => t.id === templateId);
        if (!entry) {
            window.safeLog?.("error", `[DDB Print] Template ${templateId} not found in catalog.`);
            return false;
        }

        const template = await this.loadTemplate(entry.path);
        if (!template) {
            if (!skipConfirm) catalogNotifyError('Failed to load template data. It may be malformed.');
            return false;
        }

        // Deep validation
        if (!template.data.sections && !template.data.shapes) {
            window.safeLog?.("error", '[DDB Print] Template has no sections or shapes to apply.');
            return false;
        }

        // Conflict check & confirmation
        if (!skipConfirm) {
            const msg = `Apply template "${template.name}"? This will update border styles for several sections and add decorative shapes. Existing shapes may be replaced.`;
            
            const okToApply = await catalogAskConfirm({
                title: "Apply template",
                message: msg,
                confirmLabel: "Continue",
            });
            if (!okToApply) return false;
        }

        window.safeLog?.("log", `[DDB Print] Applying template: ${template.name}`);

        // 1. Apply Borders
        if (template.data.sections) {
            for (const [selector, config] of Object.entries(template.data.sections)) {
                // Try as ID first, then as general selector
                let section = document.getElementById(selector) || document.querySelector(selector);
                
                if (section) {
                    const wrapper = section.closest('.be-section-wrapper') || section;
                    if (config.left) wrapper.style.setProperty('left', config.left, 'important');
                    if (config.top) wrapper.style.setProperty('top', config.top, 'important');
                    if (config.width) section.style.setProperty('width', config.width, 'important');
                    if (config.height) section.style.setProperty('height', config.height, 'important');
                    
                    if (config.borderStyle) {
                        if (typeof clearBorderStyles === 'function') {
                            clearBorderStyles(section);
                        }
                        section.classList.add(config.borderStyle);
                    }
                }
            }
        }

        // 2. Apply Shapes
        if (template.data.shapes) {
            template.data.shapes.forEach(shape => {
                // Prevent duplicates by checking ID
                if (shape.id) {
                    const existing = document.getElementById(shape.id);
                    if (existing) {
                        const wrapper = existing.closest('.be-section-wrapper') || existing;
                        wrapper.remove();
                    }
                }

                if (typeof createShape === 'function') {
                    createShape(shape.assetPath, {
                        id: shape.id,
                        left: shape.left,
                        top: shape.top,
                        width: shape.width,
                        height: shape.height,
                        rotation: shape.rotation || 0
                    });
                }
            });
        }

        if (typeof updateLayoutBounds === 'function') updateLayoutBounds();
        if (typeof updatePrintStyles === 'function') updatePrintStyles();
        return true;
    }
};

/**
/**
 * Neutral placeholder for a missing template thumbnail (T-2 / AC-3): swaps
 * the broken <img> for an inline neutral badge so the catalog never renders
 * broken-dark. Returns a data URL (SVG).
 */
function thumbPlaceholder(name) {
  const label = String(name || "No preview")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='150'>` +
    `<rect width='200' height='150' fill='#2a2a2a'/>` +
    `<rect x='1' y='1' width='198' height='148' fill='none' stroke='#4a4a4a' stroke-width='2' stroke-dasharray='6 5'/>` +
    `<text x='100' y='78' fill='#b9a47a' font-family='serif' font-size='13' text-anchor='middle'>${label}</text>` +
    `</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function bindThumbFallback(img, name) {
  img.onerror = () => {
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "1";
    img.src = thumbPlaceholder(name);
    img.classList.add("be-catalog-thumb-fallback");
  };
}

/**
 * T-1 / AC-2 (custom_upload_templates_ux_20260909): PREMADE template catalog
 * as ONE overlay with an in-modal view state (grid ⇄ detail ⇄ confirm) — no
 * stacked 30000/31000 overlays. Chrome + a11y match the unified picker
 * modal conventions: ✕ / backdrop / Esc close (Esc steps back one view
 * first), focusable cards (role=button, Enter/Space open), labelled dialog,
 * and an IN-MODAL apply confirm (the native confirm() is gone — apply runs
 * with skipConfirm=true after the confirm step).
 */
async function showPremadeCatalogModal() {
  const catalog = await CatalogService.loadCatalog();
  const templates = (catalog.templates || []).filter((t) => t.active);

  return new Promise((resolve) => {
    let settled = false;
    let view = "grid"; // 'grid' | 'detail' | 'confirm'
    let current = null; // {template, details}

    const overlay = document.createElement("div");
    overlay.className = "be-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "be-modal";
    // AC-9 (U-33): the inline 640px was beating the shell's max-width below
    // ~700px of viewport. The shared shell rule governs the width now.
    modal.style.maxWidth = "640px";
    modal.style.maxHeight = "80vh";
    modal.style.overflow = "hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Templates");
    modal.style.position = "relative";

    const h3 = document.createElement("h3");
    h3.textContent = "Templates";
    modal.appendChild(h3);

    const closeBtn = document.createElement("button");
    closeBtn.className = "be-modal-close";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.onclick = () => closeModal(false);
    modal.appendChild(closeBtn);

    // Scrollable content host for the current view.
    const host = document.createElement("div");
    host.className = "be-catalog-view";
    host.style.cssText =
      "overflow-y: auto; max-height: calc(80vh - 120px); padding: 2px;";
    modal.appendChild(host);

    const actions = document.createElement("div");
    actions.className = "be-modal-actions";
    actions.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 14px;";
    const actionsLeft = document.createElement("div");
    actionsLeft.style.display = "flex";
    actionsLeft.style.gap = "10px";
    const actionsRight = document.createElement("div");
    actionsRight.style.display = "flex";
    actionsRight.style.gap = "10px";
    actions.appendChild(actionsLeft);
    actions.appendChild(actionsRight);
    modal.appendChild(actions);

    function closeModal(value) {
      if (settled) return;
      settled = true;
      window.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(value);
    }

    function wireEsc() {
      window.removeEventListener("keydown", onKey);
      window.addEventListener("keydown", onKey);
    }

    function setView(next, focusSel) {
      view = next;
      render();
      if (focusSel) {
        const el = modal.querySelector(focusSel);
        if (el) el.focus();
      }
    }

    // --- grid view -------------------------------------------------------
    function renderGrid() {
      host.innerHTML = "";
      const grid = document.createElement("div");
      grid.className = "be-catalog-grid";
      grid.style.cssText =
        "display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px;";
      host.appendChild(grid);

      const cards = [];
      templates.forEach((template) => {
        const item = document.createElement("div");
        item.className = "be-catalog-item";
        item.setAttribute("role", "button");
        item.setAttribute("aria-label", template.name);
        item.tabIndex = 0;
        item.style.cssText =
          "background:#333;border-radius:8px;padding:10px;cursor:pointer;border:2px solid transparent;transition:transform .2s, background-color .2s;";
        item.addEventListener("mouseenter", () => {
          item.style.transform = "translateY(-2px)";
          item.style.backgroundColor = "#444";
        });
        item.addEventListener("mouseleave", () => {
          item.style.transform = "translateY(0)";
          item.style.backgroundColor = "#333";
        });
        const openDetail = () => openDetailFor(template);
        item.addEventListener("click", openDetail);
        item.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDetail();
          } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            moveFocus(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            moveFocus(-1);
          }
        });

        const thumb = document.createElement("img");
        thumb.className = "be-catalog-thumbnail";
        thumb.alt = template.name;
        thumb.src = chrome.runtime.getURL(template.thumbnail);
        thumb.style.cssText =
          "width:100%;height:120px;object-fit:cover;border-radius:4px;margin-bottom:8px;display:block;";
        bindThumbFallback(thumb, template.name);
        item.appendChild(thumb);

        const name = document.createElement("div");
        name.className = "be-catalog-title";
        name.textContent = template.name;
        name.style.cssText = "font-weight:bold;font-size:14px;";
        item.appendChild(name);

        const desc = document.createElement("div");
        desc.className = "be-catalog-description";
        desc.textContent = template.description || "";
        desc.style.cssText = "font-size:11px;color:#ccc;margin-top:4px;";
        item.appendChild(desc);

        grid.appendChild(item);
        cards.push(item);
      });
      cards[0] && (cards[0].tabIndex = 0);

      function moveFocus(delta) {
        const idx = cards.indexOf(document.activeElement);
        if (idx < 0) return;
        const next = Math.max(0, Math.min(cards.length - 1, idx + delta));
        cards.forEach((c) => (c.tabIndex = -1));
        cards[next].tabIndex = 0;
        cards[next].focus();
      }

      actionsLeft.innerHTML = "";
      const count = document.createElement("span");
      count.textContent = `${templates.length} template${templates.length === 1 ? "" : "s"}`;
      count.style.cssText = "font-size:11px;color:#aaa;align-self:center;";
      actionsLeft.appendChild(count);

      actionsRight.innerHTML = "";
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "be-modal-cancel";
      cancelBtn.textContent = "Cancel";
      cancelBtn.onclick = () => closeModal(false);
      actionsRight.appendChild(cancelBtn);
    }

    async function openDetailFor(template) {
      const details = await CatalogService.loadTemplate(template.path);
      if (!details) return;
      current = { template, details };
      setView("detail", ".be-catalog-back");
    }

    // --- detail view ------------------------------------------------------
    function renderDetail() {
      host.innerHTML = "";
      const { template, details } = current;
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;flex-direction:column;gap:12px;";

      const pImg = document.createElement("img");
      pImg.alt = template.name;
      pImg.src = chrome.runtime.getURL(template.thumbnail);
      pImg.style.cssText =
        "width:100%;max-height:300px;object-fit:contain;border-radius:4px;";
      bindThumbFallback(pImg, template.name);
      wrap.appendChild(pImg);

      const pDesc = document.createElement("p");
      pDesc.textContent = template.description || "";
      pDesc.style.cssText = "margin:0;font-size:13px;color:#ccc;";
      wrap.appendChild(pDesc);

      const stats = document.createElement("div");
      stats.style.cssText = "font-size:12px;color:#aaa;";
      const sectionCount = Object.keys(details.data.sections || {}).length;
      const shapeCount = (details.data.shapes || []).length;
      stats.innerHTML = `Includes: <b>${sectionCount}</b> Borders, <b>${shapeCount}</b> Shapes`;
      wrap.appendChild(stats);

      host.appendChild(wrap);

      actionsLeft.innerHTML = "";
      const backBtn = document.createElement("button");
      backBtn.className = "be-modal-cancel be-catalog-back";
      backBtn.textContent = "Back";
      backBtn.onclick = () => setView("grid", ".be-catalog-item");
      actionsLeft.appendChild(backBtn);

      actionsRight.innerHTML = "";
      const applyBtn = document.createElement("button");
      applyBtn.className = "be-modal-ok";
      applyBtn.textContent = "Continue…";
      applyBtn.onclick = () => setView("confirm", ".be-catalog-confirm-cancel");
      actionsRight.appendChild(applyBtn);
    }

    // --- confirm view -----------------------------------------------------
    function renderConfirm() {
      host.innerHTML = "";
      const { template } = current;
      const warn = document.createElement("div");
      warn.style.cssText =
        "font-size:13px;color:#ccc;line-height:1.5;padding:6px 0;";
      warn.textContent = `Apply template “${template.name}”? This will update border styles for several sections and add decorative shapes. Existing shapes may be replaced.`;
      host.appendChild(warn);

      actionsLeft.innerHTML = "";
      const backBtn = document.createElement("button");
      backBtn.className = "be-modal-cancel";
      backBtn.textContent = "Back";
      backBtn.onclick = () => setView("detail", ".be-catalog-back");
      actionsLeft.appendChild(backBtn);

      actionsRight.innerHTML = "";
      const cancelC = document.createElement("button");
      cancelC.className = "be-modal-cancel be-catalog-confirm-cancel";
      cancelC.textContent = "Cancel";
      cancelC.onclick = () => setView("detail", ".be-catalog-back");
      actionsRight.appendChild(cancelC);

      const yesBtn = document.createElement("button");
      yesBtn.className = "be-modal-ok";
      yesBtn.textContent = "Continue";
      yesBtn.onclick = async () => {
        yesBtn.disabled = true;
        yesBtn.textContent = "Applying…";
        try {
          // Native confirm is gone — this in-modal confirm IS the gate.
          const success = await CatalogService.applyTemplate(template.id, true);
          if (success) {
            if (typeof showFeedback === "function") {
              showFeedback(`Template applied: ${template.name}`);
            }
            closeModal(true);
          } else {
            if (typeof showFeedback === "function") {
              showFeedback("Template could not be applied.", "error");
            }
            setView("detail", ".be-catalog-back");
          }
        } catch (err) {
          window.safeLog?.("error", "[DDB Print] Error applying template:", err);
          catalogNotifyError("An error occurred while applying the template.");
          setView("detail", ".be-catalog-back");
        }
      };
      actionsRight.appendChild(yesBtn);
    }

    function render() {
      if (view === "grid") renderGrid();
      else if (view === "detail") renderDetail();
      else renderConfirm();
    }

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (view === "detail") setView("grid", ".be-catalog-item");
        else if (view === "confirm") setView("detail", ".be-catalog-back");
        else closeModal(false);
      }
    }

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) closeModal(false);
    });

    document.body.appendChild(overlay);
    overlay.appendChild(modal);
    render();
    wireEsc();

    // Move focus INTO the dialog on open (U-20 follow-up: the audit measured
    // this dialog as `activeElementInside: false`, so it was keyboard-reachable
    // only after tabbing in from the page behind it). The first card is the
    // natural landing point; fall back to the close ✕, then the dialog itself.
    const landing =
      modal.querySelector(".be-catalog-item") ||
      modal.querySelector(".be-modal-close") ||
      modal.querySelector("button, [tabindex]");
    if (landing && typeof landing.focus === "function") landing.focus();
  });
}

// Test seam (track dead_exports_20260910 — has no product caller; KEEP): the
// product opens the catalog through `window.showPremadeCatalogModal` below, so
// this namespace is here for the tests that drive CatalogService directly
// (test/unit/catalog_logic.test.js and templates_catalog_ux.test.js among them).
// Remove only together with those tests.
window.CatalogService = CatalogService;
window.showPremadeCatalogModal = showPremadeCatalogModal;
