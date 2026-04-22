/**
 * Manages the Layer Management Panel UI and state.
 */
class LayerManager {
    constructor() {
        this.dom = window.DomManager.getInstance();
        this.layers = [
            { id: 'shapes', label: 'Shapes Mode', isLocked: false, isHidden: false, isDisabledOnPrint: false },
            { id: 'sections', label: 'Sections Mode', isLocked: false, isHidden: false, isDisabledOnPrint: false }
        ];
        this.panel = null;
    }

    /**
     * Creates or returns the layer management panel.
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

        // Layer List
        const list = document.createElement('div');
        list.className = 'be-layer-list';

        this.layers.forEach(layer => {
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
            list.appendChild(row);
        });

        panel.appendChild(list);
        this.panel = panel;
        return panel;
    }

    /**
     * Refreshes the UI icons based on the current layer state.
     */
    refreshUI() {
        if (!this.panel) return;

        this.layers.forEach(layer => {
            const row = this.panel.querySelector(`[data-layer-id="${layer.id}"]`);
            if (row) {
                const printBtn = row.querySelector('button[title="Toggle Print Visibility"]');
                const viewBtn = row.querySelector('button[title="Toggle Layer Visibility"]');
                const lockBtn = row.querySelector('button[title="Toggle Edit Mode"]');

                if (printBtn) printBtn.innerHTML = layer.isDisabledOnPrint ? '🖨️❌' : '🖨️';
                if (viewBtn) viewBtn.innerHTML = layer.isHidden ? '🙈' : '👁️';
                if (lockBtn) lockBtn.innerHTML = layer.isLocked ? '🔒' : '🔓';
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
