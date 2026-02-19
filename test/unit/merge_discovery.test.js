const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

const elementWrapperPath = path.resolve(__dirname, '../../js/dom/element_wrapper.js');
const domManagerPath = path.resolve(__dirname, '../../js/dom/dom_manager.js');
const elementWrapperContent = fs.readFileSync(elementWrapperPath, 'utf8');
const domManagerContent = fs.readFileSync(domManagerPath, 'utf8');

describe('Merge UI & Discovery', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
            <div class="print-section-container" id="section-Actions">
                <div class="print-section-header"><span>Actions</span></div>
                <div class="print-section-content">
                    <div class="be-extractable" id="group-1">Attacks</div>
                </div>
            </div>
            <div class="print-section-container be-extracted-section" id="ext-1">
                <div class="print-section-header"><span>Extracted</span></div>
                <div class="print-section-content">
                    <div class="ct-content-group__header"><div class="ct-content-group__header-content">Fireball</div></div>
                </div>
            </div>
          </div>
        </body>
      </html>
    `, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    window.__DDB_TEST_MODE__ = true;
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);
  });

  it('should discover all merge targets with correct naming', function() {
    const targets = window.getMergeTargets();
    
    // Target 1: Sheet group
    const sheetTarget = targets.find(t => t.type === 'sheet');
    assert.ok(sheetTarget, 'Should find sheet target');
    assert.strictEqual(sheetTarget.name, 'Actions > Attacks');
    
    // Target 2: Floating section
    const sectionTarget = targets.find(t => t.type === 'section');
    assert.ok(sectionTarget, 'Should find section target');
    assert.strictEqual(sectionTarget.name, 'Floating: Extracted (Fireball)');
  });

  it('should inject append button into extracted sections', function() {
    const section = document.getElementById('ext-1');
    window.injectAppendButton(section);
    
    const btn = section.querySelector('.be-append-button');
    assert.ok(btn, 'Append button should be injected');
    assert.strictEqual(btn.innerHTML, '🔗');
  });
});
