const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const elementWrapperPath = path.resolve(__dirname, '../../js/dom/element_wrapper.js');
const domManagerPath = path.resolve(__dirname, '../../js/dom/dom_manager.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
const elementWrapperContent = fs.readFileSync(elementWrapperPath, 'utf8');
const domManagerContent = fs.readFileSync(domManagerPath, 'utf8');
const contextMenuPath = path.resolve(__dirname, '../../js/context_menu.js');
const contextMenuContent = fs.readFileSync(contextMenuPath, 'utf8');
const assetCatalogPath = path.resolve(__dirname, '../../js/asset_catalog.js');
const assetCatalogContent = fs.readFileSync(assetCatalogPath, 'utf8');
const storagePath = path.resolve(__dirname, '../../js/storage.js');
const storageContent = fs.readFileSync(storagePath, 'utf8');
const imageProcessorPath = path.resolve(__dirname, '../../js/image_processor.js');
const imageProcessorContent = fs.readFileSync(imageProcessorPath, 'utf8');
const sectionUtilsPath = path.resolve(__dirname, '../../js/section_utils.js');
const sectionUtilsContent = fs.readFileSync(sectionUtilsPath, 'utf8');
const sectionCloningPath = path.resolve(__dirname, '../../js/section_cloning.js');
const sectionCloningContent = fs.readFileSync(sectionCloningPath, 'utf8');
const layoutOpsPath = path.resolve(__dirname, '../../js/layout_ops.js');
const layoutOpsContent = fs.readFileSync(layoutOpsPath, 'utf8');
const filtersPath = path.resolve(__dirname, '../../js/filters.js');
const filtersContent = fs.readFileSync(filtersPath, 'utf8');
const spellsUiPath = path.resolve(__dirname, '../../js/spells_ui.js');
const spellsUiContent = fs.readFileSync(spellsUiPath, 'utf8');
const modalsPath = path.resolve(__dirname, '../../js/modals.js');
const modalsContent = fs.readFileSync(modalsPath, 'utf8');
const shapePickerPath = path.resolve(__dirname, '../../js/shape_picker.js');
const shapePickerContent = fs.readFileSync(shapePickerPath, 'utf8');
const propertiesPanelPath = path.resolve(__dirname, '../../js/properties_panel.js');
const propertiesPanelContent = fs.readFileSync(propertiesPanelPath, 'utf8');
const controlsPath = path.resolve(__dirname, '../../js/controls.js');
const controlsContent = fs.readFileSync(controlsPath, 'utf8');
const layoutScanPath = path.resolve(__dirname, '../../js/layout_scan.js');
const layoutScanContent = fs.readFileSync(layoutScanPath, 'utf8');
const layoutApplyPath = path.resolve(__dirname, '../../js/layout_apply.js');
const layoutApplyContent = fs.readFileSync(layoutApplyPath, 'utf8');
const persistencePath = path.resolve(__dirname, '../../js/persistence.js');
const persistenceContent = fs.readFileSync(persistencePath, 'utf8');

const printStylesPath = path.resolve(__dirname, '../../js/print_styles.js');
const printStylesContent = fs.readFileSync(printStylesPath, 'utf8');




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
            greyscale: 100,
            sepia: 0
        }),
        saveFilter: () => Promise.resolve(),
        saveHueShift: () => Promise.resolve(),
        init: () => Promise.resolve()
    };
    window.chrome = {
        runtime: {
            getURL: (path) => path
        }
    };
    

    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
    window.__DDB_TEST_MODE__ = true;
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(contextMenuContent);
    window.eval(assetCatalogContent);
    window.eval(storageContent);
window.eval(imageProcessorContent);
window.eval(printStylesContent);
window.eval(sectionUtilsContent);
    window.eval(modalsContent);
    window.eval(propertiesPanelContent);
    window.eval(layoutScanContent);
    window.eval(layoutApplyContent);
    window.eval(persistenceContent);
    window.eval(controlsContent);
    window.eval(shapePickerContent);
    window.eval(spellsUiContent);
    window.eval(filtersContent);
    window.eval(layoutOpsContent);
    window.eval(sectionCloningContent);
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
    assert.strictEqual(contrastSlider.max, '200');

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
        if (labelText.includes('Contrast') || labelText.includes('Saturate') || labelText.includes('Greyscale')) {
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
    sliders.forEach((s) => {
        s.value = "50";
        s.dispatchEvent(new window.Event('input'));
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
        
        if (labelText.includes('Hue Shift')) {
            assert.strictEqual(slider.value, "50", "Hue Shift should NOT be reset by global button");
        } else if (labelText.includes('Contrast') || labelText.includes('Saturate') || labelText.includes('Greyscale')) {
            assert.strictEqual(slider.value, "100", `Slider for ${labelText} should reset to 100, but got ${slider.value}`);
        } else {
            assert.strictEqual(slider.value, "0", `Slider for ${labelText} should reset to 0, but got ${slider.value}`);
        }
    }
  });

  it('should have a Color Picker button and a hidden 2D grid modal', async function() {
    let controls = document.getElementById('print-enhance-controls');
    if (!controls) {
        window.createControls();
        controls = document.getElementById('print-enhance-controls');
    }
    
    // Find the hue picker row
    const hueRow = Array.from(controls.querySelectorAll('div')).find(div => div.querySelector('label')?.textContent.includes('Hue Shift'));
    const colorPickerBtn = Array.from(hueRow.querySelectorAll('button')).find(btn => btn.textContent.includes('Color Picker'));
    
    assert.ok(colorPickerBtn, 'Should have a Color Picker button');
    
    // Check if the modal exists in the body
    const huePicker = document.querySelector('div[style*="z-index: 20000"]');
    assert.ok(huePicker, 'Hue picker modal should exist in the body');
    assert.strictEqual(huePicker.style.display, 'none', 'Modal should be hidden by default');
    
    // Open picker
    colorPickerBtn.click();
    assert.strictEqual(huePicker.style.display, 'flex', 'Modal should be visible after click');
    
    // Should have 600 swatches (60 hues x 10 saturations)
    const swatches = huePicker.querySelectorAll('div[title^="Hue:"]');
    assert.strictEqual(swatches.length, 600, 'Should have 600 swatches in the 2D grid');
    
    // Clicking a swatch should update sliders
    const hueSlider = hueRow.querySelector('input[type="range"]');
    const saturateRow = Array.from(controls.querySelectorAll('div')).find(div => div.querySelector('label')?.textContent.includes('Saturate'));
    const saturateSlider = saturateRow.querySelector('input[type="range"]');
    
    // Find a swatch for 180 degrees, 120% saturation (i=30, sat index=5)
    const targetSwatch = Array.from(swatches).find(s => s.title === 'Hue: 180°, Sat: 120%');
    assert.ok(targetSwatch, 'Should find the target swatch');
    
    targetSwatch.click();
    assert.strictEqual(hueSlider.value, "180", "Hue slider should update to 180");
    assert.strictEqual(saturateSlider.value, "120", "Saturate slider should update to 120");
  });
});
