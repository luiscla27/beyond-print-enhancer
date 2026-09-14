const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

describe('Quick Info Box Extraction', () => {
    let window, document;

    before(() => {
        const dom = new JSDOM(`<!DOCTYPE html>
        <html>
            <body>
                <div id="print-layout-wrapper"></div>
                <div class="ct-quick-info">
                    <div class="ct-quick-info__box ct-quick-info__box--ac">
                        <div class="ct-quick-info__box-label">AC</div>
                        <div class="ct-quick-info__box-value">15</div>
                    </div>
                    <div class="ct-quick-info__box ct-quick-info__box--initiative">
                        <div class="ct-quick-info__box-label">Initiative</div>
                        <div class="ct-quick-info__box-value">+2</div>
                    </div>
                </div>
            </body>
        </html>`, {
            url: 'https://www.dndbeyond.com/characters/123',
            runScripts: "dangerously",
            resources: "usable"
        });
        window = dom.window;
    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
        document = window.document;
        
        // Mock chrome
        window.chrome = {
            runtime: {
                getURL: (path) => `chrome-extension://mock/${path}`
            },
            storage: {
                local: { get: () => {}, set: () => {} }
            }
        };

        window.__DDB_TEST_MODE__ = true;

        const wrapperCode = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
        const managerCode = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
        const mainCode = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
        const sectionUtils = fs.readFileSync(path.resolve(__dirname, '../../js/section_utils.js'), 'utf8');
        const printStyles = fs.readFileSync(path.resolve(__dirname, '../../js/print_styles.js'), 'utf8');
        const layoutOps = fs.readFileSync(path.resolve(__dirname, '../../js/layout_ops.js'), 'utf8');
        const filters = fs.readFileSync(path.resolve(__dirname, '../../js/filters.js'), 'utf8');
        const spellsUi = fs.readFileSync(path.resolve(__dirname, '../../js/spells_ui.js'), 'utf8');
        const modals = fs.readFileSync(path.resolve(__dirname, '../../js/modals.js'), 'utf8');
        const shapePicker = fs.readFileSync(path.resolve(__dirname, '../../js/shape_picker.js'), 'utf8');
        const propertiesPanel = fs.readFileSync(path.resolve(__dirname, '../../js/properties_panel.js'), 'utf8');
        const controls = fs.readFileSync(path.resolve(__dirname, '../../js/controls.js'), 'utf8');
        const layoutScan = fs.readFileSync(path.resolve(__dirname, '../../js/layout_scan.js'), 'utf8');
        const layoutApply = fs.readFileSync(path.resolve(__dirname, '../../js/layout_apply.js'), 'utf8');
        const persistence = fs.readFileSync(path.resolve(__dirname, '../../js/persistence.js'), 'utf8');
        const sectionCloning = fs.readFileSync(path.resolve(__dirname, '../../js/section_cloning.js'), 'utf8');

        const script = document.createElement('script');
        script.textContent = `
            ${wrapperCode}
            ${managerCode}
            ${printStyles}
            ${modals}
            ${propertiesPanel}
            ${layoutScan}
            ${layoutApply}
            ${persistence}
            ${controls}
            ${shapePicker}
            ${spellsUi}
            ${filters}
            ${layoutOps}
            ${sectionCloning}
            ${sectionUtils}
            ${mainCode}
        `;
        document.body.appendChild(script);
        
    });

    it('should separate quick-info boxes into individual sections', () => {
        if (typeof window.separateQuickInfoBoxes !== 'function') {
            assert.fail('separateQuickInfoBoxes is not defined');
        }

        window.separateQuickInfoBoxes();

        const layoutRoot = document.getElementById('print-layout-wrapper');
        const sections = layoutRoot.querySelectorAll('.print-section-container');
        
        // We had 2 boxes in our mock DOM
        assert.strictEqual(sections.length, 2, 'Should have created 2 sections');

        const acSection = document.getElementById('section-Box-AC');
        assert.ok(acSection, 'AC section should exist');
        assert.ok(acSection.classList.contains('box_border'), 'Should have box border');
        
        const initSection = document.getElementById('section-Box-Initiative');
        assert.ok(initSection, 'Initiative section should exist');
        
        // Check original container is empty/removed
        const originalBoxes = document.querySelectorAll('.ct-quick-info .ct-quick-info__box');
        assert.strictEqual(originalBoxes.length, 0, 'Original elements should have been moved');
    });
});
