const fs = require('fs');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="print-layout-wrapper"><div id="print-enhance-shapes-container"></div></div></body></html>');
const window = dom.window;
const document = window.document;
global.window = window;
global.document = document;
global.HTMLElement = window.HTMLElement;
global.NodeList = window.NodeList;
global.Node = window.Node;

global.Storage = { SCHEMA_VERSION: '1.4.0', init: ()=>Promise.resolve(), loadLayout: ()=>Promise.resolve(null), loadGlobalLayout: ()=>Promise.resolve(null), validateLayout: ()=>true, getAllSpells: ()=>Promise.resolve([]) };

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
    getShapesLayer: () => ({ element: document.getElementById('print-enhance-shapes-container') })
});

const lm = window.PeDom().getLayerManager();
const layer = lm.shapeLayers[0]; // Shapes Default

// Add shield_stats
const wrapper = document.createElement('div');
wrapper.id = 'shape-123-wrapper';
wrapper.className = 'be-section-wrapper be-shape-wrapper';
const container = document.createElement('div');
container.id = 'shape-123';
container.className = 'print-section-container';
container.dataset.assetPath = 'assets/shapes/shield_stats.webp';
wrapper.appendChild(container);
document.getElementById(layer.layerId).appendChild(wrapper);

// Add archer_main
const wrapper2 = document.createElement('div');
wrapper2.id = 'shape-456-wrapper';
wrapper2.className = 'be-section-wrapper be-shape-wrapper';
const container2 = document.createElement('div');
container2.id = 'shape-456';
container2.className = 'print-section-container';
container2.dataset.assetPath = 'assets/shapes/archer_main.webp';
wrapper2.appendChild(container2);
document.getElementById(layer.layerId).appendChild(wrapper2);

lm.refreshLayerContents();
lm.updatePrintZIndexes();

const style = document.getElementById('be-print-z-style');
console.log("GENERATED CSS:");
console.log(style.textContent);

console.log("\nDOM DATA:");
console.log("shield_stats z-index:", wrapper.dataset.printZ);
console.log("archer_main z-index:", wrapper2.dataset.printZ);
