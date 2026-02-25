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

describe('UI - Spell Detail Section', function() {
  this.timeout(10000);
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
    
    // Mock chrome.runtime.sendMessage for MV3 background fetch
    window.chrome = {
      runtime: {
        sendMessage: (message, callback) => {
          if (message.type === 'FETCH_CHARACTER_DATA') {
            if (message.url.includes('NonExistent')) {
              callback({ success: false, error: 'Not Found' });
            } else {
              callback({
                success: true,
                data: {
                  data: {
                    classSpells: [],
                    spells: { race: [], class: [], feat: [], item: [] }
                  }
                }
              });
            }
          }
        }
      }
    };

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

  it('should create a floating section shell at click coordinates', async function() {
    const spellName = 'Fireball';
    const coords = { x: 100, y: 200 };
    
    // We don't await here to check the intermediate state (spinner)
    window.createSpellDetailSection(spellName, coords);
    
    const section = document.querySelector('.print-section-container.be-spell-detail');
    assert.ok(section, 'Section should be created');
    const wrapper = section.closest('.be-section-wrapper');
    assert.ok(wrapper, 'Wrapper should be found');
    assert.strictEqual(wrapper.style.left, '100px');
    assert.strictEqual(wrapper.style.top, '200px');
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
    
    const wrapper = Array.from(document.querySelectorAll('.be-section-wrapper'))
                         .find(w => w.textContent.includes('Shield'));
    assert.ok(wrapper.textContent.includes('Abjuration'), 'Should display school');
    assert.ok(wrapper.textContent.includes('An invisible barrier'), 'Should display description');
    assert.strictEqual(wrapper.querySelector('.be-spinner'), null, 'Spinner should be removed');
  });

  it('should show error state on fetch failure', async function() {
    // Force cache miss and fetch failure
    const spellName = 'NonExistent';
    window.fetch = async () => ({ ok: false });

    await window.createSpellDetailSection(spellName, { x: 0, y: 0 });
    
    const wrapper = Array.from(document.querySelectorAll('.be-section-wrapper'))
                         .find(w => w.textContent.includes('NonExistent'));
    
    assert.ok(wrapper, 'Section for NonExistent should be found');
    assert.ok(wrapper.textContent.toLowerCase().includes('available'), 'Should show error message guidance');
    assert.ok(wrapper.querySelector('.be-retry-button'), 'Should have retry button');
  });

  it('should reposition to left:0 and spell Y during handleLoadDefault', async function() {
    const spellName = 'Cure Wounds';
    
    // Create a mock spell label in the DOM
    const spellsContainer = document.createElement('div');
    spellsContainer.innerHTML = `
        <div class="ct-spells-spell">
            <div class="ct-spells-spell__label">Cure Wounds</div>
        </div>
    `;
    // Position it at Y=500
    spellsContainer.style.position = 'absolute';
    spellsContainer.style.top = '500px';
    document.body.appendChild(spellsContainer);
    
    // Mock getBoundingClientRect for the label
    const label = spellsContainer.querySelector('.ct-spells-spell__label');
    label.getBoundingClientRect = () => ({
        top: 500,
        left: 100,
        width: 100,
        height: 20
    });

    // Mock layout wrapper Rect
    const layoutRoot = document.getElementById('print-layout-wrapper');
    layoutRoot.getBoundingClientRect = () => ({ top: 0, left: 0, width: 1200 });

    // Create the detail section
    await window.createSpellDetailSection(spellName, { x: 400, y: 400 });
    const wrapper = Array.from(document.querySelectorAll('.be-section-wrapper'))
                         .find(w => {
                             const span = w.querySelector('.print-section-header span');
                             return span && span.textContent.trim() === spellName;
                         });
    assert.ok(wrapper, 'Wrapper not found');
    const detail = wrapper.querySelector('.print-section-container');
    assert.ok(detail, 'Detail container not found');
    
    // Initial position and size
    wrapper.style.left = '400px';
    detail.style.width = '500px';
    
    // Trigger Load Default
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    await window.handleLoadDefault();
    window.confirm = originalConfirm;
    
    // RE-QUERY live elements after reset
    const finalWrapper = Array.from(document.querySelectorAll('.be-section-wrapper'))
                         .find(w => {
                             const span = w.querySelector('.print-section-header span');
                             return span && span.textContent.trim() === spellName;
                         });
    assert.ok(finalWrapper, 'Wrapper missing after reset');
    const finalDetail = finalWrapper.querySelector('.print-section-container');

    // Should be at left: 1200, top: 500, and width: 300px
    assert.strictEqual(finalWrapper.style.left, '1200px');
    assert.strictEqual(finalWrapper.style.top, '500px');
    assert.strictEqual(finalDetail.style.width, '300px');
  });
});
