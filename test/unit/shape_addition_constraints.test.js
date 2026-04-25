const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Phase 4: Shape Addition Constraints (Tests)', function() {
    let window, document, LayerManager, lm;

    beforeEach(function() {
        const dom = new JSDOM('<!DOCTYPE html><html><body><div id="print-enhance-controls"></div><div id="print-enhance-shapes-container"></div></body></html>');
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.HTMLElement = window.HTMLElement;
        global.NodeList = window.NodeList;

        // Mock PeDom and other global objects
        window.DomManager = {
            getInstance: () => ({
                getLayoutRoot: () => ({ element: document.body }),
                getShapesContainer: () => ({ element: document.getElementById('print-enhance-shapes-container') }),
                getLayerManager: () => lm,
                getShapesLayer: () => ({ element: document.getElementById('print-enhance-shapes-layer') })
            })
        };
        window.PeDom = () => window.DomManager.getInstance();
        window.updatePrintStyles = () => {};
        window.showFeedback = () => {};
        
        // Mock control button
        const controls = document.getElementById('print-enhance-controls');
        const addShapeBtn = document.createElement('button');
        addShapeBtn.id = 'be-btn-add-shape';
        addShapeBtn.textContent = 'Add Shape';
        controls.appendChild(addShapeBtn);

        LayerManager = require('../../js/dom/layer_manager.js');
        lm = new LayerManager();
        
        // Mock global updateControlsState
        window.updateControlsState = () => {
            const btn = document.getElementById('be-btn-add-shape');
            if (btn) {
                const hasActiveLayer = lm.activeLayerId !== null;
                btn.disabled = !hasActiveLayer;
                btn.style.opacity = !hasActiveLayer ? '0.5' : '1';
            }
        };
    });

    afterEach(function() {
        delete global.window;
        delete global.document;
        delete global.HTMLElement;
        delete global.NodeList;
        delete require.cache[require.resolve('../../js/dom/layer_manager.js')];
    });

    it('should have the "Add Shape" button disabled if no layer is active', function() {
        // Start with all locked
        lm.shapeLayers.forEach(l => l.isLocked = true);
        lm.sectionsLayer.isLocked = true;
        lm.activeLayerId = null;
        window.updateControlsState();
        
        assert.strictEqual(document.getElementById('be-btn-add-shape').disabled, true, 'Should be disabled when no layer is active');

        // Unlock one
        lm.toggleLayerLock(lm.shapeLayers[0]);
        assert.strictEqual(lm.activeLayerId, lm.shapeLayers[0].id);
        assert.strictEqual(document.getElementById('be-btn-add-shape').disabled, false, 'Should be enabled when a layer is active');

        // Lock it back
        lm.toggleLayerLock(lm.shapeLayers[0]);
        assert.strictEqual(lm.activeLayerId, null);
        assert.strictEqual(document.getElementById('be-btn-add-shape').disabled, true, 'Should be disabled again');
    });

    it('should correctly target the active layer container in getActiveLayerContainer', function() {
        const layer1 = lm.shapeLayers[0];
        const layer2 = lm.addShapeLayer('Second Layer');
        
        // Mock DOM elements for layers
        const div1 = document.createElement('div');
        div1.id = layer1.layerId;
        document.body.appendChild(div1);
        
        const div2 = document.createElement('div');
        div2.id = layer2.layerId;
        document.body.appendChild(div2);

        lm.activeLayerId = layer2.id;
        assert.strictEqual(lm.getActiveLayerContainer().id, layer2.layerId);
        
        lm.activeLayerId = layer1.id;
        assert.strictEqual(lm.getActiveLayerContainer().id, layer1.layerId);
        
        lm.activeLayerId = null;
        // Default fallback to first shape layer if nothing active
        assert.strictEqual(lm.getActiveLayerContainer().id, layer1.layerId);
    });
});
