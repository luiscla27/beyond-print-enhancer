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

describe('Storage Layer', function() {
  let window, Storage;
  const characterId = '12345';
  const testData = {
    version: '1.0.0',
    sections: { 'actions': {} }
  };

  before(async function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    window.indexedDB = global.indexedDB; // From fake-indexeddb/auto
    window.__DDB_TEST_MODE__ = true;
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);
    Storage = window.Storage;
    await Storage.init();
  });

  it('should save and load layout data', async function() {
    await Storage.saveLayout(characterId, testData);
    const loadedData = await Storage.loadLayout(characterId);
    assert.deepStrictEqual(loadedData, { ...testData, characterId: characterId });
  });

  it('should return undefined for non-existent character', async function() {
    const loadedData = await Storage.loadLayout('non-existent');
    assert.strictEqual(loadedData, undefined);
  });

  it('should save and load global layout data', async function() {
    const globalData = { version: '1.0.0', sections: { 'test': {} } };
    await Storage.saveGlobalLayout(globalData);
    const loadedData = await Storage.loadGlobalLayout();
    assert.deepStrictEqual(loadedData, { ...globalData, characterId: 'GLOBAL' });
  });

  it('should persist border style in section data', async function() {
    const borderData = {
      version: '1.2.0',
      sections: {
        'section-Actions': { borderStyle: 'ability_border' },
        'section-Spells': { borderStyle: 'no-border' }
      },
      clones: [
        { id: 'clone-1', borderStyle: 'spikes_border' }
      ]
    };
    await Storage.saveLayout('border-test', borderData);
    const loadedData = await Storage.loadLayout('border-test');
    assert.strictEqual(loadedData.sections['section-Actions'].borderStyle, 'ability_border');
    assert.strictEqual(loadedData.sections['section-Spells'].borderStyle, 'no-border');
    assert.strictEqual(loadedData.clones[0].borderStyle, 'spikes_border');
  });
});
