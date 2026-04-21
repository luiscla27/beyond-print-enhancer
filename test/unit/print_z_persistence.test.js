const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Print Z-Index Persistence', function() {
    let dom, window, document, Storage;

    beforeEach(async function() {
        dom = new JSDOM('<!DOCTYPE html><html><body><div id="print-enhance-sections-layer"></div><div id="print-enhance-shapes-layer"></div></body></html>');
        window = dom.window;
        document = window.document;
        global.document = document;
        global.window = window;
        global.HTMLElement = window.HTMLElement;
        global.NodeList = window.NodeList;
        global.Node = window.Node;
        global.navigator = window.navigator;

        // Mock setTimeout to run immediately
        window.setTimeout = (fn) => fn();

        // Mock Storage
        global.Storage = {
            SCHEMA_VERSION: '1.4.0',
            init: () => Promise.resolve(),
            loadLayout: () => Promise.resolve(null),
            loadGlobalLayout: () => Promise.resolve(null),
            saveLayout: () => Promise.resolve(),
            validateLayout: () => true,
            getAllSpells: () => Promise.resolve([])
        };

        // Mock DomManager
        window.DomManager = {
            getInstance: () => ({
                getLayoutRoot: () => ({ element: document.body }),
                getLayerManager: () => ({
                    refreshLayerContents: () => {},
                    layers: [{ id: 'shapes', layerId: 'print-enhance-shapes-layer' }, { id: 'sections', layerId: 'print-enhance-sections-layer' }]
                }),
                selectors: {
                    EXTRACTABLE: {
                        GROUP: '.group',
                        SNIPPET_CLASS: '.snippet',
                        ACTIONS_LIST: '.actions',
                        ATTACK_TABLE: '.attacks',
                        TRAITS: '.traits'
                    }
                }
            })
        };

        // Load main.js
        require('../../js/main.js');
    });

    afterEach(function() {
        delete global.document;
        delete global.window;
        delete global.HTMLElement;
        delete global.NodeList;
        delete global.Node;
        delete global.navigator;
        delete global.Storage;
        delete require.cache[require.resolve('../../js/main.js')];
    });

    it('should save and restore printZIndex in layout', async function() {
        // Create a mock section with printZIndex
        const sectionsLayer = document.getElementById('print-enhance-sections-layer');
        const wrapper = document.createElement('div');
        wrapper.className = 'be-section-wrapper';
        wrapper.style.zIndex = '10';
        wrapper.dataset.printZ = '5'; // The new attribute
        
        const container = document.createElement('div');
        container.className = 'print-section-container';
        container.id = 'test-section';
        wrapper.appendChild(container);
        sectionsLayer.appendChild(wrapper);

        // Scan layout
        const layout = await window.scanLayout();
        
        // Verify it was saved
        assert.strictEqual(layout.sections['test-section'].printZIndex, '5', 'printZIndex should be saved in layout');

        // Modify layout and apply it back
        layout.sections['test-section'].printZIndex = '8';
        await window.applyLayout(layout);

        // Verify it was restored
        const restoredWrapper = document.getElementById('test-section').closest('.be-section-wrapper');
        assert.strictEqual(restoredWrapper.dataset.printZ, '8', 'printZIndex should be restored to dataset');
    });
});
