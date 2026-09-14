const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.resolve(__dirname, '../../js', f), 'utf8');

describe('Picker previews + live hover-swap (B-5 / AC-5)', function() {
  let window, document;

  beforeEach(function() {
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
    window.PeDom = () => ({
      getLayerManager: () => ({
        activeLayerId: 'shapes-default',
        refreshUI: () => {},
        getActiveLayerContainer: () => ({ element: document.body }),
      }),
    });
    window.updateLayoutBounds = () => {};
    let boundsCalls = 0;
    window.__spyBounds = () => boundsCalls;
    const realBounds = window.updateLayoutBounds;
    window.updateLayoutBounds = () => { boundsCalls++; };
    window.__realBounds = realBounds;
    window.eval(read('asset_catalog.js'));
    window.eval(read('modals.js'));
    window.eval(read('shape_picker.js'));
  });

  const hover = (el, type) =>
    el.dispatchEvent(new window.MouseEvent(type, { bubbles: false }));
  const cells = () => Array.from(document.querySelectorAll('.be-border-option'));
  const cellByText = (t) => cells().find((c) => c.textContent.includes(t));
  const sortedClasses = (el) => Array.from(el.classList).sort();

  it('category-aware preview geometry: frames vs background/corner art panes', function() {
    window.ShapePicker.showShapePickerModal();
    // Borders tab → frame-style tiles.
    cells().forEach((c) => {
      const p = c.querySelector('.be-border-preview');
      assert.ok(p.classList.contains('be-frame-preview'), `border cell preview: ${c.textContent}`);
      assert.ok(!p.classList.contains('be-art-preview'));
    });
    document.querySelector('.be-modal-cancel').click();
    // Shapes tab → background/corner art panes.
    window.ShapePicker.showShapePickerModal('', 'assets/shapes/');
    cells().forEach((c) => {
      const p = c.querySelector('.be-border-preview');
      assert.ok(p.classList.contains('be-art-preview'), `shape cell preview: ${c.textContent}`);
    });
    // Style mode → frame-style tiles.
    document.querySelector('.be-modal-cancel').click();
    window.showAssetPickerModal({ mode: 'style', current: 'default-border' });
    cells().forEach((c) => {
      const p = c.querySelector('.be-border-preview');
      assert.ok(p.classList.contains('be-frame-preview'));
    });
  });

  it('style-mode hover swaps only the controlled class and restores byte-identical on leave', function() {
    const sec = document.createElement('div');
    sec.className = 'print-section-container goth_border foreign-cls';
    document.body.appendChild(sec);
    const promise = window.showAssetPickerModal({ mode: 'style', current: 'goth_border', target: sec });
    const before = sortedClasses(sec);
    const vine = cellByText('Vine');
    const lb = window.__spyBounds();
    hover(vine, 'mouseenter');
    // controlled swap + marker; foreign + unrelated preserved
    assert.ok(sec.classList.contains('vine_border'), 'hovered style applied');
    assert.ok(!sec.classList.contains('goth_border'), 'previous controlled style removed');
    assert.ok(sec.classList.contains('foreign-cls'), 'foreign class preserved');
    assert.ok(sec.classList.contains('be-hover-preview'), 'marker present');
    assert.strictEqual(window.__spyBounds(), lb, 'no layout-bounds churn during hover');
    // swap-to-swap without intermediate restore
    const dwarf = cellByText('Dwarf');
    hover(dwarf, 'mouseenter');
    assert.ok(sec.classList.contains('dwarf_border'));
    assert.ok(!sec.classList.contains('vine_border'), 'no class accumulation');
    hover(dwarf, 'mouseleave');
    assert.deepStrictEqual(sortedClasses(sec), before, 'byte-identical restore');
    document.querySelector('.be-modal-cancel').click();
    promise.catch(() => {});
  });

  it('interrupt paths: Esc and commit while a hover preview is active restore first', async function() {
    const sec = document.createElement('div');
    sec.className = 'print-section-container spikes_border keep-me';
    document.body.appendChild(sec);
    const promise = window.showAssetPickerModal({ mode: 'style', current: 'spikes_border', target: sec });
    const before = sortedClasses(sec);
    // hover a different style, then Esc while the preview is live
    const box = cellByText('Box');
    hover(box, 'mouseenter');
    assert.ok(sec.classList.contains('box_border'));
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.strictEqual(await promise, null);
    assert.deepStrictEqual(sortedClasses(sec), before, 'restored before cancel');
    assert.ok(!sec.classList.contains('be-hover-preview'), 'marker cleared');

    // commit path: hover Vine, click-select Goth, OK → restored + resolved Goth
    const p2 = window.showAssetPickerModal({ mode: 'style', current: 'spikes_border', target: sec });
    const before2 = sortedClasses(sec);
    hover(cellByText('Vine'), 'mouseenter');
    assert.ok(sec.classList.contains('vine_border'));
    cellByText('Goth').click();
    document.querySelector('.be-modal-ok').click();
    const res = await p2;
    assert.strictEqual(res.style, 'goth_border');
    assert.deepStrictEqual(sortedClasses(sec), before2, 'hover preview restored before commit');
    assert.ok(!sec.classList.contains('be-hover-preview'));
  });

  it('switch-mode asset hover swaps dataset + img src and restores exactly', function() {
    const shape = document.createElement('div');
    shape.className = 'be-shape-container';
    shape.dataset.assetPath = 'assets/shapes/archer_main.webp';
    const img = document.createElement('img');
    img.className = 'be-shape-asset';
    img.src = 'chrome-extension://mock/assets/shapes/archer_main.webp';
    shape.appendChild(img);
    document.body.appendChild(shape);
    const promise = window.ShapePicker.showShapePickerModal('assets/shapes/archer_main.webp', 'assets/shapes/', shape);
    const before = { path: shape.dataset.assetPath, src: img.getAttribute('src'), cls: sortedClasses(shape) };
    const shield = cellByText('Shield Stats');
    hover(shield, 'mouseenter');
    assert.strictEqual(shape.dataset.assetPath, 'assets/shapes/shield_stats.webp');
    assert.ok(img.getAttribute('src').includes('shield_stats'), 'img src swapped');
    assert.ok(shape.classList.contains('be-hover-preview'));
    hover(shield, 'mouseleave');
    assert.strictEqual(shape.dataset.assetPath, before.path, 'dataset restored');
    assert.strictEqual(img.getAttribute('src'), before.src, 'src restored');
    assert.deepStrictEqual(sortedClasses(shape), before.cls, 'classes restored');
    assert.ok(!shape.classList.contains('be-hover-preview'));
    document.querySelector('.be-modal-cancel').click();
    promise.catch(() => {});
  });

  it('add mode never mutates the sheet and shows the magnified in-modal strip instead', function() {
    window.ShapePicker.showShapePickerModal();
    const modalCells = cells();
    hover(modalCells[1], 'mouseenter');
    const strip = document.querySelector('.be-picker-hover-strip');
    assert.ok(strip, 'hover strip exists');
    assert.strictEqual(strip.style.display, 'flex', 'strip shown on hover');
    assert.ok(strip.querySelector('.be-border-preview'), 'magnified preview cloned into strip');
    assert.strictEqual(document.querySelector('.be-hover-preview'), null, 'no sheet element marked');
    hover(modalCells[1], 'mouseleave');
    assert.strictEqual(strip.style.display, 'none', 'strip hidden on leave');
  });

  it('leak suite: 10 open-hover-leave-close cycles leave zero markers', async function() {
    for (let i = 0; i < 10; i++) {
      const sec = document.createElement('div');
      sec.className = 'print-section-container default-border';
      document.body.appendChild(sec);
      const p = window.showAssetPickerModal({ mode: 'style', current: 'default-border', target: sec });
      const goth = cellByText('Goth');
      hover(goth, 'mouseenter');
      hover(goth, 'mouseleave');
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await p;
      assert.deepStrictEqual(sortedClasses(sec), ['default-border', 'print-section-container']);
      sec.remove();
    }
    assert.strictEqual(document.querySelectorAll('.be-hover-preview').length, 0, 'no leftover markers');
  });
});
