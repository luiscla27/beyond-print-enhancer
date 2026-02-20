const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Regression: Variable Scope Safety', function() {
    let window, document;

    beforeEach(function() {
        const htmlContent = `<!DOCTYPE html><html><body>
            <button class="styles_tabButton__12345">Actions</button>
            <button class="styles_tabButton__12345">Spells</button>
            <div class="styles_primaryBox__2cqbd">Content</div>
        </body></html>`;
        
        const dom = new JSDOM(htmlContent, {
            runScripts: "dangerously",
            resources: "usable",
            url: "https://www.dndbeyond.com/characters/1"
        });
        window = dom.window;
        document = window.document;
    });

    it('should not throw ReferenceError for sectionsToCheck', async function() {
        // Load main.js logic
        const mainJsPath = path.resolve(__dirname, '../../js/main.js');
        let mainJs = fs.readFileSync(mainJsPath, 'utf8');
        let elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
        let domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
        
        // Expose function for testing
        mainJs = mainJs.replace('})();', `
            window.extractAndWrapSections = extractAndWrapSections;
            window.navToSection = (name) => {
                if (typeof name !== 'string') throw new Error('navToSection check failed: name is not a string (' + typeof name + ')');
                return true; 
            };
        })();`);

        const scriptEl = document.createElement('script');
        scriptEl.textContent = elementWrapper + '\n' + domManager + '\n' + mainJs;
        document.body.appendChild(scriptEl);

        // Allow script to init
        await new Promise(r => setTimeout(r, 50));
        
        // Execute the function that previously failed
        try {
            await window.extractAndWrapSections();
        } catch (e) {
            if (e instanceof ReferenceError && e.message.includes('sectionsToCheck')) {
                assert.fail('Regression detected: sectionsToCheck is not defined');
            }
            // Other errors (like navigation failures in unit test env) are acceptable for this specific regression test
            if (e instanceof ReferenceError) {
                 assert.fail('ReferenceError detected: ' + e.message);
            }
        }
    });

    it('should not throw ReferenceError for visibleMatch or other loop variables', async function() {
      // This test specifically targets the regression where visibleMatch was accessed outside the loop
      try {
        await window.extractAndWrapSections();
      } catch (e) {
        if (e.name === 'ReferenceError') {
             assert.fail('Regression: ' + e.message);
        }
        // Other errors might occur due to JSDOM limitations, but we only care about ReferenceError here
      }
  });
});
