/**
 * Height-symmetry contract (track ornament_symmetry_20260910, spec.md AC-4/AC-5).
 *
 * The owner's report was "buttons with different heights"; the audit measured
 * NINE distinct heights (20/22/24/26/27/30/32/34/36px + a 39.6px row outlier).
 * The contract is four FIXED tiers plus a fixed row height. These assertions
 * pin the tiers, the fixed-height rule (never min-height — a min-height is what
 * silently grew when a label wrapped), the wrap immunity mechanism, and the two
 * ratified microcopy shortenings.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const theme = require("../../js/ui_theme.js");

const CSS = theme.css;
const TIERS = theme.tiers;

const ROOT = path.resolve(__dirname, "..", "..");
const CONTROLS = fs.readFileSync(path.join(ROOT, "js", "controls.js"), "utf8");
const BACKGROUND = fs.readFileSync(path.join(ROOT, "js", "background.js"), "utf8");
const PRINT_STYLES = fs.readFileSync(path.join(ROOT, "js", "print_styles.js"), "utf8");

/** AC-3: does the panel still declare a HELP tray? (Read from the shipped source, not re-typed.) */
function trayDefsIncludesHelp() {
  const m = CONTROLS.match(/const trayDefs = \{([^}]*)\}/);
  return !!(m && /help/.test(m[1]));
}

/** Every declaration block whose selector LIST contains `sel`, comments
 *  stripped (a comment that NAMES min-height is not a min-height declaration).
 *  A rule may list several selectors, and the EFFECTIVE value can come from any
 *  of them — a later single-selector block (e.g. `.be-modal-cancel` skinning
 *  itself) must not hide the tier declared by the shared rule. */
function blocksOf(css, sel) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  const want = sel.replace(/\s+/g, " ").trim();
  const out = [];
  let m;
  while ((m = re.exec(clean)) !== null) {
    const sels = m[1]
      .split(",")
      .map((s) => s.trim().replace(/\s+/g, " "));
    if (sels.includes(want)) out.push(m[2]);
  }
  return out;
}

/** ALL declarations that apply to `sel`, concatenated (the effective value can
 *  come from any rule whose selector list contains it — a later group rule must
 *  not hide an earlier declaration). */
function blockOf(css, sel) {
  return blocksOf(css, sel).join("\n");
}

/** Assert the selector resolves to the tier height, and to no other height. */
function expectHeight(cssWhere, sel, px, label) {
  const blocks = blocksOf(cssWhere, sel);
  assert.ok(blocks.length, label + ": selector " + sel + " has a declaration block");
  const heights = blocks
    .map((b) => /(?:^|[;\s])height:\s*([0-9.]+)px/.exec(b))
    .filter(Boolean)
    .map((m) => parseFloat(m[1]));
  assert.ok(
    heights.includes(px),
    label + ": " + sel + " is a fixed " + px + "px (declared: " + JSON.stringify(heights) + ")",
  );
  assert.deepStrictEqual(
    [...new Set(heights.filter((h) => h !== px))],
    [],
    label + ": " + sel + " declares no competing height",
  );
}

describe("height tiers (AC-4)", function () {
  it("declares the four tiers + the row height + the compact control size", function () {
    assert.deepStrictEqual(TIERS, {
      action: 32,
      icon: 28,
      chip: 22,
      input: 32,
      row: 40,
      compactIcon: 22,
    });
  });

  it("T1 — every text/action button is a fixed 32px", function () {
    const t1 = [
      ".be-ctl-btn",
      ".be-ctl-btn.be-ctl-hero",
      // AC-3 (first_run_and_panel_20260911): ".be-ctl-contribute" was REMOVED from this list because
      // the control it measured no longer exists — its row left the panel for the action-icon menu,
      // and the CSS went with it. Kept here as a note rather than silently dropped: asserting a
      // height for a control the product no longer renders is a vacuous assertion, and this list is
      // the only place that recorded the control's tier.
      "#be-reset-all-filters",
      ".be-add-layer-btn",
      ".be-modal-actions button",
      ".be-modal-cancel",
      ".be-modal-ok",
      ".be-modal-button",
      ".be-more-options-button",
      ".be-section-actions button",
    ];
    for (const sel of t1) expectHeight(CSS, sel, 32, "T1");
  });

  it("T2 — every icon-only control is a fixed 28x28", function () {
    const block2 = (sel) => blockOf(CSS, sel);
    for (const sel of ["#be-ctl-collapse", ".be-layer-controls button", ".be-layer-panel-header button"]) {
      expectHeight(CSS, sel, 28, "T2");
      assert.match(block2(sel), /width:\s*28px/, "T2 " + sel + " is square");
    }
    // the modal close ✕ lives in print_styles.js
    expectHeight(PRINT_STYLES, ".be-modal-close", 28, "T2");
    assert.match(blockOf(PRINT_STYLES, ".be-modal-close"), /width:\s*28px/, "close ✕ is square");
  });

  it("T3 — chips and tag pills are a fixed 22px", function () {
    expectHeight(CSS, ".be-ctl-templates", 22, "T3");
    expectHeight(CSS, ".be-modal-tags button", 22, "T3");
    expectHeight(CSS, ".be-border-option button", 22, "T3");
  });

  it("T4 — inputs match the T1 row height", function () {
    expectHeight(CSS, '.be-modal input[type="search"]', 32, "T4");
    assert.ok(CSS.includes(".be-picker-search"), "the picker search field is covered by T4");
  });

  it("rows are list items: one fixed 40px row height (AC-5)", function () {
    expectHeight(CSS, ".be-layer-row", 40, "row");
    const row = blockOf(CSS, ".be-layer-row");
    assert.match(row, /height:\s*40px\s*!important/, "the row height is enforced");
  });

  it("tabs are not contained buttons: 32px with a bottom-border indicator", function () {
    expectHeight(CSS, ".be-modal-tabs button", 32, "tab");
    const tab = blockOf(CSS, ".be-modal-tabs button");
    assert.match(tab, /border-bottom:\s*2px solid transparent/, "inactive = border only");
    assert.match(tab, /background:\s*transparent/, "a tab is not a filled button");
  });

  it("the Print hero keeps ONLY the T1 height — not a taller tier", function () {
    const hero = blockOf(CSS, ".be-ctl-btn.be-ctl-hero");
    assert.match(hero, /height:\s*32px\s*!important/, "hero pulled 36px -> 32px");
    assert.ok(!/min-height:\s*3[3-9]px/.test(hero), "no taller hero");
    assert.match(hero, /background:.*!important/, "differentiated by the gold fill instead");
    assert.match(hero, /font-weight:\s*700/, "and by weight");
  });
});

describe("min-height prohibition (AC-4 / muse_review_2)", function () {
  const AUDITED = [
    ".be-ctl-btn",
    ".be-ctl-btn.be-ctl-hero",
    ".be-ctl-contribute",
    "#be-reset-all-filters",
    ".be-add-layer-btn",
    ".be-layer-row",
    ".be-layer-controls button",
    ".be-layer-panel-header button",
    "#be-ctl-collapse",
    ".be-ctl-templates",
    ".be-modal-actions button",
    ".be-modal-tags button",
    ".be-modal-tabs button",
    ".be-more-options-button",
    ".be-section-actions button",
  ];

  it("no audited clickable still relies on min-height", function () {
    const offenders = [];
    for (const sel of AUDITED) {
      const block = blockOf(CSS, sel);
      if (block && /min-height/.test(block)) offenders.push(sel);
    }
    assert.deepStrictEqual(offenders, [], "min-height silently grows with a wrapping label");
  });

  it("records the before-state: the audit measured nine distinct heights", function () {
    // The tier values must collapse that set — a regression to a taller hero or
    // a 30px modal action would show up as a tier mismatch in the phase-2
    // measurement, which fails on any outlier.
    const distinct = new Set(Object.values(TIERS));
    assert.deepStrictEqual([...distinct].sort((a, b) => a - b), [22, 28, 32, 40]);
    assert.ok(distinct.size <= 4, "nine measured heights collapse to four tiers");
  });
});

describe("wrap immunity (AC-5)", function () {
  it("every tiered label clips with an ellipsis instead of wrapping", function () {
    const label = blockOf(CSS, ".be-ctl-btn .be-ctl-label");
    assert.ok(label, "the panel label span has its own rule");
    assert.match(label, /min-width:\s*0/, "a flex item must be allowed to shrink");
    assert.match(label, /overflow:\s*hidden/);
    assert.match(label, /text-overflow:\s*ellipsis/);
    assert.match(label, /white-space:\s*nowrap/);
  });

  it("the layer row label is nowrap + ellipsis", function () {
    const row = blockOf(CSS, ".be-layer-row > span:first-child");
    assert.ok(row, "the row label span has its own rule");
    assert.match(row, /white-space:\s*nowrap/);
    assert.match(row, /text-overflow:\s*ellipsis/);
  });

  it("the tray buttons never wrap", function () {
    assert.match(blockOf(CSS, ".be-ctl-btn"), /white-space:\s*nowrap/);
    assert.match(blockOf(CSS, ".be-modal-actions button"), /white-space:\s*nowrap/);
  });

  it("O-2: the long label is shortened AND keeps its full text in the tooltip", function () {
    // AC-3 (first_run_and_panel_20260911) MOVED this case's other half: it used to also assert a
    // shortened "Feedback" tray label. "Feedback" and "Contribute" left the panel entirely, so those
    // assertions are RELOCATED to the case below rather than deleted — a test that silently shrinks
    // when the product changes is how a move becomes an unrecorded removal.
    assert.ok(CONTROLS.includes('resetAllBtn.textContent = "Reset Filters"'), "Reset Filters label");
    assert.ok(
      CONTROLS.includes('resetAllBtn.title = "Reset All Filters (excl. Hue)"'),
      "full text kept in the tooltip",
    );
    // every tray button carries its label as a tooltip
    assert.match(CONTROLS, /btn\.title = btnInfo\.title \|\| btnInfo\.label/);
  });

  it("AC-3: the panel carries no fundraising row, and both moved destinations are still reachable", function () {
    // The complaint AC-3 acts on, in one line: a tray labelled HELP held a bug-report link AND a
    // fundraising link, on equal footing. The measurement that scoped it is worth keeping — both
    // rows were already BELOW THE FOLD, so they never crowded the working surface and no user cost
    // was evidenced — so the fix is PLACEMENT, and the operator chose to move rather than keep.
    assert.ok(
      !CONTROLS.includes('label: "Feedback"'),
      "no Feedback row in the panel any more",
    );
    assert.ok(
      !CONTROLS.includes("be-ctl-contribute"),
      "no Contribute row in the panel any more",
    );
    assert.ok(
      !/label:\s*"Help"/.test(CONTROLS) && !trayDefsIncludesHelp(),
      "the HELP tray is gone with its last two rows (an empty header would be a worse artifact)",
    );

    // AC-3b/d: nothing was DELETED. Both destinations exist, in the action-icon menu where the
    // funding channels already live — so the move can be told apart from a removal.
    assert.match(BACKGROUND, /id: "feedback"/, "Feedback moved to the action-icon menu");
    assert.match(BACKGROUND, /id: "contribute"/, "Contribute moved to the action-icon menu");
    assert.match(
      BACKGROUND,
      /menuItemId === "feedback"/,
      "…and its click handler actually opens the bug tracker",
    );
    assert.match(
      BACKGROUND,
      /menuItemId === "contribute"/,
      "…and its handler opens the project page",
    );

    // AC-3c: the number of ASKS did not increase. Five destinations before (3 funding + feedback +
    // contribute), five after — asserted as a count rather than a claim.
    const menuIds = (BACKGROUND.match(/id:\s*"[a-z-]+",\s*\n\s*title:/g) || []).length;
    assert.strictEqual(menuIds, 5, `the action menu carries five entries, got ${menuIds}`);
  });
});

describe("panel viewport fit (the overflow fix)", function () {
  it("caps both panels to the viewport so nothing falls below the fold", function () {
    for (const sel of ["#print-enhance-controls", "#print-enhance-layer-manager"]) {
      const body = blocksOf(CSS, sel).join("\n");
      assert.match(
        body,
        /max-height:\s*calc\(100vh - 20px\)\s*!important/,
        sel + " is capped to the viewport",
      );
    }
    // the control panel hides its overflow and scrolls an inner body; the layer
    // panel scrolls itself
    assert.match(blocksOf(CSS, "#print-enhance-controls").join("\n"), /overflow:\s*hidden/);
    assert.match(blocksOf(CSS, "#print-enhance-layer-manager").join("\n"), /overflow-y:\s*auto/);
  });

  it("the control panel's scrollport can actually shrink (min-height: 0)", function () {
    const body = blocksOf(CSS, ".be-ctl-scroll").join("\n");
    assert.ok(body, "the scroll wrapper has styles");
    assert.match(body, /overflow-y:\s*auto/, "it is the scrollport");
    assert.match(body, /flex:\s*1 1 auto/);
    // a flex item defaults to min-height:auto, which refuses to shrink and would
    // make the panel overflow instead of scrolling
    assert.match(body, /min-height:\s*0/, "without this the scrollbar never appears");
    assert.match(body, /overscroll-behavior:\s*contain/, "scroll chaining is contained");
  });

  it("the scrollport is styled to the identity, not left as a default scrollbar", function () {
    const shared = blocksOf(CSS, ".be-layer-panel::-webkit-scrollbar-thumb").join("\n");
    assert.match(shared, /background:\s*#6B5A36/, "goldShadow thumb");
    assert.match(blocksOf(CSS, ".be-layer-panel").join("\n"), /scrollbar-width:\s*thin/);
  });

  it("keeps the panel header OUTSIDE the scroller", function () {
    const CONTROLS = fs.readFileSync(path.join(ROOT, "js", "controls.js"), "utf8");
    // the topbar is appended to the container, the bands/trays to the wrapper
    assert.match(CONTROLS, /container\.appendChild\(topbar\)/);
    assert.match(CONTROLS, /classList|className = "be-ctl-scroll"/, "the wrapper is built");
    for (const v of ["tray", "propsBand", "filterBand"]) {
      assert.match(
        CONTROLS,
        new RegExp(`scrollBody\\.appendChild\\(${v}\\)`),
        v + " scrolls with the body",
      );
      assert.ok(
        !new RegExp(`container\\.appendChild\\(${v}\\)`).test(CONTROLS),
        v + " is no longer a direct child of the panel",
      );
    }
  });

  it("the compressed states keep their own overflow rules", function () {
    // .be-layer-panel.minimized is more specific, so its overflow:hidden wins
    // from print_styles.js regardless of sheet order — the 32px state must not
    // grow a scrollbar
    const printStyles = fs.readFileSync(path.join(ROOT, "js", "print_styles.js"), "utf8");
    assert.match(printStyles, /\.be-layer-panel\.minimized\s*\{[^}]*overflow:\s*hidden/);
  });
});

describe("the rotation handle takes the T2 tier", function () {
  it("is a 28x28 border-box control with a re-derived stem", function () {
    expectHeight(PRINT_STYLES, ".be-rotation-handle", 28, "T2");
    const blocks = blocksOf(PRINT_STYLES, ".be-rotation-handle").join("\n");
    assert.match(blocks, /width:\s*28px/);
    assert.match(blocks, /box-sizing:\s*border-box/, "the 3px ring must not add to the size");
    const stem = blockOf(PRINT_STYLES, ".be-rotation-handle::after");
    assert.match(stem, /top:\s*26px/, "the stem still touches the smaller handle");
  });
});
