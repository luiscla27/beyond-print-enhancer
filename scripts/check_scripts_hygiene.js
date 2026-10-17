#!/usr/bin/env node
/**
 * check_scripts_hygiene.js - the `scripts` area's own guard
 * (tracks scripts_inventory_hygiene_20261014 and scripts_inventory_hygiene_20261017).
 *
 * WHY THIS EXISTS. The `scripts` area is 66 tracked files operated by agents rather than by a build:
 * 48 Node CLIs, 9 Python tools, 3 JSON data files and 6 Markdown documents, of which four are reached
 * from `package.json` and eight are `require()`d by tests (measured 2026-10-17; the previous census
 * in this header said 54 / 44 / 8 / 1 / three / seven and had been stale for a cycle - arm 5 exists
 * because NOTHING compared that sentence with the repository, and arm 6 because nothing read the
 * Python half for syntax at all). Before this guard nothing in the repository knew what the area
 * contained: a file could be added or deleted with no artifact going stale, and a new script could
 * arrive with no statement of what it was for. TECH_DEBT_SCRIPTS.md is now that statement, and this
 * file is what keeps it true - it is the inventory's own input, not documentation about it.
 *
 * WHAT IT ENFORCES (each arm is falsified in test/unit/scripts_hygiene.test.js):
 *   1. COMPLETENESS - the set of paths in TECH_DEBT_SCRIPTS.md section 3 equals the set `git ls-files
 *      scripts` reports, in BOTH directions: a tracked script with no row fails, and a row naming a
 *      path that is not on disk fails. A row naming a file that exists but is not yet committed is an
 *      advisory, not a failure - a brand-new script is not a drift.
 *   2. PURPOSE HEADER - every tracked .js opens with a comment (after an optional shebang, blank
 *      lines and a `"use strict"`-style directive prologue); every tracked .py opens with a module
 *      docstring or a comment. This is the convention 34 of the 44 .js files already followed.
 *   3. SHEBANG - line 1 of a .js is `#!/usr/bin/env node`; line 1 of a .py is
 *      `#!/usr/bin/env python3`. Normalized by the same track that added this check.
 *   4. ROW SHAPE - every row names a `scripts/...` path, carries the five columns the inventory
 *      promises, and rates risk as low, medium or high.
 *   5. COMPOSITION (added 2026-10-17) - the inventory states the area's shape as a sentence
 *      ("**N files**: A `.js`, B `.py`, …") and those numbers are compared with the tracked set, per
 *      extension AND in total. Measured reason: the sentence was FALSE in three of four classes for
 *      two cycles while every arm above stayed green, because the four wrong numbers happened to sum
 *      to the right total and nothing read the sentence. A green arm 1 says the row set matches; it
 *      has never said the document's own description of that set is true.
 *   6. PYTHON SYNTAX (added 2026-10-17) - every tracked .py is COMPILED by an interpreter (parsed,
 *      never imported, no bytecode written). Measured reason: `npm run lint` runs eslint over every
 *      tracked .js file under `scripts/`, so a JS syntax error is a lint failure, while NOTHING in
 *      this repository read a .py file - `git grep -E "py_compile|ruff|flake8|python -m"` over the
 *      tracked tree returned 0 hits - and the dossier this area answers to names "syntax errors"
 *      explicitly. The interpreter is PROBED (`python3`, then `python`) because this host answers
 *      `python` only, and an absent interpreter is an ADVISORY, never a failure: the repository
 *      cannot require one, and a gate that fails on an absent optional tool gets routed around.
 *
 * WHAT IT DELIBERATELY DOES NOT DO, and why the omission is stated rather than silent:
 *   * THE EXEC BIT IS NOT ASSERTED HERE, because this repository does not track one - measured
 *     2026-10-14: `git ls-files -s` reports 0 paths at 100755 repo-wide and `core.filemode` is false
 *     on the Windows checkout, so a mode change on disk is invisible to git. The arm ACTIVATES
 *     itself the moment any tracked file carries 100755 (the first POSIX checkout to commit one):
 *     from then on every shebang-carrying file under scripts/ must be 100755 and the rest 100644.
 *     Until then the state is reported on every run so a green line cannot be read as coverage.
 *   * IT READS `git ls-files`, NOT THE DIRECTORY, for the governed set (decision D-A in the track's
 *     deliberation record): the live checkout holds four scripts `.gitignore` excludes by name plus
 *     `__pycache__/`, and a directory scan would demand rows for files the repository does not
 *     contain. Files present but untracked are named on the advisory line instead.
 *   * IT NEVER WRITES. `npm run lint` runs it before every `npm test`, so it may only read.
 *
 * USAGE
 *   node scripts/check_scripts_hygiene.js             # check this repository, exit 1 on any failure
 *   node scripts/check_scripts_hygiene.js --json      # machine-readable, for a later track
 *   node scripts/check_scripts_hygiene.js --root DIR  # check another root (used by the test fixture)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const INVENTORY = "TECH_DEBT_SCRIPTS.md";
const SCRIPT_DIR = "scripts";
const RISK_LEVELS = ["low", "medium", "high"];
const REQUIRED_COLUMNS = 5;
const JS_SHEBANG = "#!/usr/bin/env node";
const PY_SHEBANG = "#!/usr/bin/env python3";
//: Arm 5. The area's shape is stated in ONE sentence of the inventory and the sentence's own shape
//: is `**66 files**: 48 `.js`, 9 `.py`, 3 `.json`, 6 `.md``. It is parsed by its wording rather than
//: located by line number, so a re-flowed paragraph stays checkable and a DELETED declaration is a
//: finding instead of a silent disarm.
const COMPOSITION = /\*\*(\d+)\s+files?\*\*:\s*([^\n]*)/;
const COMPOSITION_CLASS = /(\d+)\s*`\.([a-z0-9]+)`/gi;
//: Arm 6. `python3` first, because every tracked shebang says python3 and a POSIX host resolves the
//: interpreter the file declares; `python` second, because this Windows checkout answers that name
//: and NOT `python3` (measured 2026-10-17: `python3 --version` -> EACCES, `python --version` -> 3.12.0).
const PY_INTERPRETERS = ["python3", "python"];
//: Arm 6's child program. It PARSES each file and never imports it, and it writes no bytecode - so
//: `python -m py_compile` is deliberately NOT used: that writes `__pycache__/` beside the sources,
//: i.e. a gate that mutates the tree it judges. `utf-8-sig` accepts a BOM, which `compile()` would
//: otherwise reject as a non-printable character. The final line is the census, printed ALWAYS (also
//: when files fail) so a run that parsed nothing cannot be read as a run that parsed cleanly.
const PY_COMPILE_SOURCE = [
  "import sys",
  "bad = 0",
  "for p in sys.argv[1:]:",
  "    try:",
  "        with open(p, encoding='utf-8-sig') as fh:",
  "            compile(fh.read(), p, 'exec')",
  "    except SyntaxError as exc:",
  "        bad += 1",
  "        print('FAIL\\t%s\\t%s (line %s)' % (p, exc.msg, exc.lineno))",
  "    except OSError as exc:",
  "        bad += 1",
  "        print('FAIL\\t%s\\t%s' % (p, exc))",
  "print('COMPILED\\t%s\\t%d' % (sys.version.split()[0], len(sys.argv) - 1))",
  "exit(1 if bad else 0)",
].join("\n");
//: A directive prologue is probed before the header is judged: `"use strict";` must stay the first
//: statement, and it says nothing about what the file is FOR.
const DIRECTIVE = /^["'][^"']*["'];?$/;

/** Rows of the inventory table: `{path, risk, cells}` for every `| \`scripts/...\` | ... |` line. */
function parseInventory(text) {
  const rows = [];
  const problems = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\|\s*`(scripts\/[^`]+)`/.exec(line);
    if (!m) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    rows.push({ path: m[1], cells, risk: (cells[4] || "").toLowerCase() });
    if (cells.length !== REQUIRED_COLUMNS) {
      problems.push(`row ${m[1]}: ${cells.length} columns, expected ${REQUIRED_COLUMNS} ` +
        "(path | purpose | invocation | runtime/dependencies | risk)");
    }
    // Markdown emphasis and a trailing reason are ACCEPTED: a human writes this table by hand, and a
    // parser that rejects `**high** - writes a tracked file` rejects correct input (the defect class
    // this whole guard exists to avoid). What is required is that the cell BEGINS with a real level.
    const level = (cells[4] || "").replace(/[*`_]/g, "").trim().match(/^[a-z]+/i);
    if (!level || !RISK_LEVELS.includes(level[0].toLowerCase())) {
      problems.push(`row ${m[1]}: risk column is "${cells[4] || ""}", expected low, medium or high`);
    }
  }
  return { rows, problems };
}

/** The first line that carries meaning: past the shebang, blank lines and a directive prologue. */
function firstContentLine(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  if (lines[i] && lines[i].startsWith("#!")) i += 1;
  while (i < lines.length && lines[i].trim() === "") i += 1;
  let j = i;
  while (j < lines.length && DIRECTIVE.test(lines[j].trim())) j += 1;
  while (j < lines.length && lines[j].trim() === "") j += 1;
  return { line: lines[i] === undefined ? "" : lines[i], after: j < lines.length ? lines[j] : "" };
}

/** `null` when the file declares its purpose, else the reason it does not. */
function headerProblem(rel, text) {
  const { line, after } = firstContentLine(text);
  const trimmed = line.trim();
  if (rel.endsWith(".py")) {
    if (trimmed.startsWith('"""') || trimmed.startsWith("'''") || trimmed.startsWith("#")) return null;
    return `${rel}: opens with "${trimmed.slice(0, 40)}" - a .py file must open with a module ` +
      "docstring (\"\"\"...) or a comment stating what it is for";
  }
  // A directive prologue (`"use strict";`) is skipped and the comment after it counts: the prologue
  // is a statement, not a purpose, and 6 files in this area legitimately lead with one.
  const judged = trimmed.startsWith("//") || trimmed.startsWith("/*") ? trimmed : after.trim();
  if (judged.startsWith("//") || judged.startsWith("/*")) return null;
  return `${rel}: opens with "${trimmed.slice(0, 40)}" - a .js file must open with a purpose ` +
    "header comment (after an optional shebang / \"use strict\")";
}

/** `null` when line 1 is the expected interpreter line, else the reason it is not. */
function shebangProblem(rel, text) {
  const first = text.split(/\r?\n/)[0].trim();
  const want = rel.endsWith(".py") ? PY_SHEBANG : JS_SHEBANG;
  if (first === want) return null;
  return `${rel}: line 1 is "${first.slice(0, 40)}", expected "${want}"`;
}

/** Arm 5, half one: the shape the INVENTORY declares — `{total, classes}` or `null` when it declares none. */
function parseComposition(text) {
  const m = COMPOSITION.exec(text);
  if (!m) return null;
  const classes = {};
  COMPOSITION_CLASS.lastIndex = 0;
  let cls;
  while ((cls = COMPOSITION_CLASS.exec(m[2])) !== null) classes[cls[2].toLowerCase()] = Number(cls[1]);
  return { total: Number(m[1]), classes };
}

/** Arm 5, half two: the shape the REPOSITORY has, by extension, over the tracked set. */
function compositionOf(paths) {
  const classes = {};
  for (const rel of paths) {
    const ext = path.extname(rel).replace(/^\./, "").toLowerCase();
    if (!ext) continue;
    classes[ext] = (classes[ext] || 0) + 1;
  }
  return { total: paths.length, classes };
}

/** Arm 5: `[]` when the declared shape equals the measured one, else one finding per difference. */
function compositionProblems(text, tracked) {
  const declared = parseComposition(text);
  if (!declared) {
    return [`${INVENTORY}: states no shape sentence ("**N files**: A \`.js\`, B \`.py\`, …) - add it, ` +
      "or the numbers this file states about itself cannot be checked (arm 5). A deleted declaration " +
      "is a finding, not a disarm"];
  }
  const measured = compositionOf(tracked);
  const findings = [];
  if (declared.total !== measured.total) {
    findings.push(`shape: declared **${declared.total} files**, measured ${measured.total} ` +
      "tracked path(s) - the sentence and `git ls-files scripts` disagree");
  }
  const keys = new Set([...Object.keys(declared.classes), ...Object.keys(measured.classes)]);
  for (const key of [...keys].sort()) {
    const want = declared.classes[key];
    const got = measured.classes[key];
    if (want === got) continue;
    findings.push(`shape: .${key} declared ${want === undefined ? "no count" : want}, measured ` +
      `${got === undefined ? "no file" : got}`);
  }
  return findings;
}

/**
 * Arm 6: compile every tracked `.py` with the first interpreter that answers.
 *
 * `interpreters` is a parameter rather than a constant so the ADVISORY path can be falsified without
 * uninstalling Python: a caller (the test) passes names that cannot resolve.
 */
function pythonSyntax(root, files, interpreters) {
  const py = files.filter((rel) => rel.endsWith(".py"));
  if (!py.length) {
    return { failures: [], advisory: "python syntax: NOT CHECKED (this tree tracks no .py file)" };
  }
  const tried = [];
  for (const interpreter of interpreters) {
    const run = spawnSync(interpreter, ["-c", PY_COMPILE_SOURCE, ...py], { cwd: root, encoding: "utf8" });
    if (run.error) {
      tried.push(`${interpreter} (${run.error.code || "unavailable"})`);
      continue;
    }
    const out = `${run.stdout || ""}${run.stderr || ""}`;
    const failures = out.split(/\r?\n/)
      .filter((line) => line.startsWith("FAIL\t"))
      .map((line) => {
        const [, file, why] = line.split("\t");
        return `${file}: ${why} - python syntax error (arm 6, via \`${interpreter}\`)`;
      });
    const census = /COMPILED\t(\S+)\t(\d+)/.exec(out);
    if (!census) {
      failures.push(`python syntax: \`${interpreter}\` ran but parsed nothing it could report ` +
        `(exit ${run.status}) - output was ${out.trim().slice(0, 120) || "empty"}`);
    }
    return {
      failures,
      advisory: `python syntax: ${census ? census[2] : 0} file(s) compiled via \`${interpreter}\` ` +
        `(${census ? census[1] : "version unknown"})`,
    };
  }
  return {
    failures: [],
    advisory: `python syntax: NOT CHECKED - no interpreter answered (tried ${tried.join(", ")}); ` +
      `the ${py.length} tracked .py file(s) are unparsed by every gate until one is present`,
  };
}

function gitLsFiles(root, args) {
  const run = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (run.error || run.status !== 0) return null;
  return run.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
}

/** The repo's own view: what git tracks under `scripts/`, and whether ANY mode is tracked. */
function governedSet(root) {
  const tracked = gitLsFiles(root, ["ls-files", SCRIPT_DIR]);
  const modes = gitLsFiles(root, ["ls-files", "-s", SCRIPT_DIR]);
  const allModes = gitLsFiles(root, ["ls-files", "-s"]);
  if (tracked === null || modes === null || allModes === null) {
    return { error: "git ls-files failed - this guard needs a git checkout (run it from the repo root)" };
  }
  return {
    tracked,
    executable: modes.filter((l) => l.startsWith("100755")).map((l) => l.split(/\s+/).pop()),
    anyExecutableTrackedRepoWide: allModes.some((l) => l.startsWith("100755")),
  };
}

function check(root, opts) {
  const options = opts || {};
  const interpreters = options.pythonInterpreters || PY_INTERPRETERS;
  const failures = [];
  const advisories = [];
  const governed = governedSet(root);
  if (governed.error) return { failures: [governed.error], advisories, governed: 0 };

  // --- 1. the inventory: rows, shape, and both directions of the set comparison -----------------
  let text = "";
  try {
    text = fs.readFileSync(path.join(root, INVENTORY), "utf8");
  } catch (err) {
    return { failures: [`${INVENTORY} is missing or unreadable (${err.message})`], advisories, governed: 0 };
  }
  const { rows, problems } = parseInventory(text);
  failures.push(...problems);
  const documented = new Set(rows.map((r) => r.path));
  for (const rel of governed.tracked) {
    if (!documented.has(rel)) {
      failures.push(`${rel}: tracked by git but has NO row in ${INVENTORY} - add it, or delete the file`);
    }
  }
  for (const rel of documented) {
    if (!fs.existsSync(path.join(root, rel))) {
      failures.push(`${rel}: has a row in ${INVENTORY} but is not on disk - the row is stale`);
    } else if (!governed.tracked.includes(rel)) {
      advisories.push(`${rel}: row present and file on disk, not yet tracked - it becomes governed ` +
        "once committed");
    }
  }
  let present = [];
  try {
    present = fs.readdirSync(path.join(root, SCRIPT_DIR));
  } catch (err) {
    advisories.push(`could not list ${SCRIPT_DIR}/ (${err.message})`);
  }
  const extras = present.filter((n) => {
    const rel = `${SCRIPT_DIR}/${n}`;
    if (rel === INVENTORY) return false;
    // A DIRECTORY is not an entry this inventory can row, and `scripts/perf/` is the counterexample
    // that made this arm lie: it was reported as "neither tracked nor documented" while each of its
    // 12 files carried a row, and `git ls-files scripts` (which IS recursive) already covers every
    // tracked path at any depth — a directory has nothing left to add. Measured 2026-10-16 while
    // re-executing track runtime_perf_20261015. NB the walk stays one level deep on purpose: this arm
    // is a drift alarm for a NEW script at the top level, and the recursive row->file comparison
    // above is what governs the tracked set.
    try {
      if (fs.statSync(path.join(root, rel)).isDirectory()) return false;
    } catch {
      /* unreadable entry: fall through and report it rather than swallow it */
    }
    return !governed.tracked.includes(rel) && !documented.has(rel);
  });
  if (extras.length) {
    advisories.push(`${extras.length} entry(ies) in ${SCRIPT_DIR}/ are neither tracked nor ` +
      `documented - ignored or not-yet-added: ${extras.join(", ")}`);
  }

  // --- 2 + 3. per-file conventions, over the TRACKED set -----------------------------------------
  let judged = 0;
  for (const rel of governed.tracked) {
    if (!rel.endsWith(".js") && !rel.endsWith(".py")) continue;
    let body;
    try {
      body = fs.readFileSync(path.join(root, rel), "utf8");
    } catch (err) {
      failures.push(`${rel}: unreadable (${err.message})`);
      continue;
    }
    judged += 1;
    const shebang = shebangProblem(rel, body);
    if (shebang) failures.push(shebang);
    const header = headerProblem(rel, body);
    if (header) failures.push(header);
    if (governed.anyExecutableTrackedRepoWide) {
      const isExec = governed.executable.includes(rel);
      if (isExec && !body.startsWith("#!")) {
        failures.push(`${rel}: carries the executable bit but declares no shebang`);
      }
      if (!isExec && body.startsWith("#!")) {
        failures.push(`${rel}: declares a shebang but does not carry the executable bit`);
      }
    }
  }

  // --- 5. the shape the inventory declares, against the shape the repository has -----------------
  // Measured reason for this arm: the declared composition was FALSE in three of four classes for two
  // cycles while every other arm stayed green, because the four wrong numbers summed to the right
  // total and nothing in this file read the sentence. Arm 1 says the row SET matches; it has never
  // said the document's own description of that set is true.
  failures.push(...compositionProblems(text, governed.tracked));

  // --- 6. python syntax, the runtime eslint never parses ------------------------------------------
  const py = pythonSyntax(root, governed.tracked, interpreters);
  failures.push(...py.failures);
  advisories.push(py.advisory);

  // --- 4. the exec-bit arm's own state, reported so green never reads as coverage ----------------
  advisories.unshift(
    governed.anyExecutableTrackedRepoWide
      ? "exec bit: tracked in this repository, so the shebang/mode pairing IS asserted above"
      : "exec bit: NOT TRACKED in this repository (0 tracked paths at 100755; core.filemode=false " +
        "on this checkout), so the shebang/mode pairing is reported, not asserted - see T-2 in " +
        INVENTORY);
  return { failures, advisories, governed: judged, exceptions: rows.length,
    shape: compositionOf(governed.tracked) };
}

function main(argv) {
  const args = argv.slice(2);
  const json = args.includes("--json");
  const rootIdx = args.indexOf("--root");
  const root = path.resolve(rootIdx >= 0 ? args[rootIdx + 1] : process.cwd());
  const { failures, advisories, governed, exceptions, shape } = check(root);
  const measured = shape
    ? Object.keys(shape.classes).sort().map((k) => `${shape.classes[k]} .${k}`).join(", ")
    : "";
  const census = `${governed} script(s) judged (shebang + purpose header) · ` +
    `${exceptions} row(s) in ${INVENTORY} · ` +
    `shape ${shape ? shape.total : "?"} file(s) (${measured}) · ` +
    "the two sets compared with `git ls-files scripts` in both directions";
  if (json) {
    process.stdout.write(JSON.stringify({ root, failures, advisories, census, ok: failures.length === 0 },
      null, 2) + "\n");
    return failures.length ? 1 : 0;
  }
  for (const line of advisories) console.log(`  advisory: ${line}`);
  if (!failures.length) {
    console.log(`SCRIPTS HYGIENE OK [root=${root}]\n  ${census}`);
    return 0;
  }
  console.log(`SCRIPTS HYGIENE FAIL - ${failures.length} finding(s) [root=${root}]\n  ${census}`);
  for (const line of failures) console.log(`  - ${line}`);
  return 1;
}

if (require.main === module) process.exit(main(process.argv));

module.exports = {
  check,
  parseInventory,
  headerProblem,
  shebangProblem,
  firstContentLine,
  parseComposition,
  compositionOf,
  compositionProblems,
  pythonSyntax,
  INVENTORY,
};

