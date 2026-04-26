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

    it('should initialize with sections unlocked and shapes locked', function() {
        const lm = new LayerManager();
        assert.strictEqual(lm.sectionsLayer.isLocked, false, 'Sections should be unlocked by default');
        assert.strictEqual(lm.shapeLayers[0].isLocked, true, 'Shapes should be locked by default');
    });

    it('should toggle body classes when toggleLayerLock is called', function() {
        const lm = new LayerManager();
        const shapesLayer = lm.shapeLayers.find(l => l.id === 'shapes-default');
        const sectionsLayer = lm.sectionsLayer;
        
        // We need to create the panel so refreshUI can find the buttons if we want to check them
        lm.createPanel();
        const row = lm.panel.querySelector('[data-layer-id="shapes-default"]');
        const lockBtn = row.querySelector('button[title="Toggle Edit Mode"]');

        // Initially: sections unlocked, shapes locked
        assert.ok(document.body.classList.contains('be-lock-shapes-default'), 'Body should have be-lock-shapes-default class initially');
        assert.ok(!document.body.classList.contains('be-lock-sections'), 'Body should NOT have be-lock-sections class initially');

        // Unlock Shapes -> This should automatically LOCK Sections
        lm.toggleLayerLock(shapesLayer, lockBtn);
        assert.ok(!document.body.classList.contains('be-lock-shapes-default'), 'Body should NOT have be-lock-shapes-default class');
        assert.strictEqual(shapesLayer.isLocked, false);
        assert.strictEqual(lockBtn.innerHTML, '🔓');
        
        // Verify Sections was automatically locked
        assert.strictEqual(sectionsLayer.isLocked, true, 'Sections should be automatically locked when shapes are unlocked');
        assert.ok(document.body.classList.contains('be-lock-sections'), 'Body should have be-lock-sections class');

        // Now toggle Sections (which is currently locked) -> This should UNLOCK it and LOCK shapes
        const secRow = lm.panel.querySelector('[data-layer-id="sections"]');
        const secLockBtn = secRow.querySelector('button[title="Toggle Edit Mode"]');
        lm.toggleLayerLock(sectionsLayer, secLockBtn);
        
        assert.strictEqual(sectionsLayer.isLocked, false, 'Sections should now be unlocked');
        assert.ok(!document.body.classList.contains('be-lock-sections'), 'Body should NOT have be-lock-sections class');
        assert.strictEqual(shapesLayer.isLocked, true, 'Shapes should be automatically locked when sections are unlocked');
    });

    it('should inject lock buttons in the panel with correct initial states', function() {
        const lm = new LayerManager();
        const panel = lm.createPanel();
        
        const secRow = panel.querySelector('[data-layer-id="sections"]');
        const secLockBtn = secRow.querySelector('button[title="Toggle Edit Mode"]');
        assert.strictEqual(secLockBtn.innerHTML, '🔓', 'Sections should have unlocked icon initially');

        const shapeRow = panel.querySelector('[data-layer-id="shapes-default"]');
        const shapeLockBtn = shapeRow.querySelector('button[title="Toggle Edit Mode"]');
        assert.strictEqual(shapeLockBtn.innerHTML, '🔒', 'Shapes should have locked icon initially');
    });
});
