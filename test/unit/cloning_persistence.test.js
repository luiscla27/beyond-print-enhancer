const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Cloning Persistence', function() {
  let window, document, Storage;

  before(async function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
             <div class="print-section-container" id="section-Actions" style="left: 10px; top: 10px; width: 100px; height: 100px;">
                <div class="print-section-header"><span>Actions</span></div>
                <div class="print-section-content"><p>Actions Content</p></div>
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
    window.indexedDB = global.indexedDB;
    
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    
    window.__DDB_TEST_MODE__ = true;
    window.eval(mainJsContent);
    Storage = window.Storage;
    await Storage.init();
  });

  it('should include clones in scanLayout', function() {
    // Manually add a clone to the DOM
    const clone = document.createElement('div');
    clone.id = 'clone-123';
    clone.className = 'print-section-container be-clone';
    clone.style.left = '50px';
    clone.style.top = '50px';
    clone.style.width = '150px';
    clone.style.height = '150px';
    
    const header = document.createElement('div');
    header.className = 'print-section-header';
    header.innerHTML = '<span>My Clone</span>';
    clone.appendChild(header);
    
    const content = document.createElement('div');
    content.className = 'print-section-content';
    content.innerHTML = '<p>Clone Content</p>';
    clone.appendChild(content);
    
    document.getElementById('print-layout-wrapper').appendChild(clone);
    
    const layout = window.scanLayout();
    
    assert.ok(layout.clones, 'Clones array missing in layout');
    const savedClone = layout.clones.find(c => c.id === 'clone-123');
    assert.ok(savedClone, 'Clone 123 not found in saved layout');
    assert.strictEqual(savedClone.title, 'My Clone');
    assert.strictEqual(savedClone.html, '<p>Clone Content</p>');
    assert.strictEqual(savedClone.left, '50px');
    assert.strictEqual(savedClone.top, '50px');
  });

  it('should restore clones in applyLayout', function() {
    const layout = {
        version: '1.0.0',
        sections: {
            'section-Actions': { left: '20px', top: '20px' }
        },
        clones: [
            {
                id: 'clone-456',
                originalId: 'section-Actions',
                title: 'Restored Clone',
                html: '<p>Restored Content</p>',
                left: '100px',
                top: '100px',
                width: '200px',
                height: '200px'
            }
        ]
    };
    
    window.applyLayout(layout);
    
    const restoredClone = document.getElementById('clone-456');
    assert.ok(restoredClone, 'Clone 456 not restored in DOM');
    assert.ok(restoredClone.classList.contains('be-clone'), 'Missing be-clone class');
    assert.strictEqual(restoredClone.querySelector('.print-section-header span').textContent, 'Restored Clone');
    assert.ok(restoredClone.querySelector('.print-section-content').innerHTML.includes('Restored Content'));
    assert.strictEqual(restoredClone.style.left, '100px');
    assert.strictEqual(restoredClone.style.top, '100px');
  });
});
