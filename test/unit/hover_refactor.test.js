const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const cssSourcePath = path.resolve(__dirname, '../../js/print_styles.js');


describe('Hover Logic Refactor (TDD)', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body></body>
      </html>
    `, {
      url: "http://localhost",
      runScripts: "dangerously",
      resources: "usable"
    });
    
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
  });

  it('should NOT have initHoverHighlights function available on window', function() {
    // This will fail initially as it IS available
    assert.strictEqual(typeof window.initHoverHighlights, 'undefined', 'initHoverHighlights should be removed');
  });

  it('should have native CSS :hover rules for wrappers scoped to active layer in main.js', function() {
    const code = fs.readFileSync(cssSourcePath, 'utf8');
    assert.ok(code.includes('.be-active-layer .be-section-wrapper:hover'), 'Should have scoped .be-section-wrapper:hover rule');
    assert.ok(code.includes('.be-active-layer .be-shape-wrapper:hover'), 'Should have scoped .be-shape-wrapper:hover rule');
    // ISSUE_drag_and_drop.md (2026-09-14): the GREEN HOVER GLOW is removed by
    // request — a `filter` on the hovered wrapper repaints the entire subtree,
    // which is the UX the owner rejected. The scoping this test exists for is
    // unchanged; only the painted effect is, so the assertion now FORBIDS the
    // glow instead of requiring it. The source still names it — in the comment
    // explaining why it went — so the check runs against the CSS with comments
    // stripped, which is the only honest reading of "no rule may paint this".
    const cssOnly = code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.ok(
      !/filter:[^;}]*drop-shadow\(0 0 15px #28a745\)/.test(cssOnly),
      'no rule may paint the green drop-shadow (ISSUE_drag_and_drop.md)',
    );
    const hoverRule = cssOnly.match(
      /\.be-active-layer \.be-section-wrapper:hover[\s\S]{0,220}?}/,
    );
    assert.ok(hoverRule, 'the active-layer hover rule still exists');
    assert.ok(
      !/filter:/.test(hoverRule[0]),
      'the hover rule raises stacking only — no filter on the subtree',
    );
    assert.ok(
      /z-index:\s*700000 !important/.test(hoverRule[0]),
      'the hovered active-layer wrapper is still raised above the sheet',
    );
  });

  it('should offer a centred nine-dot drag handle instead of the glow (ISSUE_drag_and_drop.md)', function() {
    const dnd = require(path.resolve(__dirname, '../../js/dnd.js'));
    // Point the module's seams at a fresh jsdom document (its own `document`
    // reference is the global one, reassigned by beforeEach above).
    const handleCss = (() => {
      dnd.injectDnDStyles();
      const node = global.document.getElementById('ddb-print-dnd-style');
      assert.ok(node, 'injectDnDStyles() installs its stylesheet');
      return node.textContent;
    })();

    const block = handleCss.match(/\.be-drag-handle\s*\{[\s\S]*?\}/);
    assert.ok(block, 'the handle is styled');
    assert.ok(
      /position:\s*absolute !important/.test(block[0]),
      'it is taken out of the section flow so it can sit on top of the content',
    );
    assert.ok(/inset:\s*0 !important/.test(block[0]), 'centred by inset:0 …');
    assert.ok(/margin:\s*auto !important/.test(block[0]), '… + margin:auto: no size assumptions, no transform');
    assert.ok(/cursor:\s*grab !important/.test(block[0]), 'the handle advertises a grab');
    assert.ok(/visibility:\s*hidden !important/.test(block[0]), 'invisible AND out of the hit-test and a11y tree at rest');
    assert.ok(/pointer-events:\s*none !important/.test(block[0]), 'a hidden handle never eats clicks on the content under it');
    // "a green shadow filter" was the complaint — do not let any shadow return.
    assert.ok(/box-shadow:\s*none !important/.test(block[0]), 'no box-shadow on the handle');
    assert.ok(
      !/filter:\s*drop-shadow/.test(handleCss),
      'the handle stylesheet paints no drop-shadow anywhere',
    );

    assert.ok(
      /\.be-active-layer [^{]*:hover [^{]*\.be-drag-handle[\s\S]{0,260}?visibility:\s*visible !important/.test(handleCss),
      'only the ACTIVE layer reveals the handle',
    );
    assert.ok(
      /\.be-layer-locked \.be-drag-handle[\s\S]{0,220}?visibility:\s*hidden !important/.test(handleCss),
      'a locked layer never shows the handle',
    );
    assert.ok(
      /@media print[\s\S]*?\.be-drag-handle\s*\{[\s\S]*?display:\s*none !important/.test(handleCss),
      'the handle never reaches the printed page',
    );
  });

  it('creates one centred handle per wrapper and lets it arm a drag (ISSUE_drag_and_drop.md)', function() {
    const dnd = require(path.resolve(__dirname, '../../js/dnd.js'));
    const wrapper = document.createElement('div');
    wrapper.className = 'be-section-wrapper';
    const content = document.createElement('div');
    content.className = 'print-section-container';
    wrapper.appendChild(content);
    document.body.appendChild(wrapper);

    const handle = dnd.ensureDragHandle(wrapper);
    assert.ok(handle, 'ensureDragHandle() returns the handle');
    assert.strictEqual(handle.parentElement, wrapper, 'it is a DIRECT CHILD of the wrapper (centred on the section box, not on its content)');
    assert.strictEqual(handle.tagName, 'BUTTON');
    assert.strictEqual(handle.className, 'be-drag-handle');
    assert.ok(handle.getAttribute('aria-label'), 'the handle is labelled for AT');
    assert.strictEqual(
      dnd.ensureDragHandle(wrapper),
      handle,
      'idempotent: a second pass never stacks a second handle',
    );

    // The engine must accept it as a grab target and still refuse everything
    // else that lives inside a wrapper.
    assert.strictEqual(dnd.isInteractiveTarget(handle), false, 'the handle arms a drag');
    const bar = document.createElement('div');
    bar.className = 'be-section-actions';
    const barBtn = document.createElement('button');
    bar.appendChild(barBtn);
    wrapper.appendChild(bar);
    assert.strictEqual(dnd.isInteractiveTarget(barBtn), true, 'action-bar buttons still never arm a drag');
    assert.strictEqual(dnd.isInteractiveTarget(content), false, 'plain section content arms a drag (unchanged)');
  });

  it('should NOT use .be-hover-highlight in the CSS strings', function() {
    const code = fs.readFileSync(cssSourcePath, 'utf8');
    // We expect .be-hover-highlight to be removed from the main CSS selector list
    const highlightSelectorMatch = code.match(/\.be-hover-highlight\s*,\s*\.be-focus-highlight-hover/);
    assert.ok(!highlightSelectorMatch, 'Primary highlight should NOT target .be-hover-highlight in selector list');
  });

  it('should NOT have initHoverHighlights function called or defined', async function() {
    const code = fs.readFileSync(mainJsPath, 'utf8') + fs.readFileSync(cssSourcePath, 'utf8');
    assert.ok(!code.includes('function initHoverHighlights'), 'Function definition should be removed');
    assert.ok(!code.includes('initHoverHighlights()'), 'Function call should be removed');
  });
});
