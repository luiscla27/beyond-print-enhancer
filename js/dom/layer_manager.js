/**
 * Manages the Layer Management Panel UI and state.
 */
class LayerManager {
    constructor() {
        this.dom = window.DomManager.getInstance();
        this.layers = [
            { id: 'shapes', label: 'Shapes Mode', layerId: 'pe-shapes-layer' },
            { id: 'sections', label: 'Sections', layerId: 'pe-sections-layer' }
        ];
        this.panel = null;
    }

    /**
     * Creates and injects the Layer Management panel into the DOM.
     */
    createPanel() {
        if (this.panel) return this.panel;

        const panel = document.createElement('div');
        panel.id = 'print-enhance-layer-manager';
        panel.className = 'be-layer-panel';
        Object.assign(panel.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: '100002', // Clear site modals (30000+)
            backgroundColor: '#222',
            border: '1px solid #444',
            borderRadius: '8px',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            color: 'white',
            fontSize: '12px',
            minWidth: '120px'
        });

        const title = document.createElement('div');
        title.textContent = 'Layers';
        title.style.fontWeight = 'bold';
        title.style.borderBottom = '1px solid #444';
        title.style.paddingBottom = '4px';
        title.style.marginBottom = '4px';
        panel.appendChild(title);

        this.layers.forEach(layer => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.gap = '10px';
            row.style.padding = '2px 4px';

            const label = document.createElement('span');
            label.textContent = layer.label;
            row.appendChild(label);

            const toggle = document.createElement('button');
            toggle.innerHTML = '👁️';
            toggle.title = 'Toggle Visibility';
            Object.assign(toggle.style, {
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '0',
                opacity: '1',
                transition: 'opacity 0.2s'
            });

            toggle.onclick = () => this.toggleLayer(layer, toggle);

            row.appendChild(toggle);
            panel.appendChild(row);
        });

        document.body.appendChild(panel);
        this.panel = panel;
        return panel;
    }

    /**
     * Toggles the visibility of a layer.
     * @param {object} layer The layer metadata.
     * @param {HTMLElement} btn The toggle button element.
     */
    toggleLayer(layer, btn) {
        const layerEl = document.getElementById(layer.layerId);
        if (!layerEl) return;

        const isHidden = layerEl.style.display === 'none';
        if (isHidden) {
            layerEl.style.display = 'block';
            btn.style.opacity = '1';
            btn.innerHTML = '👁️';
        } else {
            layerEl.style.display = 'none';
            btn.style.opacity = '0.4';
            btn.innerHTML = '👁️'; // Keep same icon but dim it
        }
        
        if (window.showFeedback) {
            window.showFeedback(`${layer.label} ${isHidden ? 'Visible' : 'Hidden'}`);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayerManager;
} else {
    window.LayerManager = LayerManager;
}
