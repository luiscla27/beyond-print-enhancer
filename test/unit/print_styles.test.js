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
        assert.ok(css.includes('.be-section-wrapper'), 'Should target be-section-wrapper on print');
        assert.ok(css.includes('opacity: 1 !important'), 'Should force full opacity on print');
    });

    it('should hide selection and hover highlights on print', function() {
        window.updatePrintStyles();
        const style = document.getElementById('be-print-z-style');
        const css = style.textContent;
        
        assert.ok(css.includes('.be-active-wrapper'), 'Should target be-active-wrapper');
        assert.ok(css.includes('.be-hover-highlight'), 'Should target be-hover-highlight');
        assert.ok(css.includes('filter: none !important'), 'Should disable filters on print');
        assert.ok(css.includes('outline: none !important'), 'Should disable outlines on print');
    });

    it('should force full opacity even for locked layers on print', function() {
        window.updatePrintStyles();
        const style = document.getElementById('be-print-z-style');
        const css = style.textContent;
        
        // We check for the be-layer-locked specificity override
        assert.ok(css.includes('.be-layer-locked .be-section-wrapper'), 'Should target locked sections');
        assert.ok(css.includes('.be-layer-locked .be-shape-wrapper'), 'Should target locked shapes');
        
        // Specifically check that the rule contains opacity: 1
        const opacityMatch = css.match(/\.be-layer-locked \.be-section-wrapper[^}]*opacity:\s*1/);
        assert.ok(opacityMatch, 'Should force opacity: 1 for locked sections');
    });

    it('should target all elements with data-print-z and set layer ordering', function() {
        // Setup a mock shape and section with data-print-z
        const section = document.createElement('div');
        section.id = 'test-section';
        section.dataset.printZ = '50';
        document.body.appendChild(section);

        const shape = document.createElement('div');
        shape.id = 'test-shape';
        shape.dataset.printZ = '150';
        document.body.appendChild(shape);

        window.updatePrintStyles();
        const style = document.getElementById('be-print-z-style');
        const css = style.textContent;

        assert.ok(css.includes('#test-section { z-index: 50 !important; }'), 'Should target section by ID');
        assert.ok(css.includes('#test-shape { z-index: 150 !important; }'), 'Should target shape by ID');
        assert.ok(css.includes('#print-enhance-sections-layer { z-index: 1000 !important; }'), 'Should set section layer Z');
        assert.ok(css.includes('.be-shape-layer-container { z-index: 2000 !important; }'), 'Should set shape layer Z');
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
