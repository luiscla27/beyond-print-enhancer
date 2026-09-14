const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.resolve(__dirname, '../../js', f), 'utf8');

describe('Templates catalog shell (T-1 / AC-2) + thumbnails (T-2 / AC-3)', function() {
  let window, document;
  let appliedCalls, feedbackMsgs;

  beforeEach(function() {
    appliedCalls = [];
    feedbackMsgs = [];
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: "http://localhost",
      runScripts: "dangerously",
    });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    window.chrome = { runtime: { getURL: (p) => `chrome-extension://mock/${p}` } };
    window.showFeedback = (m) => feedbackMsgs.push(m);
    // Catalog data is stubbed on the service object itself (jsdom fetch is
    // unreliable in this suite); the modal logic is what is under test.
    const templatesFixture = [
      { id: 'archer', name: 'Archer Template', path: 'tpl-archer.json', thumbnail: 'th-archer.webp', active: true, description: 'An archer layout' },
      { id: 'basic', name: 'Basic Template', path: 'tpl-basic.json', thumbnail: 'th-basic-missing.webp', active: true, description: '' },
    ];
    window.eval(read('catalog_service.js'));
    // Stub the data methods (the service is a plain object we can wrap).
    window.CatalogService.loadCatalog = async () => ({ templates: templatesFixture });
    window.CatalogService.loadTemplate = async () => ({
      name: 'X', data: { sections: { secA: { borderStyle: 'goth_border' } }, shapes: [{ id: 's1', assetPath: 'a.webp' }] },
    });
    window.CatalogService.applyTemplate = async (id, skipConfirm) => {
      appliedCalls.push({ id, skipConfirm });
      return true;
    };
  });

  const openModal = async () => {
    const p = window.showPremadeCatalogModal();
    // Overlay creation is async (catalog load) — poll up to ~900ms. Returns
    // a holder so `await` does not flatten into the modal's own promise.
    for (let i = 0; i < 60; i++) {
      if (document.querySelector('.be-modal-overlay')) break;
      await new Promise((r) => setTimeout(r, 15));
    }
    return { p };
  };
  const overlay = () => document.querySelector('.be-modal-overlay');
  const key = (k) => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

  it('renders ONE overlay (no stacked detail overlay)', async function() {
    const { p } = await openModal();
    console.log('T0 after-open');
    try { assert.strictEqual(document.querySelectorAll('.be-modal-overlay').length, 1); } catch (e) { console.log('ASSERT1 fail'); throw e; }
    // click first card → detail must still be a single overlay (view swap)
    document.querySelectorAll('.be-catalog-item')[0].click();
    await new Promise((r) => setTimeout(r, 40));
    assert.strictEqual(document.querySelectorAll('.be-modal-overlay').length, 1, 'detail is an in-modal view');
    assert.ok(document.querySelector('.be-catalog-back'), 'Back present in detail view');
    overlay().remove();
    p.catch(() => {});
  });

  it('lists only active templates as cards; ✕ closes; Esc closes from the grid', async function() {
    const { p } = await openModal();
    const cards = document.querySelectorAll('.be-catalog-item');
    assert.strictEqual(cards.length, 2, 'active templates listed');
    document.querySelector('.be-modal-close').click();
    assert.strictEqual(await p, false);
    assert.strictEqual(document.querySelector('.be-modal-overlay'), null);
    // Esc path
    const p2 = window.showPremadeCatalogModal();
    await new Promise((r) => setTimeout(r, 40));
    key('Escape');
    assert.strictEqual(await p2, false);
  });

  it('Esc steps back one view (confirm → detail → grid) and closes on the grid', async function() {
    const { p } = await openModal();
    document.querySelectorAll('.be-catalog-item')[0].click();
    await new Promise((r) => setTimeout(r, 40));
    // detail → apply → confirm
    const applyBtn = Array.from(document.querySelectorAll('.be-modal button')).find((b) => b.textContent.trim() === 'Continue…');
    applyBtn.click();
    assert.ok(/Apply template/.test(document.querySelector('.be-catalog-view').textContent), 'confirm shown');
    key('Escape');
    assert.ok(document.querySelector('.be-catalog-back'), 'Esc in confirm → back to detail');
    key('Escape');
    assert.ok(document.querySelectorAll('.be-catalog-item').length >= 1, 'Esc in detail → back to grid');
    key('Escape');
    assert.strictEqual(await p, false, 'Esc in grid closes');
  });

  it('confirm is required before apply; applyTemplate(id, true) fires only after confirm; failure stays open', async function() {
    const { p } = await openModal();
    document.querySelectorAll('.be-catalog-item')[0].click();
    await new Promise((r) => setTimeout(r, 40));
    const applyBtn = Array.from(document.querySelectorAll('.be-modal button')).find((b) => b.textContent.trim() === 'Continue…');
    applyBtn.click(); // opens confirm, does NOT apply yet
    assert.strictEqual(appliedCalls.length, 0, 'no apply before the in-modal confirm');
    // confirm cancel → back to detail, still no apply
    document.querySelector('.be-catalog-confirm-cancel').click();
    assert.strictEqual(appliedCalls.length, 0);
    // apply again → confirm → confirm button
    const applyBtn2 = Array.from(document.querySelectorAll('.be-modal button')).find((b) => b.textContent.trim() === 'Continue…');
    applyBtn2.click();
    const yes = Array.from(document.querySelectorAll('.be-modal button')).find((b) => b.textContent.trim() === 'Continue' && !b.disabled);
    assert.ok(document.querySelector('.be-catalog-confirm-cancel'), 'confirm visible');
    yes.click();
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(appliedCalls.length, 1, 'applyTemplate called exactly once');
    assert.strictEqual(appliedCalls[0].skipConfirm, true, 'native confirm skipped (in-modal gate)');
    assert.strictEqual(appliedCalls[0].id, 'archer');
    assert.ok(feedbackMsgs.some((m) => /applied/i.test(m)), 'success toast');
    assert.strictEqual(await p, true, 'modal resolves true on apply');
    assert.strictEqual(document.querySelector('.be-modal-overlay'), null);
  });

  it('cards are keyboard-focusable and Enter opens the detail', async function() {
    const { p } = await openModal();
    const cards = document.querySelectorAll('.be-catalog-item');
    cards[0].focus();
    assert.strictEqual(document.activeElement, cards[0]);
    cards[0].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(document.querySelector('.be-catalog-back'), 'Enter on a card opens detail');
    assert.strictEqual(document.querySelectorAll('.be-modal-overlay').length, 1);
    overlay().remove();
    p.catch(() => {});
  });

  it('missing thumbnails degrade to the placeholder via onerror (never broken)', async function() {
    const { p } = await openModal();
    const basic = Array.from(document.querySelectorAll('.be-catalog-item')).find((c) =>
      (c.querySelector('.be-catalog-title') || {}).textContent === 'Basic Template',
    );
    const img = basic.querySelector('.be-catalog-thumbnail');
    // Simulate the load failure → onerror fires.
    img.dispatchEvent(new window.Event('error'));
    assert.ok(img.src.startsWith('data:image/svg+xml'), 'placeholder data URL applied');
    assert.ok(img.classList.contains('be-catalog-thumb-fallback'));
    // and it must not re-fire repeatedly (guard)
    img.dispatchEvent(new window.Event('error'));
    assert.strictEqual(img.dataset.fallbackApplied, '1');
    overlay().remove();
    p.catch(() => {});
  });

  it('backdrop click closes (target === overlay only)', async function() {
    const { p } = await openModal();
    const modal = document.querySelector('.be-modal');
    modal.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
    assert.ok(document.querySelector('.be-modal-overlay'), 'inside mousedown does not close');
    document.querySelector('.be-modal-overlay').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
    assert.strictEqual(await p, false);
  });
  it('the Basic template thumbnail asset exists on disk at the provenance format (200x150 PNG)', function() {
    const f = path.resolve(__dirname, '../../assets/thumbnails/basic.webp');
    assert.ok(fs.existsSync(f), 'assets/thumbnails/basic.webp missing');
    const buf = fs.readFileSync(f);
    // PNG signature
    assert.ok(buf[0] === 0x89 && buf[1] === 0x50, 'PNG payload');
    assert.ok(buf.toString('ascii', 1, 4) === 'PNG');
  });
});
