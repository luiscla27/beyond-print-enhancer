const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Rotation UI Injection', function() {
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

        // Load dependencies
        const elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
        const domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
        const mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');

        // Execute scripts in JSDOM context
        window.eval(elementWrapper);
        window.eval(domManager);
        window.eval(mainJs);
    });

    it('should inject a rotation handle when a shape is clicked in Shapes Mode', function() {
        // Enable Shapes Mode
        if (window.toggleShapesMode) {
            window.toggleShapesMode(true);
        } else {
            document.body.classList.add('be-shapes-mode-active');
        }

        // Create a shape
        const shapeWrapper = window.createShape('assets/shapes/corner_spikes.gif');
        assert.ok(shapeWrapper, 'Shape should be created');

        // Initially no handle
        let handle = shapeWrapper.querySelector('.be-rotation-handle');
        assert.strictEqual(handle, null, 'Handle should not exist initially');

        // Click the shape to select it
        const clickEvent = new window.MouseEvent('click', { bubbles: true });
        shapeWrapper.dispatchEvent(clickEvent);

        // Handle should now exist
        handle = shapeWrapper.querySelector('.be-rotation-handle');
        assert.ok(handle, 'Rotation handle should be injected after click in Shapes Mode');
    });

    it('should NOT inject a rotation handle when NOT in Shapes Mode', function() {
        // Disable Shapes Mode
        if (window.toggleShapesMode) {
            window.toggleShapesMode(false);
        } else {
            document.body.classList.remove('be-shapes-mode-active');
        }

        // Create another shape
        const shapeWrapper = window.createShape('assets/border_default.gif');
        
        // Click it
        const clickEvent = new window.MouseEvent('click', { bubbles: true });
        shapeWrapper.dispatchEvent(clickEvent);

        // Handle should NOT exist
        const handle = shapeWrapper.querySelector('.be-rotation-handle');
        assert.strictEqual(handle, null, 'Rotation handle should NOT be injected when Shapes Mode is OFF');
    });
});
