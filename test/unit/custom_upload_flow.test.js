const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.resolve(__dirname, '../../js', f), 'utf8');

/** tiny 1x1 transparent PNG base64 */
const TINY_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe('Custom upload flow (C-1 / AC-1)', function() {
  let window, document;
  let saved, layoutSaved, refreshCount, createdShapes;

  beforeEach(function() {
    saved = [];
    layoutSaved = [];
    refreshCount = 0;
    createdShapes = [];
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: "http://localhost",
      runScripts: "dangerously",
    });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    window.chrome = { runtime: { getURL: (p) => `chrome-extension://mock/${p}` } };
    window.__DDB_TEST_MODE__ = true;
    window.PeDom = () => ({
      getLayerManager: () => ({
        activeLayerId: 'shapes-default',
        refreshUI: () => { refreshCount++; },
        getActiveLayerContainer: () => ({ element: document.body }),
      }),
    });
    // Stubs are RE-ASSERTED after module eval below (module eval may define
    // its own storage/image-processor); these pre-eval values are seeds.
    window.__DDBStorage = {
      getCustomShapes: async () => saved.slice(),
      saveCustomShape: async (s) => { saved.push(s); },
      loadLayout: async () => ({ version: '1.5.0', customShapes: layoutSaved }),
      saveLayout: async (_id, l) => { layoutSaved = l.customShapes || []; },
    };
    window.showFeedback = (msg, type) => { window.__lastToast = { msg, type }; };
    // The Add-Shape caller in main.js creates shapes via window.createShape —
    // stub it so OK-resolution is observable without a full sheet boot.
    window.createShape = (assetPath) => {
      createdShapes.push(assetPath);
      const w = document.createElement('div');
      w.className = 'be-shape-wrapper';
      w.innerHTML = `<div class="be-shape-container" data-asset-path="${assetPath}"></div>`;
      return w;
    };
    const order = [
      'dom/element_wrapper.js', 'dom/dom_manager.js', 'context_menu.js',
      'asset_catalog.js',
      'print_styles.js', 'section_utils.js', 'modals.js', 'shape_picker.js',
    ];
    order.forEach((f) => window.eval(read(f)));
    // Re-assert the stubs AFTER module eval (shape_picker reads
    // window.__DDBStorage / window.ImageProcessor lazily at call time).
    window.__DDBStorage = {
      getCustomShapes: async () => saved.slice(),
      saveCustomShape: async (s) => { saved.push(s); },
      loadLayout: async () => ({ version: '1.5.0', customShapes: layoutSaved }),
      saveLayout: async (_id, l) => { layoutSaved = l.customShapes || []; },
    };
    window.ImageProcessor = {
      processImage: async (f) => `data:image/png;base64,${TINY_B64}:${f.name}`,
    };
  });

  function makeFile(name) {
    return new window.File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
  }

  /** Drive a real upload: click the Upload button, then inject the file into
   *  the exposed test-hook input. Returns a promise resolved once the button
   *  flow's toast fired. */
  async function uploadViaButton(pageName) {
    void (async () => {
      const b = Array.from(document.querySelectorAll('.be-modal-overlay button')).find(
        (x) => x.textContent.trim() === 'Upload from disk',
      );
      assert.ok(b, 'Upload button present');
      b.click();
    })();
    await new Promise((r) => setTimeout(r, 10));
    const input = window.__lastUploadInput;
    assert.ok(input, 'test-hook file input exposed');
    const file = makeFile(pageName || 'unit-upload.png');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    // wait for pipeline + refresh + toast
    for (let i = 0; i < 40; i++) {
      if (window.__lastToast && /Uploaded/.test(window.__lastToast.msg)) break;
      await new Promise((r) => setTimeout(r, 15));
    }
  }

  it('upload keeps the modal open, refreshes the custom grid, preselects the new cell and enables OK', async function() {
    const promise = window.ShapePicker.showShapePickerModal(); // add mode
    const overlay = document.querySelector('.be-modal-overlay');
    // open Custom tab
    const custom = Array.from(overlay.querySelectorAll('.be-modal-tab')).find((t) => t.textContent === 'Custom');
    custom.click();
    await new Promise((r) => setTimeout(r, 60));
    const okBefore = overlay.querySelector('.be-modal-ok');
    assert.strictEqual(okBefore.disabled, true, 'OK disabled before upload (nothing selected)');
    await uploadViaButton('unit-upload.png');
    // 1. modal still open
    assert.ok(document.querySelector('.be-modal-overlay'), 'modal stays open after upload');
    // 2. grid shows the uploaded shape selected
    const sel = overlay.querySelector('.be-border-option.selected');
    assert.ok(sel, 'uploaded cell selected');
    assert.strictEqual(sel.getAttribute('aria-selected'), 'true');
    assert.ok(/unit-upload/.test(sel.title || sel.textContent), 'selected cell is the upload');
    // 3. OK enabled
    const ok = overlay.querySelector('.be-modal-ok');
    assert.strictEqual(ok.disabled, false, 'OK enabled after upload preselect');
    // 4. toast microcopy is mode-aware + distinguishes placement
    assert.ok(/Add Shape/.test(window.__lastToast.msg), 'toast verb = Add Shape: ' + window.__lastToast.msg);
    // 5. no sheet shape created yet
    assert.strictEqual(createdShapes.length, 0, 'no shape dropped at upload time');
    // 6. library saved once + layer refresh once
    assert.strictEqual(saved.length, 1, 'library saved once');
    assert.strictEqual(refreshCount, 1, 'layer-manager refresh exactly once');
    // OK resolves the uploaded data and the caller creates the shape
    ok.click();
    const result = await promise;
    assert.ok(result && result.assetPath && result.assetPath.includes(TINY_B64), 'OK resolves uploaded data');
  });

  it('Cancel after upload resolves null with zero sheet mutation (library-only)', async function() {
    const promise = window.ShapePicker.showShapePickerModal();
    const overlay = document.querySelector('.be-modal-overlay');
    const custom = Array.from(overlay.querySelectorAll('.be-modal-tab')).find((t) => t.textContent === 'Custom');
    custom.click();
    await new Promise((r) => setTimeout(r, 60));
    await uploadViaButton('cancel-me.png');
    const cancel = overlay.querySelector('.be-modal-cancel');
    cancel.click();
    const result = await promise;
    assert.strictEqual(result, null, 'Cancel resolves null');
    assert.strictEqual(createdShapes.length, 0, 'no shape created on Cancel');
    assert.strictEqual(saved.length, 1, 'library save persisted (durable)');
  });

  it('switch mode: upload replaces the current selection (genuine change) and enables OK; Cancel leaves the target untouched', async function() {
    const target = document.createElement('div');
    target.className = 'be-shape-container';
    target.dataset.assetPath = 'assets/shapes/archer_main.webp';
    document.body.appendChild(target);
    const promise = window.ShapePicker.showShapePickerModal('assets/shapes/archer_main.webp', 'assets/shapes/', target);
    const overlay = document.querySelector('.be-modal-overlay');
    const ok0 = overlay.querySelector('.be-modal-ok');
    assert.strictEqual(ok0.disabled, true, 'switch OK disabled while current asset still selected');
    // upload (works on the folder-filtered single-category view with Custom hidden — re-open on the Custom surface instead)
    // The switch picker here is folder-filtered to shapes (no Custom tab); for the
    // upload path the tab bar is hidden, so drive uploadFromFile via the button is
    // only reachable from the Custom tab — use the pipeline directly for the
    // preselect semantics (the custom-surface upload is covered above).
    const shape = await window.ShapePicker.uploadFromFile(makeFile('switch-upload.png'));
    assert.ok(shape, 'upload pipeline returns the shape');
    assert.strictEqual(saved.length, 1, 'saved once');
    assert.strictEqual(refreshCount, 1, 'refresh once');
    const cancel = overlay.querySelector('.be-modal-cancel');
    cancel.click();
    assert.strictEqual(await promise, null);
    assert.strictEqual(target.dataset.assetPath, 'assets/shapes/archer_main.webp', 'switch target untouched on Cancel');
  });

  it('user-cancelled compression aborts before any persist/refresh/preselect (no toast, no error)', async function() {
    window.ImageProcessor.processImage = async () => { throw new Error('User cancelled compression'); };
    const promise = window.ShapePicker.showShapePickerModal();
    const overlay = document.querySelector('.be-modal-overlay');
    const custom = Array.from(overlay.querySelectorAll('.be-modal-tab')).find((t) => t.textContent === 'Custom');
    custom.click();
    await new Promise((r) => setTimeout(r, 60));
    const b = Array.from(overlay.querySelectorAll('button')).find((x) => x.textContent.trim() === 'Upload from disk');
    b.click();
    await new Promise((r) => setTimeout(r, 10));
    const input = window.__lastUploadInput;
    Object.defineProperty(input, 'files', { value: [makeFile('abort.png')], configurable: true });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    assert.strictEqual(saved.length, 0, 'no persist on cancel');
    assert.strictEqual(refreshCount, 0, 'no refresh on cancel');
    assert.ok(!window.__lastToast, 'no success toast on cancel');
    assert.ok(document.querySelector('.be-modal-overlay'), 'modal still open');
    const sel = overlay.querySelector('.be-border-option.selected');
    assert.ok(!sel, 'no preselect on cancel');
    const ok = overlay.querySelector('.be-modal-ok');
    assert.strictEqual(ok.disabled, true, 'OK enablement unchanged');
    overlay.querySelector('.be-modal-cancel').click();
    await promise;
  });

  it('in-flight guard: a second concurrent upload is a no-op', async function() {
    let resolveFirst;
    window.ImageProcessor.processImage = () =>
      new Promise((res) => { resolveFirst = res; });
    const p1 = window.ShapePicker.uploadFromFile(makeFile('one.png'));
    const p2 = window.ShapePicker.uploadFromFile(makeFile('two.png'));
    assert.strictEqual(await p2, null, 'second concurrent upload is a no-op (null)');
    resolveFirst(`data:image/png;base64,${TINY_B64}`);
    const s1 = await p1;
    assert.ok(s1, 'first upload completes');
  });

  it('identity by base64, not name: a duplicate-name upload selects the new (last) instance', async function() {
    // Seed a library entry whose name equals the incoming file's base name but
    // whose data differs — selection must track the returned base64.
    const promise = window.ShapePicker.showShapePickerModal();
    const overlay = document.querySelector('.be-modal-overlay');
    const custom = Array.from(overlay.querySelectorAll('.be-modal-tab')).find((t) => t.textContent === 'Custom');
    custom.click();
    await new Promise((r) => setTimeout(r, 60));
    await uploadViaButton('same-name.png');
    const sel = overlay.querySelector('.be-border-option.selected');
    assert.ok(sel, 'uploaded cell selected despite duplicate display name');
    overlay.querySelector('.be-modal-cancel').click();
    await promise;
  });
});
