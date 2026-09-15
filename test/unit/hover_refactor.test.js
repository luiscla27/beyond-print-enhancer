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

  it('makes the action bar YIELD while the grip is revealed, on a short section (ISSUE_grip_covered_by_actions_bar_20260914)', function () {
    // WHY A UNIT CASE FOR A STACKING FIX: who wins one pixel is only visible to a real
    // pointer, and the browser case measures exactly that. What the browser cannot see is
    // WHY it went red. This case pins the three numbers and the one keyword the whole fix
    // rests on, so a regression names itself instead of just losing a grip.
    //
    // THE LADDER (operator chose option 3 — the bar yields — because hoisting the grip over
    // the bar covers 60% of the Select button on `section-extra-tidbits-wrapper`, measured):
    //   hovered wrapper 700000  < yielded bar 700001  < the grip 700002
    const css = fs
      .readFileSync(cssSourcePath, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ''); // prose names other numbers; strip it first
    const dnd = require(path.resolve(__dirname, '../../js/dnd.js'));
    dnd.injectDnDStyles();
    const handleCss = global.document
      .getElementById('ddb-print-dnd-style').textContent.replace(/\/\*[\s\S]*?\*\//g, '');

    const gripZ = Number(/\.be-drag-handle\s*\{[\s\S]*?z-index:\s*(\d+)/.exec(handleCss)[1]);
    assert.ok(gripZ > 0, 'the grip declares a numeric z-index: ' + gripZ);
    // The bar's RESTING level in this same stylesheet — what puts it above the section's
    // own content. The yield may not sink it under the thing it was raised for. Matched at
    // line start so the bare resting rule is found, not any descendant selector that happens
    // to END in `.be-section-actions` (the yield itself comes earlier in the sheet).
    const restZ = Number(
      /(?:^|\n)\s*\.be-section-actions\s*\{[^}]*?z-index:\s*(\d+)/.exec(css)[1],
    );

    // THE YIELD RULE ITSELF, found by what it does rather than by a remembered selector: a
    // rule that re-levels the bar from a CONDITIONAL selector (the resting
    // `.be-section-actions { z-index: 20 }` is the baseline above, not a yield).
    const barRules = [...css.matchAll(/([^{}]*\.be-section-actions)\s*\{([^}]*)\}/g)]
      .map((m) => ({ sel: m[1].trim().replace(/\s+/g, " "), body: m[2] }))
      .filter((r) => /z-index:\s*\d+/.test(r.body));
    const yieldRules = barRules.filter((r) => /:hover|:focus-within/.test(r.sel));
    assert.strictEqual(
      yieldRules.length,
      1,
      'exactly ONE conditional rule re-levels the action bar, and it is the yield (found: ' +
        JSON.stringify(barRules.map((r) => r.sel)) + ")",
    );
    const yieldRule = yieldRules[0];
    const barZ = Number(/z-index:\s*(\d+)/.exec(yieldRule.body)[1]);

    // THE LADDER, both bounds: inside a wrapper's stacking context the bar competes only
    // with the section's content and with the grip, so it must stay ABOVE the resting level
    // and BELOW the grip. That gap is the whole fix.
    const ladder = (rest, bar, grip) => rest < bar && bar < grip;
    assert.ok(
      ladder(restZ, barZ, gripZ),
      `the yielded bar ${barZ} must sit between the bar's resting level ${restZ} and the ` +
        `grip's ${gripZ}. At or under the resting level the bar sinks into the section's own ` +
        'content; at or over the grip the collision is unfixed ' +
        '(temp/archived/ISSUE_grip_covered_by_actions_bar_on_small_sections_20260914.md)',
    );
    // The level the bar is BUILT with, read from the ONE map js/main.js writes it from —
    // not restated as a literal here.
    const mapSrc = fs.readFileSync(path.resolve(__dirname, '../../js/section_utils.js'), 'utf8');
    const builtZ = Number(/ACTIONS_BAR:\s*"(\d+)"/.exec(mapSrc)[1]);
    // FALSIFIED BOTH WAYS: the SAME predicate with the pre-fix pair (the bar left at the
    // inline level it is built with, grip 700002) must be FALSE — that pair is precisely
    // what let the buttons sit on the grip, so this case cannot pass vacuously.
    assert.ok(
      !ladder(restZ, builtZ, gripZ),
      'the pre-fix ladder FAILS — the check is load-bearing',
    );
    assert.ok(
      barZ < builtZ,
      `the yielded ${barZ} must be LOWER than the bar's built level ${builtZ} — that is the yield`,
    );
    assert.ok(
      /!important/.test(yieldRule.body),
      'the yield MUST be !important: the bar carries an INLINE level (js/main.js ' +
        'getOrCreateActionContainer) and inline outranks a non-important stylesheet rule at ' +
        'any specificity — without it the yield silently does nothing',
    );
    // The yield fires on the grip's OWN trigger, so the two can never disagree about when
    // the grip is on screen. The reveal in js/dnd.js is `.be-active-layer … :hover /
    // :focus-within .be-drag-handle` — same scope, both arms, or a keyboard-revealed grip
    // still collides.
    assert.ok(
      yieldRule.sel.includes('.be-active-layer'),
      'the yield is scoped to the active layer, like the grip reveal: ' + yieldRule.sel,
    );
    for (const arm of [':hover', ':focus-within']) {
      assert.ok(
        yieldRule.sel.includes(arm),
        `the yield covers the ${arm} arm of the grip's reveal: ${yieldRule.sel}`,
      );
    }
  });

  it('keeps the bar yield in LOCKSTEP with the grip reveal — arm for arm (Muse GATE-5 audit)', function () {
    // WHY THIS CASE EXISTS: the yield only protects the grip while the CONDITION that
    // revealed the grip is also the condition that lowered the bar. The whole safety of
    // option 3 is therefore set equality between two selector lists written in two
    // different files (js/dnd.js owns the reveal, js/print_styles.js owns the yield). If
    // the reveal ever gains an arm that the yield does not carry — a state class, a
    // :focus-visible, a second wrapper type — there is a reachable state where the grip is
    // on screen and the bar is still at its inline built level, i.e. the original bug.
    // Comparing the parsed sets is the only check that cannot rot into a comment.
    const arms = (css) => {
      const strip = css.replace(/\/\*[\s\S]*?\*\//g, "");
      const grab = (re) => {
        const m = re.exec(strip);
        if (!m) return null;
        return m[1]
          .split(",")
          .map((s) => s.trim().replace(/\s+/g, " "))
          .filter(Boolean)
          // Drop the thing each rule is ABOUT: the reveal names the handle, the yield names
          // the bar. Everything else (scope, wrapper, pseudo-class) is what must agree.
          .map((sel) => sel.replace(/\s*\.be-(drag-handle|section-actions)\b/g, ""))
          .sort();
      };
      return {
        reveal: grab(/([^{}]*\.be-drag-handle)\s*\{[^}]*opacity:\s*1\s*!important/),
        yield: grab(
          /([^{}]*\.be-section-actions)\s*\{[^}]*z-index:\s*700001[^}]*\}/,
        ),
      };
    };
    const dnd = require(path.resolve(__dirname, '../../js/dnd.js'));
    dnd.injectDnDStyles();
    const revealCss = global.document
      .getElementById('ddb-print-dnd-style').textContent;
    const yieldCss = fs.readFileSync(cssSourcePath, 'utf8');
    const { reveal, yield: yielded } = arms(revealCss + "\n" + yieldCss);

    assert.ok(reveal, 'the grip reveal rule is found in js/dnd.js');
    assert.ok(yielded, 'the bar yield rule is found in js/print_styles.js');
    // NON-VACUITY: two empty lists would compare equal, so the arms themselves are named.
    assert.ok(
      reveal.length >= 2 &&
        reveal.some((s) => s.includes(":hover")) &&
        reveal.some((s) => s.includes(":focus-within")),
      'the reveal list is real and carries both arms: ' + JSON.stringify(reveal),
    );
    assert.deepStrictEqual(
      yielded,
      reveal,
      "the yield must fire on EXACTLY the arms that reveal the grip — any arm present on " +
        "one side and not the other is a state where the grip is shown and the bar has not " +
        "yielded (the collision of " +
        "temp/archived/ISSUE_grip_covered_by_actions_bar_on_small_sections_20260914.md). " +
        "reveal=" + JSON.stringify(reveal) + " yield=" + JSON.stringify(yielded),
    );
    // AND THE COMPARISON IS NOT VACUOUS: a yield that loses its focus arm, or reaches a
    // wrapper type the reveal does not, must break the equality above.
    const mutated = arms(revealCss + "\n" + yieldCss.replace(/:focus-within/g, ":hover"));
    assert.ok(
      JSON.stringify(mutated.yield) !== JSON.stringify(mutated.reveal),
      'dropping the focus arm from the yield is DETECTED — the check is load-bearing',
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
