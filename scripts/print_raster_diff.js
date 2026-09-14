"use strict";
/**
 * Per-page pixel diff of two printed-page rasters (mean absolute channel difference and the share of
 * changed samples). Used to size how local a print-output change is.
 *
 *   node scripts/print_raster_diff.js <before> <after> [NN ...]
 * `<before>`/`<after>` are either a DIRECTORY (joined as `<dir>/page-<NN>.png`) or a FILE PATTERN
 * containing `NN` (e.g. `pages/after-wired-page-NN.png`), because this project's committed evidence
 * names its halves. Default NN list: 01..04.
 */
const sharp = require("sharp");
const path = require("path");

async function raw(p) {
  const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
  return { data, ch: info.channels, dims: [info.width, info.height] };
}

(async () => {
  const [a0, b0, ...pages] = process.argv.slice(2);
  if (!a0 || !b0) {
    console.error("usage: node scripts/print_raster_diff.js <beforeDir|prefix-NN.png> <afterDir|prefix-NN.png> [NN ...]");
    process.exit(2);
  }
  const list = pages.length ? pages : ["01", "02", "03", "04"];
  const resolve = (arg, pg) =>
    arg.includes("NN") ? arg.replace("NN", pg) : path.join(arg, `page-${pg}.png`);
  for (const pg of list) {
    const fa = resolve(a0, pg);
    const fb = resolve(b0, pg);
    const a = await raw(fa);
    const b = await raw(fb);
    if (a.dims.join("x") !== b.dims.join("x")) {
      console.log(`p${pg}: SIZE DIFFERS ${a.dims.join("x")} vs ${b.dims.join("x")}`);
      continue;
    }
    let sum = 0;
    let diff = 0;
    let n = 0;
    for (let k = 0; k < a.data.length; k += a.ch) {
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(a.data[k + c] - b.data[k + c]);
        sum += d;
        if (d > 8) diff++;
        n++;
      }
    }
    console.log(
      `p${pg}: meanDiff=${(sum / n).toFixed(3)} changedSamples=${((diff / n) * 100).toFixed(2)}%`,
    );
  }
})();
