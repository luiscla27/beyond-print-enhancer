const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Quick Switch Feature', function() {
    let window, document;

    before(async function() {
        const html = '<!DOCTYPE html><html><body><div id="print-layout-wrapper"></div></body></html>';
        const dom = new JSDOM(html, { url: 'https://www.dndbeyond.com/characters/1' });
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.chrome = { runtime: { getURL: (p) => p } };
        global.navigator = window.navigator;
        global.HTMLElement = window.HTMLElement;
        global.Node = window.Node;

        const elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
        const domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
        const dnd = fs.readFileSync(path.resolve(__dirname, '../../js/dnd.js'), 'utf8');
        const mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');

        window.eval(elementWrapper);
        window.eval(domManager);
        window.eval(dnd);
        window.eval(mainJs);
    });

    it('should switch shape asset while preserving transforms', function() {
        // 1. Create a shape with specific transforms
        const initialAsset = 'assets/shapes/corner_spikes.gif';
        const shapeWrapper = window.createShape(initialAsset, {
            left: '123px',
            top: '456px',
            width: '100px',
            height: '100px',
            rotation: '45'
        });

        const container = shapeWrapper.querySelector('.be-shape-container');
        assert.ok(container, 'Container should exist');
        
        // Verify initial state
        assert.strictEqual(shapeWrapper.style.left, '123px');
        assert.strictEqual(shapeWrapper.style.top, '456px');
        assert.strictEqual(container.style.width, '100px');
        assert.strictEqual(shapeWrapper.dataset.rotation, '45');

        // 2. Switch to a new asset
        const newAsset = 'assets/shapes/corner_dwarf.gif';
        window.applyShapeAsset(container, newAsset);
        
        // 3. Verify transforms are preserved
        // applyShapeAsset only touches the inner container styles and classes,
        // it shouldn't touch the wrapper's top/left/transform.
        assert.strictEqual(shapeWrapper.style.left, '123px', 'Left should be preserved');
        assert.strictEqual(shapeWrapper.style.top, '456px', 'Top should be preserved');
        assert.strictEqual(container.style.width, '100px', 'Width should be preserved');
        assert.strictEqual(shapeWrapper.dataset.rotation, '45', 'Rotation dataset should be preserved');
        
        // Check if the asset was actually updated (e.g. img src changed)
        const img = container.querySelector('img');
        assert.ok(img, 'Img should exist');
        assert.ok(img.src.includes(newAsset), 'Img src should be updated to new asset');
    });
});
