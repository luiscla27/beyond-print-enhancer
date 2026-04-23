const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const vm = require('vm');

describe('Shape Layers Z-Index & Drag Management', function() {
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

    beforeEach(function() {
        document.body.innerHTML = '<div id="print-layout-wrapper"><div id="print-enhance-sections-layer"></div><div id="print-enhance-shapes-container"></div></div>';
    });

    it('should assign correct Z-index based on layer order', function() {
        const lm = new LayerManager();
        lm.addShapeLayer('Foreground'); // Total: sections (0), shapes-default (1), foreground (2)
        lm.refreshUI();
        const panel = lm.createPanel();
        
        const layer0 = lm.sectionsLayer; // Base 0
        const layer1 = lm.shapeLayers[0]; // Base 100
        const layer2 = lm.shapeLayers[1]; // Base 200

        // Add mock elements to DOM
        const s1 = document.createElement('div'); s1.id = 's1'; s1.className = 'be-section-wrapper';
        document.getElementById(layer0.layerId).appendChild(s1);
        
        const h1 = document.createElement('div'); h1.id = 'h1'; h1.className = 'be-shape-wrapper';
        document.getElementById(layer1.layerId).appendChild(h1);
        
        const f1 = document.createElement('div'); f1.id = 'f1'; f1.className = 'be-shape-wrapper';
        document.getElementById(layer2.layerId).appendChild(f1);

        // Add UI proxy elements (the cards/thumbs in the panel)
        const s1Card = document.createElement('div'); s1Card.className = 'be-layer-item-card'; s1Card.dataset.targetId = 's1';
        panel.querySelector(`[data-layer="${layer0.id}"]`).appendChild(s1Card);

        const h1Thumb = document.createElement('div'); h1Thumb.className = 'be-layer-item-thumb'; h1Thumb.dataset.targetId = 'h1';
        panel.querySelector(`[data-layer="${layer1.id}"]`).appendChild(h1Thumb);

        const f1Thumb = document.createElement('div'); f1Thumb.className = 'be-layer-item-thumb'; f1Thumb.dataset.targetId = 'f1';
        panel.querySelector(`[data-layer="${layer2.id}"]`).appendChild(f1Thumb);

        lm.updatePrintZIndexes();

        assert.strictEqual(s1.dataset.printZ, '10'); // 0*100 + 10 + 0
        assert.strictEqual(h1.dataset.printZ, '110'); // 1*100 + 10 + 0
        assert.strictEqual(f1.dataset.printZ, '210'); // 2*100 + 10 + 0
    });

    it('should update Z-index when element moves between layers', function() {
        const lm = new LayerManager();
        lm.addShapeLayer('Foreground');
        lm.refreshUI();
        const panel = lm.createPanel();
        
        const l1 = lm.shapeLayers[0];
        const l2 = lm.shapeLayers[1];

        const h1 = document.createElement('div'); h1.id = 'h1'; h1.className = 'be-shape-wrapper';
        document.getElementById(l1.layerId).appendChild(h1);

        // Add UI proxy to layer 1
        const thumb = document.createElement('div');
        thumb.className = 'be-layer-item-thumb';
        thumb.dataset.targetId = 'h1';
        panel.querySelector(`[data-layer="${l1.id}"]`).appendChild(thumb);

        lm.updatePrintZIndexes();
        assert.strictEqual(h1.dataset.printZ, '110');

        // Simulate drag to l2 list
        const l2List = panel.querySelector(`[data-layer="${l2.id}"]`);
        l2List.appendChild(thumb);

        lm.updatePrintZIndexes();
        
        // Should now be in layer 2 container
        assert.strictEqual(h1.parentNode.id, l2.layerId);
        assert.strictEqual(h1.dataset.printZ, '210');
    });
});