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

    // Mock dimensions: content (200x200) into container (100x100)
    Object.defineProperty(content, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(inner, 'scrollWidth', { value: 200, configurable: true });
    Object.defineProperty(inner, 'scrollHeight', { value: 200, configurable: true });

    observer.trigger([{ target: container }]);

    assert.strictEqual(inner.style.transform, 'scale(0.5)');
    assert.strictEqual(inner.style.getPropertyValue('--be-scale'), '0.5');
    assert.strictEqual(inner.style.width, '');
    assert.strictEqual(container.getAttribute('data-scaling'), 'true');
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
    Object.defineProperty(content, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(inner, 'scrollWidth', { value: 400, configurable: true });
    Object.defineProperty(inner, 'scrollHeight', { value: 200, configurable: true });

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
    // 400x200 of content in a 100x100 box: the binding axis is width, 100/400.
    assert.strictEqual(inner.style.transform, 'scale(0.25)');
    assert.strictEqual(inner.style.getPropertyValue('--be-scale'), '0.25');
    assert.deepStrictEqual(
      record(container),
      {},
      'the scaling feature wrote something the layout record would persist as a user width',
    );
  });

  it('FLOOR + TOGGLE: extreme overflow is clamped and can be disabled per section', function() {
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

    container.dataset.noAutoScale = 'true';
    productObserver().trigger([{ target: container }]);
    assert.notStrictEqual(container.getAttribute('data-scaling'), 'true');
    assert.strictEqual(inner.style.transform, '');
    assert.strictEqual(inner.style.getPropertyValue('--be-scale'), '');
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
});
