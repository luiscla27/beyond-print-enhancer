const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('LayerManager Edit Mode', function() {
    let dom, window, document, LayerManager;

    beforeEach(function() {
        dom = new JSDOM('<!DOCTYPE html><html><body><div id="print-enhance-shapes-layer"></div><div id="print-enhance-sections-layer"></div></body></html>');
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

        LayerManager = require('../../js/dom/layer_manager.js');
    });

    afterEach(function() {
        delete global.document;
        delete global.window;
        delete global.HTMLElement;
        delete global.NodeList;
        // Clear require cache for LayerManager to ensure a fresh instance
        delete require.cache[require.resolve('../../js/dom/layer_manager.js')];
    });

    it('should initialize layers with isLocked: false', function() {
        const lm = new LayerManager();
        lm.layers.forEach(layer => {
            assert.strictEqual(layer.isLocked, false, `Layer ${layer.id} should be unlocked by default`);
        });
    });

    it('should toggle body classes when toggleLayerLock is called', function() {
        const lm = new LayerManager();
        const shapesLayer = lm.layers.find(l => l.id === 'shapes');
        const sectionsLayer = lm.layers.find(l => l.id === 'sections');
        const btn = document.createElement('button');

        // Lock Shapes
        lm.toggleLayerLock(shapesLayer, btn);
        assert.ok(document.body.classList.contains('be-lock-shapes'), 'Body should have be-lock-shapes class');
        assert.strictEqual(shapesLayer.isLocked, true);
        assert.strictEqual(btn.innerHTML, '🔒');

        // Unlock Shapes
        lm.toggleLayerLock(shapesLayer, btn);
        assert.ok(!document.body.classList.contains('be-lock-shapes'), 'Body should NOT have be-lock-shapes class');
        assert.strictEqual(shapesLayer.isLocked, false);
        assert.strictEqual(btn.innerHTML, '🔓');

        // Lock Sections
        lm.toggleLayerLock(sectionsLayer, btn);
        assert.ok(document.body.classList.contains('be-lock-sections'), 'Body should have be-lock-sections class');
        assert.strictEqual(sectionsLayer.isLocked, true);
        assert.strictEqual(btn.innerHTML, '🔒');
    });

    it('should inject lock buttons in the panel', function() {
        const lm = new LayerManager();
        const panel = lm.createPanel();
        const lockButtons = panel.querySelectorAll('button[title="Toggle Edit Mode"]');
        assert.strictEqual(lockButtons.length, 2, 'Should have 2 lock buttons (one for each layer)');
        
        lockButtons.forEach(btn => {
            assert.strictEqual(btn.innerHTML, '🔓', 'Initial state should be unlocked icon');
        });
    });
});
