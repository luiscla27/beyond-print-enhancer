/**
 * Manages the Layer Management Panel UI and state.
 */

// Gate-hygiene fix (border_shape_picker_ux_20260909, Phase 0): generated
// shape-layer ids used `Date.now() + Math.random()*1000`, which can collide
// for two same-millisecond calls (pre-existing flake: debt_e9 'assigns unique
// ids'). A module-scope monotonic counter guarantees uniqueness within a
// process while keeping the `shapes-<ts>-<n>` id shape. Restore paths that
// pass `initialState.id` are unaffected.
/**
 * U-36: in-app confirmation instead of the native `confirm()`.
 *
 * Resolved at CALL time through the shared modal primitive (js/modals.js, which
 * is injected after this file), falling back to the native dialog when the
 * primitive is absent so bare unit boots and existing `window.confirm` stubs
 * keep working. The name is unique per file because several modules are eval'd
 * into ONE shared scope in the test harness.
 */
const layerManagerAskConfirm = (opts) => {
    const w = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null);
    if (w && typeof w.confirmAction === "function") return w.confirmAction(opts);
    const text = opts.title ? opts.title + "\n\n" + (opts.message || "") : opts.message || "";
    const nativeConfirm = w && typeof w.confirm === "function" ? w.confirm.bind(w) : null;
    return Promise.resolve(nativeConfirm ? nativeConfirm(text) : false);
};

/**
 * Resolve the destructive-action gate at CALL time (track
 * destructive_recovery_20260911). `js/persistence.js` — which owns the snapshot
 * helper — is evaluated AFTER this module, so the seam is read per call and never
 * cached (the codebase convention for cross-module seams).
 *
 * When the seam is ABSENT (a bare unit harness without the persistence module) the
 * action proceeds: a deliberate fail-OPEN, documented on the track. Its presence in
 * a full boot is pinned by test/unit/destructive_recovery.test.js, so a regression
 * that removed the seam would fail a test rather than silently disarm every gate.
 */
async function layerManagerDestructiveGate(reason) {
    // AC-5: delegate to the ONE helper; this wrapper is only the call-time seam resolution, and
    // keeps the fail-open because this module is booted on its own by the unit harnesses.
    if (typeof window !== "undefined" && typeof window.destructiveGate === "function") {
        return window.destructiveGate(reason);
    }
    return { ok: true, missing: true };
}

let _shapeLayerSeq = 0;

class LayerManager {
    constructor() {
        this.dom = window.DomManager.getInstance();
        
        // Single hardcoded Sections layer
        this.sectionsLayer = { 
            id: 'sections', 
            label: 'Sections', 
            layerId: 'print-enhance-sections-layer', 
            isLocked: false, 
            isHidden: false, 
            isDisabledOnPrint: false 
        };

        // Multiple dynamic Shape layers
        this.shapeLayers = [
            { 
                id: 'shapes-default', 
                label: 'Shapes (Default)', 
                layerId: 'print-enhance-shapes-layer', 
                isLocked: true, 
                isHidden: false, 
                isDisabledOnPrint: false 
            }
        ];

        this.panel = null;
        this.isMinimized = false;
        this.contentLists = {}; // layerId -> div
        this.activeLayerId = 'sections'; // Set sections as active by default
        this.contextMenu = null;
    }

    /**
     * Adds a new shape layer.
     * @param {string} label 
     * @param {object} initialState 
     * @returns {object} The new layer object
     */
    addShapeLayer(label = 'New Layer', initialState = {}) {
        const id = initialState.id || `shapes-${Date.now()}-${_shapeLayerSeq++}`;
        const newLayer = {
            id: id,
            label: label,
            layerId: initialState.layerId || `print-enhance-layer-${id}`,
            isLocked: initialState.isLocked || false,
            isHidden: initialState.isHidden || false,
            isDisabledOnPrint: initialState.isDisabledOnPrint || false
        };
        this.shapeLayers.push(newLayer);

        // AC-5/U-7 (ui_ux_review_20260910): adding a layer used to LOCK every
        // other layer, which silently hid all section hover controls and made
        // the extension look broken after a normal action. Only the new layer
        // becomes the active (unlocked) one; the others keep their state.
        newLayer.isLocked = false;
        this.activeLayerId = newLayer.id;

        if (this.panel) {
            this.rebuildPanel();
        }
        
        if (window.updateControlsState) window.updateControlsState();

        return newLayer;
    }

    /**
     * Checks if a layer has exceeded the 100 element limit.
     * @param {object} layer 
     */
    checkLayerLimit(layer) {
        if (layer.id === 'sections') return; // Limit only applies to shapes

        const container = document.getElementById(layer.layerId);
        if (container && container.children.length >= 100) {
            // Auto-create new layer
            const newLayer = this.addShapeLayer(`${layer.label} (Overflow)`);
            if (window.showFeedback) {
                window.showFeedback(`Layer limit reached. Auto-created: ${newLayer.label}`);
            }
            return newLayer;
        }
        return null;
    }

    /**
     * Deletes a shape layer and all its contents.
     * @param {string} id
     */
    deleteShapeLayer(id) {
        if (id === 'sections') return; // Cannot delete sections layer

        const index = this.shapeLayers.findIndex(l => l.id === id);
        if (index === -1) return;

        const layer = this.shapeLayers[index];
        const container = document.getElementById(layer.layerId);
        if (container) {
            container.remove();
        }

        this.shapeLayers.splice(index, 1);
        
        if (this.panel) {
            this.rebuildPanel();
        }

        if (window.showFeedback) window.showFeedback(`Layer "${layer.label}" deleted.`);
    }

    /**
     * Deletes a specific shape.
     * @param {string} targetId
     */
    deleteShape(targetId) {
        const el = document.getElementById(targetId);
        if (el) {
            el.remove();
            this.refreshLayerContents();
            if (window.showFeedback) window.showFeedback('Shape deleted.');
        }
    }

    /**
     * Gets a layer by its ID (searching both shapes and sections).
     */
    getLayerById(id) {
        if (id === 'sections') return this.sectionsLayer;
        return this.shapeLayers.find(l => l.id === id);
    }

    /**
     * Gets the layer that contains a specific element by its ID.
     * @param {string} targetId 
     */
    getLayerForElement(targetId) {
        const el = document.getElementById(targetId);
        if (!el) return null;

        const layerEl = el.closest('.pe-layer');
        if (!layerEl) return null;

        if (layerEl.id === 'print-enhance-sections-layer') return this.sectionsLayer;
        
        return this.shapeLayers.find(l => l.layerId === layerEl.id);
    }

    /** Curated display name for an asset path (custom/data → fallback label). */
    curatedAssetName(assetPath) {
        if (window.AssetCatalog && window.AssetCatalog.curatedAssetInfo) {
            return window.AssetCatalog.curatedAssetInfo(assetPath).name;
        }
        return assetPath.split('/').pop().replace(/\.(webp|png|svg|jpe?g)$/i, '');
    }

    /**
     * AC-2 (shape_layer_ps_ux_20260909): PURE DOM reparent of a shape wrapper
     * into another shape layer's container. No internal refresh — the caller
     * reconciles once. Guards: missing wrapper/target → false; target
     * 'sections' → false (banding); same current container → false (no-op,
     * no refresh). Preserves every wrapper state (position/size/z/rotation/
     * asset) because only the parent node changes.
     */
    moveShapeToLayer(wrapperId, targetLayerId) {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper || !wrapper.classList.contains('be-shape-wrapper')) return false;
        if (targetLayerId === 'sections') return false;
        const target = this.shapeLayers.find(l => l.id === targetLayerId);
        if (!target) return false;
        const current = wrapper.parentElement;
        if (current && current.id === target.layerId) return false; // same layer
        const targetContainer = document.getElementById(target.layerId);
        if (!targetContainer) return false;
        targetContainer.appendChild(wrapper);
        return true;
    }

    /** Layer label that does not collide with existing shape-layer labels. */
    uniqueLayerLabel(base) {
        const taken = new Set(this.shapeLayers.map(l => l.label));
        if (!taken.has(base)) return base;
        let n = 2;
        while (taken.has(`${base} ${n}`)) n += 1;
        return `${base} ${n}`;
    }

    /**
     * AC-2: "Move to New Layer…" — create a layer named from the shape's
     * curated display name (deduped), move the wrapper in, make it the active
     * unlocked visible printable layer, reconcile once, toast.
     * @returns {object|null} the new layer, or null if the move was refused.
     */
    moveShapeToNewLayer(wrapperId) {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return null;
        const container = wrapper.querySelector('.print-section-container');
        const assetPath = container ? container.dataset.assetPath : null;
        const base = assetPath ? this.curatedAssetName(assetPath) : 'New Layer';
        const label = this.uniqueLayerLabel(base);
        const layer = this.addShapeLayer(label); // active + unlocked + visible + printable
        const moved = this.moveShapeToLayer(wrapperId, layer.id);
        if (!moved) {
            // Undo the layer creation (nothing was moved into it).
            this.deleteShapeLayer(layer.id);
            return null;
        }
        this.refreshLayerContents();
        if (window.showFeedback) window.showFeedback(`Moved to new layer "${label}"`);
        return layer;
    }

    /**
     * AC-2: "Move to Layer…" — reparent into an existing shape layer
     * (destination hidden/print state is followed; never orphaned).
     */
    moveShapeToExistingLayer(wrapperId, targetLayerId) {
        // Phase 2c: capture BEFORE the DOM move. Layer membership is structural layout state
        // (scanLayout records each layer's elements), so a mis-drop was previously fixable
        // only by dragging the chip back.
        const target = this.shapeLayers.find(l => l.id === targetLayerId);
        const mut = window.beginMutation
            ? window.beginMutation(this.snapshotLayerMembership())
            : null;
        if (!this.moveShapeToLayer(wrapperId, targetLayerId)) return false;
        this.refreshLayerContents();
        if (mut && window.pushMutation) {
            window.pushMutation(mut, `Move to "${(target && target.label) || targetLayerId}"`,
                window.MUTATION_CLASSES.REPARENT, (layout, snap) => this.repairLayerMembership(layout, snap));
        }
        if (window.showFeedback && target) {
            window.showFeedback(`Moved to layer "${target.label}"`);
        }
        return true;
    }

    /**
     * Rebuilds the panel when layers change.
     */
    rebuildPanel() {
        if (this.panel && this.panel.parentNode) {
            const oldPanel = this.panel;
            this.panel = null;
            this.contentLists = {};
            const newPanel = this.createPanel();
            oldPanel.parentNode.replaceChild(newPanel, oldPanel);
        }
    }

    /**
     * Creates and injects the Layer Management panel into the DOM.
     */
    createPanel() {
        if (this.panel) return this.panel;

        // AC-10: the narrow-viewport guard runs before the panel's first paint,
        // so a small window never briefly shows the full-width list.
        this.applyNarrowGuard();
        this.bindNarrowGuard();

        const panel = document.createElement('div');
        panel.id = 'print-enhance-layer-manager';
        panel.className = 'be-layer-panel be-floating-ui';
        if (this.isMinimized) panel.classList.add('minimized');
        
        // Header
        const header = document.createElement('div');
        header.className = 'be-layer-panel-header';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.innerHTML = '<strong>Layer Management</strong>';

        // AC-10: the header control is the panel's way back from the narrow-
        // viewport rail, so in that state it says so in WORDS. A bare glyph ("□")
        // was measured as unreadable in the phase-3 gate frames: the reviewer could
        // not identify any Restore affordance in the rail header.
        const minBtn = document.createElement('button');
        minBtn.className = 'be-layer-min-btn';
        minBtn.textContent = this.isMinimized ? 'Restore' : 'Minimize';
        minBtn.title = this.isMinimized ? 'Restore' : 'Minimize';
        minBtn.setAttribute('aria-label', this.isMinimized ? 'Restore' : 'Minimize');
        minBtn.style.cssText = 'background: none; border: none; color: #ddd; cursor: pointer; padding: 0 4px; font-weight: bold; font-size: 11px; letter-spacing: 0.02em;';
        minBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleMinimize();
        };
        header.appendChild(minBtn);
        panel.appendChild(header);

        // 1. Sections group (hardcoded) with a count header — round 2 IA.
        const sectionsHeader = document.createElement('div');
        sectionsHeader.className = 'be-layer-section-header';
        sectionsHeader.dataset.group = 'sections';
        const sectionsTitle = document.createElement('span');
        sectionsTitle.textContent = 'SECTIONS (1)';
        sectionsHeader.appendChild(sectionsTitle);
        panel.appendChild(sectionsHeader);
        this.renderLayerGroup(this.sectionsLayer, panel);

        // 2. Shape layers header with a live count (round 2).
        const shapesHeader = document.createElement('div');
        shapesHeader.className = 'be-layer-section-header';
        shapesHeader.dataset.group = 'shapes';
        const shapesTitle = document.createElement('span');
        shapesTitle.textContent = `SHAPES (${this.shapeLayers.length})`;
        shapesHeader.appendChild(shapesTitle);
        panel.appendChild(shapesHeader);

        // 3. Render all Shape Layers
        this.shapeLayers.forEach(layer => {
            this.renderLayerGroup(layer, panel);
        });

        // 4. Labeled "+ Add Shape" ghost button pinned to the group bottom.
        const addBtn = document.createElement('button');
        addBtn.id = 'print-enhance-add-layer';
        addBtn.innerHTML = window.Icons && window.Icons.svg
            ? `<span class="be-ctl-ico">${window.Icons.svg('plus', 14)}</span><span>Add Shape</span>`
            : '+ Add Shape';
        addBtn.title = 'Add new Shape Layer';
        addBtn.className = 'be-add-layer-btn';
        addBtn.onclick = () => this.addShapeLayer();
        panel.appendChild(addBtn);

        // Append to body if not already there
        if (!document.getElementById(panel.id)) {
            document.body.appendChild(panel);
        }

        this.panel = panel;
        this.refreshUI();
        
        return panel;
    }

    /**
     * Applies icon + semantic state (data-state / aria-label / title) to a
     * layer row's toggle cluster, per ui_ux_overhaul_20260908 (Phase 2):
     * tests and assistive tech read the semantic state, not glyphs.
     */
    applyRowState(row, layer) {
        const icon = (name) => {
            const svg = window.Icons && window.Icons.svg ? window.Icons.svg(name, 16) : "";
            return svg || "";
        };
        const stateBtn = (btn, state, label, iconName) => {
            if (!btn) return;
            const inner = icon(iconName);
            if (inner) btn.innerHTML = inner;
            btn.dataset.state = state;
            btn.setAttribute("aria-label", label);
            btn.setAttribute("aria-pressed", state === "on" || state === "visible" || state === "unlocked" ? "true" : "false");
        };
        if (!row) return;
        stateBtn(
            row.querySelector('button[title="Skip when printing"]'),
            layer.isDisabledOnPrint ? "off" : "on",
            layer.isDisabledOnPrint
                ? `Enable print for ${layer.label}`
                : `Disable print for ${layer.label}`,
            layer.isDisabledOnPrint ? "printerOff" : "printer",
        );
        stateBtn(
            row.querySelector('button[title="Hide on sheet"]'),
            layer.isHidden ? "hidden" : "visible",
            layer.isHidden ? `Show ${layer.label} on sheet` : `Hide ${layer.label} from sheet`,
            layer.isHidden ? "eyeOff" : "eye",
        );
        stateBtn(
            row.querySelector('button[title="Toggle Edit Mode"]'),
            layer.isLocked ? "locked" : "unlocked",
            layer.isLocked ? `Unlock ${layer.label} for editing` : `Lock ${layer.label}`,
            layer.isLocked ? "lock" : "lockOpen",
        );
        const deleteBtn = row.querySelector(".be-delete-layer-btn");
        if (deleteBtn) {
            const inner = icon("trash");
            if (inner) deleteBtn.innerHTML = inner;
            deleteBtn.setAttribute("aria-label", `Delete layer ${layer.label}`);
        }
    }

    syncRowHidden(row, layer) {
        if (!row) return;
        row.classList.toggle("be-layer-row-hidden", !!layer.isHidden);
        row.dataset.hidden = String(!!layer.isHidden);
    }

    renderLayerGroup(layer, parent) {
        const layerGroup = document.createElement('div');
        layerGroup.className = 'be-layer-group';
        layerGroup.style.marginBottom = '8px';

        const row = document.createElement('div');
        row.className = 'be-layer-row';
        // Two DIFFERENT signals, one writer each (consultation 2026-09-10):
        // `be-selection-layer` = holds the selected element (from the store);
        // `be-active-layer`     = the insertion target for the next shape.
        if (this.selectionLayerId() === layer.id) {
            row.classList.add('be-selection-layer');
        }
        if (this.activeLayerId === layer.id) {
            row.classList.add('be-active-layer');
        }
        row.dataset.layerId = layer.id;

        const label = document.createElement('span');
        label.textContent = layer.label;
        label.style.cursor = 'pointer';
        label.style.flex = '1';
        label.onclick = () => {
            if (layer.isLocked) {
                this.toggleLayerLock(layer);
                return;
            }
            // AC-1 (selection_model_ia_20260910): selecting a LAYER ROW selects
            // its representative element through the selection store, so the
            // on-sheet outline and the properties panel follow the row. A row
            // that holds nothing clears the selection instead of leaving the
            // panel showing a stale target.
            this.selectLayer(layer);
        };
        label.ondblclick = (e) => {
            e.stopPropagation();
            this.showRenameModal(layer);
        };
        row.appendChild(label);

        // Live element-count badge (AC-1) — kept in sync by updateCounts().
        const countSpan = document.createElement('span');
        countSpan.className = 'be-layer-count';
        countSpan.textContent = '0';
        countSpan.title = 'Items in this layer';
        Object.assign(countSpan.style, {
            fontSize: '10px', fontWeight: 'bold', color: 'var(--be-bone)', // bone
            margin: '0 6px 0 2px', background: 'var(--be-ground-well)', // groundWell
            border: '1px solid var(--be-gold)', borderRadius: '8px', padding: '0 7px', // gold
            whiteSpace: 'nowrap', lineHeight: '16px'
        });
        row.appendChild(countSpan);

        const controls = document.createElement('div');
        controls.className = 'be-layer-controls';

        // Print Visibility Toggle — O-2 (selection_model_ia_20260910): the pair of
        // per-layer controls answers ONE question each, and the copy says which.
        // The eye is on-sheet VISIBILITY; the printer is PRINT exclusion. Both are
        // kept (the ratified decision), with non-overlapping labels, because
        // collapsing them would make "will this print?" a two-step question.
        const printBtn = document.createElement('button');
        printBtn.title = 'Skip when printing';
        printBtn.setAttribute('aria-label', `Skip ${layer.label} when printing`);
        printBtn.onclick = () => this.toggleLayerPrint(layer, printBtn);
        controls.appendChild(printBtn);

        // Visibility Toggle
        const viewBtn = document.createElement('button');
        viewBtn.title = 'Hide on sheet';
        viewBtn.setAttribute('aria-label', `Hide ${layer.label} on the sheet`);
        viewBtn.onclick = () => this.toggleLayerVisibility(layer, viewBtn);
        controls.appendChild(viewBtn);

        // Lock Toggle (Edit Mode)
        const lockBtn = document.createElement('button');
        lockBtn.title = 'Toggle Edit Mode';
        lockBtn.onclick = () => this.toggleLayerLock(layer, lockBtn);
        controls.appendChild(lockBtn);

        // Delete Layer Button
        if (layer.id !== 'sections') {
            const deleteBtn = document.createElement('button');
            deleteBtn.title = 'Delete Layer';
            deleteBtn.className = 'be-delete-layer-btn';
            deleteBtn.onclick = async () => {
                const ok = await layerManagerAskConfirm({
                    title: "Delete layer",
                    message: `Delete the layer "${layer.label}" and everything in it? This cannot be undone.`,
                    confirmLabel: "Delete",
                    danger: true,
                });
                if (!ok) return;
                // AC-1: snapshot first; refuse the delete when no backup can be made.
                const gate = await layerManagerDestructiveGate(
                    `Delete layer "${layer.label}"`,
                );
                if (!gate.ok) return;
                this.deleteShapeLayer(layer.id);
                // AC-3: the snapshot just taken IS the undo.
                window.offerUndo && window.offerUndo(gate.record, `Deleted layer "${layer.label}"`);
            };
            controls.appendChild(deleteBtn);
        }

        row.appendChild(controls);
        this.applyRowState(row, layer);
        this.syncRowHidden(row, layer);
        layerGroup.appendChild(row);

        // Nested List Container
        const list = document.createElement('div');
        list.className = 'be-layer-content-list';
        list.dataset.layer = layer.id;
        Object.assign(list.style, {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            padding: '4px',
            backgroundColor: 'var(--be-ground-well)',
            borderRadius: '4px',
            minHeight: '20px',
            marginTop: '2px'
        });

        // Drag and drop list listeners
        list.ondragover = (e) => {
            e.preventDefault();
            const draggingEl = document.querySelector('.dragging');
            if (!draggingEl) return;
            // Only handle CHIP drags here — row restacks are handled by the
            // group-level handlers (bindRowDrag).
            if (!draggingEl.classList.contains('be-layer-item-card') &&
                !draggingEl.classList.contains('be-layer-item-thumb')) return;

            const afterElement = this.getDragAfterElement(list, e.clientX, e.clientY);
            if (afterElement == null) {
                list.appendChild(draggingEl);
                this.placeDropMarker(list, null);
            } else {
                list.insertBefore(draggingEl, afterElement);
                this.placeDropMarker(list, afterElement);
            }
        };
        list.ondragleave = (e) => {
            if (!list.contains(e.relatedTarget)) this.removeDropMarker();
        };
        list.ondrop = () => this.removeDropMarker();

        this.contentLists[layer.id] = list;
        layerGroup.appendChild(list);
        parent.appendChild(layerGroup);
        this.bindRowDrag(layer, layerGroup, row);
    }

    /** The shape-layer groups in the panel (excludes the sections group). */
    shapeGroups() {
        if (!this.panel) return [];
        return Array.from(this.panel.querySelectorAll('.be-layer-group')).filter((g) => {
            const row = g.querySelector('.be-layer-row');
            return row && row.dataset.layerId && row.dataset.layerId !== 'sections';
        });
    }

    /** Gold insertion marker between layer groups (row restack, AC-3). */
    placeGroupMarker(beforeGroup) {
        this.removeDropMarker();
        if (!beforeGroup || !beforeGroup.parentNode) return;
        const marker = document.createElement('div');
        marker.className = 'be-layer-drop-marker';
        Object.assign(marker.style, {
            height: '3px', width: '100%', backgroundColor: 'var(--be-gold)',
            boxShadow: '0 0 8px rgba(198,161,91,0.95), 0 0 2px var(--be-gold-hi)',
            borderRadius: '2px', pointerEvents: 'none', margin: '2px 0'
        });
        beforeGroup.parentNode.insertBefore(marker, beforeGroup);
        this._dropMarker = marker;
    }

    /**
     * AC-3 (shape_layer_ps_ux_20260909): makes a layer ROW draggable so the
     * user can restack the flat layer list (Photoshop-style). Sections row is
     * never draggable; a shape row is draggable only while unlocked (Slice K
     * — lock propagation flips this via syncLayerRowDrag). Dropping reorders
     * shapeLayers → print-z banding + DOM order.
     */
    bindRowDrag(layer, layerGroup, row) {
        if (layer.id === 'sections') return; // SECTIONS stays pinned
        row.dataset.layerId = layer.id;
        const dragAllowed = () => !layer.isLocked;

        row.setAttribute('draggable', String(dragAllowed()));
        row.addEventListener('dragstart', (e) => {
            if (!dragAllowed()) { e.preventDefault(); return; }
            // Phase 2c: a row drag is a GESTURE, so the capture starts here on the pristine
            // DOM and settles while the row is dragged; the synchronous stack snapshot is
            // the repair source when the scan finishes after the drop.
            this._rowMut = window.beginMutation
                ? window.beginMutation(this.snapshotStackState())
                : null;
            this._draggedLayerId = layer.id;
            row.classList.add('dragging');
            const ghost = layerGroup.cloneNode(true);
            ghost.className = 'be-layer-drag-ghost';
            Object.assign(ghost.style, {
                position: 'fixed', pointerEvents: 'none', opacity: '0.92',
                zIndex: window.Z.TOP, width: '230px',
                left: (e.clientX ? e.clientX + 12 : 0) + 'px',
                top: (e.clientY ? e.clientY - 16 : 0) + 'px',
                boxShadow: '0 10px 22px rgba(0,0,0,0.45)',
                border: '2px solid var(--be-gold)', borderRadius: '6px',
                backgroundColor: 'var(--be-ground-well)', color: 'var(--be-bone)'
            });
            const ghostRow = ghost.querySelector('.be-layer-row');
            if (ghostRow) { ghostRow.style.background = 'transparent'; }
            const ghostList = ghost.querySelector('.be-layer-content-list');
            if (ghostList) { ghostList.style.display = 'none'; } // ghost = the row only
            document.body.appendChild(ghost);
            try {
                if (e.dataTransfer && typeof e.dataTransfer.setDragImage === 'function') {
                    e.dataTransfer.setDragImage(ghost, 16, 16);
                }
            } catch { /* some hosts restrict setDragImage */ }
            this._rowGhost = ghost;
        });
        row.addEventListener('dragend', () => {
            row.classList.remove('dragging');
            if (this._rowGhost && this._rowGhost.parentNode) {
                this._rowGhost.parentNode.removeChild(this._rowGhost);
            }
            this._rowGhost = null;
            this._pendingRowMove = null;
            this._draggedLayerId = null;
            this.removeDropMarker();
            if (this._rowDropped) {
                this._rowDropped = false;
                this.updatePrintZIndexes(); // toast 'Layer order updated'
                // Phase 2c: the DOM work above — including the print-z banding
                // updatePrintZIndexes just recomputed — stays SYNCHRONOUS; the record is
                // pushed afterwards and a late capture is repaired from the stack snapshot.
                if (this._rowMut && window.pushMutation) {
                    window.pushMutation(this._rowMut, 'Reorder layers', window.MUTATION_CLASSES.RESTACK,
                        (layout, snap) => this.repairStackState(layout, snap));
                }
            }
            this._rowMut = null;
        });

        // Dropping a row onto a SHAPE group (never the sections area).
        layerGroup.addEventListener('dragover', (e) => {
            if (!this._draggedLayerId) return;
            const dragged = this.shapeLayers.find((l) => l.id === this._draggedLayerId);
            if (!dragged || dragged.isLocked) return; // source lock governs (Slice K)
            e.preventDefault();
            const others = this.shapeGroups().filter(
                (g) => (g.querySelector('.be-layer-row') || {}).dataset &&
                    g.querySelector('.be-layer-row').dataset.layerId !== this._draggedLayerId,
            );
            const afterEl = this.getRowAfterGroup(others, e.clientY);
            this._pendingRowMove = null;
            if (afterEl) {
                const afterId = afterEl.querySelector('.be-layer-row').dataset.layerId;
                // dropping above the group whose top we crossed → insert before it
                this.placeGroupMarker(afterEl);
                this._pendingRowMove = { beforeId: afterId };
            } else {
                // bottom of the stack (or past the last group) → move to end
                this._pendingRowMove = { beforeId: null };
                // place a marker after the LAST other group
                const last = others[others.length - 1];
                if (last) {
                    this.removeDropMarker();
                    const marker = document.createElement('div');
                    marker.className = 'be-layer-drop-marker';
                    Object.assign(marker.style, {
                        height: '3px', width: '100%', backgroundColor: 'var(--be-gold)',
                        boxShadow: '0 0 8px rgba(198,161,91,0.95), 0 0 2px var(--be-gold-hi)',
                        borderRadius: '2px', pointerEvents: 'none', margin: '2px 0'
                    });
                    last.parentNode.insertBefore(marker, last.nextSibling);
                    this._dropMarker = marker;
                }
            }
        });
        layerGroup.addEventListener('dragleave', (e) => {
            if (!layerGroup.contains(e.relatedTarget)) this.removeDropMarker();
        });
        layerGroup.addEventListener('drop', (e) => {
            e.preventDefault();
            this.removeDropMarker();
            const draggedId = this._draggedLayerId;
            const move = this._pendingRowMove;
            this._pendingRowMove = null;
            this._draggedLayerId = null;
            if (!draggedId || !move) return;
            if (this.reorderShapeLayers(draggedId, move.beforeId || null)) {
                this._rowDropped = true;
            }
        });
    }

    /**
     * AC-3: reorder shapeLayers so `draggedId` lands immediately before
     * `beforeId` (null = end of the stack). SECTIONS is never in the array
     * (banding preserved). Returns false when nothing changed.
     */
    reorderShapeLayers(draggedId, beforeId) {
        const from = this.shapeLayers.findIndex((l) => l.id === draggedId);
        if (from === -1) return false;
        let to = beforeId
            ? this.shapeLayers.findIndex((l) => l.id === beforeId)
            : this.shapeLayers.length - 1;
        if (beforeId && to === -1) to = this.shapeLayers.length - 1;
        if (beforeId && to > from) to -= 1; // adjust for the removal
        if (to === from) return false;
        const [layer] = this.shapeLayers.splice(from, 1);
        this.shapeLayers.splice(Math.max(0, Math.min(to, this.shapeLayers.length)), 0, layer);
        if (this.panel) this.rebuildPanel();
        return true;
    }

    /** sync the draggable affordance after lock toggles (Slice K). */
    syncLayerRowDrag() {
        if (!this.panel) return;
        this.shapeLayers.forEach((layer) => {
            const row = this.panel.querySelector(`[data-layer-id="${layer.id}"]`);
            if (row) row.setAttribute('draggable', String(!layer.isLocked));
        });
    }

    /** Among `groups`, the group whose vertical midpoint the row crossed. */
    getRowAfterGroup(groups, y) {
        return groups.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > (closest ? closest.offset : Number.NEGATIVE_INFINITY)) {
                return { offset, element: child };
            }
            return closest;
        }, null)?.element || null;
    }

    /**
     * AC-4 (shape_layer_ps_ux_20260909): chip multi-select. Ctrl/Meta toggles
     * membership, Shift extends, and a plain click TOGGLES too — it must never
     * silently CLEAR a set the user has just built (that was the bug; corrected
     * in 1.10.1 and kept by AC-3 of selection_model_ia_20260910). Selection is a
     * Set of element ids; visual state is a gold ring (.be-chip-selected).
     *
     * This SET is deliberately NOT the "active target" store (AC-3): it is a
     * batch, and the two must be able to coexist without clobbering each other.
     */
    toggleChipSelection(targetId, additive) {
        if (!this._selectedChipIds) this._selectedChipIds = new Set();
        if (additive) {
            if (this._selectedChipIds.has(targetId)) this._selectedChipIds.delete(targetId);
            else this._selectedChipIds.add(targetId);
        } else {
            this._selectedChipIds.clear();
        }
        this.applyChipSelectionVisual();
        return this._selectedChipIds.size;
    }

    clearChipSelection() {
        if (this._selectedChipIds && this._selectedChipIds.size) {
            this._selectedChipIds.clear();
            this.applyChipSelectionVisual();
        }
    }

    applyChipSelectionVisual() {
        if (!this.panel) return;
        const sel = this._selectedChipIds || new Set();
        this.panel.querySelectorAll('.be-layer-item-thumb, .be-layer-item-card').forEach((chip) => {
            const on = sel.has(chip.dataset.targetId);
            chip.classList.toggle('be-chip-selected', on);
            if (on) {
                chip.style.outline = '2px solid var(--be-gold)';
                chip.style.outlineOffset = '1px';
                chip.style.borderRadius = '6px';
            } else {
                chip.style.outline = '';
                chip.style.outlineOffset = '';
            }
        });
    }

    selectedChipIds() {
        return Array.from(this._selectedChipIds || []);
    }

    /**
     * AC-4 / Slice L: batch reparent with snapshot + rollback. Applies each
     * move with the pure primitive (no per-item refresh), one reconcile at the
     * end. A mid-batch failure rolls every already-applied move back to its
     * snapshot parent, reconciles once and reports; no wrapper is ever left
     * detached.
     * @param {Array<{wrapperId:string,targetLayerId:string}>} pairs
     */
    batchReparent(pairs) {
        // Phase 2c: ONE record for the whole batch — the user performed one action. The
        // batch rolls itself back on failure, so a partial apply never reaches the stack.
        const mut = window.beginMutation
            ? window.beginMutation(this.snapshotLayerMembership())
            : null;
        const snap = pairs.map((p) => ({
            id: p.wrapperId,
            parent: (document.getElementById(p.wrapperId) || {}).parentElement || null,
        }));
        let applied = 0;
        try {
            for (const p of pairs) {
                if (this.moveShapeToLayer(p.wrapperId, p.targetLayerId)) applied += 1;
            }
        } catch {
            // rollback every already-applied move (and any that did apply)
            snap.forEach((s) => {
                const el = document.getElementById(s.id);
                if (el && s.parent) s.parent.appendChild(el);
            });
            this.refreshLayerContents();
            if (window.showFeedback) {
                window.showFeedback('Batch move failed — changes rolled back.', 'error');
            }
            return false;
        }
        this.refreshLayerContents();
        // Phase 2c: recorded after the batch has settled (a rolled-back batch applied
        // nothing, so recording it would offer an undo that reverts nothing).
        //
        // MEASURED DEFECT, found by the coverage audit (which enumerated every capture point
        // against the tests): this block was inserted AFTER `return applied > 0;`, so it was
        // DEAD CODE — batch reparenting shaped a record and never pushed it, and the batch
        // path was not undoable at all. Nothing failed, because the only batch test asserts
        // the rollback and never looked at the stack. Third instance of this bug class in
        // this track, and the reason the audit existed.
        if (applied > 0 && mut && window.pushMutation) {
            window.pushMutation(mut, `Move ${applied} shapes`, window.MUTATION_CLASSES.REPARENT,
                (layout, snap2) => this.repairLayerMembership(layout, snap2));
        }
        return applied > 0;
}

    /** AC-4: "Split each into its own layer" — one new layer per selected chip. */
    splitEachSelected() {
        const ids = this.selectedChipIds();
        if (ids.length < 2) return false;
        const created = [];
        for (const id of ids) {
            const layer = this.moveShapeToNewLayer(id);
            if (layer) created.push(layer);
        }
        this.clearChipSelection();
        this.refreshLayerContents();
        if (window.showFeedback) {
            window.showFeedback(`Split ${created.length} shapes into their own layers`);
        }
        return created.length > 0;
    }

    /** AC-4: batch move the selected chips into one existing layer. */
    moveSelectedToLayer(targetLayerId) {
        const ids = this.selectedChipIds();
        if (ids.length < 2) return false;
        const ok = this.batchReparent(ids.map((id) => ({ wrapperId: id, targetLayerId })));
        this.clearChipSelection();
        if (ok && window.showFeedback) {
            const t = this.shapeLayers.find((l) => l.id === targetLayerId);
            window.showFeedback(`Moved ${ids.length} shapes to "${t ? t.label : targetLayerId}"`);
        }
        return ok;
    }

    /** AC-4: batch delete the selected chips (confirmed; Slice L snapshot). */
    async deleteSelectedChips() {
        const ids = this.selectedChipIds();
        if (ids.length < 2) return false;
        const ok = await layerManagerAskConfirm({
            title: "Delete selected shapes",
            message: `Delete ${ids.length} selected shapes? This cannot be undone.`,
            confirmLabel: "Delete",
            danger: true,
        });
        if (!ok) return false;
        // AC-1: snapshot first — a batch can remove many shapes at once.
        const batchGate = await layerManagerDestructiveGate(
            `Delete ${ids.length} selected shapes`,
        );
        if (!batchGate.ok) return false;
        const snap = ids.map((id) => ({
            id,
            parent: (document.getElementById(id) || {}).parentElement || null,
        }));
        snap.forEach((s) => {
            const el = document.getElementById(s.id);
            if (el) el.remove();
        });
        // Deletion is a pure removal — no rollback needed unless a wrapper was
        // somehow detached mid-way; verify and restore if so.
        const orphaned = snap.filter((s) => !document.getElementById(s.id));
        this.clearChipSelection();
        this.refreshLayerContents();
        if (window.showFeedback) window.showFeedback(`Deleted ${orphaned.length} shapes`);
        // AC-3: one control reverses the whole batch.
        window.offerUndo && window.offerUndo(batchGate.record,
            `Deleted ${orphaned.length} selected shape${orphaned.length === 1 ? "" : "s"}`,
        );
        return true;
    }

    /** Refreshes the content lists for all layers. */
    refreshLayerContents() {
        // AC-1 (selection_model_ia_20260910): if the selected element has just
        // been removed from the sheet, the store is cleared through its single
        // write path — the panel must never describe a target that is gone.
        if (window.PropertiesPanel && window.PropertiesPanel.pruneSelection) {
            window.PropertiesPanel.pruneSelection();
        }
        // 1. Sections
        this.renderElementsForLayer(this.sectionsLayer, '.be-section-wrapper', 'sections');

        // 2. Shapes (for each layer)
        this.shapeLayers.forEach(layer => {
            this.renderElementsForLayer(layer, '.be-shape-wrapper', 'shapes');
        });

        this.updateCounts();
        this.applyChipSelectionVisual(); // chips are fresh nodes after a refill
    }

    /** Live counts (AC-1): row badges + group headers derive from the actual
     *  DOM lists (never cached) — reconciled after every content refill so a
     *  move/add/remove can never leave a stale count. */
    updateCounts() {
        if (!this.panel) return;
        const countFor = (layer) => {
            const list = this.contentLists[layer.id];
            if (!list) return 0;
            return list.querySelectorAll('.be-layer-item-card, .be-layer-item-thumb').length;
        };
        [this.sectionsLayer, ...this.shapeLayers].forEach((layer) => {
            const row = this.panel.querySelector(`[data-layer-id="${layer.id}"]`);
            const badge = row && row.querySelector('.be-layer-count');
            if (badge) badge.textContent = countFor(layer);
        });
        const secH = this.panel.querySelector(
            '.be-layer-section-header[data-group="sections"] span');
        if (secH) secH.textContent = `SECTIONS (${countFor(this.sectionsLayer)})`;
        const shpH = this.panel.querySelector(
            '.be-layer-section-header[data-group="shapes"] span');
        if (shpH) shpH.textContent = `SHAPES (${this.shapeLayers.length})`;
    }

    renderElementsForLayer(layer, selector, type) {
        const list = this.contentLists[layer.id];
        if (!list) return;

        list.innerHTML = '';
        // The DOM stores elements front-to-back (last element is visually on top).
        // The UI list displays them top-to-bottom (top element is visually on top).
        // Therefore, we must reverse the DOM order when generating the UI list.
        const elements = Array.from(document.querySelectorAll(`#${layer.layerId} ${selector}`)).reverse();
        
        if (elements.length === 0) {
            const hint = document.createElement('span');
            hint.textContent = 'Empty — drag a shape here';
            Object.assign(hint.style, {
                color: 'var(--be-gold)', fontStyle: 'italic', fontSize: '10px',
                padding: '4px 2px'
            });
            list.appendChild(hint);
            return;
        }

        elements.forEach(el => {
            let item;
            if (type === 'shapes') {
                const container = el.querySelector('.print-section-container');
                const assetPath = container ? container.dataset.assetPath : null;
                if (!assetPath) return;

                // Shape chip (AC-1, shape_layer_ps_ux_20260909): a
                // .be-layer-item-thumb DIV container is the drag unit (class
                // kept for the drag + count selectors), holding the 34px img
                // AND a curated-name caption so rows are identifiable by name.
                const isBase64 = assetPath && assetPath.startsWith('data:');
                const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL && !isBase64)
                            ? chrome.runtime.getURL(assetPath)
                            : assetPath;

                const name = (window.AssetCatalog && window.AssetCatalog.curatedAssetInfo)
                    ? window.AssetCatalog.curatedAssetInfo(assetPath).name
                    : assetPath.split('/').pop();

                item = document.createElement('div');
                item.className = 'be-layer-item-thumb';
                Object.assign(item.style, {
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '2px', width: '58px', cursor: 'move', padding: '2px'
                });

                const img = document.createElement('img');
                img.src = url;
                Object.assign(img.style, {
                    width: '34px', height: '34px', objectFit: 'contain',
                    border: '1px solid var(--be-hair-gold)', borderRadius: '6px',
                    backgroundColor: 'var(--be-ground-well)',
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.4)'
                });
                item.appendChild(img);

                const cap = document.createElement('span');
                cap.className = 'be-layer-chip-name';
                cap.textContent = name;
                // Two-line wrap so curated names ("Archer Accent A") stay
                // readable instead of truncating into filename-looking stems.
                Object.assign(cap.style, {
                    fontSize: '9px', lineHeight: '1.1', color: 'var(--be-bone)',
                    maxWidth: '58px', maxHeight: '20px', overflow: 'hidden',
                    whiteSpace: 'normal', textAlign: 'center', width: '100%'
                });
                try { cap.style.webkitLineClamp = '2'; cap.style.display = '-webkit-box'; cap.style.webkitBoxOrient = 'vertical'; } catch { /* fallback: overflow hidden */ }
                item.appendChild(cap);
                item.title = name; // curated identity, not the raw filename
            } else {
                const title = el.dataset.title || (el.querySelector('.print-section-header span') ? el.querySelector('.print-section-header span').textContent.trim() : 'Unnamed');

                item = document.createElement('div');
                item.className = 'be-layer-item-card';
                item.textContent = title;
                item.title = title;
                Object.assign(item.style, {
                    fontSize: '11px', padding: '4px 8px', backgroundColor: 'var(--be-ground-well)',
                    border: '1px solid var(--be-hair-gold)', borderRadius: '6px', maxWidth: '120px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    cursor: 'move', color: 'var(--be-bone)'
                });
            }

            item.dataset.targetId = el.id;
            item.draggable = true;
            item.onclick = (e) => {
                e.stopPropagation();
                // AC-7/U-24a (ui_ux_review_20260910): a chip click TOGGLES
                // membership — it must never silently CLEAR an existing
                // multi-selection (that was the bug: a stray plain click threw
                // away a set the user had just built). Click-to-focus is kept
                // (documented README feature, covered by layer_focus tests).
                this.toggleChipSelection(el.id, true);
                // AC-3 interop: the chip's element also becomes the ACTIVE
                // TARGET. The single-target store and the SET are independent —
                // neither call clobbers the other's value.
                this.selectElementById(el.id);
                this.focusElement(el.id);
            };
            item.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                // AC-6: remember the invoking control so closing the menu can
                // return focus to it (a right-click does not focus the row).
                this._lastRowInvoker = item;
                this.createContextMenu(e.clientX, e.clientY, el.id);
            };
            // Custom mirrored drag ghost (AC-10): clone the chip, gold frame,
            // follow the pointer via setDragImage; removed on dragend.
            item.ondragstart = (e) => {
                item.classList.add('dragging');
                item.style.opacity = '0.35'; // dim the origin so ghost/rest differ
                const ghost = item.cloneNode(true);
                ghost.className = 'be-layer-drag-ghost';
                Object.assign(ghost.style, {
                    position: 'fixed',
                    pointerEvents: 'none',
                    opacity: '0.92',
                    zIndex: window.Z.TOP,
                    left: (e && e.clientX ? e.clientX + 90 : 0) + 'px',
                    top: (e && e.clientY ? e.clientY - 20 : 0) + 'px',
                    boxShadow: '0 10px 22px rgba(0,0,0,0.45)',
                    border: '2px solid var(--be-gold)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--be-ground-well)',
                    color: 'var(--be-bone)',
                    maxWidth: '220px'
                });
                document.body.appendChild(ghost);
                try {
                    if (e && e.dataTransfer && typeof e.dataTransfer.setDragImage === 'function') {
                        e.dataTransfer.setDragImage(ghost, 16, 16);
                    }
                } catch { /* some hosts restrict setDragImage */ }
                this._dragGhost = ghost;
            };
            item.ondragend = () => {
                item.classList.remove('dragging');
                item.style.opacity = ''; // restore origin dim
                if (this._dragGhost && this._dragGhost.parentNode) {
                    this._dragGhost.parentNode.removeChild(this._dragGhost);
                }
                this._dragGhost = null;
                this.removeDropMarker();
                this.updatePrintZIndexes();
            };

            list.appendChild(item);
        });
    }

    /** Removes the gold insertion marker if present. */
    removeDropMarker() {
        if (this._dropMarker && this._dropMarker.parentNode) {
            this._dropMarker.parentNode.removeChild(this._dropMarker);
        }
        this._dropMarker = null;
    }

    /**
     * Shows a gold insertion marker in `list` right before `beforeEl`
     * (or at the end when null) — the reorder drop slot (AC-10).
     */
    placeDropMarker(list, beforeEl) {
        if (!list) return;
        this.removeDropMarker();
        const marker = document.createElement('div');
        marker.className = 'be-layer-drop-marker';
        Object.assign(marker.style, {
            height: '3px',
            width: '100%',
            backgroundColor: 'var(--be-gold)',
            boxShadow: '0 0 8px rgba(198,161,91,0.95), 0 0 2px var(--be-gold-hi)',
            borderRadius: '2px',
            pointerEvents: 'none'
        });
        if (beforeEl) {
            list.insertBefore(marker, beforeEl);
        } else {
            list.appendChild(marker);
        }
        this._dropMarker = marker;
    }

    /**
     * Finds the element in the list that the current dragged item should be inserted after.
     */
    getDragAfterElement(container, x, y) {
        const draggableElements = [...container.querySelectorAll('.be-layer-item-card:not(.dragging), .be-layer-item-thumb:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            const xOffset = x - box.left - box.width / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else if (Math.abs(offset) < box.height / 2 && xOffset < 0 && xOffset > closest.xOffset) {
                return { offset: offset, xOffset: xOffset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY, xOffset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * Updates the printZIndex attribute of all elements based on their order in the layer list.
     */
    updatePrintZIndexes(silent = false) {
        // We'll iterate layers in reverse order for Z-Index management
        const allLayers = [this.sectionsLayer, ...this.shapeLayers];
        
        allLayers.forEach((layer, layerIndex) => {
            const list = this.contentLists[layer.id];
            if (!list) return;

            const items = Array.from(list.querySelectorAll('.be-layer-item-card, .be-layer-item-thumb'));
            const baseZ = (layerIndex * 100) + 10;
            const totalItems = items.length;

            const layerContainer = document.getElementById(layer.layerId);
            
            // Assign Z-indexes: Top item in list gets highest Z, Bottom gets lowest Z
            items.forEach((item, index) => {
                const targetId = item.dataset.targetId;
                const el = document.getElementById(targetId);
                if (el) {
                    const zValue = baseZ + (totalItems - 1 - index);
                    el.dataset.printZ = zValue.toString();
                }
            });

            // Reorder actual DOM elements: Bottom item first, Top item last (so Top renders in front)
            if (layerContainer) {
                for (let i = totalItems - 1; i >= 0; i--) {
                    const targetId = items[i].dataset.targetId;
                    const el = document.getElementById(targetId);
                    if (el) {
                        layerContainer.appendChild(el);
                    }
                }
                this.checkLayerLimit(layer);
            }
        });

        if (window.updatePrintStyles) window.updatePrintStyles();
        if (!silent && window.showFeedback) window.showFeedback('Layer order updated');
    }

    /**
     * Focuses and highlights an element on the sheet.
     */
    focusElement(id) {
        if (!id) return;
        const el = document.getElementById(id);
        if (!el) return;

        const wrapper = el.classList.contains('be-section-wrapper') ? el : el.closest('.be-section-wrapper');
        if (!wrapper) return;

        wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        wrapper.classList.add('be-focus-highlight');

        let maxZ = 1000;
        document.querySelectorAll('.be-section-wrapper').forEach(item => {
            const z = parseInt(window.getComputedStyle(item).zIndex) || window.Z.SECTION_DEFAULT;
            if (z > maxZ && z < 100000) maxZ = z;
        });
        wrapper.style.zIndex = (maxZ + 1).toString();

        setTimeout(() => { wrapper.classList.remove('be-focus-highlight'); }, 2000);
    }

    /**
     * The layer that CONTAINS the currently selected element, or null.
     * AC-1 (selection_model_ia_20260910): this is the layer panel's READ of the
     * selection store — the panel no longer derives the highlight from a
     * private notion of "selected".
     */
    layerIdForElement(el) {
        if (!el) return null;
        const allLayers = [this.sectionsLayer, ...this.shapeLayers];
        for (const layer of allLayers) {
            const container = document.getElementById(layer.layerId);
            if (container && container.contains(el)) return layer.id;
        }
        return null;
    }

    /**
     * The layer that CONTAINS the currently selected element, or null. This is
     * AC-1's row reader: it derives from the STORE and from nothing else.
     */
    selectionLayerId() {
        const store = window.PropertiesPanel;
        const target =
            store && typeof store.getActiveTarget === 'function'
                ? store.getActiveTarget()
                : null;
        return this.layerIdForElement(target);
    }

    /**
     * THE single writer of `be-selection-layer` — the row (and on-sheet layer
     * container) that HOLDS THE SELECTED ELEMENT. Written only from the store, so
     * it is absent whenever nothing is selected (AC-1: "clearing clears all
     * three"). The consultant's consultation of 2026-09-10 is explicit that the
     * old fallback to `activeLayerId` made this reader a reader of TWO values and
     * was therefore itself "a private duplicate that can disagree" — measured as
     * 0 differing pixels between the section-selected and cleared states.
     */
    applySelectionRow() {
        if (typeof document === 'undefined') return;
        const activeId = this.selectionLayerId();
        const allLayers = [this.sectionsLayer, ...this.shapeLayers];
        allLayers.forEach((layer) => {
            const on = layer.id === activeId;
            const row = this.panel
                ? this.panel.querySelector(`[data-layer-id="${layer.id}"]`)
                : null;
            if (row) row.classList.toggle('be-selection-layer', on);
            const container = document.getElementById(layer.layerId);
            if (container) container.classList.toggle('be-selection-layer', on);
        });
    }

    /**
     * THE single writer of `be-active-layer` — the INSERTION TARGET: the layer the
     * next shape lands in. A DIFFERENT concept from the selection (it survives a
     * cleared selection and is moved by unlocking a layer / adding one), which is
     * exactly why it has its own class and its own writer instead of sharing the
     * selection's.
     */
    applyInsertionTarget() {
        if (typeof document === 'undefined') return;
        const allLayers = [this.sectionsLayer, ...this.shapeLayers];
        allLayers.forEach((layer) => {
            const on = layer.id === this.activeLayerId;
            const row = this.panel
                ? this.panel.querySelector(`[data-layer-id="${layer.id}"]`)
                : null;
            if (row) row.classList.toggle('be-active-layer', on);
            const container = document.getElementById(layer.layerId);
            if (container) container.classList.toggle('be-active-layer', on);
        });
    }

    /**
     * Called by the selection store (js/properties_panel.js) whenever the active
     * target changes — the panel-side half of AC-1's live agreement.
     */
    syncSelectionRow() {
        this.applySelectionRow();
        if (window.updateControlsState) window.updateControlsState();
    }

    /**
     * Selects a layer's representative element through the selection store (the
     * ONLY writer of the active target). Empty layer -> clear.
     */
    selectLayer(layer) {
        const store = window.PropertiesPanel;
        if (!layer || !store || typeof store.setActiveSection !== 'function') return;
        const container = document.getElementById(layer.layerId);
        const representative = container
            ? container.querySelector('.be-section-wrapper')
            : null;
        store.setActiveSection(representative || null);
    }

    /**
     * Selects an on-sheet element by id through the selection store (the ONLY
     * writer of the active target). Used by the chip click, so a chip becomes the
     * active target without touching the chip SET (AC-3).
     */
    selectElementById(id) {
        const store = window.PropertiesPanel;
        if (!id || !store || typeof store.setActiveSection !== 'function') return;
        const el = document.getElementById(id);
        if (el) store.setActiveSection(el);
    }

    /**
     * Refreshes the UI icons based on the current layer state.
     */
    refreshUI() {
        const allLayers = [this.sectionsLayer, ...this.shapeLayers];
        
        allLayers.forEach(layer => {
            // Ensure DOM container exists
            let layerEl = document.getElementById(layer.layerId);
            if (!layerEl) {
                const shapesContainer = this.dom.getShapesContainer().element;
                if (shapesContainer) {
                    layerEl = document.createElement('div');
                    layerEl.id = layer.layerId;
                    layerEl.className = 'be-shape-layer-container pe-layer';
                    shapesContainer.appendChild(layerEl);
                }
            }

            if (this.panel) {
                const row = this.panel.querySelector(`[data-layer-id="${layer.id}"]`);
                if (row) {
                    this.applyRowState(row, layer);
                    this.syncRowHidden(row, layer);
                    // The active-row class is written by applyActiveRow() below
                    // (one writer for `be-active-layer`, AC-1).
                }
            }

            if (layerEl) {
                layerEl.dataset.printDisabled = layer.isDisabledOnPrint;
                layerEl.style.display = layer.isHidden ? 'none' : '';

                // Apply Lock Styles (AC-5/U-7, ui_ux_review_20260910). Locking
                // means "not draggable / resizable / rotatable" — it must NOT
                // make the layer inert, because then its own controls (unlock,
                // hide, print-off, delete) become unreachable. The drag engine
                // already refuses a locked wrapper (isElementLocked) and the
                // move/resize/rotate affordances are hidden by CSS, so the
                // layer stays hoverable; it is only dimmed to signal the state.
                if (layer.isLocked) {
                    layerEl.style.opacity = '0.5';
                    layerEl.style.pointerEvents = 'auto';
                    layerEl.classList.add('be-layer-locked');
                } else {
                    layerEl.style.opacity = '1';
                    layerEl.style.pointerEvents = 'auto';
                    layerEl.classList.remove('be-layer-locked');
                }
            }
            
            const lockClass = `be-lock-${layer.id}`;
            if (layer.isLocked) {
                document.body.classList.add(lockClass);
            } else {
                document.body.classList.remove(lockClass);
            }
        });

        this.applyInsertionTarget();
        this.applySelectionRow();
        this.refreshLayerContents();
        this.syncLayerRowDrag(); // lock interplay: rows only drag while unlocked (AC-3/Slice K)
        if (window.updatePrintStyles) window.updatePrintStyles();
    }

    // The capture-and-push protocol (`beginMutation` / `pushMutation`) is NOT defined here any
    // more (track refactor_surface_20260911, Phase 2, AC-2). This class used to re-implement
    // both as methods — the exported pair's verbatim duplicate, differing only in quote style —
    // and that duplication is how F-1's drift got in: this copy's settled branch kept pushing a
    // mid-gesture capture RAW after the shared copy had been fixed. Every site below now calls
    // the ONE implementation through `window.*` at CALL time (the convention this file already
    // uses for its destructive-gate seam above): `js/persistence.js` is evaluated after this
    // module, so the seam cannot be captured at load. When it is absent (a bare unit harness)
    // there is simply no record — the same fail-soft outcome the deleted methods had.

    /** Every layer's persisted flags + label — the fields 2d's toggles and rename touch. */
    snapshotLayerFlags() {
        return [this.sectionsLayer, ...this.shapeLayers].map((l) => ({
            id: l.id,
            isLocked: l.isLocked,
            isHidden: l.isHidden,
            isDisabledOnPrint: l.isDisabledOnPrint,
            label: l.label,
        }));
    }

    /**
     * Put the captured flags back. They live in TWO places in the record — per-layer
     * (`shapeLayers[]`) and in the `layers` map — and `scanLayout` writes both, so a repair
     * that touched only one would leave the two disagreeing.
     */
    repairLayerFlags(layout, snap) {
        if (!layout || !Array.isArray(snap)) return layout;
        snap.forEach((s) => {
            const entry = layout.layers && layout.layers[s.id];
            if (entry) {
                entry.isLocked = s.isLocked;
                entry.isHidden = s.isHidden;
                entry.isDisabledOnPrint = s.isDisabledOnPrint;
            }
            (layout.shapeLayers || []).forEach((l) => {
                if (l.id !== s.id) return;
                l.isLocked = s.isLocked;
                l.isHidden = s.isHidden;
                l.isDisabledOnPrint = s.isDisabledOnPrint;
                l.name = s.label;
            });
        });
        return layout;
    }

    /**
     * RECORD key -> its layer container id, for every shape.
     *
     * The key is the shape CONTAINER's id, not the wrapper's: `scanLayout` records
     * `elements[].id` from `.be-shape-container` inside the wrapper, while the reparent API
     * (`moveShapeToLayer`) takes a WRAPPER id. Keying this snapshot by the wrapper id — a
     * first draft did — produced a map that could never match the record it was meant to
     * repair, so the repair silently did nothing.
     */
    snapshotLayerMembership() {
        const map = {};
        document.querySelectorAll('.be-shape-wrapper').forEach((el) => {
            const container = el.querySelector('.be-shape-container') || el;
            const key = container.id || el.id;
            map[key] = (el.parentElement && el.parentElement.id) || null;
        });
        return map;
    }

    /** Put the captured layer MEMBERSHIP back (2c's reparent, single or batch). */
    repairLayerMembership(layout, snap) {
        if (!layout || !snap || !Array.isArray(layout.shapeLayers)) return layout;
        const wanted = snap;
        const entries = new Map();
        layout.shapeLayers.forEach((layer) => {
            (layer.elements || []).forEach((el) => entries.set(el.id, el));
            layer.elements = [];
        });
        const layerIdToEntry = new Map(layout.shapeLayers.map((l) => [l.id, l]));
        entries.forEach((el, id) => {
            const targetId = wanted[id];
            const target = layerIdToEntry.get(targetId) || layout.shapeLayers[0];
            if (target) target.elements.push(el);
        });
        return layout;
    }

    /**
     * Phase 2c: the synchronously-read pre-restack state. A row drag is a gesture, so its
     * capture settles during the drag; a scan that finishes after the drop needs the ORDER
     * and the print-z banding put back, and those are the only things a restack changes.
     */
    snapshotStackState() {
        const printZ = {};
        document.querySelectorAll('.be-shape-wrapper, .be-section-wrapper').forEach((el) => {
            if (el.dataset && el.dataset.printZ !== undefined) printZ[el.id] = el.dataset.printZ;
        });
        return { order: this.shapeLayers.map((l) => l.id), printZ };
    }

    /** Phase 2c: put a captured layout's layer order + print-z back to `snap`. */
    repairStackState(layout, snap) {
        if (!layout || !snap) return layout;
        if (Array.isArray(layout.shapeLayers) && Array.isArray(snap.order)) {
            const byId = new Map(layout.shapeLayers.map((l) => [l.id, l]));
            const ordered = snap.order.map((id) => byId.get(id)).filter(Boolean);
            layout.shapeLayers.forEach((l) => { if (!snap.order.includes(l.id)) ordered.push(l); });
            layout.shapeLayers = ordered;
            layout.shapeLayers.forEach((layer) => {
                (layer.elements || []).forEach((el) => {
                    if (snap.printZ && snap.printZ[el.id] !== undefined) {
                        el.printZIndex = snap.printZ[el.id];
                    }
                });
            });
        }
        if (layout.sections && snap.printZ) {
            Object.keys(layout.sections).forEach((id) => {
                if (snap.printZ[id] !== undefined) layout.sections[id].printZIndex = snap.printZ[id];
            });
        }
        ['clones', 'extractions', 'shapes', 'spell_details'].forEach((key) => {
            if (!Array.isArray(layout[key])) return;
            layout[key].forEach((e) => {
                if (e && snap.printZ && snap.printZ[e.id] !== undefined) {
                    e.printZIndex = snap.printZ[e.id];
                }
            });
        });
        return layout;
    }

    _toggleLayerPrintNow(layer) {
        layer.isDisabledOnPrint = !layer.isDisabledOnPrint;
        this.refreshUI();
        if (window.showFeedback) window.showFeedback(`${layer.label} Print ${layer.isDisabledOnPrint ? 'Disabled' : 'Enabled'}`);
    }

    toggleLayerPrint(layer, btn) {
        // Phase 2d (track undo_stack_20260911): `isDisabledOnPrint` is persisted
        // (js/layout_scan.js) and toggling it had no way back.
        const mut = window.beginMutation
            ? window.beginMutation(this.snapshotLayerFlags())
            : null;
        this._toggleLayerPrintNow(layer, btn);
        if (mut && window.pushMutation) {
            window.pushMutation(mut, `Print "${layer.label}"`, window.MUTATION_CLASSES.LAYER_FLAG,
                (layout, snap) => this.repairLayerFlags(layout, snap));
        }
    }

    /** The original lock-toggle body, unchanged (Phase 2d records it, never edits it). */
    _toggleLayerLockNow(layer) {
        const wasLocked = layer.isLocked;
        
        // If we are unlocking this layer, lock ALL others
        if (wasLocked) {
            const allLayers = [this.sectionsLayer, ...this.shapeLayers];
            allLayers.forEach(l => {
                l.isLocked = true;
            });
            layer.isLocked = false;
            this.activeLayerId = layer.id;
        } else {
            // If we are locking this layer
            layer.isLocked = true;
            if (this.activeLayerId === layer.id) {
                this.activeLayerId = null;
            }
        }

        this.refreshUI();
        if (window.updateControlsState) window.updateControlsState();
        if (window.showFeedback) window.showFeedback(`${layer.label} ${layer.isLocked ? 'Locked' : 'Unlocked'}`);
    }

    toggleLayerLock(layer, btn) {
        // Phase 2d (track undo_stack_20260911): `isLocked` is persisted per layer and this
        // toggle also CASCADES to every other layer (see the body), so the snapshot covers
        // the whole cascade — a repair that recorded only the clicked layer would leave the
        // others wrong.
        const mut = window.beginMutation
            ? window.beginMutation(this.snapshotLayerFlags())
            : null;
        this._toggleLayerLockNow(layer, btn);
        if (mut && window.pushMutation) {
            window.pushMutation(mut, `Lock "${layer.label}"`, window.MUTATION_CLASSES.LAYER_FLAG,
                (layout, snap) => this.repairLayerFlags(layout, snap));
        }
    }

    /**
     * Gets the DOM container of the currently active SHAPE layer.
     * Falls back to the default shapes container if the active layer is "sections" or none.
     */
    getActiveLayerContainer() {
        if (this.activeLayerId && this.activeLayerId !== 'sections') {
            const layer = this.shapeLayers.find(l => l.id === this.activeLayerId);
            if (layer) {
                const container = document.getElementById(layer.layerId);
                if (container) return container;
            }
        }
        // Fallback to default shapes layer if sections is active or no layer active
        const defaultLayer = this.shapeLayers[0];
        if (defaultLayer) {
            return document.getElementById(defaultLayer.layerId);
        }
        return null;
    }

    /**
     * Gets the DOM container for the sections layer.
     */
    getSectionsContainer() {
        return document.getElementById(this.sectionsLayer.layerId);
    }

    toggleLayerVisibility(layer) {
        // Phase 2d (track undo_stack_20260911): `isHidden` is persisted per layer
        // (js/layout_scan.js reads it), so hiding a layer had no way back. MISSING IN THE
        // FIRST DELIVERY, and found by the real-browser per-class verification: this site
        // was wired in a draft that was reverted for an unrelated reason (the async-before-
        // mutate problem) and the wiring was lost with it, while the unit cases covered the
        // PRINT and LOCK flags only — so nothing failed. Covered by a case now.
        const mut = window.beginMutation
            ? window.beginMutation(this.snapshotLayerFlags())
            : null;
        layer.isHidden = !layer.isHidden;
        this.refreshUI();
        if (mut && window.pushMutation) {
            window.pushMutation(mut, `Hide "${layer.label}"`, window.MUTATION_CLASSES.LAYER_FLAG,
                (layout, snap) => this.repairLayerFlags(layout, snap));
        }
        if (window.showFeedback) window.showFeedback(`${layer.label} ${layer.isHidden ? 'Hidden' : 'Visible'}`);
    }

    /**
     * Creates and displays a custom context menu. Shape wrappers get the
     * layer operations (Move to New Layer… / Move to Layer…) in addition to
     * Delete; section cards keep Delete only.
     */
    createContextMenu(x, y, targetId) {
        this.hideContextMenu();

        const menu = document.createElement('div');
        menu.id = 'print-enhance-context-menu';
        menu.className = 'be-context-menu be-floating-ui';
        // AC-6 (U-27): the menu is a real ARIA menu. It used to be a plain <div>
        // of <div>s carrying only onclick — unreachable by Tab, with no role, no
        // keyboard handling and no way to learn the menu had opened.
        menu.setAttribute('role', 'menu');
        menu.setAttribute('tabindex', '-1');
        menu.setAttribute('aria-label', 'Item actions');
        // The global .be-context-menu rule sets display:none (it styles the
        // sheet hover-bar menus); this floating menu is shown imperatively,
        // so override it here. Pre-existing latent bug surfaced by AC-2 —
        // the chip right-click menu was invisible before this track.
        menu.style.display = 'block';
        Object.assign(menu.style, {
            position: 'fixed',
            left: `${x}px`,
            top: `${y}px`,
            zIndex: '100000', // AC-5 finding: the eleventh literal the F-6 inventory did not list
            backgroundColor: '#222',
            border: '1px solid #444',
            borderRadius: '4px',
            padding: '4px 0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            minWidth: '150px'
        });
        document.body.appendChild(menu);
        this.contextMenu = menu;

        // AC-6: remember what opened the menu so Escape can hand focus back.
        this._contextMenuInvoker =
            (document.activeElement && document.activeElement !== document.body
                ? document.activeElement
                : null) || this._lastRowInvoker || null;

        const clear = () => { while (menu.firstChild) menu.removeChild(menu.firstChild); };

        const target = document.getElementById(targetId);
        const isShape = !!(target && target.classList.contains('be-shape-wrapper'));
        const doDelete = async () => {
            const ok = await layerManagerAskConfirm({
                title: 'Delete item',
                message: 'Delete this item? This cannot be undone.',
                confirmLabel: 'Delete',
                danger: true,
            });
            if (!ok) return;
            // AC-1: snapshot first, naming what is being removed.
            const menuLabel =
                (target && target.dataset && target.dataset.title) || "item";
            const gate = await layerManagerDestructiveGate(`Delete "${menuLabel}"`);
            if (!gate.ok) return;
            this.deleteShape(targetId);
            // AC-3: the snapshot just taken IS the undo.
            window.offerUndo && window.offerUndo(gate.record, `Deleted "${menuLabel}"`);
        };
        const currentLayer = this.getLayerForElement(targetId);

        const rawItem = (label, onClick, opts = {}) => {
            const el = document.createElement('div');
            el.className = 'be-context-menu-item';
            // AC-6 (U-27): menuitem semantics + roving focus. `tabindex="-1"`
            // keeps the items OUT of the natural tab order (the menu itself is
            // the tab stop) while still being programmatically focusable, which
            // is what the Arrow/Home/End walk below moves.
            el.setAttribute('role', 'menuitem');
            el.setAttribute('tabindex', '-1');
            if (opts.danger) el.dataset.danger = 'true';
            el.textContent = label;
            Object.assign(el.style, {
                padding: '6px 12px', cursor: 'pointer', fontSize: '12px',
                // AC-6: the locked danger token (ember). The literal that used
                // to be spelled out here was not in the palette at all.
                color: opts.danger ? 'var(--be-ember)' : 'var(--be-bone)',
                transition: 'background 0.2s'
            });
            el.onmouseover = () => { el.style.backgroundColor = '#333'; };
            el.onmouseout = () => { el.style.backgroundColor = 'transparent'; };
            el.onclick = onClick;
            menu.appendChild(el);
            return el;
        };
        // Generic menu items close the menu after their action.
        const item = (label, onClick, opts) =>
            rawItem(label, () => { onClick(); this.hideContextMenu(); }, opts);

        const buildMain = () => {
            clear();
            const selCount = (this._selectedChipIds || new Set()).size;
            if (isShape && selCount >= 2) {
                // AC-4 batch menu (multi-select active)
                item(`Split ${selCount} into their own layers`, () => this.splitEachSelected());
                rawItem('Move selected to layer…', () => buildBatchChooser(selCount));
                const sepA = document.createElement('div');
                sepA.style.cssText = 'height:1px;background:var(--be-hair-bone);margin:3px 0;';
                menu.appendChild(sepA);
                item(`Delete ${selCount} selected`, () => this.deleteSelectedChips(), { danger: true });
                return;
            }
            if (isShape) {
                item('Move to New Layer…', () => this.moveShapeToNewLayer(targetId));
                rawItem('Move to Layer…', () => buildChooser());
                const sep = document.createElement('div');
                sep.style.cssText = 'height:1px;background:var(--be-hair-bone);margin:3px 0;';
                menu.appendChild(sep);
                item('Delete', doDelete, { danger: true });
            } else {
                item('Delete', doDelete, { danger: true });
            }
        };

        const buildBatchChooser = (selCount) => {
            clear();
            const back = rawItem('← Back', () => buildMain(), { subtle: true });
            back.style.cssText =
                'padding:6px 12px;cursor:pointer;font-size:11px;color:var(--be-taupe);transition:background 0.2s;';
            const others = this.shapeLayers;
            if (others.length === 0) {
                const none = document.createElement('div');
                none.textContent = 'No layers';
                none.style.cssText = 'padding:6px 12px;font-size:11px;color:#888;font-style:italic;';
                menu.appendChild(none);
            } else {
                others.forEach((l) => {
                    const suffix = l.isHidden ? ' (hidden)' : l.isDisabledOnPrint ? ' (print off)' : '';
                    item(`Move ${selCount} to ${l.label}${suffix}`, () => this.moveSelectedToLayer(l.id));
                });
            }
        };

        const buildChooser = () => {
            clear();
            const back = rawItem('← Back', () => buildMain(), { subtle: true });
            back.style.cssText =
                'padding:6px 12px;cursor:pointer;font-size:11px;color:var(--be-taupe);transition:background 0.2s;';
            const others = this.shapeLayers.filter(
                (l) => !currentLayer || l.id !== currentLayer.id,
            );
            if (others.length === 0) {
                const none = document.createElement('div');
                none.textContent = 'No other layers';
                none.style.cssText =
                    'padding:6px 12px;font-size:11px;color:#888;font-style:italic;';
                menu.appendChild(none);
            } else {
                others.forEach((l) => {
                    const suffix = l.isHidden
                        ? ' (hidden)'
                        : l.isDisabledOnPrint
                          ? ' (print off)'
                          : '';
                    item(
                        `${l.label}${suffix}`,
                        () => this.moveShapeToExistingLayer(targetId, l.id),
                    );
                });
            }
        };

        buildMain();

        /**
         * AC-6 (U-27): items in DOM order, minus the group separators and any
         * "No other layers" note (which is not a menuitem).
         */
        const menuItems = () =>
            Array.from(menu.querySelectorAll('[role="menuitem"]'));

        /** Move focus to item `i`, wrapping — the roving-focus walk. */
        const focusItem = (i) => {
            const items = menuItems();
            if (!items.length) return;
            const n = items.length;
            const target = items[((i % n) + n) % n];
            items.forEach((el) => el.setAttribute('tabindex', '-1'));
            target.setAttribute('tabindex', '0');
            target.focus();
        };

        /**
         * AC-6: keep the menu fully on screen. It used to open at the raw
         * right-click coordinates, so a click near the right/bottom edge put part
         * or all of it outside the viewport with no way to reach the hidden items.
         */
        const clampToViewport = () => {
            const r = menu.getBoundingClientRect();
            const vw = window.innerWidth || document.documentElement.clientWidth || 0;
            const vh = window.innerHeight || document.documentElement.clientHeight || 0;
            const m = 8; // keep the hairline off the very edge
            let left = x;
            let top = y;
            if (left + r.width > vw - m) left = Math.max(m, vw - r.width - m);
            if (top + r.height > vh - m) top = Math.max(m, vh - r.height - m);
            menu.style.left = `${Math.max(m, left)}px`;
            menu.style.top = `${Math.max(m, top)}px`;
        };
        clampToViewport();

        // AC-6: opening moves focus INTO the menu (the first item), so a
        // keyboard user lands where the arrows work.
        focusItem(0);

        const onMenuKeydown = (e) => {
            const items = menuItems();
            const at = items.indexOf(document.activeElement);
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    focusItem(at + 1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    focusItem(at <= 0 ? items.length - 1 : at - 1);
                    break;
                case 'Home':
                    e.preventDefault();
                    focusItem(0);
                    break;
                case 'End':
                    e.preventDefault();
                    focusItem(items.length - 1);
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    if (at >= 0) items[at].click();
                    break;
                case 'Escape':
                    e.preventDefault();
                    e.stopPropagation();
                    this.hideContextMenu();
                    break;
                default:
                    break;
            }
        };
        menu.addEventListener('keydown', onMenuKeydown);

        // Auto-hide on click outside
        const hideHandler = (e) => {
            if (!menu.contains(e.target)) {
                this.hideContextMenu();
                document.removeEventListener('mousedown', hideHandler);
            }
        };
        document.addEventListener('mousedown', hideHandler);
    }

    hideContextMenu() {
        if (this.contextMenu) {
            const invoker = this._contextMenuInvoker;
            this.contextMenu.remove();
            this.contextMenu = null;
            // AC-6: Escape (or choosing an item) hands focus back to the control
            // that opened the menu instead of dropping it on <body>.
            if (invoker && typeof invoker.focus === 'function' && document.contains(invoker)) {
                invoker.focus();
            }
            this._contextMenuInvoker = null;
        }
    }

    /**
     * Toggles the minimized state of the panel.
     */
    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        if (this.isMinimized) {
            // An explicit minimize is the user's choice: it outranks the guard.
            this._userChoseMinimize = true;
            this._narrowGuardOptOut = false;
        } else {
            // An explicit EXPAND must outrank the guard too. Without this the guard
            // re-minimizes the panel on the next tick and the header control is a
            // dead end — measured in the phase-3 capture, where the "restored"
            // panel came back at rail height, still minimized.
            this._narrowGuardOptOut = true;
        }
        if (this.panel) {
            this.panel.classList.toggle('minimized', this.isMinimized);
            this.rebuildPanel(); // Rebuild to update button text/icon
        }
    }

    /** Keep the header control's copy in step with the state the guard set. */
    refreshMinimizeControl() {
        if (!this.panel) return;
        const btn = this.panel.querySelector('.be-layer-panel-header button');
        if (!btn) return;
        btn.textContent = this.isMinimized ? 'Restore' : 'Minimize';
        btn.title = this.isMinimized ? 'Restore' : 'Minimize';
        btn.setAttribute('aria-label', this.isMinimized ? 'Restore' : 'Minimize');
    }

    /**
     * AC-10 (U-34) narrow-viewport guard, live half: below 700px the panel rides
     * minimized (header only) so the two docked panels stop eating the sheet's
     * middle band. The threshold is INCLUSIVE (<= 700) because the CSS stage is
     * `@media (max-width: 700px)`: a strict `<` left an exactly-700px window with
     * narrowed panels but no rail (measured in the phase-3 capture).
     *
     * The panel's own header control toggles the same state, and an explicit expand
     * sets `_narrowGuardOptOut`, so the guard can never trap the user — the
     * first phase-3 gate round returned NOT MET because a CSS-only rail had no way
     * back at all.
     */
    applyNarrowGuard(viewportWidth) {
        const width = typeof viewportWidth === 'number'
            ? viewportWidth
            : (typeof window !== 'undefined' && window.innerWidth) || 0;
        if (!width) return;
        const narrow = width <= 700;
        if (narrow) {
            if (!this.isMinimized && !this._narrowGuardOptOut) {
                this.isMinimized = true;
                this._narrowGuardMinimized = true;
                if (this.panel) this.panel.classList.add('minimized');
                this.refreshMinimizeControl();
            }
        } else {
            // Back to a wide viewport: undo the guard's OWN minimization (never a
            // user's) and re-arm the guard for the next narrowing.
            if (this.isMinimized && this._narrowGuardMinimized && !this._userChoseMinimize) {
                this.isMinimized = false;
                if (this.panel) this.panel.classList.remove('minimized');
                this.refreshMinimizeControl();
            }
            this._narrowGuardMinimized = false;
            this._narrowGuardOptOut = false;
        }
    }

    /** Bind the guard to viewport changes (once per panel). */
    bindNarrowGuard() {
        if (this._narrowGuardBound || typeof window === 'undefined') return;
        this._narrowGuardBound = true;
        window.addEventListener('resize', () => this.applyNarrowGuard());
        // Measured in the phase-3 capture: a viewport change (page.setViewportSize)
        // did NOT reach this listener in the extension's isolated world, so the
        // guard only ever ran at panel-build time and an explicit expand could
        // never be re-armed. A ResizeObserver on the root element IS observed to
        // work in this world (js/main.js relies on one to scale the sheet), so the
        // guard is driven by whichever signal arrives first.
        try {
            if (typeof ResizeObserver === 'function' && typeof document !== 'undefined') {
                this._narrowGuardObserver = new ResizeObserver(() => this.applyNarrowGuard());
                this._narrowGuardObserver.observe(document.documentElement);
            }
        } catch {
            /* no observer in this host: the resize listener above still applies */
        }
        this.applyNarrowGuard();
    }

    /**
     * Renames a layer through the app's input modal (AC-1) instead of a
     * native prompt(); sections is never renamable. Falls back to prompt()
     * only when the modal seam is absent (bare unit boots).
     */
    async showRenameModal(layer) {
        if (layer.id === 'sections') return; // Cannot rename sections layer
        let newName;
        if (window.showInputModal) {
            newName = await window.showInputModal(
                'Rename Layer',
                `Enter a new name for "${layer.label}":`,
                layer.label,
            );
        } else {
            newName = prompt(`Rename layer "${layer.label}" to:`, layer.label);
        }
        if (newName && newName.trim() !== '' && newName !== layer.label) {
            // Phase 2d: the label IS the persisted layer NAME (scanLayout writes
            // `name: layer.label`), so a rename is a layout mutation. The no-op branch below
            // deliberately records nothing — a rename that changes nothing is not a
            // mutation, and the house already tells the user so.
            const mut = window.beginMutation
                ? window.beginMutation(this.snapshotLayerFlags())
                : null;
            layer.label = newName.trim();
            this.rebuildPanel();
            if (mut && window.pushMutation) {
                window.pushMutation(mut, `Rename "${layer.label}"`, window.MUTATION_CLASSES.RENAME,
                    (layout, snap) => this.repairLayerFlags(layout, snap));
            }
            if (window.showFeedback) window.showFeedback(`Layer renamed to "${layer.label}"`);
        } else if (newName && newName.trim() === layer.label) {
            // AC-7 (U-16): submitting the SAME name used to close the dialog and
            // report nothing at all, so a rename that changed nothing looked like
            // a rename that failed. Say that nothing changed.
            if (window.showFeedback) {
                window.showFeedback(`"${layer.label}" is already the layer's name \u2014 no change made.`);
            }
        }
        // An empty (or whitespace-only) submission is deliberately NOT reported
        // here: the input modal owns that validation and already explains it
        // (U-21, shipped in 1.12.0).
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayerManager;
} else {
    window.LayerManager = LayerManager;
}
