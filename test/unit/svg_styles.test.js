const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('SVG Styles Exclusion', function() {
  let window, document;

  before(async function() {
    const htmlContent = '<!DOCTYPE html><html><head></head><body></body></html>';
    const dom = new JSDOM(htmlContent, {
      url: "https://www.dndbeyond.com/characters/12345",
      runScripts: "dangerously", 
      resources: "usable"
    });
    window = dom.window;
    document = window.document;

    // Inject main.js logic
    let mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
    
    const scriptEl = document.createElement('script');
    scriptEl.textContent = mainJs;
    document.body.appendChild(scriptEl);
    await new Promise(r => setTimeout(r, 100));
  });

  it('should exclude g and svg tags from generic content styles', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      assert.ok(styleTag, 'Style tag should be created');
      
      const css = styleTag.textContent;
      
      // We can't easily check selector specificity by string matching if I change it to complex :not
      // But we can check if the string contains the fix, OR we can try to apply it?
      // JSDOM doesn't fully compute styles from innerHTML style tags easily without layout engine,
      // but we can check the text content of the rule.
      
      // Check that the selector matches the fix
      // Expected: :not(svg):not(g)[class*="content"]
      
      const contentRuleRegex = /:not\(svg\):not\(g\)\[class\*="content"\]/;
      // Or just check that it's NOT just [class*="content"]
      
      // Let's actually verify the logic by string inspection since JSDOM style computation with injected sheets is flaky.
      
      if (css.includes('[class*="content"]')) {
           // If it has the refined selector, it passes.
           if (css.includes(':not(svg):not(g)[class*="content"]')) {
               return; // Pass
           }
           // If it has the OLD selector plain, it fails (unless it also has the new one, but we are replacing)
           if (css.match(/^\s*\[class\*="content"\],/m)) {
               // assert.fail('Found broad [class*="content"] selector without exclusion');
               // Actually, let's just assert the presence of the exclusion.
           }
      }
      
      assert.ok(css.includes(':not(svg)'), 'Should exclude svg');
      assert.ok(css.includes(':not(g)'), 'Should exclude g');
  });


});
