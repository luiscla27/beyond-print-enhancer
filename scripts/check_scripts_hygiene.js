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
 *   7. RUNTIME SMOKE CROSS-CHECK (added 2026-10-17, track scripts_runtime_smoke_20261017) - the
 *      executable `low` rows of section 3 and the case table of scripts/smoke_low_risk.js are
 *      compared in BOTH directions: an executable low tool with no smoke case fails (governed but
 *      never executed), and a smoke case naming a path that is not an executable low row fails
 *      (executed but not vouched for). The runner's OWN row is exempt by name. Measured reason: the
 *      runtime smoke (T-4's delivery) holds an explicit case set, and without this arm nothing ties
 *      that set to the inventory that classifies the tools - the same drift class arm 1 closes one
 *      level up, between the inventory and the repository.
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
const PY_SHEBANG = "#!/usr/bin/env python";
//: Arm 5. The area's shape is stated in ONE sentence of the inventory and the sentence's own shape
//: is `**66 files**: 48 `.js`, 9 `.py`, 3 `.json`, 6 `.md``. It is parsed by its wording rather than
//: located by line number, so a re-flowed paragraph stays checkable and a DELETED declaration is a
//: finding instead of a silent disarm.
const COMPOSITION = /\*\*(\d+)\s+files?\*\*:\s*([^\n]*)/;
const COMPOSITION_CLASS = /(\d+)\s*`\.([a-z0-9]+)`/gi;
//: Arm 6. `python` first: that is the convention the nine tracked shebangs declare since
//: scripts_debt_sweep_20261017 (T-7 — previously `python3`, which this Windows checkout cannot
//: even resolve: `python3 --version` -> EACCES, `python --version` -> 3.12.0, measured 2026-10-17),
//: and a POSIX host without `python` on PATH falls through to `python3`, reported by the same
//: advisory path either way.
const PY_INTERPRETERS = ["python", "python3"];
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

/**
 * Arm 7 (added 2026-10-17, track scripts_runtime_smoke_20261017): the executable `low` rows
 * of the inventory and the smoke runner's case table are the SAME set, in BOTH directions.
 *
 * Measured reason: T-4's runner (scripts/smoke_low_risk.js) holds an explicit case table — one
 * entry per tool the smoke executes — and nothing else ties that table to the inventory that
 * classifies the tools. A `low` tool added to §3 without a case would be "governed" yet never
 * executed; a case naming a path that is not a tracked executable `low` row would execute a
 * tool the inventory does not vouch for. The runner's OWN row is exempt by name (SELF_ROW):
 * a smoke cannot execute itself, and the exemption is an explicit name match, never a wildcard.
 *
 * `cases` is a parameter (not a require of the runner) so the falsification suite can drive
 * BOTH directions against synthetic sets without touching the real files.
 */
function smokeCrossProblems(rows, cases, selfRow) {
  const executableLow = new Set(
    rows
      .filter((r) => /\.(js|py)$/.test(r.path) && (r.risk || "").startsWith("low"))
      .map((r) => r.path),
  );
  const cased = new Set(cases);
  const findings = [];
  for (const rel of [...executableLow].sort()) {
    if (rel === selfRow) continue; // the runner cannot run itself (named exemption)
    if (!cased.has(rel)) {
      findings.push(`${rel}: executable low row of ${INVENTORY} §3 has NO case in the runtime smoke ` +
        "(arm 7) - add it to scripts/smoke_low_risk.js's CASES, or re-rate its risk");
    }
  }
  for (const rel of [...cased].sort()) {
    if (!executableLow.has(rel)) {
      findings.push(`${rel}: smoke case is NOT an executable low row of ${INVENTORY} §3 (arm 7) - ` +
        "the runner executes a tool the inventory does not vouch for (untracked, non-low, or data/doc row)");
    }
  }
  return findings;
}

/**
 * Arm 8 (added 2026-10-17, track scripts_debt_sweep_20261017): the `harness` classification.
 *
 * §5-T-1's rule (operator ruling 2026-10-17): every executable row whose risk cell claims absent
 * inputs (`absent`, `gone`, `not in the tree`, `historical`, `is gone`) is a SPENT HARNESS and must
 * say so — the cell carries the `harness` marker. A row that claims absent inputs without the
 * marker is a finding (an unclassified harness), and so is a `harness` marker on a row whose cell
 * claims no absent input (an unexplained classification). The count is REPORTED on every run, so
 * the census a reader sees is the census the rule derives, not a number prose asserts.
 *
 * `riskText` is the raw risk cell (markdown emphasis stripped by the caller's risk regex is NOT
 * enough — the cell may carry backticks and reasons).
 */
const ABSENT_INPUT = /absent|gone|not in the tree|historical|is gone/i;
const HARNESS_MARKER = /(^|[^a-z])harness([^a-z]|$)/i;
function harnessProblems(rows) {
  const findings = [];
  let count = 0;
  for (const r of rows) {
    if (!/\.(js|py)$/.test(r.path)) continue;
    const cells = Array.isArray(r.cells) ? r.cells : [];
    const cell = cells[4] !== undefined ? cells[4] : (cells[3] !== undefined ? cells[3] : (r.risk || ""));
    const claimsAbsent = ABSENT_INPUT.test(cell);
    const marked = HARNESS_MARKER.test(cell);
    if (claimsAbsent && !marked) {
      findings.push(`${r.path}: risk cell claims absent inputs but carries no \`harness\` marker ` +
        "(arm 8) - classify it (T-1's rule in the inventory), or state why its inputs are present");
    } else if (!claimsAbsent && marked) {
      findings.push(`${r.path}: \`harness\` marker without an absent-input claim in the risk cell ` +
        "(arm 8) - a harness is a row whose inputs are gone; state what is absent, or drop the marker");
    } else if (marked) {
      count += 1;
    }
  }
  return { findings, count };
}

/**
 * Arm 9 (added 2026-10-17, track scripts_debt_sweep_20261017): per-script dependency declarations
 * (T-3). Every third-party `require()` target in every tracked `.js` under scripts/ must resolve
 * in `package.json` (dependencies or devDependencies — the area's real deps are all dev), and every
 * import in every tracked `.py` must be stdlib or a sanctioned local module (the two local helpers
 * the area ships outside its own directory). Relative and built-in targets are not declarations.
 *
 * The `.py` half does NOT hardcode a stdlib list (it would rot with every Python release): the
 * interpreter that arm 6 already probed is asked — `python -c "import sys; print('\n'.join(sorted(sys.stdlib_module_names)))"`.
 * An interpreter that cannot answer (arm 6's ADVISORY path) demotes the `.py` half to an ADVISORY
 * that names what was NOT checked, never a silent pass.
 */
const PY_LOCAL_MODULES = ["text_fallback", "model_call_telemetry"];
const JS_REQUIRE = /(?<!["'`]\s*\*?\s*)\brequire\(\s*["']([^"']+)["']\s*\)/g;
//: A require inside a template literal (this guard's own error messages) is PROSE, not a call —
//: require( preceded by a backtick/dollar-brace is excluded by the guard below instead, because
//: lookbehind across the whole file is brittle. Simpler: match and then drop matches whose
//: capture is literally `${target}`-style prose (contains `${`).
const PY_IMPORT = /^[ \t]*(?:import[ \t]+([.\w]+)|from[ \t]+([.\w]+)[ \t]+import)/gm;

function pyStdlibNames(root, interpreters) {
  const src = "import sys; print('\\n'.join(sorted(sys.stdlib_module_names)))";
  for (const interpreter of interpreters) {
    const run = spawnSync(interpreter, ["-c", src], { cwd: root, encoding: "utf8" });
    if (run.error || run.status !== 0 || !run.stdout.trim()) continue;
    return { names: new Set(run.stdout.split(/\r?\n/).filter(Boolean)), interpreter };
  }
  return { names: null, interpreter: null };
}

function dependencyProblems(root, files, stdlibInfo) {
  const pyStdlib = stdlibInfo ? stdlibInfo.names : null;
  const nodeBuiltins = new Set(require("module").builtinModules);
  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  } catch (err) {
    return { js: [`package.json is unreadable (${err.message}) - arm 9 cannot resolve any dependency`], py: [], stdlibVia: null };
  }
  const declared = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ]);
  const jsFindings = [];
  const pyFindings = [];
  for (const rel of files) {
    let body;
    try {
      body = fs.readFileSync(path.join(root, rel), "utf8");
    } catch {
      continue; // unreadable is arm 2's finding, not this arm's
    }
    if (rel.endsWith(".js")) {
      for (const m of body.matchAll(JS_REQUIRE)) {
        const target = m[1];
        if (target.includes("${")) continue; // prose inside a template literal, not a call
        if (target.startsWith(".") || target.startsWith("/") || target.startsWith("node:") ||
            nodeBuiltins.has(target)) continue;
        if (!declared.has(target)) {
          jsFindings.push(`${rel}: require("${target}") is not declared in package.json (arm 9, T-3) - ` +
            "add it to devDependencies, or make the target relative/built-in");
        }
      }
    } else if (rel.endsWith(".py") && pyStdlib) {
      for (const m of body.matchAll(PY_IMPORT)) {
        const top = (m[1] || m[2]).split(".")[0];
        if (top === "__future__" || pyStdlib.has(top) || PY_LOCAL_MODULES.includes(top)) continue;
        pyFindings.push(`${rel}: imports "${top}" which is neither stdlib nor a sanctioned local ` +
          `module (${PY_LOCAL_MODULES.join(", ")}) (arm 9, T-3)`);
      }
    }
  }
  return { js: jsFindings, py: pyFindings, stdlibVia: pyStdlib ? pyStdlib.interpreter : null };
}

/**
 * The file's own PURPOSE STATEMENT: the first paragraph of its opening comment/docstring, rendered
 * to one line. Arm 2 demands such an opener exists; arm 10 (T-8) holds the inventory's purpose cell
 * to it, so a row cannot state a purpose its file does not (the F-9 defect class one level down).
 * "First paragraph" because several headers continue into WHY/USAGE sections — the purpose is the
 * opening statement, not the whole block.
 */
function headerText(rel, body) {
  const lines = body.replace(/^\uFEFF/, "").split(/\r?\n/);
  let i = 0;
  if (lines[i] && lines[i].startsWith("#!")) i += 1;
  while (i < lines.length && lines[i].trim() === "") i += 1;
  const out = [];
  if (rel.endsWith(".py")) {
    const first = lines[i] || "";
    const q3 = first.trim().startsWith('"""') ? '"""'
      : first.trim().startsWith("'''") ? "'''" : null;
    if (q3) {
      const rest = first.trim().slice(3);
      const endIdx = rest.indexOf(q3);
      if (endIdx >= 0) return collapse(rest.slice(0, endIdx));
      out.push(rest);
      for (i += 1; i < lines.length; i += 1) {
        const line = lines[i];
        const close = line.indexOf(q3);
        if (close >= 0) {
          out.push(line.slice(0, close));
          break;
        }
        out.push(line);
        if (line.trim() === "" && out.length > 1) break; // first paragraph ended
      }
    } else if (first.trim().startsWith("#")) {
      for (; i < lines.length && lines[i].trim().startsWith("#"); i += 1) {
        out.push(lines[i].trim().replace(/^#+\s*/, ""));
        if (lines[i].trim() === "#") break;
      }
    }
    return collapse(out.join(" "));
  }
  // .js: the opening comment block, `/**…*/`, `/*…*/` or contiguous `//` lines
  const first = (lines[i] || "").trim();
  if (first.startsWith("/*")) {
    out.push(first.replace(/^\/\*+/, ""));
    for (i += 1; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (line.includes("*/")) {
        out.push(line.replace(/\*+\/.*$/, ""));
        break;
      }
      out.push(line.replace(/^\*+\s?/, ""));
      if (line.replace(/^\*+\s?/, "") === "" && out.length > 1) break; // first paragraph ended
    }
  } else if (first.startsWith("//")) {
    for (; i < lines.length && lines[i].trim().startsWith("//"); i += 1) {
      out.push(lines[i].trim().replace(/^\/+\s?/, ""));
      if (lines[i].trim() === "//") break;
    }
  }
  return collapse(out.join(" "));
}

function collapse(text) {
  return text.replace(/\s+/g, " ").trim();
}

/** Normalized form for the row↔header comparison: case, backticks/emphasis, punctuation runs. */
function normCell(text) {
  const collapsed = collapse(text
    .replace(/[`*_]/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/[^A-Za-z0-9.\- ]+/g, " "));
  return collapse(collapsed
    .replace(/^\s*[A-Za-z0-9_./-]+\s*[-:]+\s*/, "")   // a leading "<basename> — " prefix
    .replace(/ \. /g, " ")                             // an inline-codename period ("window.* .")
    .replace(/[-.] /g, " ")                            // a mid-word hyphen/period from a name
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase());
}

/**
 * Arm 10 (added 2026-10-17, track scripts_debt_sweep_20261017): the inventory's purpose cell must
/**
 * Arm 10 (added 2026-10-17, track scripts_debt_sweep_20261017): the inventory's purpose cell must
 * BEGIN with the file's own header text (normalized, D-2: cells are brought to headers, never the
 * reverse). The leading "<basename>" token of a self-titled header is stripped by normCell on BOTH
 * sides, so a row that keeps its own citation prefix still aligns. Data/doc rows have no header
 * (arm 2 does not demand one) and are skipped by the same rule. `readFile(rel)` is injectable for
 * the falsification suite.
 */
function alignmentProblems(rows, readFile) {
  const findings = [];
  for (const r of rows) {
    if (!/\.(js|py)$/.test(r.path)) continue;
    let body;
    try {
      body = readFile(r.path);
    } catch {
      continue; // unreadable/missing is arm 1's finding
    }
    const header = headerText(r.path, body);
    if (!header) continue; // no opener: arm 2's finding, not this arm's
    const purpose = (Array.isArray(r.cells) ? r.cells[1] : "") || "";
    const normHeader = normCell(header).replace(/^[a-z0-9_./-]+ /, "");
    const normPurpose = normCell(purpose);
    // The header's tokens must appear IN ORDER at the START of the normalized purpose cell —
    // the row may carry its own lead-in tokens (its "<basename> —" prefix, a citation), but the
    // header's own token sequence must follow from the first token on. Still a falsifiable claim.
    const tokens = normHeader.split(" ").filter(Boolean);
    const rowTokens = normPurpose.split(" ").filter(Boolean);
    let start = -1;
    if (tokens.length && rowTokens.length) {
      for (let lead = 0; lead <= 2; lead += 1) {
        if (rowTokens.length >= tokens.length + lead &&
            tokens.every((t, i) => rowTokens[lead + i] === t)) {
          start = lead;
          break;
        }
      }
    }
    const aligned = start >= 0;
    if (!aligned) {
      findings.push(`${r.path}: purpose cell does not BEGIN with the file's own header text ` +
        "(arm 10, T-8) - bring the row to the header (normalized), never edit the file's opener");
    }
  }
  return findings;
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

  // --- 7. the smoke runner's case table vs the inventory's executable low rows (both directions) --
  // The runner is read as TEXT (a require would execute nothing, but the guard never writes and the
  // runner exports its table for the falsification suite; the regex keeps this arm independent of the
  // runner's module shape). The runner's own row is exempt by name — it cannot execute itself.
  const smokePath = path.join(root, "scripts", "smoke_low_risk.js");
  let smokeCases = [];
  let smokeMiss = null;
  try {
    const smoke = fs.readFileSync(smokePath, "utf8");
    smokeCases = [...smoke.matchAll(/file:\s*"([^"]+)"/g)].map((m) => m[1].replace(/\\/g, "/"));
  } catch {
    smokeMiss = "smoke runner scripts/smoke_low_risk.js is missing - arm 7 cannot compare " +
      "the case table with the inventory; every executable low row is un-smoked until it returns";
  }
  if (smokeMiss) {
    advisories.push(smokeMiss);
  } else {
    failures.push(...smokeCrossProblems(rows, smokeCases, "scripts/smoke_low_risk.js"));
    advisories.push(`runtime smoke: ${smokeCases.length} case(s) in scripts/smoke_low_risk.js, ` +
      "cross-checked with the executable low rows in both directions (arm 7; the runner's own row exempt)");
  }

  // --- 8. the harness classification (T-1): absent-input rows must carry the marker, and only them
  const harness = harnessProblems(rows);
  failures.push(...harness.findings);
  advisories.push(`harness census: ${harness.count} row(s) classified \`harness\` by arm 8 ` +
    "(risk cell claims absent inputs; T-1's rule + retirement checklist in the inventory §5)");

  // --- 9. per-script dependency declarations (T-3)
  const stdlib = pyStdlibNames(root, interpreters);
  const deps = dependencyProblems(root, governed.tracked, stdlib.names ? stdlib : null);
  failures.push(...deps.js);
  if (stdlib.names) {
    failures.push(...deps.py);
    advisories.push(`dependencies: .py stdlib resolved via \`${stdlib.interpreter}\` ` +
      `(${stdlib.names.size} stdlib names)`);
  } else {
    advisories.push("dependencies: the .py import half NOT CHECKED - no interpreter answered " +
      `(tried ${interpreters.join(", ")}); stdlib membership is unparsed until one is present`);
  }

  // --- 10. the inventory's purpose cells vs the files' own headers (T-8)
  failures.push(...alignmentProblems(rows, (rel) => fs.readFileSync(path.join(root, rel), "utf8")));

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
  smokeCrossProblems,
  harnessProblems,
  dependencyProblems,
  headerText,
  normCell,
  alignmentProblems,
  INVENTORY,
};

