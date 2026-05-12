const fs = require('fs');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="print-layout-wrapper"><div id="print-enhance-shapes-layer" class="be-shape-layer-container"></div></div></body></html>', { url: 'https://www.dndbeyond.com/characters/123' });
const window = dom.window;
const document = window.document;
global.window = window;
global.document = document;
global.HTMLElement = window.HTMLElement;
global.NodeList = window.NodeList;
global.Node = window.Node;
global.navigator = window.navigator;

global.Storage = { SCHEMA_VERSION: '1.4.0', init: ()=>Promise.resolve(), loadLayout: ()=>Promise.resolve(null), loadGlobalLayout: ()=>Promise.resolve(null), validateLayout: ()=>true, getAllSpells: ()=>Promise.resolve([]) };

// Mock chrome before requiring main.js
global.chrome = { runtime: { getURL: (p) => p } };

require('./js/main.js');

const LayerManager = require('./js/dom/layer_manager.js');
window.PeDom = () => ({
    getLayerManager: () => {
        if (!global.lm) {
            global.lm = new LayerManager();
            global.lm.addShapeLayer('Foreground');
        }
        return global.lm;
    },
    getLayoutRoot: () => ({ element: document.getElementById('print-layout-wrapper') }),
    getShapesLayer: () => ({ element: document.getElementById('print-enhance-shapes-layer') }),
    getActiveShapesLayer: () => ({ element: document.getElementById('print-enhance-shapes-layer') })
});

const lm = window.PeDom().getLayerManager();
const layer = lm.shapeLayers[0]; // Shapes Default

// Create shield_stats using actual main.js function
window.createShape('assets/shapes/shield_stats.webp', { id: 'shape-123' });

// Create archer_main using actual main.js function
window.createShape('assets/shapes/archer_main.webp', { id: 'shape-456' });

lm.refreshLayerContents();
lm.updatePrintZIndexes();

const style = document.getElementById('be-print-z-style');
console.log('--- GENERATED CSS ---');
console.log(style ? style.textContent : 'NO STYLE TAG FOUND');

const wrapper1 = document.getElementById('shape-123-wrapper');
const wrapper2 = document.getElementById('shape-456-wrapper');
console.log('\n--- DOM DATA ---');
console.log('shield_stats z-index:', wrapper1.dataset.printZ);
console.log('archer_main z-index:', wrapper2.dataset.printZ);

// Now simulate a drag to swap them
console.log('\n--- SWAPPING ---');
const list = lm.contentLists[layer.id];
const items = Array.from(list.querySelectorAll('.be-layer-item-thumb'));
// Swap them in the DOM list
list.insertBefore(items[1], items[0]);

lm.updatePrintZIndexes();

console.log('shield_stats z-index:', wrapper1.dataset.printZ);
console.log('archer_main z-index:', wrapper2.dataset.printZ);
