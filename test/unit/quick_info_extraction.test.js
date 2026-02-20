const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Quick Info Box Extraction', () => {
    let window, document, domManager;

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

        const script = document.createElement('script');
        script.textContent = `
            ${wrapperCode}
            ${managerCode}
            ${mainCode}
        `;
        document.body.appendChild(script);
        
        domManager = window.DomManager.getInstance();
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
