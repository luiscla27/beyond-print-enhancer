const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
require("fake-indexeddb/auto");

describe('Drag-and-Drop Logic', function() {
  let window, document;
  beforeEach(function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="print-layout-wrapper">
            <div class="print-section-container" id="s1" draggable="true"><div class="print-section-header">Section 1</div></div>
            <div class="print-section-container" id="s2" draggable="true"><div class="print-section-header">Section 2</div></div>
        </div>
    </body></html>`, { url: "http://localhost" });
    window = dom.window;
    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
  });
  afterEach(function(){ delete global.window; delete global.document; delete global.HTMLElement; });
  it('should initialize draggable state', function() {
    const section = document.getElementById('s1');
    assert.strictEqual(section.getAttribute('draggable'), 'true');
  });
});

function loadPureModule(){
  const prev = global.window;
  global.window = {};
  try {
    delete require.cache[require.resolve('C:/luiscla27/projects/dndbeyond-printenhance/js/dnd.js')];
    return require('C:/luiscla27/projects/dndbeyond-printenhance/js/dnd.js');
  } finally {
    global.window = prev;
  }
}

describe('DnD feature_17_dnd - exported pure helpers & constants', function(){
  it('exposes DRAG_THRESHOLD as 4', function(){
    const m = loadPureModule();
    assert.strictEqual(m.DRAG_THRESHOLD, 4);
  });
  it('exposes GRID_STEP as 16', function(){
    const m = loadPureModule();
    assert.strictEqual(m.GRID_STEP, 16);
  });
  it('exposes ALIGN_TOLERANCE as 4', function(){
    const m = loadPureModule();
    assert.strictEqual(m.ALIGN_TOLERANCE, 4);
  });
  describe('snapToGrid', function(){
    it('snaps to nearest 16 (positive)', function(){
      const m = loadPureModule();
      assert.deepStrictEqual(m.snapToGrid(0,0), {x:0,y:0});
      assert.deepStrictEqual(m.snapToGrid(8,8), {x:16,y:16});
      assert.deepStrictEqual(m.snapToGrid(7,9), {x:0,y:16});
      assert.deepStrictEqual(m.snapToGrid(100,150), {x:96,y:144});
      assert.deepStrictEqual(m.snapToGrid(24, 40), {x:32, y:48});
    });
    it('snaps negative values and avoids -0', function(){
      const m = loadPureModule();
      assert.deepStrictEqual(m.snapToGrid(-5,33), {x:0,y:32});
      assert.deepStrictEqual(m.snapToGrid(-8,-8), {x:0,y:0});
      const r = m.snapToGrid(-0.1, -0.1);
      assert.strictEqual(Object.is(r.x, -0), false);
      assert.strictEqual(Object.is(r.y, -0), false);
    });
    it('snaps large values on exact grid boundaries', function(){
      const m = loadPureModule();
      assert.deepStrictEqual(m.snapToGrid(32,48), {x:32,y:48});
      assert.deepStrictEqual(m.snapToGrid(16,16), {x:16,y:16});
    });
  });
  describe('findAlignmentGuides', function(){
    it('emits v guide when left edges align within tolerance (midpoint)', function(){
      const m = loadPureModule();
      const {v,h} = m.findAlignmentGuides({left:100,right:300,top:50,bottom:150}, [{left:101,right:401,top:500,bottom:600}], null, 4);
      assert.ok(v.includes(101), `expected 101 in ${v}`);
      assert.strictEqual(h.length, 0);
    });
    it('emits no guides when far', function(){
      const m = loadPureModule();
      const {v,h} = m.findAlignmentGuides({left:100,right:300,top:50,bottom:150}, [{left:340,right:640,top:500,bottom:600}], null, 4);
      assert.strictEqual(v.length, 0);
      assert.strictEqual(h.length, 0);
    });
    it('includes container as alignment target', function(){
      const m = loadPureModule();
      const {v} = m.findAlignmentGuides({left:402,right:502,top:50,bottom:150}, [], {left:400,right:1400,top:0,bottom:2000}, 4);
      assert.ok(v.includes(401), `expected 401 in ${v}`);
    });
    it('deduplicates identical guide coords', function(){
      const m = loadPureModule();
      const {v} = m.findAlignmentGuides({left:100,right:200,top:0,bottom:100}, [{left:100,right:200,top:300,bottom:400},{left:100,right:200,top:500,bottom:600}], null, 4);
      const count100 = v.filter(x=>x===100).length;
      assert.strictEqual(count100, 1);
    });
    it('emits vertical guide for exact left-left align even with tight tolerance', function(){
      const m = loadPureModule();
      const {v} = m.findAlignmentGuides({left:100,right:300,top:50,bottom:250}, [{left:100,right:500,top:850,bottom:950}], null, 0.001);
      assert.ok(v.includes(100), `expected 100 in ${v}`);
    });
  });
});

describe('DnD feature_17_dnd - predicates isDragHandle / isInteractiveTarget', function(){
  let win, doc;
  function bootPredicates(){
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="layout-root"></div></body></html>', {url:'http://localhost'});
    win = dom.window; doc = win.document;
    global.window = win; global.document = doc; global.HTMLElement = win.HTMLElement; global.Node = win.Node;
    win.DomManager = { getInstance:()=>({ getLayoutRoot:()=>({element:doc.getElementById('layout-root')}), getLayerManager:()=>({getLayerForElement:()=>({isLocked:false})}) }) };
    win.getComputedStyle = ()=>({transform:'none'});
    delete require.cache[require.resolve('C:/luiscla27/projects/dndbeyond-printenhance/js/dnd.js')];
    return require('C:/luiscla27/projects/dndbeyond-printenhance/js/dnd.js');
  }
  afterEach(function(){ delete global.window; delete global.document; delete global.HTMLElement; delete global.Node; delete global.MutationObserver; delete require.cache[require.resolve('C:/luiscla27/projects/dndbeyond-printenhance/js/dnd.js')]; });
  it('isDragHandle true for element with .be-drag-handle', function(){
    const m = bootPredicates();
    const el = doc.createElement('button'); el.className='be-drag-handle'; doc.body.appendChild(el);
    assert.strictEqual(m.isDragHandle(el), true);
  });
  it('isDragHandle true for descendant of handle', function(){
    const m = bootPredicates();
    const handle = doc.createElement('button'); handle.className='be-drag-handle';
    const inner = doc.createElement('span'); inner.textContent='x'; handle.appendChild(inner); doc.body.appendChild(handle);
    assert.strictEqual(m.isDragHandle(inner), true);
  });
  it('isDragHandle false for plain button', function(){
    const m = bootPredicates();
    const btn = doc.createElement('button'); btn.textContent='Click'; doc.body.appendChild(btn);
    assert.strictEqual(m.isDragHandle(btn), false);
  });
  it('isDragHandle false for null/primitive', function(){
    const m = bootPredicates();
    assert.strictEqual(m.isDragHandle(null), false);
    assert.strictEqual(m.isDragHandle({}), false);
  });
  it('isInteractiveTarget exempts drag handle even inside .be-section-actions', function(){
    const m = bootPredicates();
    const rail = doc.createElement('div'); rail.className='be-section-actions';
    const handle = doc.createElement('button'); handle.className='be-drag-handle'; rail.appendChild(handle);
    doc.body.appendChild(rail);
    assert.strictEqual(m.isInteractiveTarget(handle), false);
  });
  it('isInteractiveTarget flags .be-section-actions rail', function(){
    const m = bootPredicates();
    const rail = doc.createElement('div'); rail.className='be-section-actions'; doc.body.appendChild(rail);
    assert.strictEqual(m.isInteractiveTarget(rail), true);
  });
  it('isInteractiveTarget flags rotation/resize handles and form controls', function(){
    const m = bootPredicates();
    const rot = doc.createElement('div'); rot.className='be-rotation-handle'; doc.body.appendChild(rot);
    assert.strictEqual(m.isInteractiveTarget(rot), true);
    const resize = doc.createElement('div'); resize.className='print-section-resize-handle'; doc.body.appendChild(resize);
    assert.strictEqual(m.isInteractiveTarget(resize), true);
    const btn = doc.createElement('button'); doc.body.appendChild(btn);
    assert.strictEqual(m.isInteractiveTarget(btn), true);
    const inp = doc.createElement('input'); doc.body.appendChild(inp);
    assert.strictEqual(m.isInteractiveTarget(inp), true);
  });
  it('isInteractiveTarget false for plain content div, true for null', function(){
    const m = bootPredicates();
    const div = doc.createElement('div'); doc.body.appendChild(div);
    assert.strictEqual(m.isInteractiveTarget(div), false);
    assert.strictEqual(m.isInteractiveTarget(null), true);
  });
});

describe('DnD feature_17_dnd - handle lifecycle ensureDragHandle/syncDragHandles', function(){
  let win, doc;
  function bootHandles(){
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="layout-root"></div></body></html>', {url:'http://localhost'});
    win = dom.window; doc = win.document;
    global.window = win; global.document = doc; global.HTMLElement = win.HTMLElement; global.Node = win.Node; global.MutationObserver = win.MutationObserver;
    win.DomManager = { getInstance:()=>({ getLayoutRoot:()=>({element:doc.getElementById('layout-root')}), getLayerManager:()=>({getLayerForElement:()=>({isLocked:false})}) }) };
    win.getComputedStyle = ()=>({transform:'none'});
    delete require.cache[require.resolve('C:/luiscla27/projects/dndbeyond-printenhance/js/dnd.js')];
    const m = require('C:/luiscla27/projects/dndbeyond-printenhance/js/dnd.js');
    // mirror module exports onto window so the rest of the suite sees win.ensureDragHandle
    Object.assign(win, m);
    // also expose on global.window for any window.* lookups inside dnd.js at runtime
    Object.assign(global.window, m);
    return m;
  }
  afterEach(function(){ delete global.window; delete global.document; delete global.HTMLElement; delete global.Node; delete global.MutationObserver; delete require.cache[require.resolve('C:/luiscla27/projects/dndbeyond-printenhance/js/dnd.js')]; });
  it('ensureDragHandle creates handle as first child of .be-section-actions', function(){
    const w = bootHandles();
    const wrapper = doc.createElement('div'); wrapper.className='be-section-wrapper'; wrapper.id='wh1';
    const rail = doc.createElement('div'); rail.className='be-section-actions';
    const btn = doc.createElement('button'); btn.textContent='A'; rail.appendChild(btn);
    wrapper.appendChild(rail); doc.getElementById('layout-root').appendChild(wrapper);
    const handle = w.ensureDragHandle(wrapper);
    assert.ok(handle, 'handle created');
    assert.ok(handle.classList.contains('be-drag-handle'));
    assert.strictEqual(rail.firstChild, handle, 'handle is first child');
    assert.strictEqual(handle.getAttribute('aria-label'), 'Drag to move this section');
  });
  it('ensureDragHandle idempotent: second call does not duplicate', function(){
    const w = bootHandles();
    const wrapper = doc.createElement('div'); wrapper.className='be-section-wrapper'; wrapper.id='wh2';
    doc.getElementById('layout-root').appendChild(wrapper);
    const h1 = w.ensureDragHandle(wrapper);
    const h2 = w.ensureDragHandle(wrapper);
    assert.strictEqual(h1, h2);
    const handles = wrapper.querySelectorAll('.be-drag-handle');
    assert.strictEqual(handles.length, 1);
  });
  it('ensureDragHandle migrates sibling handle into rail', function(){
    const w = bootHandles();
    const wrapper = doc.createElement('div'); wrapper.className='be-section-wrapper'; wrapper.id='wh3';
    const handle = doc.createElement('button'); handle.className='be-drag-handle'; handle.textContent='grip';
    wrapper.appendChild(handle);
    const rail = doc.createElement('div'); rail.className='be-section-actions'; wrapper.appendChild(rail);
    doc.getElementById('layout-root').appendChild(wrapper);
    const migrated = w.ensureDragHandle(wrapper);
    assert.strictEqual(migrated, handle);
    assert.strictEqual(rail.firstChild, handle);
    assert.strictEqual(wrapper.querySelectorAll('.be-drag-handle').length, 1);
  });
  it('syncDragHandles visits all wrappers and returns count', function(){
    const w = bootHandles();
    for(let i=0;i<3;i++){ const wr = doc.createElement('div'); wr.className='be-section-wrapper'; wr.id='sw'+i; doc.getElementById('layout-root').appendChild(wr); }
    const n = w.syncDragHandles();
    assert.strictEqual(n, 3);
    assert.strictEqual(doc.querySelectorAll('.be-drag-handle').length, 3);
    const n2 = w.syncDragHandles();
    assert.strictEqual(n2, 3);
    assert.strictEqual(doc.querySelectorAll('.be-drag-handle').length, 3);
  });
  it('ensureDragHandle returns null for null wrapper', function(){
    const w = bootHandles();
    assert.strictEqual(w.ensureDragHandle(null), null);
    assert.strictEqual(w.ensureDragHandle({}), null);
  });
});

describe('DnD feature_17_dnd - initDragAndDrop lifecycle', function(){
  let win, doc;
  function bootLifecycle(){
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="layout-root"></div></body></html>', {url:'http://localhost'});
    win = dom.window; doc = win.document;
    global.window = win; global.document = doc; global.HTMLElement = win.HTMLElement; global.Node = win.Node; global.MutationObserver = win.MutationObserver;
    win.DomManager = { getInstance:()=>({ getLayoutRoot:()=>({element:doc.getElementById('layout-root')}), getLayerManager:()=>({getLayerForElement:()=>({isLocked:false})}) }) };
    win.getComputedStyle = ()=>({transform:'none'});
    delete require.cache[require.resolve('C:/luiscla27/projects/dndbeyond-printenhance/js/dnd.js')];
    const m = require('C:/luiscla27/projects/dndbeyond-printenhance/js/dnd.js');
    Object.assign(win, m);
    Object.assign(global.window, m);
    return m;
  }
  afterEach(function(){ delete global.window; delete global.document; delete global.HTMLElement; delete global.Node; delete global.MutationObserver; delete require.cache[require.resolve('C:/luiscla27/projects/dndbeyond-printenhance/js/dnd.js')]; });
  it('injectDnDStyles creates style block and is idempotent', function(){
    const w = bootLifecycle();
    w.injectDnDStyles();
    const s1 = doc.getElementById('ddb-print-dnd-style');
    assert.ok(s1, 'style injected');
    assert.ok(s1.textContent.includes('.be-drag-handle'));
    w.injectDnDStyles();
    assert.strictEqual(doc.querySelectorAll('#ddb-print-dnd-style').length, 1);
  });
  it('initDragAndDrop does not set draggable=true on wrappers', function(){
    const w = bootLifecycle();
    const wrapper = doc.createElement('div'); wrapper.className='be-section-wrapper'; wrapper.id='no-drag'; doc.getElementById('layout-root').appendChild(wrapper);
    w.initDragAndDrop();
    assert.strictEqual(wrapper.getAttribute('draggable'), null);
    w.initDragAndDrop();
    assert.strictEqual(wrapper.querySelectorAll('.be-drag-handle').length, 1);
  });
  it('injectDnDStyles block contains not-allowed cursor for locked wrappers and no .drag-over', function(){
    const w = bootLifecycle();
    w.injectDnDStyles();
    const txt = doc.getElementById('ddb-print-dnd-style').textContent;
    assert.ok(txt.includes('not-allowed'), 'locked cursor rule');
    assert.ok(!txt.includes('drag-over'), 'no drag-over rule');
  });
});

describe('DnD feature_17_dnd - pointer drag commit semantics (4px threshold)', function(){
  let win, doc;
  function bootDrag(opts){
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="layout-root"></div></body></html>', {url:'http://localhost', runScripts:'dangerously'});
    win = dom.window; doc = win.document;
    global.window = win; global.document = doc; global.HTMLElement = win.HTMLElement; global.Node = win.Node;
    const lockedId = opts && opts.lockedId;
    win.DomManager = { getInstance:()=>({ getLayoutRoot:()=>({element:doc.getElementById('layout-root')}), getLayerManager:()=>({getLayerForElement:(id)=> lockedId===id ? {isLocked:true}:{isLocked:false}}) }) };
    win.getComputedStyle = ()=>({transform:'none'});
    const root = doc.getElementById('layout-root');
    root.getBoundingClientRect = ()=>({left:0,top:0,right:1000,bottom:800,width:1000,height:800});
    const code = fs.readFileSync('C:/luiscla27/projects/dndbeyond-printenhance/js/dnd.js','utf8');
    const script = doc.createElement('script'); script.textContent=code; doc.head.appendChild(script);
    return win;
  }
  function makeWrapper(id, rect){
    const wr = doc.createElement('div'); wr.className='be-section-wrapper'; wr.id=id;
    wr.getBoundingClientRect = ()=> rect;
    Object.defineProperty(wr,'offsetWidth',{value: rect.width, configurable:true});
    Object.defineProperty(wr,'offsetHeight',{value: rect.height, configurable:true});
    doc.getElementById('layout-root').appendChild(wr); return wr;
  }
  function pointerEvent(type, target, x, y, extra){
    const ev = new win.MouseEvent(type, {bubbles:true, cancelable:true, clientX:x, clientY:y, button:0});
    Object.defineProperty(ev,'target',{value:target, enumerable:true});
    if(extra && extra.pointerType) Object.defineProperty(ev,'pointerType',{value:extra.pointerType});
    if(extra && extra.pointerId) Object.defineProperty(ev,'pointerId',{value:extra.pointerId});
    return ev;
  }
  afterEach(function(){ delete global.window; delete global.document; delete global.HTMLElement; delete global.Node; delete global.MutationObserver; delete require.cache[require.resolve('C:/luiscla27/projects/dndbeyond-printenhance/js/dnd.js')]; });
  it('below-threshold move does not commit: no ghost, no class, no position change', function(){
    bootDrag({});
    const wr = makeWrapper('drag-thr-below', {left:0,top:0,width:200,height:100,right:200,bottom:100});
    win.initDragAndDrop();
    doc.getElementById('layout-root').dispatchEvent(pointerEvent('pointerdown', wr, 10,10));
    doc.getElementById('layout-root').dispatchEvent(pointerEvent('pointermove', wr, 12,11));
    assert.strictEqual(doc.querySelectorAll('.be-drag-ghost').length, 0, 'no ghost below threshold');
    assert.ok(!wr.classList.contains('dragging'), 'not dragging');
    doc.dispatchEvent(pointerEvent('pointerup', wr, 12,11));
    assert.strictEqual(wr.style.left, '', 'position untouched');
    assert.strictEqual(doc.querySelectorAll('.be-drag-ghost').length, 0);
  });
  it('at threshold commits: ghost appears with grid-snapped left/top multiples of 16', function(){
    bootDrag({});
    const wr = makeWrapper('drag-thr-at', {left:0,top:0,width:200,height:100,right:200,bottom:100});
    win.initDragAndDrop();
    doc.getElementById('layout-root').dispatchEvent(pointerEvent('pointerdown', wr, 10,10));
    doc.getElementById('layout-root').dispatchEvent(pointerEvent('pointermove', wr, 14,10));
    const ghost = doc.querySelector('.be-drag-ghost');
    assert.ok(ghost, 'ghost created at threshold');
    assert.strictEqual(parseInt(ghost.style.left)%16, 0, 'ghost left snapped');
    assert.strictEqual(parseInt(ghost.style.top)%16, 0, 'ghost top snapped');
    assert.ok(wr.classList.contains('dragging'), 'dragging class set');
    assert.strictEqual(doc.body.classList.contains('be-dragging'), true);
    doc.dispatchEvent(pointerEvent('pointerup', wr, 14,10));
    assert.ok(!wr.classList.contains('dragging'), 'dragging cleared');
    assert.strictEqual(doc.querySelectorAll('.be-drag-ghost').length, 0, 'ghost removed');
  });
  it('locked wrapper never drags even past threshold', function(){
    bootDrag({lockedId:'locked-wrapper'});
    const wr = makeWrapper('locked-wrapper', {left:0,top:0,width:200,height:100,right:200,bottom:100});
    win.initDragAndDrop();
    doc.getElementById('layout-root').dispatchEvent(pointerEvent('pointerdown', wr, 10,10));
    doc.getElementById('layout-root').dispatchEvent(pointerEvent('pointermove', wr, 50,50));
    assert.strictEqual(doc.querySelectorAll('.be-drag-ghost').length, 0, 'no ghost for locked');
    assert.ok(!wr.classList.contains('dragging'));
    doc.dispatchEvent(pointerEvent('pointerup', wr, 50,50));
    assert.strictEqual(wr.style.left, '', 'locked not moved');
  });
  it('committed drag drop sets wrapper left/top to snapped slot and cleans up', function(){
    bootDrag({});
    const wr = makeWrapper('drag-drop', {left:0,top:0,width:200,height:100,right:200,bottom:100});
    win.initDragAndDrop();
    doc.getElementById('layout-root').dispatchEvent(pointerEvent('pointerdown', wr, 10,10));
    doc.getElementById('layout-root').dispatchEvent(pointerEvent('pointermove', wr, 100,77));
    const ghostLeft = parseInt(doc.querySelector('.be-drag-ghost').style.left);
    const ghostTop = parseInt(doc.querySelector('.be-drag-ghost').style.top);
    doc.dispatchEvent(pointerEvent('pointerup', wr, 100,77));
    assert.strictEqual(parseInt(wr.style.left), ghostLeft, 'drop left == ghost left');
    assert.strictEqual(parseInt(wr.style.top), ghostTop, 'drop top == ghost top');
    assert.strictEqual(doc.querySelectorAll('.be-drag-ghost').length, 0);
    assert.strictEqual(doc.body.classList.contains('be-dragging'), false);
  });
  it('pointerdown on interactive button does not arm drag', function(){
    bootDrag({});
    const wr = makeWrapper('drag-btn', {left:0,top:0,width:200,height:100,right:200,bottom:100});
    const rail = wr.querySelector('.be-section-actions') || (()=>{ const r=doc.createElement('div'); r.className='be-section-actions'; wr.appendChild(r); return r; })();
    const btn = doc.createElement('button'); btn.textContent='Delete'; rail.appendChild(btn);
    win.initDragAndDrop();
    doc.getElementById('layout-root').dispatchEvent(pointerEvent('pointerdown', btn, 15,15));
    doc.getElementById('layout-root').dispatchEvent(pointerEvent('pointermove', btn, 60,60));
    assert.strictEqual(doc.querySelectorAll('.be-drag-ghost').length, 0, 'button does not arm');
    doc.dispatchEvent(pointerEvent('pointerup', btn, 60,60));
  });
});
