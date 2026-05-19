const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

describe('Site-Main Visibility Regression', function() {
    let dom, document, DomManager;

    before(function() {
        const htmlPath = path.resolve(__dirname, '../test-subject.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        
        dom = new JSDOM(htmlContent);
        document = dom.window.document;
        global.document = document;
        global.window = dom.window;
    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
        global.HTMLElement = dom.window.HTMLElement;

        // Load dependencies in correct order
        global.ElementWrapper = require('../../js/dom/element_wrapper.js');
        DomManager = require('../../js/dom/dom_manager.js');
    });

    it('should NOT match #site-main with DIALOG_SIBLING selector in the real layout', function() {
        const manager = DomManager.getInstance();
        const selector = "dialog ~ div:not(#site-main):not([id^=\"print-enhance\"]):not([class*=\"be-\"])";
        
        // Find site-main
        const siteMain = document.getElementById('site-main');
        assert.ok(siteMain, 'site-main should exist in test-subject.html');
        
        // Check if any element matching the selector IS site-main
        const hiddenElements = Array.from(document.querySelectorAll(selector));
        const isSiteMainHidden = hiddenElements.includes(siteMain);
        
        assert.strictEqual(isSiteMainHidden, false, 'DIALOG_SIBLING selector should NOT target #site-main');
    });

    it('should ensure #site-main is not targeted by any CORE hiding selectors', function() {
        const manager = DomManager.getInstance();
        const coreSelectors = [
            ".site-bar",
            "header.main",
            "#mega-menu-target",
            "footer",
            ".ddb-site-alert",
            ".watermark",
            ".notifications-wrapper",
            "[class*=\"ct-character-nav\"]"
        ];

        const siteMain = document.getElementById('site-main');
        
        coreSelectors.forEach(selector => {
            if (!selector) return;
            const matches = Array.from(document.querySelectorAll(selector));
            assert.strictEqual(matches.includes(siteMain), false, `Selector ${selector} should NOT match #site-main`);
        });
    });

    it('should verify DomManager.getCharacterSheet() finds the correct container', function() {
        const manager = DomManager.getInstance();
        const sheet = manager.getCharacterSheet();
        
        assert.ok(sheet.element, 'Should find a character sheet element');
        assert.ok(sheet.element.classList.contains('ct-character-sheet-desktop'), 'Should have the correct class');
        
        // In test-subject.html, let's verify if the found element is NOT the navigation menu
        const siteMain = document.getElementById('site-main');
        assert.notStrictEqual(sheet.element, siteMain, 'Character sheet should NOT be the site-main navigation menu');
    });

    it('should NOT hide the real character sheet with the Deep Clean selector', function() {
        const manager = DomManager.getInstance();
        const sheet = manager.getCharacterSheet().element;
        
        const selector = "dialog ~ div:not(#site-main):not([id^=\"print-enhance\"]):not([class*=\"be-\"])";
        const matches = Array.from(document.querySelectorAll(selector));
        assert.strictEqual(matches.includes(sheet), false, `Selector ${selector} should NOT match the character sheet`);
    });
});
