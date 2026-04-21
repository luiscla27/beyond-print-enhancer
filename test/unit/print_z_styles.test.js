const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Print Z-Index Style Injection', function() {
    let dom, window, document;

    beforeEach(async function() {
        dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
        window = dom.window;
        document = window.document;
        global.document = document;
        global.window = window;
        global.HTMLElement = window.HTMLElement;
        global.NodeList = window.NodeList;
        global.Node = window.Node;

        // Mock Storage so main.js doesn't crash
        global.Storage = {
            SCHEMA_VERSION: '1.4.0',
            init: () => Promise.resolve(),
            loadLayout: () => Promise.resolve(null),
            loadGlobalLayout: () => Promise.resolve(null),
            validateLayout: () => true,
            getAllSpells: () => Promise.resolve([])
        };

        require('../../js/main.js');
    });

    afterEach(function() {
        delete global.document;
        delete global.window;
        delete global.HTMLElement;
        delete global.NodeList;
        delete global.Node;
        delete global.Storage;
        delete require.cache[require.resolve('../../js/main.js')];
    });

    it('should generate @media print CSS based on data-print-z attributes', function() {
        // Create some elements with data-print-z
        const el1 = document.createElement('div');
        el1.className = 'be-section-wrapper';
        el1.dataset.printZ = '15';
        document.body.appendChild(el1);

        const el2 = document.createElement('div');
        el2.className = 'be-section-wrapper';
        el2.dataset.printZ = '12';
        document.body.appendChild(el2);

        // Trigger style update (will fail as it is not implemented)
        if (typeof window.updatePrintStyles !== 'function') {
            assert.fail('window.updatePrintStyles is not defined');
        }
        window.updatePrintStyles();

        // Check for the style tag
        const style = document.getElementById('be-print-z-style');
        assert.ok(style, 'Should have a style tag with ID be-print-z-style');
        
        const css = style.textContent;
        assert.ok(css.includes('@media print'), 'Should contain @media print');
        assert.ok(css.includes('.be-section-wrapper[data-print-z="15"]'), 'Should have rule for Z 15');
        assert.ok(css.includes('z-index: 15 !important;'), 'Should have z-index value 15');
    });
});
