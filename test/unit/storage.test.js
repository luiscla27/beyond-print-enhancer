const assert = require('assert');
const { JSDOM } = require('jsdom');
require("fake-indexeddb/auto");
const Storage = require('../../js/storage.js');

describe('Storage Layer', function() {
  const characterId = '12345';
  const testData = {
    characterId: characterId,
    sectionOrder: ['actions', 'spells'],
    customSpells: [{ id: 'spell-1', name: 'Fireball' }]
  };

  before(async function() {
    // Initialize DB
    await Storage.init();
  });

  it('should save and load layout data', async function() {
    await Storage.saveLayout(characterId, testData);
    const loadedData = await Storage.loadLayout(characterId);
    assert.deepStrictEqual(loadedData, testData);
  });

  it('should return undefined for non-existent character', async function() {
    const loadedData = await Storage.loadLayout('non-existent');
    assert.strictEqual(loadedData, undefined);
  });
});