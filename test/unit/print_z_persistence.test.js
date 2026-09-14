const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Print Z-Index Persistence', function() {
    let dom, window, document;

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

        // Mock DomManager
        window.DomManager = {
            getInstance: () => ({
                getLayoutRoot: () => ({ element: document.body }),
                getShapesContainer: () => ({ element: document.body }),
                getLayerManager: () => ({
                    refreshLayerContents: () => {},
                    refreshUI: () => {},
                    addShapeLayer: (name, data) => ({ id: data.id || 'shapes', ...data }),
                    getLayerById: (id) => (id === 'sections' ? { id: 'sections' } : { id: 'shapes' }),
                    shapeLayers: [{ id: 'shapes', layerId: 'print-enhance-shapes-layer' }],
                    sectionsLayer: { id: 'sections', layerId: 'print-enhance-sections-layer' }
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
        require('../../js/print_styles.js');
        require('../../js/section_utils.js');
        require('../../js/image_processor.js');
        require('../../js/storage.js');
        require('../../js/asset_catalog.js');
        require('../../js/context_menu.js');
        require('../../js/section_cloning.js');
        require('../../js/layout_ops.js');
        require('../../js/filters.js');
        require('../../js/spells_ui.js');
        require('../../js/modals.js');
        require('../../js/shape_picker.js');
        require('../../js/properties_panel.js');
        require('../../js/controls.js');
        require('../../js/layout_scan.js');
        require('../../js/layout_apply.js');
        require('../../js/persistence.js');
        require('../../js/main.js');
    });

    afterEach(function() {
        delete global.document;
        delete global.window;
        delete global.HTMLElement;
        delete global.NodeList;
        delete global.Node;
        delete global.navigator;
        delete require.cache[require.resolve('../../js/print_styles.js')];
        delete require.cache[require.resolve('../../js/section_utils.js')];
        delete require.cache[require.resolve('../../js/image_processor.js')];
        delete require.cache[require.resolve('../../js/asset_catalog.js')];
        delete require.cache[require.resolve('../../js/storage.js')];
        delete require.cache[require.resolve('../../js/context_menu.js')];
        delete require.cache[require.resolve('../../js/section_cloning.js')];
        delete require.cache[require.resolve('../../js/layout_ops.js')];
        delete require.cache[require.resolve('../../js/filters.js')];
        delete require.cache[require.resolve('../../js/spells_ui.js')];
        delete require.cache[require.resolve('../../js/modals.js')];
        delete require.cache[require.resolve('../../js/shape_picker.js')];
        delete require.cache[require.resolve('../../js/properties_panel.js')];
        delete require.cache[require.resolve('../../js/controls.js')];
        delete require.cache[require.resolve('../../js/layout_scan.js')];
        delete require.cache[require.resolve('../../js/layout_apply.js')];
        delete require.cache[require.resolve('../../js/persistence.js')];
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
