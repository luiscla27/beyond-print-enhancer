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

  it('should have a reset button for each slider that restores default value', async function() {
    let controls = document.getElementById('print-enhance-controls');
    if (!controls) {
        window.createControls();
        controls = document.getElementById('print-enhance-controls');
    }
    
    // Filter containers that contain a slider
    const rows = Array.from(controls.querySelectorAll('div')).filter(div => div.querySelector('input[type="range"]'));
    
    // For each slider, find its reset button and test it
    for (const row of rows) {
        const slider = row.querySelector('input[type="range"]');
        const label = row.querySelector('label');
        const resetBtn = Array.from(row.querySelectorAll('button')).find(btn => btn.textContent === '↺');
        
        assert.ok(resetBtn, `Reset button missing for slider ${slider.min}-${slider.max}`);
        
        const labelText = label.textContent;
        let defaultValue = "0";
        if (labelText.includes('Contrast') || labelText.includes('Saturate')) {
            defaultValue = "100";
        }

        // 1. Change value
        slider.value = "50";
        slider.dispatchEvent(new window.Event('input'));
        
        // 2. Click reset
        resetBtn.click();
        
        // 3. Verify state
        assert.strictEqual(slider.value, defaultValue, `Slider for ${labelText} should reset value to ${defaultValue}`);
        assert.ok(label.textContent.includes(defaultValue), `Label for ${labelText} should reset text to ${defaultValue}`);
    }
  });

  it('should have a global reset button that resets all filters except Hue', async function() {
    let controls = document.getElementById('print-enhance-controls');
    if (!controls) {
        window.createControls();
        controls = document.getElementById('print-enhance-controls');
    }
    
    const sliders = Array.from(controls.querySelectorAll('input[type="range"]'));
    const rows = Array.from(controls.querySelectorAll('div')).filter(div => div.querySelector('input[type="range"]'));
    
    // 1. Set all sliders to non-default values
    sliders.forEach((s, i) => {
        s.value = "50";
        s.dispatchEvent(new window.Event('input'));
        // console.log(`Slider ${i} set to ${s.value}`);
    });
    
    // 2. Click global reset
    const resetAllBtn = document.getElementById('be-reset-all-filters');
    assert.ok(resetAllBtn, 'Global reset button missing');
    resetAllBtn.click();
    
    // Wait for async effects
    await new Promise(r => setTimeout(r, 100));
    
    // 3. Verify state
    for (const row of rows) {
        const slider = row.querySelector('input[type="range"]');
        const labelText = row.querySelector('label').textContent;
        // console.log(`Verifying: ${labelText}, value: ${slider.value}`);
        
        if (labelText.includes('Hue Shift')) {
            assert.strictEqual(slider.value, "50", "Hue Shift should NOT be reset by global button");
        } else if (labelText.includes('Contrast') || labelText.includes('Saturate')) {
            assert.strictEqual(slider.value, "100", `Slider for ${labelText} should reset to 100, but got ${slider.value}`);
        } else {
            assert.strictEqual(slider.value, "0", `Slider for ${labelText} should reset to 0, but got ${slider.value}`);
        }
    }
  });

  it('should have a Quick Hue Picker with 10 swatches', async function() {
    let controls = document.getElementById('print-enhance-controls');
    if (!controls) {
        window.createControls();
        controls = document.getElementById('print-enhance-controls');
    }
    
    // Find the hue picker container (it's a grid inside the hue slider row)
    const hueRow = Array.from(controls.querySelectorAll('div')).find(div => div.querySelector('label')?.textContent.includes('Hue Shift'));
    const swatches = hueRow.querySelectorAll('div[title^="Set Hue to"]');
    
    assert.strictEqual(swatches.length, 10, 'Should have 10 swatches');
    
    // Check if clicking a swatch updates the hue slider
    const hueSlider = hueRow.querySelector('input[type="range"]');
    const firstSwatch = swatches[0]; // 0 degrees
    const middleSwatch = swatches[5]; // 180 degrees
    
    // Set to something else first
    hueSlider.value = "90";
    
    // Click 180 swatch
    middleSwatch.click();
    assert.strictEqual(hueSlider.value, "180", "Hue slider should update to 180 degrees");
    
    // Click 0 swatch
    firstSwatch.click();
    assert.strictEqual(hueSlider.value, "0", "Hue slider should update to 0 degrees");
  });
});
