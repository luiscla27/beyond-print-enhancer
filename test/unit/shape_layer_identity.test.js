const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Boot LayerManager like test/unit/layer_manager.test.js does (it constructs
// LayerManager directly). Reuse that harness shape so we control the DOM.
const domManagerJs = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
const elementWrapperJs = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
const layerManagerJs = fs.readFileSync(path.resolve(__dirname, '../../js/dom/layer_manager.js'), 'utf8');
const assetCatalogJs = fs.readFileSync(path.resolve(__dirname, '../../js/asset_catalog.js'), 'utf8');

function boot() {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="print-layout-wrapper"></div></body></html>',
    { url: "http://localhost", runScripts: "dangerously" },
  );
  const w = dom.window;
  global.window = w;
  global.document = w.document;
  global.HTMLElement = w.HTMLElement;
  global.Node = w.Node;
  w.chrome = { runtime: { getURL: (p) => `chrome-extension://mock/${p}` } };
  w.__DDB_TEST_MODE__ = true;
  w.Icons = { svg: () => "" };
  w.eval(assetCatalogJs);
  w.eval(elementWrapperJs);
  w.eval(domManagerJs);
  w.eval(layerManagerJs);
  return w;
}

function addShape(w, layer, assetPath, id) {
  const container = document.createElement('div');
  container.className = 'be-shape-container print-section-container';
  container.dataset.assetPath = assetPath;
  const content = document.createElement('div');
  container.appendChild(content);
  const wrapper = document.createElement('div');
  wrapper.className = 'be-shape-wrapper';
  wrapper.id = id;
  container.id = `${id}-inner`;
  wrapper.appendChild(container);
  document.getElementById(layer.layerId).appendChild(wrapper);
}

describe('Shape layer identity & truth (AC-1)', function () {
  it('shape chips carry the curated asset name caption + title (no filename tooltip)', function () {
    const w = boot();
    const lm = window.DomManager.getInstance().getLayerManager();
    lm.createPanel();
    const defaultLayer = lm.shapeLayers[0];
    // Shape A is a curated catalog asset; Shape B is a data-URL custom shape.
    addShape(w, defaultLayer, 'assets/shapes/corner_ornament.webp', 'shape-curated');
    addShape(w, defaultLayer, 'data:image/png;base64,AAAA', 'shape-custom');
    lm.refreshUI();
    const thumbs = Array.from(document.querySelectorAll('.be-layer-item-thumb'));
    assert.strictEqual(thumbs.length, 2, 'two shape chips rendered');
    const curated = thumbs.find((t) => t.dataset.targetId === 'shape-curated');
    assert.ok(curated, 'curated chip present');
    const cap = curated.querySelector('.be-layer-chip-name');
    assert.ok(cap, 'caption element present');
    // Curated display name (not 'Corner Ornament2' filename surgery, not a URL).
    assert.ok(/ornament/i.test(cap.textContent), 'caption is curated: ' + cap.textContent);
    assert.ok(!cap.textContent.includes('.webp'), 'no filename leak in caption');
    assert.ok(!curated.title.includes('/'), 'title is not a path');
    const innerImg = curated.querySelector('img');
    assert.ok(innerImg && innerImg.src.includes('corner_ornament'), 'inner img src points at the asset');
  });

  it('layer rows show live counts that reconcile on add/remove', function () {
    const w = boot();
    const lm = window.DomManager.getInstance().getLayerManager();
    lm.createPanel();
    const defaultLayer = lm.shapeLayers[0];
    const row = document.querySelector(`[data-layer-id="${defaultLayer.id}"]`);
    const badge = () => row.querySelector('.be-layer-count').textContent;
    assert.strictEqual(badge(), '0', 'empty layer shows 0');
    addShape(w, defaultLayer, 'assets/shapes/dwarf.webp', 's1');
    addShape(w, defaultLayer, 'assets/shapes/dwarf.webp', 's2');
    lm.refreshUI();
    assert.strictEqual(badge(), '2', 'count reconciles after add');
    // remove one real wrapper + refresh
    document.getElementById('s1').remove();
    lm.refreshUI();
    assert.strictEqual(badge(), '1', 'count reconciles after remove');
    // SECTIONS header reflects real element count too
    const secH = document.querySelector('.be-layer-section-header[data-group="sections"] span');
    assert.ok(secH, 'sections header present');
    assert.ok(/SECTIONS \(\d+\)/.test(secH.textContent), 'sections header is a live count: ' + secH.textContent);
  });

  it('empty layers show the drag-a-shape affordance, not bare text', function () {
    boot();
    const lm = window.DomManager.getInstance().getLayerManager();
    lm.createPanel();
    lm.refreshUI();
    const defaultLayer = lm.shapeLayers[0];
    const list = document.getElementById(defaultLayer.layerId);
    // default has no shapes in this boot
    const listUi = lm.contentLists[defaultLayer.id];
    assert.ok(
      /Empty — drag a shape here/.test(listUi.textContent),
      'affordance text shown: ' + listUi.textContent,
    );
    assert.ok(list, 'container exists');
  });

  it('rename uses the app input modal (no native prompt) when the seam exists', async function () {
    const w = boot();
    const lm = window.DomManager.getInstance().getLayerManager();
    lm.createPanel();
    const extra = lm.addShapeLayer('Old Name');
    let promptCalls = 0;
    const realPrompt = w.prompt;
    w.prompt = () => { promptCalls++; return 'Bad'; };
    // Provide the showInputModal seam returning a new name.
    w.showInputModal = async (title, message, def) => {
      w.__inputTitle = title;
      w.__inputDef = def;
      return 'Dice';
    };
    await lm.showRenameModal(extra);
    assert.strictEqual(promptCalls, 0, 'prompt() must not be used when showInputModal exists');
    assert.strictEqual(extra.label, 'Dice', 'layer renamed via the modal');
    assert.strictEqual(w.__inputDef, 'Old Name', 'modal prefilled with the current label');
    assert.ok(/Rename Layer/.test(w.__inputTitle), 'modal titled Rename Layer');
    // Cancel (null) → no change
    w.showInputModal = async () => null;
    await lm.showRenameModal(extra);
    assert.strictEqual(extra.label, 'Dice', 'cancel is a no-op');
    w.prompt = realPrompt;
  });

  it('rename never applies to the sections layer', async function () {
    const w = boot();
    const lm = window.DomManager.getInstance().getLayerManager();
    lm.createPanel();
    let called = false;
    w.showInputModal = async () => { called = true; return 'Nope'; };
    await lm.showRenameModal(lm.sectionsLayer);
    assert.strictEqual(called, false, 'sections layer is not renamable');
    assert.strictEqual(lm.sectionsLayer.label, 'Sections');
  });
});
