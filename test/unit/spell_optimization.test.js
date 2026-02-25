const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

const elementWrapperPath = path.resolve(__dirname, '../../js/dom/element_wrapper.js');
const domManagerPath = path.resolve(__dirname, '../../js/dom/dom_manager.js');
const elementWrapperContent = fs.readFileSync(elementWrapperPath, 'utf8');
const domManagerContent = fs.readFileSync(domManagerPath, 'utf8');

describe('Spell Detail Optimization', function() {
  let window, document;

  beforeEach(async function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper"></div>
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

    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);
    await window.Storage.init();
  });

  it('should not store HTML for spell details in scanLayout', async function() {
    const spellName = 'Shield';
    const spellData = {
      name: 'Shield',
      level: 1,
      description: 'An invisible barrier...',
      range: 'Self',
      school: 'Abjuration'
    };

    await window.Storage.saveSpells([spellData]);
    await window.createSpellDetailSection(spellName, { x: 100, y: 100 });
    
    const layout = await window.scanLayout();
    assert.ok(layout.spell_details, 'Should have spell_details array');
    assert.strictEqual(layout.spell_details.length, 1, 'Should have one spell detail');
    assert.strictEqual(layout.spell_details[0].spellName, 'Shield');
    assert.strictEqual(layout.spell_details[0].html, undefined, 'Should NOT have html attribute');
  });

  it('should reconstruct spell detail content from cache in applyLayout', async function() {
    const spellName = 'Misty Step';
    const spellData = {
      name: 'Misty Step',
      level: 2,
      description: 'Briefly surrounded by silvery mist...',
      range: 'Self',
      school: 'Conjuration'
    };

    // Save to cache FIRST
    await window.Storage.saveSpells([spellData]);

    const layout = {
        version: '1.4.0',
        sections: {},
        clones: [],
        extractions: [],
        spell_details: [{
            id: 'saved-spell-1',
            spellName: 'Misty Step',
            left: '150px',
            top: '250px'
        }]
    };

    await window.applyLayout(layout);
    
    // Wait for async reconstruction
    await new Promise(resolve => setTimeout(resolve, 50));

    const section = document.getElementById('saved-spell-1');
    assert.ok(section, 'Spell detail section should be restored');
    assert.ok(section.textContent.includes('Conjuration'), 'Should show school from cache');
    assert.ok(section.textContent.includes('silvery mist'), 'Should show description from cache');
    const wrapper = section.closest('.be-section-wrapper');
    assert.ok(wrapper, 'Wrapper missing for restored spell detail');
    assert.strictEqual(wrapper.style.left, '150px');
  });
});
