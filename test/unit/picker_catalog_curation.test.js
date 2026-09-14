const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.resolve(__dirname, '../../js', f), 'utf8');

describe('Picker catalog curation + search (B-4 / AC-4)', function() {
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
    window.eval(read('asset_catalog.js'));
    window.eval(read('modals.js'));
    window.eval(read('shape_picker.js'));
  });

  const cells = () => Array.from(document.querySelectorAll('.be-border-option'));
  const headers = () => Array.from(document.querySelectorAll('.be-asset-group')).map((h) => h.textContent.trim());
  const typeSearch = (v) => {
    const input = document.querySelector('.be-picker-search');
    input.value = v;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  };

  it('curates every catalog path (name + group) and renders no filename-derived labels', function() {
    const cat = window.AssetCatalog;
    assert.strictEqual(cat.ASSET_LIST.length, Object.keys(cat.ASSET_CURATION).length);
    cat.ASSET_LIST.forEach((p) => {
      const c = cat.ASSET_CURATION[p];
      assert.ok(c && c.name && c.group, `missing curation for ${p}`);
    });
    // Render the borders tab and assert every label equals the curated name.
    window.ShapePicker.showShapePickerModal();
    const names = cells().map((c) => c.textContent.trim());
    names.forEach((n) => assert.ok(n.length > 1, 'empty label rendered'));
    // Old filename-surgery artifacts must be gone from the display set.
    const artifact = [
      'Border Goth1 Hand', 'Spike Hollow2', 'Corner Ornament Bold2',
    ];
    artifact.forEach((a) => assert.ok(!names.includes(a), `filename-derived label leaked: ${a}`));
    // Spot-check curated renames surfaced.
    assert.ok(names.includes('Ornament Bold Double'), 'curated name rendered');
  });

  it('renders grouped grid headers in the fixed family order without duplicates', function() {
    window.ShapePicker.showShapePickerModal();
    const hs = headers();
    const order = window.AssetCatalog.ASSET_GROUP_ORDER;
    assert.ok(hs.length > 0, 'group headers rendered');
    const seen = [];
    let lastRank = -1;
    hs.forEach((h) => {
      const rank = order.indexOf(h);
      assert.ok(rank >= 0, `unexpected group header: ${h}`);
      assert.ok(rank >= lastRank, `headers out of order: ${hs.join('|')}`);
      lastRank = rank;
      assert.ok(!seen.includes(h), `duplicate group header: ${h}`);
      seen.push(h);
    });
  });

  it('search filters cells live by curated name', function() {
    window.ShapePicker.showShapePickerModal();
    typeSearch('goth');
    const names = cells().map((c) => c.textContent.trim());
    assert.ok(names.length >= 2, `expected goth family, got ${names.length}`);
    assert.ok(names.every((n) => /goth/i.test(n)), `unrelated results: ${names.join('|')}`);
    const hs = headers();
    assert.deepStrictEqual(hs, ['Goth']);
  });

  it('search filters by group name (Archer spans frame + shape families in tab)', function() {
    window.ShapePicker.showShapePickerModal();
    typeSearch('Archer');
    const names = cells().map((c) => c.textContent.trim());
    assert.ok(names.length > 0);
    assert.ok(names.every((n) => /archer/i.test(n)), names.join('|'));
  });

  it('search composes with the active tag pill', function() {
    window.ShapePicker.showShapePickerModal();
    // Borders tab: Goth family has a plain and a hand-drawn variant.
    typeSearch('goth');
    const before = cells().length;
    const hand = Array.from(document.querySelectorAll('.be-modal-tags button')).find((b) => b.textContent === 'hand drawn');
    hand.click();
    const names = cells().map((c) => c.textContent.trim());
    assert.ok(names.length < before, `tag composition narrowed (${before} → ${names.length})`);
    assert.ok(names.every((n) => /hand/i.test(n)), names.join('|'));
  });

  it('shows an empty state for a query with no matches', function() {
    window.ShapePicker.showShapePickerModal();
    typeSearch('zzzz-no-such-shape');
    assert.strictEqual(cells().length, 0);
    const body = document.querySelector('.be-border-options').textContent;
    assert.ok(/No shapes found/.test(body), body.slice(0, 80));
    assert.ok(body.includes('zzzz-no-such-shape'), 'query echoed in empty state');
  });

  it('Esc in the search field clears the query without cancelling the modal', async function() {
    window.ShapePicker.showShapePickerModal();
    typeSearch('vine');
    assert.ok(cells().length > 0, 'query produced results');
    const input = document.querySelector('.be-picker-search');
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.ok(document.querySelector('.be-modal-overlay'), 'modal still open after Esc in field');
    assert.strictEqual(input.value, '', 'query cleared');
    assert.ok(cells().length > 0, 'full grid restored after clearing');
  });

  it('Enter in the search field does not commit the modal', async function() {
    const promise = window.ShapePicker.showShapePickerModal();
    const input = document.querySelector('.be-picker-search');
    input.focus();
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(document.querySelector('.be-modal-overlay'), 'modal not committed by Enter in search');
    document.querySelector('.be-modal-cancel').click();
    assert.strictEqual(await promise, null);
  });

  it('style mode keeps flat curated style labels and hides the search field', function() {
    window.showAssetPickerModal({ mode: 'style', current: 'default-border' });
    assert.strictEqual(document.querySelector('.be-picker-search').style.display, 'none');
    assert.strictEqual(headers().length, 0, 'no group headers in style mode');
    assert.ok(cells().some((c) => c.textContent.trim() === 'Ornament Bold'), 'curated style labels shown');
    assert.ok(cells().some((c) => c.textContent.trim() === 'None'));
  });
});
