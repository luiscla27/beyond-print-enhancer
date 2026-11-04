#!/usr/bin/env node
/**
 * audit_dead_exports.js — reproducible audit of the project's `window.*` export
 * surface (track: dead_exports_20260910).
 *
 * WHY THIS EXISTS
 * ---------------
 * The content-script modules talk to each other through `window.X = ...`
 * assignments. That is a deliberate, documented seam pattern (files loaded
 * before `js/main.js` / `js/modals.js` resolve later helpers lazily through
 * `window`), but nothing removed the exports of paths that were superseded as
 * features landed. This script measures which exports are actually reached and
 * from where, so retirement is decided from evidence instead of from a hunch.
 *
 * TWO SURFACES (both are the export surface; only the first is obvious)
 * --------------------------------------------------------------------
 *  1. DIRECT: every `window.NAME = ...` assignment under `js/` (including the
 *     `else` branch of `if (module.exports) {…} else { window.X = X }`).
 *  2. NAMESPACE MEMBERS: names published as an object literal or class
 *     (`window.Modals.showSliderModal`, `DomManager.getInstance()`). Matching
 *     `window.NAME` cannot see these — a dead member hid in exactly that gap,
 *     which is why this surface is audited explicitly rather than assumed.
 *     Only namespaces that are ACTUALLY exported on `window` are walked, so
 *     module-private literals (`TOKENS`, `ICON_PATHS`) never enter the table.
 *
 * METHOD (and its limits — do not forget them)
 * --------------------------------------------
 * References are counted per area (`js/` = product code, `test/`, `scripts/`),
 * never counting an export's own declaring line, using:
 *      - `NAME(` / `window.NAME`                 for a direct export
 *      - `Ns.M` / `window.Ns.M`                  for a namespace member
 *      - a bare identifier in CODE position      (comments stripped) — this is
 *        the conservative half: a member is normally also called internally by
 *        its bare name inside the module that declares it, and a harness may
 *        take it by destructuring. Over-counting keeps things, which is the safe
 *        direction; under-counting would delete live code.
 * Verdict per row (exactly three, per AC-2):
 *      - `live`       reached from `js/` — product code
 *      - `test-seam`  reached only from `test/` or `scripts/` — kept on purpose,
 *                     annotated at its declaring site (track AC-5)
 *      - `dead`       reached from nowhere at all
 * A member of a namespace that is ITSELF dead is reported `dead` with
 * `removalUnit` naming the parent export — the removal unit is the parent
 * `window.X` line, not each member.
 *
 * A `window.NAME = …` assignment to a host-object property (`window.onresize =
 * null` clears a global handler, it does not publish an API) is marked
 * `host-property`: counted, because the measured method behind AC-1 counts every
 * such assignment and the 120 must stay reproducible, but never a deletion
 * candidate and never annotated by the guard.
 *
 * USAGE
 *   node scripts/audit_dead_exports.js                     # human table + summary
 *   node scripts/audit_dead_exports.js --json              # machine-readable rows
 *   node scripts/audit_dead_exports.js --json=FILE         # machine-readable rows to FILE
 *   node scripts/audit_dead_exports.js --json=FILE --compact  # the committed evidence form
 *   node scripts/audit_dead_exports.js --diff=FILE         # mechanical before/after diff (AC-4)
 *
 * Exit code is always 0: this is an audit, not a gate. The re-rot GUARD is
 * `scripts/check_dead_exports.js` (track AC-6).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/** Areas the audit counts references in. `js` is product code; the rest are not. */
const AREAS = [
  { name: "js", dir: "js" },
  { name: "test", dir: "test" },
  { name: "scripts", dir: "scripts" },
];

/**
 * `window.NAME = …` assignments that are NOT module exports but assignments to a
 * host-object property. Counted for reproducibility, never audited as an export.
 */
const HOST_PROPERTIES = new Set([
  "onresize",
  "onload",
  "onunload",
  "onbeforeunload",
  "onscroll",
  "onmessage",
  "onerror",
  "onclick",
  "onkeydown",
  "onkeyup",
  "onfocus",
  "onblur",
  "onhashchange",
  "onpopstate",
]);

/** Recursively collect every `.js` file under `dir` (repo-relative, POSIX slashes). */
function jsFiles(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(p);
      } else if (entry.name.endsWith(".js")) {
        out.push(path.relative(ROOT, p).split(path.sep).join("/"));
      }
    }
  };
  walk(abs);
  return out.sort();
}

/**
 * Remove comments so a bare identifier inside prose is not mistaken for a use.
 * String and template-literal contents are preserved, and the line count is
 * preserved so reported line numbers stay valid.
 */
function stripComments(text) {
  let out = "";
  let i = 0;
  const n = text.length;
  let state = "code"; // code | line | block | sq | dq | tpl
  while (i < n) {
    const c = text[i];
    const d = text[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (c === "/" && d === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (c === "'") state = "sq";
      else if (c === '"') state = "dq";
      else if (c === "`") state = "tpl";
      out += c;
      i++;
      continue;
    }
    if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += c;
      }
      i++;
      continue;
    }
    if (state === "block") {
      if (c === "*" && d === "/") {
        state = "code";
        i += 2;
        continue;
      }
      if (c === "\n") out += c;
      i++;
      continue;
    }
    if (c === "\\") {
      out += c + (d === undefined ? "" : d);
      i += 2;
      continue;
    }
    if ((state === "sq" && c === "'") || (state === "dq" && c === '"') || (state === "tpl" && c === "`")) {
      state = "code";
    }
    out += c;
    i++;
  }
  return out;
}

/** Every audited source file, as raw lines plus a comment-stripped line array. */
function loadSources() {
  const sources = {};
  for (const area of AREAS) {
    for (const rel of jsFiles(area.dir)) {
      const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
      sources[rel] = { lines: text.split(/\r?\n/), code: stripComments(text).split(/\r?\n/) };
    }
  }
  return sources;
}

/** Direct surface: every `window.NAME = <value>` assignment under `js/`. */
function collectDirectExports(sources) {
  const decls = new Map();
  const re = /window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=(?!=)/;
  for (const [file, src] of Object.entries(sources)) {
    if (!file.startsWith("js/")) continue;
    src.lines.forEach((text, i) => {
      const m = re.exec(text);
      if (!m) return;
      const name = m[1];
      if (!decls.has(name)) decls.set(name, []);
      decls.get(name).push({ name, file, line: i + 1, source: text.trim() });
    });
  }
  return decls;
}

/**
 * Where a name is DEFINED in `js/` as an object literal or a class — the only
 * two shapes whose members can be enumerated statically. Returns null when the
 * name is not a namespace (a function declaration, a primitive, …).
 */
function findDefinitionSite(sources, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const literalRe = new RegExp(`(?:const|let|var)\\s+${esc}\\s*=\\s*(?:Object\\.freeze\\()?\\{`);
  const classRe = new RegExp(`(?:^|[^A-Za-z0-9_$.])class\\s+${esc}\\b`);
  for (const [file, src] of Object.entries(sources)) {
    if (!file.startsWith("js/")) continue;
    for (let i = 0; i < src.lines.length; i++) {
      if (literalRe.test(src.lines[i])) return { file, index: i, kind: "object" };
      if (classRe.test(src.lines[i])) return { file, index: i, kind: "class" };
    }
  }
  return null;
}

/**
 * Top-level keys of the object literal that starts on `startIndex`.
 * Depth-aware (braces, brackets and parens all nest), string-aware, and
 * comment-aware, so a key of a NESTED literal is never reported as a member —
 * that false positive produced phantom `dead` rows in the first draft.
 */
function parseObjectLiteral(lines, startIndex) {
  const keys = [];
  const keyLines = {};
  const spreads = [];
  let braceDepth = 0;
  let nest = 0;
  let started = false;
  let seg = "";
  let segLine = startIndex + 1;
  let segStarted = false;
  const append = (text, lineNo) => {
    if (!segStarted && text.trim() !== "") {
      segLine = lineNo;
      segStarted = true;
    }
    seg += text;
  };
  const flush = () => {
    const t = seg.trim().replace(/,$/, "").trim();
    seg = "";
    segStarted = false;
    if (!t) return;
    if (t.startsWith("...")) {
      spreads.push(segLine);
      return;
    }
    const kv = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*:/.exec(t);
    const shorthand = /^([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(t);
    const key = kv ? kv[1] : shorthand ? shorthand[1] : null;
    if (key && !(key in keyLines)) {
      keys.push(key);
      keyLines[key] = segLine;
    }
  };

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    let quote = null;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (!started) {
        // Skip the declaration prefix; the literal begins at its opening brace.
        if (ch === "{") {
          started = true;
          braceDepth = 1;
          nest = 1;
        }
        continue;
      }
      if (quote) {
        if (ch === "\\") {
          append(line.slice(c, c + 2), i + 1);
          c++;
          continue;
        }
        if (ch === quote) quote = null;
        append(ch, i + 1);
        continue;
      }
      if (ch === "'" || ch === '"' || ch === "`") {
        quote = ch;
        append(ch, i + 1);
        continue;
      }
      if (ch === "/" && (line[c + 1] === "/" || line[c + 1] === "*")) break; // comment
      if (ch === "{" || ch === "[" || ch === "(") {
        nest++;
        if (ch === "{") braceDepth++;
      } else if (ch === "}" || ch === "]" || ch === ")") {
        nest--;
        if (ch === "}") braceDepth--;
      }
      if (braceDepth === 0) {
        flush();
        return { keys, keyLines, spreads };
      }
      if (ch === "," && nest === 1) {
        flush();
        continue;
      }
      append(ch, i + 1);
    }
    if (started) append("\n", i + 1);
  }
  return { keys, keyLines, spreads };
}

/**
 * Members of a CLASS-shaped namespace. Only STATIC members are export surface:
 * `DomManager.getInstance()` is reached by that path from anywhere, whereas a
 * prototype method is the per-instance implementation reached through an
 * instance (`wrapper.addClass(…)`), not through the export. Enumerating prototype
 * methods as individual rows produced dozens of meaningless `dead` rows in the
 * first draft, so they are COUNTED and reported as a note instead of silently
 * dropped.
 */
function parseClassBody(lines, startIndex) {
  const statics = [];
  let methodCount = 0;
  let depth = 0;
  let started = false;
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") {
        depth++;
        started = true;
      } else if (ch === "}") depth--;
    }
    if (!started) continue;
    if (depth >= 1) {
      const statMethod = /^\s*static\s+(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*[(=]/.exec(line);
      const instanceMethod = /^\s*(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^)]*\)\s*\{/.exec(line);
      if (statMethod && i !== startIndex) statics.push(statMethod[1]);
      else if (instanceMethod && i !== startIndex) methodCount++;
    }
    if (depth === 0) break;
  }
  return { statics: [...new Set(statics)], methodCount };
}

/**
 * `NAME(` / `window.NAME` (direct) or `Ns.M` / `window.Ns.M` (member) — the
 * explicit shapes this codebase uses to reach an export. Anchored so a substring
 * never counts as a reference: `applyGlobalFilters(` must not count as a use of
 * `Filters`. A member may be reached through any object holding the namespace
 * (`w.Modals.showSliderModal`), so only identifier characters are excluded in
 * front of the namespace name — never a dot.
 */
function explicitPatternsFor(name, namespace) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const identLead = "(?:^|[^A-Za-z0-9_$.])";
  const dotLead = "(?:^|[^A-Za-z0-9_$])";
  // `.NAME` — the export reached through a LOCAL ALIAS of the global or through
  // a receiver that holds it: `const api = window.Modals; api.__createModal(…)`
  // and `w.restoreFailureCard(…)` in a jsdom harness. Without this pattern both
  // of those read as dead, and deleting them would be exactly the mistake AC-4
  // exists to prevent. Word-based, so it over-counts for common member names —
  // the safe direction.
  const aliased = new RegExp(`\\.${esc(name)}\\b`);
  if (!namespace) {
    return [
      new RegExp(`${identLead}${esc(name)}\\s*\\(`),
      new RegExp(`${identLead}window\\.${esc(name)}\\b`),
      aliased,
    ];
  }
  return [
    new RegExp(`${dotLead}${esc(namespace)}\\.${esc(name)}\\b`),
    new RegExp(`${dotLead}window\\.${esc(namespace)}\\.${esc(name)}\\b`),
    aliased,
  ];
}

/**
 * A line that PUBLISHES the name rather than using it — the declaration, the
 * `module.exports` / `window.X` publication, an object-literal member key, a
 * method signature. These are not references to the export: counting
 * `module.exports = UiTheme` as a use would silently mark a dead `window.UiTheme`
 * as live and defeat the whole audit.
 */
function isPublishingLine(text, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const shapes = [
    new RegExp(`(?:^|[^A-Za-z0-9_$.])(?:async\\s+)?function\\s+${esc}\\b`),
    new RegExp(`(?:^|[^A-Za-z0-9_$.])class\\s+${esc}\\b`),
    new RegExp(`(?:^|[^A-Za-z0-9_$.])(?:const|let|var)\\s+${esc}\\b`),
    new RegExp(`module\\.exports\\s*=\\s*${esc}\\b`),
    new RegExp(`(?:^|[^A-Za-z0-9_$.])exports\\.${esc}\\s*=`),
    new RegExp(`(?:^|[^A-Za-z0-9_$.])window\\.${esc}\\s*=(?!=)`),
    new RegExp(`^\\s*${esc}\\s*[,:]\\s*(?:\\(|$)`),
    new RegExp(`^\\s*${esc}\\s*:\\s*`),
    new RegExp(`^\\s*(?:static\\s+)?(?:async\\s+)?(?:get\\s+|set\\s+)?${esc}\\s*\\([^)]*\\)\\s*\\{`),
  ];
  return shapes.some((re) => re.test(text));
}

/** A bare identifier in CODE position that is not a publication of the name. */
function isBareUseLine(text, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`(?:^|[^A-Za-z0-9_$.])${esc}(?![A-Za-z0-9_$])`).test(text)) return false;
  return !isPublishingLine(text, name);
}

/**
 * Count references to one export, per area, ignoring its own declaring lines.
 * Returns three counts per area:
 *   - `explicit` — access to the export PATH (`window.X`, `X(`, `Ns.M`, `.X`)
 *   - `local`    — a bare identifier: the member called by its own module, taken
 *                  by destructuring, or evaluated into a shared harness scope.
 *                  Word-based, so it OVER-counts for common member names (`init`,
 *                  `names`). It participates in the verdict for NAMESPACE
 *                  MEMBERS (`useLocal`), because a member reached only from inside
 *                  its own module is still reached — the track's rule is "delete
 *                  only what nothing ANYWHERE reaches". For a DIRECT export it is
 *                  reported but not counted: that row is about the `window.X`
 *                  PATH, and a bare `X` elsewhere refers to a module-local binding
 *                  (or to a *different* export of the same name, e.g.
 *                  `{ restoreFailureCard } = Persistence`), so folding it in would
 *                  mark a genuinely unreachable global as live.
 *   - `counts`   — the number the verdict uses.
 * `testFiles` names WHICH tests reach it — AC-2 requires a test-seam row to say
 * which test uses it.
 */
function countReferences(sources, name, namespace, ownLines, useLocal) {
  const explicit = explicitPatternsFor(name, namespace);
  const counts = {};
  const detail = {};
  const testFiles = new Set();
  const productFiles = new Set();
  for (const area of AREAS) {
    let n = 0;
    let ex = 0;
    let local = 0;
    for (const [file, src] of Object.entries(sources)) {
      if (!file.startsWith(`${area.dir}/`)) continue;
      src.code.forEach((text, i) => {
        if (ownLines.has(`${file}:${i + 1}`)) return;
        const isExplicit = explicit.some((re) => re.test(text));
        const isLocal = !isExplicit && isBareUseLine(text, name);
        if (!isExplicit && !isLocal) return;
        if (isExplicit) ex++;
        else local++;
        if (useLocal || isExplicit) {
          n++;
          if (area.name === "test") testFiles.add(file);
          if (area.name === "js") productFiles.add(file);
        }
      });
    }
    counts[area.name] = n;
    detail[area.name] = { explicit: ex, local };
  }
  return { counts, detail, testFiles: [...testFiles].sort(), productFiles: [...productFiles].sort() };
}

/** dead / test-seam / live — the only three verdicts (AC-2). */
function verdictFor(counts) {
  if (counts.js > 0) return "live";
  if (counts.test > 0 || counts.scripts > 0) return "test-seam";
  return "dead";
}

function buildRows(sources) {
  const direct = [];
  const byName = new Map();
  for (const [name, decls] of collectDirectExports(sources)) {
    const ownLines = new Set(decls.map((d) => `${d.file}:${d.line}`));
    const refs = countReferences(sources, name, null, ownLines, false);
    const row = {
      surface: "direct",
      kind: HOST_PROPERTIES.has(name) ? "host-property" : "export",
      name,
      namespace: null,
      file: decls[0].file,
      line: decls[0].line,
      decls: decls.map((d) => `${d.file}:${d.line}`),
      source: decls[0].source,
      ...refs,
      verdict: verdictFor(refs.counts),
    };
    direct.push(row);
    byName.set(name, row);
  }

  // Namespace surface: only names actually exported on `window` AND defined as
  // an enumerable shape. A member of a dead namespace inherits its fate, because
  // the removal unit is the parent `window.X` line.
  const namespace = [];
  const notes = [];
  const namespacesAudited = [];
  for (const row of direct) {
    if (row.kind === "host-property") continue;
    const site = findDefinitionSite(sources, row.name);
    if (!site) continue;
    namespacesAudited.push({ namespace: row.name, kind: site.kind, file: site.file, line: site.index + 1 });
    if (site.kind === "class") {
      const { statics, methodCount } = parseClassBody(sources[site.file].lines, site.index);
      for (const member of statics) {
        namespace.push(makeMemberRow(sources, row, site, member, site.index + 1, "class-static"));
      }
      notes.push({
        namespace: row.name,
        kind: "prototype-methods",
        detail: `${methodCount} prototype method(s) in ${site.file} are per-instance implementation, not export surface — not audited as rows`,
      });
      continue;
    }
    const { keys, keyLines, spreads } = parseObjectLiteral(sources[site.file].lines, site.index);
    for (const key of keys) {
      namespace.push(makeMemberRow(sources, row, site, key, keyLines[key] ?? site.index + 1, "object-member"));
    }
    for (const spreadLine of spreads) {
      notes.push({ namespace: row.name, kind: "spread", detail: `${site.file}:${spreadLine} — member cannot be enumerated statically` });
    }
  }

  const label = (r) => (r.namespace ? `${r.namespace}.${r.name}` : r.name);
  const rows = [...direct, ...namespace].sort((a, b) => label(a).localeCompare(label(b)));
  return { rows, direct, namespace, notes, namespacesAudited };
}

function makeMemberRow(sources, parent, site, member, line, kind) {
  const ownLines = new Set([`${site.file}:${line}`]);
  const refs = countReferences(sources, member, parent.name, ownLines, true);
  const verdict = verdictFor(refs.counts);
  // A member of a dead namespace is unreachable THROUGH the export, but if the
  // member has a reach of its own (a test driving `window.UiTheme.css`) it keeps
  // that verdict — and that in turn falsifies the parent's `dead` row, which is
  // exactly what AC-4's revert-and-reclassify rule is for.
  const removalUnit = verdict === "dead" && parent.verdict === "dead" ? parent.name : null;
  return {
    surface: "namespace",
    kind,
    name: member,
    namespace: parent.name,
    file: site.file,
    line,
    decls: [`${site.file}:${line}`],
    source: "",
    ...refs,
    verdict,
    removalUnit,
  };
}

function printTable(rows) {
  const label = (r) => (r.namespace ? `${r.namespace}.${r.name}` : r.name);
  const width = Math.max(4, ...rows.map((r) => label(r).length));
  console.log(
    `${"export".padEnd(width)}  ${"js".padStart(4)} ${"test".padStart(4)} ${"scr".padStart(4)}  ${"verdict".padEnd(10)} ${"kind".padEnd(11)} declared at`
  );
  console.log("-".repeat(width + 54));
  for (const r of rows) {
    console.log(
      `${label(r).padEnd(width)}  ${String(r.counts.js).padStart(4)} ` +
        `${String(r.counts.test).padStart(4)} ${String(r.counts.scripts).padStart(4)}  ` +
        `${r.verdict.padEnd(10)} ${(r.kind === "host-property" ? "host-prop" : r.kind).padEnd(11)} ${r.file}:${r.line}`
    );
  }
}

function summarize(rows, extra) {
  const dead = rows.filter((r) => r.verdict === "dead");
  const host = rows.filter((r) => r.kind === "host-property");
  const independentDead = dead.filter((r) => !r.removalUnit);
  return {
    generatedAt: new Date().toISOString(),
    directExports: rows.filter((r) => r.surface === "direct").length,
    moduleExports: rows.filter((r) => r.surface === "direct" && r.kind !== "host-property").length,
    hostProperties: host.length,
    namespaceMembers: rows.filter((r) => r.surface === "namespace").length,
    totalRows: rows.length,
    verdicts: {
      live: rows.filter((r) => r.verdict === "live").length,
      testSeam: rows.filter((r) => r.verdict === "test-seam").length,
      dead: dead.length,
    },
    dead: dead.map((r) => (r.namespace ? `${r.namespace}.${r.name}` : r.name)),
    deadWithoutParent: independentDead.map((r) => (r.namespace ? `${r.namespace}.${r.name}` : r.name)),
    unclassified: rows.filter((r) => !["dead", "test-seam", "live"].includes(r.verdict)).length,
    ...extra,
  };
}

/**
 * The committed evidence form: everything AC-1..AC-4 need (surface, kind, name,
 * declaring site, per-area counts, verdict), minus the bulky fields that only
 * tooling uses (`source`, `decls`, `detail`, `productFiles`) and minus the
 * `testFiles` list for `live` rows (AC-2 only requires a seam row to name its
 * test). Keeps the before/after artifacts small enough to commit as evidence.
 */
function compactRows(rows) {
  const out = [];
  for (const r of rows) {
    const c = {
      surface: r.surface,
      kind: r.kind,
      name: r.name,
      namespace: r.namespace,
      file: r.file,
      line: r.line,
      counts: r.counts,
      verdict: r.verdict,
    };
    if (r.verdict !== "live") c.testFiles = r.testFiles;
    out.push(c);
  }
  return out;
}

/** Mechanical before/after diff, so AC-4 is argued from data, not prose. */
function diffAgainst(beforePath, rows) {
  const before = JSON.parse(fs.readFileSync(path.resolve(ROOT, beforePath), "utf8"));
  const label = (r) => (r.namespace ? `${r.namespace}.${r.name}` : r.name);
  const bm = new Map(before.rows.map((r) => [label(r), r]));
  const am = new Map(rows.map((r) => [label(r), r]));
  const counts = (r) => `${r.counts.js}/${r.counts.test}/${r.counts.scripts}`;
  const retired = [...bm.keys()].filter((k) => !am.has(k)).map((k) => ({ label: k, before: bm.get(k) }));
  const added = [...am.keys()].filter((k) => !bm.has(k)).map((k) => ({ label: k, after: am.get(k) }));
  const changed = [];
  for (const [k, b] of bm) {
    const a = am.get(k);
    if (!a) continue;
    if (counts(b) !== counts(a) || b.verdict !== a.verdict) {
      changed.push({ label: k, before: `${counts(b)} ${b.verdict}`, after: `${counts(a)} ${a.verdict}` });
    }
  }
  const lines = [];
  lines.push(`before: ${beforePath} — ${before.rows.length} rows, verdicts ${JSON.stringify(before.summary.verdicts)}`);
  lines.push(`after : runtime        — ${rows.length} rows, verdicts ${JSON.stringify(summarize(rows).verdicts)}`);
  // A member of a namespace that is itself gone did not get deleted: it left the
  // window surface WITH its parent, and its implementation may still be reached
  // through the module's CJS export. Calling that a deletion would overstate what
  // this track removed, so the two cases are reported apart.
  const goneLabels = new Set(retired.map((r) => r.label));
  const deleted = retired.filter((r) => !(r.before.namespace && goneLabels.has(r.before.namespace)));
  const withParent = retired.filter((r) => r.before.namespace && goneLabels.has(r.before.namespace));
  lines.push("");
  lines.push(`DELETED (${deleted.length}): their own removal unit — the export is gone and so is its declaration`);
  for (const r of deleted) {
    lines.push(`  - ${r.label} [${r.before.verdict}] ${r.before.file}:${r.before.line}`);
  }
  lines.push("");
  lines.push(`REMOVED WITH THEIR NAMESPACE (${withParent.length}): no declaration touched; they left the window surface because the parent did`);
  for (const r of withParent) {
    lines.push(`  - ${r.label} [was ${r.before.verdict}] ${r.before.file}:${r.before.line} — parent ${r.before.namespace} retired`);
  }
  lines.push("");
  lines.push(`NEW (${added.length}):`);
  for (const r of added) lines.push(`  + ${r.label} [${r.after.verdict}]`);
  lines.push("");
  lines.push(`SURVIVOR COUNT CHANGES (${changed.length}) — every one must be explained by the removals:`);
  for (const c of changed) lines.push(`  ! ${c.label}: ${c.before} -> ${c.after}`);
  lines.push("");
  const regressed = added.filter((r) => r.after.verdict === "dead").length;
  lines.push(
    `Verdict: ${deleted.length} export(s) deleted, ${withParent.length} row(s) left with their namespace, ` +
      `${added.length} new row(s), ${changed.length} survivor count change(s)`
  );
  return { text: lines.join("\n"), retired, deleted, withParent, added, changed, before, regressed };
}

function main() {
  const args = process.argv.slice(2);
  const sources = loadSources();
  const { rows, notes, namespacesAudited } = buildRows(sources);
  const summary = summarize(rows, { notes, namespacesAudited });

  const diffArg = args.find((a) => a.startsWith("--diff="));
  if (diffArg) {
    const result = diffAgainst(diffArg.slice("--diff=".length), rows);
    if (args.includes("--json")) {
      console.log(JSON.stringify({ retired: result.retired, added: result.added, changed: result.changed }, null, 2));
    } else {
      console.log(result.text);
    }
    return;
  }

  const jsonArg = args.find((a) => a === "--json" || a.startsWith("--json="));
  if (jsonArg) {
    const compact = args.includes("--compact");
    const payload = JSON.stringify(
      { summary, rows: compact ? compactRows(rows) : rows },
      null,
      2
    );
    const target = jsonArg.includes("=") ? jsonArg.slice("--json=".length) : null;
    if (target) {
      fs.writeFileSync(path.resolve(ROOT, target), `${payload}\n`);
      console.error(`wrote ${target}${compact ? " (compact evidence form)" : ""}`);
    } else {
      console.log(payload);
    }
    return;
  }

  printTable(rows);
  console.log("");
  console.log(
    `direct window.* assignments : ${summary.directExports} (= ${summary.moduleExports} module exports + ${summary.hostProperties} host property)`
  );
  console.log(`namespaces audited          : ${namespacesAudited.length} (${namespacesAudited.map((n) => n.namespace).join(", ")})`);
  console.log(`namespace members           : ${summary.namespaceMembers}`);
  console.log(`rows audited                : ${summary.totalRows}`);
  console.log(
    `verdicts                    : live=${summary.verdicts.live} test-seam=${summary.verdicts.testSeam} dead=${summary.verdicts.dead}`
  );
  if (summary.deadWithoutParent.length)
    console.log(`DEAD (own removal unit)     : ${summary.deadWithoutParent.join(", ")}`);
  if (summary.unclassified) console.log(`UNCLASSIFIED                : ${summary.unclassified} (must be 0)`);
  if (notes.length) {
    console.log("");
    console.log("NOT STATICALLY ENUMERABLE (recorded, not silently skipped):");
    for (const note of notes) console.log(`  ${note.namespace} ${note.kind} ${note.detail}`);
  }
}

module.exports = { ROOT, AREAS, loadSources, buildRows, summarize, verdictFor, diffAgainst };

if (require.main === module) main();

