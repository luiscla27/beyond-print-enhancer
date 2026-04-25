const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Layer Edit Mode & Hover Highlights (Failing Tests)', function() {
    let window, document, LayerManager, lm;

    beforeEach(function() {
        const dom = new JSDOM('<!DOCTYPE html><html><body><div id="print-enhance-shapes-layer" class="pe-layer"></div><div id="print-enhance-sections-layer" class="pe-layer"></div></body></html>');
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.HTMLElement = window.HTMLElement;
        global.NodeList = window.NodeList;

        window.DomManager = {
            getInstance: () => ({
                getLayoutRoot: () => ({ element: document.body }),
                getShapesContainer: () => ({ element: document.body })
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

    it('should only allow one layer to be unlocked at a time', function() {
        const shapes = lm.shapeLayers[0];
        const sections = lm.sectionsLayer;

        // Initially all unlocked (default in constructor is false)
        assert.strictEqual(shapes.isLocked, false);
        assert.strictEqual(sections.isLocked, false);

        // Unlock shapes (already unlocked, but let's assume we want to enforce it)
        // If we call toggleLayerLock on sections when it's unlocked, it should lock.
        // The requirement is: "Modify the Edit mode so only one layer can be edited at once"
        
        // Let's start with both locked for clarity
        shapes.isLocked = true;
        sections.isLocked = true;
        lm.refreshUI();

        // Unlock Shapes
        lm.toggleLayerLock(shapes);
        assert.strictEqual(shapes.isLocked, false, 'Shapes should be unlocked');
        assert.strictEqual(sections.isLocked, true, 'Sections should remain locked');

        // Unlock Sections -> Should lock Shapes
        lm.toggleLayerLock(sections);
        assert.strictEqual(sections.isLocked, false, 'Sections should be unlocked');
        assert.strictEqual(shapes.isLocked, true, 'Shapes should be automatically locked');
    });

    it('should identify the active layer ID based on which one is unlocked', function() {
        const shapes = lm.shapeLayers[0];
        const sections = lm.sectionsLayer;
        
        shapes.isLocked = true;
        sections.isLocked = true;

        lm.toggleLayerLock(shapes);
        assert.strictEqual(lm.activeLayerId, shapes.id);

        lm.toggleLayerLock(sections);
        assert.strictEqual(lm.activeLayerId, sections.id);
        
        // Lock the active one -> activeLayerId should be null
        lm.toggleLayerLock(sections);
        assert.strictEqual(lm.activeLayerId, null);
    });
});
