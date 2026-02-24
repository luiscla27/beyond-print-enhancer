const assert = require('assert');
const { JSDOM } = require('jsdom');
// Since we are testing files that might not exist yet or are being created, 
// we will assume their paths for now.
// For now, I'll define the test and then create the files.

describe('DomManager & ElementWrapper', () => {
    let ElementWrapper;
    let DomManager;
    let document;
    let window;

    before(() => {
        const dom = new JSDOM(`<!DOCTYPE html>
        <div id="root">
            <div class="sidebar">Sidebar Content</div>
            <div class="content">Main Content</div>
            <div class="tabs">
                <button class="tab">Tab 1</button>
                <button class="tab">Tab 2</button>
            </div>
            <div id="hidden" style="display: none;">Hidden</div>
        </div>`);
        window = dom.window;
        document = window.document;
        global.document = document;
        global.window = window;
        global.HTMLElement = window.HTMLElement;
        global.NodeList = window.NodeList;

        // Load modules
        global.ElementWrapper = require('../../js/dom/element_wrapper.js');
        ElementWrapper = global.ElementWrapper;
        DomManager = require('../../js/dom/dom_manager.js');
    });

    describe('ElementWrapper', () => {
        it('should wrap an HTMLElement', () => {
            const el = document.querySelector('.sidebar');
            const wrapper = new ElementWrapper(el);
            assert.strictEqual(wrapper.element, el);
        });

        it('should return true for isVisible() if element is visible', () => {
            const el = document.querySelector('.sidebar');
            const wrapper = new ElementWrapper(el);
            assert.strictEqual(wrapper.isVisible(), true);
        });

        it('should return false for isVisible() if element is hidden', () => {
            const el = document.getElementById('hidden');
            const wrapper = new ElementWrapper(el);
            assert.strictEqual(wrapper.isVisible(), false);
        });

        it('should toggle visibility', () => {
            const el = document.querySelector('.sidebar');
            const wrapper = new ElementWrapper(el);
            wrapper.hide();
            assert.strictEqual(el.style.display, 'none');
            wrapper.show();
            assert.strictEqual(el.style.display, '');
        });

        it('should manage classes', () => {
            const el = document.createElement('div');
            const wrapper = new ElementWrapper(el);
            wrapper.addClass('test-class');
            assert.ok(el.classList.contains('test-class'));
            wrapper.removeClass('test-class');
            assert.ok(!el.classList.contains('test-class'));
        });

        it('should get and set attributes', () => {
            const el = document.createElement('div');
            const wrapper = new ElementWrapper(el);
            wrapper.attr('id', 'test-id');
            assert.strictEqual(el.id, 'test-id');
            assert.strictEqual(wrapper.attr('id'), 'test-id');
        });
        
        it('should handle text content', () => {
             const el = document.createElement('div');
             const wrapper = new ElementWrapper(el);
             wrapper.text('Hello');
             assert.strictEqual(el.textContent, 'Hello');
             assert.strictEqual(wrapper.text(), 'Hello');
        });
    });

    describe('DomManager', () => {
        it('should be a singleton', () => {
            const instance1 = DomManager.getInstance();
            const instance2 = DomManager.getInstance();
            assert.strictEqual(instance1, instance2);
        });

        it('should have a selector registry', () => {
            const manager = DomManager.getInstance();
            assert.ok(manager.selectors);
            assert.ok(manager.selectors.CORE);
        });

        describe('Core Layout Methods', () => {
            let manager;
            
            before(() => {
                manager = DomManager.getInstance();
            });

            it('should retrieve the character sheet', () => {
                // Setup fake DOM
                document.body.innerHTML = '<div class="ct-character-sheet-desktop"></div>';
                const wrapper = manager.getCharacterSheet();
                assert.ok(wrapper instanceof ElementWrapper);
                assert.ok(wrapper.element);
                assert.strictEqual(wrapper.element.className, 'ct-character-sheet-desktop');
            });

            it('should retrieve the sidebar', () => {
                document.body.innerHTML = '<div class="ct-sidebar"></div>';
                const wrapper = manager.getSidebar();
                assert.ok(wrapper instanceof ElementWrapper);
                assert.strictEqual(wrapper.element.className, 'ct-sidebar');
            });
            
            it('should retrieve navigation tabs', () => {
                document.body.innerHTML = `
                    <div class="ct-character-sheet-desktop">
                        <nav>
                            <div class="ct-primary-box__tab--actions">Actions</div>
                            <div class="ct-primary-box__tab--spells">Spells</div>
                        </nav>
                    </div>`;
                const wrapper = manager.getNavigation();
                assert.ok(wrapper instanceof ElementWrapper);
                assert.strictEqual(wrapper.element.tagName, 'NAV');
            });

            it('should hide core interface elements', () => {
                document.body.innerHTML = `
                    <div class="site-bar">Site Bar</div>
                    <header class="main">Header</header>
                    <div class="ct-sidebar">Sidebar</div>
                    <nav class="navigation">Nav</nav>
                `;
                manager.hideCoreInterface();
                assert.strictEqual(document.querySelector('.site-bar').style.display, 'none');
                assert.strictEqual(document.querySelector('header.main').style.display, 'none');
                assert.strictEqual(document.querySelector('.ct-sidebar').style.display, 'none');
                assert.strictEqual(document.querySelector('nav.navigation').style.display, 'none');
            });
        });

        describe('Spells Module Methods', () => {
            let manager;
            
            before(() => {
                manager = DomManager.getInstance();
            });

            it('should retrieve spells container', () => {
                document.body.innerHTML = '<div class="ct-spells"></div>';
                const wrapper = manager.getSpellsContainer();
                assert.strictEqual(wrapper.element.className, 'ct-spells');
            });

            it('should retrieve spell rows', () => {
                document.body.innerHTML = `
                    <div class="ct-spells">
                        <div class="ct-spells-spell">Spell 1</div>
                        <div class="ct-spells-spell">Spell 2</div>
                    </div>`;
                const rows = manager.getSpellRows();
                assert.strictEqual(rows.length, 2);
                assert.strictEqual(rows[0].text(), 'Spell 1');
            });

            it('should retrieve spell rows within context', () => {
                 document.body.innerHTML = `
                    <div id="group1"><div class="ct-spells-spell">Spell A</div></div>
                    <div id="group2"><div class="ct-spells-spell">Spell B</div></div>
                 `;
                 const group1 = new ElementWrapper(document.getElementById('group1'));
                 const rows = manager.getSpellRows(group1);
                 assert.strictEqual(rows.length, 1);
                 assert.strictEqual(rows[0].text(), 'Spell A');
            });
        });

        describe('Ability Selectors', () => {
            it('should have ability summary selectors', () => {
                const manager = DomManager.getInstance();
                assert.strictEqual(manager.selectors.ABILITY.SUMMARY, '.ddbc-ability-summary');
                assert.strictEqual(manager.selectors.ABILITY.SUMMARY_SECONDARY, '.ddbc-ability-summary__secondary');
            });
        });

        describe('UI Selectors', () => {
            it('should have shape container selector', () => {
                const manager = DomManager.getInstance();
                assert.strictEqual(manager.selectors.UI.SHAPE_CONTAINER, '.print-shape-container');
            });
        });
    });
});
