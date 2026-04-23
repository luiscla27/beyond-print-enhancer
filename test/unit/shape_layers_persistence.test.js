const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');

describe('Shape Layers Persistence', function() {
    let window, document, Storage, scanLayout, applyLayout, migrateLayout;

    before(function() {
        const html = '<!DOCTYPE html><html><head></head><body><div id="print-layout-wrapper"></div></body></html>';
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
                this.layers = [
                    { id: 'shapes', label: 'Shapes Mode', isLocked: false, isHidden: false, isDisabledOnPrint: false },
                    { id: 'sections', label: 'Sections', isLocked: false, isHidden: false, isDisabledOnPrint: false }
                ];
            }
            refreshUI() {}
        }
        
        window.DomManager = {
            getInstance: () => ({
                getLayerManager: () => new MockLayerManager(),
                getLayoutRoot: () => ({ element: document.getElementById('print-layout-wrapper') }),
                getSectionsLayer: () => ({ element: document.getElementById('print-enhance-sections-layer') }),
                getShapesLayer: () => ({ element: document.getElementById('print-enhance-shapes-layer') }),
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
                    CSS: {}
                }
            })
        };

        // Load main.js content
        const scriptPath = path.resolve(__dirname, '../../js/main.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        // Execute script in global context
        const wrappedScript = `
            (function() {
                ${scriptContent}
            })();
        `;
        try {
            eval(wrappedScript);
        } catch (e) {
            console.error('Error evaling main.js:', e);
        }

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
});