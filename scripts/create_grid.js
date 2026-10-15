#!/usr/bin/env node
// create_grid.js - one-off: slice the demo sheet into a 10x10 tile grid under demo/ignored/grid, so
// a small region can be inspected at full resolution. Input and output directory are both absent.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createGrid() {
  const image = sharp('demo/ignored/sheet_archer.png');
  const metadata = await image.metadata();
  const rows = 10, cols = 10;
  const tileWidth = Math.floor(metadata.width / cols);
  const tileHeight = Math.floor(metadata.height / rows);

  const gridDir = 'demo/ignored/grid';
  if (!fs.existsSync(gridDir)) fs.mkdirSync(gridDir, { recursive: true });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tileWidth;
      const y = r * tileHeight;
      const tilePath = path.join(gridDir, `tile_${r}_${c}.png`);
      
      await sharp('demo/ignored/sheet_archer.png')
        .extract({ left: x, top: y, width: tileWidth, height: tileHeight })
        .toFile(tilePath);
    }
  }
}

createGrid().catch(console.error);
