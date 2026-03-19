const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

describe('Rotation Persistence', function() {
    let window, document;

    before(async function() {
        const html = '<!DOCTYPE html><html><body><div id="print-layout-wrapper"></div><div class="ct-character-sheet"></div></body></html>';
        const dom = new JSDOM(html, { url: 'https://www.dndbeyond.com/characters/1' });
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.chrome = { runtime: { getURL: (p) => p } };
        global.navigator = window.navigator;
        global.HTMLElement = window.HTMLElement;
        global.Node = window.Node;
        global.CustomEvent = window.CustomEvent;
        const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
        window.indexedDB = indexedDB;
        window.IDBKeyRange = IDBKeyRange;
        global.indexedDB = indexedDB;
        global.IDBKeyRange = IDBKeyRange;

        const elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
        const domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
        const mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');

        // We need to make sure they are in the same scope
        const combined = elementWrapper + '\n' + domManager + '\n' + mainJs;
        window.eval(combined);
    });

    it('should include rotation in scanned layout', async function() {
        // Ensure layoutRoot exists
        const layoutRoot = document.getElementById('print-layout-wrapper');
        
        const shapeWrapper = window.createShape('assets/shapes/corner_spikes.webp');
        shapeWrapper.dataset.rotation = '45';
        
        const layout = await window.scanLayout();
        const container = shapeWrapper.querySelector('.be-shape-container');
        const shapeData = layout.shapes.find(s => s.id === container.id);
        
        assert.ok(shapeData, 'Shape should be in layout');
        assert.strictEqual(shapeData.rotation, '45', 'Layout should include rotation');
    });

    it('should restore rotation from layout data', async function() {
        const layout = {
            version: 1,
            sections: {},
            clones: [],
            extractions: [],
            shapes: [
                {
                    id: 'restored-shape-id',
                    assetPath: 'assets/shapes/corner_spikes.webp',
                    left: '100px',
                    top: '100px',
                    width: '50px',
                    height: '50px',
                    rotation: '90'
                }
            ],
            spell_details: [],
            merges: []
        };

        await window.applyLayout(layout);
        
        const shapeContainer = document.getElementById('restored-shape-id');
        assert.ok(shapeContainer, 'Shape should be restored');
        const wrapper = shapeContainer.closest('.be-shape-wrapper');
        assert.strictEqual(wrapper.dataset.rotation, '90', 'Restored wrapper should have rotation dataset');
        assert.ok(shapeContainer.style.transform.includes('rotate(90deg)'), 'Restored container should have rotation transform');
    });
});
