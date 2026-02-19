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

describe('Spell Cache Storage', function() {
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

  it('should have a spell_cache object store', async function() {
    const db = await Storage.init();
    assert.strictEqual(db.objectStoreNames.contains('spell_cache'), true, 'spell_cache store should exist');
  });

  it('should save and retrieve spell data', async function() {
    const spellData = {
      name: 'Fireball',
      level: 3,
      description: 'A bright streak flashes from your pointing finger...',
      range: '150 feet',
      school: 'Evocation'
    };

    // Note: These methods are not implemented yet, so this should fail
    await Storage.saveSpells([spellData]);
    const cachedSpell = await Storage.getSpell('Fireball');
    assert.deepStrictEqual(cachedSpell, spellData);
  });
});
