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
            console.error(`[DDB Print] Error loading template at ${path}:`, err);
            return null;
        }
    },

    async applyTemplate(templateId, skipConfirm = false) {
        const catalog = await this.loadCatalog();
        const entry = catalog.templates.find(t => t.id === templateId);
        if (!entry) {
            console.error(`[DDB Print] Template ${templateId} not found in catalog.`);
            return false;
        }

        const template = await this.loadTemplate(entry.path);
        if (!template) {
            if (!skipConfirm) alert('Failed to load template data. It may be malformed.');
            return false;
        }

        // Deep validation
        if (!template.data.sections && !template.data.shapes) {
            console.error('[DDB Print] Template has no sections or shapes to apply.');
            return false;
        }

        // Conflict check & confirmation
        if (!skipConfirm) {
            const hasExistingShapes = document.querySelectorAll('.be-shape').length > 0;
            const msg = `Apply template "${template.name}"?\n\nThis will update border styles for several sections and add decorative shapes. Existing shapes may be replaced.`;
            
            if (!confirm(msg)) return false;
        }

        console.log(`[DDB Print] Applying template: ${template.name}`);

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
                const details = await CatalogService.loadTemplate(template.path);
                if (!details) return;

                // Show detailed preview modal
                const previewOverlay = document.createElement('div');
                previewOverlay.className = 'be-modal-overlay';
                previewOverlay.style.zIndex = '31000';
                
                const previewModal = document.createElement('div');
                previewModal.className = cls(selectors.MODAL);
                previewModal.style.width = '400px';

                const pTitle = document.createElement('h3');
                pTitle.textContent = template.name;
                previewModal.appendChild(pTitle);

                const pImg = document.createElement('img');
                pImg.src = chrome.runtime.getURL(template.thumbnail);
                pImg.style.width = '100%';
                pImg.style.borderRadius = '4px';
                pImg.style.marginBottom = '10px';
                previewModal.appendChild(pImg);

                const pDesc = document.createElement('p');
                pDesc.textContent = template.description || '';
                pDesc.style.fontSize = '13px';
                previewModal.appendChild(pDesc);

                const stats = document.createElement('div');
                stats.style.fontSize = '12px';
                stats.style.color = '#aaa';
                stats.style.marginBottom = '20px';
                const sectionCount = Object.keys(details.data.sections || {}).length;
                const shapeCount = (details.data.shapes || []).length;
                stats.innerHTML = `Includes: <b>${sectionCount}</b> Borders, <b>${shapeCount}</b> Shapes`;
                previewModal.appendChild(stats);

                const btnGroup = document.createElement('div');
                btnGroup.style.display = 'flex';
                btnGroup.style.gap = '10px';
                btnGroup.style.justifyContent = 'flex-end';

                const applyBtn = document.createElement('button');
                applyBtn.textContent = 'Apply Template';
                applyBtn.className = 'be-robust-button'; // Assuming this exists or using standard be-modal-cancel style
                applyBtn.style.backgroundColor = '#e40712';
                applyBtn.style.color = 'white';
                applyBtn.onclick = async () => {
                    const originalText = applyBtn.textContent;
                    applyBtn.textContent = 'Applying...';
                    applyBtn.disabled = true;
                    
                    try {
                        const success = await CatalogService.applyTemplate(template.id);
                        if (success) {
                            if (typeof showFeedback === 'function') showFeedback(`Template applied: ${template.name}`);
                            previewOverlay.remove();
                            overlay.remove();
                            resolve(true);
                        }
                    } catch (err) {
                        console.error('[DDB Print] Error applying template:', err);
                        alert('An error occurred while applying the template.');
                    } finally {
                        applyBtn.textContent = originalText;
                        applyBtn.disabled = false;
                    }
                };
                btnGroup.appendChild(applyBtn);

                const closePBtn = document.createElement('button');
                closePBtn.textContent = 'Back';
                closePBtn.className = 'be-modal-cancel';
                closePBtn.onclick = () => previewOverlay.remove();
                btnGroup.appendChild(closePBtn);

                previewModal.appendChild(btnGroup);
                previewOverlay.appendChild(previewModal);
                document.body.appendChild(previewOverlay);
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

// Export to window for access from main.js
window.CatalogService = CatalogService;
window.showPremadeCatalogModal = showPremadeCatalogModal;
