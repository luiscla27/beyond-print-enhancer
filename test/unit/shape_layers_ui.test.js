const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const vm = require('vm');

describe('Shape Layers UI Management', function() {
    let window, document, LayerManager;

    before(function() {
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

    after(function() {
        delete global.window;
        delete global.document;
        delete global.HTMLElement;
        delete global.Node;
        delete global.navigator;
    });

    afterEach(function() {
        document.body.innerHTML = '';
    });

    beforeEach(function() {
        document.body.innerHTML = '<div id="print-layout-wrapper"><div id="print-enhance-sections-layer"></div><div id="print-enhance-shapes-container"></div></div>';
    });

    it('should render "Add Layer" button', function() {
        const lm = new LayerManager();
        const panel = lm.createPanel();
        const addBtn = panel.querySelector('#print-enhance-add-layer');
        assert.ok(addBtn, 'Add layer button should exist');
    });

    it('should add a new layer panel when "Add Layer" is clicked', function() {
        const lm = new LayerManager();
        let panel = lm.createPanel();
        
        // Ensure panel is in document for replaceChild to work
        if (!panel.parentNode) {
            document.body.appendChild(panel);
        }

        const initialGroups = panel.querySelectorAll('.be-layer-group').length;
        
        const addBtn = panel.querySelector('#print-enhance-add-layer');
        addBtn.click();
        
        // After click, rebuildPanel should have replaced the panel in the DOM
        panel = document.getElementById('print-enhance-layer-manager');
        const newGroups = panel.querySelectorAll('.be-layer-group').length;
        assert.strictEqual(newGroups, initialGroups + 1, 'Should have one more layer group');
    });

    it('should toggle visibility on the correct DOM container', function() {
        const lm = new LayerManager();
        const layer = lm.shapeLayers[0];
        lm.refreshUI();
        
        const layerEl = document.getElementById(layer.layerId);
        assert.strictEqual(layerEl.style.display, '', 'Layer should be visible initially');
        
        lm.toggleLayerVisibility(layer);
        assert.strictEqual(layerEl.style.display, 'none', 'Layer should be hidden after toggle');
    });
});