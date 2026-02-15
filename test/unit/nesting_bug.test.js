const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Bug Fix: Recursive DIV Nesting', function() {
  let window, document;

  beforeEach(async function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper"></div>
          <div class="ct-actions-group" id="target-1">
            <h3 class="head">My Actions</h3>
            <p>Action Content</p>
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
    
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };

    window.eval(mainJsContent);
    await window.Storage.init();
  });

  it('should not wrap content in extra DIV when re-extracting merged content', async function() {
    window.flagExtractableElements();
    
    // 1. Initial Extraction of Target 1
    const t1 = document.getElementById('target-1');
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    t1.dispatchEvent(dblClickEvent);
    
    const s1 = document.querySelector('.be-extracted-section');
    assert.ok(s1, 'First section should exist');

    // 2. Merge S1 into the sheet (append after target-1)
    const targetInfo = { type: 'sheet', element: t1, id: 'target-1', name: 'Sheet' };
    window.handleMergeSections(s1, targetInfo);
    
    const wrapper = document.querySelector('.be-merge-wrapper');
    if (!wrapper) {
        console.log('Body:', document.body.innerHTML);
    }
    assert.ok(wrapper, 'Merge wrapper should exist on sheet');
    assert.ok(wrapper.classList.contains('be-extractable'), 'Wrapper should be extractable');

    // 3. Re-Extract the wrapper
    wrapper.dispatchEvent(dblClickEvent);
    
    const s2 = document.querySelector('.be-extracted-section');
    assert.ok(s2, 'Second section should exist');
    
    // Check structure of s2 content
    // Expected: .print-section-content -> [header, children of original wrapper]
    const contentArea = s2.querySelector('.print-section-content');
    
    // If it had been double-wrapped, there would be a div between contentArea and header/originalContent
    const topLevelChildren = Array.from(contentArea.children);
    
    // Should have: 1. ct-content-group__header, 2. h3 (hidden), 3. p
    assert.strictEqual(topLevelChildren[0].className, 'ct-content-group__header');
    
    // Ensure be-merge-wrapper div is NOT among the top-level children (it should have been flattened)
    const hasMergeWrapperChild = topLevelChildren.some(c => c.classList.contains('be-merge-wrapper'));
    assert.strictEqual(hasMergeWrapperChild, false, 'Should not contain a be-merge-wrapper as a direct child');
    
    assert.ok(s2.textContent.includes('Action Content'), 'Content should be preserved');
  });

  it('should destroy the source element instead of hiding it for spells during extraction', async function() {
    const spellName = 'Shield';
    const spellData = {
      name: 'Shield',
      level: 1,
      description: 'Invisible barrier',
      range: 'Self',
      school: 'Abjuration'
    };
    await window.Storage.saveSpells([spellData]);

    // 1. Create Spell Section
    await window.createSpellDetailSection(spellName, { x: 0, y: 0 });
    const s1 = document.querySelector('.be-spell-detail');
    
    // 2. Append/Merge it somewhere (e.g. into the sheet after target-1)
    const t1 = document.getElementById('target-1');
    window.handleMergeSections(s1, { type: 'sheet', element: t1, id: 'target-1', name: 'Sheet' });
    
    const wrapper = document.querySelector('.be-merge-wrapper');
    assert.ok(wrapper, 'Spell wrapper should exist');
    
    // 3. Double click to re-extract
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    wrapper.dispatchEvent(dblClickEvent);
    
    // 4. Verify original wrapper is DESTROYED (removed), not just hidden
    assert.strictEqual(document.querySelector('.be-merge-wrapper'), null, 'Source spell wrapper should be removed from DOM');
    
    const s2 = document.querySelector('.be-extracted-section');
    assert.ok(s2, 'New extraction should exist');
    assert.ok(s2.textContent.includes('Shield'), 'Content should be in the new section');
  });
});
