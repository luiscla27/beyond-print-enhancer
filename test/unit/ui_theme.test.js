"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const ROOT = path.resolve(__dirname, "..", "..");
const SRC = fs.readFileSync(path.join(ROOT, "js", "ui_theme.js"), "utf8");
const theme = require("../../js/ui_theme.js");
const CSS = theme.css;
const TOKENS = theme.tokens;
const EXPECTED_TOKENS = {
  groundPanel: "#191410",
  groundTray: "#221C16",
  groundWell: "#120D0A",
  groundModal: "#1E1813",
  seamDeep: "#0C0907",
  hairGold: "#4A3E2B",
  hairBone: "#2E2820",
  bone: "#E9DDC2",
  boneDim: "#CFC2A4",
  taupe: "#AB9F86",
  taupeFaint: "#7E7460",
  gold: "#C6A15B",
  goldHi: "#E9D6A4",
  goldShadow: "#6B5A36",
  goldInk: "#2A1F12",
  oxblood: "#5E1F1E",
  oxbloodDeep: "#3A1211",
  ember: "#D86A3D",
  emberDim: "#8A4430",
  rowHover: "#2A231B",
  rowSelected: "#2B1A17",
  rangeTrack: "#2E2820",
  rangeFill: "#6B5A36",
  thumb: "#E9DDC2",
  thumbRing: "#0C0907",
  thumbInner: "#4A3E2B",
  focusRing: "#E9D6A4",
  focusInk: "#0C0907",
  radius: "10px",
  radiusInner: "6px",
  shadowPanel: "0 6px 24px rgba(0,0,0,0.55)",
  fontDisplay: 'Cinzel, "Trajan Pro", "Cormorant Garamond", "Times New Roman", serif',
  fontTool: 'Inter, "Source Sans 3", system-ui, sans-serif',
};

describe("TOKENS palette — locked hex values", function () {
  it("exports every expected token with the exact locked value", function () {
    for (const [k, v] of Object.entries(EXPECTED_TOKENS)) assert.strictEqual(TOKENS[k], v, "TOKENS." + k);
  });
  it("exports no unexpected token keys", function () {
    assert.deepStrictEqual(Object.keys(TOKENS).sort(), Object.keys(EXPECTED_TOKENS).sort());
  });
  it("every color token is 6-digit hex uppercase", function () {
    for (const k of Object.keys(EXPECTED_TOKENS).filter((k) => EXPECTED_TOKENS[k].startsWith("#")))
      assert.match(TOKENS[k], /^#[0-9A-F]{6}$/, k);
  });
  it("radii and shadow tokens have expected units", function () {
    assert.match(TOKENS.radius, /^\d+px$/);
    assert.match(TOKENS.radiusInner, /^\d+px$/);
    assert.match(TOKENS.shadowPanel, /^0 6px 24px rgba\(0,0,0,0\.55\)$/);
  });
  it("font tokens contain expected families", function () {
    assert.ok(TOKENS.fontDisplay.includes("Cinzel"));
    assert.ok(TOKENS.fontTool.includes("Inter"));
  });
});

describe("no-new-hex discipline", function () {
  const allowedHex = new Set(
    Object.values(TOKENS)
      .filter((v) => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v))
      .map((v) => v.toLowerCase())
  );
  function hexesIn(str) {
    const c = str.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    return (c.match(/#[0-9A-Fa-f]{3,8}\b/g) || []).map((h) => h.toLowerCase());
  }
  it("emitted stylesheet contains only palette hexes", function () {
    const h = hexesIn(CSS);
    assert.ok(h.length > 20, "many hexes " + h.length);
    for (const x of h) assert.ok(allowedHex.has(x), x + " not palette");
  });
  it("source introduces no new hex outside TOKENS", function () {
    for (const x of hexesIn(SRC)) assert.ok(allowedHex.has(x), x);
  });
  it("no 3-digit shorthand or 8-digit alpha", function () {
    const hits = CSS.replace(/\/\*[\s\S]*?\*\//g, "").match(/#[0-9A-Fa-f]{3,8}\b/g) || [];
    for (const h of hits) assert.strictEqual(h.length, 7, h + " must be 6-digit");
  });
});

describe("THEME_CSS :root --be-* vars", function () {
  function rootBlock() {
    const m = CSS.match(/:root\s*\{([^}]*)\}/);
    assert.ok(m, ":root exists");
    return m[1];
  }
  const EXPECTED_VARS = {
    "--be-ground-panel": EXPECTED_TOKENS.groundPanel,
    "--be-ground-tray": EXPECTED_TOKENS.groundTray,
    "--be-ground-well": EXPECTED_TOKENS.groundWell,
    "--be-ground-modal": EXPECTED_TOKENS.groundModal,
    "--be-seam-deep": EXPECTED_TOKENS.seamDeep,
    "--be-hair-gold": EXPECTED_TOKENS.hairGold,
    "--be-hair-bone": EXPECTED_TOKENS.hairBone,
    "--be-bone": EXPECTED_TOKENS.bone,
    "--be-bone-dim": EXPECTED_TOKENS.boneDim,
    "--be-taupe": EXPECTED_TOKENS.taupe,
    "--be-taupe-faint": EXPECTED_TOKENS.taupeFaint,
    "--be-gold": EXPECTED_TOKENS.gold,
    "--be-gold-hi": EXPECTED_TOKENS.goldHi,
    "--be-gold-shadow": EXPECTED_TOKENS.goldShadow,
    "--be-gold-ink": EXPECTED_TOKENS.goldInk,
    "--be-oxblood": EXPECTED_TOKENS.oxblood,
    "--be-oxblood-deep": EXPECTED_TOKENS.oxbloodDeep,
    "--be-ember": EXPECTED_TOKENS.ember,
    "--be-ember-dim": EXPECTED_TOKENS.emberDim,
    "--be-row-hover": EXPECTED_TOKENS.rowHover,
    "--be-row-selected": EXPECTED_TOKENS.rowSelected,
    "--be-radius": EXPECTED_TOKENS.radius,
    "--be-radius-inner": EXPECTED_TOKENS.radiusInner,
    "--be-shadow-panel": EXPECTED_TOKENS.shadowPanel,
    "--be-font-display": EXPECTED_TOKENS.fontDisplay,
    "--be-font-tool": EXPECTED_TOKENS.fontTool,
    "--be-font-caps": "11px",
  };
  it("declares :root with all --be-* vars", function () {
    const r = rootBlock();
    for (const [k, v] of Object.entries(EXPECTED_VARS)) {
      const e = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.ok(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:\\s*" + e + "\\s*;").test(r), k);
    }
  });
  it("every :root var matches TOKENS (no drift)", function () {
    const r = rootBlock();
    const m = new Map();
    for (const l of r.split(";").map((s) => s.trim()).filter(Boolean)) {
      const x = l.match(/(--be-[a-z0-9-]+)\s*:\s*(.*)/);
      if (x) m.set(x[1], x[2].trim());
    }
    for (const [k, v] of Object.entries(EXPECTED_VARS)) assert.strictEqual(m.get(k), v, k);
  });
  it(":root exact set", function () {
    const f = [...rootBlock().matchAll(/(--be-[a-z0-9-]+)\s*:/g)].map((m) => m[1]).sort();
    assert.deepStrictEqual(f, Object.keys(EXPECTED_VARS).sort());
  });
  it("CSS substantial and starts with :root", function () {
    assert.ok(CSS.length > 10000);
    assert.ok(CSS.trim().startsWith(":root"));
  });
});

describe("injectTheme — style#ddb-print-ui-theme contract", function () {
  function bootFresh(h) {
    const html = h || "<!doctype html><html><head></head><body></body></html>";
    const d = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost" });
    d.window.eval(SRC);
    return d;
  }
  it("creates single <style id=\"ddb-print-ui-theme\"> in <head> with THEME_CSS", function () {
    const d = bootFresh();
    const e = d.window.document.getElementById("ddb-print-ui-theme");
    assert.ok(e);
    assert.strictEqual(e.tagName, "STYLE");
    assert.strictEqual(e.id, "ddb-print-ui-theme");
    assert.strictEqual(e.textContent, CSS);
    assert.strictEqual(e.parentNode, d.window.document.head);
  });
  it("idempotent — repeated calls do not duplicate", function () {
    const d = bootFresh();
    const prevDoc = global.document;
    const prevWin = global.window;
    try {
      global.document = d.window.document;
      global.window = d.window;
      theme.injectTheme();
      theme.injectTheme();
      theme.injectTheme();
    } finally {
      if (prevDoc === undefined) delete global.document;
      else global.document = prevDoc;
      if (prevWin === undefined) delete global.window;
      else global.window = prevWin;
    }
    assert.strictEqual(d.window.document.querySelectorAll("#ddb-print-ui-theme").length, 1);
    assert.strictEqual(d.window.document.getElementById("ddb-print-ui-theme").textContent, CSS);
  });
  it("head guard — fail-open when head falsy", function () {
    const sD = global.document, sW = global.window;
    try {
      global.document = { getElementById: () => null, head: null, createElement: () => { throw new Error("x"); } };
      assert.doesNotThrow(() => theme.injectTheme());
    } finally {
      if (sD === undefined) delete global.document; else global.document = sD;
      if (sW === undefined) delete global.window; else global.window = sW;
    }
    let s2 = global.document;
    try {
      global.document = { getElementById: () => null, createElement: () => { throw new Error("x"); } };
      assert.doesNotThrow(() => theme.injectTheme());
    } finally {
      if (s2 === undefined) delete global.document; else global.document = s2;
    }
    let s3 = global.document;
    try {
      delete global.document;
      assert.doesNotThrow(() => { if (typeof global.document === "undefined") theme.injectTheme(); });
    } finally {
      if (s3 !== undefined) global.document = s3;
    }
  });
  it("no extra attributes, direct child of head", function () {
    const e = bootFresh().window.document.getElementById("ddb-print-ui-theme");
    assert.strictEqual(e.getAttribute("type"), null);
    assert.strictEqual(e.className, "");
    assert.strictEqual(e.parentNode.tagName, "HEAD");
  });
  it("injectTheme is function and auto-runs", function () {
    assert.strictEqual(typeof theme.injectTheme, "function");
    assert.ok(bootFresh().window.document.getElementById("ddb-print-ui-theme"));
  });
});

describe("module.exports shape", function () {
  it("exports exactly { injectTheme, tokens, css, tiers, ornament }", function () {
    assert.deepStrictEqual(Object.keys(theme).sort(), ["css", "injectTheme", "ornament", "tiers", "tokens"].sort());
  });
  it("tokens/css/tiers types and identities", function () {
    assert.strictEqual(typeof theme.tokens, "object");
    assert.strictEqual(theme.css, CSS);
    assert.strictEqual(typeof theme.injectTheme, "function");
    assert.ok(theme.css.length > 10000);
  });
  it("tiers numeric heights", function () {
    const t = theme.tiers;
    for (const k of ["action", "icon", "chip", "input", "row", "compactIcon"]) assert.strictEqual(typeof t[k], "number", k);
    assert.strictEqual(t.action, 32);
    assert.strictEqual(t.icon, 28);
    assert.strictEqual(t.chip, 22);
    assert.strictEqual(t.input, 32);
    assert.strictEqual(t.row, 40);
    assert.strictEqual(t.compactIcon, 22);
  });
  it("ornament primitives + corners + surfaces + helpers", function () {
    const o = theme.ornament;
    assert.strictEqual(o.stroke, TOKENS.gold);
    assert.strictEqual(o.highlight, TOKENS.goldHi);
    assert.strictEqual(o.innerPanel, TOKENS.hairGold);
    assert.strictEqual(o.innerModal, TOKENS.goldShadow);
    assert.deepStrictEqual(o.corners, { all: ["tl", "tr", "bl", "br"], top: ["tl", "tr"] });
    assert.ok(Array.isArray(o.surfaces.full) && o.surfaces.full.length === 3);
    assert.ok(Array.isArray(o.surfaces.quiet));
    assert.ok(Array.isArray(o.surfaces.plain));
    assert.strictEqual(typeof o.cornerLayers, "function");
    assert.strictEqual(typeof o.surface, "function");
  });
  it("no extra exports and no window pollution", function () {
    assert.strictEqual(Object.keys(theme).length, 5);
    const d = new JSDOM("<!doctype html><html><head></head><body></body></html>", { runScripts: "outside-only", url: "http://localhost" });
    d.window.eval(SRC);
    assert.strictEqual(typeof d.window.UiTheme, "undefined");
  });
});

describe("visual-consistency seams", function () {
  it("derived TOKENS aliases consistent", function () {
    assert.strictEqual(TOKENS.rangeTrack, TOKENS.hairBone);
    assert.strictEqual(TOKENS.rangeFill, TOKENS.goldShadow);
    assert.strictEqual(TOKENS.thumb, TOKENS.bone);
    assert.strictEqual(TOKENS.thumbRing, TOKENS.seamDeep);
    assert.strictEqual(TOKENS.thumbInner, TOKENS.hairGold);
    assert.strictEqual(TOKENS.focusRing, TOKENS.goldHi);
    assert.strictEqual(TOKENS.focusInk, TOKENS.seamDeep);
  });
  it("every CSS hex is palette hex (no drift)", function () {
    const p = new Set(Object.values(TOKENS).filter((v) => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v)).map((v) => v.toLowerCase()));
    const c = new Set((CSS.match(/#[0-9A-Fa-f]{6}\b/g) || []).map((h) => h.toLowerCase()));
    for (const h of c) assert.ok(p.has(h), h);
    assert.ok(c.size >= 10, "css distinct " + c.size);
  });
  it("ornament primitives palette-only", function () {
    const p = new Set(Object.values(TOKENS).filter((v) => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v)).map((v) => v.toLowerCase()));
    for (const k of ["stroke", "highlight", "innerPanel", "innerModal"]) assert.ok(p.has(theme.ornament[k].toLowerCase()), k);
  });
  it("THEME_CSS references TOKENS values", function () {
    assert.ok(CSS.includes(TOKENS.focusRing));
    assert.ok(CSS.includes(TOKENS.bone));
    assert.ok(CSS.includes(TOKENS.groundPanel));
  });
});
