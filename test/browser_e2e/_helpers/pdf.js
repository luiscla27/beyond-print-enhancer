/**
 * PDF OUTPUT instruments for the browser-e2e harness (issue
 * `print_output_never_assessed_20260911`).
 *
 * WHY THIS EXISTS. Every print-related suite in this repo asserts print *configuration* through the
 * DOM — "the layer container carries data-print-disabled", "the injected @media print CSS has a hide
 * rule". None of them has ever looked at what actually comes out of the printer. This module closes
 * that gap: it takes a REAL pdf (the bytes `page.pdf()` produced, i.e. the printer's input) and
 * measures it as a PAGE, in the page's own coordinate system.
 *
 * HOW. There is no PDF rasteriser on this machine (no poppler, no ghostscript, no ImageMagick) and
 * `sharp`'s libvips is built without PDF input — measured, it answers "Input file contains
 * unsupported image format". Chromium will not render a PDF either (`page.goto(file://x.pdf)`
 * downloads it; the headless build ships no PDF viewer — also measured). So the rasteriser is
 * pdf.js, pinned as a devDependency, run inside a Chromium page that a dependency-free static
 * server feeds over http (module specifiers need a hierarchical origin, so `page.setContent` at
 * about:blank cannot import it — measured).
 *
 * WHAT IT REPORTS, and why each number is the one that answers a question:
 *   * page box (pt)            — Letter or not, per the PDF's own MediaBox.
 *   * ink box (pt, x/y/w/h)    — where the printed marks actually sit on the sheet. This is the
 *                                PAGE-REGION measurement Phase 2 could not take (it had only byte
 *                                size), and it is what makes the margins claim checkable.
 *   * ink coverage             — how much of the sheet is marked. The honest metric behind
 *                                "does Background graphics: deselect still print a correct sheet".
 *   * saturated pixels + max chroma — whether there is COLOUR in the output at all, which decides
 *                                whether the documented "Colour: black and white" costs anything.
 *   * text box (pt)            — the text-only extent, so graphics can be told from type.
 *   * horizontal ink runs      — the count of separated ink bands down the page, i.e. whether page
 *                                separators/rule lines exist in the OUTPUT rather than in the CSS.
 */
"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

const EXT_ROOT = path.resolve(__dirname, "..", "..", "..");
const PDFJS_DIR = "/node_modules/pdfjs-dist/legacy/build";

const MIME = {
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".pdf": "application/pdf",
  ".html": "text/html",
  ".css": "text/css",
  ".png": "image/png",
};

/** A static file server rooted at the repo, plus the in-memory page that drives pdf.js. */
function startStaticServer(root = EXT_ROOT) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    if (rel === "__audit_raster.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(RASTER_HTML);
      return;
    }
    const file = path.resolve(root, rel);
    // Path containment: a served file must live under the root.
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

/**
 * The rasteriser page. It loads a PDF, renders every page into a canvas at a known scale, and
 * measures each rendered page from its OWN PIXELS (not from the PDF's object model) so the numbers
 * describe what a printer would put on paper.
 *
 * THRESHOLD CHOICE. "Ink" is a pixel meaningfully darker or more colourful than paper: luminance
 * below 250/255 on any channel, or chroma above 8. A blank Letter page rendered by pdf.js has
 * (255,255,255) everywhere — asserted by `blankPageControl()` in the spec, so the threshold cannot
 * quietly count anti-aliasing haze as content.
 */
const RASTER_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #888; }
  canvas { display: block; margin: 8px auto; background: #fff; }
</style></head><body><div id="host"></div>
<script type="module">
import * as pdfjs from '${PDFJS_DIR}/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = '${PDFJS_DIR}/pdf.worker.min.mjs';

const INK_LUMA = 250;   // any channel below this is "marked"
const INK_CHROMA = 8;   // ...or a channel spread above this

window.__raster = async function (pdfUrl, pixelRatio) {
  const doc = await pdfjs.getDocument({ url: pdfUrl }).promise;
  const host = document.getElementById('host');
  host.innerHTML = '';
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const box = p.getViewport({ scale: 1 });           // PDF points
    const vp = p.getViewport({ scale: pixelRatio });   // device pixels
    const c = document.createElement('canvas');
    c.width = Math.floor(vp.width);
    c.height = Math.floor(vp.height);
    c.dataset.page = String(i);
    host.appendChild(c);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    await p.render({ canvasContext: g, viewport: vp }).promise;

    const { width: W, height: H } = c;
    const d = g.getImageData(0, 0, W, H).data;
    let minX = W, minY = H, maxX = -1, maxY = -1, ink = 0, sat = 0, maxChroma = 0;
    let sumR = 0, sumG = 0, sumB = 0, inkR = 0, inkG = 0, inkB = 0;
    const rowInk = new Int32Array(H);
    for (let y = 0; y < H; y++) {
      let rowCount = 0;
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4;
        const r = d[o], gg = d[o + 1], b = d[o + 2];
        sumR += r; sumG += gg; sumB += b;
        const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        const chroma = mx - mn;
        if (chroma > maxChroma) maxChroma = chroma;
        const marked = mn < INK_LUMA || chroma > INK_CHROMA;
        if (marked) {
          ink++; rowCount++;
          if (chroma > INK_CHROMA) sat++;
          inkR += r; inkG += gg; inkB += b;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      rowInk[y] = rowCount;
    }

    // Ink bands down the page: contiguous runs of rows that carry marks. A page separator is a band
    // that exists in the OUTPUT; a band count is a fact, an interpretation is left to the report.
    const bands = [];
    let start = -1;
    for (let y = 0; y <= H; y++) {
      const on = y < H && rowInk[y] > 0;
      if (on && start < 0) start = y;
      if (!on && start >= 0) { bands.push([start, y - 1]); start = -1; }
    }

    // The text extent, in the page's own points. A TextItem's transform is the raw PDF text matrix
    // (y-up, bottom-left origin) while its width/height are already viewport units -- mixing the two
    // measures nonsense (it produced a 1090pt-wide box on a 612pt page). So transform first, through
    // pdf.js's own viewport matrix, then scale.
    const textBox = { x: null, y: null, w: 0, h: 0 };
    const items = (await p.getTextContent()).items.filter((t) => t.str && t.str.trim());
    if (items.length) {
      let tx0 = Infinity, ty0 = Infinity, tx1 = -Infinity, ty1 = -Infinity;
      for (const t of items) {
        const m = pdfjs.Util.transform(box.transform, t.transform);
        const h = Math.abs(t.height) || Math.abs(m[3]) || 10;
        const w = Math.abs(t.width) || 10;
        tx0 = Math.min(tx0, m[4]);
        ty0 = Math.min(ty0, m[5] - h);
        tx1 = Math.max(tx1, m[4] + w);
        ty1 = Math.max(ty1, m[5]);
      }
      const k = pixelRatio;
      textBox.x = tx0 * k; textBox.y = ty0 * k;
      textBox.w = (tx1 - tx0) * k; textBox.h = (ty1 - ty0) * k;
    }

    const pt = (v) => Math.round((v / pixelRatio) * 100) / 100;
    pages.push({
      page: i,
      px: [W, H],
      pageBoxPt: [box.width, box.height],
      inkPx: ink,
      coverage: Math.round((ink / (W * H)) * 10000) / 100,
      saturatedPx: sat,
      maxChroma,
      inkBoxPt: maxX < 0 ? null : { x: pt(minX), y: pt(minY), w: pt(maxX - minX + 1), h: pt(maxY - minY + 1) },
      marginsPt: maxX < 0 ? null : {
        left: pt(minX),
        top: pt(minY),
        right: pt(W - 1 - maxX),
        bottom: pt(H - 1 - maxY),
      },
      textBoxPt: textBox.x === null ? null : { x: pt(textBox.x), y: pt(textBox.y), w: pt(textBox.w), h: pt(textBox.h) },
      textItems: items.length,
      inkBands: bands.length,
      inkBandPt: bands.slice(0, 40).map(([a, b2]) => [pt(a), pt(b2)]),
      inkMean: ink ? [Math.round(inkR / ink), Math.round(inkG / ink), Math.round(inkB / ink)] : null,
      paperMean: [Math.round(sumR / (W * H)), Math.round(sumG / (W * H)), Math.round(sumB / (W * H))],
    });
  }
  return pages;
};
window.__rasterReady = true;
</script></body></html>`;

/**
 * Render every page of `pdfPath` to a PNG AND to per-page measurements.
 *
 * `pdfPath` must live under the repo root (that is what the static server can reach); callers pass
 * a path under `temp/`, which is where generated artifacts belong.
 */
async function measurePdf(page, { pdfPath, outDir, pixelRatio = 2, prefix = "page" }) {
  const abs = path.resolve(pdfPath);
  if (!abs.startsWith(EXT_ROOT)) {
    throw new Error(`measurePdf: ${abs} is outside the repo root, so the rasteriser cannot serve it`);
  }
  const { server, port } = await startStaticServer();
  const rel = "/" + path.relative(EXT_ROOT, abs).split(path.sep).join("/");
  try {
    await page.goto(`http://127.0.0.1:${port}/__audit_raster.html`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__rasterReady, { timeout: 60000 });
    const pages = await page.evaluate(
      ({ url, k }) => window.__raster(url, k),
      { url: `http://127.0.0.1:${port}${rel}`, k: pixelRatio },
    );
    const shots = [];
    if (outDir) {
      fs.mkdirSync(outDir, { recursive: true });
      for (let i = 1; i <= pages.length; i++) {
        const file = path.join(outDir, `${prefix}-${String(i).padStart(2, "0")}.png`);
        await page
          .locator(`canvas[data-page="${i}"]`)
          .screenshot({ path: file });
        shots.push(file);
      }
    }
    return { pages, shots };
  } finally {
    server.close();
  }
}

module.exports = { measurePdf, startStaticServer, EXT_ROOT };
