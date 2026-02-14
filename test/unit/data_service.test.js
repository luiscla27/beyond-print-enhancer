const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Data Service & Cache Logic', function() {
  let window, Storage;

  before(async function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "https://www.dndbeyond.com/characters/12345",
      runScripts: "dangerously"
    });
    window = dom.window;
    window.indexedDB = global.indexedDB;
    window.__DDB_TEST_MODE__ = true;
    window.eval(mainJsContent);
    Storage = window.Storage;
    await Storage.init();
  });

  it('should retrieve from cache if available', async function() {
    const spellData = {
      name: 'Shield',
      level: 1,
      description: 'An invisible barrier...',
      range: 'Self',
      school: 'Abjuration'
    };
    await Storage.saveSpells([spellData]);

    // Mock getCharacterId
    window.getCharacterId = () => '12345';
    // Mock fetch to ensure it's NOT called
    window.fetch = () => { throw new Error('Fetch should not be called on cache hit'); };

    const result = await window.fetchSpellWithCache('Shield');
    assert.deepStrictEqual(result, spellData);
  });

  it('should fetch from API and update cache on miss', async function() {
    const spellData = {
      name: 'Misty Step',
      level: 2,
      description: 'Briefly surrounded by silvery mist...',
      range: 'Self',
      school: 'Conjuration'
    };

    // Clear cache for this spell
    const db = await Storage.init();
    const transaction = db.transaction(['spell_cache'], 'readwrite');
    transaction.objectStore('spell_cache').delete('Misty Step');
    await new Promise(resolve => transaction.oncomplete = resolve);

    // Mock getCharacterId
    window.getCharacterId = () => '12345';
    
    // Mock fetch
    window.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: {
          classSpells: [],
          spells: {
            race: [],
            class: [{ definition: { name: 'Misty Step', level: 2, description: 'Briefly surrounded by silvery mist...', range: { origin: 'Self' }, school: 'Conjuration' } }],
            feat: [],
            item: []
          }
        }
      })
    });

    const result = await window.fetchSpellWithCache('Misty Step');
    assert.strictEqual(result.name, 'Misty Step');

    // Verify it was cached
    const cached = await Storage.getSpell('Misty Step');
    assert.strictEqual(cached.name, 'Misty Step');
  });
});
