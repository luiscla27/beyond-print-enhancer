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

describe('Quick Info Persistence', function() {
  let window, document;

  before(async function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
          </div>
          <div class="ct-quick-info">
              <div class="ct-quick-info__box ct-quick-info__box--ac">
                  <div class="ct-quick-info__box-label">AC</div>
                  <div class="ct-quick-info__box-value">15</div>
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

  it('should include quick-info boxes in scanLayout', async function() {
    window.separateQuickInfoBoxes();
    const acSection = document.getElementById('section-Box-AC');
    assert.ok(acSection, 'AC section should exist');
    const wrapper = acSection.closest('.be-section-wrapper');
    assert.ok(wrapper, 'Wrapper should exist');
    
    // Set custom position
    wrapper.style.left = '600px';
    wrapper.style.top = '600px';
    
    const layout = await window.scanLayout();
    assert.ok(layout.sections['section-Box-AC'], 'AC section missing in scanLayout');
    assert.strictEqual(layout.sections['section-Box-AC'].left, '600px');
    assert.strictEqual(layout.sections['section-Box-AC'].borderStyle, 'box_border');
  });

  it('should restore quick-info boxes in applyLayout', async function() {
    const layout = {
        version: '1.4.0',
        sections: {
            'section-Box-AC': { 
                left: '200px', 
                top: '200px',
                borderStyle: 'ability_border'
            }
        },
        clones: []
    };

    await window.applyLayout(layout);
    const acSection = document.getElementById('section-Box-AC');
    const wrapper = acSection.closest('.be-section-wrapper');
    assert.strictEqual(wrapper.style.left, '200px');
    assert.strictEqual(wrapper.style.top, '200px');
    assert.ok(acSection.classList.contains('ability_border'), 'Should have restored custom border style');
    assert.ok(!acSection.classList.contains('box_border'), 'Default border should have been removed');
  });
});
