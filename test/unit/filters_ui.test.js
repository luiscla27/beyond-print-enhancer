const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Filters UI', function() {
  let window, document;

  before(function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    
    // Mock Storage
    window.Storage = {
        getFilters: () => Promise.resolve({
            hue: 0,
            contrast: 100,
            saturate: 100,
            greyscale: 0,
            sepia: 0
        }),
        saveFilter: () => Promise.resolve(),
        saveHueShift: () => Promise.resolve(),
        init: () => Promise.resolve()
    };
    
    window.__DDB_TEST_MODE__ = true;
    window.chrome = {
        runtime: {
            getURL: (path) => path
        }
    };
    
    window.eval(mainJsContent);
  });

  it('should create all five filter sliders in the controls panel', async function() {
    let controls = document.getElementById('print-enhance-controls');
    if (!controls) {
        window.createControls();
        controls = document.getElementById('print-enhance-controls');
    }
    
    assert.ok(controls, 'Controls panel should exist');
    
    const sliders = Array.from(controls.querySelectorAll('input[type="range"]'));
    assert.strictEqual(sliders.length, 5, 'Should have 5 sliders');

    const labels = Array.from(controls.querySelectorAll('label')).map(l => l.textContent);
    
    // Check for specific labels
    assert.ok(labels.some(l => l.includes('Hue Shift')), 'Hue Shift slider missing');
    assert.ok(labels.some(l => l.includes('Contrast')), 'Contrast slider missing');
    assert.ok(labels.some(l => l.includes('Saturate')), 'Saturate slider missing');
    assert.ok(labels.some(l => l.includes('Greyscale')), 'Greyscale slider missing');
    assert.ok(labels.some(l => l.includes('Sepia')), 'Sepia slider missing');

    // Check ranges
    const hueSlider = sliders.find((s, i) => labels[i].includes('Hue Shift'));
    assert.strictEqual(hueSlider.min, '0');
    assert.strictEqual(hueSlider.max, '360');

    const contrastSlider = sliders.find((s, i) => labels[i].includes('Contrast'));
    assert.strictEqual(contrastSlider.min, '0');
    assert.strictEqual(contrastSlider.max, '300');

    const greyscaleSlider = sliders.find((s, i) => labels[i].includes('Greyscale'));
    assert.strictEqual(greyscaleSlider.min, '0');
    assert.strictEqual(greyscaleSlider.max, '100');
  });
});
