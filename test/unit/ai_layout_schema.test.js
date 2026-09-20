/**
 * Phase 1 of track byok_ai_layout_20260915 — the BYOK AI layout arranger's PURE core:
 * the layout-patch schema + validator (AC-1, AC-2), the provider adapters (AC-6) and
 * the prompt constructor (AC-1's enum + O-3's payload shape).
 *
 * WHY THIS SUITE IS HEADLESS ON PURPOSE
 * -------------------------------------
 * The plan's Phase 1 box is "no DOM, no chrome.*", and R1's GATE-2 finding said why: an
 * earlier gate said "a synthetic layout" without naming where its section ids came from,
 * so a test could have enumerated ids that are NOT the ones `scanLayout` produces and
 * passed anyway. So `liveSectionIds` is always passed IN here as a caller would pass the
 * ids it read from a live scan, and every rejection is asserted by ERROR CODE, not merely
 * by "it failed" — the shape that lets a reject-everything validator pass. Fixture G is
 * the must-pass control that closes the other half of that hole.
 *
 * WHAT EACH FIXTURE IS THE REJECTION OF (spec AC-1/AC-2, plan Phase 1 R2 list)
 * ---------------------------------------------------------------------------
 *   A an unknown section id          -> `section_id_unknown`
 *   B non-numeric / NaN / null geom  -> `geometry_value` / `geometry_shape`
 *   C out-of-range stacking order    -> `stack_order_value` / `stack_order_shape`
 *   D malformed envelope             -> `envelope_shape` / `envelope_key` / `envelope_empty`
 *   E non-JSON model output          -> `model_output_not_json` (incl. fenced, truncated)
 *   F derived-width re-injection     -> `derived_width`; and `derived_width_unchecked`
 *                                      when a patch writes a width but the caller passed no
 *                                      current record to compare it against (GATE-3 D2)
 *   G a well-formed patch            -> MUST be `ok: true`
 *
 * O-3 is asserted too: the context the model gets is `{id, title, left, top, width,
 * height, zIndex, minimized}` per section — the scan's GEOMETRY FIELDS ONLY, no content
 * text, no key material. (The `zIndex`/`minimized` pair is the operator's 2026-09-17
 * widening of the ratified `{id, title, x, y, w, h}` — see the SECTION_CONTEXT_KEYS header
 * in `js/ai_layout.js` for why, and Phase 5's privacy copy for what it costs.)
 */

"use strict";

const assert = require("assert");
const aiLayout = require("../../js/ai_layout.js");

const LIVE_IDS = ["section-ability", "section-spells", "section-equipment"];

/** One scan-shaped row: every field a real `scanLayout` record carries on a section. */
function scanRow(id, extra) {
  return Object.assign(
    {
      id,
      title: "Abilities & Adjustments",
      left: "200px",
      top: "40px",
      width: "400px",
      height: "600px",
      zIndex: 240,
      // A real record carries these two (js/layout_scan.js:233, :236) and the widened O-3
      // sends them; `compact`/`fontSize`/`borderStyle` are the record's OTHER neighbours
      // that must still not travel.
      minimized: false,
      compact: true,
      fontSize: "12px",
      borderStyle: "solid",
    },
    extra || {},
  );
}

function sectionTable(ids) {
  return (ids || LIVE_IDS).map((id) => scanRow(id));
}

/**
 * The caller's live `layout.sections` map, in the shape `scanLayout` writes it
 * (`js/layout_scan.js:227-239`). GATE-3's D2 made the record MANDATORY whenever a patch
 * writes a `width` — a guard a caller can silently skip is not a guard — so the ordinary
 * fixtures pass it. Deliberately WITHOUT populated `innerWidths`, so no derived candidate
 * trips fixture F unless a case adds one on purpose.
 */
function liveRecord(ids) {
  const out = {};
  for (const id of ids || LIVE_IDS) {
    out[id] = { left: 200, top: 40, width: 400, height: 600, zIndex: 240, innerWidths: {} };
  }
  return out;
}

/** The default options: a live record, exactly as Phase 4's flow will have one. */
const OPT = { current: liveRecord() };

/** The control patch: every field the schema allows, on ids that exist. */
function validPatch() {
  return {
    moves: {
      "section-ability": { left: 0, top: 0, width: 320, zIndex: 210, minimized: false },
      "section-spells": { left: 340, top: 0, width: 400, zIndex: 220, minimized: false },
    },
    hide: ["section-equipment"],
    note: "Combat column on the left, utility hidden.",
  };
}

/** Every code in a verdict, so a case can assert the EXACT code it owns. */
function codes(verdict) {
  return verdict.errors.map((e) => e.code);
}

// ---------------------------------------------------------------------------
// AC-1 — the schema vocabulary is ONE declaration, not prose in two places
// ---------------------------------------------------------------------------
describe("ai_layout — the patch schema (AC-1)", function () {
  it("names exactly the patch keys spec AC-1 declares, and NO others", function () {
    // GATE-3's D1: this draft added a `confirm` field and it was REMOVED. AC-1's envelope is
    // {moves, hide, note?}, and fixture D rejects an extra top-level key — a schema that
    // shipped one would contradict its own rejection rule. Destructiveness is refused where
    // it is real (the width floor below), and the rest is Phase 4's preview + undo.
    assert.deepStrictEqual(Object.keys(aiLayout.PATCH_KEYS), ["moves", "hide", "note"]);
    assert.deepStrictEqual(Object.keys(aiLayout.PATCH_SECTION_KEYS), [
      "left",
      "top",
      "width",
      "zIndex",
      "minimized",
    ]);
    assert.ok(Object.isFrozen(aiLayout.PATCH_KEYS), "the vocabulary is frozen");
    assert.ok(Object.isFrozen(aiLayout.PATCH_SECTION_KEYS), "the vocabulary is frozen");
  });

  it("speaks ONE geometry vocabulary in both directions (one source, no drift)", function () {
    // O-3 was WIDENED by the operator on 2026-09-17 to include zIndex + minimized, so EVERY
    // name the model may write is now a name it was SHOWN — that is the assertion. A rename
    // in PATCH_SECTION_KEYS that forgets SECTION_CONTEXT_KEYS fails here.
    assert.deepStrictEqual(aiLayout.SECTION_CONTEXT_KEYS, [
      "id",
      "title",
      "left",
      "top",
      "width",
      "height",
      "zIndex",
      "minimized",
    ]);
    const shown = aiLayout.SECTION_CONTEXT_KEYS.filter((k) => k !== "id" && k !== "title");
    for (const field of Object.keys(aiLayout.PATCH_SECTION_KEYS)) {
      assert.ok(shown.includes(field), "a writable field must be visible to the model: " + field);
    }
    // The widened pair is pinned positively: an operator answer that is silently reverted
    // (a dropped entry) must fail, not merely stop being asserted.
    for (const widened of ["zIndex", "minimized"]) {
      assert.ok(
        shown.includes(widened),
        `the 2026-09-17 O-3 widening must keep ${widened} in the prompt context`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// AC-2 — reject before anything could change; distinct code per class
// ---------------------------------------------------------------------------
describe("ai_layout.validatePatch — fixture G, the control that MUST pass", function () {
  it("accepts a well-formed patch over live ids", function () {
    const verdict = aiLayout.validatePatch(validPatch(), LIVE_IDS, OPT);
    assert.strictEqual(verdict.ok, true, JSON.stringify(verdict.errors));
    assert.deepStrictEqual(verdict.errors, []);
    assert.deepStrictEqual(verdict.advisories, [], "with a record, the derived guard has RUN");
  });

  it("accepts a patch that only hides, and one that only moves", function () {
    assert.strictEqual(aiLayout.validatePatch({ hide: ["section-spells"] }, LIVE_IDS).ok, true);
    assert.strictEqual(
      aiLayout.validatePatch({ moves: { "section-spells": { top: 80 } } }, LIVE_IDS).ok,
      true,
    );
  });

  it("accepts a width written as a string, as the record itself spells it", function () {
    // A model that echoes "300px" and a model that writes 300 must NOT diverge: this is
    // AC-3's byte-identical restore case (string vs number differs under JSON.stringify).
    const a = aiLayout.validatePatch(
      { moves: { "section-spells": { width: "300px" } } },
      LIVE_IDS,
      OPT,
    );
    const b = aiLayout.validatePatch(
      { moves: { "section-spells": { width: 300 } } },
      LIVE_IDS,
      OPT,
    );
    assert.strictEqual(a.ok, true);
    assert.strictEqual(b.ok, true);
    assert.strictEqual(
      JSON.stringify(aiLayout.summarizePatch(a.patch)),
      JSON.stringify(aiLayout.summarizePatch(b.patch)),
      "a normalised patch must be byte-identical regardless of the spelling it arrived in",
    );
  });
});

describe("ai_layout.validatePatch — fixture A: unknown section id", function () {
  it("rejects an id that is not on the live sheet, and names nothing else", function () {
    const verdict = aiLayout.validatePatch(
      { moves: { "section-not-here": { left: 0 } } },
      LIVE_IDS,
    );
    assert.strictEqual(verdict.ok, false);
    assert.deepStrictEqual(codes(verdict), ["section_id_unknown"]);
    assert.match(verdict.errors[0].path, /section-not-here/);
  });

  it("rejects an unknown id in `hide` too", function () {
    const verdict = aiLayout.validatePatch({ hide: ["section-ghost"] }, LIVE_IDS);
    assert.deepStrictEqual(codes(verdict), ["section_id_unknown"]);
  });

  it("does NOT reject an id that lives in the scan but only as an extractions/merges row", function () {
    // `liveSectionIds` is the CALLER's job: whatever the caller passes is the truth. This
    // case pins that the validator consults the list and nothing else (no hardcoded ids).
    assert.strictEqual(
      aiLayout.validatePatch({ moves: { "whatever-dndbeyond-named-this": { top: 0 } } }, [
        "whatever-dndbeyond-named-this",
      ]).ok,
      true,
    );
  });
});

describe("ai_layout.validatePatch — fixture B: non-numeric / NaN / null geometry", function () {
  const bad = [
    ["null", null, "geometry_value"],
    ["NaN", NaN, "geometry_value"],
    ["Infinity", Infinity, "geometry_value"],
    ["boolean", true, "geometry_shape"],
    ["object", {}, "geometry_shape"],
    ["empty string", "", "geometry_value"],
    ["nonsense string", "12px-ish", "geometry_value"],
    ["unitless non-number", "wide", "geometry_value"],
  ];
  for (const [label, value, code] of bad) {
    it(`rejects a ${label} left`, function () {
      const verdict = aiLayout.validatePatch(
        { moves: { "section-spells": { left: value } } },
        LIVE_IDS,
      );
      assert.strictEqual(verdict.ok, false);
      assert.ok(codes(verdict).includes(code), `${code} expected, got ${codes(verdict)}`);
    });
  }

  it("rejects a non-finite width and a negative geometry with geometry_value", function () {
    const v1 = aiLayout.validatePatch(
      { moves: { "section-spells": { width: -400 } } },
      LIVE_IDS,
      OPT,
    );
    assert.deepStrictEqual(codes(v1), ["geometry_value"]);
    const v2 = aiLayout.validatePatch({ moves: { "section-spells": { top: -1 } } }, LIVE_IDS);
    assert.deepStrictEqual(codes(v2), ["geometry_value"]);
  });

  it("rejects an unbounded width at the ceiling", function () {
    const verdict = aiLayout.validatePatch(
      { moves: { "section-spells": { width: 40001 } } },
      LIVE_IDS,
      OPT,
    );
    assert.deepStrictEqual(codes(verdict), ["geometry_value"]);
  });

  it("rejects a width below the floor the product's own resize path clamps to", function () {
    // GATE-3's D1 replacement for the `confirm` gate: a collapsed section is not a legal ask
    // needing consent. A user CANNOT produce it — js/main.js:2303 raises any `newWidth < 50`
    // to 48 — so 0/47 are malformed geometry, and the blanket "blank the sheet" patch dies
    // here with no extra field in AC-1's envelope.
    for (const width of [0, 1, 47]) {
      const verdict = aiLayout.validatePatch(
        { moves: { "section-ability": { width }, "section-spells": { width } } },
        LIVE_IDS,
        OPT,
      );
      assert.strictEqual(verdict.ok, false, "width " + width + " must be refused");
      assert.deepStrictEqual(codes(verdict), ["geometry_value", "geometry_value"]);
      assert.match(verdict.errors[0].message, /main\.js:2303|resize/);
    }
    // and the smallest legal width is exactly the clamp the handle can produce
    assert.strictEqual(
      aiLayout.validatePatch(
        { moves: { "section-ability": { width: 48 } } },
        LIVE_IDS,
        OPT,
      ).ok,
      true,
    );
  });

  it("rejects the fields the schema does not carry (height, top-level ids)", function () {
    const verdict = aiLayout.validatePatch(
      { moves: { "section-spells": { height: 200 } } },
      LIVE_IDS,
    );
    assert.deepStrictEqual(codes(verdict), ["geometry_shape"]);
    assert.match(verdict.errors[0].message, /height/);
  });
});

describe("ai_layout.validatePatch — fixture C: out-of-range stacking order", function () {
  const bad = [
    ["a negative zIndex", -1, "stack_order_value"],
    ["a non-integer zIndex", 12.5, "stack_order_value"],
    ["an overflow zIndex", 2147483648, "stack_order_value"],
    ["a NaN zIndex", NaN, "stack_order_value"],
    ["a boolean zIndex", false, "stack_order_shape"],
  ];
  for (const [label, value, code] of bad) {
    it(`rejects ${label}`, function () {
      const verdict = aiLayout.validatePatch(
        { moves: { "section-spells": { zIndex: value } } },
        LIVE_IDS,
      );
      assert.strictEqual(verdict.ok, false);
      assert.ok(codes(verdict).includes(code), `${code} expected, got ${codes(verdict)}`);
    });
  }

  it("accepts the whole real band the sheet itself uses, including both sentinels", function () {
    // 0, the SECTION_DEFAULT 10, the panel's 10000, the actions bar's 1000000, INT32_MAX:
    // a range that rejected any of these would refuse the layout the product already has.
    for (const z of [0, 10, 240, 10000, 1000000, 2147483647]) {
      assert.strictEqual(
        aiLayout.validatePatch({ moves: { "section-spells": { zIndex: z } } }, LIVE_IDS).ok,
        true,
        `zIndex ${z} must be acceptable`,
      );
    }
  });

  it("accepts a stacking order spelled with units, as the record spells it", function () {
    // js/layout_scan.js:233 stores `wrapper.style.zIndex || "10"` — the record's own
    // zIndex is OFTEN a string, so a model that copies it back must not be rejected.
    assert.strictEqual(
      aiLayout.validatePatch({ moves: { "section-spells": { zIndex: "240" } } }, LIVE_IDS).ok,
      true,
    );
  });

  it("rejects a non-boolean minimized", function () {
    const verdict = aiLayout.validatePatch(
      { moves: { "section-spells": { minimized: "true" } } },
      LIVE_IDS,
    );
    assert.deepStrictEqual(codes(verdict), ["minimized_shape"]);
  });
});

describe("ai_layout.validatePatch — fixture D: malformed envelope", function () {
  const cases = [
    ["null", null, "envelope_shape"],
    ["a string", "moves", "envelope_shape"],
    ["an array", [], "envelope_shape"],
    ["undefined", undefined, "envelope_shape"],
    ["a patch with neither moves nor hide", {}, "envelope_empty"],
    ["moves that is not a map", { moves: "section-spells" }, "envelope_shape"],
    ["moves that is an array", { moves: ["section-spells"] }, "envelope_shape"],
    ["hide that is not a list", { hide: "section-spells" }, "envelope_shape"],
    [
      "an entry that is not an object",
      { moves: { "section-spells": 7 } },
      "envelope_shape",
    ],
    ["an extra top-level key", { moves: {}, hide: [], order: [0] }, "envelope_key"],
    ["an extra per-section key", { moves: { "section-spells": { opacity: 0.5 } } }, "geometry_shape"],
    [
      "a duplicated id between moves and hide",
      { moves: { "section-spells": { top: 0 } }, hide: ["section-spells"] },
      "section_id_duplicated",
    ],
    [
      // GATE-3's D1: the consent field this draft added and then DELETED. It stays in the
      // reject list on purpose — a schema that ships {moves, hide, note?} must refuse a
      // `confirm`, or fixture D's own "extra top-level key" rule is a lie.
      "the consent field GATE-3 removed",
      { moves: { "section-spells": { top: 0 } }, confirm: true },
      "envelope_key",
    ],
  ];
  for (const [label, patch, code] of cases) {
    it(`rejects ${label} with ${code}`, function () {
      const verdict = aiLayout.validatePatch(patch, LIVE_IDS);
      assert.strictEqual(verdict.ok, false, label + " must not pass");
      assert.ok(codes(verdict).includes(code), `${code} expected, got ${codes(verdict)}`);
    });
  }

  it("accepts a move with NO hide and a hide with no moves (one section is legal)", function () {
    assert.strictEqual(aiLayout.validatePatch({ moves: { "section-spells": {} } }, LIVE_IDS).ok, true);
  });

  it("collects EVERY error rather than stopping at the first", function () {
    const verdict = aiLayout.validatePatch(
      {
        moves: {
          "section-nope": { left: 0 },
          "section-spells": { top: NaN, zIndex: -5 },
        },
        hide: ["also-nope"],
        order: [],
      },
      LIVE_IDS,
    );
    assert.strictEqual(verdict.ok, false);
    // 1 envelope_key (`order`) + 1 unknown move id + a NaN geometry + a bad stacking order
    // + 1 unknown hide id = FIVE. A validator that short-circuits on the first finding
    // cannot tell the user WHAT to fix, which is what this case protects.
    assert.strictEqual(verdict.errors.length, 5, JSON.stringify(verdict.errors));
    assert.deepStrictEqual(
      codes(verdict).sort(),
      [
        "envelope_key",
        "geometry_value",
        "section_id_unknown",
        "section_id_unknown",
        "stack_order_value",
      ],
    );
  });
});

describe("ai_layout.validatePatch — fixture F: derived-width re-injection", function () {
  // Why this fixture exists (plan Phase 0's `innerWidths` warning): `innerWidths` is
  // written by five modules (layout_scan, layout_apply, undo, main, print_styles), and the
  // 1.17.3 responsive fit recorded a DERIVED width into the user's record — measured as
  // `innerWidths["0-0"]` going "110.469%" -> "110.392%" — so an undo restored something the
  // user never had. `width` is the only derived field AC-1's schema exposes, so the derived
  // candidate is reconstructed from the section's OWN record.
  function recordFor(id, extra) {
    return Object.assign(
      { left: 200, top: 40, width: 400, zIndex: 240, innerWidths: { "0-0": "110.5%", "1-0": "442px" } },
      extra || {},
    );
  }

  it("rejects a width that re-injects the record's derived value", function () {
    // 110.5% of 400px = 442px, and "442px" is also spelled in the record: either way the
    // number is the scaling's, not the user's.
    const verdict = aiLayout.validatePatch(
      { moves: { "section-ability": { width: 442 } } },
      LIVE_IDS,
      { current: { "section-ability": recordFor("section-ability") } },
    );
    assert.strictEqual(verdict.ok, false);
    assert.deepStrictEqual(codes(verdict), ["derived_width"]);
    assert.match(verdict.errors[0].message, /derived/);
  });

  it("rejects a percentage / viewport / calc spelling outright", function () {
    for (const width of ["110.469%", "100vw", "calc(100% - 20px)"]) {
      const verdict = aiLayout.validatePatch(
        { moves: { "section-ability": { width } } },
        LIVE_IDS,
        { current: { "section-ability": recordFor("section-ability") } },
      );
      assert.deepStrictEqual(codes(verdict), ["derived_width"], "rejected: " + width);
    }
  });

  it("rejects a fractional pixel — the resize handle can only write integers", function () {
    // js/main.js:2294-2305 snaps to multiples of 16 and clamps at integer px, so a
    // fractional width is the scaling's arithmetic, never a user choice.
    for (const width of [442.5, "442.5px"]) {
      const verdict = aiLayout.validatePatch(
        { moves: { "section-ability": { width } } },
        LIVE_IDS,
        { current: {} },
      );
      assert.deepStrictEqual(codes(verdict), ["derived_width"], "rejected: " + width);
    }
  });

  it("accepts the user's own current width and an unrelated one", function () {
    for (const width of [400, 500, 512]) {
      const verdict = aiLayout.validatePatch(
        { moves: { "section-ability": { width } } },
        LIVE_IDS,
        { current: { "section-ability": recordFor("section-ability") } },
      );
      assert.strictEqual(verdict.ok, true, `width ${width} is not the derived value`);
    }
  });

  it("REFUSES a width outright when the caller passes no record to check it against", function () {
    // GATE-3's D2, and the half of fixture F that used to be advisory: the guard exists to
    // stop a derived width being persisted, and an advisory stops nothing. A patch that
    // writes a `width` MUST be checked against the live record. Width-free patches are
    // unaffected, so the requirement cannot be dodged by simply not passing the record.
    const verdict = aiLayout.validatePatch(
      { moves: { "section-ability": { width: 442 } } },
      LIVE_IDS,
    );
    assert.strictEqual(verdict.ok, false, "an unchecked width is not a pass");
    assert.deepStrictEqual(codes(verdict), ["derived_width_unchecked"]);
    assert.strictEqual(verdict.checks.derivedWidth, false);

    // the same call WITH the record runs the check for real and CATCHES the value
    const checked = aiLayout.validatePatch(
      { moves: { "section-ability": { width: 442 } } },
      LIVE_IDS,
      { current: { "section-ability": recordFor("section-ability") } },
    );
    assert.strictEqual(checked.ok, false);
    assert.deepStrictEqual(codes(checked), ["derived_width"]);

    // a patch that touches no width needs nothing, and says so as an ADVISORY
    const noWidth = aiLayout.validatePatch({ moves: { "section-ability": { top: 20 } } }, LIVE_IDS);
    assert.strictEqual(noWidth.ok, true);
    assert.deepStrictEqual(noWidth.advisories.map((a) => a.code), ["derived_width_unchecked"]);
  });

  it("flags every section that re-injects, not just the first", function () {
    const verdict = aiLayout.validatePatch(
      { moves: { "section-ability": { width: 442 }, "section-spells": { width: 442 } } },
      LIVE_IDS,
      {
        current: {
          "section-ability": recordFor("section-ability"),
          "section-spells": recordFor("section-spells"),
        },
      },
    );
    assert.deepStrictEqual(codes(verdict), ["derived_width", "derived_width"]);
  });
});

// ---------------------------------------------------------------------------
// The no-throw contract: a verdict, never an exception
// ---------------------------------------------------------------------------
describe("ai_layout.validatePatch — the no-throw contract", function () {
  const hostile = [
    undefined,
    null,
    0,
    true,
    false,
    "",
    "moves",
    [],
    ["a"],
    {},
    { moves: null },
    { moves: {} },
    { hide: null },
    { hide: [null, 7, {}] },
    { note: 42 },
    { confirm: true },
    { __proto__: { poisoned: true } },
    JSON.parse('{"moves": {"__proto__": {"x": 1}}, "hide": ["__proto__"]}'),
    new Date(),
    () => 0,
    Symbol.iterator,
    [{ toString: null }],
    aiLayout,
    global,
  ];
  for (const value of hostile) {
    const label = (() => {
      try {
        return typeof value === "symbol" ? String(value) : JSON.stringify(value) ?? String(value);
      } catch {
        return String(value);
      }
    })();
    it(`returns a verdict instead of throwing for ${label.slice(0, 60)}`, function () {
      const verdict = aiLayout.validatePatch(value, LIVE_IDS);
      assert.strictEqual(typeof verdict, "object");
      assert.strictEqual(typeof verdict.ok, "boolean");
      assert.ok(Array.isArray(verdict.errors));
      assert.ok(Array.isArray(verdict.advisories));
      for (const err of verdict.errors.concat(verdict.advisories)) {
        assert.strictEqual(typeof err.code, "string", "every finding carries a code");
        assert.strictEqual(typeof err.path, "string", "every finding carries a path");
        assert.strictEqual(typeof err.message, "string");
      }
    });
  }

  it("never throws on a malformed liveSectionIds either", function () {
    for (const ids of [undefined, null, "section-spells", 7, [null, 1, "ok"]]) {
      const verdict = aiLayout.validatePatch({ moves: { "section-spells": { top: 0 } } }, ids);
      assert.strictEqual(typeof verdict.ok, "boolean");
    }
  });

  it("reports an empty live-id list rather than silently rejecting everything", function () {
    // This is the shape that would otherwise be indistinguishable from a correct
    // validator: a live scan that produced no ids (wrong page state, or a spec that
    // passed [] by mistake) must say WHY every id is unknown.
    const verdict = aiLayout.validatePatch(validPatch(), []);
    assert.strictEqual(verdict.ok, false);
    assert.ok(codes(verdict).includes("live_ids_empty"), codes(verdict).join(","));
  });

  it("does not mutate the patch it was handed", function () {
    const patch = validPatch();
    const frozenCopy = JSON.parse(JSON.stringify(patch));
    const verdict = aiLayout.validatePatch(patch, LIVE_IDS, OPT);
    assert.strictEqual(verdict.ok, true);
    assert.deepStrictEqual(patch, frozenCopy, "the input object is untouched");
    assert.ok(Object.isFrozen(verdict.patch), "the verdict's normalised patch is frozen");
    assert.notStrictEqual(verdict.patch, patch, "and it is a COPY, not the caller's object");
  });

  it("normalises geometry and stacking order to numbers, and never carries an unknown field", function () {
    const verdict = aiLayout.validatePatch(
      {
        moves: {
          "section-spells": {
            width: "300px",
            left: "  40px  ",
            top: 12.0,
            zIndex: "240",
            minimized: true,
          },
        },
        hide: ["section-ability"],
        note: "x",
      },
      LIVE_IDS,
      OPT,
    );
    assert.strictEqual(verdict.ok, true, JSON.stringify(verdict.errors));
    assert.deepStrictEqual(Object.keys(verdict.patch).sort(), ["hide", "moves", "note"]);
    assert.deepStrictEqual(verdict.patch.moves["section-spells"], {
      width: 300,
      left: 40,
      top: 12,
      zIndex: 240,
      minimized: true,
    });
    assert.deepStrictEqual(verdict.patch.hide, ["section-ability"]);
    assert.ok(Object.isFrozen(verdict.patch), "the normalised patch is frozen");
  });
});

// ---------------------------------------------------------------------------
// AC-1's enum + O-3's payload — the prompt constructor
// ---------------------------------------------------------------------------
describe("ai_layout.buildMessages — the live-id enum and O-3's payload", function () {
  const instruction = "group my combat stuff top-left in two tidy columns";

  it("builds system + user messages, both strings", function () {
    const messages = aiLayout.buildMessages(sectionTable(), instruction);
    assert.deepStrictEqual(
      messages.map((m) => m.role),
      ["system", "user"],
    );
    for (const m of messages) assert.strictEqual(typeof m.content, "string");
  });

  it("contains EVERY id of the scan and NO id that is not in it", function () {
    const rows = sectionTable(["a-live", "b-live", "c-live"]);
    const serialized = JSON.stringify(aiLayout.buildMessages(rows, instruction));
    for (const id of ["a-live", "b-live", "c-live"]) {
      assert.ok(serialized.includes(id), "every live id must be in the enum: " + id);
    }
    assert.ok(!serialized.includes("section-ability"), "no id that is not in the scan may appear");
    assert.ok(!serialized.includes("inventory"), "no hardcoded example id may appear");
  });

  it("sends geometry + the heading only — never a section's content text", function () {
    const rows = sectionTable();
    // A hostile-ish row: content-bearing keys a sloppy "spread the record" would carry.
    rows[0].innerHTML = "<p>Secret of the Steel Fang</p>";
    rows[0].content = "MORE CONTENT";
    rows[0].statBlock = { damage: "2d8+3" };
    rows[0].className = "ddbc-thing";
    const messages = aiLayout.buildMessages(rows, instruction);
    // Assert on the system message's PAYLOAD, read back as data. The serialized form of the
    // whole messages array escapes the inner quotes, so string-grepping it for `"title"`
    // would fail on a correct payload — and a test that passes on shape instead of content
    // is the vacuity class this gate exists to kill.
    const system = messages[0].content;
    const marker = aiLayout.SECTION_TABLE_MARKER;
    assert.ok(system.includes(marker), "the payload is delimited by a declared marker");
    const payload = JSON.parse(system.slice(system.indexOf(marker) + marker.length).trim());
    assert.ok(Array.isArray(payload) && payload.length === 3, "one row per section");
    assert.deepStrictEqual(Object.keys(payload[0]), [
      "id",
      "title",
      "left",
      "top",
      "width",
      "height",
      "zIndex",
      "minimized",
    ]);
    assert.strictEqual(payload[0].title, "Abilities & Adjustments", "the heading IS sent (O-3)");
    // The 2026-09-17 widening: stacking order and the minimized flag travel as SCALARS.
    assert.strictEqual(payload[0].zIndex, 240, "the model sees its current stacking order");
    assert.strictEqual(payload[0].minimized, false, "the model sees whether a section is tucked");
    for (const leak of ["innerHTML", "content", "statBlock", "className", "innerWidths", "printZIndex", "compact", "fontSize", "noAutoScale", "borderStyle"]) {
      assert.ok(!(leak in payload[0]), "the record key must not travel: " + leak);
    }
    const serialized = JSON.stringify(messages);
    for (const text of ["Secret of the Steel Fang", "MORE CONTENT", "2d8+3", "ddbc-thing"]) {
      assert.ok(!serialized.includes(text), "content text must not travel: " + text);
    }
  });

  it("states the allowed field names and the enum in the system message", function () {
    const system = aiLayout.buildMessages(sectionTable(), instruction)[0].content;
    for (const field of ["left", "top", "width", "zIndex", "minimized"]) {
      assert.ok(system.includes(field), "the schema is declared to the model: " + field);
    }
    assert.ok(system.includes("moves") && system.includes("hide"));
    assert.ok(/section-ability/.test(system), "the enum is in the system contract");
  });

  it("states the width floor instead of a consent flag", function () {
    // GATE-3 D1: the model is told the floor it must respect rather than offered a field that
    // unlocks destruction.
    const system = aiLayout.buildMessages(sectionTable(), instruction)[0].content;
    assert.ok(system.includes(String(aiLayout.MIN_WIDTH_PX)), "the floor is in the contract");
    assert.ok(!/confirm/.test(system), "no consent field is advertised to the model");
  });

  it("refuses a table row whose id is not in liveSectionIds (AC-1's enum is enforced here too)", function () {
    const table = sectionTable(["a-live"]);
    table.push(scanRow("section-injected"));
    assert.throws(
      () => aiLayout.buildMessages(table, instruction, { liveSectionIds: ["a-live"] }),
      (err) => err.code === "section_id_absent",
    );
    // and the ordinary path: the table IS the live scan, so it must not need the option
    assert.doesNotThrow(() => aiLayout.buildMessages(sectionTable(), instruction));
  });

  it("refuses an instruction carrying a credential instead of shipping it (AC-4)", function () {
    assert.throws(
      () => aiLayout.buildMessages(sectionTable(), "use key sk-abc123DEF456ghi789JKL012"),
      (err) => err.code === "instruction_contains_credential",
    );
    assert.throws(
      () => aiLayout.buildMessages(sectionTable(), "pat_01100AAAABBBBCCCCDDDD"),
      (err) => err.code === "instruction_contains_credential",
    );
  });

  it("caps the instruction length (the token budget is O-3's whole point)", function () {
    assert.throws(
      () => aiLayout.buildMessages(sectionTable(), "x".repeat(aiLayout.MAX_INSTRUCTION_CHARS + 1)),
      (err) => err.code === "instruction_too_long",
    );
  });
});

// ---------------------------------------------------------------------------
// AC-6 — provider adapters, pure, with typed errors
// ---------------------------------------------------------------------------
describe("ai_layout.buildRequest — OpenAI adapter", function () {
  const cfg = {
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: "sk-test-key-123456",
    messages: [{ role: "user", content: "hi" }],
    maxTokens: 512,
  };

  it("builds url + Authorization header + body", function () {
    const req = aiLayout.buildRequest(cfg);
    assert.strictEqual(req.url, "https://api.openai.com/v1/chat/completions");
    assert.strictEqual(req.headers.Authorization, "Bearer sk-test-key-123456");
    assert.deepStrictEqual(Object.keys(req.headers).sort(), ["Authorization", "Content-Type"]);
    assert.strictEqual(req.headers["Content-Type"], "application/json");
    assert.strictEqual(req.body.model, "gpt-4o-mini");
    assert.strictEqual(req.body.max_tokens, 512);
    assert.deepStrictEqual(req.body.messages, cfg.messages);
    assert.strictEqual(req.body.response_format.type, "json_object");
    assert.strictEqual(req.method, "post", "the method travels with the request");
  });

  it("never puts the key in the body or the url", function () {
    const req = aiLayout.buildRequest(cfg);
    assert.ok(!JSON.stringify(req.body).includes("sk-test-key-123456"));
    assert.ok(!req.url.includes("sk-test-key-123456"));
  });

  it("applies the default token budget when none is given", function () {
    const req = aiLayout.buildRequest({ ...cfg, maxTokens: undefined });
    assert.strictEqual(req.body.max_tokens, aiLayout.DEFAULT_MAX_TOKENS);
  });

  it("routes an operator-approved compatible base URL, and refuses anything else", function () {
    const allowed = {
      ...cfg,
      baseUrl: "https://openrouter.ai/api/v1",
      allowedBaseOrigins: ["https://openrouter.ai"],
    };
    assert.strictEqual(
      aiLayout.buildRequest(allowed).url,
      "https://openrouter.ai/api/v1/chat/completions",
    );
    // Free-form base URL is the arbitrary-URL relay wearing a different hat (O-1's
    // accepted consequence), so no allow-list = no override, ever.
    assert.throws(
      () => aiLayout.buildRequest({ ...cfg, baseUrl: "https://evil.example/" }),
      (err) => err.code === "base_url_not_allowed",
    );
    assert.throws(
      () => aiLayout.buildRequest({ ...allowed, allowedBaseOrigins: ["https://api.openai.com"] }),
      (err) => err.code === "base_url_not_allowed",
    );
    for (const evil of [
      "javascript:alert(1)",
      "data:text/plain,x",
      "file:///C:/windows/win.ini",
      "https://user:pass@evil.example",
    ]) {
      assert.throws(
        () =>
          aiLayout.buildRequest({
            ...cfg,
            baseUrl: evil + "/v1",
            allowedBaseOrigins: [evil],
          }),
        (err) => err.code === "base_url_not_allowed",
        "refused: " + evil,
      );
    }
  });

  it("refuses a missing key / model / unknown provider with distinct codes", function () {
    assert.throws(() => aiLayout.buildRequest({ ...cfg, apiKey: "" }), (e) => e.code === "api_key_required");
    assert.throws(() => aiLayout.buildRequest({ ...cfg, model: "  " }), (e) => e.code === "model_required");
    assert.throws(() => aiLayout.buildRequest({ ...cfg, provider: "gemini" }), (e) => e.code === "unknown_provider");
  });
});

describe("ai_layout.buildRequest — Anthropic adapter", function () {
  const cfg = {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    apiKey: "sk-ant-test123",
    messages: [
      { role: "system", content: "be terse" },
      { role: "user", content: "hi" },
    ],
    maxTokens: 256,
  };

  it("lifts the system message out of `messages` and sets the version header", function () {
    const req = aiLayout.buildRequest(cfg);
    assert.strictEqual(req.url, "https://api.anthropic.com/v1/messages");
    assert.strictEqual(req.headers["x-api-key"], "sk-ant-test123");
    assert.strictEqual(req.headers["anthropic-version"], aiLayout.ANTHROPIC_VERSION);
    assert.strictEqual(req.headers["Content-Type"], "application/json");
    assert.strictEqual(req.body.system, "be terse");
    assert.deepStrictEqual(req.body.messages, [{ role: "user", content: "hi" }]);
    assert.strictEqual(req.body.max_tokens, 256);
    assert.ok(!("response_format" in req.body), "no OpenAI-only field leaks into this body");
  });

  it("never puts the key in the body", function () {
    assert.ok(!JSON.stringify(aiLayout.buildRequest(cfg).body).includes("sk-ant-test123"));
  });
});

describe("ai_layout.parseResponse — typed errors, each distinct", function () {
  const providerCases = [
    ["openai", { status: 401, body: { error: { message: "Incorrect API key provided" } } }, "auth"],
    ["openai", { status: 403, body: { error: { message: "quota" } } }, "auth"],
    ["openai", { status: 429, body: { error: { message: "rate limit" } } }, "rate_limit"],
    ["anthropic", { status: 401, body: { error: { type: "authentication_error" } } }, "auth"],
    ["anthropic", { status: 429, body: { error: { type: "rate_limit_error" } } }, "rate_limit"],
  ];
  for (const [provider, response, errorClass] of providerCases) {
    it(`${provider} ${response.status} maps to ${errorClass}`, function () {
      const verdict = aiLayout.parseResponse(provider, response);
      assert.strictEqual(verdict.ok, false);
      assert.strictEqual(verdict.errorClass, errorClass);
      assert.strictEqual(verdict.text, undefined, "a failure carries no text");
    });
  }

  it("keeps the provider's human message, redacting what looks like a key", function () {
    const verdict = aiLayout.parseResponse("openai", {
      status: 400,
      body: { error: { message: "Invalid model 'gpt-x' for key sk-SECRET1234567890ABCD" } },
    });
    assert.strictEqual(verdict.ok, false);
    assert.strictEqual(verdict.errorClass, "malformed");
    assert.ok(verdict.message.includes("Invalid model"));
    assert.ok(!verdict.message.includes("sk-SECRET1234567890ABCD"), "the echo is redacted");
  });

  it("carries the retry hint a 429 sends", function () {
    const verdict = aiLayout.parseResponse("openai", {
      status: 429,
      headers: { "retry-after": "17" },
      body: { error: { message: "slow down" } },
    });
    assert.strictEqual(verdict.errorClass, "rate_limit");
    assert.strictEqual(verdict.retryAfterSeconds, 17);
  });

  it("maps a 5xx to a distinct class from a 4xx (the user's fix differs)", function () {
    const verdict = aiLayout.parseResponse("anthropic", { status: 529, body: "overloaded" });
    assert.strictEqual(verdict.ok, false);
    assert.strictEqual(verdict.errorClass, "provider_unavailable");
  });

  it("maps an ABORT (timeout / user cancel) to its own class, not to offline", function () {
    for (const err of [
      Object.assign(new Error("signal aborted"), { name: "AbortError" }),
      Object.assign(new Error("This operation was aborted"), { name: "DOMException" }),
    ]) {
      const verdict = aiLayout.parseResponse("openai", err);
      assert.strictEqual(verdict.errorClass, "aborted");
      assert.ok(!verdict.retryable === false || verdict.retryable === true);
    }
  });

  it("maps a transport failure to `network`, and an unknown throw to an honest error", function () {
    assert.strictEqual(
      aiLayout.parseResponse("openai", Object.assign(new Error("Failed to fetch"), { name: "TypeError" }))
        .errorClass,
      "network",
    );
    const verdict = aiLayout.parseResponse("openai", new Error("the floor is lava"));
    assert.strictEqual(verdict.ok, false);
    assert.strictEqual(verdict.errorClass, "unknown");
    assert.ok(verdict.message.length > 0, "never a blank failure");
  });

  it("extracts the assistant text from each provider's shape", function () {
    const ok = aiLayout.parseResponse("openai", {
      status: 200,
      body: { choices: [{ message: { content: '{"moves":{}}' } }] },
    });
    assert.strictEqual(ok.ok, true);
    assert.strictEqual(ok.text, '{"moves":{}}');
    assert.strictEqual(ok.errorClass, null, "a success names no error class");
    assert.strictEqual(
      aiLayout.parseResponse("anthropic", {
        status: 200,
        body: { content: [{ type: "thinking", thinking: "hmm" }, { type: "text", text: "done" }] },
      }).text,
      "done",
      "only the text blocks, in order",
    );
  });

  it("classifies a 200 that carries no text as malformed rather than throwing", function () {
    for (const body of [
      {},
      { choices: [] },
      { choices: [{ message: {} }] },
      { content: [] },
      "not an object",
      null,
    ]) {
      const verdict = aiLayout.parseResponse("openai", { status: 200, body });
      assert.strictEqual(verdict.ok, false, "malformed 200 body: " + JSON.stringify(body));
      assert.strictEqual(verdict.errorClass, "malformed");
    }
  });

  it("is the single JSON-decode site: parses a string body, and calls un-parseable text model_output_not_json", function () {
    assert.strictEqual(
      aiLayout.parseResponse("openai", {
        status: 200,
        body: JSON.stringify({ choices: [{ message: { content: '{"hide":[]}' } }] }),
      }).text,
      '{"hide":[]}',
    );
    // The text a provider answered with is AC-2's next input, and it goes through
    // `parseModelOutput`: there is no second, ungated JSON.parse anywhere (Phase 0 counted
    // 3 `.json()` sites in js/, all of them `response.json()`).
    const verdict = aiLayout.parseModelOutput("{not json", LIVE_IDS);
    assert.strictEqual(verdict.ok, false);
    assert.strictEqual(verdict.code, "model_output_not_json");
  });

  it("never throws, whatever it is handed", function () {
    for (const input of [
      undefined,
      null,
      0,
      "",
      [],
      {},
      { status: "200", body: undefined },
      { status: 200, body: "{" },
      Object.assign(new Error("boom"), { name: 7 }),
    ]) {
      const verdict = aiLayout.parseResponse("openai", input);
      assert.strictEqual(typeof verdict.ok, "boolean");
      assert.strictEqual(typeof verdict.errorClass, "string");
    }
    assert.strictEqual(aiLayout.parseResponse("nope", {}).errorClass, "unknown_provider");
  });
});

// ---------------------------------------------------------------------------
// fixture E — non-JSON model output (and AC-2's confirm gate)
// ---------------------------------------------------------------------------
describe("ai_layout.parseModelOutput — fixture E and AC-2's gate", function () {
  const outputs = [
    ["plain prose", "I would move your combat section to the top left."],
    ["truncated JSON", '{"moves": {"section-ability": {"lef'],
    ["fenced json block", '```json\n{"moves":{"section-ability":{"top":0}}}\n```'],
    ["bare fence", '```\n{"moves":{}}\n```'],
    ["prose wrapped around JSON", 'Sure! {"moves":{"section-ability":{"top":0}}} — done.'],
    ["leading newline + prose", '\n\n{"moves": {"oops"},'],
  ];
  for (const [label, text] of outputs) {
    it(`rejects ${label} with model_output_not_json`, function () {
      const verdict = aiLayout.parseModelOutput(text, LIVE_IDS);
      assert.strictEqual(verdict.ok, false, label + " must not pass");
      assert.strictEqual(verdict.code, "model_output_not_json");
      assert.ok(codes(verdict).includes("model_output_not_json"));
    });
  }

  it("refuses a fence rather than unwrapping it — the contract is JSON and nothing else", function () {
    // Unwrapping "Sure! {...} — done" is how a partial answer becomes a partial apply. A
    // refusal costs one retry; a guess costs the user their layout.
    const verdict = aiLayout.parseModelOutput(
      '```json\n{"moves":{"section-ability":{"top":0}},"hide":[]}\n```',
      LIVE_IDS,
    );
    assert.strictEqual(verdict.ok, false);
    assert.strictEqual(verdict.code, "model_output_not_json");
  });

  it("accepts the JSON object itself and validates it against the live enum", function () {
    const verdict = aiLayout.parseModelOutput(
      '{"moves":{"section-ability":{"top":0}},"hide":[]}',
      LIVE_IDS,
    );
    assert.strictEqual(verdict.ok, true, JSON.stringify(verdict.errors));
    assert.strictEqual(verdict.patch.moves["section-ability"].top, 0);
  });

  it("forwards the current record so the derived guard can run", function () {
    const verdict = aiLayout.parseModelOutput(
      '{"moves":{"section-ability":{"width":442}}}',
      LIVE_IDS,
      {
        current: {
          "section-ability": { left: 200, width: 400, innerWidths: { "0-0": "110.5%" } },
        },
      },
    );
    assert.strictEqual(verdict.ok, false);
    assert.deepStrictEqual(codes(verdict), ["derived_width"]);
  });

  it("runs the envelope AND the enum on parsed output", function () {
    const verdict = aiLayout.parseModelOutput('{"moves":{"nope-not-live":{"top":0}}}', LIVE_IDS);
    assert.strictEqual(verdict.ok, false);
    assert.deepStrictEqual(codes(verdict), ["section_id_unknown"]);
  });

  it("cannot express a blank-the-sheet patch at all now (GATE-3 D1's replacement)", function () {
    // Every section the patch would collapse fails the width floor, so there is nothing left
    // for a `confirm` flag to unlock — and with no record passed, the unchecked-width guard
    // fires first. Either way: refused, no consent state in the schema.
    const verdict = aiLayout.parseModelOutput(
      '{"moves":{"section-spells":{"width":0},"section-ability":{"width":0}},"hide":[]}',
      LIVE_IDS,
    );
    assert.strictEqual(verdict.ok, false);
    assert.ok(codes(verdict).length > 0);
  });

  it("leaves a hide-all to Phase 4's preview, NOT to the validator", function () {
    // AC-2 governs MALFORMED input. Hiding every section the user asked to hide is a legal,
    // reversible ask — `pushUndo` and the preview diff are where the user says no. This case
    // pins that boundary deliberately, so a later phase cannot quietly graft semantic policy
    // onto a schema check and call it validation.
    const verdict = aiLayout.parseModelOutput(
      `{"moves":{},"hide":[${LIVE_IDS.map((id) => JSON.stringify(id)).join(",")}]}`,
      LIVE_IDS,
    );
    assert.strictEqual(verdict.ok, true, JSON.stringify(verdict.errors));
  });

  it("does NOT reject a patch that leaves plenty of surface alone", function () {
    assert.strictEqual(
      aiLayout.parseModelOutput(
        '{"moves":{"section-spells":{"top":10}},"hide":["section-ability"]}',
        LIVE_IDS,
      ).ok,
      true,
    );
  });

  it("never throws for hostile text", function () {
    for (const text of [undefined, null, 0, "", "[]", "{}", JSON.stringify({ moves: 1 })]) {
      const verdict = aiLayout.parseModelOutput(text, LIVE_IDS);
      assert.strictEqual(typeof verdict.ok, "boolean");
    }
  });
});

describe("ai_layout — module surface discipline (AC-7, spec L-6)", function () {
  const raw = require("fs").readFileSync(require.resolve("../../js/ai_layout.js"), "utf8");
  // THE PROSE NAMES THE THINGS THE CODE FORBIDS ("nothing here touches ... `chrome.*`"),
  // so a word-match over the whole file reads red on a comment — the exact false-positive
  // class spec L-6 re-pinned for `.headers` ("a Phase 3 probe built on the loose form would
  // read red on comments and get 'fixed' by loosening it further"). Assert on the CODE.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("declares no chrome.* and no DOM access anywhere (the pure-core boundary)", function () {
    assert.strictEqual(/\bchrome\s*\./.test(src), false, "no chrome.* in Phase 1");
    for (const seam of ["document.", "window.getComputedStyle", "querySelector", "localStorage", "indexedDB"]) {
      assert.ok(!src.includes(seam), "no DOM/host seam: " + seam);
    }
  });

  it("contains no real credential material and logs through safeLog only", function () {
    assert.strictEqual(/\bsk-[A-Za-z0-9_-]{16,}/.test(src), false, "no key-shaped literal");
    assert.strictEqual(/console\.(log|warn|error)/.test(src), false, "no console sink");
    if (src.includes("safeLog(")) {
      assert.ok(/window\.safeLog\??\.\(/.test(src), "any log goes through the window seam, lazily");
    }
  });

  it("never JSON.stringifies the credential into a body or a log line", function () {
    // AC-4's sink rule, asserted structurally: every place apiKey appears, it lands in a
    // header value — never in an object that gets serialized.
    for (const line of src.split(/\r?\n/)) {
      if (!/apiKey/.test(line) || /^\s*(\*|\/\/)/.test(line)) continue;
      assert.ok(
        /headers|\[REDACTED\]|\.code|config\.apiKey\b|api_key_required|redact/.test(line),
        "suspicious apiKey line: " + line.trim(),
      );
    }
  });

  it("publishes exactly ONE window seam, and only because Phase 4 gave it a product caller", function () {
    // THE HISTORY THIS CASE PINS. Phase 1 shipped NO `window.*` at all: the re-rot guard
    // (`scripts/check_dead_exports.js`) fails a seam with no caller in `js/`, and there was
    // none — the fleet has deleted two write-it-now seams for exactly that reason
    // (`__refreshUndoControl`, `UNDO_LABEL_MAX`). Phase 4 of this track added `js/ai_arrange.js`,
    // which is a real product reader, and the seam arrived in the same change.
    //
    // So the assertion is now about the SHAPE of that publication rather than its absence, and
    // both halves still bite: the code assigns `window.AiLayout` ONCE, with no other seam
    // smuggled in beside it, and it is the module object — not a hand-listed subset that could
    // drift from `module.exports`.
    const assignments = src.match(/^\s*window\.[A-Za-z_$][\w$]*\s*=/gm) || [];
    assert.deepStrictEqual(
      assignments.map((s) => s.trim()),
      ["window.AiLayout ="],
      "the pure core publishes ONE seam, named, and no more",
    );
    assert.ok(
      /window\.AiLayout = AiLayout;/.test(src),
      "the seam is the same object `module.exports` hands the suites — one surface, two readers",
    );
    assert.strictEqual(typeof aiLayout.validatePatch, "function");
    assert.strictEqual(typeof global.AiLayout, "undefined", "loading it in Node publishes nothing");
    // And the reader exists, in product source, not in a test: this is the claim the seam was
    // added for. If `js/ai_arrange.js` ever stops reading the core, the guard fails too — but
    // failing HERE as well means the two files cannot drift apart silently.
    const arrange = require("fs").readFileSync(
      require.resolve("../../js/ai_arrange.js"),
      "utf8",
    );
    assert.ok(/window\.AiLayout/.test(arrange), "js/ai_arrange.js is the caller");
  });

  it("summarizes a patch for the preview diff and the undo label", function () {
    const summary = aiLayout.summarizePatch(
      aiLayout.validatePatch(validPatch(), LIVE_IDS, OPT).patch,
    );
    assert.deepStrictEqual(summary, { moves: 2, hides: 1, resized: 2, restacked: 2 });
  });
});
