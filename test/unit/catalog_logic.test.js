const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Mock chrome API
global.chrome = {
    runtime: {
        getURL: (path) => path
    }
};

// Mock fetch
global.fetch = async (url) => {
    // catalog_service.js uses chrome.runtime.getURL which we mocked to return the path as is
    if (url === 'catalog.json' || url.endsWith('/catalog.json')) {
        return {
            ok: true,
            json: async () => ({
                templates: [
                    { id: 'archer', name: 'Archer', path: 'assets/templates/archer_template.json', thumbnail: 'assets/thumbnails/archer.webp' }
                ]
            })
        };
    }
    if (url === 'assets/templates/archer_template.json' || url.endsWith('/archer_template.json')) {
        return {
            ok: true,
            json: async () => ({
                name: 'Archer',
                data: {
                    sections: {
                        'ability-scores': { borderStyle: 'archer_ability' }
                    },
                    shapes: [
                        { id: 'shape-archer-icon', assetPath: 'assets/shapes/archer_main.webp', left: '100px', top: '100px' }
                    ]
                }
            })
        };
    }
    if (url === 'malformed.json' || url.endsWith('/malformed.json')) {
        return { ok: true, json: async () => ({ name: 'Bad' }) };
    }
    if (url === 'empty.json' || url.endsWith('/empty.json')) {
        return { ok: true, json: async () => ({ name: 'Empty', data: {} }) };
    }
    return { ok: false };
};

describe('Catalog Service', function() {
    let CatalogService;

    before(function() {
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
        global.document = dom.window.document;
        global.window = dom.window;
        global.HTMLElement = dom.window.HTMLElement;

        // Load the service.
        const code = fs.readFileSync(path.join(__dirname, '../../js/catalog_service.js'), 'utf8');
        // Simple way to get the object out for testing
        const wrappedCode = code + '\nmodule.exports = { CatalogService };';
        
        // Use a temporary module to export the service
        const m = new module.constructor();
        m._compile(wrappedCode, 'catalog_service.js');
        CatalogService = m.exports.CatalogService;
    });

    it('should load the catalog JSON', async function() {
        const catalog = await CatalogService.loadCatalog();
        assert.strictEqual(catalog.templates.length, 1);
        assert.strictEqual(catalog.templates[0].id, 'archer');
    });

    it('should load a specific template', async function() {
        const template = await CatalogService.loadTemplate('assets/templates/archer_template.json');
        assert.strictEqual(template.name, 'Archer');
        assert.ok(template.data.sections);
    });

    describe('applyTemplate', function() {
        let dom;
        beforeEach(function() {
            dom = new JSDOM('<!DOCTYPE html><html><body><div id="ability-scores"></div></body></html>');
            global.document = dom.window.document;
            global.window = dom.window;
            global.HTMLElement = dom.window.HTMLElement;
            
            // Mock global functions used by applyTemplate
            global.clearBorderStyles = (el) => { el.className = ''; };
            global.createShape = () => {};
            global.updateLayoutBounds = () => {};
            global.alert = () => {};
        });

        it('should apply border styles to matching sections', async function() {
            // Mock confirm
            global.confirm = () => true;

            const success = await CatalogService.applyTemplate('archer');
            assert.ok(success);
            
            const section = document.getElementById('ability-scores');
            assert.ok(section.classList.contains('archer_ability'));
        });

        it('should prevent duplicate shapes if IDs match', async function() {
            global.confirm = () => true;
            let shapeCreateCount = 0;
            global.createShape = () => { shapeCreateCount++; };
            
            // First apply
            await CatalogService.applyTemplate('archer');
            assert.strictEqual(shapeCreateCount, 1);
            
            // Mock the shape element existing in DOM
            const shapeEl = document.createElement('div');
            shapeEl.id = 'shape-archer-icon';
            const wrapper = document.createElement('div');
            wrapper.className = 'be-section-wrapper';
            wrapper.appendChild(shapeEl);
            document.body.appendChild(wrapper);
            
            // Second apply
            await CatalogService.applyTemplate('archer');
            assert.strictEqual(shapeCreateCount, 2); // Should call createShape again
            assert.strictEqual(document.getElementById('shape-archer-icon'), null); // Should have removed the old one
        });

        it('should return false for non-existent template', async function() {
            const success = await CatalogService.applyTemplate('unknown');
            assert.strictEqual(success, false);
        });

        it('should handle malformed template JSON (missing data)', async function() {
            // Mock fetch to return malformed JSON
            const oldFetch = global.fetch;
            global.fetch = async (url) => {
                if (url === 'malformed.json') {
                    return { ok: true, json: async () => ({ name: 'Bad' }) }; // Missing 'data'
                }
                return oldFetch(url);
            };

            const template = await CatalogService.loadTemplate('malformed.json');
            assert.strictEqual(template, null);
            global.fetch = oldFetch;
        });

        it('should handle template with no sections or shapes', async function() {
            const oldFetch = global.fetch;
            global.fetch = async (url) => {
                if (url === 'empty.json') {
                    return { ok: true, json: async () => ({ name: 'Empty', data: {} }) };
                }
                return oldFetch(url);
            };
            
            // We need to add 'empty' to the catalog first
            const oldLoadCatalog = CatalogService.loadCatalog;
            CatalogService.loadCatalog = async () => ({
                templates: [{ id: 'empty', path: 'empty.json' }]
            });

            const success = await CatalogService.applyTemplate('empty');
            assert.strictEqual(success, false);

            CatalogService.loadCatalog = oldLoadCatalog;
            global.fetch = oldFetch;
        });
    });
});
