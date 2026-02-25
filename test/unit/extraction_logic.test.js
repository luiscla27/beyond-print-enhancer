const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

const elementWrapperPath = path.resolve(__dirname, '../../js/dom/element_wrapper.js');
const domManagerPath = path.resolve(__dirname, '../../js/dom/dom_manager.js');
const elementWrapperContent = fs.readFileSync(elementWrapperPath, 'utf8');
const domManagerContent = fs.readFileSync(domManagerPath, 'utf8');
require("fake-indexeddb/auto");

describe('Extraction Core & Lifecycle', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper"></div>
          <div class="ct-actions-group" id="target-element">
            <h3 class="head">My Actions</h3>
            <p>Some content</p>
          </div>
        </body>
      </html>
    `, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    window.indexedDB = global.indexedDB;
    window.__DDB_TEST_MODE__ = true;
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);
    
    // Flag elements
    window.flagExtractableElements();
  });

  it('should extract element on double click', function() {
    const target = document.getElementById('target-element');
    
    // Simulate double click
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    target.dispatchEvent(dblClickEvent);
    
    // Original should be hidden
    assert.strictEqual(target.style.display, 'none', 'Original element should be hidden');
    
    // New section should exist in print-layout-wrapper
    const sections = document.querySelectorAll('.print-section-container.be-extracted-section');
    assert.strictEqual(sections.length, 1, 'One extracted section should be created');
    
    const section = sections[0];
    const wrapper = section.closest('.be-section-wrapper');
    assert.ok(wrapper, 'Wrapper should exist');
    assert.ok(wrapper.textContent.includes('My Actions'), 'Section should contain original title');
    assert.ok(section.textContent.includes('Some content'), 'Section should contain original content');
    
    // Link tracking
    assert.strictEqual(section.dataset.originalId, 'target-element', 'Section should track original ID');

    // Resize handle
    assert.ok(section.querySelector('.print-section-resize-handle'), 'Should have a resize handle');

    // Compact button
    const actionContainer = wrapper.querySelector('.be-section-actions');
    assert.ok(actionContainer.querySelector('.be-compact-button'), 'Should have a compact mode button');

    // Original header inside clone should be hidden
    const clonedHeader = section.querySelector('.ct-actions-group h3.head');
    assert.ok(clonedHeader, 'Cloned header should exist');
    assert.strictEqual(clonedHeader.style.display, 'none', 'Original header inside clone should be hidden');
  });

  it('should rollback extraction when section is closed', function() {
    const target = document.getElementById('target-element');
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    target.dispatchEvent(dblClickEvent);
    
    const section = document.querySelector('.be-extracted-section');
    const wrapper = section.closest('.be-section-wrapper');
    const closeBtn = wrapper.querySelector('.print-section-minimize'); // The 'X' button
    
    closeBtn.click();
    
    // Section should be removed
    assert.strictEqual(document.querySelector('.be-section-wrapper'), null, 'Wrapper should be removed');
    
    // Original should be visible
    assert.notStrictEqual(target.style.display, 'none', 'Original element should be restored');
  });

  it('should rollback all extractions during handleLoadDefault', async function() {
    const target = document.getElementById('target-element');
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    target.dispatchEvent(dblClickEvent);
    
    const section = document.querySelector('.be-extracted-section');
    const wrapper = section.closest('.be-section-wrapper');
    assert.strictEqual(target.style.display, 'none', 'Should be hidden after extraction');
    assert.ok(wrapper, 'Extracted wrapper should exist');

    // Mock confirm for handleLoadDefault
    window.confirm = () => true;
    
    // Trigger Load Default
    await window.handleLoadDefault();
    
    assert.strictEqual(document.querySelector('.be-section-wrapper'), null, 'Extracted wrapper should be removed');
    assert.notStrictEqual(target.style.display, 'none', 'Original should be restored');
  });
});
