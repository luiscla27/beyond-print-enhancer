/**
 * Manages the Layer Management Panel UI and state.
 */
class LayerManager {
    constructor() {
        this.dom = window.DomManager.getInstance();
        this.layers = [
            { id: 'shapes', label: 'Shapes Mode', layerId: 'print-enhance-shapes-layer', isLocked: false, isHidden: false, isDisabledOnPrint: false },
            { id: 'sections', label: 'Sections', layerId: 'print-enhance-sections-layer', isLocked: false, isHidden: false, isDisabledOnPrint: false }
        ];
        this.panel = null;
        this.contentLists = {}; // layerId -> div
    }

    /**
     * Creates and injects the Layer Management panel into the DOM.
     */
    createPanel() {
        if (this.panel) return this.panel;

        const panel = document.createElement('div');
        panel.id = 'print-enhance-layer-manager';
        panel.className = 'be-layer-panel be-floating-ui';
        
        // Header
        const header = document.createElement('div');
        header.className = 'be-layer-panel-header';
        header.innerHTML = '<strong>Layer Management</strong>';
        panel.appendChild(header);

        this.layers.forEach(layer => {
            const layerGroup = document.createElement('div');
            layerGroup.className = 'be-layer-group';
            layerGroup.style.marginBottom = '8px';

            const row = document.createElement('div');
            row.className = 'be-layer-row';
            row.dataset.layerId = layer.id;

            const label = document.createElement('span');
            label.textContent = layer.label;
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
                const draggingEl = list.querySelector('.dragging');
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

            panel.appendChild(layerGroup);
        });

        // Append to body if not already there
        if (!document.getElementById(panel.id)) {
            document.body.appendChild(panel);
        }

        this.panel = panel;
        
        // Initial refresh
        this.refreshLayerContents();
        
        return panel;
    }

    /**
     * Refreshes the content lists for all layers.
     */
    refreshLayerContents() {
        // 1. Shapes
        const shapeList = this.contentLists['shapes'];
        if (shapeList) {
            shapeList.innerHTML = '';
            const shapes = document.querySelectorAll(`#${this.layers[0].layerId} .be-shape-wrapper`);
            if (shapes.length === 0) {
                shapeList.innerHTML = '<span style="color: #666; font-style: italic; font-size: 10px;">Empty</span>';
            }
            shapes.forEach(shape => {
                const container = shape.querySelector('.print-section-container');
                const assetPath = container ? container.dataset.assetPath : null;

                if (assetPath) {
                    const thumb = document.createElement('img');
                    // Ensure we use chrome.runtime.getURL if available, otherwise raw path
                    const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
                                ? chrome.runtime.getURL(assetPath)
                                : assetPath;

                    thumb.src = url;
                    thumb.className = 'be-layer-item-thumb';
                    thumb.dataset.targetId = shape.id;
                    thumb.draggable = true;
                    Object.assign(thumb.style, {
                        width: '28px',
                        height: '28px',
                        objectFit: 'contain',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        backgroundColor: '#333',
                        cursor: 'move',
                        transition: 'transform 0.1s'
                    });
                    thumb.onmouseenter = () => thumb.style.transform = 'scale(1.2)';
                    thumb.onmouseleave = () => thumb.style.transform = 'scale(1)';
                    thumb.onclick = (e) => {
                        e.stopPropagation();
                        this.focusElement(shape.id);
                    };

                    thumb.ondragstart = () => thumb.classList.add('dragging');
                    thumb.ondragend = () => {
                        thumb.classList.remove('dragging');
                        this.updatePrintZIndexes();
                    };

                    thumb.title = assetPath.split('/').pop();
                    shapeList.appendChild(thumb);
                }
            });
        }

        // 2. Sections
        const sectionList = this.contentLists['sections'];
        if (sectionList) {
            sectionList.innerHTML = '';
            const sections = document.querySelectorAll(`#${this.layers[1].layerId} .be-section-wrapper`);
            if (sections.length === 0) {
                sectionList.innerHTML = '<span style="color: #666; font-style: italic; font-size: 10px;">Empty</span>';
            }
            sections.forEach(section => {
                const header = section.querySelector('.print-section-header span');
                const title = header ? header.textContent.trim() : 'Unnamed';

                const card = document.createElement('div');
                card.className = 'be-layer-item-card';
                card.textContent = title;
                card.dataset.targetId = section.id;
                card.draggable = true;
                Object.assign(card.style, {
                    fontSize: '9px',
                    padding: '3px 6px',
                    backgroundColor: '#333',
                    border: '1px solid #555',
                    borderRadius: '4px',
                    maxWidth: '80px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'move',
                    color: '#ddd'
                });
                card.title = title;
                card.onclick = (e) => {
                    e.stopPropagation();
                    this.focusElement(section.id);
                };

                card.ondragstart = () => card.classList.add('dragging');
                card.ondragend = () => {
                    card.classList.remove('dragging');
                    this.updatePrintZIndexes();
                };

                sectionList.appendChild(card);
            });
        }
    }

    /**
     * Finds the element in the list that the current dragged item should be inserted after.
     */
    getDragAfterElement(container, x, y) {
        const draggableElements = [...container.querySelectorAll('.be-layer-item-card:not(.dragging), .be-layer-item-thumb:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            // Heuristic for flex-wrap: priority to Y (lines), then X (position in line)
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
        const items = Array.from(this.panel.querySelectorAll('.be-layer-item-card, .be-layer-item-thumb'));
        // Top item in list = Highest Print Z-Index
        // We reverse because we want the first item to have the highest index
        const reversedItems = [...items].reverse();

        reversedItems.forEach((item, index) => {
            const targetId = item.dataset.targetId;
            if (!targetId) return;

            const el = document.getElementById(targetId);
            if (el) {
                const wrapper = el.classList.contains('be-section-wrapper') ? el : el.closest('.be-section-wrapper');
                if (wrapper) {
                    wrapper.dataset.printZ = (index + 10).toString(); // Base 10 to clear background
                }
            }
        });

        if (window.updatePrintStyles) {
            window.updatePrintStyles();
        }

        if (window.showFeedback) {
            window.showFeedback('Print order updated');
        }
    }

    /**
     * Focuses and highlights an element on the sheet.
     * @param {string} id The ID of the container element (wrapper or inner) to focus.
     */
    focusElement(id) {
        if (!id) return;
        const el = document.getElementById(id);
        if (!el) return;

        // Ensure we have the wrapper for scrolling and highlighting
        const wrapper = el.classList.contains('be-section-wrapper') ? el : el.closest('.be-section-wrapper');
        if (!wrapper) return;

        // 1. Scroll to element
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // 2. Highlighting
        wrapper.classList.add('be-focus-highlight');

        // 3. Bring to front (Existing behavior maintained)
        // Find max z-index in both layers to ensure it's truly on top
        let maxZ = 1000;
        document.querySelectorAll('.be-section-wrapper').forEach(item => {
            const z = parseInt(window.getComputedStyle(item).zIndex) || 10;
            if (z > maxZ && z < 100000) maxZ = z;
        });
        wrapper.style.zIndex = (maxZ + 1).toString();

        // Remove highlight after duration
        setTimeout(() => {
            wrapper.classList.remove('be-focus-highlight');
        }, 2000);

        if (window.showFeedback) {
            const header = wrapper.querySelector('.print-section-header span');
            const name = header ? header.textContent.trim() : 'Element';
            window.showFeedback(`Focused: ${name}`);
        }
    }

    /**
     * Refreshes the UI icons based on the current layer state.
     */
    refreshUI() {
        this.layers.forEach(layer => {
            if (this.panel) {
                const row = this.panel.querySelector(`[data-layer-id="${layer.id}"]`);
                if (row) {
                    const printBtn = row.querySelector('button[title="Toggle Print Visibility"]');
                    const viewBtn = row.querySelector('button[title="Toggle Layer Visibility"]');
                    const lockBtn = row.querySelector('button[title="Toggle Edit Mode"]');

                    if (printBtn) printBtn.innerHTML = layer.isDisabledOnPrint ? '🖨️❌' : '🖨️';
                    if (viewBtn) viewBtn.innerHTML = layer.isHidden ? '🙈' : '👁️';
                    if (lockBtn) lockBtn.innerHTML = layer.isLocked ? '🔒' : '🔓';
                }
            }

            // Sync with actual DOM elements
            const layerEl = document.getElementById(`print-enhance-${layer.id}-layer`);
            if (layerEl) {
                layerEl.dataset.printDisabled = layer.isDisabledOnPrint;
                if (layer.isHidden) {
                    layerEl.style.display = 'none';
                } else {
                    layerEl.style.display = '';
                }
            }
            
            // Sync body classes for locking
            const lockClass = `be-lock-${layer.id}`;
            if (layer.isLocked) {
                document.body.classList.add(lockClass);
            } else {
                document.body.classList.remove(lockClass);
            }
        });

        this.refreshLayerContents();

        if (window.updatePrintStyles) {
            window.updatePrintStyles();
        }
    }

    toggleLayerPrint(layer, btn) {
        layer.isDisabledOnPrint = !layer.isDisabledOnPrint;
        btn.innerHTML = layer.isDisabledOnPrint ? '🖨️❌' : '🖨️';
        
        const layerEl = document.getElementById(`print-enhance-${layer.id}-layer`);
        if (layerEl) {
            layerEl.dataset.printDisabled = layer.isDisabledOnPrint;
        }

        if (window.updatePrintStyles) {
            window.updatePrintStyles();
        }

        if (window.showFeedback) {
            window.showFeedback(`${layer.label} Print ${layer.isDisabledOnPrint ? 'Disabled' : 'Enabled'}`);
        }
    }

    toggleLayerLock(layer, btn) {
        layer.isLocked = !layer.isLocked;
        btn.innerHTML = layer.isLocked ? '🔒' : '🔓';
        
        const lockClass = `be-lock-${layer.id}`;
        if (layer.isLocked) {
            document.body.classList.add(lockClass);
        } else {
            document.body.classList.remove(lockClass);
        }

        if (window.showFeedback) {
            window.showFeedback(`${layer.label} ${layer.isLocked ? 'Locked' : 'Unlocked'}`);
        }
    }

    toggleLayerVisibility(layer, btn) {
        layer.isHidden = !layer.isHidden;
        btn.innerHTML = layer.isHidden ? '🙈' : '👁️';
        
        const layerEl = document.getElementById(`print-enhance-${layer.id}-layer`);
        if (layerEl) {
            layerEl.style.display = layer.isHidden ? 'none' : '';
        }

        if (window.showFeedback) {
            window.showFeedback(`${layer.label} ${layer.isHidden ? 'Hidden' : 'Visible'}`);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayerManager;
} else {
    window.LayerManager = LayerManager;
}
