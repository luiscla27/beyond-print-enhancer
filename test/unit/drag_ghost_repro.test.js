const assert = require('assert');
const { JSDOM } = require('jsdom');
require("fake-indexeddb/auto");

describe('Drag Ghost Reproduction', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="print-layout-wrapper" style="position: relative;">
            <div class="be-section-wrapper be-shape-wrapper" id="shape1" style="position: absolute !important; top: 100px !important; left: 100px !important; width: 50px; height: 50px;">
                <div class="print-section-header" draggable="true">Header</div>
                <div class="print-section-container">
                    <div class="be-shape-content">Shape</div>
                </div>
            </div>
        </div>
    </body></html>`, {
      url: "http://localhost",
    });
    window = dom.window;
    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    global.Node = window.Node;
    global.Image = window.Image;
  });

  it('should demonstrate that !important styles are inherited by cloneNode and resist non-important updates', function() {
    const target = document.getElementById('shape1');
    
    // Initial state
    assert.strictEqual(target.style.top, '100px');
    
    // Clone it
    const clone = target.cloneNode(true);
    document.body.appendChild(clone);
    
    // The clone should have !important in its style attribute if target had it
    // Note: JSDOM's style implementation might differ slightly in how it exposes !important
    // but in a real browser it definitely carries over.
    
    // Try to update top without !important
    clone.style.top = '200px';
    
    // In JSDOM, let's see what happens
    console.log('Clone top after update:', clone.style.top);
    
    // If it's still 100px, then !important prevented the update.
    // Or if it's 200px but visually overridden? 
    // Actually, setting .style.top = '200px' in JS usually clears the !important if it wasn't there, 
    // or fails to override it if it was.
  });
});
