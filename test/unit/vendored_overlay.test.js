/**
 * The vendored overlay layout and the public-project flow must both be TRUE, together.
 *
 * Why this suite exists: this project migrated onto the `vendor_root_consolidation_20260914`
 * layout by hand (operator option A of 2026-09-15,
 * `temp/issues/ISSUE_vendored_overlay_layout_and_generated_public_block_20260915.md`). A manual
 * migration is exactly the kind of state that decays silently — a re-sync can stamp an overlay
 * member at the ROOT again (the half-migrated state the framework's own spec §3.7 forbids), a
 * hand-edit can break the marker pair the hook greps for, and a fresh `git init` elsewhere can
 * forget the hook binding. Each case below is the AC-1/AC-6/AC-7/AC-8 invariant for THIS repo,
 * read from the worktree rather than asserted in prose.
 *
 * Runs ONLY where the overlay exists: every file it checks is excluded from the public history,
 * so a fresh clone of this repo has neither this test nor the tree it inspects (same shape as
 * `input_budget_alignment.test.js`'s fresh-clone case).
 *
 * Falsifiability (checked at authoring, 2026-09-15): re-creating a root `conductor/` fails case 1;
 * deleting the generated block's open marker fails case 2 AND case 3; unsetting `core.hooksPath`
 * fails case 4; dropping `[skills] paths` fails case 5; clearing the lock flag fails case 6.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const OVERLAY = path.join(ROOT, "vendor");
const MARK_OPEN = "# >>> modelstack vendor overlay (generated — do not edit) >>>";
const MARK_CLOSE = "# <<< modelstack vendor overlay (generated) <<<";
const GENERATED_PATTERNS = ["/vendor/", "/modelstack.lock", "/reasonix.toml"];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const has = (rel) => fs.existsSync(path.join(ROOT, rel));

function generatedBlock(text) {
  const open = text.indexOf(MARK_OPEN);
  const close = text.indexOf(MARK_CLOSE);
  if (open === -1 || close === -1 || close < open) return null;
  return text.slice(open, close + MARK_CLOSE.length);
}

function git(...args) {
  const res = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return res.status === 0 ? res.stdout.trim() : null;
}

/** [relative path, bytes] for every file under `dir` (or the single file `dir`). */
function walk(dir) {
  if (!fs.statSync(dir).isDirectory()) {
    return [[path.basename(dir), fs.readFileSync(dir)]];
  }
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else out.push([path.relative(dir, p).replace(/\\/g, "/"), fs.readFileSync(p)]);
    }
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

describe("vendored overlay layout + public flow (issue …_vendored_overlay_layout_20260915)", function () {
  it("puts the whole framework overlay under vendor/, with no root copies", function () {
    // AC-1: the overlay members that migrated. A MISSING one is a real finding (the tree is
    // half-migrated), not a skip — so this list is asserted, not enumerated from disk.
    const members = [
      "AGENTS.md",
      "conductor/tracks.md",
      "conductor/track_spec_template.md",
      "docs",
      ".reasonix/skills",
      "config.yaml",
      "lanes.yaml",
      "pipeline.yaml",
      "registry.yaml",
      "stack_adapter.py",
      "housekeeping_guard.py",
      "hooks/pre-commit",
      "PROJECTS.fragment.json",
      ".env.fragment",
      "ISSUE_template.md",
      "scheduled-task.ps1.fragment",
    ];
    for (const rel of members) {
      assert.ok(
        has(path.join("vendor", rel)),
        `the overlay member vendor/${rel} is missing — the layout is half-migrated`,
      );
    }
    // …and the SAME names must NOT exist at the root. The root `AGENTS.md` is the documented
    // exception to this rule (a pointer, because Reasonix cannot be told where else to look);
    // everything else at the root would be a duplicated member.
    const banned = members.filter((m) => m !== "AGENTS.md");
    for (const rel of banned) {
      assert.ok(
        !has(rel),
        `the root still carries ${rel}, which now lives in vendor/ — a half-migrated tree ` +
          `(spec §3.7). Remove the root copy; do not re-add it.`,
      );
    }
    // The three named root exceptions really are at the root.
    assert.ok(has(".gitignore"), ".gitignore must stay at the root (it is the ignore mechanism)");
    assert.ok(has("modelstack.lock"), "the pin is read from the worktree root");
    assert.ok(has("reasonix.toml") || has("reasonix.toml.example"), "reasonix.toml* stays at the root");
  });

  it("carries the generated block in .gitignore with exactly the three framework patterns", function () {
    const block = generatedBlock(read(".gitignore"));
    assert.ok(block !== null, ".gitignore must carry the marker-delimited generated block");
    for (const pattern of GENERATED_PATTERNS) {
      assert.ok(
        block.split(/\r?\n/).includes(pattern),
        `the generated region must contain ${pattern}; got:\n${block}`,
      );
    }
    // The block must be COMMITTED — it is the only protection a fresh clone carries
    // (the lock is ignored, and core.hooksPath is repository-local: framework residual R2).
    const committed = git("show", "HEAD:.gitignore");
    assert.notStrictEqual(committed, null, "this must be a git work tree");
    assert.ok(
      committed.includes(MARK_OPEN),
      "the generated block must be committed, or a clone protects nothing",
    );
    // …and the project's OWN rules must survive next to it (the reconciliation in the issue §4).
    for (const own of ["/temp/", "/shots/", "/.reasonix/", "/reasonix.exe"]) {
      assert.ok(
        read(".gitignore").split(/\r?\n/).includes(own),
        `the project-owned pattern ${own} must stay — the generated region does not cover it`,
      );
    }
  });

  it("keeps the hook's marker constants in step with the block it greps for", function () {
    // The hook (framework-stamped, so never hand-edited) carries its OWN copy of the two markers
    // and rule 3 fails closed when the block's open marker is absent. If those two spellings ever
    // diverge — a re-cut unit, a stray edit to the consumer's block — a public project starts
    // denying its own commits, or stops denying overlay adds. This is the hermetic way to pin the
    // pair without reaching into a framework checkout.
    const hook = read(path.join("vendor", "hooks", "pre-commit"));
    const openDecl = hook.match(/^MARK_OPEN="(.*)"$/m);
    const closeDecl = hook.match(/^MARK_CLOSE="(.*)"$/m);
    assert.ok(openDecl && closeDecl, "the stamped hook must declare both marker constants");
    assert.strictEqual(openDecl[1], MARK_OPEN, "the hook's open marker must match the block's");
    assert.strictEqual(closeDecl[1], MARK_CLOSE, "the hook's close marker must match the block's");
    assert.ok(
      read(".gitignore").includes(MARK_OPEN),
      "…and the committed block must actually use that spelling",
    );
    assert.strictEqual(
      (read(".gitignore").match(/modelstack vendor overlay/g) || []).length,
      2,
      "exactly one generated region (two marker lines) — a stray copy is a half-removed block",
    );
  });

  it("binds the hook it stamped (core.hooksPath -> vendor/hooks)", function () {
    const bound = git("config", "--get", "core.hooksPath");
    assert.strictEqual(
      bound && bound.replace(/\\/g, "/"),
      "vendor/hooks",
      `a public project's overlay guard must be bound; core.hooksPath is ${JSON.stringify(bound)}. ` +
        "Re-bind with `msf public --enable --root .` (repository-local by design — see R2)",
    );
  });

  it("declares where the skills went, and the path resolves", function () {
    // AC-8: `vendor/.reasonix/skills` is NOT a convention discovery root, so the root config is the
    // only thing that makes the playbooks visible to the client.
    for (const rel of ["reasonix.toml", "reasonix.toml.example"]) {
      if (!has(rel)) continue; // the live file is gitignored; the mirror is the committed copy
      const m = read(rel).match(/^\[skills\][\s\S]*?paths\s*=\s*\[([^\]]*)\]/m);
      assert.ok(m, `${rel} must declare [skills] paths for the vendored skill set`);
      const listed = m[1].match(/"([^"]+)"/g) || [];
      assert.ok(
        listed.some((entry) => entry.replace(/"/g, "").replace(/\\/g, "/").endsWith("vendor/.reasonix/skills") ||
          entry.replace(/"/g, "").replace(/\\/g, "/") === "vendor/.reasonix/skills"),
        `${rel}'s [skills] paths must name vendor/.reasonix/skills, got ${m[1].trim()}`,
      );
    }
    const dir = path.join(ROOT, "vendor", ".reasonix", "skills");
    assert.ok(fs.statSync(dir).isDirectory(), "the declared skill root must exist");
    const n = fs.readdirSync(dir).filter((f) => /\.(md)$|^(conductor|fleet|muse|prevent|right|summary|visual|e2e|lego|modelstack|okf|design|session|subtrack)/.test(f)).length;
    assert.ok(n > 5, `the declared skill root must hold the playbook set (found ${n} entries)`);
  });

  it("declares governance at the root and received the whole catalog surface", function () {
    // Governance adoption (`temp/archived/ISSUE_governance_content_migration_handoff_20260915.md`).
    // Two invariants, both layout-specific and both silent if broken:
    //  1. the declaration must be at the ROOT — `governance.py:96` reads `root/governance.yaml` and
    //     that lookup does NOT go through `vendor_layout.resolve_home`, so a file under `vendor/`
    //     leaves the gate in ADVISORY mode forever while looking correctly placed;
    //  2. the 44 received units (34 `delivery: template` docs + 10 `delivery: stamped` skills) must
    //     actually be there — the overlay's exclusion from history means no clone can tell us.
    assert.ok(
      has(path.join("governance.yaml")),
      "governance.yaml must be at the ROOT: the gate reads it there and never under vendor/",
    );
    assert.ok(
      !has(path.join("vendor", "governance.yaml")),
      "a vendor/governance.yaml would be inert (the gate's declaration lookup is root-only) — " +
        "keep exactly one, at the root",
    );
    const decl = read("governance.yaml");
    assert.ok(
      /^governance:\s*enforced\s*$/m.test(decl),
      "the project opted into `governance: enforced`; if this reads advisory the opt-in was lost " +
        "and drift is being reported as a warning again",
    );
    for (const rel of [
      path.join("vendor", "docs", "governance", "gates", "plan-commit-gate.md"),
      path.join("vendor", "docs", "governance", "gates", "viewport-capture-workflow.md"),
      path.join("vendor", "docs", "governance", "naming-conventions.md"),
      path.join("vendor", "docs", "governance", "relay-modelstacks.md"),
      path.join("vendor", ".reasonix", "skills", "visual-review", "SKILL.md"),
      path.join("vendor", ".reasonix", "skills", "okf-context", "SPEC.md"),
      path.join("vendor", ".reasonix", "skills", "session-close-out.md"),
    ]) {
      assert.ok(has(rel), `received governance unit ${rel} is missing — re-run the receive step`);
    }
    const gates = fs.readdirSync(path.join(OVERLAY, "docs", "governance", "gates"));
    assert.strictEqual(
      gates.length,
      14,
      "the delivered gate surface is 14 units (the issue's §'34 missing'), got " + gates.length,
    );
    // Every stamped skill the catalog calls canonical must match its canonical body byte-for-byte.
    // The comparison needs the framework checkout, which is not part of this repo's history; when it
    // is not reachable the case asserts only the local half (the count + the declared-local list).
    const declaredLocal = [...decl.matchAll(/home:\s*(\S+)/g)].map((m) => m[1].replace(/\\/g, "/"));
    const skillRoot = path.join(ROOT, "vendor", ".reasonix", "skills");
    const entries = fs.readdirSync(skillRoot);
    assert.ok(
      declaredLocal.every((d) => has(path.join("vendor", d))),
      "every `local:` home in governance.yaml must exist — a declared unit that is gone is drift " +
        "in the other direction",
    );
    const canonicalRoot = process.env.MSF_CANONICAL_SKILLS; // set by the harness when the framework is reachable
    if (canonicalRoot) {
      const stamped = entries.filter((e) => !declaredLocal.some((d) => d.split("/").includes(e)));
      assert.ok(stamped.length >= 18, `expected the full stamped skill set, found ${stamped.length}`);
      for (const e of stamped) {
        const mine = path.join(skillRoot, e);
        const theirs = path.join(canonicalRoot, e);
        if (!fs.existsSync(theirs)) continue; // catalog homes differ in shape for a few units
        const norm = (buf) => buf.toString("utf8").replace(/\r\n/g, "\n");
        assert.deepStrictEqual(
          walk(mine).map(([rel, bytes]) => [rel, norm(bytes)]),
          walk(theirs).map(([rel, bytes]) => [rel, norm(bytes)]),
          `stamped skill ${e} has drifted from its canonical body — restore it or declare it local`,
        );
      }
    }
  });

  it("says PUBLIC in the lock — and the lock says what the block says", function () {
    const lock = JSON.parse(read("modelstack.lock"));
    assert.strictEqual(lock.public_project, true, "modelstack.lock must declare public_project");
    // The hook's own detection order is lock -> block -> not public. Both must agree, or a clone
    // (which carries the block and NOT the lock) reads a different posture than this worktree.
    assert.ok(
      generatedBlock(read(".gitignore")) !== null,
      "the lock says public, so .gitignore must carry the generated region",
    );
    // And the overlay really is excluded right now — `git add` must not offer it.
    const staged = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: ROOT,
      encoding: "utf8",
    }).stdout;
    const leaked = staged
      .split(/\r?\n/)
      .filter((line) => /^\?\?/.test(line) && /^(\?\?\s+)?(vendor\/|modelstack\.lock$|reasonix\.toml)/.test(line));
    assert.deepStrictEqual(
      leaked,
      [],
      `the generated region must keep the overlay out of \`git status\`; leaked:\n${leaked.join("\n")}`,
    );
  });
});
