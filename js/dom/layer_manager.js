/**
 * Manages the Layer Management Panel UI and state.
 */
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
        const id = initialState.id || `shapes-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newLayer = {
            id: id,
            label: label,
            layerId: initialState.layerId || `print-enhance-layer-${id}`,
            isLocked: initialState.isLocked || false,
            isHidden: initialState.isHidden || false,
            isDisabledOnPrint: initialState.isDisabledOnPrint || false
        };
        this.shapeLayers.push(newLayer);

        // Mark new layer as active and unlock it
        const allLayers = [this.sectionsLayer, ...this.shapeLayers];
        allLayers.forEach(l => {
            l.isLocked = true;
        });
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

        const minBtn = document.createElement('button');
        minBtn.innerHTML = this.isMinimized ? '□' : '_';
        minBtn.title = this.isMinimized ? 'Restore' : 'Minimize';
        minBtn.style.cssText = 'background: none; border: none; color: #aaa; cursor: pointer; padding: 0 4px; font-weight: bold; font-size: 14px;';
        minBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleMinimize();
        };
        header.appendChild(minBtn);
        panel.appendChild(header);

        // 1. Sections Section (Hardcoded)
        this.renderLayerGroup(this.sectionsLayer, panel);

        // 2. Shapes Section Header & Add Button
        const shapesHeader = document.createElement('div');
        shapesHeader.className = 'be-layer-section-header';
        shapesHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: #333; margin-top: 8px; border-radius: 4px 4px 0 0;';
        shapesHeader.innerHTML = '<span style="font-size: 11px; font-weight: bold; color: #aaa;">SHAPE LAYERS</span>';
        
        const addBtn = document.createElement('button');
        addBtn.id = 'print-enhance-add-layer';
        addBtn.innerHTML = '+';
        addBtn.title = 'Add new Shape Layer';
        addBtn.className = 'be-add-layer-btn';
        addBtn.style.cssText = 'background: #444; border: none; color: white; cursor: pointer; padding: 0 6px; border-radius: 3px; font-weight: bold;';
        addBtn.onclick = () => this.addShapeLayer();
        shapesHeader.appendChild(addBtn);
        panel.appendChild(shapesHeader);

        // 3. Render all Shape Layers
        this.shapeLayers.forEach(layer => {
            this.renderLayerGroup(layer, panel);
        });

        // Append to body if not already there
        if (!document.getElementById(panel.id)) {
            document.body.appendChild(panel);
        }

        this.panel = panel;
        this.refreshUI();
        
        return panel;
    }

    renderLayerGroup(layer, parent) {
        const layerGroup = document.createElement('div');
        layerGroup.className = 'be-layer-group';
        layerGroup.style.marginBottom = '8px';

        const row = document.createElement('div');
        row.className = 'be-layer-row';
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
            }
        };
        label.ondblclick = (e) => {
            e.stopPropagation();
            this.showRenameModal(layer);
        };
        row.appendChild(label);

        const controls = document.createElement('div');
        controls.className = 'be-layer-controls';

        // Print Visibility Toggle
        const printBtn = document.createElement('button');
        printBtn.innerHTML = layer.isDisabledOnPrint ? '🖨️❌' : '🖨️';
        printBtn.title = 'Toggle Print Visibility';
        printBtn.onclick = () => this.toggleLayerPrint(layer, printBtn);
        controls.appendChild(printBtn);

        // Visibility Toggle
        const viewBtn = document.createElement('button');
        viewBtn.innerHTML = layer.isHidden ? '🙈' : '👁️';
        viewBtn.title = 'Toggle Layer Visibility';
        viewBtn.onclick = () => this.toggleLayerVisibility(layer, viewBtn);
        controls.appendChild(viewBtn);

        // Lock Toggle (Edit Mode)
        const lockBtn = document.createElement('button');
        lockBtn.innerHTML = layer.isLocked ? '🔒' : '🔓';
        lockBtn.title = 'Toggle Edit Mode';
        lockBtn.onclick = () => this.toggleLayerLock(layer, lockBtn);
        controls.appendChild(lockBtn);

        // Delete Layer Button
        if (layer.id !== 'sections') {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.title = 'Delete Layer';
            deleteBtn.className = 'be-delete-layer-btn';
            deleteBtn.onclick = () => {
                if (confirm(`Are you sure you want to delete the layer "${layer.label}" and all its contents?`)) {
                    this.deleteShapeLayer(layer.id);
                }
            };
            controls.appendChild(deleteBtn);
        }

        row.appendChild(controls);
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
            backgroundColor: '#1a1a1a',
            borderRadius: '4px',
            minHeight: '20px',
            marginTop: '2px'
        });

        // Drag and drop list listeners
        list.ondragover = (e) => {
            e.preventDefault();
            const draggingEl = document.querySelector('.dragging');
            if (!draggingEl) return;

            const afterElement = this.getDragAfterElement(list, e.clientX, e.clientY);
            if (afterElement == null) {
                list.appendChild(draggingEl);
            } else {
                list.insertBefore(draggingEl, afterElement);
            }
        };

        this.contentLists[layer.id] = list;
        layerGroup.appendChild(list);
        parent.appendChild(layerGroup);
    }

    /**
     * Refreshes the content lists for all layers.
     */
    refreshLayerContents() {
        // 1. Sections
        this.renderElementsForLayer(this.sectionsLayer, '.be-section-wrapper', 'sections');

        // 2. Shapes (for each layer)
        this.shapeLayers.forEach(layer => {
            this.renderElementsForLayer(layer, '.be-shape-wrapper', 'shapes');
        });
    }

    renderElementsForLayer(layer, selector, type) {
        const list = this.contentLists[layer.id];
        if (!list) return;

        list.innerHTML = '';
        const elements = document.querySelectorAll(`#${layer.layerId} ${selector}`);
        
        if (elements.length === 0) {
            list.innerHTML = '<span style="color: #666; font-style: italic; font-size: 10px;">Empty</span>';
            return;
        }

        elements.forEach(el => {
            let item;
            if (type === 'shapes') {
                const container = el.querySelector('.print-section-container');
                const assetPath = container ? container.dataset.assetPath : null;
                if (!assetPath) return;

                item = document.createElement('img');
                const isBase64 = assetPath && assetPath.startsWith('data:');
                const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL && !isBase64)
                            ? chrome.runtime.getURL(assetPath)
                            : assetPath;

                item.src = url;
                item.className = 'be-layer-item-thumb';
                Object.assign(item.style, {
                    width: '28px', height: '28px', objectFit: 'contain',
                    border: '1px solid #444', borderRadius: '4px', backgroundColor: '#333',
                    cursor: 'move'
                });
                item.title = assetPath.split('/').pop();
            } else {
                const title = el.dataset.title || (el.querySelector('.print-section-header span') ? el.querySelector('.print-section-header span').textContent.trim() : 'Unnamed');

                item = document.createElement('div');
                item.className = 'be-layer-item-card';
                item.textContent = title;
                item.title = title;
                Object.assign(item.style, {
                    fontSize: '9px', padding: '3px 6px', backgroundColor: '#333',
                    border: '1px solid #555', borderRadius: '4px', maxWidth: '80px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    cursor: 'move', color: '#ddd'
                });
            }

            item.dataset.targetId = el.id;
            item.draggable = true;
            item.onclick = (e) => { e.stopPropagation(); this.focusElement(el.id); };
            item.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.createContextMenu(e.clientX, e.clientY, el.id);
            };
            item.ondragstart = () => item.classList.add('dragging');
            item.ondragend = () => {
                item.classList.remove('dragging');
                this.updatePrintZIndexes();
            };

            list.appendChild(item);
        });
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
    updatePrintZIndexes() {
        // We'll iterate layers in reverse order for Z-Index management
        const allLayers = [this.sectionsLayer, ...this.shapeLayers];
        
        allLayers.forEach((layer, layerIndex) => {
            const list = this.contentLists[layer.id];
            if (!list) return;

            const items = Array.from(list.querySelectorAll('.be-layer-item-card, .be-layer-item-thumb'));
            const baseZ = (layerIndex * 100) + 10;

            // Reorder actual DOM elements to match list order
            const layerContainer = document.getElementById(layer.layerId);
            
            items.forEach((item, index) => {
                const targetId = item.dataset.targetId;
                const el = document.getElementById(targetId);
                if (el) {
                    // Update Print Z
                    el.dataset.printZ = (baseZ + index).toString();
                    
                    // Reorder in DOM container if it moved between layers
                    if (layerContainer && el.parentNode !== layerContainer) {
                        layerContainer.appendChild(el);
                        this.checkLayerLimit(layer);
                    } else if (layerContainer) {
                        // Just append to maintain order within same layer
                        layerContainer.appendChild(el);
                    }
                }
            });
        });

        if (window.updatePrintStyles) window.updatePrintStyles();
        if (window.showFeedback) window.showFeedback('Layer order updated');
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
            const z = parseInt(window.getComputedStyle(item).zIndex) || 10;
            if (z > maxZ && z < 100000) maxZ = z;
        });
        wrapper.style.zIndex = (maxZ + 1).toString();

        setTimeout(() => { wrapper.classList.remove('be-focus-highlight'); }, 2000);
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
                    const printBtn = row.querySelector('button[title="Toggle Print Visibility"]');
                    const viewBtn = row.querySelector('button[title="Toggle Layer Visibility"]');
                    const lockBtn = row.querySelector('button[title="Toggle Edit Mode"]');

                    if (printBtn) printBtn.innerHTML = layer.isDisabledOnPrint ? '🖨️❌' : '🖨️';
                    if (viewBtn) viewBtn.innerHTML = layer.isHidden ? '🙈' : '👁️';
                    if (lockBtn) lockBtn.innerHTML = layer.isLocked ? '🔒' : '🔓';

                    // Sync active class on panel row
                    if (this.activeLayerId === layer.id) {
                        row.classList.add('be-active-layer');
                    } else {
                        row.classList.remove('be-active-layer');
                    }
                }
            }

            if (layerEl) {
                layerEl.dataset.printDisabled = layer.isDisabledOnPrint;
                layerEl.style.display = layer.isHidden ? 'none' : '';
                
                // Sync active class on DOM container
                if (this.activeLayerId === layer.id) {
                    layerEl.classList.add('be-active-layer');
                } else {
                    layerEl.classList.remove('be-active-layer');
                }

                // Apply Lock Styles (Faint and Non-Interactive)
                if (layer.isLocked) {
                    layerEl.style.opacity = '0.5';
                    layerEl.style.pointerEvents = 'none';
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

        this.refreshLayerContents();
        if (window.updatePrintStyles) window.updatePrintStyles();
    }

    toggleLayerPrint(layer, btn) {
        layer.isDisabledOnPrint = !layer.isDisabledOnPrint;
        this.refreshUI();
        if (window.showFeedback) window.showFeedback(`${layer.label} Print ${layer.isDisabledOnPrint ? 'Disabled' : 'Enabled'}`);
    }

    toggleLayerLock(layer, btn) {
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

    toggleLayerVisibility(layer, btn) {
        layer.isHidden = !layer.isHidden;
        this.refreshUI();
        if (window.showFeedback) window.showFeedback(`${layer.label} ${layer.isHidden ? 'Hidden' : 'Visible'}`);
    }

    /**
     * Creates and displays a custom context menu.
     */
    createContextMenu(x, y, targetId) {
        this.hideContextMenu();

        const menu = document.createElement('div');
        menu.id = 'print-enhance-context-menu';
        menu.className = 'be-context-menu be-floating-ui';
        Object.assign(menu.style, {
            position: 'fixed',
            left: `${x}px`,
            top: `${y}px`,
            zIndex: '100000',
            backgroundColor: '#222',
            border: '1px solid #444',
            borderRadius: '4px',
            padding: '4px 0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            minWidth: '120px'
        });

        const deleteItem = document.createElement('div');
        deleteItem.className = 'be-context-menu-item';
        deleteItem.innerHTML = '🗑️ Delete';
        Object.assign(deleteItem.style, {
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#ff4444',
            transition: 'background 0.2s'
        });
        deleteItem.onmouseover = () => { deleteItem.style.backgroundColor = '#333'; };
        deleteItem.onmouseout = () => { deleteItem.style.backgroundColor = 'transparent'; };
        deleteItem.onclick = () => {
            if (confirm('Delete this item?')) {
                this.deleteShape(targetId);
            }
            this.hideContextMenu();
        };

        menu.appendChild(deleteItem);
        document.body.appendChild(menu);
        this.contextMenu = menu;

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
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }

    /**
     * Toggles the minimized state of the panel.
     */
    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        if (this.panel) {
            this.panel.classList.toggle('minimized', this.isMinimized);
            this.rebuildPanel(); // Rebuild to update button text/icon
        }
    }

    /**
     * Shows a modal to rename a layer.
     * @param {object} layer 
     */
    showRenameModal(layer) {
        if (layer.id === 'sections') return; // Cannot rename sections layer

        const newName = prompt(`Rename layer "${layer.label}" to:`, layer.label);
        if (newName && newName.trim() !== '' && newName !== layer.label) {
            layer.label = newName.trim();
            this.rebuildPanel();
            if (window.showFeedback) window.showFeedback(`Layer renamed to "${layer.label}"`);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayerManager;
} else {
    window.LayerManager = LayerManager;
}
