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
  w.showFeedback = () => {};
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
  wrapper.appendChild(container);
  document.getElementById(layer.layerId).appendChild(wrapper);
  return wrapper;
}

const chipFor = (id) => document.querySelector(`.be-layer-item-thumb[data-target-id="${id}"], .be-layer-item-card[data-target-id="${id}"]`);

describe('Shape layer chip multi-select + batch ops (AC-4)', function () {
  it('selects multiple chips and toggles membership', function () {
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    addShape(w, lm, dflt, 'assets/shapes/dwarf.webp', 's1');
    addShape(w, lm, dflt, 'assets/shapes/vine_hollow.webp', 's2');
    addShape(w, lm, dflt, 'assets/shapes/spike_bold.webp', 's3');
    lm.refreshUI();
    // plain click clears
    lm.toggleChipSelection('s1', false);
    assert.strictEqual(lm.selectedChipIds().length, 0, 'plain click clears the set');
    // ctrl-add two
    lm.toggleChipSelection('s1', true);
    lm.toggleChipSelection('s2', true);
    assert.strictEqual(JSON.stringify(lm.selectedChipIds().sort()), JSON.stringify(['s1', 's2']));
    // toggling an existing member removes it
    lm.toggleChipSelection('s1', true);
    assert.strictEqual(JSON.stringify(lm.selectedChipIds()), JSON.stringify(['s2']));
    assert.ok(chipFor('s2').classList.contains('be-chip-selected'), 'selected chip has the gold ring class');
    assert.ok(!chipFor('s1').classList.contains('be-chip-selected'), 'deselected chip has no ring');
  });

  // AC-7/U-24a (ui_ux_review_20260910): a chip click TOGGLES membership. It
  // must never silently clear a set the user just built (the old behaviour
  // threw away a multi-selection on any stray unmodified click).
  it('a plain click on a chip toggles that chip instead of clearing the set', function () {
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    addShape(w, lm, dflt, 'assets/shapes/dwarf.webp', 'a');
    addShape(w, lm, dflt, 'assets/shapes/vine_hollow.webp', 'b');
    lm.refreshUI();
    lm.toggleChipSelection('a', true);
    lm.toggleChipSelection('b', true);
    assert.strictEqual(lm.selectedChipIds().length, 2);
    const chip = chipFor('a');
    chip.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); // no modifier
    assert.strictEqual(
      JSON.stringify(lm.selectedChipIds()),
      JSON.stringify(['b']),
      'plain click toggled only the clicked chip; the rest of the set survives',
    );
  });

  it('Ctrl-click on a chip adds it to the selection', function () {
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    addShape(w, lm, dflt, 'assets/shapes/dwarf.webp', 'c1');
    addShape(w, lm, dflt, 'assets/shapes/vine_hollow.webp', 'c2');
    lm.refreshUI();
    chipFor('c1').dispatchEvent(new window.MouseEvent('click', { bubbles: true, ctrlKey: true }));
    chipFor('c2').dispatchEvent(new window.MouseEvent('click', { bubbles: true, ctrlKey: true }));
    assert.strictEqual(JSON.stringify(lm.selectedChipIds().sort()), JSON.stringify(['c1', 'c2']));
  });

  it('splitEachSelected gives each selected shape its own new layer (single reconcile)', function () {
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    addShape(w, lm, dflt, 'assets/shapes/corner_ornament.webp', 'p1');
    addShape(w, lm, dflt, 'assets/shapes/vine_hollow.webp', 'p2');
    addShape(w, lm, dflt, 'assets/shapes/spike_bold.webp', 'p3');
    lm.refreshUI();
    const before = lm.shapeLayers.length;
    lm.toggleChipSelection('p1', true);
    lm.toggleChipSelection('p2', true);
    const ok = lm.splitEachSelected();
    assert.strictEqual(ok, true);
    assert.strictEqual(lm.shapeLayers.length, before + 2, 'two new layers created');
    // each moved wrapper now sits in its OWN container (one shape per layer)
    const counts = lm.shapeLayers.map((l) => document.getElementById(l.layerId).querySelectorAll('.be-shape-wrapper').length);
    assert.ok(counts.filter((n) => n === 1).length >= 2, 'each split layer holds exactly one shape: ' + JSON.stringify(counts));
    assert.strictEqual(lm.selectedChipIds().length, 0, 'selection cleared after the batch');
  });

  it('moveSelectedToLayer reparents all selected shapes into one target layer', function () {
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    const target = lm.addShapeLayer('Batch Target');
    addShape(w, lm, dflt, 'assets/shapes/dwarf.webp', 'm1');
    addShape(w, lm, dflt, 'assets/shapes/vine_hollow.webp', 'm2');
    addShape(w, lm, dflt, 'assets/shapes/spike_bold.webp', 'm3');
    lm.refreshUI();
    lm.toggleChipSelection('m1', true);
    lm.toggleChipSelection('m3', true);
    const ok = lm.moveSelectedToLayer(target.id);
    assert.strictEqual(ok, true);
    assert.strictEqual(
      document.getElementById(target.layerId).querySelectorAll('.be-shape-wrapper').length,
      2,
      'two shapes moved into the target',
    );
    assert.strictEqual(
      document.getElementById(dflt.layerId).querySelectorAll('.be-shape-wrapper').length,
      1,
      'one shape remains in the default layer',
    );
    assert.strictEqual(lm.selectedChipIds().length, 0, 'selection cleared');
  });

  it('deleteSelectedChips removes the selected shapes (confirmed) and keeps the rest', async function () {
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    addShape(w, lm, dflt, 'assets/shapes/dwarf.webp', 'd1');
    addShape(w, lm, dflt, 'assets/shapes/vine_hollow.webp', 'd2');
    addShape(w, lm, dflt, 'assets/shapes/spike_bold.webp', 'd3');
    lm.refreshUI();
    lm.toggleChipSelection('d1', true);
    lm.toggleChipSelection('d2', true);
    // U-36: the batch delete now confirms through the in-app dialog, so it is
    // async — awaiting the user's answer is the whole point, and a dismissed
    // dialog must read as "no".
    const ok = await lm.deleteSelectedChips();
    assert.strictEqual(ok, true);
    assert.strictEqual(document.getElementById('d1'), null);
    assert.strictEqual(document.getElementById('d2'), null);
    assert.ok(document.getElementById('d3'), 'unselected shape survives');
    assert.strictEqual(lm.selectedChipIds().length, 0);
    // confirm=false path is a no-op
    lm.toggleChipSelection('d3', true);
    lm.toggleChipSelection('d3', true); // toggles off then...
    lm._selectedChipIds = new Set(['d3']);
    const w2 = window; w2.confirm = () => false;
    const ok2 = await lm.deleteSelectedChips();
    assert.strictEqual(ok2, false, 'cancel returns false');
    assert.ok(document.getElementById('d3'), 'cancel keeps the shape');
  });

  it('batch menu appears only with >=2 selected, and offers split/move/delete', function () {
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    addShape(w, lm, dflt, 'assets/shapes/dwarf.webp', 'b1');
    addShape(w, lm, dflt, 'assets/shapes/vine_hollow.webp', 'b2');
    lm.refreshUI();
    // single selection → normal menu
    lm.toggleChipSelection('b1', true);
    lm.createContextMenu(10, 10, 'b1');
    let labels = Array.from(document.querySelectorAll('#print-enhance-context-menu .be-context-menu-item')).map((e) => e.textContent);
    assert.ok(labels.includes('Move to New Layer…'), 'normal menu for 1 selected: ' + JSON.stringify(labels));
    lm.hideContextMenu();
    // two selected → batch menu
    lm.toggleChipSelection('b2', true);
    lm.createContextMenu(10, 10, 'b1');
    labels = Array.from(document.querySelectorAll('#print-enhance-context-menu .be-context-menu-item')).map((e) => e.textContent);
    assert.ok(labels.some((t) => /Split 2 into their own layers/.test(t)), 'batch split: ' + JSON.stringify(labels));
    assert.ok(labels.some((t) => /Move selected to layer/.test(t)), 'batch move');
    assert.ok(labels.some((t) => /Delete 2 selected/.test(t)), 'batch delete');
    lm.hideContextMenu();
  });

  it('batchReparent rolls back on failure and never leaves a wrapper detached (Slice L)', function () {
    const { w, lm } = boot();
    const dflt = lm.shapeLayers[0];
    const target = lm.addShapeLayer('Rollback Target');
    addShape(w, lm, dflt, 'assets/shapes/dwarf.webp', 'r1');
    addShape(w, lm, dflt, 'assets/shapes/vine_hollow.webp', 'r2');
    lm.refreshUI();
    const srcContainer = document.getElementById(dflt.layerId);
    // Force the FIRST move to succeed and the SECOND to throw mid-batch by
    // making the second wrapper's lookup explode once.
    const realMove = lm.moveShapeToLayer.bind(lm);
    let calls = 0;
    lm.moveShapeToLayer = (...args) => {
      calls += 1;
      if (calls === 2) throw new Error('simulated mid-batch failure');
      return realMove(...args);
    };
    const ok = lm.batchReparent([
      { wrapperId: 'r1', targetLayerId: target.id },
      { wrapperId: 'r2', targetLayerId: target.id },
    ]);
    lm.moveShapeToLayer = realMove;
    assert.strictEqual(ok, false, 'batch reported failure');
    // both wrappers back in the source container, none detached
    assert.strictEqual(srcContainer.querySelectorAll('.be-shape-wrapper').length, 2, 'rollback restored the source');
    assert.strictEqual(document.getElementById(target.layerId).querySelectorAll('.be-shape-wrapper').length, 0, 'target empty after rollback');
    assert.ok(document.getElementById('r1') && document.getElementById('r2'), 'no wrapper lost');
  });
});
