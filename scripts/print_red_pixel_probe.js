"use strict";
/**
 * Counts STRONGLY-RED pixels in each printed-page raster and reports their bounding box, so a claim
 * about a red mark on paper is a measurement rather than a reading. Built to check what the visual
 * gate flagged on page 4 of the responsive-scaling comparison (issue
 * responsive_scaling_observer_never_observed_20260912 -> vendor/docs/responsive-scaling-wiring-20260913).
 *
 *   node scripts/print_red_pixel_probe.js <raster.png> [...]
 */
const sharp = require("sharp");
const path = require("path");

async function redStats(f) {
  const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
  let red = 0;
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let k = 0; k < data.length; k += info.channels) {
    const r = data[k], g = data[k + 1], b = data[k + 2];
    if (r > 120 && r - g > 60 && r - b > 60) {
      red++;
      const px = (k / info.channels) % info.width;
      const py = Math.floor(k / info.channels / info.width);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
  }
  return { file: path.basename(f), red, box: red ? [minX, minY, maxX, maxY] : null, dims: [info.width, info.height] };
}

(async () => {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('usage: node scripts/print_red_pixel_probe.js <raster.png> [...]');
    process.exit(2);
  }
  for (const f of files) console.log(JSON.stringify(await redStats(f)));
})();
