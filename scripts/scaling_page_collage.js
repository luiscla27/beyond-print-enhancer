"use strict";
/**
 * A side-by-side of the SAME printed page, before vs after the scaling wiring, for the
 * visual reviewer. `sharp` composes the two rasters with a labelled gutter, at native resolution,
 * so the reviewer is looking at real pixels of both states rather than a description of them.
 *
 *   node scripts/scaling_page_collage.js <beforeDir> <afterDir> <out.png> [page]
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

(async () => {
  // Usage: two FILE paths, not dirs — the committed evidence names its halves.
  const [b, a, out] = process.argv.slice(2);
  for (const f of [b, a]) if (!fs.existsSync(f)) throw new Error("missing " + f);
  const meta = await sharp(b).metadata();
  const gap = 24;
  const W = meta.width * 2 + gap;
  const left = await sharp(b).png().toBuffer();
  const right = await sharp(a).png().toBuffer();
  await sharp({
    create: { width: W, height: meta.height, channels: 3, background: "#888888" },
  })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: meta.width + gap, top: 0 },
    ])
    .png()
    .toFile(out);
  console.log(
    `wrote ${out} (${W}x${meta.height})  left=BEFORE ${path.basename(b)}  right=AFTER ${path.basename(a)}`,
  );
})();
