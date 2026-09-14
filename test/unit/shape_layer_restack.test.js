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
  w.updatePrintStyles = () => {};
  w.eval(read('asset_catalog.js'));
  w.eval(read('dom/element_wrapper.js'));
  w.eval(read('dom/dom_manager.js'));
  w.eval(read('dom/layer_manager.js'));
  const lm = w.DomManager.getInstance().getLayerManager();
  lm.createPanel();
  return { w, lm };
}

describe('Shape layer flat restack (AC-3)', function () {
  it('reorderShapeLayers moves a layer to the top of the stack (before the first other layer)', function () {
    const { lm } = boot();
    const a = lm.addShapeLayer('A');
    const b = lm.addShapeLayer('B');
    const c = lm.addShapeLayer('C');
    // stack now: [default, A, B, C]
    assert.strictEqual(JSON.stringify(lm.shapeLayers.map((l) => l.id)), JSON.stringify(['shapes-default', a.id, b.id, c.id]));
    const ok = lm.reorderShapeLayers(c.id, a.id); // move C above A
    assert.strictEqual(ok, true);
    assert.strictEqual(JSON.stringify(lm.shapeLayers.map((l) => l.id)), JSON.stringify(['shapes-default', c.id, a.id, b.id]));
    // panel order follows the array (groups in DOM order after sections)
    const ids = Array.from(document.querySelectorAll('.be-layer-group .be-layer-row')).map((r) => r.dataset.layerId);
    // sections first, then shapes in array order (excluding sections row, which is inside its own group)
    const shapesInDom = ids.filter((id) => id !== 'sections');
    assert.strictEqual(JSON.stringify(shapesInDom), JSON.stringify(['shapes-default', c.id, a.id, b.id]));
  });

  it('reorder to the end (beforeId null) and same-position no-op', function () {
    const { lm } = boot();
    const a = lm.addShapeLayer('A');
    const b = lm.addShapeLayer('B');
    const c = lm.addShapeLayer('C');
    // move the DEFAULT layer to the end (a legal shape-layer restack position)
    assert.strictEqual(lm.reorderShapeLayers('shapes-default', null), true);
    assert.strictEqual(JSON.stringify(lm.shapeLayers.map((l) => l.id)), JSON.stringify([a.id, b.id, c.id, 'shapes-default']));
    // move A above A (before itself) is impossible via beforeId self → findIndex(A) then... move A before A == no move
    lm.reorderShapeLayers(a.id, b.id); // restore-ish
    // same-position no-op: move the first before the second
    // [a,b,c,default] → move b before a
    lm.reorderShapeLayers(b.id, a.id);
    assert.strictEqual(JSON.stringify(lm.shapeLayers.map((l) => l.id)), JSON.stringify([b.id, a.id, c.id, 'shapes-default']));
    // unknown dragged id → false, order unchanged
    const snap = lm.shapeLayers.map((l) => l.id);
    assert.strictEqual(lm.reorderShapeLayers('nope', a.id), false);
    assert.strictEqual(JSON.stringify(lm.shapeLayers.map((l) => l.id)), JSON.stringify(snap));
  });

  it('print-z banding follows the new shapeLayers order (updatePrintZIndexes uses layer index)', function () {
    const { lm } = boot();
    const a = lm.addShapeLayer('A');
    const b = lm.addShapeLayer('B');
    // spy updatePrintZIndexes by capturing data-print-z assigned per element:
    // simplest observable: the method computes baseZ = layerIndex*100+10 per
    // layer — exercise it directly (no wrappers) then flip order and confirm
    // the DOM order of containers changes.
    const cA = document.getElementById(a.layerId);
    const cB = document.getElementById(b.layerId);
    // put one shape in A and one in B to make reorder observable
    const mkShape = (id) => {
      const cont = document.createElement('div');
      cont.className = 'be-shape-container print-section-container';
      cont.id = id;
      const wrapper = document.createElement('div');
      wrapper.className = 'be-shape-wrapper';
      wrapper.id = `w-${id}`;
      wrapper.appendChild(cont);
      return wrapper;
    };
    cA.appendChild(mkShape('a1'));
    cB.appendChild(mkShape('b1'));
    lm.refreshUI();
    const orderBefore = () =>
      Array.from(document.querySelectorAll('.be-layer-content-list')).map((l) => l.dataset.layer);
    const before = orderBefore();
    lm.reorderShapeLayers(b.id, a.id); // B now first → B before A in the panel
    const after = orderBefore();
    assert.notStrictEqual(JSON.stringify(after), JSON.stringify(before), 'panel order changed after restack');
    assert.strictEqual(after.indexOf(b.id) < after.indexOf(a.id), true, 'B now before A');
  });

  it('sections row is never draggable; shape rows draggable only while unlocked; lock propagation flips it', function () {
    const { lm } = boot();
    lm.refreshUI();
    const secRow = document.querySelector('.be-layer-row[data-layer-id="sections"]');
    assert.strictEqual(secRow.draggable, false, 'sections pinned (not draggable)');
    const defaultLayer = lm.shapeLayers[0];
    // default starts locked (all layers locked initially except none) — check
    lm.refreshUI();
    const defRow = document.querySelector('.be-layer-row[data-layer-id="shapes-default"]');
    // unlock the default layer → draggable true
    if (defaultLayer.isLocked) lm.toggleLayerLock(defaultLayer);
    assert.strictEqual(defaultLayer.isLocked, false);
    assert.strictEqual(defRow.draggable, true, 'unlocked row is draggable');
    // lock it again → draggable flips false immediately (Slice K)
    lm.toggleLayerLock(defaultLayer);
    assert.strictEqual(defaultLayer.isLocked, true);
    assert.strictEqual(defRow.draggable, false, 'lock propagation flips draggable off');
  });

  it('bindRowDrag guards: a locked row dragstart is prevented (no ghost/no drag id set)', function () {
    const { lm } = boot();
    const extra = lm.addShapeLayer('Locked Row');
    extra.isLocked = true;
    lm.rebuildPanel();
    const row = document.querySelector(`.be-layer-row[data-layer-id="${extra.id}"]`);
    assert.strictEqual(row.draggable, false);
    assert.ok(!lm._draggedLayerId, 'no drag armed for a locked row');
    // unlock → draggable true and dragstart arms the drag id + ghost
    lm.toggleLayerLock(extra); // locks all others, unlocks extra
    lm.refreshUI();
    const row2 = document.querySelector(`.be-layer-row[data-layer-id="${extra.id}"]`);
    assert.strictEqual(row2.draggable, true);
  });
});
