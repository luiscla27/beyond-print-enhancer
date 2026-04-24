const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const vm = require('vm');

describe('Shape Layers DOM Management', function() {
    let window, document, LayerManager;

    beforeEach(function() {
        const html = '<!DOCTYPE html><html><head></head><body><div id="print-layout-wrapper"><div id="print-enhance-sections-layer"></div><div id="print-enhance-shapes-container"></div></div></body></html>';
        const dom = new JSDOM(html, { url: 'https://www.dndbeyond.com/characters/123' });
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.HTMLElement = window.HTMLElement;
        global.Node = window.Node;
        global.navigator = window.navigator;

        // Mock dependencies
        window.DomManager = {
            getInstance: () => ({
                getLayoutRoot: () => ({ element: document.getElementById('print-layout-wrapper') }),
                getSectionsLayer: () => ({ element: document.getElementById('print-enhance-sections-layer') }),
                getShapesContainer: () => ({ element: document.getElementById('print-enhance-shapes-container') })
            })
        };
        window.showFeedback = () => {};
        window.updatePrintStyles = () => {};

        // Load LayerManager content
        const scriptPath = path.resolve(__dirname, '../../js/dom/layer_manager.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        const context = vm.createContext(window);
        vm.runInContext(scriptContent, context);

        LayerManager = window.LayerManager;
    });

    afterEach(function() {
        delete global.window;
        delete global.document;
        delete global.HTMLElement;
        delete global.Node;
        delete global.navigator;
    });

    it('should initialize with default shape layer', function() {
        const lm = new LayerManager();
        assert.ok(lm.shapeLayers.length >= 1, 'Should have at least one shape layer');
        assert.strictEqual(lm.shapeLayers[0].id, 'shapes-default');
    });

    it('should create multiple DOM containers for shape layers', function() {
        const lm = new LayerManager();
        lm.addShapeLayer('Background');
        lm.addShapeLayer('Foreground');
        
        lm.refreshUI();
        
        const containers = document.querySelectorAll('.be-shape-layer-container');
        // 1 default + 2 added = 3
        assert.strictEqual(containers.length, 3);
    });

    it('should enforce 100 element limit by auto-creating layers', function() {
        const lm = new LayerManager();
        const initialLayerCount = lm.shapeLayers.length;
        
        // Mock adding 101 elements to the first layer's DOM container
        lm.refreshUI();
        const container = document.getElementById(lm.shapeLayers[0].layerId);
        for (let i = 0; i < 101; i++) {
            container.appendChild(document.createElement('div'));
            // Check limit
            const newLayer = lm.checkLayerLimit(lm.shapeLayers[0]);
            if (newLayer) break; // Should happen at 100
        }
        
        assert.strictEqual(lm.shapeLayers.length, initialLayerCount + 1, 'Should have auto-created a new layer');
    });
});