const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('UI - Trigger Injection', function() {
  let window, document;

  before(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="ct-spells-spell">
            <div class="ct-spells-spell__label">Fireball</div>
          </div>
          <div id="clone-container">
            <div class="ct-spells-spell">
              <div class="ct-spells-spell__label">Magic Missile</div>
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
    window.eval(mainJsContent);
  });

  it('should inject a "Details" button into spell rows', function() {
    window.injectSpellDetailTriggers();
    
    const fireballRow = document.querySelector('.ct-spells-spell:nth-child(1)');
    const button = fireballRow.querySelector('.be-spell-details-button');
    
    assert.ok(button, 'Button should be injected');
    assert.strictEqual(button.innerText, 'Details');
  });

  it('should inject buttons into rows within a specific context (clones)', function() {
    const cloneContainer = document.getElementById('clone-container');
    window.injectSpellDetailTriggers(cloneContainer);
    
    const magicMissileRow = cloneContainer.querySelector('.ct-spells-spell');
    const button = magicMissileRow.querySelector('.be-spell-details-button');
    
    assert.ok(button, 'Button should be injected into clone context');
  });

  it('should not inject duplicate buttons', function() {
    window.injectSpellDetailTriggers();
    window.injectSpellDetailTriggers();
    
    const fireballRow = document.querySelector('.ct-spells-spell:nth-child(1)');
    const buttons = fireballRow.querySelectorAll('.be-spell-details-button');
    
    assert.strictEqual(buttons.length, 1, 'Should not have duplicate buttons');
  });
});
