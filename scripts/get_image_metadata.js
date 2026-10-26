#!/usr/bin/env node
// get_image_metadata.js - print sharp's metadata (dimensions, format, channels) for the image given
// on argv, defaulting to the demo sheet. Read-only and argument-driven.
const sharp = require('sharp');

async function getMetadata() {
  const inputFile = process.argv[2] || 'demo/ignored/sheet_archer.png';
  const metadata = await sharp(inputFile).metadata();
  console.log(JSON.stringify(metadata, null, 2));
}

getMetadata().catch(err => {
  console.error(err);
  process.exit(1);
});
