const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');

describe('Shape Layers Persistence', function() {
    let window, document, Storage, scanLayout, applyLayout, migrateLayout;

    before(function() {
        const html = '<!DOCTYPE html><html><head></head><body><div id="print-layout-wrapper"><div id="print-enhance-shapes-layer"></div></div></body></html>';
        const dom = new JSDOM(html, { url: 'https://www.dndbeyond.com/characters/123' });
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.HTMLElement = window.HTMLElement;
        global.Node = window.Node;
        global.navigator = window.navigator;
        global.chrome = {
            runtime: {
                getURL: (path) => path
            }
        };

        // Mock PeDom and other dependencies
        window.__DDB_TEST_MODE__ = true;
        
        // Mock LayerManager
        class MockLayerManager {
            constructor() {
                this.sectionsLayer = { id: 'sections', label: 'Sections', layerId: 'print-enhance-sections-layer' };
                this.shapeLayers = [
                    { id: 'shapes-default', label: 'Shapes (Default)', layerId: 'print-enhance-shapes-layer', isLocked: false, isHidden: false, isDisabledOnPrint: false }
                ];
            }
            getLayerById(id) {
                if (id === 'sections') return this.sectionsLayer;
                return this.shapeLayers.find(l => l.id === id);
            }
            addShapeLayer(name, state) {
                const layer = { id: state.id || 'new-layer', label: name, layerId: state.layerId || 'new-layer-id' };
                this.shapeLayers.push(layer);
                return layer;
            }
            refreshUI() {}
        }
        
        window.DomManager = {
            getInstance: () => ({
                getLayerManager: () => new MockLayerManager(),
                getLayoutRoot: () => ({ element: document.getElementById('print-layout-wrapper') }),
                getSectionsLayer: () => ({ element: document.getElementById('print-enhance-sections-layer') }),
                getShapesLayer: () => ({ element: document.getElementById('print-enhance-shapes-layer') }),
                getShapesContainer: () => ({ element: document.body }),
                getCharacterSheet: () => ({ element: { style: {} } }),
                getSheetInner: () => ({ element: { style: {} } }),
                getCharacterName: () => 'Test Character',
                getSidebar: () => ({ element: { querySelector: () => null } }),
                getCombatTablet: () => ({ element: { querySelector: () => null } }),
                selectors: {
                    EXTRACTABLE: {},
                    UI: {},
                    CORE: {},
                    SVG: {},
                    COMPACT: {},
                    SPELLS: {},
                    EQUIPMENT: {},
                    EXTRAS: {},
                    TRAITS: {},
                    CSS: {},
                    LAYERS: {
                        SHAPES: '#print-enhance-shapes-layer'
                    }
                }
            })
        };

        // Load main.js content
        const scriptPath = path.resolve(__dirname, '../../js/main.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        // Execute script in global context
        try {
            eval(scriptContent);
        } catch (e) {
            console.error('Error evaling main.js:', e);
        }

        window.flagExtractableElements = () => {};
        window.updatePrintStyles = () => {};
        window.updateLayoutBounds = () => {};
        window.PeDom = window.PeDom || (() => window.DomManager.getInstance());
        
        global.updatePrintStyles = window.updatePrintStyles;
        global.updateLayoutBounds = window.updateLayoutBounds;
        global.flagExtractableElements = window.flagExtractableElements;

        Storage = window.Storage;
        scanLayout = window.scanLayout;
        applyLayout = window.applyLayout;
        migrateLayout = Storage.migrateLayout;
    });

    after(function() {
        delete global.window;
        delete global.document;
        delete global.HTMLElement;
        delete global.Node;
        delete global.navigator;
        delete global.chrome;
    });

    it('should have SCHEMA_VERSION 1.5.0', function() {
        assert.strictEqual(Storage.SCHEMA_VERSION, '1.5.0');
    });

    it('should migrate legacy layer states to new multi-layer format', function() {
        const legacyData = {
            version: '1.4.0',
            sections: {},
            layers: {
                shapes: { isLocked: true, isHidden: false, isDisabledOnPrint: false },
                sections: { isLocked: false, isHidden: true, isDisabledOnPrint: true }
            }
        };

        const migrated = migrateLayout(JSON.parse(JSON.stringify(legacyData)));
        
        assert.strictEqual(migrated.version, '1.5.0');
        assert.ok(Array.isArray(migrated.shapeLayers), 'Should have shapeLayers array');
        assert.strictEqual(migrated.shapeLayers.length, 1, 'Should have 1 default shape layer');
        assert.strictEqual(migrated.shapeLayers[0].id, 'shapes-default');
        assert.strictEqual(migrated.shapeLayers[0].isLocked, true);
        assert.strictEqual(migrated.shapeLayers[0].isHidden, false);
    });

    it('should preserve multi-layer structure during migration if already present', function() {
        const multiLayerData = {
            version: '1.5.0',
            sections: {},
            shapeLayers: [
                { id: 'layer-1', name: 'Background', isLocked: true, elements: [] },
                { id: 'layer-2', name: 'Foreground', isLocked: false, elements: [] }
            ]
        };

        const migrated = migrateLayout(JSON.parse(JSON.stringify(multiLayerData)));
        assert.strictEqual(migrated.shapeLayers.length, 2);
        assert.strictEqual(migrated.shapeLayers[0].name, 'Background');
    });

    it('should restore shapes correctly from legacy layout', async function() {
        const legacyData = {
            version: '1.4.0',
            sections: {},
            shapes: [
                { id: 'shape-1', assetPath: 'path/to/asset.webp', left: '10px', top: '20px' }
            ]
        };

        // Mock dependencies globally
        global.flagExtractableElements = () => {};
        global.updatePrintStyles = () => {};
        global.showFeedback = () => {};
        
        // Mock createShape
        global.createShape = (path, data, layerId) => {
            const el = document.createElement('div');
            el.id = data.id;
            el.className = 'be-shape-wrapper';
            const container = document.getElementById(layerId) || document.body;
            container.appendChild(el);
        };

        await applyLayout(legacyData);

        const shape = document.getElementById('shape-1');
        assert.ok(shape, 'Shape should be created in the DOM');
        assert.ok(shape.closest('#print-enhance-shapes-layer'), 'Shape should be inside the default shapes layer');
    });
});