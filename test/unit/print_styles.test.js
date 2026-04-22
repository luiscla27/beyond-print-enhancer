const assert = require('assert');
const { JSDOM } = require('jsdom');
require("fake-indexeddb/auto");

describe('Print Styles Injection', function() {
    let dom, window, document;

    before(function() {
        // Set test mode globally to prevent main.js from auto-initializing
        global.window = { __DDB_TEST_MODE__: true };
    });

    after(function() {
        delete global.window;
    });

    beforeEach(function() {
        dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
        window = dom.window;
        window.__DDB_TEST_MODE__ = true;
        document = window.document;
        global.document = document;
        global.window = window;
        global.HTMLElement = window.HTMLElement;
        global.NodeList = window.NodeList;
        global.Node = window.Node;
        global.navigator = window.navigator;

        // Mock safeLog
        global.safeLog = () => {};

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
        delete global.safeLog;
        delete require.cache[require.resolve('../../js/main.js')];
    });

    it('should inject base print styles (hide manager and force opacity)', function() {
        window.updatePrintStyles();
        const style = document.getElementById('be-print-z-style');
        assert.ok(style, 'Style element should exist');
        
        const css = style.textContent;
        assert.ok(css.includes('@media print'), 'Should contain @media print');
        assert.ok(css.includes('#print-enhance-layer-manager { display: none !important; }'), 'Should hide layer manager on print');
        assert.ok(css.includes('.be-section-wrapper { opacity: 1 !important; }'), 'Should force full opacity on print');
    });

    it('should hide layers with data-print-disabled="true"', function() {
        const layer = document.createElement('div');
        layer.id = 'print-enhance-sections-layer';
        layer.dataset.printDisabled = 'true';
        document.body.appendChild(layer);

        window.updatePrintStyles();
        const style = document.getElementById('be-print-z-style');
        const css = style.textContent;
        
        assert.ok(css.includes('#print-enhance-sections-layer { display: none !important; }'), 'Should hide disabled layers on print');
    });

    it('should still include z-index styles', function() {
        const wrapper = document.createElement('div');
        wrapper.id = 'section-1';
        wrapper.className = 'be-section-wrapper';
        wrapper.dataset.printZ = '50';
        document.body.appendChild(wrapper);

        window.updatePrintStyles();
        const style = document.getElementById('be-print-z-style');
        const css = style.textContent;
        
        assert.ok(css.includes('#section-1 { z-index: 50 !important; }'), 'Should still include z-index overrides');
    });
});
