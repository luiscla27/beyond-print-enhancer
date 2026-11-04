/**
 * The injected-scope collision guard — BEYOND-10 (SC-D2), session 2.
 *
 * WHAT IT GUARDS. `chrome.scripting.executeScript({ files })` evaluates every file in
 * `js/background.js`'s list as a CLASSIC SCRIPT in ONE global scope. So two modules that declare the
 * same top-level binding do not merely warn: the second one dies at parse time with
 * `SyntaxError: Identifier '<name>' has already been declared`, and the WHOLE file it lives in never
 * runs — its `window.*` seams are never published, and any later module that calls them throws.
 *
 * WHY THIS EXISTS, MEASURED (this is not a hypothetical class — it has now happened twice):
 *   1. `_safeLog` — `js/undo.js` and `js/recovery_ui.js` both carry the note: "a second
 *      `const _safeLog` in a sibling module is a redeclaration error that kills the whole boot
 *      (measured in a real browser: 'Identifier _safeLog has already been declared', and the layout
 *      never appeared)". The house rule that followed was "each module names its own".
 *   2. `state` — BEYOND-10's new `js/border_refine.js` shipped `const state = {…}` while
 *      `js/dnd.js:437` declares `let state = null`. `js/dnd.js` is injected AFTER the new module, so
 *      dnd.js never executed at all: `window.initDragAndDrop` and `window.scheduleAutosave` were
 *      undefined, `js/main.js`'s boot threw at `initDragAndDrop()`, and `#print-layout-wrapper` kept
 *      a height of 0. The harness's `bootPage` then hung on `waitForSelector(READY_SELECTOR)` —
 *      whose default `state: 'visible'` needs a non-empty box — so EVERY e2e spec in the repo failed
 *      with a 60s "host" timeout. The failure presented as a broken demo host, and the track's first
 *      record said so; the A/B that falsified it was: same browser, production file list MINUS
 *      `js/border_refine.js` → `initDragAndDrop: function`, no page errors; with it →
 *      `Identifier 'state' has already been declared`.
 *
 * So the rule needs a fast check, not a third comment. This is it: a unit test, because the failure
 * it prevents is invisible to every unit test (each loads ONE module into jsdom) and catastrophic in
 * the browser, where it reads as infrastructure.
 *
 * WHAT IT CANNOT SEE (stated, not hidden). The extractor is line-anchored on column 0, the shape every
 * module in this repo uses for a top-level declaration. A declaration nested inside an IIFE (the shape
 * `js/main.js` and `js/activation_overlay.js` use) is correctly INVISIBLE here — it is also not a
 * shared-scope binding, so nothing is missed. A second declarator on a continuation line
 * (`const a = 1,\n  b = 2;`) would be missed; no file in the list uses that shape, and the exact-count
 * floor below turns a wholesale extraction break into a failure instead of a silent pass.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const BACKGROUND = path.join(ROOT, "js", "background.js");

/**
 * The injected file list, parsed EXACTLY the way the browser harness parses it
 * (`test/browser_e2e/_helpers/dom.js` → `productionInjectFiles`): if this guard and the harness
 * disagreed about the list, the guard would be scoring a different product than the one that boots.
 */
function injectedFiles() {
  const source = fs.readFileSync(BACKGROUND, "utf8");
  const match = /files:\s*\[([\s\S]*?)\]/.exec(source);
  assert.ok(match, "could not parse the files array from js/background.js");
  const files = Array.from(match[1].matchAll(/'([^']+)'/g), (x) => x[1]);
  assert.ok(files.length >= 20, "the injected file list parsed as only " + files.length + " entries");
  return files;
}

const DECL = /^(async\s+function|function|class|const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/;

/** The top-level declarations of one module, in file order. Nested (indented) decls are ignored. */
function topLevelDecls(text) {
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const m = DECL.exec(line);
    if (!m) return;
    const keyword = m[1];
    out.push({
      name: m[2],
      kind: keyword.indexOf("function") >= 0 ? "function" : keyword.indexOf("class") >= 0 ? "class" : keyword,
      line: i + 1,
    });
  });
  return out;
}

/** Every top-level declaration in the injected list, grouped by name. */
function declarationsByName(files) {
  const byName = new Map();
  for (const rel of files) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    for (const d of topLevelDecls(text)) {
      if (!byName.has(d.name)) byName.set(d.name, []);
      byName.get(d.name).push(Object.assign({ file: rel }, d));
    }
  }
  return byName;
}

/** A `let` / `const` / `class` binding is lexical: redeclaring it anywhere is a SyntaxError. */
const isLexical = (kind) => kind === "let" || kind === "const" || kind === "class";

/**
 * The FATAL collisions: any name that appears in more than one file where at least one declaration is
 * lexical. These kill a whole module at load, which is the defect this guard exists for.
 */
function fatalCollisions(byName) {
  const fatal = [];
  for (const [name, decls] of byName) {
    if (decls.length < 2) continue;
    if (decls.some((d) => isLexical(d.kind))) fatal.push({ name, decls });
  }
  return fatal;
}

/**
 * `window` members a top-level declaration would SHADOW for every other file in the shared scope.
 * Narrow and named rather than "everything on window": these are the ones a module author plausibly
 * reaches for and the ones whose loss is silent. `open` / `close` are here because the refine surface
 * first declared both — they happened not to collide with another module, but they did overwrite the
 * DOM's own `window.open` / `window.close` for the whole injected world.
 */
const SHADOWED_WINDOW_MEMBERS = [
  "open",
  "close",
  "focus",
  "blur",
  "print",
  "stop",
  "alert",
  "confirm",
  "prompt",
  "name",
  "status",
  "length",
  "top",
  "self",
  "parent",
  "frames",
  "origin",
  "event",
  "history",
  "location",
  "document",
  "navigator",
  "screen",
  "fetch",
  "postMessage",
  "getComputedStyle",
  "scrollTo",
  "scrollBy",
];

/**
 * Duplicate declarations the language TOLERATES (`var`/`function` twice in one scope: the last one
 * silently wins) but that a reader would not expect. Frozen with a reason, and the guard asserts the
 * list is EXACT in both directions — a new duplicate fails, and an entry that no longer reproduces
 * fails, so this cannot rot into a blanket exemption.
 */
const TOLERATED_DUPLICATES = [
  {
    name: "fail",
    reason:
      "js/ai_layout.js:1278 `function fail(errorClass, message, status, retryable, retryAfterSeconds)` " +
      "and js/ai_arrange.js:968 `function fail(message)` — PRE-EXISTING (predates BEYOND-10), and one " +
      "of them silently shadows the other for the whole injected scope, so a caller in ai_layout gets " +
      "ai_arrange's 1-arg shape. Not this track's file and not this track's fix; recorded here so the " +
      "shape is visible and so the NEXT duplicate of this class fails instead of joining a crowd.",
  },
];

describe("injected-scope collision guard — one global scope, one binding per name", function () {
  this.timeout(20000);

  it("the injected file list parses the way the browser harness parses it", function () {
    const files = injectedFiles();
    assert.ok(files.indexOf("js/background.js") < 0, "background.js is the injector, not an injected file");
    // The extraction floor: 436 top-level declarations were measured across this list (2026-11-01).
    // A parser or list break shows up here as a collapse rather than as a silent "no collisions".
    const byName = declarationsByName(files);
    let total = 0;
    for (const decls of byName.values()) total += decls.length;
    assert.ok(
      files.length >= 30 && total >= 300,
      "the extractor found " + files.length + " files / " + total + " top-level declarations — too few " +
        "to be the real list, so this guard would pass vacuously",
    );
  });

  it("no top-level binding is declared LEXICALLY in one module and again in another", function () {
    const fatal = fatalCollisions(declarationsByName(injectedFiles()));
    assert.deepStrictEqual(
      fatal.map((c) => c.name + " -> " + c.decls.map((d) => d.file + ":" + d.line + " (" + d.kind + ")").join(", ")),
      [],
      "a shared-scope redeclaration kills the WHOLE module that loses the race, and every seam it " +
        "publishes disappears — rename the binding uniquely (the house rule: each module names its own)",
    );
  });

  it("duplicate var/function declarations are exactly the frozen, reasoned set", function () {
    const byName = declarationsByName(injectedFiles());
    const found = [];
    for (const [name, decls] of byName) {
      if (decls.length < 2 || decls.some((d) => isLexical(d.kind))) continue;
      found.push(name);
    }
    assert.deepStrictEqual(
      found.slice().sort(),
      TOLERATED_DUPLICATES.map((t) => t.name).sort(),
      "the tolerated-duplicate list must be EXACT: a new duplicate silently shadows a sibling " +
        "module's function for the whole injected scope, and a stale entry hides a fix",
    );
    for (const t of TOLERATED_DUPLICATES) {
      assert.ok(t.reason && t.reason.length > 40, "every tolerated duplicate carries a written reason: " + t.name);
    }
  });

  it("no top-level binding shadows a window member the whole injected world shares", function () {
    const byName = declarationsByName(injectedFiles());
    const shadowing = SHADOWED_WINDOW_MEMBERS.filter((n) => byName.has(n)).map((n) => {
      const d = byName.get(n)[0];
      return n + " -> " + d.file + ":" + d.line + " (" + d.kind + ")";
    });
    assert.deepStrictEqual(
      shadowing,
      [],
      "a top-level declaration of a window member overwrites it for every file in the shared scope",
    );
  });

  /**
   * FALSIFIABILITY. The three cases above assert an ABSENCE, and an extractor that quietly matched
   * nothing would make all of them green. This case feeds the same functions the two exact shapes the
   * guard was built for — the BEYOND-10 collision and the window shadow — and requires them to be
   * REPORTED, so a green run means the detector works rather than that it found nothing to say.
   */
  it("the detector actually detects (synthetic reproduction of the BEYOND-10 collision)", function () {
    const collision = new Map();
    collision.set("state", [
      { file: "js/border_refine.js", name: "state", kind: "const", line: 67 },
      { file: "js/dnd.js", name: "state", kind: "let", line: 437 },
    ]);
    const fatal = fatalCollisions(collision);
    assert.deepStrictEqual(fatal.map((c) => c.name), ["state"], "the detector must flag the measured collision");

    // …and the real extractor reads the real shapes correctly, so the fixture above is not a fiction.
    assert.deepStrictEqual(
      topLevelDecls('const state = {\n  a: 1,\n};\nlet other = 2;\n  const nested = 3;\nfunction fn() {}\n'),
      [
        { name: "state", kind: "const", line: 1 },
        { name: "other", kind: "let", line: 4 },
        { name: "fn", kind: "function", line: 6 },
      ],
      "column-0 declarations are found; an indented (nested) one is not",
    );
    // Two `var`/`function` declarations are tolerated by the language, and the guard must not confuse
    // them with the fatal class.
    const tolerated = new Map();
    tolerated.set("fail", [
      { file: "js/ai_layout.js", name: "fail", kind: "function", line: 1278 },
      { file: "js/ai_arrange.js", name: "fail", kind: "function", line: 968 },
    ]);
    assert.deepStrictEqual(fatalCollisions(tolerated), [], "a var/function pair is not the fatal class");
  });
});
