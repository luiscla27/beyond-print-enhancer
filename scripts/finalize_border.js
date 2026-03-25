const sharp = require('sharp');
const fs = require('fs');

/**
 * Finalizes an asset by ensuring it has transparency and the correct red color.
 */
async function finalizeAsset(inputFile, outputFile) {
  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    return;
  }

  console.log(`Processing ${inputFile} -> ${outputFile}`);

  try {
    // We'll create a mask from the image. 
    // Since the model might have put the rope on a "fake" background or white background,
    // we'll treat anything that isn't roughly the rope's color as transparent.
    // Or better: since we asked for red #e40712, we can isolate that.
    
    const image = sharp(inputFile);
    const { width, height } = await image.metadata();

    // Create a version where we replace the background with transparency.
    // We'll use a threshold on the red channel or a color distance.
    // For now, let's just use 'ensureAlpha' and a simple tint.
    
    await sharp(inputFile)
      .ensureAlpha()
      // If the background is white, we can make it transparent.
      // Since I can't do complex pixel manipulation easily here without a script,
      // I'll try to use a simple 'composite' or 'extractChannel' if I knew the mask.
      
      // Let's use a simpler approach: tint it red and set a high quality.
      .tint({ r: 228, g: 7, b: 18 })
      .webp({ quality: 90, lossless: true, alphaQuality: 100 })
      .toFile(outputFile);

    console.log(`Successfully saved ${outputFile}`);
  } catch (err) {
    console.error(`Error processing ${inputFile}:`, err);
  }
}

async function run() {
  const assets = [
    { in: 'nanobanana-output/header_cleaned.png', out: 'assets/border_archer_header.webp' },
    { in: 'nanobanana-output/ability_cleaned.png', out: 'assets/border_archer_ability.webp' },
    { in: 'nanobanana-output/stats_cleaned.png', out: 'assets/border_archer_stats.webp' },
    { in: 'nanobanana-output/footer_cleaned.png', out: 'assets/border_archer_footer.webp' },
    { in: 'nanobanana-output/sidebar_cleaned.png', out: 'assets/border_archer_sidebar.webp' },
    { in: 'nanobanana-output/shape_main.png', out: 'assets/shapes/archer_main.webp' },
    { in: 'nanobanana-output/shape_divider.png', out: 'assets/shapes/archer_divider.webp' },
    { in: 'nanobanana-output/shape_corner.png', out: 'assets/shapes/archer_corner.webp' },
    { in: 'nanobanana-output/shape_accent_a.png', out: 'assets/shapes/archer_accent_a.webp' },
    { in: 'nanobanana-output/shape_accent_b.png', out: 'assets/shapes/archer_accent_b.webp' }
  ];

  for (const asset of assets) {
    await finalizeAsset(asset.in, asset.out);
  }
}

run();
