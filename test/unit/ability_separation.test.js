const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Ability Separation', () => {
    let window, document, domManager;

    before(() => {
        const dom = new JSDOM(`<!DOCTYPE html>
        <html>
            <body>
                <div id="print-layout-wrapper"></div>
                <div class="ct-quick-info">
                    <section id="abilities-parent">
                        <div class="ct-quick-info__ability ct-quick-info__ability--str">
                            <div class="ct-quick-info__ability-name">STR</div>
                            <div class="ct-quick-info__ability-value">18</div>
                        </div>
                        <div class="ct-quick-info__ability ct-quick-info__ability--dex">
                            <div class="ct-quick-info__ability-name">DEX</div>
                            <div class="ct-quick-info__ability-value">14</div>
                        </div>
                    </section>
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

        // Set test mode to skip IIFE execution automatically
        window.__DDB_TEST_MODE__ = true;

        // Load modules manually into window context
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

    it('should have ability selectors in DomManager', () => {
        assert.strictEqual(domManager.selectors.CORE.ABILITY, '.ct-quick-info__ability');
        assert.strictEqual(domManager.selectors.CORE.ABILITY_NAME, '.ct-quick-info__ability-name');
    });

    it('should separate abilities and remove parent section', () => {
        window.__MOCK_REMOVE_SPECIFIC_SVGS__ = (el) => {}; // No-op
        
        // Execute the function
        window.separateAbilities();

        const layoutRoot = document.getElementById('print-layout-wrapper');
        const sections = layoutRoot.querySelectorAll('.print-section-container');
        
        assert.strictEqual(sections.length, 2);
        
        const strSection = document.getElementById('section-Ability-STR');
        assert.ok(strSection, 'STR section should exist');
        
        // Check content moved
        const strValue = strSection.querySelector('.ct-quick-info__ability-value');
        assert.strictEqual(strValue.textContent, '18');

        // Check original container is empty (elements moved)
        const originalAbilities = document.querySelectorAll('.ct-quick-info .ct-quick-info__ability');
        assert.strictEqual(originalAbilities.length, 0, 'Original elements should have been moved');

        // Check parent section removed
        const parent = document.getElementById('abilities-parent');
        assert.strictEqual(parent, null, 'Parent section should have been destroyed');
    });
});
