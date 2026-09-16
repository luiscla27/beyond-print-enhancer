const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

/**
 * PROPERTIES PANEL — the caption for the scale floor's cost.
 *
 * (issue `scaling_floor_spells_0443_20260913`, option 1: a section floored at 0.60 is still
 * clipped, and the clip must be made "visible somehow (a marker, a panel warning)" rather than
 * silent as it was pre-1.17.3.)
 *
 * TWO SURFACES, ONE FACT. `fitContainer` (js/main.js) stamps `data-scaling-clipped` when the
 * FLOOR — not the arithmetic — decides the scale and the tail is still cut off; js/print_styles.js
 * paints that attribute as a red band on the sheet, and this panel note is the half that says WHY
 * and WHAT TO DO. The panel reads the attribute instead of recomputing a ratio so it can never
 * disagree with the band the user is looking at: one measurement, two renderings. The last case
 * presses the real Auto-scale checkbox and requires the note to go away WITHOUT any hand having
 * removed it — that is what proves the note is keyed to the product's marker rather than to a
 * copy of the decision.
 *
 * The harness is the full panel stack (boot-time section layout, real selection click, a
 * `window.ResizeObserver` the product can actually install), because the note is produced by the
 * same pass that builds the toggle beside it and consumes a marker written by the scaling
 * feature. A `window.eval` of the panel function alone would not exercise either end.
 */

const read = (rel) => fs.readFileSync(path.resolve(__dirname, '../../', rel), 'utf8');

const MODULES = [
  'js/dom/element_wrapper.js',
  'js/dom/dom_manager.js',
  'js/context_menu.js',
  'js/asset_catalog.js',
  'js/storage.js',
  'js/image_processor.js',
  'js/print_styles.js',
  'js/section_utils.js',
  'js/modals.js',
  'js/properties_panel.js',
  'js/layout_scan.js',
  'js/layout_apply.js',
  'js/persistence.js',
  'js/controls.js',
  'js/shape_picker.js',
  'js/spells_ui.js',
  'js/filters.js',
  'js/layout_ops.js',
  'js/section_cloning.js',
  'js/main.js',
];

describe('Properties Panel — scale-floor clip note', function () {
  let window, document, observers;

  beforeEach(function () {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body>
         <div class="ct-character-sheet-desktop">
           <div class="ct-character-sheet__inner">
             <div id="print-layout-wrapper">
               <div id="print-enhance-sections-layer">
                 <div class="be-section-wrapper">
                   <div class="print-section-container" id="section-1">
                     <div class="print-section-header"><span>Section 1</span></div>
                     <div class="print-section-content">
                       <div class="content-inner">long content</div>
                     </div>
                   </div>
                 </div>
               </div>
             </div>
           </div>
         </div>
       </body></html>`,
      { url: 'http://localhost', runScripts: 'dangerously', resources: 'usable' },
    );

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;

    // On `window`, not just `global`: js/main.js resolves `ResizeObserver` through its own
    // window, so a node-global mock leaves the scaling feature uninstalled. It records its
    // targets so a case can deliver a measurement the way the host does.
    observers = [];
    class MockResizeObserver {
      constructor(callback) {
        this.callback = callback;
        this.observed = new Set();
        observers.push(this);
      }
      observe(target) {
        this.observed.add(target);
      }
      unobserve(target) {
        this.observed.delete(target);
      }
      disconnect() {
        this.observed.clear();
      }
      deliver() {
        this.callback(
          Array.from(this.observed).map((target) => ({
            target,
            contentRect: { width: 0, height: 0 },
          })),
          this,
        );
      }
    }
    window.ResizeObserver = MockResizeObserver;
    global.ResizeObserver = MockResizeObserver;

    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
    window.__DDB_TEST_MODE__ = true;
    for (const rel of MODULES) window.eval(read(rel));
  });

  /** Select section-1 the way the sheet does, and return the panel that opens. */
  function openPanel() {
    window.createControls();
    window.injectCloneButtons();
    const section = document.getElementById('section-1');
    // The action bar is appended to the WRAPPER (js/main.js getOrCreateActionContainer), a
    // sibling of the container it acts on — so the button is looked up from the wrapper.
    const scope = section.closest('.be-section-wrapper') || section;
    const select = scope.querySelector('.be-select-section-button');
    assert.ok(select, 'the section carries no select button — the fixture is not a real section');
    select.click();
    const panel = document.getElementById('print-enhance-properties-panel');
    assert.ok(panel, 'the panel did not open');
    return { section, panel };
  }

  /** Give a section a content box and an inner that overflows it by `w`x`h`. */
  function setGeometry(section, boxW, boxH, innerW, innerH) {
    const content = section.querySelector('.print-section-content');
    const inner = content.firstElementChild;
    Object.defineProperty(content, 'clientWidth', { value: boxW, configurable: true });
    Object.defineProperty(content, 'clientHeight', { value: boxH, configurable: true });
    Object.defineProperty(inner, 'scrollWidth', { value: innerW, configurable: true });
    Object.defineProperty(inner, 'scrollHeight', { value: innerH, configurable: true });
    return inner;
  }

  const noteIn = (panel) =>
    Array.from(panel.querySelectorAll('.be-prop-panel-note')).find((el) =>
      /auto-scale/i.test(el.textContent),
    );

  /** The Auto-scale checkbox the panel renders for the open section. */
  function autoScaleToggle(panel) {
    const toggle = Array.from(panel.querySelectorAll('input[type="checkbox"]')).find((box) =>
      /auto-scale/i.test(box.parentElement ? box.parentElement.textContent : ''),
    );
    assert.ok(toggle, 'the panel renders no Auto-scale checkbox');
    return toggle;
  }

  it('says nothing while the floor costs nothing', function () {
    const { panel } = openPanel();
    assert.ok(
      !noteIn(panel),
      'a section that is not clipped carries a clip warning — the note would be noise, and ' +
        'a warning the user learns to ignore is worse than none',
    );
  });

  it('does not duplicate itself when the panel is rebuilt between the write and the sync', async function () {
    // The toggle's re-read is a ZERO TIMER, so it can land AFTER another pass has rebuilt the
    // panel — `updatePropertiesPanel()` does `panel.innerHTML = ""` and constructs fresh nodes,
    // while `clipNote` is a per-build closure variable. Without the adopt-what-is-in-the-host
    // step in `syncClipNote`, a stale closure adds its OWN note to the CURRENT panel beside the
    // fresh copy → two identical warnings. The user pressed one checkbox; any other action in the
    // sheet (a selection click, a font-size drag) can re-render the panel in that gap.
    const { section, panel } = openPanel();
    setGeometry(section, 100, 100, 200, 300);
    window.initResponsiveScaling();
    observers[observers.length - 1].deliver();
    assert.strictEqual(section.getAttribute('data-scaling-clipped'), 'true', 'setup: marked');

    // Turn the feature OFF first, so the starting state is scaled-off and unmarked and the switch
    // press below is the one that re-clips the section (and therefore re-stamps the marker).
    const off = autoScaleToggle(panel);
    off.checked = false;
    off.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.strictEqual(section.getAttribute('data-scaling-clipped'), null, 'setup: unmarked');

    // Now intercept the timer the handler schedules and rebuild the panel inside the gap.
    const timer = window.setTimeout;
    window.setTimeout = (fn, ms) =>
      timer(() => {
        window.PropertiesPanel.updatePropertiesPanel(panel); // a fresh build owns the panel now
        fn(); // …and this is the PREVIOUS build's sync, running against it
      }, ms);
    let notes;
    try {
      const on = autoScaleToggle(panel);
      on.checked = true;
      on.dispatchEvent(new window.Event('change', { bubbles: true }));
      await new Promise((resolve) => timer(resolve, 0));
      notes = Array.from(panel.querySelectorAll('.be-prop-panel-note')).filter((el) =>
        /auto-scale/i.test(el.textContent),
      );
    } finally {
      window.setTimeout = timer;
    }

    assert.strictEqual(
      section.getAttribute('data-scaling-clipped'),
      'true',
      'setup: the section is clipped again, so one note IS warranted',
    );
    assert.strictEqual(
      notes.length,
      1,
      notes.length + ' clip notes on a section that is clipped once — ' +
        'a stale closure appended a second copy: ' +
        JSON.stringify(notes.map((n) => n.textContent.slice(0, 30))),
    );
  });

  it('names the cost and the way out when the section is floored into a clip', function () {
    const { section, panel } = openPanel();
    section.setAttribute('data-scaling-clipped', 'true');
    window.PropertiesPanel.updatePropertiesPanel(panel);

    const note = noteIn(panel);
    assert.ok(
      note,
      'data-scaling-clipped paints a red band on the sheet but the panel never explains it',
    );
    // Both halves of the message are load-bearing: the reason (the floor, not a bug) and the
    // action (resize, or turn the feature off). A note that only says "clipped" leaves the
    // user with a warning and no lever.
    assert.match(note.textContent, /floor/i, 'the note does not say what causes the clip');
    assert.match(note.textContent, /taller|drag/i, 'the note offers no way to fix it');
    assert.match(note.textContent, /Auto-scale/i, 'the note does not name the switch');
    // A DIV, not a SPAN: the panel's first <span> is a debt-pinned readout
    // (appendPositionGroup's comment in js/properties_panel.js), and a leading span here would
    // silently move what every debt test reads.
    assert.strictEqual(note.tagName, 'DIV', 'the note must not be a span');
    assert.strictEqual(
      panel.querySelector('span').textContent,
      '10px',
      'the first span of the panel is the pinned font-size readout — the note displaced it',
    );
  });

  it('round-trips: the feature marks, the panel explains, the switch clears both', async function () {
    const { section, panel } = openPanel();
    // 100x100 box, 200x300 content: the arithmetic wants 0.333, the floor gives 0.6, and the
    // drawn height (180) still blows the box → the product itself stamps the marker. Nothing in
    // this case writes `data-scaling-clipped` by hand, so a marker that never arrives means the
    // product stopped marking, not that the test forgot to.
    const inner = setGeometry(section, 100, 100, 200, 300);
    window.initResponsiveScaling();
    observers[observers.length - 1].deliver();
    assert.strictEqual(inner.style.transform, 'scale(0.6)', 'setup: the floor clamped this');
    assert.strictEqual(
      section.getAttribute('data-scaling-clipped'),
      'true',
      'setup: the product did not mark a section the floor left clipped',
    );
    assert.ok(!noteIn(panel), 'setup: the panel was built before the marker existed');

    // The note arrives on the next panel pass, from the attribute alone.
    window.PropertiesPanel.updatePropertiesPanel(panel);
    assert.ok(noteIn(panel), 'a marker already on the section produced no note on re-render');

    // Press the switch OFF. This writes `data-no-auto-scale` and nothing else: js/main.js's
    // attribute observation runs fitContainer, clearScaling takes the marker down with the
    // scale, and the panel's deferred sync must follow it. Neither the test nor the handler
    // removes the note by hand — if the panel keyed its note off anything other than the
    // marker, or the marker outlived the scale, this is the case that notices.
    const toggle = autoScaleToggle(panel);
    toggle.checked = false;
    toggle.dispatchEvent(new window.Event('change', { bubbles: true }));
    // One macrotask: the MutationObserver callback is a microtask, and the panel's re-read is
    // the timer scheduled after it.
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    assert.strictEqual(section.dataset.noAutoScale, 'true', 'setup: the switch did not land');
    assert.strictEqual(
      section.getAttribute('data-scaling-clipped'),
      null,
      'the marker survived the scale being turned off',
    );
    assert.strictEqual(inner.style.transform, '', 'the scale survived the switch');
    assert.ok(
      !noteIn(panel),
      'the note survived the marker going away — it is keyed off a stale fact, not the attribute',
    );
  });
});
