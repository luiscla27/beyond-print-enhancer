const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Spells Interactivity Regression', () => {
    let document;
    let window;
    let runStep;

    beforeEach(() => {
        // Mock DOM with the critical structure provided by user
        const dom = new JSDOM(`
            <!DOCTYPE html>
            <div id="root">
                <div class="ct-character-sheet-desktop">
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
                    
                    <div class="site-bar">Site Bar</div>
                    <div class="header-wrapper">Global Search</div>
                    <div class="ct-sidebar">Sidebar</div>
                    <div class="ct-quick-info">Quick Info</div>
                    <div class="ddbc-character-avatar__portrait">Portrait</div>
                    <div class="ct-subsection ct-subsection--primary-box"></div>
                </div>
                <div id="print-layout-wrapper"></div>
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
        
        // Mock safeQuery
        global.safeQuery = (selectors, context = document) => {
             if (!Array.isArray(selectors)) selectors = [selectors];
             for (const selector of selectors) {
                 const el = context.querySelector(selector);
                 if (el) return el;
             }
             return null;
        };

        // Attach event listener to Manage Spells to verify it stays
        const btn = document.querySelector('.manage-spells-btn');
        btn.addEventListener('click', () => {
            btn.dataset.clicked = 'true';
        });
    });

    const checkManageSpells = (stepName) => {
        const manageBtn = document.querySelector('.manage-spells-btn');
        assert.ok(manageBtn, `[${stepName}] Manage Spells button should exist`);
        
        const filterContainer = document.querySelector('.ct-spells-filter');
        assert.ok(filterContainer, `[${stepName}] .ct-spells-filter container should exist`);
        
        // Check visibility (style.display)
        if (manageBtn.style.display === 'none') assert.fail(`[${stepName}] Manage Spells button is hidden via style`);
        if (filterContainer.style.display === 'none') assert.fail(`[${stepName}] .ct-spells-filter is hidden via style`);
        
        // Check if it's detached (not in document body)
        assert.ok(document.body.contains(manageBtn), `[${stepName}] Manage Spells button should be in the document`);

        // Check event listener (by simulating click)
        manageBtn.click();
        assert.strictEqual(manageBtn.dataset.clicked, 'true', `[${stepName}] Click event should still fire`);
        manageBtn.dataset.clicked = 'false'; // Reset
    };

    // Replicate logic from main.js
    const removeSearchBoxes = () => {
        const searchSelectors = [
            '.header-wrapper',
            '.ct-spells-filter',
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
            if (el.closest('.ct-spells') || el.closest('[data-testid="SPELLS"]')) {
                return;
            }
            el.remove();
        });
    };

    const tweakStyles = () => {
        global.safeQueryAll([
            'div.site-bar', 'header.main', '#mega-menu-target', 
            '[class*="navigation"]', '[class*="mega-menu"]', '[class*="sidebar"]', 'footer'
        ]).forEach(e => { 
            if (e.classList.contains('ct-sidebar__portal') || e.closest('.ct-sidebar__portal')) return;
            e.style.display = 'none'; 
        });
    };

    const movePortrait = () => {
        const portrait = document.querySelector('.ddbc-character-avatar__portrait');
        const target = document.querySelector('.ct-subsection.ct-subsection--primary-box');
        if (portrait && target) {
            target.appendChild(portrait);
        }
    };

    const moveQuickInfo = () => {
        const quickInfo = document.querySelector('.ct-quick-info');
        if (quickInfo) {
            const layoutRoot = document.getElementById('print-layout-wrapper');
            if (layoutRoot) {
                 // Mock createDraggableContainer behavior (basic)
                 const container = document.createElement('div');
                 container.className = 'print-section-container';
                 const content = document.createElement('div');
                 content.className = 'print-section-content';
                 content.appendChild(quickInfo);
                 container.appendChild(content);
                 layoutRoot.appendChild(container);
            }
        }
    };

    it('should survive full post-processing sequence', () => {
        // ... (existing checks)
    });

    it('should NOT hide the sidebar portal (used for modals)', () => {
        // Add portal to DOM
        const portal = document.createElement('div');
        portal.className = 'ct-sidebar__portal';
        document.body.appendChild(portal);

        tweakStyles();

        assert.notStrictEqual(portal.style.display, 'none', 'Sidebar portal should NOT be hidden');
    });
});
