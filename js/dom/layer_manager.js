/**
 * Manages the Layer Management Panel UI and state.
 */
class LayerManager {
    constructor() {
        this.dom = window.DomManager.getInstance();
        this.layers = [
            { id: 'shapes', label: 'Shapes Mode', layerId: 'print-enhance-shapes-layer' },
            { id: 'sections', label: 'Sections', layerId: 'print-enhance-sections-layer' }
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
            minWidth: '140px',
            maxWidth: '280px',
            maxHeight: '80vh',
            overflowY: 'auto',
            overflowX: 'hidden'
        });

        const title = document.createElement('div');
        title.textContent = 'Layer Management';
        title.style.fontWeight = 'bold';
        title.style.borderBottom = '1px solid #444';
        title.style.paddingBottom = '4px';
        title.style.marginBottom = '4px';
        panel.appendChild(title);

        this.layers.forEach(layer => {
            const layerGroup = document.createElement('div');
            layerGroup.style.display = 'flex';
            layerGroup.style.flexDirection = 'column';
            layerGroup.style.gap = '2px';
            layerGroup.style.marginBottom = '8px';

            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.gap = '10px';
            row.style.padding = '2px 4px';

            const label = document.createElement('span');
            label.textContent = layer.label;
            label.style.fontWeight = '600';
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
            layerGroup.appendChild(row);

            // Nested List Container
            const list = document.createElement('div');
            list.className = 'be-layer-content-list';
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
            
            this.contentLists[layer.id] = list;
            layerGroup.appendChild(list);
            
            panel.appendChild(layerGroup);
        });

        document.body.appendChild(panel);
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
                    Object.assign(thumb.style, {
                        width: '28px',
                        height: '28px',
                        objectFit: 'contain',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        backgroundColor: '#333',
                        cursor: 'help',
                        transition: 'transform 0.1s'
                    });
                    thumb.onmouseenter = () => thumb.style.transform = 'scale(1.2)';
                    thumb.onmouseleave = () => thumb.style.transform = 'scale(1)';
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
                    cursor: 'default',
                    color: '#ddd'
                });
                card.title = title;
                sectionList.appendChild(card);
            });
        }
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
