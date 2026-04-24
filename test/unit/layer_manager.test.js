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
                getLayoutRoot: () => ({ element: document.body }),
                getShapesContainer: () => ({ element: document.body })
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
        const allLayers = [lm.sectionsLayer, ...lm.shapeLayers];
        allLayers.forEach(layer => {
            assert.strictEqual(layer.isLocked, false, `Layer ${layer.id} should be unlocked by default`);
        });
    });

    it('should toggle body classes when toggleLayerLock is called', function() {
        const lm = new LayerManager();
        const shapesLayer = lm.shapeLayers.find(l => l.id === 'shapes-default');
        const sectionsLayer = lm.sectionsLayer;
        
        // We need to create the panel so refreshUI can find the buttons if we want to check them
        lm.createPanel();
        const row = lm.panel.querySelector('[data-layer-id="shapes-default"]');
        const lockBtn = row.querySelector('button[title="Toggle Edit Mode"]');

        // Lock Shapes
        lm.toggleLayerLock(shapesLayer, lockBtn);
        assert.ok(document.body.classList.contains('be-lock-shapes-default'), 'Body should have be-lock-shapes-default class');
        assert.strictEqual(shapesLayer.isLocked, true);
        assert.strictEqual(lockBtn.innerHTML, '🔒');

        // Unlock Shapes
        lm.toggleLayerLock(shapesLayer, lockBtn);
        assert.ok(!document.body.classList.contains('be-lock-shapes-default'), 'Body should NOT have be-lock-shapes-default class');
        assert.strictEqual(shapesLayer.isLocked, false);
        assert.strictEqual(lockBtn.innerHTML, '🔓');

        // Lock Sections
        const secRow = lm.panel.querySelector('[data-layer-id="sections"]');
        const secLockBtn = secRow.querySelector('button[title="Toggle Edit Mode"]');
        lm.toggleLayerLock(sectionsLayer, secLockBtn);
        assert.ok(document.body.classList.contains('be-lock-sections'), 'Body should have be-lock-sections class');
        assert.strictEqual(sectionsLayer.isLocked, true);
        assert.strictEqual(secLockBtn.innerHTML, '🔒');
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
