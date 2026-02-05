const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('DOM Extraction Logic (2026 Resilience)', function() {
  let window, document;

  beforeEach(function() {
    // Mock the 2026 obfuscated structure
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="styles_tabs__abc">
            <button class="styles_tabButton__wvSLf">Actions</button>
            <button class="styles_tabButton__wvSLf">Spells</button>
            <button class="styles_tabButton__wvSLf">Equipment</button>
            <button class="styles_tabButton__wvSLf">Features & Traits</button>
          </div>
          <div class="character-sheet-main">
            <div class="_content_dbufq_8">
                <div class="mock-data">Actions Content</div>
            </div>
          </div>
          <div class="ct-status-summary-bar">
            <div class="ct-status-summary-bar__hp-text">10 / 10</div>
          </div>
        </body>
      </html>
    `, {
      url: "http://localhost",
    });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    global.NodeList = window.NodeList;
  });

  // Test the navToSection logic
  function navToSection(name) {
    const tabs = Array.from(document.querySelectorAll('button[class*="tabButton"]'));
    let target = tabs.find(tab => tab.textContent.toLowerCase().includes(name.toLowerCase()));
    return !!target;
  }

  it('should find obfuscated tab buttons by text/pattern', function() {
    assert.ok(navToSection('Actions'));
    assert.ok(navToSection('Spells'));
    assert.ok(navToSection('Features'));
  });

  it('should find obfuscated content area by class pattern', function() {
    const content = document.querySelector('div[class*="content"]');
    assert.ok(content);
    assert.strictEqual(content.className, '_content_dbufq_8');
  });

  it('should find HP display by numeric pattern', function() {
    const all = Array.from(document.querySelectorAll('*'));
    const hp = all.find(el => el.textContent.trim().match(/^\d+\s*\/\s*\d+$/));
    assert.ok(hp);
    assert.strictEqual(hp.textContent.trim(), '10 / 10');
  });
});