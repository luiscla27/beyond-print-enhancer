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

  it('should offer a nine-dot drag handle instead of the glow (ISSUE_drag_and_drop.md)', function() {
    const dnd = require(path.resolve(__dirname, '../../js/dnd.js'));
    // Point the module's seams at a fresh jsdom document (its own `document`
    // reference is the global one, reassigned by beforeEach above).
    const handleCss = (() => {
      dnd.injectDnDStyles();
      const node = global.document.getElementById('ddb-print-dnd-style');
      assert.ok(node, 'injectDnDStyles() installs its stylesheet');
      return node.textContent;
    })();
    /* The DECLARATIONS are what is asserted; the sheet's prose names the very
       properties it forbids ("no transform"), so a block matched out of the raw
       text would be read against commentary. Comments stripped once, here. */
    const declarations = handleCss.replace(/\/\*[\s\S]*?\*\//g, '');

    const block = declarations.match(/\.be-drag-handle\s*\{[\s\S]*?\}/);
    assert.ok(block, 'the handle is styled');
    // IT IS A FLEX CELL, NOT AN OVERLAY (ISSUE_corner_grip_lands_on_first_action_button).
    // Every property that would let the grip take a box the rail already handed to a
    // button is FORBIDDEN here, not merely absent: this placement is the fix, so a
    // re-anchored grip is a regression of the collision rather than a style tweak.
    assert.ok(
      /position:\s*relative !important/.test(block[0]),
      'it stays in the rail\'s flow (relative, so z-index still applies)',
    );
    for (const forbidden of [
      /position:\s*absolute/,
      /(^|[\s;{])inset\s*:/,
      /(^|[\s;{])top\s*:/,
      /(^|[\s;{])left\s*:/,
      /(^|[\s;{])translate\s*:/,
      /(^|[\s;{])transform\s*:/,
    ]) {
      assert.ok(
        !forbidden.test(block[0]),
        `the grip may not re-take a position the flex row owns: ${forbidden}`,
      );
    }
    assert.ok(
      /flex:\s*0 0 auto !important/.test(block[0]),
      'a narrow section may not squeeze the GRIP first — it holds its 39px tier',
    );
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
    // THE PRINT BLOCK CARRIES BOTH ARMS, and the browser had to catch that. The
    // base block's (0,2,0) arm beats the action buttons' rules, and a @media rule
    // does not outrank a higher-specificity declaration outside the media
    // question — so a lone `.be-drag-handle { display:none !important }` under
    // @media print LOSES to the grip's own `display:flex !important` and the
    // handle printed (measured: {"display":"flex","visibility":"visible"}).
    const printBlock = handleCss.match(/@media print\s*\{([\s\S]*?)\n\s*\}/)[1];
    assert.ok(
      /\.be-section-actions \.be-drag-handle/.test(printBlock),
      'the print hide repeats the (0,2,0) arm the base block wins with: ' + printBlock.trim(),
    );
  });

  it('puts the grip INSIDE the action rail, so no z-index yield exists or is needed (ISSUE_corner_grip_lands_on_first_action_button_20260922)', function () {
    // WHY A UNIT CASE FOR A PLACEMENT: which control wins one pixel is only visible to a
    // real pointer, and the browser case measures that. What the browser cannot see is
    // whether the collision became UNREPRESENTABLE or merely lost an argument. This case
    // pins the two facts that make it unrepresentable — the rail is a flex row with a gap,
    // and no rule re-levels the bar against its own child.
    const css = fs
      .readFileSync(cssSourcePath, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ''); // prose names other numbers; strip it first
    const dnd = require(path.resolve(__dirname, '../../js/dnd.js'));
    dnd.injectDnDStyles();
    const handleCss = global.document
      .getElementById('ddb-print-dnd-style').textContent.replace(/\/\*[\s\S]*?\*\//g, '');

    // THE RAIL IS A FLEX ROW — the ONE thing that gives every cell its own box. Matched at
    // line start so the bare resting rule is found, not a descendant selector.
    const rest = /(?:^|\n)\s*\.be-section-actions\s*\{([^}]*)\}/.exec(css);
    assert.ok(rest, 'the sheet declares a resting rule for the action rail');
    assert.ok(
      /display:\s*flex\s*;/.test(rest[1]),
      'the rail lays its cells out in a row: ' + rest[1].trim(),
    );
    assert.ok(
      /gap:\s*\d+px\s*;/.test(rest[1]),
      'the row separates them, so the grip cannot share a button\'s box: ' + rest[1].trim(),
    );
    // FALSIFIED, not assumed: with the pre-fix shape (a plain absolutely-positioned grip
    // beside the bar) the flex/gap pair below the FIRST cell did not keep them apart — the
    // grip was positioned, outside the row entirely. So the row properties alone are not the
    // proof; the grip being IN FLOW is the other half, asserted in the sibling case below.

    // NO CONDITIONAL RULE RE-LEVELS THE BAR ANYMORE. The yield (`z-index: 700001` on the
    // bar, under the grip's 700002) ranked two boxes that no longer overlap, and a level
    // that decides nothing beside the placement that replaced it is a second definition of
    // the same fact — the failure class this cascade keeps naming.
    const barZRules = [...css.matchAll(/([^{}]*\.be-section-actions)\s*\{([^}]*)\}/g)]
      .map((m) => ({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] }))
      .filter((r) => /z-index:\s*\d+/.test(r.body));
    assert.deepStrictEqual(
      barZRules.filter((r) => /:hover|:focus-within/.test(r.sel)).map((r) => r.sel),
      [],
      'no :hover / :focus-within rule re-levels the action rail (found: ' +
        JSON.stringify(barZRules.map((r) => r.sel)) + ')',
    );
    // The grip keeps ONE level, and it is a tie-break inside the row, not a fight with the
    // rail: it must still out-rank the bar's resting level so a wrapped row shows the GRIP.
    const gripZ = Number(/\.be-drag-handle\s*\{[\s\S]*?z-index:\s*(\d+)/.exec(handleCss)[1]);
    const restZ = Number(/z-index:\s*(\d+)/.exec(rest[1])[1]);
    assert.ok(
      gripZ > restZ,
      `the grip (${gripZ}) still out-ranks the rail's resting level (${restZ})`,
    );
  });

  it('keeps the RAIL REVEAL in LOCKSTEP with the grip reveal — arm for arm (Muse GATE-5 audit)', function () {
    // WHY THE LOCKSTEP MATTERS NOW MORE THAN IT DID: the grip is a CHILD of the rail, and
    // the rail's rest state is `opacity: 0`. A child cannot undo its parent's transparency,
    // so if the bar revealed on :hover alone while the grip revealed on :hover AND
    // :focus-within, a keyboard-reached grip would sit in an invisible row — the reveal
    // selector list is now a SHARED precondition, not two independent affordances.
    // Comparing the parsed sets is the only check that cannot rot into a comment.
    const arms = (css) => {
      const strip = css.replace(/\/\*[\s\S]*?\*\//g, '');
      const grab = (re) => {
        const m = re.exec(strip);
        if (!m) return null;
        return m[1]
          .split(',')
          .map((s) => s.trim().replace(/\s+/g, ' '))
          .filter(Boolean)
          // Drop the thing each rule is ABOUT: the reveal names the handle, the bar reveal
          // names the rail. Everything else (scope, wrapper, pseudo-class) is what must agree.
          .map((sel) => sel.replace(/\s*\.be-(drag-handle|section-actions)\b/g, ''))
          .sort();
      };
      return {
        reveal: grab(/([^{}]*\.be-drag-handle)\s*\{[^}]*opacity:\s*1\s*!important/),
        bar: grab(/([^{}]*\.be-section-actions)\s*\{[^}]*opacity:\s*1\s*[;}]/),
      };
    };
    const dnd = require(path.resolve(__dirname, '../../js/dnd.js'));
    dnd.injectDnDStyles();
    const revealCss = global.document.getElementById('ddb-print-dnd-style').textContent;
    const barCss = fs.readFileSync(cssSourcePath, 'utf8');
    const { reveal, bar } = arms(revealCss + '\n' + barCss);

    assert.ok(reveal, 'the grip reveal rule is found in js/dnd.js');
    assert.ok(bar, 'the rail reveal rule is found in js/print_styles.js');
    // NON-VACUITY: two empty lists would compare equal, so the arms themselves are named.
    assert.ok(
      reveal.length >= 2 &&
        reveal.some((s) => s.includes(':hover')) &&
        reveal.some((s) => s.includes(':focus-within')),
      'the reveal list is real and carries both arms: ' + JSON.stringify(reveal),
    );
    assert.deepStrictEqual(
      bar,
      reveal,
      'the rail must become visible+hittable on EXACTLY the arms that reveal the grip — any ' +
        'arm present on one list and not the other is a reachable state where the grip is ' +
        'revealed inside an invisible row (or a dead row-swallowing grip): ' +
        'reveal=' + JSON.stringify(reveal) + ' bar=' + JSON.stringify(bar),
    );
    // AND THE COMPARISON IS NOT VACUOUS: a rail reveal that loses its focus arm, or reaches
    // a wrapper type the grip reveal does not, must break the equality above.
    const mutated = arms(revealCss + '\n' + barCss.replace(/:focus-within/g, ':hover'));
    assert.ok(
      JSON.stringify(mutated.bar) !== JSON.stringify(mutated.reveal),
      'dropping the focus arm from the rail reveal is DETECTED — the check is load-bearing',
    );
  });

  it('creates one handle per wrapper, as the rail\'s FIRST CELL, and lets it arm a drag (ISSUE_drag_and_drop.md)', function() {
    const dnd = require(path.resolve(__dirname, '../../js/dnd.js'));
    const wrapper = document.createElement('div');
    wrapper.className = 'be-section-wrapper';
    const content = document.createElement('div');
    content.className = 'print-section-container';
    wrapper.appendChild(content);
    document.body.appendChild(wrapper);

    const handle = dnd.ensureDragHandle(wrapper);
    assert.ok(handle, 'ensureDragHandle() returns the handle');
    const rail = wrapper.querySelector(':scope > .be-section-actions');
    assert.ok(rail, 'the wrapper has an action rail');
    assert.strictEqual(handle.parentElement, rail, 'the grip is a CHILD of the rail — a cell of the row, not a second overlay on the corner');
    assert.strictEqual(rail.firstChild, handle, 'and it holds the FIRST slot, left of every button');
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
    const barBtn = document.createElement('button');
    rail.appendChild(barBtn);
    assert.strictEqual(dnd.isInteractiveTarget(barBtn), true, 'action-bar buttons still never arm a drag');
    assert.strictEqual(dnd.isInteractiveTarget(content), false, 'plain section content arms a drag (unchanged)');
  });

  it('keeps the grip in the rail\'s FIRST slot across a section rebuild, and never stacks one', function () {
    // WHY THIS CASE EXISTS: 'getOrCreateActionContainer' / 'addRobustButton'
    // (js/main.js) re-create and re-fill the rail while the drag engine owns the
    // grip, and 'ensureDragHandle' runs on a MutationObserver rather than in the
    // section factory — so the ordering that puts the grip ahead of the buttons
    // is a RACE between two owners of the same element, and a re-append or a
    // prepend by the rail's other owner silently moves the grip to the END of
    // the row (or the corner it was moved out of). Every assertion below is
    // about the state after the OTHER owner touched the rail.
    const dnd = require(path.resolve(__dirname, '../../js/dnd.js'));
    const wrapper = document.createElement('div');
    wrapper.className = 'be-section-wrapper';
    document.body.appendChild(wrapper);

    const handle = dnd.ensureDragHandle(wrapper);
    const rail = handle.parentElement;
    // The real builder's own accessors, mirrored: js/main.js queries by selector
    // and appends, so a rebuild is "find the existing rail, append buttons".
    const btnA = document.createElement('button');
    btnA.className = 'be-select-section-button';
    rail.appendChild(btnA);
    assert.strictEqual(rail.firstChild, handle, 'appending a button leaves the grip first');

    // A REBUILD that prepends a control (the "more options" tail, and any
    // future insertBefore) must not push the grip out of slot zero.
    rail.insertBefore(document.createElement('button'), rail.firstChild);
    assert.notStrictEqual(rail.firstChild, handle, 'the prepend DID displace the grip (the premise below)');
    dnd.ensureDragHandle(wrapper);
    assert.strictEqual(rail.firstChild, handle, 'the engine pass puts it back in slot zero');
    assert.strictEqual(
      wrapper.querySelectorAll('.be-drag-handle').length,
      1,
      'and re-running never stacks a second grip',
    );

    // THE RAIL REBUILT FROM UNDERNEATH: the observer sees the removed handle and
    // re-visits the wrapper (js/dnd.js watchDragHandles), so a torn-out rail must
    // come back with a grip in it. That is the case the parentNode → closest
    // change in the removed-node arm exists for: the handle's parent is now the
    // RAIL, and if the rail itself is what was removed, its parentNode is the
    // detached fragment — resolving the WRAPPER is the only lookup that finds
    // the live one.
    rail.remove();
    const rebuilt = document.createElement('div');
    rebuilt.className = 'be-section-actions';
    wrapper.appendChild(rebuilt);
    const second = dnd.ensureDragHandle(wrapper);
    assert.ok(second, 'a rebuilt rail gets its grip back');
    assert.strictEqual(second.parentElement, rebuilt, 'the new rail, not the detached one');
    assert.strictEqual(rebuilt.firstChild, second, 'in slot zero again');
    assert.strictEqual(
      wrapper.querySelectorAll('.be-drag-handle').length,
      1,
      'one grip per wrapper after a rebuild',
    );
  });

  it('re-arms after the section is stripped bare: the removed-node arm, not the added one', async function () {
    // WHY THIS CASE IS THE REAL TEST OF THAT ARM: `ensureDragHandle` is called
    // directly in the cases above, which proves the function; the observer is
    // what proves the SHEET keeps its grip when another owner rebuilds a section
    // under it. So the strip here adds NOTHING back — the added-node arm cannot
    // fire, and only the removed-node arm can put the grip back.
    //
    // IT IS ALSO where `node.parentNode` was wrong: a MutationObserver callback
    // runs in a microtask, so by then a genuinely removed node has NO parent at
    // all (a bare `remove()` leaves it null; only a MOVE keeps one). The old arm
    // therefore saw the one case it exists for — "a section rebuilt in place" —
    // as no case at all. With that expression restored, this test fails.
    const dnd = require(path.resolve(__dirname, '../../js/dnd.js'));
    // jsdom's MutationObserver lives on the window, and dnd.js reads the bare
    // global (that is what `watchDragHandles`' guard checks), so the harness has
    // to hand it over — without this the case would only ever assert the null
    // return and pass vacuously.
    global.MutationObserver = global.window.MutationObserver;
    const wrapper = document.createElement('div');
    wrapper.className = 'be-section-wrapper';
    document.body.appendChild(wrapper);
    const observer = dnd.watchDragHandles(document.documentElement);
    assert.ok(observer, 'the observer arms on a host with MutationObserver');

    dnd.ensureDragHandle(wrapper);
    assert.strictEqual(wrapper.querySelectorAll('.be-drag-handle').length, 1, 'precondition: it has a grip');

    // Tear the section down and hand back NOTHING.
    wrapper.innerHTML = '';
    assert.strictEqual(wrapper.querySelectorAll('.be-drag-handle').length, 0, 'precondition: the grip is gone');
    await new Promise((r) => setTimeout(r, 0)); // let the microtask flush land

    const rail = wrapper.querySelector(':scope > .be-section-actions');
    assert.ok(rail, 'the engine re-created the rail it needs to hold a grip in');
    const grip = rail.querySelector(':scope > .be-drag-handle');
    assert.ok(grip, 'and put a grip back in it');
    assert.strictEqual(rail.firstChild, grip, 'in slot zero');
    assert.strictEqual(
      wrapper.querySelectorAll('.be-drag-handle').length,
      1,
      'exactly one grip after the rebuild',
    );
    observer.disconnect();
  });

  it('migrates a corner grip left by the previous placement instead of stacking', function () {
    // WHY: a page built under the sibling placement keeps its grip as a direct
    // child of the wrapper. 'ensureDragHandle' must MOVE that node into the rail
    // — a plain create would leave two grips on one section, and a section can
    // only be grabbed from one of them.
    const dnd = require(path.resolve(__dirname, '../../js/dnd.js'));
    const wrapper = document.createElement('div');
    wrapper.className = 'be-section-wrapper';
    const old = document.createElement('button');
    old.className = 'be-drag-handle';
    old.setAttribute('aria-label', 'Drag to move this section');
    wrapper.appendChild(old); // the legacy sibling placement
    document.body.appendChild(wrapper);

    const handle = dnd.ensureDragHandle(wrapper);
    assert.strictEqual(handle, old, 'the existing node is reused, not replaced');
    assert.strictEqual(
      handle.parentElement.className,
      'be-section-actions',
      'and it is relocated INTO the rail',
    );
    assert.strictEqual(
      wrapper.querySelectorAll('.be-drag-handle').length,
      1,
      'exactly one grip on a migrated section',
    );
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
