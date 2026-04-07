const sharp = require('sharp');
const fs = require('fs');

async function extractBorders() {
  const input = 'demo/ignored/sheet_archer.png';
  const outDir = 'demo/ignored/extracted';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Main Header Border (Top center area usually)
  // Let's take the top middle part for the header asset
  await sharp(input)
    .extract({ left: 600, top: 0, width: 1500, height: 300 })
    .resize(1024)
    .toFile(`${outDir}/header_raw.png`);

  // Ability Score Box
  // Scratchpad: (25, 25) to (165, 175) on 1140x600? 
  // Scaled: x2.42, y2.5 -> (60, 62) to (400, 440)
  await sharp(input)
    .extract({ left: 60, top: 60, width: 340, height: 380 })
    .resize(512)
    .toFile(`${outDir}/ability_raw.png`);

  // Combat Stats (Crest)
  // Scratchpad: (370, 185) to (580, 680)
  // Scaled: (895, 460) to (1400, 1700)? Height is only 1504.
  // Maybe the scratchpad meant (370, 185) to (580, 400) or similar.
  // Let's take the center area.
  await sharp(input)
    .extract({ left: 1000, top: 400, width: 600, height: 600 })
    .resize(512)
    .toFile(`${outDir}/stats_raw.png`);

  // Footer
  await sharp(input)
    .extract({ left: 600, top: 1200, width: 1500, height: 300 })
    .resize(1024)
    .toFile(`${outDir}/footer_raw.png`);
    
  console.log('Borders extracted.');
}

extractBorders().catch(console.error);
