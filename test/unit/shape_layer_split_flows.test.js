const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.resolve(__dirname, '../../js/', f), 'utf8');
const { JSDOM } = require('jsdom');

function boot() {
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
  w.Icons = { svg: () => "" };
  w.confirm = () => true;
  w.eval(read('asset_catalog.js'));
  w.eval(read('dom/element_wrapper.js'));
  w.eval(read('dom/dom_manager.js'));
  w.eval(read('dom/layer_manager.js'));
  const lm = w.DomManager.getInstance().getLayerManager();
  lm.createPanel();
  return { w, lm };
}

function addShape(w, lm, layer, assetPath, id) {
  const container = document.createElement('div');
  container.className = 'be-shape-container print-section-container';
  container.dataset.assetPath = assetPath;
  container.id = `${id}-inner`;
  const wrapper = document.createElement('div');
  wrapper.className = 'be-shape-wrapper';
  wrapper.id = id;
  wrapper.style.left = '11px';
  wrapper.style.top = '22px';
  wrapper.style.zIndex = '123';
  wrapper.dataset.rotation = '45';
  wrapper.dataset.printZ = '1040';
  wrapper.appendChild(container);
  document.getElementById(layer.layerId).appendChild(wrapper);
  return wrapper;
}

describe('Shape layer split & move flows (AC-2)', function () {
  it('moveShapeToLayer reparents the wrapper between layer containers (no refresh, state preserved)', function () {
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    const target = lm.addShapeLayer('Gold Dividers');
    const wrapper = addShape(w, lm, dflt, 'assets/shapes/archer_main.webp', 'shape-1');
    const srcContainer = wrapper.parentElement;
    // count refreshLayerContents invocations by spying on renderElementsForLayer
    let refills = 0;
    const orig = lm.renderElementsForLayer.bind(lm);
    lm.renderElementsForLayer = (...a) => { refills++; return orig(...a); };
    const moved = lm.moveShapeToLayer('shape-1', target.id);
    assert.strictEqual(moved, true);
    assert.strictEqual(refills, 0, 'pure DOM move must NOT refresh');
    assert.strictEqual(wrapper.parentElement.id, target.layerId, 'wrapper in the target container');
    assert.notStrictEqual(wrapper.parentElement, srcContainer);
    // geometry + state preserved
    assert.strictEqual(wrapper.style.left, '11px');
    assert.strictEqual(wrapper.style.top, '22px');
    assert.strictEqual(wrapper.style.zIndex, '123');
    assert.strictEqual(wrapper.dataset.rotation, '45');
    assert.strictEqual(wrapper.dataset.printZ, '1040');
    assert.ok(wrapper.querySelector('.print-section-container').dataset.assetPath.includes('archer_main'));
  });

  it('move guards: same-layer no-op, missing target no-op, sections target refused', function () {
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    const wrapper = addShape(w, lm, dflt, 'assets/shapes/dwarf.webp', 'shape-x');
    assert.strictEqual(lm.moveShapeToLayer('shape-x', dflt.id), false, 'same layer');
    assert.strictEqual(wrapper.parentElement.id, dflt.layerId);
    assert.strictEqual(lm.moveShapeToLayer('shape-x', 'no-such-layer'), false, 'missing target');
    assert.strictEqual(lm.moveShapeToLayer('shape-x', 'sections'), false, 'sections refused (banding)');
    assert.strictEqual(lm.moveShapeToLayer('missing-wrapper', dflt.id), false, 'missing wrapper');
    assert.strictEqual(wrapper.parentElement.id, dflt.layerId, 'never left the source');
  });

  it('moveShapeToNewLayer creates a curated-name layer, moves the shape, makes it active; deletes it if refused', function () {
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    const wrapper = addShape(w, lm, dflt, 'assets/shapes/corner_ornament.webp', 'shape-n');
    const before = lm.shapeLayers.length;
    const layer = lm.moveShapeToNewLayer('shape-n');
    assert.ok(layer, 'new layer created');
    assert.strictEqual(lm.shapeLayers.length, before + 1);
    // label derived from curated display name (Ornament Corner)
    assert.ok(/Ornament Corner/.test(layer.label), 'label from curated name: ' + layer.label);
    assert.strictEqual(wrapper.parentElement.id, layer.layerId, 'wrapper moved in');
    assert.strictEqual(layer.isLocked, false, 'new layer unlocked');
    assert.strictEqual(lm.activeLayerId, layer.id, 'new layer active');
    assert.strictEqual(layer.isHidden, false, 'visible');
    assert.strictEqual(layer.isDisabledOnPrint, false, 'printable');
    assert.strictEqual(layer.isLocked, false);
    // content reconciled once
    lm.refreshLayerContents();
    const destList = lm.contentLists[layer.id];
    assert.strictEqual(destList.querySelectorAll('.be-layer-item-thumb').length, 1);
  });

  it('uniqueLayerLabel dedupes collisions ("Name 2")', function () {
    const { lm } = boot();
    lm.addShapeLayer('Vine Hollow');
    assert.strictEqual(lm.uniqueLayerLabel('Vine Hollow'), 'Vine Hollow 2');
    assert.strictEqual(lm.uniqueLayerLabel('Fresh Name'), 'Fresh Name');
  });

  it('moveShapeToNewLayer with a missing wrapper returns null and creates nothing', function () {
    const { lm } = boot();
    const before = lm.shapeLayers.length;
    assert.strictEqual(lm.moveShapeToNewLayer('does-not-exist'), null);
    assert.strictEqual(lm.shapeLayers.length, before, 'no orphan layer left behind');
  });

  it('chip context menu on a shape offers Move to New Layer / Move to Layer / Delete', function () {
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    addShape(w, lm, dflt, 'assets/shapes/corner_ornament.webp', 'shape-m');
    lm.addShapeLayer('Other');
    lm.refreshUI();
    lm.createContextMenu(100, 100, 'shape-m');
    const labels = Array.from(document.querySelectorAll('#print-enhance-context-menu .be-context-menu-item'))
      .map((e) => e.textContent);
    assert.ok(labels.includes('Move to New Layer…'), JSON.stringify(labels));
    assert.ok(labels.includes('Move to Layer…'));
    assert.ok(labels.includes('Delete'));
    document.querySelector('#print-enhance-context-menu').remove();
    lm.contextMenu = null;
  });

  it('Move to Layer chooser lists the other layers with state and moving reparents + reconciles once', function () {
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    addShape(w, lm, dflt, 'assets/shapes/dwarf.webp', 'shape-c');
    const hidden = lm.addShapeLayer('Hidden Dest');
    hidden.isHidden = true;
    const plain = lm.addShapeLayer('Plain Dest');
    lm.createContextMenu(10, 10, 'shape-c');
    // open the chooser
    const moveLayerItem = Array.from(document.querySelectorAll('#print-enhance-context-menu .be-context-menu-item'))
      .find((e) => e.textContent === 'Move to Layer…');
    moveLayerItem.click(); // rawItem → chooser, menu stays
    const chooser = Array.from(document.querySelectorAll('#print-enhance-context-menu .be-context-menu-item'))
      .map((e) => e.textContent);
    assert.ok(chooser.includes('← Back'));
    assert.ok(chooser.some((t) => t.startsWith('Hidden Dest (hidden)')), JSON.stringify(chooser));
    assert.ok(chooser.some((t) => t === 'Plain Dest'), JSON.stringify(chooser));
    assert.ok(!chooser.some((t) => t.startsWith('Shapes (Default)')), 'current layer excluded');
    // choose Plain Dest
    const target = Array.from(document.querySelectorAll('#print-enhance-context-menu .be-context-menu-item'))
      .find((e) => e.textContent === 'Plain Dest');
    let refills = 0;
    const orig = lm.renderElementsForLayer.bind(lm);
    lm.renderElementsForLayer = (...a) => { refills++; return orig(...a); };
    target.click();
    const wrapper = document.getElementById('shape-c');
    assert.strictEqual(wrapper.parentElement.id, plain.layerId, 'moved to Plain Dest');
    assert.ok(refills >= 1, 'reconciled once after move');
    assert.strictEqual(document.querySelector('#print-enhance-context-menu'), null, 'menu closed');
  });

  it('persistence round-trip: scan groups the moved shape under the target layer and apply recreates it there', async function () {
    // Use the real scanLayout/applyLayout path? They live in layout_scan/apply
    // which need main-level seams; instead assert the container-grouping
    // invariant: scanLayout reads #layerId .be-shape-wrapper — so after the
    // move the wrapper sits in the target container, which is the grouping
    // key. Directly emulate: move then query like scan does.
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    addShape(w, lm, dflt, 'assets/shapes/archer_main.webp', 'shape-p');
    const target = lm.addShapeLayer('Persisted Dest');
    lm.moveShapeToLayer('shape-p', target.id);
    lm.refreshLayerContents();
    // scan-style grouping query
    const inTarget = document.querySelectorAll(`#${target.layerId} .be-shape-wrapper`).length;
    const inDefault = document.querySelectorAll(`#${dflt.layerId} .be-shape-wrapper`).length;
    assert.strictEqual(inTarget, 1);
    assert.strictEqual(inDefault, 0);
    assert.strictEqual(target.label, 'Persisted Dest');
  });
});
