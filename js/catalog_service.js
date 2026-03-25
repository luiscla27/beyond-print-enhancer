/**
 * Service for managing premade templates.
 */
const CatalogService = {
    async loadCatalog() {
        try {
            const response = await fetch(chrome.runtime.getURL('catalog.json'));
            if (!response.ok) throw new Error('Failed to load catalog');
            return await response.json();
        } catch (err) {
            console.error('[DDB Print] Error loading catalog:', err);
            return { templates: [] };
        }
    },

    async loadTemplate(path) {
        try {
            const response = await fetch(chrome.runtime.getURL(path));
            if (!response.ok) throw new Error(`Failed to load template: ${path}`);
            return await response.json();
        } catch (err) {
            console.error(`[DDB Print] Error loading template at ${path}:`, err);
            return null;
        }
    },

    async applyTemplate(templateId) {
        const catalog = await this.loadCatalog();
        const entry = catalog.templates.find(t => t.id === templateId);
        if (!entry) return false;

        const template = await this.loadTemplate(entry.path);
        if (!template) return false;

        console.log(`[DDB Print] Applying template: ${template.name}`);

        // 1. Apply Borders
        if (template.data.sections) {
            for (const [selector, config] of Object.entries(template.data.sections)) {
                // Try as ID first, then as general selector
                let section = document.getElementById(selector) || document.querySelector(selector);
                
                if (section) {
                    const wrapper = section.closest('.be-section-wrapper') || section;
                    if (config.left) wrapper.style.left = config.left;
                    if (config.top) wrapper.style.top = config.top;
                    if (config.width) section.style.width = config.width;
                    if (config.height) section.style.height = config.height;
                    
                    if (config.borderStyle) {
                        // Ensure the class name is correct
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
                if (typeof createShape === 'function') {
                    createShape(shape.assetPath, {
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
        return true;
    }
};

/**
 * Shows a modal displaying the PREMADE template catalog.
 */
async function showPremadeCatalogModal() {
    const catalog = await CatalogService.loadCatalog();
    const dom = (typeof DomManager !== 'undefined') ? DomManager.getInstance() : null;
    const selectors = dom ? dom.selectors.TEMPLATE : {
        MODAL: 'be-modal',
        ITEM: 'be-catalog-item',
        GRID: 'be-catalog-grid',
        THUMBNAIL: 'be-catalog-thumbnail',
        TITLE: 'be-catalog-title',
        DESCRIPTION: 'be-catalog-description'
    };

    // Helper to get class name without dot
    const cls = (selector) => selector.startsWith('.') ? selector.slice(1) : selector;
    
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'be-modal-overlay';
        overlay.style.zIndex = '30000';
        
        const modal = document.createElement('div');
        modal.className = cls(selectors.MODAL);
        modal.style.width = '600px';
        modal.style.maxHeight = '80vh';
        modal.style.overflowY = 'auto';
        
        const h3 = document.createElement('h3');
        h3.textContent = 'Premade Templates';
        modal.appendChild(h3);

        const grid = document.createElement('div');
        grid.className = cls(selectors.GRID);
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
        grid.style.gap = '15px';
        grid.style.marginTop = '20px';

        catalog.templates.forEach(template => {
            const item = document.createElement('div');
            item.className = cls(selectors.ITEM);
            item.style.backgroundColor = '#333';
            item.style.borderRadius = '8px';
            item.style.padding = '10px';
            item.style.cursor = 'pointer';
            item.style.transition = 'transform 0.2s, background-color 0.2s';
            item.style.border = '2px solid transparent';

            const thumb = document.createElement('img');
            thumb.className = cls(selectors.THUMBNAIL);
            thumb.src = chrome.runtime.getURL(template.thumbnail);
            thumb.style.width = '100%';
            thumb.style.height = '120px';
            thumb.style.objectFit = 'cover';
            thumb.style.borderRadius = '4px';
            thumb.style.marginBottom = '8px';
            item.appendChild(thumb);

            const name = document.createElement('div');
            name.className = cls(selectors.TITLE);
            name.textContent = template.name;
            name.style.fontWeight = 'bold';
            name.style.fontSize = '14px';
            item.appendChild(name);

            const desc = document.createElement('div');
            desc.className = cls(selectors.DESCRIPTION);
            desc.textContent = template.description || '';
            desc.style.fontSize = '11px';
            desc.style.color = '#ccc';
            desc.style.marginTop = '4px';
            item.appendChild(desc);

            item.onmouseenter = () => {
                item.style.transform = 'translateY(-2px)';
                item.style.backgroundColor = '#444';
            };
            item.onmouseleave = () => {
                item.style.transform = 'translateY(0)';
                item.style.backgroundColor = '#333';
            };

            item.onclick = async () => {
                item.style.borderColor = '#e40712';
                const success = await CatalogService.applyTemplate(template.id);
                if (success) {
                    if (typeof showFeedback === 'function') showFeedback(`Template applied: ${template.name}`);
                    overlay.remove();
                    resolve(true);
                } else {
                    alert('Failed to apply template.');
                }
            };

            grid.appendChild(item);
        });

        modal.appendChild(grid);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Close';
        cancelBtn.className = 'be-modal-cancel';
        cancelBtn.style.marginTop = '20px';
        cancelBtn.onclick = () => {
            overlay.remove();
            resolve(false);
        };
        modal.appendChild(cancelBtn);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    });
}
