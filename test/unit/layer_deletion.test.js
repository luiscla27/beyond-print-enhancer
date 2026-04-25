const assert = require('assert');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

describe('Layer Deletion & Shape Context Menu (Failing Tests)', function() {
    let window, document, LayerManager, lm;

    beforeEach(function() {
        const dom = new JSDOM('<!DOCTYPE html><html><body><div id="print-enhance-shapes-container"></div><div id="print-enhance-sections-layer"></div></body></html>');
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.HTMLElement = window.HTMLElement;
        global.NodeList = window.NodeList;

        window.DomManager = {
            getInstance: () => ({
                getLayoutRoot: () => ({ element: document.body }),
                getShapesContainer: () => ({ element: document.getElementById('print-enhance-shapes-container') })
            })
        };
        window.updatePrintStyles = () => {};

        LayerManager = require('../../js/dom/layer_manager.js');
        lm = new LayerManager();
    });

    afterEach(function() {
        delete global.window;
        delete global.document;
        delete global.HTMLElement;
        delete global.NodeList;
        delete require.cache[require.resolve('../../js/dom/layer_manager.js')];
    });

    it('should have a deleteShapeLayer method that removes the layer from state and DOM', function() {
        const layer = lm.addShapeLayer('To Delete');
        lm.refreshUI();
        const layerId = layer.id;
        const domId = layer.layerId;

        assert.ok(document.getElementById(domId), 'Layer DOM container should exist');
        assert.ok(lm.shapeLayers.find(l => l.id === layerId), 'Layer should be in state');

        lm.deleteShapeLayer(layerId);

        assert.strictEqual(document.getElementById(domId), null, 'Layer DOM container should be removed');
        assert.strictEqual(lm.shapeLayers.find(l => l.id === layerId), undefined, 'Layer should be removed from state');
    });

    it('should remove all shapes contained in the layer when the layer is deleted', function() {
        const layer = lm.addShapeLayer('Layer with Shapes');
        lm.refreshUI();
        
        // Mock a shape inside the layer
        const shape = document.createElement('div');
        shape.id = 'shape-1';
        shape.className = 'be-shape-wrapper';
        document.getElementById(layer.layerId).appendChild(shape);

        assert.ok(document.getElementById('shape-1'), 'Shape should exist');

        lm.deleteShapeLayer(layer.id);

        assert.strictEqual(document.getElementById('shape-1'), null, 'Shape should be removed with the layer');
    });

    it('should render a delete button on each shape layer row', function() {
        lm.createPanel();
        const deleteBtns = lm.panel.querySelectorAll('button[title="Delete Layer"]');
        // 1 for the default shape layer. Sections layer should NOT have a delete button.
        assert.strictEqual(deleteBtns.length, 1, 'Should have 1 delete button for the default shape layer');
    });

    it('should support deleting a single shape (context menu logic mock)', function() {
        // This tests the underlying deletion logic that the context menu will call
        const layer = lm.shapeLayers[0];
        lm.refreshUI();
        
        const shape = document.createElement('div');
        shape.id = 'shape-to-delete';
        shape.className = 'be-shape-wrapper';
        document.getElementById(layer.layerId).appendChild(shape);

        assert.ok(document.getElementById('shape-to-delete'));

        lm.deleteShape('shape-to-delete');

        assert.strictEqual(document.getElementById('shape-to-delete'), null, 'Shape should be removed');
    });
});
