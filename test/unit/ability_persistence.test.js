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

describe('Ability Persistence', function() {
  let window, document;

  before(async function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
          </div>
          <div class="ct-quick-info">
              <div class="ct-quick-info__ability ct-quick-info__ability--str">
                  <div class="ct-quick-info__ability-name">Ability 1</div>
                  <div class="ct-quick-info__ability-value">18</div>
              </div>
          </div>
        </body>
      </html>
    `, {
      url: "http://localhost",
      runScripts: "dangerously",
      resources: "usable"
    });
    
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    window.indexedDB = global.indexedDB;
    window.confirm = () => true;
    
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    
    window.__DDB_TEST_MODE__ = true;
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);
    await window.Storage.init();
  });

  it('should separate abilities and include them in scanLayout', async function() {
    window.separateAbilities();
    const strSection = document.getElementById('section-Ability-Ability 1');
    assert.ok(strSection, 'Ability 1 section should exist');
    const wrapper = strSection.closest('.be-section-wrapper');
    assert.ok(wrapper, 'Wrapper should exist');
    
    // Set custom position
    wrapper.style.left = '500px';
    wrapper.style.top = '500px';
    
    const layout = await window.scanLayout();
    assert.ok(layout.sections['section-Ability-Ability 1'], 'Ability 1 section missing in scanLayout');
    assert.strictEqual(layout.sections['section-Ability-Ability 1'].left, '500px');
    assert.strictEqual(layout.sections['section-Ability-Ability 1'].borderStyle, 'ability_border');
  });

  it('should restore ability sections in applyLayout', async function() {
    const layout = {
        version: '1.4.0',
        sections: {
            'section-Ability-Ability 1': { 
                left: '123px', 
                top: '456px',
                borderStyle: 'spikes_border'
            }
        },
        clones: []
    };

    await window.applyLayout(layout);
    const strSection = document.getElementById('section-Ability-Ability 1');
    const wrapper = strSection.closest('.be-section-wrapper');
    assert.strictEqual(wrapper.style.left, '123px');
    assert.strictEqual(wrapper.style.top, '456px');
    assert.ok(strSection.classList.contains('spikes_border'), 'Should have restored custom border style');
    assert.ok(!strSection.classList.contains('ability_border'), 'Default border should have been removed');
  });

  it('should apply defaults to ability sections in applyDefaultLayout', async function() {
      // Clear styles from previous test
      const strSection = document.getElementById('section-Ability-Ability 1');
      const wrapper = strSection.closest('.be-section-wrapper');
      wrapper.style.left = '0px';
      strSection.classList.remove('spikes_border');
      
      window.applyDefaultLayout();
      
      // Default for Ability 1 is left: 16px, top: 16px, border: ability_border
      assert.strictEqual(wrapper.style.left, '16px');
      assert.strictEqual(wrapper.style.top, '16px');
      assert.ok(strSection.classList.contains('ability_border'), 'Default border should be applied');
  });
});
