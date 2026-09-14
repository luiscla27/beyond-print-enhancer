const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const read = (f) => fs.readFileSync(path.resolve(__dirname, '../../js', f), 'utf8');

function bootDom(html) {
  const dom = new JSDOM(html || '<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    runScripts: 'dangerously',
  });
  const w = dom.window;
  global.window = w;
  global.document = w.document;
  global.HTMLElement = w.HTMLElement;
  global.Node = w.Node;
  w.__DDB_TEST_MODE__ = true;
  w.Icons = { svg: () => '' };
  w.showFeedback = () => {};
  w.safeLog = () => {};
  return w;
}

describe('AC-4 — grabbing a handle never arms the move drag (U-6)', function () {
  it('rotation + resize handles are interactive targets; the shape body is not', function () {
    const w = bootDom(`<!DOCTYPE html><html><body>
      <div class="be-section-wrapper">
        <div class="be-shape-container print-section-container">
          <span class="print-section-resize-handle"></span>
          <div class="be-rotation-handle"></div>
          <div class="be-section-actions"><button>x</button></div>
          <p id="body">shape body content</p>
        </div>
      </div></body></html>`);
    w.eval(read('dnd.js'));
    const t = w.isInteractiveTarget;
    assert.strictEqual(typeof t, 'function');
    assert.strictEqual(t(document.querySelector('.be-rotation-handle')), true, 'rotation handle must not drag');
    assert.strictEqual(t(document.querySelector('.print-section-resize-handle')), true, 'resize handle must not drag');
    assert.strictEqual(t(document.querySelector('.be-section-actions button')), true, 'action bar must not drag');
    assert.strictEqual(t(document.getElementById('body')), false, 'the shape body still drags');
    assert.strictEqual(t(document.querySelector('.be-section-wrapper')), false, 'the wrapper still drags');
  });
});

describe('AC-5 — lock semantics are honest (U-7)', function () {
  it('adding a shape layer does not lock the other layers', function () {
    const w = bootDom();
    w.eval(read('asset_catalog.js'));
    w.eval(read('dom/element_wrapper.js'));
    w.eval(read('dom/dom_manager.js'));
    w.eval(read('dom/layer_manager.js'));
    const lm = w.DomManager.getInstance().getLayerManager();
    lm.createPanel();
    const before = lm.shapeLayers.map((l) => l.isLocked);
    const extra = lm.addShapeLayer('Extra');
    assert.strictEqual(extra.isLocked, false);
    assert.strictEqual(lm.activeLayerId, extra.id);
    const existing = lm.shapeLayers.filter((l) => l.id !== extra.id).map((l) => l.isLocked);
    assert.strictEqual(JSON.stringify(existing), JSON.stringify(before), 'others keep their state');
  });

  it('the injected chrome keeps a locked layer\'s controls reachable', function () {
    const css = read('print_styles.js');
    // Negative assertions run against the CSS with comments stripped: this file
    // EXPLAINS the removed rules by naming their selectors, and a source-text
    // check cannot tell a rule from a sentence about one.
    const cssRulesOnly = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    // Rotate/resize affordances are hidden while THEIR OWN layer is locked …
    //
    // This assertion used to require the selector `body[class*="be-lock-"] …`, which is
    // satisfied by ANY lock class on the body — and the product always keeps all but one
    // layer locked, so that rule hid the handles on EVERY wrapper and corner resize/rotate
    // were unreachable by mouse in practice (issue
    // ISSUE_lock_rule_hides_all_resize_rotate_handles_20260911). The test asserted the
    // defect's exact text, which is precisely why a green suite never noticed it.
    //
    // It now asserts the SCOPED rule that does the job — `.be-layer-locked` is set on the
    // LAYER CONTAINER, so it names exactly the locked layer — and explicitly FORBIDS the
    // over-broad form coming back. The behaviour itself is verified in a real browser by
    // test/browser_e2e/lock_handle_visibility.spec.js, which a source-text check cannot do.
    assert.ok(
      /\.be-layer-locked \.be-rotation-handle[\s\S]{0,200}display:\s*none !important/.test(css),
      'a locked layer hides the rotate affordance',
    );
    assert.ok(
      /\.be-layer-locked \.print-section-resize-handle[\s\S]{0,200}display:\s*none !important/.test(css),
      'a locked layer hides the resize affordance',
    );
    assert.ok(
      !/body\[class\*="be-lock-"[^{]*\.(be-rotation-handle|print-section-resize-handle)/.test(css),
      'the handle rules must NOT key off the BODY lock state: any layer being locked would ' +
        'then hide every wrapper\'s handles — the defect this test previously pinned',
    );
    // … but the action bar is NOT revealed by the lock classes any more.
    //
    // This assertion used to require `body[class*="be-lock-"] … .be-section-actions
    // { opacity: 1 !important }` — i.e. it Pinned the defect ISSUE_hover.md reports:
    // that selector matches when ANY layer is locked, and the product keeps every
    // layer but one locked, so hovering ANY section revealed its buttons, "on ALL
    // sections regardless of their status". The reachability it was written for
    // (U-7/U-11: a locked layer whose bar was unreachable) is preserved differently:
    // `.be-active-layer` is set on the layer container (js/dom/layer_manager.js
    // applyInsertionTarget) independently of `isLocked`, so the layer you are
    // working on always reveals — locked or not — while inactive layers do not.
    assert.ok(
      !/body\[class\*="be-lock-"[^{]*\.be-section-actions/.test(cssRulesOnly),
      'no body-lock class may reveal an action bar: it names "any layer locked", ' +
        'which is always true, so it showed buttons on inactive layers (ISSUE_hover.md)',
    );
    assert.ok(
      !/\.be-layer-locked[^{]*\.be-section-actions/.test(cssRulesOnly),
      'a locked layer no longer gets its own reveal rule — the active-layer rule is the ONE mechanism',
    );
    assert.ok(
      /\.be-active-layer \.be-section-wrapper:hover \.be-section-actions,[\s\S]{0,160}?opacity:\s*1[\s\S]{0,80}?pointer-events:\s*auto !important/.test(
        css,
      ),
      'the ACTIVE layer reveals its action bar on hover',
    );
    // … and the hidden bar must be UNHITTABLE, not merely transparent: the bar is
    // built with an inline pointerEvents="all" (js/main.js:2513), which outranks a
    // non-important stylesheet rule, so a non-important `none` would leave dead
    // buttons over the section.
    assert.ok(
      /\.be-section-wrapper:hover \.be-section-actions,[\s\S]{0,80}?opacity:\s*0;[\s\S]{0,80}?pointer-events:\s*none !important/.test(
        css,
      ),
      'a non-active layer\'s bar is transparent AND out of the hit-test',
    );
    // … and the layer must not be made inert (that was the U-7 root cause:
    // an inline pointer-events:none killed hover, making the lock unescapable).
    const lm = read('dom/layer_manager.js');
    assert.ok(
      !/isLocked\)[\s\S]{0,200}pointerEvents = 'none'/.test(lm),
      'a locked layer is never made pointer-events:none',
    );
    assert.ok(/not-allowed/.test(css), 'locked cursor is signalled');
  });
});

describe('AC-6 — spell Retry retries instead of deleting (U-9)', function () {
  function bootSpells() {
    const w = bootDom('<!DOCTYPE html><html><body></body></html>');
    const calls = [];
    w.__spellCalls = calls;
    // Minimal seams the spells module needs.
    w.createDraggableContainer = (cls, content, id) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'be-section-wrapper';
      const container = document.createElement('div');
      container.className = 'be-shape-container print-section-container be-spell-detail';
      container.id = id;
      container.appendChild(content);
      wrapper.appendChild(container);
      document.body.appendChild(wrapper);
      return wrapper;
    };
    w.fetchSpellWithCache = async (name) => {
      calls.push(name);
      return null; // keep failing → the error card renders again
    };
    w.applyFontSize = () => {};
    w.initResizeLogic = () => {};
    w.updateLayoutBounds = () => {};
    w.refreshLayers = () => {};
    w.injectSpellDetailTriggers = () => {};
    w.safeLog = () => {};
    const layoutRoot = document.createElement('div');
    layoutRoot.id = 'print-layout-wrapper';
    document.body.appendChild(layoutRoot);
    const sectionsLayer = document.createElement('div');
    sectionsLayer.id = 'print-enhance-sections-layer';
    document.body.appendChild(sectionsLayer);
    w.DomManager = {
      getInstance: () => ({
        getLayoutRoot: () => ({ element: layoutRoot }),
        getSectionsLayer: () => ({ element: sectionsLayer }),
        getShapesLayer: () => ({ element: sectionsLayer }),
        getActiveShapesLayer: () => ({ element: sectionsLayer }),
      }),
    };
    // AC-5: spells_ui.js reads the ONE z-index declaration at CALL time; the declaring module
    // (js/section_utils.js, dependency-free) is loaded with it, as the extension's shared scope does.
    w.eval(read('section_utils.js'));
    w.eval(read('spells_ui.js'));
    return w;
  }

  it('Retry removes the old card then re-creates (no "already open" dead end)', async function () {
    const w = bootSpells();
    await w.SpellsUi.createSpellDetailSection('Fireball', { x: 10, y: 10 });
    const firstCalls = w.__spellCalls.length;
    assert.ok(firstCalls >= 1, 'initial attempt fetched');

    const retry = document.querySelector('.be-retry-button');
    assert.ok(retry, 'error card offers Retry');
    retry.click();
    // the old container must be gone (it used to survive the re-create and be
    // removed afterwards, producing the "already open" toast + deletion)
    await new Promise((r) => setTimeout(r, 50));
    const details = document.querySelectorAll('.be-spell-detail');
    assert.strictEqual(details.length, 1, 'exactly one detail section remains (recreated in place)');
    assert.ok(w.__spellCalls.length > firstCalls, 'Retry actually re-attempted the fetch');
    const toasts = Array.from(document.querySelectorAll('.be-feedback')).map((f) => f.textContent);
    assert.ok(
      !toasts.some((t) => /already open/.test(t)),
      'never emits the contradictory "already open" toast: ' + JSON.stringify(toasts),
    );
  });
});

describe('AC-8 — the rotation affordance is themed (U-29)', function () {
  it('no debug magenta (#f0f) remains in the injected chrome', function () {
    const css = read('print_styles.js');
    assert.ok(!/#f0f\b/i.test(css), 'no #f0f left');
    assert.ok(!/magenta/i.test(css), 'no magenta reference left');
    const handle = css.slice(css.indexOf('.be-rotation-handle'));
    assert.ok(/var\(--be-gold/.test(handle) || /var\(--be-bone/.test(handle), 'handle uses locked tokens');
  });
});
