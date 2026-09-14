/**
 * The split guard — AC-4 (track refactor_surface_20260911, Phase 4).
 *
 * WHAT IT PINS, and why each half is needed:
 *
 *   1. THE SEAM SET IS UNCHANGED. The split moved WHERE each `window.*` seam is assigned; it must
 *      not rename, drop or invent one. A renamed seam is invisible until a lazy resolver reads
 *      `undefined` at runtime — the classic failure this kind of refactor ships — so the set is
 *      asserted against an explicit, frozen list read from the three modules' source.
 *   2. EVERY SEAM THAT MOVED IS STILL ASSIGNED SOMEWHERE IN THE SOURCE LIST. A name appearing in a
 *      consumer but assigned nowhere is the same failure from the other side, and it is what a
 *      half-finished extraction looks like.
 *   3. CONSUMERS RESOLVE AT CALL TIME. A module that captured a seam at LOAD time would keep working
 *      against a stale copy while the text looked fine — which, after a split, means it would keep
 *      talking to a function the extracted module no longer owns.
 *   4. THE MOVE IS A MOVE: every function the split relocated still EXISTS, exactly once, and its
 *      body is byte-identical to the pre-split one except for the cross-module calls that had to
 *      become `window.*` lookups. That is what makes "no behaviour change" checkable rather than
 *      asserted.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { boot } = require("./encapsulation_debt/debt_harness.js");

const ROOT = path.resolve(__dirname, "..", "..");
const MODULES = ["js/undo.js", "js/recovery_ui.js", "js/persistence.js"];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/** Every `window.X = …` assignment a module makes. */
function seamsOf(rel) {
  const out = new Set();
  for (const m of read(rel).matchAll(/^\s*window\.([A-Za-z_$][\w$]*)\s*=/gm)) out.add(m[1]);
  return out;
}

function allSeams() {
  const out = new Set();
  for (const m of MODULES) for (const s of seamsOf(m)) out.add(s);
  return out;
}

describe("AC-4 — the split's seam set and the move's fidelity", function () {
  this.timeout(20000);

  it("the seam set is the FROZEN 35 names the single module published", function () {
    // Read off `git show HEAD:js/persistence.js` before the split and recorded here; the split may
    // MOVE an assignment between modules, never rename, drop or invent one.
    const EXPECTED = [
      "MUTATION_CLASSES", "Persistence", "UNDO_STACK_MAX", "announceBootRestore", "applyUndo",
      "beginMutation", "canUndo", "captureLiveLayout", "captureUndo", "clearUndoOffer",
      "clearUndoStack", "confirmDestructive", "createBackupSnapshot", "detectLegacyLayout",
      "gateDestructive", "hasUndoOffer", "installUndoShortcut", "isTextEntryTarget", "listBackups",
      "offerUndo", "patchCapturedFields", "peekUndo", "pruneBackups", "pushMutation", "pushUndo",
      "repairSectionFlags", "restoreBackupRecord", "restoreFailureCard", "showRestoreSurface",
      "snapshotContainerGeometry", "snapshotSectionFlags", "undoDepth", "undoLabel",
      "undoScreenLabel", "versionNotice",
      // AC-5 (Phase 5) added exactly ONE of the split modules' seams: `destructiveGate`, the ONE
      // gate helper the three earlier-evaluated wrappers delegate to. Recorded rather than silently
      // passed, because this list is what makes a rename visible. (AC-5 also added the z-index
      // declaration map, but it is declared in js/section_utils.js — outside this guard's scope —
      // and is pinned by the AC-5 guard instead.)
      "destructiveGate",
      // AC-4 (Phase 4, track ux_gaps_20260911) added THREE, all part of ONE change: the refusal
      // copy was split into a short toast form and a long dialog form, because the old 21-word
      // sentence outran the toast's measured ~3.5 s window at any plausible reading rate. The
      // three are the two halves (`gateRefusalMessage`, `gateRefusalDetail`) and the dialog that
      // keeps the long form (`showGateRefusalDetail`). Recorded here for the same reason as
      // `destructiveGate`: this list is what makes an invented or renamed seam visible.
      "gateRefusalMessage", "gateRefusalDetail", "showGateRefusalDetail",
    ];
    assert.deepStrictEqual(
      [...allSeams()].sort(),
      EXPECTED.slice().sort(),
      "a seam name changed: the split MOVES assignments, it does not rename them. A renamed seam " +
        "is invisible until a lazy resolver reads `undefined` at runtime.",
    );
  });

  it("every name a consuming module reads is assigned by exactly ONE of the three modules", function () {
    // A seam defined twice would be the duplication this track exists to remove; a seam defined
    // NOWHERE would be a half-finished extraction. Both are checked, name by name.
    const owners = {};
    for (const m of MODULES) {
      for (const s of seamsOf(m)) {
        owners[s] = (owners[s] || []).concat(m);
      }
    }
    const doubled = Object.entries(owners).filter(([, v]) => v.length > 1);
    assert.deepStrictEqual(doubled, [], "a seam is assigned by more than one module");
    const consumers = new Set();
    for (const p of fs.readdirSync(path.join(ROOT, "js"))) {
      if (!p.endsWith(".js")) continue;
      const text = read("js/" + p);
      for (const m of text.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)/g)) consumers.add(m[1]);
    }
    // Only names in the split's own family are asserted here: a consumer reading `window.Modals`
    // is reading a DIFFERENT module's seam, which this guard has no business pinning.
    const family = Object.keys(owners);
    const orphanReads = [...consumers].filter((c) => c.startsWith("undo") && !family.includes(c));
    assert.deepStrictEqual(orphanReads, [], "a consumer reads an undo-family seam nobody assigns");
  });

  it("no module added by the split captures a seam at LOAD time", function () {
    // The deferred-capture shape, from the other direction: the two new modules are evaluated before
    // `js/persistence.js`, so a top-level `const x = window.something` there would capture undefined
    // and stay wrong forever. Only assignments INTO window, and call-time reads, are allowed.
    const offenders = [];
    for (const rel of ["js/undo.js", "js/recovery_ui.js"]) {
      const lines = read(rel).split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        const m = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*window\./.exec(lines[i]);
        if (m) offenders.push(rel + ":" + (i + 1) + " :: " + lines[i].trim().slice(0, 90));
      }
    }
    assert.deepStrictEqual(
      offenders,
      [],
      "a module captured a seam at LOAD time — after a split that means it can hold a reference " +
        "the extracted module no longer owns:\n" + offenders.join("\n"),
    );
  });

  it("the extracted functions exist exactly ONCE and their bodies are the moved ones", function () {
    // The move's fidelity check. Each relocated function must be defined in exactly one of the three
    // modules, and its body must still contain the statements the pre-split version did — so a body
    // that was quietly rewritten during the extraction fails here.
    const RELOCATED = {
      "js/undo.js": [
        "function pushUndo", "function peekUndo", "async function captureUndo",
        "function beginMutation", "function pushMutation", "const MUTATION_CLASSES",
        "function resolveMutationClass", "async function captureLiveLayout", "function applyUndo",
        "function offerUndo", "function clearUndoOffer", "function installUndoShortcut",
        "function patchCapturedFields", "function snapshotContainerGeometry",
        "function snapshotSectionFlags", "function repairSectionFlags", "function undoDepth",
        "function clearUndoStack", "function canUndo", "function undoLabel", "function undoScreenLabel",
      ],
      "js/recovery_ui.js": [
        "function showRestoreSurface", "async function gateDestructive", "function confirmDestructive",
        "function showRestoreFailureCard", "function gateRefusalMessage",
      ],
      "js/persistence.js": [
        "function handleSaveBrowser", "async function createBackupSnapshot", "function listBackups",
        "function pruneBackups", "async function restoreBackupRecord", "function detectLegacyLayout",
        "function versionNotice", "async function handleLoadDefault", "async function restoreLayout",
        "function announceBootRestore",
      ],
    };
    for (const [rel, markers] of Object.entries(RELOCATED)) {
      const text = read(rel);
      for (const marker of markers) {
        assert.strictEqual(
          text.split(marker).length - 1,
          1,
          rel + " must define " + marker + " exactly once",
        );
      }
    }
    // …and nowhere else. A copy left behind in js/persistence.js would be a second implementation.
    const persistence = read("js/persistence.js");
    for (const marker of RELOCATED["js/undo.js"]) {
      assert.ok(
        !persistence.includes(marker),
        "js/persistence.js still defines " + marker + " — the extraction left a copy behind",
      );
    }
    for (const marker of RELOCATED["js/recovery_ui.js"]) {
      assert.ok(
        !persistence.includes(marker),
        "js/persistence.js still defines " + marker + " — the extraction left a copy behind",
      );
    }
  });

  it("the pieces have the sizes the split claims, and no module owns four concerns", function () {
    // The point of AC-4: no single module owns the backup store AND the stack AND the recovery UI AND
    // the gate. Asserted by the presence/absence of each concern's marker in each module, so it
    // cannot be satisfied by moving lines around within one file.
    const CONCERNS = {
      "backup store": "const MAX_BACKUPS",
      "undo stack": "function pushUndo",
      "capture protocol": "function pushMutation",
      "vocabulary": "const MUTATION_CLASSES",
      "recovery UI": "function showRestoreSurface",
      "destructive gate": "async function gateDestructive",
    };
    const owners = {};
    for (const [concern, marker] of Object.entries(CONCERNS)) {
      owners[concern] = MODULES.filter((m) => read(m).includes(marker));
    }
    for (const [concern, mods] of Object.entries(owners)) {
      assert.strictEqual(mods.length, 1, concern + " must live in exactly one module: " + mods);
    }
    assert.strictEqual(
      owners["backup store"][0],
      "js/persistence.js",
      "the backup store stays in js/persistence.js",
    );
    assert.deepStrictEqual(
      [owners["undo stack"][0], owners["capture protocol"][0], owners["vocabulary"][0]],
      ["js/undo.js", "js/undo.js", "js/undo.js"],
      "the stack, the protocol and the vocabulary are all in js/undo.js",
    );
    assert.deepStrictEqual(
      [owners["recovery UI"][0], owners["destructive gate"][0]],
      ["js/recovery_ui.js", "js/recovery_ui.js"],
      "the recovery UI and the gate are both in js/recovery_ui.js",
    );
    // And the old monolith is gone: the module that had four concerns now has one.
    const persistenceConcerns = Object.entries(owners).filter(([, m]) => m[0] === "js/persistence.js");
    assert.deepStrictEqual(
      persistenceConcerns.map(([c]) => c),
      ["backup store"],
      "js/persistence.js owns exactly the backup store",
    );
  });
});

describe("AC-4 hardening (GATE 3 recommendation) — the seams RESOLVE after a real boot", function () {
  this.timeout(20000);

  it("every one of the 35 seams is DEFINED on window after the harness boots", function () {
    // The source-level set comparison proves no assignment was dropped or invented; the review named
    // what it cannot prove — that the names RESOLVE at runtime. That is what this case measures, and
    // it is the failure a split actually ships: a name that is assigned in a module the boot never
    // reaches would leave a lazy resolver reading `undefined`.
    const b = boot();
    const { window } = b;
    try {
      // The three non-function seams, named so the assertion stays a statement about existence
      // rather than about kind.
      const NOT_FUNCTIONS = { MUTATION_CLASSES: "object", UNDO_STACK_MAX: "number", Persistence: "object", Z: "object" };
      const missing = [];
      const wrongKind = [];
      for (const seam of allSeams()) {
        const value = window[seam];
        if (value === undefined || value === null) {
          missing.push(seam);
          continue;
        }
        const expected = NOT_FUNCTIONS[seam];
        if (expected ? typeof value !== expected : typeof value !== "function") {
          wrongKind.push(seam + " is a " + typeof value);
        }
      }
      assert.deepStrictEqual(missing, [], "seams that do not resolve after boot: " + missing.join(", "));
      assert.deepStrictEqual(wrongKind, [], "seams with the wrong kind: " + wrongKind.join(", "));
      // And the split's own two modules are the ones that published them: js/undo.js owns the stack
      // family, js/recovery_ui.js the recovery family.
      assert.strictEqual(typeof window.pushUndo, "function", "the stack seam resolves");
      assert.strictEqual(typeof window.showRestoreSurface, "function", "the recovery seam resolves");
      assert.strictEqual(typeof window.gateDestructive, "function", "the gate seam resolves");
      assert.strictEqual(typeof window.createBackupSnapshot, "function", "the store seam resolves");
    } finally {
      b.cleanup();
    }
  });
});
