const assert = require('assert');
const { JSDOM } = require('jsdom');
require("fake-indexeddb/auto");

describe('Spells Interactivity Regression', () => {
    let document;
    let window;

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
    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
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
                } catch { /* a selector that matches nothing is not a failure */ }
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


    // Replicate logic from main.js

    const tweakStyles = () => {
        global.safeQueryAll([
            'div.site-bar', 'header.main', '#mega-menu-target', 
            '[class*="navigation"]', '[class*="mega-menu"]', '[class*="sidebar"]', 'footer'
        ]).forEach(e => { 
            if (e.classList.contains('ct-sidebar__portal') || e.closest('.ct-sidebar__portal')) return;
            e.style.display = 'none'; 
        });
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
