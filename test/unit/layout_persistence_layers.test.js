const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const layerManagerPath = path.resolve(__dirname, '../../js/dom/layer_manager.js');
const domManagerPath = path.resolve(__dirname, '../../js/dom/dom_manager.js');
const elementWrapperPath = path.resolve(__dirname, '../../js/dom/element_wrapper.js');

const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
const layerManagerContent = fs.readFileSync(layerManagerPath, 'utf8');
const domManagerContent = fs.readFileSync(domManagerPath, 'utf8');
const elementWrapperContent = fs.readFileSync(elementWrapperPath, 'utf8');

describe('Layer Persistence', function() {
    let window, document, lm;

    before(async function() {
        const dom = new JSDOM('<!DOCTYPE html><html><body><div id="print-layout-wrapper"></div><div id="print-enhance-shapes-layer"></div><div id="print-enhance-sections-layer"></div></body></html>', {
            url: "http://localhost",
            runScripts: "dangerously",
            resources: "usable"
        });
        
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.HTMLElement = window.HTMLElement;
        global.NodeList = window.NodeList;
        global.Node = window.Node;
        global.navigator = window.navigator;

        global.ResizeObserver = class ResizeObserver {
            observe() {}
            unobserve() {}
            disconnect() {}
        };

        const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
        window.indexedDB = indexedDB;
        window.IDBKeyRange = IDBKeyRange;
        global.indexedDB = indexedDB;
        global.IDBKeyRange = IDBKeyRange;
        window.__DDB_TEST_MODE__ = true;

        // Mock safeLog
        window.safeLog = () => {};

        // Load dependencies in order
        window.eval(elementWrapperContent);
        window.eval(domManagerContent);
        window.eval(layerManagerContent);
        
        // Use DomManager to get the LayerManager instance
        lm = window.DomManager.getInstance().getLayerManager();
        window.PeDom = () => window.DomManager.getInstance();

        window.eval(mainJsContent);
        await window.Storage.init();
    });

    after(function() {
        delete global.window;
        delete global.document;
        delete global.HTMLElement;
        delete global.NodeList;
        delete global.Node;
        delete global.navigator;
        delete global.indexedDB;
        delete global.IDBKeyRange;
        delete global.ResizeObserver;
    });

    it('should include layer states in scanLayout', async function() {
        lm.shapeLayers.find(l => l.id === 'shapes-default').isDisabledOnPrint = true;
        lm.sectionsLayer.isLocked = true;
        
        const layout = await window.scanLayout();
        // console.log('DEBUG layout.layers:', JSON.stringify(layout.layers, null, 2));
        
        assert.ok(layout.layers, 'Layers should be included in layout');
        assert.strictEqual(layout.layers['shapes-default'].isDisabledOnPrint, true, 'shapes-default should be disabled on print');
        assert.strictEqual(layout.layers.sections.isLocked, true, 'sections should be locked');
    });

    it('should restore layer states in applyLayout', async function() {
        const testLayout = {
            version: '1.5.0',
            sections: {}, // Needed to pass the guard clause
            shapeLayers: [
                { id: 'shapes-default', name: 'Shapes (Default)', isDisabledOnPrint: false, isLocked: true, isHidden: true }
            ],
            layers: {
                'shapes-default': { isDisabledOnPrint: false, isLocked: true, isHidden: true },
                sections: { isDisabledOnPrint: true, isLocked: false, isHidden: false }
            }
        };

        await window.applyLayout(testLayout);

        // Re-fetch lm as it might have been re-instantiated during applyLayout
        lm = window.PeDom().getLayerManager();

        const shapes = lm.shapeLayers.find(l => l.id === 'shapes-default');
        const sections = lm.sectionsLayer;

        assert.strictEqual(shapes.isLocked, true);
        assert.strictEqual(shapes.isHidden, true);
        assert.strictEqual(shapes.isDisabledOnPrint, false);

        assert.strictEqual(sections.isLocked, false);
        assert.strictEqual(sections.isHidden, false);
        assert.strictEqual(sections.isDisabledOnPrint, true);
        
        // Verify DOM sync
        assert.strictEqual(document.getElementById('print-enhance-sections-layer').dataset.printDisabled, 'true');
        assert.ok(document.body.classList.contains('be-lock-shapes-default'));
    });
});
