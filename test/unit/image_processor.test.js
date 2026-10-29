"use strict";

const assert = require("assert");
const { boot } = require("./encapsulation_debt/debt_harness.js");

// Helpers to control browser seams without touching production code.
function mockFileReader(window, resultB64, shouldError) {
  const Original = window.FileReader;
  class MockReader {
    constructor() { this.onload = null; this.onerror = null; this.result = null; }
    readAsDataURL() {
      if (shouldError) {
        if (typeof this.onerror === "function") this.onerror(new Error("read error"));
        return;
      }
      this.result = resultB64;
      if (typeof this.onload === "function") this.onload({ target: { result: resultB64 } });
    }
  }
  window.FileReader = MockReader;
  global.FileReader = MockReader;
  return () => { window.FileReader = Original; global.FileReader = Original; };
}

function mockImage(window, { width, height, shouldError } = {}) {
  const Original = window.Image;
  let lastInstance = null;
  class MockImage {
    constructor() {
      this._src = "";
      this.onload = null;
      this.onerror = null;
      this.width = width != null ? width : 1600;
      this.height = height != null ? height : 900;
      lastInstance = this;
    }
    set src(v) {
      this._src = v;
      // async tick to mimic real Image
      setTimeout(() => {
        if (shouldError) {
          if (typeof this.onerror === "function") this.onerror(new Error("img error"));
        } else {
          if (typeof this.onload === "function") this.onload();
        }
      }, 0);
    }
    get src() { return this._src; }
  }
  window.Image = MockImage;
  global.Image = MockImage;
  return {
    restore() { window.Image = Original; global.Image = Original; },
    get last() { return lastInstance; }
  };
}

function mockCanvas(window, capture) {
  // capture = { width, height, drawArgs, toDataURLArgs }
  let canvasEl = null;
  let ctx = null;
  const orig = window.document.createElement;
  window.document.createElement = function(tag) {
    if (tag.toLowerCase() !== "canvas") return orig.call(window.document, tag);
    canvasEl = orig.call(window.document, tag);
    // stub getContext
    ctx = {
      drawImageArgs: null,
      drawImage(...args) { this.drawImageArgs = args; if (capture) capture.drawArgs = args; },
    };
    canvasEl.getContext = () => ctx;
    canvasEl.toDataURL = function(type, quality) {
      if (capture) { capture.toDataURLArgs = [type, quality]; capture.width = canvasEl.width; capture.height = canvasEl.height; }
      return "data:image/webp;base64,compressed-mock";
    };
    // allow width/height setting
    return canvasEl;
  };
  return {
    restore() { window.document.createElement = orig; },
    get canvas() { return canvasEl; },
    get ctx() { return ctx; }
  };
}

function bootRooted() {
  return boot('<!DOCTYPE html><html><body><div id="print-layout-wrapper"></div></body></html>');
}

// ---------------------------------------------------------------------------
// constants & harness boot
// ---------------------------------------------------------------------------
describe("feature_18_image_processor — constants & boot", function () {
  let ctx;
  beforeEach(function () { ctx = bootRooted(); });
  afterEach(function () { ctx.cleanup(); });

  it("exposes ImageProcessor on window with expected thresholds", function () {
    const ip = ctx.window.ImageProcessor;
    assert.ok(ip, "window.ImageProcessor should exist");
    assert.strictEqual(ip.MAX_SIZE_BYTES, 750 * 1024);
    assert.strictEqual(ip.TARGET_WIDTH, 1200);
    assert.strictEqual(typeof ip.processImage, "function");
    assert.strictEqual(typeof ip.compress, "function");
  });

  it("module.exports is the same object when required in node (smoke)", function () {
    const direct = require("../../js/image_processor.js");
    assert.strictEqual(direct.MAX_SIZE_BYTES, 750 * 1024);
    assert.strictEqual(direct.TARGET_WIDTH, 1200);
  });
});

// ---------------------------------------------------------------------------
// processImage — small file (no compression)
// ---------------------------------------------------------------------------
describe("feature_18_image_processor — processImage small file", function () {
  let ctx;
  beforeEach(function () { ctx = bootRooted(); });
  afterEach(function () { ctx.cleanup(); });

  it("resolves with base64 directly when file.size <= MAX_SIZE_BYTES", async function () {
    const b64 = "data:image/png;base64,small";
    const restoreFR = mockFileReader(ctx.window, b64, false);
    const file = { name: "small.png", size: 1000, type: "image/png" };
    const result = await ctx.window.ImageProcessor.processImage(file);
    assert.strictEqual(result, b64);
    restoreFR();
  });

  it("resolves without calling compress or confirm when small", async function () {
    const b64 = "data:image/png;base64,small2";
    const restoreFR = mockFileReader(ctx.window, b64, false);
    let compressCalled = false;
    const origCompress = ctx.window.ImageProcessor.compress;
    ctx.window.ImageProcessor.compress = async () => { compressCalled = true; return "x"; };
    let confirmCalled = false;
    const origConfirm = ctx.window.confirmAction;
    ctx.window.confirmAction = async () => { confirmCalled = true; return true; };
    // Also guard native confirm
    const origNative = ctx.window.confirm;
    ctx.window.confirm = () => { confirmCalled = true; return true; };
    const file = { name: "tiny.jpg", size: 500, type: "image/jpeg" };
    const result = await ctx.window.ImageProcessor.processImage(file);
    assert.strictEqual(result, b64);
    assert.strictEqual(compressCalled, false);
    assert.strictEqual(confirmCalled, false);
    ctx.window.ImageProcessor.compress = origCompress;
    if (origConfirm) ctx.window.confirmAction = origConfirm; else delete ctx.window.confirmAction;
    ctx.window.confirm = origNative;
    restoreFR();
  });

  it("resolves when size exactly equals MAX_SIZE_BYTES (boundary)", async function () {
    const b64 = "data:image/png;base64,boundary";
    const restoreFR = mockFileReader(ctx.window, b64, false);
    const file = { name: "boundary.png", size: ctx.window.ImageProcessor.MAX_SIZE_BYTES, type: "image/png" };
    const result = await ctx.window.ImageProcessor.processImage(file);
    assert.strictEqual(result, b64);
    restoreFR();
  });

  it("rejects when FileReader errors", async function () {
    const restoreFR = mockFileReader(ctx.window, null, true);
    const file = { name: "err.png", size: 100, type: "image/png" };
    await assert.rejects(() => ctx.window.ImageProcessor.processImage(file));
    restoreFR();
  });
});

// ---------------------------------------------------------------------------
// processImage — large file (compression path)
// ---------------------------------------------------------------------------
describe("feature_18_image_processor — processImage large file (compression)", function () {
  let ctx;
  beforeEach(function () { ctx = bootRooted(); });
  afterEach(function () { ctx.cleanup(); });

  it("asks for confirmation and compresses when file is large (confirm true)", async function () {
    const b64 = "data:image/png;base64,large-original";
    const restoreFR = mockFileReader(ctx.window, b64, false);
    ctx.window.confirmAction = async (opts) => {
      assert.ok(opts.title && opts.title.includes("Compress"), "confirm title should mention Compress");
      assert.ok(opts.message && opts.message.includes("large-original") === false, "message should contain file info");
      // check message contains file name and size
      assert.match(opts.message, /large\.png/);
      return true;
    };
    // stub compress to return known value
    const origCompress = ctx.window.ImageProcessor.compress;
    ctx.window.ImageProcessor.compress = async (input) => {
      assert.strictEqual(input, b64);
      return "data:image/webp;base64,compressed-mock";
    };
    const file = { name: "large.png", size: 2 * 1024 * 1024, type: "image/png" };
    const result = await ctx.window.ImageProcessor.processImage(file);
    assert.strictEqual(result, "data:image/webp;base64,compressed-mock");
    ctx.window.ImageProcessor.compress = origCompress;
    delete ctx.window.confirmAction;
    restoreFR();
  });

  it("rejects with User cancelled when confirm returns false", async function () {
    const b64 = "data:image/png;base64,large2";
    const restoreFR = mockFileReader(ctx.window, b64, false);
    ctx.window.confirmAction = async () => false;
    const file = { name: "large2.png", size: 900 * 1024, type: "image/png" };
    await assert.rejects(() => ctx.window.ImageProcessor.processImage(file), (err) => {
      assert.match(err.message, /User cancelled/);
      return true;
    });
    delete ctx.window.confirmAction;
    restoreFR();
  });

  it("falls back to window.confirm when confirmAction absent (native path)", async function () {
    const b64 = "data:image/png;base64,fallback";
    const restoreFR = mockFileReader(ctx.window, b64, false);
    delete ctx.window.confirmAction;
    let nativeCalled = false;
    ctx.window.confirm = (text) => {
      nativeCalled = true;
      assert.ok(text.includes("Compress") || text.includes("large"), "native text should contain context");
      return true;
    };
    const origCompress = ctx.window.ImageProcessor.compress;
    ctx.window.ImageProcessor.compress = async () => "data:image/webp;base64,ok";
    const file = { name: "fallback.png", size: 800 * 1024, type: "image/png" };
    const result = await ctx.window.ImageProcessor.processImage(file);
    assert.strictEqual(result, "data:image/webp;base64,ok");
    assert.strictEqual(nativeCalled, true);
    ctx.window.ImageProcessor.compress = origCompress;
    restoreFR();
  });

  it("rejects when compress throws (propagation)", async function () {
    const b64 = "data:image/png;base64,large3";
    const restoreFR = mockFileReader(ctx.window, b64, false);
    ctx.window.confirmAction = async () => true;
    const origCompress = ctx.window.ImageProcessor.compress;
    ctx.window.ImageProcessor.compress = async () => { throw new Error("canvas failed"); };
    const file = { name: "large3.png", size: 900 * 1024, type: "image/png" };
    await assert.rejects(() => ctx.window.ImageProcessor.processImage(file), (err) => {
      assert.match(err.message, /canvas failed/);
      return true;
    });
    ctx.window.ImageProcessor.compress = origCompress;
    delete ctx.window.confirmAction;
    restoreFR();
  });

  it("returns false when neither confirmAction nor window.confirm exists", async function () {
    const b64 = "data:image/png;base64,no-confirm";
    const restoreFR = mockFileReader(ctx.window, b64, false);
    delete ctx.window.confirmAction;
    const origConfirm = ctx.window.confirm;
    // remove confirm
    ctx.window.confirm = undefined;
    // Also ensure global confirm not present via window
    const file = { name: "noconfirm.png", size: 900 * 1024, type: "image/png" };
    await assert.rejects(() => ctx.window.ImageProcessor.processImage(file), (err) => {
      assert.match(err.message, /User cancelled/);
      return true;
    });
    ctx.window.confirm = origConfirm;
    restoreFR();
  });
});

// ---------------------------------------------------------------------------
// imageProcessorAskConfirm — exercised via processImage (helper not on window)
// ---------------------------------------------------------------------------
// The helper is intentionally not on window: image_processor.js declares
// `function imageProcessorAskConfirm` inside an eval'd string that begins with
// `"use strict";`, so jsdom's window.eval does not leak block-scoped function
// declarations to the global. We therefore exercise the same four behaviours
// through the public seam that calls the helper (processImage's large-file path)
// — no production code modified, real thresholds/commit.
// ---------------------------------------------------------------------------
describe("feature_18_image_processor — confirm helper via processImage", function () {
  let ctx;
  beforeEach(function () { ctx = bootRooted(); });
  afterEach(function () { ctx.cleanup(); });

  it("prefers window.confirmAction — opts carry title/message/label", async function () {
    const b64 = "data:image/png;base64,helper1";
    const restoreFR = mockFileReader(ctx.window, b64, false);
    let optsSeen = null;
    ctx.window.confirmAction = async (opts) => { optsSeen = opts; return true; };
    const origCompress = ctx.window.ImageProcessor.compress;
    ctx.window.ImageProcessor.compress = async () => "data:image/webp;base64,ok1";
    const file = { name: "helper1.png", size: 900 * 1024, type: "image/png" };
    await ctx.window.ImageProcessor.processImage(file);
    assert.ok(optsSeen, "confirmAction should be called");
    assert.ok(optsSeen.title && optsSeen.title.includes("Compress"));
    assert.ok(optsSeen.message && optsSeen.message.includes("helper1.png"));
    assert.strictEqual(optsSeen.confirmLabel, "Continue");
    ctx.window.ImageProcessor.compress = origCompress;
    delete ctx.window.confirmAction;
    restoreFR();
  });

  it("falls back to window.confirm with title+message concatenation", async function () {
    const b64 = "data:image/png;base64,helper2";
    const restoreFR = mockFileReader(ctx.window, b64, false);
    delete ctx.window.confirmAction;
    let nativeText = null;
    ctx.window.confirm = (t) => { nativeText = t; return true; };
    const origCompress = ctx.window.ImageProcessor.compress;
    ctx.window.ImageProcessor.compress = async () => "data:image/webp;base64,ok2";
    const file = { name: "helper2.png", size: 900 * 1024, type: "image/png" };
    await ctx.window.ImageProcessor.processImage(file);
    assert.ok(nativeText && nativeText.includes("Compress this image?"), "native text should contain title");
    assert.ok(nativeText.includes("helper2.png"), "native text should contain file info");
    ctx.window.ImageProcessor.compress = origCompress;
    restoreFR();
  });

  it("large file without any confirm primitive resolves to cancelled (false)", async function () {
    const b64 = "data:image/png;base64,helper3";
    const restoreFR = mockFileReader(ctx.window, b64, false);
    delete ctx.window.confirmAction;
    const origConfirm = ctx.window.confirm;
    ctx.window.confirm = undefined;
    const file = { name: "helper3.png", size: 900 * 1024, type: "image/png" };
    await assert.rejects(() => ctx.window.ImageProcessor.processImage(file), (err) => {
      assert.match(err.message, /User cancelled/);
      return true;
    });
    ctx.window.confirm = origConfirm;
    restoreFR();
  });

  it("message fallback uses file info even when title missing — via processImage opts", async function () {
    // processImage always passes both title and message; verify message contains KB and name
    const b64 = "data:image/png;base64,helper4";
    const restoreFR = mockFileReader(ctx.window, b64, false);
    let msg = null;
    ctx.window.confirmAction = async (opts) => { msg = opts.message; return true; };
    const origCompress = ctx.window.ImageProcessor.compress;
    ctx.window.ImageProcessor.compress = async () => "data:image/webp;base64,ok4";
    const file = { name: "helper4.png", size: 800 * 1024, type: "image/png" };
    await ctx.window.ImageProcessor.processImage(file);
    assert.ok(msg.includes("helper4.png"));
    assert.ok(msg.includes("KB"));
    assert.ok(msg.includes("resized and compressed"));
    ctx.window.ImageProcessor.compress = origCompress;
    delete ctx.window.confirmAction;
    restoreFR();
  });
});

// ---------------------------------------------------------------------------
// compress — canvas scaling & export
// ---------------------------------------------------------------------------
describe("feature_18_image_processor — compress canvas path", function () {
  let ctx;
  beforeEach(function () { ctx = bootRooted(); });
  afterEach(function () { ctx.cleanup(); });

  it("scales down when width > TARGET_WIDTH, preserves aspect", async function () {
    const capture = {};
    const restoreCanvas = mockCanvas(ctx.window, capture);
    const imgMock = mockImage(ctx.window, { width: 2400, height: 1200, shouldError: false });
    const b64 = "data:image/png;base64,input";
    const result = await ctx.window.ImageProcessor.compress(b64);
    assert.strictEqual(result, "data:image/webp;base64,compressed-mock");
    assert.strictEqual(capture.width, 1200);
    assert.strictEqual(capture.height, 600);
    // drawImage should be called with scaled dims
    assert.ok(capture.drawArgs, "drawImage should be called");
    assert.strictEqual(capture.drawArgs[1], 0);
    assert.strictEqual(capture.drawArgs[2], 0);
    assert.strictEqual(capture.drawArgs[3], 1200);
    assert.strictEqual(capture.drawArgs[4], 600);
    // toDataURL args
    assert.deepStrictEqual(capture.toDataURLArgs, ["image/webp", 0.8]);
    restoreCanvas.restore();
    imgMock.restore();
  });

  it("does not scale when width <= TARGET_WIDTH", async function () {
    const capture = {};
    const restoreCanvas = mockCanvas(ctx.window, capture);
    const imgMock = mockImage(ctx.window, { width: 800, height: 600, shouldError: false });
    const b64 = "data:image/png;base64,input2";
    const result = await ctx.window.ImageProcessor.compress(b64);
    assert.strictEqual(result, "data:image/webp;base64,compressed-mock");
    assert.strictEqual(capture.width, 800);
    assert.strictEqual(capture.height, 600);
    restoreCanvas.restore();
    imgMock.restore();
  });

  it("does not scale when width exactly equals TARGET_WIDTH", async function () {
    const capture = {};
    const restoreCanvas = mockCanvas(ctx.window, capture);
    const imgMock = mockImage(ctx.window, { width: 1200, height: 800, shouldError: false });
    const b64 = "data:image/png;base64,boundary";
    const result = await ctx.window.ImageProcessor.compress(b64);
    assert.ok(result, "compress returned a data URL");
    assert.strictEqual(capture.width, 1200);
    assert.strictEqual(capture.height, 800);
    restoreCanvas.restore();
    imgMock.restore();
  });

  it("sets canvas.width/height before drawing", async function () {
    const order = [];
    let canvasEl = null;
    const origCE = ctx.window.document.createElement;
    ctx.window.document.createElement = function(tag) {
      if (tag.toLowerCase() !== "canvas") return origCE.call(ctx.window.document, tag);
      canvasEl = origCE.call(ctx.window.document, tag);
      // intercept via proxy: record order of assignments vs draw
      let _w = 0, _h = 0;
      Object.defineProperty(canvasEl, "width", { get() { return _w; }, set(v) { _w = v; order.push(`width=${v}`); }, configurable: true });
      Object.defineProperty(canvasEl, "height", { get() { return _h; }, set(v) { _h = v; order.push(`height=${v}`); }, configurable: true });
      canvasEl.getContext = () => ({ drawImage() { order.push("draw"); } });
      canvasEl.toDataURL = () => "data:image/webp;base64,compressed-mock";
      return canvasEl;
    };
    const imgMock = mockImage(ctx.window, { width: 2000, height: 1000 });
    await ctx.window.ImageProcessor.compress("data:image/png;base64,order");
    assert.ok(order.indexOf("width=1200") < order.indexOf("draw"), "width set before draw");
    assert.ok(order.indexOf("height=600") < order.indexOf("draw"), "height set before draw");
    ctx.window.document.createElement = origCE;
    imgMock.restore();
  });

  it("rejects when Image fails to load", async function () {
    const capture = {};
    const restoreCanvas = mockCanvas(ctx.window, capture);
    const imgMock = mockImage(ctx.window, { width: 100, height: 100, shouldError: true });
    await assert.rejects(() => ctx.window.ImageProcessor.compress("data:image/png;base64,bad"));
    restoreCanvas.restore();
    imgMock.restore();
  });

  it("sets img.src to the input base64", async function () {
    const capture = {};
    const restoreCanvas = mockCanvas(ctx.window, capture);
    let seenSrc = null;
    const Original = ctx.window.Image;
    class SrcCaptureImage {
      constructor() { this.onload = null; this.onerror = null; this.width = 500; this.height = 500; }
      set src(v) { seenSrc = v; setTimeout(() => this.onload && this.onload(), 0); }
      get src() { return seenSrc; }
    }
    ctx.window.Image = SrcCaptureImage;
    global.Image = SrcCaptureImage;
    const input = "data:image/png;base64,src-capture";
    await ctx.window.ImageProcessor.compress(input);
    assert.strictEqual(seenSrc, input);
    ctx.window.Image = Original;
    global.Image = Original;
    restoreCanvas.restore();
  });

  it("handles tall image scaling correctly (ratio from width)", async function () {
    const capture = {};
    const restoreCanvas = mockCanvas(ctx.window, capture);
    const imgMock = mockImage(ctx.window, { width: 2400, height: 4800 });
    await ctx.window.ImageProcessor.compress("data:image/png;base64,tall");
    // ratio 0.5 => 1200 x 2400
    assert.strictEqual(capture.width, 1200);
    assert.strictEqual(capture.height, 2400);
    restoreCanvas.restore();
    imgMock.restore();
  });
});

// ---------------------------------------------------------------------------
// integration: upload flow via shape_picker seam (optional, not required for cert)
// ---------------------------------------------------------------------------
describe("feature_18_image_processor — integration with upload flow seam", function () {
  let ctx;
  beforeEach(function () { ctx = bootRooted(); });
  afterEach(function () { ctx.cleanup(); });

  it("processImage result can be a data URL consumed by shape_picker upload", async function () {
    const b64 = "data:image/png;base64,integ";
    const restoreFR = mockFileReader(ctx.window, b64, false);
    const file = { name: "integ.png", size: 100, type: "image/png" };
    const data = await ctx.window.ImageProcessor.processImage(file);
    assert.ok(data.startsWith("data:image/"), "should be data URL");
    restoreFR();
  });
});
