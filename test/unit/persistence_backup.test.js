const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
require('fake-indexeddb/auto');

const read = (f) => fs.readFileSync(path.resolve(__dirname, '../../js', f), 'utf8');

/** Boot persistence.js on a jsdom window with the real storage layer. */
async function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    runScripts: 'dangerously',
  });
  const w = dom.window;
  global.window = w;
  global.document = w.document;
  global.HTMLElement = w.HTMLElement;
  global.Node = w.Node;
  const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
  w.indexedDB = indexedDB;
  w.IDBKeyRange = IDBKeyRange;
  global.indexedDB = indexedDB;
  global.IDBKeyRange = IDBKeyRange;
  w.__DDB_TEST_MODE__ = true;

  const toasts = [];
  w.showFeedback = (msg, type) => toasts.push({ msg, type });
  w.safeLog = () => {};
  w.getCharacterId = () => 'char-1';
  w.scanLayout = async () => ({ version: '1.5.0', sections: {} });
  w.applyLayout = async () => {};
  w.applyDefaultLayout = async () => { w.__defaultApplied = (w.__defaultApplied || 0) + 1; };
  w.updateLayoutBounds = () => {};
  w.createSpellDetailSection = async () => {};

  w.eval(read('storage.js'));
  // js/modals.js must be present: the restore-failure card now renders through
  // the shared modal primitive (track modal_primitive_20260910). In production
  // js/modals.js is injected BEFORE js/persistence.js, so loading it here makes
  // the harness match the real boot order rather than papering over it.
  w.eval(read('modals.js'));
  // Split out of js/persistence.js (track refactor_surface_20260911, AC-4). This suite boots a
  // hand-rolled window rather than the shared harness, so the two new modules are evaluated in
  // the position js/persistence.js used to occupy for their seams — matching the extension's own
  // order. No case is touched.
  w.eval(read('undo.js'));
  w.eval(read('recovery_ui.js'));
  w.eval(read('persistence.js'));
  // main.js destructures these out of window.Persistence; mirror that so the
  // suite exercises the same surface the app calls.
  const P = w.Persistence;
  w.handleLoadDefault = P.handleLoadDefault;
  w.restoreLayout = P.restoreLayout;
  return { w, toasts, P };
}

describe('Trust primitive — backup / prune / pause / confirm (AC-1)', function () {
  // The bound is `Persistence.MAX_BACKUPS` (raised 3 -> 10 by track ux_gaps_20260911,
  // Phase 3, AC-3). The title used to name "the newest 3" as a literal, which made it a
  // stale claim the moment the constant moved; it names the constant's job now.
  it('writes a backup record before erasing and prunes to the newest MAX_BACKUPS (deterministic)', async function () {
    const { w} = await boot();
    // Seed a saved layout so the backup has something to capture.
    await w.__DDBStorage.init();
    await w.__DDBStorage.saveGlobalLayout({ version: '1.5.0', sections: { a: {} } });

    const ids = [];
    // Write MORE than the cap, derived from the constant (Phase 3 raised it 3 -> 10, and
    // this loop used to be a literal 5 — enough to evict at 3, not at 10).
    const writes = w.Persistence.MAX_BACKUPS + 2;
    for (let i = 0; i < writes; i++) {
      const r = await w.createBackupSnapshot('bulk');
      assert.strictEqual(r.ok, true);
      ids.push(r.record.id);
    }
    const listed = await w.listBackups();
    assert.strictEqual(listed.length, w.Persistence.MAX_BACKUPS, 'FIFO cap honoured');
    // newest first, deterministic (compare via JSON: the records come from the
    // jsdom realm, so cross-realm prototype equality would false-fail)
    const seqs = Array.from(listed, (r) => r.seq);
    const sorted = [...seqs].sort((a, b) => b - a);
    assert.strictEqual(JSON.stringify(seqs), JSON.stringify(sorted), 'newest-first ordering');
    assert.ok(!listed.some((r) => r.id === ids[0]), 'oldest evicted');
    assert.ok(listed.some((r) => r.id === ids[ids.length - 1]), 'the newest survived the prune');
    // the backup carries the layout payload
    assert.ok(listed[0].layout && listed[0].layout.sections, 'backup captured the saved layout');
  });

  it('same-millisecond backups get distinct ids (monotonic sequence tie-break)', async function () {
    const { w } = await boot();
    const a = await w.createBackupSnapshot('t');
    const b = await w.createBackupSnapshot('t');
    assert.notStrictEqual(a.record.id, b.record.id, 'no id collision');
    assert.notStrictEqual(a.record.seq, b.record.seq, 'monotonic sequence');
  });

  it('a failed backup aborts Reset before anything is erased (Edge 5)', async function () {
    const { w, toasts } = await boot();
    w.createBackupSnapshot = async () => ({ ok: false, error: 'quota' });
    let confirmed = 0;
    w.confirmDestructive = async () => { confirmed += 1; return true; };

    await w.handleLoadDefault();

    assert.strictEqual(confirmed, 0, 'never even prompts when the backup failed');
    assert.strictEqual(w.__defaultApplied || 0, 0, 'default template NOT applied');
    const err = toasts.find((t) => t.type === 'error');
    assert.ok(err, 'typed error toast emitted');
    assert.ok(/quota/.test(err.msg), 'error names the cause: ' + err.msg);
  });

  it('cancelling the confirm leaves the layout untouched and lifts the pause', async function () {
    const { w } = await boot();
    w.createBackupSnapshot = async () => ({ ok: true, record: { id: 'b1' } });
    w.confirmDestructive = async () => false;
    let pauses = 0;
    w.pauseAutosave = () => { pauses += 1; };
    w.resumeAutosave = () => {};

    await w.handleLoadDefault();

    assert.strictEqual(w.__defaultApplied || 0, 0, 'cancel does not reset');
    assert.strictEqual(pauses, 0, 'handleLoadDefault itself does not pause (the modal owns it)');
  });

  it('confirmDestructive owns a ref-counted pause and lifts it on every close path', async function () {
    const { w } = await boot();
    let pauses = 0;
    let resumes = 0;
    w.pauseAutosave = () => { pauses += 1; };
    w.resumeAutosave = () => { resumes += 1; };

    // confirm via the OK button
    const p = w.confirmDestructive({ title: 'T', message: 'M', confirmLabel: 'Yes' });
    assert.strictEqual(pauses, 1, 'paused on open');
    document.querySelector('.be-modal-ok').click();
    assert.strictEqual(await p, true);
    assert.strictEqual(resumes, 1, 'resumed on confirm');

    // cancel via Escape
    const p2 = w.confirmDestructive({ title: 'T', message: 'M' });
    assert.strictEqual(pauses, 2);
    w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.strictEqual(await p2, false, 'Escape cancels');
    assert.strictEqual(resumes, 2, 'resumed on Escape');

    // cancel via backdrop
    const p3 = w.confirmDestructive({ title: 'T', message: 'M' });
    const overlay = document.querySelector('.be-modal-overlay');
    overlay.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true }));
    assert.strictEqual(await p3, false, 'backdrop cancels');
    assert.strictEqual(resumes, 3);

    // cancel via the close ✕
    const p4 = w.confirmDestructive({ title: 'T', message: 'M' });
    document.querySelector('.be-modal-close').click();
    assert.strictEqual(await p4, false, 'close X cancels');
    assert.strictEqual(resumes, 4);
    assert.strictEqual(pauses, resumes, 'no leaked pause on any close path');
  });

  it('the destructive confirm is a real dialog (role/aria-modal) with a labelled title', async function () {
    const { w } = await boot();
    w.pauseAutosave = () => {};
    w.resumeAutosave = () => {};
    const p = w.confirmDestructive({ title: 'Reset to Default Layout', message: 'M' });
    const modal = document.querySelector('.be-modal');
    assert.strictEqual(modal.getAttribute('role'), 'dialog');
    assert.strictEqual(modal.getAttribute('aria-modal'), 'true');
    assert.strictEqual(modal.getAttribute('aria-label'), 'Reset to Default Layout');
    assert.ok(document.querySelector('.be-modal-close'), 'has a close affordance');
    // cancel path resolves false and the overlay is removed
    document.querySelector('.be-modal-cancel').click();
    assert.strictEqual(await p, false);
    assert.strictEqual(document.querySelector('.be-modal-overlay'), null, 'overlay removed');
  });

  it('autosave pause is REF-COUNTED: two overlapping modals stay paused until both close (Edge 2)', async function () {
    const { w } = await boot();
    let paused = 0;
    w.pauseAutosave = () => { paused += 1; };
    w.resumeAutosave = () => { paused = Math.max(0, paused - 1); };

    const a = w.confirmDestructive({ title: 'A', message: 'M' });
    const b = w.confirmDestructive({ title: 'B', message: 'M' });
    assert.strictEqual(paused, 2, 'both held');
    document.querySelectorAll('.be-modal-ok')[0].click();
    await a;
    assert.strictEqual(paused, 1, 'still paused while the second is open');
    document.querySelectorAll('.be-modal-ok')[0].click();
    await b;
    assert.strictEqual(paused, 0, 'released only after the last close');
  });
});

describe('Restore failure + legacy + version copy (AC-1)', function () {
  it('restoreLayout reports a RESULT OBJECT distinguishing empty / invalid / error', async function () {
    const { w } = await boot();
    // fake-indexeddb is process-shared, so clear the store first to make the
    // "nothing saved" case genuine.
    const db = await w.__DDBStorage.init();
    await new Promise((resolve) => {
      const tx = db.transaction([w.__DDBStorage.STORE_NAME], 'readwrite');
      tx.objectStore(w.__DDBStorage.STORE_NAME).clear();
      tx.oncomplete = () => resolve();
    });
    // nothing saved yet → empty
    const empty = await w.restoreLayout();
    assert.strictEqual(empty.restored, false);
    assert.strictEqual(empty.reason, 'empty');

    // corrupt saved data → invalid (must NOT be reported as "empty")
    await w.__DDBStorage.init();
    await w.__DDBStorage.saveGlobalLayout({ version: '1.5.0', bogus: true });
    const invalid = await w.restoreLayout();
    assert.strictEqual(invalid.restored, false);
    assert.strictEqual(invalid.reason, 'invalid');

    // healthy layout → restored
    await w.__DDBStorage.saveGlobalLayout({ version: '1.5.0', sections: {} });
    const ok = await w.restoreLayout();
    assert.strictEqual(ok.restored, true);
  });

  it('the failure card offers recovery and does not apply the default template', async function () {
    const { w } = await boot();
    const before = w.__defaultApplied || 0;
    w.restoreFailureCard({ restored: false, reason: 'invalid' });
    assert.strictEqual(w.__defaultApplied || 0, before, 'no silent default applied');
    const card = document.querySelector('.be-modal-overlay');
    assert.ok(card, 'error card shown');
    const buttons = Array.from(card.querySelectorAll('button')).map((b) => b.textContent);
    assert.ok(buttons.some((t) => /backup/i.test(t)), 'offers a backup: ' + JSON.stringify(buttons));
    assert.ok(buttons.some((t) => /fresh|reset/i.test(t)), 'offers start-fresh');
  });

  it('legacy detection is ALLOWLIST-based (a current file with extra fields is fine)', async function () {
    const { w } = await boot();
    assert.strictEqual(w.detectLegacyLayout({ version: '1.5.0', sections: {} }), null);
    // forward-compatible: unknown extra field must NOT be flagged
    assert.strictEqual(w.detectLegacyLayout({ version: '1.5.0', sections: {}, futureThing: 1 }), null);
    // exact legacy signatures ARE flagged
    assert.ok(w.detectLegacyLayout({ version: '1.5.0', shapes: [] }), 'legacy flat shapes');
    assert.ok(w.detectLegacyLayout({ version: 'nope', sections: {} }), 'missing/garbage version');
    assert.ok(
      w.detectLegacyLayout({ version: '1.5.0', sections: { a: { borderImage: 'assets/x.gif' } } }),
      'legacy .gif asset',
    );
  });

  it('version copy is accurate for older AND newer files (U-14)', async function () {
    const { w } = await boot();
    w.__DDBStorage.SCHEMA_VERSION = '1.5.0';
    assert.strictEqual(w.versionNotice('1.5.0'), null);
    assert.ok(/older version/.test(w.versionNotice('1.4.0')));
    assert.ok(/NEWER version/.test(w.versionNotice('1.6.0')), 'never claims "older" for newer files');
  });
});

describe('Autosave pause contract (AC-1 / Edge 2-3)', function () {
  it('an armed debounce is cancelled by pause and re-armed (not lost) on resume', async function () {
    this.timeout(8000);
    const { w } = await boot();
    // load dnd.js autosave surface
    w.eval(read('dnd.js'));
    assert.strictEqual(typeof w.pauseAutosave, 'function', 'pause exposed');
    assert.strictEqual(typeof w.resumeAutosave, 'function', 'resume exposed');

    let writes = 0;
    w.scanLayout = async () => { writes += 1; return { version: '1.5.0', sections: {} }; };
    w.__DDBStorage = {
      saveLayout: async () => {},
      saveGlobalLayout: async () => {},
    };

    w.scheduleAutosave(); // armed
    w.pauseAutosave(); // must cancel it
    assert.strictEqual(w.isAutosavePaused(), true);
    await new Promise((r) => setTimeout(r, 1200));
    assert.strictEqual(writes, 0, 'a debounce armed BEFORE the pause never fires during it');

    w.resumeAutosave(); // dirty → re-armed
    assert.strictEqual(w.isAutosavePaused(), false);
    await new Promise((r) => setTimeout(r, 1200));
    assert.strictEqual(writes, 1, 'the deferred save runs after resume — not dropped');
  });

  it('pause is ref-counted and resume only releases on the last one', async function () {
    const { w } = await boot();
    w.eval(read('dnd.js'));
    w.pauseAutosave();
    w.pauseAutosave();
    w.resumeAutosave();
    assert.strictEqual(w.isAutosavePaused(), true, 'still paused after one release');
    w.resumeAutosave();
    assert.strictEqual(w.isAutosavePaused(), false);
    w.resumeAutosave(); // extra release must not go negative
    assert.strictEqual(w.isAutosavePaused(), false);
  });
});

describe('Typed feedback (AC-3 / U-10)', function () {
  it('showFeedback honours the type: errors are distinct and announced', async function () {
    const { w } = await boot();
    w.eval(read('modals.js'));
    w.Modals.showFeedback('something broke', 'error');
    const err = document.querySelector('.be-feedback-error');
    assert.ok(err, 'error toast carries the error class');
    assert.strictEqual(err.getAttribute('role'), 'alert', 'errors are announced assertively');
    assert.ok(/something broke/.test(err.textContent));
    w.Modals.showFeedback('all good');
    const info = document.querySelector('.be-feedback-info');
    assert.ok(info, 'default toast is the info variant');
    assert.strictEqual(info.getAttribute('role'), 'status');
  });
});

describe('AC-2 — Save to PC surfaces a scan failure (U-4)', function () {
  it('scanLayout running inside the try yields a typed error toast and no rejection', async function () {
    const { w, toasts } = await boot();
    let downloaded = false;
    w.scanLayout = async () => {
      throw new Error('scan blew up');
    };
    const origCreate = w.document.createElement.bind(w.document);
    w.document.createElement = (tag) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        el.click = () => {
          downloaded = true;
        };
      }
      return el;
    };
    // Must resolve (not reject) and must report the failure.
    await w.Persistence.handleSavePC();
    assert.strictEqual(downloaded, false, 'nothing was downloaded');
    const err = toasts.find((t) => t.type === 'error');
    assert.ok(err, 'typed error toast emitted: ' + JSON.stringify(toasts));
    assert.ok(/Could not read the current layout/.test(err.msg), 'copy names the failure: ' + err.msg);
  });
});
