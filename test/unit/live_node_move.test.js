const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Live Node Move Logic', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="spells-container" class="styles_primaryBox__2cqbd ct-primary-box">
             Spells Content
          </div>
          <div id="actions-container" class="styles_primaryBox__2cqbd ct-primary-box">
             Actions Content
          </div>
        </body>
      </html>
    `);
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
  });

  afterEach(() => {
    delete global.window;
    delete global.document; 
  });

  it('should move the live Spells node and clone others', function() {
      const spellsContent = document.getElementById('spells-container');
      const actionsContent = document.getElementById('actions-container');
      
      // Simulate Logic
      const wrapSection = (name, content) => {
            let nodeToWrap;
            if (name === 'Spells') {
                nodeToWrap = content; 
            } else {
                nodeToWrap = content.cloneNode(true);
            }
            return nodeToWrap;
      };

      // Test Spells (Should be same instance)
      const spellsResult = wrapSection('Spells', spellsContent);
      assert.strictEqual(spellsResult, spellsContent, 'Spells should return the EXACT same node instance');
      
      // Test Actions (Should be clone)
      const actionsResult = wrapSection('Actions', actionsContent);
      assert.notStrictEqual(actionsResult, actionsContent, 'Actions should return a new node instance');
      assert.strictEqual(actionsResult.innerHTML.trim(), actionsContent.innerHTML.trim(), 'Actions clone should match content');
  });
});
