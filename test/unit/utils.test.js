const assert = require('assert');
const { JSDOM } = require('jsdom');

/**
 * Mock the environment for main.js utilities
 */
describe('Query Utilities', function() {
  let window, document;

  // We'll define the functions in the test scope since they are not exported from main.js yet
  function safeQuery(selectors, context = document) {
    if (!Array.isArray(selectors)) selectors = [selectors];
    for (const selector of selectors) {
      try {
        const element = context.querySelector(selector);
        if (element) return element;
      } catch (e) {} // eslint-disable-line no-empty
    }
    return null;
  }

  function findByText(text, context = document) {
    const elements = context.querySelectorAll('*');
    return Array.from(elements).find(el => 
      el.textContent.trim().toLowerCase() === text.toLowerCase() && 
      el.children.length === 0
    );
  }

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="old-class">Old Content</div>
          <div class="obfuscated_123">New Content</div>
          <button class="styles_tab__abc">Actions</button>
          <span>Spells</span>
        </body>
      </html>
    `);
    window = dom.window;
    document = window.document;
  });

  it('should find elements by multiple selectors in safeQuery', function() {
    const el = safeQuery(['.non-existent', '.obfuscated_123']);
    assert.strictEqual(el.textContent, 'New Content');
  });

  it('should find elements by text content', function() {
    const btn = findByText('Actions');
    assert.strictEqual(btn.tagName, 'BUTTON');
    
    const span = findByText('Spells');
    assert.strictEqual(span.tagName, 'SPAN');
  });

  it('should return null if no element matches', function() {
    const el = safeQuery(['.missing']);
    assert.strictEqual(el, null);
    
    const txt = findByText('Missing');
    assert.strictEqual(txt, undefined);
  });
});
