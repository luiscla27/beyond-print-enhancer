const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Layout Stabilization', () => {
    let window, document;

    beforeEach(() => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
            url: 'https://www.dndbeyond.com/characters/123',
            runScripts: "dangerously",
            resources: "usable"
        });
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.HTMLElement = window.HTMLElement;
        global.Node = window.Node;
        global.navigator = window.navigator;

        const mainJsCode = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
        const scriptEl = document.createElement('script');
        scriptEl.textContent = `
            window.__DDB_TEST_MODE__ = true;
            ${mainJsCode}
        `;
        document.body.appendChild(scriptEl);
    });

    it('should suppress window.onresize', () => {
        window.onresize = () => { window.__RESIZED = true; };
        window.suppressResizeEvents();
        assert.strictEqual(window.onresize, null, 'window.onresize should be nullified');
    });

    it('should intercept and block NEW resize event listeners', () => {
        window.suppressResizeEvents();

        let resizeTriggered = false;
        window.addEventListener('resize', () => {
            resizeTriggered = true;
        });

        window.dispatchEvent(new window.Event('resize'));
        assert.strictEqual(resizeTriggered, false, 'NEW resize event should have been blocked');
    });

    it('should block EXISTING resize event listeners added before suppression', () => {
        let existingTriggered = false;
        // Simulating React listener added before extension
        window.addEventListener('resize', () => {
            existingTriggered = true;
        });

        window.suppressResizeEvents();

        window.dispatchEvent(new window.Event('resize'));
        assert.strictEqual(existingTriggered, false, 'EXISTING resize event should have been blocked');
    });
});
