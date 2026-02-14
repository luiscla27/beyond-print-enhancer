const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('UI - Spell Detail Section', function() {
  let window, document;

  before(async function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper"></div>
        </body>
      </html>
    `, {
      url: "https://www.dndbeyond.com/characters/12345",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    window.indexedDB = global.indexedDB;
    window.__DDB_TEST_MODE__ = true;
    
    // Mock fetch BEFORE eval
    window.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: {
          classSpells: [],
          spells: { race: [], class: [], feat: [], item: [] }
        }
      })
    });

    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };

    window.eval(mainJsContent);
    await window.Storage.init();
  });

  it('should create a floating section shell at click coordinates', async function() {
    const spellName = 'Fireball';
    const coords = { x: 100, y: 200 };
    
    // We don't await here to check the intermediate state (spinner)
    window.createSpellDetailSection(spellName, coords);
    
    const section = document.querySelector('.print-section-container.be-spell-detail');
    assert.ok(section, 'Section should be created');
    assert.strictEqual(section.style.left, '100px');
    assert.strictEqual(section.style.top, '200px');
    assert.ok(section.querySelector('.be-spinner'), 'Should show loading spinner initially');
  });

  it('should populate data after successful fetch', async function() {
    const spellName = 'Shield';
    const spellData = {
      name: 'Shield',
      level: 1,
      description: 'An invisible barrier...',
      range: 'Self',
      school: 'Abjuration'
    };

    // Mock Storage to return our spell
    await window.Storage.saveSpells([spellData]);

    await window.createSpellDetailSection(spellName, { x: 0, y: 0 });
    
    const section = Array.from(document.querySelectorAll('.print-section-container.be-spell-detail'))
                         .find(s => s.textContent.includes('Shield'));
    assert.ok(section.textContent.includes('Abjuration'), 'Should display school');
    assert.ok(section.textContent.includes('An invisible barrier'), 'Should display description');
    assert.strictEqual(section.querySelector('.be-spinner'), null, 'Spinner should be removed');
  });

  it('should show error state on fetch failure', async function() {
    // Force cache miss and fetch failure
    const spellName = 'NonExistent';
    window.fetch = async () => ({ ok: false });

    await window.createSpellDetailSection(spellName, { x: 0, y: 0 });
    
    const section = Array.from(document.querySelectorAll('.print-section-container.be-spell-detail'))
                         .find(s => s.textContent.includes('NonExistent'));
    
    assert.ok(section, 'Section for NonExistent should be found');
    assert.ok(section.textContent.toLowerCase().includes('available'), 'Should show error message guidance');
    assert.ok(section.querySelector('.be-retry-button'), 'Should have retry button');
  });
});
