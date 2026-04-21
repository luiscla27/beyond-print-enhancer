const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Layer List Reorder Functionality', function() {
    let dom, window, document, LayerManager;
    let lmInstance;

    beforeEach(function() {
        dom = new JSDOM('<!DOCTYPE html><html><body><div id="print-enhance-sections-layer"></div></body></html>');
        window = dom.window;
        document = window.document;
        global.document = document;
        global.window = window;
        global.HTMLElement = window.HTMLElement;
        global.NodeList = window.NodeList;
        global.Node = window.Node;

        // Mock DomManager
        window.DomManager = {
            getInstance: () => ({
                getLayoutRoot: () => ({ element: document.body }),
                getLayerManager: () => lmInstance
            })
        };

        LayerManager = require('../../js/dom/layer_manager.js');
        lmInstance = new LayerManager();
    });

    afterEach(function() {
        delete global.document;
        delete global.window;
        delete global.HTMLElement;
        delete global.NodeList;
        delete global.Node;
        delete require.cache[require.resolve('../../js/dom/layer_manager.js')];
    });

    it('should update printZIndex based on list order after reorder', function() {
        const lm = lmInstance;
        const sectionsLayer = document.getElementById('print-enhance-sections-layer');

        // Create 3 mock sections
        const ids = ['sec-1', 'sec-2', 'sec-3'];
        ids.forEach((id, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'be-section-wrapper';
            wrapper.id = `${id}-wrapper`;
            const container = document.createElement('div');
            container.className = 'print-section-container';
            container.id = id;
            const header = document.createElement('div');
            header.className = 'print-section-header';
            header.innerHTML = `<span>Section ${id}</span>`;
            container.appendChild(header);
            wrapper.appendChild(container);
            sectionsLayer.appendChild(wrapper);
        });

        lm.createPanel();
        lm.refreshLayerContents();

        const cards = Array.from(document.querySelectorAll('.be-layer-item-card'));
        assert.strictEqual(cards.length, 3);

        // Simulate reorder: move first card to the end
        const sectionList = document.querySelector('.be-layer-content-list[data-layer="sections"]');
        const firstCard = cards[0];
        sectionList.appendChild(firstCard); // Move to end

        // Trigger the internal update logic (which we will implement)
        lm.updatePrintZIndexes();

        // Verify printZIndex
        // New order in DOM list: sec-2, sec-3, sec-1
        // Expected printZIndex: 
        // sec-2 -> 12
        // sec-3 -> 11
        // sec-1 -> 10
        const wrapper1 = document.getElementById('sec-1-wrapper');
        const wrapper2 = document.getElementById('sec-2-wrapper');
        const wrapper3 = document.getElementById('sec-3-wrapper');

        assert.strictEqual(wrapper2.dataset.printZ, '12', 'Top item (sec-2) should have highest printZIndex');
        assert.strictEqual(wrapper3.dataset.printZ, '11', 'Middle item (sec-3) should have middle printZIndex');
        assert.strictEqual(wrapper1.dataset.printZ, '10', 'Bottom item (sec-1) should have lowest printZIndex');
    });
});
