const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

// Boot harness mirrors test/unit/border_picker_ui.test.js (all modules eval'd
// into one jsdom window in production load order).
const src = (f) => fs.readFileSync(path.resolve(__dirname, '../../js', f), 'utf8');

describe('Picker unification (B-1 — one shell + single source of truth)', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: "http://localhost",
      runScripts: "dangerously",
      resources: "usable",
    });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    window.chrome = { runtime: { getURL: (p) => `chrome-extension://mock/${p}` } };
    global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
    window.__DDB_TEST_MODE__ = true;
    const order = [
      'dom/element_wrapper.js', 'dom/dom_manager.js', 'context_menu.js',
      'asset_catalog.js', 'storage.js', 'image_processor.js',
      'print_styles.js', 'section_utils.js', 'modals.js',
      'properties_panel.js', 'layout_scan.js', 'layout_apply.js',
      'persistence.js', 'controls.js', 'shape_picker.js', 'spells_ui.js',
      'filters.js', 'layout_ops.js', 'section_cloning.js', 'main.js',
    ];
    order.forEach((f) => window.eval(src(f)));
  });

  /** Activate a fake shape layer so add/switch flows pass the layer gate. */
  function stubLayer() {
    window.PeDom = () => ({
      getLayerManager: () => ({
        activeLayerId: 'shapes-default',
        refreshUI: () => {},
        getActiveLayerContainer: () => ({ element: document.body }),
      }),
    });
  }

  const FROZEN_20 = [
    ["default-border", "Default"], ["no-border", "None"],
    ["ability_border", "Ability"], ["spikes_border", "Spikes"],
    ["barbarian_border", "Barbarian"], ["goth_border", "Goth"],
    ["plants_border", "Plants"], ["box_border", "Box"],
    ["dwarf_border", "Dwarf"], ["dwarf_hollow_border", "Dwarf Hollow"],
    ["sticks_border", "Sticks"], ["ornament_border", "Ornament 1"],
    ["ornament2_border", "Ornament 2"], ["ornament_bold_border", "Ornament Bold"],
    ["ornament_bold2_border", "Ornament Bold 2"],
    ["ornament_simple_border", "Ornament Simple"],
    ["spike_hollow_border", "Spike Hollow"], ["spiky_border", "Spiky"],
    ["spiky_bold_border", "Spiky Bold"], ["vine_border", "Vine"],
  ];

  it('exposes one unified implementation behind every entry point', function() {
    assert.strictEqual(typeof window.ShapePicker.showAssetPickerModal, 'function');
    assert.strictEqual(window.showAssetPickerModal, window.ShapePicker.showAssetPickerModal);
    assert.strictEqual(typeof window.showShapePickerModal, 'function', 'alias kept');
    assert.strictEqual(typeof window.ShapePicker.showShapePickerModal, 'function');
  });

  it('the legacy section-border modal API is gone (surface + source grep)', function() {
    assert.strictEqual(typeof window.showBorderPickerModal, 'undefined');
    assert.strictEqual(typeof window.Modals.showBorderPickerModal, 'undefined');
    assert.strictEqual(typeof window.Modals.showAssetPickerModal, 'undefined');
    // AC-1: zero identifier occurrences across the module sources.
    const files = ['modals.js', 'shape_picker.js', 'main.js', 'properties_panel.js', 'asset_catalog.js'];
    files.forEach((f) => {
      const count = (src(f).match(/showBorderPickerModal/g) || []).length;
      assert.strictEqual(count, 0, `${f} still references the removed API (${count})`);
    });
  });

  it('SECTION_BORDER_STYLES is the single ordered 20-entry fixture (no drift)', function() {
    const styles = window.AssetCatalog.SECTION_BORDER_STYLES;
    assert.ok(Array.isArray(styles));
    assert.strictEqual(styles.length, 20);
    styles.forEach((s, i) => {
      assert.strictEqual(s.className, FROZEN_20[i][0]);
      assert.strictEqual(s.label, FROZEN_20[i][1]);
    });
    // no-border + default-border present (drift guards)
    assert.ok(styles.some((s) => s.className === 'no-border'));
    assert.ok(styles.some((s) => s.className === 'default-border'));
  });

  it('style mode renders the Section Styles surface and resolves { style }', async function() {
    // no layer manager on purpose: style mode must not require a shape layer
    const promise = window.showAssetPickerModal({ mode: 'style', current: 'spikes_border' });
    const modal = document.querySelector('.be-modal-overlay');
    assert.ok(modal, 'style surface should open');
    const h3 = modal.querySelector('h3');
    assert.strictEqual(h3.textContent, 'Select Section Border');
    const options = modal.querySelectorAll('.be-border-option');
    assert.strictEqual(options.length, 20, 'Section Styles tab lists the 20-entry catalog');
    // preselected current style
    const sel = modal.querySelector('.be-border-option.selected');
    assert.ok(sel, 'current style preselected');
    assert.ok(sel.textContent.includes('Spikes'), 'preselected cell is the current style');
    // pick Dwarf Hollow -> OK
    const dwarf = Array.from(options).find((o) => o.textContent.includes('Dwarf Hollow'));
    assert.ok(dwarf, 'Dwarf Hollow option present');
    dwarf.click();
    modal.querySelector('.be-modal-ok').click();
    const result = await promise;
    assert.ok(result, 'style resolved');
    assert.strictEqual(result.style, 'dwarf_hollow_border');
  });

  it('style mode with no current defaults the selection to default-border', async function() {
    const promise = window.showAssetPickerModal({ mode: 'style' });
    const sel = document.querySelector('.be-border-option.selected');
    assert.ok(sel && sel.textContent.includes('Default'), 'Default preselected when no current');
    document.querySelector('.be-modal-cancel').click();
    assert.strictEqual(await promise, null);
  });

  it('add mode (layer active) renders Borders/Shapes/Custom and resolves { assetPath }', async function() {
    stubLayer();
    const promise = window.showShapePickerModal(); // alias → add
    const modal = document.querySelector('.be-modal-overlay');
    assert.ok(modal, 'add picker should open');
    assert.strictEqual(modal.querySelector('h3').textContent, 'Select Decorative Shape');
    const tabs = Array.from(modal.querySelectorAll('.be-modal-tab')).map((t) => t.textContent);
    assert.deepStrictEqual(tabs, ['Borders', 'Shapes', 'Custom']);
    const options = modal.querySelectorAll('.be-border-option');
    assert.ok(options.length > 0, 'borders tab lists assets');
    // selecting any asset resolves its path
    options[1].click();
    const pathSelected = (() => {
      // read back the cell title / asset label used as title attr
      return options[1].title || options[1].textContent.trim();
    })();
    modal.querySelector('.be-modal-ok').click();
    const result = await promise;
    assert.ok(result && typeof result.assetPath === 'string');
    assert.ok(result.assetPath.length > 0);
    assert.ok(pathSelected.length > 0);
  });

  it('folder-filtered switch keeps a single category (hidden tabs) + preselected current', async function() {
    stubLayer();
    const promise = window.showShapePickerModal('assets/shapes/archer_main.webp', 'assets/shapes/');
    const modal = document.querySelector('.be-modal-overlay');
    const tabBar = modal.querySelector('.be-modal-tabs');
    assert.strictEqual(tabBar.style.display, 'none', 'folder-filtered picker hides the tab bar');
    const sel = modal.querySelector('.be-border-option.selected');
    assert.ok(sel, 'current asset preselected in switch mode');
    modal.querySelector('.be-modal-cancel').click();
    assert.strictEqual(await promise, null);
  });

  it('no layer in add mode still rejects with feedback (legacy guard preserved)', async function() {
    const result = await window.showShapePickerModal();
    assert.strictEqual(result, null);
    const fb = document.querySelector('.be-feedback');
    assert.ok(fb && /layer/i.test(fb.textContent), 'feedback toast shown');
  });

  /* ------------------------------------------------------------------ */
  /* B-2 — per-flow copy + disabled-until-genuine-selection (AC-2)        */
  /* ------------------------------------------------------------------ */

  describe('B-2 per-flow copy + disabled-until-genuine-selection', function() {
    const okBtnOf = () => document.querySelector('.be-modal-ok');
    const cancelOf = () => document.querySelector('.be-modal-cancel');
    const openModal = (fn) => {
      const p = fn();
      // DOM builds synchronously before the promise resolves.
      return p;
    };

    it('style mode shows title "Select Section Border" + verb "Apply Border Style"', function() {
      openModal(() => window.showAssetPickerModal({ mode: 'style', current: 'goth_border' }));
      const modal = document.querySelector('.be-modal-overlay');
      assert.strictEqual(modal.querySelector('h3').textContent, 'Select Section Border');
      assert.strictEqual(okBtnOf().textContent, 'Apply Border Style');
    });

    it('switch mode shows title "Switch Shape Asset" + verb "Switch Asset"', function() {
      stubLayer();
      openModal(() => window.showShapePickerModal('assets/shapes/archer_main.webp', 'assets/shapes/'));
      const modal = document.querySelector('.be-modal-overlay');
      assert.strictEqual(modal.querySelector('h3').textContent, 'Switch Shape Asset');
      assert.strictEqual(okBtnOf().textContent, 'Switch Asset');
    });

    it('add mode shows title "Select Decorative Shape" + verb "Add Shape"', function() {
      stubLayer();
      openModal(() => window.showShapePickerModal());
      const modal = document.querySelector('.be-modal-overlay');
      assert.strictEqual(modal.querySelector('h3').textContent, 'Select Decorative Shape');
      assert.strictEqual(okBtnOf().textContent, 'Add Shape');
    });

    it('style mode: OK disabled at open while the current class is still chosen; enables on change; re-disables on switch-back', async function() {
      const promise = openModal(() => window.showAssetPickerModal({ mode: 'style', current: 'spikes_border' }));
      assert.strictEqual(okBtnOf().disabled, true, 'disabled while unchanged');
      const goth = Array.from(document.querySelectorAll('.be-border-option')).find((o) => o.textContent.includes('Goth'));
      goth.click();
      assert.strictEqual(okBtnOf().disabled, false, 'enabled after picking a different style');
      const spikes = Array.from(document.querySelectorAll('.be-border-option')).find((o) => o.textContent.includes('Spikes'));
      spikes.click();
      assert.strictEqual(okBtnOf().disabled, true, 'disabled again after switching back to current');
      cancelOf().click();
      assert.strictEqual(await promise, null);
    });

    it('add mode: no fabricated preselection — OK disabled at open, enables on first choice', async function() {
      stubLayer();
      const promise = openModal(() => window.showShapePickerModal());
      const modal = document.querySelector('.be-modal-overlay');
      assert.strictEqual(okBtnOf().disabled, true, 'OK disabled with nothing chosen (no default)');
      assert.strictEqual(modal.querySelector('.be-border-option.selected'), null, 'no option preselected in add mode');
      modal.querySelectorAll('.be-border-option')[0].click();
      assert.strictEqual(okBtnOf().disabled, false, 'OK enabled after first explicit choice');
      okBtnOf().click();
      const result = await promise;
      assert.ok(result && result.assetPath, 'commits the chosen asset');
    });

    it('switch mode: current asset preselected but OK disabled until a different asset is picked', async function() {
      stubLayer();
      const promise = openModal(() => window.showShapePickerModal('assets/shapes/archer_main.webp', 'assets/shapes/'));
      const modal = document.querySelector('.be-modal-overlay');
      const sel = modal.querySelector('.be-border-option.selected');
      assert.ok(sel, 'current asset preselected');
      assert.strictEqual(okBtnOf().disabled, true, 'OK disabled while the current asset is still chosen');
      const other = Array.from(modal.querySelectorAll('.be-border-option')).find((o) => !o.classList.contains('selected'));
      other.click();
      assert.strictEqual(okBtnOf().disabled, false, 'OK enabled after picking a different asset');
      cancelOf().click();
      assert.strictEqual(await promise, null);
    });

    it('Enter while OK is disabled is a no-op (modal stays open, no commit)', async function() {
      stubLayer();
      const promise = openModal(() => window.showShapePickerModal());
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
      assert.ok(document.querySelector('.be-modal-overlay'), 'modal still open after disabled Enter');
      // now choose + Enter commits
      document.querySelectorAll('.be-border-option')[0].click();
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      const result = await promise;
      assert.ok(result && result.assetPath, 'Enter commits once a genuine selection exists');
      assert.strictEqual(document.querySelector('.be-modal-overlay'), null, 'modal closed after commit');
    });

    it('hover never enables OK — only click-selection flips the enabled state (AC-2/AC-5 clause)', async function() {
      const promise = openModal(() => window.showAssetPickerModal({ mode: 'style', current: 'default-border' }));
      const modal = document.querySelector('.be-modal-overlay');
      assert.strictEqual(okBtnOf().disabled, true);
      const goth = Array.from(modal.querySelectorAll('.be-border-option')).find((o) => o.textContent.includes('Goth'));
      goth.dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: true }));
      assert.strictEqual(okBtnOf().disabled, true, 'mouseenter alone must not enable OK');
      goth.dispatchEvent(new window.MouseEvent('mouseleave', { bubbles: true }));
      assert.strictEqual(okBtnOf().disabled, true);
      cancelOf().click();
      assert.strictEqual(await promise, null);
    });
  });

  /* ------------------------------------------------------------------ */
  /* B-3 — keyboard/cancel integrity + a11y (AC-3)                        */
  /* ------------------------------------------------------------------ */

  describe('B-3 keyboard/cancel integrity + a11y', function() {
    const okBtnOf = () => document.querySelector('.be-modal-ok');
    const cancelOf = () => document.querySelector('.be-modal-cancel');
    const overlayOf = () => document.querySelector('.be-modal-overlay');
    const closeX = () => document.querySelector('.be-modal-close');
    const key = (k, target) => {
      const evt = new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
      (target || window).dispatchEvent(evt);
    };

    it('Enter on a focused Cancel cancels (never commits) — the legacy trap is gone', async function() {
      stubLayer();
      const promise = window.showShapePickerModal();
      cancelOf().focus();
      assert.strictEqual(document.activeElement, cancelOf(), 'Cancel focused');
      key('Enter');
      assert.strictEqual(await promise, null, 'Enter on focused Cancel cancels');
      assert.strictEqual(document.querySelector('.be-modal-overlay'), null, 'modal closed');
    });

    it('Esc cancels from anywhere (keyboard escape hatch)', async function() {
      stubLayer();
      const promise = window.showShapePickerModal();
      key('Escape');
      assert.strictEqual(await promise, null);
      assert.strictEqual(document.querySelector('.be-modal-overlay'), null);
    });

    it('the close ✕ cancels', async function() {
      stubLayer();
      const promise = window.showShapePickerModal();
      assert.ok(closeX(), 'close ✕ present');
      closeX().click();
      assert.strictEqual(await promise, null);
      assert.strictEqual(document.querySelector('.be-modal-overlay'), null);
    });

    it('a backdrop click cancels (target === overlay only)', async function() {
      stubLayer();
      const promise = window.showShapePickerModal();
      const modal = overlayOf();
      const inside = modal.querySelector('.be-modal');
      inside.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
      assert.ok(overlayOf(), 'mousedown inside the modal does not close');
      modal.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
      assert.strictEqual(await promise, null, 'backdrop mousedown cancels');
      assert.strictEqual(document.querySelector('.be-modal-overlay'), null);
    });

    it('no keydown-listener leak after 5 open→close cycles', async function() {
      stubLayer();
      // Instrument: count net window keydown listeners added by the modal.
      const realAdd = window.addEventListener.bind(window);
      const realRemove = window.removeEventListener.bind(window);
      let net = 0;
      window.addEventListener = (t, fn, o) => {
        if (t === 'keydown') net += 1;
        return realAdd(t, fn, o);
      };
      window.removeEventListener = (t, fn, o) => {
        if (t === 'keydown') net -= 1;
        return realRemove(t, fn, o);
      };
      try {
        const baseline = net;
        for (let i = 0; i < 5; i++) {
          const p = window.showShapePickerModal();
          key('Escape');
          await p;
        }
        assert.strictEqual(net, baseline, `keydown listeners leaked (net ${net} vs baseline ${baseline})`);
      } finally {
        window.addEventListener = realAdd;
        window.removeEventListener = realRemove;
      }
    });

    it('option cells are focusable with roving tabindex + keyboard selection (Enter)', async function() {
      stubLayer();
      const promise = window.showShapePickerModal();
      const cells = () => Array.from(overlayOf().querySelectorAll('.be-border-option'));
      assert.ok(cells().length > 0);
      // first render: single roving tabstop (no selection in add mode → first cell)
      const tabStops = cells().filter((c) => c.tabIndex === 0);
      assert.strictEqual(tabStops.length, 1, 'exactly one roving tabstop');
      const first = cells()[0];
      const second = cells()[1];
      first.focus();
      assert.strictEqual(document.activeElement, first);
      // ArrowRight moves focus to the next cell (roving follows)
      key('ArrowRight', first);
      assert.strictEqual(document.activeElement, second, 'arrow right moved focus');
      assert.strictEqual(second.tabIndex, 0, 'roving tabstop moved to the focused cell');
      // Enter on the focused cell selects it (no commit yet)
      key('Enter', second);
      assert.ok(second.classList.contains('selected'), 'Enter selects the focused cell');
      assert.ok(!okBtnOf().disabled, 'selection enables OK');
      cancelOf().click();
      assert.strictEqual(await promise, null);
    });

    it('aria-selected mirrors the selection state on option cells', async function() {
      stubLayer();
      const promise = window.showShapePickerModal();
      const cells = Array.from(overlayOf().querySelectorAll('.be-border-option'));
      cells[0].click();
      assert.strictEqual(cells[0].getAttribute('aria-selected'), 'true');
      assert.strictEqual(cells[1].getAttribute('aria-selected'), 'false');
      cells[1].click();
      assert.strictEqual(cells[1].getAttribute('aria-selected'), 'true');
      assert.strictEqual(cells[0].getAttribute('aria-selected'), 'false');
      cancelOf().click();
      assert.strictEqual(await promise, null);
    });

    it('dialog chrome exposes role=dialog + aria-modal + labelled title', async function() {
      stubLayer();
      const promise = window.showShapePickerModal();
      const modal = overlayOf().querySelector('.be-modal');
      assert.strictEqual(modal.getAttribute('role'), 'dialog');
      assert.strictEqual(modal.getAttribute('aria-modal'), 'true');
      assert.ok(modal.getAttribute('aria-label'));
      assert.strictEqual(modal.getAttribute('aria-label'), 'Select Decorative Shape');
      cancelOf().click();
      assert.strictEqual(await promise, null);
    });
  });
});
