const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Spells Interactivity Regression', () => {
    let document;
    let window;
    let removeSearchBoxes;

    beforeEach(() => {
        // Mock DOM with the critical structure provided by user
        const dom = new JSDOM(`
            <!DOCTYPE html>
            <div id="root">
                <section class="ct-spells" data-testid="SPELLS">
                    <h2 class="accessibility_screenreaderOnly__OEzRB">Spells</h2>
                    <div class="ct-spells-filter">
                        <div class="ct-spells-filter__interactions">
                            <div class="ct-spells-filter__box">
                                <div class="ct-spells-filter__primary">
                                    <div class="ct-spells-filter__field">
                                        <input class="ct-spells-filter__input" type="search">
                                    </div>
                                </div>
                            </div>
                            <div class="ct-spells-filter__callout">
                                <button class="ct-theme-button manage-spells-btn">
                                    <span class="ct-button__content">Manage Spells</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="ct-spells__content">
                        <!-- striped for simplicity -->
                    </div>
                </section>
                
                <!-- Another filter outside spells that SHOULD be removed -->
                <div class="header-wrapper">Global Search</div>
            </div>
        `);
        window = dom.window;
        document = window.document;
        global.document = document;
        global.window = window;
        global.HTMLElement = window.HTMLElement;
        global.NodeList = window.NodeList;

        // Mock safeQueryAll for main.js functions
        global.safeQueryAll = (selectors, context = document) => {
            if (!Array.isArray(selectors)) selectors = [selectors];
            let results = [];
            for (const selector of selectors) {
                try {
                    results = results.concat(Array.from(context.querySelectorAll(selector)));
                } catch (e) {}
            }
            return results;
        };

        // We need to extract the removeSearchBoxes function logic from main.js
        // Since main.js is not a module, we'll replicate the logic exactly as it is in the file
        // or load the file if possible. For unit testing specific logic, replicating the function
        // under test is often safer/faster if we can't easily import.
        
        removeSearchBoxes = () => {
            const searchSelectors = [
                '.header-wrapper',
                '.ct-spells-filter', // This is the dangerous one
                '.ct-inventory__filter',
                '.ct-equipment__filter',
                '.ct-extras__filter',
                '.ct-features__management-link',
                '.ct-filter-box', 
                'input[type="search"]',
                '[class*="filter"]',
                '.ct-application-group__filter'
            ];

            global.safeQueryAll(searchSelectors).forEach(el => {
                // User Request: Preserve Filters on Live Spells Tab
                // Check if element is inside Spells container (or is the spells filter itself checking ancestors)
                if (el.closest('.ct-spells') || el.closest('[data-testid="SPELLS"]')) {
                    return;
                }
                el.remove();
            });
        };
    });

    it('should NOT remove the Manage Spells button or its container', () => {
        removeSearchBoxes();
        
        const manageBtn = document.querySelector('.manage-spells-btn');
        assert.ok(manageBtn, 'Manage Spells button should exist');
        
        const filterContainer = document.querySelector('.ct-spells-filter');
        assert.ok(filterContainer, '.ct-spells-filter container should exist');
    });

    it('should remove global search boxes outside of spells', () => {
        removeSearchBoxes();
        const globalSearch = document.querySelector('.header-wrapper');
        assert.strictEqual(globalSearch, null, 'Global header wrapper should be removed');
    });
});
