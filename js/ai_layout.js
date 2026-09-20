/**
 * AI layout: the BYOK arranger's PURE core — the layout-patch schema, its validator,
 * the provider adapters, and the prompt constructor.
 *
 * Track `byok_ai_layout_20260915`, Phase 1. The architectural stance this module exists
 * to enforce is the spec's: **AI proposes, code disposes.** The model's only output is a
 * JSON patch against the existing layout record (`js/layout_scan.js:227`
 * `layout.sections[id]`); nothing here touches the DOM, `chrome.*`, or the network, so
 * every rejection class in AC-2 is provable headless — which is what GATE-2's R1 finding
 * asked for (an earlier draft of the gate could pass on ids that no real scan produces).
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 * ---------------------------------------
 * - No apply, no undo, no save: that is Phase 4, through `applyLayout`/`pushMutation`.
 *   Nothing here can mutate a layout record, and `validatePatch` does not even try: it
 *   reads the ids the caller harvested from a LIVE `scanLayout` and hands back a verdict.
 * - No transport: Phase 3 owns content-script -> service-worker (`js/background.js:195`
 *   is the shape), and `buildRequest` is what that transport will hand `fetch` — a plain
 *   `{url, method, headers, body}` with the credential in ONE header.
 * - No key storage: AC-4 (Phase 2) owns where the key lives. This module only ever
 *   receives one as a string, and its unit case asserts the string never lands in a
 *   serialized body, url, or message.
 *
 * PURE, ON PURPOSE: no `chrome` namespace, no `document`, no host storage. Pinned by
 * `test/unit/ai_layout_schema.test.js` so the boundary cannot rot into "just one small fetch".
 *
 * WHY THERE IS NO `window.*` SEAM YET: the re-rot guard
 * (`scripts/check_dead_exports.js`, track `dead_exports_20260910`) fails a published seam
 * with no reader in `js/`, and Phase 1 has none — the fleet has twice deleted a
 * write-it-now seam for exactly that reason (`__refreshUndoControl`, `UNDO_LABEL_MAX`).
 * `window.AiLayout` is added in Phase 4, in the commit that gives it its first product
 * caller. Suites reach this module through `require`, like `js/ui_theme.js` is reached.
 */

"use strict";

// ---------------------------------------------------------------------------
// The vocabulary. ONE declaration, so the schema, the prompt that teaches it, and
// the validator that enforces it cannot drift apart (that drift is the defect the
// fleet's stale-pointer class keeps recording).
// ---------------------------------------------------------------------------

/**
 * Top-level patch keys — spec AC-1's envelope, EXACTLY: `{ moves, hide, note? }`.
 *
 * GATE-3's D1 removed the `confirm` field this draft had added. It was scope creep in the
 * wrong place: AC-1's envelope does not carry it, and fixture D's own rule ("an extra
 * top-level key is rejected") cannot be enforced by a schema that ships one. The
 * destructive patch class it gated is now refused where it belongs — a `width` below the
 * minimum the product's own resize path can produce (see `MIN_WIDTH_PX`) — and "hide
 * everything" is Phase 4's PREVIEW decision, made by the user looking at the diff, with
 * `pushUndo` behind it. AC-2 governs malformed input, not a well-formed ask the user made.
 */
const PATCH_KEYS = Object.freeze({
  moves: "moves",
  hide: "hide",
  note: "note",
});

/** The fields a move may write on one section (spec AC-1). */
const PATCH_SECTION_KEYS = Object.freeze({
  left: "left",
  top: "top",
  width: "width",
  zIndex: "zIndex",
  minimized: "minimized",
});

/**
 * O-3's payload: what the model is TOLD about each section. Ratified 2026-09-15 as
 * `{id, title, x, y, w, h}`, then **WIDENED by the operator 2026-09-17** (GATE-3 round 2's
 * escalated challenge) to add `zIndex` and `minimized`. The answer settles the
 * contradiction AC-1/O-3 carried: `zIndex` was WRITABLE by a patch but never SHOWN, so the
 * model restacked blind. Every field it may now write is a field it was shown — asserted,
 * not merely true, by `test/unit/ai_layout_schema.test.js`.
 *
 * THE COST THE OPERATOR ACCEPTED WITH THE ANSWER (AC-D1, Phase 5): this is a WIDER privacy
 * surface than the ratified text, so the README/PRIVACY_POLICY copy must read
 * "position, size, stacking order and the section's heading" and never "no text". Both new
 * fields come straight off the scan record (`js/layout_scan.js:233` `zIndex`,
 * `:236` `minimized`) — scalars, zero content text.
 */
const SECTION_CONTEXT_KEYS = Object.freeze([
  "id",
  "title",
  "left",
  "top",
  "width",
  "height",
  "zIndex",
  "minimized",
]);

/** Bounds on the geometry. A sheet section is never negative and never this wide. */
const MAX_GEOMETRY_PX = 40000;

/**
 * The stacking band. The LOW end and the DEFAULT come from the product's own declared
 * ladder (`js/section_utils.js:16` `Z`), so a range that disagreed with it would reject
 * layouts the extension already ships. The HIGH end is INT32_MAX, the ceiling a CSS
 * `z-index` can hold — and `Z.TOP` ("2147483647") is a value the layer ghost genuinely
 * carries, so it must stay legal.
 */
const Z_ORDER_MIN = 0;
const Z_ORDER_MAX = 2147483647;

/**
 * The smallest `width` a patch may write. NOT an invention: a user dragging the resize
 * handle cannot produce anything under it — `js/main.js:2303` clamps `newWidth < 50` up to
 * 48 — so a 0 (or a hairline) is a value the sheet's own UI cannot make, i.e. malformed
 * geometry rather than a legitimate destructive ask. This is what closes GATE-3's D1: the
 * blank-the-sheet patch dies as a `geometry_value` rejection, with no new schema field and
 * no consent state to carry.
 */
const MIN_WIDTH_PX = 48;

/**
 * The line that closes the instruction block and opens the section table inside the system
 * message. A DECLARED constant rather than prose both suites re-type: the unit case reads the
 * payload back as data through it (a substring hunt for "[{" would break the moment the
 * schema example above the table grows an array), and Phase 4's prompt-size report can
 * measure the table apart from the contract.
 */
const SECTION_TABLE_MARKER = "SECTION TABLE (the only valid ids):";

/** O-3's budget promise: the instruction is a sentence or two, not a document. */
const MAX_INSTRUCTION_CHARS = 4000;

/** The provider contract the adapters speak. */
/**
 * The provider contract the adapters speak. `base` + `path` is the endpoint; `base` is what
 * an allow-listed OpenAI-compatible override REPLACES (O-1), which is why the two are
 * separate fields — a compatible host serves `/chat/completions` under its own root, so
 * bolting the whole path onto an override's origin would produce `.../api/v1/v1/...`.
 */
const PROVIDERS = Object.freeze({
  openai: {
    label: "OpenAI",
    base: "https://api.openai.com/v1",
    path: "/chat/completions",
    header: "Authorization",
    scheme: "Bearer ",
  },
  anthropic: {
    label: "Anthropic",
    base: "https://api.anthropic.com/v1",
    path: "/messages",
    header: "x-api-key",
    scheme: "",
  },
});

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 2048;

/** Key-shaped strings that must never be echoed into a message or a log line. */
const CREDENTIAL_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bsk-ant-[A-Za-z0-9_-]{16,}/,
  /\bpat_[A-Za-z0-9_-]{12,}/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/,
];

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

/**
 * A finding is `{code, path, message}` — a CODE, not just prose. R2's gate list demands
 * "a DISTINCT error code" per reject class, because "it failed" is satisfied by a
 * validator that rejects everything.
 */
function finding(code, path, message) {
  return { code, path, message };
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A string that is not blank, e.g. an id. */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * The record's own geometry spelling is a string with units (`"400px"`) because
 * `scanLayout` reads `style.width`; the patch speaks numbers so a model cannot smuggle a
 * unit it was never shown. Both spellings are accepted at the boundary and NORMALISED to
 * one form — that is what makes AC-3's "one undo restores exactly what was there" a
 * byte-compare rather than a coin flip.
 */
function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Only a bare number or a px value: `110.469%`, `calc(...)` and `vw` are DERIVED
  // spellings and are handled by the derived-width rule below, not by coercion.
  const m = /^(-?\d+(?:\.\d+)?)(?:px)?$/.exec(trimmed);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * THE classifier behind every numeric patch field, and the reason each reject class owns
 * its own CODE (R2's gate list: "assert a DISTINCT error code, not merely that it failed" —
 * "it failed" is equally true of a validator that rejects everything):
 *
 *   shape    not a number at all (`true`, `{}`, an array) — the model did not understand
 *            the field: `geometry_shape` / `stack_order_shape`
 *   value    meant to be a number but is not one the sheet can place (`null`, `NaN`,
 *            `Infinity`, `""`, `"12px-ish"`): `geometry_value` / `stack_order_value`.
 *            `null` belongs here, not under shape: JSON has no NaN, so a model that
 *            cannot compute a coordinate answers `null`, and the copy is the same retry.
 *   derived  a number whose SPELLING the sheet's own scaling produces and no user gesture
 *            can: a percentage / `vw` / `vh` / `calc(...)`, or a fractional pixel. THAT is
 *            fixture F — see `derivedCandidatesFromRecord` for the other half.
 *   ok       an integer (or an integer-valued `"300px"`, the record's own spelling)
 *
 * The product's user path cannot produce a fractional width: the resize handle snaps to
 * multiples of 16 and clamps to integers (`js/main.js:2294-2305`), and the scaling
 * compensation travels as `--be-scale`, which no inline-style scan reads
 * (`js/print_styles.js:1234-1246`).
 */
function classifyNumber(value) {
  if (value === null) return { kind: "value", n: null };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { kind: "value", n: null };
    return Number.isInteger(value)
      ? { kind: "ok", n: value }
      : { kind: "derived", n: value, why: "a fractional pixel" };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^[-+]?\d*\.?\d+(?:%|vw|vh)$/i.test(trimmed) || /calc\(/i.test(trimmed)) {
      return { kind: "derived", n: null, why: "a relative unit" };
    }
    const n = toNumber(trimmed);
    if (n === null) return { kind: "value", n: null };
    return Number.isInteger(n)
      ? { kind: "ok", n }
      : { kind: "derived", n, why: "a fractional pixel" };
  }
  return { kind: "shape", n: null };
}

/**
 * The values in the record that a derived width could RE-APPEAR as: `innerWidths` entries
 * (the compensation's own percentages, per `js/layout_apply.js:243-259` and
 * `js/layout_scan.js:242-252`) resolved against the section's recorded width, plus its px
 * entries. A model that copies one of these into `width` re-injects a derived value as a
 * user choice — the 1.17.3 collision, back on the AI path. An INTEGER px is not cleared by
 * the spelling test, which is why the caller passes its live `layout.sections` in
 * `options.current`; without it the check reports itself through `advisories` rather than
 * reading as a pass.
 */
function derivedCandidatesFromRecord(entry) {
  const out = [];
  if (!isPlainObject(entry) || !isPlainObject(entry.innerWidths)) return out;
  const width = toNumber(entry.width);
  for (const key of Object.keys(entry.innerWidths)) {
    const raw = entry.innerWidths[key];
    if (typeof raw !== "string") continue;
    const pct = /^(-?\d+(?:\.\d+)?)%$/.exec(raw.trim());
    if (pct && width !== null) out.push((Number(pct[1]) / 100) * width);
    const px = toNumber(raw);
    if (px !== null) out.push(px);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

function verdict(errors, advisories, patch, checks) {
  const checksDone = checks || {};
  return {
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    advisories: Object.freeze(advisories),
    patch: patch === undefined ? null : patch,
    code: errors.length ? errors[0].code : null,
    checks: Object.freeze({
      liveIds: true,
      derivedWidth: false,
      ...checksDone,
    }),
  };
}

/**
 * `validatePatch(patch, liveSectionIds, options)` — AC-1's schema and AC-2's logic.
 *
 * PURE: the ids are the CALLER'S live scan (that pairing is what keeps this headless),
 * nothing is read from the environment, and the input object is never mutated — the
 * verdict's `patch` is a frozen normalised copy, which is what Phase 4 will merge.
 *
 * THE CONTRACT THAT MATTERS MOST: this function RETURNS a verdict, it does not throw, for
 * any input whatsoever. A model that answers `"I can't help with that"`, `null`, or an
 * object with a poisoned prototype gets findings back, and AC-2's "zero mutation" follows
 * from the caller never having to be inside a try/catch to be safe.
 *
 * @param {Object} patch candidate patch from the model.
 * @param {string[]} liveSectionIds ids present on the sheet, from a live `scanLayout`.
 * @param {{current?: Object}} options `current` = the live `layout.sections` map, which is
 *        what lets the derived-width check be a CHECK instead of a guess.
 * @return {{ok: boolean, errors: Array, advisories: Array, patch: Object|null,
 *           code: string|null, checks: Object}}
 */
function validatePatch(patch, liveSectionIds, options) {
  const errors = [];
  const advisories = [];
  const checks = {};

  // --- the id universe ------------------------------------------------------
  const live = Array.isArray(liveSectionIds)
    ? liveSectionIds.filter(isNonEmptyString).map((s) => String(s).trim())
    : [];
  const liveSet = new Set(live);
  checks.liveIds = live.length > 0;
  if (live.length === 0) {
    // Without this, "the scan produced nothing" is indistinguishable from "every id in
    // this patch is bogus" — and a spec that passed [] would see a wall of
    // `section_id_unknown` and conclude the validator works.
    advisories.push(
      finding(
        "live_ids_empty",
        "liveSectionIds",
        "the caller supplied no live section ids, so nothing can be validated",
      ),
    );
    errors.push(
      finding(
        "live_ids_empty",
        "liveSectionIds",
        "no live sections: run the patch against a sheet that has been scanned",
      ),
    );
    return verdict(errors, advisories, undefined, checks);
  }

  // --- the envelope ---------------------------------------------------------
  if (!isPlainObject(patch)) {
    errors.push(
      finding("envelope_shape", "$", "a patch must be an object, got " + describeValue(patch)),
    );
    return verdict(errors, advisories, undefined, checks);
  }

  for (const key of Object.keys(patch)) {
    if (!Object.prototype.hasOwnProperty.call(PATCH_KEYS, key)) {
      errors.push(
        finding(
          "envelope_key",
          key,
          `"${key}" is not a patch field (allowed: ${Object.keys(PATCH_KEYS).join(", ")})`,
        ),
      );
    }
  }

  const hasMoves = Object.prototype.hasOwnProperty.call(patch, PATCH_KEYS.moves);
  const hasHide = Object.prototype.hasOwnProperty.call(patch, PATCH_KEYS.hide);
  if (!hasMoves && !hasHide) {
    errors.push(
      finding(
        "envelope_empty",
        "$",
        "a patch must carry `moves` and/or `hide`; an empty patch changes nothing",
      ),
    );
  }

  const movesIn = hasMoves ? patch[PATCH_KEYS.moves] : {};
  if (!isPlainObject(movesIn)) {
    errors.push(
      finding("envelope_shape", PATCH_KEYS.moves, "`moves` must be an id-keyed map, got " + describeValue(movesIn)),
    );
  }

  const hideIn = hasHide ? patch[PATCH_KEYS.hide] : [];
  if (!Array.isArray(hideIn)) {
    errors.push(
      finding("envelope_shape", PATCH_KEYS.hide, "`hide` must be a list of ids, got " + describeValue(hideIn)),
    );
  }

  // --- the moves ------------------------------------------------------------
  const movesOut = {};
  const moveIds = isPlainObject(movesIn) ? Object.keys(movesIn) : [];
  for (const id of moveIds) {
    if (!liveSet.has(id)) {
      errors.push(
        finding(
          "section_id_unknown",
          `${PATCH_KEYS.moves}.${id}`,
          `"${id}" is not a section on this sheet`,
        ),
      );
      continue;
    }
    const entry = movesIn[id];
    if (!isPlainObject(entry)) {
      errors.push(
        finding("envelope_shape", `${PATCH_KEYS.moves}.${id}`, "a move must be an object, got " + describeValue(entry)),
      );
      continue;
    }
    const out = {};
    for (const field of Object.keys(entry)) {
      if (!Object.prototype.hasOwnProperty.call(PATCH_SECTION_KEYS, field)) {
        errors.push(
          finding(
            "geometry_shape",
            `${PATCH_KEYS.moves}.${id}.${field}`,
            `"${field}" is not writable by a patch (allowed: ${Object.keys(PATCH_SECTION_KEYS).join(", ")})`,
          ),
        );
        continue;
      }
      const value = entry[field];
      const where = `${PATCH_KEYS.moves}.${id}.${field}`;
      if (field === "minimized") {
        if (typeof value !== "boolean") {
          errors.push(
            finding("minimized_shape", where, "`minimized` must be true or false, got " + describeValue(value)),
          );
        } else {
          out[field] = value;
        }
        continue;
      }
      const num = classifyNumber(value);
      if (field === "zIndex") {
        // Stacking order has no derived class: a fractional z is simply not an integer
        // z-index, so `derived` folds into the value failure the user retries on.
        if (num.kind === "shape") {
          errors.push(
            finding(
              "stack_order_shape",
              where,
              "a stacking order must be a number, got " + describeValue(value),
            ),
          );
        } else if (num.kind !== "ok" || num.n < Z_ORDER_MIN || num.n > Z_ORDER_MAX) {
          errors.push(
            finding(
              "stack_order_value",
              where,
              `a stacking order must be an integer ${Z_ORDER_MIN}..${Z_ORDER_MAX}, got ` +
                describeValue(value),
            ),
          );
        } else {
          out[field] = num.n;
        }
        continue;
      }

      // left / top / width
      if (num.kind === "shape") {
        errors.push(
          finding(
            "geometry_shape",
            where,
            "a pixel position must be a number, got " + describeValue(value),
          ),
        );
      } else if (num.kind === "derived") {
        errors.push(
          finding(
            "derived_width",
            where,
            `${describeValue(value)} is ${num.why} — a value the sheet's own scaling produced, ` +
              "not a width a user could have set (the record-collision class, " +
              "js/print_styles.js:1234)",
          ),
        );
      } else if (num.kind === "value") {
        errors.push(
          finding(
            "geometry_value",
            where,
            "must be a whole number of pixels, got " + describeValue(value),
          ),
        );
      } else if (num.n < 0 || num.n > MAX_GEOMETRY_PX) {
        errors.push(
          finding(
            "geometry_value",
            where,
            `${num.n}px is outside 0..${MAX_GEOMETRY_PX}px`,
          ),
        );
      } else if (field === "width" && num.n < MIN_WIDTH_PX) {
        errors.push(
          finding(
            "geometry_value",
            where,
            `a width of ${num.n}px is below the ${MIN_WIDTH_PX}px the sheet's own resize ` +
              "handle clamps to (js/main.js:2303) — a collapsed section is a malformed ask, " +
              "not something to confirm",
          ),
        );
      } else {
        out[field] = num.n;
      }
    }
    movesOut[id] = out;
  }

  // --- the hides ------------------------------------------------------------
  const hideOut = [];
  const hideList = Array.isArray(hideIn) ? hideIn : [];
  for (let i = 0; i < hideList.length; i += 1) {
    const id = hideList[i];
    if (!isNonEmptyString(id)) {
      errors.push(
        finding("envelope_shape", `${PATCH_KEYS.hide}[${i}]`, "a hidden id must be a string, got " + describeValue(id)),
      );
      continue;
    }
    if (!liveSet.has(id)) {
      errors.push(
        finding("section_id_unknown", `${PATCH_KEYS.hide}[${id}]`, `"${id}" is not a section on this sheet`),
      );
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(movesOut, id)) {
      errors.push(
        finding(
          "section_id_duplicated",
          `${PATCH_KEYS.hide}[${id}]`,
          `"${id}" is both moved and hidden — pick one`,
        ),
      );
      continue;
    }
    hideOut.push(id);
  }

  // --- the note ---------------------------------------------------------------
  let note;
  if (patch[PATCH_KEYS.note] !== undefined) {
    if (typeof patch[PATCH_KEYS.note] !== "string") {
      errors.push(finding("envelope_shape", PATCH_KEYS.note, "`note` must be a string"));
    } else {
      note = patch[PATCH_KEYS.note].slice(0, 2000);
    }
  }

  // --- derived widths: the SPELLING test plus the RECORD comparison --------------
  // GATE-3's D2 promoted this from advisory to a hard requirement. The working note says
  // "validate widths are what the user asked for, or copy the current value", and a check
  // that a caller can silently skip is not a validation: `width` is the field that carried
  // the 1.17.3 record collision, so a patch that writes one is REQUIRED to be checked
  // against the record it is patching. The caller has it — Phase 4's flow scans first.
  const current =
    isPlainObject(options) && isPlainObject(options.current) ? options.current : null;
  const writesWidth = Object.keys(movesOut).some((id) => movesOut[id].width !== undefined);
  checks.derivedWidth = current !== null;
  if (writesWidth && !current) {
    errors.push(
      finding(
        "derived_width_unchecked",
        PATCH_KEYS.moves,
        "this patch writes a width but no current layout record was passed, so the " +
          "derived-width guard could not run; pass `{current: layout.sections}` from the " +
          "live scan (AC-2's reject-no-damage requires the check, not the intention)",
      ),
    );
  } else if (!current) {
    advisories.push(
      finding(
        "derived_width_unchecked",
        PATCH_KEYS.moves,
        "no current layout record was passed; harmless for this patch because it writes no " +
          "width, but a later revision that adds one will be REJECTED",
      ),
    );
  }
  if (current) {
    for (const id of Object.keys(movesOut)) {
      const candidates = derivedCandidatesFromRecord(current[id]);
      if (candidates.length === 0) continue;
      for (const field of ["left", "top", "width"]) {
        const want = movesOut[id][field];
        if (typeof want !== "number") continue;
        const hit = candidates.find((c) => Math.abs(c - want) < 0.5);
        if (hit !== undefined) {
          errors.push(
            finding(
              "derived_width",
              `${PATCH_KEYS.moves}.${id}.${field}`,
              `${want}px re-injects a derived value (${hit}px comes from this section's own ` +
                "scaling record) — use the user's width or leave the field out",
            ),
          );
        }
      }
    }
  }

  if (errors.length) return verdict(errors, advisories, undefined, checks);

  const normalized = Object.freeze({
    moves: Object.freeze(
      Object.keys(movesOut).reduce((acc, id) => {
        acc[id] = Object.freeze(movesOut[id]);
        return acc;
      }, {}),
    ),
    hide: Object.freeze(hideOut),
    note,
  });
  return verdict(errors, advisories, normalized, checks);
}

/** Compact, safe type description for a message. Never dumps a whole object. */
function describeValue(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : String(value);
  if (typeof value === "string") return JSON.stringify(value.slice(0, 40));
  if (typeof value === "object") return "an object";
  return `a ${typeof value}`;
}

/**
 * What a patch will DO, in counts — for Phase 4's preview diff and its undo label
 * ("Move 2, hide 1"). Kept here so the number the user confirms is computed from the SAME
 * normalised patch the apply consumes.
 */
function summarizePatch(patch) {
  if (!isPlainObject(patch)) return { moves: 0, hides: 0, resized: 0, restacked: 0 };
  const moves = isPlainObject(patch.moves) ? patch.moves : {};
  let resized = 0;
  let restacked = 0;
  for (const id of Object.keys(moves)) {
    const m = moves[id] || {};
    if (m.width !== undefined) resized += 1;
    if (m.zIndex !== undefined) restacked += 1;
  }
  return {
    moves: Object.keys(moves).length,
    hides: Array.isArray(patch.hide) ? patch.hide.length : 0,
    resized,
    restacked,
  };
}

// ---------------------------------------------------------------------------
// The prompt constructor (AC-1's enum, O-3's payload)
// ---------------------------------------------------------------------------

/**
 * Builds the model's two messages from a scanned section table + the user's instruction.
 *
 * THE ASSERTION THAT MAKES THIS SAFE (plan Phase 1, R3's surviving ask): the section table
 * is the ONLY source of ids, and it is built field-by-field from `SECTION_CONTEXT_KEYS` —
 * never spread from the scan record. A `...row` would ship `innerHTML` with it, and O-3's
 * "geometry plus the heading" promise would be a comment rather than a rule. The enum in
 * the system message is generated from the same list, so the model cannot be shown one set
 * of ids and constrained to another.
 *
 * Throws (a typed `Error` with `.code`) ONLY for caller mistakes that must never reach the
 * network: an id in the table that is not in the live scan, an over-long instruction, or an
 * instruction carrying a credential. `validatePatch` is the one with the no-throw contract,
 * because that is where model output lands.
 *
 * @param {Array<{id, title, left, top, width, height}>} sections the scanned table.
 * @param {string} instruction what the user asked for.
 * @param {{liveSectionIds?: string[]}} options optional live-id cross-check.
 * @return {Array<{role: string, content: string}>}
 */
function buildMessages(sections, instruction, options) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw typedError("section_table_empty", "the prompt needs at least one scanned section");
  }
  if (!isNonEmptyString(instruction)) {
    throw typedError("instruction_required", "there is nothing to ask the model for");
  }
  const text = String(instruction).trim();
  if (text.length > MAX_INSTRUCTION_CHARS) {
    throw typedError(
      "instruction_too_long",
      `the instruction is ${text.length} characters (max ${MAX_INSTRUCTION_CHARS})`,
    );
  }
  const leak = CREDENTIAL_PATTERNS.find((re) => re.test(text));
  if (leak) {
    // AC-4: the key is never placed in the prompt. If the user pasted one into the box,
    // refuse the CALL rather than ship the secret to a third party in a chat body.
    throw typedError(
      "instruction_contains_credential",
      "the instruction looks like it carries an API key; put it in the AI settings instead",
    );
  }

  const live =
    options && Array.isArray(options.liveSectionIds)
      ? new Set(options.liveSectionIds.filter(isNonEmptyString))
      : null;

  const rows = [];
  for (const row of sections) {
    if (!isPlainObject(row) || !isNonEmptyString(row.id)) {
      throw typedError("section_table_shape", "every row needs a string `id`");
    }
    if (live && !live.has(row.id)) {
      // AC-1's enum is enforced HERE too, not only in the validator: an id that is not on
      // the sheet must never be offered to the model as a legal answer in the first place.
      throw typedError("section_id_absent", `"${row.id}" is not in the live scan`);
    }
    rows.push(pickSectionContext(row));
  }

  const system = [
    "You arrange a printable Dungeons & Dragons character sheet. Every section is already",
    "absolutely positioned on one page; you change WHERE it goes, never what it contains.",
    "",
    "Reply with ONE JSON object and NOTHING else — no prose, no markdown fence. Shape:",
    `  {${JSON.stringify(PATCH_KEYS.moves)}: {<sectionId>: {` +
      `${PATCH_SECTION_KEYS.left}, ${PATCH_SECTION_KEYS.top}, ${PATCH_SECTION_KEYS.width}, ` +
      `${PATCH_SECTION_KEYS.zIndex}, ${PATCH_SECTION_KEYS.minimized}}}, ` +
      `${JSON.stringify(PATCH_KEYS.hide)}: [<sectionId>, ...], ` +
      `${JSON.stringify(PATCH_KEYS.note)}: string}`,
    "",
    "Rules:",
    `- ${PATCH_KEYS.moves} and ${PATCH_KEYS.hide} are both optional; every id you use MUST be`,
    "  one of the SECTION TABLE ids below. Any other id fails the whole patch.",
    `- ${PATCH_KEYS.left}/${PATCH_KEYS.top}/${PATCH_KEYS.width} are pixel numbers >= 0.` +
      " Integers only.",
    `- ${PATCH_KEYS.zIndex} is an integer 0..${Z_ORDER_MAX}; higher sits on top.` +
      " Keep headings above art.",
    `- ${PATCH_KEYS.minimized} is true/false: a minimized section shows only its heading.` +
      ` Each section below reports its CURRENT ${PATCH_KEYS.zIndex} and` +
      ` ${PATCH_KEYS.minimized}, so move/stack against what is there instead of guessing.`,
    `- ${PATCH_KEYS.hide} removes a section from the printed page without deleting it.`,
    "- Do NOT reuse a section's reported width as a NEW width for another section, and never",
    "  send a percentage or a decimal: widths are the USER's pixel choices.",
    `- \`width\` has a floor of ${MIN_WIDTH_PX}px (a section cannot be collapsed to nothing).`,
    "  Do NOT hide every section: the user can always undo, but a blank page is not a layout.",
    `- ${PATCH_KEYS.note}: one short sentence to the user about what you did.`,
    "",
    // The marker is load-bearing for the unit case that reads this payload back as data.
    `Each section below is described by ${SECTION_CONTEXT_KEYS.join(", ")}; \`title\` is the`,
    "printed heading, so you can tell combat from utility apart.",
    // THE MARKER IS THE CONTRACT WITH THE TEST: it sits immediately before the table,
    // which is the last thing in the message, so everything after it IS the JSON — no
    // "find the bracket" heuristic that breaks when the schema example above grows an
    // array. Declared as a constant for exactly that reason.
    SECTION_TABLE_MARKER,
    JSON.stringify(rows),
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: text },
  ];
}

/** One row of O-3's payload — field by field, so nothing else can ride along. */
function pickSectionContext(row) {
  const out = {};
  for (const key of SECTION_CONTEXT_KEYS) {
    if (row[key] !== undefined) out[key] = row[key];
  }
  return out;
}

// ---------------------------------------------------------------------------
// The provider adapters (AC-6)
// ---------------------------------------------------------------------------

function typedError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * `{provider, model, apiKey, messages, maxTokens, baseUrl?, allowedBaseOrigins?}` →
 * `{url, method, headers, body}` — the exact argument list `fetch` will be called with in
 * Phase 3's service worker.
 *
 * THE CREDENTIAL TRAVELS IN EXACTLY ONE PLACE: a header. It is never in `url` and never in
 * `body`, which is what makes AC-4's "never in the prompt, never in a log line" assertable
 * on the OUTPUT of this function rather than on a grep of the tree.
 *
 * O-1's accepted consequence, enforced here: the free-form OpenAI-compatible base URL IS
 * the arbitrary-URL relay in a different hat (spec L-3 MEASURED CORRECTION), so an override
 * is honoured ONLY when its origin is in the operator-published allow-list — and that list
 * comes from code, never from a message body.
 */
function buildRequest(config) {
  if (!isPlainObject(config)) throw typedError("request_shape", "buildRequest needs a config object");
  const provider = String(config.provider || "").trim().toLowerCase();
  const spec = Object.prototype.hasOwnProperty.call(PROVIDERS, provider) ? PROVIDERS[provider] : null;
  if (!spec) {
    throw typedError(
      "unknown_provider",
      `"${provider}" has no adapter (shipped: ${Object.keys(PROVIDERS).join(", ")})`,
    );
  }
  const key = typeof config.apiKey === "string" ? config.apiKey.trim() : "";
  if (!key) throw typedError("api_key_required", "no API key is stored for this provider");
  const model = String(config.model || "").trim();
  if (!model) throw typedError("model_required", "no model id is configured");
  if (!Array.isArray(config.messages) || config.messages.length === 0) {
    throw typedError("messages_required", "buildRequest needs the messages from buildMessages");
  }

  const maxTokens =
    typeof config.maxTokens === "number" && Number.isFinite(config.maxTokens) && config.maxTokens > 0
      ? Math.floor(config.maxTokens)
      : DEFAULT_MAX_TOKENS;

  const base = resolveBase(spec, config);
  const headers = { "Content-Type": "application/json" };
  headers[spec.header] = spec.scheme + key;

  let body;
  if (provider === "anthropic") {
    // Anthropic takes the system prompt OUT OF BAND; a `system` role inside `messages` is
    // a 400, so lifting it is part of the adapter, not a caller's job.
    const system = config.messages
      .filter((m) => m && m.role === "system")
      .map((m) => String(m.content))
      .join("\n\n");
    body = {
      model,
      max_tokens: maxTokens,
      messages: config.messages.filter((m) => m && m.role !== "system"),
    };
    if (system) body.system = system;
    headers["anthropic-version"] = ANTHROPIC_VERSION;
  } else {
    body = {
      model,
      max_tokens: maxTokens,
      messages: config.messages,
      response_format: { type: "json_object" },
    };
  }

  return { url: base + spec.path, method: "post", headers, body };
}

/**
 * The endpoint's base: the provider's published one, or an ALLOW-LISTED compatible override.
 *
 * O-1's accepted consequence, enforced in code: a free-form base URL is the arbitrary-URL
 * relay wearing a different hat (spec L-3 MEASURED CORRECTION), so an override is honoured
 * only when its origin is either a published provider or a host on the operator-published
 * list — and that list is a build-time constant passed IN, never a message field. https
 * only, no embedded credentials (they would ride to the host in the request).
 */
function resolveBase(spec, config) {
  const raw = typeof config.baseUrl === "string" ? config.baseUrl.trim() : "";
  if (!raw) return spec.base;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw typedError("base_url_not_allowed", "the stored base URL is not a valid URL");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw typedError("base_url_not_allowed", "a base URL must be https with no credentials");
  }
  const allowed = Array.isArray(config.allowedBaseOrigins) ? config.allowedBaseOrigins : [];
  const origin = url.origin;
  const isPublished = Object.keys(PROVIDERS).some(
    (p) => new URL(PROVIDERS[p].base).origin === origin,
  );
  const isListed = allowed.some((a) => {
    try {
      return new URL(String(a)).origin === origin;
    } catch {
      return false;
    }
  });
  if (!isPublished && !isListed) {
    throw typedError(
      "base_url_not_allowed",
      `"${origin}" is not an approved provider origin (O-1: a stored base URL may not name ` +
        "an arbitrary host; it is checked against the published list)",
    );
  }
  return origin + url.pathname.replace(/\/+$/, "");
}

/** The error classes AC-6's tail demands, each with its own user-visible message. */
const ERROR_CLASSES = Object.freeze({
  auth: "That API key was rejected. Re-check it in AI settings.",
  rate_limit: "The provider is rate-limiting this key. Try again in a moment.",
  provider_unavailable: "The provider is unavailable right now. Try again shortly.",
  network: "Could not reach the provider. Check your connection.",
  aborted: "The request was cancelled.",
  malformed: "The provider answered with something unexpected.",
  model_output_not_json: "The model did not answer with a valid layout patch.",
  unknown: "The arrangement request failed.",
});

/** Strip anything key-shaped out of a provider message before it reaches a toast. */
function redactCredentials(text) {
  let out = String(text);
  for (const re of CREDENTIAL_PATTERNS) {
    out = out.replace(new RegExp(re.source, "g"), "[REDACTED]");
  }
  return out.slice(0, 400);
}

/**
 * `(provider, rawResponseOrError)` → `{ok: true, text}` | `{ok: false, errorClass,
 * message, status?, retryAfterSeconds?}`.
 *
 * THE SINGLE JSON-DECODE SITE for a provider body (Phase 0 counted 3 `.json()` calls in
 * `js/`, all of them `response.json()`): it accepts a parsed object OR a string, so Phase 3
 * cannot reintroduce a second, ungated parse — and a body that will not parse is a TYPED
 * failure, never an exception, because AC-6's promise is an error per class, not a crash.
 *
 * It never throws. A provider 4xx body can ECHO what was sent (AC-4's sink warning), so the
 * message is redacted before it is handed up to be shown.
 */
function parseResponse(provider, response) {
  const name = String(provider || "").trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(PROVIDERS, name)) {
    return fail("unknown_provider", `no adapter for provider "${name}"`, null);
  }

  // A thrown error is an input like any other — a timeout, an abort, a CSP block.
  if (response instanceof Error) {
    const errName = String(response.name || "");
    const msg = String(response.message || "");
    if (errName === "AbortError" || /abort/i.test(msg)) {
      return fail("aborted", ERROR_CLASSES.aborted, null, true);
    }
    if (errName === "TypeError" || /fetch|network|offline|load failed/i.test(msg)) {
      return fail("network", ERROR_CLASSES.network, null, true);
    }
    return fail("unknown", msg || ERROR_CLASSES.unknown, null, true);
  }

  if (!isPlainObject(response)) {
    return fail("malformed", ERROR_CLASSES.malformed, null);
  }

  const status = Number(response.status);
  const body = decodeBody(response.body);

  if (!Number.isFinite(status)) {
    return fail("malformed", "the response carries no status code", null);
  }

  if (status >= 400) {
    const detail = describeProviderError(body);
    const retryAfter = readRetryAfter(response.headers);
    if (status === 401 || status === 403) {
      return fail("auth", detail || ERROR_CLASSES.auth, status);
    }
    if (status === 429) {
      return fail(
        "rate_limit",
        detail || ERROR_CLASSES.rate_limit,
        status,
        false,
        retryAfter === null ? undefined : retryAfter,
      );
    }
    if (status >= 500) {
      return fail("provider_unavailable", detail || ERROR_CLASSES.provider_unavailable, status, true);
    }
    return fail("malformed", detail || ERROR_CLASSES.malformed, status);
  }

  if (status >= 300) {
    return fail("malformed", `unexpected redirect (${status})`, status);
  }

  const text = extractAssistantText(name, body);
  if (text === null) {
    return fail("malformed", ERROR_CLASSES.malformed, status);
  }
  return { ok: true, text, status, errorClass: null, message: "", retryAfterSeconds: undefined };
}

function fail(errorClass, message, status, retryable, retryAfterSeconds) {
  return {
    ok: false,
    text: undefined,
    status: status === undefined ? null : status,
    errorClass,
    code: errorClass,
    message: redactCredentials(message || ERROR_CLASSES[errorClass] || ERROR_CLASSES.unknown),
    retryable: Boolean(retryable),
    retryAfterSeconds,
  };
}

function decodeBody(body) {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}

function describeProviderError(body) {
  if (typeof body === "string") return redactCredentials(body);
  if (!isPlainObject(body)) return "";
  const err = isPlainObject(body.error) ? body.error : body;
  const raw = err && (err.message || err.type || err.code);
  if (!raw) return "";
  return redactCredentials(typeof raw === "string" ? raw : JSON.stringify(raw));
}

function readRetryAfter(headers) {
  if (!isPlainObject(headers)) return null;
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() !== "retry-after") continue;
    const n = Number(headers[key]);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return null;
}

/** The two response shapes, walked WITHOUT a JSON parse of a body we were handed parsed. */
function extractAssistantText(provider, body) {
  if (!isPlainObject(body)) return null;
  if (provider === "anthropic") {
    const blocks = Array.isArray(body.content) ? body.content : [];
    const text = blocks
      .filter((b) => isPlainObject(b) && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("");
    return text.length ? text : null;
  }
  const choices = Array.isArray(body.choices) ? body.choices : [];
  const first = choices.find((c) => isPlainObject(c) && isPlainObject(c.message));
  const content = first ? first.message.content : null;
  if (typeof content === "string" && content.length) return content;
  if (Array.isArray(content)) {
    const text = content
      .filter((p) => isPlainObject(p) && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
    if (text.length) return text;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Model text -> patch (fixture E's home)
// ---------------------------------------------------------------------------

/**
 * `parseModelOutput(text, liveSectionIds, options)` — the last gate before anything could
 * change: decode the model's answer, THEN validate it. The verdict has the same shape as
 * `validatePatch`, so Phase 4 branches on `ok` exactly once.
 *
 * A fenced block is REJECTED, not unwrapped. `buildRequest` asks for
 * `response_format: json_object` and the system rule says "no prose, no markdown fence", so
 * a fence means the model broke the contract — and unwrapping "Sure! {...} — done." is how
 * a partial answer becomes a partial apply. Refusing costs the user one retry; guessing
 * costs them their layout.
 */
function parseModelOutput(text, liveSectionIds, options) {
  const errors = [];
  const advisories = [];
  if (typeof text !== "string" || !text.trim()) {
    errors.push(finding("model_output_not_json", "$", "the model returned no text"));
    return verdict(errors, advisories, undefined, { liveIds: true, derivedWidth: false });
  }
  let candidate;
  try {
    candidate = JSON.parse(text.trim());
  } catch {
    errors.push(
      finding(
        "model_output_not_json",
        "$",
        "the model's answer is not a JSON object (" + describeValue(text.trim().slice(0, 60)) + ")",
      ),
    );
    return verdict(errors, advisories, undefined, { liveIds: true, derivedWidth: false });
  }
  return validatePatch(candidate, liveSectionIds, options);
}

// ---------------------------------------------------------------------------
// The module surface
// ---------------------------------------------------------------------------

const AiLayout = {
  PATCH_KEYS,
  PATCH_SECTION_KEYS,
  SECTION_CONTEXT_KEYS,
  PROVIDERS,
  ANTHROPIC_VERSION,
  DEFAULT_MAX_TOKENS,
  MAX_GEOMETRY_PX,
  MAX_INSTRUCTION_CHARS,
  // Test seam (track byok_ai_layout_20260915 — KEEP): the exact line the prompt uses to open the
  // table of legal section ids. `test/unit/ai_layout_schema.test.js` asserts the built prompt
  // carries THIS constant followed by every live id, which is the only way that check can compare
  // the prompt against the enum without re-typing the string (a re-typed copy drifts silently and
  // the test keeps passing while the prompt says something else). No product module reads it —
  // `buildMessages` is its only writer — so it is annotated rather than pretending to be used.
  SECTION_TABLE_MARKER,
  Z_ORDER_MIN,
  Z_ORDER_MAX,
  MIN_WIDTH_PX,
  ERROR_CLASSES,
  validatePatch,
  parseModelOutput,
  summarizePatch,
  buildMessages,
  buildRequest,
  parseResponse,
  redactCredentials,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = AiLayout;
}
// `window.AiLayout` — added by Phase 4 (track byok_ai_layout_20260915) in the SAME commit as its
// first product caller, `js/ai_arrange.js` (which reads `buildMessages`, `parseModelOutput`,
// `validatePatch` and `summarizePatch` off it). Until that commit this file published NO `window.*`
// seam, deliberately: the re-rot guard (`scripts/check_dead_exports.js`) fails a published seam
// with no reader, and Phase 1 had none. The page loads it through `js/background.js`'s
// `executeScript` file list; the worker reaches the same symbols through `importScripts`.
if (typeof window !== "undefined") {
  window.AiLayout = AiLayout;
}
