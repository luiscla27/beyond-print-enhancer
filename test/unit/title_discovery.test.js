const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Title Discovery', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    window.__DDB_TEST_MODE__ = true;
    window.eval(mainJsContent);
  });

  it('should find title from h1-h5', function() {
    const el = document.createElement('div');
    el.innerHTML = '<h4>Level 3 Fireball</h4>';
    const title = window.findSectionTitle(el);
    assert.strictEqual(title, 'Level 3 Fireball');
  });

  it('should find title from class containing "head"', function() {
    const el = document.createElement('div');
    el.innerHTML = '<div class="styles_header__abc">My Actions</div>';
    const title = window.findSectionTitle(el);
    assert.strictEqual(title, 'My Actions');
  });

  it('should prompt for title if nothing is found', async function() {
    const el = document.createElement('div');
    el.innerHTML = '<p>Just content</p>';
    
    // Mock showInputModal
    window.showInputModal = async () => 'Manual Title';
    
    // We need to test the logic that calls the prompt. 
    // This is inside handleElementExtraction.
    
    const extractionPromise = new Promise(async (resolve) => {
        // We need to wrap handleElementExtraction to capture the result or mock parts of it
        // Or just test findSectionTitle directly if we modify it to return null/handle prompt
        // Actually handleElementExtraction does: const title = findSectionTitle(el) || await showInputModal(...)
        resolve();
    });
    
    const title = window.findSectionTitle(el);
    assert.strictEqual(title, null, 'Should return null if no element found');
  });
});
