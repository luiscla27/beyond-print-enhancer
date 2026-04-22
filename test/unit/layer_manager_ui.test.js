const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('LayerManager UI Enhancements', function() {
    let dom, window, document, LayerManager;

    beforeEach(function() {
        dom = new JSDOM('<!DOCTYPE html><html><body>' +
            '<div id="print-enhance-shapes-layer"></div>' +
            '<div id="print-enhance-sections-layer"></div>' +
            '</body></html>');
        window = dom.window;
        document = window.document;
        global.document = document;
        global.window = window;
        global.HTMLElement = window.HTMLElement;
        global.NodeList = window.NodeList;

        // Mock DomManager
        window.DomManager = {
            getInstance: () => ({
                getLayoutRoot: () => ({ element: document.body })
            })
        };

        // Mock updatePrintStyles
        window.updatePrintStyles = () => {};

        LayerManager = require('../../js/dom/layer_manager.js');
    });

    afterEach(function() {
        delete global.document;
        delete global.window;
        delete global.HTMLElement;
        delete global.NodeList;
        delete global.safeLog;
        delete require.cache[require.resolve('../../js/dom/layer_manager.js')];
    });

    it('should initialize layers with isDisabledOnPrint: false', function() {
        const lm = new LayerManager();
        lm.layers.forEach(layer => {
            assert.strictEqual(layer.isDisabledOnPrint, false, `Layer ${layer.id} should be enabled on print by default`);
        });
    });

    it('should toggle isDisabledOnPrint and update dataset when toggleLayerPrint is called', function() {
        const lm = new LayerManager();
        const shapesLayer = lm.layers.find(l => l.id === 'shapes');
        const btn = document.createElement('button');
        const layerEl = document.getElementById('print-enhance-shapes-layer');

        // Initial state
        assert.strictEqual(shapesLayer.isDisabledOnPrint, false);
        assert.strictEqual(layerEl.dataset.printDisabled, undefined);

        // Disable on print
        lm.toggleLayerPrint(shapesLayer, btn);
        assert.strictEqual(shapesLayer.isDisabledOnPrint, true, 'Layer should be disabled on print');
        assert.strictEqual(layerEl.dataset.printDisabled, 'true', 'Dataset should be updated');
        assert.strictEqual(btn.innerHTML, '🖨️❌', 'Button icon should show disabled printer');

        // Re-enable on print
        lm.toggleLayerPrint(shapesLayer, btn);
        assert.strictEqual(shapesLayer.isDisabledOnPrint, false, 'Layer should be enabled on print');
        assert.strictEqual(layerEl.dataset.printDisabled, 'false', 'Dataset should be updated');
        assert.strictEqual(btn.innerHTML, '🖨️', 'Button icon should show enabled printer');
    });

    it('should inject printer toggle buttons in the panel', function() {
        const lm = new LayerManager();
        const panel = lm.createPanel();
        const printButtons = panel.querySelectorAll('button[title="Toggle Print Visibility"]');
        assert.strictEqual(printButtons.length, 2, 'Should have 2 printer toggle buttons');
        
        printButtons.forEach(btn => {
            assert.strictEqual(btn.innerHTML, '🖨️', 'Initial state should be enabled printer icon');
        });
    });

    it('should refresh UI based on current state', function() {
        const lm = new LayerManager();
        const shapesLayer = lm.layers.find(l => l.id === 'shapes');
        shapesLayer.isDisabledOnPrint = true;
        shapesLayer.isHidden = true;
        shapesLayer.isLocked = true;

        const panel = lm.createPanel();
        lm.refreshUI();

        const row = panel.querySelector(`[data-layer-id="shapes"]`);
        const printBtn = row.querySelector('button[title="Toggle Print Visibility"]');
        const viewBtn = row.querySelector('button[title="Toggle Layer Visibility"]');
        const lockBtn = row.querySelector('button[title="Toggle Edit Mode"]');

        assert.strictEqual(printBtn.innerHTML, '🖨️❌', 'Print button should reflect disabled state');
        assert.strictEqual(viewBtn.innerHTML, '🙈', 'View button should reflect hidden state');
        assert.strictEqual(lockBtn.innerHTML, '🔒', 'Lock button should reflect locked state');
    });
});
