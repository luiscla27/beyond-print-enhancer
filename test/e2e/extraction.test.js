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
    
    // Inject main.js logic
    // We read the file and strip the IIFE wrapper so we can access functions, 
    // OR just modify it to expose them.
    // Simplest approach: Search and replace the IIFE start/end or just Eval the functions.
    // However, main.js has many helper functions. 
    // Let's read the file and append an exporter to the window object inside the IIFE if possible,
    // or better: regex to expose functions.
    
    let mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
    
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
    scriptEl.textContent = mainJs;
    document.body.appendChild(scriptEl);
    
    // Allow script to run
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should automatically extract and append sections to the print wrapper', async function() {
    // The script runs immediately upon injection (IIFE).
    // We just need to wait for it to complete its async work.
    
    // Poll for the wrapper up to 2 seconds
    let wrapper;
    for (let i = 0; i < 20; i++) {
        wrapper = document.getElementById('print-layout-wrapper');
        if (wrapper) break;
        await new Promise(r => setTimeout(r, 100));
    }
    
    assert.ok(wrapper, 'Print layout wrapper should be created by the script');
    
    // Check for specific section
    // The wrapper mimics structure so it should have children that are the wrappers
    const sections = wrapper.querySelectorAll('.print-section-wrapper');
    assert.ok(sections.length > 0, 'Should have extracted sections');
    
    // Find the Actions section
    let actionsSection;
    sections.forEach(s => {
        if (s.innerHTML.includes('Attack Actions')) actionsSection = s;
    });
    
    assert.ok(actionsSection, 'Should contain attack actions');
    
    // Verify Structure Cloning
    const clonedPrimaryBox = actionsSection.querySelector('.styles_primaryBox__2cqbd');
    assert.ok(clonedPrimaryBox, 'Should preserve the structural class styles_primaryBox');
    assert.ok(clonedPrimaryBox.classList.contains('ct-primary-box'), 'Should preserve ct-primary-box');
    
    // Verify SVGs inside the content
    const svgContent = clonedPrimaryBox.querySelector('svg use');
    assert.ok(svgContent, 'Should preserve SVGs inside content');
    
    // Verify Global SVG defs were copied
    // copySvgDefinitions clones SVGs with defs into the wrapper
    const globalDefs = wrapper.querySelector('svg defs symbol#icon-sword');
    assert.ok(globalDefs, 'Should copy global SVG definitions to the print wrapper');
  });
});