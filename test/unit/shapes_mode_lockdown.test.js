const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

describe('Shapes Mode Lockdown', function() {
    let window, document;

    before(async function() {
        const html = '<!DOCTYPE html><html><body class="some-page"><div id="print-layout-wrapper"></div></body></html>';
        const dom = new JSDOM(html, { url: 'https://www.dndbeyond.com/characters/1' });
        window = dom.window;
    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
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

        if (window.enforceFullHeight) {
            window.enforceFullHeight();
        }
    });

    it('should have shapes mode OFF by default', function() {
        assert.ok(!document.body.classList.contains('be-shapes-mode-active'));
    });

    it('should verify that shapes are locked when Shapes Mode is OFF', function() {
        const styleTag = document.getElementById('ddb-print-enhance-style');
        assert.ok(styleTag, 'Style tag should exist');
        const css = styleTag.textContent;
        
        // We expect rules that lock shapes by default or via class
        assert.ok(css.includes('body.be-lock-shapes #print-enhance-shapes-layer'), 'CSS should have shape lock rules');
    });

    it('should verify that sections remain interactive even when Shapes Mode is OFF', function() {
        const styleTag = document.getElementById('ddb-print-enhance-style');
        const css = styleTag.textContent;
        
        // Sections should be interactive by default (pointer-events: auto on wrapper)
        assert.ok(css.includes('.be-section-wrapper'), 'CSS should have wrapper rules');
        assert.ok(css.includes('pointer-events: auto !important; /* Interactive by default */'), 'Should be interactive by default');
    });
});
