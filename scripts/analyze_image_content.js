const sharp = require('sharp');

async function analyzeImage() {
  const image = sharp('demo/ignored/sheet_archer.png');
  const metadata = await image.metadata();
  console.log(`Dimensions: ${metadata.width}x${metadata.height}`);

  // Get a small version to check for content
  const { data, info } = await image
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width, minY = info.height, maxX = 0, maxY = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const pixel = data[y * info.width + x];
      if (pixel < 250) { // Not white (assuming white background)
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`Content Bounding Box: (${minX}, ${minY}) to (${maxX}, ${maxY})`);
  console.log(`Content Dimensions: ${maxX - minX}x${maxY - minY}`);
}

analyzeImage().catch(console.error);
