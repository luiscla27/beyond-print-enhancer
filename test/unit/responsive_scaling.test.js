const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

/**
 * RESPONSIVE SCALING — the wiring, not a copy of the arithmetic.
 *
 * (issue `responsive_scaling_observer_never_observed_20260912`, wired 2026-09-13.)
 *
 * THE HOLE THIS CLOSES. The previous version of this file proved the feature by
 * re-implementing `initResponsiveScaling`'s callback INSIDE the test and triggering
 * that copy — while the product constructed a ResizeObserver and never called
 * `observe()` on it. An observer that observes nothing never fires, so the shipped
 * feature did nothing and the suite stayed green. A test that copies the logic cannot
 * fail for a missing wire; every case below therefore drives the PRODUCT's own
 * callback, reached through the observer instance the product constructed, and the
 * first case asserts the wire itself (the `observe()` call) that was absent.
 *
 * The mock records its instances (`instances`) and its targets (`observed`) for
 * exactly that reason: `observed` is the assertion the old suite never made.
 */
describe('Responsive Content Scaling', function() {
  let window, document, ResizeObserverMock;

  before(async function() {
    // Mock ResizeObserver
    const instances = [];
    ResizeObserverMock = class {
        constructor(callback) {
            this.callback = callback;
            this.observed = new Set();
            instances.push(this);
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
        // Manual trigger for test
        trigger(entries) {
            this.callback(entries);
        }
    };
    ResizeObserverMock.instances = instances;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
            <div id="print-enhance-sections-layer">
              <div class="be-section-wrapper">
                <div class="print-section-container" id="section-1">
                  <div class="print-section-header">Header</div>
                  <div class="print-section-content">
                      <div class="content-inner">Some long content that might overflow</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    const dom = new JSDOM(htmlContent, {
      runScripts: "dangerously",
      resources: "usable"
    });
    window = dom.window;
    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
    document = window.document;
    window.ResizeObserver = ResizeObserverMock;

    // Inject main.js logic
    window.__DDB_TEST_MODE__ = true;
    let mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
    const sectionUtils = fs.readFileSync(path.resolve(__dirname, '../../js/section_utils.js'), 'utf8');
const layoutOps = fs.readFileSync(path.resolve(__dirname, '../../js/layout_ops.js'), 'utf8');

    const printStyles = fs.readFileSync(path.resolve(__dirname, '../../js/print_styles.js'), 'utf8');
    let elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
    let domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
    const scriptEl = document.createElement('script');
    scriptEl.textContent = printStyles + '\n' + sectionUtils + '\n' + elementWrapper + '\n' + domManager + '\n' + layoutOps + '\n' + mainJs;
    document.body.appendChild(scriptEl);
  });

  /** The observer instance the PRODUCT constructed, or null. */
  function productObserver() {
    return ResizeObserverMock.instances[ResizeObserverMock.instances.length - 1] || null;
  }

  /** Give the document MutationObserver a microtask turn to deliver its records. */
  async function settle() {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  it('WIRING: initResponsiveScaling() observes every existing .print-section-container', function() {
    ResizeObserverMock.instances.length = 0;
    window.initResponsiveScaling();

    const observer = productObserver();
    assert.ok(observer, 'initResponsiveScaling() constructed no ResizeObserver');
    const container = document.getElementById('section-1');
    assert.ok(
      observer.observed.has(container),
      'the container is NOT observed — the feature is inert again (observed: ' +
        observer.observed.size + ')',
    );
  });

  it('WIRING: a container created AFTER boot is observed too', async function() {
    const container = document.createElement('div');
    container.className = 'print-section-container';
    container.id = 'section-late';
    container.innerHTML =
      '<div class="print-section-content"><div class="content-inner">late</div></div>';
    document
      .getElementById('print-enhance-sections-layer')
      .appendChild(container);
    await settle();

    const observer = productObserver();
    assert.ok(
      observer.observed.has(container),
      'a section added after init is never observed, so it can never be scaled',
    );
  });

  it('WIRING: content added INSIDE an observed section forces a re-measure', async function() {
    const observer = productObserver();
    const container = document.getElementById('section-late');
    const content = container.querySelector('.print-section-content');
    const inner = container.querySelector('.content-inner');

    Object.defineProperty(content, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(inner, 'scrollWidth', { value: 100, configurable: true });
    Object.defineProperty(inner, 'scrollHeight', { value: 100, configurable: true });

    // First delivery: it fits, and the box is recorded.
    observer.trigger([{ target: container }]);
    assert.notStrictEqual(container.getAttribute('data-scaling'), 'true');

    // The overflow grows with NO change to the container's own box (a fixed-height
    // section does not resize when its content does), so the size record would
    // suppress the re-measure unless the mutation requested one.
    Object.defineProperty(inner, 'scrollHeight', { value: 200, configurable: true });
    const extra = document.createElement('p');
    content.appendChild(extra);
    await settle();

    observer.trigger([{ target: container }]);
    assert.strictEqual(
      container.getAttribute('data-scaling'),
      'true',
      'content added inside a section did not schedule a re-measure',
    );
  });

  it('should scale down content if it exceeds container bounds', function() {
    const container = document.getElementById('section-1');
    const content = container.querySelector('.print-section-content');
    const inner = container.querySelector('.content-inner');

    // Initialize scaling
    window.initResponsiveScaling();

    // The product's OWN callback, reached through the product's own observer — not a
    // re-implementation of it (that copy is what let the dead feature look tested).
    const observer = productObserver();
    assert.ok(observer, 'no observer constructed by the product');

    // Mock dimensions: content (160x160) into container (100x100).
    //
    // The ratio lands at 0.625 — ABOVE `MIN_SCALE_FLOOR` (0.60) — on purpose. This case is the
    // arithmetic proof: it asserts the exact quotient, so it fails if `scaleX/scaleY` are
    // swapped, dropped, or replaced by a constant. It was 200x200 (a raw 0.5) until
    // issue scaling_offswitch_no_remeasure_and_stale_floor_expectations_20260914: the
    //    floor shipped and silently turned this into a second assertion of the clamp, which the
    //    FLOOR case below already makes.
    // Pair the two: a value above the floor must pass through untouched here, a value below
    // it must be raised to it there. Collapse them and the floor stops being pinned.
    Object.defineProperty(content, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(inner, 'scrollWidth', { value: 160, configurable: true });
    Object.defineProperty(inner, 'scrollHeight', { value: 160, configurable: true });

    observer.trigger([{ target: container }]);

    assert.strictEqual(inner.style.transform, 'scale(0.625)');
    assert.strictEqual(inner.style.getPropertyValue('--be-scale'), '0.625');
    assert.strictEqual(inner.style.width, '');
    assert.strictEqual(container.getAttribute('data-scaling'), 'true');
    // Not marked clipped: 0.625 is what the ARITHMETIC asked for, so the content fits at it.
    // This half of the pair is what stops the marker being "any section that shrank".
    assert.strictEqual(
      container.getAttribute('data-scaling-clipped'),
      null,
      'a section that FITS at its applied scale was marked as clipped',
    );
  });

  it('should not scale if content fits', function() {
    const container = document.getElementById('section-1');
    const content = container.querySelector('.print-section-content');
    const inner = container.querySelector('.content-inner');

    // Reset
    inner.style.transform = 'none';
    inner.style.width = '100%';
    container.removeAttribute('data-scaling');

    // Mock dimensions: content (50x50) into container (100x100)
    Object.defineProperty(content, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(inner, 'scrollWidth', { value: 50, configurable: true });
    Object.defineProperty(inner, 'scrollHeight', { value: 50, configurable: true });

    // Same delivery path as the scaling case above — the product's own callback. The
    // box is deliberately a NEW one (the previous case recorded 100x100 while scaled),
    // so passing here means the arithmetic ran and found a fit, not that the guard
    // skipped the measurement.
    Object.defineProperty(content, 'clientWidth', { value: 120, configurable: true });
    Object.defineProperty(content, 'clientHeight', { value: 120, configurable: true });
    productObserver().trigger([{ target: container }]);

    // When the content FITS, the feature leaves NO scaling residue behind: the attribute,
    // the transform and the compensation custom property are all cleared (clearScaling), so a
    // section that stops overflowing does not keep a stale scale or a stale min-width.
    assert.notStrictEqual(container.getAttribute('data-scaling'), 'true');
    assert.strictEqual(inner.style.transform, '');
    assert.strictEqual(inner.style.getPropertyValue('--be-scale'), '');
  });

  it('STABILITY: a repeat delivery for an unchanged box does not re-write the styles', async function() {
    const container = document.getElementById('section-1');
    const content = container.querySelector('.print-section-content');
    const inner = container.querySelector('.content-inner');

    // The state a real browser reaches after scaling: the applied scale widens the
    // inner, an auto-height container changes box, and the observer delivers AGAIN.
    Object.defineProperty(content, 'clientWidth', { value: 120, configurable: true });
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(inner, 'scrollWidth', { value: 50, configurable: true });
    Object.defineProperty(inner, 'scrollHeight', { value: 50, configurable: true });
    const observer = productObserver();
    observer.trigger([{ target: container }]);

    // Now make it overflow — via a real content mutation, which is what a browser does.
    Object.defineProperty(inner, 'scrollWidth', { value: 240, configurable: true });
    Object.defineProperty(inner, 'scrollHeight', { value: 200, configurable: true });
    content.appendChild(document.createElement('p'));
    await settle();
    observer.trigger([{ target: container }]);
    const written = inner.style.transform;
    assert.match(written, /^scale\(0\./, 'expected a scale-down, got ' + written);

    // A delivery of the SAME box with no content mutation must be a no-op: re-running
    // the arithmetic on the already-scaled layout is how the loop Chromium reports as
    // "ResizeObserver loop completed with undelivered notifications" gets started.
    // Detected observably: the inner now FITS (its natural size shrank), so a
    // re-measure would clear the transform and drop the attribute.
    Object.defineProperty(inner, 'scrollWidth', { value: 60, configurable: true });
    Object.defineProperty(inner, 'scrollHeight', { value: 60, configurable: true });
    observer.trigger([{ target: container }]);
    assert.strictEqual(
      inner.style.transform,
      written,
      'the callback re-measured an unchanged box and re-wrote the transform',
    );
    assert.strictEqual(
      container.getAttribute('data-scaling'),
      'true',
      'the callback re-measured an unchanged box and dropped data-scaling',
    );
  });

  it('RECORD SAFETY: scaling writes nothing the layout record reads as a USER width', function() {
    // THE REGRESSION THIS PINS. `scanLayout` and `snapshotContainerGeometry` build
    // `layout.sections[id].innerWidths` by reading `child.style.width` over
    // `div[class$="-row-header"], div[class$="-content"]` — and `.print-section-content`
    // MATCHES that selector (its class name ends in "-content"), so the element this
    // feature scales is inside the recorded set. An inline width here would be persisted
    // as a user choice and replayed by `applyLayout` (a feature-derived value pinned at
    // every later sheet size), and an undo would restore something other than what the
    // user had. The browser gate caught exactly that on the undo round trip:
    // innerWidths["0-0"] going "110.469%" -> "110.392%".
    const container = document.createElement('div');
    container.className = 'print-section-container';
    container.id = 'section-record';
    container.innerHTML =
      '<div class="print-section-content"><div class="content-inner">long</div></div>';
    document.getElementById('print-enhance-sections-layer').appendChild(container);

    const content = container.querySelector('.print-section-content');
    const inner = content.firstElementChild;
    // Deliberately NOT extreme: width is the binding axis (100/160 = 0.625) while height fits,
    // so the asserted transform is the quotient itself. The 400x200 this case used to measure
    // needs clamping after `MIN_SCALE_FLOOR`, and a clamped value proves nothing about which
    // axis bound or what the record saw — the FLOOR case below owns that instead.
    Object.defineProperty(content, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(inner, 'scrollWidth', { value: 160, configurable: true });
    Object.defineProperty(inner, 'scrollHeight', { value: 100, configurable: true });

    // Same selector + same keying as js/layout_scan.js / js/undo.js.
    const record = (el) => {
      const out = {};
      el.querySelectorAll('div[class$="-row-header"], div[class$="-content"]')
        .forEach((c, cIdx) => {
          Array.from(c.children).forEach((child, dIdx) => {
            if (child.tagName === 'DIV' && child.style.width) {
              out[`${cIdx}-${dIdx}`] = child.style.width;
            }
          });
        });
      return out;
    };

    assert.deepStrictEqual(record(container), {}, 'precondition: an un-scaled section records no widths');
    productObserver().trigger([{ target: container }]);
    assert.strictEqual(container.getAttribute('data-scaling'), 'true', 'the section scaled');
    // 160x100 of content in a 100x100 box: the binding axis is width, 100/160.
    assert.strictEqual(inner.style.transform, 'scale(0.625)');
    assert.strictEqual(inner.style.getPropertyValue('--be-scale'), '0.625');
    assert.deepStrictEqual(
      record(container),
      {},
      'the scaling feature wrote something the layout record would persist as a user width',
    );
  });

  it('FLOOR + TOGGLE: extreme overflow is clamped and can be disabled per section', async function() {
    const container = document.getElementById('section-1');
    const content = container.querySelector('.print-section-content');
    const inner = container.querySelector('.content-inner');

    container.removeAttribute('data-no-auto-scale');
    Object.defineProperty(content, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(inner, 'scrollWidth', { value: 400, configurable: true });
    Object.defineProperty(inner, 'scrollHeight', { value: 400, configurable: true });

    productObserver().trigger([{ target: container }]);
    assert.strictEqual(container.getAttribute('data-scaling'), 'true');
    assert.strictEqual(inner.style.transform, 'scale(0.6)');
    assert.strictEqual(inner.style.getPropertyValue('--be-scale'), '0.6');
    // THE FLOOR'S COST IS MARKED. 400 of content in a 100 box needs 0.25; the floor answers 0.6,
    // and 400 x 0.6 = 240 of drawn content in a 100 box that clips — so this section is NOT
    // fitted, merely smaller, and issue scaling_floor_spells_0443_20260913 requires that to be
    // visible rather than silent. A `data-scaling` value alone cannot tell the two apart.
    assert.strictEqual(
      container.getAttribute('data-scaling-clipped'),
      'true',
      'a section floored into a still-clipped box was not marked — the clip is silent again',
    );

    // THE OFF-SWITCH. issue
    //    scaling_offswitch_no_remeasure_and_stale_floor_expectations_20260914: this write
    //    used to be invisible to the feature. Both observers watched for SIZE, and scaling a section off
    // changes no size, so the scale stayed on until something else happened to resize the
    // section — and the `initResponsiveScaling()` the panel called returns at its `installed`
    // guard. Assert the clear WITHOUT triggering the observer: the only thing that may have
    // acted here is the attribute observation. A trigger afterwards must then be a no-op, or
    // this write is what starts the loop the STABILITY case guards the other direction.
    container.dataset.noAutoScale = 'true';
    await settle();
    assert.notStrictEqual(
      container.getAttribute('data-scaling'),
      'true',
      'writing data-no-auto-scale did not take effect — the switch is inert until the next resize',
    );
    assert.strictEqual(inner.style.transform, '');
    assert.strictEqual(inner.style.getPropertyValue('--be-scale'), '');
    // The marker goes with the scale it belonged to: with the feature off, this section is
    // clipped by the user's OWN choice, and a tool warning about that would be noise.
    assert.strictEqual(
      container.getAttribute('data-scaling-clipped'),
      null,
      'the clip marker survived turning auto-scale off — it now blames the feature for a user choice',
    );

    productObserver().trigger([{ target: container }]);
    assert.notStrictEqual(
      container.getAttribute('data-scaling'),
      'true',
      'the size pass the switch caused re-measured the section and put the scale back',
    );

    // And back on: the same observation must carry the reverse write, which is the half a
    // one-directional fix (clear only when "true") would get wrong.
    delete container.dataset.noAutoScale;
    await settle();
    assert.strictEqual(
      container.getAttribute('data-scaling'),
      'true',
      'removing data-no-auto-scale did not restore scaling',
    );
    assert.strictEqual(inner.style.transform, 'scale(0.6)');
  });

  it('CLIP MARKER: a scale AT the floor that still fits is not marked', async function() {
    // The boundary the marker must NOT cross. 166.67 of content in a 100 box needs exactly
    // 0.600006 — the floor answers 0.6, which leaves ~1px of the tail outside the box, well
    // inside CLIP_SLACK_PX. A rule that fired on "scale === MIN_SCALE_FLOOR" would light this
    // section up and the marker would mean "hit the floor" instead of "content is missing".
    const container = document.createElement('div');
    container.className = 'print-section-container';
    container.id = 'section-at-floor';
    container.innerHTML =
      '<div class="print-section-content"><div class="content-inner">tall</div></div>';
    document.getElementById('print-enhance-sections-layer').appendChild(container);
    await settle();

    const content = container.querySelector('.print-section-content');
    const inner = content.firstElementChild;
    Object.defineProperty(content, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(inner, 'scrollWidth', { value: 100, configurable: true });
    Object.defineProperty(inner, 'scrollHeight', { value: 166.67, configurable: true });

    productObserver().trigger([{ target: container }]);
    assert.strictEqual(inner.style.transform, 'scale(0.6)', 'the floor clamped this section');
    assert.strictEqual(container.getAttribute('data-scaling'), 'true');
    assert.strictEqual(
      container.getAttribute('data-scaling-clipped'),
      null,
      'a section whose clipped tail is sub-pixel was marked — the marker now means "floored"',
    );

    // Grow the overflow past the slack and the SAME section is genuinely clipped.
    Object.defineProperty(inner, 'scrollHeight', { value: 400, configurable: true });
    content.appendChild(document.createElement('p'));
    await settle();
    productObserver().trigger([{ target: container }]);
    assert.strictEqual(
      container.getAttribute('data-scaling-clipped'),
      'true',
      'a real clip on a previously-clean section was never marked',
    );
    container.remove();
  });

  it('TOGGLE SCOPE: the switch is read on the section, not only on the mutated node', async function() {
    // The attribute is written on the container by js/properties_panel.js and by
    // js/layout_apply.js. Observing the document subtree means any matching write inside a
    // section reaches this callback, so the owner lookup is what keeps a nested element from
    // being scaled as if it were the section — and what keeps an unrelated node (the panel
    // itself, the document root) from being touched at all.
    const container = document.createElement('div');
    container.className = 'print-section-container';
    container.id = 'section-nested';
    container.innerHTML =
      '<div class="print-section-content"><div class="content-inner">long</div></div>';
    document.getElementById('print-enhance-sections-layer').appendChild(container);
    await settle();

    const content = container.querySelector('.print-section-content');
    const inner = content.firstElementChild;
    Object.defineProperty(content, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(inner, 'scrollWidth', { value: 160, configurable: true });
    Object.defineProperty(inner, 'scrollHeight', { value: 100, configurable: true });

    container.dataset.noAutoScale = 'true';
    await settle();
    assert.notStrictEqual(
      container.getAttribute('data-scaling'),
      'true',
      'a section restored with auto-scale off is scaled anyway on arrival',
    );

    delete container.dataset.noAutoScale;
    await settle();
    assert.strictEqual(inner.style.transform, 'scale(0.625)');

    // An unrelated element carrying the attribute must not be mistaken for a section.
    const stranger = document.createElement('div');
    stranger.id = 'stranger';
    document.body.appendChild(stranger);
    stranger.dataset.noAutoScale = 'true';
    await settle();
    assert.ok(!stranger.hasAttribute('data-scaling'), 'a non-section element was scaled');
    stranger.remove();
    container.remove();
  });

  it('the data-scaling rule that the attribute drives still exists', function() {
    // The whole point of the attribute: without the rule, `data-scaling="true"` is a
    // no-op flag and the feature is inert in a new way. Pinned here, in prose, at the
    // one place that can check it cheaply.
    const css = fs.readFileSync(path.resolve(__dirname, '../../js/print_styles.js'), 'utf8');
    assert.ok(
      css.includes('.print-section-container[data-scaling="true"] .print-section-content > div'),
      'the scaling helper rule was removed from js/print_styles.js',
    );
  });

  it('the clip marker paints, on screen ONLY', function() {
    // THE OTHER HALF OF THE MARKER. js/main.js stamps data-scaling-clipped on a section the
    // floor left short of its box; if nothing paints it, the stamp is a no-op flag and the
    // clip is silent again — which is precisely what issue scaling_floor_spells_0443_20260913
    // forbids ("with the clip made *visible* somehow (a marker, a panel warning)"). And it
    // must be SCREEN-ONLY: a warning band that reaches the paper would be the tool's own
    // notice printed onto the user's PDF, the failure class print_output_audit.spec.js exists
    // for. So assert both directions against the media blocks as they are actually emitted —
    // textually, since jsdom's CSSOM drops nested at-rules (see the extractor below).
    const src = fs.readFileSync(path.resolve(__dirname, '../../js/print_styles.js'), 'utf8');
    const SELECTOR = '.print-section-container[data-scaling-clipped="true"]';

    /** Every block of the named @media query, brace-matched (a nested rule would end a
     *  non-greedy regex at its first inner closing brace and the scan would see nothing). */
    function mediaBlocks(css, media) {
      const out = [];
      const re = new RegExp('@media\\s+' + media + '\\s*\\{', 'g');
      let m;
      while ((m = re.exec(css))) {
        let depth = 0;
        let i = m.index + m[0].length - 1;
        const start = i;
        for (; i < css.length; i++) {
          if (css[i] === '{') depth++;
          else if (css[i] === '}') {
            depth--;
            if (depth === 0) break;
          }
        }
        out.push(css.slice(start, i + 1));
      }
      return out;
    }

    const screen = mediaBlocks(src, 'screen');
    const print = mediaBlocks(src, 'print');
    // Guard the extractor itself: a scan of zero blocks passes every "not found" below.
    assert.ok(screen.length >= 1 && print.length >= 1, 'the media scan found nothing to scan');
    assert.ok(
      src.includes(SELECTOR),
      'the clip-marker rule is gone — data-scaling-clipped is set by js/main.js and painted by nobody',
    );
    assert.ok(
      screen.some((b) => b.includes(SELECTOR)),
      'the clip-marker rule is not inside a @media screen block',
    );
    assert.ok(
      !print.some((b) => b.includes(SELECTOR)),
      'the clip marker prints: the tool\'s own warning band would land on the user\'s paper',
    );
    // pointer-events: none, so the band cannot eat a click on the content under it.
    const painted = screen.find((b) => b.includes(SELECTOR)) || '';
    assert.ok(/pointer-events:\s*none/.test(painted), 'the marker can steal clicks from content');
  });
});
