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

describe('Spell Persistence in JSON', function() {
  let window, Storage;

  before(async function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    window.indexedDB = global.indexedDB;
    window.__DDB_TEST_MODE__ = true;
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);
    Storage = window.Storage;
    await Storage.init();
  });

  it('should include spell_cache in scanLayout', async function() {
    const spellData = {
      name: 'Magic Missile',
      level: 1,
      description: 'You create three glowing darts of magical force.',
      range: '120 feet',
      school: 'Evocation'
    };

    await Storage.saveSpells([spellData]);
    
    const layout = await window.scanLayout();
    assert.ok(layout.spell_cache, 'layout should have spell_cache');
    const found = layout.spell_cache.find(s => s.name === 'Magic Missile');
    assert.deepStrictEqual(found, spellData);
  });

  it('should restore spell_cache in applyLayout', async function() {
    const spellData = {
      name: 'Shield',
      level: 1,
      description: 'An invisible barrier of magical force appears...',
      range: 'Self',
      school: 'Abjuration'
    };

    const layout = {
      version: '1.1.0',
      sections: {},
      spell_cache: [spellData]
    };

    // Clear current cache
    const db = await Storage.init();
    const transaction = db.transaction(['spell_cache'], 'readwrite');
    transaction.objectStore('spell_cache').clear();
    await new Promise(resolve => transaction.oncomplete = resolve);

    await window.applyLayout(layout);
    
    const cachedSpell = await Storage.getSpell('Shield');
    assert.deepStrictEqual(cachedSpell, spellData);
  });
});
