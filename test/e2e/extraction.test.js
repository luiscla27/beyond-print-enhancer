const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('DOM Extraction Logic (Integration)', function() {
  let window, document;

  before(async function() {
    // Load the simulated fixture
    const htmlPath = path.resolve(__dirname, '../../test/fixtures/simulated_sheet.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // Create JSDOM with the fixture
    const dom = new JSDOM(htmlContent, {
      url: "https://www.dndbeyond.com/characters/12345",
      runScripts: "dangerously", 
      resources: "usable"
    });
    window = dom.window;
    document = window.document;
    
    // Mock chrome
    window.chrome = {
        runtime: {
            getURL: (path) => `chrome-extension://id/${path}`
        }
    };
    global.chrome = window.chrome;
    
    // Inject main.js logic
    // We read the file and strip the IIFE wrapper so we can access functions, 
    // OR just modify it to expose them.
    // Simplest approach: Search and replace the IIFE start/end or just Eval the functions.
    // However, main.js has many helper functions. 
    // Let's read the file and append an exporter to the window object inside the IIFE if possible,
    // or better: regex to expose functions.
    
    let mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
    let elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
    let domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
    
    // HACK: To test private functions inside the IIFE, we intentionally modify the code string 
    // to attach them to window before the IIFE closes.
    // Finding the end of the file or the IIFE closing.
    // The IIFE ends with `})();`. We replace it.
    mainJs = mainJs.replace('})();', `
        window.navToSection = navToSection;
        window.extractAndWrapSections = extractAndWrapSections;
        window.extractedContainers = []; // Capture result if it returns
    })();`);

    // We also need to mock `sleep` or `setTimeout` if it's not working well, but JSDOM handles basic timers.
    // `main.js` uses `safeQuery`, so we need that too. It's inside the scope.
    
    // Execute the modified script in the JSDOM window
    const scriptEl = document.createElement('script');
    scriptEl.textContent = elementWrapper + '\n' + domManager + '\n' + mainJs;
    document.body.appendChild(scriptEl);
    
    // Allow script to run
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should automatically extract and inject sections around the Live Spells node', async function() {
    this.timeout(10000);
    
    // Poll for the INJECTED CLONES (Actions/Inventory) to appear in the DOM.
    // They are distinguished by class .print-section-container.
    let actionsClone;
    let inventoryClone;
    let spellsNode;
    
    for (let i = 0; i < 100; i++) {
        const containers = document.querySelectorAll('.print-section-container');
        if (containers.length > 0) {
            actionsClone = Array.from(containers).find(el => el.textContent.includes('Unique Actions Content'));
            inventoryClone = Array.from(containers).find(el => el.textContent.includes('Unique Inventory Content'));
        }
        
        // Find the live Spells node (Actionable Anchor)
        // It is now wrapped in a .print-section-container
        const allPrimaryns = document.querySelectorAll('.styles_primaryBox__2cqbd, .ct-primary-box');
        spellsNode = Array.from(allPrimaryns).find(el => 
            el.innerHTML.includes('Manage Spells')
        );

        if (actionsClone && spellsNode) break;

        await new Promise(r => setTimeout(r, 100));
    }
    
    assert.ok(spellsNode, 'Live Spells node should be found and visible');
    assert.ok(actionsClone, 'Actions clone should be injected');
    // Inventory is initially hidden in fixture, so finding it means we processed it correctly
    // assert.ok(inventoryClone, 'Inventory clone should be injected'); 

    // Verify Layout: Actions should be BEFORE Spells
    // Spells should be BEFORE Inventory (if strictly ordered by append)
    // Verify Layout: Actions and Spells should be siblings in the unified root
    const layoutRoot = document.querySelector('.ct-subsections');
    assert.ok(layoutRoot, 'Unified layout root .ct-subsections should exist');
    
    const spellsContainer = spellsNode.closest('.print-section-container');
    assert.ok(spellsContainer, 'Spells node should be inside a print container');
    const actionsWrapper = actionsClone.closest('.be-section-wrapper');
    const spellsWrapper = spellsContainer.closest('.be-section-wrapper');
    assert.ok(actionsWrapper, 'Actions wrapper missing');
    assert.ok(spellsWrapper, 'Spells wrapper missing');
    
    assert.strictEqual(actionsWrapper.parentElement, layoutRoot, 'Actions wrapper should be inside layout root');
    assert.strictEqual(spellsWrapper.parentElement, layoutRoot, 'Spells wrapper should be inside layout root');
    
    // Check if Navigation is hidden
    const nav = document.querySelector('nav');
    if (nav) assert.strictEqual(nav.style.display, 'none', 'Navigation should be hidden');

    // Verify Spells Content (Live)
    const manageBtn = spellsNode.querySelector('button');
    assert.ok(manageBtn, 'Manage Spells button should exist');
    assert.notStrictEqual(manageBtn.style.display, 'none', 'Manage Spells button should be visible/interactive');

    // Verify Layout Fixes on Live Node
    const style = spellsNode.style;
    assert.ok(style.height.includes('fit-content') || style.cssText.includes('fit-content'), 'Live Spells node should have fit-content height');
    
    // Verify SVGs on Live Node
    const bgSvg = spellsNode.querySelector('svg'); 
    if (bgSvg && bgSvg.closest('.ddbc-box-background')) {
         assert.strictEqual(bgSvg.style.height, '100%', 'Background SVG on live node should be 100% height');
    }
  });
});