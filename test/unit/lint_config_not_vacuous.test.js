/**
 * The lint config must keep LOOKING at the tree (track `gate_coverage_20260912`, Phase 1, AC-2).
 *
 * WHY THIS EXISTS. This project has produced three vacuous guards, and the third is this track's
 * subject: `no-console` was documented in `eslint.config.js` as a hard failure since
 * `refactor_surface_20260911` and **had never executed on a single file in any tree**, because
 * nothing invoked eslint. `package.json` has a `lint` script now, but a script is not a guarantee —
 * the config could be made to report nothing at all by declaring every name the tree uses, and every
 * gate would stay green. That is the exact failure mode AC-2 forbids ("a config that declares
 * everything reports nothing"), so it is pinned here by PLANTING the three defects and requiring
 * eslint to name them:
 *
 *   1. an undefined identifier        -> `no-undef`   (the config does not "declare everything")
 *   2. a `console.*` call             -> `no-console` (the ratified O-4 rule is still an error)
 *   3. an unused binding              -> `no-unused-vars` (O-3 resolved the backlog; it must stay
 *                                                          reported, not merely absent today)
 *   and, in the other direction, a name the config DOES declare (`safeLog`, a product seam) must
 *   produce nothing — otherwise "no findings" would be indistinguishable from "everything is
 *   declared", which is the vacuity this test is for.
 *
 * The fixture is fed through `--stdin-filename js/…`, so the config under test is the repository's
 * own by construction, and no scratch file is written into `js/`.
 */
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");

/** One eslint run over one synthetic file, resolved through the repo's own config. */
function lint(relativeName, source) {
  const res = spawnSync(
    process.execPath,
    [
      path.join(ROOT, "node_modules", "eslint", "bin", "eslint.js"),
      "--stdin",
      "--stdin-filename",
      relativeName,
      "-f",
      "json",
    ],
    { cwd: ROOT, input: source, encoding: "utf8" },
  );
  const stdout = res.stdout || "";
  const start = stdout.indexOf("[");
  assert.ok(start >= 0, "eslint produced no JSON report: " + stdout.slice(0, 400) + res.stderr);
  return JSON.parse(stdout.slice(start));
}

const rulesOf = (reports) =>
  reports.flatMap((r) => r.messages.map((m) => m.ruleId)).filter(Boolean);

describe("the lint config actually looks at the tree (AC-2, AC-6)", function () {
  this.timeout(60000);

  it("reports an undefined identifier in the PRODUCT tree (it does not declare everything)", function () {
    const rules = rulesOf(lint("js/__lint_fixture__.js", "__plantedUndefinedRef__();\n"));
    assert.ok(
      rules.includes("no-undef"),
      "an undefined identifier must still be an error in js/ — got: " + JSON.stringify(rules),
    );
  });

  it("reports a console.* call in the PRODUCT tree (the O-4 rule is still an error)", function () {
    const rules = rulesOf(lint("js/__lint_fixture__.js", 'console.log("plant");\n'));
    assert.ok(
      rules.includes("no-console"),
      "no-console must still be an error in js/ — got: " + JSON.stringify(rules),
    );
  });

  it("reports an unused binding in the PRODUCT tree (O-3's backlog cannot silently return)", function () {
    const rules = rulesOf(lint("js/__lint_fixture__.js", "const unusedBinding = 1;\n"));
    assert.ok(
      rules.includes("no-unused-vars"),
      "no-unused-vars must still be an error in js/ — got: " + JSON.stringify(rules),
    );
  });

  it("does NOT report a name the config declares on purpose (a product seam)", function () {
    const rules = rulesOf(lint("js/__lint_fixture__.js", 'safeLog("log", "seam");\n'));
    assert.ok(
      !rules.includes("no-undef"),
      "the declared seam safeLog must not be reported — got: " + JSON.stringify(rules),
    );
  });

  it("the fast gate's one command carries lint (AC-1)", function () {
    // AC-1 is "one documented command runs lint + unit + integration + the manifest check". The
    // documented command is `npm test`; lint is wired into it with `pretest`, so this asserts the
    // LINK rather than a remembered invocation.
    const pkg = require(path.join(ROOT, "package.json"));
    assert.strictEqual(pkg.scripts.pretest, "npm run lint", "npm test must run lint first");
    assert.ok(pkg.scripts.lint, "a lint script must exist");
    const target = pkg.scripts.lint;
    for (const tree of ["js/", "test/", "scripts/"]) {
      assert.ok(
        target.includes(tree),
        "the lint script must cover " + tree + " (O-7: three trees, one command) — got " + target,
      );
    }
  });
});
