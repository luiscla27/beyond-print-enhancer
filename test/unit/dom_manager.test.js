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

        // Load modules (simulated require if they were ES modules, but we'll use CommonJS for test compatibility if needed, 
        // or just require them normally assuming they are written as CommonJS or we have a transform. 
        // Given the project seems to use vanilla JS for extension, I'll likely need to use standard require.
        // If the files are ES modules (with export), Node might complain without configuration.
        // Let's assume standard CommonJS for now or that I can require them.
        
        // Wait, the project is a Chrome Extension, usually vanilla JS. 
        // I might need to mock the module loading if they are just scripts.
        // But for unit testing logic, I should write them as testable modules.
        // I will write them as classes that can be exported.
        
        ElementWrapper = require('../../js/dom/element_wrapper.js');
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

        // We will add specific selector tests in the next phase/task when we populate them
    });
});
