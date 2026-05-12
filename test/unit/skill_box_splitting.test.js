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

describe('Skill Box Splitting', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
             <div class="be-section-wrapper" id="section-skills-wrapper" data-title="Skills">
                <div class="print-section-container" id="section-skills">
                    <div class="print-section-content">
                        <div class="ct-skills__box">
                            <div class="ct-skills__item">
                                <span class="ct-skills__item--label">Acrobatics</span>
                                <span class="ct-skills__col--stat">DEX</span>
                            </div>
                            <div class="ct-skills__item">
                                <span class="ct-skills__item--label">Athletics</span>
                                <span class="ct-skills__item--stat">STR</span>
                            </div>
                            <div class="ct-skills__item">
                                <span class="ct-skills__item--label">Arcana</span>
                                <span class="ct-skills__col--stat">INT</span>
                            </div>
                            <div class="ct-skills__item">
                                <span class="ct-skills__item--label">Insight</span>
                                <span class="ct-skills__item--stat">WIS</span>
                            </div>
                            <div class="ct-skills__item">
                                <span class="ct-skills__item--label">Deception</span>
                                <span class="ct-skills__col--stat">CHA</span>
                            </div>
                        </div>
                    </div>
                </div>
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
    
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };

    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;

    // Mock chrome
    window.chrome = {
        runtime: {
            getURL: (path) => `chrome-extension://mock/${path}`
        },
        storage: {
            local: { get: () => {}, set: () => {} }
        }
    };

    window.__DDB_TEST_MODE__ = true;
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);
  });

  it('should split the skills box into 5 sections and filter items', async function() {
    if (typeof window.splitSkillsBox !== 'function') {
      assert.fail('window.splitSkillsBox is not defined');
    }

    // Initial state
    assert.strictEqual(window.skillsSplit, false);
    assert.ok(document.querySelector('.ct-skills__box'), 'Original skills box should exist');

    // Execute split
    await window.splitSkillsBox(true);

    // Verify original removed
    assert.strictEqual(document.getElementById('section-skills-wrapper'), null, 'Original section wrapper should be removed');
    
    // Verify 5 clones created (and each contains a skills box)
    const skillsBoxes = document.querySelectorAll('.ct-skills__box');
    assert.strictEqual(skillsBoxes.length, 5, 'Should have created 5 clones, each with its own skills box');

    const clones = document.querySelectorAll('.be-clone');
    assert.strictEqual(clones.length, 5, 'Should have created 5 clones');

    const expectedStats = ["STR", "INT", "WIS", "CHA", "DEX"];
    expectedStats.forEach(stat => {
        const clone = Array.from(document.querySelectorAll('.be-section-wrapper'))
            .find(el => el.dataset.title === stat);
        assert.ok(clone, `Clone for ${stat} should exist`);

        // Check filtering
        const items = clone.querySelectorAll('.ct-skills__item');
        assert.strictEqual(items.length, 1, `Clone for ${stat} should have exactly 1 skill item`);
        const statEl = items[0].querySelector('.ct-skills__item--stat') || items[0].querySelector('.ct-skills__col--stat');
        const itemStat = statEl.textContent.trim();
        assert.strictEqual(itemStat, stat, `Skill item in ${stat} clone should match the stat`);
    });

    // Verify flag
    assert.strictEqual(window.skillsSplit, true);
  });

  it('should persist the skillsSplit flag in scanLayout', async function() {
    window.skillsSplit = true;
    const layout = await window.scanLayout();
    assert.strictEqual(layout.skillsSplit, true, 'skillsSplit flag should be persisted in scanLayout');
  });

  it('should restore the skillsSplit flag in applyLayout', async function() {
    const layout = {
      version: 1,
      skillsSplit: true,
      sections: {}
    };

    // Initially false
    window.skillsSplit = false;

    // Apply layout
    await window.applyLayout(layout);

    assert.strictEqual(window.skillsSplit, true, 'skillsSplit flag should be restored in applyLayout');
  });
});
